#!/usr/bin/env python3
"""BTree Studio - local server.

Serves the web interface and bridges the things a browser cannot do alone:
  * reading a serial port (UART) through pyserial (optional dependency);
  * reading a TCP socket (SEGGER RTT over SWD via OpenOCD / J-Link / pyOCD gdbserver);
  * reading SEGGER RTT straight from a J-Link probe over SWD (pylink, optional dependency);
  * reading the stdout of an external command (e.g. `pyocd rtt`, `probe-rs attach`);
  * saving the workspace (projects) to disk;
  * running the C code generator from ../Scripts.

Only the Python standard library is required. Run:  python3 studio.py
"""

import argparse
import json
import os
import queue
import re
import shlex
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

try:
    import serial
    import serial.tools.list_ports

    SERIAL_AVAILABLE = True
except ImportError:  # pragma: no cover - depends on the environment
    SERIAL_AVAILABLE = False

try:
    import pylink  # pip install pylink-square (also needs the SEGGER J-Link software installed)

    JLINK_AVAILABLE = hasattr(pylink, "JLink")  # an unrelated PyPI package is also called "pylink"
except ImportError:  # pragma: no cover - depends on the environment
    JLINK_AVAILABLE = False

VERSION = "3.0.0"
FROZEN = getattr(sys, "frozen", False)  # running as a PyInstaller executable
BASE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
FRONTEND_DIR = BASE_DIR / "frontend"
SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "Scripts"
DEFAULT_WORKSPACE = (Path.home() / "BTreeStudio") if FROZEN else (BASE_DIR / "workspace")
PROJECT_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")


# --------------------------------------------------------------------------- #
# Event hub (Server-Sent Events)
# --------------------------------------------------------------------------- #
class EventHub:
    """Fan-out of events to every connected browser (one queue per client)."""

    def __init__(self):
        self._clients = []
        self._lock = threading.Lock()

    def subscribe(self):
        q = queue.Queue(maxsize=5000)
        with self._lock:
            self._clients.append(q)
        return q

    def unsubscribe(self, q):
        with self._lock:
            if q in self._clients:
                self._clients.remove(q)

    def publish(self, event):
        data = json.dumps(event, ensure_ascii=False)
        with self._lock:
            clients = list(self._clients)
        for q in clients:
            try:
                q.put_nowait(data)
            except queue.Full:
                pass


HUB = EventHub()


# --------------------------------------------------------------------------- #
# Data sources
# --------------------------------------------------------------------------- #
class LineSource:
    """Base class: a background thread that turns a byte stream into lines."""

    kind = "none"

    def __init__(self):
        self.running = False
        self.thread = None
        self.error = None
        self.description = ""

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False

    def send(self, data: bytes):
        raise RuntimeError("Esta fonte não aceita envio de dados.")

    def _read_chunk(self):
        raise NotImplementedError

    def _run(self):
        buf = b""
        while self.running:
            try:
                chunk = self._read_chunk()
            except Exception as exc:  # device unplugged, socket closed, ...
                if self.running:
                    self.error = str(exc)
                    HUB.publish({"type": "status", "connected": False, "error": self.error})
                self.running = False
                break
            if chunk is None:  # end of stream
                if self.running:
                    HUB.publish({"type": "status", "connected": False, "error": "Fonte encerrada."})
                self.running = False
                break
            if not chunk:
                continue
            buf += chunk
            while True:
                idx = buf.find(b"\n")
                if idx < 0:
                    break
                line, buf = buf[:idx], buf[idx + 1 :]
                text = line.decode("utf-8", errors="replace").rstrip("\r")
                HUB.publish({"type": "line", "text": text, "t": time.time()})
            if len(buf) > 8192:  # device that never sends '\n'
                HUB.publish({"type": "line", "text": buf.decode("utf-8", errors="replace"), "t": time.time()})
                buf = b""
        self._close()

    def _close(self):
        pass


class SerialSource(LineSource):
    kind = "serial"

    def __init__(self, port, baudrate):
        super().__init__()
        if not SERIAL_AVAILABLE:
            raise RuntimeError("pyserial não está instalado (pip install pyserial).")
        self.ser = serial.Serial(port, baudrate=baudrate, timeout=0.1)
        self.description = f"{port} @ {baudrate}"

    def _read_chunk(self):
        n = self.ser.in_waiting or 1
        return self.ser.read(n)

    def send(self, data):
        self.ser.write(data)

    def _close(self):
        try:
            self.ser.close()
        except Exception:
            pass


class TcpSource(LineSource):
    kind = "tcp"

    def __init__(self, host, port):
        super().__init__()
        self.sock = socket.create_connection((host, int(port)), timeout=5)
        self.sock.settimeout(0.2)
        self.description = f"tcp://{host}:{port}"

    def _read_chunk(self):
        try:
            data = self.sock.recv(4096)
        except socket.timeout:
            return b""
        return data if data else None

    def send(self, data):
        self.sock.sendall(data)

    def stop(self):
        super().stop()
        self._close()

    def _close(self):
        try:
            self.sock.close()
        except Exception:
            pass


class JLinkSource(LineSource):
    """SEGGER RTT read directly from a J-Link over SWD (no J-Link Commander / TCP server needed)."""

    kind = "jlink"

    def __init__(self, device, serial_no=None, speed=4000, rtt_address=None, channel=0):
        super().__init__()
        if not JLINK_AVAILABLE:
            raise RuntimeError("pylink não está instalado (pip install pylink-square) ou o software J-Link da SEGGER está ausente.")
        if not device:
            raise RuntimeError("Informe o dispositivo (ex.: STM32F411RE, nRF52840_xxAA).")
        self.lock = threading.Lock()  # reader thread and /api/send share the DLL
        self.channel = int(channel)
        self.jl = pylink.JLink()
        try:
            self.jl.open(serial_no=int(serial_no) if serial_no else None)
            self.jl.set_tif(pylink.enums.JLinkInterfaces.SWD)
            self.jl.connect(device, speed=int(speed or 4000))
            self.jl.rtt_start(int(str(rtt_address), 0) if rtt_address else None)
            deadline = time.time() + 5
            while True:  # the DLL scans RAM for the "SEGGER RTT" control block in the background
                try:
                    if self.jl.rtt_get_num_up_buffers() > 0:
                        break
                except pylink.errors.JLinkRTTException:
                    pass
                if time.time() > deadline:
                    raise RuntimeError("Bloco de controle RTT não encontrado. O firmware usa SEGGER RTT? Informe o endereço de _SEGGER_RTT (arquivo .map).")
                time.sleep(0.1)
        except Exception:
            self._close()
            raise
        self.description = f"J-Link {self.jl.serial_number} · {device} · SWD {int(speed or 4000)} kHz · RTT {self.channel}"

    def _read_chunk(self):
        with self.lock:
            data = self.jl.rtt_read(self.channel, 4096)
        if not data:
            time.sleep(0.01)
            return b""
        return bytes(data)

    def send(self, data):
        with self.lock:
            self.jl.rtt_write(self.channel, list(data))

    def _close(self):
        for fn in (self.jl.rtt_stop, self.jl.close):
            try:
                fn()
            except Exception:
                pass


def list_jlink_probes():
    if not JLINK_AVAILABLE:
        return []
    try:
        return [{"serial": e.SerialNumber, "product": e.acProduct.decode(errors="replace") if isinstance(e.acProduct, bytes) else str(e.acProduct)}
                for e in pylink.JLink().connected_emulators()]
    except Exception:  # DLL missing: report as no probes
        return []


class ProcessSource(LineSource):
    kind = "process"

    def __init__(self, command):
        super().__init__()
        args = shlex.split(command, posix=os.name != "nt")
        if not args:
            raise RuntimeError("Comando vazio.")
        self.proc = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.PIPE,
            bufsize=0,
        )
        self.description = command

    def _read_chunk(self):
        data = self.proc.stdout.readline()
        return data if data else None

    def send(self, data):
        self.proc.stdin.write(data)
        self.proc.stdin.flush()

    def stop(self):
        super().stop()
        self._close()

    def _close(self):
        try:
            self.proc.terminate()
            self.proc.wait(timeout=2)
        except Exception:
            try:
                self.proc.kill()
            except Exception:
                pass
        for pipe in (self.proc.stdout, self.proc.stdin):
            try:
                pipe.close()
            except Exception:
                pass


class Bridge:
    def __init__(self):
        self.source = None
        self.lock = threading.Lock()

    def connect(self, cfg):
        with self.lock:
            self._disconnect_locked()
            kind = cfg.get("kind")
            if kind == "serial":
                src = SerialSource(cfg["port"], int(cfg.get("baudrate") or 115200))
            elif kind == "tcp":
                src = TcpSource(cfg.get("host") or "127.0.0.1", int(cfg.get("port") or 9090))
            elif kind == "jlink":
                src = JLinkSource(cfg.get("device"), cfg.get("serial"), cfg.get("speed") or 4000, cfg.get("rttAddress"))
            elif kind == "process":
                src = ProcessSource(cfg.get("command") or "")
            else:
                raise RuntimeError(f"Tipo de conexão desconhecido: {kind}")
            src.start()
            self.source = src
        HUB.publish({"type": "status", **self.status()})

    def _disconnect_locked(self):
        if self.source is not None:
            self.source.stop()
            self.source = None

    def disconnect(self):
        with self.lock:
            self._disconnect_locked()
        HUB.publish({"type": "status", **self.status()})

    def send(self, text):
        with self.lock:
            if self.source is None or not self.source.running:
                raise RuntimeError("Nenhuma fonte conectada.")
            self.source.send(text.encode("utf-8"))

    def status(self):
        src = self.source
        connected = bool(src and src.running)
        return {
            "connected": connected,
            "kind": src.kind if src else None,
            "description": src.description if src else "",
            "error": src.error if src else None,
        }


BRIDGE = Bridge()


def list_dirs(path):
    """Folders inside `path` (for the output folder picker). Defaults to the workspace."""
    base = Path(path).expanduser() if path else WORKSPACE.root
    base = base.resolve()
    while not base.is_dir() and base != base.parent:
        base = base.parent
    dirs = []
    try:
        for d in sorted(base.iterdir(), key=lambda x: x.name.lower()):
            if d.is_dir() and not d.name.startswith("."):
                dirs.append(d.name)
    except PermissionError:
        pass
    return {"path": str(base), "parent": str(base.parent) if base.parent != base else None,
            "home": str(Path.home()), "workspace": str(WORKSPACE.root), "dirs": dirs}


def list_serial_ports():
    if not SERIAL_AVAILABLE:
        return []
    real, legacy = [], []
    for p in serial.tools.list_ports.comports():
        entry = {"device": p.device, "description": p.description or "", "hwid": p.hwid or ""}
        # Linux lists every legacy /dev/ttyS* with no hardware behind it ("n/a"): keep the real
        # ports (USB adapters, boards) first and drop the empty ones when a real port exists.
        (legacy if (p.hwid or "n/a") == "n/a" else real).append(entry)
    real.sort(key=lambda e: e["device"])
    return real or legacy


# --------------------------------------------------------------------------- #
# Workspace on disk:  <workspace>/<Project>/<Project>.xml  (+ project.btproj)
# --------------------------------------------------------------------------- #
class Workspace:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _project_dir(self, name):
        if not PROJECT_NAME_RE.match(name or ""):
            raise RuntimeError("Nome de projeto inválido (use letras, números e _).")
        return self.root / name

    def list(self):
        projects = []
        for d in sorted(self.root.iterdir()):
            xml = d / f"{d.name}.xml"
            if d.is_dir() and xml.is_file():
                meta = {}
                meta_file = d / "studio.json"
                if meta_file.is_file():
                    try:
                        meta = json.loads(meta_file.read_text(encoding="utf-8"))
                    except Exception:
                        meta = {}
                projects.append(
                    {
                        "name": d.name,
                        "xml": xml.read_text(encoding="utf-8"),
                        "meta": meta,
                        "modified": xml.stat().st_mtime,
                    }
                )
        return projects

    def save(self, name, xml, meta):
        d = self._project_dir(name)
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{name}.xml").write_text(xml, encoding="utf-8")
        (d / "studio.json").write_text(json.dumps(meta or {}, indent=2, ensure_ascii=False), encoding="utf-8")
        btproj = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<root BTCPP_format="4" project_name="{name}">\n'
            f'    <include path="{name}.xml"/>\n'
            "    <!-- Description of Node Models (used by Groot) -->\n"
            "    <TreeNodesModel/>\n"
            "</root>\n"
        )
        (d / f"{name}.btproj").write_text(btproj, encoding="utf-8")
        return str(d)

    def delete(self, name):
        d = self._project_dir(name)
        if d.is_dir():
            shutil.rmtree(d)

    def rename(self, old, new):
        src = self._project_dir(old)
        dst = self._project_dir(new)
        if dst.exists():
            raise RuntimeError(f"Já existe um projeto chamado {new}.")
        if src.is_dir():
            src.rename(dst)
            for suffix in (".xml", ".btproj"):
                f = dst / f"{old}{suffix}"
                if f.exists():
                    f.rename(dst / f"{new}{suffix}")


WORKSPACE = None


# --------------------------------------------------------------------------- #
# C code generation through ../Scripts/btree_array_creator.py
# --------------------------------------------------------------------------- #
GENERATOR_SNIPPET = r"""
import sys
from btree_array_creator import BTREE_ARRAY
archive, output, main_tree, project, author, email, version, copyrights, prefix = sys.argv[1:10]
x = BTREE_ARRAY()
x.set_archive_data(author, email, version, copyrights, project, prefix=prefix or None)
x.create_trees(archive=archive, output=output, main_tree=main_tree)
print("OK")
"""


C_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def generate_code(payload):
    """Runs Scripts/ for one project. Layout of <output>:
    src/btree_<p>/ and include/btree_<p>/ (your code: trees and blackboard),
    tools/btree_<p>/ (array, common and the XML). With dryRun the files are generated in a
    temporary folder only to list them, marking the ones that already exist in <output>."""
    if not (SCRIPTS_DIR / "btree_array_creator.py").is_file():
        raise RuntimeError(f"Gerador não encontrado em {SCRIPTS_DIR}.")
    project = payload["project"]
    if not PROJECT_NAME_RE.match(project) or not C_IDENT_RE.match(project):
        raise RuntimeError("Nome de projeto inválido para gerar código C (use letras, números e _).")
    prefix = (payload.get("prefix") or "").strip()
    if prefix and not C_IDENT_RE.match(prefix):
        raise RuntimeError("Prefixo inválido: use letras, números e _ (sem começar com número).")
    output = payload.get("output") or str(WORKSPACE.root / project / "generated")
    output = str(Path(output).expanduser().resolve())
    if payload.get("dryRun"):
        with tempfile.TemporaryDirectory() as tmp:
            res = generate_code({**payload, "dryRun": False, "output": tmp})
        files = [{"path": f, "exists": os.path.exists(os.path.join(output, f))} for f in res["files"]]
        return {"output": output, "files": files, "dryRun": True}
    python = sys.executable
    if FROZEN:  # inside the executable there is no interpreter: use the system Python
        python = shutil.which("python3") or shutil.which("python")
        if not python:
            raise RuntimeError("Python não encontrado no PATH (necessário para o gerador de código C).")
    with tempfile.TemporaryDirectory() as tmp:
        xml_path = Path(tmp) / f"{project}.xml"  # copied to tools/btree_<p>/<project>.xml
        xml_path.write_text(payload["xml"], encoding="utf-8")
        proc = subprocess.run(
            [
                python,
                "-c",
                GENERATOR_SNIPPET,
                str(xml_path),
                output,
                payload["mainTree"],
                project,
                payload.get("author") or "BTree Studio",
                payload.get("email") or "",
                payload.get("version") or "1.0",
                payload.get("copyright") or "",
                prefix,
            ],
            cwd=str(SCRIPTS_DIR),
            capture_output=True,
            text=True,
            timeout=60,
        )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "Falha no gerador").strip()[-2000:])
    files = []
    for root, _dirs, names in os.walk(output):
        for n in names:
            files.append(os.path.relpath(os.path.join(root, n), output))
    return {"output": output, "files": sorted(files), "log": proc.stdout[-2000:]}


# --------------------------------------------------------------------------- #
# HTTP handler
# --------------------------------------------------------------------------- #
class Handler(SimpleHTTPRequestHandler):
    server_version = f"BTreeStudio/{VERSION}"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def log_message(self, fmt, *args):  # keep the console quiet
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # ---- helpers -------------------------------------------------------- #
    def _json(self, obj, status=HTTPStatus.OK):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, message, status=HTTPStatus.BAD_REQUEST):
        self._json({"ok": False, "error": message}, status)

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    # ---- routes --------------------------------------------------------- #
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/info":
            return self._json(
                {
                    "ok": True,
                    "version": VERSION,
                    "serialAvailable": SERIAL_AVAILABLE,
                    "jlinkAvailable": JLINK_AVAILABLE,
                    "workspace": str(WORKSPACE.root),
                    "generatorAvailable": (SCRIPTS_DIR / "btree_array_creator.py").is_file(),
                    "bridge": BRIDGE.status(),
                }
            )
        if path == "/api/serial/ports":
            return self._json({"ok": True, "available": SERIAL_AVAILABLE, "ports": list_serial_ports()})
        if path == "/api/jlink/probes":
            return self._json({"ok": True, "available": JLINK_AVAILABLE, "probes": list_jlink_probes()})
        if path == "/api/fs/dirs":
            q = parse_qs(urlparse(self.path).query)
            return self._json({"ok": True, **list_dirs((q.get("path") or [""])[0])})
        if path == "/api/workspace":
            return self._json({"ok": True, "root": str(WORKSPACE.root), "projects": WORKSPACE.list()})
        if path == "/api/events":
            return self._sse()
        if path.startswith("/api/"):
            return self._error("Rota desconhecida.", HTTPStatus.NOT_FOUND)
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self._body()
            if path == "/api/connect":
                BRIDGE.connect(body)
                return self._json({"ok": True, **BRIDGE.status()})
            if path == "/api/disconnect":
                BRIDGE.disconnect()
                return self._json({"ok": True})
            if path == "/api/send":
                BRIDGE.send(body.get("data", ""))
                return self._json({"ok": True})
            if path == "/api/log":
                # Lets any other tool inject log lines: curl -d '{"line":"..."}'
                lines = body.get("lines") or [body.get("line", "")]
                for line in lines:
                    HUB.publish({"type": "line", "text": str(line), "t": time.time()})
                return self._json({"ok": True})
            if path == "/api/project/save":
                where = WORKSPACE.save(body["name"], body["xml"], body.get("meta"))
                return self._json({"ok": True, "path": where})
            if path == "/api/project/delete":
                WORKSPACE.delete(body["name"])
                return self._json({"ok": True})
            if path == "/api/project/rename":
                WORKSPACE.rename(body["old"], body["new"])
                return self._json({"ok": True})
            if path == "/api/fs/mkdir":
                target = Path(body["path"]).expanduser().resolve()
                target.mkdir(parents=True, exist_ok=True)
                return self._json({"ok": True, "path": str(target)})
            if path == "/api/generate":
                return self._json({"ok": True, **generate_code(body)})
        except Exception as exc:
            return self._error(str(exc))
        return self._error("Rota desconhecida.", HTTPStatus.NOT_FOUND)

    def _sse(self):
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        q = HUB.subscribe()
        try:
            hello = json.dumps({"type": "status", **BRIDGE.status()})
            self.wfile.write(f"data: {hello}\n\n".encode("utf-8"))
            self.wfile.flush()
            while True:
                try:
                    data = q.get(timeout=15)
                    chunk = f"data: {data}\n\n"
                except queue.Empty:
                    chunk = ": keep-alive\n\n"
                self.wfile.write(chunk.encode("utf-8"))
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            HUB.unsubscribe(q)


def main():
    global WORKSPACE, SCRIPTS_DIR
    parser = argparse.ArgumentParser(description="BTree Studio - editor e depurador de Behavior Trees embarcadas")
    parser.add_argument("--host", default="127.0.0.1", help="endereço de escuta (padrão 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="porta HTTP (padrão 8765)")
    parser.add_argument("--workspace", default=str(DEFAULT_WORKSPACE), help="pasta do workspace")
    parser.add_argument("--scripts", default=None, help="pasta Scripts/ do Embedded-Behavior-Tree (gerador de código C)")
    parser.add_argument("--no-browser", action="store_true", help="não abrir o navegador automaticamente")
    args = parser.parse_args()

    WORKSPACE = Workspace(Path(args.workspace).expanduser().resolve())
    if args.scripts:
        SCRIPTS_DIR = Path(args.scripts).expanduser().resolve()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    httpd.daemon_threads = True
    url = f"http://{'localhost' if args.host in ('127.0.0.1', '0.0.0.0') else args.host}:{args.port}"
    print(f"BTree Studio {VERSION}")
    print(f"  Interface : {url}")
    print(f"  Workspace : {WORKSPACE.root}")
    print(f"  Serial    : {'pyserial OK' if SERIAL_AVAILABLE else 'pyserial ausente (pip install pyserial)'}")
    print(f"  J-Link    : {'pylink OK' if JLINK_AVAILABLE else 'pylink ausente (pip install pylink-square)'}")
    gen_ok = (SCRIPTS_DIR / "btree_array_creator.py").is_file()
    print(f"  Gerador C : {SCRIPTS_DIR if gen_ok else 'indisponível (use --scripts <pasta Scripts>)'}")
    print("  Ctrl+C para encerrar.")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        BRIDGE.disconnect()
        httpd.server_close()


if __name__ == "__main__":
    main()

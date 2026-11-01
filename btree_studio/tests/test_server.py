"""Tests for studio.py (standard library only). Run: python3 tests/test_server.py"""
import json
import sys
import tempfile
import threading
import time
import unittest
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import studio  # noqa: E402

XML = """<?xml version="1.0" encoding="UTF-8"?>
<root BTCPP_format="4" main_tree_to_execute="main">
  <BehaviorTree ID="main">
    <Sequence>
      <ScriptCondition code="ready"/>
      <Script code="go"/>
      <Sleep msec="10"/>
    </Sequence>
  </BehaviorTree>
</root>
"""


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        studio.WORKSPACE = studio.Workspace(Path(cls.tmp.name) / "ws")
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), studio.Handler)
        cls.httpd.daemon_threads = True
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.tmp.cleanup()

    def call(self, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(self.base + path, data=data, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            return json.loads(e.read())

    def test_index_served(self):
        with urllib.request.urlopen(self.base + "/", timeout=5) as r:
            self.assertIn(b"BTree Studio", r.read())

    def test_info(self):
        info = self.call("/api/info")
        self.assertTrue(info["ok"])
        self.assertIn("serialAvailable", info)

    def test_workspace_crud(self):
        self.assertTrue(self.call("/api/project/save", {"name": "demo", "xml": XML, "meta": {"logName": "DEMO"}})["ok"])
        projects = self.call("/api/workspace")["projects"]
        self.assertEqual([p["name"] for p in projects], ["demo"])
        self.assertEqual(projects[0]["meta"]["logName"], "DEMO")
        self.assertTrue((studio.WORKSPACE.root / "demo" / "demo.btproj").is_file())
        self.assertTrue(self.call("/api/project/rename", {"old": "demo", "new": "demo2"})["ok"])
        self.assertTrue((studio.WORKSPACE.root / "demo2" / "demo2.xml").is_file())
        self.assertFalse(self.call("/api/project/save", {"name": "../evil", "xml": XML})["ok"])
        self.assertTrue(self.call("/api/project/delete", {"name": "demo2"})["ok"])
        self.assertEqual(self.call("/api/workspace")["projects"], [])

    def test_log_injection_reaches_sse(self):
        got = []

        def listen():
            with urllib.request.urlopen(self.base + "/api/events", timeout=5) as r:
                for raw in r:
                    line = raw.decode().strip()
                    if line.startswith("data:"):
                        ev = json.loads(line[5:])
                        if ev["type"] == "line":
                            got.append(ev["text"])
                            return

        t = threading.Thread(target=listen, daemon=True)
        t.start()
        time.sleep(0.3)
        self.call("/api/log", {"line": "[BTREE] | Tree: DEMO | Node: 0 | Status: Running | Type: Condition"})
        t.join(3)
        self.assertEqual(got, ["[BTREE] | Tree: DEMO | Node: 0 | Status: Running | Type: Condition"])

    def test_process_source_lines(self):
        q = studio.HUB.subscribe()
        try:
            cmd = f'"{sys.executable}" -c "print(\'hello\'); print(\'[BTREE] | Tree: X | Node: 1 | Status: Fail | Type: Action\')"'
            res = self.call("/api/connect", {"kind": "process", "command": cmd})
            self.assertTrue(res["ok"], res)
            lines = []
            deadline = time.time() + 5
            while time.time() < deadline and len(lines) < 2:
                try:
                    ev = json.loads(q.get(timeout=0.5))
                except Exception:
                    continue
                if ev["type"] == "line":
                    lines.append(ev["text"])
            self.assertEqual(lines[0], "hello")
            self.assertIn("Status: Fail", lines[1])
        finally:
            studio.HUB.unsubscribe(q)
            self.call("/api/disconnect", {})

    @unittest.skipUnless((studio.SCRIPTS_DIR / "btree_array_creator.py").is_file(), "Scripts/ não encontrado")
    def test_generate_code(self):
        out = Path(self.tmp.name) / "gen"
        res = self.call("/api/generate", {"project": "demo", "mainTree": "main", "xml": XML, "output": str(out)})
        self.assertTrue(res["ok"], res)
        array = next(out.rglob("btree_demo_array.c")).read_text()
        self.assertIn("BTREE_DEFINITION_CREATE_NODE_CONDITION", array)
        self.assertIn("BTREE_DEFINITION_CREATE_NODE_ACTION_SLEEP", array)

    def test_generate_layout_header_and_prefix(self):
        out = Path(self.tmp.name) / "gen2"
        req = {"project": "demo", "mainTree": "main", "xml": XML, "output": str(out), "author": "Ana",
               "email": "ana@x.com", "version": "3.2", "copyright": "ACME", "prefix": "acme"}
        dry = self.call("/api/generate", {**req, "dryRun": True})
        self.assertTrue(dry["ok"], dry)
        self.assertFalse(out.exists(), "dry run must not write anything")
        paths = sorted(f["path"] for f in dry["files"])
        self.assertEqual(paths, sorted([
            "tools/btree_demo/btree_demo_array.c", "tools/btree_demo/btree_demo_array.h",
            "tools/btree_demo/btree_demo_common.c", "tools/btree_demo/btree_demo_common.h", "tools/btree_demo/demo.xml",
            "include/btree_demo/btree_demo_blackboard.h", "include/btree_demo/btree_demo_main.h",
            "src/btree_demo/btree_demo_blackboard.c", "src/btree_demo/btree_demo_main.c"]))
        self.assertTrue(all(not f["exists"] for f in dry["files"]))
        res = self.call("/api/generate", req)
        self.assertTrue(res["ok"], res)
        src = (out / "src/btree_demo/btree_demo_main.c").read_text()
        self.assertIn("@author Ana (ana@x.com)", src)
        self.assertIn("@version 3.2", src)
        self.assertIn("ACME", src)
        self.assertIn("acme_btree_demo_main_go(void)", src)
        self.assertIn("&acme_btree_demo_main_go", (out / "tools/btree_demo/btree_demo_array.c").read_text())
        self.assertIn('code="go"', (out / "tools/btree_demo/demo.xml").read_text())
        again = self.call("/api/generate", {**req, "dryRun": True})
        self.assertTrue(all(f["exists"] for f in again["files"]))

    def test_regenerate_keeps_user_code(self):
        out = Path(self.tmp.name) / "gen3"
        req = {"project": "demo", "mainTree": "main", "xml": XML, "output": str(out)}
        self.assertTrue(self.call("/api/generate", req)["ok"])
        src = out / "src/btree_demo/btree_demo_main.c"
        text = src.read_text().replace("btree_demo_main_go(void)\n{\n  return BTREE_DEFINITION_STATUS_SUCCESS;",
                                       "btree_demo_main_go(void)\n{\n  motor_on(); /* mine */\n  return BTREE_DEFINITION_STATUS_STAND_BY;")
        src.write_text(text)
        more = XML.replace('<Script code="go"/>', '<Script code="go"/>\n      <Script code="stop"/>')
        self.assertTrue(self.call("/api/generate", {**req, "xml": more})["ok"])
        after = src.read_text()
        self.assertTrue(after.startswith(text), "the user file must be kept as it was")
        self.assertIn("btree_demo_main_stop(void)", after[len(text):])
        self.assertEqual(after.count("motor_on();"), 1)
        self.assertIn("btree_demo_main_stop(void);", (out / "include/btree_demo/btree_demo_main.h").read_text())
        self.assertIn("&btree_demo_main_stop", (out / "tools/btree_demo/btree_demo_array.c").read_text())
        self.assertTrue(self.call("/api/generate", {**req, "xml": more})["ok"])
        self.assertEqual(src.read_text(), after, "generating twice must not change anything")

    def test_generate_rejects_bad_names(self):
        for bad in ({"project": "9demo"}, {"project": "demo", "prefix": "a-b"}):
            res = self.call("/api/generate", {"mainTree": "main", "xml": XML, "output": self.tmp.name, **bad})
            self.assertFalse(res["ok"])

    def test_folder_browser(self):
        base = Path(self.tmp.name) / "browse"
        (base / "alpha").mkdir(parents=True)
        (base / ".hidden").mkdir()
        res = self.call("/api/fs/dirs?path=" + urllib.parse.quote(str(base)))
        self.assertEqual(res["dirs"], ["alpha"])
        self.assertEqual(res["parent"], str(base.parent))
        made = self.call("/api/fs/mkdir", {"path": str(base / "novo")})
        self.assertTrue(made["ok"] and (base / "novo").is_dir())


if __name__ == "__main__":
    unittest.main(verbosity=2)

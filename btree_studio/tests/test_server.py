"""Tests for studio.py (standard library only). Run: python3 tests/test_server.py"""
import json
import sys
import tempfile
import threading
import time
import unittest
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


if __name__ == "__main__":
    unittest.main(verbosity=2)

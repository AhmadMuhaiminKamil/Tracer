import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from tracer_sessions import (
    clip_history,
    delete_session,
    load_sessions,
    new_session,
    save_session,
    touch_session,
)


class SessionStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_load_missing_returns_empty(self):
        self.assertEqual(load_sessions(self.root), [])

    def test_save_and_load_roundtrip(self):
        s = new_session(self.root, "Kenapa BUKA naik?")
        save_session(self.root, s)
        loaded = load_sessions(self.root)
        self.assertEqual(len(loaded), 1)
        self.assertEqual(loaded[0]["title"], "Kenapa BUKA naik?")
        self.assertEqual(loaded[0]["id"], s["id"])

    def test_save_updates_in_place_most_recent_first(self):
        a = new_session(self.root, "A")
        b = new_session(self.root, "B")
        save_session(self.root, a)
        save_session(self.root, b)
        self.assertEqual([s["title"] for s in load_sessions(self.root)], ["B", "A"])
        a["title"] = "A2"
        save_session(self.root, a)
        self.assertEqual([s["title"] for s in load_sessions(self.root)], ["A2", "B"])

    def test_corrupt_lines_skipped(self):
        path = self.root / "data" / "cli_sessions.jsonl"
        path.parent.mkdir(parents=True)
        good = new_session(self.root, "ok")
        path.write_text("NOT JSON\n" + json.dumps(good) + "\n")
        loaded = load_sessions(self.root)
        self.assertEqual(len(loaded), 1)
        self.assertEqual(loaded[0]["title"], "ok")

    def test_touch_renames_placeholder_and_bumps(self):
        s = new_session(self.root)
        self.assertEqual(s["title"], "Sesi baru")
        touch_session(self.root, s, question="Halo dunia")
        self.assertEqual(s["title"], "Halo dunia")
        touch_session(self.root, s, question="pertanyaan kedua")
        self.assertEqual(s["title"], "Halo dunia")  # real title survives

    def test_touch_persists_history(self):
        s = new_session(self.root)
        s["history"] = [{"role": "user", "content": "q"}]
        touch_session(self.root, s)
        loaded = load_sessions(self.root)
        self.assertEqual(loaded[0]["history"], [{"role": "user", "content": "q"}])

    def test_delete_removes_only_target(self):
        a = new_session(self.root, "A")
        b = new_session(self.root, "B")
        save_session(self.root, a)
        save_session(self.root, b)
        delete_session(self.root, a["id"])
        titles = [s["title"] for s in load_sessions(self.root)]
        self.assertEqual(titles, ["B"])
        delete_session(self.root, b["id"])
        self.assertEqual(load_sessions(self.root), [])
        self.assertFalse((self.root / "data" / "cli_sessions.jsonl").exists())

    def test_cap_30(self):
        for i in range(35):
            save_session(self.root, new_session(self.root, f"q{i}"))
        self.assertEqual(len(load_sessions(self.root)), 30)

    def test_clip_history(self):
        msgs = [{"role": "user", "content": f"q{i}"} for i in range(20)]
        msgs += [{"role": "system", "content": "junk"}]  # dropped
        clipped = clip_history(msgs)
        self.assertEqual(len(clipped), 12)
        self.assertEqual(clipped[0]["content"], "q8")
        self.assertEqual(clipped[-1]["content"], "q19")


if __name__ == "__main__":
    unittest.main()

import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from tracer import _ansi, _print_table, print_answer, _call_tool


class MarkdownTest(unittest.TestCase):
    def test_bold(self):
        self.assertIn("analis", _ansi("**analis** insider"))

    def test_code(self):
        self.assertIn("HEAL", _ansi("ticker `HEAL` ok"))

    def test_table(self):
        lines = ["| A | B |", "|---|---|", "| 1 | 2 |"]
        next_i = _print_table(lines, 0)
        self.assertEqual(next_i, 3)  # consumed all 3 rows

    def test_print_answer_mixed(self):
        answer = "Intro **bold**.\n| A | B |\n|---|---|\n| 1 | 2 |\nAkhir."
        import io
        from contextlib import redirect_stdout
        buf = io.StringIO()
        with redirect_stdout(buf):
            print_answer(answer)
        out = buf.getvalue()
        self.assertIn("Intro", out)
        self.assertIn("1", out)  # table cell content rendered
        self.assertIn("Akhir", out)


SNAPSHOT = {
    "payload": {
        "scanned": 2,
        "kept": 2,
        "partial": False,
        "clusters": [
            {
                "symbol": "HEAL.JK",
                "direction": "accumulation",
                "participants": 2,
                "participant_names": ["A", "B"],
                "total_value": 1000,
                "window_start": "2026-01-01",
                "window_end": "2026-01-02",
                "transactions": [{"source": "https://example.test/a.pdf"}],
                "fundamentals": {"company_name": "Test Co"},
            }
        ],
    },
    "source_updated_at": "2026-01-02T00:00:00Z",
}


class ToolTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Built here on purpose: the tool layer must not depend on a data file the
        # user may have cleared (the real snapshot is fetched, never committed).
        cls.snap = SNAPSHOT

    def test_scan_compact(self):
        r = _call_tool("read_market_snapshot", {}, self.snap)
        self.assertTrue(r["clusters"])
        self.assertNotIn("transactions", r["clusters"][0])  # compact, no raw txns
        self.assertIn("total", r)

    def test_detail_found_and_missing(self):
        d = _call_tool("get_ticker_detail", {"symbol": "HEAL"}, self.snap)
        self.assertTrue(d.get("transactions"))
        self.assertIn("error", _call_tool("get_ticker_detail", {"symbol": "ZZZZ"}, self.snap))

    def test_unknown_tool(self):
        self.assertIn("error", _call_tool("nope", {}, self.snap))


if __name__ == "__main__":
    unittest.main()

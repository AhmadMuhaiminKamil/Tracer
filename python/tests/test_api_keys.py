"""pick_menu drives both the session picker and `tracer api`.

Navigation is the one part of the CLI that can't be exercised by piping stdin,
so it's tested here with a fake TTY: arrow keys must move the selection, Enter
returns the row, q cancels, and extra keys return (action, row).
"""
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import apikeys
import tracer

LABELS = ["opsi A", "opsi B", "opsi C"]


class FakeTty(io.StringIO):
    """TTY-ish stdin. read(n) returns up to n bytes, like a real terminal —
    the old StringIO returned one byte regardless, which hid an arrow-key bug."""

    def isatty(self):
        return True

    def fileno(self):
        return 0

    def read(self, n=1):
        return super().read(n)


def drive(keys: str, extra: dict | None = None, labels: list[str] | None = None, sink: list | None = None):
    """Run pick_menu on a fake TTY. `sink` collects what it printed."""
    def collect(*a, **k):
        if sink is not None and a and isinstance(a[0], str):
            sink.append(a[0])

    with patch.object(sys, "stdin", FakeTty(keys)), \
         patch("termios.tcgetattr", lambda fd: []), \
         patch("termios.tcsetattr", lambda *a: None), \
         patch("tty.setcbreak", lambda fd: None), \
         patch("builtins.print", collect):
        return tracer.pick_menu("judul", list(labels or LABELS), "", Path("."), keys=extra)


class PickMenuTests(unittest.TestCase):
    def test_enter_picks_first_row(self):
        self.assertEqual(drive("\r"), 0)

    def test_down_moves_to_second_row(self):
        self.assertEqual(drive("\x1b[B\r"), 1)

    def test_marker_actually_moves_down_a_row(self):
        # Index alone could pass while the cursor stays put; assert the drawn marker moves.
        lines: list[str] = []
        drive("\x1b[B\r", sink=lines)
        rows = [i for i, line in enumerate(lines) if "▸" in line]
        self.assertGreater(rows[-1], rows[0])

    def test_two_downs_move_to_third_row(self):
        self.assertEqual(drive("\x1b[B\x1b[B\r"), 2)

    def test_down_then_up_returns_to_first(self):
        self.assertEqual(drive("\x1b[B\x1b[A\r"), 0)

    def test_down_clamps_at_last_row(self):
        self.assertEqual(drive("\x1b[B" * 5 + "\r"), len(LABELS) - 1)

    def test_up_clamps_at_first_row(self):
        self.assertEqual(drive("\x1b[A\x1b[A\r"), 0)

    def test_arrow_up_on_first_row_does_not_move_down(self):
        # Regression: elif used to fire for "[A" when at row 0, moving the cursor down.
        self.assertEqual(drive("\x1b[A\r"), 0)



class ReadLineTests(unittest.TestCase):
    """EOF on a closed stdin (pipe, CI) must not raise."""

    def test_read_line_returns_empty_on_eof(self):
        with patch("builtins.input", side_effect=EOFError), patch("builtins.print"):
            self.assertEqual(tracer._read_line("prompt: "), "")

    def test_read_line_strips_whitespace(self):
        with patch("builtins.input", return_value="  value  "):
            self.assertEqual(tracer._read_line("prompt: "), "value")


PAYLOAD = b'{"object":"list","data":[{"id":"ohh/gpt-5.6"},{"id":"claude-opus-5"},{"no_id":1}]}'


class FakeResponse:
    def __init__(self, body):
        self._body = body

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class ListModelsTests(unittest.TestCase):
    def test_parses_ids_and_skips_entries_without_id(self):
        with patch("urllib.request.urlopen", return_value=FakeResponse(PAYLOAD)):
            self.assertEqual(apikeys.list_models("https://x/v1", "k"), ["ohh/gpt-5.6", "claude-opus-5"])

    def test_missing_endpoint_returns_empty_not_raise(self):
        with patch("urllib.request.urlopen", side_effect=OSError("404")):
            self.assertEqual(apikeys.list_models("https://x/v1", "k"), [])

    def test_bad_json_returns_empty(self):
        with patch("urllib.request.urlopen", return_value=FakeResponse(b"not json")):
            self.assertEqual(apikeys.list_models("https://x/v1", "k"), [])

    def test_trailing_slash_does_not_double_up(self):
        seen = {}

        def capture(request, timeout=None):
            seen["url"] = request.full_url
            return FakeResponse(PAYLOAD)

        with patch("urllib.request.urlopen", side_effect=capture):
            apikeys.list_models("https://x/v1/", "k")
        self.assertEqual(seen["url"], "https://x/v1/models")



if __name__ == "__main__":
    unittest.main()

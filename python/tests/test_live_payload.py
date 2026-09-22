import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from insideriq import detect_clusters, is_genuine_transaction
from sectors_api import FILING_TAGS, NOISE_TAGS, load_api_key

FIXTURE = Path(__file__).parents[1] / "data" / "live_filings.json"


class LivePayloadTests(unittest.TestCase):
    """Guards the noise filter against the real Sectors v2 payload shape."""

    def test_noise_tags_are_disjoint_from_filing_tags(self):
        self.assertFalse(set(FILING_TAGS) & NOISE_TAGS)
        self.assertEqual(FILING_TAGS, ("investment",))

    def test_api_key_prefers_environment(self):
        with patch.dict(os.environ, {"SECTORS_API_KEY": "from-env"}, clear=False):
            self.assertEqual(load_api_key(), "from-env")

    def test_api_key_falls_back_to_env_file(self):
        # The previous version asserted len(real_key) == 64: it only passed on the
        # author's machine and tested the secret, not the lookup. Use a throwaway file.
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / ".env").write_text("SECTORS_API_KEY=from-file\n", encoding="utf-8")
            with patch.dict(os.environ, {}, clear=False), patch("sectors_api.ROOT", Path(tmp)):
                os.environ.pop("SECTORS_API_KEY", None)
                self.assertEqual(load_api_key(), "from-file")

    def test_api_key_missing_fails_loudly(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch("sectors_api.ROOT", Path(tmp)):
                os.environ.pop("SECTORS_API_KEY", None)
                with self.assertRaises(RuntimeError):
                    load_api_key()

    @unittest.skipUnless(FIXTURE.exists(), "belum ada snapshot filings live")
    def test_captured_payload_still_parses_into_clusters(self):
        rows = json.loads(FIXTURE.read_text(encoding="utf-8"))
        kept = [row for row in rows if is_genuine_transaction(row)]
        self.assertLess(len(kept), len(rows))
        for cluster in detect_clusters(kept):
            self.assertGreaterEqual(cluster["participants"], 2)
            self.assertTrue(cluster["transactions"][0]["source"])


if __name__ == "__main__":
    unittest.main()

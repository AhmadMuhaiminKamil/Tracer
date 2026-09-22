"""keys_store keeps a list of keys but must never damage the .env it mirrors into.

Three real bugs found while building the dashboard live here as regressions:
  1. a kind with no active row blanked its env var (wiping a key set via CLI)
  2. deleting the active key left the env var empty instead of promoting a sibling
  3. adding an untested key auto-enabled it, overwriting a working key
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import apikeys
import keys_store


class StoreTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.store = root / "keys.json"
        self.env_path = root / ".env"
        self.patchers = [
            patch.object(keys_store, "STORE", self.store),
            patch.object(apikeys, "ENV_FILE", self.env_path),
            patch.object(apikeys, "WEB_ENV_FILE", root / "missing.env.local"),
        ]
        for patcher in self.patchers:
            patcher.start()

    def tearDown(self):
        for patcher in self.patchers:
            patcher.stop()
        self.tmp.cleanup()

    def env(self) -> dict[str, str]:
        return apikeys.read_env(self.env_path)


class MirrorTests(StoreTestCase):
    def test_first_key_activates_itself(self):
        # Nothing to clobber, so the first key of a kind turns itself on.
        row = keys_store.add("sectors", "FIRST", "a")
        self.assertTrue(row["enabled"])
        self.assertEqual(self.env()["SECTORS_API_KEY"], "FIRST")

    def test_second_key_wants_a_manual_enable(self):
        # Enabling a second key would overwrite the working one — wait for the user.
        keys_store.add("sectors", "WORKING", "a")
        row = keys_store.add("sectors", "UNTESTED", "b")
        self.assertFalse(row["enabled"], "a second key must start disabled")
        self.assertEqual(self.env()["SECTORS_API_KEY"], "WORKING", "must not overwrite the working key")

    def test_toggle_on_writes_key(self):
        self.env_path.write_text("SECTORS_API_KEY=OLD\n")
        keys_store.add("sectors", "FIRST", "f")          # auto-active, sets FIRST
        row = keys_store.add("sectors", "NEW", "n")      # starts disabled
        keys_store.toggle(row["id"])
        self.assertEqual(self.env()["SECTORS_API_KEY"], "NEW")

    def test_toggle_is_exclusive_within_a_kind(self):
        a = keys_store.add("sectors", "AAA", "a")
        b = keys_store.add("sectors", "BBB", "b")
        keys_store.toggle(a["id"])
        keys_store.toggle(b["id"])
        enabled = [r["label"] for r in keys_store.load() if r["enabled"]]
        self.assertEqual(enabled, ["b"], "enabling one must disable its siblings")

    def test_remove_active_promotes_sibling(self):
        a = keys_store.add("sectors", "AAA", "a")
        b = keys_store.add("sectors", "BBB", "b")
        keys_store.toggle(b["id"])
        keys_store.remove(b["id"])
        self.assertEqual(self.env()["SECTORS_API_KEY"], "AAA", "sibling must take over")
        self.assertTrue(next(r for r in keys_store.load() if r["id"] == a["id"])["enabled"])

    def test_untouched_kind_keeps_env_value(self):
        # Store has no sectors row, so saving a model key must not wipe SECTORS_API_KEY.
        self.env_path.write_text("SECTORS_API_KEY=SET-BY-HAND\n")
        row = keys_store.add("model", "sk-llm", "gw", base_url="https://x/v1", model="m")
        keys_store.toggle(row["id"])
        self.assertEqual(self.env()["SECTORS_API_KEY"], "SET-BY-HAND")

    def test_removing_last_key_of_owned_kind_clears_it(self):
        # Once the store owns the kind, removing its only key must clear the var —
        # otherwise a disabled key keeps being used.
        self.env_path.write_text("LLM_API_KEY=KEEP\n")
        row = keys_store.add("sectors", "X", "x")
        keys_store.toggle(row["id"])
        keys_store.remove(row["id"])
        self.assertEqual(self.env().get("SECTORS_API_KEY", ""), "")
        self.assertEqual(self.env()["LLM_API_KEY"], "KEEP", "untouched kind survives")

    def test_toggle_off_removes_key_from_env(self):
        # Regression: skipping kinds with no active row meant "off" left the key live.
        row = keys_store.add("sectors", "REALKEY", "s")
        self.assertEqual(self.env()["SECTORS_API_KEY"], "REALKEY", "first key auto-activates")
        keys_store.toggle(row["id"])
        self.assertEqual(self.env().get("SECTORS_API_KEY", ""), "", "disabled key must leave .env")

    def test_other_kind_is_never_touched(self):
        self.env_path.write_text("LLM_API_KEY=MY-LLM-KEY\nLLM_MODEL=gpt-5.6\n")
        row = keys_store.add("sectors", "SEC", "s")
        keys_store.toggle(row["id"])
        self.assertEqual(self.env()["LLM_API_KEY"], "MY-LLM-KEY")
        self.assertEqual(self.env()["LLM_MODEL"], "gpt-5.6")


class PublicShapeTests(StoreTestCase):
    def test_public_never_exposes_the_key(self):
        row = keys_store.add("sectors", "sk-supersecret-value", "s")
        shown = keys_store.public(row)
        self.assertNotIn("key", shown)
        self.assertNotIn("supersecret", json.dumps(shown))
        self.assertIn("masked", shown)

    def test_reveal_is_the_only_way_to_the_full_value(self):
        row = keys_store.add("sectors", "sk-supersecret-value", "s")
        self.assertEqual(keys_store.reveal(row["id"]), "sk-supersecret-value")

    def test_corrupt_store_reads_as_empty(self):
        self.store.write_text("{not json")
        self.assertEqual(keys_store.load(), [])

    def test_model_key_keeps_base_and_model(self):
        keys_store.add("model", "sk-llm", "gw", base_url="https://x/v1", model="gpt-5.6")
        self.assertEqual(self.env()["LLM_BASE_URL"], "https://x/v1")
        self.assertEqual(self.env()["LLM_MODEL"], "gpt-5.6")


if __name__ == "__main__":
    unittest.main()

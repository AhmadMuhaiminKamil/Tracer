import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from snapshot_store import load_local_snapshot, save_local_snapshot, upload_snapshot


class SnapshotStoreTests(unittest.TestCase):
    def test_local_snapshot_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "snapshot.json"
            payload = {"scanned": 10, "kept": 8, "clusters": []}
            save_local_snapshot(path, payload, "2026-09-15T10:00:00Z")
            stored = load_local_snapshot(path)
            self.assertEqual(stored["payload"], payload)
            self.assertEqual(stored["source_updated_at"], "2026-09-15T10:00:00Z")

    def test_upload_uses_service_role_and_upserts_latest(self):
        snapshot = {"payload": {"clusters": []}, "source_updated_at": "2026-09-15T10:00:00Z"}
        response = MagicMock()
        response.__enter__.return_value.status = 201
        with patch.dict(os.environ, {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "secret"}), patch(
            "urllib.request.urlopen", return_value=response
        ) as urlopen:
            upload_snapshot(snapshot)
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://example.supabase.co/rest/v1/market_snapshots?on_conflict=id")
        self.assertEqual(request.headers["Authorization"], "Bearer secret")
        body = json.loads(request.data)
        self.assertEqual(body["id"], "latest")
        self.assertEqual(body["payload"], {"clusters": []})
        self.assertIn("saved_at", body)

    def test_failed_write_does_not_replace_previous_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "snapshot.json"
            save_local_snapshot(path, {"clusters": []}, "2026-09-15T00:00:00Z")
            original = path.read_bytes()
            with patch("os.replace", side_effect=OSError("disk failure")):
                with self.assertRaises(OSError):
                    save_local_snapshot(path, {"clusters": [1]})
            self.assertEqual(path.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()

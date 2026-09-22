from __future__ import annotations

import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def save_local_snapshot(path: str | Path, payload: dict, source_updated_at: str | None = None) -> dict:
    snapshot = {
        "payload": payload,
        "source_updated_at": source_updated_at or datetime.now(timezone.utc).isoformat(),
    }
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    import tempfile
    fd, temporary = tempfile.mkstemp(prefix='.snapshot-', dir=target.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(snapshot, stream, ensure_ascii=False, indent=1, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return snapshot


def load_local_snapshot(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def upload_snapshot(snapshot: dict) -> None:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    body = {
        "id": "latest",
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "payload": snapshot["payload"],
        "source_updated_at": snapshot["source_updated_at"],
    }
    if snapshot.get("latest_filing_timestamp") is not None:
        body["payload"] = {
            **snapshot["payload"],
            "latest_filing_timestamp": snapshot["latest_filing_timestamp"],
            "filing_timezone": snapshot.get("filing_timezone"),
        }
    request = urllib.request.Request(
        f"{url}/rest/v1/market_snapshots?on_conflict=id",
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status not in (200, 201, 204):
            raise RuntimeError(f"Supabase snapshot upload gagal: HTTP {response.status}")


if __name__ == "__main__":
    import sys

    snapshot = load_local_snapshot(sys.argv[1])
    upload_snapshot(snapshot)
    print("Snapshot uploaded: latest")

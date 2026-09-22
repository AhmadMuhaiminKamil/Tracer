from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = "https://api.sectors.app"
ROOT = Path(__file__).resolve().parent
FILING_TAGS = ("investment",)
NOISE_TAGS = {"repurchase-agreement", "placement", "capital-restructuring"}


def load_api_key() -> str:
    key = os.getenv("SECTORS_API_KEY")
    if not key:
        env_file = ROOT / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                if line.startswith("SECTORS_API_KEY="):
                    key = line.split("=", 1)[1].strip()
                    break
    if not key:
        raise RuntimeError("SECTORS_API_KEY belum diisi di .env")
    return key


def get(path: str, **params: object) -> dict:
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    url = f"{BASE_URL}{path}" + (f"?{query}" if query else "")
    request = urllib.request.Request(
        url, headers={"Authorization": load_api_key(), "User-Agent": "insideriq/0.1"}
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", "replace")[:200]
        raise RuntimeError(f"Sectors API {error.code} pada {path}: {body}") from error


def fetch_filings(symbol: str | None = None, transaction_type: str | None = None,
                  start: str | None = None, end: str | None = None, max_rows: int = 90) -> list[dict]:
    """Paginate filings. ponytail: max_rows cap; raise if watchlist grows beyond demo scale."""
    rows: list[dict] = []
    offset = 0
    while len(rows) < max_rows:
        page = get("/v2/filings/", symbol=symbol, transaction_type=transaction_type,
                   start=start, end=end, limit=30, offset=offset)
        results = page.get("results", [])
        rows.extend(results)
        pagination = page.get("pagination", {})
        if not pagination.get("has_next"):
            break
        offset = pagination["next_offset"]
    return rows[:max_rows]

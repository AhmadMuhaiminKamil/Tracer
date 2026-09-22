from __future__ import annotations

import json
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from insideriq import build_brief, detect_clusters, is_genuine_transaction
from sectors_api import fetch_filings, get

CACHE: dict[str, tuple[date, dict]] = {}


def cached(key: str, loader) -> dict:
    """ponytail: in-process TTL cache; swap for Redis when this runs multi-worker."""
    today = date.today()
    hit = CACHE.get(key)
    if hit and hit[0] == today:
        return hit[1]
    value = loader()
    CACHE[key] = (today, value)
    return value


def report(symbol: str) -> dict:
    data = cached(f"report:{symbol}", lambda: get(f"/v2/company/report/{symbol}/", sections="overview,valuation"))
    overview = data.get("overview") or {}
    prices = overview.get("all_time_price") or {}
    return {
        "company_name": data.get("company_name"),
        "sector": overview.get("sector"),
        "sub_sector": overview.get("sub_sector"),
        "market_cap": overview.get("market_cap"),
        "last_close": overview.get("last_close_price"),
        "latest_close_date": overview.get("latest_close_date"),
        "valuation": data.get("valuation"),
        "low_52w": _price(prices, "52_w_low"),
        "high_52w": _price(prices, "52_w_high"),
        "high_ath": _price(prices, "all_time_high"),
    }


def _price(bucket: dict, key: str):
    value = bucket.get(key)
    return next(iter(value.values())) if isinstance(value, dict) and value else None


def scan(days: int = 90, limit: int = 90) -> dict:
    start = (date.today() - timedelta(days=days)).isoformat()
    rows = cached(f"filings:{start}", lambda: fetch_filings(transaction_type="buy", start=start, max_rows=limit))
    kept = [row for row in rows if is_genuine_transaction(row)]
    clusters = detect_clusters(kept)
    for cluster in clusters:
        symbol = cluster["symbol"].split(".")[0]
        cluster["fundamentals"] = report(symbol)
        cluster["summary"] = build_brief(cluster, cluster["fundamentals"], cluster["fundamentals"])
    return {"scanned": len(rows), "kept": len(kept), "clusters": clusters}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        try:
            if parsed.path == "/api/scan":
                body = scan(int(params.get("days", ["90"])[0]), int(params.get("limit", ["90"])[0]))
            elif parsed.path.startswith("/api/report/"):
                body = report(parsed.path.rsplit("/", 1)[-1].upper())
            elif parsed.path == "/api/health":
                body = {"ok": True}
            else:
                return self._send(404, {"error": "not found"})
            self._send(200, body)
        except Exception as error:  # ponytail: single boundary; refine into typed errors if a client needs to branch
            self._send(502, {"error": str(error)})

    def _send(self, status: int, body: object) -> None:
        payload = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format, *args):  # noqa: A002 - keep stdout clean
        pass


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8000), Handler).serve_forever()

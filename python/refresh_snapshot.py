from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from insideriq import build_brief, detect_clusters, is_genuine_transaction
from snapshot_store import save_local_snapshot, upload_snapshot


def _single_price(all_time: dict, key: str):
    value = all_time.get(key)
    return next(iter(value.values())) if isinstance(value, dict) and value else None


def extract_fundamentals(report: dict) -> dict:
    overview = report.get("overview") or {}
    valuation = report.get("valuation") or {}
    financials = report.get("financials") or {}
    valuations = valuation.get("historical_valuation") or []
    ratios = financials.get("historical_financial_ratio") or []
    latest_valuation = max(valuations, key=lambda row: int(row['year']), default={})
    latest_ratio = max(ratios, key=lambda row: int(row['year']), default={})
    # Annual ratios are NOT interchangeable with TTM/MRQ ratios.
    profitability = latest_ratio.get("profitability") or {}
    leverage = latest_ratio.get("leverage") or {}
    prices = overview.get("all_time_price") or {}
    last = overview.get("last_close_price")
    ath = _single_price(prices, "all_time_high")
    return {
        "company_name": report.get("company_name"),
        "sector": overview.get("sector"),
        "sub_sector": overview.get("sub_sector"),
        "market_cap": overview.get("market_cap"),
        "last_close": last,
        "latest_close_date": overview.get("latest_close_date"),
        "pe": latest_valuation.get("pe"),
        "pb": latest_valuation.get("pb"),
        "valuation_year": latest_valuation.get("year"),
        "roe": profitability.get("roe"),
        "der": leverage.get("debt_to_equity_ratio"),
        "ratio_year": latest_ratio.get("year"),
        "revenue_growth": financials.get("yoy_quarter_revenue_growth"),
        "earnings_growth": financials.get("yoy_quarter_earnings_growth"),
        "low_52w": _single_price(prices, "52_w_low"),
        "high_52w": _single_price(prices, "52_w_high"),
        "high_ath": ath,
        "drawdown_ath": (last / ath - 1) if isinstance(last, (int, float)) and isinstance(ath, (int, float)) and ath else None,
    }


def rebuild_from_cache(filings_path: Path, reports_dir: Path) -> dict:
    rows = json.loads(filings_path.read_text(encoding="utf-8"))
    kept = [row for row in rows if is_genuine_transaction(row)]
    clusters = detect_clusters(kept)
    for cluster in clusters:
        symbol = cluster["symbol"].replace(".JK", "")
        report = json.loads((reports_dir / f"{symbol}.json").read_text(encoding="utf-8"))
        fundamentals = extract_fundamentals(report)
        cluster["fundamentals"] = fundamentals
        cluster["summary"] = build_brief(cluster, fundamentals, fundamentals)
    return {
        "payload": {"scanned": len(rows), "kept": len(kept), "clusters": clusters, "partial": True},
        # Capture time from file metadata, not a timezone guessed for filing timestamps.
        "source_updated_at": datetime.fromtimestamp(filings_path.stat().st_mtime, timezone.utc).isoformat(),
        "latest_filing_timestamp": max((row["timestamp"] for row in rows), default=None),
        "filing_timezone": "unspecified by upstream",
    }


if __name__ == "__main__":
    root = Path(__file__).parent
    snapshot = rebuild_from_cache(root / "data/live_filings.json", root / "data/company_reports")
    save_local_snapshot(root / "data/sectors_snapshot.json", snapshot["payload"], snapshot["source_updated_at"])
    print(f"Snapshot saved locally: {len(snapshot['payload']['clusters'])} clusters")
    if os.getenv("SUPABASE_URL"):  # opt-in: only push when the operator configured Supabase
        upload_snapshot(snapshot)
        print("Snapshot also uploaded to Supabase")

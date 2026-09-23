"""Manual budgeted ingestion, disk history, and zero-credit snapshot watcher."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from contextlib import contextmanager

from insideriq import build_brief, detect_clusters, is_genuine_transaction
from sectors_api import load_api_key
from refresh_snapshot import extract_fundamentals
from snapshot_store import upload_snapshot


def _atomic(path: Path, value: object):
    import tempfile
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".monitor-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=1, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name): os.unlink(name)


@contextmanager
def locked(root: Path):
    # ponytail: single workstation lock; shared DB lock needed for multiple hosts.
    root.mkdir(parents=True, exist_ok=True)
    path = root / "refresh.lock"
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.write(fd, str(os.getpid()).encode())
        yield
    finally:
        os.close(fd)
        path.unlink()


def today_date():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).date()


def fetch_page(offset: int = 0) -> dict:
    today = today_date()
    start = (today - timedelta(days=30)).isoformat()
    query = urllib.parse.urlencode({"start": start, "end": today.isoformat(), "limit": 30, "offset": offset})
    request = urllib.request.Request(
        "https://api.sectors.app/v2/filings/?" + query,
        headers={"Authorization": load_api_key(), "User-Agent": "insideriq/0.1"},
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        err_body = error.read().decode("utf-8", "replace")[:200]
        raise SystemExit(
            f"Sectors rejected request (HTTP {error.code}): {err_body}. "
            "Please check SECTORS_API_KEY in python/.env and your remaining account credits."
        ) from error


def fetch_report(symbol: str) -> dict:
    request = urllib.request.Request(
        f"https://api.sectors.app/v2/company/report/{symbol}/?sections=overview,valuation,financials",
        headers={"Authorization": load_api_key(), "User-Agent": "insideriq/0.1"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        err_body = error.read().decode("utf-8", "replace")[:200]
        raise SystemExit(
            f"Sectors rejected report request for {symbol} (HTTP {error.code}): {err_body}."
        ) from error


def refresh_reports(root: Path, reports: Path, symbols: list[str], confirmed: int, total_cap: int = 60):
    import re
    normalized = sorted({symbol.upper().removesuffix('.JK') for symbol in symbols if symbol})
    if any(not re.fullmatch(r'[A-Z]{4}', symbol) for symbol in normalized):
        raise ValueError('Ticker IDX harus empat huruf')
    missing = [symbol for symbol in normalized if not (reports / f"{symbol}.json").exists()]
    credits = len(missing) * 3  # three Company Report sections
    if not confirmed:
        return {"mode": "dry_run", "missing": missing, "maximum_credits": credits}
    if confirmed != credits: raise RuntimeError("--confirm-report-credits harus sama dengan estimasi")
    budget_path = root / "budget.json"
    with locked(root):
        budget = json.loads(budget_path.read_text()) if budget_path.exists() else {"reserved": 0}
        if budget["reserved"] + credits > total_cap: raise RuntimeError("Total budget habis")
        for symbol in missing:
            budget["reserved"] += 3
            _atomic(budget_path, budget)
            _atomic(reports / f"{symbol}.json", fetch_report(symbol))
    return {"mode": "report-refresh", "saved": missing, "reserved": budget["reserved"]}


def row_key(row):
    return json.dumps([row.get(k) for k in ("source", "symbol", "timestamp", "holder_name", "transaction_type")])


def refresh(root: Path, pages: int, confirmed: int, run_cap: int = 5, total_cap: int = 60, fresh: bool = False):
    if not 1 <= pages <= 5 or not 1 <= run_cap <= 5 or total_cap < 1:
        raise ValueError("pages/run-cap harus 1–5, total-cap minimal 1")
    if not confirmed:
        return {"mode": "dry_run", "maximum_credits": pages, "note": "Tidak ada network call. Buy/sell, rentang 30 hari; hasil mungkin terpotong."}
    if confirmed != pages: raise RuntimeError("--confirm-credits harus sama dengan estimasi pages")
    if pages > run_cap: raise RuntimeError(f"Run cap {run_cap} credit terlampaui")
    with locked(root):
        budget_path = root / "budget.json"
        budget = json.loads(budget_path.read_text()) if budget_path.exists() else {"reserved": 0}
        results = []
        partial = False
        for page_number in range(pages):
            today = today_date()
            cache = root / "responses" / f"{today}-30d-{page_number}.json"
            if cache.exists() and not fresh:
                page = json.loads(cache.read_text())
            else:
                if budget["reserved"] >= total_cap: raise RuntimeError("Total budget limit reached; no request made")
                budget["reserved"] += 1
                _atomic(budget_path, budget)  # reserve before network; failures stay charged conservatively
                page = fetch_page(page_number * 30)
                _atomic(cache, page)
            if not isinstance(page.get("results"), list): raise ValueError("Invalid filings response format")
            results.extend(page["results"])
            partial = bool(page.get("pagination", {}).get("has_next"))
            if not partial: break
        previous = json.loads((root / "filings.json").read_text()) if (root / "filings.json").exists() else []
        unique = {row_key(row): row for row in [*previous, *results]}
        _atomic(root / "filings.json", list(unique.values()))
        _atomic(root / "coverage.json", {"partial": partial, "captured_at": datetime.now(timezone.utc).isoformat()})
        return {"mode": "refresh", "rows": len(unique), "reserved": budget["reserved"], "partial": partial}


def publish_cached(root: Path, reports: Path, target: Path, upload=False):
    filings = root / "filings.json"
    if not filings.exists():
        raise SystemExit("filings.json not found. Ingest first with: monitor.py --pages 1 --confirm-credits 1")
    rows = json.loads(filings.read_text())
    today = today_date()
    start = (today - timedelta(days=30)).isoformat()
    rows = [r for r in rows if start <= str(r.get("timestamp", ""))[:10] <= today.isoformat()]
    kept = [r for r in rows if is_genuine_transaction(r)]
    clusters = detect_clusters(kept)
    for c in clusters:
        file = reports / f"{c['symbol'].removesuffix('.JK')}.json"
        report = json.loads(file.read_text()) if file.exists() else {}
        c["fundamentals"] = extract_fundamentals(report)
        c["summary"] = build_brief(c, c["fundamentals"], c["fundamentals"])
    coverage = json.loads((root / "coverage.json").read_text())
    value = {"payload": {"scanned": len(rows), "kept": len(kept), "clusters": clusters, "partial": coverage['partial']}, "source_updated_at": coverage['captured_at']}
    if target.exists():
        previous = json.loads(target.read_text())
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        _atomic(root / "history" / f"{digest}.json", previous)
    if upload: upload_snapshot(value)  # remote failure preserves previous local latest
    _atomic(target, value)
    return value


def signatures(snapshot: dict, watchlist: list[str]):
    watched = {ticker.upper().removesuffix(".JK") for ticker in watchlist}
    return {
        c["symbol"] + ':' + c['direction']: hashlib.sha256(json.dumps(c, sort_keys=True).encode()).hexdigest()
        for c in snapshot.get("payload", {}).get("clusters", [])
        if c["symbol"].removesuffix(".JK") in watched
    }


def changes(before: dict[str, str], now: dict[str, str]):
    return ([f"{ticker}: cluster baru/berubah" for ticker, value in now.items() if before.get(ticker) != value]
            + [f"{ticker}: cluster tidak lagi ada" for ticker in before if ticker not in now])


def watch(snapshot_path: Path, watchlist_path: Path, state_path: Path):
    snapshot = json.loads(snapshot_path.read_text())
    watchlist = json.loads(watchlist_path.read_text())
    current = signatures(snapshot, watchlist)
    previous = json.loads(state_path.read_text()) if state_path.exists() else {}
    alerts = changes(previous, current)
    _atomic(state_path, current)
    return alerts


def main():
    base = Path(__file__).parent / 'data'
    parser = argparse.ArgumentParser(description="Default dry-run. Watch mode never fetches Sectors.")
    parser.add_argument('--root', type=Path, default=base / 'monitor')
    parser.add_argument('--pages', type=int, default=1)
    parser.add_argument('--confirm-credits', type=int, default=0)
    parser.add_argument('--run-cap', type=int, default=5)
    parser.add_argument('--total-cap', type=int, default=60)
    parser.add_argument('--publish', action='store_true', help='Rebuild latest from cached filings; zero Sectors calls')
    parser.add_argument('--upload', action='store_true', help='Upsert latest to Supabase')
    parser.add_argument('--fresh', action='store_true', help='Ignore today\'s cache and re-request (spends credits)')
    parser.add_argument('--watchlist', type=Path, help='Watch snapshot with exported JSON ticker list')
    parser.add_argument('--interval', type=int, default=60)
    parser.add_argument('--once', action='store_true')
    parser.add_argument('--reports', nargs='+', help='Only fetch missing company reports with separate credit approval')
    parser.add_argument('--confirm-report-credits', type=int, default=0)
    args = parser.parse_args()
    if args.upload and not args.publish: parser.error('--upload requires --publish')
    if args.reports:
        if args.confirm_credits or args.watchlist: parser.error('report refresh must run separately')
        print(json.dumps(refresh_reports(args.root, base/'company_reports', args.reports, args.confirm_report_credits, args.total_cap)))
        return
    if args.confirm_report_credits: parser.error('--confirm-report-credits requires --reports')
    if args.watchlist:
        if args.confirm_credits: parser.error('watch mode cannot spend credits')
        while True:
            for alert in watch(base/'sectors_snapshot.json', args.watchlist, args.root/'alerts-state.json'):
                print(alert, flush=True)
                args.root.mkdir(parents=True, exist_ok=True)
                with (args.root/'alerts.log').open('a') as stream: stream.write(alert+'\n')
            if args.once: break
            time.sleep(max(10, args.interval))
    else:
        if args.publish and not args.confirm_credits:
            print(json.dumps({'mode': 'publish-only', 'note': 'Tidak ada Sectors call.'}))
        else:
            print(json.dumps(refresh(args.root, args.pages, args.confirm_credits, args.run_cap, args.total_cap, args.fresh)))
        if args.publish:
            publish_cached(args.root, base/'company_reports', base/'sectors_snapshot.json', args.upload)
            print('Snapshot published from disk cache; history archived.')
        elif args.upload: parser.error('--upload requires --publish')


if __name__ == '__main__': main()

from __future__ import annotations

import hashlib
import json
import sqlite3
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

NOISE_KEYWORDS = {
    "esop",
    "employee stock",
    "hibah",
    "warisan",
    "inheritance",
    "gift",
    "transfer",
    "waris",
    "pemberian",
    "debt settlement",
    "rights issue",
    "capital restructuring",
    "share split",
    "share issuance",
    "inherited",
}

# Tags the live Sectors v2 filings feed uses for non-market movements.
NOISE_TAGS = {"repurchase-agreement", "placement", "capital-restructuring"}


def is_genuine_transaction(filing: dict[str, Any]) -> bool:
    """Conservative heuristic: reject known administrative/non-market language."""
    tags = {str(tag).lower() for tag in filing.get("tags") or []}
    if tags & NOISE_TAGS:
        return False
    text = " ".join(
        [str(filing.get("body") or ""), *(str(tag) for tag in filing.get("tags") or [])]
    ).lower()
    return not any(keyword in text for keyword in NOISE_KEYWORDS)


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


def detect_clusters(
    filings: list[dict[str, Any]], window_days: int = 30, min_participants: int = 2
) -> list[dict[str, Any]]:
    """Return latest qualifying window per symbol and direction."""
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for filing in filings:
        direction = filing.get("transaction_type")
        if direction in {"buy", "sell"} and is_genuine_transaction(filing):
            grouped[(str(filing.get("symbol", "")).upper(), direction)].append(filing)

    clusters: list[dict[str, Any]] = []
    for (symbol, transaction_type), rows in grouped.items():
        rows.sort(key=lambda item: _parse_timestamp(str(item["timestamp"])))
        best: list[dict[str, Any]] = []
        for index, end_row in enumerate(rows):
            end = _parse_timestamp(str(end_row["timestamp"]))
            start = end - timedelta(days=window_days)
            window = [
                row
                for row in rows[: index + 1]
                if _parse_timestamp(str(row["timestamp"])) >= start
            ]
            participants = {str(row.get("holder_name") or "Tidak diketahui") for row in window}
            if len(participants) >= min_participants and len(window) > len(best):
                best = window
        if not best:
            continue
        participants = sorted({str(row.get("holder_name") or "Tidak diketahui") for row in best})
        total_value = int(sum(float(row.get("transaction_value") or 0) for row in best))
        bodies = " ".join(str(row.get("body") or "") for row in best).lower()
        economic_classification = (
            "non_market_settlement"
            if any(phrase in bodies for phrase in ("settlement of dividend", "debt settlement", "share issuance"))
            else "genuine_candidate"
        )
        review_notes = []
        if economic_classification != "genuine_candidate":
            review_notes.append("Tujuan transaksi menunjukkan penyelesaian/non-market; jangan dibaca sebagai akumulasi pasar tunai.")
        normalized_names: dict[str, list[str]] = defaultdict(list)
        for name in participants:
            normalized_names["".join(name.lower().split())].append(name)
        if any(len(names) > 1 for names in normalized_names.values()):
            review_notes.append("Kemungkinan duplikat identitas holder; jumlah pihak perlu review manual.")
        start_date = _parse_timestamp(str(best[0]["timestamp"])).date().isoformat()
        end_date = _parse_timestamp(str(best[-1]["timestamp"])).date().isoformat()
        clusters.append(
            {
                "symbol": symbol,
                "transaction_type": transaction_type,
                "direction": "accumulation" if transaction_type == "buy" else "distribution",
                "participants": len(participants),
                "participant_names": participants,
                "total_value": total_value,
                "window_start": start_date,
                "window_end": end_date,
                "transactions": best,
                "economic_classification": economic_classification,
                "review_notes": review_notes,
            }
        )
    return sorted(clusters, key=lambda item: item["total_value"], reverse=True)


def format_rupiah(value: int | float) -> str:
    return "Rp" + f"{value:,.0f}".replace(",", ".")


def build_brief(
    cluster: dict[str, Any], fundamentals: dict[str, Any], price: dict[str, Any]
) -> str:
    company = fundamentals.get("company_name") or cluster["symbol"]
    action = "mengakumulasi" if cluster["direction"] == "accumulation" else "mendistribusikan"
    last_close = price.get("last_close")
    low = price.get("low_52w")
    high = price.get("high_52w")
    price_context = "Konteks harga belum tersedia."
    if isinstance(last_close, (int, float)) and isinstance(low, (int, float)) and isinstance(high, (int, float)) and high > low:
        position = (last_close - low) / (high - low) * 100
        price_context = f"Harga terakhir berada {position:.0f}% dari dasar rentang 52 minggu."
    roe = fundamentals.get("roe")
    roe_year = fundamentals.get("ratio_year")
    fundamental_context = (
        f"ROE {roe_year or ''} {roe * 100:.1f}%." if isinstance(roe, (int, float)) else "ROE belum tersedia."
    )
    period_start = cluster.get("window_start", "tanggal tidak tersedia")
    period_end = cluster.get("window_end", "tanggal tidak tersedia")
    return (
        f"{cluster['participants']} pihak {action} saham {company} senilai total "
        f"{format_rupiah(cluster['total_value'])} pada {period_start}–{period_end}. "
        f"{fundamental_context} {price_context} Informasi ini untuk triase riset, bukan rekomendasi beli atau jual."
    )


def _signal_id(cluster: dict[str, Any]) -> str:
    raw = "|".join(
        str(cluster[key])
        for key in ("symbol", "direction", "window_start", "window_end")
    )
    return hashlib.sha256(raw.encode()).hexdigest()


def save_signal(db_path: str | Path, cluster: dict[str, Any], summary: str) -> bool:
    """Insert signal once. Return True only for a new row."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS detected_signals (
                signal_id TEXT PRIMARY KEY,
                symbol TEXT NOT NULL,
                direction TEXT NOT NULL,
                participants INTEGER NOT NULL,
                total_value INTEGER NOT NULL,
                window_start TEXT NOT NULL,
                window_end TEXT NOT NULL,
                summary TEXT NOT NULL,
                raw_json TEXT NOT NULL,
                detected_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor = connection.execute(
            """
            INSERT OR IGNORE INTO detected_signals
            (signal_id, symbol, direction, participants, total_value, window_start, window_end, summary, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                _signal_id(cluster),
                cluster["symbol"],
                cluster["direction"],
                cluster["participants"],
                cluster["total_value"],
                cluster["window_start"],
                cluster["window_end"],
                summary,
                json.dumps(cluster, ensure_ascii=False),
            ),
        )
        return cursor.rowcount == 1

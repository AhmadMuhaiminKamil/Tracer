from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

from insideriq import build_brief, detect_clusters, format_rupiah, save_signal

ROOT = Path(__file__).parent
DATA_PATH = ROOT / "data" / "mock_data.json"
DB_PATH = ROOT / "signals.db"

st.set_page_config(page_title="InsiderIQ", page_icon="IQ", layout="wide")
st.title("InsiderIQ")
st.caption("Radar transaksi insider IDX — MVP berbasis data simulasi")
st.warning("Informasi untuk riset dan edukasi. Ini bukan financial advice atau rekomendasi beli/jual.")

try:
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    filings = payload["filings"]
    fundamentals = payload["fundamentals"]
    prices = payload["prices"]
except (OSError, KeyError, json.JSONDecodeError) as error:
    st.error(f"Data demo tidak dapat dimuat: {error}")
    st.stop()

clusters = detect_clusters(filings)
for cluster in clusters:
    symbol = cluster["symbol"]
    cluster["summary"] = build_brief(
        cluster, fundamentals.get(symbol, {}), prices.get(symbol, {})
    )
    save_signal(DB_PATH, cluster, cluster["summary"])

scan_tab, detail_tab, method_tab = st.tabs(["Market Scan", "Deep Dive", "Metodologi"])

with scan_tab:
    st.subheader("Sinyal yang perlu diteliti")
    if not clusters:
        st.info("Tidak ada cluster yang memenuhi kriteria.")
    for cluster in clusters:
        symbol = cluster["symbol"]
        company = fundamentals.get(symbol, {}).get("company_name", symbol)
        with st.container(border=True):
            left, middle, right = st.columns([2, 1, 1])
            left.markdown(f"### {symbol}\n{company}")
            middle.metric("Pihak unik", cluster["participants"])
            right.metric("Nilai transaksi", format_rupiah(cluster["total_value"]))
            st.markdown(cluster["summary"])
            st.caption(
                f"Periode {cluster['window_start']}–{cluster['window_end']} · "
                f"Arah: {cluster['direction']}"
            )

with detail_tab:
    if not clusters:
        st.info("Belum ada ticker untuk dianalisis.")
    else:
        symbols = [cluster["symbol"] for cluster in clusters]
        selected = st.selectbox("Pilih ticker", symbols)
        cluster = next(item for item in clusters if item["symbol"] == selected)
        fundamental = fundamentals.get(selected, {})
        price = prices.get(selected, {})

        st.subheader(f"{selected} — {fundamental.get('company_name', selected)}")
        st.markdown(cluster["summary"])

        metrics = st.columns(4)
        metrics[0].metric("PE TTM", fundamental.get("pe_ttm", "N/A"))
        metrics[1].metric("PB MRQ", fundamental.get("pb_mrq", "N/A"))
        roe = fundamental.get("roe_ttm")
        metrics[2].metric("ROE TTM", f"{roe * 100:.1f}%" if isinstance(roe, (int, float)) else "N/A")
        metrics[3].metric("Harga terakhir", format_rupiah(price.get("last_close", 0)))

        st.markdown("#### Evidence transaksi")
        for transaction in cluster["transactions"]:
            with st.expander(
                f"{transaction['holder_name']} · {transaction['timestamp'][:10]} · "
                f"{format_rupiah(transaction.get('transaction_value', 0))}"
            ):
                st.write(transaction["body"])
                st.write(f"Jumlah saham: {transaction.get('amount_transaction', 'N/A'):,}")
                st.link_button("Buka filing sumber", transaction["source"])

with method_tab:
    st.markdown(
        """
        - Data pada MVP ini simulasi, bukan data pasar aktual.
        - Noise administratif seperti ESOP, hibah, warisan, transfer, placement, dan repo dikeluarkan.
        - Cluster membutuhkan minimal dua nama holder unik dengan arah transaksi sama dalam 30 hari.
        - Skor prediktif sengaja belum dibuat; cluster dipakai sebagai antrean riset, bukan sinyal beli/jual.
        - Versi berikutnya akan mengganti fixture dengan Sectors REST API v2.
        """
    )

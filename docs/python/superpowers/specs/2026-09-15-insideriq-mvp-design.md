# InsiderIQ MVP Design

## Goal

Demo end-to-end berbasis data mock untuk menyeleksi filing insider IDX, mendeteksi cluster transaksi searah, menambahkan konteks fundamental dan harga, lalu menyajikan brief informatif berbahasa Indonesia.

## Scope

- Streamlit satu proses.
- Fixture JSON lokal menggantikan Sectors API pada MVP.
- Noise filter membaca `body` dan `tags`; transaksi hibah, warisan, ESOP, transfer, placement, dan repo dikeluarkan.
- Cluster valid bila minimal dua holder unik melakukan transaksi searah pada ticker sama dalam 30 hari.
- Hasil mencakup evidence transaksi, fundamental ringkas, konteks harga, dan disclaimer.
- Signal tersimpan deduplicated di SQLite.

## Architecture

`app.py` memuat fixture, memanggil fungsi murni di `insideriq.py`, menyimpan hasil ke SQLite, lalu merender Market Scan dan Deep Dive. API client, LangGraph, scheduler, autentikasi, serta LLM ditunda sampai alur inti terbukti.

## Data Flow

1. Muat `data/mock_data.json`.
2. Filter filing non-informatif.
3. Kelompokkan berdasarkan ticker dan arah.
4. Ringkas jumlah peserta, nilai transaksi, dan rentang waktunya tanpa membuat skor prediktif yang belum tervalidasi.
5. Gabungkan fundamental dan price context fixture.
6. Simpan signal unik ke SQLite dan tampilkan evidence sumber.

## Error Handling

Fixture/schema yang hilang menghasilkan pesan Streamlit, bukan crash mentah. Nilai nullable ditampilkan sebagai tidak tersedia. Tidak ada secret dalam source atau fixture.

## Verification

`unittest` menguji noise filter, holder unik, arah transaksi, ringkasan, dan deduplikasi SQLite. Streamlit diuji lewat AppTest, lalu server dijalankan dan diperiksa via HTTP.

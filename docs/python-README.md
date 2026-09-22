# InsiderIQ ingestion & monitoring

Frontend aktif: `../insideriq-web`, Next.js + Supabase + GPT-5.6. Python hanya untuk ingestion manual, pengolahan snapshot, dan monitor lokal. Jangan jalankan `api.py` atau `agent.py` lama: keduanya masih memiliki jalur live Sectors dan bukan runtime dashboard.

## Tes offline

```sh
.venv/bin/python -m unittest discover -s tests -v
```

## Refresh manual, default tanpa biaya

```sh
python3 monitor.py --pages 1
python3 monitor.py --reports HEAL
```

Dua perintah itu DRY RUN, tidak menyentuh Sectors. Yang pertama menunjukkan maksimum biaya halaman filing; kedua menunjukkan report yang belum tersimpan dan biaya 3 section/report. Report yang sudah ada tidak diambil ulang.

Hanya setelah operator menyetujui biaya, muat key lokal ke environment dan tambahkan flag konfirmasi:

```sh
# CONTOH BERBAYAR: maksimal 1 kredit, hanya jalankan dengan persetujuan.
set -a; . ./.env; set +a
python3 monitor.py --pages 1 --confirm-credits 1
```

- Maksimal 5 halaman per run, limit 30 row/halaman, buy/sell, rentang 30 hari.
- `--total-cap` default 30 adalah batas ledger lokal, BUKAN saldo akun Sectors.
- Ledger `data/monitor/budget.json` direservasi sebelum request. Error/timeout tetap dihitung konservatif.
- Respons sukses disimpan per hari/halaman. Run ulang memakai file, tidak refetch.
- Jangan hapus ledger atau ganti `--root` untuk mengakali budget.
- Crash dapat meninggalkan `refresh.lock`; verifikasi PID benar-benar mati sebelum menghapus lock.
- Snapshot diberi `partial=true` jika ada halaman berikutnya yang belum diambil.
- Existing reports sengaja tidak auto-expire. Untuk refresh report lama, arsipkan file sendiri setelah review budget, lalu pakai konfirmasi report.

## Publish dari cache, nol Sectors credit

```sh
set -a; . ./.env.supabase; set +a
python3 monitor.py --publish --upload
```

Menggunakan `data/monitor/filings.json` dan `data/company_reports/`. Snapshot lama diarsipkan ke `data/monitor/history/`; latest di-upsert ke Supabase. Tidak DROP/DELETE data remote. Report yang belum tersedia ditandai kosong; tidak ada fallback live.

`refresh_snapshot.py` adalah rebuild dari snapshot filing awal `data/live_filings.json` + laporan tersimpan. Jangan menganggapnya refresh pasar.

## Monitor watchlist, nol Sectors credit

Ekspor watchlist lewat dashboard, lalu:

```sh
python3 monitor.py --watchlist /path/insideriq-watchlist.json --once
python3 monitor.py --watchlist /path/insideriq-watchlist.json --interval 60
```

Monitor membaca snapshot lokal; cetak perubahan baru/berubah/hilang dan simpan `data/monitor/alerts.log`. Tidak polling Sectors; informasi pasar baru baru muncul setelah ingestion manual. Tidak ada scheduled paid job dipasang.

## Batas data

Snapshot awal adalah sampel filing pembelian, bukan seluruh pasar. Rasio annual tetap dilabeli tahun, tidak diganti menjadi TTM/MRQ. Tag `investment` dan perubahan kepemilikan tidak membuktikan open-market cash purchase. Noise filter masih heuristik, perlu review dokumen sumber. Kunci jangan dibagikan/di-commit.

Ini bukan financial advice.

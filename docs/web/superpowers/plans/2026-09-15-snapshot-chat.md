# Snapshot Chat Implementation Plan

**Goal:** Tambah chat GPT-5.6 di dashboard yang hanya membaca snapshot Supabase.

**Architecture:** Next.js route `/api/ask` menerima pertanyaan dan history, mengambil `market_snapshots/latest`, lalu menjalankan loop tool-use tunggal ke gateway OpenAI-compatible. Client component menyimpan history di browser. Tidak ada Python API atau Sectors API.

**Tech Stack:** Next.js 16, React 19, TypeScript, native fetch.

## Constraints

- Nol Sectors API calls.
- LLM key hanya server-side.
- Maksimum 4 langkah tool-use dan 12 pesan history.
- Satu tool: `read_market_snapshot`.
- Semua jawaban punya batas bukan financial advice.

## Tasks

1. Buat route handler dengan validasi input, tool loop, dan snapshot Supabase.
2. Buat client chat minimal dan pasang di halaman.
3. Tambah CSS, build, jalankan localhost, uji satu pertanyaan nyata.

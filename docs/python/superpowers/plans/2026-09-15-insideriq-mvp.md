# InsiderIQ MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat MVP Streamlit end-to-end berbasis fixture untuk mendeteksi dan menjelaskan cluster transaksi insider IDX.

**Architecture:** Satu modul domain murni menangani filtering, cluster, summary, dan SQLite. Satu aplikasi Streamlit merender hasil. Fixture JSON menjadi adapter data sementara agar penggantian dengan Sectors REST API tidak mengubah logika inti.

**Tech Stack:** Python 3.12, stdlib `json`/`sqlite3`/`unittest`, Streamlit.

## Global Constraints

- Tidak ada API key atau secret di source.
- Tidak memberikan rekomendasi beli/jual.
- Semua output menyertakan disclaimer bukan financial advice.
- Minimum dua holder unik dalam jendela 30 hari.
- Gunakan field Sectors v2 yang benar: `body`, `tags`, `holder_name`, `amount_transaction`, `transaction_value`.

---

### Task 1: Domain pipeline

**Files:**
- Create: `insideriq.py`
- Create: `tests/test_insideriq.py`

**Interfaces:**
- Produces: `is_genuine_transaction`, `detect_clusters`, `build_brief`, `save_signal`.

- [ ] Write failing unittest for noise filtering, unique-holder cluster, and SQLite deduplication.
- [ ] Run `python3 -m unittest tests.test_insideriq -v`; expect import failure.
- [ ] Implement minimum domain functions.
- [ ] Run test again; expect pass.

### Task 2: Fixture and Streamlit UI

**Files:**
- Create: `data/mock_data.json`
- Create: `app.py`
- Create: `tests/test_app.py`
- Create: `requirements.txt`
- Create: `.gitignore`
- Create: `README.md`

**Interfaces:**
- Consumes: domain functions from Task 1 and fixture keys `filings`, `fundamentals`, `prices`.
- Produces: runnable Streamlit market scan and ticker deep dive.

- [ ] Write failing Streamlit AppTest asserting title, cluster ticker, and disclaimer.
- [ ] Run `python3 -m unittest tests.test_app -v`; expect failure because app is absent.
- [ ] Add fixture and minimum app.
- [ ] Install dependencies in `.venv` and run all tests.
- [ ] Start Streamlit on port 8501; verify HTTP 200 and AppTest interaction.

### Task 3: Final verification

**Files:**
- Verify all files above.

- [ ] Run `python3 -m unittest discover -v`.
- [ ] Run `python3 -m compileall -q .` excluding `.venv`.
- [ ] Run Streamlit headless and `curl` root.
- [ ] Confirm no secret-like values tracked and inspect `git diff --check`.

# Tracer

Cross-platform AI agent and web analytics dashboard for IDX (Indonesia Stock Exchange) insider-filing analysis. Detects insider accumulation and distribution clusters, filters market noise, and provides interactive research over local snapshot data.

**Bring your own keys.** All credentials and data remain local on your machine.

---

## Quick Start (Clone & Install)

Prerequisites: **Node.js (v18+)** and **Python (3.10+)**.

```bash
# 1. Clone the repository
git clone https://github.com/AhmadMuhaiminKamil/Tracer.git
cd Tracer

# 2. Install dependencies (Node & CLI auto-configured)
npm install
```

---

## Setup API Keys

You need a **Sectors API key** (market data) and an **LLM API key** (OpenAI / OpenRouter / local model). You can configure them via CLI or Web Dashboard:

### Method 1: Via CLI (Quickest)
Run the built-in interactive key manager:

- **Windows (PowerShell / CMD):**
  ```powershell
  .\tracer.ps1 api
  ```
- **Linux / WSL / macOS:**
  ```bash
  python3 python/tracer.py api
  ```
Follow the interactive prompt to add, test, or enable your keys.

### Method 2: Via Web Dashboard
1. Start the web application:
   ```bash
   npm run dev
   ```
2. Open [http://localhost:3000](http://localhost:3000) in your browser.
3. Click the **API Keys** tab on the sidebar to add and toggle your Sectors and Model keys directly.

*(Alternatively, copy `.env.local.example` to `.env.local` and `python/.env.example` to `python/.env` manually).*

---

## How to Run

### 1. Interactive CLI Agent

Run Tracer in your terminal with prompt auto-complete and arrow-key session history:

- **Windows:**
  ```powershell
  .\tracer.ps1          # Start chat REPL
  .\tracer.ps1 session  # Browse and resume saved sessions
  ```

- **Linux / WSL / macOS:**
  ```bash
  python3 python/tracer.py          # Start chat REPL
  python3 python/tracer.py session  # Browse and resume saved sessions
  ```

**Useful CLI Commands inside chat:**
- `/scan` — Display detected insider trading clusters.
- `/detail <TICKER>` — View detailed filings and party breakdown.
- `/session` — Switch or resume chat sessions with arrow keys (↑/↓).
- `/help` — List all available commands.
- `/quit` — Exit the CLI.

---

### 2. Web Dashboard

Launch the local glassmorphic web dashboard:

```bash
# Development mode:
npm run dev

# Production build & run:
npm run build
npm run start
```
Access the dashboard at [http://localhost:3000](http://localhost:3000).

---

## Data Ingestion & Snapshot

Tracer operates read-only against a local snapshot cache (`python/data/sectors_snapshot.json`). Browsing and querying the dashboard consumes 0 external API credits.

To pull fresh market filings from Sectors:

```bash
# Fetch filings (e.g. 1 page = 30 filings, 1 credit):
python3 python/monitor.py --pages 1 --confirm-credits 1

# Publish cached filings to local snapshot:
python3 python/monitor.py --publish
```

---

## Testing & Verification

```bash
# Run CLI & backend tests
python3 -m unittest discover -s python/tests -v

# Run frontend build check
npm run build
```

---

## Data Caveats

Data is historical and partial; classification is heuristic. For research and educational purposes only — not financial advice or a buy/sell recommendation.

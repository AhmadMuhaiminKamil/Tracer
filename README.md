# Tracer

Cross-platform AI agent and web analytics dashboard for IDX (Indonesia Stock Exchange) insider-filing analysis. Detects insider accumulation/distribution clusters, filters market noise, and provides interactive research over local snapshot data.

**Bring your own keys.** All credentials and data remain local on your machine.

---

## 1. Clone & Install

Prerequisites: **Node.js (v18+)** and **Python (3.10+)**.

```bash
git clone https://github.com/AhmadMuhaiminKamil/Tracer.git
cd Tracer
npm install
```

---

## 2. Setup API Keys

Tracer requires a **Sectors API key** (market data) and an **LLM API key** (OpenAI / OpenRouter / local model).

### Option A: Via CLI (Instant)

Run the key manager directly from the repo root:

- **Linux / WSL / macOS:**
  ```bash
  ./tracer api
  ```
- **Windows (PowerShell / CMD):**
  ```powershell
  .\tracer api
  ```

### Option B: Via Web Dashboard

1. Start dashboard:
   ```bash
   npm run dev
   ```
2. Open [http://localhost:3000](http://localhost:3000) and configure keys in the **API Keys** tab.

*(Or copy `.env.local.example` to `.env.local` and `python/.env.example` to `python/.env` manually).*

---

## 3. Running Tracer

### Interactive CLI

Launch the terminal agent directly using the root runner:

- **Linux / WSL / macOS:**
  ```bash
  ./tracer           # Start chat agent
  ./tracer session   # Browse & resume saved sessions
  ./tracer api       # Manage API keys
  ```
- **Windows (PowerShell / CMD):**
  ```powershell
  .\tracer           # Start chat agent
  .\tracer session   # Browse & resume saved sessions
  .\tracer api       # Manage API keys
  ```

**CLI Commands inside chat:**
- `/scan` — list detected insider clusters
- `/detail <TICKER>` — inspect transactions and filing evidence
- `/session` — switch or create sessions with arrow keys (↑/↓)
- `/help` — view available commands
- `/quit` — exit CLI

---

### Web Dashboard

```bash
# Development
npm run dev

# Production
npm run build
npm run start
```
Open [http://localhost:3000](http://localhost:3000).

---

## Data Ingestion & Snapshot

Tracer operates read-only against a local snapshot (`python/data/sectors_snapshot.json`). Browsing consumes 0 external API credits.

To fetch fresh market filings from Sectors:

- **Linux / WSL / macOS:**
  ```bash
  python3 python/monitor.py --pages 1 --confirm-credits 1
  python3 python/monitor.py --publish
  ```
- **Windows:**
  ```powershell
  python python\monitor.py --pages 1 --confirm-credits 1
  python python\monitor.py --publish
  ```

---

## Verification & Tests

```bash
npm run build
python3 -m unittest discover -s python/tests -v
```

---

## Data Caveats

Data is historical and partial; classification is heuristic. For research and educational purposes only — not financial advice or a buy/sell recommendation.

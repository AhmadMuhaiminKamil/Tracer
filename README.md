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
npm link    # enables the global "tracer" command in your terminal
```

> **Tip:** After running `npm link`, you can type `tracer` anywhere in your terminal without `./` or `python` prefixes.

---

## 2. Setup API Keys

Tracer requires a **Sectors API key** (market data) and an **LLM API key** (OpenAI / OpenRouter / local model).

### Option A: Via CLI (Instant)

Run the key manager directly from your terminal:

```bash
tracer api
```
*(If you didn't run `npm link`: use `./tracer api` on Linux/WSL or `.\tracer api` on Windows).*

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

Launch the terminal agent directly:

```bash
tracer           # Start interactive chat agent
tracer session   # Browse & resume saved sessions (↑/↓ + Enter)
tracer api       # Manage API keys
```

*(Or use `./tracer` on Linux/WSL, `.\tracer` on Windows).*

**CLI Commands inside chat:**
- `/scan` — list detected insider clusters
- `/detail <TICKER>` — inspect transactions and filing evidence
- `/session` (or `tracer session`) — switch or create sessions with arrow keys (↑/↓)
- `/api` (or `tracer api`) — open key manager inside chat
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

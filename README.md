# Tracer

Cross-platform AI agent and web analytics dashboard for IDX (Indonesian Stock Exchange) insider-filing analysis. Detects accumulation/distribution clusters (≥2 insiders trading in the same direction on a single ticker), filters out non-market noise, and answers research questions over a local snapshot.

**Bring your own keys.** All data and credentials stay on your local machine.

---

## Platform Support

Tracer runs natively across platforms:
- **Windows**: PowerShell, Command Prompt (CMD), or Windows Terminal.
- **Linux / WSL / macOS**: Bash, Zsh, or any standard terminal shell.

---

## Installation & Setup

### Prerequisites
- **Node.js**: v18+ or v20+
- **Python**: 3.10+ (with `venv` support)

### 1. Windows (PowerShell / CMD)

```powershell
# Install Web Dashboard dependencies
npm install

# Setup Python Virtual Environment
python -m venv python/.venv
.\python\.venv\Scripts\Activate.ps1
pip install -r python/requirements.txt

# Copy environment templates
copy .env.local.example .env.local
copy python\.env.example python\.env
```

### 2. Linux / WSL / macOS

```bash
# Install Web Dashboard dependencies
npm install

# Setup Python Virtual Environment
python3 -m venv python/.venv
source python/.venv/bin/activate
pip install -r python/requirements.txt

# Copy environment templates
cp .env.local.example .env.local
cp python/.env.example python/.env
```

Fill in your `LLM_API_KEY` in `.env.local` and your `SECTORS_API_KEY` in `python/.env`.

---

## Running Tracer

### Option A: Interactive CLI

Launch the interactive terminal agent with prompt auto-complete and arrow-key session navigation:

**Windows (PowerShell / CMD):**
```powershell
.\tracer.ps1          # or: .\tracer.cmd
.\tracer.ps1 session  # browse and resume saved chat sessions
```

**Linux / WSL / macOS:**
```bash
./python/tracer.py          # or: npm run tracer
./python/tracer.py session  # browse and resume saved chat sessions
```

CLI Commands inside the session:
- `/scan` — list detected insider clusters
- `/detail <TICKER>` — inspect cluster transactions & filing evidence
- `/session` — switch or create sessions with arrow keys (↑/↓)
- `/help` — view all commands
- `/quit` — exit CLI

---

### Option B: Web Dashboard

Start the local Next.js glassmorphic dashboard:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Production Build & Start:**
  ```bash
  npm run build
  npm run start
  ```

---

## Data Ingestion & Snapshot

Tracer operates read-only against a local snapshot cache (`python/data/sectors_snapshot.json`). The web app and chat agent consume 0 API credits while browsing.

To ingest fresh market data from Sectors:

```bash
# Fetch 1 page (30 filings) - requires explicit credit confirmation
python python/monitor.py --pages 1 --confirm-credits 1

# Publish cached filings to the local snapshot
python python/monitor.py --publish
```

---

## Verification & Tests

```bash
# Run web unit tests
npx tsx web-tests/sessions.test.ts

# Run python engine & CLI tests
python -m unittest discover -s python/tests -v

# Production build check
npm run build
```

---

## Data Caveats

Data is historical and partial; classification is heuristic. Corporate actions can shift historical ATH. Research and education only — not financial advice or a buy/sell recommendation.

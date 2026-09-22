# Tracer

AI agent for IDX insider-filing analysis. Detects clusters (≥2 insiders trading
the same direction on one ticker), filters out ESOP/inheritance noise, and
answers questions over a locally stored snapshot.

**Bring your own keys.** Nothing here is provided by the project — you supply
your own Sectors and LLM credentials. All captured data stays on your machine.

## Setup

```sh
npm install
cp .env.local.example .env.local     # fill in your LLM gateway key
cp python/.env.example python/.env   # fill in your own Sectors API key
```

Capture a snapshot, then run the dashboard:

```sh
python3 python/monitor.py --pages 1 --confirm-credits 1   # 1 credit, dry-run unless confirmed
python3 python/monitor.py --publish                       # 0 credits, reads the local cache
npm run dev
```

Open http://localhost:3000.

### First run, no key yet?

The dashboard still starts and shows a setup panel instead of data. Nothing
breaks, nothing is fetched.

## How it works

```
Sectors API  →  python/monitor.py  →  python/data/sectors_snapshot.json  →  Next.js
   (1 credit / page)     explicit, confirm-gated        read-only, zero credits
```

The web app never calls Sectors. One ingestion can render many pages and many
chat questions at no extra cost. Delete the snapshot and the product has nothing
to show — Sectors is the core data source, not a decorative call.

## Credit discipline

| Action | Cost |
|---|---|
| `--pages 1` (30 filings) | 1 credit |
| Company report | 3 credits (3 sections) |
| `--publish` | 0 |
| Anything on the dashboard | 0 |

Guards that exist on purpose — do not work around them:

- Every paid run needs `--confirm-credits N` matching the page count exactly.
- `--run-cap` 5 and `--total-cap` 30 bound a single run and the local ledger.
- A page is cached to `data/monitor/responses/`, so a re-run on the same day is free.
- The ledger in `data/monitor/budget.json` is reserved *before* the request; a
  failed call still counts, same as the provider bills it.

## Verify

```sh
npx tsx web-tests/*.test.ts                                  # web logic, mocked gateway
python3 -m unittest discover -s python/tests -v              # ingestion logic, no network
npm run build
```

## Data caveats

Snapshot is historical and partial. Classification is heuristic; an `investment`
tag does not prove an open-market cash purchase. Distinct holder names do not
prove independent parties. Corporate actions can distort ATH. PE/PB use the
valuation year and ROE/DER the annual-ratio year — not TTM/MRQ.

## Not included

Automated or brokerage-connected trade execution. This project analyses and
informs only; it does not place orders.

Information for research and education. Not financial advice or a buy/sell
recommendation.

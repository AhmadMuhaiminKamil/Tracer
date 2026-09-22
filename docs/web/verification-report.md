# Verification report — 2026-09-15

## Implemented

- Runtime dashboard and AI agent read one persisted Supabase snapshot only.
- GPT-5.6 bounded tool loop: compact scan/filter + ticker detail/evidence.
- 6 snapshot tickers enriched with cached Company Report overview, valuation and financial sections.
- PE/PB labelled by valuation year; ROE/DER by annual-ratio year; quarterly growth and provider price ranges shown.
- Filing links visible without LLM; economic review warnings included for non-market settlement and likely duplicate holder names.
- Browser-local chat history/watchlist, clear/remove/export, snapshot-change hints.
- Tool names, latency and token usage displayed.
- Input/history/body/output/tool-size limits, step/tool caps, same-origin check, timeout, process-local concurrency/rate limit.
- Manual ingestion only: dry-run by default, exact numeric credit confirmation, run/total caps, response cache, pre-request ledger reservation, local lock, dedupe, partial-coverage marker, local history.
- Watcher reads the local snapshot only and never polls Sectors.

## Completion boundary

Not included: public deployment, account auth, distributed rate limiting, cross-device memory, automated paid scheduling, historical backtest/validated conviction score, GitHub/video/social submission assets. These are not required for the local MVP; add before public launch/submission where applicable.

## Data caveats

Snapshot is historical and sampled. Noise classification is heuristic. `investment` does not prove open-market cash purchase. Distinct spelling does not prove distinct beneficial owners. ATH may be distorted by corporate actions. Missing cached company reports remain unavailable until a separately budgeted manual refresh.

## Security

Keys pasted into chat are compromised by disclosure; rotate Sectors, LLM, and Supabase service-role keys before deployment. Env files are ignored. Supabase anon may read latest only; service role performs manual upsert.

import * as assert from "node:assert/strict";
import { callSnapshotTool } from "../app/api/ask/tools";
import type { Snapshot } from "../app/snapshot";

const snapshot: Snapshot = {
  source_updated_at: "2026-09-15T00:00:00Z",
  saved_at: "2026-09-15T01:00:00Z",
  payload: {
    scanned: 2,
    kept: 2,
    clusters: [
      {
        symbol: "HEAL.JK",
        direction: "accumulation",
        participants: 2,
        participant_names: ["A", "B"],
        total_value: 100,
        window_start: "2026-09-01",
        window_end: "2026-09-02",
        summary: "x",
        fundamentals: { company_name: "Hermina", sector: "Healthcare", sub_sector: null, market_cap: null, last_close: null, latest_close_date: null, low_52w: null, high_52w: null, high_ath: null },
        transactions: [{ holder_name: "A", holder_type: "insider", timestamp: "2026-09-01", amount_transaction: 1, price: 100, transaction_value: 100, source: "https://idx.test/a.pdf", body: "buy" }],
      },
    ],
  },
};

const scan = callSnapshotTool("read_market_snapshot", { sector: "health" }, snapshot);
assert.ok("clusters" in scan && scan.clusters);
assert.equal(scan.clusters.length, 1);
assert.equal(scan.clusters[0].transaction_count, 1);
assert.equal("transactions" in scan.clusters[0], false);
const detail = callSnapshotTool("get_ticker_detail", { symbol: "heal" }, snapshot);
assert.ok("symbol" in detail && "transactions" in detail);
assert.equal(detail.symbol, "HEAL.JK");
assert.equal(detail.transactions[0].source, "https://idx.test/a.pdf");
assert.deepEqual(callSnapshotTool("get_ticker_detail", { symbol: "ZZZZ" }, snapshot), { error: "Ticker tidak ada di snapshot" });
console.log("PASS snapshot tools");

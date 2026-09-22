import * as assert from "node:assert/strict";
// @ts-ignore -- Node's dependency-free type-strip runner requires the explicit extension.
import * as state from "../app/browser-state.ts";

const { addTicker, appendMessage, clusterSignatures, parseHistory, parseWatchlist, removeTicker, stringifyHistory, stringifyWatchlist } = state;

assert.deepEqual(parseHistory(null), []);
assert.deepEqual(parseHistory("not json"), []);
assert.deepEqual(parseHistory(JSON.stringify({ version: 99, messages: [] })), []);
assert.deepEqual(
  parseHistory(
    JSON.stringify({
      version: 1,
      messages: [
        { role: "user", content: " halo " },
        { role: "system", content: "drop" },
        { role: "assistant", content: 42 },
      ],
    }),
  ),
  [{ role: "user", content: " halo " }],
);

let messages: Array<{ role: "user" | "assistant"; content: string }> = [];
for (let index = 0; index < 55; index++) messages = appendMessage(messages, { role: "user", content: String(index) });
assert.equal(messages.length, 50);
assert.equal(messages[0].content, "5");
assert.deepEqual(parseHistory(stringifyHistory(messages)), messages);

assert.deepEqual(parseWatchlist(null), []);
assert.deepEqual(parseWatchlist("{"), []);
assert.deepEqual(parseWatchlist(JSON.stringify({ version: 1, tickers: [" bbca ", "BBCA", "bad ticker", 4] })), ["BBCA"]);

let watchlist: string[] = [];
watchlist = addTicker(watchlist, " bbca.jk ");
watchlist = addTicker(watchlist, "BBCA.JK");
assert.deepEqual(watchlist, ["BBCA"]);
watchlist = removeTicker(watchlist, "bbca.jk");
assert.deepEqual(watchlist, []);
for (let index = 0; index < 55; index++) watchlist = addTicker(watchlist, `IDX${index}`);
assert.equal(watchlist.length, 50);
assert.equal(watchlist[0], "IDX0");
assert.deepEqual(parseWatchlist(stringifyWatchlist(watchlist)), watchlist);
assert.deepEqual(
  clusterSignatures(
    [
      { symbol: "idx0", direction: "accumulation", window_end: "2026-09-15" },
      { symbol: "OTHER", direction: "distribution" },
    ],
    watchlist,
  ),
  { IDX0: "accumulation|2026-09-15" },
);

console.log("PASS browser-state");

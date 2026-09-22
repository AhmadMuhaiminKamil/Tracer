import * as assert from "node:assert/strict";
import { acquireSlot, resetLimiter, runAgent } from "../app/api/ask/agent";

async function main() {
  let reads = 0;
  let requests = 0;
  const snapshot = {
    payload: { scanned: 0, kept: 0, clusters: [] },
    source_updated_at: "2026-09-15",
    saved_at: "2026-09-15",
  };
  const result = await runAgent(
    "hello",
    [],
    [],
    async (messages) => {
      requests++;
      if (requests === 1) {
        return {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              { id: "one", function: { name: "read_market_snapshot", arguments: "{}" } },
              { id: "two", function: { name: "get_ticker_detail", arguments: '{"symbol":"HEAL"}' } },
            ],
          },
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        };
      }
      assert.equal(messages.filter((message) => message.role === "tool").length, 2);
      return {
        message: { role: "assistant", content: "Tidak ada data." },
        usage: { prompt_tokens: 20, completion_tokens: 3, total_tokens: 23 },
      };
    },
    async () => {
      reads++;
      return snapshot;
    },
  );
  assert.equal(reads, 1);
  assert.equal(result.usage.total_tokens, 35);
  assert.equal(result.tools.length, 2);
  assert.match(result.answer, /financial advice/);

  await assert.rejects(
    runAgent(
      "too many",
      [],
      [],
      async () => ({ message: { role: "assistant", tool_calls: Array.from({length: 5}, (_, index) => ({id: String(index), function: {name: "read_market_snapshot", arguments: "{}"}})) } }),
      async () => snapshot,
    ),
    /Batas tool/,
  );

  await assert.rejects(
    runAgent(
      "loop",
      [],
      [],
      async () => ({ message: { role: "assistant", tool_calls: [{ id: "one", function: { name: "read_market_snapshot", arguments: "{}" } }] } }),
      async () => snapshot,
    ),
    /langkah/,
  );

  // regression: a replayed assistant turn with content:null breaks the gateway,
  // so the loop must normalise it to a string before sending it back.
  const seen: Record<string, unknown>[][] = [];
  const callWithNullContent = async (messages: Record<string, unknown>[]) => {
    seen.push(messages.map((m) => ({ ...m })));
    if (seen.length === 1) {
      return { message: { role: "assistant", content: null, tool_calls: [{ id: "c1", function: { name: "read_market_snapshot", arguments: "{}" } }] } };
    }
    return { message: { role: "assistant", content: "Ringkas. Ini bukan financial advice." } };
  };
  const answered = await runAgent("sektor", [], [], callWithNullContent, async () => snapshot);
  assert.equal(answered.tools.length, 1);
  const replayed = seen[1].find((m) => m.role === "assistant");
  assert.equal(typeof replayed?.content, "string", "replayed assistant turn must carry a string content");
  assert.equal(replayed?.content, "");
  assert.equal(Array.isArray(replayed?.tool_calls), true, "tool_calls must survive normalisation");

  resetLimiter();
  const first = acquireSlot(1);
  const second = acquireSlot(1);
  assert.throws(() => acquireSlot(1), /bersamaan/);
  first();
  second();
  resetLimiter();
  for (let index = 0; index < 8; index++) acquireSlot(1)();
  assert.throws(() => acquireSlot(1), /menit/);
  acquireSlot(60002)();
  console.log("PASS bounded loop, JSON tools, snapshot once, telemetry, rate/concurrency");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

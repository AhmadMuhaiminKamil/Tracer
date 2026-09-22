import * as assert from "node:assert/strict";
import { NextRequest } from "next/server";

/**
 * Ad-hoc verification: the gateway intermittently answers HTTP 200 with a body that
 * has no `choices` array. The route must retry that, and must not retry a 4xx refusal.
 * The gateway is stubbed here, so no tokens are spent.
 */
type Stub = { status?: number; body: string };

async function main() {
  process.env.LLM_API_KEY = "test-key";
  let plan: Stub[] = [];
  let calls = 0;

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    const next = plan[calls] ?? plan[plan.length - 1];
    calls++;
    return new Response(next.body, { status: next.status ?? 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const { POST } = await import("../app/api/ask/route.js");

  const call = () =>
    POST(
      new NextRequest("http://localhost:3100/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3100", Host: "localhost:3100" },
        body: JSON.stringify({ question: "Berapa jumlah cluster?" }),
      }),
    );

  const ok = (content: string) =>
    JSON.stringify({
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { total_tokens: 10 },
    });

  // 1) truncated body first, then a good answer -> must recover without user-visible error
  plan = [{ body: '{"id":"x","object":"chat.completion"}' }, { body: ok("Ada 11 cluster di snapshot. Ini bukan financial advice.") }];
  calls = 0;
  let res = await call();
  let payload = (await res.json()) as { answer?: string; error?: string };
  assert.equal(res.status, 200, `truncated body must be retried, got ${res.status} ${JSON.stringify(payload)}`);
  assert.match(String(payload.answer), /11 cluster/);
  assert.equal(calls, 2, "must retry exactly once for the truncated response");

  // 2) unparseable body, then good -> retried
  plan = [{ body: "not json at all" }, { body: ok("ok. Ini bukan financial advice.") }];
  calls = 0;
  res = await call();
  assert.equal(res.status, 200, "unparseable body must be retried");
  assert.equal(calls, 2);

  // 3) permanent failure -> surfaces a readable message after the retry budget, not a retry loop
  plan = [{ body: '{"error":"nope"}' }];
  calls = 0;
  res = await call();
  payload = (await res.json()) as { error?: string };
  assert.equal(res.status, 502);
  assert.match(String(payload.error), /tidak lengkap/i);
  assert.match(String(payload.error), /3 percobaan/);
  assert.equal(calls, 3, "must stop after initial + 2 retries");

  // 4) 429 is transient -> retried; 401 is permanent -> not retried
  plan = [{ status: 429, body: "{}" }, { body: ok("ok. Ini bukan financial advice.") }];
  calls = 0;
  res = await call();
  assert.equal(res.status, 200, "429 must be retried");
  assert.equal(calls, 2);

  plan = [{ status: 401, body: '{"error":"bad key"}' }];
  calls = 0;
  res = await call();
  assert.equal(res.status, 502);
  assert.equal(calls, 1, "401 must not be retried");

  globalThis.fetch = realFetch;
  console.log("PASS gateway resilience: truncated body retried, 429 retried, 4xx not retried, budget bounded");
}

main();
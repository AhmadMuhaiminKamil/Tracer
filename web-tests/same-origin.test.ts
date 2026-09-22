import * as assert from "node:assert/strict";
import { NextRequest } from "next/server";

async function main() {
  // guard-only test: never let this reach the LLM gateway
  delete process.env.LLM_API_KEY;
  const { POST } = await import("../app/api/ask/route.js");

  const call = (origin?: string, host = "localhost:3100") =>
    POST(
      new NextRequest("http://localhost:3100/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(origin ? { Origin: origin } : {}),
          ...(host ? { Host: host } : {}),
        },
        body: JSON.stringify({ question: "x" }),
      }),
    );

  // browser on localhost, server bound to 0.0.0.0 -> must NOT be 403
  assert.notEqual((await call("http://localhost:3100")).status, 403, "localhost must pass same-origin");
  assert.notEqual((await call("http://127.0.0.1:3100", "127.0.0.1:3100")).status, 403, "loopback must pass");
  assert.notEqual((await call("http://172.26.221.205:3100", "172.26.221.205:3100")).status, 403, "LAN host must pass");

  // cross-site stays blocked
  assert.equal((await call("https://evil.example", "localhost:3100")).status, 403, "cross-site must be blocked");
  assert.equal((await call("http://localhost:3000", "localhost:3100")).status, 403, "port mismatch must be blocked");

  // non-browser client (no Origin) still allowed
  assert.notEqual((await call(undefined)).status, 403, "no Origin must pass");

  console.log("PASS same-origin guard: host-based, bind-address agnostic");
}

main();

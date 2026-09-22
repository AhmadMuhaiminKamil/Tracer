import * as assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The reader path is cwd-relative now, and the old hardcoded path pointed at a
// different project. Pin it via env so the test owns its fixture.
async function main() {
  const dir = mkdtempSync(join(tmpdir(), "cli-log-"));
  const log = join(dir, "chat_log.jsonl");
  process.env.INSIDERIQ_CHAT_LOG = log;
  const { readCliLog } = await import("../app/cli-log.js");

  try {
    // missing file
    assert.deepEqual(readCliLog(), []);

    // empty file
    writeFileSync(log, "");
    assert.deepEqual(readCliLog(), []);

    // valid + malformed lines: malformed is skipped, not fatal
    const entries = [
      { ts: "2026-09-17T10:00:00+0700", question: "q1", answer: "a1", tools: ["t"], ms: 100 },
      { ts: "2026-09-17T10:01:00+0700", question: "q2", answer: "a2", tools: [], ms: 200 },
    ];
    writeFileSync(log, JSON.stringify(entries[0]) + "\nNOT-JSON\n" + JSON.stringify(entries[1]) + "\n");
    const got = readCliLog(10);
    assert.equal(got.length, 2, "malformed line skipped");
    assert.equal(got[0].question, "q1");
    assert.equal(got[1].question, "q2");

    // limit keeps the LAST n
    assert.equal(readCliLog(1).length, 1);
    assert.equal(readCliLog(1)[0].question, "q2");

    // wrong shape rejected
    writeFileSync(log, JSON.stringify({ ts: "x" }) + "\n");
    assert.deepEqual(readCliLog(), []);

    // tools defaults to [] and ms to 0 when absent
    writeFileSync(log, JSON.stringify({ ts: "t", question: "q", answer: "a" }) + "\n");
    const sparse = readCliLog(1)[0];
    assert.deepEqual(sparse.tools, []);
    assert.equal(sparse.ms, 0);

    // reads the file the env var points at, not a hardcoded path
    assert.equal(readFileSync(log, "utf-8").includes("q"), true);

    console.log("PASS cli-log: missing/empty/malformed/limit/shape/env-path");
  } finally {
    delete process.env.INSIDERIQ_CHAT_LOG;
    rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

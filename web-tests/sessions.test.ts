import * as assert from "node:assert/strict";

async function main() {
  const {
    parseSessions,
    parseActive,
    newSession,
    touchSession,
    removeSession,
  } = await import("../app/browser-state.js");

  // parse: garbage / wrong shape
  assert.deepEqual(parseSessions(null), []);
  assert.deepEqual(parseSessions("bad"), []);
  assert.deepEqual(parseSessions(JSON.stringify({ version: 1, sessions: "x" })), []);
  assert.deepEqual(parseSessions(JSON.stringify({ version: 1, sessions: [{ id: 1 }, { id: "a", title: 2, updated: "x" }] })), []);
  assert.deepEqual(parseActive(null), "");
  assert.deepEqual(parseActive(JSON.stringify({ version: 1, active: 5 })), "");

  // newSession: title from question, prepended
  let sessions: any[] = [];
  const made = newSession(sessions, "Kenapa BUKA naik?");
  sessions = made.sessions;
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].title, "Kenapa BUKA naik?");
  assert.equal(sessions[0].id, made.activeId);
  assert.match(sessions[0].updated, /^\d{4}-/);

  // empty question -> "Sesi baru"
  assert.equal(newSession([], "").sessions[0].title, "Sesi baru");

  // touchSession: moves to front; placeholder renamed, real title kept
  const later = touchSession(sessions, made.activeId, "pertanyaan kedua");
  assert.equal(later[0].title, "Kenapa BUKA naik?"); // real title survives
  // placeholder (from "+ Baru" empty session) gets renamed
  const ph = newSession([], "");
  const renamed = touchSession(ph.sessions, ph.activeId, "pertanyaan nyata");
  assert.equal(renamed[0].title, "pertanyaan nyata");
  assert.deepEqual(touchSession([], "ghost", "x"), []);

  assert.deepEqual(removeSession(later, made.activeId), []);

  // cap 30
  let many: any[] = [];
  for (let i = 0; i < 35; i++) many = newSession(many, `q${i}`).sessions;
  assert.equal(many.length, 30);

  console.log("PASS sessions: parse shapes, new/touch/remove, cap 30");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

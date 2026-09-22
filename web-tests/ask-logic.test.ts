import * as assert from "node:assert/strict";
import { sanitizeChat } from "../app/api/ask/logic";

assert.deepEqual(sanitizeChat({ question: "  halo  ", history: [] }), {
  question: "halo",
  history: [],
});
assert.equal(sanitizeChat({ question: "x".repeat(1001), history: [] }).question.length, 1000);
assert.throws(() => sanitizeChat({ question: "", history: [] }), /pertanyaan/i);
assert.deepEqual(
  sanitizeChat({
    question: "ok",
    history: [
      { role: "system", content: "drop" },
      { role: "user", content: "u" },
      { role: "assistant", content: "a" },
    ],
  }).history,
  [
    { role: "user", content: "u" },
    { role: "assistant", content: "a" },
  ],
);
console.log("PASS sanitizeChat");

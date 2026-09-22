import * as assert from "node:assert/strict";
import { parseBlocks, parseInline } from "../app/markdown.js";

// the shape the gateway actually returned in verification
const sample = `**BUKA (PT Bukalapak.com Tbk)** adalah cluster terbesar:

| Holder | Nilai | Bukti |
|---|---:|---|
| Kreatif Media Karya | Rp101,21 miliar | [Filing IDX](https://www.idx.co.id/x.pdf) |

- Jendela cluster: 7–8 September 2026
- \`review_notes\`: kosong

1. pertama
2. kedua

## Catatan

Ini bukan financial advice.`;

const blocks = parseBlocks(sample);
assert.deepEqual(blocks.map((b) => b.type), ["p", "table", "list", "list", "h", "p"]);

const table = blocks[1];
assert.equal(table.type, "table");
if (table.type === "table") {
  assert.deepEqual(table.head, ["Holder", "Nilai", "Bukti"]);
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0][2].includes("Filing IDX"), true);
}

const bullet = blocks[2];
assert.equal(bullet.type === "list" && bullet.ordered, false);
assert.equal(bullet.type === "list" && bullet.items.length, 2);

const numbered = blocks[3];
assert.equal(numbered.type === "list" && numbered.ordered, true);

assert.equal(blocks[4].type === "h" && blocks[4].level, 2);
assert.equal(blocks[5].type === "p" && blocks[5].text, "Ini bukan financial advice.");

// bold + link + code inline
const spans = parseInline("**tebal** lalu `kode` dan [bukti](https://idx.co.id/a.pdf) selesai");
assert.deepEqual(spans.map((s) => s.kind), ["strong", "text", "code", "text", "link", "text"]);
assert.equal(spans[4].kind === "link" && spans[4].href, "https://idx.co.id/a.pdf");

// a marker split across a partial reveal half must still render, not throw
assert.deepEqual(parseInline("**BUKA (PT Bukalapak").map((s) => s.kind), ["text"]);
assert.deepEqual(parseInline("").map((s) => s.kind), ["text"]);

// fenced code stays raw
const fenced = parseBlocks("```\n{\"a\":1}\n```");
assert.equal(fenced.length === 1 && fenced[0].type === "code" && fenced[0].text, '{"a":1}');

// regression: bold must not swallow the label as an empty <strong>
const boldCases: [string, string][] = [
  ["**Periode transaksi:** 1–15 September 2026.", "Periode transaksi:"],
  ["**Periode transaksi: **1–15 September 2026.", "Periode transaksi: "],
];
for (const [input, expected] of boldCases) {
  const first = parseInline(input)[0];
  assert.equal(first.kind, "strong", `bold must open: ${input}`);
  assert.equal(first.kind === "strong" && first.value, expected);
}

// regression: link label must be the label, not the whole markdown token
const linkCell = parseBlocks(
  "| a |\n| --- |\n| [PDF — LK-01](https://www.idx.co.id/x.pdf) |",
)[0];
assert.equal(linkCell.type === "table" && linkCell.rows[0][0].startsWith("[PDF"), true, "cell keeps raw md");
const linkSpan = parseInline("[PDF — LK-01](https://www.idx.co.id/x.pdf)")[0];
assert.equal(linkSpan.kind, "link");
assert.equal(linkSpan.kind === "link" && linkSpan.value, "PDF — LK-01");
assert.equal(linkSpan.kind === "link" && linkSpan.href, "https://www.idx.co.id/x.pdf");

// italic + escaped star
assert.equal(parseInline("*Tautan bukti.*")[0].kind, "em");
assert.deepEqual(parseInline("\\*catatan")[0], { kind: "text", value: "*" });

console.log("PASS markdown: blocks, table, lists, inline, partial-safe, bold/link regressions");

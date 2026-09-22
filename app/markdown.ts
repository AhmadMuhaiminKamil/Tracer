export type Block =
  | { type: "h"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "code"; text: string }
  | { type: "p"; text: string };

const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_SEP = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;

function cells(line: string) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

// ponytail: hand parser for the handful of constructs the gateway emits.
// Swap for react-markdown + remark-gfm if answers ever need footnotes, nesting or HTML.
export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", text: para.join("\n") });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", ...list });
    list = null;
  };
  const flush = () => {
    flushPara();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push({ type: "code", text: code.join("\n") });
        code = null;
      } else {
        flush();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    const head = /^(#{1,6})\s+(.*)$/.exec(line);
    if (head) {
      flush();
      blocks.push({ type: "h", level: head[1].length, text: head[2].trim() });
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1].trim());
      continue;
    }

    const row = TABLE_ROW.exec(line);
    if (row && TABLE_SEP.test(lines[i + 1] ?? "")) {
      flush();
      const head_ = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        rows.push(cells(lines[i]));
        i++;
      }
      i--;
      blocks.push({ type: "table", head: head_, rows });
      continue;
    }

    flushList();
    para.push(line.trim());
  }

  if (code) blocks.push({ type: "code", text: code.join("\n") });
  flush();
  return blocks;
}

export type Span =
  | { kind: "text"; value: string }
  | { kind: "strong"; value: string }
  | { kind: "code"; value: string }
  | { kind: "em"; value: string }
  | { kind: "link"; value: string; href: string };

// order matters: escaped star, bold, code, italic, link
const INLINE = /(\\\*|\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;

export function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  let last = 0;
  let match = INLINE.exec(text);
  while (match) {
    const at = match.index;
    if (at > last) spans.push({ kind: "text", value: text.slice(last, at) });
    const token = match[0];
    if (token === "\\*") spans.push({ kind: "text", value: "*" });
    else if (token.startsWith("**")) spans.push({ kind: "strong", value: token.slice(2, -2) });
    else if (token.startsWith("`")) spans.push({ kind: "code", value: token.slice(1, -1) });
    else if (token.startsWith("*")) spans.push({ kind: "em", value: token.slice(1, -1) });
    else spans.push({ kind: "link", value: match[2], href: match[3] });
    last = at + token.length;
    match = INLINE.exec(text);
  }
  if (last < text.length) spans.push({ kind: "text", value: text.slice(last) });
  return spans.length ? spans : [{ kind: "text", value: text }];
}

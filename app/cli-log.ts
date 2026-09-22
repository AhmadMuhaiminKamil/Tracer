import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type CliEntry = {
  ts: string;
  question: string;
  answer: string;
  tools: string[];
  ms: number;
};

// Same relative path as snapshot.ts: the CLI writes here, the dashboard reads it.
// (It used to point at the old insideriq/ project, which is why the log looked empty.)
const LOG_PATH = process.env.INSIDERIQ_CHAT_LOG ?? join(process.cwd(), "python", "data", "chat_log.jsonl");

export function readCliLog(limit = 20): CliEntry[] {
  if (!existsSync(/* turbopackIgnore: true */ LOG_PATH)) return [];
  try {
    const lines = readFileSync(/* turbopackIgnore: true */ LOG_PATH, "utf-8").trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .map((line) => {
        try {
          const parsed = JSON.parse(line) as Partial<CliEntry>;
          if (typeof parsed.ts !== "string" || typeof parsed.question !== "string" || typeof parsed.answer !== "string") return null;
          return {
            ts: parsed.ts,
            question: parsed.question,
            answer: parsed.answer,
            tools: Array.isArray(parsed.tools) ? parsed.tools : [],
            ms: typeof parsed.ms === "number" ? parsed.ms : 0,
          };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is CliEntry => entry !== null);
  } catch {
    return [];
  }
}

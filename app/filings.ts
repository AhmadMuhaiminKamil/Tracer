import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Filing = {
  symbol: string;
  holder_name: string;
  holder_type: string;
  transaction_type: string;
  amount_transaction: number;
  price: number;
  transaction_value: number;
  share_percentage_after: number;
  timestamp: string;
  source: string;
};

// Raw filings the CLI fetched. Same relative-path rule as cli-log.ts.
const PATH = process.env.INSIDERIQ_FILINGS ?? join(process.cwd(), "python", "data", "monitor", "filings.json");

export function readFilings(limit = 200): Filing[] {
  if (!existsSync(/* turbopackIgnore: true */ PATH)) return [];
  try {
    const rows = JSON.parse(readFileSync(/* turbopackIgnore: true */ PATH, "utf-8")) as Partial<Filing>[];
    return rows
      .filter((r) => typeof r.symbol === "string" && typeof r.timestamp === "string")
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .slice(0, limit)
      .map((r) => ({
        symbol: String(r.symbol),
        holder_name: String(r.holder_name ?? "—"),
        holder_type: String(r.holder_type ?? ""),
        transaction_type: String(r.transaction_type ?? ""),
        amount_transaction: Number(r.amount_transaction ?? 0),
        price: Number(r.price ?? 0),
        transaction_value: Number(r.transaction_value ?? 0),
        share_percentage_after: Number(r.share_percentage_after ?? 0),
        timestamp: String(r.timestamp),
        source: String(r.source ?? ""),
      }));
  } catch {
    return [];
  }
}

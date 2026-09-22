export type Fundamentals = {
  company_name: string | null;
  sector: string | null;
  sub_sector: string | null;
  market_cap: number | null;
  last_close: number | null;
  latest_close_date: string | null;
  low_52w: number | null;
  high_52w: number | null;
  high_ath: number | null;
  pe?: number | null;
  pb?: number | null;
  roe?: number | null;
  der?: number | null;
  valuation_year?: number | string | null;
  ratio_year?: number | string | null;
  revenue_growth?: number | null;
  earnings_growth?: number | null;
  drawdown_ath?: number | null;
  report_cached_at?: string | null;
};

export type Transaction = {
  holder_name: string;
  holder_type: string | null;
  timestamp: string;
  amount_transaction: number | null;
  price: number | null;
  transaction_value: number | null;
  source: string | null;
  body: string | null;
};

export type Cluster = {
  symbol: string;
  direction: "accumulation" | "distribution";
  participants: number;
  participant_names: string[];
  total_value: number;
  window_start: string;
  window_end: string;
  summary: string;
  fundamentals: Fundamentals;
  transactions: Transaction[];
  economic_classification?: "genuine_candidate" | "non_market_settlement";
  review_notes?: string[];
};

export type Scan = { scanned: number; kept: number; clusters: Cluster[]; partial?: boolean };

export function rupiah(value: number | null | undefined) {
  if (value == null) return "—";
  return "Rp" + value.toLocaleString("id-ID");
}

export function rupiahCompact(value: number | null | undefined, lang: "id" | "en" = "id") {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (lang === "en") {
    if (abs >= 1e12) return "Rp" + (value / 1e12).toFixed(2) + " T";
    if (abs >= 1e9) return "Rp" + (value / 1e9).toFixed(2) + " B";
    if (abs >= 1e6) return "Rp" + (value / 1e6).toFixed(2) + " M";
    return "Rp" + value.toLocaleString("en-US");
  }
  if (abs >= 1e12) return "Rp" + (value / 1e12).toFixed(2).replace(".", ",") + " T";
  if (abs >= 1e9) return "Rp" + (value / 1e9).toFixed(2).replace(".", ",") + " M";
  if (abs >= 1e6) return "Rp" + (value / 1e6).toFixed(2).replace(".", ",") + " jt";
  return "Rp" + value.toLocaleString("id-ID");
}

export function pricePosition(f: Fundamentals) {
  const { last_close: last, low_52w: low, high_52w: high } = f;
  if (last == null || low == null || high == null || high <= low) return null;
  return Math.round(((last - low) / (high - low)) * 100);
}

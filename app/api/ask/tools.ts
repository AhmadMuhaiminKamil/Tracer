import type { Snapshot } from "../../snapshot";
import type { Cluster } from "../../lib";

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "read_market_snapshot",
      description: "Baca ringkasan cluster terakhir. Bisa filter sektor. Hanya snapshot, bukan data live.",
      parameters: { type: "object", properties: { sector: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ticker_detail",
      description: "Detail ticker dari snapshot: pihak, nilai transaksi, tanggal, dan URL filing IDX. Tidak mengambil data live.",
      parameters: {
        type: "object",
        properties: { symbol: { type: "string" } },
        required: ["symbol"],
      },
    },
  },
];

function compact(cluster: Cluster) {
  const { transactions, ...summary } = cluster;
  return { ...summary, transaction_count: transactions?.length ?? 0 };
}

export function callSnapshotTool(name: string, args: Record<string, unknown>, snapshot: Snapshot) {
  const clusters = snapshot.payload.clusters;
  if (name === "read_market_snapshot") {
    const sector = String(args.sector ?? "").trim().toLowerCase();
    const filtered = sector
      ? clusters.filter((cluster) =>
          (cluster.fundamentals.sector ?? "").toLowerCase().includes(sector),
        )
      : clusters;
    return {
      source_updated_at: snapshot.source_updated_at,
      scanned: snapshot.payload.scanned,
      kept: snapshot.payload.kept,
      partial: Boolean(snapshot.payload.partial),
      clusters: filtered.slice(0, 50).map(compact),
      total_matching: filtered.length,
      note: sector && !filtered.length ? "Tidak ada cluster dengan sektor ini di snapshot. Data sektor mungkin belum tersedia." : "Snapshot tersimpan, bukan scan pasar live.",
    };
  }
  if (name === "get_ticker_detail") {
    const symbol = String(args.symbol ?? "").trim().toUpperCase().replace(/\.JK$/, "");
    const found = clusters.find((cluster) => cluster.symbol.replace(/\.JK$/, "") === symbol);
    return found ? { source_updated_at: snapshot.source_updated_at, ...found } : { error: "Ticker tidak ada di snapshot" };
  }
  return { error: "Tool tidak dikenal" };
}

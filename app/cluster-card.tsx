import { pricePosition, rupiah, rupiahCompact, type Cluster } from "./lib";
import { useT } from "./i18n";

function pct(value: number | null | undefined, digits = 1) {
  return value == null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

function Metric({ label, value, tone, title }: { label: string; value: string; tone?: "up" | "down" | "dim"; title?: string }) {
  return (
    <div className="metric" title={title}>
      <span className="metricLabel">{label}</span>
      <span className={"metricValue" + (tone ? ` ${tone}` : "")}>{value}</span>
    </div>
  );
}

export default function ClusterCard({ cluster }: { cluster: Cluster }) {
  const { t, lang } = useT();
  const f = cluster.fundamentals;
  const position = pricePosition(f);
  const accumulation = cluster.direction === "accumulation";
  return (
    <article className={"card" + (accumulation ? "" : " dist")}>
      <div className="cardHead">
        <div>
          <h2>{cluster.symbol}</h2>
          <span className="company">{f.company_name ?? "—"}</span>
        </div>
        <span className={"badge " + (accumulation ? "acc" : "dist")}>
          {accumulation ? "▲" : "▼"} {cluster.direction}
        </span>
      </div>
      <p className="window">
        {cluster.window_start} – {cluster.window_end} · {cluster.participant_names.length} pihak
      </p>

      {position != null && (
        <div className="bar" title={`Posisi 52 minggu: ${position}%`}>
          <div className="barFill" style={{ width: `${Math.min(Math.max(position, 0), 100)}%` }} />
        </div>
      )}

      <div className="metrics">
        <Metric label={t("th.parties")} value={String(cluster.participants)} />
        <Metric label={t("kpi.value")} value={rupiahCompact(cluster.total_value, lang)} title={rupiah(cluster.total_value)} />
        <Metric label={t("kpi.lastPrice")} value={rupiah(f.last_close)} />
        <Metric label={t("th.pos52w")} value={position == null ? "—" : `${position}%`} tone={position == null ? "dim" : undefined} />
        <Metric label={`PE / PB ${f.valuation_year ?? ""}`.trim()} value={`${f.pe == null ? "—" : f.pe.toFixed(1)} / ${f.pb == null ? "—" : f.pb.toFixed(1)}`} />
        <Metric label={`ROE / DER ${f.ratio_year ?? ""}`.trim()} value={`${f.roe == null ? "—" : `${(f.roe * 100).toFixed(1)}%`} / ${f.der == null ? "—" : f.der.toFixed(2)}`} />
        <Metric
          label={t("kpi.growth")}
          value={`${pct(f.revenue_growth)} / ${pct(f.earnings_growth)}`}
          tone={f.revenue_growth != null && f.revenue_growth < 0 ? "down" : f.revenue_growth != null ? "up" : "dim"}
        />
        <Metric label="Drawdown ATH" value={pct(f.drawdown_ath)} tone={f.drawdown_ath == null ? "dim" : "down"} />
      </div>

      <p className="summary">{cluster.summary}</p>

      {cluster.review_notes?.length ? (
        <div className="notes">
          {cluster.review_notes.map((note) => (
            <strong className="reviewNote" key={note}>{note}</strong>
          ))}
        </div>
      ) : null}

      <footer className="cardFoot">
        <span className="participants">{cluster.participant_names.join(" · ")}</span>
        <span className="caveat">{t("card.caveat1", { date: f.latest_close_date ?? t("card.missing") })}</span>
        <span className="caveat">{t("card.caveat2")}</span>
        <span className="evidence">
          {cluster.transactions.map((transaction, index) =>
            transaction.source ? (
              <a key={transaction.source} href={transaction.source} target="_blank" rel="noreferrer">
                Filing {index + 1} ↗
              </a>
            ) : null,
          )}
        </span>
      </footer>
    </article>
  );
}
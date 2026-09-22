"use client";

import { rupiah, rupiahCompact, type Cluster } from "./lib";
import type { Filing } from "./filings";
import ClusterCard from "./cluster-card";
import { useState } from "react";
import { useT } from "./i18n";

type Entry = { ts: string; question: string; answer: string; tools: string[]; ms: number };

export function ClustersView({ clusters }: { clusters: Cluster[] }) {
  const { t } = useT();
  return (
    <>
      <div className="sectionHead viewHead">
        <div>
          <h2>{t("clusters.title")}</h2>
          <p>{t("clusters.sub", { n: clusters.length })}</p>
        </div>
      </div>
      {clusters.length === 0 ? (
        <p className="empty">{t("empty.clusters")}</p>
      ) : (
        <div className="grid">
          {clusters.map((cluster) => (
            <ClusterCard key={cluster.symbol + cluster.window_start} cluster={cluster} />
          ))}
        </div>
      )}
    </>
  );
}

function largest(clusters: Cluster[]) {
  return clusters.reduce<Cluster | null>(
    (best, c) => (!best || c.total_value > best.total_value ? c : best),
    null,
  );
}

function topSectors(clusters: Cluster[]) {
  const tally = new Map<string, { count: number; value: number }>();
  for (const c of clusters) {
    const name = c.fundamentals.sector?.trim() || "Unknown";
    const row = tally.get(name) ?? { count: 0, value: 0 };
    tally.set(name, { count: row.count + 1, value: row.value + c.total_value });
  }
  return [...tally.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 8);
}

function positionBars(clusters: Cluster[]) {
  return clusters
    .filter((c) => c.fundamentals.last_close != null && c.fundamentals.low_52w != null && c.fundamentals.high_52w != null && c.fundamentals.high_52w > c.fundamentals.low_52w)
    .map((c) => ({
      symbol: c.symbol,
      direction: c.direction,
      value: c.total_value,
      participants: c.participants,
      position: ((c.fundamentals.last_close! - c.fundamentals.low_52w!) / (c.fundamentals.high_52w! - c.fundamentals.low_52w!)) * 100,
    }));
}

export function HomeView({
  scan, updatedAt, cliLog,
}: {
  scan: { scanned: number; kept: number; clusters: Cluster[]; partial?: boolean };
  updatedAt: string;
  cliLog: Entry[];
}) {
  const { t, lang } = useT();
  const clusters = scan.clusters;
  const accumulation = clusters.filter((c) => c.direction === "accumulation");
  const distribution = clusters.length - accumulation.length;
  const value = clusters.reduce((sum, c) => sum + c.total_value, 0);
  const participants = clusters.reduce((sum, c) => sum + c.participants, 0);
  const big = largest(clusters);
  const last = cliLog[cliLog.length - 1];

  return (
    <>
      <div className="viewHead">
        <h2>{t("home.title")}</h2>
        <p>{t("home.sub", { at: updatedAt })}</p>
      </div>

      <div className="kpi">
        <div className="kpiCard kpiGreen">
          <span className="kpiLabel">{t("kpi.filings")}</span>
          <span className="kpiValue green">{scan.kept}</span>
          <span className="kpiHint">{t("kpi.filings.hint", { scanned: scan.scanned, coverage: scan.partial ? t("snapshot.partial") : t("snapshot.full") })}</span>
        </div>
        <div className="kpiCard kpiViolet">
          <span className="kpiLabel">{t("kpi.clusters")}</span>
          <span className="kpiValue" style={{ color: "#a78bfa", textShadow: "0 0 16px var(--violet-glow)" }}>{clusters.length}</span>
          <span className="kpiHint">{t("kpi.clusters.hint", { acc: accumulation.length, dist: distribution })}</span>
        </div>
        <div className="kpiCard">
          <span className="kpiLabel">{t("kpi.value")}</span>
          <span className="kpiValue amber" title={rupiah(value)}>{rupiahCompact(value, lang)}</span>
          <span className="kpiHint">{t("kpi.value.hint")}</span>
        </div>
        <div className="kpiCard kpiCyan">
          <span className="kpiLabel">{t("kpi.parties")}</span>
          <span className="kpiValue" style={{ color: "#38bdf8", textShadow: "0 0 16px var(--cyan-glow)" }}>{participants}</span>
          <span className="kpiHint">{t("kpi.parties.hint")}</span>
        </div>
        <div className="kpiCard kpiPink">
          <span className="kpiLabel">{t("kpi.largest")}</span>
          <span className="kpiValue small" style={{ color: "#f472b6", textShadow: "0 0 16px var(--pink-glow)" }} title={big ? `${big.symbol} · ${rupiah(big.total_value)}` : undefined}>{big ? `${big.symbol} · ${rupiahCompact(big.total_value, lang)}` : "—"}</span>
          <span className="kpiHint">{big?.fundamentals.company_name ?? t("kpi.largest.hint")}</span>
        </div>
      </div>

      <div className="split">
        <section className="panel">
          <div className="panelHead">
            <h3>{t("panel.clusterPos")}</h3>
            <span>{t("panel.byValue")}</span>
          </div>
          {clusters.length === 0 ? (
            <p className="empty">{t("empty.clustersTable")}</p>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("th.ticker")}</th>
                    <th>{t("th.parties")}</th>
                    <th>{t("th.value")}</th>
                    <th>{t("th.pos52w")}</th>
                  </tr>
                </thead>
                <tbody>
                  {positionBars(clusters).map((row) => (
                    <tr key={row.symbol}>
                      <td className="sym">
                        {row.symbol}
                        <br />
                        <span className={"dir " + (row.direction === "accumulation" ? "acc" : "dist")}>{row.direction}</span>
                      </td>
                      <td className="num">{row.participants}</td>
                      <td className="num">{rupiah(row.value)}</td>
                      <td>
                        <span className="pos" title={`${Math.round(row.position)}%`}>
                          <i style={{ width: `${Math.min(Math.max(row.position, 0), 100)}%` }} />
                        </span>
                        <span className="num"> {Math.round(row.position)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="panelFoot">{t("panel.clusterPos.foot")}</p>
        </section>

        <div style={{ display: "grid", gap: 18 }}>
          <section className="panel">
            <div className="panelHead">
              <h3>{t("panel.sector")}</h3>
              <span>by transaction value</span>
            </div>
            {topSectors(clusters).length === 0 ? (
              <p className="empty">{t("empty.sectors")}</p>
            ) : (
              <div>
                {topSectors(clusters).map(([name, row]) => {
                  const max = topSectors(clusters)[0][1].value || 1;
                  return (
                    <div key={name} style={{ marginBottom: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                        <span>{name}</span>
                        <span className="num" style={{ color: "var(--muted)" }}>{row.count} · {rupiah(row.value)}</span>
                      </div>
                      <div className="bar">
                        <div className="barFill" style={{ width: `${Math.round((row.value / max) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="panelFoot">{t("panel.sector.foot")}</p>
          </section>

          <section className="panel">
            <div className="panelHead">
              <h3>{t("panel.activity")}</h3>
              <span>{t("panel.activity.from", { n: cliLog.length })}</span>
            </div>
            {last ? (
              <>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{last.question}</p>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.5 }}>
                  {last.answer.length > 220 ? `${last.answer.slice(0, 220)}…` : last.answer}
                </p>
                <p className="logMeta" style={{ marginTop: 8 }} suppressHydrationWarning>
                  {new Date(last.ts).toLocaleString("id-ID")} · {last.tools.length ? last.tools.join(", ") : "tanpa tool"} · {last.ms} ms
                </p>
              </>
            ) : (
              <p className="empty">{t("empty.cliActivity")}</p>
            )}
            <p className="panelFoot">{t("panel.activity.foot")}</p>
          </section>
        </div>
      </div>
    </>
  );
}

const PER_PAGE = 50;

/** Every filing the CLI fetched, newest first, 50 per page. */
export function FilingsView({ filings }: { filings: Filing[] }) {
  const { t } = useT();
  const [page, setPage] = useState(0);

  if (!filings.length) {
    return (
      <div className="viewHead">
        <h2>{t("filings.title")}</h2>
        <p className="empty">{t("filings.empty")}</p>
      </div>
    );
  }

  const buys = filings.filter((f) => f.transaction_type === "buy").length;
  const pages = Math.ceil(filings.length / PER_PAGE);
  const current = Math.min(page, pages - 1);
  const slice = filings.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  return (
    <>
      <div className="viewHead">
        <h2>{t("filings.title")}</h2>
        <p>{t("filings.sub", { n: filings.length, buy: buys, sell: filings.length - buys })}</p>
      </div>
      <div className="panel">
        <table className="dataTable">
          <thead>
            <tr>
              <th>{t("filings.date")}</th>
              <th>{t("filings.ticker")}</th>
              <th>{t("filings.holder")}</th>
              <th>{t("filings.side")}</th>
              <th className="num">{t("filings.value")}</th>
              <th className="num">{t("filings.after")}</th>
              <th>{t("filings.evidence")}</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((f, i) => (
              <tr key={f.source + i}>
                <td className="mono">{f.timestamp.slice(0, 10)}</td>
                <td><b className="amber">{f.symbol}</b></td>
                <td>
                  {f.holder_name}
                  {f.holder_type && <span className="tag">{f.holder_type}</span>}
                </td>
                <td>
                  <span className={"dir " + (f.transaction_type === "buy" ? "acc" : "dist")}>
                    {f.transaction_type === "buy" ? "▲" : "▼"} {f.transaction_type}
                  </span>
                </td>
                <td className="num">{rupiah(f.transaction_value)}</td>
                <td className="num">{f.share_percentage_after ? `${f.share_percentage_after}%` : "—"}</td>
                <td>{f.source && <a href={f.source} target="_blank" rel="noreferrer">↗</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages > 1 && (
          <nav className="pager" aria-label={t("filings.pager")}>
            <button type="button" className="ghostBtn" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label={t("filings.prev")}>
              ←
            </button>
            {Array.from({ length: pages }, (_, i) => (
              <button
                type="button"
                key={i}
                className={i === current ? "pageDot on" : "pageDot"}
                aria-current={i === current}
                onClick={() => setPage(i)}
              >
                {i + 1}
              </button>
            ))}
            <button type="button" className="ghostBtn" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label={t("filings.next")}>
              →
            </button>
          </nav>
        )}
      </div>
    </>
  );
}

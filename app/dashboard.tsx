"use client";

import { useEffect, useState } from "react";
import type { Snapshot } from "./snapshot";
import type { CliEntry } from "./cli-log";
import { NAV_PROVIDER, Sidebar, useNav, type View } from "./nav";
import { HomeView, ClustersView, FilingsView } from "./views";
import ChatRoom from "./chat-room";
import { LangProvider, SetupNotice, useT } from "./i18n";
import type { Filing } from "./filings";
import ApiKeysView from "./views-keys";

const VIEWS: View[] = ["home", "clusters", "filings", "sessions", "cli", "keys"];
const TITLES: Record<View, string> = {
  home: "nav.home",
  clusters: "nav.clusters",
  filings: "nav.filings",
  sessions: "nav.sessions",
  cli: "nav.cli",
  keys: "nav.keys",
};

function Body({ snapshot, cliLog, filings, ageHours, missingData }: { snapshot: Snapshot; cliLog: CliEntry[]; filings: Filing[]; ageHours: number | null; missingData: boolean }) {
  const { view } = useNav();
  const { t } = useT();
  const scan = snapshot.payload;

  // Age is the whole point of a snapshot: say how old it is, loudly once it goes stale.
  const hours = ageHours;
  const age =
    hours == null ? null
    : hours < 1 ? t("age.minutes", { n: Math.max(1, Math.round(hours * 60)) })
    : hours < 48 ? t("age.hours", { n: Math.round(hours) })
    : t("age.days", { n: Math.round(hours / 24) });
  const ageNotice = hours == null ? null : { stale: hours > 24, text: t("age.body", { age: age ?? "" }) };

  return (
    <>
      <div className="mobileBar">
        <div className="brandMark" role="img" aria-label="Tracer" />
        <b>{t(TITLES[view] as "nav.home")}</b>
        <button type="button" className="burger" onClick={() => document.dispatchEvent(new Event("insideriq:menu"))}>
          ☰ Menu
        </button>
      </div>
      <div className={"wrap" + (view === "sessions" ? " wrapWide" : "")}>
        {missingData && <SetupNotice />}
        {!missingData && ageNotice && (
          <p className={"notice" + (ageNotice.stale ? " danger" : "")}>
            <span>
              <b>{ageNotice.stale ? t("age.stale") : t("age.fresh")}</b> {ageNotice.text}
              {scan.partial && ` ${t("age.partial")}`}
            </span>
          </p>
        )}

        {view === "home" && !missingData && <HomeView scan={scan} updatedAt={snapshot.source_updated_at} cliLog={cliLog} />}
        {view === "clusters" && <ClustersView clusters={scan.clusters} />}
        {view === "filings" && <FilingsView filings={filings} />}
        {view === "sessions" && <ChatRoom />}
        {view === "keys" && (
          <>
            <div className="viewHead">
              <h2>{t("api.title")}</h2>
              <p>{t("api.sub")}</p>
            </div>
            <ApiKeysView />
          </>
        )}
        {view === "cli" && (
          <>
            <div className="viewHead">
              <h2>{t("cli.title")}</h2>
              <p>{t("cli.sub", { n: cliLog.length })}</p>
            </div>
            {cliLog.length === 0 ? (
              <p className="empty">{t("empty.cliLog")}</p>
            ) : (
              <div className="logList">
                {cliLog.slice().reverse().map((entry, index) => (
                  <details className="logItem" key={entry.ts + index}>
                    <summary>
                      <b>{entry.question}</b>
                      <span className="logMeta" suppressHydrationWarning>
                        {new Date(entry.ts).toLocaleString("id-ID")} · {entry.tools.length ? entry.tools.join(", ") : t("cli.noTool")} · {entry.ms} ms
                      </span>
                    </summary>
                    <p>{entry.answer}</p>
                  </details>
                ))}
              </div>
            )}
          </>
        )}

        <p className="sideNote" style={{ marginTop: 34 }}>
          Research and education only. Not financial advice and not a buy or sell recommendation. Data is historical and partial; classification is heuristic.
        </p>
      </div>
    </>
  );
}

export default function Dashboard({ snapshot, cliLog, filings, ageHours, missingData = false }: { snapshot: Snapshot; cliLog: CliEntry[]; filings: Filing[]; ageHours: number | null; missingData?: boolean }) {
  const [view, setView] = useState<View>("home");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as View;
    if (VIEWS.includes(hash)) setView(hash);
  }, []);

  useEffect(() => {
    const open = () => setMenuOpen(true);
    document.addEventListener("insideriq:menu", open);
    return () => document.removeEventListener("insideriq:menu", open);
  }, []);

  // back/forward and external #view links stay in sync after mount
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace("#", "") as View;
      if (VIEWS.includes(hash)) setView(hash);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function go(next: View) {
    setView(next);
    window.history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0 });
  }

  return (
    <NAV_PROVIDER value={{ view, go }}>
      <LangProvider>
      <div className="shell">
        <Sidebar
          scan={{
            scanned: snapshot.payload.scanned,
            kept: snapshot.payload.kept,
            clusters: snapshot.payload.clusters.length,
            partial: snapshot.payload.partial,
          }}
          updatedAt={snapshot.source_updated_at}
          cliCount={cliLog.length}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />
        <main className="main">
          <Body snapshot={snapshot} cliLog={cliLog} filings={filings} ageHours={ageHours} missingData={missingData} />
        </main>
      </div>
      </LangProvider>
    </NAV_PROVIDER>
  );
}
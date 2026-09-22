"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { SESSIONS_KEY, parseSessions } from "./browser-state";
import { LangSwitch, useT } from "./i18n";

export type View = "home" | "clusters" | "filings" | "sessions" | "cli" | "keys";

export type Counts = { sessions: number; alerts: number; cli: number };

const NavContext = createContext<{ view: View; go: (view: View) => void }>({ view: "home", go: () => {} });

export const useNav = () => useContext(NavContext);

const EVENT = "insideriq:state";
const EMPTY: Counts = { sessions: 0, alerts: 0, cli: 0 };

/** Chat announces its live localStorage counts; the sidebar listens. No store, no context plumbing. */
export function notifyState(counts: Partial<Counts>) {
  window.dispatchEvent(new CustomEvent<Partial<Counts>>(EVENT, { detail: counts }));
}

/** Seeds from localStorage so counts are right before any chat mounts, then follows live events. */
export function useCounts(cli = 0) {
  const [counts, setCounts] = useState<Counts>(EMPTY);
  useEffect(() => {
    setCounts((current) => ({
      ...current,
      cli,
      sessions: parseSessions(localStorage.getItem(SESSIONS_KEY)).length,
    }));
    const onState = (event: Event) => {
      const detail = (event as CustomEvent<Partial<Counts>>).detail;
      if (detail) setCounts((current) => ({ ...current, ...detail }));
    };
    window.addEventListener(EVENT, onState);
    return () => window.removeEventListener(EVENT, onState);
  }, [cli]);
  return counts;
}

const ITEMS: { id: View; icon: string; label: string; group: "main" | "activity" | "api" }[] = [
  { id: "home", icon: "◆", label: "nav.home", group: "main" },
  { id: "clusters", icon: "▦", label: "nav.clusters", group: "main" },
  { id: "filings", icon: "≡", label: "nav.filings", group: "main" },
  { id: "sessions", icon: "⌘", label: "nav.sessions", group: "activity" },
  { id: "cli", icon: "▤", label: "nav.cli", group: "activity" },
  { id: "keys", icon: "⚿", label: "nav.keys", group: "api" },
];

function badgeFor(id: View, counts: Counts) {
  if (id === "sessions") return counts.sessions;
  if (id === "cli") return counts.cli;
  return 0;
}

export function Sidebar({
  scan, updatedAt, cliCount, open, onClose,
}: {
  scan: { scanned: number; kept: number; clusters: number; partial?: boolean };
  updatedAt: string;
  cliCount: number;
  open: boolean;
  onClose: () => void;
}) {
  const { view, go } = useNav();
  const counts = useCounts(cliCount);
  const { t } = useT();

  function nav(id: View) {
    go(id);
    onClose();
  }

  const groups: ("main" | "activity" | "api")[] = ["main", "activity", "api"];
  return (
    <>
      {open && <button className="scrim" type="button" aria-label="Tutup navigasi" onClick={onClose} />}
      <aside className={"sidebar" + (open ? " open" : "")} aria-label="Navigasi utama">
        <div className="brand">
          <div className="brandMark" role="img" aria-label="Tracer" />
          <div className="brandText">
            <h1>Tracer</h1>
            <span><span className="livePulse" />{t("brand.tagline")}</span>
          </div>
        </div>

        {groups.map((group) => (
          <nav className="nav" key={group}>
            <span className="navLabel">{t(`nav.${group}` as "nav.main")}</span>
            {ITEMS.filter((item) => item.group === group).map((item) => {
              const badge = badgeFor(item.id, counts);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={"navItem" + (view === item.id ? " on" : "")}
                  aria-current={view === item.id ? "page" : undefined}
                  onClick={() => nav(item.id)}
                >
                  <i aria-hidden="true">{item.icon}</i>
                  {t(item.label as "nav.home")}
                  {badge ? <span className="navCount">{badge}</span> : null}
                </button>
              );
            })}
          </nav>
        ))}

        <div className="sideFoot">
          {scan.scanned > 0 && (
          <div className="sideStat">
            <b>{t("snapshot.label")}</b>
            <span>
              {scan.clusters} cluster · {scan.kept}/{scan.scanned} filing
              <br />
              <span className={scan.partial ? "warn" : "ok"}>{scan.partial ? t("snapshot.partial") : t("snapshot.full")}</span>
            </span>
          </div>
          )}
          {updatedAt && (
            <div className="sideStat">
              <b>{t("snapshot.updated")}</b>
              <span suppressHydrationWarning>{new Date(updatedAt).toLocaleString("id-ID")}</span>
            </div>
          )}
          <LangSwitch />
          <p className="sideNote">{t("disclaimer")}</p>
        </div>
      </aside>
    </>
  );
}

export const NAV_PROVIDER = NavContext.Provider;
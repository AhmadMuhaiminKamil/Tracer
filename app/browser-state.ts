export const HISTORY_KEY = "insideriq.chat.v1";
export const WATCHLIST_KEY = "insideriq.watchlist.v1";
export const WATCHLIST_SNAPSHOT_KEY = "insideriq.watchlist-snapshot.v1";
export const STORAGE_VERSION = 1;
export const MAX_ITEMS = 50;

export type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
export type MessageMeta = { tools?: string[]; latency_ms?: number; usage?: Usage };
export type ChatMessage = { role: "user" | "assistant"; content: string; meta?: MessageMeta };
export type WatchlistCluster = { symbol: string; direction?: string; window_end?: string };
export type WatchlistSnapshot = Record<string, string>;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value = record(JSON.parse(raw));
    return value?.version === STORAGE_VERSION ? value : null;
  } catch {
    return null;
  }
}

export function parseHistory(raw: string | null): ChatMessage[] {
  const messages = parse(raw)?.messages;
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((item) => {
      const value = record(item);
      return (
        (value?.role === "user" || value?.role === "assistant") &&
        typeof value.content === "string"
      );
    })
    .slice(-MAX_ITEMS) as ChatMessage[];
}

export function stringifyHistory(messages: ChatMessage[]) {
  return JSON.stringify({ version: STORAGE_VERSION, messages: messages.slice(-MAX_ITEMS) });
}

export function appendMessage(messages: ChatMessage[], message: ChatMessage) {
  return [...messages, message].slice(-MAX_ITEMS);
}

export function normalizeTicker(value: string) {
  const ticker = value.trim().toUpperCase().replace(/\.JK$/, "");
  return /^[A-Z0-9-]{1,20}$/.test(ticker) ? ticker : "";
}

export function parseWatchlist(raw: string | null): string[] {
  const tickers = parse(raw)?.tickers;
  if (!Array.isArray(tickers)) return [];
  return tickers.reduce<string[]>((result, value) => {
    if (typeof value !== "string") return result;
    const ticker = normalizeTicker(value);
    if (ticker && !result.includes(ticker) && result.length < MAX_ITEMS) result.push(ticker);
    return result;
  }, []);
}

export function stringifyWatchlist(tickers: string[]) {
  return JSON.stringify({ version: STORAGE_VERSION, tickers: tickers.slice(0, MAX_ITEMS) });
}

export function addTicker(tickers: string[], value: string) {
  const ticker = normalizeTicker(value);
  return !ticker || tickers.includes(ticker) || tickers.length >= MAX_ITEMS
    ? tickers
    : [...tickers, ticker];
}

export function removeTicker(tickers: string[], value: string) {
  const ticker = normalizeTicker(value);
  return tickers.filter((item) => item !== ticker);
}

export function clusterSignatures(clusters: WatchlistCluster[], watchlist: string[]): WatchlistSnapshot {
  const watched = new Set(watchlist);
  return clusters.reduce<WatchlistSnapshot>((result, cluster) => {
    const symbol = normalizeTicker(cluster.symbol);
    if (watched.has(symbol)) result[symbol] = `${cluster.direction ?? ""}|${cluster.window_end ?? ""}`;
    return result;
  }, {});
}

export function parseWatchlistSnapshot(raw: string | null): WatchlistSnapshot {
  const values = parse(raw)?.values;
  const source = record(values);
  if (!source) return {};
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string] => normalizeTicker(entry[0]) === entry[0] && typeof entry[1] === "string",
    ),
  );
}

export function stringifyWatchlistSnapshot(values: WatchlistSnapshot) {
  return JSON.stringify({ version: STORAGE_VERSION, values });
}

// ── Sessions ────────────────────────────────────────────────────────────
export const SESSIONS_KEY = "insideriq.sessions.v1";
export const ACTIVE_SESSION_KEY = "insideriq.session-active.v1";
export const MAX_SESSIONS = 30;

export type SessionMeta = { id: string; title: string; updated: string };

function sessionId() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function parseSessions(raw: string | null): SessionMeta[] {
  const sessions = parse(raw)?.sessions;
  if (!Array.isArray(sessions)) return [];
  return sessions
    .filter((item): item is SessionMeta => {
      const value = record(item);
      return !!value && typeof value.id === "string" && typeof value.title === "string" && typeof value.updated === "string";
    })
    .slice(0, MAX_SESSIONS);
}

export function stringifySessions(sessions: SessionMeta[]) {
  return JSON.stringify({ version: STORAGE_VERSION, sessions: sessions.slice(0, MAX_SESSIONS) });
}

export function parseActive(raw: string | null): string {
  const id = parse(raw)?.active;
  return typeof id === "string" ? id : "";
}

export function stringifyActive(id: string) {
  return JSON.stringify({ version: STORAGE_VERSION, active: id });
}

export function newSession(sessions: SessionMeta[], firstQuestion: string): { sessions: SessionMeta[]; activeId: string } {
  const activeId = sessionId();
  const title = firstQuestion.slice(0, 60) || "Sesi baru";
  const meta: SessionMeta = { id: activeId, title, updated: new Date().toISOString() };
  return { sessions: [meta, ...sessions].slice(0, MAX_SESSIONS), activeId };
}

export function touchSession(sessions: SessionMeta[], id: string, firstQuestion?: string): SessionMeta[] {
  if (!id) return sessions;
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return sessions;
  const updated = { ...sessions[idx], updated: new Date().toISOString() };
  // only placeholder titles get renamed by a later question
  if (firstQuestion && sessions[idx].title === "Sesi baru") updated.title = firstQuestion.slice(0, 60);
  return [updated, ...sessions.filter((s) => s.id !== id)];
}

export function removeSession(sessions: SessionMeta[], id: string): SessionMeta[] {
  return sessions.filter((s) => s.id !== id);
}


"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Markdown from "./markdown-view";
import { useT } from "./i18n";
import {
  ACTIVE_SESSION_KEY,
  HISTORY_KEY,
  SESSIONS_KEY,
  appendMessage,
  newSession,
  parseActive,
  parseHistory,
  parseSessions,
  removeSession,
  stringifyActive,
  stringifyHistory,
  stringifySessions,
  touchSession,
  type ChatMessage,
  type MessageMeta,
  type SessionMeta,
  type Usage,
} from "./browser-state";

type ApiData = Record<string, unknown>;

const THINKING_STEPS = ["step.1", "step.2", "step.3", "step.4"] as const;

const SUGGESTIONS = ["cluster", "accumulation", "sector", "heal"] as const;

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function responseMeta(data: ApiData): MessageMeta | undefined {
  const rawTools = data.tools ?? data.tool_names ?? data.used_tools ?? data.tool_calls;
  const tools = Array.isArray(rawTools)
    ? rawTools
        .map((tool) => {
          if (typeof tool === "string") return tool;
          if (!tool || typeof tool !== "object") return "";
          const value = tool as ApiData;
          return String(value.name ?? (value.function as ApiData | undefined)?.name ?? "");
        })
        .filter(Boolean)
    : [];
  const rawUsage = (data.usage ?? data.token_usage ?? data.tokens) as ApiData | undefined;
  const usage: Usage = {
    prompt_tokens: number(rawUsage?.prompt_tokens ?? rawUsage?.promptTokens ?? rawUsage?.input_tokens),
    completion_tokens: number(rawUsage?.completion_tokens ?? rawUsage?.completionTokens ?? rawUsage?.output_tokens),
    total_tokens: number(rawUsage?.total_tokens ?? rawUsage?.totalTokens ?? rawUsage?.total),
  };
  const latency_ms = number(data.latency_ms ?? data.latency ?? data.duration_ms);
  return tools.length || latency_ms !== undefined || Object.values(usage).some((value) => value !== undefined)
    ? { tools, latency_ms, usage }
    : undefined;
}

function metaLine(meta: MessageMeta) {
  const parts: string[] = [];
  if (meta.tools?.length) parts.push(meta.tools.join(", "));
  if (meta.latency_ms !== undefined) parts.push(`${meta.latency_ms} ms`);
  if (meta.usage?.total_tokens !== undefined) parts.push(`${meta.usage.total_tokens} token`);
  else if (meta.usage?.prompt_tokens !== undefined) parts.push(`input ${meta.usage.prompt_tokens}`);
  return parts.join(" · ");
}

// Dates render identically on server and client (both UTC) — a Date.now() relative
// time here caused a React #418 hydration mismatch that re-mounted the spinner.
function ago(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  return new Date(then).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function readCount(id: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${HISTORY_KEY}:${id}`) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export default function ChatRoom() {
  const { t } = useT();
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [commandList, setCommandList] = useState<{ cmd: string; args: string; en: string; id: string }[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [reveal, setReveal] = useState<{ index: number; shown: number } | null>(null);
  const stream = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((d) => {
        const list: { id: string; title: string; updated: string; history?: ChatMessage[] }[] = d.sessions || [];
        if (list.length) {
          const metas: SessionMeta[] = list.map((s) => ({ id: s.id, title: s.title, updated: s.updated }));
          setSessions(metas);
          const active = parseActive(localStorage.getItem(ACTIVE_SESSION_KEY));
          const currentId = active && metas.some((s) => s.id === active) ? active : metas[0].id;
          setActiveId(currentId);
          const target = list.find((s) => s.id === currentId);
          setMessages(target?.history?.length ? target.history : []);
          setReady(true);
          return;
        }
        const stored = parseSessions(localStorage.getItem(SESSIONS_KEY));
        const active = parseActive(localStorage.getItem(ACTIVE_SESSION_KEY));
        const id = active && stored.some((s) => s.id === active) ? active : stored[0]?.id ?? "";
        setSessions(stored);
        setActiveId(id);
        setMessages(id ? parseHistory(localStorage.getItem(`${HISTORY_KEY}:${id}`)) : []);
        setReady(true);
      })
      .catch(() => {
        const stored = parseSessions(localStorage.getItem(SESSIONS_KEY));
        const active = parseActive(localStorage.getItem(ACTIVE_SESSION_KEY));
        const id = active && stored.some((s) => s.id === active) ? active : stored[0]?.id ?? "";
        setSessions(stored);
        setActiveId(id);
        setMessages(id ? parseHistory(localStorage.getItem(`${HISTORY_KEY}:${id}`)) : []);
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!ready || !activeId) return;
    localStorage.setItem(`${HISTORY_KEY}:${activeId}`, stringifyHistory(messages));
    const currentSession = sessions.find((s) => s.id === activeId);
    if (currentSession && messages.length) {
      void fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          session: {
            id: activeId,
            title: currentSession.title,
            updated: currentSession.updated,
            history: messages.map(({ role, content }) => ({ role, content })),
          },
        }),
      });
    }
  }, [messages, ready, activeId, sessions]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(SESSIONS_KEY, stringifySessions(sessions));
    localStorage.setItem(ACTIVE_SESSION_KEY, stringifyActive(activeId));
  }, [sessions, activeId, ready]);

  // live status + elapsed clock while the agent works
  useEffect(() => {
    if (!loading) {
      setStep(0);
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const statusTimer = setInterval(() => setStep((current) => (current + 1) % THINKING_STEPS.length), 2300);
    const clockTimer = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 100);
    return () => {
      clearInterval(statusTimer);
      clearInterval(clockTimer);
    };
  }, [loading]);

  // Command list comes from python/commands.py so the CLI and the composer
  // can never disagree about what exists.
  useEffect(() => {
    void fetch("/api/commands")
      .then((r) => r.json())
      .then((d) => setCommandList(d.commands ?? []))
      .catch(() => setCommandList([]));
  }, []);

  // Palette shows only while the line starts with "/" and has no argument yet.
  const palette =
    question.startsWith("/") && !question.includes(" ")
      ? commandList.filter((c) => c.cmd.startsWith(question.toLowerCase()))
      : [];

  // lazy typewriter: the answer types itself in. Skipped entirely under reduced motion.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !last.content) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const index = messages.length - 1;
    const total = last.content.length;
    const stepChars = Math.max(3, Math.ceil(total / 70)); // ~1.1s regardless of length
    setReveal({ index, shown: 0 });
    const timer = setInterval(() => {
      setReveal((current) => {
        if (!current) return null;
        const next = current.shown + stepChars;
        return next >= total ? null : { index, shown: next };
      });
    }, 16);
    return () => clearInterval(timer);
  }, [messages]);

  useEffect(() => {
    const el = stream.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, reveal, step]);

  function grow() {
    const el = input.current;
    if (!el) return;
    // scrollHeight excludes the 1px borders under border-box, so add them back
    // or the box stays 2px short of its content and shows a scrollbar.
    el.style.height = "auto";
    const borders = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + borders}px`;
  }

  async function newData() {
    setMessages((current) => appendMessage(current, { role: "user", content: "/newdata" }));
    setQuestion("");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/refresh", { method: "POST" });
      const data = (await response.json()) as ApiData;
      if (!response.ok) throw new Error(String(data.error ?? t("refresh.failed")));
      setMessages((current) =>
        appendMessage(current, {
          role: "assistant",
          content: t("refresh.done", { rows: String(data.rows ?? 0), credits: String(data.credits ?? 0) }),
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("refresh.failed"));
    } finally {
      setLoading(false);
    }
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    if (trimmed === "/newdata") return newData();
    const history = messages.slice(-12).map(({ role, content }) => ({ role, content }));

    let sessionId = activeId;
    if (!sessionId) {
      const created = newSession(sessions, trimmed);
      setSessions(created.sessions);
      setActiveId(created.activeId);
      sessionId = created.activeId;
      localStorage.setItem(`${HISTORY_KEY}:${created.activeId}`, stringifyHistory([{ role: "user", content: trimmed }]));
    } else {
      setSessions((current) => touchSession(current, sessionId, trimmed));
    }

    setMessages((current) => appendMessage(current, { role: "user", content: trimmed }));
    setQuestion("");
    if (input.current) input.current.style.height = "auto";
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history }),
      });
      const data = (await response.json()) as ApiData;
      if (!response.ok) throw new Error(String(data.error ?? "Agent gagal"));
      setMessages((current) =>
        appendMessage(current, { role: "assistant", content: String(data.answer ?? ""), meta: responseMeta(data) }),
      );
      setSessions((current) => touchSession(current, sessionId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Agent gagal");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (palette.length) {
      if (event.key === "ArrowDown") return (event.preventDefault(), setHighlight((h) => (h + 1) % palette.length));
      if (event.key === "ArrowUp") return (event.preventDefault(), setHighlight((h) => (h - 1 + palette.length) % palette.length));
      if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
        event.preventDefault();
        return setQuestion(`${palette[highlight].cmd} `);
      }
      if (event.key === "Escape") return (event.preventDefault(), setQuestion(""));
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(question);
    }
  }

  function startSession() {
    if (activeId && messages.length === 0) {
      input.current?.focus();
      return;
    }
    const created = newSession(sessions, "");
    setSessions(created.sessions);
    setActiveId(created.activeId);
    setMessages([]);
    setError("");
    setQuestion("");
    input.current?.focus();
  }

  function switchSession(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    setMessages(parseHistory(localStorage.getItem(`${HISTORY_KEY}:${id}`)));
    setError("");
  }

  function deleteSession(id: string) {
    const remaining = removeSession(sessions, id);
    localStorage.removeItem(`${HISTORY_KEY}:${id}`);
    setSessions(remaining);
    void fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (id === activeId) {
      const next = remaining[0]?.id ?? "";
      setActiveId(next);
      setMessages(next ? parseHistory(localStorage.getItem(`${HISTORY_KEY}:${next}`)) : []);
    }
  }

  function clearAll() {
    for (const session of sessions) localStorage.removeItem(`${HISTORY_KEY}:${session.id}`);
    setSessions([]);
    setActiveId("");
    setMessages([]);
    setError("");
    void fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
  }

  function clearActive() {
    setMessages([]);
    if (activeId) localStorage.removeItem(`${HISTORY_KEY}:${activeId}`);
  }

  const active = sessions.find((session) => session.id === activeId);

  return (
    <div className="chatRoom">
      <aside className="sessionRail" aria-label={t("chat.history")}>
        <button type="button" className="newChatBtn" onClick={startSession}>
          <span aria-hidden="true">＋</span> {t("chat.new")}
        </button>
        <span className="railLabel">{t("chat.history")}</span>
        <ul className="railList">
          {sessions.length === 0 && <li className="railEmpty">{t("chat.empty")}</li>}
          {sessions.map((session) => (
            <li key={session.id} className={"railItem" + (session.id === activeId ? " on" : "")}>
              <button
                type="button"
                className="railMain"
                onClick={() => switchSession(session.id)}
                title={session.title}
                aria-current={session.id === activeId ? "true" : undefined}
              >
                <span className="railTitle">{session.title}</span>
                <span className="railMeta">
                  {ago(session.updated)} · {session.id === activeId ? messages.length : readCount(session.id)} messages
                </span>
              </button>
              <button
                type="button"
                className="railDel"
                onClick={() => deleteSession(session.id)}
                aria-label={`${t("chat.delete")} ${session.title}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="railFoot">
          <span className="railMeta">{t("chat.count", { n: sessions.length })}</span>
          <button type="button" className="ghostBtn" onClick={clearAll} disabled={!sessions.length}>
            {t("chat.deleteAll")}
          </button>
        </div>
      </aside>

      <section className="chatPane">
        <header className="chatPaneHead">
          <div className="avatar" role="img" aria-label="Tracer" />
          <h3>{active ? active.title : t("chat.new")}</h3>
          <span>{active ? ago(active.updated) : t("chat.notStarted")}</span>
          <button type="button" className="ghostBtn" onClick={clearActive} disabled={!messages.length}>
            {t("chat.clear")}
          </button>
        </header>

        <div className="stream" ref={stream} aria-live="polite" aria-busy={loading}>
          <div className="streamInner">
            {messages.length === 0 && !loading && (
              <div className="welcome">
                <h4>{t("chat.title")}</h4>
                <p>
                  {t("chat.sub")}
                </p>
                <div className="chips">
                  {SUGGESTIONS.map((prompt) => (
                    <button type="button" className="chip" key={t(`sug.${prompt}` as "sug.cluster")} onClick={() => void ask(t(`sug.${prompt}` as "sug.cluster"))}>
                      {t(`sug.${prompt}` as "sug.cluster")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) =>
              message.role === "user" ? (
                <div className="turn user" key={index}>
                  <div className="bubbleUser">{message.content}</div>
                </div>
              ) : (
                <div className="turn bot" key={index}>
                  <div className="avatar" role="img" aria-label="Tracer" />
                  <div className={"botBody" + (reveal?.index === index ? " revealing" : "")}>
                    <div className="mdBody">
                      <Markdown
                        text={reveal?.index === index ? message.content.slice(0, reveal.shown) : message.content}
                        partial={reveal?.index === index}
                      />
                      {reveal?.index === index && <span className="caret" aria-hidden="true" />}
                    </div>
                    {message.meta && reveal?.index !== index && <small className="msgMeta">{metaLine(message.meta)}</small>}
                  </div>
                </div>
              ),
            )}

            {loading && (
              <div className="turn bot">
                <div className="avatar" role="img" aria-label="Tracer" />
                <div className="thinking">
                  <span className="orbit" aria-hidden="true" />
                  <div className="thinkingInfo">
                    <b key={step} className="thinkingStep">
                      {t(THINKING_STEPS[step])}
                    </b>
                    <span className="thinkingSub">
                      {t("thinking.sub", { s: elapsed.toFixed(1) })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="chatError" role="alert">{error}</p>}
          </div>
        </div>

        <form className="composer" onSubmit={submit}>
          {palette.length > 0 && (
            <ul className="cmdPalette" role="listbox" aria-label={t("cmd.list")}>
              {palette.map((entry, index) => (
                <li key={entry.cmd}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlight}
                    className={index === highlight ? "on" : ""}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => setQuestion(`${entry.cmd} `)}
                  >
                    <span className="cmdName">{entry.cmd}</span>
                    {entry.args && <span className="cmdArgs">{entry.args}</span>}
                    <span className="cmdDesc">{t(`cmd.${entry.cmd.slice(1)}` as "cmd.scan")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="composerInner">
            <label htmlFor="ask">{t("chat.question")}</label>
            <textarea
              id="ask"
              ref={input}
              value={question}
              rows={1}
              maxLength={1000}
              placeholder={t("chat.placeholder")}
              disabled={loading}
              onChange={(event) => {
                setQuestion(event.target.value);
                setHighlight(0);
                grow();
              }}
              onKeyDown={keyDown}
            />
            <button type="submit" className="sendBtn" disabled={loading || !question.trim()} aria-label={t("chat.send")}>
              <svg className="sendIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h13" />
                <path d="M12 5l7 7-7 7" />
              </svg>
              {t("chat.send")}
            </button>
          </div>
          <div className="composerHint">
            <span>{t("chat.hint")} · {t("refresh.hint")}</span>
            <span>{question.length}/1000</span>
          </div>
        </form>
      </section>
    </div>
  );
}
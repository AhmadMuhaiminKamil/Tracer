"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useT } from "./i18n";

type Kind = "sectors" | "model";
type StoredKey = {
  id: string;
  kind: Kind;
  label: string;
  created: string;
  enabled: boolean;
  masked: string;
  base_url?: string;
  model?: string;
};

async function api(body?: Record<string, unknown>) {
  const response = body
    ? await fetch("/api/keys/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    : await fetch("/api/keys/store");
  const data = await response.json();
  if (!response.ok) throw new Error(String(data.error ?? "Gagal"));
  return data;
}

/** Eye toggle: fetch the real value only when asked, and never cache it. */
function KeyRow({ row, onChange }: { row: StoredKey; onChange: () => void }) {
  const { t } = useT();
  const [revealed, setRevealed] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ key: "", label: row.label, base_url: row.base_url ?? "", model: row.model ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await api(body);
      setRevealed("");
      setEditing(false);
      onChange();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function eye() {
    if (revealed) return setRevealed("");
    try {
      setRevealed(String((await api({ action: "reveal", id: row.id })).key));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal");
    }
  }

  return (
    <li className={"keyRow" + (row.enabled ? " on" : "")}>
      <div className="keyMain">
        <div className="keyTop">
          <b>{row.label}</b>
          <span className="keyTag">{row.kind}</span>
          {row.enabled && <span className="keyActive">{t("api.active")}</span>}
        </div>

        {editing ? (
          <div className="keyEdit">
            <input
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              placeholder={t("api.label")}
              aria-label={t("api.label")}
            />
            <input
              value={draft.key}
              onChange={(event) => setDraft({ ...draft, key: event.target.value })}
              placeholder={t("api.replaceKey")}
              aria-label={t("api.replaceKey")}
              autoComplete="off"
              spellCheck={false}
            />
            {row.kind === "model" && (
              <>
                <input
                  value={draft.base_url}
                  onChange={(event) => setDraft({ ...draft, base_url: event.target.value })}
                  placeholder="Base URL"
                  aria-label="Base URL"
                  autoComplete="off"
                  spellCheck={false}
                />
                <ModelPicker
                  baseUrl={draft.base_url}
                  keyValue={draft.key}
                  value={draft.model}
                  onPick={(model) => setDraft((d) => ({ ...d, model }))}
                />
              </>
            )}
            <div className="keyActions">
              <button type="button" disabled={busy} onClick={() => void act({ action: "update", id: row.id, ...draft })}>
                {t("api.save")}
              </button>
              <button type="button" className="ghostBtn" onClick={() => setEditing(false)}>
                {t("api.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <code className="keyValue">{revealed || row.masked}</code>
        )}

        <span className="keyMeta">
          {row.kind === "model" && row.base_url ? `${row.base_url}${row.model ? ` · ${row.model}` : ""} · ` : ""}
          {t("api.created", { date: row.created })}
        </span>
        {error && <span className="keyBad">{error}</span>}
      </div>

      <div className="keyActions">
        <button type="button" onClick={() => void eye()} aria-label={revealed ? t("api.hide") : t("api.reveal")} title={t("api.reveal")}>
          {revealed ? "🙈" : "👁"}
        </button>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={row.enabled}
          aria-label={`${t(row.enabled ? "api.disable" : "api.enable")} ${row.label}`}
          onClick={() => void act({ action: "toggle", id: row.id })}
          disabled={busy}
        >
          <span className="knob" />
        </button>
        <button type="button" className="ghostBtn" onClick={() => setEditing((on) => !on)}>
          {t("api.edit")}
        </button>
        <button type="button" className="keyDel" onClick={() => void act({ action: "remove", id: row.id })} disabled={busy}>
          {t("api.delete")}
        </button>
      </div>
    </li>
  );
}

/** Fetch the gateway's model list so the user picks instead of typing.
 *  Needs a base URL and a usable key; a stored key the user has not replaced
 *  is not in hand here, so we fall back to a plain input. */
function ModelPicker({
  baseUrl,
  keyValue,
  value,
  onPick,
}: {
  baseUrl: string;
  keyValue: string;
  value: string;
  onPick: (model: string) => void;
}) {
  const { t } = useT();
  const [models, setModels] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function fetchModels() {
    setState("loading");
    try {
      const data = (await api({ action: "list_models", base_url: baseUrl, key: keyValue })) as { models: string[] };
      setModels(data.models);
      setState(data.models.length ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="modelPick">
      <div className="modelPickHead">
        <input
          value={value}
          onChange={(event) => onPick(event.target.value)}
          placeholder={t("api.modelPlaceholder")}
          aria-label="Model"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="ghostBtn"
          disabled={!baseUrl.trim() || !keyValue.trim() || state === "loading"}
          onClick={() => void fetchModels()}
        >
          {state === "loading" ? t("api.loading") : t("api.fetchModels")}
        </button>
      </div>
      {state === "error" && <span className="keyBad">{t("api.couldNotList")}</span>}
      {state === "done" && (
        <ul className="modelList">
          {models.map((model) => (
            <li key={model}>
              <button type="button" className={model === value ? "on" : ""} onClick={() => onPick(model)}>
                {model}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddForm({ kind, onAdded }: { kind: Kind; onAdded: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ label: "", key: "", base_url: "", model: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api({ action: "add", kind, ...draft });
      setDraft({ label: "", key: "", base_url: "", model: "" });
      setOpen(false);
      onAdded();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="wideBtn" onClick={() => setOpen(true)}>
        {kind === "sectors" ? t("api.addSectors") : t("api.addModel")}
      </button>
    );
  }

  return (
    <form className="watchForm keyEdit" onSubmit={submit}>
      <input
        value={draft.label}
        onChange={(event) => setDraft({ ...draft, label: event.target.value })}
        placeholder={t("api.labelPlaceholder")}
        aria-label={t("api.label")}
      />
      <input
        value={draft.key}
        onChange={(event) => setDraft({ ...draft, key: event.target.value })}
        placeholder={t("api.keyPlaceholder")}
        aria-label={t("api.label")}
        autoComplete="off"
        spellCheck={false}
      />
      {kind === "model" && (
        <>
          <input
            value={draft.base_url}
            onChange={(event) => setDraft({ ...draft, base_url: event.target.value })}
            placeholder={t("api.basePlaceholder")}
            aria-label="Base URL"
            autoComplete="off"
            spellCheck={false}
          />
          <ModelPicker
            baseUrl={draft.base_url}
            keyValue={draft.key}
            value={draft.model}
            onPick={(model) => setDraft((d) => ({ ...d, model }))}
          />
        </>
      )}
      {error && <span className="keyBad">{error}</span>}
      <div className="keyActions">
        <button type="submit" disabled={busy || !draft.key.trim()}>
          {t("api.save")}
        </button>
        <button type="button" className="ghostBtn" onClick={() => setOpen(false)}>
          {t("api.cancel")}
        </button>
      </div>
    </form>
  );
}

export default function ApiKeysView() {
  const { t } = useT();
  const [rows, setRows] = useState<StoredKey[]>([]);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      setRows((await api()).keys as StoredKey[]);
    } catch (reason) {
      setNote(reason instanceof Error ? reason.message : t("err.listKeys"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const of = (kind: Kind) => rows.filter((row) => row.kind === kind);

  return (
    <div className="split">
      {(["sectors", "model"] as Kind[]).map((kind) => (
        <section className="panel" key={kind}>
          <div className="panelHead">
            <h3>{kind === "sectors" ? t("api.sectors") : t("api.model")}</h3>
            <span>{t("api.stored", { n: of(kind).length })}</span>
          </div>

          {of(kind).length === 0 ? (
            <p className="empty">{t("api.empty", { kind })}</p>
          ) : (
            <ul className="keyList">
              {of(kind).map((row) => (
                <KeyRow key={row.id} row={row} onChange={() => void load()} />
              ))}
            </ul>
          )}

          <AddForm kind={kind} onAdded={() => void load()} />
        </section>
      ))}
      {note && <p className="keyBad">{note}</p>}
    </div>
  );
}

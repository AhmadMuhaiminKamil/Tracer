"""Session management for Tracer CLI: arrow-key navigation, Enter to enter.

Format: one JSON object per line in data/cli_sessions.jsonl
  {"id": "s1", "title": "Pertanyaan pertama", "updated": "ISO", "history": [...]}
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

MAX_SESSIONS = 30
MAX_HISTORY = 12  # pairs of user/assistant messages sent to the LLM


def _sessions_path(root: Path) -> Path:
    return root / "data" / "cli_sessions.jsonl"


def session_id() -> str:
    import secrets
    return f"s{time.strftime('%y%m%d%H%M%S')}{secrets.token_hex(3)}"


def load_sessions(root: Path) -> list[dict]:
    path = _sessions_path(root)
    if not path.exists():
        return []
    sessions = []
    for line in path.read_text(encoding="utf-8").strip().splitlines():
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
            if (
                isinstance(entry, dict)
                and isinstance(entry.get("id"), str)
                and isinstance(entry.get("title"), str)
                and isinstance(entry.get("updated"), str)
            ):
                entry.setdefault("history", [])
                sessions.append(entry)
        except json.JSONDecodeError:
            continue  # skip corrupt line, never crash the picker
    return sessions[:MAX_SESSIONS]


def save_session(root: Path, session: dict) -> None:
    """Insert-or-update by id, most recent first, cap MAX_SESSIONS. Atomic-ish append."""
    sessions = load_sessions(root)
    sessions = [s for s in sessions if s["id"] != session["id"]]
    sessions.insert(0, session)
    sessions = sessions[:MAX_SESSIONS]
    path = _sessions_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    import tempfile, os

    fd, tmp = tempfile.mkstemp(prefix=".sessions-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            for s in sessions:
                stream.write(json.dumps(s, ensure_ascii=False) + "\n")
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def new_session(root: Path, first_question: str = "") -> dict:
    title = (first_question or "New session").strip()[:60]
    return {
        "id": session_id(),
        "title": title,
        "updated": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "history": [],
    }


def format_activity_title(text: str) -> str:
    raw = text.strip()
    if raw == "/scan":
        return "Scan clusters"
    if raw.lower().startswith("/detail"):
        parts = raw.split(maxsplit=1)
        ticker = parts[1].upper().removesuffix(".JK") if len(parts) > 1 else ""
        return f"Detail {ticker}" if ticker else "Detail ticker"
    if raw.lower().startswith("/newdata"):
        return "Data refresh"
    if raw.lower().startswith("/history"):
        return "History"
    if raw.lower().startswith("/api"):
        return "Manage keys"
    if raw.startswith("/"):
        return raw.lstrip("/")[:60].capitalize()
    return raw[:60]


def touch_session(root: Path, session: dict, question: str | None = None) -> dict:
    """Bump updated; rename placeholder title on real activity or question."""
    if question is not None and session.get("title") in ("Sesi baru", "New session"):
        session["title"] = format_activity_title(question)
    session["updated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    save_session(root, session)
    return session


def delete_session(root: Path, session_id_: str) -> list[dict]:
    sessions = [s for s in load_sessions(root) if s["id"] != session_id_]
    path = _sessions_path(root)
    if sessions:
        path.write_text("\n".join(json.dumps(s, ensure_ascii=False) for s in sessions) + "\n", encoding="utf-8")
    elif path.exists():
        path.unlink()
    return sessions


def clip_history(history: list) -> list:
    """Keep only role/content pairs; cap at MAX_HISTORY messages (skill: bounded tool loops)."""
    clean = [
        {"role": m["role"], "content": m["content"]}
        for m in history
        if isinstance(m, dict) and m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str)
    ]
    return clean[-MAX_HISTORY:]

"""Multiple API keys per kind, stored in keys.json.

.env holds exactly one value per name, so it cannot list keys. This keeps the
list in keys.json and mirrors only the *enabled* key back into .env — meaning
sectors_api.load_api_key() and tracer.py keep reading .env unchanged.

    python3 keys_store.py list
    python3 keys_store.py add   sectors <key> [label]
    python3 keys_store.py add   model <key> [label] --base https://x/v1 --model gpt-5.6
    python3 keys_store.py toggle <id>
    python3 keys_store.py update <id> <key>
    python3 keys_store.py remove <id>
    python3 keys_store.py reveal  <id>
"""
from __future__ import annotations

import json
import os
import re
import secrets
import tempfile
import time
from pathlib import Path

import apikeys

ROOT = Path(__file__).resolve().parent
STORE = ROOT / "keys.json"

KINDS = ("sectors", "model")


def _atomic(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".keys-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=1)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def load() -> list[dict]:
    """Empty list on a missing or corrupt file — never crash the dashboard over this."""
    if not STORE.exists():
        return []
    try:
        data = json.loads(STORE.read_text(encoding="utf-8"))
        return [row for row in data if isinstance(row, dict) and row.get("kind") in KINDS]
    except (json.JSONDecodeError, OSError):
        return []


KIND_ENV = {
    "sectors": {"key": "SECTORS_API_KEY"},
    "model": {"key": "LLM_API_KEY", "base_url": "LLM_BASE_URL", "model": "LLM_MODEL"},
}


def _mirror(rows: list[dict], kinds: set[str]) -> None:
    """Write the active key of each given kind into .env, clearing it when none is active.

    `kinds` is the set the store has a claim on, not simply the kinds still
    present: removing the last row of a kind must clear .env, or the deleted key
    stays live. Kinds never touched keep whatever .env already holds.
    """
    updates: dict[str, str] = {}
    for kind in kinds:
        active = next((r for r in rows if r["kind"] == kind and r.get("enabled")), None)
        for field, env_name in KIND_ENV[kind].items():
            updates[env_name] = str(active.get(field, "")) if active else ""
    if updates:
        apikeys.save(updates)


def _write(rows: list[dict], kinds: set[str]) -> list[dict]:
    _atomic(STORE, rows)
    _mirror(rows, kinds)
    return rows


def _kinds_of(rows: list[dict]) -> set[str]:
    return {r["kind"] for r in rows}


def add(kind: str, key: str, label: str = "", base_url: str = "", model: str = "") -> dict:
    if kind not in KINDS:
        raise ValueError(f"kind harus salah satu dari {KINDS}")
    if not key.strip():
        raise ValueError("key tidak boleh kosong")
    rows = load()
    row = {
        "id": f"{kind[:3]}-{secrets.token_hex(3)}",
        "kind": kind,
        "label": label.strip() or f"{kind} key",
        "key": key.strip(),
        "created": time.strftime("%Y-%m-%d"),
        # First key of a kind turns itself on — nothing to clobber. A second key
        # waits for the user: enabling it would overwrite the working one.
        "enabled": not any(r["kind"] == kind for r in rows),
    }
    if kind == "model":
        row["base_url"] = base_url.strip()
        row["model"] = model.strip()
    # An inactive add must not touch .env: the store only claims a kind once
    # something is active for it, or the new key would blank a working one.
    _write([*rows, row], {kind} if row["enabled"] else set())
    return row


def toggle(row_id: str) -> dict:
    """Enabling one key disables its siblings — .env can only hold one value."""
    rows = load()
    target = next((r for r in rows if r["id"] == row_id), None)
    if target is None:
        raise ValueError(f"key {row_id} tidak ada")
    turning_on = not target.get("enabled")
    for row in rows:
        if row["kind"] == target["kind"]:
            row["enabled"] = turning_on and row["id"] == row_id
    _write(rows, {target["kind"]})
    return target


def update(row_id: str, key: str = "", label: str = "", base_url: str = "", model: str = "") -> dict:
    rows = load()
    target = next((r for r in rows if r["id"] == row_id), None)
    if target is None:
        raise ValueError(f"key {row_id} tidak ada")
    if key.strip():
        target["key"] = key.strip()
    if label.strip():
        target["label"] = label.strip()
    if target["kind"] == "model":
        if base_url.strip():
            target["base_url"] = base_url.strip()
        if model.strip():
            target["model"] = model.strip()
    _write(rows, {target["kind"]})
    return target


def remove(row_id: str) -> list[dict]:
    rows = load()
    victim = next((r for r in rows if r["id"] == row_id), None)
    rows = [r for r in rows if r["id"] != row_id]
    # Deleting the active key would blank the env var; promote a sibling instead.
    if victim and victim.get("enabled"):
        sibling = next((r for r in rows if r["kind"] == victim["kind"]), None)
        if sibling:
            sibling["enabled"] = True
    # pass the victim's kind so removing the last row still clears .env
    return _write(rows, {victim["kind"]} if victim else set())


def reveal(row_id: str) -> str:
    """Full key for the eye toggle. Local-only endpoint; never logged."""
    target = next((r for r in load() if r["id"] == row_id), None)
    if target is None:
        raise ValueError(f"key {row_id} tidak ada")
    return str(target["key"])


def public(row: dict) -> dict:
    """What the UI sees: masked key, no secret."""
    out = {k: v for k, v in row.items() if k != "key"}
    out["masked"] = apikeys.mask(str(row.get("key", "")))
    return out


def _cli(argv: list[str]) -> int:
    cmd = argv[0] if argv else "list"
    try:
        if cmd == "list":
            result = {"keys": [public(r) for r in load()]}
        elif cmd == "reveal":
            result = {"key": reveal(argv[1])}
        elif cmd == "add":
            rest = argv[2:]
            opts = _flags(rest)
            result = {"key": public(add(argv[1], opts.pop("_", ""), opts.get("label", ""), opts.get("base", ""), opts.get("model", "")))}
        elif cmd == "toggle":
            result = {"key": public(toggle(argv[1]))}
        elif cmd == "update":
            opts = _flags(argv[2:])
            result = {"key": public(update(argv[1], opts.pop("_", ""), opts.get("label", ""), opts.get("base", ""), opts.get("model", "")))}
        elif cmd == "remove":
            result = {"keys": [public(r) for r in remove(argv[1])]}
        else:
            raise ValueError(f"perintah tidak dikenal: {cmd}")
    except Exception as error:  # noqa: BLE001 — the route relays stderr verbatim
        import sys

        print(str(error), file=sys.stderr)
        return 1
    print(json.dumps(result))
    return 0


def _flags(args: list[str]) -> dict:
    """Positionals first (key, label), then --flag value pairs."""
    out: dict[str, str] = {}
    positionals: list[str] = []
    index = 0
    while index < len(args):
        if args[index].startswith("--"):
            name = args[index].lstrip("-")
            out[name] = args[index + 1] if index + 1 < len(args) else ""
            index += 2
        else:
            positionals.append(args[index])
            index += 1
    if positionals:
        out["_"] = positionals[0]
    if len(positionals) > 1:
        out["label"] = positionals[1]
    return out


if __name__ == "__main__":
    import sys

    raise SystemExit(_cli(sys.argv[1:]))

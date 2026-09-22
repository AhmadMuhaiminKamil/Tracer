"""API key management: read, write, and validate the .env files both halves read.

One module because three places need the same thing: the CLI REPL, the
`tracer api` command, and the dashboard. Writes are atomic — a half-written
.env would lock the user out of their own keys.
"""
from __future__ import annotations

import json
import os
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env"
# The web app keeps its own file; writing both keeps `tracer api` and the
# dashboard in sync without adding a config layer.
WEB_ENV_FILE = ROOT.parent / ".env.local"

TRACER_KEYS = ("SECTORS_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY")
SECRET_KEYS = ("SECTORS_API_KEY", "LLM_API_KEY")


def read_env(path: Path = ENV_FILE) -> dict[str, str]:
    """Parse KEY=value lines. No dotenv dependency for four keys."""
    if not path.exists():
        return {}
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()
    return values


def write_env(updates: dict[str, str], path: Path = ENV_FILE) -> None:
    """Merge updates into the file, preserving comments and unrelated keys.

    An empty value removes the line: leaving `KEY=` behind would look like a set
    variable to the Python readers, so a disabled key would still be used.
    """
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    seen = set()
    out = []
    for line in lines:
        key = line.partition("=")[0].strip()
        if key in updates and "=" in line and not line.strip().startswith("#"):
            seen.add(key)
            if updates[key] != "":
                out.append(f"{key}={updates[key]}")
            # else: key disabled -> drop the line entirely
        else:
            out.append(line)
    for key, value in updates.items():
        if key not in seen and value != "":
            out.append(f"{key}={value}")
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".env-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write("\n".join(out).rstrip("\n") + "\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def save(values: dict[str, str]) -> list[Path]:
    """Write to every env file that exists, so CLI and dashboard stay in sync."""
    written = []
    for path in (ENV_FILE, WEB_ENV_FILE):
        if path is ENV_FILE or path.exists():
            write_env(values, path)
            written.append(path)
    return written
def test_sectors(key: str) -> tuple[bool, str]:
    """Hits subsectors (the cheapest documented endpoint) to verify the key works.
    Burns 1 real credit on purpose — a dry-run auth test is not an auth test.
    """
    request = urllib.request.Request(
        "https://api.sectors.app/v1/subsectors/",
        headers={"Authorization": key},
    )
    try:
        with urllib.request.urlopen(request, timeout=20):
            return True, "Key is valid (1 credit used)"
    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            return False, f"Key rejected (HTTP {error.code})"
        return False, f"Sectors returned HTTP {error.code}"
    except Exception as error:  # noqa: BLE001 — network shape varies; report, don't crash
        return False, f"Cannot connect to Sectors: {type(error).__name__}"


def test_llm(base_url: str, key: str, model: str) -> tuple[bool, str]:
    """One tiny completion. Validates base URL *and* key together, which is the point."""
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": "ping"}],
        "stream": False,
        "max_tokens": 5,
        "max_completion_tokens": 5,
    })
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=payload.encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8", errors="replace")
            if raw.strip().startswith("data:"):
                body = {}
                for line in raw.splitlines():
                    line = line.strip()
                    if line.startswith("data:") and line != "data: [DONE]":
                        try:
                            body = json.loads(line[5:].strip())
                            break
                        except Exception:
                            pass
            else:
                body = json.loads(raw)
    except urllib.error.HTTPError as error:
        return False, f"Gateway rejected request (HTTP {error.code})"
    except Exception as error:  # noqa: BLE001
        return False, f"Cannot reach Gateway: {type(error).__name__}"
    if body.get("error"):
        err = body["error"]
        msg = err.get("message") if isinstance(err, dict) else str(err)
        return False, f"Gateway error: {msg}"
    if not body.get("choices"):
        return False, "Response contains no choices"
    return True, "Gateway and API key are valid"


def list_models(base_url: str, key: str) -> list[str]:
    """OpenAI-compatible GET /models. Returns [] when the gateway does not offer it."""
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/models",
        headers={"Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = json.loads(response.read())
    except Exception:  # noqa: BLE001 — a missing /models is not fatal, just no list
        return []
    return [str(m.get("id")) for m in body.get("data", []) if m.get("id")]


def mask(value: str) -> str:
    """Redact a key for display. Only an empty value reads as unset — a short key
    is still a key, and the old `len > 12` cutoff labelled real values as missing."""
    if not value:
        return "(belum diisi)"
    if len(value) <= 8:
        return f"…{value[-4:]} ({len(value)} chars)"
    return f"{value[:6]}…{value[-4:]} ({len(value)} chars)"


def snapshot_env() -> dict[str, str]:
    """Filled values only, masked where secret. This is what the web UI renders."""
    merged = {k: v for k, v in read_env().items() if v}
    merged.update({k: v for k, v in read_env(WEB_ENV_FILE).items() if v and k not in merged})
    return {k: (mask(merged.get(k, "")) if k in SECRET_KEYS else merged.get(k, "")) for k in TRACER_KEYS}


def _cli(argv: list[str]) -> int:
    """Subcommand interface for the web route. Prints JSON; never raises."""
    import sys

    cmd = argv[0] if argv else ""
    try:
        if cmd == "read":
            result = snapshot_env()
        elif cmd == "test_sectors":
            ok, message = test_sectors(argv[1])
            result = {"ok": ok, "message": message}
        elif cmd == "test_llm":
            ok, message = test_llm(argv[1], argv[2], argv[3] if len(argv) > 3 else "")
            result = {"ok": ok, "message": message}
        elif cmd == "list_models":
            result = {"models": list_models(argv[1], argv[2])}
        elif cmd == "save":
            values = json.loads(argv[1])
            updates = {k: str(values[k]) for k in TRACER_KEYS if values.get(k)}
            result = {"saved": [str(p) for p in save(updates)]} if updates else {"saved": []}
        else:
            raise ValueError(f"perintah tidak dikenal: {cmd}")
    except Exception as error:  # noqa: BLE001 — the route reports stderr verbatim
        print(str(error), file=sys.stderr)
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    import sys

    raise SystemExit(_cli(sys.argv[1:]))

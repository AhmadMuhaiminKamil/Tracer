from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

import api
from sectors_api import load_api_key

MODEL = os.getenv("LLM_MODEL", "gpt-5.6")
BASE_URL = os.getenv("LLM_BASE_URL", "https://ohhmyagent.com/v1")

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "scan_market",
            "description": (
                "Daftar cluster transaksi insider IDX yang sudah dihitung. "
                "Pakai ini dulu; jangan panggil ulang kalau data sudah ada di konteks."
            ),
            "parameters": {
                "type": "object",
                "properties": {"days": {"type": "integer", "description": "rentang hari, default 90"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_company",
            "description": "Fundamental dan harga satu ticker. Hanya untuk ticker yang muncul di hasil scan.",
            "parameters": {
                "type": "object",
                "properties": {"symbol": {"type": "string", "description": "mis. HEAL"}},
                "required": ["symbol"],
            },
        },
    },
]

SYSTEM = """Kamu InsiderIQ, analis transaksi insider IDX.
Aturan keras:
- Kamu TIDAK memberi rekomendasi beli/jual. Sajikan temuan dan konteksnya.
- Panggil scan_market dulu. Kalau hasilnya sudah ada di konteks, jangan panggil lagi.
- get_company hanya untuk ticker dari hasil scan.
- Sebut angka apa adanya. Kalau data tidak ada, katakan tidak ada.
- Jawab Bahasa Indonesia, ringkas, sebutkan bahwa ini bukan financial advice."""

CACHE: dict[str, list] = {}


def _call(tool: str, args: dict) -> dict:
    if tool == "scan_market":
        return api.scan(int(args.get("days") or 90))
    if tool == "get_company":
        symbol = str(args.get("symbol", "")).split(".")[0].upper()
        known = {c["symbol"].split(".")[0] for c in CACHE.get("clusters", [])}
        if symbol not in known:
            return {"error": f"{symbol} tidak ada di hasil scan. Panggil scan_market dulu."}
        return api.report(symbol)
    return {"error": f"tool tidak dikenal: {tool}"}


def _post(payload: dict) -> dict:
    request = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.environ['LLM_API_KEY']}",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"LLM {error.code}: {error.read().decode('utf-8', 'replace')[:300]}") from error


def ask(question: str, history: list | None = None, max_steps: int = 6) -> dict:
    """ponytail: single loop, no graph framework. LangGraph when branching/retries need it."""
    messages = [{"role": "system", "content": SYSTEM}, *(history or []), {"role": "user", "content": question}]
    used: list[str] = []
    for _ in range(max_steps):
        reply = _post({"model": MODEL, "messages": messages, "tools": TOOLS})["choices"][0]["message"]
        messages.append(reply)
        calls = reply.get("tool_calls") or []
        if not calls:
            return {"answer": reply.get("content") or "", "tools": used}
        for call in calls:
            name = call["function"]["name"]
            args = json.loads(call["function"].get("arguments") or "{}")
            result = _call(name, args)
            used.append(name)
            if name == "scan_market":
                CACHE["clusters"] = result.get("clusters", [])
            messages.append(
                {"role": "tool", "tool_call_id": call["id"], "content": json.dumps(result, ensure_ascii=False)[:12000]}
            )
    raise RuntimeError("Batas langkah habis tanpa jawaban akhir.")


if __name__ == "__main__":
    import sys

    out = ask(" ".join(sys.argv[1:]) or "Cluster insider apa yang paling signifikan belakangan ini?")
    print(out["answer"])
    print("\n[tools]", out["tools"])

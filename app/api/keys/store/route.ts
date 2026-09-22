import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import { PYTHON_BIN } from "../../../env";

// Thin bridge to python/keys_store.py. Same reasoning as /api/keys: the store,
// masking, validation and .env mirroring already live in Python.
const PYTHON = PYTHON_BIN;
const SCRIPT = "python/keys_store.py";

function run(args: string[], script = SCRIPT): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(/* turbopackIgnore: true */ PYTHON, [script, ...args], { cwd: process.cwd() });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("close", (code) => resolve({ code: code ?? 1, out, err }));
    child.on("error", () => resolve({ code: 1, out: "", err: "python3 tidak ditemukan" }));
  });
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const ALLOWED = new Set(["add", "toggle", "update", "remove", "reveal", "list_models"]);

async function dispatch(args: string[]) {
  const { code, out, err } = await run(args);
  if (code !== 0) return NextResponse.json({ error: err.trim() || "perintah gagal" }, { status: 400 });
  return NextResponse.json(JSON.parse(out));
}

export async function GET() {
  const { code, out, err } = await run(["list"]);
  if (code !== 0) return NextResponse.json({ error: err.trim() || "gagal membaca daftar" }, { status: 500 });
  return NextResponse.json(JSON.parse(out));
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin ditolak" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const id = String(body.id ?? "").trim();
  if (!ALLOWED.has(action)) return NextResponse.json({ error: "action tidak dikenal" }, { status: 400 });
  if (action !== "add" && action !== "list_models" && !id) {
    return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  }

  const value = String(body.key ?? "").trim();
  const label = String(body.label ?? "").trim();
  const base = String(body.base_url ?? "").trim();
  const model = String(body.model ?? "").trim();

  if (action === "add") {
    const kind = String(body.kind ?? "");
    if (!["sectors", "model"].includes(kind)) return NextResponse.json({ error: "kind tidak valid" }, { status: 400 });
    if (!value) return NextResponse.json({ error: "API key wajib diisi" }, { status: 400 });
    return dispatch(["add", kind, value, label, "--base", base, "--model", model]);
  }
  if (action === "list_models") {
    // Delegates to apikeys.list_models via its own CLI, so there is one parser.
    const py = await run(["list_models", base, value], "python/apikeys.py");
    if (py.code !== 0) return NextResponse.json({ error: py.err.trim() || "gagal mengambil model" }, { status: 400 });
    return NextResponse.json(JSON.parse(py.out));
  }
  if (action === "reveal") return dispatch(["reveal", id]);
  if (action === "toggle") return dispatch(["toggle", id]);
  if (action === "remove") return dispatch(["remove", id]);
  return dispatch(["update", id, value, label, "--base", base, "--model", model]);
}

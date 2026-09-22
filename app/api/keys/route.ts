import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import { PYTHON_BIN } from "../../env";

// Thin bridge to python/apikeys.py — the CLI already owns env read/write, key
// masking, connectivity tests and model listing. Re-implementing any of that in
// TypeScript would be a second source of truth for the same .env file.
const PYTHON = PYTHON_BIN;
const SCRIPT = "python/apikeys.py";

type Action = "read" | "test_sectors" | "test_llm" | "list_models" | "save";

function run(args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    // ponytail: shelling out to python/apikeys.py keeps one source of truth for
    // the .env file. turbopackIgnore stops the tracer from bundling the whole project.
    const child = spawn(/* turbopackIgnore: true */ PYTHON, [SCRIPT, ...args], { cwd: process.cwd() });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("close", (code) => resolve({ code: code ?? 1, out, err }));
    child.on("error", () => resolve({ code: 1, out: "", err: "python3 tidak ditemukan" }));
  });
}

// Same guard as /api/ask: compare Origin against Host, because nextUrl.origin
// reflects the bind address (0.0.0.0) rather than what the browser used.
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

export async function GET() {
  const { code, out, err } = await run(["read"]);
  if (code !== 0) return NextResponse.json({ error: err || "gagal membaca env" }, { status: 500 });
  return NextResponse.json(JSON.parse(out));
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin ditolak" }, { status: 403 });

  let body: { action?: Action; key?: string; base_url?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 });
  }

  const action = body.action;
  const key = String(body.key ?? "").trim();
  const base = String(body.base_url ?? "").trim();

  if (action !== "save" && action !== "read" && !key) {
    return NextResponse.json({ error: "API key wajib diisi" }, { status: 400 });
  }

  const args: string[] =
    action === "test_sectors" ? ["test_sectors", key]
    : action === "test_llm" ? ["test_llm", base, key, String(body.model ?? "")]
    : action === "list_models" ? ["list_models", base, key]
    : action === "save" ? ["save", JSON.stringify(body)]
    : [];

  if (!args.length) return NextResponse.json({ error: "action tidak dikenal" }, { status: 400 });

  const { code, out, err } = await run(args);
  if (code !== 0) return NextResponse.json({ error: err.trim() || "perintah gagal" }, { status: 500 });
  return NextResponse.json(JSON.parse(out));
}

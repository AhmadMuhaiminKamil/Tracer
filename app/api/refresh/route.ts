import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";

// Reuses python/monitor.py: it already owns the credit ledger, the run/page caps
// and the response cache. A second fetch path here would be a second ledger.
const PYTHON = process.env.PYTHON_BIN ?? "python3";
const PAGES = 5; // monitor caps a run at 5 pages = 150 filings = 5 credits.

function run(args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(/* turbopackIgnore: true */ PYTHON, ["python/monitor.py", ...args], { cwd: process.cwd() });
    let out = "";
    let err = "";
    child.stdout.on("data", (c) => (out += c));
    child.stderr.on("data", (c) => (err += c));
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

async function spent(): Promise<number | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(/* turbopackIgnore: true */ "python/data/monitor/budget.json", "utf-8");
    return (JSON.parse(raw) as { reserved?: number }).reserved ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin ditolak" }, { status: 403 });
  const before = await spent();

  // Fetch then rebuild. --publish costs nothing: it recomputes clusters from the
  // cache we just wrote, so the snapshot file is always consistent with the ledger.
  // --fresh: /newdata means "get me new data", so today's cache must not short-circuit it.
  const fetch = await run(["--pages", String(PAGES), "--confirm-credits", String(PAGES), "--fresh"]);
  if (fetch.code !== 0) {
    return NextResponse.json({ error: fetch.err.trim() || "Gagal mengambil data baru" }, { status: 400 });
  }
  const publish = await run(["--publish"]);
  if (publish.code !== 0) {
    return NextResponse.json({ error: publish.err.trim() || "Gagal menyusun ulang snapshot" }, { status: 400 });
  }

  // Fundamentals only for tickers that became a cluster. refresh_reports skips
  // the ones already on disk, so a repeat run costs nothing here.
  let reportCredits = 0;
  const clusters = [...publish.out.matchAll(/"symbol":\s*"([A-Z]{4})\.JK"/g)].map((m) => m[1]);
  if (clusters.length) {
    const probe = await run(["--reports", ...clusters]);
    const need = JSON.parse(probe.out.trim().split("\n").pop() ?? "{}") as { maximum_credits?: number };
    if (need.maximum_credits) {
      const reports = await run(["--reports", ...clusters, "--confirm-report-credits", String(need.maximum_credits)]);
      if (reports.code === 0) {
        await run(["--publish"]);
        reportCredits = need.maximum_credits;
      }
      // Budget short: filings still landed. Do not fail the whole refresh.
    }
  }

  const report = JSON.parse(fetch.out.trim().split("\n").pop() ?? "{}") as { rows?: number; reserved?: number };
  const credits = before != null && report.reserved != null ? report.reserved - before : PAGES + reportCredits;
  return NextResponse.json({ ok: true, rows: report.rows ?? 0, credits, used: report.reserved ?? null });
}

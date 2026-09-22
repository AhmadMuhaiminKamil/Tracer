import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const SESSIONS_PATH = process.env.TRACER_SESSIONS_PATH ?? join(process.cwd(), "python", "data", "cli_sessions.jsonl");

export type SessionEntry = {
  id: string;
  title: string;
  updated: string;
  history: { role: string; content: string }[];
};

async function loadSessions(): Promise<SessionEntry[]> {
  if (!existsSync(/* turbopackIgnore: true */ SESSIONS_PATH)) return [];
  try {
    const raw = await readFile(/* turbopackIgnore: true */ SESSIONS_PATH, "utf-8");
    const sessions: SessionEntry[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const item = JSON.parse(trimmed);
        if (item && typeof item.id === "string" && typeof item.title === "string") {
          sessions.push({
            id: item.id,
            title: item.title,
            updated: item.updated || new Date().toISOString(),
            history: Array.isArray(item.history) ? item.history : [],
          });
        }
      } catch {}
    }
    return sessions;
  } catch {
    return [];
  }
}

async function saveSessions(sessions: SessionEntry[]): Promise<void> {
  const dir = join(process.cwd(), "python", "data");
  if (!existsSync(/* turbopackIgnore: true */ dir)) await mkdir(/* turbopackIgnore: true */ dir, { recursive: true });
  const lines = sessions.map((s) => JSON.stringify(s)).join("\n") + (sessions.length ? "\n" : "");
  await writeFile(/* turbopackIgnore: true */ SESSIONS_PATH, lines, "utf-8");
}

export async function GET() {
  const sessions = await loadSessions();
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || "save");
    let sessions = await loadSessions();

    if (action === "save" && body.session) {
      const s = body.session;
      sessions = sessions.filter((x) => x.id !== s.id);
      sessions.unshift({
        id: String(s.id),
        title: String(s.title || "New session"),
        updated: String(s.updated || new Date().toISOString()),
        history: Array.isArray(s.history) ? s.history : [],
      });
      sessions = sessions.slice(0, 30);
      await saveSessions(sessions);
      return NextResponse.json({ success: true, sessions });
    }

    if (action === "delete" && body.id) {
      sessions = sessions.filter((x) => x.id !== body.id);
      await saveSessions(sessions);
      return NextResponse.json({ success: true, sessions });
    }

    if (action === "clear") {
      await saveSessions([]);
      return NextResponse.json({ success: true, sessions: [] });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

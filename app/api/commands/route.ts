import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

// Serves python/commands.py so the CLI and the web composer share one list.
const PYTHON = process.env.PYTHON_BIN ?? "python3";

export async function GET() {
  const out = await new Promise<string>((resolve) => {
    const child = spawn(
      /* turbopackIgnore: true */ PYTHON,
      ["-c", "import json,commands;print(json.dumps(commands.COMMANDS))"],
      { cwd: `${process.cwd()}/python` },
    );
    let text = "";
    child.stdout.on("data", (c) => (text += c));
    child.on("close", () => resolve(text));
    child.on("error", () => resolve(""));
  });

  try {
    return NextResponse.json({ commands: JSON.parse(out) });
  } catch {
    return NextResponse.json({ commands: [] });
  }
}

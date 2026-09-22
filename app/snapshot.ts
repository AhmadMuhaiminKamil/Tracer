import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Scan } from "./lib";

export type Snapshot = {
  payload: Scan;
  source_updated_at: string;
  saved_at: string;
};

// Snapshot lives in the repo's python/ project. Set INSIDERIQ_SNAPSHOT to override.
// ponytail: fixed path, no config layer — one env var covers the "somewhere else" case.
function snapshotPath() {
  return (
    process.env.INSIDERIQ_SNAPSHOT ??
    join(process.cwd(), "python", "data", "sectors_snapshot.json")
  );
}

function isSnapshot(value: unknown): value is Omit<Snapshot, "saved_at"> {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<Snapshot>;
  return (
    typeof row.source_updated_at === "string" &&
    !!row.payload &&
    typeof row.payload.scanned === "number" &&
    typeof row.payload.kept === "number" &&
    Array.isArray(row.payload.clusters)
  );
}

export async function getSnapshot(): Promise<Snapshot> {
  const file = snapshotPath();
  let raw: string;
  try {
    raw = await readFile(/* turbopackIgnore: true */ file, "utf-8");
  } catch {
    throw new Error("Data not available yet.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Data file is not readable.");
  }
  if (!isSnapshot(parsed)) throw new Error("Data file is not valid.");
  const saved_at = parsed.source_updated_at;
  return { ...parsed, saved_at };
}

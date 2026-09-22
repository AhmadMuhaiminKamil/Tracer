import { getSnapshot, type Snapshot } from "./snapshot";
import { readCliLog } from "./cli-log";
import { readFilings } from "./filings";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

/** Age in hours, computed server-side so the client never touches node:fs. */
function ageHours(updatedAt: string) {
  const then = Date.parse(updatedAt);
  return Number.isNaN(then) ? null : (Date.now() - then) / 3_600_000;
}

// No data yet is the normal first-run state, not an error page: hand the
// dashboard an empty snapshot so API Keys stays reachable to set keys up.
const EMPTY: Snapshot = {
  payload: { scanned: 0, kept: 0, clusters: [], partial: false },
  source_updated_at: "",
  saved_at: "",
};

export default async function Page() {
  let snapshot = EMPTY;
  let missing = false;
  try {
    snapshot = await getSnapshot();
  } catch {
    missing = true;
  }
  return (
    <Dashboard
      snapshot={snapshot}
      cliLog={readCliLog(60)}
      filings={readFilings(200)}
      ageHours={snapshot.source_updated_at ? ageHours(snapshot.source_updated_at) : null}
      missingData={missing}
    />
  );
}

import * as assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSnapshot } from '../app/snapshot';

// Snapshot is read from disk now, so the cases are: missing file, bad JSON,
// wrong shape, and a good one. No network, no env, no Supabase.
async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'snapshot-'));
  const file = join(dir, 'sectors_snapshot.json');
  const original = process.env.INSIDERIQ_SNAPSHOT;
  try {
    process.env.INSIDERIQ_SNAPSHOT = file;

    await assert.rejects(getSnapshot(), /not available/i, 'missing file must fail closed');

    writeFileSync(file, 'not json');
    await assert.rejects(getSnapshot(), /not readable/i);

    writeFileSync(file, JSON.stringify({ payload: { clusters: null } }));
    await assert.rejects(getSnapshot(), /not valid/i);

    writeFileSync(file, JSON.stringify({ payload: { scanned: 0, kept: 0, clusters: [] } }));
    await assert.rejects(getSnapshot(), /not valid/i, 'source_updated_at is required');

    const good = { payload: { scanned: 7, kept: 5, clusters: [] }, source_updated_at: '2026-09-19T06:21:41Z' };
    writeFileSync(file, JSON.stringify(good));
    const read = await getSnapshot();
    assert.equal(read.payload.scanned, 7);
    assert.equal(read.source_updated_at, '2026-09-19T06:21:41Z');
    assert.equal(read.saved_at, '2026-09-19T06:21:41Z');

    console.log('PASS snapshot read from disk: missing, bad json, wrong shape, good');
  } finally {
    if (original === undefined) delete process.env.INSIDERIQ_SNAPSHOT;
    else process.env.INSIDERIQ_SNAPSHOT = original;
    rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

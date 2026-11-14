import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url).pathname;
const sourceWorkbook = root + 'docs/audits/2026-10-26/Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.source.xlsx';
const script = root + 'scripts/update-audit-progress.py';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'yautja-audit-progress-'));
  const progress = JSON.parse(await readFile(root + 'docs/audits/2026-10-26/implementation-progress.json', 'utf8'));
  for (const record of Object.values(progress.actions)) Object.assign(record, { status: 'À faire', acceptanceVerified: false, evidence: [], notes: '' });
  const workbookPath = join(directory, 'review.xlsx'), progressPath = join(directory, 'progress.json');
  await cp(sourceWorkbook, workbookPath);
  return { directory, progress, workbookPath, progressPath,
    async save() { await writeFile(progressPath, JSON.stringify(progress)); },
    args: ['--progress', progressPath, '--workbook', workbookPath],
    dispose: () => rm(directory, { recursive: true, force: true }) };
}

test('Excel follow-up changes only column N, preserves all other ZIP members and never changes the immutable source', async () => {
  const current = await fixture(), before = digest(await readFile(sourceWorkbook));
  try {
    current.progress.actions['AUD-002'].status = 'En cours';
    current.progress.actions['AUD-003'].status = 'À valider';
    Object.assign(current.progress.actions['AUD-022'], { status: 'Terminé', acceptanceVerified: true,
      evidence: [{ kind: 'review', path: 'tests/battle-catalog.test.js', sha256: digest(await readFile(root + 'tests/battle-catalog.test.js')),
        scope: 'Synthetic writer fixture only; this does not mark the real project criterion complete.' }] });
    await current.save();
    const result = JSON.parse(execFileSync('python3', [script, ...current.args, '--write'], { encoding: 'utf8' }));
    assert.equal(result.status, 'passed'); assert.equal(result.actions, 126); assert.equal(result.counts['Terminé'], 1);
    assert.deepEqual(result.changedMembers, ['xl/worksheets/sheet3.xml']); assert.equal(result.allNonFollowupContentPreserved, true);
    const checked = JSON.parse(execFileSync('python3', [script, ...current.args, '--check'], { encoding: 'utf8' }));
    assert.equal(checked.workingWorkbookSha256, result.workingWorkbookSha256);
    assert.equal(digest(await readFile(sourceWorkbook)), before);
    const xml = execFileSync('python3', ['-c', 'import zipfile,sys; print(zipfile.ZipFile(sys.argv[1]).read("xl/worksheets/sheet3.xml").decode())', current.workbookPath], { encoding: 'utf8' });
    assert.match(xml, /r="N8"[^>]*><x:v>En cours<\/x:v>/);
    assert.match(xml, /r="N9"[^>]*><x:v>À valider<\/x:v>/);
    assert.match(xml, /r="I8"/, 'the acceptance-criterion cells are still present');
  } finally { await current.dispose(); }
});

test('completion without evidence or with a modified criterion/hash is rejected before workbook mutation', async () => {
  const current = await fixture(), before = digest(await readFile(current.workbookPath));
  try {
    current.progress.actions['AUD-001'].status = 'Terminé'; await current.save();
    let result = spawnSync('python3', [script, ...current.args, '--write'], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /completion needs/);
    current.progress.actions['AUD-001'].status = 'À faire'; current.progress.actions['AUD-001'].acceptance = 'Invented replacement acceptance'; await current.save();
    result = spawnSync('python3', [script, ...current.args, '--write'], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /criterion must remain intact/);
    assert.equal(digest(await readFile(current.workbookPath)), before);
  } finally { await current.dispose(); }
});

test('unrelated workbook edits and a missing action are preserved and rejected instead of overwritten', async () => {
  const current = await fixture();
  try {
    await current.save();
    execFileSync('python3', ['-c', 'import zipfile,sys,pathlib; p=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(p); entries=[(i,z.read(i.filename)) for i in z.infolist()]; z.close(); out=zipfile.ZipFile(p,"w"); [out.writestr(i,d.replace(b"Manquants et corrections",b"User edits et corrections") if i.filename=="xl/worksheets/sheet3.xml" else d) for i,d in entries]; out.close()', current.workbookPath]);
    const changed = digest(await readFile(current.workbookPath));
    let result = spawnSync('python3', [script, ...current.args, '--write'], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /Non-Suivi/); assert.equal(digest(await readFile(current.workbookPath)), changed);
    delete current.progress.actions['AUD-126']; await current.save();
    result = spawnSync('python3', [script, ...current.args, '--write'], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /126 source action IDs/);
  } finally { await current.dispose(); }
});

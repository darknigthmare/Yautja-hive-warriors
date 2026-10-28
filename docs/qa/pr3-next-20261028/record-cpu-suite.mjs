// Records an explicit CPU test suite without marking any audit criterion done.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { sourceFingerprint } from '../../../scripts/publication-pr3-lib.mjs';

const root = resolve(import.meta.dirname, '../../..');
const options = { label: null, output: null, tests: [] };
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument === '--label') options.label = process.argv[++index];
  else if (argument === '--output') options.output = resolve(process.argv[++index]);
  else options.tests.push(argument);
}
assert.match(options.label ?? '', /^[A-Za-z0-9_.-]{1,80}$/, 'An explicit proof label is required');
assert.ok(options.tests.length > 0, 'Supply explicit CPU test files');
options.output ??= resolve(import.meta.dirname, options.label);
const hashFile = async path => {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(path)) digest.update(bytes);
  return digest.digest('hex');
};
const git = args => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const tests = [];
for (const name of options.tests) {
  const path = resolve(root, name), local = relative(root, path);
  assert.ok(!local.startsWith('..') && /\.test\.(?:js|mjs)$/.test(local), 'Tests must be repository test files');
  const text = await readFile(path, 'utf8');
  assert.ok(!/playwright|chromium\.launch|createSession\(/.test(text), 'This recorder never starts browser suites; ROOT schedules Chromium separately');
  tests.push({ path: local, sha256: await hashFile(path) });
}
await mkdir(options.output, { recursive: false });
const rawPath = resolve(options.output, 'output.txt'), reportPath = resolve(options.output, 'report.json');
const args = ['--max-old-space-size=2048', '--test', '--test-concurrency=1', '--test-reporter=tap', ...tests.map(test => test.path)];
const report = { schemaVersion: 1, status: 'running', label: options.label, startedAt: new Date().toISOString(),
  scope: 'Explicit automated CPU suite. No browser, human playtest, hardware performance or visual fidelity certification.',
  command: ['node', ...args], cwd: root, node: process.version, platform: process.platform, arch: process.arch,
  sourceHeadBefore: git(['rev-parse', 'HEAD']), sourceBefore: await sourceFingerprint(), testsBefore: tests,
  rawOutput: 'output.txt', humanTesters: 0, browserSessions: 0, fidelity1to1Verified: false };
const save = () => writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
await save();
const output = createWriteStream(rawPath, { flags: 'wx' });
try {
  const result = await new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let forced;
    const deadline = setTimeout(() => { child.kill('SIGTERM'); forced = setTimeout(() => child.kill('SIGKILL'), 2000); }, 900000);
    child.stdout.pipe(output, { end: false }); child.stderr.pipe(output, { end: false });
    child.once('error', error => { clearTimeout(deadline); clearTimeout(forced); reject(error); });
    child.once('close', (code, signal) => { clearTimeout(deadline); clearTimeout(forced); done({ code, signal }); });
  });
  await new Promise((done, reject) => { output.once('error', reject); output.end(done); });
  report.exitCode = result.code; report.signal = result.signal;
  const handle = await open(rawPath, 'r');
  let raw;
  try {
    report.rawBytes = (await handle.stat()).size;
    const bytes = Math.min(report.rawBytes, 128 * 1024), buffer = Buffer.alloc(bytes);
    await handle.read(buffer, 0, bytes, report.rawBytes - bytes);
    raw = buffer.toString('utf8'); report.summaryParserReadsTailBytes = bytes;
  } finally { await handle.close(); }
  const count = field => { const matches = [...raw.matchAll(new RegExp(`^# ${field} (\\d+)$`, 'gm'))]; return matches.length ? Number(matches.at(-1)[1]) : null; };
  report.result = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(field => [field, count(field)]));
  report.sourceHeadAfter = git(['rev-parse', 'HEAD']); report.sourceAfter = await sourceFingerprint();
  report.testsAfter = await Promise.all(tests.map(async test => ({ path: test.path, sha256: await hashFile(resolve(root, test.path)) })));
  report.runtimeSourceUnchanged = report.sourceBefore.sha256 === report.sourceAfter.sha256;
  report.testsUnchanged = JSON.stringify(report.testsBefore) === JSON.stringify(report.testsAfter);
  report.rawSha256 = await hashFile(rawPath);
  const passed = result.code === 0 && report.result.tests > 0 && report.result.tests === report.result.pass &&
    ['fail', 'cancelled', 'skipped', 'todo'].every(field => report.result[field] === 0);
  report.status = passed ? report.runtimeSourceUnchanged && report.testsUnchanged ? 'passed' : 'passed_but_source_changed_during_run' : 'failed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack ?? error.message;
  if (!output.closed) output.end();
} finally {
  report.endedAt = new Date().toISOString();
  report.durationSeconds = (Date.parse(report.endedAt) - Date.parse(report.startedAt)) / 1000;
  await save();
  process.stdout.write(JSON.stringify({ status: report.status, result: report.result ?? null, reportPath, runtimeSourceUnchanged: report.runtimeSourceUnchanged }) + '\n');
}
if (report.status !== 'passed') process.exitCode = 1;

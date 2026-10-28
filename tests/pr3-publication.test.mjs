// Publication guard tests use temporary local fixtures only. No request, real
// stage, repository Git operation, build or browser is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseOptions, waitForCanonicalIndex } from '../scripts/publish-verified-pr3.mjs';
import { DEFAULT_PINS, assertHttpHeaders, assertQaReport, expectedHeaders, readPins, validateBuildIdentity } from '../scripts/publication-pr3-lib.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
async function fixtures() {
  const pins = JSON.parse(await readFile(DEFAULT_PINS, 'utf8'));
  return { ...pins, status: 'frozen', sourceCommit: 'a'.repeat(40), sourceFingerprint: 'b'.repeat(64), indexSha256: 'c'.repeat(64), buildInfoSha256: 'd'.repeat(64), previousPublicIndexSha256: '3'.repeat(64), artifactManifestSha256: 'e'.repeat(64), outputConfigSha256: 'f'.repeat(64), projectLinkSha256: '1'.repeat(64), qaReportSha256: '2'.repeat(64), cpuPassed: 731, browserRegressionPassed: 19, expectedRuntimeChecks: ['real_queen', 'fronts_coop'] };
}
function qa(pins) {
  const suite = passed => ({ status: 'passed', passed, failed: 0, skipped: 0, cancelled: 0, index_sha256: pins.indexSha256 });
  return { status: 'passed_locally_waiting_publication', build: { success: true, index_sha256: pins.indexSha256, source_commit: pins.sourceCommit, build_info_sha256: pins.buildInfoSha256, source_fingerprint: pins.sourceFingerprint },
    cpu: suite(pins.cpuPassed), browser: { final_regression: suite(pins.browserRegressionPassed), final_runtime: { status: 'passed', index_sha256: pins.indexSha256, errors: 0, failed_requests: 0, external_requests: 0, checks: pins.expectedRuntimeChecks.map(id => ({ id, status: 'passed' })) } } };
}

test('remote operations require explicit compatible flags and a bounded real deployment ID', () => {
  assert.equal(parseOptions([]).deploy, false); assert.equal(parseOptions(['--check-only']).checkOnly, true);
  for (const args of [['--check-only', '--deploy'], ['--check-only', '--deployment', 'dpl_one'], ['--promote'], ['--deploy', '--deployment', 'dpl_two'], ['--deployment', 'https://elsewhere.test'], ['--ready-timeout-ms', 'Infinity'], ['--ready-timeout-ms', '900001']]) assert.throws(() => parseOptions(args));
  assert.equal(parseOptions(['--deployment', 'dpl_realID42', '--promote']).deploymentId, 'dpl_realID42');
});

test('promotion waits through only the known previous index until new canonical bytes appear', async () => {
  const values = ['old', 'old', 'new'], delays = []; let clock = 0, calls = 0;
  const result = await waitForCanonicalIndex({ indexSha256: 'new', previousIndexSha256: 'old', deploymentId: 'dpl_one',
    now: () => clock, wait: async ms => { delays.push(ms); clock += ms; },
    snapshot: async timeout => { assert.ok(timeout > 0 && timeout <= 30000); calls++; return { sha256: values.shift() }; } });
  assert.equal(result.sha256, 'new'); assert.equal(calls, 3); assert.deepEqual(delays, [2000, 2000]);
});

test('promotion immediately rejects unknown canonical bytes and never retries them', async () => {
  let calls = 0, waits = 0;
  await assert.rejects(waitForCanonicalIndex({ indexSha256: 'new', previousIndexSha256: 'old', deploymentId: 'dpl_one',
    snapshot: async () => { calls++; return { sha256: 'unknown' }; }, wait: async () => { waits++; } }), /Canonical changed to another build/);
  assert.equal(calls, 1); assert.equal(waits, 0);
});

test('canonical propagation deadline preserves the existing deployment ID for resume', async () => {
  let clock = 0, calls = 0;
  await assert.rejects(waitForCanonicalIndex({ indexSha256: 'new', previousIndexSha256: 'old', deploymentId: 'dpl_resume42',
    now: () => clock, wait: async ms => { assert.ok(ms <= 2000); clock += ms; }, snapshot: async () => { calls++; return { sha256: 'old' }; } }),
  error => error.waiting === true && /resume with --deployment dpl_resume42/.test(error.message));
  assert.equal(clock, 60000); assert.equal(calls, 30);
});

test('frozen pins bind the existing project, code identity, final measured counts and actual runtime IDs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pr3-pins-'));
  try {
    const pins = await fixtures(), path = join(directory, 'pins.json');
    await writeFile(path, JSON.stringify(pins)); assert.equal((await readPins(path)).cpuPassed, 731);
    for (const change of [{ status: 'unfrozen' }, { sourceCommit: 'HEAD' }, { buildInfoSha256: null }, { qaReportSha256: null }, { cpuPassed: 0 }, { expectedRuntimeChecks: [] }, { expectedRuntimeChecks: ['same', 'same'] }, { origin: 'https://other-project.vercel.app' }, { stageDirectory: '/tmp/another-stage' }]) {
      await writeFile(path, JSON.stringify({ ...pins, ...change })); await assert.rejects(readPins(path));
    }
  } finally { await rm(directory, { recursive: true }); }
});

test('final QA cannot pass with an old build, partial suite, error or missing measured runtime scenario', async () => {
  const pins = await fixtures(), good = qa(pins); assert.equal(assertQaReport(good, pins).runtimeChecksPassed, 2);
  const bad = [value => { value.cpu.passed--; }, value => { value.cpu.skipped = 1; }, value => { value.browser.final_regression.failed = 1; }, value => { value.browser.final_runtime.checks.pop(); }, value => { value.browser.final_runtime.checks[0].status = 'failed'; }, value => { value.browser.final_runtime.errors = 1; }, value => { value.browser.final_runtime.index_sha256 = '0'.repeat(64); }, value => { value.build.build_info_sha256 = '0'.repeat(64); }, value => { value.status = 'pending'; }];
  for (const change of bad) { const report = clone(good); change(report); assert.throws(() => assertQaReport(report, pins)); }
});

test('index, build-info bytes and clean source identity are checked independently', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pr3-identity-'));
  try {
    const pins = await fixtures(), index = '<!doctype html><title>Reviewed fixture</title>', info = { schemaVersion: 1, sourceCommit: pins.sourceCommit, sourceFingerprint: pins.sourceFingerprint, sourceTreeDirty: false };
    const body = JSON.stringify(info); pins.indexSha256 = sha(index); pins.buildInfoSha256 = sha(body);
    await writeFile(join(directory, 'index.html'), index); await writeFile(join(directory, 'build-info.json'), body);
    await validateBuildIdentity(directory, pins);
    await writeFile(join(directory, 'build-info.json'), JSON.stringify({ ...info, sourceTreeDirty: true }));
    await assert.rejects(validateBuildIdentity(directory, pins), /identity changed/i);
    pins.buildInfoSha256 = sha(JSON.stringify({ ...info, sourceTreeDirty: true }));
    await assert.rejects(validateBuildIdentity(directory, pins), /modified runtime source/);
  } finally { await rm(directory, { recursive: true }); }
});

test('headers cover every file, preserve model download metadata and verify build-info MIME', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const path = '/models/city-hunter-body-corrected.glb', headers = expectedHeaders(path, config.headers);
  assert.equal(headers['x-frame-options'], 'DENY'); assert.equal(headers['content-type'], 'model/gltf-binary');
  assert.match(headers['content-disposition'], /^attachment;/);
  assertHttpHeaders({ path, relativePath: path.slice(1) }, headers, config.headers);
  assert.throws(() => assertHttpHeaders({ path, relativePath: path.slice(1) }, { ...headers, 'content-security-policy': 'unsafe' }, config.headers));
  const jsonHeaders = { ...expectedHeaders('/build-info.json', config.headers), 'content-type': 'application/json; charset=utf-8' };
  assertHttpHeaders({ path: '/build-info.json', relativePath: 'build-info.json' }, jsonHeaders, config.headers);
  assert.throws(() => assertHttpHeaders({ path: '/build-info.json', relativePath: 'build-info.json' }, { ...jsonHeaders, 'content-type': 'text/html' }, config.headers));
  assert.equal(expectedHeaders('/assets/engine.js', config.headers)['cache-control'], 'public, max-age=31536000, immutable');
});

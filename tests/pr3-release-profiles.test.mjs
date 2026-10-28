// Fresh Node imports exercise environment selection without network, Git,
// build, browser, credentials, real stage access or publication operations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, RELEASE_PROFILES, assertQaReport, resolveReleaseProfile } from '../scripts/publication-pr3-lib.mjs';

const library = new URL('../scripts/publication-pr3-lib.mjs', import.meta.url).href;
const publisher = new URL('../scripts/publish-verified-pr3.mjs', import.meta.url).href;
function child(profile, code, args = []) {
  const env = { ...process.env }; delete env.YAUTJA_RELEASE_PROFILE;
  if (profile !== undefined) env.YAUTJA_RELEASE_PROFILE = profile;
  return spawnSync(process.execPath, ['--input-type=module', '--eval', code, ...args], { cwd: REPO, env, encoding: 'utf8', timeout: 10000 });
}
const inspect = `const lib = await import(${JSON.stringify(library)}); const pub = await import(${JSON.stringify(publisher)});
  const pins = process.argv[1] ? await lib.readPins(process.argv[1]) : null;
  console.log(JSON.stringify({ profile: lib.RELEASE.name, qa: lib.QA, stage: lib.STAGE, pins: lib.DEFAULT_PINS,
    qaReport: lib.RELEASE.qaReport, defaultOption: pub.parseOptions([]).pinsPath, frozen: pins?.status }));`;

test('release profile allowlist has exactly the original and NEXT entries', () => {
  assert.deepEqual(Object.keys(RELEASE_PROFILES), ['pr3-20261026', 'pr3-next-20261028']);
  for (const name of Object.keys(RELEASE_PROFILES)) assert.equal(resolveReleaseProfile(name).name, name);
  for (const name of ['', 'pr3-next', '../pr3-20261026', 'other', 'toString']) assert.throws(() => resolveReleaseProfile(name), /Unknown YAUTJA_RELEASE_PROFILE/);
});

test('unset environment retains every original default and NEXT selects its own paths', () => {
  for (const profile of [undefined, 'pr3-20261026', 'pr3-next-20261028']) {
    const result = child(profile, inspect); assert.equal(result.status, 0, result.stderr);
    const value = JSON.parse(result.stdout), name = profile ?? 'pr3-20261026', expected = RELEASE_PROFILES[name];
    assert.deepEqual(value, { profile: name, qa: expected.qaDirectory, stage: expected.qaDirectory + '/vercel-static-prebuilt',
      pins: REPO + '/' + expected.pins, qaReport: expected.qaReport, defaultOption: REPO + '/' + expected.pins });
  }
});

test('both profiles require their own frozen pins and reject pins from the other release', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pr3-release-profile-'));
  try {
    const paths = {};
    for (const [name, profile] of Object.entries(RELEASE_PROFILES)) {
      const pins = JSON.parse(await readFile(REPO + '/' + profile.pins, 'utf8'));
      Object.assign(pins, { status: 'frozen', sourceCommit: 'a'.repeat(40), sourceFingerprint: 'b'.repeat(64), indexSha256: 'c'.repeat(64),
        buildInfoSha256: 'd'.repeat(64), previousPublicIndexSha256: 'e'.repeat(64), artifactManifestSha256: 'f'.repeat(64),
        outputConfigSha256: '1'.repeat(64), projectLinkSha256: '2'.repeat(64), qaReportSha256: '3'.repeat(64),
        cpuPassed: 7, browserRegressionPassed: 3, expectedRuntimeChecks: ['measured_fixture'] });
      paths[name] = join(directory, name + '.json'); await writeFile(paths[name], JSON.stringify(pins));
    }
    for (const name of Object.keys(RELEASE_PROFILES)) {
      const own = child(name, inspect, [paths[name]]); assert.equal(own.status, 0, own.stderr);
      assert.equal(JSON.parse(own.stdout).frozen, 'frozen');
      const other = Object.keys(paths).find(value => value !== name), mismatched = child(name, inspect, [paths[other]]);
      assert.notEqual(mismatched.status, 0); assert.match(mismatched.stderr, /AssertionError/);
    }
  } finally { await rm(directory, { recursive: true }); }
});

test('unknown profile aborts every entrypoint at import before local or remote actions', () => {
  for (const name of ['prepare-verified-pr3.mjs', 'publish-verified-pr3.mjs', 'verify-pr3-http.mjs']) {
    const url = new URL('../scripts/' + name, import.meta.url).href;
    const result = child('invalid-profile', `await import(${JSON.stringify(url)});`);
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Unknown YAUTJA_RELEASE_PROFILE/); assert.equal(result.stdout, '');
  }
});

test('unfilled NEXT pins and pending QA cannot pass the final guards', async () => {
  const profile = RELEASE_PROFILES['pr3-next-20261028'];
  const pins = JSON.parse(await readFile(REPO + '/' + profile.pins, 'utf8'));
  const report = JSON.parse(await readFile(REPO + '/' + profile.qaReport, 'utf8'));
  // Make an unfinished local fixture even after the coordinator fills the real
  // documents: future successful releases must not invalidate this guard test.
  pins.status = 'awaiting_source_build_and_final_qa';
  for (const key of ['sourceCommit', 'sourceFingerprint', 'indexSha256', 'buildInfoSha256', 'qaReportSha256', 'cpuPassed', 'browserRegressionPassed']) pins[key] = null;
  pins.expectedRuntimeChecks = []; report.status = 'awaiting_final_build_and_qa'; report.build.success = false;
  assert.throws(() => assertQaReport(report, pins), /Final QA is not passed/);
  const directory = await mkdtemp(join(tmpdir(), 'pr3-unfilled-next-'));
  try {
    const path = join(directory, 'pins.json'); await writeFile(path, JSON.stringify(pins));
    const result = child('pr3-next-20261028', inspect, [path]);
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Pin the reviewed source commit/);
  } finally { await rm(directory, { recursive: true }); }
});

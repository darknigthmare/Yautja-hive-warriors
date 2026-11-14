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
const archivedProfiles = ['pr3-20261026', 'pr3-next-20261028', 'continuation-20261101', 'continuation-final-20261101'];
function fixturePins(profile) {
  return { schemaVersion: 1, origin: 'https://yautja-hive-warriors.vercel.app', qaDirectory: profile.qaDirectory,
    stageDirectory: profile.qaDirectory + '/vercel-static-prebuilt', cliWrapper: profile.qaDirectory + '/vercel-cli.sh', qaReport: profile.qaReport };
}
function child(profile, code, args = []) {
  const env = { ...process.env }; delete env.YAUTJA_RELEASE_PROFILE;
  if (profile !== undefined) env.YAUTJA_RELEASE_PROFILE = profile;
  return spawnSync(process.execPath, ['--input-type=module', '--eval', code, ...args], { cwd: REPO, env, encoding: 'utf8', timeout: 10000 });
}
const inspect = `const lib = await import(${JSON.stringify(library)}); const pub = await import(${JSON.stringify(publisher)});
  const pins = process.argv[1] ? await lib.readPins(process.argv[1]) : null;
  console.log(JSON.stringify({ profile: lib.RELEASE.name, qa: lib.QA, stage: lib.STAGE, pins: lib.DEFAULT_PINS,
    qaReport: lib.RELEASE.qaReport, defaultOption: pub.parseOptions([]).pinsPath, frozen: pins?.status }));`;

test('release profiles isolate all four archives and the new continuation stage', () => {
  assert.deepEqual(RELEASE_PROFILES, {
    'pr3-20261026': { qaDirectory: '/workspace/qa/pr3-20261026', pins: 'docs/qa/pr3-publication-pins.json', qaReport: 'docs/qa/pr3-validation.json' },
    'pr3-next-20261028': { qaDirectory: '/workspace/qa/pr3-next-20261028', pins: 'docs/qa/pr3-next-publication-pins.json', qaReport: 'docs/qa/pr3-next-validation.json' },
    'continuation-20261101': { qaDirectory: '/workspace/qa/continuation-20261101', pins: 'docs/qa/continuation-publication-pins.json', qaReport: 'docs/qa/continuation-validation.json' },
    'continuation-final-20261101': { qaDirectory: '/workspace/qa/continuation-final-20261101', pins: 'docs/qa/continuation-final-publication-pins.json', qaReport: 'docs/qa/continuation-final-validation.json' },
    'continuation-20261102': { qaDirectory: '/workspace/qa/continuation-20261102', pins: 'docs/qa/continuation-20261102-publication-pins.json', qaReport: 'docs/qa/continuation-20261102-validation.json' }
  });
  for (const name of Object.keys(RELEASE_PROFILES)) assert.equal(resolveReleaseProfile(name).name, name);
  for (const name of ['', 'pr3-next', '../pr3-20261026', 'other', 'toString']) assert.throws(() => resolveReleaseProfile(name), /Unknown YAUTJA_RELEASE_PROFILE/);
});

test('unset environment retains every original default and NEXT selects its own paths', () => {
  for (const profile of [undefined, ...Object.keys(RELEASE_PROFILES)]) {
    const result = child(profile, inspect); assert.equal(result.status, 0, result.stderr);
    const value = JSON.parse(result.stdout), name = profile ?? 'pr3-20261026', expected = RELEASE_PROFILES[name];
    assert.deepEqual(value, { profile: name, qa: expected.qaDirectory, stage: expected.qaDirectory + '/vercel-static-prebuilt',
      pins: REPO + '/' + expected.pins, qaReport: expected.qaReport, defaultOption: REPO + '/' + expected.pins });
  }
});

test('all profiles require their own frozen pins and reject every other release', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pr3-release-profile-'));
  try {
    const paths = {};
    for (const [name, profile] of Object.entries(RELEASE_PROFILES)) {
      // Exercise the real archived configurations while keeping a future
      // profile testable before its actual build/QA documents are created.
      const pins = archivedProfiles.includes(name)
        ? JSON.parse(await readFile(REPO + '/' + profile.pins, 'utf8'))
        : fixturePins(profile);
      for (const [key, expected] of Object.entries(fixturePins(profile))) assert.equal(pins[key], expected, name + ' ' + key);
      Object.assign(pins, { status: 'frozen', sourceCommit: 'a'.repeat(40), sourceFingerprint: 'b'.repeat(64), indexSha256: 'c'.repeat(64),
        buildInfoSha256: 'd'.repeat(64), previousPublicIndexSha256: 'e'.repeat(64), artifactManifestSha256: 'f'.repeat(64),
        outputConfigSha256: '1'.repeat(64), projectLinkSha256: '2'.repeat(64), qaReportSha256: '3'.repeat(64),
        cpuPassed: 7, browserRegressionPassed: 3, expectedRuntimeChecks: ['measured_fixture'] });
      paths[name] = join(directory, name + '.json'); await writeFile(paths[name], JSON.stringify(pins));
    }
    for (const name of Object.keys(RELEASE_PROFILES)) {
      const own = child(name, inspect, [paths[name]]); assert.equal(own.status, 0, own.stderr);
      assert.equal(JSON.parse(own.stdout).frozen, 'frozen');
      for(const other of Object.keys(paths).filter(value=>value!==name)){
        const mismatched = child(name, inspect, [paths[other]]);
        assert.notEqual(mismatched.status, 0); assert.match(mismatched.stderr, /AssertionError/);
      }
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

test('unfilled NEXT and new continuation pins cannot pass the final guards', async () => {
  const archived = RELEASE_PROFILES['pr3-next-20261028'];
  const archivedPins = JSON.parse(await readFile(REPO + '/' + archived.pins, 'utf8'));
  const archivedReport = JSON.parse(await readFile(REPO + '/' + archived.qaReport, 'utf8'));
  // Make an unfinished local fixture even after the coordinator fills the real
  // documents: future successful releases must not invalidate this guard test.
  const directory = await mkdtemp(join(tmpdir(), 'pr3-unfilled-next-'));
  try {
    for (const name of ['pr3-next-20261028', 'continuation-20261102']) {
      const pins = { ...structuredClone(archivedPins), ...fixturePins(RELEASE_PROFILES[name]) };
      const report = structuredClone(archivedReport);
      pins.status = 'awaiting_source_build_and_final_qa';
      for (const key of ['sourceCommit', 'sourceFingerprint', 'indexSha256', 'buildInfoSha256', 'qaReportSha256', 'cpuPassed', 'browserRegressionPassed']) pins[key] = null;
      pins.expectedRuntimeChecks = []; report.status = 'awaiting_final_build_and_qa'; report.build.success = false;
      assert.throws(() => assertQaReport(report, pins), /Final QA is not passed/);
      const path = join(directory, name + '.json'); await writeFile(path, JSON.stringify(pins));
      const result = child(name, inspect, [path]);
      assert.notEqual(result.status, 0); assert.match(result.stderr, /Pin the reviewed source commit/);
    }
  } finally { await rm(directory, { recursive: true }); }
});

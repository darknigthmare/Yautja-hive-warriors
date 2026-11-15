import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const QA = '/workspace/qa/pr3-20261026';
export const STAGE = QA + '/vercel-static-prebuilt';
export const ORIGIN = 'https://yautja-hive-warriors.vercel.app';
export const PROJECT = Object.freeze({ projectName: 'yautja-hive-warriors', projectId: 'prj_zA8CZlvC2NrLJFia0lVUFwUVuTZQ', orgId: 'team_VrIjq2UWV6VaHZr7DdQFwvfu', contextName: 'darknigthmares-projects' });
export const DEFAULT_PINS = REPO + '/docs/qa/pr3-publication-pins.json';
export const SHA = /^[a-f0-9]{64}$/;
export const COMMIT = /^[a-f0-9]{40}$/;
export const jsonFile = async path => JSON.parse(await readFile(path, 'utf8'));
export const say = value => process.stdout.write(JSON.stringify(value) + '\n');
export async function hashFile(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), 'Symlinks cannot enter a frozen output');
    const name = prefix + entry.name;
    assert.ok(!/[\\?#\0\r\n]/.test(name) && !name.split('/').some(part => part === '.' || part === '..'), 'Unsafe static path');
    if (entry.isDirectory()) result.push(...await listFiles(resolve(directory, entry.name), name + '/'));
    else { assert.ok(entry.isFile(), 'Unexpected static file type'); result.push(name); }
  }
  return result.sort();
}
export async function readPins(path = DEFAULT_PINS, frozen = true) {
  const pins = await jsonFile(resolve(path));
  assert.equal(pins.schemaVersion, 1, 'Unsupported PR3 pins');
  assert.equal(pins.origin, ORIGIN, 'Only the existing canonical project is authorized');
  assert.equal(pins.qaDirectory, QA); assert.equal(pins.stageDirectory, STAGE);
  assert.equal(pins.cliWrapper, QA + '/vercel-cli.sh');
  assert.equal(pins.qaReport, 'docs/qa/pr3-validation.json');
  assert.match(pins.sourceCommit ?? '', COMMIT, 'Pin the reviewed source commit');
  for (const key of ['indexSha256', 'buildInfoSha256', 'sourceFingerprint']) assert.match(pins[key] ?? '', SHA, 'Missing reviewed pin: ' + key);
  assert.match(pins.previousPublicIndexSha256 ?? '', SHA, 'Pin the previously public index');
  if (frozen) {
    assert.equal(pins.status, 'frozen', 'Publication pins have not been reviewed and frozen');
    for (const key of ['artifactManifestSha256', 'outputConfigSha256', 'projectLinkSha256', 'qaReportSha256']) assert.match(pins[key] ?? '', SHA, 'Missing frozen pin: ' + key);
    for (const key of ['cpuPassed', 'browserRegressionPassed']) assert.ok(Number.isInteger(pins[key]) && pins[key] > 0, 'Pin the actual successful final count: ' + key);
    assert.ok(Array.isArray(pins.expectedRuntimeChecks) && pins.expectedRuntimeChecks.length > 0 && pins.expectedRuntimeChecks.length <= 256 && new Set(pins.expectedRuntimeChecks).size === pins.expectedRuntimeChecks.length && pins.expectedRuntimeChecks.every(id => typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(id)), 'Pin actual measured runtime check IDs');
  }
  return pins;
}
export async function sourceFingerprint() {
  const files = [];
  for (const directory of ['js', 'css']) for (const name of await listFiles(REPO + '/' + directory)) if (/\.(?:js|css)$/.test(name)) files.push(resolve(REPO, directory, name));
  for (const name of ['index.html', 'package.json', 'package-lock.json', 'vite.config.js']) files.push(resolve(REPO, name));
  const digest = createHash('sha256');
  for (const path of files.sort()) digest.update(relative(REPO, path) + '\0').update(await readFile(path)).update('\0');
  return { sha256: digest.digest('hex'), files: files.length };
}
export async function validateBuildIdentity(root, pins, liveSource = false) {
  assert.equal(await hashFile(root + '/index.html'), pins.indexSha256, 'Index differs from the reviewed build');
  assert.equal(await hashFile(root + '/build-info.json'), pins.buildInfoSha256, 'Build identity changed');
  const info = await jsonFile(root + '/build-info.json');
  assert.equal(info.schemaVersion, 1); assert.equal(info.sourceCommit, pins.sourceCommit);
  assert.equal(info.sourceFingerprint, pins.sourceFingerprint); assert.equal(info.sourceTreeDirty, false, 'Build was made from modified runtime source');
  if (liveSource) { const actual = await sourceFingerprint(); assert.equal(actual.sha256, pins.sourceFingerprint, 'Runtime source changed after the build'); assert.equal(actual.files, info.sourceFiles); }
  return info;
}
export function assertProject(link) { for (const key of ['projectName', 'projectId', 'orgId']) assert.equal(link[key], PROJECT[key], 'Wrong Vercel project: ' + key); }
export function expectedHeaders(path, rules) {
  const headers = {};
  for (const rule of rules) {
    const escaped = rule.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\(\\\.\\\*\\\)/g, '.*');
    if (new RegExp('^' + escaped + '$').test(path)) for (const item of rule.headers) headers[item.key.toLowerCase()] = item.value;
  }
  return headers;
}
export function assertHttpHeaders(file, headers, rules) {
  for (const [name, value] of Object.entries(expectedHeaders(file.path, rules))) assert.equal(headers[name], value, `${file.path} ${name}`);
  const type = (headers['content-type'] ?? '').split(';')[0].trim();
  if (file.relativePath.endsWith('.glb')) assert.equal(type, 'model/gltf-binary', file.path + ' GLB MIME');
  if (file.relativePath === 'build-info.json') assert.equal(type, 'application/json', 'Build identity JSON MIME');
  if (file.relativePath === 'index.html') assert.equal(type, 'text/html', 'Index MIME');
}
export async function validateLocal(pins) {
  assert.equal(await hashFile(STAGE + '/frozen-artifacts.json'), pins.artifactManifestSha256, 'Frozen artifact manifest changed');
  assert.equal(await hashFile(STAGE + '/.vercel/output/config.json'), pins.outputConfigSha256, 'Frozen routing/headers changed');
  assert.equal(await hashFile(STAGE + '/.vercel/project.json'), pins.projectLinkSha256, 'Frozen project link changed');
  assertProject(await jsonFile(STAGE + '/.vercel/project.json'));
  const artifact = await jsonFile(STAGE + '/frozen-artifacts.json');
  assert.equal(artifact.schemaVersion, 1); assert.equal(artifact.stage, STAGE);
  assert.equal(artifact.index_sha256, pins.indexSha256); assert.equal(artifact.sourceCommit, pins.sourceCommit); assert.equal(artifact.build_info_sha256, pins.buildInfoSha256);
  assert.ok(Array.isArray(artifact.allFiles) && artifact.allFiles.length > 1);
  const names = artifact.allFiles.map(file => file.relativePath).sort();
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes('index.html') && names.includes('build-info.json'), 'Both index and build identity must ship');
  assert.equal(artifact.static_files, names.length);
  assert.equal(artifact.models.length, artifact.allFiles.filter(file => file.relativePath.endsWith('.glb')).length);
  assert.equal(artifact.files.length, artifact.allFiles.filter(file => file.path.startsWith('/assets/') && /\.(?:css|js)$/.test(file.path)).length);
  for (const root of [REPO + '/dist', STAGE + '/.vercel/output/static']) {
    assert.deepEqual(await listFiles(root), names, 'Frozen file set changed: ' + root);
    for (const file of artifact.allFiles) {
      assert.match(file.sha256, SHA); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
      assert.equal(file.path, file.relativePath === 'index.html' ? '/' : '/' + file.relativePath);
      assert.equal((await stat(root + '/' + file.relativePath)).size, file.bytes, file.path + ' bytes');
      assert.equal(await hashFile(root + '/' + file.relativePath), file.sha256, file.path + ' SHA256');
    }
    await validateBuildIdentity(root, pins, root === REPO + '/dist');
  }
  return artifact;
}
export function assertQaReport(validation, pins) {
  assert.ok(['passed_locally_waiting_publication', 'published_and_verified'].includes(validation.status), 'Final QA is not passed');
  assert.equal(validation.build?.success, true); assert.equal(validation.build.index_sha256, pins.indexSha256);
  assert.equal(validation.build.source_commit, pins.sourceCommit); assert.equal(validation.build.build_info_sha256, pins.buildInfoSha256);
  assert.equal(validation.build.source_fingerprint, pins.sourceFingerprint);
  for (const [key, count] of [['cpu', pins.cpuPassed], ['regression', pins.browserRegressionPassed]]) {
    const result = key === 'cpu' ? validation.cpu : validation.browser?.final_regression;
    assert.equal(result?.status, 'passed', key + ' did not pass'); assert.equal(result.index_sha256, pins.indexSha256);
    assert.equal(result.passed, count, key + ' differs from the final reviewed count');
    for (const field of ['failed', 'skipped', 'cancelled']) assert.equal(result[field], 0, key + ' ' + field);
  }
  const runtime = validation.browser?.final_runtime;
  assert.equal(runtime?.status, 'passed'); assert.equal(runtime.index_sha256, pins.indexSha256);
  for (const field of ['errors', 'failed_requests', 'external_requests']) assert.equal(runtime[field], 0, 'Runtime ' + field);
  assert.ok(Array.isArray(runtime.checks) && new Set(runtime.checks.map(check => check.id)).size === runtime.checks.length);
  for (const id of pins.expectedRuntimeChecks) assert.equal(runtime.checks.find(check => check.id === id)?.status, 'passed', 'Missing actual passed runtime check: ' + id);
  assert.ok(runtime.checks.every(check => check.status === 'passed'), 'A measured runtime check still fails');
  return { passed: true, cpuPassed: pins.cpuPassed, regressionPassed: pins.browserRegressionPassed, runtimeChecksPassed: runtime.checks.length };
}
export async function validateQa(pins) {
  const path = resolve(REPO, pins.qaReport);
  assert.equal(await hashFile(path), pins.qaReportSha256, 'Final QA report changed after review');
  const validation = await jsonFile(path);
  return { ...assertQaReport(validation, pins), path, sha256: pins.qaReportSha256 };
}

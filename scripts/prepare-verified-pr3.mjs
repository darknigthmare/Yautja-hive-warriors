// Local staging only. Never builds, commits, deploys or reads credentials.
import assert from 'node:assert/strict';
import { access, copyFile, cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { REPO, QA, STAGE, RELEASE, DEFAULT_PINS, assertProject, hashFile, jsonFile, listFiles, readPins, say, validateBuildIdentity } from './publication-pr3-lib.mjs';

export async function main(argv = process.argv.slice(2)) {
  let pinsPath = DEFAULT_PINS;
  for (let i = 0; i < argv.length; i++) { if (argv[i] === '--pins') pinsPath = resolve(argv[++i]); else throw new Error('Unknown option: ' + argv[i]); }
  const pins = await readPins(pinsPath, false);
  await validateBuildIdentity(REPO + '/dist', pins, true);
  try { await access(STAGE); throw new Error('PR3 stage already exists. It is immutable; inspect/reuse it instead of overwriting a candidate.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const configuration = await jsonFile(REPO + '/vercel.json'), project = await jsonFile(REPO + '/.vercel/project.json');
  assertProject(project); assert.ok(Array.isArray(configuration.headers) && configuration.headers.length > 0);
  // Validate the complete file set and model provenance before creating a stage.
  const { GENERATED_ASSETS } = await import(pathToFileURL(REPO + '/js/graphics/GeneratedAssetManifest.js'));
  const modelHashes = new Map();
  for (const asset of Object.values(GENERATED_ASSETS)) {
    modelHashes.set(asset.url, asset.sha256);
    for (const [clip, url] of Object.entries(asset.animationUrls ?? {})) modelHashes.set(url, asset.animationSha256?.[clip]);
  }
  const allFiles = [];
  for (const relativePath of await listFiles(REPO + '/dist')) {
    const full = REPO + '/dist/' + relativePath, sha256 = await hashFile(full), bytes = (await stat(full)).size;
    const path = relativePath === 'index.html' ? '/' : '/' + relativePath;
    if (relativePath.endsWith('.glb')) assert.equal(sha256, modelHashes.get(path), 'Every shipping GLB must match the active source manifest: ' + path);
    allFiles.push({ path, relativePath, bytes, sha256 });
  }
  assert.ok(allFiles.some(file => file.relativePath === 'build-info.json'));
  const routes = configuration.headers.map(({ source, headers }) => ({
    src: source.includes('(.*)') ? source : source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    headers: Object.fromEntries(headers.map(({ key, value }) => [key, value])), continue: true
  }));
  routes.push({ handle: 'filesystem' });
  const output = STAGE + '/.vercel/output';
  // Exclusive creation protects a candidate even if two preparation commands race.
  await mkdir(QA, { recursive: true }); await mkdir(STAGE);
  await mkdir(output, { recursive: true }); await cp(REPO + '/dist', output + '/static', { recursive: true });
  await copyFile(REPO + '/vercel.json', STAGE + '/vercel.json');
  await writeFile(STAGE + '/.vercel/project.json', JSON.stringify(project, null, 2) + '\n', { flag: 'wx' });
  await writeFile(output + '/config.json', JSON.stringify({ version: 3, routes }, null, 2) + '\n', { flag: 'wx' });
  assert.deepEqual(await listFiles(output + '/static'), allFiles.map(file => file.relativePath).sort());
  for (const file of allFiles) assert.equal(await hashFile(output + '/static/' + file.relativePath), file.sha256, 'Copy changed: ' + file.path);
  await validateBuildIdentity(REPO + '/dist', pins, true); await validateBuildIdentity(output + '/static', pins);
  const artifact = { schemaVersion: 1, status: 'staged_locally_without_deploying', releaseProfile: RELEASE.name, createdAt: new Date().toISOString(), stage: STAGE,
    sourceCommit: pins.sourceCommit, sourceFingerprint: pins.sourceFingerprint, index_sha256: pins.indexSha256, build_info_sha256: pins.buildInfoSha256,
    static_files: allFiles.length, static_bytes: allFiles.reduce((sum, file) => sum + file.bytes, 0),
    expected_headers: configuration.headers, files: allFiles.filter(file => file.path.startsWith('/assets/') && /\.(?:css|js)$/.test(file.path)),
    models: allFiles.filter(file => file.relativePath.endsWith('.glb')), allFiles };
  await writeFile(STAGE + '/frozen-artifacts.json', JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx' });
  const proposed = { ...pins, status: 'staged_awaiting_final_qa_and_review', artifactManifestSha256: await hashFile(STAGE + '/frozen-artifacts.json'),
    outputConfigSha256: await hashFile(output + '/config.json'), projectLinkSha256: await hashFile(STAGE + '/.vercel/project.json') };
  const proposal = QA + '/publication-pins.proposed.json';
  await writeFile(proposal, JSON.stringify(proposed, null, 2) + '\n', { flag: 'wx' });
  say({ status: artifact.status, stage: STAGE, files: artifact.static_files, models: artifact.models.length, bundles: artifact.files.length,
    bytes: artifact.static_bytes, indexSha256: pins.indexSha256, buildInfoSha256: pins.buildInfoSha256, proposedPins: proposal,
    finalQaRequired: true, remoteActionsExecuted: false });
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(error => { say({ status: 'local_staging_failed', error: error.message, remoteActionsExecuted: false }); process.exitCode = 1; });

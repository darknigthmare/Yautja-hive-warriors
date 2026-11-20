// Called only by the coordinator after final local QA. Both modes read bytes;
// candidate mode uses the existing credential wrapper, public mode has no auth.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { QA, STAGE, ORIGIN, RELEASE, DEFAULT_PINS, assertHttpHeaders, hashFile, readPins, say, validateLocal, validateQa } from './publication-pr3-lib.mjs';

const headerNames = ['content-type', 'content-security-policy', 'content-disposition', 'cache-control', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy'];
async function candidateFile(pins, deploymentId, file, directory, index, rules) {
  const body = `${directory}/body-${index}`, stderrPath = `${directory}/request-${index}.log`;
  const format = 'http_code:%{http_code}\n' + headerNames.map(name => `${name}:%header{${name}}\n`).join('');
  let stdout = '', stderr = '';
  const result = await new Promise((done, reject) => {
    const child = spawn(pins.cliWrapper, ['curl', file.path, '--deployment', deploymentId, '--', '--max-time', '120', '--silent', '--show-error', '--output', body, '--write-out', format],
      { cwd: STAGE, env: { ...process.env, NODE_USE_ENV_PROXY: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGTERM'), 130000);
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-50000); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => { clearTimeout(timer); done({ code, signal }); });
  });
  await writeFile(stderrPath, stderr); await writeFile(`${directory}/headers-${index}.txt`, stdout);
  assert.equal(result.code, 0, 'Candidate request failed; see ' + stderrPath);
  const headers = {};
  for (const line of stdout.split(/\r?\n/)) { const colon = line.indexOf(':'); if (colon > 0) headers[line.slice(0, colon)] = line.slice(colon + 1).trim(); }
  assert.equal(headers.http_code, '200', file.path + ' candidate HTTP');
  assertHttpHeaders(file, headers, rules);
  const { size } = await stat(body), sha256 = await hashFile(body);
  assert.equal(size, file.bytes, file.path + ' candidate bytes'); assert.equal(sha256, file.sha256, file.path + ' candidate SHA256');
  // Full GLB bodies were hashed. No second 250MB copy is retained after proof.
  await rm(body); return { path: file.path, bytes: size, sha256, headers, http: 200 };
}
async function publicFile(file, rules) {
  const response = await fetch(ORIGIN + file.path, { redirect: 'error', signal: AbortSignal.timeout(180000) });
  assert.equal(response.status, 200, file.path + ' public HTTP');
  const digest = createHash('sha256'); let bytes = 0;
  for await (const chunk of response.body) { digest.update(chunk); bytes += chunk.length; assert.ok(bytes <= file.bytes, file.path + ' returned oversized bytes'); }
  const sha256 = digest.digest('hex'); assert.equal(bytes, file.bytes, file.path + ' public bytes'); assert.equal(sha256, file.sha256, file.path + ' public SHA256');
  const headers = Object.fromEntries(headerNames.map(name => [name, response.headers.get(name)])); assertHttpHeaders(file, headers, rules);
  return { path: file.path, bytes, sha256, headers, http: response.status };
}
export async function verifyHttp({ pins, artifact, mode, deploymentId = null, runId = new Date().toISOString().replace(/[:.]/g, '-') }) {
  assert.ok(['candidate', 'public'].includes(mode));
  if (mode === 'candidate' || deploymentId !== null && deploymentId !== undefined) assert.match(deploymentId ?? '', /^dpl_[A-Za-z0-9]+$/);
  const directory = `${QA}/http-${mode}-${runId}`; await mkdir(directory);
  const reportPath = directory + '/report.json', latestPath = `${QA}/vercel-${mode}-verification.json`;
  const report = { status: 'running', releaseProfile: RELEASE.name, mode, deploymentId, origin: mode === 'public' ? ORIGIN : null, unauthenticated: mode === 'public',
    redirectsAllowed: false, index_sha256: pins.indexSha256, build_info_sha256: pins.buildInfoSha256, sourceCommit: pins.sourceCommit,
    artifactManifestSha256: pins.artifactManifestSha256, expectedFiles: artifact.allFiles.length, checkedAt: new Date().toISOString(), files: [] };
  const save = async () => { const text = JSON.stringify(report, null, 2) + '\n'; await writeFile(reportPath, text); await writeFile(latestPath, text); };
  await save();
  try {
    for (const [index, file] of artifact.allFiles.entries()) {
      const proof = mode === 'candidate' ? await candidateFile(pins, deploymentId, file, directory, index, artifact.expected_headers) : await publicFile(file, artifact.expected_headers);
      report.files.push(proof); await save();
    }
    assert.equal(report.files.length, artifact.allFiles.length);
    report.modelsVerified = report.files.filter(file => file.path.endsWith('.glb')).length;
    report.bundlesVerified = report.files.filter(file => file.path.startsWith('/assets/') && /\.(?:css|js)$/.test(file.path)).length;
    report.buildInfoVerified = report.files.some(file => file.path === '/build-info.json' && file.sha256 === pins.buildInfoSha256);
    assert.equal(report.modelsVerified, artifact.models.length); assert.equal(report.bundlesVerified, artifact.files.length); assert.equal(report.buildInfoVerified, true);
    report.status = 'passed'; report.completedAt = new Date().toISOString(); await save(); return { ...report, reportPath };
  } catch (error) { report.status = 'failed'; report.error = error.message; await save(); throw error; }
}
export async function main(argv = process.argv.slice(2)) {
  let pinsPath = DEFAULT_PINS, mode, deploymentId;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pins') pinsPath = resolve(argv[++i]); else if (argv[i] === '--mode') mode = argv[++i];
    else if (argv[i] === '--deployment') deploymentId = argv[++i]; else throw new Error('Unknown option: ' + argv[i]);
  }
  const pins = await readPins(pinsPath), artifact = await validateLocal(pins); await validateQa(pins);
  const report = await verifyHttp({ pins, artifact, mode, deploymentId });
  say({ status: report.status, mode, files: report.files.length, models: report.modelsVerified, bundles: report.bundlesVerified, buildInfoVerified: report.buildInfoVerified, reportPath: report.reportPath });
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(error => { say({ status: 'http_verification_failed', error: error.message }); process.exitCode = 1; });

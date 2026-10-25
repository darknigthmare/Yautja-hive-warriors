// Resume this exact reviewed cloud build. Default: local integrity checks only.
// Network commands use the existing session and never read credential files.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERIFIED_SHA = '8683a627c08e1c2647913aa29dc375df8cdde08c69da18895981de2b5c5fae6f';
const PREVIOUS_PUBLIC_SHA = '9fdd19169a75d324dbde0e77bddbac90167e81ca19bfb06880084246a4bad6d6';
const MANIFEST_SHA = 'da553b8ca45340e81b7c522ec1d6616f89c2f19aead7b26153ea458495271649';
const CONFIG_SHA = 'fff4229af49c3a7397bd4aed332a50e94f7856a0366cfab2c2e2478a779b409b';
const LINK_SHA = '77454d4ed9af5d8736994c6061dadc515966445cabaa602b75ee4482fffb8505';
const ORIGIN = 'https://yautja-hive-warriors.vercel.app';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const qa = '/workspace/qa/development-20261025';
const qaReportPath = repo + '/docs/qa/development-validation.json';
const stage = qa + '/vercel-static-prebuilt-v2';
const cli = qa + '/vercel-cli.sh';
const argv = process.argv.slice(2);
const options = { deploy: false, promote: false, deployment: null, waitMs: 180000, checkOnly: false };
for (let index = 0; index < argv.length; index++) {
  const argument = argv[index];
  if (argument === '--deploy') options.deploy = true;
  else if (argument === '--promote') options.promote = true;
  else if (argument === '--check-only') options.checkOnly = true;
  else if (argument === '--deployment') options.deployment = argv[++index];
  else if (argument === '--ready-timeout-ms') options.waitMs = Number(argv[++index]);
  else throw new Error(`Unknown option: ${argument}`);
}
assert.ok(!(options.deploy && options.deployment), 'Choose a new deployment or an existing candidate, not both');
assert.ok(!options.promote || options.deploy || options.deployment, '--promote requires --deploy or --deployment ID');
assert.ok(!options.checkOnly || !(options.deploy || options.deployment || options.promote), '--check-only cannot mutate a remote deployment');
assert.ok(Number.isInteger(options.waitMs) && options.waitMs >= 1000 && options.waitMs <= 900000, 'Bound READY waiting to at most 15 minutes');
if (options.deployment) assert.match(options.deployment, /^dpl_[A-Za-z0-9]+$/);

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const say = value => process.stdout.write(JSON.stringify(value) + '\n');
const hashFile = async path => {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
};
const jsonFile = async path => JSON.parse(await readFile(path, 'utf8'));
async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), 'Do not publish symlinks');
    const relative = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await listFiles(directory + '/' + entry.name, relative + '/'));
    else { assert.ok(entry.isFile()); result.push(relative); }
  }
  return result.sort();
}
let artifact;
async function validateLocal() {
  assert.equal(await hashFile(stage + '/frozen-artifacts.json'), MANIFEST_SHA, 'Frozen manifest changed');
  assert.equal(await hashFile(qa + '/vercel-local-artifacts.json'), MANIFEST_SHA, 'Active HTTP verification manifest must still be v2');
  assert.equal(await hashFile(stage + '/.vercel/output/config.json'), CONFIG_SHA, 'Frozen headers/routes changed');
  assert.equal(await hashFile(stage + '/.vercel/project.json'), LINK_SHA, 'Frozen project link changed');
  artifact = await jsonFile(stage + '/frozen-artifacts.json');
  assert.equal(artifact.index_sha256, VERIFIED_SHA);
  assert.equal(artifact.stage, stage);
  const link = await jsonFile(stage + '/.vercel/project.json');
  assert.equal(link.projectName, 'yautja-hive-warriors');
  assert.equal(link.projectId, 'prj_zA8CZlvC2NrLJFia0lVUFwUVuTZQ');
  assert.equal(link.orgId, 'team_VrIjq2UWV6VaHZr7DdQFwvfu');
  const expectedNames = artifact.allFiles.map(file => file.relativePath).sort();
  for (const root of [repo + '/dist', stage + '/.vercel/output/static']) {
    assert.deepEqual(await listFiles(root), expectedNames, 'Frozen file set changed: ' + root);
    for (const file of artifact.allFiles) {
      assert.equal((await stat(root + '/' + file.relativePath)).size, file.bytes, file.path + ' size');
      assert.equal(await hashFile(root + '/' + file.relativePath), file.sha256, file.path + ' SHA');
    }
    assert.equal(await hashFile(root + '/index.html'), VERIFIED_SHA);
  }
  return { verifiedIndexSha256: VERIFIED_SHA, files: artifact.static_files, models: artifact.models.length, bundles: artifact.files.length };
}
async function validateGlobalQa(required = false) {
  const validation = await jsonFile(qaReportPath);
  const checks = {
    final_status: ['passed_locally_waiting_publication', 'published_and_verified'].includes(validation.status),
    final_build: validation.build?.success === true && validation.build?.index_sha256 === VERIFIED_SHA,
    cpu: validation.cpu?.passed === 360 && validation.cpu?.failed === 0
      && validation.cpu?.final_environment?.status === 'passed',
    regression_browser: validation.browser?.final_regression?.status === 'passed'
      && validation.browser?.final_regression?.index_sha256 === VERIFIED_SHA,
    runtime_browser: validation.browser?.final_runtime?.status === 'passed',
  };
  const pendingChecks = Object.keys(checks).filter(key => !checks[key]);
  const result = { source: qaReportPath, status: validation.status, passed: pendingChecks.length === 0,
    pendingChecks, checkedAt: new Date().toISOString() };
  if (required) assert.ok(result.passed, 'Global QA is not ready for publication: ' + pendingChecks.join(', '));
  return result;
}
async function run(command, args, key, timeout = 90000) {
  const stdoutPath = `${qa}/resume-${runId}-${key}.json`;
  const stderrPath = `${qa}/resume-${runId}-${key}.log`;
  const stdout = createWriteStream(stdoutPath), stderr = createWriteStream(stderrPath);
  const code = await new Promise((done, reject) => {
    const child = spawn(command, args, { cwd: stage, env: { ...process.env, NODE_USE_ENV_PROXY: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout);
    child.stdout.pipe(stdout); child.stderr.pipe(stderr);
    child.once('error', error => { clearTimeout(timer); stdout.end(); stderr.end(); reject(error); });
    child.once('close', (exitCode, signal) => { clearTimeout(timer); done({ exitCode, signal }); });
  });
  await Promise.all([stdout.closed ? undefined : new Promise(done => stdout.once('close', done)), stderr.closed ? undefined : new Promise(done => stderr.once('close', done))]);
  return { ...code, stdoutPath, stderrPath, text: await readFile(stdoutPath, 'utf8') };
}
const runCli = (args, key, timeout) => run(cli, args, key, timeout);
async function publicSnapshot() {
  const response = await fetch(ORIGIN, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, 'Canonical HTTP');
  const sha256 = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
  assert.ok([PREVIOUS_PUBLIC_SHA, VERIFIED_SHA].includes(sha256), 'Canonical changed to another build; review before replacing it');
  return { http: response.status, sha256 };
}
let deploymentId = options.deployment;
const report = { status: 'starting', startedAt: new Date().toISOString(), index_sha256: VERIFIED_SHA, stage, promotion_executed: false, deployment_id: deploymentId, other_projects_changed: false, billing_changed: false };
async function save() {
  report.updatedAt = new Date().toISOString();
  await writeFile(qa + '/vercel-delivery-status.json', JSON.stringify(report, null, 2) + '\n');
}
async function readyCandidate() {
  const deadline = Date.now() + options.waitMs;
  let poll = 0;
  while (Date.now() < deadline) {
    const response = await runCli(['inspect', deploymentId, '--json'], `inspect-${poll++}`, 45000);
    assert.equal(response.exitCode, 0, 'Candidate inspection failed; see ' + response.stderrPath);
    const metadata = JSON.parse(response.text);
    assert.equal(metadata.id, deploymentId);
    assert.equal(metadata.name, 'yautja-hive-warriors');
    assert.equal(metadata.contextName, 'darknigthmares-projects');
    assert.equal(metadata.target, 'production');
    report.ready_state = metadata.readyState;
    report.candidate_url = 'https://' + metadata.url.replace(/^https?:\/\//, '');
    await save(); say({ deploymentId, state: metadata.readyState });
    if (metadata.readyState === 'READY') return;
    assert.ok(!['ERROR', 'CANCELED', 'CANCELLED'].includes(metadata.readyState), 'Candidate failed');
    await new Promise(done => setTimeout(done, Math.min(15000, Math.max(0, deadline - Date.now()))));
  }
  report.status = 'candidate_created_waiting_for_ready'; await save();
  const error = new Error(`READY deadline reached; resume with --deployment ${deploymentId}`); error.waiting = true; throw error;
}

try {
  const integrity = await validateLocal();
  if (!options.deploy && !options.deployment) {
    const local = { status: 'passed_local_integrity_only', ...integrity, globalQa: await validateGlobalQa(),
      checkedAt: new Date().toISOString(), remoteActionsExecuted: false };
    await writeFile(qa + '/vercel-resume-local-check.json', JSON.stringify(local, null, 2) + '\n');
    say(local);
  } else {
    // Gate all remote workflow paths on the root's actual final QA report.
    // In particular, no candidate can be submitted while runtime QA is pending.
    report.global_qa = await validateGlobalQa(true);
    const initial = await publicSnapshot(); report.canonical_before = initial;
    if (initial.sha256 !== VERIFIED_SHA) {
      if (options.deploy) {
        await validateLocal(); report.global_qa = await validateGlobalQa(true);
        const result = await runCli(['deploy', '--prebuilt', '--prod', '--skip-domain', '--yes', '--json', '--no-wait'], 'submission', 120000);
        const submission = JSON.parse(result.text || '{}');
        if (result.exitCode !== 0 || submission.status === 'error') {
          const message = submission.message ?? 'Deployment submission failed; see saved CLI log';
          report.status = /api-deployments-free-per-day/.test(message) ? 'v2_publication_blocked_by_vercel_daily_deployment_quota' : 'candidate_submission_failed';
          report.error_code = /api-deployments-free-per-day/.test(message) ? 'api-deployments-free-per-day' : 'submission_failed';
          report.error_message = message; report.submission_evidence = [result.stdoutPath, result.stderrPath];
          report.canonical_after = await publicSnapshot(); await save();
          const error = new Error(message); error.quota = report.error_code === 'api-deployments-free-per-day'; throw error;
        }
        deploymentId = submission.deployment?.id;
        assert.match(deploymentId ?? '', /^dpl_[A-Za-z0-9]+$/);
        report.deployment_id = deploymentId; report.status = 'candidate_created_without_domain_promotion'; await save();
      }
      await readyCandidate();
      const candidate = await run('python', [qa + '/verify-vercel-candidate.py', deploymentId], 'candidate-verification', 150000);
      assert.equal(candidate.exitCode, 0, 'Candidate HTTP verification failed; see ' + candidate.stdoutPath);
      const verification = await jsonFile(qa + '/vercel-candidate-verification.json');
      assert.equal(verification.deployment_id, deploymentId); assert.equal(verification.index_sha256, VERIFIED_SHA); assert.equal(verification.passed, true);
      await copyFile(qa + '/vercel-candidate-verification.json', `${qa}/resume-${runId}-candidate-proof.json`);
      report.status = 'candidate_ready_http_verified_waiting_for_promotion'; await save();
      if (options.promote) {
        await validateLocal(); report.global_qa = await validateGlobalQa(true); await publicSnapshot();
        const promotion = await runCli(['promote', deploymentId, '--yes', '--timeout', '60s'], 'promotion', 90000);
        assert.equal(promotion.exitCode, 0, 'Promotion failed; see ' + promotion.stderrPath);
        report.promotion_executed = true; report.status = 'promoted_awaiting_public_verification'; await save();
      } else say({ status: report.status, deploymentId, verifiedIndexSha256: VERIFIED_SHA, promotionExecuted: false });
    }
    if (initial.sha256 === VERIFIED_SHA || options.promote) {
      const canonical = await publicSnapshot(); assert.equal(canonical.sha256, VERIFIED_SHA, 'Canonical did not switch to the pinned build');
      // The verifier requires an ID only as a report label; no authenticated
      // request is used to prove the public bytes and headers.
      const label = deploymentId ?? 'already-public-id-not-resolved';
      const result = await run(process.execPath, [qa + '/verify-vercel-public.mjs', label], 'public-verification', 300000);
      assert.equal(result.exitCode, 0, 'Public verification failed; see ' + result.stdoutPath);
      const publicProof = await jsonFile(qa + '/vercel-public-verification.json');
      assert.equal(publicProof.status, 'passed'); assert.equal(publicProof.frozen_index_sha256, VERIFIED_SHA); assert.equal(publicProof.files.length, artifact.allFiles.length);
      report.status = 'published_and_public_http_verified'; report.public_url = ORIGIN; report.canonical_after = canonical;
      report.public_files_verified = publicProof.files.length; report.public_models_verified = artifact.models.length; report.public_bundles_verified = artifact.files.length;
      report.browser_verification = 'Required separately on the canonical URL; this script does not start Chromium or claim human QA';
      await save(); say({ status: report.status, deploymentId, verifiedIndexSha256: VERIFIED_SHA, publicFilesVerified: publicProof.files.length });
    }
  }
} catch (error) {
  if (!options.deploy && !options.deployment) {
    say({ status: 'local_integrity_failed_no_remote_action', error: error.message });
  } else {
    if (!error.quota && !error.waiting) { report.status = 'stopped_before_further_remote_actions'; report.error_message = error.message; await save(); }
    say({ status: report.status, deploymentId, error: error.message, automaticRetry: false });
  }
  process.exitCode = error.quota ? 2 : error.waiting ? 3 : 1;
}

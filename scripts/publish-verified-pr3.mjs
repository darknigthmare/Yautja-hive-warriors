// Default: local validation only. Remote actions require explicit flags and
// frozen final QA. One candidate, READY, every byte, then optional promotion.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { QA, STAGE, ORIGIN, REPO, PROJECT, DEFAULT_PINS, readPins, say, validateLocal, validateQa } from './publication-pr3-lib.mjs';
import { verifyHttp } from './verify-pr3-http.mjs';

export function parseOptions(argv) {
  const options = { pinsPath: DEFAULT_PINS, deploy: false, promote: false, deploymentId: null, waitMs: 180000, checkOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pins') options.pinsPath = resolve(argv[++i]);
    else if (argv[i] === '--deploy') options.deploy = true;
    else if (argv[i] === '--promote') options.promote = true;
    else if (argv[i] === '--deployment') options.deploymentId = argv[++i];
    else if (argv[i] === '--ready-timeout-ms') options.waitMs = Number(argv[++i]);
    else if (argv[i] === '--check-only') options.checkOnly = true;
    else throw new Error('Unknown option: ' + argv[i]);
  }
  assert.ok(!(options.deploy && options.deploymentId), 'Use --deployment to resume an existing candidate; never submit a duplicate');
  assert.ok(!options.promote || options.deploy || options.deploymentId, '--promote requires --deploy or --deployment');
  assert.ok(!options.checkOnly || !(options.deploy || options.promote || options.deploymentId), '--check-only cannot request remote actions');
  assert.ok(Number.isInteger(options.waitMs) && options.waitMs >= 1000 && options.waitMs <= 900000, 'READY deadline must be 1 second to 15 minutes');
  if (options.deploymentId) assert.match(options.deploymentId, /^dpl_[A-Za-z0-9]+$/);
  return options;
}
export async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv), pins = await readPins(options.pinsPath), runId = new Date().toISOString().replace(/[:.]/g, '-');
  await mkdir(QA, { recursive: true });
  const reportPath = `${QA}/publication-${runId}.json`, latestPath = QA + '/vercel-delivery-status.json';
  const report = { status: 'starting_local_validation', startedAt: new Date().toISOString(), sourceCommit: pins.sourceCommit,
    index_sha256: pins.indexSha256, build_info_sha256: pins.buildInfoSha256, stage: STAGE, promotion_executed: false,
    deployment_id: options.deploymentId, submission_attempted: false, remoteActionsExecuted: false, other_projects_changed: false, billing_changed: false };
  const save = async (latest = false) => {
    report.updatedAt = new Date().toISOString(); const text = JSON.stringify(report, null, 2) + '\n';
    await writeFile(reportPath, text); if (latest) await writeFile(latestPath, text);
  };
  async function run(command, args, label, { timeout = 90000, cwd = STAGE } = {}) {
    const stdoutPath = `${QA}/publication-${runId}-${label}.stdout`, stderrPath = `${QA}/publication-${runId}-${label}.log`;
    let stdout = '', stderr = '';
    const result = await new Promise((done, reject) => {
      const child = spawn(command, args, { cwd, env: { ...process.env, NODE_USE_ENV_PROXY: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
      let killTimer;
      const timer = setTimeout(() => { child.kill('SIGTERM'); killTimer = setTimeout(() => child.kill('SIGKILL'), 2000); }, timeout);
      child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-2000000); });
      child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-200000); });
      child.once('error', error => { clearTimeout(timer); clearTimeout(killTimer); reject(error); });
      child.once('close', (code, signal) => { clearTimeout(timer); clearTimeout(killTimer); done({ code, signal }); });
    });
    await writeFile(stdoutPath, stdout); await writeFile(stderrPath, stderr);
    return { ...result, stdout, stdoutPath, stderrPath };
  }
  const cli = (args, label, timeout) => run(pins.cliWrapper, args, label, { timeout });
  async function finalGate() {
    const artifact = await validateLocal(pins); report.globalQa = await validateQa(pins);
    // Read-only ancestry admits a later documentation-only commit. Runtime
    // source is independently fingerprinted, so edited code still fails closed.
    const ancestry = await run('git', ['merge-base', '--is-ancestor', pins.sourceCommit, 'HEAD'], 'source-ancestry', { cwd: REPO, timeout: 10000 });
    assert.equal(ancestry.code, 0, 'The build source is not an ancestor of this release branch');
    report.sourceCommitIsAncestorOfRelease = true;
    return artifact;
  }
  async function canonicalSnapshot() {
    const response = await fetch(ORIGIN, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, 'Canonical HTTP');
    const sha256 = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
    assert.ok([pins.previousPublicIndexSha256, pins.indexSha256].includes(sha256), 'Canonical changed to another build. Review before replacing it.');
    return { http: response.status, sha256, checkedAt: new Date().toISOString() };
  }
  let artifact, deploymentId = options.deploymentId, ownsLock = false;
  const lockPath = QA + '/publication-remote.lock';
  try {
    artifact = await finalGate();
    report.localFilesVerified = artifact.allFiles.length; report.localModelsVerified = artifact.models.length; report.localBundlesVerified = artifact.files.length;
    if (!options.deploy && !deploymentId) {
      report.status = 'passed_local_integrity_and_final_qa'; await save();
      say({ status: report.status, sourceCommit: pins.sourceCommit, indexSha256: pins.indexSha256, files: artifact.allFiles.length, models: artifact.models.length, bundles: artifact.files.length, remoteActionsExecuted: false, reportPath });
      return;
    }
    // Serialize even two simultaneous --deploy invocations. A crashed owner
    // leaves this lock for manual investigation, never an automatic resubmit.
    await mkdir(lockPath); ownsLock = true;
    await writeFile(lockPath + '/owner.json', JSON.stringify({ runId, processId: process.pid, startedAt: report.startedAt }) + '\n', { flag: 'wx' });
    let previous = null;
    try { previous = JSON.parse(await readFile(latestPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous) {
      assert.equal(previous.index_sha256, pins.indexSha256, 'Existing PR3 delivery belongs to another frozen build; preserve and review it');
      if (options.deploy) assert.ok(!previous.submission_attempted && !previous.deployment_id, 'A candidate submission was already attempted. Resolve/resume that candidate with --deployment; no automatic second deployment.');
      if (deploymentId && previous.deployment_id) assert.equal(deploymentId, previous.deployment_id, 'Resume the single recorded candidate');
    }
    report.remoteActionsExecuted = true; report.canonical_before = await canonicalSnapshot();
    if (report.canonical_before.sha256 !== pins.indexSha256) {
      if (options.deploy) {
        await finalGate(); report.submission_attempted = true; report.status = 'submission_started_no_domain_promotion'; await save(true);
        const submission = await cli(['deploy', '--prebuilt', '--prod', '--skip-domain', '--yes', '--json', '--no-wait'], 'submission', 120000);
        let data; try { data = JSON.parse(submission.stdout); } catch { throw new Error('Submission response was not JSON. Resolve its deployment ID before attempting another submission.'); }
        if (submission.code !== 0 || data.status === 'error') {
          report.status = 'submission_failed_without_retry'; report.submissionEvidence = [submission.stdoutPath, submission.stderrPath];
          report.error = data.message ?? 'See the saved submission evidence'; await save(true); throw new Error(report.error);
        }
        deploymentId = data.deployment?.id; assert.match(deploymentId ?? '', /^dpl_[A-Za-z0-9]+$/);
        report.deployment_id = deploymentId; report.status = 'candidate_created_without_domain_promotion'; await save(true);
      }
      assert.match(deploymentId ?? '', /^dpl_[A-Za-z0-9]+$/);
      report.deployment_id = deploymentId; report.submission_attempted ||= !!previous?.submission_attempted;
      const deadline = Date.now() + options.waitMs; let ready = false, poll = 0;
      while (Date.now() < deadline) {
        const result = await cli(['inspect', deploymentId, '--json'], 'inspect-' + poll++, 45000);
        assert.equal(result.code, 0, 'Candidate inspect failed; see ' + result.stderrPath);
        const metadata = JSON.parse(result.stdout);
        assert.equal(metadata.id, deploymentId); assert.equal(metadata.name, PROJECT.projectName);
        assert.equal(metadata.contextName, PROJECT.contextName); assert.equal(metadata.target, 'production');
        report.ready_state = metadata.readyState; report.candidate_url = 'https://' + metadata.url.replace(/^https?:\/\//, ''); await save(true);
        say({ deploymentId, readyState: metadata.readyState });
        if (metadata.readyState === 'READY') { ready = true; break; }
        assert.ok(!['ERROR', 'CANCELED', 'CANCELLED'].includes(metadata.readyState), 'Candidate failed; no replacement submitted automatically');
        await new Promise(done => setTimeout(done, Math.min(10000, Math.max(0, deadline - Date.now()))));
      }
      if (!ready) { report.status = 'candidate_waiting_for_ready'; await save(true); const error = new Error('READY deadline reached; resume with --deployment ' + deploymentId); error.waiting = true; throw error; }
      const candidate = await verifyHttp({ pins, artifact, mode: 'candidate', deploymentId, runId });
      assert.equal(candidate.status, 'passed'); assert.equal(candidate.files.length, artifact.allFiles.length);
      report.candidateProof = candidate.reportPath; report.status = 'candidate_all_bytes_verified_waiting_for_promotion'; await save(true);
      if (options.promote) {
        await finalGate(); await canonicalSnapshot();
        const result = await cli(['promote', deploymentId, '--yes', '--timeout', '60s'], 'promotion', 90000);
        assert.equal(result.code, 0, 'Promotion failed; see ' + result.stderrPath);
        report.promotion_executed = true; report.status = 'promoted_waiting_for_public_bytes'; await save(true);
      } else { say({ status: report.status, deploymentId, filesVerified: candidate.files.length, promotionExecuted: false, reportPath }); return; }
    }
    report.canonical_after = await canonicalSnapshot(); assert.equal(report.canonical_after.sha256, pins.indexSha256, 'Canonical index has not switched to the frozen build');
    const proof = await verifyHttp({ pins, artifact, mode: 'public', deploymentId, runId });
    report.publicProof = proof.reportPath; report.status = 'published_and_public_all_bytes_verified'; report.public_url = ORIGIN;
    report.publicFilesVerified = proof.files.length; report.publicModelsVerified = proof.modelsVerified; report.publicBundlesVerified = proof.bundlesVerified;
    report.buildInfoVerified = proof.buildInfoVerified;
    report.browserVerification = 'Separate canonical browser verification is required; this script does not start Chromium or claim human QA.';
    await save(true); say({ status: report.status, deploymentId, sourceCommit: pins.sourceCommit, indexSha256: pins.indexSha256, buildInfoSha256: pins.buildInfoSha256, files: proof.files.length, reportPath });
  } catch (error) {
    if (!error.waiting) report.status = report.remoteActionsExecuted ? 'stopped_before_further_remote_actions' : 'local_gate_failed_no_remote_action';
    report.error = error.message; await save(report.remoteActionsExecuted);
    say({ status: report.status, deploymentId, error: error.message, automaticRetry: false, reportPath }); process.exitCode = error.waiting ? 3 : 1;
  } finally { if (ownsLock) { await rm(lockPath + '/owner.json', { force: true }); await rmdir(lockPath); } }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(error => { say({ status: 'pins_or_arguments_invalid_no_remote_action', error: error.message }); process.exitCode = 1; });

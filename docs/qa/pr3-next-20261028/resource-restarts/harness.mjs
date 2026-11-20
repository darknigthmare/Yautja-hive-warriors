// Final-build resource fixture. ROOT schedules exclusive Chromium access.
// This file never builds, writes runtime source, invokes Git or calls Vercel.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { CHARACTERS_DATA } from '../../../../js/data/charactersData.js';
import { LEVELS_DATA } from '../../../../js/data/levelsData.js';
import { finishMissionInsertion } from '../../../../tests/helpers/finish-insertion.mjs';
import { assessCycles, installResourceDiagnostics, parseOptions, settleAssetPromises } from './harness-lib.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const sha = value => createHash('sha256').update(value).digest('hex');
const pause = ms => new Promise(done => setTimeout(done, ms));
async function hashFile(path) {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(path)) digest.update(bytes);
  return digest.digest('hex');
}
async function tree(directory, prefix = '') {
  const rows = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), 'Frozen dist cannot contain symbolic links');
    const path = resolve(directory, entry.name), name = prefix + entry.name;
    if (entry.isDirectory()) rows.push(...await tree(path, name + '/'));
    else { assert.ok(entry.isFile()); rows.push({ path: name, sha256: await hashFile(path) }); }
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

export async function main(argv = process.argv.slice(2)) {
  // Parse every mandatory build pin before creating a preview or Chromium.
  const options = parseOptions(argv), url = 'http://127.0.0.1:' + options.port;
  const character = CHARACTERS_DATA.find(item => item.id === 'city_hunter');
  const level = LEVELS_DATA.find(item => item.id === 'la_rooftops');
  assert.ok(character && level, 'Canonical fixed mission configuration must exist');
  const report = {
    schemaVersion: 1, status: 'running', startedAt: new Date().toISOString(),
    expectedIndexSha256: options.expectedIndex, expectedSourceCommit: options.expectedSource,
    scope: 'Fixed City Hunter / Los Angeles sandbox, real mission construction, insertion, active render and returnToMenu cleanup. Five default warmups then ten complete measured restarts; direct launch and simulation stepping are assisted. Native RNG remains unchanged.',
    humanTesters: 0, fidelity1to1Verified: false, hardwarePerformanceMeasured: false, victoriesClaimed: 0,
    configuration: { levelId: level.id, characterId: character.id, missionMode: 'sandbox', enemyCount: 1,
      quality: 'low', viewport: { width: 480, height: 320 }, simulatedAfterInsertion: .25,
      warmups: options.warmups, measured: options.measured, previewCwd: root },
    cycles: [], errors: [], failedRequests: [], httpErrors: [], externalRequests: []
  };
  let server, browser, context, page, cdp, before, current = 'bootstrap', watchdog;
  const save = () => writeFile(resolve(options.output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await mkdir(dirname(options.output), { recursive: true });
  await mkdir(options.output); // Preserve every earlier attempt instead of overwriting it.
  try {
    before = await tree(resolve(root, 'dist'));
    report.distBefore = { indexSha256: await hashFile(resolve(root, 'dist/index.html')), treeSha256: sha(JSON.stringify(before)),
      buildInfoSha256: await hashFile(resolve(root, 'dist/build-info.json')), buildInfo: JSON.parse(await readFile(resolve(root, 'dist/build-info.json'), 'utf8')), files: before.length };
    assert.equal(report.distBefore.indexSha256, options.expectedIndex, 'Frozen index differs from ROOT authorization');
    assert.equal(report.distBefore.buildInfo.sourceCommit, options.expectedSource, 'Frozen source differs from ROOT authorization');
    assert.equal(report.distBefore.buildInfo.sourceTreeDirty, false, 'The final build must have clean runtime source');
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(options.port), '--strictPort'],
      { cwd: root, stdio: 'ignore' });
    server.on('error', error => { report.previewError = error.message; });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.ok(server.exitCode === null && !report.previewError, 'Preview process stopped before readiness');
      try { ready = (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Preview is starting. */ }
      if (ready) break;
      await pause(100);
    }
    assert.ok(ready, 'Frozen static preview unavailable');
    const served = await fetch(url, { signal: AbortSignal.timeout(15000) });
    assert.equal(sha(Buffer.from(await served.arrayBuffer())), options.expectedIndex, 'Preview port serves another candidate');
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
    watchdog = setTimeout(() => { report.watchdogExpired = true; void browser.close(); }, 18 * 60 * 1000);
    context = await browser.newContext({ viewport: report.configuration.viewport, deviceScaleFactor: 1 });
    page = await context.newPage(); page.setDefaultTimeout(120000);
    page.on('pageerror', error => report.errors.push({ cycle: current, kind: 'pageerror', message: error.message }));
    page.on('console', message => { if (message.type() === 'error') report.errors.push({ cycle: current, kind: 'console', message: message.text() }); });
    page.on('requestfailed', request => report.failedRequests.push({ cycle: current, url: request.url(), failure: request.failure() }));
    page.on('response', response => { if (response.status() >= 400) report.httpErrors.push({ cycle: current, url: response.url(), status: response.status() }); });
    page.on('request', request => {
      const parsed = new URL(request.url());
      if (!['data:', 'blob:'].includes(parsed.protocol) && parsed.origin !== url) report.externalRequests.push({ cycle: current, url: request.url() });
    });
    await page.addInitScript(() => { localStorage.setItem('yautja_graphics_quality', 'low'); localStorage.setItem('yautja_audio_muted', 'true'); });
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 180000 });
    assert.equal(sha(await response.body()), options.expectedIndex, 'Browser document differs from the authorized frozen index');
    await page.waitForFunction(() => Boolean(window.game), null, { timeout: 180000 });
    cdp = await context.newCDPSession(page); await page.evaluate(installResourceDiagnostics);
    async function collect(label) {
      return page.evaluate(label => {
        game.renderer.camera.position.set(0, 12, 18); game.renderer.camera.lookAt(0, 1.5, 0);
        game.renderer.render(); game.renderer.renderer.getContext().finish();
        return window.__restartResourceQA.sample(label);
      }, label);
    }
    async function heap() {
      // Console entries can retain logged graphs. All evaluate results already
      // contain DTOs only; no page/Node handle to a disposed actor is kept.
      await cdp.send('Runtime.discardConsoleEntries');
      await cdp.send('HeapProfiler.collectGarbage');
      const usage = await cdp.send('Runtime.getHeapUsage');
      return { forcedGC: true, kind: 'CPU JS heap after CDP GC; not VRAM/RSS/ordinary play memory', usedSize: usage.usedSize,
        totalSize: usage.totalSize, embedderHeapUsedSize: usage.embedderHeapUsedSize ?? null, backingStorageSize: usage.backingStorageSize ?? null };
    }
    report.bootstrap = await collect('bootstrap'); report.graphics = await page.evaluate(() => game.renderer.getQualityInfo());
    const total = options.warmups + options.measured;
    for (let index = 0; index < total; index++) {
      const cycle = { index: index + 1, phase: index < options.warmups ? 'warmup' : 'measured',
        measuredIndex: index < options.warmups ? null : index - options.warmups + 1, startedAt: new Date().toISOString() };
      report.cycles.push(cycle); current = cycle.phase + '-' + (cycle.measuredIndex ?? cycle.index); await save();
      cycle.started = await page.evaluate(({ character, level }) => {
        const g = window.game; g.ui.selectedChar = character; g.ui.selectedLevel = level; g.missionMode = 'sandbox';
        g.isCoOp = false; g.renderer.setSplitScreen(false);
        g.activeLoadout = { primary: 'wristblades', secondary: 'smart_disc', gadgets: ['medicomp', 'bear_trap'], fidelityMode: 'adapted' };
        g.startMission({ enemyCount: 1 }); g.isPaused = true;
        return { missionRun: g.missionRun, level: g.ui.selectedLevel.id, character: g.player.data.id, remaining: g.horde.remainingCount, hp: g.player.hp };
      }, { character, level });
      assert.equal(cycle.started.remaining, 1); assert.equal(cycle.started.character, character.id); assert.equal(cycle.started.level, level.id);
      if (index) assert.notEqual(cycle.started.missionRun, report.cycles[index - 1].started.missionRun, 'A real new mission must be constructed');
      cycle.assets = await page.evaluate(settleAssetPromises, { timeoutMs: 120000 });
      assert.equal(cycle.assets.playerState, 'imported', 'The actual City Hunter import must finish');
      await page.waitForLoadState('networkidle', { timeout: 120000 });
      cycle.insertion = await finishMissionInsertion(page);
      assert.ok(cycle.insertion.visible && cycle.insertion.phase === 'complete', 'Real insertion must finish before the active render');
      cycle.active = await page.evaluate(() => {
        game.isPaused = false; for (let frame = 0; frame < 15; frame++) game.update(1 / 60); game.isPaused = true;
        game.renderer.camera.position.set(0, 12, 18); game.renderer.camera.lookAt(0, 1.5, 0);
        game.renderer.render(); game.renderer.renderer.getContext().finish();
        return window.__restartResourceQA.sample('active-after-insertion');
      });
      assert.ok(cycle.active.playing && cycle.active.playerPresent && cycle.active.playerHP > 0, 'Live mission sample requires a living real player');
      if (index === total - 1) await page.screenshot({ path: resolve(options.output, 'active-last-cycle.png') });
      await page.evaluate(() => game.returnToMenu()); await page.waitForLoadState('networkidle', { timeout: 120000 });
      cycle.cleanup = await collect('menu-first-cleanup-render'); await pause(80);
      cycle.cleanupSettled = await collect('menu-second-cleanup-render'); cycle.cpuHeap = await heap();
      assert.ok(!cycle.cleanupSettled.playing && !cycle.cleanupSettled.playerPresent, 'Menu cleanup must release the mission/player');
      assert.equal(cycle.cleanupSettled.hordeCachedPlayers, 0, 'The Horde must release its last-player cache');
      assert.ok(Object.values(cycle.cleanupSettled.liveActors).every(count => count === 0), 'A combat manager retained active actors');
      const previous = index ? report.cycles[index - 1].cleanupSettled.disposeEvents : report.bootstrap.disposeEvents;
      cycle.disposalsDelta = Object.fromEntries(Object.entries(cycle.cleanupSettled.disposeEvents).map(([key, value]) => [key, value - previous[key]]));
      cycle.status = 'completed'; cycle.finishedAt = new Date().toISOString(); await save();
      process.stdout.write(JSON.stringify({ cycle: cycle.index, phase: cycle.phase, gpu: cycle.cleanupSettled.gpuCounters,
        sceneChildren: cycle.cleanupSettled.scene.children, cachedPlayers: cycle.cleanupSettled.hordeCachedPlayers, heapAfterGC: cycle.cpuHeap.usedSize }) + '\n');
    }
    await page.screenshot({ path: resolve(options.output, 'menu-after-ten-restarts.png') });
    report.completed = { warmups: options.warmups, measured: options.measured, total: report.cycles.length };
    report.assessment = assessCycles(report.cycles, options.measured);
    report.status = report.assessment.passedResourceCriterion && !report.errors.length && !report.failedRequests.length && !report.httpErrors.length && !report.externalRequests.length ?
      'passed_resource_counters_and_texture_residency' : 'failed_resource_or_runtime_check';
  } catch (error) {
    report.status = 'failed'; report.error = error.stack ?? error.message;
    try { await page?.screenshot({ path: resolve(options.output, 'failure.png') }); } catch { /* Preserve the original failure. */ }
  } finally {
    clearTimeout(watchdog); await cdp?.detach().catch(() => {}); await context?.close().catch(() => {}); await browser?.close().catch(() => {});
    if (server && server.exitCode === null) {
      const exited = new Promise(done => server.once('exit', done)); server.kill('SIGTERM');
      let timer; try { await Promise.race([exited, new Promise(done => { timer = setTimeout(() => { server.kill('SIGKILL'); done(); }, 2000); })]); }
      finally { clearTimeout(timer); }
    }
    if (before) {
      const after = await tree(resolve(root, 'dist'));
      report.distAfter = { indexSha256: await hashFile(resolve(root, 'dist/index.html')), treeSha256: sha(JSON.stringify(after)), files: after.length };
      report.distUnchanged = JSON.stringify(before) === JSON.stringify(after);
      if (!report.distUnchanged) { report.status = 'failed'; report.error = 'Frozen dist changed during resource QA'; }
    }
    report.browserClosed = true; report.finishedAt = new Date().toISOString();
    report.durationSeconds = (Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000; await save();
    const rows = report.cycles.map(cycle => `| ${cycle.index} | ${cycle.phase} | ${cycle.cleanupSettled?.gpuCounters.geometries ?? '—'} | ${cycle.cleanupSettled?.gpuCounters.textures ?? '—'} | ${cycle.cleanupSettled?.gpuCounters.programs ?? '—'} | ${cycle.cleanupSettled?.scene.children ?? '—'} | ${cycle.cpuHeap?.usedSize ?? '—'} |`);
    await writeFile(resolve(options.output, 'README.md'), `Status: **${report.status}**. Source: ${options.expectedSource}. Index SHA256: ${options.expectedIndex}. Dist unchanged: ${report.distUnchanged}.\n\n${options.warmups} warmups followed by ten real fixed-configuration restarts; all ten cleanup samples must remain identical for a resource-counter pass. Assisted direct launch, insertion and simulation updates; native RNG unchanged. A changing measured window is reported as such, never silently trimmed. Shared imported UUIDs, image dimensions, GPU uploads and observed non-disposal are checked in active scenes and after menu cleanup. Horde cached player count must be zero.\n\n| Cycle | Phase | GPU geometries | GPU textures | Programs | Scene children | JS heap after forced GC (bytes) |\n|---|---|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\nHeap endpoint delta: ${report.assessment?.cpuHeapAfterGC.firstToLast ?? 'unavailable'} bytes. Renderer counters do not measure VRAM bytes. Forced-GC JS heap is neither GPU memory, process RSS nor normal-play memory. Dispose observers cover sampled resources only and keep weak resource references. Caches and the retained level/menu remain present. No general leak-freedom, hardware, human, victory or fidelity1:1 certification is claimed.\n`);
    process.stdout.write(JSON.stringify({ status: report.status, completed: report.completed ?? null, countersStable: report.assessment?.countersStable ?? null,
      texturesResident: report.assessment?.texturesResident ?? null, playersReleased: report.assessment?.playersReleased ?? null,
      heapDeltaBytes: report.assessment?.cpuHeapAfterGC.firstToLast ?? null, distUnchanged: report.distUnchanged, browserClosed: true, error: report.error ?? null }) + '\n');
  }
  if (report.status !== 'passed_resource_counters_and_texture_residency') process.exitCode = 1;
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
}

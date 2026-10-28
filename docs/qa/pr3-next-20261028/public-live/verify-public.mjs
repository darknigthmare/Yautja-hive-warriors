// Run only after root's final Vercel GO and exclusive Chromium handoff.
// --help and --check-config never fetch, launch Chromium, or write evidence.
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { createHash, X509Certificate } from 'node:crypto';
import { chromium } from '/workspace/Yautja-hive-warriors/node_modules/playwright/index.mjs';
import { finishMissionInsertion } from '/workspace/Yautja-next-20261028/tests/helpers/finish-insertion.mjs';

const usage = `Usage after final publication GO and exclusive Chromium handoff:
  NODE_USE_ENV_PROXY=1 node docs/qa/pr3-next-20261028/public-live/verify-public.mjs \\
    --commit SOURCE_SHA40 --index-sha256 INDEX_SHA64 \\
    --build-info-sha256 BUILD_INFO_SHA64 --deployment dpl_ID

Add --check-config to validate arguments without network, browser, or writes.
--help prints this message without network, browser, or writes.
The only target is https://yautja-hive-warriors.vercel.app.
`;
const argv = process.argv.slice(2);
if (argv.includes('--help')) { console.log(usage); process.exit(0); }
const options = {};
const flags = new Set(['--commit', '--index-sha256', '--build-info-sha256', '--deployment']);
for (let i = 0; i < argv.length; i++) {
  const key = argv[i];
  if (key === '--check-config') { if (options.checkConfig) throw Error('Duplicate --check-config'); options.checkConfig = true; continue; }
  if (!flags.has(key) || options[key] || !argv[i+1] || argv[i+1].startsWith('--')) throw Error('Invalid or duplicate argument: ' + key + '\n' + usage);
  options[key] = argv[++i];
}
if (!/^[a-f0-9]{40}$/.test(options['--commit'] ?? '')) throw Error('--commit must be a complete 40-character lowercase SHA.\n' + usage);
for (const key of ['--index-sha256', '--build-info-sha256']) if (!/^[a-f0-9]{64}$/.test(options[key] ?? '')) throw Error(key + ' must contain a 64-character lowercase SHA256.\n' + usage);
if (!/^dpl_[A-Za-z0-9]+$/.test(options['--deployment'] ?? '')) throw Error('--deployment must be a Vercel deployment ID.\n' + usage);

const root = '/workspace/Yautja-next-20261028';
const proof = root + '/docs/qa/pr3-next-20261028/public-live';
const origin = 'https://yautja-hive-warriors.vercel.app';
const expected = { source: options['--commit'], index: options['--index-sha256'], buildInfo: options['--build-info-sha256'] };
const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + expected.source.slice(0,8);
const out = '/workspace/qa/pr3-next-20261028/publication-public/' + runId;
if (options.checkConfig) {
  console.log(JSON.stringify({ status: 'configuration_valid_only', expected, deployment: options['--deployment'], origin, proof, browserLaunched: false, networkAccessed: false, filesWritten: false }));
  process.exit(0);
}

const sha = data => createHash('sha256').update(data).digest('hex');
const report = {
  status: 'running', startedAt: new Date().toISOString(), runId, origin,
  deployment: options['--deployment'], expected,
  humanTesters: 0, fidelity1to1Verified: false, hardwarePerformanceMeasured: false,
  viewport: { width: 800, height: 600 }, renderer: 'Chromium SwiftShader software WebGL',
  scope: 'Public release menu-to-pilot smoke, capsule visibility/opening/exit, nonzero finite population, FRONTS HUD, real map mouse order, O photo, checkpoint and pause-menu cleanup. No full mission victory claimed.',
  assistance: ['Pause via game API to bound software-renderer timing', 'Await imported generated visual without serializing its graph', 'Advance real game updates deterministically for staged insertion; finishMissionInsertion helper completes exit; 3 s of normal updates exercise the allocator', 'Explicit game render call for frozen capture', 'Unpause and blur previous UI control via API before real keyboard O/Escape'],
  checks: {}, errors: [], failedRequests: [], httpErrors: [], externalRequests: [],
  eventCounts: { errors: 0, failedRequests: 0, httpErrors: 0, externalRequests: 0 },
  captures: []
};
let browser, page, before, stage = 'preflight';
const check = (key, value, detail = '') => {
  report.checks[key] = Boolean(value);
  if (!value) throw Error(key + (detail ? ': ' + detail : ''));
};
const event = (key, value) => { report.eventCounts[key]++; if (report[key].length < 25) report[key].push({ stage, ...value }); };
async function tree(path) {
  const entries = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = path + '/' + entry.name;
    if (entry.isDirectory()) entries.push(...await tree(file));
    else entries.push([file.slice(root.length + 1), sha(await readFile(file))]);
  }
  return entries.sort((a,b) => a[0].localeCompare(b[0]));
}
async function progress(message) {
  console.log(JSON.stringify({ stage, message, at: new Date().toISOString() }));
  await writeFile(out + '/progress.json', JSON.stringify(report, null, 2) + '\n');
}
async function capture(name) {
  await page.screenshot({ path: out + '/' + name });
  report.captures.push({ name, sha256: sha(await readFile(out + '/' + name)) });
}
await mkdir(out, { recursive: true });
await mkdir(proof, { recursive: true });
const deadline = setTimeout(() => { report.deadlineExceeded = true; void browser?.close(); }, 7 * 60 * 1000);
try {
  before = await tree(root + '/dist');
  report.frozenDistBeforeSha256 = sha(JSON.stringify(before));
  const localIndex = await readFile(root + '/dist/index.html');
  const localInfo = await readFile(root + '/dist/build-info.json');
  report.localFrozenBuild = { indexSha256: sha(localIndex), buildInfoSha256: sha(localInfo), sourceCommit: JSON.parse(localInfo.toString('utf8')).sourceCommit };
  if (report.localFrozenBuild.indexSha256 !== expected.index || report.localFrozenBuild.buildInfoSha256 !== expected.buildInfo || report.localFrozenBuild.sourceCommit !== expected.source) throw Error('Local frozen build differs from explicit publication arguments; no browser launched.');
  stage = 'http';
  const indexResponse = await fetch(origin + '/', { signal: AbortSignal.timeout(45000) });
  const index = Buffer.from(await indexResponse.arrayBuffer());
  const infoResponse = await fetch(origin + '/build-info.json', { signal: AbortSignal.timeout(45000) });
  const info = Buffer.from(await infoResponse.arrayBuffer());
  const publicInfo = JSON.parse(info.toString('utf8'));
  report.http = { indexStatus: indexResponse.status, indexSha256: sha(index), buildInfoStatus: infoResponse.status, buildInfoSha256: sha(info), sourceCommit: publicInfo.sourceCommit, buildInfoVersion: publicInfo.version ?? null };
  check('publicIndexMatches', indexResponse.ok && sha(index) === expected.index);
  check('publicBuildInfoMatches', infoResponse.ok && sha(info) === expected.buildInfo && publicInfo.sourceCommit === expected.source);
  await progress('Public index and build-info match the explicit frozen release.');
  stage = 'browser-boot';
  const caPins = process.env.NODE_EXTRA_CA_CERTS ? [...(await readFile(process.env.NODE_EXTRA_CA_CERTS, 'utf8')).matchAll(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)].map(m => createHash('sha256').update(new X509Certificate(m[0]).publicKey.export({ type: 'spki', format: 'der' })).digest('base64')) : [];
  report.browserTlsTrust = { managedProxyCaSpkiPins: caPins, globalCertificateChecksDisabled: false, ignoreHTTPSErrors: false };
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', ...(caPins.length ? ['--ignore-certificate-errors-spki-list=' + caPins.join(',')] : [])], proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
  page = await browser.newPage({ viewport: report.viewport });
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => event('errors', { message: e.message.slice(0,2000) }));
  page.on('console', m => { if (m.type() === 'error') event('errors', { message: m.text().slice(0,2000) }); });
  page.on('requestfailed', q => event('failedRequests', { url: q.url(), failure: q.failure()?.errorText }));
  page.on('response', q => { if (q.status() >= 400) event('httpErrors', { url: q.url(), status: q.status() }); });
  page.on('request', q => { const u = new URL(q.url()); if (!['data:', 'blob:'].includes(u.protocol) && u.origin !== origin) event('externalRequests', { url: q.url() }); });
  const documentResponse = await page.goto(origin + '/', { waitUntil: 'networkidle', timeout: 180000 });
  report.browserDocument = { status: documentResponse.status(), sha256: sha(await documentResponse.body()) };
  check('browserDocumentMatches', report.browserDocument.status === 200 && report.browserDocument.sha256 === expected.index);
  await page.waitForFunction(() => Boolean(window.game), null, { timeout: 180000 });
  stage = 'menus';
  await page.locator('#btn-start-game').click();
  await page.locator('#btn-confirm-char').click();
  await page.locator('#mission-mode-select').selectOption('fronts');
  await page.locator('#operation-select').selectOption('pilot');
  await page.locator('#btn-launch-mission').click();
  await page.locator('.operation-briefing').waitFor({ state: 'visible' });
  report.briefing = await page.locator('.operation-briefing [data-summary]').textContent();
  report.fidelityDisclosure = await page.locator('#loadout-prep-screen .operation-provenance').textContent();
  check('briefingCeiling32', /Plafond de proximité : 32/.test(report.briefing));
  check('explicitFidelityLimitation', report.fidelityDisclosure.includes('aucune fidélité visuelle 1:1'));
  await progress('Real menus selected fronts/pilot and show actor ceiling 32.');
  stage = 'insertion';
  await page.locator('#btn-confirm-loadout').click({ timeout: 180000 });
  await page.waitForFunction(() => game.isPlaying && !!game.player, null, { timeout: 180000 });
  report.insertionInitial = await page.evaluate(async () => {
    const g = game; g.isPaused = true;
    const initial = { phase: g.dropPod.phase, active: g.dropPod.isActive, elapsed: g.dropPod.elapsed, visible: g.player.mesh.visible, hp: g.player.hp };
    await g.player.generatedVisualReady;
    return { ...initial, importedReady: true, visibleAfterImport: g.player.mesh.visible };
  });
  check('playerHiddenDuringArrival', report.insertionInitial.active && !report.insertionInitial.visible && !report.insertionInitial.visibleAfterImport);
  report.insertionStages = await page.evaluate(() => {
    const g = game, initiallyPaused = g.isPaused, states = [];
    try {
      g.isPaused = false;
      for (const target of [1.2, 1.8, 3.25]) {
        let steps = 0;
        while (g.dropPod.elapsed < target && g.dropPod.isActive && steps < 1000) { g.update(1/60); steps++; }
        states.push({ target, steps, phase: g.dropPod.phase, elapsed: g.dropPod.elapsed, openingProgress: g.dropPod.openingProgress, visible: g.player.mesh.visible, hp: g.player.hp });
      }
      return states;
    } finally { g.isPaused = initiallyPaused; }
  });
  check('arrivalThenOpeningThenExit', report.insertionStages[0].phase === 'settling' && !report.insertionStages[0].visible && report.insertionStages[1].phase === 'opening' && report.insertionStages[1].openingProgress > 0 && report.insertionStages[1].visible && report.insertionStages[2].phase === 'exiting' && report.insertionStages[2].visible);
  report.insertionComplete = await finishMissionInsertion(page);
  check('insertionCompletedVisible', report.insertionComplete.phase === 'complete' && report.insertionComplete.visible);
  report.firstGameplayUpdate = await page.evaluate(() => {
    const g = game; g.isPaused = false;
    try { for(let i=0;i<180;i++)g.update(1/60); return { simulatedSeconds: 3, hp: g.player.hp, operationPanelVisible: !document.getElementById('operation-panel').classList.contains('hidden'), hudCounter: document.getElementById('hud-wave-counter').textContent.trim(), frontCount: g.battleSimulation.getHUDState().fronts.length }; }
    finally { g.isPaused = true; }
  });
  check('operationHudAfterFirstNormalUpdate', report.firstGameplayUpdate.operationPanelVisible);
  check('frontsCounterSurvivesNormalUpdate', report.firstGameplayUpdate.hudCounter === `${report.firstGameplayUpdate.frontCount} FRONTS · RÉSERVES FINIES` && !/VAGUE|ZONE/.test(report.firstGameplayUpdate.hudCounter));
  report.initialState = await page.evaluate(() => {
    const g = game, s = g.battleSimulation; g.battleBridge.sync();
    g.renderer.renderer.render(g.renderer.scene, g.renderer.camera);
    const counts = s.getCounts(), info = g.renderer.renderer.info;
    return { operation: g.operationId, character: g.player.data.id, visualState: g.player.generatedVisualState, maskState: g.player.generatedBiomaskState, hp: g.player.hp, visible: g.player.mesh.visible, ceiling: s.budgets.active, active: Object.values(counts).reduce((n,c)=>n+c.active,0), actors: g.battleBridge.actors.size, unitCount: s.units.size, unitIds: [...s.units.keys()].sort(), conservation: s.assertConservation(), sectors: g.env.battlefieldLayout.sectors.length, counts, render: { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures } };
  });
  check('hp1000AfterInsertion', report.initialState.hp === 1000);
  check('ceilingAndActorCount', report.initialState.ceiling === 32 && report.initialState.active <= 32 && report.initialState.actors === report.initialState.active);
  check('nonzeroMaterializedActorLoad', report.initialState.active > 0 && report.initialState.actors > 0);
  check('finitePopulation132', report.initialState.unitCount === 132 && report.initialState.unitIds.length === new Set(report.initialState.unitIds).size && report.initialState.conservation);
  check('sixSectorMap', report.initialState.sectors === 6);
  await capture('pilot-public-game.png');
  await progress('Capsule arrival, opening/exit, HP1000, nonzero actors, finite132, cap32 and FRONTS HUD verified.');
  stage = 'command-map';
  if (!(await page.locator('#operation-panel details').evaluate(n => n.open))) await page.locator('#operation-panel summary').click();
  await page.locator('#operation-panel [data-map]').click();
  await page.locator('#command-map-modal').waitFor({ state: 'visible' });
  await page.locator('#command-map-modal [data-order]').selectOption('defend');
  await page.locator('#command-map-modal [data-send]').click();
  report.command = await page.evaluate(() => {
    const id = document.querySelector('#command-map-modal [data-groups]').value, group = game.battleSimulation.getGroup(id);
    return { groupId: id, type: group.order.type, issuer: group.order.issuer, paused: game.isPaused, feedback: document.querySelector('#command-map-modal [data-feedback]').textContent };
  });
  check('realMapClickIssuedDefend', report.command.type === 'defend' && report.command.issuer === 'player1' && report.command.paused);
  await capture('pilot-public-command-map.png');
  await page.locator('#command-map-modal [data-close]').click();
  stage = 'photo';
  await page.evaluate(() => { game.isPaused = false; document.activeElement?.blur(); });
  await page.keyboard.press('o');
  await page.locator('#photo-mode-hud').waitFor({ state: 'visible' });
  report.photoOpened = await page.evaluate(() => Boolean(game.photoMode.isActive));
  await page.keyboard.press('o');
  report.photoClosed = await page.evaluate(() => !game.photoMode.isActive);
  check('realOOpenedAndClosedPhoto', report.photoOpened && report.photoClosed);
  await page.evaluate(() => { game.isPaused = true; });
  stage = 'save-and-menu';
  await page.locator('#operation-panel [data-save]').click();
  report.checkpoint = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('yautja-operation-checkpoint-v1'));
    return { version: saved.version, operationId: saved.operationId, unitCount: saved.simulation.units.length, unitIds: saved.simulation.units.map(u=>u.id).sort() };
  });
  check('savedAllFiniteIds', report.checkpoint.version === 1 && report.checkpoint.operationId === 'pilot' && JSON.stringify(report.checkpoint.unitIds) === JSON.stringify(report.initialState.unitIds));
  report.finalState = await page.evaluate(() => {
    const g = game, s = g.battleSimulation, c = s.getCounts();
    return { hp: g.player.hp, ceiling: s.budgets.active, active: Object.values(c).reduce((n,v)=>n+v.active,0), conservation: s.assertConservation(), unitCount: s.units.size, hudCounter: document.getElementById('hud-wave-counter').textContent.trim() };
  });
  check('finalConservationAndBudget', report.finalState.conservation && report.finalState.ceiling === 32 && report.finalState.active > 0 && report.finalState.active <= 32 && report.finalState.unitCount === 132 && report.finalState.hp === report.initialState.hp && report.finalState.hudCounter === report.firstGameplayUpdate.hudCounter);
  await page.evaluate(() => { game.isPaused = false; document.activeElement?.blur(); });
  await page.keyboard.press('Escape');
  await page.locator('#pause-menu').waitFor({ state: 'visible' });
  report.realEscapePaused = await page.evaluate(() => game.isPaused);
  await page.locator('#btn-pause-menu-return').click();
  await page.locator('#main-menu').waitFor({ state: 'visible' });
  report.cleanup = await page.evaluate(() => ({ playing: game.isPlaying, playerCleared: game.player === null, bridgeCleared: game.battleBridge === null, aliens: game.horde.aliens.length, marines: game.marines.marines.length, allies: game.allies.allies.length, synthetics: game.synthetics.androids.length, bossPresent: Boolean(game.bosses.activeBoss), checkpointExists: Boolean(localStorage.getItem('yautja-operation-checkpoint-v1')) }));
  check('realEscapeAndMenuCleanup', report.realEscapePaused && !report.cleanup.playing && report.cleanup.playerCleared && report.cleanup.bridgeCleared && !report.cleanup.aliens && !report.cleanup.marines && !report.cleanup.allies && !report.cleanup.synthetics && !report.cleanup.bossPresent && report.cleanup.checkpointExists);
  check('noJsNetworkOrExternalErrors', Object.values(report.eventCounts).every(n => n === 0));
  report.status = 'passed';
  await progress('Real map order, O photo, checkpoint and Escape/menu cleanup passed.');
} catch (error) {
  report.status = 'failed'; report.failure = { stage, message: error.message, stack: error.stack?.slice(0,3500) };
  console.error(JSON.stringify(report.failure));
  if (page && !page.isClosed() && report.captures.length < 2) try { await page.screenshot({ path: out + '/failure.png', timeout: 15000 }); report.failureCapture = out + '/failure.png'; } catch {}
} finally {
  clearTimeout(deadline);
  try { await browser?.close(); report.browserClosed = true; } catch (error) { report.browserClosed = false; report.closeError = error.message; report.status = 'failed'; }
  if (before) {
    const after = await tree(root + '/dist'); report.frozenDistAfterSha256 = sha(JSON.stringify(after));
    report.checks.frozenDistUnchanged = JSON.stringify(before) === JSON.stringify(after);
    if (!report.checks.frozenDistUnchanged) report.status = 'failed';
  }
  report.endedAt = new Date().toISOString(); report.durationSeconds = (Date.parse(report.endedAt)-Date.parse(report.startedAt))/1000;
  await writeFile(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
  await copyFile(out + '/report.json', proof + '/publication-20261028.json');
  await copyFile(out + '/report.json', proof + '/attempt-' + runId + '.json');
  for (const { name } of report.captures) await copyFile(out + '/' + name, proof + '/' + name);
  console.log(JSON.stringify({ status: report.status, stage, checks: report.checks, eventCounts: report.eventCounts, browserClosed: report.browserClosed, report: proof + '/publication-20261028.json', failure: report.failure ?? null }));
  if (report.status !== 'passed') process.exitCode = 1;
}

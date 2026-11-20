// Controlled acceptance fixture. This does not certify natural victories,
// human readability, hardware performance, or visual fidelity to a film.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { LEVELS_DATA } from '../../../js/data/levelsData.js';
import { finishMissionInsertion } from '../../../tests/helpers/finish-insertion.mjs';
import { reachBattlefieldSector } from '../../../tests/helpers/complete-battlefield.mjs';

const root = resolve(import.meta.dirname, '../../..');
const options = { expectedIndex: null, expectedSource: null, output: null, levelIds: null, outcomes: ['victory', 'defeat'], port: 4318 };
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument === '--expected-index') options.expectedIndex = process.argv[++index];
  else if (argument === '--expected-source') options.expectedSource = process.argv[++index];
  else if (argument === '--output') options.output = resolve(process.argv[++index]);
  else if (argument === '--levels') options.levelIds = process.argv[++index].split(',');
  else if (argument === '--outcomes') options.outcomes = process.argv[++index].split(',');
  else if (argument === '--port') options.port = Number(process.argv[++index]);
  else throw new Error(`Unknown argument: ${argument}`);
}
assert.match(options.expectedIndex ?? '', /^[a-f0-9]{64}$/, 'ROOT must supply the frozen HTML SHA before any browser launches');
assert.ok(options.output, 'An explicit output directory is required');
if (options.expectedSource) assert.match(options.expectedSource, /^[a-f0-9]{40}$/);
assert.ok(Number.isInteger(options.port) && options.port > 1024 && options.port < 65536);
assert.ok(options.outcomes.length > 0 && new Set(options.outcomes).size === options.outcomes.length &&
  options.outcomes.every(outcome => ['victory', 'defeat'].includes(outcome)), 'Outcomes must be victory, defeat, or victory,defeat');
const chosen = options.levelIds ? options.levelIds.map(id => LEVELS_DATA.find(level => level.id === id)) : LEVELS_DATA;
assert.ok(chosen.length > 0 && chosen.every(Boolean) && (!options.levelIds || chosen.length === new Set(options.levelIds).size), 'Every requested level ID must exist');

async function hashFile(path) {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(path)) digest.update(bytes);
  return digest.digest('hex');
}
async function tree(directory, prefix = '') {
  const rows = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name), name = prefix + entry.name;
    if (entry.isDirectory()) rows.push(...await tree(path, name + '/'));
    else rows.push({ path: name, sha256: await hashFile(path) });
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}
const helperPaths = ['docs/qa/pr3-next-20261028/run-complete-contexts.mjs',
  'tests/helpers/complete-battlefield.mjs', 'tests/helpers/finish-insertion.mjs'];
const helperHashes = () => Promise.all(helperPaths.map(async path => ({ path, sha256: await hashFile(resolve(root, path)) })));

const report = {
  schemaVersion: 1, status: 'running', startedAt: new Date().toISOString(),
  scope: 'Assisted complete objective paths and controlled player defeats in the production build. UI selection, physical route helper, real manager damage/death callbacks, real boss and end-screen transitions. Not natural combat victories or human playtests.',
  intendedCriteria: ['AUD-071 positive map/boss bindings', 'AUD-115 coherent win/loss paths'],
  humanTesters: 0, fidelity1to1Verified: false, hardwarePerformanceVerified: false,
  expectedContexts: chosen.length, fullElevenContextCoverage: chosen.length === LEVELS_DATA.length,
  expectedOutcomes: options.outcomes, expectedPaths: chosen.length * options.outcomes.length,
  fullVictoryAndDefeatCoverage: chosen.length === LEVELS_DATA.length && options.outcomes.length === 2,
  inputAssistances: ['deterministic walking in existing route helper', 'measured floor correction for accelerated assisted walking, vertical snap bounded to .66',
    'large manager-applied damage to shorten encounters', ...(options.outcomes.includes('defeat') ? ['controlled player HP=0 for defeat'] : [])],
  errors: [], failedRequests: [], externalRequests: [], cases: []
};
let server, browser, context, page, before, currentCase = 'boot';
const baseURL = `http://127.0.0.1:${options.port}`;
const save = () => writeFile(resolve(options.output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
await mkdir(dirname(options.output), { recursive: true });
await mkdir(options.output); // A rerun must preserve prior evidence in its own directory.
try {
  assert.equal(await hashFile(resolve(root, 'dist/index.html')), options.expectedIndex, 'Frozen index differs from ROOT authorization');
  before = await tree(resolve(root, 'dist'));
  report.indexSha256 = options.expectedIndex;
  report.distTreeSha256 = createHash('sha256').update(JSON.stringify(before)).digest('hex');
  report.buildInfo = JSON.parse(await readFile(resolve(root, 'dist/build-info.json'), 'utf8'));
  if (options.expectedSource) assert.equal(report.buildInfo.sourceCommit, options.expectedSource);
  report.helperSourcesBefore = await helperHashes();
  for (const [index, source] of report.helperSourcesBefore.entries()) {
    source.snapshot = `helper-source-${index}.mjs`;
    await writeFile(resolve(options.output, source.snapshot), await readFile(resolve(root, source.path)), { flag: 'wx' });
  }
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(options.port), '--strictPort'], { cwd: root, stdio: 'ignore' });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(baseURL)).ok; } catch { /* Preview is starting. */ }
    if (ready) break;
    await new Promise(done => setTimeout(done, 100));
  }
  assert.ok(ready, 'Production preview must start');
  const servedIndex = await fetch(baseURL, { signal: AbortSignal.timeout(15000) });
  assert.equal(createHash('sha256').update(Buffer.from(await servedIndex.arrayBuffer())).digest('hex'), options.expectedIndex,
    'The preview port must actually serve the authorized frozen index');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push({ case: currentCase, message: error.message, stack: error.stack }));
  page.on('console', message => { if (message.type() === 'error') report.errors.push({ case: currentCase, message: message.text(), location: message.location() }); });
  page.on('requestfailed', request => report.failedRequests.push({ case: currentCase, url: request.url(), failure: request.failure() }));
  page.on('request', request => {
    const url = new URL(request.url());
    if (!['data:', 'blob:'].includes(url.protocol) && url.origin !== baseURL) report.externalRequests.push({ case: currentCase, url: request.url() });
  });
  await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForFunction(() => Boolean(window.game), null, { timeout: 180000 });

  async function start(level) {
    const index = LEVELS_DATA.findIndex(entry => entry.id === level.id);
    await page.locator('#btn-start-game').click();
    await page.locator('#btn-confirm-char').click();
    await page.selectOption('#mission-mode-select', 'hunt');
    await page.locator('.level-card').nth(index).click();
    await page.locator('#btn-launch-mission').click();
    await page.locator('#btn-confirm-loadout').click({ timeout: 180000 });
    await page.waitForFunction(() => game.isPlaying && Boolean(game.player), null, { timeout: 180000 });
    await page.evaluate(async () => {
      game.isPaused = true;
      let timer;
      try {
        await Promise.race([Promise.resolve(game.player.generatedVisualReady).then(() => true),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Player visual did not settle in 90 seconds')), 90000); })]);
      } finally { clearTimeout(timer); }
    });
    const insertion = await finishMissionInsertion(page);
    assert.equal(insertion.visible, true, 'Player appears after the real insertion');
    const state = await page.evaluate(() => ({ levelId: game.ui.selectedLevel.id, expectedBoss: game.ui.selectedLevel.bossType,
      sectors: game.env.battlefieldLayout.sectors.length, playerVisible: game.player.mesh.visible }));
    assert.equal(state.levelId, level.id); assert.equal(state.expectedBoss, level.bossType); assert.equal(state.sectors, 6);
    await page.evaluate(() => { game.isPaused = false; document.activeElement?.blur(); });
    return { insertion, state };
  }

  for (const level of chosen) {
    for (const outcome of options.outcomes) {
      currentCase = `${level.id}:${outcome}`;
      const result = { levelId: level.id, expectedBoss: level.bossType, intendedOutcome: outcome, status: 'running' };
      report.cases.push(result); await save();
      try {
        result.started = await start(level);
        if (outcome === 'victory') {
          const visited = new Set(); result.physicalStages = [];
          for (let sectorIndex = 0; sectorIndex < 6; sectorIndex++) {
            const stage = await reachBattlefieldSector(page, sectorIndex);
            stage.visited.forEach(id => visited.add(id));
            result.physicalStages.push({ requestedSectorIndex: sectorIndex, ...stage });
            result.route = { ...stage, visited: [...visited] };
            await save();
            process.stdout.write(JSON.stringify({ case: currentCase, physicalSectorIndex: sectorIndex,
              visited: stage.visited, completed: stage.completed, openGates: stage.openGates, boss: stage.boss }) + '\n');
          }
          assert.equal(result.route.visited.length, 6); assert.equal(result.route.completed.length, 5); assert.equal(result.route.openGates.length, 5);
          result.boss = await page.evaluate(() => {
            const boss = game.bosses.activeBoss;
            return { type: boss?.type ?? null, hp: boss?.hp ?? null, maxHp: boss?.maxHp ?? null,
              meshPresent: Boolean(boss?.mesh?.parent), configuredType: game.ui.selectedLevel.bossType };
          });
          assert.equal(result.boss.type, level.bossType); assert.equal(result.boss.configuredType, level.bossType);
          assert.ok(result.boss.hp > 0 && result.boss.meshPresent, 'A live rendered boss must exist before the assisted final hit');
          await page.evaluate(() => { game.bosses.takeDamage(1_000_000); game.update(1 / 120); });
        } else {
          await page.evaluate(() => { game.player.hp = 0; game.isPaused = false; game.update(1 / 120); });
        }
        await page.waitForFunction(() => !game.isPlaying, null, { timeout: 30000 });
        await page.locator('#game-over-screen').waitFor({ state: 'visible' });
        result.ended = await page.evaluate(() => ({ playing: game.isPlaying, playerCleared: game.player === null,
          title: document.getElementById('end-title').textContent, subtitle: document.getElementById('end-subtitle').textContent,
          actualBossCleared: !game.bosses.activeBoss, actors: game.horde.aliens.length,
          queues: game.horde.pendingSpawnCount, projectiles: game.projectiles.length, missionTasks: game.missionTasks.length }));
        assert.equal(result.ended.playing, false); assert.equal(result.ended.playerCleared, true);
        assert.equal(result.ended.actualBossCleared, true); assert.equal(result.ended.actors, 0); assert.equal(result.ended.queues, 0);
        assert.equal(result.ended.projectiles, 0); assert.equal(result.ended.missionTasks, 0);
        assert.match(result.ended.title, outcome === 'victory' ? /VICTOIRE/ : /CHASSE TERMINÉE/);
        assert.ok(!/players_defeated|objective_complete/.test(result.ended.subtitle), 'Public outcome text must be readable');
        await page.screenshot({ path: resolve(options.output, `${level.id}-${outcome}.png`) });
        await page.locator('#btn-menu-return').click();
        await page.locator('#main-menu').waitFor({ state: 'visible' });
        result.status = 'passed';
      } catch (error) {
        result.status = 'failed'; result.error = error.stack ?? error.message;
        try { await page.screenshot({ path: resolve(options.output, `${level.id}-${outcome}-failure.png`) }); } catch { /* Preserve original failure. */ }
        await page.reload({ waitUntil: 'networkidle', timeout: 180000 });
        await page.waitForFunction(() => Boolean(window.game), null, { timeout: 180000 });
      }
      await save();
      process.stdout.write(JSON.stringify({ case: currentCase, status: result.status, boss: result.boss?.type ?? null }) + '\n');
    }
  }
  report.status = report.cases.length === chosen.length * options.outcomes.length && report.cases.every(result => result.status === 'passed') &&
    report.errors.length === 0 && report.failedRequests.length === 0 && report.externalRequests.length === 0 ? 'passed' : 'failed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack ?? error.message;
} finally {
  await context?.close(); await browser?.close(); server?.kill('SIGTERM');
  if (report.helperSourcesBefore) {
    report.helperSourcesAfter = await helperHashes();
    report.helpersUnchanged = report.helperSourcesBefore.every((source, index) => source.sha256 === report.helperSourcesAfter[index].sha256);
    if (!report.helpersUnchanged) { report.status = 'failed'; report.error ??= 'QA helper source changed during the acceptance fixture'; }
  }
  if (before) {
    report.distUnchanged = JSON.stringify(before) === JSON.stringify(await tree(resolve(root, 'dist')));
    if (!report.distUnchanged) { report.status = 'failed'; report.error = 'Frozen production build changed during the acceptance fixture'; }
  }
  report.endedAt = new Date().toISOString(); report.durationSeconds = (Date.parse(report.endedAt) - Date.parse(report.startedAt)) / 1000;
  await save();
  process.stdout.write(JSON.stringify({ status: report.status, cases: report.cases.length, errors: report.errors.length,
    failedRequests: report.failedRequests.length, distUnchanged: report.distUnchanged }) + '\n');
}
if (report.status !== 'passed') process.exitCode = 1;

// Real browser startup/insertion with historical, partial and rejected saves.
// Run only after the coordinator has frozen and identified a production build.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { finishMissionInsertion } from '../../../tests/helpers/finish-insertion.mjs';
import { LEVELS_DATA } from '../../../js/data/levelsData.js';

const root = resolve(import.meta.dirname, '../../..');
const options = { baseURL: 'http://127.0.0.1:5199', expectedIndex: null, expectedSource: null, output: null };
for (let index = 2; index < process.argv.length; index++) {
  const name = process.argv[index], value = process.argv[++index];
  if (name === '--base-url') options.baseURL = value.replace(/\/$/, '');
  else if (name === '--expected-index') options.expectedIndex = value;
  else if (name === '--expected-source') options.expectedSource = value;
  else if (name === '--output') options.output = resolve(value);
  else throw new Error(`Unknown option: ${name}`);
}
assert.match(options.expectedIndex ?? '', /^[a-f0-9]{64}$/);
assert.match(options.expectedSource ?? '', /^[a-f0-9]{40}$/);
assert.ok(options.output, 'Every run needs a fresh evidence directory');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function tree(path, prefix = '') {
  const files = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const absolute = resolve(path, entry.name), relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await tree(absolute, `${relative}/`));
    else files.push({ path: relative, sha256: hash(await readFile(absolute)) });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
const key = 'yautja_honor_ledger_v1', trophy = 'Crâne de Prétorien — sauvegarde conservée';
const validPartial = JSON.stringify({ version: 1, earned: 900, spent: 100, trophies: [trophy], migrationNote: 'conserver' });
const cases = [
  { id: 'legacy-counter-migration', records: { yautja_total_kos: '12', yautja_forge_upgrades: '{"spentHonor":100}' }, balance: 1100, protected: false },
  { id: 'partial-version-one', records: { [key]: validPartial }, balance: 800, protected: false, preserveRaw: true },
  { id: 'future-version-preserved', records: { [key]: JSON.stringify({ version: 2, earned: 900, spent: 100, trophies: [trophy] }) }, protected: true, preserveRaw: true },
  { id: 'invalid-balance-preserved', records: { [key]: JSON.stringify({ version: 1, earned: 'invalid', spent: 100, trophies: [trophy] }) }, protected: true, preserveRaw: true },
  { id: 'malformed-operation-checkpoint', records: { [key]: validPartial, 'yautja-operation-checkpoint-v1': '{broken' }, balance: 800, protected: false, preserveRaw: true, rejectResume: true }
];
const report = { schemaVersion: 1, startedAt: new Date().toISOString(), status: 'running',
  scope: 'Five real browser boot and playable insertion paths. Preserved raw rejected honor slots, partial v1 and legacy migration, malformed-operation fallback. Not exhaustive historical-save migration or human playtesting.',
  humanTesters: 0, hardwarePerformanceVerified: false, fidelity1to1Verified: false,
  assistances: ['Real insertion advanced with game.update at 1/60 in existing helper; no combat victory or manually granted trophy'],
  indexSha256: options.expectedIndex, sourceCommit: options.expectedSource, cases: [], errors: [], failedRequests: [], externalRequests: [] };
await mkdir(options.output); // Refuse to overwrite a previous attempt.
const helperPaths = ['docs/qa/continuation-20261101/verify-save-startup.mjs', 'tests/helpers/finish-insertion.mjs'];
const helperHashes = () => Promise.all(helperPaths.map(async path => ({ path, sha256: hash(await readFile(resolve(root, path))) })));
report.helperSourcesBefore = await helperHashes();
for (let index = 0; index < helperPaths.length; index++) {
  await writeFile(resolve(options.output, `helper-source-${index}.mjs`), await readFile(resolve(root, helperPaths[index])));
}
const save = () => writeFile(resolve(options.output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
let browser, activeCase = 'boot';
const before = await tree(resolve(root, 'dist'));
try {
  assert.equal(hash(await readFile(resolve(root, 'dist/index.html'))), options.expectedIndex);
  report.buildInfo = JSON.parse(await readFile(resolve(root, 'dist/build-info.json'), 'utf8'));
  assert.equal(report.buildInfo.sourceCommit, options.expectedSource);
  const served = await fetch(options.baseURL, { signal: AbortSignal.timeout(15000) });
  assert.equal(served.status, 200); assert.equal(hash(Buffer.from(await served.arrayBuffer())), options.expectedIndex);
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  for (const fixture of cases) {
    activeCase = fixture.id;
    const result = { id: fixture.id, status: 'running' }; report.cases.push(result); await save();
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    try {
      await context.addInitScript(records => {
        localStorage.clear(); for (const [name, value] of Object.entries(records)) localStorage.setItem(name, value);
      }, fixture.records);
      const page = await context.newPage(); page.setDefaultTimeout(30000);
      page.on('pageerror', error => report.errors.push({ case: activeCase, message: error.message }));
      page.on('console', message => { if (message.type() === 'error') report.errors.push({ case: activeCase, message: message.text() }); });
      page.on('requestfailed', request => report.failedRequests.push({ case: activeCase, url: request.url(), failure: request.failure() }));
      page.on('request', request => {
        const url = new URL(request.url());
        if (!['data:', 'blob:'].includes(url.protocol) && url.origin !== new URL(options.baseURL).origin) report.externalRequests.push({ case: activeCase, url: request.url() });
      });
      await page.goto(options.baseURL, { waitUntil: 'networkidle', timeout: 180000 });
      await page.waitForFunction(() => Boolean(window.game?.forge?.honorLedger), null, { timeout: 180000 });
      result.loaded = await page.evaluate(key => ({ state: game.forge.honorLedger.getSnapshot(), raw: localStorage.getItem(key) }), key);
      assert.equal(result.loaded.state.readOnly, fixture.protected);
      if (fixture.balance !== undefined) assert.equal(result.loaded.state.balance, fixture.balance);
      if (fixture.records[key]?.includes(trophy)) assert.ok(result.loaded.state.trophies.includes(trophy));
      if (fixture.preserveRaw) assert.equal(result.loaded.raw, fixture.records[key]);
      await page.locator('#btn-start-game').click(); await page.locator('#btn-confirm-char').click();
      if (fixture.rejectResume) {
        await page.locator('#btn-resume-operation').click();
        await page.waitForFunction(() => !game.isPlaying && !game.ui.levelSelectMenu.classList.contains('hidden'));
        result.rejectedCheckpoint = await page.evaluate(() => ({ playing: game.isPlaying, raw: localStorage.getItem('yautja-operation-checkpoint-v1') }));
        assert.equal(result.rejectedCheckpoint.raw, fixture.records['yautja-operation-checkpoint-v1']);
      }
      await page.selectOption('#mission-mode-select', 'hunt');
      await page.locator('.level-card').nth(LEVELS_DATA.findIndex(level => level.id === 'val_verde_jungle')).click();
      await page.locator('#btn-launch-mission').click(); await page.locator('#btn-confirm-loadout').click({ timeout: 180000 });
      await page.waitForFunction(() => game.isPlaying && Boolean(game.player), null, { timeout: 180000 });
      await page.evaluate(async () => {
        game.isPaused = true; let timer;
        try {
          await Promise.race([Promise.resolve(game.player.generatedVisualReady), new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Imported player visual did not settle')), 90000);
          })]);
        } finally { clearTimeout(timer); }
      });
      result.insertion = await finishMissionInsertion(page);
      assert.equal(result.insertion.visible, true);
      result.active = await page.evaluate(key => ({ hp: game.player.hp, isPlaying: game.isPlaying, visible: game.player.mesh.visible,
        readOnly: game.forge.honorLedger.getSnapshot().readOnly, raw: localStorage.getItem(key) }), key);
      assert.ok(result.active.isPlaying && result.active.visible && result.active.hp > 0);
      if (fixture.preserveRaw) assert.equal(result.active.raw, fixture.records[key]);
      await page.screenshot({ path: resolve(options.output, `${fixture.id}.png`) });
      result.status = 'passed';
    } catch (error) { result.status = 'failed'; result.error = error.stack; }
    finally { await context.close(); await save(); }
  }
  report.status = report.cases.every(item => item.status === 'passed') && !report.errors.length && !report.failedRequests.length && !report.externalRequests.length ? 'passed' : 'failed';
} catch (error) { report.status = 'failed'; report.error = error.stack; }
finally {
  await browser?.close(); report.finishedAt = new Date().toISOString();
  report.helperSourcesAfter = await helperHashes();
  report.helpersUnchanged = JSON.stringify(report.helperSourcesBefore) === JSON.stringify(report.helperSourcesAfter);
  report.distUnchanged = JSON.stringify(before) === JSON.stringify(await tree(resolve(root, 'dist')));
  if (!report.distUnchanged || !report.helpersUnchanged) report.status = 'failed';
  await save();
  const manifest = await tree(options.output);
  await writeFile(resolve(options.output, 'manifest.json'), `${JSON.stringify({ schemaVersion: 1, files: manifest }, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, passed: report.cases.filter(item => item.status === 'passed').length, cases: report.cases.length, errors: report.errors.length, distUnchanged: report.distUnchanged }));
  if (report.status !== 'passed') process.exitCode = 1;
}

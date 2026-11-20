// ROOT grants the sole Chromium slot. This captures real scenes, not hardware FPS.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { LEVELS_DATA } from '../../../js/data/levelsData.js';
import { finishMissionInsertion } from '../../../tests/helpers/finish-insertion.mjs';

const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root-browser-go') options.go = true;
  else { assert.ok(['--root', '--port', '--source', '--output'].includes(args[i])); options[args[i].slice(2)] = args[++i]; }
}
assert.equal(options.go, true); assert.match(options.source ?? '', /^[a-f0-9]{40}$/);
const root = resolve(options.root), out = resolve(options.output), port = Number(options.port);
assert.ok(Number.isInteger(port) && port >= 4300 && port < 4400);
const base = `http://127.0.0.1:${port}`, sha = b => createHash('sha256').update(b).digest('hex');
async function tree(path, prefix = '') {
  const rows = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    const rel = prefix + item.name, full = resolve(path, item.name);
    if (item.isDirectory()) rows.push(...await tree(full, rel + '/'));
    else rows.push({ path: rel, sha256: sha(await readFile(full)) });
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}
await mkdir(out);
const report = { status: 'running', startedAt: new Date().toISOString(), sourceCommit: options.source,
  humanTesters: 0, fidelity1to1Verified: false, hardwarePerformanceMeasured: false,
  scope: 'Val Verde fronts/pilot insertion and scene inspection; real menus, imported player, actual world geometry and two rendered camera views. No natural victory or all-map fidelity claim.',
  assistances: ['Insertion advanced by actual game.update at 1/60', 'Simulation paused for comparable inspection', 'Second capture uses an explicit inspection camera; first capture retains the actual gameplay camera'],
  errors: [], failedRequests: [], externalRequests: [] };
const before = await tree(resolve(root, 'dist')); report.distBefore = before;
report.buildInfo = JSON.parse(await readFile(resolve(root, 'dist/build-info.json'), 'utf8'));
assert.equal(report.buildInfo.sourceCommit, options.source); assert.equal(report.buildInfo.sourceTreeDirty, false);
report.harnessSha256 = sha(await readFile(import.meta.filename));
let server, browser;
const save = () => writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
try {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { ready = (await fetch(base)).ok; } catch {} if (ready) break; await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready);
  const response = await fetch(base); assert.equal(sha(Buffer.from(await response.arrayBuffer())), before.find(f => f.path === 'index.html').sha256);
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }); page.setDefaultTimeout(30000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('requestfailed', q => report.failedRequests.push({ url: q.url(), error: q.failure()?.errorText }));
  page.on('request', q => { const u = new URL(q.url()); if (/^https?:$/.test(u.protocol) && u.origin !== base) report.externalRequests.push(q.url()); });
  await page.goto(base, { waitUntil: 'networkidle' }); await page.waitForFunction(() => !!window.game);
  await page.locator('#btn-start-game').click(); await page.locator('#btn-confirm-char').click();
  await page.selectOption('#mission-mode-select', 'fronts');
  await page.locator('.level-card').nth(LEVELS_DATA.findIndex(l => l.id === 'val_verde_jungle')).click();
  await page.selectOption('#operation-select', 'pilot'); await page.selectOption('#operation-layout-select', '1');
  await page.locator('#btn-launch-mission').click(); await page.locator('#btn-confirm-loadout').click();
  await page.waitForFunction(() => game.isPlaying && !!game.player);
  await page.evaluate(async () => { game.isPaused = true; await game.player.generatedVisualReady; });
  report.insertion = await finishMissionInsertion(page);
  report.scene = await page.evaluate(() => {
    const g = game; g.isPaused = true; const marks = [], canopy = [], cones = [];
    g.renderer.scene.updateMatrixWorld(true);
    g.renderer.scene.traverse(o => {
      if (o.geometry?.type === 'ConeGeometry') cones.push({ name: o.name, position: o.position.toArray(), height: o.geometry.parameters?.height, opacity: o.material?.opacity });
      if (/canopy|bough/i.test(o.name)) canopy.push({ name: o.name, position: o.position.toArray(), geometry: o.geometry?.type });
      if (o.name !== 'battlefield-wayfinding-floor') return;
      const p = o.geometry.attributes.position; const near = [];
      for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 25 && Math.abs(p.getZ(i)) < 25) near.push(p.getY(i));
      marks.push({ vertices: p.count, insertionVertices: near.length, insertionHeightMin: Math.min(...near), insertionHeightMax: Math.max(...near), insertionVerticesAboveOne: near.filter(y => y > 1).length, cues: o.userData.physicalRouteCues });
    });
    g.renderer.render();
    return { levelId: g.ui.selectedLevel.id, seed: g.operationMapSeed, player: { position: g.player.position.toArray(), hp: g.player.hp, visible: g.player.mesh.visible },
      weather: { type: g.weather.weatherType, vents: g.weather.steamVents.length, ventGeometry: g.weather.steamVents.slice(0, 5).map(v => ({ keys: Object.keys(v), position: v.position?.toArray?.(), meshType: v.mesh?.geometry?.type })) },
      camera: { position: g.renderer.camera.position.toArray(), quaternion: g.renderer.camera.quaternion.toArray() }, marks, canopy: canopy.slice(0, 50), cones: cones.slice(0, 30),
      finite: { allocated: g.battleSimulation.initialAllocated, units: g.battleSimulation.units.size, conserved: g.battleSimulation.assertConservation() } };
  });
  await page.screenshot({ path: resolve(out, 'actual-gameplay-camera.png') });
  report.inspectionCamera = await page.evaluate(() => { const r = game.renderer; r.camera.position.set(16, 14, 20); r.camera.lookAt(0, 2, 4); r.camera.updateMatrixWorld(true); r.render(); return { position: r.camera.position.toArray(), quaternion: r.camera.quaternion.toArray() }; });
  await page.screenshot({ path: resolve(out, 'fixed-inspection-camera.png') });
  assert.equal(report.scene.player.hp, 1000); assert.equal(report.scene.player.visible, true); assert.equal(report.scene.finite.conserved, true);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.failedRequests, []); assert.deepEqual(report.externalRequests, []);
  report.status = 'captured';
} catch (e) { report.status = 'failed'; report.error = e.stack; process.exitCode = 1; }
finally {
  await browser?.close(); server?.kill('SIGTERM'); report.distUnchanged = JSON.stringify(before) === JSON.stringify(await tree(resolve(root, 'dist')));
  if (!report.distUnchanged) { report.status = 'failed'; process.exitCode = 1; }
  report.finishedAt = new Date().toISOString(); await save();
  console.log(JSON.stringify({ status: report.status, steamVents: report.scene?.weather.vents, markings: report.scene?.marks.map(m => ({ min: m.insertionHeightMin, max: m.insertionHeightMax, aboveOne: m.insertionVerticesAboveOne })), errors: report.errors.length, distUnchanged: report.distUnchanged }));
}

// Exclusive, local, reproducible browser inspection; never imported by the game.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2), opt = {};
const usage = 'node capture-fidelity.mjs --source-root ABS --base-url http://127.0.0.1:4350 --studio-url http://127.0.0.1:4351 --expected-source SHA40 --expected-index SHA64 --expected-build-info SHA64 --expected-fingerprint SHA64 --mode baseline|after --output /workspace/qa/fidelity-20261109/NEW_RUN --root-browser-go';
if (args.length === 1 && args[0] === '--help') { console.log(usage); process.exit(0); }
const values = ['--source-root', '--base-url', '--studio-url', '--expected-source', '--expected-index', '--expected-build-info', '--expected-fingerprint', '--mode', '--output'];
for (let i = 0; i < args.length; i++) {
  const flag = args[i]; assert.ok(!opt[flag], 'Duplicate ' + flag);
  if (['--root-browser-go', '--check-config'].includes(flag)) opt[flag] = true;
  else { assert.ok(values.includes(flag) && args[i + 1] && !args[i + 1].startsWith('--'), 'Invalid option ' + flag); opt[flag] = args[++i]; }
}
const root = resolve(opt['--source-root'] ?? ''), output = resolve(opt['--output'] ?? '');
assert.ok(['/workspace/Yautja-continue-20261109', '/workspace/Yautja-fidelity-20261109'].includes(root));
assert.ok(output.startsWith('/workspace/qa/fidelity-20261109/') && !output.endsWith('/references'));
assert.ok(['baseline', 'after'].includes(opt['--mode']));
assert.match(opt['--expected-source'] ?? '', /^[a-f0-9]{40}$/);
for (const name of ['--expected-index', '--expected-build-info', '--expected-fingerprint']) assert.match(opt[name] ?? '', /^[a-f0-9]{64}$/);
const local = name => { const url = new URL(opt[name]); assert.equal(url.protocol, 'http:'); assert.equal(url.hostname, '127.0.0.1'); assert.ok(url.port && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/'); return url.origin; };
const base = local('--base-url'), studio = local('--studio-url'); assert.notEqual(base, studio);
if (opt['--check-config']) { console.log(JSON.stringify({ status: 'configuration_only', root, output, base, studio, browserLaunched: false, networkAccessed: false, filesWritten: false })); process.exit(0); }
assert.equal(opt['--root-browser-go'], true, 'The coordinator must grant exclusive Chromium first');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function tree(directory, prefix = '') { const rows = []; for (const entry of await readdir(directory, { withFileTypes: true })) {
  const path = resolve(directory, entry.name), name = prefix + entry.name;
  if (entry.isDirectory()) rows.push(...await tree(path, name + '/')); else rows.push({ path: name, sha256: sha(await readFile(path)) });
} return rows.sort((a, b) => a.path.localeCompare(b.path)); }
const frozenBefore = await tree(resolve(root, 'dist'));
assert.equal(frozenBefore.find(x => x.path === 'index.html')?.sha256, opt['--expected-index']);
assert.equal(frozenBefore.find(x => x.path === 'build-info.json')?.sha256, opt['--expected-build-info']);
const buildInfo = JSON.parse(await readFile(resolve(root, 'dist/build-info.json'), 'utf8'));
assert.equal(buildInfo.sourceCommit, opt['--expected-source']);
const fetchBytes = async url => { const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) }); assert.equal(response.status, 200, url); return Buffer.from(await response.arrayBuffer()); };
assert.equal(sha(await fetchBytes(base + '/')), opt['--expected-index']);
assert.equal(sha(await fetchBytes(base + '/build-info.json')), opt['--expected-build-info']);
const studioBefore = JSON.parse(await fetchBytes(studio + '/__fidelity_meta'));
assert.equal(studioBefore.source.sha256, opt['--expected-fingerprint']); assert.equal(studioBefore.sourceRoot, root);
const report = { schemaVersion: 1, mode: opt['--mode'], status: 'running', startedAt: new Date().toISOString(), sourceRoot: root,
  sourceFingerprint: opt['--expected-fingerprint'], sourceBuildCommit: opt['--expected-source'], buildInfo, studioBefore,
  indexSha256: opt['--expected-index'], buildInfoSha256: opt['--expected-build-info'], nodeVersion: process.version,
  humanTesters: 0, fidelity1to1Verified: false, hardwarePerformanceMeasured: false,
  scope: 'Controlled asset studio plus real Val Verde cooperative pilot insertion and three seconds of actual gameplay. Screenshots record the tested source/build; no human review, source-film accuracy certification, natural victory, exhaustive combat or hardware FPS claim.',
  assistances: ['Global gameplay is paused between ordinary DOM menu actions; the actual Game.update advances at 1/60 for repeatable insertion stages and three seconds after insertion.',
    'Both genuine game cameras and world geometry remain unchanged. No actor, HP, strategic time, capsule phase, save data, resource, collision or world visibility assignment is used.',
    'A separate Three r160 Raycaster imported from the local source studio observes visible actual meshes along camera-to-head/chest/feet lines; actor meshes are excluded as self intersections. Collider traces and visible-mesh raycasts are reported separately.',
    'The separate asset studio loads actual source factories into fixed neutral light, camera, exposure and framing. It is an inspection scene, not a gameplay or hardware-performance benchmark.'],
  errors: [], failedRequests: [], httpErrors: [], externalRequests: [], screenshots: [], studio: [], gameplay: {} };
await mkdir(output);
const save = () => writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const helperDirectory = dirname(fileURLToPath(import.meta.url));
for (const [i, path] of [fileURLToPath(import.meta.url), resolve(helperDirectory, 'studio-scene.mjs'), resolve(helperDirectory, 'serve-fidelity-studio.mjs'), resolve(root, 'tests/helpers/finish-insertion.mjs')].entries()) {
  const bytes = await readFile(path); (report.helperSources ??= []).push({ path, sha256: sha(bytes), snapshot: `helper-source-${i}.mjs` }); await writeFile(resolve(output, `helper-source-${i}.mjs`), bytes);
}
await save();
let browser, context, page, stage = 'boot';
const watch = page => {
  page.on('pageerror', e => report.errors.push({ stage, message: e.message }));
  page.on('console', msg => { if (msg.type() === 'error') report.errors.push({ stage, message: msg.text() }); });
  page.on('requestfailed', req => report.failedRequests.push({ stage, url: req.url(), failure: req.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) report.httpErrors.push({ stage, status: response.status(), url: response.url() }); });
  page.on('request', req => { const url = new URL(req.url()); if (/^https?:$/.test(url.protocol) && ![base, studio].includes(url.origin)) report.externalRequests.push({ stage, url: req.url() }); });
};
const capture = async name => { const path = name + '.png'; await page.screenshot({ path: resolve(output, path), animations: 'disabled', timeout: 30000 }); const row = { stage, path, sha256: sha(await readFile(resolve(output, path))) }; report.screenshots.push(row); await save(); return row; };
const progress = message => console.log(JSON.stringify({ stage, message, at: new Date().toISOString() }));
try {
  const { chromium } = await import(pathToFileURL(resolve(root, 'node_modules/playwright/index.mjs')).href);
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] }); report.browserVersion = browser.version();
  stage = 'studio'; context = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 }); page = await context.newPage(); watch(page); page.setDefaultTimeout(30000);
  await page.goto(studio + '/__fidelity_studio', { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForFunction(() => window.__fidelityStudio?.ready, null, { timeout: 180000 });
  report.studioTechnicalFrame = await page.evaluate(() => ({ ...__fidelityStudio.technicalFrame, viewport: __fidelityStudio.viewport, renderer: __fidelityStudio.renderer }));
  for (const [kind, view, opening] of [['honor-guard', 'front', 0], ['honor-guard', 'quarter', 0], ['honor-guard-alt', 'quarter', 0], ['marine:marine', 'front', 0], ['marine:marine', 'quarter', 0], ['synthetic', 'quarter', 0], ['capsule', 'front', 0], ['capsule', 'quarter', 0], ['capsule', 'front', 1], ['capsule', 'quarter', 1]]) {
    const row = await page.evaluate(({ kind, view, opening }) => __fidelityStudio.render(kind, view, opening), { kind, view, opening });
    assert.equal(row.model.malformed, 0); row.capture = await capture('studio-' + kind.replace(':', '-') + '-' + view + (kind === 'capsule' ? '-opening' + opening : '')); report.studio.push(row); progress(kind + ' ' + view);
  }
  for (const method of ['roleSheet', 'surfaceSheet']) { const row = await page.evaluate(method => __fidelityStudio[method](), method); row.capture = await capture('studio-' + method); report.studio.push(row); }
  report.woodSurface = await page.evaluate(() => __fidelityStudio.optionalWood());
  if (report.woodSurface.available) report.woodSurface.capture = await capture('studio-wood-new-surface');
  await context.close(); context = null; page = null; progress('Controlled asset captures complete');
  stage = 'gameplay'; context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); page = await context.newPage(); watch(page); page.setDefaultTimeout(30000);
  await page.goto(base, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForFunction(() => !!window.game);
  report.gameplay.raycasterEngine = await page.evaluate(async url => { const module = await import(url); window.__fidelityRaycaster = new module.Raycaster(); return module.REVISION; }, studio + '/node_modules/.vite/deps/three.js');
  assert.equal(report.gameplay.raycasterEngine, '160');
  await page.locator('#btn-open-coop').click(); await page.locator('#btn-confirm-char').click();
  await page.locator('#mission-mode-select').selectOption('fronts'); await page.locator('#operation-select').selectOption('pilot');
  await page.locator('.level-card[data-level-id="val_verde_jungle"]').click();
  await page.locator('#operation-layout-select').selectOption('1'); await page.locator('#operation-difficulty-select').selectOption('standard');
  await page.locator('#btn-launch-mission').click(); await page.locator('#btn-confirm-loadout').click({ timeout: 180000 });
  await page.waitForFunction(() => game.isPlaying && !!game.player && !!game.player2, null, { timeout: 180000 });
  report.gameplay.initial = await page.evaluate(async () => { const g = game; g.isPaused = true;
    const before = [g.player, g.player2].map(p => ({ visible: p.mesh.visible, hp: p.hp, position: p.position.toArray() }));
    await Promise.all([g.player.generatedVisualReady, g.player2.generatedVisualReady]);
    return { before, after: [g.player, g.player2].map(p => ({ visible: p.mesh.visible, hp: p.hp, position: p.position.toArray(), visual: p.generatedVisualState })),
      phase: g.dropPod.phase, elapsed: g.dropPod.elapsed, active: g.dropPod.isActive, level: g.ui.selectedLevel.id, seed: g.operationMapSeed, coop: g.isCoOp, splitScreen: g.renderer.isSplitScreen };
  });
  assert.equal(report.gameplay.initial.level, 'val_verde_jungle'); assert.equal(report.gameplay.initial.seed, 1);
  assert.ok(report.gameplay.initial.active && report.gameplay.initial.before.every(p => !p.visible) && report.gameplay.initial.after.every(p => !p.visible));
  const observe = async target => page.evaluate(target => { const g = game; let ticks = 0;
    if (target !== null) try { g.isPaused = false; while (g.dropPod.isActive && g.dropPod.elapsed < target && ticks < 1000) { g.update(1 / 60); ticks++; } } finally { g.isPaused = true; }
    const players = [g.player, g.player2], cameras = [g.renderer.camera, g.renderer.cameraP2];
    const cameraRows = cameras.map((camera, index) => { const focus = g._insertionCameraFocus[index] ?? players[index].position.clone().add({ x: 0, y: 2, z: 0 });
      const h = camera.near * Math.tan(camera.fov * Math.PI / 360) / (camera.zoom ?? 1), radius = Math.min(1.2, Math.max(.25, Math.hypot(h, h * camera.aspect)));
      const canopy = g.env.colliders.filter(c => c.owner?.startsWith('val-verde-canopy-') && c.isCollisionActive?.());
      const all = g.env.traceSegment(focus, camera.position, { radius });
      const canopyHits = canopy.map(c => ({ owner: c.owner, hit: c.traceSegment(focus, camera.position, { radius }) })).filter(row => row.hit).map(row => ({ owner: row.owner, t: row.hit.t }));
      const bodySightlines = [0.2, 1.8, 3.6].map(y => { const p = players[index].position.clone().add({ x: 0, y, z: 0 }), hit = g.env.traceSegment(p, camera.position, { radius: .05 }), screen = p.clone().project(camera); return { height: y, screen: screen.toArray(), physicalHit: hit ? { owner: hit.collider?.owner, t: hit.t } : null }; });
      return { player: index + 1, focus: focus.toArray(), position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), near: camera.near, fov: camera.fov, aspect: camera.aspect, radius, canopyOwners: canopy.map(c => c.owner), canopyHits, allPhysicalHit: all ? { owner: all.collider?.owner, t: all.t } : null, bodySightlines };
    });
    const beforeRender = cameras.map(c => c.position.toArray()); g.renderer.render();
    const visible = object => { for (let p = object; p; p = p.parent) if (!p.visible) return false; return true; };
    const belongsToPlayer = object => { for (let p = object; p; p = p.parent) if (players.some(player => p === player.mesh)) return true; return false; };
    const ray = window.__fidelityRaycaster;
    for (const [index, camera] of cameras.entries()) for (const line of cameraRows[index].bodySightlines) {
      const target = players[index].position.clone().add({ x: 0, y: line.height, z: 0 }), direction = target.clone().sub(camera.position), length = direction.length();
      ray.set(camera.position, direction.divideScalar(length)); ray.near = camera.near; ray.far = Math.max(camera.near, length - .1);
      line.visibleMeshHits = ray.intersectObjects(g.renderer.scene.children, true).filter(hit => visible(hit.object) && !belongsToPlayer(hit.object)).slice(0, 8).map(hit => {
        const chain = []; for (let object = hit.object; object && chain.length < 5; object = object.parent) chain.push(object.name || object.type);
        return { distance: hit.distance, point: hit.point.toArray(), object: hit.object.name || hit.object.type, ancestry: chain, material: Array.isArray(hit.object.material) ? hit.object.material.map(m => m.name) : hit.object.material.name };
      });
    }
    const s = g.battleSimulation, counts = s.getCounts(); let worldMeshes = 0, worldTriangles = 0;
    g.renderer.scene.traverse(o => { if (o.isMesh) { worldMeshes++; worldTriangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position')?.count ?? 0) / 3 * (o.isInstancedMesh ? o.count : 1); } });
    return { target, ticks, phase: g.dropPod.phase, elapsed: g.dropPod.elapsed, openingProgress: g.dropPod.openingProgress,
      players: players.map(p => ({ hp: p.hp, visible: p.mesh.visible, position: p.position.toArray() })), cameras: cameraRows, beforeRender, afterRender: cameras.map(c => c.position.toArray()),
      finite: { operation: g.operationId, ids: [...s.units.keys()].sort(), allocated: s.initialAllocated, actors: g.battleBridge.actors.size, active: Object.values(counts).reduce((sum, row) => sum + row.active, 0), cap: s.budgets.active, conserved: s.assertConservation(), time: s.time, digest: s.digest },
      renderer: { memory: { ...g.renderer.renderer.info.memory }, render: { ...g.renderer.renderer.info.render }, worldMeshes, worldTriangles }, quality: g.renderer.getQualityInfo() };
  }, target);
  report.gameplay.stages = [];
  for (const [target, phase] of [[1.8, 'opening'], [3.25, 'exiting']]) { const row = await observe(target); assert.equal(row.phase, phase); assert.deepEqual(row.beforeRender, row.afterRender); assert.ok(row.players.every(p => p.hp > 0 && p.visible)); row.capture = await capture('val-verde-real-coop-' + phase); report.gameplay.stages.push(row); progress(phase); }
  const { finishMissionInsertion } = await import(pathToFileURL(resolve(root, 'tests/helpers/finish-insertion.mjs')).href); report.gameplay.insertionComplete = await finishMissionInsertion(page);
  report.gameplay.threeSecondTicks = await page.evaluate(() => { const g = game; try { g.isPaused = false; for (let i = 0; i < 180; i++) g.update(1 / 60); } finally { g.isPaused = true; } return 180; });
  const row = await observe(null); assert.equal(row.phase, 'complete'); assert.deepEqual(row.beforeRender, row.afterRender); assert.ok(row.players.every(p => p.hp > 0 && p.visible));
  assert.ok(row.finite.actors > 0 && row.finite.active === row.finite.actors && row.finite.active <= 32 && row.finite.cap === 32 && row.finite.conserved && row.finite.ids.length === row.finite.allocated);
  row.capture = await capture('val-verde-real-coop-after3s'); report.gameplay.after3s = row;
  for (const item of report.gameplay.stages) assert.deepEqual(item.finite.ids, row.finite.ids, 'Finite UID set is conserved across the sequence');
  await page.evaluate(() => { game.isPaused = false; document.activeElement?.blur(); }); await page.keyboard.press('Escape'); await page.locator('#pause-menu').waitFor({ state: 'visible' });
  await page.locator('#btn-pause-menu-return').click(); await page.locator('#main-menu').waitFor({ state: 'visible' });
  report.gameplay.cleanup = await page.evaluate(() => ({ playing: game.isPlaying, playerCleared: game.player === null, simulationCleared: game.battleSimulation === null, bridgeCleared: game.battleBridge === null, aliens: game.horde.aliens.length, memory: { ...game.renderer.renderer.info.memory } }));
  assert.deepEqual({ ...report.gameplay.cleanup, memory: undefined }, { playing: false, playerCleared: true, simulationCleared: true, bridgeCleared: true, aliens: 0, memory: undefined });
  assert.equal(report.errors.length, 0); assert.equal(report.failedRequests.length, 0); assert.equal(report.httpErrors.length, 0); assert.equal(report.externalRequests.length, 0);
  report.studioAfter = JSON.parse(await fetchBytes(studio + '/__fidelity_meta')); assert.deepEqual(report.studioBefore, report.studioAfter, 'Inspected source and fixture remain frozen');
  assert.deepEqual(await tree(resolve(root, 'dist')), frozenBefore, 'Production build remains frozen'); report.frozenBuildUnchanged = true; report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = { stage, message: error.message, stack: error.stack }; if (page && !page.isClosed()) try { await capture('failure'); } catch {} }
finally { await context?.close(); await browser?.close(); report.finishedAt = new Date().toISOString(); await save();
  await writeFile(resolve(output, 'evidence-manifest.json'), JSON.stringify(await tree(output), null, 2) + '\n'); console.log(JSON.stringify({ status: report.status, output, screenshots: report.screenshots.length, failure: report.failure?.message })); }
if (report.status !== 'passed') process.exitCode = 1;

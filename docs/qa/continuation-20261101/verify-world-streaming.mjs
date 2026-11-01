// Rendered, collision-respecting assisted traversal. Battle time stays paused
// during sampling; observed SwiftShader wall times are not hardware FPS claims.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { LEVELS_DATA } from '../../../js/data/levelsData.js';
import { finishMissionInsertion } from '../../../tests/helpers/finish-insertion.mjs';
import { reachBattlefieldSector } from '../../../tests/helpers/complete-battlefield.mjs';

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
await mkdir(options.output); // Never overwrite a failed or earlier attempt.
const helperPaths = ['docs/qa/continuation-20261101/verify-world-streaming.mjs',
  'tests/helpers/finish-insertion.mjs', 'tests/helpers/complete-battlefield.mjs'];
const helperHashes = () => Promise.all(helperPaths.map(async path => ({ path, sha256: hash(await readFile(resolve(root, path))) })));
for (let index = 0; index < helperPaths.length; index++) {
  await writeFile(resolve(options.output, `helper-source-${index}.mjs`), await readFile(resolve(root, helperPaths[index])));
}
const report = { schemaVersion: 1, status: 'running', startedAt: new Date().toISOString(), criterion: 'AUD-112',
  scope: 'Antarctic hunt: earned objectives and destroyed real blast-door panels; rendered physical travel through insertion, approach and relay then return. Same scene, CPU geometry templates and destruction state. Not natural combat, hardware profiling or all-map streaming certification.',
  sourceCommit: options.expectedSource, indexSha256: options.expectedIndex,
  humanTesters: 0, fidelity1to1Verified: false, hardwarePerformanceVerified: false, gpuTimeAvailable: false,
  assistances: ['Existing helper shortens actual encounters and walks physical gates to earn sectors 0 and 1 before sampling.',
    'Real blast-door damage method receives its exact remaining HP at its registered contact point; no projectile-input claim.',
    'Battle time is paused during measured traversal. Player advances up to four collision-resolved .7-unit steps per rendered animation frame.',
    'Camera is placed at an observation offset for the probe. Camera behavior and combat difficulty are not assessed.',
    'A far point within relay forces actual insertion-floor GPU-buffer eviction; merely visiting three nearby centers would not.'],
  errors: [], failedRequests: [], externalRequests: [], stages: [] };
report.helperSourcesBefore = await helperHashes();
const save = () => writeFile(resolve(options.output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
let browser, context, page;
const before = await tree(resolve(root, 'dist'));
try {
  assert.equal(hash(await readFile(resolve(root, 'dist/index.html'))), options.expectedIndex);
  report.buildInfo = JSON.parse(await readFile(resolve(root, 'dist/build-info.json'), 'utf8'));
  assert.equal(report.buildInfo.sourceCommit, options.expectedSource);
  const served = await fetch(options.baseURL, { signal: AbortSignal.timeout(15000) });
  assert.equal(served.status, 200); assert.equal(hash(Buffer.from(await served.arrayBuffer())), options.expectedIndex);
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  context = await browser.newContext({ viewport: { width: 960, height: 720 } });
  page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push({ message: error.message, stack: error.stack }));
  page.on('console', message => { if (message.type() === 'error') report.errors.push({ message: message.text() }); });
  page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), failure: request.failure() }));
  page.on('request', request => {
    const url = new URL(request.url());
    if (!['data:', 'blob:'].includes(url.protocol) && url.origin !== new URL(options.baseURL).origin) report.externalRequests.push({ url: request.url() });
  });
  await page.goto(options.baseURL, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForFunction(() => Boolean(window.game), null, { timeout: 180000 });
  await page.locator('#btn-start-game').click(); await page.locator('#btn-confirm-char').click();
  await page.selectOption('#mission-mode-select', 'hunt');
  await page.locator('.level-card').nth(LEVELS_DATA.findIndex(level => level.id === 'antarctic_pyramid')).click();
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
  report.insertion = await finishMissionInsertion(page); assert.equal(report.insertion.visible, true);
  report.damagePreparation = await page.evaluate(() => {
    const g = game, door = g.env.blastDoors[0];
    if (!door || door.isDestroyed || !(door.hp > 0)) throw new Error('Expected an intact, actually built blast door');
    const before = { hp: door.hp, leftVisible: door.doorL.visible, rightVisible: door.doorR.visible };
    const destroyed = g.env.checkBlastDoorHits(door.pos, .1, door.hp, g.audio, g.particles);
    if (!destroyed || !door.isDestroyed || door.hp !== 0 || door.doorL.visible || door.doorR.visible) throw new Error('Real blast-door damage did not destroy both panels');
    window.__qaStreamDoor = door;
    return { before, after: { hp: door.hp, isDestroyed: door.isDestroyed, leftVisible: door.doorL.visible, rightVisible: door.doorR.visible }, position: door.pos.toArray() };
  });
  await page.evaluate(() => { game.isPaused = false; });
  report.objectivePreparation = await reachBattlefieldSector(page, 2);
  await page.evaluate(() => { game.isPaused = true; });
  report.initial = await page.evaluate(() => {
    const g = game, stream = g.env.worldStreaming;
    if (!stream) throw new Error('World streaming is not owned by the actual environment');
    const floorZone = stream.zones.find(zone => zone.id === 'insertion-floor');
    const floorRecord = floorZone && stream.geometries.get(floorZone.root.geometry);
    if (!floorRecord || floorRecord.global) throw new Error('Expected a streamable insertion floor');
    const snapshot = () => ({ completed: [...g.battlefieldProgression.completedSectorIds], openGates: [...g.battlefieldProgression.openGateIds],
      completedWorldSectors: [...g.env.completedSectors], door: { hp: window.__qaStreamDoor.hp, destroyed: window.__qaStreamDoor.isDestroyed,
        leftVisible: window.__qaStreamDoor.doorL.visible, rightVisible: window.__qaStreamDoor.doorR.visible } });
    const probe = window.__qaStreamProbe = { snapshot, baseline: snapshot(), floorRecord, samples: [],
      geometryRecords: [...stream.geometries].map(([geometry]) => ({ geometry, positions: geometry.attributes.position?.array })),
      evictions: stream.evictions, restorations: stream.restorations, lastFrameAt: null };
    const sector = g.env.battlefieldLayout.sectors[2], insertion = g.env.battlefieldLayout.sectors[0];
    const far = [sector.center[0] + Math.sign(sector.center[0] - insertion.center[0] || 1) * 43,
      sector.center[1] + Math.sign(sector.center[1] - insertion.center[1] || 1) * 43];
    if (far[0] < sector.bounds.minX + 2 || far[0] > sector.bounds.maxX - 2 || far[1] < sector.bounds.minZ + 2 || far[1] > sector.bounds.maxZ - 2) throw new Error('Eviction point must remain inside relay');
    return { state: probe.baseline, stats: stream.getStats(), insertionFloorResident: floorRecord.resident,
      sectors: g.env.battlefieldLayout.sectors.slice(0, 3).map(sector => ({ id: sector.id, center: sector.center, bounds: sector.bounds })),
      // The insertion center remains occupied by the real pod shell. Use the
      // clear front-side apron; never disable the cabin collision to return.
      returnInsertionPoint: g.dropPod.pods.length ? [Math.min(...g.dropPod.pods.map(pod => pod.targetPosition.x)) - 7,
        Math.max(...g.dropPod.pods.map(pod => pod.targetPosition.z)) + 6] : [...insertion.center],
      relayFarPoint: far, rendering: g.renderer.getQualityInfo(), playerPosition: g.player.position.toArray() };
  });
  assert.deepEqual(report.initial.state.completed.slice(0, 2), ['insertion', 'approach']);

  async function walk(label, target) {
    const stage = { label, target, status: 'running' }; report.stages.push(stage); await save();
    Object.assign(stage, await page.evaluate(async ({ label, target }) => {
      const g = game, p = g.player, env = g.env, probe = window.__qaStreamProbe;
      const destination = p.position.clone().set(target[0], env.getPlacementElevationAt(target[0], target[1]), target[1]);
      const startedAt = performance.now(), firstSample = probe.samples.length;
      probe.lastFrameAt = null; // Screenshots/report I/O between legs are not frame intervals.
      let steps = 0, frames = 0, stalled = 0, maxGroundCorrection = 0;
      const remaining = () => Math.hypot(destination.x - p.position.x, destination.z - p.position.z);
      while (remaining() > .05 && frames < 1400) {
        for (let substep = 0; substep < 4 && remaining() > .05; substep++) {
          const waypoint = env.getNavigationWaypoint(p.position, destination, .75) ?? destination;
          const direction = waypoint.clone().sub(p.position).setY(0), distance = direction.length();
          if (distance < 1e-6) throw new Error(`Zero navigation leg while ${remaining()} units remain`);
          const requested = p.position.clone().addScaledVector(direction.normalize(), Math.min(.7, distance));
          const floor = env.getElevationAt(requested.x, requested.z, p.position.y), correction = Math.abs(floor - requested.y);
          if (!Number.isFinite(floor) || correction > .66) throw new Error(`Route skips a physical height: ${requested.toArray()} to ${floor}`);
          maxGroundCorrection = Math.max(maxGroundCorrection, correction); requested.y = floor;
          env.resolveMovement(requested, .75, p.getCollisionHeight?.() ?? 2.4);
          g.dropPod.resolveMovement?.(requested, .75, p.getCollisionHeight?.() ?? 2.4);
          if (requested.distanceTo(p.position) < .001) stalled++; else stalled = 0;
          if (stalled > 8) throw new Error(`Physical traversal stuck at ${p.position.toArray()} toward ${destination.toArray()}`);
          p.position.copy(requested); p.mesh.position.copy(requested); steps++;
        }
        const frameAt = performance.now(), priorFrame = probe.lastFrameAt;
        env.updateBattlefieldVisibility([p]); env.root.updateMatrixWorld(true);
        for (const record of env.worldStreaming.geometries.values()) {
          if ([...record.zones].some(zone => zone.mustDraw) && !record.resident) throw new Error('Mandatory visible terrain remains evicted');
        }
        const camera = g.renderer.camera;
        camera.position.copy(p.position).add(p.position.clone().set(0, 10, 16)); camera.lookAt(p.position.clone().add(p.position.clone().set(0, 2, 0)));
        const renderAt = performance.now(); g.renderer.render(); const renderEndedAt = performance.now();
        const gl = g.renderer.renderer.getContext(), glError = gl.getError();
        if (glError !== gl.NO_ERROR) throw new Error(`WebGL error during rendered traversal: ${glError}`);
        const info = g.renderer.renderer.info;
        if (!(info.render.calls > 0 && info.render.triangles > 0)) throw new Error('The production renderer did not draw the scene');
        probe.samples.push({ stage: label, position: p.position.toArray(), floorHeight: env.getElevationAt(p.position.x, p.position.z, p.position.y),
          frameIntervalMs: priorFrame === null ? null : frameAt - priorFrame, renderCpuSubmissionMs: renderEndedAt - renderAt,
          calls: info.render.calls, triangles: info.render.triangles, allocatedGeometries: info.memory.geometries,
          allocatedTextures: info.memory.textures, insertionFloorResident: probe.floorRecord.resident, streaming: env.getWorldStreamingStats() });
        probe.lastFrameAt = frameAt; frames++;
        if (JSON.stringify(probe.snapshot()) !== JSON.stringify(probe.baseline)) throw new Error('Streaming changed an earned objective, gate or destroyed panel');
        await new Promise(requestAnimationFrame);
      }
      if (remaining() > .05) throw new Error(`Traversal limit reached: ${remaining()} units remain`);
      return { status: 'passed', frames, physicalSteps: steps, maxGroundCorrection, durationMs: performance.now() - startedAt,
        firstSample, lastSample: probe.samples.length - 1, state: probe.snapshot(), stats: env.getWorldStreamingStats(),
        insertionFloorResident: probe.floorRecord.resident, playerPosition: p.position.toArray() };
    }, { label, target }));
    await page.screenshot({ path: resolve(options.output, `${label}.png`) }); await save();
    return stage;
  }

  // First establish the distant eviction, then render the full three-zone loop.
  const far = await walk('relay-far-evicts-insertion', report.initial.relayFarPoint);
  assert.equal(far.insertionFloorResident, false, 'The selected route must actually evict insertion geometry');
  const insertionCenter = report.initial.returnInsertionPoint;
  await walk('return-to-insertion', insertionCenter);
  await walk('outbound-approach', report.initial.sectors[1].center);
  await walk('outbound-relay', report.initial.sectors[2].center);
  await walk('outbound-relay-far', report.initial.relayFarPoint);
  const returned = await walk('final-return-insertion', insertionCenter);
  assert.equal(returned.insertionFloorResident, true);
  report.final = await page.evaluate(() => {
    const probe = window.__qaStreamProbe, stream = game.env.worldStreaming;
    return { state: probe.snapshot(), samples: probe.samples, stats: stream.getStats(),
      geometryCountUnchanged: stream.geometries.size === probe.geometryRecords.length,
      sameCpuTemplates: probe.geometryRecords.every(({ geometry, positions }) => stream.geometries.has(geometry) && geometry.attributes.position?.array === positions),
      newEvictions: stream.evictions - probe.evictions, newRestorations: stream.restorations - probe.restorations,
      insertionFloorResident: probe.floorRecord.resident, playerHp: game.player.hp,
      telemetry: game.renderer.frameTelemetry.snapshot(), battleTimePaused: game.isPaused };
  });
  assert.ok(report.final.sameCpuTemplates && report.final.geometryCountUnchanged);
  assert.ok(report.final.newEvictions > 0 && report.final.newRestorations > 0);
  assert.deepEqual(report.final.state, report.initial.state);
  assert.equal(report.final.insertionFloorResident, true);
  assert.equal(report.final.battleTimePaused, true);
  assert.ok(report.final.playerHp > 0);
  const intervals = report.final.samples.map(sample => sample.frameIntervalMs).filter(Number.isFinite).sort((a, b) => a - b);
  report.observedTiming = { scope: 'Paused-battle, accelerated collision traversal on this software-rendered browser; CPU submission and browser scheduling only.',
    samples: intervals.length, medianIntervalMs: intervals[Math.floor(intervals.length / 2)],
    p95IntervalMs: intervals[Math.ceil(intervals.length * .95) - 1], maximumIntervalMs: intervals.at(-1), gpuTimeAvailable: false };
  report.status = !report.errors.length && !report.failedRequests.length && !report.externalRequests.length ? 'passed' : 'failed';
} catch (error) { report.status = 'failed'; report.error = error.stack; }
finally {
  if (page) try { await page.evaluate(() => { delete window.__qaStreamProbe; delete window.__qaStreamDoor; }); } catch { /* Browser may have closed after the primary error. */ }
  await context?.close(); await browser?.close();
  report.finishedAt = new Date().toISOString();
  report.helperSourcesAfter = await helperHashes();
  report.helpersUnchanged = JSON.stringify(report.helperSourcesBefore) === JSON.stringify(report.helperSourcesAfter);
  report.distUnchanged = JSON.stringify(before) === JSON.stringify(await tree(resolve(root, 'dist')));
  if (!report.distUnchanged || !report.helpersUnchanged) report.status = 'failed'; await save();
  await writeFile(resolve(options.output, 'manifest.json'), `${JSON.stringify({ schemaVersion: 1, files: await tree(options.output) }, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, stages: report.stages.length, errors: report.errors.length,
    newEvictions: report.final?.newEvictions ?? null, newRestorations: report.final?.newRestorations ?? null, distUnchanged: report.distUnchanged }));
  if (report.status !== 'passed') process.exitCode = 1;
}

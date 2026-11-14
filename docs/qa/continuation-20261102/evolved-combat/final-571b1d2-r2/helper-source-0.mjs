// Assisted real-source combat smoke. Never run before ROOT grants Chromium.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const usage = `After final build and exclusive Chromium GO:
  node docs/qa/continuation-20261102/verify-evolved-combat.mjs \\
    --base-url http://127.0.0.1:4320 --expected-source SOURCE_SHA40 \\
    --expected-index INDEX_SHA64 --expected-build-info BUILD_INFO_SHA64 \\
    --output /workspace/qa/continuation-20261102/evolved-RUN --root-browser-go
--help and --check-config do not read the build, fetch, launch Chrome or write evidence.`;
const args = process.argv.slice(2), options = {};
if (args.length === 1 && args[0] === '--help') { console.log(usage); process.exit(0); }
const values = new Set(['--base-url', '--expected-source', '--expected-index', '--expected-build-info', '--output']);
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (flag === '--root-browser-go' || flag === '--check-config') {
    assert.ok(!options[flag], 'Duplicate ' + flag); options[flag] = true;
  } else {
    assert.ok(values.has(flag) && !options[flag] && args[i + 1] && !args[i + 1].startsWith('--'), 'Invalid or duplicate argument: ' + flag);
    options[flag] = args[++i];
  }
}
assert.match(options['--expected-source'] ?? '', /^[a-f0-9]{40}$/);
for (const flag of ['--expected-index', '--expected-build-info']) assert.match(options[flag] ?? '', /^[a-f0-9]{64}$/);
const root = resolve(fileURLToPath(new URL('../../../', import.meta.url))), base = new URL(options['--base-url']);
assert.equal(base.protocol, 'http:'); assert.equal(base.hostname, '127.0.0.1');
assert.ok(base.port && !base.username && !base.password && !base.search && !base.hash && base.pathname === '/', 'Only a local preview origin is accepted');
assert.ok(options['--output']); const out = resolve(options['--output']);
assert.ok(out.startsWith('/workspace/qa/continuation-20261102/'), 'Use a fresh output inside the new QA directory');
if (options['--check-config']) {
  console.log(JSON.stringify({ status: 'configuration_only', root, baseURL: base.origin, output: out, browserLaunched: false, networkAccessed: false, filesWritten: false })); process.exit(0);
}
assert.equal(options['--root-browser-go'], true, 'ROOT must grant the exclusive Chromium slot');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function tree(path, prefix = '') {
  const rows = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const name = prefix + entry.name, full = resolve(path, entry.name);
    if (entry.isDirectory()) rows.push(...await tree(full, name + '/'));
    else rows.push({ path: name, sha256: hash(await readFile(full)) });
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}
const report = { schemaVersion: 1, status: 'running', startedAt: new Date().toISOString(), sourceCommit: options['--expected-source'],
  indexSha256: options['--expected-index'], buildInfoSha256: options['--expected-build-info'],
  humanTesters: 0, fidelity1to1Verified: false, hardwarePerformanceMeasured: false,
  scope: 'Two assisted rendered mechanisms in fresh AFF-27 evolved operations selected through real menus. Actual allocated UID ownership, physical launch, detailed catalepsy/recovery and typed lethal fire. No natural victory, route traversal, entire AI policy or hardware performance claim.',
  assistances: ['Actual game.update completes insertion at1/60', 'Player-only inspection relocations use actual group coordinates, navigation safeSpawnNear and floor queries; no unit/group coordinate, profile, signature or HP is assigned', 'Global RAF gameplay stays paused while explicit Simulation/Bridge owner updates advance the selected subsystem in .25s steps', 'Carrier callback observations call the original and return its unchanged result; the callback is restored immediately. A recorded explicit real Bridge launch request may follow an expected physical refusal, testing the mechanism rather than natural target choice', 'Carrier flight uses actual Horde updates; other managers stay paused. Any additional normal launch consumes and records another original cargo UID', 'Damage requests use the real Horde applyDamage API with the signed player faction; no HP, timer, result or corpse flag is assigned', 'Captures use an explicitly recorded inspection camera and refresh normal environment visibility around the relocated player', 'Actual saveOperation writes a checkpoint during catalepsy; browser phase restore is not exercised'],
  errors: [], failedRequests: [], externalRequests: [], cases: [] };
const save = () => writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const before = await tree(resolve(root, 'dist'));
assert.equal(before.find(row => row.path === 'index.html')?.sha256, report.indexSha256);
assert.equal(before.find(row => row.path === 'build-info.json')?.sha256, report.buildInfoSha256);
report.buildInfo = JSON.parse(await readFile(resolve(root, 'dist/build-info.json'), 'utf8'));
assert.equal(report.buildInfo.sourceCommit, report.sourceCommit); assert.equal(report.buildInfo.sourceTreeDirty, false);
const helperFiles = ['docs/qa/continuation-20261102/verify-evolved-combat.mjs', 'tests/helpers/finish-insertion.mjs'];
const helperBytes = await Promise.all(helperFiles.map(path => readFile(resolve(root, path))));
report.helperSources = helperFiles.map((path, i) => ({ path, sha256: hash(helperBytes[i]), snapshot: `helper-source-${i}.mjs` }));
await mkdir(out);
let browser, context, page, current = 'boot';
const deadline = setTimeout(() => { report.deadlineExceeded = true; void browser?.close(); }, 8 * 60 * 1000);

async function inspect(uid) {
  return page.evaluate(async id => {
    const g = game, s = g.battleSimulation, unit = s.units.get(id), actor = g.battleBridge.actors.get(id)?.actor;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([...s.units.keys()].sort())));
    const idsSha256 = [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
    const active = Object.values(s.getCounts()).reduce((n, row) => n + row.active, 0);
    const projected = [...g.battleBridge.actors.entries()], hordeIds = g.horde.aliens.map(a => a.battleUnitId).filter(Boolean);
    return { id, type: unit.actorType, hp: unit.hp, maxHp: unit.maxHp, state: unit.state, groupId: unit.groupId,
      sourceUpgrade: s.config.profiles.find(p => p.id === unit.profileId)?.extinctionUpgrade, profileId: unit.profileId,
      cargo: [...(unit.carrierCargoIds ?? [])], cargoStates: (unit.carrierCargoIds ?? []).map(id => ({ id, state: s.units.get(id)?.state, carrier: s.units.get(id)?.carriedByCarrierId, rendered: g.battleBridge.actors.has(id) })),
      phase: unit.ravagerCatalepsy ? { ...unit.ravagerCatalepsy } : null, spent: unit.ravagerRegenesisSpent ?? false,
      incapacitated: unit.incapacitated === true, deadRegistered: s.deaths.has(id), time: s.time, paused: s.paused,
      variant: s.config.context?.extinctionCasteVariant, digest: s.digest,
      inventory: { idsSha256, allocated: s.initialAllocated, units: s.units.size, active, actors: g.battleBridge.actors.size, cap: s.budgets.active, conserved: s.assertConservation(),
        everyProjectionOwned: projected.every(([id, entry]) => entry.actor.battleUnitId === id && s.units.get(id)?.state === 'active'), hordeIdsUnique: new Set(hordeIds).size === hordeIds.length },
      actor: actor ? { uid: actor.battleUnitId, type: actor.type, hp: actor.hp, rootUuid: actor.mesh.uuid, position: actor.mesh.position.toArray(), rotation: actor.mesh.rotation.toArray().slice(0, 3),
        rootParented: !!actor.mesh.parent, downed: actor.isDowned === true, visualChild: !!actor.ravagerVisual && actor.ravagerVisual !== actor.mesh && actor.ravagerVisual.parent === actor.mesh,
        visualRotation: actor.ravagerVisual?.rotation.toArray().slice(0, 3), pose: actor.ravagerVisual?.userData.ravagerCatalepsyPose ?? false,
        flight: actor.carrierFlight ? { elapsed: actor.carrierFlight.elapsed, duration: actor.carrierFlight.duration, start: actor.carrierFlight.start.toArray(), end: actor.carrierFlight.end.toArray() } : null,
        floor: g.env.getElevationAt(actor.mesh.position.x, actor.mesh.position.z, actor.mesh.position.y), canStand: g.env.navigation.canStand(actor.mesh.position, actor.radius ?? .6) } : null };
  }, uid);
}
function finite(state, original) {
  assert.equal(state.inventory.conserved, true); assert.equal(state.inventory.units, state.inventory.allocated);
  assert.ok(state.inventory.active <= state.inventory.cap); assert.equal(state.inventory.cap, 32);
  assert.equal(state.inventory.everyProjectionOwned, true); assert.equal(state.inventory.hordeIdsUnique, true);
  if (original) { assert.equal(state.inventory.idsSha256, original.inventory.idsSha256); assert.equal(state.digest, original.digest); }
}
async function stepStrategic(steps = 1) {
  return page.evaluate(count => {
    const g = game, s = g.battleSimulation;
    for (let i = 0; i < count; i++) {
      const players = [g.player, g.player2].filter(Boolean).map((p, index) => ({ id: index ? 'player2' : 'player1', position: [p.position.x, p.position.z], hp: p.hp }));
      g.battleBridge.sync(); s.update(.25, { players, paused: false });
      g.horde.update(0, g.player, g.player2); g.battleBridge.sync();
    }
    return { time: s.time, result: s.getResult(), playing: g.isPlaying };
  }, steps);
}
async function observeCarrierTicks(count, delta) {
  return page.evaluate(({ count, delta }) => {
    const g = game, s = g.battleSimulation, original = g.horde.carrierCargoLaunch, attempts = [];
    if (typeof original !== 'function') throw Error('Actual Carrier launch callback is not bound');
    g.horde.carrierCargoLaunch = (carrier, target) => {
      const source = s.units.get(carrier.battleUnitId), group = s.groups.get(source?.groupId), p = target?.position ?? target?.mesh?.position;
      const before = { carrierId: source?.id, sourceState: source?.state, groupMaterialized: group?.materialized, groupPathLength: group?.path.length,
        paused: s.paused, result: s.getResult(), cargo: [...(source?.carrierCargoIds ?? [])],
        target: { uid: target?.actor?.battleUnitId ?? target?.battleUnitId ?? null, type: target?.actor?.type ?? target?.type ?? null,
          playerReference: target === g.player, faction: target?.factionId ?? null, hp: target?.hp, position: p?.toArray?.(), gap: p ? carrier.mesh.position.distanceTo(p) : null } };
      let result;
      try { result = original(carrier, target); return result; }
      finally { attempts.push({ before, result: result ? { accepted: result.accepted, reason: result.reason ?? null, facehuggerId: result.facehuggerId ?? null } : null }); }
    };
    try { for (let i = 0; i < count; i++) { g.battleBridge.sync(); g.horde.update(delta, g.player, g.player2); } }
    finally { g.horde.carrierCargoLaunch = original; }
    return { attempts, callbackRestored: g.horde.carrierCargoLaunch === original };
  }, { count, delta });
}
async function materialize(type) {
  return page.evaluate(kind => {
    const g = game, s = g.battleSimulation, nav = g.env.navigation;
    const unit = [...s.units.values()].find(u => u.actorType === kind), group = s.groups.get(unit?.groupId), front = s.fronts.get(group?.frontId);
    if (!unit || !group || !front) throw Error('No actually allocated source ' + kind);
    const candidates = [], members = group.units.map(id => s.units.get(id)).filter(u => u.hp > 0 && u.carriedByCarrierId === undefined);
    const peers = [...s.groups.values()].filter(other => other.frontId === group.frontId && other.factionId === group.factionId && other.units.some(id => { const u = s.units.get(id); return u.hp > 0 && u.state !== 'reserve'; }));
    const occupied = [...g.battleBridge.actors.values()].map(({ actor }) => ({ position: actor.mesh.position, radius: actor.radius ?? 1 }));
    for (const radius of [32, 42, 52, 65]) for (let i = 0; i < 24; i++) {
      const angle = i * Math.PI / 12, p = g.player.position.clone().set(group.position[0] + Math.cos(angle) * radius, 0, group.position[1] + Math.sin(angle) * radius);
      p.y = g.env.getElevationAt(p.x, p.z);
      const safe = nav.safeSpawnNear(p, g.player.radius ?? 1, occupied, 3);
      if (!safe || !nav.canStand(safe, g.player.radius ?? 1) || Math.hypot(safe.x - front.position[0], safe.z - front.position[1]) > front.radius * 1.45 || members.some(u => Math.hypot(safe.x - u.position[0], safe.z - u.position[1]) < s.budgets.spawnDistance + .5)) continue;
      const distance = Math.hypot(safe.x - group.position[0], safe.z - group.position[1]);
      const nearer = peers.filter(other => other !== group && Math.hypot(safe.x - other.position[0], safe.z - other.position[1]) < distance).length;
      candidates.push({ position: safe, rank: nearer * 1000 + distance });
    }
    candidates.sort((a, b) => a.rank - b.rank);
    const trials = [];
    for (const { position } of candidates.slice(0, 16)) {
      g.player.position.copy(position);
      const players = [{ id: 'player1', position: [position.x, position.z], hp: g.player.hp }];
      g.battleBridge.sync(); s.update(.25, { players, paused: false }); g.horde.update(0, g.player, g.player2); g.battleBridge.sync();
      trials.push({ playerPosition: position.toArray(), time: s.time, materialized: g.battleBridge.actors.has(unit.id), bridgeError: g.battleBridge.lastError ?? null });
      if (g.battleBridge.actors.has(unit.id)) return { uid: unit.id, groupId: unit.groupId, trials };
    }
    throw Error('Could not materialize actual ' + kind + ': ' + JSON.stringify(trials));
  }, type);
}
async function approach(uid) {
  return page.evaluate(id => {
    const g = game, actor = g.battleBridge.actors.get(id)?.actor, nav = g.env.navigation;
    if (!actor) throw Error('Source actor absent before player approach');
    const occupied = [...g.battleBridge.actors.values()].map(({ actor }) => ({ position: actor.mesh.position, radius: actor.radius ?? 1 }));
    for (const radius of [6, 8, 10, 12]) for (let i = 0; i < 24; i++) {
      const angle = i * Math.PI / 12, target = actor.mesh.position.clone(); target.x += Math.cos(angle) * radius; target.z += Math.sin(angle) * radius; target.y = g.env.getElevationAt(target.x, target.z, actor.mesh.position.y);
      const p = nav.safeSpawnNear(target, g.player.radius ?? 1, occupied, 3);
      if (!p || !nav.canStand(p, g.player.radius ?? 1) || p.distanceTo(actor.mesh.position) > 12 || Math.abs(p.y - actor.mesh.position.y) > 2 || g.env.hasLineOfSight(actor.mesh.position.clone().add({ x: 0, y: 2, z: 0 }), p.clone().add({ x: 0, y: .5, z: 0 })) === false) continue;
      const before = g.player.position.toArray(); g.player.position.copy(p);
      return { before, after: p.toArray(), distance: p.distanceTo(actor.mesh.position), standable: true, actorPositionUnchanged: actor.mesh.position.toArray() };
    }
    throw Error('No physical nearby inspection position for ' + id);
  }, uid);
}
async function capture(name, ids, fallback = null) {
  const camera = await page.evaluate(({ ids, fallback }) => {
    const g = game, points = ids.map(id => g.battleBridge?.actors.get(id)?.actor?.mesh.position).filter(Boolean);
    g.env.updateBattlefieldVisibility?.([g.player, g.player2].filter(Boolean));
    let center = points[0]?.clone() ?? (fallback ? g.player.position.clone().set(...fallback) : g.player.position.clone());
    if (points.length > 1) { for (let i = 1; i < points.length; i++) center.add(points[i]); center.multiplyScalar(1 / points.length); }
    g.renderer.camera.position.copy(center).add({ x: 8, y: 5.5, z: 9 }); g.renderer.camera.lookAt(center.clone().add({ x: 0, y: 1.2, z: 0 }));
    g.renderer.camera.updateMatrixWorld(true); g.renderer.render();
    return { position: g.renderer.camera.position.toArray(), quaternion: g.renderer.camera.quaternion.toArray(), focus: center.toArray() };
  }, { ids, fallback });
  const filename = name + '.png'; await page.screenshot({ path: resolve(out, filename), animations: 'disabled' });
  return { path: filename, sha256: hash(await readFile(resolve(out, filename))), camera };
}
async function launch() {
  context = await browser.newContext({ viewport: { width: 1000, height: 700 } }); page = await context.newPage(); page.setDefaultTimeout(30000);
  const add = (key, value) => { if (report[key].length < 25) report[key].push({ case: current, ...value }); };
  page.on('pageerror', e => add('errors', { message: e.message })); page.on('console', m => { if (m.type() === 'error') add('errors', { message: m.text() }); });
  page.on('requestfailed', r => add('failedRequests', { url: r.url(), failure: r.failure()?.errorText }));
  page.on('response', r => { if (r.status() >= 400) add('errors', { httpStatus: r.status(), url: r.url() }); });
  page.on('request', r => { const url = new URL(r.url()); if (/^https?:$/.test(url.protocol) && url.origin !== base.origin) add('externalRequests', { url: r.url() }); });
  await page.goto(base.origin, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForFunction(() => !!window.game);
  await page.locator('#btn-start-game').click(); await page.locator('#btn-confirm-char').click(); await page.selectOption('#mission-mode-select', 'fronts');
  await page.selectOption('#operation-select', 'AFF-27'); await page.locator('#extinction-variant-enabled').check(); await page.locator('#extinction-variant-upgraded').check();
  await page.locator('#btn-launch-mission').click(); await page.locator('#btn-confirm-loadout').click({ timeout: 180000 });
  await page.waitForFunction(() => game.isPlaying && !!game.player, null, { timeout: 180000 });
  await page.evaluate(async () => { game.isPaused = true; await game.player.generatedVisualReady; });
  const { finishMissionInsertion } = await import('../../../tests/helpers/finish-insertion.mjs');
  const insertion = await finishMissionInsertion(page);
  const selected = await page.evaluate(() => { game.isPaused = true; return { operationId: game.operationId, variant: game.battleSimulation.config.context?.extinctionCasteVariant, digest: game.battleSimulation.digest }; });
  assert.equal(selected.operationId, 'AFF-27'); assert.equal(selected.variant, 'carrier-ravager-enhanced'); assert.equal(insertion.visible, true);
  return { insertion, selected };
}
async function cleanup() {
  await page.evaluate(() => { game.isPaused = false; document.activeElement?.blur(); }); await page.keyboard.press('Escape');
  await page.locator('#pause-menu').waitFor({ state: 'visible' }); await page.locator('#btn-pause-menu-return').click(); await page.locator('#main-menu').waitFor({ state: 'visible' });
  const state = await page.evaluate(() => { let roots = 0; game.renderer.scene.traverse(o => { if (o.name === 'ravager-collision-root') roots++; }); return { playing: game.isPlaying, playerCleared: game.player === null, simulationCleared: game.battleSimulation === null, bridgeCleared: game.battleBridge === null, aliens: game.horde.aliens.length, ravagerRoots: roots }; });
  assert.equal(state.playing, false); assert.equal(state.playerCleared, true); assert.equal(state.simulationCleared, true); assert.equal(state.bridgeCleared, true); assert.equal(state.aliens, 0); assert.equal(state.ravagerRoots, 0);
  return state;
}
async function run(id, action) {
  current = id; const row = { id, status: 'running' }; report.cases.push(row); await save();
  try { row.launch = await launch(); await action(row); row.cleanup = await cleanup(); row.status = 'passed'; }
  catch (error) { row.status = 'failed'; row.error = error.stack; if (page && !page.isClosed()) try { await page.screenshot({ path: resolve(out, id + '-failure.png'), timeout: 10000 }); } catch {} throw error; }
  finally { await context?.close(); context = null; page = null; await save(); }
}
try {
  const response = await fetch(base.origin, { signal: AbortSignal.timeout(15000), redirect: 'error' }); assert.equal(response.status, 200); assert.equal(hash(Buffer.from(await response.arrayBuffer())), report.indexSha256);
  const { chromium } = await import('playwright'); browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  await run('carrier-real-cargo-flight', async row => {
    row.materialization = await materialize('carrier'); const uid = row.materialization.uid; row.before = await inspect(uid); finite(row.before);
    assert.equal(row.before.sourceUpgrade, 'supercarrier-genome'); assert.equal(row.before.cargo.length, 6); assert.equal(new Set(row.before.cargo).size, 6);
    assert.ok(row.before.cargoStates.every(u => u.carrier === uid && u.state === 'distant' && !u.rendered)); row.approach = await approach(uid);
    row.firstNormalTick = await observeCarrierTicks(1, 1 / 60); assert.equal(row.firstNormalTick.callbackRestored, true);
    row.afterFirstNormalTick = await inspect(uid);
    const unexpected = row.firstNormalTick.attempts.filter(attempt => !attempt.result || (attempt.result.accepted !== true && !['target_outside_carrier_arc', 'no_clear_physical_carrier_arc'].includes(attempt.result.reason)));
    assert.equal(unexpected.length, 0, 'Unexpected real Carrier gate rejection: ' + JSON.stringify(unexpected));
    if (row.afterFirstNormalTick.cargo.length === 6) {
      row.launchMode = 'assisted-real-bridge-request-after-observed-normal-tick';
      row.explicitRequest = await page.evaluate(id => {
        const g = game, s = g.battleSimulation, actor = g.battleBridge.actors.get(id)?.actor, group = s.groups.get(s.units.get(id)?.groupId);
        const result = g.battleBridge.launchCarrierFacehugger(actor, g.player);
        return { target: { playerReference: true, position: g.player.position.toArray(), hp: g.player.hp }, groupPathLength: group?.path.length,
          result: { accepted: result.accepted, reason: result.reason ?? null, facehuggerId: result.facehuggerId ?? null } };
      }, uid);
      assert.equal(row.explicitRequest.result.accepted, true, 'Actual player-target Bridge request refused: ' + row.explicitRequest.result.reason);
    } else row.launchMode = 'normal-horde-selector';
    row.launched = await inspect(uid); assert.equal(row.launched.cargo.length, 5); const face = row.before.cargo.find(id => !row.launched.cargo.includes(id)); assert.ok(face);
    row.faceId = face; row.flightStart = await inspect(face); finite(row.flightStart, row.before); assert.equal(row.flightStart.state, 'active'); assert.ok(row.flightStart.actor?.flight); assert.equal(row.flightStart.actor.uid, face);
    assert.equal(row.flightStart.inventory.active, row.before.inventory.active + 1); row.captures = [await capture('carrier-launched', [uid, face])];
    row.pause = await page.evaluate(id => { const g = game, a = g.battleBridge.actors.get(id).actor, before = { flight: a.carrierFlight.elapsed, strategic: g.battleSimulation.time, horde: g.horde.time }; g.update(.25); return { before, after: { flight: a.carrierFlight.elapsed, strategic: g.battleSimulation.time, horde: g.horde.time }, globalPaused: g.isPaused }; }, face);
    assert.equal(row.pause.globalPaused, true); assert.deepEqual(row.pause.before, row.pause.after);
    row.midairUpdates = await observeCarrierTicks(2, .25); assert.equal(row.midairUpdates.callbackRestored, true);
    row.midair = await inspect(face); assert.ok(row.midair.actor.flight); assert.equal(row.midair.actor.flight.elapsed, .5); assert.ok(row.midair.actor.position[1] > row.flightStart.actor.position[1]); row.captures.push(await capture('carrier-midair', [uid, face]));
    row.landingUpdates = await observeCarrierTicks(2, .25); assert.equal(row.landingUpdates.callbackRestored, true);
    row.landed = await inspect(face); finite(row.landed, row.before); assert.equal(row.landed.actor.flight, null); assert.ok(row.landed.actor.canStand); assert.ok(Math.abs(row.landed.actor.position[1] - row.landed.actor.floor) < .03); assert.equal(row.landed.actor.uid, face);
    row.finalCarrier = await inspect(uid); assert.ok(row.finalCarrier.cargo.length <= 5);
    row.originalPayload = await page.evaluate(ids => ids.map(id => { const g = game, u = g.battleSimulation.units.get(id); return { id, state: u.state, carrier: u.carriedByCarrierId ?? null, rendered: g.battleBridge.actors.has(id), copies: g.horde.aliens.filter(a => a.battleUnitId === id).length }; }), row.before.cargo);
    const released = row.originalPayload.filter(u => u.carrier === null);
    assert.ok(released.length >= 1 && released.length <= (row.launchMode === 'normal-horde-selector' ? 1 : 2));
    for (const u of row.originalPayload) {
      if (u.carrier === uid) { assert.equal(u.state, 'distant'); assert.equal(u.rendered, false); assert.equal(u.copies, 0); }
      else { assert.ok(u.state === 'active' || u.state === 'dead'); assert.equal(u.copies, u.state === 'active' ? 1 : 0); }
    }
    assert.deepEqual(row.finalCarrier.cargo, row.before.cargo.filter(id => !released.some(u => u.id === id)));
    row.captures.push(await capture('carrier-landed', [uid, face]));
  });
  await run('ravager-detailed-phase-fire', async row => {
    row.materialization = await materialize('ravager'); const uid = row.materialization.uid; row.before = await inspect(uid); finite(row.before); row.approach = await approach(uid);
    assert.equal(row.before.sourceUpgrade, 'colossal-resilience'); assert.equal(row.before.hp, 1000); assert.ok(row.before.actor.visualChild); assert.equal(row.before.deadRegistered, false);
    row.damage = await page.evaluate(id => { const g = game, a = g.battleBridge.actors.get(id).actor, details = { cause: 'raw', killerFaction: g.battleSimulation.config.playerFaction }; const first = g.horde.applyDamage(a, 600, details), second = g.horde.applyDamage(a, 350, details); g.horde.update(0, g.player, g.player2); g.battleBridge.sync(); return { first: { damage: first?.damage, killed: first?.killed }, second: { damage: second?.damage, killed: second?.killed } }; }, uid);
    row.started = await inspect(uid); assert.equal(row.started.hp, 50); assert.equal(row.started.actor.hp, 50); assert.equal(row.started.spent, true); assert.ok(row.started.phase); assert.equal(row.started.phase.recoverAt - row.started.phase.startedAt, 12); assert.equal(row.started.deadRegistered, false);
    await stepStrategic(3); row.fallen = await inspect(uid); finite(row.fallen, row.before); assert.equal(row.fallen.actor.rootUuid, row.before.actor.rootUuid); assert.deepEqual(row.fallen.actor.position, row.before.actor.position); assert.deepEqual(row.fallen.actor.rotation, row.before.actor.rotation); assert.equal(row.fallen.actor.downed, true); assert.ok(row.fallen.actor.visualRotation[2] < -1.5); row.captures = [await capture('ravager-cataleptic', [uid])];
    row.pause = await page.evaluate(id => { const g = game, s = g.battleSimulation, a = g.battleBridge.actors.get(id).actor, before = { time: s.time, phase: { ...s.units.get(id).ravagerCatalepsy }, hp: a.hp, rotation: a.ravagerVisual.rotation.toArray() }; s.update(1, { paused: true }); const rejected = g.horde.applyDamage(a, 1, { cause: 'fire', killerFaction: s.config.playerFaction }); g.horde.update(0, g.player, g.player2); g.battleBridge.sync(); const after = { time: s.time, phase: { ...s.units.get(id).ravagerCatalepsy }, hp: a.hp, rotation: a.ravagerVisual.rotation.toArray() }; s.update(0, { paused: false }); return { before, after, rejectedDamage: rejected?.damage }; }, uid);
    assert.deepEqual(row.pause.after, row.pause.before); assert.equal(row.pause.rejectedDamage, 0);
    row.checkpoint = await page.evaluate(id => { game.saveOperation(); const saved = JSON.parse(localStorage.getItem('yautja-operation-checkpoint-v1')); const u = saved?.simulation.units.find(u => u.id === id); return { version: saved?.version, variant: saved?.scene.extinctionVariant, digest: saved?.simulation.configDigest, time: saved?.simulation.time, unit: u ? { id: u.id, hp: u.hp, spent: u.ravagerRegenesisSpent, phase: u.ravagerCatalepsy } : null }; }, uid);
    assert.equal(row.checkpoint.variant, 'carrier-ravager-enhanced'); assert.equal(row.checkpoint.digest, row.before.digest); assert.equal(row.checkpoint.unit.id, uid); assert.deepEqual(row.checkpoint.unit.phase, row.started.phase); assert.equal(row.checkpoint.unit.spent, true);
    await stepStrategic(44); row.beforeRecovery = await inspect(uid); assert.ok(row.beforeRecovery.phase); assert.ok(row.beforeRecovery.time < row.started.phase.recoverAt); assert.equal(row.beforeRecovery.hp, 50);
    await stepStrategic(); row.recovered = await inspect(uid); finite(row.recovered, row.before); assert.equal(row.recovered.phase, null); assert.equal(row.recovered.hp, 500); assert.equal(row.recovered.actor.hp, 500); assert.equal(row.recovered.actor.downed, false); assert.equal(row.recovered.actor.rootUuid, row.before.actor.rootUuid);
    await stepStrategic(3); row.standing = await inspect(uid); assert.equal(row.standing.actor.pose, false); assert.deepEqual(row.standing.actor.position, row.before.actor.position); assert.ok(Math.abs(row.standing.actor.visualRotation[2] - row.before.actor.visualRotation[2]) < .001); row.captures.push(await capture('ravager-recovered', [uid]));
    row.fire = await page.evaluate(id => { const g = game, s = g.battleSimulation, a = g.battleBridge.actors.get(id).actor, details = { killerFaction: s.config.playerFaction }; g.horde.applyDamage(a, 450, { ...details, cause: 'raw' }); const noSecondPhase = !s.units.get(id).ravagerCatalepsy && a.hp === 50; const first = g.horde.applyDamage(a, 100, { ...details, cause: 'fire' }); const eventsBefore = g.horde.combatEvents.deaths.size; const repeat = g.horde.applyDamage(a, 100, { ...details, cause: 'fire' }); g.horde.update(0, g.player, g.player2); g.battleBridge.sync(); return { noSecondPhase, first: { damage: first?.damage, killed: first?.killed }, repeatRejected: repeat === null, eventsBefore, eventsAfter: g.horde.combatEvents.deaths.size, actorPresent: g.battleBridge.actors.has(id), hordeHasId: g.horde.aliens.some(a => a.battleUnitId === id) }; }, uid);
    assert.equal(row.fire.noSecondPhase, true); assert.equal(row.fire.first.killed, true); assert.equal(row.fire.repeatRejected, true); assert.equal(row.fire.eventsAfter, row.fire.eventsBefore); assert.equal(row.fire.actorPresent, false); assert.equal(row.fire.hordeHasId, false);
    row.dead = await inspect(uid); finite(row.dead, row.before); assert.equal(row.dead.state, 'dead'); assert.equal(row.dead.hp, 0); assert.equal(row.dead.deadRegistered, true); assert.equal(row.dead.actor, null); row.captures.push(await capture('ravager-fire-cleanup', [], row.before.actor.position));
  });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.failedRequests, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = error.stack; }
finally {
  clearTimeout(deadline); await context?.close(); await browser?.close(); report.browserClosed = true;
  report.distUnchanged = JSON.stringify(before) === JSON.stringify(await tree(resolve(root, 'dist')));
  const afterHelpers = await Promise.all(helperFiles.map(path => readFile(resolve(root, path)))); report.helperSourcesUnchanged = afterHelpers.every((b, i) => hash(b) === hash(helperBytes[i]));
  if (!report.distUnchanged || !report.helperSourcesUnchanged || report.deadlineExceeded || report.errors.length || report.failedRequests.length || report.externalRequests.length) report.status = 'failed';
  report.finishedAt = new Date().toISOString(); report.durationSeconds = (Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000;
  await save(); for (let i = 0; i < helperBytes.length; i++) await writeFile(resolve(out, `helper-source-${i}.mjs`), helperBytes[i]);
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify({ schemaVersion: 1, files: await tree(out) }, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, cases: report.cases.map(({ id, status }) => ({ id, status })), errors: report.errors.length, failedRequests: report.failedRequests.length, distUnchanged: report.distUnchanged, helperSourcesUnchanged: report.helperSourcesUnchanged, browserClosed: true, report: resolve(out, 'report.json') }));
  if (report.status !== 'passed') process.exitCode = 1;
}

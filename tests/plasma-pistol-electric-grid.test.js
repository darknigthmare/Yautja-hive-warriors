import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { traceCombatSegment, hasCombatLineOfSight } from '../js/engine/CombatGeometry.js';

const load = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const playerSource = load('js/entities/Player.js');
const mechanismSource = load('js/entities/ReferenceEnvironmentMechanisms.js');
const environmentSource = load('js/entities/Environment.js');
const bossSource = load('js/entities/Bosses.js');
function method(source, name) {
  const start = source.indexOf(`  ${name}(`);
  assert.notEqual(start, -1, `production method ${name}`);
  const firstLineEnd = source.indexOf('\n', start);
  if (source.slice(start, firstLineEnd).trimEnd().endsWith('}')) return source.slice(start, firstLineEnd);
  const end = source.indexOf('\n  }', start);
  assert.notEqual(end, -1, `end of ${name}`); return source.slice(start, end + 4);
}
const math = Object.create(Math); math.random = () => 0.99;
const PlayerActions = vm.runInNewContext(`(class { ${['firePlasmaPistol', '_canDamageLegacyAlien', '_canHitLegacyAlien', '_hasLegacyLineOfSight']
  .map(name => method(playerSource, name)).join('\n')} })`, { THREE, Math: math });
// These are the real grid owner, visibility and boss damage methods. Fixtures
// supply actors/colliders; they do not reproduce the admission or damage logic.
const GridEnvironment = vm.runInNewContext(`(class { ${[
  ...['checkElectricGridInteraction', 'electrifyGrid'].map(name => method(mechanismSource, name)),
  ...['traceSegment', 'hasLineOfSight'].map(name => method(environmentSource, name)),
].join('\n')} })`, { THREE, traceCombatSegment, hasCombatLineOfSight });
const BossDamage = vm.runInNewContext(`(class { ${['takeDamage', '_syncPhaseFromHealth'].map(name => method(bossSource, name)).join('\n')} })`,
  { THREE, recordCombatDeath: (_owner, victim) => ({ id: victim.id }) });
const grid = (x = 0.4, z = 24.3) => ({ pos: new THREE.Vector3(x, 0.04, z), isActive: false, activeTimer: 0 });
const wall = (overrides = {}) => ({ x: 0, z: 12, halfWidth: 5, halfDepth: 0.2, height: 3, ...overrides });
const alien = (z, hp = 1000) => ({ id: `alien:${z}`, hp, type: 'warrior', mesh: { position: new THREE.Vector3(0.4, 0, z) } });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);

function fixture({ grids = [grid()], colliders = [], actors = [] } = {}) {
  const queue = [], checks = [], rays = [], sparks = [], announcements = [], sounds = [];
  let time = 0;
  const environment = new GridEnvironment();
  Object.assign(environment, { colliders, electricFloorGrids: grids, random: () => 0.5 });
  const checkGrid = environment.checkElectricGridInteraction, trace = environment.traceSegment;
  environment.checkElectricGridInteraction = function (...args) {
    checks.push({ time, point: args[0].clone(), origin: args[6]?.clone() });
    return checkGrid.apply(this, args);
  };
  environment.traceSegment = function (...args) {
    rays.push({ time, from: args[0].clone(), to: args[1].clone() });
    return trace.apply(this, args);
  };
  const horde = { aliens: actors }, bosses = new BossDamage();
  Object.assign(bosses, { activeBoss: null, time: 0, clear() { this.activeBoss = null; }, _updateAttackReadout() {} });
  const ui = { showAnnouncement(message) { announcements.push(message); } };
  const particles = { emitSparks(point, count) { sparks.push({ time, point: point.clone(), count }); } };
  const audio = { playPlasmaPistolBurst() { sounds.push('shot'); }, playElectricFloorHum() { sounds.push('grid'); } };
  const player = new PlayerActions();
  Object.assign(player, { position: new THREE.Vector3(), rotationY: 0, plasmaEnergy: 100, plasmaPistolCooldown: 0,
    audioEngine: audio, gameContext: { env: environment, ui }, canUseArsenalEquipment: () => true,
    schedule(fn, delay) { queue.push({ fn, delay }); },
  });
  const step = () => { const action = queue.shift(); assert.ok(action); time = action.delay; action.fn(); };
  return { player, environment, horde, bosses, ui, particles, audio, grids, checks, rays, sparks, sounds, announcements, queue,
    fire: () => player.firePlasmaPistol(horde, bosses, particles, environment), step,
    flush() { while (queue.length) step(); } };
}
function assertCost(f) {
  assert.equal(f.player.plasmaEnergy, 88); assert.equal(f.player.plasmaPistolCooldown, 0.42);
  assert.equal(f.sounds.filter(sound => sound === 'shot').length, 1);
}

test('an unobstructed burst activates the real grid once, retaining its damage, duration and shot cadence', () => {
  const victim = alien(28.3), f = fixture({ actors: [victim] });
  assert.equal(f.fire(), true); assert.deepEqual(f.queue.map(item => item.delay), [0, 85, 170]); f.flush();
  assert.equal(f.grids[0].isActive, true); assert.equal(f.grids[0].activeTimer, 6);
  assert.equal(victim.hp, 720); assert.equal(victim.isStunned, true); assert.equal(victim.stunTimer, 4);
  assert.equal(f.announcements.length, 1); assert.equal(f.sounds.filter(sound => sound === 'grid').length, 1);
  assert.deepEqual(f.checks.map(item => item.time), [0, 85, 170]);
  assert.deepEqual(f.sparks.filter(item => item.count === 5).map(item => item.time), [0, 85, 170]);
  const muzzleSparks = f.sparks.filter(item => item.count === 5);
  for (const [index, z] of [1.8, 2.2, 2.6].entries()) {
    close(muzzleSparks[index].point.x, 0.4); close(muzzleSparks[index].point.y, 1.8); close(muzzleSparks[index].point.z, z);
  }
  assertCost(f);
});

test('a frontal wall prevents a remote grid discharge and its real collateral damage', () => {
  const victim = alien(28.3), f = fixture({ colliders: [wall()], actors: [victim] });
  assert.equal(f.fire(), true); f.flush();
  assert.equal(f.grids[0].isActive, false); assert.equal(victim.hp, 1000);
  assert.equal(victim.isStunned, undefined); assert.equal(f.announcements.length, 0);
  for (const check of f.checks) close(check.point.z, 11.77);
  assertCost(f);
});

test('a grid before the nearest wall can activate at that wall impact instead of the unreachable endpoint', () => {
  const f = fixture({ grids: [grid(0.4, 10)], colliders: [wall({ z: 18 }), wall()] });
  assert.equal(f.fire(), true); f.flush();
  assert.equal(f.grids[0].isActive, true); assert.equal(f.announcements.length, 1);
  for (const check of f.checks) close(check.point.z, 11.77);
});

test('a grid just behind the first wall stays protected even inside the interaction radius of its impact', () => {
  const f = fixture({ grids: [grid(0.4, 14)], colliders: [wall()] });
  assert.equal(f.fire(), true); f.flush();
  assert.equal(f.grids[0].isActive, false); assert.equal(f.announcements.length, 0);
  assert.ok(f.checks[0].point.distanceTo(f.grids[0].pos) < 5.5);
});

test('a lateral wall blocks the actual grid candidate even when the shot axis reaches its endpoint', () => {
  const f = fixture({ grids: [grid(4, 24)], colliders: [wall({ x: 2, z: 14, halfWidth: 0.2, halfDepth: 6 })] });
  assert.equal(f.fire(), true); f.flush();
  assert.equal(f.grids[0].isActive, false);
  for (const check of f.checks) close(check.point.z, 24.3);
  assert.equal(f.announcements.length, 0);
});

test('the grid owner skips a hidden candidate and can still activate the next visible inactive grid', () => {
  const f = fixture({ grids: [grid(4, 24), grid()], colliders: [wall({ x: 2, z: 14, halfWidth: 0.2, halfDepth: 6 })] });
  assert.equal(f.fire(), true); f.flush();
  assert.equal(f.grids[0].isActive, false); assert.equal(f.grids[1].isActive, true);
  assert.equal(f.announcements.length, 1);
});

test('manual grid interactions retain historical order, active-grid skipping and the 3D radius without projectile filtering', () => {
  const f = fixture({ grids: [grid(4, 24), grid()], colliders: [wall({ x: 2, z: 14, halfWidth: 0.2, halfDepth: 6 })] });
  const point = new THREE.Vector3(0.4, 1.8, 24.3);
  const interact = at => f.environment.checkElectricGridInteraction(at, f.player, f.ui, f.audio, f.particles, f.horde);
  assert.equal(interact(point), true); assert.equal(f.grids[0].isActive, true); assert.equal(f.grids[1].isActive, false);
  assert.equal(interact(point), true); assert.equal(f.grids[1].isActive, true); assert.equal(interact(point), false);
  f.grids[0].isActive = false; f.grids[1].isActive = false;
  const above = f.grids[0].pos.clone().add(new THREE.Vector3(0, 5.51, 0));
  assert.equal(interact(above), false);
  above.y -= 0.01; assert.equal(interact(above), true);
  assert.equal(f.player.plasmaEnergy, 100);
});

test('disabled cover and walls beyond the shot do not block an otherwise reachable grid', () => {
  for (const blocker of [wall({ enabled: false }), wall({ z: 32 }), wall({ height: 0.2 })]) {
    const f = fixture({ colliders: [blocker] });
    assert.equal(f.fire(), true); f.flush();
    assert.equal(f.grids[0].isActive, true); assert.equal(f.announcements.length, 1);
  }
});

test('a custom physical collider returning only t still supplies the correct interaction point', () => {
  const plane = { traceSegment(from, to) {
    const t = (12 - from.z) / (to.z - from.z);
    return Number.isFinite(t) && t >= 0 && t <= 1 ? { t } : null;
  } };
  const f = fixture({ grids: [grid(0.4, 10)], colliders: [plane] });
  assert.equal(f.fire(), true); f.flush();
  assert.equal(f.grids[0].isActive, true);
  for (const check of f.checks) close(check.point.z, 12);
});

test('an obstacle before the first cosmetic spark bounds all three sparks at the real first impact', () => {
  const f = fixture({ colliders: [wall({ z: 0.8, halfDepth: 0.1 })] });
  assert.equal(f.fire(), true); f.flush();
  const muzzleSparks = f.sparks.filter(item => item.count === 5);
  assert.deepEqual(muzzleSparks.map(item => item.time), [0, 85, 170]);
  for (const spark of muzzleSparks) { close(spark.point.x, 0.4); close(spark.point.y, 1.8); close(spark.point.z, 0.67); }
  assert.equal(f.grids[0].isActive, false); assert.equal(f.rays.length, 3);
  for (const ray of f.rays) assert.deepEqual(ray.from.toArray(), [0.4, 1.8, 0.3]);
});

for (const kind of ['alien', 'boss']) {
  test(`a successful ${kind} impact consumes each bolt instead of also activating a distant grid`, () => {
    const victim = alien(28.3), f = fixture({ actors: [victim] });
    const target = alien(10, 10000);
    if (kind === 'alien') f.horde.aliens.push(target);
    else Object.assign(f.bosses, { activeBoss: { ...target, type: 'queen', maxHp: 10000, phase: 1 } });
    assert.equal(f.fire(), true); f.flush();
    assert.equal((kind === 'boss' ? f.bosses.activeBoss : target).hp, 9715);
    assert.equal(f.grids[0].isActive, false); assert.equal(victim.hp, 1000);
    assert.equal(f.checks.length, 0); assert.equal(f.announcements.length, 0); assertCost(f);
  });
}

test('later bolts can reach a grid after an earlier bolt kills and clears the boss', () => {
  const f = fixture();
  f.bosses.activeBoss = { ...alien(10, 50), type: 'queen', maxHp: 50, phase: 1 };
  assert.equal(f.fire(), true); f.step();
  assert.equal(f.bosses.activeBoss, null); assert.equal(f.grids[0].isActive, false); assert.equal(f.checks.length, 0);
  f.step(); assert.equal(f.grids[0].isActive, true); f.flush();
  assert.deepEqual(f.checks.map(item => item.time), [85, 170]); assert.equal(f.announcements.length, 1);
});

test('each callback reevaluates a changing obstacle before grid activation', () => {
  const blocker = wall(), f = fixture({ colliders: [blocker] });
  assert.equal(f.fire(), true); f.step();
  assert.equal(f.grids[0].isActive, false); close(f.checks[0].point.z, 11.77);
  blocker.enabled = false; f.step(); assert.equal(f.grids[0].isActive, true); f.flush();
  close(f.checks[1].point.z, 24.3); close(f.checks[2].point.z, 24.3);
  assert.equal(f.announcements.length, 1); assert.equal(f.rays.length, 3); assertCost(f);
});

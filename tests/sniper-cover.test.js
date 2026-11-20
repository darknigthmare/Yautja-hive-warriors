import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { traceCombatSegment, hasCombatLineOfSight } from '../js/engine/CombatGeometry.js';

const playerSource = fs.readFileSync(process.env.YHW_PLAYER_SOURCE ?? new URL('../js/entities/Player.js', import.meta.url), 'utf8');
const bossSource = fs.readFileSync(new URL('../js/entities/Bosses.js', import.meta.url), 'utf8');
function method(source, name) {
  const start = source.indexOf(`  ${name}(`), end = source.indexOf('\n  }', start);
  assert.notEqual(start, -1, `production method ${name}`);
  assert.notEqual(end, -1, `end of production method ${name}`);
  return source.slice(start, end + 4);
}
// Exercise the actual weapon, boss damage and geometry code. Particles, audio,
// UI and lifecycle callbacks are observed at their boundaries; no WebGL or
// character assets are loaded, and no substitute vector implementation is used.
const PlayerActions = vm.runInNewContext(`(class { ${[
  'fireSniperPlasmaLance', '_canDamageLegacyAlien', '_canHitLegacyAlien', '_hasLegacyLineOfSight',
].map(name => method(playerSource, name)).join('\n')} })`, { THREE });
const BossDamage = vm.runInNewContext(`(class { ${[
  'takeDamage', '_syncPhaseFromHealth',
].map(name => method(bossSource, name)).join('\n')} })`, {
  THREE,
  recordCombatDeath(manager, actor, details) {
    const event = { id: actor.id, details }; manager.deaths.push(event); return event;
  },
});

const wall = (extra = {}) => ({ x: 0, z: 5, halfWidth: 5, halfDepth: 0.5, height: 4, ...extra });
function actor(kind, { position = new THREE.Vector3(0, 0, 10), hp = 10000, id = kind, type } = {}) {
  const mesh = new THREE.Group(); mesh.position.copy(position);
  return { id, mesh, hp, maxHp: hp, phase: 1, type: type ?? (kind === 'boss' ? 'queen' : kind === 'synthetic' ? 'android' : 'warrior'), factionId: 'hostile' };
}

function fixture({ kind = null, colliders = [], targetPosition, hp, position = new THREE.Vector3(), rotation = 0, environment = true } = {}) {
  const traces = [], rays = [], explosions = [], sparks = [], blood = [], sounds = [], messages = [], bossHits = [], phaseHordes = [];
  const env = environment ? {
    traceSegment(from, to, options) {
      const hit = traceCombatSegment(from, to, colliders, options);
      traces.push({ from: from.clone(), to: to.clone(), options, hit }); return hit;
    },
    hasLineOfSight(from, to, options) {
      rays.push({ from: from.clone(), to: to.clone(), options });
      return hasCombatLineOfSight(from, to, colliders, options);
    },
  } : null;
  const target = kind ? actor(kind, { position: targetPosition, hp }) : null;
  const player = new PlayerActions(), bosses = new BossDamage();
  Object.assign(bosses, {
    activeBoss: kind === 'boss' ? target : null, time: 0, deaths: [],
    clear() { this.activeBoss = null; }, _updateAttackReadout() {},
    triggerPregnantBurstFrenzy(horde) { phaseHordes.push(horde); },
  });
  const realTakeDamage = bosses.takeDamage;
  bosses.takeDamage = function (...args) {
    bossHits.push(args); return realTakeDamage.apply(this, args);
  };
  const horde = { aliens: kind === 'alien' ? [target] : [] };
  const synthetics = { androids: kind === 'synthetic' ? [target] : [] };
  Object.assign(player, {
    position: position.clone(), rotationY: rotation, plasmaEnergy: 100, sniperCooldown: 0,
    gameContext: { env }, canUseArsenalEquipment: () => true,
  });
  const particles = {
    emitExplosion(point, count) { explosions.push({ point: point.clone(), count }); },
    emitSparks(point, count) { sparks.push({ point: point.clone(), count }); },
    emitAlienBloodSpurt(point, count) { blood.push({ point: point.clone(), count }); },
  };
  const audio = { playBurnerHeavyPlasmaBlast() { sounds.push('blast'); }, playSniperPlasmaTriLaserHum() { sounds.push('hum'); } };
  const ui = { showAnnouncement(message) { messages.push(message); } };
  const forward = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation)).normalize();
  const origin = position.clone().add(new THREE.Vector3(0, 1.8, 0));
  return { player, bosses, target, horde, synthetics, env, traces, rays, explosions, sparks, blood, sounds, messages, bossHits, phaseHordes, forward, origin,
    fire: () => player.fireSniperPlasmaLance(horde, bosses, synthetics, particles, audio, ui) };
}
function near(actual, expected, message, epsilon = 1e-8) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, got ${actual}`);
}
function assertShotCost(f) {
  assert.equal(f.player.plasmaEnergy, 65); assert.equal(f.player.sniperCooldown, 3.8);
  assert.deepEqual(f.sounds, ['blast', 'hum']);
}
function assertHits(f, count) {
  assert.match(f.messages.at(-1), new RegExp(`: ${count} CIBLES TRANSPERCÉES`));
}
function assertEffects(f, length) {
  if (length === 0) {
    assert.equal(f.explosions.length, 0); assert.equal(f.sparks.length, 0); return;
  }
  assert.equal(f.explosions.length, 1); assert.equal(f.explosions[0].count, 24);
  near(f.explosions[0].point.distanceTo(f.origin.clone().addScaledVector(f.forward, length)), 0, 'explosion origin is the physical endpoint');
  const expectedSteps = Math.min(8, Math.floor(length / 5));
  assert.equal(f.sparks.length, expectedSteps, 'only the existing spark stations before cover are emitted');
  f.sparks.forEach(({ point, count }, i) => {
    near(point.distanceTo(f.origin.clone().addScaledVector(f.forward, (i + 1) * 5)), 0, 'spark follows the original shot line');
    assert.equal(count, 6);
  });
}

for (const kind of ['alien', 'boss', 'synthetic']) {
  test(`sniper damages a visible ${kind} with actual Three r160 vectors and retains its costs`, () => {
    const f = fixture({ kind }); assert.equal(f.fire(), true);
    assert.equal(f.target.hp, 8800); assertShotCost(f); assertHits(f, 1); assertEffects(f, 42);
    assert.equal(f.blood.length, kind === 'alien' ? 1 : 0);
  });

  test(`sniper does not damage or count a ${kind} behind the first physical wall`, () => {
    const f = fixture({ kind, colliders: [wall()] }); assert.equal(f.fire(), true);
    assert.equal(f.target.hp, 10000); assertHits(f, 0); assert.equal(f.blood.length, 0);
    assert.equal(f.bossHits.length, 0); assertShotCost(f); assertEffects(f, 4.47);
  });
}

test('sniper keeps piercing visible actors before cover without reaching actors behind it', () => {
  const f = fixture({ kind: 'boss', targetPosition: new THREE.Vector3(0, 0, 4), colliders: [wall({ z: 12 })] });
  const first = actor('alien', { id: 'first', position: new THREE.Vector3(0, 0, 3) });
  const second = actor('alien', { id: 'second', position: new THREE.Vector3(0, 0, 9) });
  const hidden = actor('alien', { id: 'hidden', position: new THREE.Vector3(0, 0, 15) });
  const android = actor('synthetic', { position: new THREE.Vector3(0, 0, 7) });
  const hiddenAndroid = actor('synthetic', { id: 'hidden-android', position: new THREE.Vector3(0, 0, 16) });
  f.horde.aliens.push(first, hidden, second); f.synthetics.androids.push(hiddenAndroid, android);
  assert.equal(f.fire(), true);
  for (const target of [f.target, first, second, android]) assert.equal(target.hp, 8800);
  for (const target of [hidden, hiddenAndroid]) assert.equal(target.hp, 10000);
  assertHits(f, 4); assert.equal(f.blood.length, 2); assertEffects(f, 11.47); assertShotCost(f);
});

test('sniper retains the existing forward, range and perpendicular target limits', () => {
  for (const kind of ['alien', 'boss', 'synthetic']) {
    const f = fixture();
    const limit = kind === 'boss' ? 3.2 : 1.8;
    const targets = [
      actor(kind, { position: new THREE.Vector3(0, 1.8, -1) }),
      actor(kind, { position: new THREE.Vector3(0, 1.8, 42.1) }),
      actor(kind, { position: new THREE.Vector3(limit + .01, 1.8, 10) }),
      actor(kind, { position: new THREE.Vector3(0, 1.8 + limit + .01, 10) }),
    ];
    for (const target of targets) {
      f.player.sniperCooldown = 0; f.player.plasmaEnergy = 100;
      if (kind === 'boss') f.bosses.activeBoss = target;
      else (kind === 'alien' ? f.horde.aliens : f.synthetics.androids).splice(0, Infinity, target);
      assert.equal(f.fire(), true); assert.equal(target.hp, 10000); assertHits(f, 0);
    }
  }
});

test('sniper damage respects cover from its true 1.8-high muzzle instead of the legacy 2-high origin', () => {
  for (const kind of ['alien', 'boss', 'synthetic']) {
    const collider = wall({ z: .15, halfDepth: .02, height: 1.84 });
    const f = fixture({ kind, colliders: [collider] });
    const targetPoint = f.target.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    assert.equal(hasCombatLineOfSight(new THREE.Vector3(0, 2, 0), targetPoint, [collider], { radius: .03 }), true);
    assert.equal(f.fire(), true); assert.equal(f.target.hp, 10000); assertHits(f, 0); assertEffects(f, .10);
    assert.ok(f.traces.length > 0); assert.deepEqual(f.traces[0].from.toArray(), [0, 1.8, 0]);
    for (const ray of f.rays) assert.deepEqual(ray.from.toArray(), [0, 1.8, 0]);
  }
});

test('sniper chooses the nearest obstacle regardless of collider order and reconstructs t-only contacts', () => {
  for (const colliders of [[wall({ z: 20 }), wall({ z: 12 })], [wall({ z: 12 }), wall({ z: 20 })]]) {
    const f = fixture({ colliders }); assert.equal(f.fire(), true); assertEffects(f, 11.47);
  }
  const custom = { resolveMovement() {}, traceSegment: () => ({ t: .25 }) };
  const f = fixture({ colliders: [custom] }); assert.equal(f.fire(), true); assertEffects(f, 10.5);
  assert.equal(f.traces[0].hit.distance, undefined); assert.equal(f.traces[0].hit.point, undefined);
});

test('sniper endpoint follows a moved and rotated player against rotated and cylindrical cover', () => {
  const position = new THREE.Vector3(8, 3, -7), rotation = Math.PI / 3;
  const forward = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation));
  const center = position.clone().addScaledVector(forward, 12);
  for (const [collider, distance] of [
    [wall({ x: center.x, z: center.z, baseY: 3, rotation }), 11.47],
    [{ x: center.x, z: center.z, baseY: 3, height: 4, radius: 1 }, 10.97],
  ]) {
    const f = fixture({ position, rotation, colliders: [collider] });
    assert.equal(f.fire(), true); assertEffects(f, distance); assertShotCost(f);
    assert.deepEqual(f.player.position.toArray(), position.toArray(), 'feedback does not move the player');
  }
});

test('sniper trace uses its radius and physical flags independently of render visibility', () => {
  const graze = wall({ x: .52, halfWidth: .5 });
  assert.equal(traceCombatSegment(new THREE.Vector3(0, 1.8, 0), new THREE.Vector3(0, 1.8, 42), [graze]), null);
  for (const collider of [graze, wall({ mesh: { visible: false } })]) {
    const f = fixture({ colliders: [collider] }); assert.equal(f.fire(), true); assertEffects(f, 4.47);
  }
  for (const collider of [
    wall({ enabled: false }), wall({ solid: false }), wall({ blocksProjectiles: false }),
    wall({ projectileBlocker: false }), wall({ isCollisionActive: () => false }), wall({ z: 44 }),
  ]) {
    const f = fixture({ kind: 'boss', colliders: [collider] }); assert.equal(f.fire(), true);
    assert.equal(f.target.hp, 8800); assertEffects(f, 42);
  }
});

test('sniper beam respects the actual heights of low walls, floors and overhead cover', () => {
  for (const [collider, length] of [
    [wall({ height: 1.75 }), 42], [wall({ height: 1.78 }), 4.47],
    [wall({ baseY: 1.82, height: 1 }), 4.47], [wall({ baseY: 1.84, height: 1 }), 42],
  ]) {
    const f = fixture({ colliders: [collider] }); assert.equal(f.fire(), true); assertEffects(f, length);
  }
  const f = fixture({ kind: 'alien', colliders: [wall({ height: .2 })] });
  assert.equal(f.fire(), true); assert.equal(f.target.hp, 8800);
});

test('sniper cannot reach an elevated actor past blocked central cover even when its individual sight line is clear', () => {
  for (const kind of ['alien', 'boss', 'synthetic']) {
    const collider = wall({ height: 1.78 });
    const f = fixture({ kind, targetPosition: new THREE.Vector3(0, 1, 10), colliders: [collider] });
    const targetPoint = f.target.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    assert.equal(hasCombatLineOfSight(f.origin, targetPoint, [collider], { radius: .03 }), true,
      'the elevated candidate is individually visible over the wall');
    const centralHit = traceCombatSegment(f.origin, f.origin.clone().addScaledVector(f.forward, 42), [collider], { radius: .03 });
    assert.ok(centralHit, 'the horizontal shot still meets physical cover');
    near(centralHit.distance, 4.47, 'central physical limit');
    assert.equal(f.fire(), true); assert.equal(f.target.hp, 10000); assertHits(f, 0);
    assert.equal(f.blood.length, 0); assert.equal(f.bossHits.length, 0);
    assertEffects(f, 4.47); assertShotCost(f);
  }
});

test('sniper emits no trajectory or actor impact when its muzzle starts inside solid cover', () => {
  for (const kind of ['alien', 'boss', 'synthetic']) {
    const f = fixture({ kind, colliders: [wall({ z: 0 })] }); assert.equal(f.fire(), true);
    assertEffects(f, 0); assert.equal(f.target.hp, 10000); assert.equal(f.blood.length, 0);
    assertHits(f, 0); assertShotCost(f);
  }
});

test('sniper still checks lateral cover to each candidate instead of using only the central beam', () => {
  for (const kind of ['alien', 'boss', 'synthetic']) {
    const targetPosition = new THREE.Vector3(1, 1.8, 10);
    const collider = wall({ x: .5, halfWidth: .08, halfDepth: .1 });
    const f = fixture({ kind, targetPosition, colliders: [collider] });
    assert.equal(traceCombatSegment(f.origin, f.origin.clone().addScaledVector(f.forward, 42), [collider], { radius: .03 }), null);
    assert.equal(f.fire(), true); assert.equal(f.target.hp, 10000); assertHits(f, 0); assert.equal(f.blood.length, 0);
  }
});

test('sniper passes the real horde to nonlethal boss phases and safely handles a lethal boss clear', () => {
  const f = fixture({ kind: 'boss', hp: 2000 }); f.target.type = 'predalien';
  assert.equal(f.fire(), true); assert.equal(f.target.hp, 800); assert.equal(f.target.phase, 2);
  assert.deepEqual(f.phaseHordes, [f.horde]); assert.equal(f.bossHits[0][1], f.horde); assertHits(f, 1);
  f.player.sniperCooldown = 0;
  assert.equal(f.fire(), true); assert.equal(f.target.hp, 0); assert.equal(f.bosses.activeBoss, null);
  assert.equal(f.bosses.deaths.length, 1); assertHits(f, 1);
  f.player.sniperCooldown = 0; f.player.plasmaEnergy = 100;
  assert.equal(f.fire(), true); assert.equal(f.bosses.deaths.length, 1); assertHits(f, 0);
});

test('sniper ignores allied aliens and actors already dead while retaining live targets', () => {
  for (const kind of ['alien', 'boss', 'synthetic']) {
    const f = fixture({ kind, hp: 0 }); assert.equal(f.fire(), true);
    assert.equal(f.target.hp, 0); assertHits(f, 0); assert.equal(f.blood.length, 0); assert.equal(f.bossHits.length, 0);
  }
  const f = fixture({ kind: 'alien' }); f.target.factionId = 'player_clan';
  f.horde.battleSimulation = { config: { playerFaction: 'player_clan' }, areHostile: (_from, to) => to !== 'player_clan' };
  const hostile = actor('alien', { id: 'hostile', position: new THREE.Vector3(0, 0, 12) });
  f.horde.aliens.push(hostile);
  assert.equal(f.fire(), true); assert.equal(f.target.hp, 10000); assert.equal(hostile.hp, 8800);
  assertHits(f, 1); assert.equal(f.blood.length, 1);
});

test('sniper remains usable with absent environment, particle, audio or UI services', () => {
  for (const kind of ['alien', 'boss', 'synthetic']) {
    const f = fixture({ kind, environment: false });
    assert.equal(f.player.fireSniperPlasmaLance(f.horde, f.bosses, f.synthetics, null, null, null), true);
    assert.equal(f.target.hp, 8800); assert.equal(f.player.plasmaEnergy, 65); assert.equal(f.player.sniperCooldown, 3.8);
  }
  const f = fixture({ environment: false }); assert.equal(f.fire(), true); assertEffects(f, 42);
});

test('sniper refuses unavailable gear, cooldown or insufficient energy before any shot effects or costs', () => {
  for (const reason of ['gear', 'cooldown', 'energy']) {
    const f = fixture({ kind: 'boss' });
    if (reason === 'gear') f.player.canUseArsenalEquipment = () => false;
    if (reason === 'cooldown') f.player.sniperCooldown = 2;
    if (reason === 'energy') f.player.plasmaEnergy = 34;
    const energy = f.player.plasmaEnergy, cooldown = f.player.sniperCooldown;
    assert.equal(f.fire(), false); assert.equal(f.player.plasmaEnergy, energy); assert.equal(f.player.sniperCooldown, cooldown);
    assert.equal(f.target.hp, 10000); assert.deepEqual(f.sounds, []); assert.deepEqual(f.traces, []);
    assert.deepEqual(f.explosions, []); assert.deepEqual(f.sparks, []); assert.deepEqual(f.blood, []);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { traceCombatSegment, hasCombatLineOfSight } from '../js/engine/CombatGeometry.js';
import { CombatEvents, recordCombatDeath } from '../js/engine/CombatEvents.js';
import { disposeObject } from '../js/engine/SceneResources.js';

const load = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const playerSource = process.env.YHW_PLAYER_SOURCE ? fs.readFileSync(process.env.YHW_PLAYER_SOURCE, 'utf8') : load('js/entities/Player.js');
const bossSource = load('js/entities/Bosses.js');
const syntheticSource = load('js/entities/Synthetics.js');
function method(source, name) {
  const start = source.indexOf(`  ${name}(`), end = source.indexOf('\n  }', start);
  assert.notEqual(start, -1, `production method ${name}`);
  assert.notEqual(end, -1, `end of production method ${name}`);
  return source.slice(start, end + 4);
}
// Run production damage/geometry admission, with real Three vectors and cover.
// Rendering, audio and the attack director are controlled boundaries;
// emitted positions do not certify the later motion or volume of particles.
const PlayerActions = vm.runInNewContext(`(class { ${[
  'fireSniperPlasmaLance', '_canDamageLegacyAlien', '_canHitLegacyAlien', '_hasLegacyLineOfSight',
].map(name => method(playerSource, name)).join('\n')} })`, { THREE });
const BossDamage = vm.runInNewContext(`(class { ${['takeDamage', '_syncPhaseFromHealth']
  .map(name => method(bossSource, name)).join('\n')} })`, { THREE, recordCombatDeath });
const math = Object.create(Math); math.random = () => 1;
const SyntheticOwner = vm.runInNewContext(`(class { ${['update', 'bisectSynthetic', 'defeatSynthetic']
  .map(name => method(syntheticSource, name)).join('\n')} })`, { THREE, Math: math, recordCombatDeath, disposeObject, releaseHostileAttack() {} });

const wall = (overrides = {}) => ({ x: 0, z: 5, halfWidth: 5, halfDepth: 0.5, height: 4, ...overrides });
function actor(kind, position = new THREE.Vector3(0, 0, 10), hp = 5000) {
  const mesh = new THREE.Group(); mesh.position.copy(position);
  return { id: `${kind}:${position.z}`, type: kind === 'boss' ? 'queen' : kind === 'synthetic' ? 'working_joe' : 'warrior',
    factionId: 'hostile', mesh, hp, maxHp: hp, phase: 1, pattern: {} };
}
function fixture({ aliens = [], boss = null, androids = [], colliders = [] } = {}) {
  const effects = [], messages = [], sounds = [], rays = [], traces = [];
  const environment = {
    traceSegment(from, to, options) {
      const hit = traceCombatSegment(from, to, colliders, options);
      traces.push({ from: from.clone(), to: to.clone(), options, hit }); return hit;
    },
    hasLineOfSight(from, to, options) {
      rays.push({ from: from.clone(), to: to.clone(), options });
      return hasCombatLineOfSight(from, to, colliders, options);
    },
  };
  const simulation = { config: { playerFaction: 'player_clan' }, areHostile: (_from, to) => to !== 'player_clan' };
  const horde = { aliens, battleSimulation: simulation }, synthetics = { androids, battleSimulation: simulation };
  const bosses = new BossDamage();
  Object.assign(bosses, { activeBoss: boss, time: 0, deaths: [], combatEvents: new CombatEvents({ runId: 'sniper-boss' }),
    clear() { this.activeBoss = null; }, _updateAttackReadout() {} });
  bosses.combatEvents.subscribe(event => bosses.deaths.push(event));
  const player = new PlayerActions();
  Object.assign(player, { position: new THREE.Vector3(), rotationY: 0, plasmaEnergy: 100, sniperCooldown: 0,
    gameContext: { env: environment }, canUseArsenalEquipment: () => true });
  const emit = kind => (point, count) => effects.push({ kind, point: point.clone(), count });
  const particles = { emitExplosion: emit('explosion'), emitSparks: emit('sparks'), emitAlienBloodSpurt: emit('blood') };
  const audio = { playBurnerHeavyPlasmaBlast() { sounds.push('blast'); }, playSniperPlasmaTriLaserHum() { sounds.push('hum'); } };
  const ui = { showAnnouncement(message) { messages.push(message); } };
  return { player, bosses, horde, synthetics, environment, effects, messages, sounds, rays, traces, particles, audio,
    fire: () => player.fireSniperPlasmaLance(horde, bosses, synthetics, particles, audio, ui) };
}
const targetFixture = (kind, target, colliders = []) => fixture({ colliders,
  aliens: kind === 'alien' ? [target] : [], boss: kind === 'boss' ? target : null, androids: kind === 'synthetic' ? [target] : [] });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);
const assertCount = (f, count) => assert.match(f.messages.at(-1), new RegExp(`: ${count} CIBLES TRANSPERCÉES`));
function assertCost(f) {
  assert.equal(f.player.plasmaEnergy, 65); assert.equal(f.player.sniperCooldown, 3.8);
  assert.deepEqual(f.sounds, ['blast', 'hum']);
}

for (const kind of ['alien', 'boss', 'synthetic']) {
  test(`sniper preserves a ${kind} behind real solid, rotated or cylindrical cover without reporting a hit`, () => {
    for (const collider of [wall(), wall({ rotation: Math.PI / 3 }), { x: 0, z: 5, radius: 1, height: 4 }]) {
      const target = actor(kind), f = targetFixture(kind, target, [collider]);
      assert.equal(f.fire(), true); assert.equal(target.hp, 5000); assertCount(f, 0); assertCost(f);
      assert.equal(f.effects.some(effect => effect.kind === 'blood'), false);
      assert.deepEqual(f.traces[0].from.toArray(), [0, 1.8, 0]);
    }
  });
}

test('sniper uses its 1.8-high muzzle for alien cover instead of the legacy default at height 2', () => {
  const collider = wall({ z: 0.2, halfDepth: 0.05, height: 1.85 }), target = actor('alien');
  const aimPoint = target.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  assert.equal(hasCombatLineOfSight(new THREE.Vector3(0, 2, 0), aimPoint, [collider], { radius: .03 }), true);
  assert.equal(hasCombatLineOfSight(new THREE.Vector3(0, 1.8, 0), aimPoint, [collider], { radius: .03 }), false);
  const f = targetFixture('alien', target, [collider]);
  assert.equal(f.fire(), true); assert.equal(target.hp, 5000); assertCount(f, 0);
});

test('sniper retains piercing damage on several exposed actors, costs and the existing alien faction filter', () => {
  const aliens = [actor('alien', new THREE.Vector3(0, 0, 8)), actor('alien', new THREE.Vector3(0, 0, 18))];
  const friendly = actor('alien', new THREE.Vector3(0, 0, 15)); friendly.factionId = 'player_clan';
  const boss = actor('boss', new THREE.Vector3(0, 0, 12)), androids = [actor('synthetic', new THREE.Vector3(0, 0, 22)), actor('synthetic', new THREE.Vector3(0, 0, 32))];
  const f = fixture({ aliens: [...aliens, friendly], boss, androids });
  assert.equal(f.fire(), true);
  for (const target of [...aliens, boss, ...androids]) assert.equal(target.hp, 3800);
  assert.equal(friendly.hp, 5000); assertCount(f, 5); assertCost(f);
  assert.equal(f.effects.filter(effect => effect.kind === 'blood').length, 2);
  assert.equal(f.bosses.deaths.length, 0, 'nonlethal boss damage returns null but still counts');
});

test('restored sniper synthetic hits respect the owning simulation and preserve credit on rejected targets', () => {
  const ally = actor('synthetic', new THREE.Vector3(0, 0, 8)), neutral = actor('synthetic', new THREE.Vector3(0, 0, 12));
  const hostile = actor('synthetic', new THREE.Vector3(0, 0, 16));
  ally.factionId = 'allied_corporation'; neutral.factionId = 'neutral_corporation';
  for (const target of [ally, neutral, hostile]) target.lastDamageFaction = 'previous_npc';
  const f = fixture({ androids: [ally, neutral, hostile] });
  f.synthetics.battleSimulation = { config: { playerFaction: 'player_corporation' }, areHostile(from, to) {
    assert.equal(from, 'player_corporation'); return to === 'hostile';
  } };
  assert.equal(f.fire(), true); assert.equal(hostile.hp, 3800); assertCount(f, 1);
  assert.equal(hostile.lastDamageFaction, 'player_corporation');
  for (const target of [ally, neutral]) { assert.equal(target.hp, 5000); assert.equal(target.lastDamageFaction, 'previous_npc'); }
  const hidden = actor('synthetic'); hidden.lastDamageFaction = 'previous_npc';
  const covered = targetFixture('synthetic', hidden, [wall()]);
  assert.equal(covered.fire(), true); assert.equal(hidden.hp, 5000); assert.equal(hidden.lastDamageFaction, 'previous_npc');
  const legacy = actor('synthetic'); delete legacy.factionId;
  const standalone = targetFixture('synthetic', legacy); delete standalone.synthetics.battleSimulation;
  assert.equal(standalone.fire(), true); assert.equal(legacy.hp, 3800); assert.equal(legacy.lastDamageFaction, 'player_clan');
});

test('an admitted alien hit replaces stale NPC credit while friendly or covered aliens keep it', () => {
  for (const reason of ['hit', 'friendly', 'covered']) {
    const target = actor('alien'); target.lastDamageFaction = 'previous_npc';
    if (reason === 'friendly') target.factionId = 'player_clan';
    const f = targetFixture('alien', target, reason === 'covered' ? [wall()] : []);
    assert.equal(f.fire(), true); assert.equal(target.hp, reason === 'hit' ? 3800 : 5000);
    assert.equal(target.lastDamageFaction, reason === 'hit' ? 'player_clan' : 'previous_npc');
    assert.equal(f.horde.aliens[0], target, 'the weapon leaves actor finalization with its existing owner');
  }
});

// The accessible central segment bounds damage as well as the visible trail.
// Aim assistance must not route a shot around the first cover it encountered.
test('sniper cannot reach a lateral boss beyond the first obstacle on its central trajectory', () => {
  const hidden = actor('alien'), boss = actor('boss', new THREE.Vector3(2, 0, 10));
  const f = fixture({ aliens: [hidden], boss, colliders: [wall({ halfWidth: .15, halfDepth: .3 })] });
  assert.equal(f.fire(), true); assert.equal(hidden.hp, 5000); assert.equal(boss.hp, 5000); assertCount(f, 0);
  near(f.effects.find(effect => effect.kind === 'explosion').point.z, 4.67);
});

test('sniper respects the historical projected range and 3D corridors for every target family', () => {
  for (const kind of ['alien', 'boss', 'synthetic']) {
    for (const [position, hit] of [
      [new THREE.Vector3(0, 0, 42), true], [new THREE.Vector3(0, 0, 42.01), false],
      [new THREE.Vector3(0, 0, -1), false], [new THREE.Vector3(kind === 'boss' ? 3 : 1, 0, 10), false],
    ]) {
      const target = actor(kind, position), f = targetFixture(kind, target);
      assert.equal(f.fire(), true); assert.equal(target.hp, hit ? 3800 : 5000); assertCount(f, hit ? 1 : 0);
    }
  }
});

test('sniper does not turn low, overhead, distant, disabled or render-hidden cover into incorrect admission', () => {
  for (const [collider, hit] of [
    [wall({ height: .2 }), true], [wall({ baseY: 2.2 }), true], [wall({ z: 20 }), true],
    [wall({ enabled: false }), true], [wall({ blocksProjectiles: false }), true],
    [wall({ mesh: { visible: false } }), false],
  ]) {
    for (const kind of ['alien', 'boss', 'synthetic']) {
      const target = actor(kind), f = targetFixture(kind, target, [collider]);
      assert.equal(f.fire(), true); assert.equal(target.hp, hit ? 3800 : 5000); assertCount(f, hit ? 1 : 0);
    }
  }
});

test('a lethal sniper boss impact keeps the real damage owner and remains safe after it clears the boss', () => {
  const boss = actor('boss', undefined, 500), f = targetFixture('boss', boss);
  assert.equal(f.fire(), true); assert.equal(boss.hp, 0); assert.equal(f.bosses.activeBoss, null);
  assert.equal(f.bosses.deaths.length, 1); assert.equal(f.bosses.deaths[0].isBoss, true); assertCount(f, 1); assertCost(f);
});

test('lethal synthetic hits keep deferred bisection and final deactivation with the existing owner and player credit', () => {
  const target = actor('synthetic', undefined, 1000), f = targetFixture('synthetic', target);
  target.isBisected = false; target.isEMPStunned = true; target.empStunTimer = 1; target.lastDamageFaction = 'previous_npc';
  assert.equal(f.fire(), true); assert.equal(target.hp, -200); assert.equal(target.isBisected, false);
  assert.equal(f.synthetics.androids[0], target); assertCount(f, 1); assert.equal(target.lastDamageFaction, 'player_clan');
  const owner = new SyntheticOwner();
  Object.assign(owner, { androids: f.synthetics.androids, bloodDrops: [], bloodPools: [], severedProps: [],
    scene: new THREE.Scene(), sharedResources: new Set(), combatEvents: new CombatEvents({ runId: 'sniper-synthetic' }),
    audioEngine: { playSyntheticShortCircuit() {} }, emitWhiteSyntheticBlood() {} });
  owner.update(.1, null, null);
  assert.equal(target.isBisected, true); assert.equal(target.hp, 110); near(target.crawlLife, 7.9);
  assert.equal(owner.androids[0], target);
  assert.equal(owner.combatEvents.getSnapshot().deaths.length, 0);
  f.player.sniperCooldown = 0; assert.equal(f.fire(), true); assert.equal(target.hp, -1090);
  assert.equal(owner.androids[0], target); owner.update(.1, null, null);
  assert.equal(owner.androids.length, 0); assert.equal(target.hp, 0); assert.equal(target._combatDisposed, true);
  const deaths = owner.combatEvents.getSnapshot().deaths;
  assert.equal(deaths.length, 1); assert.equal(deaths[0].killerFaction, 'player_clan');
  assert.equal(deaths[0].cause, 'synthetic-deactivation');
});

test('a synthetic already at zero HP keeps its previous lethal credit until its owner restores a living torso', () => {
  const target = actor('synthetic', undefined, 0), f = targetFixture('synthetic', target);
  target.lastDamageFaction = 'previous_npc'; target.isBisected = false; target.isEMPStunned = true; target.empStunTimer = 1;
  assert.equal(f.fire(), true); assert.equal(target.hp, 0); assert.equal(target.lastDamageFaction, 'previous_npc');
  assertCount(f, 0); assertCost(f); assert.equal(f.rays.length, 0);
  const owner = new SyntheticOwner();
  Object.assign(owner, { androids: f.synthetics.androids, bloodDrops: [], bloodPools: [], severedProps: [],
    scene: new THREE.Scene(), audioEngine: { playSyntheticShortCircuit() {} }, emitWhiteSyntheticBlood() {} });
  owner.update(.1, null, null);
  assert.equal(target.isBisected, true); assert.equal(target.hp, 110); assert.equal(target.lastDamageFaction, 'previous_npc');
  f.player.sniperCooldown = 0; assert.equal(f.fire(), true);
  assert.equal(target.hp, -1090); assert.equal(target.lastDamageFaction, 'player_clan'); assertCount(f, 1);
});

test('sniper preserves unobstructed endpoint and all eight existing spark emission points', () => {
  const f = fixture(); assert.equal(f.fire(), true); assertCount(f, 0); assertCost(f);
  assert.deepEqual(f.effects.filter(effect => effect.kind === 'sparks').map(effect => effect.point.z), [5, 10, 15, 20, 25, 30, 35, 40]);
  assert.deepEqual(f.effects.find(effect => effect.kind === 'explosion').point.toArray(), [0, 1.8, 42]);
  assert.equal(f.traces.length, 1); assert.equal(f.traces[0].options.radius, .03);
});

test('sniper bounds its explosion and spark emission points at the nearest physical wall', () => {
  for (const [colliders, end, sparks] of [
    [[wall({ z: 30 }), wall({ z: 12, halfDepth: .2 })], 11.77, [5, 10]],
    [[wall({ z: .2, halfDepth: .05 })], .12, []],
  ]) {
    const f = fixture({ colliders }); assert.equal(f.fire(), true);
    near(f.effects.find(effect => effect.kind === 'explosion').point.z, end);
    assert.deepEqual(f.effects.filter(effect => effect.kind === 'sparks').map(effect => effect.point.z), sparks);
    for (const effect of f.effects) assert.ok(effect.point.z <= end + 1e-9);
  }
});

test('sniper handles a custom t-only impact and an origin already inside cover without points beyond it', () => {
  for (const [collider, end, sparks] of [
    [{ resolveMovement() {}, traceSegment: () => ({ t: .25 }) }, 10.5, [5, 10]],
    [wall({ z: 0 }), 0, []],
  ]) {
    const f = fixture({ colliders: [collider] }); assert.equal(f.fire(), true); assertCost(f);
    if (end > 0) near(f.effects.find(effect => effect.kind === 'explosion').point.z, end);
    else assert.equal(f.effects.length, 0, 'no trajectory exists inside solid cover');
    assert.deepEqual(f.effects.filter(effect => effect.kind === 'sparks').map(effect => effect.point.z), sparks);
    assert.ok(f.effects.every(effect => effect.point.toArray().every(Number.isFinite)));
  }
});

test('an unavailable, cooling or unaffordable sniper shot retains its existing refusal and consumes nothing', () => {
  for (const reason of ['equipment', 'cooldown', 'energy']) {
    const f = fixture();
    if (reason === 'equipment') f.player.canUseArsenalEquipment = () => false;
    if (reason === 'cooldown') f.player.sniperCooldown = 1;
    if (reason === 'energy') f.player.plasmaEnergy = 34;
    const before = [f.player.plasmaEnergy, f.player.sniperCooldown];
    assert.equal(f.fire(), false); assert.deepEqual([f.player.plasmaEnergy, f.player.sniperCooldown], before);
    assert.equal(f.effects.length, 0); assert.equal(f.sounds.length, 0); assert.equal(f.traces.length, 0);
  }
});

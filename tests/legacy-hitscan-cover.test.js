import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { hasCombatLineOfSight } from '../js/engine/CombatGeometry.js';

const playerSource = fs.readFileSync(new URL('../js/entities/Player.js', import.meta.url), 'utf8');
const bossSource = fs.readFileSync(new URL('../js/entities/Bosses.js', import.meta.url), 'utf8');
function method(source, name) {
  const start = source.indexOf(`  ${name}(`), end = source.indexOf('\n  }', start);
  assert.notEqual(start, -1, `production method ${name}`); assert.notEqual(end, -1, `end of ${name}`);
  return source.slice(start, end + 4);
}
const math = Object.create(Math); math.random = () => 0.99;
const playerMethods = ['firePlasmaPistol', 'fireSeegsonBoltGun', '_canDamageLegacyAlien', '_canHitLegacyAlien'];
if (playerSource.includes('  _hasLegacyLineOfSight(')) playerMethods.push('_hasLegacyLineOfSight');
// Execute the production weapon and boss damage methods with the real geometry
// queries, without loading character assets or creating a WebGL renderer.
const PlayerActions = vm.runInNewContext(`(class { ${playerMethods.map(name => method(playerSource, name)).join('\n')} })`, { THREE, Math: math });
const BossDamage = vm.runInNewContext(`(class { ${['takeDamage', '_syncPhaseFromHealth'].map(name => method(bossSource, name)).join('\n')} })`,
  { THREE, recordCombatDeath: (_manager, actor) => ({ id: actor.id }) });
const wall = (overrides = {}) => ({ x: 0, z: 5, halfWidth: 5, halfDepth: 0.5, height: 4, ...overrides });
const actor = (kind, position = new THREE.Vector3(0, 0, 10), hp = 10000) => ({ id: kind, type: kind === 'boss' ? 'queen' : 'warrior',
  hp, maxHp: hp, phase: 1, factionId: 'hostile', mesh: { position } });

function fixture(weapon, { kind = 'boss', colliders = [], position, hp } = {}) {
  const queue = [], sparks = [], announcements = [], effects = [], rays = [], scene = new THREE.Scene();
  const environment = { hasLineOfSight(from, to, options) {
    rays.push({ from: from.clone(), to: to.clone(), options });
    return hasCombatLineOfSight(from, to, colliders, options);
  } };
  const target = actor(kind, position, hp), player = new PlayerActions(), bosses = new BossDamage();
  Object.assign(bosses, { activeBoss: kind === 'boss' ? target : null, time: 0,
    clear() { this.activeBoss = null; }, _updateAttackReadout() {} });
  const horde = { aliens: kind === 'alien' ? [target] : [] };
  Object.assign(player, { position: new THREE.Vector3(), rotationY: 0, plasmaEnergy: 100, plasmaPistolCooldown: 0,
    seegsonBoltAmmo: 10, seegsonBoltCooldown: 0, gameContext: { env: environment }, canUseArsenalEquipment: () => true,
    schedule(fn, delay) { queue.push({ fn, delay }); },
    _addOwnedEffect(object) { effects.push(object); scene.add(object); },
    _removeOwnedEffect(object) { scene.remove(object); object.traverse(part => { part.geometry?.dispose(); part.material?.dispose(); }); },
  });
  const particles = { emitSparks(point, count) { sparks.push({ point: point.clone(), count }); } };
  const ui = { showAnnouncement(message) { announcements.push(message); } };
  const fire = (providedEnvironment = environment) => weapon === 'pistol'
    ? player.firePlasmaPistol(horde, bosses, particles, providedEnvironment)
    : player.fireSeegsonBoltGun(horde, bosses, null, particles, ui);
  const flush = () => { while (queue.length) queue.shift().fn(); };
  return { player, bosses, target, horde, environment, colliders, queue, sparks, announcements, effects, rays, fire, flush };
}
function assertShotCost(f, weapon) {
  assert.equal(f.player.plasmaEnergy, weapon === 'pistol' ? 88 : 100);
  assert.equal(f.player.plasmaPistolCooldown, weapon === 'pistol' ? 0.42 : 0);
  assert.equal(f.player.seegsonBoltAmmo, weapon === 'pistol' ? 10 : 9);
  assert.equal(f.player.seegsonBoltCooldown, weapon === 'pistol' ? 0 : 1.6);
}
function assertNoTargetFeedback(f, weapon) {
  assert.equal(f.sparks.some(({ count }) => count === 6 || count === 8 || count === 14), false);
  if (weapon === 'bolt') assert.match(f.announcements.at(-1), /TIR À VIDE/);
}

for (const weapon of ['pistol', 'bolt']) {
  for (const kind of ['boss', 'alien']) {
    test(`${weapon} cannot damage a ${kind} through a real wall or report a target impact`, () => {
      const f = fixture(weapon, { kind, colliders: [wall()] });
      assert.equal(f.fire(), true); f.flush();
      assert.equal(f.target.hp, 10000); assertNoTargetFeedback(f, weapon); assertShotCost(f, weapon);
      if (weapon === 'pistol') assert.equal(f.sparks.filter(({ count }) => count === 5).length, 3);
      else assert.equal(f.effects.length, 1);
    });
  }
  test(`${weapon} retains damage and costs in open space, above low cover and with a wall beyond the target`, () => {
    for (const colliders of [[], [wall({ height: 0.2 })], [wall({ z: 18 })]]) {
      for (const kind of ['boss', 'alien']) {
        const f = fixture(weapon, { kind, colliders });
        assert.equal(f.fire(), true); f.flush();
        assert.equal(10000 - f.target.hp, weapon === 'pistol' ? 285 : 680);
        assertShotCost(f, weapon);
        if (weapon === 'bolt') assert.match(f.announcements.at(-1), /IMPACT CAUTÉRISANT/);
      }
    }
  });
  test(`${weapon} still respects its range and retains a shot cost when no target is reached`, () => {
    const f = fixture(weapon, { position: new THREE.Vector3(0, 0, weapon === 'pistol' ? 35 : 45) });
    assert.equal(f.fire(), true); f.flush();
    assert.equal(f.target.hp, 10000); assertNoTargetFeedback(f, weapon); assertShotCost(f, weapon);
  });
  test(`${weapon} still excludes an allied alien from the hit and its feedback`, () => {
    const f = fixture(weapon, { kind: 'alien' });
    f.target.factionId = 'player_clan';
    f.horde.battleSimulation = { config: { playerFaction: 'player_clan' }, areHostile: () => false };
    assert.equal(f.fire(), true); f.flush();
    assert.equal(f.target.hp, 10000); assertNoTargetFeedback(f, weapon);
  });
}

test('the pistol checks the real muzzle origin before all three cosmetic spark origins', () => {
  for (const kind of ['boss', 'alien']) {
    const f = fixture('pistol', { kind, colliders: [wall({ z: 0.8, halfDepth: 0.1 })] });
    assert.equal(f.fire(), true); f.flush();
    assert.equal(f.target.hp, 10000);
    assert.deepEqual(f.rays.map(ray => ray.from.toArray()), Array.from({ length: 3 }, () => [0.4, 1.8, 0.3]));
    assertNoTargetFeedback(f, 'pistol');
  }
});

test('the Seegson bolt uses its actual 2.3-high origin for a nearby overhead obstacle', () => {
  for (const kind of ['boss', 'alien']) {
    const f = fixture('bolt', { kind, colliders: [wall({ z: 0.4, halfDepth: 0.05, baseY: 2.1, height: 1 })] });
    assert.equal(f.fire(), true); f.flush();
    assert.equal(f.target.hp, 10000); assert.deepEqual(f.rays[0].from.toArray(), [0, 2.3, 0]);
    assertNoTargetFeedback(f, 'bolt');
  }
});

test('each delayed pistol bolt reevaluates physical cover before applying its damage', () => {
  const blocker = wall({ enabled: false }), f = fixture('pistol', { colliders: [blocker] });
  assert.equal(f.fire(), true); assert.deepEqual(f.queue.map(item => item.delay), [0, 85, 170]);
  f.queue.shift().fn(); blocker.enabled = true; f.flush();
  assert.equal(10000 - f.target.hp, 95); assert.equal(f.sparks.filter(({ count }) => count === 8).length, 1);
  assertShotCost(f, 'pistol');
});

test('pistol feedback remains safe when the real boss damage method clears a defeated boss', () => {
  const f = fixture('pistol', { hp: 50 });
  assert.equal(f.fire(), true); assert.doesNotThrow(f.flush);
  assert.equal(f.bosses.activeBoss, null); assert.equal(f.target.hp, 0);
  assert.equal(f.sparks.filter(({ count }) => count === 8).length, 1);
});

test('the pistol uses its supplied environment for boss and alien cover checks', () => {
  for (const kind of ['boss', 'alien']) {
    const f = fixture('pistol', { kind, colliders: [wall()] });
    f.player.gameContext.env = { hasLineOfSight: () => true };
    assert.equal(f.fire(f.environment), true); f.flush();
    assert.equal(f.target.hp, 10000); assertNoTargetFeedback(f, 'pistol');
  }
});

test('a hidden boss does not consume a pistol hit that can reach a visible hostile alien', () => {
  const f = fixture('pistol', { colliders: [wall({ halfWidth: 0.5 })] });
  const exposed = actor('alien', new THREE.Vector3(2.5, 0, 10)); f.horde.aliens.push(exposed);
  assert.equal(f.fire(), true); f.flush();
  assert.equal(f.target.hp, 10000); assert.equal(exposed.hp, 9715);
  assert.equal(f.sparks.filter(({ count }) => count === 8).length, 0);
  assert.equal(f.sparks.filter(({ count }) => count === 6).length, 3);
});

test('existing legacy alien callers retain their default origins, target offsets and absent-environment behavior', () => {
  const f = fixture('pistol', { kind: 'alien' });
  assert.equal(f.player._canHitLegacyAlien(f.horde, f.target), true);
  assert.deepEqual(f.rays[0].from.toArray(), [0, 2, 0]); assert.deepEqual(f.rays[0].to.toArray(), [0, 1.2, 10]);
  f.target.type = 'facehugger'; assert.equal(f.player._canHitLegacyAlien(f.horde, f.target), true);
  assert.deepEqual(f.rays[1].to.toArray(), [0, 0.2, 10]);
  f.player.gameContext.env = null;
  assert.equal(f.player._canHitLegacyAlien(f.horde, f.target), true);
});

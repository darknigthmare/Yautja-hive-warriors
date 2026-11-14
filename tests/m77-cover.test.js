import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { traceCombatSegment, hasCombatLineOfSight } from '../js/engine/CombatGeometry.js';
import { disposeObject } from '../js/engine/SceneResources.js';

const playerSource = fs.readFileSync(process.env.YHW_PLAYER_SOURCE || new URL('../js/entities/Player.js', import.meta.url), 'utf8');
const bossSource = fs.readFileSync(new URL('../js/entities/Bosses.js', import.meta.url), 'utf8');
function method(source, name) {
  const start = source.indexOf(`  ${name}(`), end = source.indexOf('\n  }', start);
  assert.notEqual(start, -1, `production method ${name}`);
  assert.notEqual(end, -1, `end of production method ${name}`);
  return source.slice(start, end + 4);
}
// Actual production methods and Three meshes; only scene services, audio and
// the clock are controlled. These CPU checks are not a WebGL visual review.
const PlayerActions = vm.runInNewContext(`(class { ${[
  'fireM77GaussRifle', '_canDamageLegacyAlien', '_canHitLegacyAlien',
  '_hasLegacyLineOfSight', '_defeatLegacyAlien', '_addOwnedEffect', '_removeOwnedEffect',
].map(name => method(playerSource, name)).join('\n')} })`, { THREE, disposeObject });
const BossDamage = vm.runInNewContext(`(class { ${['takeDamage', '_syncPhaseFromHealth']
  .map(name => method(bossSource, name)).join('\n')} })`, {
  THREE, recordCombatDeath: (_manager, actor) => ({ id: actor.id }),
});

const wall = (overrides = {}) => ({ x: 0, z: 5, halfWidth: 5, halfDepth: .5, height: 4, ...overrides });
function actor(id, position = new THREE.Vector3(0, 0, 10), hp = 10000) {
  const mesh = new THREE.Object3D(); mesh.position.copy(position);
  return { id, type: 'warrior', factionId: 'hostile', hp, maxHp: hp, phase: 1, mesh };
}
function fixture({ colliders = [], position = new THREE.Vector3(), rotation = 0, aliens = [], boss = null } = {}) {
  const scene = new THREE.Scene(), effects = [], removed = [], queue = [], traces = [], rays = [];
  const sparks = [], sounds = [], messages = [], deaths = [], pools = [];
  const environment = {
    traceSegment(from, to, options) {
      const hit = traceCombatSegment(from, to, colliders, options);
      traces.push({ from: from.clone(), to: to.clone(), options, hit });
      return hit;
    },
    hasLineOfSight(from, to, options) {
      rays.push({ from: from.clone(), to: to.clone(), options });
      return hasCombatLineOfSight(from, to, colliders, options);
    },
  };
  const horde = { aliens, spawnAcidPool(point) { pools.push(point.clone()); },
    defeatAlien(target, details) {
      deaths.push({ target, details });
      const index = this.aliens.indexOf(target);
      if (index >= 0) this.aliens.splice(index, 1);
      return { id: target.id };
    } };
  const bosses = new BossDamage();
  Object.assign(bosses, { activeBoss: boss, time: 0,
    clear() { this.activeBoss = null; }, _updateAttackReadout() {} });
  const player = new PlayerActions();
  Object.assign(player, {
    position: position.clone(), rotationY: rotation, m77GaussAmmo: 12, m77GaussCooldown: 0,
    scene, _effects: new Set(), _ownedFxDisposers: new Map(),
    gameContext: { env: environment, score: 0, comboHits: 0 }, _legacyDefeated: new WeakSet(),
    canUseArsenalEquipment: () => true,
    audioEngine: { playM77GaussRailgunFire() { sounds.push('m77'); } },
    schedule(callback, delay) { queue.push({ callback, delay }); },
    _addOwnedEffect(object, ...args) {
      effects.push(object); return PlayerActions.prototype._addOwnedEffect.call(this, object, ...args);
    },
    _removeOwnedEffect(object) {
      if (this._effects.has(object)) removed.push(object);
      return PlayerActions.prototype._removeOwnedEffect.call(this, object);
    },
  });
  const forward = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation)).normalize();
  const origin = position.clone().add(new THREE.Vector3(0, 1.8, 0));
  const particles = { emitSparks(point, count) { sparks.push({ point: point.clone(), count }); } };
  const fire = (providedEnvironment = environment) => player.fireM77GaussRifle(horde, bosses, null,
    providedEnvironment, particles, { showAnnouncement(message) { messages.push(message); } });
  return { player, horde, bosses, environment, colliders, scene, effects, removed, queue, traces, rays,
    sparks, sounds, messages, deaths, pools, forward, origin, fire };
}
function near(actual, expected, label, epsilon = 1e-5) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= epsilon,
    `${label}: expected ${expected}, got ${actual}`);
}
function vertices(mesh) {
  mesh.updateWorldMatrix(true, false);
  const positions = mesh.geometry.getAttribute('position');
  return Array.from({ length: positions.count }, (_, index) =>
    new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld));
}
function meshes(f, type) {
  return f.effects.flatMap(effect => effect.children).filter(mesh => mesh.geometry?.type === type);
}
function assertBeam(f, length) {
  assert.equal(f.effects.length, 1);
  const beams = meshes(f, 'CylinderGeometry'); assert.equal(beams.length, 1);
  const beam = beams[0], points = vertices(beam), along = [], radii = [];
  for (const point of points) {
    const offset = point.sub(f.origin), distance = offset.dot(f.forward);
    along.push(distance); radii.push(offset.addScaledVector(f.forward, -distance).length());
  }
  near(Math.min(...along), 0, 'beam begins at actual muzzle');
  near(Math.max(...along), length, 'beam ends at physical cover');
  near(Math.max(...radii), .08, 'M77 beam radius');
  near(beam.position.distanceTo(f.origin.clone().addScaledVector(f.forward, length / 2)), 0, 'beam center');
  assert.equal(beam.material.color.getHex(), 0x38bdf8);
  assert.equal(beam.material.opacity, .95);
  for (const ring of meshes(f, 'TorusGeometry')) {
    for (const point of vertices(ring)) {
      const distance = point.sub(f.origin).dot(f.forward);
      assert.ok(distance >= -1e-5 && distance <= length + 1e-5, 'whole ring stays within physical beam segment');
    }
  }
  return beam;
}
function assertCost(f, hits = 0) {
  assert.equal(f.player.m77GaussAmmo, 11);
  assert.equal(f.player.m77GaussCooldown, 1.35);
  assert.deepEqual(f.sounds, ['m77']);
  assert.match(f.messages.at(-1), new RegExp(`${hits} CIBLES TRANSPERCÉES.*\\(11/12\\)`));
}

test('M77 keeps its 45-unit beam, six original ion rings, damage and shot cost in open space', () => {
  const alien = actor('alien'), boss = actor('boss', new THREE.Vector3(0, 0, 20));
  boss.type = 'queen';
  const f = fixture({ aliens: [alien], boss }); assert.equal(f.fire(), true);
  assertBeam(f, 45); assertCost(f, 2);
  assert.equal(alien.hp, 9450); assert.equal(boss.hp, 9450);
  const rings = meshes(f, 'TorusGeometry'); assert.equal(rings.length, 6);
  for (let index = 0; index < rings.length; index++) {
    near(rings[index].position.clone().sub(f.origin).dot(f.forward), (index + 1) * 6.5, 'original ring position');
    near(rings[index].geometry.parameters.radius, .45 + (index + 1) * .08, 'original ring radius');
    assert.equal(rings[index].material.color.getHex(), 0x00f2fe);
  }
});

test('M77 stops at the nearest physical wall regardless of collider order or render visibility', () => {
  for (const colliders of [[wall(), wall({ z: 20 })], [wall({ z: 20 }), wall()],
    [wall({ mesh: { visible: false } })], [wall({ z: .4, halfDepth: .05 })]]) {
    const f = fixture({ colliders }); assert.equal(f.fire(), true);
    assertBeam(f, colliders[0].z === .4 ? .27 : 4.42); assertCost(f);
    assert.equal(meshes(f, 'TorusGeometry').length, 0);
  }
});

test('M77 beam follows a displaced and rotated muzzle against rotated walls and cylinders', () => {
  const position = new THREE.Vector3(7, 3, -11), rotation = Math.PI / 3;
  const forward = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation));
  const center = position.clone().addScaledVector(forward, 10);
  for (const [collider, expected] of [
    [wall({ x: center.x, z: center.z, baseY: 3, rotation }), 9.42],
    [{ x: center.x, z: center.z, baseY: 3, height: 4, radius: 1 }, 8.92],
  ]) {
    const f = fixture({ colliders: [collider], position, rotation });
    assert.equal(f.fire(), true); assertBeam(f, expected); assertCost(f);
  }
});

test('M77 uses its 1.8-high muzzle and full beam radius beside low and overhead cover', () => {
  for (const [collider, expected] of [
    [wall({ height: 1.70 }), 45], [wall({ height: 1.75 }), 4.42],
    [wall({ baseY: 1.85, height: 1 }), 4.42], [wall({ baseY: 1.90, height: 1 }), 45],
  ]) {
    const f = fixture({ colliders: [collider] }); assert.equal(f.fire(), true); assertBeam(f, expected);
  }
});

test('M77 beam radius hits lateral cover missed by a zero-width center line', () => {
  for (const [x, expected] of [[.55, 4.42], [.59, 45]]) {
    const collider = wall({ x, halfWidth: .5 });
    assert.equal(traceCombatSegment(new THREE.Vector3(0, 1.8, 0), new THREE.Vector3(0, 1.8, 45), [collider]), null);
    const f = fixture({ colliders: [collider] }); assert.equal(f.fire(), true); assertBeam(f, expected);
  }
});

test('M77 ignores distant, disabled, nonblocking and destroyed colliders', () => {
  for (const collider of [wall({ z: 46 }), wall({ enabled: false }), wall({ solid: false }),
    wall({ blocksProjectiles: false }), wall({ projectileBlocker: false }), wall({ isCollisionActive: () => false })]) {
    const f = fixture({ colliders: [collider] }); assert.equal(f.fire(), true); assertBeam(f, 45); assertCost(f);
  }
});

test('M77 reconstructs the endpoint when a custom collider reports only a normalized fraction', () => {
  const f = fixture({ colliders: [{ resolveMovement() {}, traceSegment: () => ({ t: .25 }) }] });
  assert.equal(f.fire(), true); assertBeam(f, 11.25); assertCost(f);
  assert.equal(f.traces[0].hit.point, undefined); assert.equal(f.traces[0].hit.distance, undefined);
});

test('M77 does not create a beam, ring or cleanup timer when the muzzle is inside cover', () => {
  const boss = actor('boss'); boss.type = 'queen';
  const alien = actor('alien'), f = fixture({ colliders: [wall({ z: 0 })], aliens: [alien], boss });
  assert.equal(f.fire(), true); assertCost(f);
  assert.equal(f.effects.length, 0); assert.equal(f.queue.length, 0);
  assert.equal(alien.hp, 10000); assert.equal(boss.hp, 10000); assert.equal(f.sparks.length, 0);
});

test('M77 removes only its own effects after 220ms, including when removed before the timer fires', () => {
  for (const early of [false, true]) {
    const f = fixture(); assert.equal(f.fire(), true);
    const effect = f.effects[0], unrelated = new THREE.Object3D(); f.scene.add(unrelated);
    const disposals = [];
    effect.traverse(part => {
      for (const resource of [part.geometry, part.material].filter(Boolean)) {
        const record = { count: 0 }; disposals.push(record);
        resource.addEventListener('dispose', () => record.count++);
      }
    });
    assert.equal(f.queue.length, 1); assert.equal(f.queue[0].delay, 220);
    if (early) f.player._removeOwnedEffect(effect);
    f.queue[0].callback();
    assert.equal(effect.parent, null); assert.equal(unrelated.parent, f.scene);
    assert.equal(f.removed.length, 1, 'one owned resource cleanup');
    assert.ok(f.removed[0] === effect, 'cleanup belongs to this shot'); assert.ok(disposals.length > 0);
    assert.ok(disposals.every(record => record.count === 1), 'every owned resource disposed exactly once');
  }
});

test('M77 does not damage or report an alien or boss behind a wall', () => {
  const alien = actor('alien'), boss = actor('boss'); boss.type = 'queen';
  const f = fixture({ aliens: [alien], boss, colliders: [wall()] });
  assert.equal(f.fire(), true); assertCost(f);
  assert.equal(alien.hp, 10000); assert.equal(boss.hp, 10000);
  assert.equal(f.sparks.length, 0); assert.equal(f.deaths.length, 0);
});

test('M77 assisted targets cannot bypass the first obstacle on the actual firing axis', () => {
  const collider = wall({ halfWidth: .2 });
  const alien = actor('alien', new THREE.Vector3(1.5, 0, 10));
  const boss = actor('boss', new THREE.Vector3(1.5, 0, 10)); boss.type = 'queen';
  const f = fixture({ aliens: [alien], boss, colliders: [collider] });
  assert.equal(hasCombatLineOfSight(f.origin, alien.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), [collider]), true,
    'the assisted target is visible beside the barrier, while the actual shot hits it');
  assert.equal(f.fire(), true); assertCost(f);
  assertBeam(f, 4.42); assert.equal(alien.hp, 10000); assert.equal(boss.hp, 10000);
  assert.equal(f.sparks.length, 0);
});

test('M77 retains exposed damage with low cover, a wall behind targets and targets before a wall', () => {
  for (const colliders of [[], [wall({ height: .2 })], [wall({ z: 18 })]]) {
    const alien = actor('alien'), boss = actor('boss'); boss.type = 'queen';
    const f = fixture({ aliens: [alien], boss, colliders }); assert.equal(f.fire(), true); assertCost(f, 2);
    assert.equal(alien.hp, 9450); assert.equal(boss.hp, 9450);
    assert.equal(f.sparks.length, 1); assert.equal(f.sparks[0].count, 8);
  }
});

test('M77 uses the explicitly supplied environment for both damage and visible effects', () => {
  for (const blocked of [true, false]) {
    const alien = actor('alien'), boss = actor('boss'); boss.type = 'queen';
    const f = fixture({ aliens: [alien], boss, colliders: blocked ? [wall()] : [] });
    f.player.gameContext.env = {
      traceSegment: () => blocked ? null : ({ t: .1 }), hasLineOfSight: () => blocked,
    };
    assert.equal(f.fire(), true); assertCost(f, blocked ? 0 : 2);
    assert.equal(alien.hp, blocked ? 10000 : 9450); assert.equal(boss.hp, blocked ? 10000 : 9450);
    assertBeam(f, blocked ? 4.42 : 45);
  }
});

test('M77 falls back to its context environment and still works when no environment exists', () => {
  for (const absent of [false, true]) {
    const alien = actor('alien'), boss = actor('boss'); boss.type = 'queen';
    const f = fixture({ aliens: [alien], boss, colliders: [wall()] });
    if (absent) f.player.gameContext.env = null;
    assert.equal(f.fire(null), true); assertCost(f, absent ? 2 : 0);
    assertBeam(f, absent ? 45 : 4.42);
    assert.equal(alien.hp, absent ? 9450 : 10000); assert.equal(boss.hp, absent ? 9450 : 10000);
  }
});

test('M77 uses its real muzzle for very close obstacles before the legacy default origin', () => {
  const alien = actor('alien'), boss = actor('boss'); boss.type = 'queen';
  const f = fixture({ aliens: [alien], boss, colliders: [wall({ z: .25, halfDepth: .05, baseY: 1.6, height: .3 })] });
  assert.equal(f.fire(), true); assertCost(f);
  assert.equal(alien.hp, 10000); assert.equal(boss.hp, 10000);
  assert.ok(f.rays.every(ray => ray.from.equals(f.origin)), 'all actor cover checks use the muzzle');
});

test('M77 preserves its 15-alien cap, reverse iteration order and separate boss hit', () => {
  const aliens = Array.from({ length: 18 }, (_, index) => actor(`alien-${index}`, new THREE.Vector3(0, 0, 2 + index)));
  const boss = actor('boss', new THREE.Vector3(0, 0, 24)); boss.type = 'queen';
  const f = fixture({ aliens, boss }); assert.equal(f.fire(), true); assertCost(f, 16);
  assert.deepEqual(aliens.map(a => a.hp), aliens.map((_, index) => index < 3 ? 10000 : 9450));
  assert.equal(boss.hp, 9450); assert.equal(f.sparks.length, 15);
});

test('M77 leaves allied, dead, behind, off-axis and out-of-range aliens untouched', () => {
  const allies = actor('ally'), dead = actor('dead', new THREE.Vector3(0, 0, 12), 0);
  allies.factionId = 'player_clan';
  const behind = actor('behind', new THREE.Vector3(0, 0, -5));
  const far = actor('far', new THREE.Vector3(0, 0, 46));
  const side = actor('side', new THREE.Vector3(8, 0, 10));
  const alien = actor('valid', new THREE.Vector3(0, 0, 10));
  const f = fixture({ aliens: [allies, dead, behind, far, side, alien] });
  f.horde.battleSimulation = { config: { playerFaction: 'player_clan' }, areHostile: (_source, target) => target !== 'player_clan' };
  assert.equal(f.fire(), true); assertCost(f, 1);
  assert.equal(alien.hp, 9450);
  for (const untouched of [allies, behind, far, side]) assert.equal(untouched.hp, 10000);
  assert.equal(dead.hp, 0); assert.equal(f.sparks.length, 1);
});

test('M77 preserves the boss cone and range and safely handles an immediately defeated boss', () => {
  for (const position of [new THREE.Vector3(0, 0, -5), new THREE.Vector3(0, 0, 46), new THREE.Vector3(20, 0, 10)]) {
    const boss = actor('excluded-boss', position); boss.type = 'queen';
    const f = fixture({ boss }); assert.equal(f.fire(), true); assertCost(f); assert.equal(boss.hp, 10000);
  }
  const boss = actor('fragile-boss', new THREE.Vector3(0, 0, 10), 100); boss.type = 'queen';
  const f = fixture({ boss }); assert.doesNotThrow(() => f.fire());
  assert.equal(boss.hp, 0); assert.equal(f.bosses.activeBoss, null); assertCost(f, 1);
});

test('M77 lethal piercing still delegates each alien death once to its owner', () => {
  const first = actor('first', new THREE.Vector3(0, 0, 4), 100);
  const second = actor('second', new THREE.Vector3(0, 0, 8), 100);
  const f = fixture({ aliens: [first, second] }); assert.equal(f.fire(), true); assertCost(f, 2);
  assert.deepEqual(f.deaths.map(entry => entry.target.id), ['second', 'first']);
  assert.equal(f.horde.aliens.length, 0); assert.equal(f.pools.length, 2);
  assert.equal(f.player.gameContext.comboHits, 2); assert.equal(f.player.gameContext.score, 380);
});

test('M77 rings cannot extend past near cover or intersect lateral obstacles missed by the beam', () => {
  const front = fixture({ colliders: [wall({ z: 7.1 })] }); assert.equal(front.fire(), true); assertBeam(front, 6.52);
  const collider = wall({ x: .55, z: 6.5, halfWidth: .05, halfDepth: .25 });
  const f = fixture({ colliders: [collider] }); assert.equal(f.fire(), true); assertBeam(f, 45);
  const rings = meshes(f, 'TorusGeometry'); assert.ok(rings.length < 6, 'at least the intersecting ring is suppressed');
  for (const ring of rings) {
    for (const point of vertices(ring)) {
      const inside = Math.abs(point.x - collider.x) < collider.halfWidth &&
        Math.abs(point.z - collider.z) < collider.halfDepth && point.y > 0 && point.y < collider.height;
      assert.equal(inside, false, 'ring surface stays outside physical lateral cover');
    }
  }
});

test('M77 rejection by arsenal, cooldown or empty ammunition spends nothing and creates no effects', () => {
  for (const reason of ['arsenal', 'cooldown', 'ammunition']) {
    const f = fixture();
    if (reason === 'arsenal') f.player.canUseArsenalEquipment = () => false;
    if (reason === 'cooldown') f.player.m77GaussCooldown = .5;
    if (reason === 'ammunition') f.player.m77GaussAmmo = 0;
    const beforeAmmo = f.player.m77GaussAmmo, beforeCooldown = f.player.m77GaussCooldown;
    assert.equal(f.fire(), false);
    assert.equal(f.player.m77GaussAmmo, beforeAmmo); assert.equal(f.player.m77GaussCooldown, beforeCooldown);
    assert.equal(f.effects.length, 0); assert.equal(f.queue.length, 0); assert.equal(f.sounds.length, 0);
    assert.equal(f.traces.length, 0);
  }
});

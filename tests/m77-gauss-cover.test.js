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
  assert.notEqual(end, -1, `end of ${name}`);
  return source.slice(start, end + 4);
}
// Execute production firing, visibility, death delegation and effect ownership
// with real r160 meshes and combat intersections. Rendering, clock, UI and scene
// resource disposal are controlled services, not a browser or GPU measurement.
const PlayerActions = vm.runInNewContext(`(class { ${[
  'fireM77GaussRifle', '_canDamageLegacyAlien', '_canHitLegacyAlien', '_hasLegacyLineOfSight',
  '_defeatLegacyAlien', '_addOwnedEffect', '_removeOwnedEffect',
].map(name => method(playerSource, name)).join('\n')} })`, {
  THREE,
  disposeObject(object) {
    object.removeFromParent();
    object.traverse(part => { part.geometry?.dispose(); part.material?.dispose(); });
  },
});
const BossDamage = vm.runInNewContext(`(class { ${['takeDamage', '_syncPhaseFromHealth']
  .map(name => method(bossSource, name)).join('\n')} })`, {
  THREE,
  recordCombatDeath(manager, actor, details) {
    const event = { id: actor.id, ...details }; manager.deaths.push(event); return event;
  },
});
const wall = (overrides = {}) => ({ x: 0, z: 10, halfWidth: 5, halfDepth: 0.2, height: 4, ...overrides });
function actor(id, position = new THREE.Vector3(0, 0, 15), hp = 10000) {
  const mesh = new THREE.Object3D(); mesh.position.copy(position);
  return { id, type: id === 'boss' ? 'queen' : 'warrior', factionId: 'hostile', mesh, hp, maxHp: hp, phase: 1 };
}
function fixture({ colliders = [], aliens = [], boss = null, synthetics = [], position = new THREE.Vector3(), rotation = 0 } = {}) {
  const effects = [], queue = [], sounds = [], messages = [], sparks = [], traces = [], rays = [], defeats = [], acid = [], gore = [];
  const scene = new THREE.Scene();
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
  const horde = { aliens, centralDeathScoring: true,
    spawnAcidPool(point) { acid.push(point.clone()); },
    goreEngine: { spawnDismemberment(point, kind) { gore.push({ point: point.clone(), kind }); } },
    defeatAlien(target, details) {
      defeats.push({ target, details }); const index = this.aliens.indexOf(target);
      if (index >= 0) this.aliens.splice(index, 1);
      return { id: target.id, ...details };
    },
  };
  const bosses = new BossDamage();
  Object.assign(bosses, { activeBoss: boss, time: 0, deaths: [], clears: 0,
    clear() { this.clears++; this.activeBoss = null; }, _updateAttackReadout() {} });
  const player = new PlayerActions();
  Object.assign(player, { position: position.clone(), rotationY: rotation, scene,
    _effects: new Set(), _ownedFxDisposers: new Map(), _legacyDefeated: new WeakSet(),
    m77GaussAmmo: 12, m77GaussCooldown: 0, gameContext: { env: environment, score: 0, comboHits: 0 },
    canUseArsenalEquipment: () => true,
    audioEngine: { playM77GaussRailgunFire() { sounds.push('m77'); } },
    schedule(callback, delay) { queue.push({ callback, delay }); },
    _addOwnedEffect(object, ...args) { effects.push(object); return PlayerActions.prototype._addOwnedEffect.call(this, object, ...args); },
  });
  const particles = { emitSparks(point, count) { sparks.push({ point: point.clone(), count }); } };
  const ui = { showAnnouncement(message) { messages.push(message); } };
  const fire = (...args) => player.fireM77GaussRifle(horde, bosses, { androids: synthetics }, args.length ? args[0] : environment, particles, ui);
  const forward = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation)).normalize();
  const origin = position.clone().add(new THREE.Vector3(0, 1.8, 0));
  return { player, horde, bosses, scene, effects, queue, sounds, messages, sparks, traces, rays, defeats, acid, gore,
    environment, colliders, origin, forward, fire };
}
function near(actual, expected, label, epsilon = 1e-5) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= epsilon,
    `${label}: expected ${expected}, got ${actual}`);
}
function assertCost(f, targets) {
  assert.equal(f.player.m77GaussAmmo, 11); assert.equal(f.player.m77GaussCooldown, 1.35);
  assert.deepEqual(f.sounds, ['m77']);
  assert.ok(f.messages.at(-1).includes(`${targets} CIBLES TRANSPERCÉES`));
  assert.ok(f.messages.at(-1).endsWith('(11/12)'));
}
function visibleVertices(mesh) {
  mesh.updateMatrixWorld(true); const positions = mesh.geometry.getAttribute('position');
  return Array.from({ length: positions.count }, (_, index) =>
    new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld));
}
function assertBeam(f, length) {
  assert.equal(f.effects.length, 1, 'one owned effect group');
  const beam = f.effects[0].children.find(mesh => mesh.geometry.type === 'CylinderGeometry');
  assert.ok(beam, 'visible beam mesh'); f.effects[0].updateMatrixWorld(true);
  near(beam.position.distanceTo(f.origin.clone().addScaledVector(f.forward, length / 2)), 0, 'beam center');
  const along = [], radii = [];
  for (const point of visibleVertices(beam)) {
    const offset = point.sub(f.origin), distance = offset.dot(f.forward); along.push(distance);
    radii.push(offset.addScaledVector(f.forward, -distance).length());
  }
  near(Math.min(...along), 0, 'beam muzzle'); near(Math.max(...along), length, 'beam physical endpoint');
  near(Math.max(...radii), 0.08, 'beam radius');
  assert.equal(beam.material.color.getHex(), 0x38bdf8); assert.equal(beam.material.opacity, 0.95);
  return beam;
}
const rings = f => f.effects.flatMap(group => group.children.filter(mesh => mesh.geometry.type === 'TorusGeometry'));
function containsBoxPoint(collider, point) {
  const local = point.clone().sub(new THREE.Vector3(collider.x, collider.baseY ?? 0, collider.z))
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), -(collider.rotation ?? 0));
  return Math.abs(local.x) < collider.halfWidth - 1e-6 && Math.abs(local.z) < collider.halfDepth - 1e-6 &&
    local.y > 1e-6 && local.y < collider.height - 1e-6;
}
function assertNoBoxOverlap(f, collider) {
  for (const group of f.effects) {
    group.updateMatrixWorld(true);
    for (const mesh of group.children) assert.equal(visibleVertices(mesh).some(point => containsBoxPoint(collider, point)), false,
      `${mesh.geometry.type} has no visible vertex inside physical cover`);
  }
}

test('M77 preserves its full beam, six ring centers, colors and shot costs in clear space', () => {
  for (const [position, rotation] of [[new THREE.Vector3(), 0], [new THREE.Vector3(7, 3, -11), Math.PI / 3]]) {
    const f = fixture({ position, rotation }); assert.equal(f.fire(), true); assertBeam(f, 45); assertCost(f, 0);
    assert.equal(rings(f).length, 6);
    rings(f).forEach((ring, index) => {
      near(ring.position.distanceTo(f.origin.clone().addScaledVector(f.forward, (index + 1) * 6.5)), 0, 'historical ring center');
      near(ring.geometry.parameters.radius, 0.45 + (index + 1) * 0.08, 'ring radius');
      assert.equal(ring.geometry.parameters.tube, 0.04); assert.equal(ring.material.color.getHex(), 0x00f2fe);
      assert.equal(ring.material.opacity, 0.85);
    });
    assert.equal(f.queue.length, 1); assert.equal(f.queue[0].delay, 220);
  }
});

test('M77 cannot damage a boss or alien through real physical cover or count a hidden target', () => {
  for (const kind of ['boss', 'alien']) {
    const target = actor(kind), f = fixture({ colliders: [wall()], [kind === 'boss' ? 'boss' : 'aliens']: kind === 'boss' ? target : [target] });
    assert.equal(f.fire(), true); assert.equal(target.hp, 10000); assertCost(f, 0); assert.deepEqual(f.sparks, []);
    assertBeam(f, 9.72); assert.equal(rings(f).length, 1); assertNoBoxOverlap(f, f.colliders[0]);
  }
});

test('M77 keeps 550 damage in open space, over low cover and before a wall beyond either target', () => {
  for (const colliders of [[], [wall({ height: 0.2 })], [wall({ z: 20 })]]) {
    const boss = actor('boss'), alien = actor('alien'), f = fixture({ colliders, boss, aliens: [alien] });
    assert.equal(f.fire(), true); assert.equal(boss.hp, 9450); assert.equal(alien.hp, 9450); assertCost(f, 2);
    assert.equal(f.sparks.length, 1); assert.equal(f.sparks[0].count, 8);
    assert.equal(f.rays.length, 2);
    for (const ray of f.rays) { assert.deepEqual(ray.from.toArray(), [0, 1.8, 0]); assert.equal(ray.options.radius, 0.03); }
  }
});

test('M77 keeps actor range, facing, faction and historical lateral admission independently of ring clearance', () => {
  const boss = actor('boss', new THREE.Vector3(0, 0, 45.01));
  const hostile = actor('hostile', new THREE.Vector3(0, 0, 15));
  const ally = actor('ally', new THREE.Vector3(0, 0, 12)); ally.factionId = 'player_clan';
  const behind = actor('behind', new THREE.Vector3(0, 0, -10)), distant = actor('distant', new THREE.Vector3(0, 0, 46));
  const lateral = actor('lateral', new THREE.Vector3(3, 0, 12));
  const f = fixture({ boss, aliens: [hostile, ally, behind, distant, lateral], colliders: [wall({ x: 1, z: 39, halfWidth: 0.1, halfDepth: 0.3 })] });
  f.horde.battleSimulation = { config: { playerFaction: 'player_clan' }, areHostile: (_from, to) => to === 'hostile' };
  assert.equal(f.fire(), true); assert.equal(hostile.hp, 9450);
  for (const target of [boss, ally, behind, distant, lateral]) assert.equal(target.hp, 10000);
  assertCost(f, 1);
});

test('M77 uses the supplied environment consistently for boss, alien and beam, with context fallback', () => {
  for (const useContext of [false, true]) {
    const boss = actor('boss'), alien = actor('alien'), f = fixture({ boss, aliens: [alien], colliders: [wall()] });
    if (!useContext) f.player.gameContext.env = { traceSegment: () => null, hasLineOfSight: () => true };
    assert.equal(f.fire(useContext ? undefined : f.environment), true);
    assert.equal(boss.hp, 10000); assert.equal(alien.hp, 10000); assertBeam(f, 9.72); assertCost(f, 0);
  }
  const boss = actor('boss'), alien = actor('alien'), f = fixture({ boss, aliens: [alien], colliders: [wall()] });
  assert.equal(f.fire({ traceSegment: () => null, hasLineOfSight: () => true }), true);
  assert.equal(boss.hp, 9450); assert.equal(alien.hp, 9450); assertBeam(f, 45); assertCost(f, 2);
});

test('M77 stops visible vertices at the nearest wall, including close, hidden or oblique cover', () => {
  for (const [colliders, length] of [
    [[wall({ z: 25 }), wall()], 9.72],
    [[wall({ z: 0.4, halfDepth: 0.05 })], 0.27],
    [[wall({ mesh: { visible: false } })], 9.72],
    [[wall({ rotation: Math.PI / 4 })], 10 - 0.28 / Math.cos(Math.PI / 4)],
  ]) {
    const f = fixture({ colliders }); assert.equal(f.fire(), true); assertBeam(f, length); assertCost(f, 0);
    for (const collider of colliders) assertNoBoxOverlap(f, collider);
    for (const ring of rings(f)) assert.ok(ring.position.clone().sub(f.origin).dot(f.forward) < length);
  }
});

test('M77 transformed beam follows the shooter and rotated or cylindrical physical cover', () => {
  const position = new THREE.Vector3(7, 3, -11), rotation = Math.PI / 3;
  const forward = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation));
  const center = position.clone().addScaledVector(forward, 10);
  for (const [collider, length] of [
    [wall({ x: center.x, z: center.z, baseY: 3, rotation }), 9.72],
    [{ x: center.x, z: center.z, baseY: 3, height: 4, radius: 1 }, 8.92],
  ]) {
    const f = fixture({ colliders: [collider], position, rotation }); assert.equal(f.fire(), true); assertBeam(f, length);
    if (collider.halfWidth) assertNoBoxOverlap(f, collider);
  }
});

test('M77 beam radius and muzzle height stop glancing cover missed by the center line', () => {
  for (const [collider, length] of [
    [wall({ x: 0.54, halfWidth: 0.5 }), 9.72], [wall({ x: 0.59, halfWidth: 0.5 }), 45],
    [wall({ height: 1.75 }), 9.72], [wall({ height: 1.71 }), 45],
    [wall({ baseY: 1.85, height: 1 }), 9.72], [wall({ baseY: 1.89, height: 1 }), 45],
  ]) {
    const f = fixture({ colliders: [collider] });
    assert.equal(traceCombatSegment(f.origin, f.origin.clone().addScaledVector(f.forward, 45), [collider]), null);
    assert.equal(f.fire(), true); assertBeam(f, length); assertNoBoxOverlap(f, collider);
  }
});

test('M77 omits a ring whose outer volume overlaps side cover while the central beam stays clear', () => {
  const collider = wall({ x: 1, z: 39, halfWidth: 0.1, halfDepth: 0.3 }), f = fixture({ colliders: [collider] });
  const historical = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.04, 6, 16), new THREE.MeshBasicMaterial());
  historical.position.set(0, 1.8, 39); historical.lookAt(new THREE.Vector3(0, 1.8, 45));
  assert.ok(visibleVertices(historical).some(point => containsBoxPoint(collider, point)), 'the historical torus intersects this wall');
  historical.geometry.dispose(); historical.material.dispose();
  assert.equal(traceCombatSegment(f.origin, new THREE.Vector3(0, 1.8, 45), [collider], { radius: 0.08 }), null);
  assert.equal(f.fire(), true); assertBeam(f, 45); assert.equal(rings(f).length, 5); assertNoBoxOverlap(f, collider);
  assert.deepEqual(rings(f).map(ring => ring.position.z), [6.5, 13, 19.5, 26, 32.5]);
});

test('M77 ring clearance is deliberately conservative along its route without widening actor damage', () => {
  const collider = wall({ x: 0.9, z: 34, halfWidth: 0.1, halfDepth: 0.2 });
  const target = actor('alien', new THREE.Vector3(0, 0, 40)), f = fixture({ colliders: [collider], aliens: [target] });
  assert.equal(f.fire(), true); assertBeam(f, 45); assert.equal(rings(f).length, 5); assert.equal(target.hp, 9450);
  assertCost(f, 1); assert.equal(f.rays[0].options.radius, 0.03);
  // The final ring center would be clear: its swept outer volume met cover earlier.
  assert.equal(containsBoxPoint(collider, new THREE.Vector3(0, 1.8, 39)), false);
  assertNoBoxOverlap(f, collider);
});

test('M77 leaves nonblocking, disabled, destroyed and beyond-range cover out of its visible path', () => {
  for (const collider of [wall({ z: 46 }), wall({ enabled: false }), wall({ solid: false }),
    wall({ blocksProjectiles: false }), wall({ projectileBlocker: false }), wall({ isCollisionActive: () => false })]) {
    const target = actor('boss'), f = fixture({ colliders: [collider], boss: target });
    assert.equal(f.fire(), true); assertBeam(f, 45); assert.equal(rings(f).length, 6); assert.equal(target.hp, 9450); assertCost(f, 1);
  }
});

test('M77 accepts physical custom colliders with only a normalized impact fraction', () => {
  const f = fixture({ colliders: [{ resolveMovement() {}, traceSegment: () => ({ t: 0.25 }) }] });
  assert.equal(f.fire(), true); assertBeam(f, 11.25); assert.equal(rings(f).length, 0);
  assert.equal(f.traces[0].hit.point, undefined); assert.equal(f.traces[0].hit.distance, undefined); assertCost(f, 0);
});

test('M77 allocates no mesh, group or cleanup timer when its muzzle is inside physical cover', () => {
  const f = fixture({ colliders: [wall({ z: 0 })], boss: actor('boss') });
  assert.equal(f.fire(), true); assertCost(f, 0); assert.equal(f.bosses.activeBoss.hp, 10000);
  assert.equal(f.effects.length, 0); assert.equal(f.queue.length, 0); assert.equal(f.player._effects.size, 0);
});

test('M77 preserves the legacy budget of 15 reversed aliens plus a separate boss, with no synthetic hits', () => {
  const aliens = Array.from({ length: 16 }, (_, index) => actor(`alien-${index + 1}`, new THREE.Vector3(0, 0, 2 + index * 2)));
  const boss = actor('boss', new THREE.Vector3(0, 0, 34)), synthetic = actor('synthetic', new THREE.Vector3(0, 0, 8));
  const f = fixture({ aliens, boss, synthetics: [synthetic] });
  assert.equal(f.fire(), true); assert.equal(aliens[0].hp, 10000);
  assert.equal(aliens.filter(target => target.hp === 9450).length, 15); assert.equal(boss.hp, 9450);
  assert.equal(synthetic.hp, 10000); assertCost(f, 16);
});

test('M77 delegates lethal aliens and bosses to their owners and counts nonlethal boss damage despite a null return', () => {
  for (const hp of [500, 10000]) {
    const target = actor('boss', new THREE.Vector3(0, 0, 15), hp), f = fixture({ boss: target });
    assert.equal(f.fire(), true); assert.equal(target.hp, Math.max(0, hp - 550)); assertCost(f, 1);
    assert.equal(f.bosses.clears, hp <= 550 ? 1 : 0); assert.equal(f.bosses.deaths.length, hp <= 550 ? 1 : 0);
    assert.equal(f.bosses.activeBoss, hp <= 550 ? null : target);
  }
  const target = actor('alien', new THREE.Vector3(0, 0, 15), 500), f = fixture({ aliens: [target] });
  f.horde.battleSimulation = { config: { playerFaction: 'player_clan' }, areHostile: () => true };
  assert.equal(f.fire(), true); assertCost(f, 1); assert.equal(f.defeats.length, 1);
  assert.equal(f.defeats[0].target, target); assert.equal(f.defeats[0].details.cause, 'legacy_weapon');
  assert.equal(f.defeats[0].details.killerFaction, 'player_clan'); assert.equal(f.horde.aliens.length, 0);
  assert.equal(f.acid.length, 1); assert.equal(f.gore[0].kind, 'heavy');
  assert.equal(f.player.gameContext.score, 0); assert.equal(f.player.gameContext.comboHits, 0);
});

test('M77 keeps arsenal, cooldown and empty-ammo refusals free of effects or costs', () => {
  for (const guard of ['arsenal', 'cooldown', 'ammo']) {
    const target = actor('boss'), f = fixture({ boss: target });
    if (guard === 'arsenal') f.player.canUseArsenalEquipment = () => false;
    if (guard === 'cooldown') f.player.m77GaussCooldown = 0.1;
    if (guard === 'ammo') f.player.m77GaussAmmo = 0;
    assert.equal(f.fire(), false); assert.equal(f.player.m77GaussAmmo, guard === 'ammo' ? 0 : 12);
    assert.equal(f.player.m77GaussCooldown, guard === 'cooldown' ? 0.1 : 0);
    assert.equal(f.effects.length, 0); assert.equal(f.queue.length, 0); assert.equal(f.traces.length, 0);
    assert.equal(f.sounds.length, 0); assert.equal(target.hp, 10000);
  }
});

test('M77 effect ownership cleans every mesh once at 220ms, including detached or previously removed effects', () => {
  for (const early of ['none', 'detach', 'dispose']) {
    const f = fixture(); assert.equal(f.fire(), true);
    const group = f.effects[0], unrelated = new THREE.Object3D(); f.scene.add(unrelated);
    let geometryDisposals = 0, materialDisposals = 0;
    for (const mesh of group.children) {
      mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
      mesh.material.addEventListener('dispose', () => materialDisposals++);
    }
    assert.equal(f.queue.length, 1); assert.equal(f.queue[0].delay, 220);
    if (early === 'detach') group.removeFromParent();
    if (early === 'dispose') f.player._removeOwnedEffect(group);
    f.queue[0].callback();
    assert.equal(group.parent, null); assert.equal(unrelated.parent, f.scene); assert.equal(f.player._effects.size, 0);
    assert.equal(geometryDisposals, 7); assert.equal(materialDisposals, 7);
  }
});

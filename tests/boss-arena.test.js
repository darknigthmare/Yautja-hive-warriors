import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BOSS_REGISTRY } from '../js/data/BossRegistry.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { BossManager, BOSS_FOOTPRINT_LIMITS } from '../js/entities/Bosses.js';
import { EnvironmentManager } from '../js/entities/Environment.js';

// AUD-066: a boss body is sized from its own model, spawns only where that body fits,
// and moves with the same footprint, so it never stands inside scenery.
const audio = new Proxy({}, { get: () => () => {} });
const fits = (env, position, radius, height) => {
  const probe = position.clone(); env.resolveMovement(probe, radius, height);
  return Math.hypot(probe.x - position.x, probe.z - position.z) < .05;
};

test('every boss gets a measured body footprint inside the declared limits', () => {
  const manager = new BossManager(new THREE.Scene(), audio), footprints = {};
  for (const id of Object.keys(BOSS_REGISTRY)) {
    const boss = manager.spawnBoss(id, new THREE.Vector3());
    assert.ok(boss.footprintRadius >= BOSS_FOOTPRINT_LIMITS.min && boss.footprintRadius <= BOSS_FOOTPRINT_LIMITS.max, `${id}: ${boss.footprintRadius}`);
    assert.equal(boss.arena.moved, false, `${id} moved without an environment`);
    footprints[id] = boss.footprintRadius;
  }
  manager.clear();
  // The Charon King and the titan are broader than a hunter-sized Yautja.
  assert.ok(footprints.rogue_king_prime > footprints.jungle_hunter_boss + 1);
  assert.ok(footprints.predalien_matriarch_titan > footprints.city_hunter_boss + 1);
});

test('every final battlefield boss keeps its objective point, which is clear for its body', () => {
  for (const level of LEVELS_DATA.filter(item => item.bossType)) {
    const scene = new THREE.Scene(), env = new EnvironmentManager(scene);
    env.buildLevelEnvironment({ ...level, battlefield: true });
    // The mission reaches the duel through opened gates; spawn happens with the sector reachable.
    for (const gate of env.battlefieldLayout.gates) env.openGate(gate.id);
    const sector = env.battlefieldLayout.sectors.at(-1), requested = new THREE.Vector3(sector.objective.position[0], 0, sector.objective.position[1]);
    const manager = new BossManager(scene, audio); manager.environment = env;
    const boss = manager.spawnBoss(level.bossType, requested);
    assert.equal(boss.arena.moved, false, `${level.id}: the duel point is obstructed`);
    assert.ok(fits(env, boss.mesh.position, boss.footprintRadius + .6, boss.definition.height), level.id);
    // The boss is the marker of its own objective: no thin post crosses its body.
    const marker = env.objectiveMarkers.get(sector.id);
    assert.equal(marker.children.filter(child => child.geometry?.type === 'BoxGeometry').length, 0, `${level.id} marker posts`);
    manager.clear();
  }
});

test('a boss requested inside scenery is placed on the nearest point where its body fits', () => {
  const level = LEVELS_DATA.find(item => item.id === 'romulus_station');
  const scene = new THREE.Scene(), env = new EnvironmentManager(scene);
  env.buildLevelEnvironment({ ...level, battlefield: false });
  const collider = env.colliders.find(item => typeof item.resolveMovement !== 'function' && Math.max(item.radius ?? 0, item.halfWidth ?? 0, item.halfDepth ?? 0) >= 1
    && Math.abs(item.x) < env.halfSize - 12 && Math.abs(item.z) < env.halfSize - 12 && !fits(env, new THREE.Vector3(item.x, 0, item.z), 1, 6));
  assert.ok(collider, 'the survival station needs a solid prop for this case');
  const manager = new BossManager(scene, audio); manager.environment = env;
  const requested = new THREE.Vector3(collider.x, 0, collider.z);
  const boss = manager.spawnBoss('rogue_king_prime', requested);
  assert.equal(boss.arena.moved, true);
  assert.ok(fits(env, boss.mesh.position, boss.footprintRadius + .6, boss.definition.height));
  assert.ok(boss.mesh.position.distanceTo(requested) <= 12 * Math.max(2, boss.footprintRadius) + 1e-6);
  manager.clear();
});

test('walking, pursuit and charges resolve the boss with its own footprint', () => {
  const radii = [];
  const env = { resolveAgentMovement: (position, target, step, radius) => radii.push(['agent', radius]),
    resolveMovement: (position, radius, height) => radii.push(['body', radius, height]) };
  const manager = new BossManager(new THREE.Scene(), audio); manager.environment = env;
  const boss = manager.spawnBoss('rogue_king_prime', new THREE.Vector3());
  radii.length = 0;
  const player = { hp: 1000, position: new THREE.Vector3(0, 0, 30), mesh: new THREE.Group(), radius: 1.2, takeDamage() {} };
  boss.contactCooldown = boss.tailWhipCooldown = boss.spitCooldown = boss.specialCooldown = boss.regurgitateCooldown = boss.shriekCooldown = 99;
  manager.update(1 / 30, player);
  boss.charge = { kind: 'charge', direction: new THREE.Vector3(0, 0, 1), life: .5, duration: .7, startY: 0, speed: 16, damage: 0, hit: new Set() };
  manager.update(1 / 30, player);
  assert.ok(radii.some(([kind, radius]) => kind === 'agent' && radius === boss.footprintRadius), JSON.stringify(radii));
  assert.ok(radii.some(([kind, radius, height]) => kind === 'body' && radius === boss.footprintRadius && height === boss.definition.height), JSON.stringify(radii));
  manager.clear();
});

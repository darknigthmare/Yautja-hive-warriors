import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { ColliderBroadphase } from '../js/engine/ColliderBroadphase.js';

// Performance pass: the broadphase must give exactly the result of the full collider scan.
const fullScan = environment => ({ isStale: () => false, query: (x, z, reach, after = -1) => environment.colliders.map((_, index) => index).filter(index => index > after) });
let seed = 7; const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;

for (const id of ['gunnison_forest', 'romulus_station', 'antarctic_pyramid', 'la_rooftops', 'lv223_engineer_structures']) test(`${id}: broadphase movement equals the full scan`, () => {
  const level = LEVELS_DATA.find(item => item.id === id), env = new EnvironmentManager(new THREE.Scene());
  env.buildLevelEnvironment({ ...level, battlefield: true });
  for (const gate of env.battlefieldLayout.gates) env.openGate(gate.id);
  const bounds = env.battlefieldLayout.bounds, broad = new ColliderBroadphase();
  let compared = 0, pushed = 0;
  for (let i = 0; i < 1500; i++) {
    const start = new THREE.Vector3(bounds.minX + random() * (bounds.maxX - bounds.minX), random() < .8 ? 0 : random() * 4, bounds.minZ + random() * (bounds.maxZ - bounds.minZ));
    const radius = .5 + random() * 3, height = 1.4 + random() * 6;
    env._colliderBroadphase = broad; const fast = env.resolveMovement(start.clone(), radius, height);
    env._colliderBroadphase = fullScan(env); const reference = env.resolveMovement(start.clone(), radius, height);
    assert.deepEqual(fast.toArray(), reference.toArray(), `${id} at ${start.toArray().map(v => v.toFixed(2))} r=${radius.toFixed(2)}`);
    compared++; if (reference.distanceTo(start) > 1e-9) pushed++;
  }
  assert.ok(pushed > 20, `the sample exercises real pushes (${pushed}/${compared})`);
});

test('dynamic colliders are always tested and the grid follows the collider list', () => {
  const moving = { resolveMovement() {}, x: 500, z: 500, radius: 1 }, staticOne = { x: 0, z: 0, radius: 1, height: 2 };
  const broad = new ColliderBroadphase().rebuild([staticOne, moving], 1);
  assert.deepEqual(broad.query(0, 0, 2), [0, 1]);
  assert.deepEqual(broad.query(300, 300, 2), [1]);
  const list = [staticOne]; broad.rebuild(list, 1); list.push({ x: 1, z: 1, radius: 1 });
  assert.equal(broad.isStale(list, 1), true, 'a new collider invalidates the grid');
  assert.equal(broad.isStale(list.slice(), 1), true);
});

test('segment traces and line of sight through the broadphase equal the full scan', async () => {
  const { traceCombatSegment, hasCombatLineOfSight } = await import('../js/engine/CombatGeometry.js');
  for (const id of ['romulus_station', 'gunnison_forest', 'lv223_engineer_structures']) {
    const level = LEVELS_DATA.find(item => item.id === id), env = new EnvironmentManager(new THREE.Scene());
    env.buildLevelEnvironment({ ...level, battlefield: true });
    const bounds = env.battlefieldLayout.bounds; let blocked = 0;
    for (let i = 0; i < 800; i++) {
      const point = () => new THREE.Vector3(bounds.minX + random() * (bounds.maxX - bounds.minX), random() * 4, bounds.minZ + random() * (bounds.maxZ - bounds.minZ));
      const from = point(), to = random() < .5 ? point() : from.clone().add(new THREE.Vector3((random() - .5) * 60, 0, (random() - .5) * 60)), radius = random() < .5 ? 0 : random() * .8;
      const fast = env.traceSegment(from, to, { radius }), reference = traceCombatSegment(from, to, env.colliders, { radius });
      assert.equal(fast?.t ?? null, reference?.t ?? null, `${id} trace ${i}`);
      assert.equal(fast?.collider ?? null, reference?.collider ?? null);
      assert.equal(env.hasLineOfSight(from, to), hasCombatLineOfSight(from, to, env.colliders));
      if (reference) blocked++;
    }
    assert.ok(blocked > 20, `${id}: real blocked segments (${blocked})`);
  }
});

test('agent steering through the broadphase equals the full scan', () => {
  for (const id of ['romulus_station', 'gunnison_forest']) {
    const level = LEVELS_DATA.find(item => item.id === id), make = () => { const env = new EnvironmentManager(new THREE.Scene()); env.buildLevelEnvironment({ ...level, battlefield: true }); for (const gate of env.battlefieldLayout.gates) env.openGate(gate.id); return env; };
    const fastEnv = make(), slowEnv = make(); slowEnv._colliderBroadphase = fullScan(slowEnv);
    const bounds = fastEnv.battlefieldLayout.bounds;
    for (let i = 0; i < 600; i++) {
      const start = new THREE.Vector3(bounds.minX + random() * (bounds.maxX - bounds.minX), 0, bounds.minZ + random() * (bounds.maxZ - bounds.minZ));
      const target = start.clone().add(new THREE.Vector3((random() - .5) * 80, 0, (random() - .5) * 80)), step = .2 + random() * 1.5, radius = .5 + random() * 1.5;
      const a = start.clone(), b = start.clone();
      fastEnv.resolveAgentMovement(a, target, step, radius); slowEnv.resolveAgentMovement(b, target, step, radius);
      assert.deepEqual(a.toArray(), b.toArray(), `${id} step ${i}`);
    }
  }
});

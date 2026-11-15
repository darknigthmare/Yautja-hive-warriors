import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

test('relay furniture has a real approach, finite textured details and bounded batched geometry', () => {
  const env = new EnvironmentManager(new THREE.Scene());
  env.buildLevelEnvironment(LEVELS_DATA.find(level => level.environmentType === 'station'));
  try {
    const sector = env.battlefieldLayout.sectors.find(sector => sector.objective.type === 'interact');
    for (const gate of env.battlefieldLayout.gates.slice(0, 2)) env.openGate(gate.id);
    env.setActiveSector(sector.id);
    const relay = env.relayVisuals.get(sector.id);
    let triangles = 0, calls = 0;
    relay.group.traverse(mesh => {
      if (!mesh.isMesh) return;
      calls++;
      const geometry = mesh.geometry;
      assert.ok(geometry.attributes.normal && geometry.attributes.uv);
      assert.ok(geometry.attributes.position.array.every(Number.isFinite));
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3 * (mesh.count ?? 1);
      assert.ok(mesh.material.map && mesh.material.normalMap && mesh.material.roughnessMap);
    });
    assert.ok(triangles > 1500 && triangles < 20000, `relay geometry ${triangles}`);
    assert.ok(calls <= 6, `relay submits ${calls} meshes`);
    const [x, z] = sector.objective.position;
    const inside = new THREE.Vector3(x, 0, z); env.resolveMovement(inside);
    assert.ok(Math.hypot(inside.x - x, inside.z - z) > 0.9, 'a standing actor cannot occupy the control cabinet');
    const approach = new THREE.Vector3(x, 0, z + 3), original = approach.clone();
    env.resolveMovement(approach);
    assert.ok(approach.distanceTo(original) < 1e-8, 'the front interaction apron is walkable');
    assert.ok(approach.distanceTo(new THREE.Vector3(x, 0, z)) < sector.objective.radius);
  } finally { env.clearEnvironment(); }
});

test('relay signal and segmented progress follow actual objective phases without recoloring world trim', () => {
  const env = new EnvironmentManager(new THREE.Scene());
  env.buildLevelEnvironment(LEVELS_DATA.find(level => level.environmentType === 'station'));
  const sector = env.battlefieldLayout.sectors.find(sector => sector.objective.type === 'interact');
  const relay = env.relayVisuals.get(sector.id), originalTrim = env.trimMat.color.getHex();
  const state = { interacted: false, completed: false, defenseKills: 0 };
  const progression = { currentSector: sector, getSectorState: () => state };
  try {
    env.updateBattlefieldObjectives(progression, 0.05);
    assert.equal(relay.getState().phase, 'awaiting-activation');
    const time = relay.getState().time;
    env.updateBattlefieldObjectives(progression, 0);
    assert.equal(relay.getState().time, time, 'paused time does not advance the signal');
    state.interacted = true; state.defenseKills = sector.objective.defenseTarget / 2;
    env.updateBattlefieldObjectives(progression, 0.05);
    assert.equal(relay.getState().phase, 'counterattack');
    assert.equal(relay.getState().progress, 0.5);
    const first = new THREE.Color(), last = new THREE.Color();
    relay.segments.getColorAt(0, first); relay.segments.getColorAt(11, last);
    assert.notEqual(first.getHex(), last.getHex(), 'the ring distinguishes secured progress from remaining counterattack');
    state.completed = true; env.completeSector(sector.id); env.updateBattlefieldObjectives(progression, 0);
    assert.equal(relay.getState().phase, 'secured');
    assert.equal(relay.getState().progress, 1);
    relay.segments.getColorAt(0, first); relay.segments.getColorAt(11, last);
    assert.equal(first.getHex(), last.getHex());
    assert.equal(env.trimMat.color.getHex(), originalTrim);
  } finally { env.clearEnvironment(); }
  assert.equal(env.relayVisuals.size, 0);
});

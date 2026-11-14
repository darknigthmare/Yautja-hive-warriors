import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

for (const level of LEVELS_DATA) {
  test(`${level.id}: described, decorated, deterministic and navigable`, () => {
    for (const property of ['description', 'icon', 'difficulty', 'environmentType']) assert.ok(level[property], `missing ${property}`);
    assert.ok(Number.isFinite(level.fogDensity));
    const scene = new THREE.Scene();
    const environment = new EnvironmentManager(scene);
    environment.buildLevelEnvironment(level);
    let meshes = 0;
    environment.root.traverse(object => { if (object.isMesh) meshes++; });
    assert.ok(meshes > 40, 'arena should contain its landmarks, not only a floor and walls');
    assert.ok(environment.colliders.length, 'solid scenery must have collision data');
    const initialLayout = JSON.stringify(environment.colliders);
    for (const x of [0, 4]) {
      const insertion = new THREE.Vector3(x, 0, 0);
      insertion.y = environment.getPlacementElevationAt(x, 0);
      const expected = insertion.toArray();
      environment.resolveMovement(insertion);
      assert.deepEqual(insertion.toArray(), expected, 'single and co-op spawns stay clear at their actual placement height');
    }
    // The four cardinal routes and the circular route must stay traversable.
    for (let direction = 0; direction < 4; direction++) {
      for (let distance = 0; distance <= 60; distance += 3) {
        const position = new THREE.Vector3(Math.sin(direction * Math.PI / 2) * distance, 0, Math.cos(direction * Math.PI / 2) * distance);
        position.y = environment.getPlacementElevationAt(position.x, position.z);
        const original = position.clone();
        environment.resolveMovement(position);
        assert.ok(position.distanceTo(original) < 0.001, `blocked cardinal lane at ${distance}`);
      }
    }
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 24) {
      const position = new THREE.Vector3(Math.sin(angle) * 28, 0, Math.cos(angle) * 28);
      position.y = environment.getPlacementElevationAt(position.x, position.z);
      const original = position.clone();
      environment.resolveMovement(position);
      assert.ok(position.distanceTo(original) < 0.001, 'blocked circulation loop');
    }
    const escaped = new THREE.Vector3(1000, 2, -1000);
    environment.resolveMovement(escaped);
    assert.ok(Math.abs(escaped.x) <= level.arenaHalfSize - 0.75);
    assert.ok(Math.abs(escaped.z) <= level.arenaHalfSize - 0.75);
    assert.equal(escaped.y, 2, 'collision preserves jump height');
    let disposed = 0;
    const ownedGeometries = environment.geometries.size;
    environment.geometries.forEach(geometry => geometry.addEventListener('dispose', () => disposed++));
    environment.buildLevelEnvironment(level);
    assert.equal(disposed, ownedGeometries, 'rebuild disposes every previous geometry');
    assert.equal(scene.children.length, 1, 'rebuild replaces the old arena');
    assert.equal(JSON.stringify(environment.colliders), initialLayout, 'layout stays identical across retries');
    environment.clearEnvironment();
    assert.equal(scene.children.length, 0);
    assert.equal(environment.geometries.size, 0);
    assert.equal(environment.materials.size, 0);
  });
}

test('solid scenery collision handles exact centers, corners, rotations and jumping', () => {
  const environment = new EnvironmentManager(new THREE.Scene());
  environment.addCollider(10, 10, 2, 3);
  const center = new THREE.Vector3(10, 0, 10);
  environment.resolveMovement(center, 1);
  assert.ok(center.distanceTo(new THREE.Vector3(10, 0, 10)) >= 3);
  assert.ok(center.toArray().every(Number.isFinite));
  const jump = new THREE.Vector3(10, 5, 10);
  environment.resolveMovement(jump, 1);
  assert.deepEqual(jump.toArray(), [10, 5, 10]);
  environment.colliders = [];
  environment.addBoxCollider(20, 20, 4, 2, 3, Math.PI / 4);
  const boxCenter = new THREE.Vector3(20, 0, 20);
  environment.resolveMovement(boxCenter, 1);
  assert.ok(boxCenter.distanceTo(new THREE.Vector3(20, 0, 20)) >= 3 - 0.0001);
  const far = new THREE.Vector3(-20, 0, -20);
  environment.resolveMovement(far, 1);
  assert.deepEqual(far.toArray(), [-20, 0, -20]);
});

for (const level of LEVELS_DATA) {
  test(`${level.id}: seeking AI can skirt scenery from the perimeter to four open targets`, () => {
    const environment = new EnvironmentManager(new THREE.Scene());
    environment.buildLevelEnvironment(level);
    for (const [x, z] of [[0, 0], [20, 0], [0, -30], [-40, 0]]) {
      const target = new THREE.Vector3(x, 0, z);
      target.y = environment.getPlacementElevationAt(x, z);
      for (let direction = 0; direction < 32; direction++) {
        const angle = direction / 32 * Math.PI * 2;
        const position = new THREE.Vector3(Math.cos(angle) * 60, 0, Math.sin(angle) * 60);
        environment.resolveMovement(position, 0.65);
        for (let step = 0; step < 650 && position.distanceTo(target) >= 2; step++) {
          const movement = target.clone().sub(position).normalize();
          position.addScaledVector(movement, 0.3);
          environment.resolveAgentMovement(position, target, 0.3, 0.65);
          assert.ok(position.toArray().every(Number.isFinite));
          assert.ok(Math.abs(position.x) <= level.arenaHalfSize && Math.abs(position.z) <= level.arenaHalfSize);
        }
        assert.ok(position.distanceTo(target) < 2, `AI became stuck from direction ${direction} toward ${x},${z}; position ${position.x.toFixed(2)},${position.y.toFixed(2)},${position.z.toFixed(2)}, distance ${position.distanceTo(target).toFixed(2)}`);
      }
    }
    environment.clearEnvironment();
  });
}

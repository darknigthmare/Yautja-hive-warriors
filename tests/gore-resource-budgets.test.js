import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GoreEngine, GORE_RESOURCE_LIMITS } from '../js/engine/GoreEngine.js';

function watchResources(object) {
  const geometries = new Set(), materials = new Set(), disposals = new Map();
  object.traverse(child => {
    if (child.geometry) geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) if (material) materials.add(material);
  });
  for (const resource of [...geometries, ...materials]) {
    disposals.set(resource, 0);
    resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource) + 1));
  }
  return { geometries, materials, disposals };
}

test('saturated gore bursts stay strictly bounded and preserve the newest visible impact', () => {
  const scene = new THREE.Scene(), gore = new GoreEngine(scene), origin = new THREE.Vector3();
  gore.spawnAcidSlagDecal(origin);
  const firstSlag = gore.acidSlagDecals[0].group, owned = watchResources(firstSlag);
  for (let index = 1; index < 120; index++) {
    gore.spawnAcidSlagDecal(new THREE.Vector3(index, 0, 0));
    gore.spawnDismemberment(origin, index % 2 ? 'heavy' : 'wristblades');
    gore.spawnAcidSplatter(origin);
    assert.ok(gore.severedParts.length <= GORE_RESOURCE_LIMITS.severedParts);
    assert.ok(gore.acidGibs.length <= GORE_RESOURCE_LIMITS.acidGibs);
    assert.ok(gore.acidSlagDecals.length <= GORE_RESOURCE_LIMITS.acidSlagDecals);
  }
  assert.equal(firstSlag.parent, null);
  for (const resource of [...owned.geometries, ...owned.materials]) {
    assert.equal(owned.disposals.get(resource), 1, 'Evicting a decal releases its own resources exactly once');
  }
  assert.equal(gore.acidSlagDecals.at(-1).group.position.x, 119);
  assert.equal(gore.acidSlagDecals.length, GORE_RESOURCE_LIMITS.acidSlagDecals);
  assert.equal(scene.children.length, gore.severedParts.length + gore.acidGibs.length + gore.acidSlagDecals.length);
  gore.clear();
  assert.equal(scene.children.length, 0);
});

test('clear and expiration release private gore resources without disposing materials reused next mission', () => {
  const scene = new THREE.Scene(), gore = new GoreEngine(scene), origin = new THREE.Vector3();
  const sharedDisposals = new Map([...gore.sharedResources].map(resource => [resource, 0]));
  for (const resource of gore.sharedResources) resource.addEventListener('dispose', () => sharedDisposals.set(resource, sharedDisposals.get(resource) + 1));
  gore.spawnDismemberment(origin, 'heavy'); gore.spawnAcidSlagDecal(origin);
  // Observe resource ownership without moving live meshes out of their scene.
  const objects = [...gore.severedParts.map(part => part.mesh), ...gore.acidGibs.map(gib => gib.mesh), gore.acidSlagDecals[0].group];
  const observed = objects.map(object => watchResources(object));
  gore.clear(); gore.clear();
  assert.equal(scene.children.length, 0);
  for (const observation of observed) for (const resource of [...observation.geometries, ...observation.materials]) {
    assert.equal(observation.disposals.get(resource), gore.sharedResources.has(resource) ? 0 : 1);
  }
  assert.equal(gore.spawnDismemberment(origin), true);
  gore.spawnAcidSlagDecal(origin); gore.update(30);
  assert.equal(gore.severedParts.length, 0); assert.equal(gore.acidSlagDecals.length, 0);
  gore.update(9); assert.equal(gore.acidGibs.length, 0); assert.equal(scene.children.length, 0);
  assert.deepEqual([...sharedDisposals.values()], [0, 0, 0]);
});

test('decal fading is independent of other impacts and respects elevated contact surfaces', () => {
  const scene = new THREE.Scene(), gore = new GoreEngine(scene), position = new THREE.Vector3(1, 8, 3);
  gore.spawnAcidSlagDecal(position); const older = gore.acidSlagDecals[0];
  gore.update(12); gore.spawnAcidSlagDecal(position); const newer = gore.acidSlagDecals[1];
  gore.update(.1);
  assert.equal(older.group.position.y, 8.03); assert.equal(newer.group.position.y, 8.03);
  assert.notEqual(older.vein.material, newer.vein.material);
  assert.notEqual(older.vein.material, gore.acidGlowMat);
  assert.ok(older.vein.material.opacity < newer.vein.material.opacity);
  assert.equal(gore.acidGlowMat.opacity, .85);
  gore.spawnDismemberment(position, 'heavy'); gore.update(3);
  assert.ok(gore.severedParts.every(part => part.onGround && part.mesh.position.y === 8.2));
  assert.ok(gore.acidGibs.every(gib => gib.mesh.position.y === 8.02));
  gore.clear();
});

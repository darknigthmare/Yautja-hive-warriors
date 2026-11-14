import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { addBiomaskEyeFilters, parseBiomaskEyeFiltersCalibration } from '../js/graphics/BiomaskEyeFilters.js';

// Synthetic window-frame fixture, unrelated to the measured production mask.
const fixtureCalibration = () => ({ calibrated: true, coordinateSpace: 'gltf-scene', filters: [
  { name: 'left-eye', vertices: [[-.8, -.52, -.08], [.02, -.52, -.08], [.02, .52, -.08], [-.8, .52, -.08]], indices: [0, 1, 2, 0, 2, 3] },
  { name: 'right-eye', vertices: [[-.02, -.52, -.083], [.8, -.52, -.083], [.8, .52, -.083], [-.02, .52, -.083]], indices: [0, 1, 2, 0, 2, 3] }
] });

function windowFixture() {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
  for (const [x, y, width, height] of [[0, .55, 1.7, .1], [0, -.55, 1.7, .1], [-.8, 0, .1, 1.1], [.8, 0, .1, 1.1], [0, 0, .1, 1.1]]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, .1), material); mesh.position.set(x, y, 0); root.add(mesh);
  }
  return root;
}

test('optional eye-filter calibration deep-copies measured arrays and rejects malformed geometry', () => {
  assert.equal(parseBiomaskEyeFiltersCalibration(null), null);
  assert.equal(parseBiomaskEyeFiltersCalibration({ calibrated: false }), null);
  const input = fixtureCalibration(), parsed = parseBiomaskEyeFiltersCalibration(input);
  input.filters[0].vertices[0][0] = 99; input.filters[0].indices[0] = 99;
  assert.equal(parsed.filters[0].vertices[0][0], -.8); assert.equal(parsed.filters[0].indices[0], 0);
  for (const mutate of [c => c.filters.pop(), c => c.filters[0].vertices[0][0] = NaN,
    c => c.filters[0].vertices[0][0] = Number.MAX_VALUE,
    c => c.filters[0].indices[0] = 500, c => c.filters[0].indices[1] = 0,
    c => c.filters[0].uvs = [[0, 0]], c => c.coordinateSpace = 'screen']) {
    const bad = fixtureCalibration(); mutate(bad);
    assert.throws(() => parseBiomaskEyeFiltersCalibration(bad), /Biomask eye filters/);
  }
});

test('opaque backing meshes occlude both empty windows without altering the cached shell', () => {
  const cached = windowFixture(), clone = cached.clone(true), shellGeometry = cached.children[0].geometry, shellMaterial = cached.children[0].material;
  const sourcePositions = shellGeometry.attributes.position.array.slice(), sourceColor = shellMaterial.color.clone();
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(0, 0, -1);
  const cast = x => { clone.updateMatrixWorld(true); ray.set(new THREE.Vector3(x, 0, 3), direction); return ray.intersectObject(clone, true); };
  assert.equal(cast(-.4).length, 0); assert.equal(cast(.4).length, 0);
  const filters = addBiomaskEyeFilters(clone, fixtureCalibration());
  assert.equal(filters.root.children.length, 2);
  assert.notEqual(filters.root.children[0].geometry, filters.root.children[1].geometry);
  for (const x of [-.4, .4]) {
    const hit = cast(x)[0]; assert.ok(hit.object.userData.biomaskEyeFilter);
    assert.equal(hit.object.material.transparent, false); assert.equal(hit.object.material.opacity, 1);
    assert.equal(hit.object.material.alphaTest, 0); assert.equal(hit.object.material.depthWrite, true);
  }
  assert.equal(cast(0)[0].object.userData.biomaskEyeFilter, undefined, 'the shell stays in front of the recessed backing');
  const data = filters.root.children[0].material.map.source.data.data;
  for (let at = 3; at < data.length; at += 4) assert.equal(data[at], 255, 'grille pattern never cuts transparent holes');
  assert.equal(cached.children.length, 5); assert.equal(clone.children.length, 6);
  assert.equal(clone.children[0].geometry, shellGeometry); assert.equal(clone.children[0].material, shellMaterial);
  assert.deepEqual(shellGeometry.attributes.position.array, sourcePositions); assert.ok(shellMaterial.color.equals(sourceColor));
  filters.dispose();
});

test('filter cleanup releases private geometry/material once and retains the shared grid for adapter clones', () => {
  const clone = windowFixture(), filters = addBiomaskEyeFilters(clone, fixtureCalibration());
  let privateDisposed = 0, sharedDisposed = 0;
  filters.resources.forEach(resource => resource.addEventListener('dispose', () => privateDisposed++));
  const shared = [...filters.sharedResources][0]; shared.addEventListener('dispose', () => sharedDisposed++);
  const copiedMaterial = filters.root.children[0].material.clone();
  filters.dispose(); filters.dispose();
  assert.equal(privateDisposed, 4); assert.equal(sharedDisposed, 0);
  assert.equal(copiedMaterial.map, shared); assert.equal(copiedMaterial.map.source.data.width, 128);
  assert.equal(filters.root.parent, null); copiedMaterial.dispose();
});

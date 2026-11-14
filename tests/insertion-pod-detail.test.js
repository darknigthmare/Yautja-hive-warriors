import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildInsertionPodModel } from '../js/graphics/InsertionPodModel.js';
import { Assembly } from '../js/graphics/SupportAssembly.js';
import { disposeObject } from '../js/engine/SceneResources.js';

const baseline = JSON.parse(readFileSync(new URL('../docs/qa/fidelity-20261109/capsule/baseline.json', import.meta.url), 'utf8'));
const createPod = () => buildInsertionPodModel(Assembly);
const meshes = pod => { const result = []; pod.group.traverse(object => { if (object.isMesh) result.push(object); }); return result; };
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 2e-6, `${message}: ${actual} / ${expected}`);

test('capsule details preserve the measured exterior, cabin handoff and physical profile within the temporary cinematic budget', () => {
  const pod = createPod();
  try {
    const surfaces = meshes(pod), triangleCount = surfaces.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
    assert.ok(triangleCount > baseline.triangles && triangleCount <= 65000);
    assert.equal(surfaces.length, 14);
    assert.deepEqual(pod.collisionProfile, baseline.collisionProfile);
    assert.deepEqual(pod.seatPosition.toArray(), baseline.seat);
    assert.deepEqual(pod.exitPosition.toArray(), baseline.exit);
    for (const [opening, reference] of [[0, baseline.closed], [1, baseline.opened]]) {
      pod.updateOpening(opening); pod.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(pod.group);
      assert.deepEqual(box.min.toArray(), reference.min);
      assert.deepEqual(box.max.toArray(), reference.max);
    }
    assert.equal(pod.group.userData.insertionPod.interpretation, 'yautja-inspired-hollow-capsule');
    assert.equal(pod.group.userData.insertionPod.detail.filmPropFidelity1to1Verified, false);
  } finally { disposeObject(pod.group); }
});

test('segmented crown has an opaque pressure hull behind every armor seam', () => {
  const pod = createPod();
  try {
    pod.group.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(), origin = new THREE.Vector3(), direction = new THREE.Vector3();
    for (const height of [5.35, 5.9, 6.35]) for (let segment = 0; segment < 72; segment++) {
      const angle = segment / 72 * Math.PI * 2;
      origin.set(Math.cos(angle) * 3, height, Math.sin(angle) * 3); direction.set(-Math.cos(angle), 0, -Math.sin(angle));
      raycaster.set(origin, direction); raycaster.far = 3;
      const hits = raycaster.intersectObject(pod.group, true);
      assert.ok(hits.length, `pressure hull missing at height ${height}, angle ${angle}`);
      assert.ok(hits.every(hit => !hit.object.material.transparent));
    }
  } finally { disposeObject(pod.group); }
});

test('one dynamic actuator buffer keeps fixed barrels and telescopes to both real door sockets through reversal', () => {
  const pod = createPod(), geometry = pod.actuators.mesh.geometry;
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  const positionArray = position.array, normalArray = normal.array;
  const verticesPerSection = position.count / 8, point = new THREE.Vector3(), anchor = new THREE.Vector3(), socket = new THREE.Vector3(), direction = new THREE.Vector3();
  const firstPiston = pod.actuators.metrics[0].pistonLength;
  try {
    assert.equal(position.usage, THREE.DynamicDrawUsage);
    for (const opening of [0, .125, .25, .5, .75, 1, .35, 0]) {
      pod.updateOpening(opening);
      assert.equal(geometry.attributes.position.array, positionArray);
      assert.equal(geometry.attributes.normal.array, normalArray);
      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        const side = sideIndex ? 1 : -1;
        anchor.set(side * 1.87, 4.34, .34);
        socket.set(-side * .12, 4.25, .26).applyEuler(pod.hinges[sideIndex].rotation).add(pod.hinges[sideIndex].position);
        direction.copy(socket).sub(anchor); const distance = direction.length(); direction.normalize();
        const intervals = [[0, .72], [.66, distance], [.67, .725], [distance - .06, distance]];
        for (let section = 0; section < 4; section++) {
          let min = Infinity, max = -Infinity;
          for (let vertex = 0; vertex < verticesPerSection; vertex++) {
            const index = (sideIndex * 4 + section) * verticesPerSection + vertex;
            point.fromBufferAttribute(position, index);
            assert.ok(geometry.boundingBox.containsPoint(point), `actuator escaped its culling box at ${opening}`);
            const projected = point.sub(anchor).dot(direction); min = Math.min(min, projected); max = Math.max(max, projected);
            point.fromBufferAttribute(normal, index); near(point.length(), 1, 'actuator normal is normalized');
          }
          near(min, intervals[section][0], 'section start follows its mount');
          near(max, intervals[section][1], 'section end follows its mount');
        }
      }
      const version = position.version; pod.updateOpening(opening);
      assert.equal(position.version, version, 'unchanged opening does not upload the same vertices again');
    }
    pod.updateOpening(1);
    assert.ok(Math.abs(firstPiston - pod.actuators.metrics[0].pistonLength) > .1, 'the piston actually changes length');
    assert.ok(position.version > 1);
  } finally { disposeObject(pod.group); }
});

test('two capsule animations own their changing buffers and release geometry/materials without disposing borrowed surface maps', () => {
  const left = createPod(), right = createPod(), scene = new THREE.Scene(); scene.add(left.group, right.group);
  const rightBytes = right.actuators.mesh.geometry.attributes.position.array.slice();
  assert.notEqual(left.actuators.mesh.geometry, right.actuators.mesh.geometry);
  assert.notEqual(left.actuators.mesh.material, right.actuators.mesh.material);
  assert.equal(left.actuators.mesh.material.map, right.actuators.mesh.material.map, 'cached maps are deliberately borrowed');
  left.updateOpening(.8);
  assert.deepEqual(right.actuators.mesh.geometry.attributes.position.array, rightBytes);
  const resources = new Set(), maps = new Set(), counts = new Map();
  for (const pod of [left, right]) for (const mesh of meshes(pod)) {
    resources.add(mesh.geometry); resources.add(mesh.material);
    for (const property of ['map', 'normalMap', 'roughnessMap']) if (mesh.material[property]) maps.add(mesh.material[property]);
  }
  for (const resource of [...resources, ...maps]) { counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1)); }
  disposeObject(left.group); disposeObject(right.group);
  assert.equal(scene.children.length, 0);
  for (const resource of resources) assert.equal(counts.get(resource), 1, 'each owned resource is released once');
  for (const texture of maps) assert.equal(counts.get(texture), 0, 'shared surface maps remain reusable');
});

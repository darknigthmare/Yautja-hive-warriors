import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDropPodModel } from '../js/graphics/SupportModels.js';
import { disposeObject } from '../js/engine/SceneResources.js';

const ray = (model, origin, direction, far = 10) => {
  model.group.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction), 0, far).intersectObject(model.group, true);
};

test('closed capsule occludes the occupant and open leaves clear the standing exit corridor', () => {
  const pod = createDropPodModel();
  for (const x of [-0.8, 0, 0.8]) for (const y of [0.4, 2, 4.2]) {
    assert.ok(ray(pod, [x, y, 4], [0, 0, -1], 3).length, `closed leaf missing at ${x}, ${y}`);
  }
  pod.updateOpening(1);
  for (const x of [-0.8, 0, 0.8]) for (const y of [0.4, 2, 4.2]) {
    assert.equal(ray(pod, [x, y, 0], [0, 0, 1], 5).length, 0, `exit blocked at ${x}, ${y}`);
  }
  assert.equal(pod.seatPosition.y, pod.exitPosition.y);
  assert.ok(pod.exitPosition.z > 4);
  disposeObject(pod.group);
});

test('capsule hinges turn continuously around fixed sockets without replacing owned buffers', () => {
  const pod = createDropPodModel(), resources = new Set(), positions = pod.hinges.map(hinge => hinge.position.clone());
  pod.group.traverse(object => { if (object.isMesh) resources.add(object.geometry); });
  for (const progress of [0, 0.1, 0.35, 0.7, 1]) {
    pod.updateOpening(progress);
    for (let index = 0; index < 2; index++) assert.ok(pod.hinges[index].position.equals(positions[index]));
    assert.ok(Math.abs(pod.hinges[0].rotation.y + pod.hinges[1].rotation.y) < 1e-12);
    assert.ok(Math.abs(pod.hinges[0].rotation.y + progress * pod.collisionProfile.maxOpeningAngle) < 1e-12);
    pod.group.traverse(object => { if (object.isMesh) assert.ok(resources.has(object.geometry)); });
  }
  pod.updateOpening(3); assert.equal(pod.door.userData.opening, 1);
  pod.updateOpening(-1); assert.equal(pod.door.userData.opening, 0);
  pod.updateOpening(NaN); assert.equal(pod.door.userData.opening, 0);
  disposeObject(pod.group);
});

test('interior floor and threshold do not bury ground-height feet during the exit', () => {
  const pod = createDropPodModel(); pod.updateOpening(1);
  for (const x of [-0.65, 0, 0.65]) for (const z of [0, 0.5, 1, 1.4, 2, 3, 4.2]) {
    const hits = ray(pod, [x, 0.3, z], [0, -1, 0], 1);
    assert.ok(hits.every(hit => hit.point.y <= 0.001), `floor penetrates feet at ${x}, ${z}`);
  }
  disposeObject(pod.group);
});

test('six-unit co-op spacing keeps both capsule silhouettes and moving leaves apart', () => {
  const left = createDropPodModel(), right = createDropPodModel();
  right.group.position.x = 6;
  for (let step = 0; step <= 20; step++) {
    left.updateOpening(step / 20); right.updateOpening(step / 20);
    const a = new THREE.Box3().setFromObject(left.group), b = new THREE.Box3().setFromObject(right.group);
    assert.ok(b.min.x - a.max.x > 1, `capsules overlap at opening ${step / 20}`);
  }
  disposeObject(left.group); disposeObject(right.group);
});

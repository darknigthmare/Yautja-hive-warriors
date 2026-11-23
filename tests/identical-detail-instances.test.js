import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { instanceIdenticalDetails } from '../js/graphics/ReferenceLandmarkBatching.js';

// Draw-call pass: only plain fixed children sharing the very same geometry and material are instanced,
// with their exact local matrices; held, named, data-carrying or transparent meshes stay live.
test('identical plain details become one instance set with unchanged transforms', () => {
  const geometry = new THREE.BoxGeometry(1, 2, 1), material = new THREE.MeshStandardMaterial({ color: 0x445566 }), group = new THREE.Group();
  const plain = [0, 1, 2].map(i => { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(i * 3, 0, -i); mesh.rotation.y = i * .4; mesh.scale.set(1, 1 + i, 1); group.add(mesh); return mesh; });
  const held = new THREE.Mesh(geometry, material); group.add(held);
  const named = new THREE.Mesh(geometry, material); named.name = 'door'; group.add(named);
  const tagged = new THREE.Mesh(geometry, material); tagged.userData.destructible = true; group.add(tagged);
  const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: .5 }); for (let i = 0; i < 2; i++) group.add(new THREE.Mesh(geometry, glass));
  const expected = plain.map(mesh => { mesh.updateMatrix(); return mesh.matrix.clone(); });
  const environment = { sectorVisuals: new Map([['insertion', group]]), doorMesh: held };
  const result = instanceIdenticalDetails(environment);
  assert.deepEqual(result, { sourceMeshes: 3, instancedMeshes: 1 });
  const instances = group.children.find(child => child.isInstancedMesh);
  assert.equal(instances.count, 3); assert.equal(instances.geometry, geometry); assert.equal(instances.material, material);
  const matrix = new THREE.Matrix4();
  expected.forEach((value, index) => { instances.getMatrixAt(index, matrix); assert.ok(matrix.elements.every((v, i) => Math.abs(v - value.elements[i]) < 1e-6), `instance ${index} keeps its transform`); });
  for (const kept of [held, named, tagged]) assert.equal(kept.parent, group);
  assert.equal(group.children.filter(child => child.material === glass).length, 2, 'transparent meshes are not instanced');
  assert.ok(plain.every(mesh => mesh.parent === null));
});

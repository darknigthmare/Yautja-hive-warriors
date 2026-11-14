import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { disposeObject } from '../js/engine/SceneResources.js';

test('removing an instanced actor releases its instance buffer lifecycle while retaining shared surfaces', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  const strands = new THREE.InstancedMesh(geometry, material, 16), peer = new THREE.InstancedMesh(geometry, material, 16);
  root.add(strands); scene.add(peer);
  const matrix = new THREE.Matrix4().makeTranslation(2, 3, 4); peer.setMatrixAt(0, matrix);
  let instances = 0, peerDisposals = 0, geometries = 0, materials = 0;
  strands.addEventListener('dispose', () => instances++); peer.addEventListener('dispose', () => peerDisposals++);
  geometry.addEventListener('dispose', () => geometries++); material.addEventListener('dispose', () => materials++);
  disposeObject(root, new Set([geometry, material]));
  assert.equal(root.parent, null); assert.equal(instances, 1, 'Three r160 frees instanceMatrix/instanceColor through the mesh dispose event');
  assert.equal(peerDisposals, 0); assert.equal(peer.parent, scene);
  assert.equal(geometries, 0); assert.equal(materials, 0);
  const after = new THREE.Matrix4(); peer.getMatrixAt(0, after); assert.deepEqual(after.elements, matrix.elements);
  disposeObject(peer); assert.equal(peerDisposals, 1); assert.equal(geometries, 1); assert.equal(materials, 1);
});

test('distinct instanced meshes dispose independently while shared owned geometry and material dispose once', () => {
  const root = new THREE.Group(), geometry = new THREE.SphereGeometry(1, 8, 6), material = new THREE.MeshStandardMaterial();
  let instances = 0, geometries = 0, materials = 0, ordinaryDisposals = 0;
  for (let i = 0; i < 2; i++) {
    const mesh = new THREE.InstancedMesh(geometry, material, 4);
    mesh.addEventListener('dispose', () => instances++); root.add(mesh);
  }
  const ordinary = new THREE.Mesh(geometry, material); ordinary.dispose = () => ordinaryDisposals++; root.add(ordinary);
  geometry.addEventListener('dispose', () => geometries++); material.addEventListener('dispose', () => materials++);
  disposeObject(root);
  assert.equal(instances, 2); assert.equal(geometries, 1); assert.equal(materials, 1);
  assert.equal(ordinaryDisposals, 0, 'do not call arbitrary object-level disposal hooks outside the Three instancing contract');
});

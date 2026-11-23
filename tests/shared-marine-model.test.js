import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMarineModel, createSharedMarineModel } from '../js/graphics/SupportModels.js';
import { disposeObject } from '../js/engine/SceneResources.js';

// Performance pass: battle marines are clones of one template per role.
test('a shared marine matches its role model, shares geometry, owns its materials and survives a disposal', () => {
  const built = createMarineModel('smartgunner'), a = createSharedMarineModel('smartgunner'), b = createSharedMarineModel('smartgunner');
  const meshes = object => { const list = []; object.traverse(node => { if (node.isMesh) list.push(node); }); return list; };
  const [mb, ma, mbb] = [meshes(built), meshes(a), meshes(b)];
  assert.equal(ma.length, mb.length);
  ma.forEach((mesh, index) => {
    assert.equal(mesh.geometry, mbb[index].geometry, 'geometry shared between clones');
    assert.notEqual(mesh.material, mbb[index].material, 'materials owned per marine');
    assert.equal(mesh.geometry.attributes.position.count, mb[index].geometry.attributes.position.count, 'same shape as a freshly built model');
  });
  const box = object => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).toArray().map(value => +value.toFixed(4));
  assert.deepEqual(box(a), box(built));
  assert.deepEqual(a.userData.marineAnatomy, built.userData.marineAnatomy);
  let disposed = 0; ma[0].geometry.addEventListener('dispose', () => disposed++);
  disposeObject(a);
  assert.equal(disposed, 0, 'disposing one marine keeps the shared template geometry');
  assert.equal(meshes(createSharedMarineModel('smartgunner'))[0].geometry, mbb[0].geometry);
});

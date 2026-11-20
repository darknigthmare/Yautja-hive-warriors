import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Assembly } from '../js/graphics/SupportAssembly.js';
import { addMarineAnatomy } from '../js/graphics/MarineAnatomy.js';
import { createMarineModel } from '../js/graphics/SupportModels.js';
import { disposeObject } from '../js/engine/SceneResources.js';

function body() {
  const mats = Object.fromEntries(['armor', 'dark', 'cloth', 'skin', 'rubber', 'steel'].map(name => {
    const material = new THREE.MeshStandardMaterial(); material.name = name;
    return [name, material];
  }));
  const parts = new Assembly('human-anatomy-fixture');
  const anatomy = addMarineAnatomy(parts, mats, 'marine'), group = parts.finish();
  group.updateMatrixWorld(true);
  return { group, anatomy };
}

function nearest(group, x, y, maximumZ = Infinity) {
  return new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1))
    .intersectObject(group, true).find(hit => hit.point.z < maximumZ);
}

test('human anatomy leaves room for existing weapons in the support rendering budget', () => {
  const { group, anatomy } = body();
  try {
    let triangles = 0;
    group.traverse(mesh => {
      if (!mesh.isMesh) return;
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      for (const name of ['position', 'normal', 'uv']) {
        const attribute = mesh.geometry.attributes[name];
        assert.ok(attribute?.count > 0, name);
        assert.equal(attribute.array.every(Number.isFinite), true, `${name} is finite`);
      }
    });
    assert.ok(triangles <= 37500, `${triangles} anatomy triangles must leave the existing role-equipment allowance`);
    assert.ok(group.children.length <= 7, 'the facial features share a single vertex-colored material');
    const bounds = new THREE.Box3().setFromObject(group);
    assert.ok(Math.abs(bounds.min.y) < 1e-6, 'the original feet remain on Y0');
    assert.ok(Math.abs(bounds.max.y - 3.445) < 1e-6, 'the original helmet envelope is retained');
    assert.deepEqual(group.position.toArray(), [0, 0, 0]);
    assert.deepEqual(group.scale.toArray(), [1, 1, 1]);
    assert.deepEqual(anatomy.legacyHandAnchors, { right: [.30, 2.09, .58], left: [.06, 2.07, .99] });
    assert.equal(anatomy.weaponGrips.length, 2);
    assert.ok(anatomy.headsTall > 7.2 && anatomy.headsTall < 8.2);
  } finally { disposeObject(group); }
});

test('human eyes and mouth remain visible outside the sculpted facial relief', () => {
  const { group, anatomy } = body();
  try {
    assert.equal(anatomy.facialLandmarks.filter(p => p.kind === 'eye').length, 2);
    for (const landmark of anatomy.facialLandmarks) {
      const [x, y] = landmark.position;
      assert.ok(landmark.position[2] > landmark.surface[2], `${landmark.kind} sits above its actual skin surface`);
      const hit = nearest(group, x, y);
      assert.equal(hit.object.material.name, 'human-facial-features', `${landmark.kind} is not buried beneath the head`);
      assert.ok(hit.point.z > landmark.surface[2] + .004);
      assert.equal(hit.object.material.vertexColors, true);
    }
  } finally { disposeObject(group); }
});

test('the fitted chest covers its original front without cloth or fastener poke-through', () => {
  const { group } = body();
  try {
    for (const x of [-.1, 0, .1]) for (const y of [2.02, 2.3, 2.48, 2.64])
      assert.equal(nearest(group, x, y, .4)?.object.material.name, 'armor', `chest ${x},${y}`);
  } finally { disposeObject(group); }
});

test('separate human actors own their new facial buffers and materials', () => {
  const first = body(), second = body();
  try {
    const faceA = first.group.children.find(mesh => mesh.material.name === 'human-facial-features');
    const faceB = second.group.children.find(mesh => mesh.material.name === 'human-facial-features');
    assert.notEqual(faceA.geometry, faceB.geometry);
    assert.notEqual(faceA.material, faceB.material);
    let disposed = 0;
    for (const mesh of first.group.children) {
      mesh.geometry.addEventListener('dispose', () => disposed++);
      mesh.material.addEventListener('dispose', () => disposed++);
    }
    let secondDisposed = false;
    faceB.material.addEventListener('dispose', () => { secondDisposed = true; });
    const expected = first.group.children.length * 2;
    disposeObject(first.group);
    assert.equal(disposed, expected, 'every owned geometry and material is released once');
    assert.equal(secondDisposed, false, 'another actor remains live');
    assert.equal(first.anatomy.factionInsigniaAdded, false);
    assert.equal(first.anatomy.equipmentRoleChanged, false);
    assert.equal(first.anatomy.visualFidelity1to1Verified, false);
  } finally { disposeObject(second.group); }
});

test('all eight integrated weapon roles retain their factory contract and rendering allowance', () => {
  for (const [argument, role] of [['marine', 'marine'], [true, 'smartgunner'], [false, 'flametrooper'],
    ['medic', 'medic'], ['commtech', 'commtech'], ['sniper', 'sniper'], ['sadar', 'sadar'], ['exosuit', 'exosuit']]) {
    const group = createMarineModel(argument);
    try {
      let triangles = 0;
      group.traverse(mesh => {
        if (mesh.isMesh) triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      });
      assert.equal(group.userData.weaponKind, role);
      assert.ok(triangles >= 30000 && triangles <= 46000, `${role}: ${triangles} triangles`);
      assert.ok(group.children.length <= 12, `${role} material batches`);
      assert.equal(group.userData.visualFidelity1to1Verified, false);
      assert.equal(group.userData.behaviorFidelity1to1Verified, false);
      assert.equal(group.userData.marineAnatomy.factionInsigniaAdded, false);
      const bounds = new THREE.Box3().setFromObject(group);
      assert.ok(Math.abs(bounds.min.y) < 1e-6, `${role} feet remain at Y0`);
      if (role !== 'commtech') assert.ok(Math.abs(bounds.max.y - 3.445) < 1e-6, `${role} head height`);
      else assert.ok(bounds.max.y > 3.6, 'the original CommTech antenna remains taller than the helmet');
    } finally { disposeObject(group); }
  }
});

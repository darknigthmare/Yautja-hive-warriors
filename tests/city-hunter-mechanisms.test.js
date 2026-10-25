import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createImportedCharacter } from '../js/graphics/ImportedCharacter.js';
import { CITY_HUNTER_RIG } from '../js/graphics/CityHunterRig.js';
import { CITY_HUNTER_CONSOLE } from '../js/graphics/CityHunterMechanismsCalibration.js';
import { installCityHunterMechanisms } from '../js/graphics/CityHunterMechanisms.js';

// Decode the actual shipping geometry/rig with texture stubs. This verifies
// geometry, UV ownership and animation; it does not claim a PBR render review.
const bytes = await readFile(new URL('../public/models/city-hunter-body-corrected.glb', import.meta.url));
const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(sourceSha256, CITY_HUNTER_CONSOLE.sourceSha256);
const template = await new GLTFLoader().register(() => ({ name: 'QA_CPU_TEXTURE_STUB',
  loadTexture: async () => new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1) }))
  .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');

function fixture() {
  const owner = Object.fromEntries(Object.keys(CITY_HUNTER_RIG.boneMap).map(role => [role === 'head' ? 'headMesh' : role, new THREE.Group()]));
  const adapter = createImportedCharacter(owner, template, { ...CITY_HUNTER_RIG, sourceSha256,
    requireHeadPartition: true, animateWhenUncontrolled: false, footGrounding: undefined });
  adapter.update(0, false);
  return { owner, adapter, source: adapter.model.getObjectByName('model_part11'),
    install() { return installCityHunterMechanisms(adapter, { sourceSha256 }); } };
}
const point = (mesh, vertex) => mesh.isSkinnedMesh
  ? mesh.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)
  : new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, vertex).applyMatrix4(mesh.matrixWorld);
function equalityError(source, replacement) {
  source.updateWorldMatrix(true, false); source.skeleton.update(); replacement.updateWorldMatrix(true, false);
  let maximum = 0;
  for (let vertex = 0; vertex < source.geometry.attributes.position.count; vertex++) maximum = Math.max(maximum, point(source, vertex).distanceTo(point(replacement, vertex)));
  return maximum;
}
function geometryDigest(geometry) {
  const hash = createHash('sha256');
  for (const attribute of [...Object.values(geometry.attributes), geometry.index].filter(Boolean)) {
    hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
  }
  return hash.digest('hex');
}
const cachedPlate = template.scene.getObjectByName('model_part11');
const cachedGeometryDigest = geometryDigest(cachedPlate.geometry);
const cachedHousing = template.scene.getObjectByName('model_part7');
const cachedHousingDigest = geometryDigest(cachedHousing.geometry);

test('actual corrected City Hunter plate preserves every closed and posed vertex, original UV and PBR material', () => {
  const f = fixture(), originalDigest = geometryDigest(f.source.geometry), controller = f.install();
  try {
    assert.equal(controller.diagnostics.maximumWeightError, 0);
    assert.equal(controller.diagnostics.rigidBone, 'LeftForeArm');
    assert.equal(controller.lid.geometry.index.count / 3, 740);
    assert.equal(controller.lid.geometry.attributes.position.count, 746);
    assert.deepEqual(controller.lid.geometry.index.array, f.source.geometry.index.array);
    assert.deepEqual(controller.lid.geometry.attributes.uv.array, f.source.geometry.attributes.uv.array);
    assert.equal(controller.lid.material, f.source.material, 'the original actor-owned PBR material is borrowed unchanged');
    assert.notEqual(controller.lid.geometry, f.source.geometry);
    assert.equal(f.source.visible, true, 'exact rest renders the original closed assembly');
    assert.equal(controller.hinge.visible, false); assert.equal(controller.consoleRoot.visible, false);
    assert.ok(equalityError(f.source, controller.lid) < 1e-6);
    for (const [arm, forearm] of [[0.5, 0], [-0.3, 0.4], [0.2, -0.55]]) {
      f.owner.leftArm.rotation.x = arm; f.owner.leftForeArm.rotation.z = forearm;
      f.adapter.update(0.02, false);
      assert.ok(equalityError(f.source, controller.lid) < 1e-6, 'the rigid replacement follows the exact original skin binding');
    }
    assert.equal(geometryDigest(f.source.geometry), originalDigest);
    assert.equal(geometryDigest(cachedPlate.geometry), cachedGeometryDigest);
    assert.ok(controller.diagnostics.addedConsoleTriangles <= 500);
    assert.equal(controller.diagnostics.addedConsoleDrawMeshes, 4);
  } finally { controller.dispose(); f.adapter.dispose(); }
});

test('opening moves the real plate around its hinge while the forearm and interior remain still', () => {
  const f = fixture(), controller = f.install();
  try {
    f.adapter.root.updateMatrixWorld(true);
    const before = point(controller.lid, 120), bodyBefore = point(f.source, 120);
    const boardBefore = controller.consoleRoot.matrixWorld.clone(), pivotBefore = controller.hinge.position.clone();
    assert.equal(controller.trigger('emp', 1.8), true); controller.update(0.4);
    f.adapter.root.updateMatrixWorld(true);
    assert.equal(controller.getState().amount, 1);
    assert.equal(f.source.visible, false); assert.equal(controller.hinge.visible, true);
    assert.ok(point(controller.lid, 120).distanceTo(before) > 0.04, 'an actual retained surface moves');
    assert.ok(point(f.source, 120).distanceTo(bodyBefore) < 1e-9);
    assert.deepEqual(controller.consoleRoot.matrixWorld.elements, boardBefore.elements);
    assert.ok(controller.hinge.position.equals(pivotBefore));
    controller.update(2);
    assert.equal(controller.getState().amount, 0);
    assert.equal(f.source.visible, true); assert.equal(controller.hinge.visible, false);
    assert.ok(equalityError(f.source, controller.lid) < 1e-6, 'automatic closure restores its exact original surface');
  } finally { controller.dispose(); f.adapter.dispose(); }
});

test('the recess cuts only the measured covered rigid armour on a private clone and restores its source', () => {
  const f = fixture(), housing = f.adapter.model.getObjectByName('model_part7');
  const skin = f.adapter.model.getObjectByName('model_part15'), skinGeometry = skin.geometry;
  const skinDigest = geometryDigest(skinGeometry), original = housing.geometry, originalDigest = geometryDigest(original);
  const controller = f.install(), patch = CITY_HUNTER_CONSOLE.housingPatch;
  assert.equal(housing.geometry, original, 'the original closed shell is rendered at exact rest');
  controller.trigger('emp', 2); controller.update(0.4);
  const removed = new Set(patch.faceRanges.flatMap(([first, count]) => Array.from({ length: count }, (_, i) => first + i)));
  const retained = [];
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const closedPlate = new THREE.Mesh(f.source.geometry, material), raycaster = new THREE.Raycaster();
  const n = new THREE.Vector3(...CITY_HUNTER_CONSOLE.n), u = new THREE.Vector3(...CITY_HUNTER_CONSOLE.u);
  const v = new THREE.Vector3(...CITY_HUNTER_CONSOLE.v), center = new THREE.Vector3(...CITY_HUNTER_CONSOLE.center);
  try {
    assert.equal(removed.size, 276); assert.notEqual(housing.geometry, original);
    for (const [name, attribute] of Object.entries(original.attributes)) {
      assert.deepEqual(housing.geometry.attributes[name].array, attribute.array, `${name} is retained bit for bit`);
    }
    for (let face = 0; face < original.index.count / 3; face++) {
      const indices = [0, 1, 2].map(corner => original.index.getX(face * 3 + corner));
      if (!removed.has(face)) { retained.push(...indices); continue; }
      const points = indices.map(vertex => new THREE.Vector3().fromBufferAttribute(original.attributes.position, vertex));
      for (const point of [...points, points[0].clone().add(points[1]).add(points[2]).multiplyScalar(1 / 3)]) {
        const relative = point.clone().sub(center), projected = [relative.dot(u), relative.dot(v), relative.dot(n)];
        projected.forEach((value, axis) => assert.ok(value >= patch.projectionBounds[0][axis] - 1e-7 && value <= patch.projectionBounds[1][axis] + 1e-7));
        raycaster.set(point.clone().addScaledVector(n, -1), n); raycaster.far = 0.999;
        assert.ok(raycaster.intersectObject(closedPlate).length > 0, 'each removed armour corner and centroid is behind the original closed plate');
      }
      const joint = housing.skeleton.bones.findIndex(bone => bone.name === 'LeftForeArm');
      for (const vertex of indices) for (let component = 0; component < 4; component++) {
        const weight = original.attributes.skinWeight.getComponent(vertex, component);
        if (weight > 0) assert.equal(original.attributes.skinIndex.getComponent(vertex, component), joint);
      }
    }
    assert.deepEqual([...housing.geometry.index.array], retained);
    assert.equal(housing.geometry.index.count / 3, 1656);
    assert.equal(skin.geometry, skinGeometry); assert.equal(geometryDigest(skin.geometry), skinDigest);
    assert.equal(geometryDigest(original), originalDigest); assert.equal(geometryDigest(cachedHousing.geometry), cachedHousingDigest);
    controller.dispose();
    assert.equal(housing.geometry, original); assert.equal(geometryDigest(housing.geometry), originalDigest);
  } finally { material.dispose(); controller.dispose(); f.adapter.dispose(); }
});

test('console actuation uses simulation time, freezes in pause and closes at the same time across frame rates', () => {
  const values = [];
  for (const frame of [1 / 10, 1 / 60, 1 / 120]) {
    const f = fixture(), controller = f.install();
    try {
      controller.trigger('nuke', 1.8);
      let elapsed = 0;
      while (elapsed < 2.05 - 1e-12) { const step = Math.min(frame, 2.05 - elapsed); controller.update(step); elapsed += step; }
      const before = controller.getState(); controller.update(10, { paused: true }); assert.deepEqual(controller.getState(), before);
      values.push(before.amount);
      controller.update(100); assert.equal(controller.getState().amount, 0);
      controller.setGauntletOpen(controller.id, 1); controller.update(0.4); assert.equal(controller.getState().amount, 1);
      controller.reset(); assert.equal(controller.getState().amount, 0); assert.equal(controller.getState().target, 0);
    } finally { controller.dispose(); f.adapter.dispose(); }
  }
  for (const value of values) assert.ok(Math.abs(value - 0.25) < 1e-10);
});

test('co-op instances own separate hinges, geometry, displays and command state without changing cached assets', () => {
  const a = fixture(), b = fixture(), ca = a.install(), cb = b.install();
  try {
    assert.notEqual(ca.lid.geometry, cb.lid.geometry); assert.notEqual(ca.lid.material, cb.lid.material);
    assert.notEqual(ca.materials[2].map, cb.materials[2].map);
    ca.trigger('heal', 2); ca.update(0.4);
    assert.equal(ca.getState().amount, 1); assert.equal(cb.getState().amount, 0);
    ca.materials[0].opacity = 0.2; assert.equal(cb.materials[0].opacity, 1);
    ca.dispose(); assert.ok(cb.hinge.parent); assert.equal(cb.source.visible, true);
    assert.equal(geometryDigest(cachedPlate.geometry), cachedGeometryDigest);
    assert.notEqual(ca.housing.geometry, cb.housing.geometry);
    assert.equal(geometryDigest(cachedHousing.geometry), cachedHousingDigest);
  } finally { ca.dispose(); cb.dispose(); a.adapter.dispose(); b.adapter.dispose(); }
});

test('disposal restores the source plate and releases only newly owned buffers, materials and display texture once', () => {
  const f = fixture(), originalHousing = f.adapter.model.getObjectByName('model_part7').geometry, controller = f.install();
  controller.trigger('emp', 2); controller.update(0.4);
  let sourceGeometry = 0, sourceMaterial = 0, sourceTexture = 0, ownGeometry = 0, ownMaterial = 0, ownTexture = 0, sourceHousing = 0, ownHousing = 0;
  f.source.geometry.addEventListener('dispose', () => sourceGeometry++);
  f.source.material.addEventListener('dispose', () => sourceMaterial++);
  f.source.material.map.addEventListener('dispose', () => sourceTexture++);
  controller.lid.geometry.addEventListener('dispose', () => ownGeometry++);
  controller.materials[0].addEventListener('dispose', () => ownMaterial++);
  controller.materials[2].map.addEventListener('dispose', () => ownTexture++);
  originalHousing.addEventListener('dispose', () => sourceHousing++);
  controller.housing.geometry.addEventListener('dispose', () => ownHousing++);
  controller.dispose(); controller.dispose();
  assert.equal(f.source.visible, true); assert.equal(controller.hinge.parent, null); assert.equal(controller.consoleRoot.parent, null);
  assert.deepEqual([sourceGeometry, sourceMaterial, sourceTexture], [0, 0, 0]);
  assert.deepEqual([ownGeometry, ownMaterial, ownTexture], [1, 1, 1]);
  assert.equal(controller.housing.geometry, originalHousing); assert.equal(sourceHousing, 0); assert.equal(ownHousing, 1);
  assert.equal(controller.trigger('emp', 1), false); assert.equal(controller.update(1), false);
  f.adapter.dispose();
});

test('source mismatch, unsupported skinning and duplicate installation fail before changing a plate', () => {
  const f = fixture();
  try {
    assert.throws(() => installCityHunterMechanisms(f.adapter, { sourceSha256: '0'.repeat(64) }), /SHA-256/);
    assert.equal(f.source.visible, true);
    const original = f.source.geometry.attributes.skinWeight.getX(0);
    f.source.geometry.attributes.skinWeight.setX(0, 0.8);
    assert.throws(() => f.install(), /not a rigid surface/); assert.equal(f.source.visible, true);
    f.source.geometry.attributes.skinWeight.setX(0, original);
    const housing = f.adapter.model.getObjectByName('model_part7');
    const patchVertex = housing.geometry.index.getX(CITY_HUNTER_CONSOLE.housingPatch.faceRanges[0][0] * 3);
    const originalHousingWeight = housing.geometry.attributes.skinWeight.getX(patchVertex);
    housing.geometry.attributes.skinWeight.setX(patchVertex, NaN);
    assert.throws(() => f.install(), /invalid armour patch skin weight/); assert.equal(f.source.visible, true);
    housing.geometry.attributes.skinWeight.setX(patchVertex, originalHousingWeight);
    const controller = f.install();
    assert.throws(() => f.install(), /already installed/);
    assert.equal(controller.trigger('unknown', 2), false); assert.equal(controller.trigger('emp', Infinity), false);
    assert.equal(controller.setGauntletOpen('missing', 1), false); assert.equal(controller.setGauntletOpen(controller.id, NaN), false);
    controller.dispose();
  } finally { f.adapter.dispose(); }
});

test('a plate originally hidden stays hidden at rest, during actuation and after disposal', () => {
  const f = fixture(); f.source.visible = false;
  const controller = f.install();
  try {
    assert.equal(f.source.visible, false); assert.equal(controller.hinge.visible, false); assert.equal(controller.consoleRoot.visible, false);
    controller.trigger('emp', 2); controller.update(0.4);
    assert.equal(f.source.visible, false); assert.equal(controller.hinge.visible, false); assert.equal(controller.consoleRoot.visible, false);
    controller.update(3); assert.equal(f.source.visible, false);
    controller.dispose(); assert.equal(f.source.visible, false);
  } finally { controller.dispose(); f.adapter.dispose(); }
});

after(() => {
  const geometry = new Set(), materials = new Set(), textures = new Set();
  template.scene.traverse(node => {
    if (node.geometry) geometry.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material) {
      materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometry.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
});

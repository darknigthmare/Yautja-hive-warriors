import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createImportedCharacter } from '../js/graphics/ImportedCharacter.js';
import { CITY_HUNTER_RIG } from '../js/graphics/CityHunterRig.js';
import { CITY_HUNTER_RIGHT_GAUNTLET as calibration } from '../js/graphics/CityHunterRightGauntletCalibration.js';
import { installCityHunterRightGauntlet } from '../js/graphics/CityHunterRightGauntlet.js';

// Actual shipping mesh/rig with CPU texture stubs; PBR pixels are reviewed separately.
const bytes = await readFile(new URL('../public/models/city-hunter-body-corrected.glb', import.meta.url));
const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(sourceSha256, calibration.sourceSha256);
const template = await new GLTFLoader().register(() => ({ name: 'QA_CPU_TEXTURE_STUB',
  loadTexture: async () => new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1) }))
  .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const digest = geometry => {
  const hash = createHash('sha256');
  for (const attribute of [...Object.values(geometry.attributes), geometry.index].filter(Boolean)) {
    hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
  }
  return hash.digest('hex');
};
const cached = calibration.parts.map(part => {
  const mesh = template.scene.getObjectByName(part.name);
  return { name: part.name, digest: digest(mesh.geometry), uuid: mesh.geometry.uuid, visible: mesh.visible };
});
const fixture = () => {
  const owner = Object.fromEntries(Object.keys(CITY_HUNTER_RIG.boneMap).map(role => [role === 'head' ? 'headMesh' : role, new THREE.Group()]));
  const adapter = createImportedCharacter(owner, template, { ...CITY_HUNTER_RIG, sourceSha256,
    requireHeadPartition: true, animateWhenUncontrolled: false, footGrounding: undefined });
  adapter.update(0, false);
  return { owner, adapter, install: () => installCityHunterRightGauntlet(adapter, { sourceSha256 }) };
};
const point = (mesh, vertex) => (mesh.isSkinnedMesh ? mesh.getVertexPosition(vertex, new THREE.Vector3())
  : new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, vertex)).applyMatrix4(mesh.matrixWorld);

// Mirror the skin-normal/tangent shader paths rather than merely comparing raw attributes.
function worldDirection(mesh, vertex, attribute) {
  const result = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes[attribute], vertex);
  if (mesh.isSkinnedMesh) {
    const sum = new THREE.Matrix4(); sum.elements.fill(0);
    const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
    for (let slot = 0; slot < 4; slot++) {
      const joint = indices.getComponent(vertex, slot), weight = weights.getComponent(vertex, slot);
      for (let at = 0; at < 16; at++) sum.elements[at] += weight * mesh.skeleton.boneMatrices[joint * 16 + at];
    }
    sum.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
    result.applyMatrix3(new THREE.Matrix3().setFromMatrix4(sum));
  }
  return result.applyMatrix3(attribute === 'normal' ? new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)
    : new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld)).normalize();
}

test('real armour preserves every rest vertex, UV, triangle, PBR material, normal and tangent', () => {
  const f = fixture(); let controller;
  try {
    controller = f.install(); f.adapter.root.updateMatrixWorld(true);
    assert.equal(controller.diagnostics.triangles, 3221); assert.equal(controller.diagnostics.vertices, 3254);
    assert.equal(controller.diagnostics.addedDrawCalls, 0);
    assert.equal(controller.diagnostics.fullWristbladeSeparation, false);
    let maximumPositionError = 0, maximumNormalError = 0, maximumTangentError = 0;
    for (const { source, replacement } of controller.parts) {
      source.skeleton.update();
      assert.equal(source.visible, false); assert.equal(replacement.visible, true);
      assert.equal(replacement.material.uuid, source.material.uuid);
      assert.notEqual(replacement.geometry.uuid, source.geometry.uuid);
      assert.deepEqual(replacement.geometry.index.array, source.geometry.index.array);
      assert.deepEqual(replacement.geometry.attributes.uv.array, source.geometry.attributes.uv.array);
      for (let vertex = 0; vertex < source.geometry.attributes.position.count; vertex++) {
        maximumPositionError = Math.max(maximumPositionError, point(source, vertex).distanceTo(point(replacement, vertex)));
        maximumNormalError = Math.max(maximumNormalError, worldDirection(source, vertex, 'normal').distanceTo(worldDirection(replacement, vertex, 'normal')));
        maximumTangentError = Math.max(maximumTangentError, worldDirection(source, vertex, 'tangent').distanceTo(worldDirection(replacement, vertex, 'tangent')));
        assert.equal(replacement.geometry.attributes.tangent.getW(vertex), source.geometry.attributes.tangent.getW(vertex));
      }
    }
    assert.ok(maximumPositionError < 1e-6, `rest surface error ${maximumPositionError}`);
    assert.ok(maximumNormalError < 2e-6, `rest normal error ${maximumNormalError}`);
    assert.ok(maximumTangentError < 2e-6, `rest tangent error ${maximumTangentError}`);
  } finally { controller?.dispose(); f.adapter.dispose(); }
});

test('wrist flex and elbow motion cannot bend the housing or drag it with the hand', () => {
  const f = fixture(); let controller;
  try {
    controller = f.install();
    const bone = controller.group.parent;
    const hand = controller.parts[0].source.skeleton.bones.find(candidate => candidate.name === 'RightHand');
    const handRest = hand.quaternion.clone();
    f.adapter.root.updateMatrixWorld(true);
    const initial = controller.parts.map(({ replacement }) => {
      const inverse = bone.matrixWorld.clone().invert();
      return Array.from({ length: replacement.geometry.attributes.position.count }, (_, vertex) => point(replacement, vertex).applyMatrix4(inverse));
    });
    let originalSkinDrift = 0, correctedDrift = 0;
    for (const pose of [[0, 0, 0.85], [-0.35, 0.65, -0.75], [0.5, -0.5, 0.45]]) {
      f.owner.rightArm.rotation.x = pose[0]; f.owner.rightForeArm.rotation.z = pose[1]; f.owner.rightHand.rotation.x = pose[2];
      f.adapter.update(0.02, false);
      // Hand controls are not among ImportedCharacter.ROLES yet; flex the real
      // skeleton joint so this also checks a future independently posed wrist.
      hand.quaternion.copy(handRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pose[2]));
      f.adapter.root.updateMatrixWorld(true);
      const inverse = bone.matrixWorld.clone().invert();
      controller.parts.forEach(({ source, replacement }, part) => {
        source.skeleton.update();
        for (let vertex = 0; vertex < replacement.geometry.attributes.position.count; vertex++) {
          correctedDrift = Math.max(correctedDrift, point(replacement, vertex).applyMatrix4(inverse).distanceTo(initial[part][vertex]));
          originalSkinDrift = Math.max(originalSkinDrift, point(source, vertex).applyMatrix4(inverse).distanceTo(initial[part][vertex]));
        }
      });
    }
    assert.ok(correctedDrift < 1e-9, `rigid housing drift ${correctedDrift}`);
    assert.ok(originalSkinDrift > 0.2, `original blended housing drift ${originalSkinDrift}`);
    // Neither the fused blades nor any face of the hand/arm was replaced or cut.
    const anatomy = f.adapter.model.getObjectByName('model_part1');
    assert.equal(anatomy.visible, true); assert.equal(anatomy.geometry.index.count / 3, 6743);
  } finally { controller?.dispose(); f.adapter.dispose(); }
});

test('toggle and idempotent disposal restore visibility without disposing borrowed PBR resources', () => {
  const f = fixture(); let controller, disposedGeometries = 0, disposedMaterials = 0;
  const source = f.adapter.model.getObjectByName('model_part8'); source.visible = false;
  try {
    controller = f.install();
    for (const part of controller.parts) {
      part.replacement.geometry.addEventListener('dispose', () => { disposedGeometries++; });
      part.source.material.addEventListener('dispose', () => { disposedMaterials++; });
    }
    assert.equal(controller.setEnabled(false), true); assert.equal(controller.group.visible, false);
    assert.equal(f.adapter.model.getObjectByName('model_part2').visible, true); assert.equal(source.visible, false);
    assert.equal(controller.setEnabled(true), true); assert.equal(controller.group.visible, true);
    controller.dispose(); controller.dispose();
    assert.equal(disposedGeometries, 3); assert.equal(disposedMaterials, 0);
    assert.equal(controller.group.parent, null);
    assert.equal(source.visible, false); assert.equal(f.adapter.model.getObjectByName('model_part2').visible, true);
    assert.equal(controller.setEnabled(true), false); assert.equal(controller.getState().disposed, true);
  } finally { controller?.dispose(); f.adapter.dispose(); }
});

test('each actor owns its geometry while the cached source geometry and visibility remain unchanged', () => {
  const a = fixture(), b = fixture(); let first, second;
  try {
    first = a.install(); second = b.install();
    assert.notEqual(first.group.uuid, second.group.uuid);
    first.parts.forEach((entry, i) => {
      assert.notEqual(entry.replacement.geometry.uuid, second.parts[i].replacement.geometry.uuid);
      assert.notEqual(entry.replacement.material.uuid, second.parts[i].replacement.material.uuid);
    });
    first.dispose();
    assert.equal(second.getState().enabled, true); assert.equal(second.group.visible, true);
    for (const saved of cached) {
      const mesh = template.scene.getObjectByName(saved.name);
      assert.equal(mesh.geometry.uuid, saved.uuid); assert.equal(digest(mesh.geometry), saved.digest); assert.equal(mesh.visible, saved.visible);
    }
  } finally { first?.dispose(); second?.dispose(); a.adapter.dispose(); b.adapter.dispose(); }
});

test('wrong source, duplicate installation and a late non-rest installation fail without hidden source surfaces', () => {
  const f = fixture(); let controller;
  try {
    assert.throws(() => installCityHunterRightGauntlet(f.adapter, { sourceSha256: 'wrong' }), /source SHA-256/);
    controller = f.install(); assert.throws(() => f.install(), /already installed/);
    controller.dispose();
    f.owner.rightForeArm.rotation.z = 0.9; f.adapter.update(0.02, false);
    assert.throws(() => f.install(), /install before posing/);
    assert.equal(Boolean(f.adapter.root.getObjectByName(calibration.id)), false);
    for (const part of calibration.parts) assert.equal(f.adapter.model.getObjectByName(part.name).visible, true);
  } finally { controller?.dispose(); f.adapter.dispose(); }
});

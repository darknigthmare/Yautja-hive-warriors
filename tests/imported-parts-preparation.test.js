import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { prepareImportedParts } from '../js/graphics/ImportedPartsPreparation.js';
import { createImportedPartRegions } from '../js/graphics/ImportedPartRegions.js';
import { createImportedCharacter } from '../js/graphics/ImportedCharacter.js';
import { composeCharacterWithBiomask } from '../js/graphics/BiomaskComposition.js';

const SOURCE_SHA = 'a'.repeat(64);
const close = (a, b, reason) => assert.ok(a.distanceTo(b) < 2e-6, reason ?? `${a.toArray()} != ${b.toArray()}`);
const worldVertex = (mesh, index) => mesh.localToWorld(mesh.getVertexPosition(index, new THREE.Vector3()));

// Synthetic bind-pose surfaces and measured curves only. No reference/film claim.
function fixture({ affine = false } = {}) {
  const scene = new THREE.Group(); scene.position.set(0.7, 1.2, -0.3); scene.rotation.y = 0.23; scene.scale.setScalar(1.2);
  const hips = new THREE.Bone(); hips.name = 'FixtureHips'; hips.position.y = 0.4; scene.add(hips);
  const head = new THREE.Bone(); head.name = 'FixtureHead'; head.position.set(0.05, 1.1, 0.07); head.rotation.set(0.1, 0.2, -0.03); hips.add(head);
  const positions = [-0.3, 0, 0, 0.3, 0, 0, 0, 1, 0, -0.15, 1.7, 0, 0.15, 1.7, 0, 0, 2, 0];
  const skinIndex = [], skinWeight = [], triangles = [0, 1, 2, 3, 4, 5], curves = [];
  const regions = [];
  for (let strand = 0; strand < 2; strand++) {
    const x = strand ? 0.2 : -0.2, offset = positions.length / 3, firstFace = triangles.length / 3;
    const joints = [[x, 1.5, 0], [x + 0.035, 1.2, 0.035], [x + 0.07, 0.9, 0.07]];
    for (let ring = 0; ring < 5; ring++) for (let edge = 0; edge < 3; edge++) {
      const t = ring / 4, theta = edge * Math.PI * 2 / 3;
      positions.push(x + 0.07 * t + Math.cos(theta) * 0.012, 1.5 - 0.6 * t, 0.07 * t + Math.sin(theta) * 0.012);
    }
    for (let ring = 0; ring < 4; ring++) for (let edge = 0; edge < 3; edge++) {
      const a = offset + ring * 3 + edge, b = offset + ring * 3 + (edge + 1) % 3;
      triangles.push(a, a + 3, b, b, a + 3, b + 3);
    }
    regions.push({ id: `hair${strand}`, faceRanges: [[firstFace, triangles.length / 3 - firstFace]] });
    curves.push({ version: 1, namespace: `PreparedHair${strand}`, chains: [{ id: `strand${strand}`, joints,
      allVertices: true, radius: 0.03, rootBlendLength: 0.045, gravityScale: 0, stiffness: 20, damping: 4, maxAngle: 1.2 }] });
  }
  const count = positions.length / 3;
  for (let i = 0; i < count; i++) { skinIndex.push(i < 3 ? 0 : 1, 0, 0, 0); skinWeight.push(1, 0, 0, 0); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from({ length: count }, (_, i) => [i / count, i % 3 / 2]).flat(), 2));
  geometry.setAttribute('color', new THREE.Uint8BufferAttribute(Array.from({ length: count }, () => [120, 60, 30]).flat(), 3, true));
  geometry.setAttribute('tangent', new THREE.Float32BufferAttribute(Array.from({ length: count }, () => [1, 0, 0, -1]).flat(), 4));
  geometry.setIndex(triangles); geometry.computeVertexNormals();
  const texture = new THREE.DataTexture(new Uint8Array([120, 60, 30, 255]), 1, 1);
  const material = new THREE.MeshStandardMaterial({ map: texture }); material.name = 'fixture-skin';
  const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = 'MergedFixture';
  mesh.position.set(0.1, -0.2, 0.15); mesh.rotation.set(0.07, -0.12, 0.05);
  if (affine) mesh.scale.set(1.1, 0.85, 1.2);
  scene.add(mesh); scene.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton([hips, head]), mesh.matrixWorld);
  const gltf = { scene, animations: [] };
  const partRegions = { version: 1, sourceSha256: SOURCE_SHA,
    meshes: [{ meshIndex: 0, vertexCount: count, triangleCount: triangles.length / 3, regions, unassignedId: 'body' }] };
  const measured = createImportedPartRegions(gltf, partRegions), measuredHead = measured.gltf.scene.getObjectByName('FixtureHead');
  measured.gltf.scene.updateMatrixWorld(true);
  const parts = curves.map((descriptor, i) => {
    const region = measured.regions.get(`hair${i}`), position = region.geometry.attributes.position;
    descriptor.rootVertices = Array.from({ length: position.count }, (_, at) => at).filter(at => position.getY(at) > 1.49);
    return { regionId: `hair${i}`, vertexCount: position.count, triangleCount: region.geometry.index.count / 3,
      meshLocalToHead: measuredHead.matrixWorld.clone().invert().multiply(region.matrixWorld).toArray(), descriptor };
  });
  measured.dispose();
  const rig = { partRegions, boneMap: { hips: 'FixtureHips', head: 'FixtureHead' },
    splitHair: { version: 1, calibrated: true, sourceSha256: SOURCE_SHA, headBone: 'FixtureHead', parts } };
  return { gltf, rig, scene, head, mesh, texture, geometry, material };
}

function baseline(f) {
  const regions = createImportedPartRegions(f.gltf, f.rig.partRegions), result = new Map();
  regions.gltf.scene.updateMatrixWorld(true);
  for (const [id, mesh] of regions.regions) {
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld), linear = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld);
    result.set(id, { world: Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => worldVertex(mesh, i)),
      normal: Array.from({ length: mesh.geometry.attributes.normal.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal, i).applyMatrix3(normalMatrix).normalize()),
      tangent: Array.from({ length: mesh.geometry.attributes.tangent.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.tangent, i).applyMatrix3(linear).normalize()),
      uv: mesh.geometry.attributes.uv.array.slice(), color: mesh.geometry.attributes.color.array.slice(),
      attributes: Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name, attribute]) => [name, attribute.array.slice()])),
      skin: mesh.geometry.attributes.skinIndex.array.slice(), weights: mesh.geometry.attributes.skinWeight.array.slice(), indices: mesh.geometry.index.array.slice() });
  }
  regions.dispose(); return result;
}

test('legacy imported bodies are untouched when no region/hair descriptors exist', () => {
  const f = fixture(), original = f.scene.toJSON();
  const prep = prepareImportedParts(f.gltf, {});
  assert.equal(prep.gltf, f.gltf); assert.equal(prep.articulationDescriptor, undefined);
  assert.equal(prep.diagnostics.regionsPrepared, false); assert.equal(prep.dispose(), true); assert.equal(prep.dispose(), false);
  assert.deepEqual(f.scene.toJSON(), original);
});

for (const affine of [false, true]) test(`prepared hair preserves every world rest vertex and affine surface direction (${affine ? 'nonuniform mesh' : 'uniform'})`, () => {
  const f = fixture({ affine }), before = baseline(f), original = f.scene.toJSON();
  const prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(prep.diagnostics.regionsPrepared, true); assert.equal(prep.diagnostics.hairPrepared, true, prep.diagnostics.hairError);
  assert.equal(prep.diagnostics.hairPieces, 2); assert.equal(prep.articulationDescriptor.dreadlocks.length, 2);
  prep.gltf.scene.updateMatrixWorld(true);
  for (const [id, mesh] of prep.regions) {
    if (mesh.isSkinnedMesh) mesh.skeleton.update();
    const record = before.get(id), normal = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld), linear = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld);
    record.world.forEach((point, i) => close(worldVertex(mesh, i), point, `world rest changed ${id}/${i}`));
    assert.deepEqual(mesh.geometry.attributes.uv.array, record.uv); assert.deepEqual(mesh.geometry.attributes.color.array, record.color);
    assert.deepEqual(mesh.geometry.index.array, record.indices);
    record.normal.forEach((point, i) => close(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal, i).applyMatrix3(normal).normalize(), point));
    record.tangent.forEach((point, i) => {
      close(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.tangent, i).applyMatrix3(linear).normalize(), point);
      assert.equal(mesh.geometry.attributes.tangent.getW(i), -1);
    });
    if (id === 'body') { assert.deepEqual(mesh.geometry.attributes.skinIndex.array, record.skin); assert.deepEqual(mesh.geometry.attributes.skinWeight.array, record.weights); }
    else { assert.equal(mesh.parent.name, 'FixtureHead'); assert.ok(mesh.skeleton.bones.length >= 4); }
  }
  assert.deepEqual(f.scene.toJSON(), original); prep.dispose(); assert.deepEqual(f.scene.toJSON(), original);
});

test('source hashes/topology and posed or unmeasured hair refuse replacement while keeping complete surfaces', () => {
  for (const mode of ['hash', 'topology', 'morph', 'posed', 'matrix', 'missing-matrix', 'second-piece', 'namespace']) {
    const f = fixture();
    if (mode === 'hash') f.rig.partRegions.sourceSha256 = 'b'.repeat(64);
    if (mode === 'topology') f.rig.partRegions.meshes[0].triangleCount++;
    if (mode === 'morph') {
      f.geometry.morphAttributes.position = [f.geometry.attributes.position.clone()];
      f.mesh.updateMorphTargets(); f.mesh.morphTargetInfluences[0] = 0.2;
    }
    if (mode === 'posed') { f.head.rotation.x += 0.2; f.scene.updateMatrixWorld(true); }
    if (mode === 'matrix') f.rig.splitHair.parts[0].meshLocalToHead[12] += 0.1;
    if (mode === 'missing-matrix') delete f.rig.splitHair.parts[0].meshLocalToHead;
    if (mode === 'second-piece') f.rig.splitHair.parts[1].vertexCount++;
    if (mode === 'namespace') f.rig.splitHair.parts[1].descriptor.namespace = f.rig.splitHair.parts[0].descriptor.namespace;
    const original = f.scene.toJSON(), prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
    assert.equal(prep.diagnostics.hairPrepared, false, mode);
    if (mode === 'hash' || mode === 'topology' || mode === 'morph') { assert.equal(prep.gltf, f.gltf); assert.ok(prep.diagnostics.regionError); }
    else {
      assert.ok(prep.diagnostics.hairError, mode); assert.equal(prep.regions.size, 3);
      for (const mesh of prep.regions.values()) { assert.equal(mesh.isSkinnedMesh, true); assert.ok(mesh.parent, `${mode}: original region detached`); }
    }
    assert.deepEqual(f.scene.toJSON(), original); prep.dispose();
  }
});

test('adapter owns prepared hair clones, moves real surfaces, hides them in FPS and survives temporary cleanup', () => {
  const f = fixture(), prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  const owner = { headMesh: new THREE.Group() };
  const adapter = createImportedCharacter(owner, prep.gltf, { boneMap: f.rig.boneMap, height: 4.1,
    articulation: prep.articulationDescriptor, articulationOptions: { gravity: [0, 0, 0] }, requireHeadPartition: true });
  const hair = adapter.model.getObjectByName('hair0'), capIndex = f.rig.splitHair.parts[0].descriptor.rootVertices[0];
  let tipIndex = 0; const p = hair.geometry.attributes.position;
  for (let i = 1; i < p.count; i++) if (p.getY(i) < p.getY(tipIndex)) tipIndex = i;
  const before = worldVertex(hair, tipIndex), cap = worldVertex(hair, capIndex);
  let originalDisposals = 0, adapterDisposals = 0;
  [f.geometry, f.material, f.texture].forEach(resource => resource.addEventListener('dispose', () => originalDisposals++));
  hair.geometry.addEventListener('dispose', () => adapterDisposals++);
  prep.dispose(); prep.dispose(); assert.equal(originalDisposals, 0); assert.equal(adapterDisposals, 0);
  owner.headMesh.position.x += 0.2; adapter.update(1 / 60);
  close(worldVertex(hair, capIndex), cap.clone().add(new THREE.Vector3(0.2, 0, 0)));
  assert.ok(worldVertex(hair, tipIndex).distanceTo(before.clone().add(new THREE.Vector3(0.2, 0, 0))) > 0.005, 'weighted surface must lag, not only helper bones');
  owner.headMesh.visible = false; adapter.update(1 / 60);
  assert.equal(hair.visible, false); assert.equal(adapter.articulation.getState().hairActive, false);
  owner.headMesh.visible = true; adapter.update(1 / 60); assert.equal(hair.visible, true);
  adapter.dispose(); adapter.dispose(); assert.equal(adapterDisposals, 1); assert.equal(originalDisposals, 0);
});

test('an exporter neutral skin unit matrix is accepted only when explicitly measured and verified on every rendered vertex', () => {
  const f = fixture(), scale = new THREE.Matrix4().makeScale(100, 100, 100);
  f.scene.scale.multiplyScalar(0.01); f.scene.updateMatrixWorld(true);
  f.mesh.skeleton.calculateInverses(); f.mesh.bind(f.mesh.skeleton, f.mesh.matrixWorld);
  // Synthetic exporter bind-unit conversion; all bone inverses retain the same
  // known affine conversion, rather than substituting a fitted pose transform.
  for (const inverse of f.mesh.skeleton.boneInverses) inverse.multiply(f.mesh.bindMatrix).multiply(scale).multiply(f.mesh.bindMatrixInverse);
  f.scene.updateMatrixWorld(true); f.mesh.skeleton.update();
  const noMeasurement = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(noMeasurement.diagnostics.hairPrepared, false); assert.match(noMeasurement.diagnostics.hairError, /posed/); noMeasurement.dispose();
  for (const piece of f.rig.splitHair.parts) piece.neutralSkinMatrix = scale.toArray();
  const before = baseline(f), original = f.scene.toJSON();
  const prepared = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(prepared.diagnostics.hairPrepared, true, prepared.diagnostics.hairError);
  assert.ok(prepared.diagnostics.hairMaxNeutralWorldError < 1e-6);
  for (const [id, mesh] of prepared.regions) {
    mesh.updateWorldMatrix(true, true); mesh.skeleton.update();
    before.get(id).world.forEach((position, vertex) => close(worldVertex(mesh, vertex), position));
  }
  prepared.dispose(); assert.deepEqual(f.scene.toJSON(), original);
  f.rig.splitHair.parts[1].neutralSkinMatrix = new THREE.Matrix4().makeScale(99, 99, 99).toArray();
  const wrong = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(wrong.diagnostics.hairPrepared, false); assert.match(wrong.diagnostics.hairError, /posed/);
  assert.ok([...wrong.regions.values()].every(mesh => mesh.parent && mesh.isSkinnedMesh)); wrong.dispose();
});

test('refused morph partition retains animation through biomask composition and the adapter clone', () => {
  const f = fixture(), delta = new Float32Array(f.geometry.attributes.position.count * 3);
  for (let i = 0; i < f.geometry.attributes.position.count; i++) delta[i * 3 + 1] = 0.1;
  f.geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(delta, 3)];
  f.geometry.morphTargetsRelative = true; f.mesh.updateMorphTargets(); f.mesh.morphTargetInfluences[0] = 0.2;
  const original = f.scene.toJSON(), prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(prep.gltf, f.gltf); assert.match(prep.diagnostics.regionError, /morph animation/);
  const maskScene = new THREE.Group();
  maskScene.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), new THREE.MeshStandardMaterial()));
  const composed = composeCharacterWithBiomask(prep.gltf, { scene: maskScene }, {
    assetKey: 'fixture_biomask', bone: 'FixtureHead', position: [0, 0, 0.1], quaternion: [0, 0, 0, 1], scale: [1, 1, 1]
  }, { headBoneName: 'FixtureHead' });
  const adapter = createImportedCharacter({}, composed, { boneMap: f.rig.boneMap, requireHeadPartition: true });
  composed.disposeComposition(); prep.dispose();
  const body = adapter.model.getObjectByName('MergedFixture'), head = adapter.model.getObjectByName('MergedFixture-head-partition');
  const before = worldVertex(body, 0);
  const clip = new THREE.AnimationClip('fixture-expression', 1, [new THREE.NumberKeyframeTrack('MergedFixture.morphTargetInfluences[0]', [0, 1], [0.2, 0.6])]);
  const mixer = new THREE.AnimationMixer(adapter.model), action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play(); mixer.update(1); adapter.update(0);
  assert.ok(Math.abs(body.morphTargetInfluences[0] - 0.6) < 1e-6);
  assert.ok(Math.abs(head.morphTargetInfluences[0] - 0.6) < 1e-6);
  assert.ok(worldVertex(body, 0).distanceTo(before) > 0.01, 'the original named clip must still deform real body vertices');
  adapter.setHeadVisible(false); assert.equal(head.visible, false); assert.equal(body.visible, true);
  mixer.stopAllAction(); mixer.uncacheRoot(adapter.model); adapter.dispose();
  assert.deepEqual(f.scene.toJSON(), original);
});

function skinFilterFixture() {
  const f = fixture(), hips = f.scene.getObjectByName('FixtureHips');
  const arm = new THREE.Bone(); arm.name = 'FixtureForeignArm'; arm.position.set(0.6, 0.8, 0.1); hips.add(arm);
  f.scene.updateMatrixWorld(true); f.mesh.bind(new THREE.Skeleton([hips, f.head, arm]), f.mesh.matrixWorld);
  for (let vertex = 0; vertex < f.geometry.attributes.position.count; vertex++) {
    f.geometry.attributes.skinIndex.setXYZW(vertex, 1, 2, 0, 0);
    f.geometry.attributes.skinWeight.setXYZW(vertex, 0.25, 0.5, 0.25, 0);
  }
  const regions = f.rig.splitHair.parts.map(piece => ({ regionId: piece.regionId, vertexCount: piece.vertexCount,
    triangleCount: piece.triangleCount, keepBones: ['FixtureHead', 'FixtureHips'], minRetainedWeight: 0.49 }));
  delete f.rig.splitHair;
  f.rig.partSkinFilters = { version: 1, calibrated: true, sourceSha256: SOURCE_SHA, regions };
  return { ...f, arm };
}

test('measured skin filters preserve every rest vertex and surface attribute, remove only foreign weights, and retain anatomical blending', () => {
  const f = skinFilterFixture(), before = baseline(f), original = f.scene.toJSON();
  const prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(prep.diagnostics.skinFiltersPrepared, true, prep.diagnostics.skinFilterError);
  assert.equal(prep.diagnostics.skinFilteredRegions, 2);
  assert.equal(prep.diagnostics.skinFilteredVertices, 30);
  assert.ok(prep.diagnostics.skinMaxRestWorldError < 1e-6);
  for (const [id, mesh] of prep.regions) {
    const record = before.get(id), geometry = mesh.geometry;
    mesh.updateWorldMatrix(true, true); mesh.skeleton.update();
    record.world.forEach((point, vertex) => close(worldVertex(mesh, vertex), point));
    assert.deepEqual(geometry.attributes.skinIndex.array, record.skin);
    assert.deepEqual(geometry.attributes.uv.array, record.uv); assert.deepEqual(geometry.attributes.color.array, record.color);
    assert.deepEqual(geometry.index.array, record.indices);
    const sourceGeometry = f.geometry;
    for (const [name, attribute] of Object.entries(geometry.attributes)) if (!['skinWeight', 'skinIndex'].includes(name)) {
      assert.deepEqual(attribute.array, record.attributes[name], `${id}/${name} changed`);
      assert.equal(attribute.array.constructor, sourceGeometry.attributes[name].array.constructor);
    }
    if (id === 'body') assert.deepEqual(geometry.attributes.skinWeight.array, record.weights);
    else for (let vertex = 0; vertex < geometry.attributes.position.count; vertex++) {
      assert.deepEqual(Array.from(geometry.attributes.skinWeight.array.subarray(vertex * 4, vertex * 4 + 4)), [0.5, 0, 0.5, 0]);
    }
  }
  const strand = prep.regions.get('hair0'), tip = 12, resting = worldVertex(strand, tip);
  const foreign = prep.gltf.scene.getObjectByName('FixtureForeignArm');
  foreign.rotation.z += 0.5; prep.gltf.scene.updateMatrixWorld(true); strand.skeleton.update();
  close(worldVertex(strand, tip), resting, 'foreign arm rotation must no longer deform this measured region');
  const head = prep.gltf.scene.getObjectByName('FixtureHead');
  head.rotation.z += 0.2; prep.gltf.scene.updateMatrixWorld(true); strand.skeleton.update();
  const blended = worldVertex(strand, tip);
  assert.ok(blended.distanceTo(resting) > 0.001, 'existing anatomical head influence must still deform the region');
  const weights = strand.geometry.attributes.skinWeight;
  weights.setXYZW(tip, 1, 0, 0, 0); strand.skeleton.update();
  const fullyHead = worldVertex(strand, tip);
  weights.setXYZW(tip, 0.5, 0, 0.5, 0);
  close(blended, resting.clone().lerp(fullyHead, 0.5), 'neck/hips blend must remain, rather than forcing a rigid head');
  assert.deepEqual(f.scene.toJSON(), original); prep.dispose(); assert.deepEqual(f.scene.toJSON(), original);
});

test('skin filter validation and second-region failures roll back every candidate weight attribute', () => {
  const modes = ['hash', 'version', 'uncalibrated', 'empty', 'missing-region', 'duplicate-region', 'vertex-count', 'triangle-count',
    'missing-bone', 'duplicate-bone', 'ambiguous-bone', 'no-bones', 'minimum-nan', 'minimum-zero', 'minimum-high', 'too-little-retained',
    'zero-retained', 'negative-weight', 'nan-weight', 'bad-index', 'unnormalized', 'posed', 'posed-second'];
  for (const mode of modes) {
    const f = skinFilterFixture(), config = f.rig.partSkinFilters, second = config.regions[1];
    if (mode === 'hash') config.sourceSha256 = 'b'.repeat(64);
    if (mode === 'version') config.version = 2;
    if (mode === 'uncalibrated') config.calibrated = false;
    if (mode === 'empty') config.regions = [];
    if (mode === 'missing-region') second.regionId = 'missing';
    if (mode === 'duplicate-region') second.regionId = config.regions[0].regionId;
    if (mode === 'vertex-count') second.vertexCount++;
    if (mode === 'triangle-count') second.triangleCount++;
    if (mode === 'missing-bone') second.keepBones = ['AbsentBone'];
    if (mode === 'duplicate-bone') second.keepBones = ['FixtureHead', 'FixtureHead'];
    if (mode === 'ambiguous-bone') f.arm.name = 'FixtureHead';
    if (mode === 'no-bones') second.keepBones = [];
    if (mode === 'minimum-nan') second.minRetainedWeight = NaN;
    if (mode === 'minimum-zero') second.minRetainedWeight = 0;
    if (mode === 'minimum-high') second.minRetainedWeight = 1.1;
    if (mode === 'too-little-retained') second.minRetainedWeight = 0.75;
    if (mode === 'zero-retained') second.keepBones = ['FixtureForeignArm'];
    const start = f.geometry.attributes.position.count - 15;
    if (mode === 'zero-retained') for (let i = start; i < start + 15; i++) f.geometry.attributes.skinWeight.setXYZW(i, 0.5, 0, 0.5, 0);
    if (mode === 'negative-weight') f.geometry.attributes.skinWeight.setX(start, -0.1);
    if (mode === 'nan-weight') f.geometry.attributes.skinWeight.setX(start, NaN);
    if (mode === 'bad-index') f.geometry.attributes.skinIndex.setY(start, 40);
    if (mode === 'unnormalized') f.geometry.attributes.skinWeight.setY(start, 0.2);
    if (mode === 'posed') { f.arm.rotation.x = 0.3; f.scene.updateMatrixWorld(true); }
    if (mode === 'posed-second') {
      const secondForeign = new THREE.Bone(); secondForeign.name = 'SecondForeignArm';
      secondForeign.position.set(-0.4, 0.7, 0.1); f.scene.getObjectByName('FixtureHips').add(secondForeign);
      f.scene.updateMatrixWorld(true);
      f.mesh.bind(new THREE.Skeleton([...f.mesh.skeleton.bones, secondForeign]), f.mesh.matrixWorld);
      for (let vertex = start; vertex < start + 15; vertex++) f.geometry.attributes.skinIndex.setY(vertex, 3);
      secondForeign.rotation.x = 0.3; f.scene.updateMatrixWorld(true);
    }
    const originalWeights = f.geometry.attributes.skinWeight.array.slice();
    if (['negative-weight', 'nan-weight', 'bad-index'].includes(mode)) {
      const prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
      assert.equal(prep.gltf, f.gltf); assert.equal(prep.diagnostics.regionsPrepared, false);
      assert.ok(prep.diagnostics.regionError); assert.deepEqual(f.geometry.attributes.skinWeight.array, originalWeights);
      prep.dispose(); continue;
    }
    const before = createImportedPartRegions(f.gltf, f.rig.partRegions);
    const originalByRegion = new Map([...before.regions].map(([id, mesh]) => [id, mesh.geometry.attributes.skinWeight.array.slice()]));
    before.dispose();
    const prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
    assert.equal(prep.diagnostics.skinFiltersPrepared, false, mode);
    assert.ok(prep.diagnostics.skinFilterError, mode);
    if (mode.startsWith('posed')) assert.match(prep.diagnostics.skinFilterError, /world rest surface/, mode);
    assert.equal(prep.diagnostics.skinFilteredRegions, 0, mode);
    for (const [id, mesh] of prep.regions) assert.deepEqual(mesh.geometry.attributes.skinWeight.array, originalByRegion.get(id), `${mode}/${id} candidate leaked`);
    assert.deepEqual(f.geometry.attributes.skinWeight.array, originalWeights, mode); prep.dispose();
  }
});

test('normalized integer source weights become accurate private float weights and survive adapter ownership and cleanup', () => {
  const f = skinFilterFixture(), count = f.geometry.attributes.position.count;
  f.geometry.setAttribute('skinWeight', new THREE.Uint16BufferAttribute(Array.from({ length: count }, () => [16384, 32767, 16384, 0]).flat(), 4, true));
  const original = f.scene.toJSON(), first = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  const second = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(first.diagnostics.skinFiltersPrepared, true, first.diagnostics.skinFilterError);
  assert.equal(second.diagnostics.skinFiltersPrepared, true, second.diagnostics.skinFilterError);
  const firstWeights = first.regions.get('hair0').geometry.attributes.skinWeight;
  assert.ok(firstWeights.array instanceof Float32Array); assert.equal(firstWeights.normalized, false);
  assert.equal(firstWeights.getX(0), 0.5); assert.equal(firstWeights.getZ(0), 0.5);
  assert.notEqual(firstWeights, second.regions.get('hair0').geometry.attributes.skinWeight);
  const adapter = createImportedCharacter({}, first.gltf, { boneMap: f.rig.boneMap });
  const actor = adapter.model.getObjectByName('hair0'), actorWeights = actor.geometry.attributes.skinWeight.array.slice();
  assert.notEqual(actor.geometry, first.regions.get('hair0').geometry);
  let sourceDisposals = 0, actorDisposals = 0;
  [f.geometry, f.material, f.texture].forEach(resource => resource.addEventListener('dispose', () => sourceDisposals++));
  actor.geometry.addEventListener('dispose', () => actorDisposals++);
  first.dispose(); second.dispose();
  assert.equal(actorDisposals, 0); assert.equal(sourceDisposals, 0);
  assert.deepEqual(actor.geometry.attributes.skinWeight.array, actorWeights);
  adapter.dispose(); adapter.dispose(); assert.equal(actorDisposals, 1); assert.equal(sourceDisposals, 0);
  assert.deepEqual(f.scene.toJSON(), original);
});

test('measured sparse vertex ranges and explicit indices filter only exact seam copies and preserve the whole rest surface', () => {
  const selected = [1, 2, 7, 8, 9], outputs = [];
  for (const mode of ['ranges', 'indices']) {
    const f = skinFilterFixture(), specification = f.rig.partSkinFilters.regions[1], before = baseline(f);
    if (mode === 'ranges') specification.vertexRanges = [[1, 2], [7, 3]];
    else specification.vertexIndices = selected;
    const source = f.scene.toJSON(), prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
    assert.equal(prep.diagnostics.skinFiltersPrepared, true, prep.diagnostics.skinFilterError);
    assert.equal(prep.diagnostics.skinFilteredVertices, 20);
    assert.equal(prep.diagnostics.skinFilterRegions[1].selectedVertexCount, selected.length);
    const mesh = prep.regions.get('hair1'), weights = mesh.geometry.attributes.skinWeight;
    before.get('hair1').world.forEach((point, vertex) => close(worldVertex(mesh, vertex), point));
    for (let vertex = 0; vertex < weights.count; vertex++) {
      const actual = Array.from(weights.array.subarray(vertex * 4, vertex * 4 + 4));
      const expected = selected.includes(vertex) ? [0.5, 0, 0.5, 0] : Array.from(before.get('hair1').weights.subarray(vertex * 4, vertex * 4 + 4));
      assert.deepEqual(actual, expected, `${mode}: unmeasured vertex ${vertex} was changed`);
    }
    for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) if (name !== 'skinWeight') assert.deepEqual(attribute.array, before.get('hair1').attributes[name]);
    outputs.push(weights.array.slice()); prep.dispose(); assert.deepEqual(f.scene.toJSON(), source);
  }
  assert.deepEqual(outputs[0], outputs[1]);
});

test('ambiguous, unordered, overlapping or unbounded sparse skin selections refuse all staged filters', () => {
  const selections = [
    { vertexIndices: [] }, { vertexIndices: [-1] }, { vertexIndices: [1.5] }, { vertexIndices: [15] },
    { vertexIndices: [2, 1] }, { vertexIndices: [1, 1] }, { vertexIndices: [NaN] },
    { vertexRanges: [] }, { vertexRanges: [[-1, 1]] }, { vertexRanges: [[0, 0]] }, { vertexRanges: [[0, -1]] },
    { vertexRanges: [[0, 1.5]] }, { vertexRanges: [[1.5, 1]] }, { vertexRanges: [[14, 2]] },
    { vertexRanges: [[1, 3], [3, 2]] }, { vertexRanges: [[5, 1], [1, 1]] }, { vertexRanges: [[1]] },
    { vertexRanges: [[1, 1]], vertexIndices: [1] }
  ];
  for (const selection of selections) {
    const f = skinFilterFixture(); Object.assign(f.rig.partSkinFilters.regions[1], selection);
    const before = baseline(f), original = f.scene.toJSON(), prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
    assert.equal(prep.diagnostics.skinFiltersPrepared, false, JSON.stringify(selection));
    assert.ok(prep.diagnostics.skinFilterError);
    for (const [id, mesh] of prep.regions) assert.deepEqual(mesh.geometry.attributes.skinWeight.array, before.get(id).weights);
    prep.dispose(); assert.deepEqual(f.scene.toJSON(), original);
  }
});

test('measured blend weights follow selected vertex order and interpolate real posed surfaces without new bone influences', () => {
  const f = skinFilterFixture(), selected = [1, 2, 7, 8, 9], alphas = [0.125, 0.25, 0.5, 0.75, 1];
  const original = f.scene.toJSON(), unfiltered = createImportedPartRegions(f.gltf, f.rig.partRegions);
  const full = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  f.rig.partSkinFilters.regions[1].vertexRanges = [[1, 2], [7, 3]];
  f.rig.partSkinFilters.regions[1].blendWeights = alphas;
  const blended = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(blended.diagnostics.skinFiltersPrepared, true, blended.diagnostics.skinFilterError);
  const record = blended.diagnostics.skinFilterRegions[1];
  assert.equal(record.minBlendWeight, 0.125); assert.equal(record.maxBlendWeight, 1);
  assert.equal(record.removedInfluenceSlots, 1); assert.equal(record.attenuatedInfluenceSlots, 5);
  const partial = blended.regions.get('hair1'), originalMesh = unfiltered.regions.get('hair1'), fullMesh = full.regions.get('hair1');
  for (let vertex = 0; vertex < partial.geometry.attributes.position.count; vertex++) {
    const selectionAt = selected.indexOf(vertex), alpha = selectionAt === -1 ? 0 : alphas[selectionAt];
    const weights = partial.geometry.attributes.skinWeight;
    assert.equal(weights.getX(vertex), 0.25 + 0.25 * alpha);
    assert.equal(weights.getY(vertex), 0.5 * (1 - alpha));
    assert.equal(weights.getZ(vertex), 0.25 + 0.25 * alpha); assert.equal(weights.getW(vertex), 0);
    assert.equal(weights.getX(vertex) + weights.getY(vertex) + weights.getZ(vertex), 1);
  }
  assert.deepEqual(partial.geometry.attributes.skinIndex.array, originalMesh.geometry.attributes.skinIndex.array);
  for (const preparation of [unfiltered, full, blended]) {
    preparation.gltf.scene.getObjectByName('FixtureForeignArm').rotation.x = 0.4;
    preparation.gltf.scene.updateMatrixWorld(true);
    preparation.gltf.scene.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.skeleton.update(); });
  }
  for (let vertex = 0; vertex < partial.geometry.attributes.position.count; vertex++) {
    const selectionAt = selected.indexOf(vertex), alpha = selectionAt === -1 ? 0 : alphas[selectionAt];
    close(worldVertex(partial, vertex), worldVertex(originalMesh, vertex).lerp(worldVertex(fullMesh, vertex), alpha));
  }
  assert.deepEqual(f.scene.toJSON(), original);
  unfiltered.dispose(); full.dispose(); blended.dispose(); assert.deepEqual(f.scene.toJSON(), original);
});

test('invalid measured blend arrays refuse all staged regions and never infer missing or zero strengths', () => {
  const invalid = [[], [1], [1, 1, 1], [0, 1], [-0.1, 1], [1.1, 1], [NaN, 1], [Infinity, 1], [null, 1], [, 1], { 0: 1, 1: 1, length: 2 }];
  for (const blendWeights of invalid) {
    const f = skinFilterFixture(), specification = f.rig.partSkinFilters.regions[1];
    specification.vertexIndices = [1, 2]; specification.blendWeights = blendWeights;
    const before = baseline(f), original = f.scene.toJSON(), prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
    assert.equal(prep.diagnostics.skinFiltersPrepared, false);
    assert.match(prep.diagnostics.skinFilterError, /blend weights/);
    for (const [id, mesh] of prep.regions) assert.deepEqual(mesh.geometry.attributes.skinWeight.array, before.get(id).weights);
    prep.dispose(); assert.deepEqual(f.scene.toJSON(), original);
  }
});

function orderedFilterFixture() {
  const f = skinFilterFixture(), first = f.rig.partSkinFilters.regions.map(specification => ({ ...specification,
    minRetainedWeight: 0.2, blendWeights: Array(specification.vertexCount).fill(0.5) }));
  const second = { ...f.rig.partSkinFilters.regions[0], keepBones: ['FixtureHead', 'FixtureForeignArm'], minRetainedWeight: 0.6 };
  delete f.rig.partSkinFilters.regions;
  f.rig.partSkinFilters.passes = [{ regions: first }, { regions: [second] }];
  return f;
}

test('ordered skin filter passes use preceding weights and preserve single-pass compatibility', () => {
  const f = orderedFilterFixture(), before = baseline(f), original = f.scene.toJSON();
  const prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(prep.diagnostics.skinFiltersPrepared, true, prep.diagnostics.skinFilterError);
  assert.equal(prep.diagnostics.skinFilterPasses, 2); assert.equal(prep.diagnostics.skinFilteredRegions, 2);
  assert.equal(prep.diagnostics.skinFilteredVertices, 45);
  assert.deepEqual(prep.diagnostics.skinFilterRegions.map(value => value.passIndex), [0, 0, 1]);
  const first = prep.regions.get('hair0').geometry.attributes.skinWeight, second = prep.regions.get('hair1').geometry.attributes.skinWeight;
  assert.ok(Math.abs(first.getX(0) - 0.6) < 1e-7); assert.ok(Math.abs(first.getY(0) - 0.4) < 1e-7); assert.equal(first.getZ(0), 0);
  assert.deepEqual(Array.from(second.array.subarray(0, 4)), [0.375, 0.25, 0.375, 0]);
  for (const [id, mesh] of prep.regions) before.get(id).world.forEach((point, vertex) => close(worldVertex(mesh, vertex), point));
  prep.dispose(); assert.deepEqual(f.scene.toJSON(), original);

  // Reversing the measured operations yields a different result; this must not
  // be flattened or sorted into a single unordered pass.
  const reverse = orderedFilterFixture(); reverse.rig.partSkinFilters.passes.reverse();
  const reversed = prepareImportedParts(reverse.gltf, reverse.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(reversed.diagnostics.skinFiltersPrepared, true, reversed.diagnostics.skinFilterError);
  const reverseWeights = reversed.regions.get('hair0').geometry.attributes.skinWeight;
  assert.ok(Math.abs(reverseWeights.getX(0) - 2 / 3) < 1e-7);
  assert.ok(Math.abs(reverseWeights.getY(0) - 1 / 3) < 1e-7); reversed.dispose();

  const legacy = skinFilterFixture(), legacyPrep = prepareImportedParts(legacy.gltf, legacy.rig, { sourceSha256: SOURCE_SHA });
  const onePass = skinFilterFixture();
  onePass.rig.partSkinFilters.passes = [{ regions: onePass.rig.partSkinFilters.regions }]; delete onePass.rig.partSkinFilters.regions;
  const onePrep = prepareImportedParts(onePass.gltf, onePass.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(onePrep.diagnostics.skinFilterPasses, 1);
  for (const [id, mesh] of legacyPrep.regions) assert.deepEqual(onePrep.regions.get(id).geometry.attributes.skinWeight.array, mesh.geometry.attributes.skinWeight.array);
  legacyPrep.dispose(); onePrep.dispose();
});

test('late pass validation, rest and cumulative errors restore weights and all success diagnostics from before every pass', () => {
  for (const mode of ['threshold', 'missing-bone', 'bad-selection', 'bad-blend', 'duplicate-region', 'posed-later', 'cumulative']) {
    const f = orderedFilterFixture(), passes = f.rig.partSkinFilters.passes;
    if (mode === 'threshold') passes[1].regions[0].minRetainedWeight = 0.7; // Source .75, preceding output .625.
    if (mode === 'missing-bone') passes[1].regions[0].keepBones = ['AbsentBone'];
    if (mode === 'bad-selection') passes[1].regions[0].vertexIndices = [3, 2];
    if (mode === 'bad-blend') passes[1].regions[0].blendWeights = [NaN];
    if (mode === 'duplicate-region') passes[1].regions.push(passes[1].regions[0]);
    if (mode === 'posed-later') {
      const secondForeign = new THREE.Bone(); secondForeign.name = 'SecondForeignArm';
      f.scene.getObjectByName('FixtureHips').add(secondForeign); f.scene.updateMatrixWorld(true);
      f.mesh.bind(new THREE.Skeleton([...f.mesh.skeleton.bones, secondForeign]), f.mesh.matrixWorld);
      for (let vertex = f.geometry.attributes.position.count - 15; vertex < f.geometry.attributes.position.count; vertex++) f.geometry.attributes.skinIndex.setY(vertex, 3);
      passes[0].regions = [passes[0].regions[0]];
      passes[1].regions = [{ ...passes[0].regions[0], regionId: 'hair1' }];
      secondForeign.rotation.x = 0.3; f.scene.updateMatrixWorld(true);
    }
    if (mode === 'cumulative') {
      const specification = passes[0].regions[0];
      f.rig.partSkinFilters.passes = Array.from({ length: 3 }, () => ({ regions: [specification] }));
      f.arm.position.x += 0.0000025; f.scene.updateMatrixWorld(true);
    }
    const before = baseline(f), original = f.scene.toJSON(), prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
    assert.equal(prep.diagnostics.skinFiltersPrepared, false, mode); assert.ok(prep.diagnostics.skinFilterError, mode);
    if (mode === 'cumulative') assert.match(prep.diagnostics.skinFilterError, /cumulative/, mode);
    if (mode === 'posed-later') assert.match(prep.diagnostics.skinFilterError, /world rest surface/, mode);
    assert.equal(prep.diagnostics.skinFilterPasses, 0, mode); assert.equal(prep.diagnostics.skinFilteredRegions, 0, mode);
    assert.equal(prep.diagnostics.skinFilteredVertices, 0, mode); assert.equal(prep.diagnostics.skinMaxRestWorldError, 0, mode);
    assert.deepEqual(prep.diagnostics.skinFilterRegions, [], mode);
    for (const [id, mesh] of prep.regions) assert.deepEqual(mesh.geometry.attributes.skinWeight.array, before.get(id).weights, `${mode}/${id}`);
    prep.dispose(); assert.deepEqual(f.scene.toJSON(), original);
  }
});

test('ordered pass metadata rejects ambiguous, empty or malformed forms before any correction', () => {
  const invalid = [
    { regions: [], passes: [{ regions: [] }] }, { passes: [] }, { passes: null }, { passes: [{}] },
    { passes: [{ regions: [] }] }, { passes: [,] }, { passes: Array.from({ length: 65 }, () => ({ regions: [] })) }
  ];
  for (const fields of invalid) {
    const f = skinFilterFixture(), before = baseline(f), original = f.scene.toJSON();
    const { sourceSha256, version, calibrated } = f.rig.partSkinFilters;
    f.rig.partSkinFilters = { sourceSha256, version, calibrated, ...fields };
    const prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
    assert.equal(prep.diagnostics.skinFiltersPrepared, false); assert.ok(prep.diagnostics.skinFilterError);
    for (const [id, mesh] of prep.regions) assert.deepEqual(mesh.geometry.attributes.skinWeight.array, before.get(id).weights);
    prep.dispose(); assert.deepEqual(f.scene.toJSON(), original);
  }
});

function replacementFixture() {
  const f = skinFilterFixture(), hips = f.scene.getObjectByName('FixtureHips');
  const leftArm = new THREE.Bone(); leftArm.name = 'FixtureLeftArm'; leftArm.position.set(-0.6, 0.8, 0.1); hips.add(leftArm);
  f.scene.updateMatrixWorld(true); f.mesh.bind(new THREE.Skeleton([...f.mesh.skeleton.bones, leftArm]), f.mesh.matrixWorld);
  const first = { ...f.rig.partSkinFilters.regions[0], blendWeights: Array(15).fill(0.5) };
  const replacement = { mode: 'replaceWeights', regionId: 'hair0', vertexCount: 15, triangleCount: 24, vertexIndices: [1, 2, 7],
    influences: [[{ bone: 'FixtureLeftArm', weight: 1 }],
      [{ bone: 'FixtureHead', weight: 0.25 }, { bone: 'FixtureLeftArm', weight: 0.75 }],
      [{ bone: 'FixtureHips', weight: 0.2 }, { bone: 'FixtureLeftArm', weight: 0.5 }, { bone: 'FixtureHead', weight: 0.3 }]] };
  delete f.rig.partSkinFilters.regions;
  f.rig.partSkinFilters.passes = [{ regions: [first] }, { regions: [replacement] }];
  return { ...f, leftArm, replacement };
}

test('measured joint correction integrates with skin passes while excluding old-pivot clips only from the private actor', () => {
  const f = replacementFixture(), before = baseline(f), original = f.scene.toJSON();
  const snapshot = new THREE.AnimationClip('old-pivot', 0.1, [new THREE.VectorKeyframeTrack('FixtureLeftArm.position', [0], [-0.6, 0.8, 0.1])]);
  f.gltf.animations = [snapshot];
  f.rig.boneRestCorrections = { version: 1, calibrated: true, sourceSha256: SOURCE_SHA,
    joints: [{ bone: 'FixtureLeftArm', parent: 'FixtureHips', position: [-0.2, 0.8, 0.1] }] };
  const prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(prep.diagnostics.skinFiltersPrepared, true, prep.diagnostics.skinFilterError);
  assert.equal(prep.diagnostics.boneRestCorrectionsApplied, true, prep.diagnostics.boneRestCorrectionError);
  assert.equal(prep.diagnostics.animationsSuppressedForBoneRestCorrection, true);
  assert.equal(prep.diagnostics.suppressedAnimationClips, 1);
  assert.deepEqual(prep.gltf.animations, []); assert.equal(f.gltf.animations[0], snapshot);
  assert.deepEqual(Array.from(snapshot.tracks[0].values), Array.from(new Float32Array([-0.6, 0.8, 0.1])));
  close(prep.gltf.scene.getObjectByName('FixtureLeftArm').position, new THREE.Vector3(-0.2, 0.8, 0.1));
  for (const [id, mesh] of prep.regions) before.get(id).world.forEach((point, vertex) => close(worldVertex(mesh, vertex), point));
  prep.dispose(); assert.deepEqual(f.scene.toJSON(), original);
});

test('explicit measured replacements add only existing bone influences on selected vertices and later filters read their new indices', () => {
  const f = replacementFixture(), original = f.scene.toJSON(), before = baseline(f);
  f.rig.partSkinFilters.passes.push({ regions: [{ regionId: 'hair0', vertexCount: 15, triangleCount: 24, vertexIndices: [2], keepBones: ['FixtureHead'], minRetainedWeight: 0.2 }] });
  const prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(prep.diagnostics.skinFiltersPrepared, true, prep.diagnostics.skinFilterError);
  assert.equal(prep.diagnostics.skinFilterPasses, 3);
  assert.equal(prep.diagnostics.skinFilterRegions[1].mode, 'replaceWeights');
  const mesh = prep.regions.get('hair0'), weights = mesh.geometry.attributes.skinWeight, indices = mesh.geometry.attributes.skinIndex;
  assert.deepEqual(Array.from(indices.array.subarray(4, 8)), [3, 0, 0, 0]);
  assert.deepEqual(Array.from(weights.array.subarray(4, 8)), [1, 0, 0, 0]);
  assert.deepEqual(Array.from(indices.array.subarray(8, 12)), [1, 3, 0, 0]);
  assert.deepEqual(Array.from(weights.array.subarray(8, 12)), [1, 0, 0, 0]);
  assert.deepEqual(Array.from(indices.array.subarray(28, 32)), [0, 3, 1, 0]);
  assert.deepEqual(Array.from(weights.array.subarray(12, 16)), [0.375, 0.25, 0.375, 0]);
  let boneCount = 0; prep.gltf.scene.traverse(node => { if (node.isBone) boneCount++; }); assert.equal(boneCount, 4);
  for (const [id, surface] of prep.regions) {
    before.get(id).world.forEach((point, vertex) => close(worldVertex(surface, vertex), point));
    for (const [name, attribute] of Object.entries(surface.geometry.attributes)) if (!['skinIndex', 'skinWeight'].includes(name)) assert.deepEqual(attribute.array, before.get(id).attributes[name]);
    assert.deepEqual(surface.geometry.index.array, before.get(id).indices);
  }
  const initial = [1, 2, 7].map(vertex => worldVertex(mesh, vertex));
  const left = prep.gltf.scene.getObjectByName('FixtureLeftArm'), delta = new THREE.Vector3(0.2, 0, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(left.parent.matrixWorld));
  left.position.x += 0.2; prep.gltf.scene.updateMatrixWorld(true); mesh.skeleton.update();
  close(worldVertex(mesh, 1), initial[0].clone().add(delta));
  close(worldVertex(mesh, 2), initial[1], 'the later anatomical filter must read the newly replaced indices');
  close(worldVertex(mesh, 7), initial[2].clone().addScaledVector(delta, 0.5));
  prep.dispose(); assert.deepEqual(f.scene.toJSON(), original);
});

test('explicit replacement validation and late failures roll back initial bone indices, weights and diagnostics across every pass', () => {
  const modes = ['unknown-mode', 'missing-mode', 'mixed-filter', 'mixed-blend', 'missing-influences', 'wrong-length', 'empty-influence',
    'too-many', 'missing-bone', 'duplicate-bone', 'ambiguous-bone', 'nan', 'infinity', 'zero', 'negative', 'above-one', 'unnormalized',
    'sparse-list', 'sparse-vertex', 'bad-selection', 'topology', 'posed-target', 'late-filter', 'late-replacement'];
  for (const mode of modes) {
    const f = replacementFixture(), specification = f.replacement;
    if (mode === 'unknown-mode') specification.mode = 'replace-typo';
    if (mode === 'missing-mode') delete specification.mode;
    if (mode === 'mixed-filter') specification.keepBones = ['FixtureHead'];
    if (mode === 'mixed-blend') specification.blendWeights = [1, 1, 1];
    if (mode === 'missing-influences') delete specification.influences;
    if (mode === 'wrong-length') specification.influences.pop();
    if (mode === 'empty-influence') specification.influences[2] = [];
    if (mode === 'too-many') specification.influences[2] = Array(5).fill({ bone: 'FixtureHead', weight: 0.2 });
    if (mode === 'missing-bone') specification.influences[2] = [{ bone: 'InventedBone', weight: 1 }];
    if (mode === 'duplicate-bone') specification.influences[2] = [{ bone: 'FixtureHead', weight: 0.5 }, { bone: 'FixtureHead', weight: 0.5 }];
    if (mode === 'ambiguous-bone') f.leftArm.name = 'FixtureHead';
    if (mode === 'nan') specification.influences[2][0].weight = NaN;
    if (mode === 'infinity') specification.influences[2][0].weight = Infinity;
    if (mode === 'zero') specification.influences[2][0].weight = 0;
    if (mode === 'negative') specification.influences[2][0].weight = -0.2;
    if (mode === 'above-one') specification.influences[2][0].weight = 1.2;
    if (mode === 'unnormalized') specification.influences[2][0].weight = 0.1;
    if (mode === 'sparse-list') specification.influences[2] = [, { bone: 'FixtureHead', weight: 1 }];
    if (mode === 'sparse-vertex') delete specification.influences[2];
    if (mode === 'bad-selection') specification.vertexIndices = [2, 1, 7];
    if (mode === 'topology') specification.vertexCount++;
    if (mode === 'posed-target') { f.leftArm.rotation.x = 0.3; f.scene.updateMatrixWorld(true); }
    if (mode === 'late-filter') f.rig.partSkinFilters.passes.push({ regions: [{ regionId: 'hair0', vertexCount: 15, triangleCount: 24, vertexIndices: [1], keepBones: ['FixtureHead'], minRetainedWeight: 0.1 }] });
    if (mode === 'late-replacement') f.rig.partSkinFilters.passes.push({ regions: [{ ...specification, influences: specification.influences.map(() => [{ bone: 'MissingLateBone', weight: 1 }]) }] });
    const before = baseline(f), original = f.scene.toJSON(), prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
    assert.equal(prep.diagnostics.skinFiltersPrepared, false, mode); assert.ok(prep.diagnostics.skinFilterError, mode);
    if (mode === 'posed-target') assert.match(prep.diagnostics.skinFilterError, /world rest surface/, mode);
    assert.equal(prep.diagnostics.skinFilterPasses, 0, mode); assert.equal(prep.diagnostics.skinFilteredVertices, 0, mode);
    assert.deepEqual(prep.diagnostics.skinFilterRegions, [], mode);
    for (const [id, mesh] of prep.regions) {
      assert.deepEqual(mesh.geometry.attributes.skinIndex.array, before.get(id).skin, `${mode}/${id}: indices leaked`);
      assert.deepEqual(mesh.geometry.attributes.skinWeight.array, before.get(id).weights, `${mode}/${id}: weights leaked`);
    }
    prep.dispose(); assert.deepEqual(f.scene.toJSON(), original);
  }
});

test('replacement ranges normalize only floating representation noise and actor resources outlive temporary preparation', () => {
  const f = replacementFixture(), original = f.scene.toJSON();
  f.replacement.vertexRanges = [[1, 2], [7, 1]]; delete f.replacement.vertexIndices;
  f.replacement.influences[2] = [{ bone: 'FixtureLeftArm', weight: 0.2 }, { bone: 'FixtureHead', weight: 0.8000003 }];
  const prep = prepareImportedParts(f.gltf, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(prep.diagnostics.skinFiltersPrepared, true, prep.diagnostics.skinFilterError);
  const weights = prep.regions.get('hair0').geometry.attributes.skinWeight;
  assert.ok(Math.abs(weights.getX(7) - 0.2 / 1.0000003) < 1e-7);
  assert.ok(Math.abs(weights.getX(7) + weights.getY(7) - 1) < 1e-7);
  const adapter = createImportedCharacter({}, prep.gltf, { boneMap: f.rig.boneMap });
  const actor = adapter.model.getObjectByName('hair0'), indices = actor.geometry.attributes.skinIndex.array.slice(), actorWeights = actor.geometry.attributes.skinWeight.array.slice();
  let cachedDisposals = 0, actorDisposals = 0;
  [f.geometry, f.material, f.texture].forEach(resource => resource.addEventListener('dispose', () => cachedDisposals++));
  actor.geometry.addEventListener('dispose', () => actorDisposals++);
  prep.dispose(); assert.equal(actorDisposals, 0); assert.equal(cachedDisposals, 0);
  assert.deepEqual(actor.geometry.attributes.skinIndex.array, indices); assert.deepEqual(actor.geometry.attributes.skinWeight.array, actorWeights);
  adapter.dispose(); adapter.dispose(); assert.equal(actorDisposals, 1); assert.equal(cachedDisposals, 0);
  assert.deepEqual(f.scene.toJSON(), original);
});

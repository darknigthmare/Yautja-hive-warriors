import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createImportedCharacter } from '../js/graphics/ImportedCharacter.js';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';

// Deliberately synthetic test geometry, not a generated or production character.
function syntheticFixture({ indexed = true, transformed = true } = {}) {
  const scene = new THREE.Group(); scene.name = 'SYNTHETIC_TEST_FIXTURE';
  if (transformed) { scene.position.set(3, 5, -2); scene.rotation.y = 0.31; scene.scale.setScalar(1.2); }
  const armature = new THREE.Group(); armature.rotation.y = -0.18; scene.add(armature);
  const makeBone = (name, parent, position, rotation = [0, 0, 0]) => {
    const bone = new THREE.Bone(); bone.name = name; bone.position.set(...position); bone.rotation.set(...rotation); parent.add(bone); return bone;
  };
  const hips = makeBone('mixamorig:Hips', armature, [0, 0.25, 0]);
  const head = makeBone('mixamorig:Head', hips, [0, 1.8, 0], [0.03, 0.11, 0]);
  const jaw = makeBone('Jaw_TEST', head, [0, 0.2, 0.05]);
  const leftArm = makeBone('mixamorig:LeftArm', hips, [-0.4, 1.3, 0], [0.08, 0.12, 0.45]);
  const rightArm = makeBone('mixamorig:RightArm', hips, [0.4, 1.3, 0], [0.08, -0.12, -0.45]);
  const leftLeg = makeBone('mixamorig:LeftUpLeg', hips, [-0.18, 0, 0], [0, 0, -0.12]);
  const rightLeg = makeBone('mixamorig:RightUpLeg', hips, [0.18, 0, 0], [0, 0, 0.12]);
  const leftForeArm = makeBone('mixamorig:LeftForeArm', leftArm, [-0.5, 0, 0]);
  const rightForeArm = makeBone('mixamorig:RightForeArm', rightArm, [0.5, 0, 0]);
  const leftHand = makeBone('mixamorig:LeftHand', leftForeArm, [-0.3, 0, 0]);
  const rightHand = makeBone('mixamorig:RightHand', rightForeArm, [0.3, 0, 0]);
  const leftFoot = makeBone('mixamorig:LeftFoot', leftLeg, [0, -0.4, 0]);
  const rightFoot = makeBone('mixamorig:RightFoot', rightLeg, [0, -0.4, 0]);
  const bones = [hips, head, jaw, leftArm, rightArm, leftLeg, rightLeg, leftForeArm, rightForeArm, leftHand, rightHand, leftFoot, rightFoot];
  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.3, 0, 0, 0.3, 0, 0, 0, 1, 0,
    -0.4, 1.2, 0, -0.8, 1.4, 0, -0.4, 1.6, 0,
    -0.2, 2, 0, 0.2, 2, 0, 0, 2.6, 0.05,
    -0.1, 1.6, 0, 0.1, 1.6, 0, 0, 2, 0.1
  ], 3));
  const indices = [], weights = [];
  for (let i = 0; i < 12; i++) {
    let influence = [[0, 1]];
    if (i >= 3 && i <= 5) influence = [[3, 1]];
    if (i === 6) influence = [[1, 1]];
    if (i === 7) influence = [[2, 1]]; // A descendant of Head, not Head itself.
    if (i === 8) influence = [[1, 0.8], [2, 0.2]];
    if (i === 10) influence = [[1, 0.6], [0, 0.4]];
    if (i === 11) influence = [[1, 0.4], [0, 0.6]];
    for (let slot = 0; slot < 4; slot++) { indices.push(influence[slot]?.[0] ?? 0); weights.push(influence[slot]?.[1] ?? 0); }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from({ length: 24 }, (_, i) => (i % 5) / 4), 2));
  geometry.setAttribute('tangent', new THREE.Float32BufferAttribute(Array.from({ length: 48 }, (_, i) => i % 4 === 0 || i % 4 === 3 ? 1 : 0), 4));
  geometry.setAttribute('testTemperature', new THREE.Float32BufferAttribute(Array.from({ length: 12 }, (_, i) => i / 12), 1));
  geometry.setIndex(Array.from({ length: 12 }, (_, i) => i)); geometry.computeVertexNormals();
  const morph = new Float32Array(36); morph[8 * 3 + 2] = 0.07; morph[4 * 3] = -0.05;
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(morph, 3)];
  geometry.morphAttributes.position[0].name = 'fixture-expression'; geometry.morphTargetsRelative = true;
  geometry.addGroup(0, 6, 0); geometry.addGroup(6, 3, 1); geometry.addGroup(9, 3, 0);
  if (!indexed) { const previous = geometry; geometry = geometry.toNonIndexed(); previous.dispose(); }
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  const skin = new THREE.MeshStandardMaterial({ map: texture }); skin.name = 'fixture-skin';
  const mask = new THREE.MeshStandardMaterial({ map: texture }); mask.name = 'fixture-mask';
  const mesh = new THREE.SkinnedMesh(geometry, [skin, mask]); mesh.name = 'FixtureBody'; mesh.position.y = 0.5; scene.add(mesh);
  const capGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.03, 0, 0, 0, 0.03, 0], 3));
  const cap = new THREE.Mesh(capGeometry, mask); cap.name = 'FixtureRigidJawCap'; jaw.add(cap);
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones); mesh.bind(skeleton, mesh.matrixWorld); mesh.morphTargetInfluences[0] = 0.65;
  return { gltf: { scene, animations: [] }, mesh, geometry, skeleton, bones, cap, texture };
}

function ownerControls() {
  const owner = { _leftArmRestX: -0.66 };
  for (const [role, position] of Object.entries({ leftArm: [-0.66, 3.43, 0], rightArm: [0.66, 3.43, 0], leftLeg: [-0.235, 2.18, 0], rightLeg: [0.235, 2.18, 0], headMesh: [0, 4.02, 0.02] })) {
    owner[role] = new THREE.Group(); owner[role].position.set(...position);
  }
  return owner;
}

const close = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-6, message ?? `${a} != ${b}`);
const sourceBody = adapter => adapter.model.getObjectByName('FixtureBody');
const headBody = adapter => adapter.headMeshes.find(mesh => mesh.isSkinnedMesh);
const faceList = geometry => {
  const list = [], count = geometry.index?.count ?? geometry.attributes.position.count;
  for (let at = 0; at < count; at += 3) list.push([0, 1, 2].map(offset => geometry.index ? geometry.index.getX(at + offset) : at + offset).join(','));
  return list;
};

function articulatedFixture() {
  const fixture = syntheticFixture({ transformed: false }), scene = fixture.gltf.scene;
  const chain = [];
  let parent = fixture.bones[1];
  for (let i = 0; i < 3; i++) {
    const bone = new THREE.Bone(); bone.name = `FixtureDread_${i}`;
    bone.position.set(i ? 0 : 0.1, i ? -0.3 : 0, 0.12);
    parent.add(bone); chain.push(bone); parent = bone;
  }
  scene.updateMatrixWorld(true);
  const positions = [], indices = [], weights = [];
  for (let segment = 0; segment < 2; segment++) {
    const start = chain[segment].getWorldPosition(new THREE.Vector3());
    const end = chain[segment + 1].getWorldPosition(new THREE.Vector3());
    for (const point of [start.clone().add(new THREE.Vector3(-0.01, 0, 0)), start.clone().add(new THREE.Vector3(0.01, 0, 0)), start.clone().lerp(end, 0.9)]) {
      positions.push(...point.toArray()); indices.push(segment, 0, 0, 0); weights.push(1, 0, 0, 0);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  geometry.computeVertexNormals();
  const hair = new THREE.SkinnedMesh(geometry, fixture.mesh.material[0]); hair.name = 'FixtureWeightedDread'; scene.add(hair);
  hair.bind(new THREE.Skeleton(chain));
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.02), fixture.mesh.material[1]);
  blade.name = 'FixtureSeparateBlade'; blade.position.z = 0.3; fixture.bones[8].add(blade);
  const lid = new THREE.Group(); lid.name = 'FixtureComputerLid'; fixture.bones[7].add(lid);
  lid.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.01, 0.15), fixture.mesh.material[1]));
  fixture.articulation = {
    version: 1,
    dreadlocks: [{ id: 'dread', nodes: chain.map(bone => bone.name) }],
    wristblades: [{ id: 'blade', nodes: [blade.name], axis: [0, 0, 1], travel: 0.2, restState: 'extended' }],
    gauntlets: [{ id: 'lid', node: lid.name, axis: [1, 0, 0], angle: 1.1, restState: 'closed' }]
  };
  return fixture;
}

test('optional imported articulation follows the posed body and respects FPS, pause and actuator commands', () => {
  const fixture = articulatedFixture(), owner = ownerControls();
  const adapter = createImportedCharacter(owner, fixture.gltf, { articulation: fixture.articulation, requireHeadPartition: true });
  const rootBone = adapter.model.getObjectByName('FixtureDread_0'), tipBone = adapter.model.getObjectByName('FixtureDread_2');
  const blade = adapter.model.getObjectByName('FixtureSeparateBlade');
  const rootBefore = rootBone.getWorldPosition(new THREE.Vector3()), tipBefore = tipBone.getWorldPosition(new THREE.Vector3());
  const bladeRest = blade.position.clone();
  owner.headMesh.position.x += 0.2;
  adapter.update(1 / 60, false);
  const anchorTravel = rootBone.getWorldPosition(new THREE.Vector3()).sub(rootBefore);
  const tipTravel = tipBone.getWorldPosition(new THREE.Vector3()).sub(tipBefore);
  assert.ok(anchorTravel.x > 0.19, 'body controls must actually move the strand anchor');
  assert.ok(tipTravel.x < anchorTravel.x - 0.005, 'strand solver must see this frame\'s already posed head');
  adapter.articulation.setBladeExtension('blade', 0);
  adapter.articulation.setGauntletOpen('lid', 1);
  const beforePause = blade.position.clone();
  adapter.update(1, false, { paused: true });
  assert.deepEqual(blade.position.toArray(), beforePause.toArray());
  adapter.setHeadVisible(false);
  adapter.update(1 / 60, false);
  assert.equal(adapter.articulation.getState().hairActive, false);
  assert.ok(adapter.headMeshes.every(mesh => !mesh.visible));
  assert.ok(rootBone.quaternion.angleTo(new THREE.Quaternion()) < 1e-6, 'FPS transition must clear strand deformation');
  for (let frame = 0; frame < 25; frame++) adapter.update(1 / 60, false, { detailLevel: 2 });
  close(blade.position.z, bladeRest.z - 0.2);
  close(adapter.articulation.getState().gauntlets[0].amount, 1);
  adapter.setHeadVisible(true); adapter.update(1 / 60, false);
  assert.equal(adapter.articulation.getState().hairActive, true);
  adapter.dispose();
});

test('imported articulation owns cloned nodes, restores them on disposal and rejects body/cache bindings', () => {
  const fixture = articulatedFixture(), sourcePose = fixture.gltf.scene.toJSON();
  const first = createImportedCharacter({}, fixture.gltf, { articulation: fixture.articulation });
  const second = createImportedCharacter({}, fixture.gltf, { articulation: fixture.articulation });
  const firstBlade = first.model.getObjectByName('FixtureSeparateBlade'), secondBlade = second.model.getObjectByName('FixtureSeparateBlade');
  const authored = firstBlade.position.clone();
  first.articulation.setBladeExtension('blade', 0);
  for (let frame = 0; frame < 25; frame++) first.update(1 / 60);
  assert.ok(firstBlade.position.distanceTo(secondBlade.position) > 0.1);
  assert.deepEqual(fixture.gltf.scene.toJSON(), sourcePose);
  first.dispose(); first.dispose();
  assert.deepEqual(firstBlade.position.toArray(), authored.toArray());
  assert.equal(first.articulation.getState().disposed, true);
  assert.equal(first.update(1 / 60), false);
  assert.equal(second.update(1 / 60), true); second.dispose();
  const bodyBinding = { version: 1, gauntlets: [{ id: 'illegal', node: 'mixamorig:Head', axis: [1, 0, 0], angle: 1, restState: 'closed' }] };
  assert.throws(() => createImportedCharacter({}, fixture.gltf, { articulation: bodyBinding }), /body animation/);
  const cacheBinding = { version: 1, wristblades: [{ id: 'illegal', nodes: [fixture.gltf.scene.getObjectByName('FixtureSeparateBlade')], axis: [0, 0, 1], travel: 1, restState: 'extended' }] };
  assert.throws(() => createImportedCharacter({}, fixture.gltf, { articulation: cacheBinding }), /foreign/);
  assert.deepEqual(fixture.gltf.scene.toJSON(), sourcePose);
  const unchanged = createImportedCharacter({}, fixture.gltf);
  assert.equal(unchanged.articulation, null, 'assets without descriptors must retain their existing adapter');
  unchanged.dispose();
});

test('import normalization grounds the feet at requested height without mutating the loaded GLB', () => {
  for (const forwardAxis of ['+z', '-z', '+x', '-x']) {
    const fixture = syntheticFixture(), original = fixture.gltf.scene.toJSON();
    const owner = ownerControls(), originalControl = owner.leftArm;
    const adapter = createImportedCharacter(owner, fixture.gltf, { height: 4.31, forwardAxis, requireHeadPartition: true });
    const bounds = new THREE.Box3().setFromObject(adapter.root, true), center = bounds.getCenter(new THREE.Vector3());
    close(bounds.min.y, 0); close(bounds.max.y, 4.31); close(center.x, 0); close(center.z, 0);
    assert.equal(owner.leftArm, originalControl, 'adapter must not replace the gameplay controls');
    assert.deepEqual(fixture.gltf.scene.toJSON(), original, 'loaded cache scene must remain unchanged');
    assert.equal(adapter.sockets.leftHand.parent, adapter.bones.leftHand);
    assert.equal(adapter.sockets.rightArm.parent, adapter.bones.rightArm);
    adapter.dispose();
  }
});

test('FPS partitions conserve every triangle/material group for indexed and non-indexed skins', () => {
  for (const indexed of [true, false]) {
    const fixture = syntheticFixture({ indexed }), owner = ownerControls();
    const adapter = createImportedCharacter(owner, fixture.gltf, { requireHeadPartition: true });
    const body = sourceBody(adapter), head = headBody(adapter);
    assert.deepEqual([...faceList(body.geometry), ...faceList(head.geometry)].sort(), faceList(fixture.geometry).sort());
    assert.deepEqual(body.geometry.groups, [{ start: 0, count: 6, materialIndex: 0 }]);
    assert.deepEqual(head.geometry.groups, [{ start: 0, count: 3, materialIndex: 1 }, { start: 3, count: 3, materialIndex: 0 }]);
    assert.equal(body.skeleton, head.skeleton);
    assert.equal(body.skeleton.bones[1], adapter.bones.head);
    assert.notEqual(body.skeleton.bones[1], fixture.bones[1]);
    assert.notEqual(body.skeleton.boneInverses[0], fixture.skeleton.boneInverses[0]);
    assert.equal(adapter.setHeadVisible(false), true);
    const visible = [];
    adapter.root.traverseVisible(mesh => { if (mesh.isMesh) visible.push(mesh); });
    assert.deepEqual(visible, [body], 'head skin and rigid descendants must disappear, body triangles remain');
    assert.deepEqual(faceList(body.geometry), ['0,1,2', '3,4,5']);
    adapter.setHeadVisible(true);
    assert.equal(head.visible, true); assert.equal(adapter.model.getObjectByName('FixtureRigidJawCap').visible, true);
    adapter.setHeadVisible(null); owner.headMesh.visible = false; adapter.update(0, false);
    assert.equal(head.visible, false, 'original Player FPS control is followed unless explicitly overridden');
    owner.headMesh.visible = true; adapter.update(0, false); assert.equal(head.visible, true);
    adapter.dispose();
  }
});

test('partition drawRange preserves active faces while retaining all inactive source triangles', () => {
  const fixture = syntheticFixture(); fixture.geometry.setDrawRange(3, 6);
  const adapter = createImportedCharacter({}, fixture.gltf);
  const body = sourceBody(adapter), head = headBody(adapter);
  assert.deepEqual(body.geometry.drawRange, { start: 3, count: 3 });
  assert.deepEqual(head.geometry.drawRange, { start: 0, count: 3 });
  assert.equal(faceList(body.geometry).length + faceList(head.geometry).length, 4);
  adapter.dispose();
});

test('skin, UV, tangent, custom attributes and active morph deformation survive the split', () => {
  const fixture = syntheticFixture(), adapter = createImportedCharacter({}, fixture.gltf);
  const body = sourceBody(adapter), head = headBody(adapter);
  for (const partition of [body, head]) {
    for (const [name, attribute] of Object.entries(fixture.geometry.attributes)) assert.deepEqual(partition.geometry.attributes[name].array, attribute.array, name);
    assert.equal(partition.geometry.morphTargetsRelative, true);
    assert.deepEqual(partition.geometry.morphAttributes.position[0].array, fixture.geometry.morphAttributes.position[0].array);
    assert.deepEqual(partition.morphTargetDictionary, fixture.mesh.morphTargetDictionary);
    close(partition.morphTargetInfluences[0], 0.65);
    for (const index of [4, 7, 8, 10]) {
      const expected = fixture.mesh.getVertexPosition(index, new THREE.Vector3());
      assert.ok(partition.getVertexPosition(index, new THREE.Vector3()).distanceTo(expected) < 1e-6, 'bind matrices and deformation must survive normalization');
    }
  }
  body.morphTargetInfluences = [0.9]; adapter.update(0, false);
  assert.equal(head.morphTargetInfluences, body.morphTargetInfluences, 'both partitions must follow subsequent morph changes');
  adapter.dispose();
});

test('non-neutral bind poses receive controller deltas in character axes and restore exactly', () => {
  const fixture = syntheticFixture(), owner = ownerControls(), adapter = createImportedCharacter(owner, fixture.gltf);
  const host = new THREE.Group(); host.rotation.set(0.2, 0.4, 0.1); host.position.set(8, 2, -3); host.scale.setScalar(1.8); host.add(adapter.root);
  host.updateMatrixWorld(true); adapter.update(0, false);
  const arm = adapter.bones.leftArm, restLocal = arm.quaternion.clone(), restPosition = arm.position.clone();
  const restWorld = arm.getWorldQuaternion(new THREE.Quaternion()), restWorldPosition = arm.getWorldPosition(new THREE.Vector3());
  const rootRotation = adapter.root.getWorldQuaternion(new THREE.Quaternion());
  owner.leftArm.rotation.x = 0.6; owner.leftArm.position.x += 0.06;
  adapter.update(0.016, true);
  const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(rootRotation);
  const expected = new THREE.Quaternion().setFromAxisAngle(axis, 0.6).multiply(restWorld);
  assert.ok(arm.getWorldQuaternion(new THREE.Quaternion()).angleTo(expected) < 1e-6, 'bone axes must not change the meaning of Player arm.rotation.x');
  const expectedPosition = restWorldPosition.clone().add(new THREE.Vector3(0.06, 0, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(adapter.root.matrixWorld)));
  assert.ok(arm.getWorldPosition(new THREE.Vector3()).distanceTo(expectedPosition) < 1e-6, 'blocking translation is a delta in game units, including normalization scale');
  owner.leftArm.rotation.set(0, 0, 0); owner.leftArm.position.x = owner._leftArmRestX; adapter.update(0, false);
  assert.ok(arm.quaternion.angleTo(restLocal) < 1e-6); assert.ok(arm.position.distanceTo(restPosition) < 1e-6);
  assert.ok(fixture.bones[3].quaternion.angleTo(restLocal) < 1e-6, 'the source rig is never posed');
  adapter.dispose();
});

test('cooperative clones isolate pose/materials and release only their own GPU resources once', () => {
  const fixture = syntheticFixture(), firstOwner = ownerControls(), secondOwner = ownerControls();
  const first = createImportedCharacter(firstOwner, fixture.gltf), second = createImportedCharacter(secondOwner, fixture.gltf);
  assert.notEqual(sourceBody(first).geometry, sourceBody(second).geometry);
  assert.notEqual(first.materials[0], second.materials[0]); assert.equal(first.materials[0].map, fixture.texture);
  first.materials[0].opacity = 0.22; assert.equal(second.materials[0].opacity, 1); assert.equal(fixture.mesh.material[0].opacity, 1);
  const secondRest = second.bones.leftArm.quaternion.clone(); firstOwner.leftArm.rotation.x = -1; first.update(0.1, true);
  assert.ok(second.bones.leftArm.quaternion.angleTo(secondRest) < 1e-6);
  const geometries = new Set(), skeletons = new Set();
  first.root.traverse(mesh => { if (mesh.isMesh) geometries.add(mesh.geometry); if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton); });
  let releasedGeometry = 0, releasedMaterial = 0, releasedBoneTexture = 0, releasedSource = 0, releasedSurvivor = 0;
  for (const geometry of geometries) geometry.addEventListener('dispose', () => releasedGeometry++);
  for (const material of first.materials) material.addEventListener('dispose', () => releasedMaterial++);
  for (const skeleton of skeletons) { skeleton.computeBoneTexture(); skeleton.boneTexture.addEventListener('dispose', () => releasedBoneTexture++); }
  for (const resource of [fixture.geometry, fixture.mesh.material[0], fixture.texture]) resource.addEventListener('dispose', () => releasedSource++);
  sourceBody(second).geometry.addEventListener('dispose', () => releasedSurvivor++);
  first.dispose(); first.dispose();
  assert.equal(releasedGeometry, geometries.size); assert.equal(releasedMaterial, first.materials.length); assert.equal(releasedBoneTexture, skeletons.size);
  assert.equal(releasedSource, 0); assert.equal(releasedSurvivor, 0); assert.equal(first.update(0.1, true), false);
  assert.ok(second.update(0.1, false)); assert.ok(Number.isFinite(sourceBody(second).getVertexPosition(8, new THREE.Vector3()).y));
  second.dispose();
});

test('simultaneous arm and forearm controls apply their deltas in character axes', () => {
  const fixture = syntheticFixture(), owner = ownerControls(); owner.leftForeArm = new THREE.Group();
  const adapter = createImportedCharacter(owner, fixture.gltf);
  owner.leftArm.rotation.x = 0.65; adapter.update(0, false);
  const before = adapter.bones.leftForeArm.getWorldQuaternion(new THREE.Quaternion());
  owner.leftForeArm.rotation.y = 0.4; adapter.update(0, false);
  const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4).multiply(before);
  assert.ok(adapter.bones.leftForeArm.getWorldQuaternion(new THREE.Quaternion()).angleTo(expected) < 1e-6);
  adapter.dispose();
});

test('explicit rig aliases/pose corrections work and unsupported FPS rigs cannot pretend to hide a head', () => {
  const fixture = syntheticFixture(); fixture.bones[1].name = 'CustomSkull';
  const adapter = createImportedCharacter({}, fixture.gltf, { boneMap: { head: 'CustomSkull' }, poseOffsets: { leftArm: [0, 0, -0.3] }, requireHeadPartition: true });
  const expected = fixture.bones[3].quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.3)));
  adapter.update(0, false); assert.ok(adapter.bones.leftArm.quaternion.angleTo(expected) < 1e-6); adapter.dispose();
  const unknown = createImportedCharacter({}, fixture.gltf);
  assert.equal(unknown.canHideHead, false); assert.equal(unknown.setHeadVisible(false), false); unknown.dispose();
  assert.throws(() => createImportedCharacter({}, fixture.gltf, { requireHeadPartition: true }), /head triangles cannot be identified/);
  assert.throws(() => createImportedCharacter({}, fixture.gltf, { boneMap: { head: 'Missing' } }), /does not exist/);
});

test('malformed and unbounded imports fail before becoming renderable characters', () => {
  const fixture = syntheticFixture();
  assert.throws(() => createImportedCharacter({}, null), /loaded glTF/);
  assert.throws(() => createImportedCharacter({}, fixture.gltf, { height: 0 }), /positive/);
  assert.throws(() => createImportedCharacter({}, fixture.gltf, { forwardAxis: '+y' }), /forwardAxis/);
  assert.throws(() => createImportedCharacter({}, fixture.gltf, { maxVertices: 3 }), /budget/);
  const external = new THREE.Bone(); fixture.skeleton.bones[0] = external;
  assert.throws(() => createImportedCharacter({}, fixture.gltf), /must belong/);
  fixture.skeleton.bones[0] = fixture.bones[0]; fixture.geometry.attributes.position.setX(0, NaN);
  assert.throws(() => createImportedCharacter({}, fixture.gltf), /non-finite vertex/);
  fixture.geometry.attributes.position.setX(0, -0.3); fixture.mesh.morphTargetInfluences[0] = 0;
  fixture.geometry.morphAttributes.position[0].setX(0, NaN);
  assert.throws(() => createImportedCharacter({}, fixture.gltf), /non-finite morph vertex/);
  fixture.geometry.morphAttributes.position[0].setX(0, 0); fixture.mesh.bindMatrix.elements[0] = NaN;
  assert.throws(() => createImportedCharacter({}, fixture.gltf), /invalid bind matrix/);
  const repeated = syntheticFixture(); repeated.gltf.scene.add(repeated.mesh.clone(false));
  assert.throws(() => createImportedCharacter({}, repeated.gltf, { maxVertices: 20 }), /budget/);
});

// Identity socket transforms are valid ONLY for these synthetic fixture tests.
// They are not supplied as shipping calibrations or written to a manifest.
function fixtureLibrary(fixture, load = async () => fixture.gltf) {
  const accessories = {};
  for (const [name, socket] of Object.entries({ blade1: 'rightHand', blade2: 'rightHand', shieldMesh: 'leftHand', secWeaponMesh: 'leftHand', plasmaGlaiveMesh: 'rightHand', clanMarkMesh: 'head' })) {
    accessories[name] = { socket, position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] };
  }
  const entry = { status: 'verified', url: '/models/SYNTHETIC_TEST_ONLY.glb', characterRig: { calibrated: true, height: 4.31, forwardAxis: '+z', boneMap: {}, poseOffsets: {}, accessories } };
  return { entry, getGeneratedAssetEntry: key => key === 'jungle_hunter' ? entry : null, loadGeneratedAsset: load };
}
const silentAudio = new Proxy({}, { get: () => () => {} });
const makePlayer = index => new Player(new THREE.Scene(), CHARACTERS_DATA[index ?? 0], silentAudio);

test('Player keeps its current model for empty manifest, other hunters, absent calibration and failed requests', async () => {
  const player = makePlayer(); assert.equal(await player.generatedVisualReady, false);
  const mesh = player.mesh, head = player.headMesh, arm = player.rightArm, blade = player.blade1;
  const fixture = syntheticFixture(); let requests = 0;
  const library = fixtureLibrary(fixture, async () => { requests++; throw new Error('fixture network failure'); });
  const other = makePlayer(1); assert.equal(await other.loadGeneratedVisual(library), false); assert.equal(requests, 0); other.dispose();
  library.entry.characterRig.calibrated = false;
  assert.equal(await player.loadGeneratedVisual(library), false); assert.equal(requests, 0);
  library.entry.characterRig.calibrated = true;
  const calibration = library.entry.characterRig.accessories.blade1; delete library.entry.characterRig.accessories.blade1;
  assert.equal(await player.loadGeneratedVisual(library), false); assert.equal(requests, 0);
  library.entry.characterRig.accessories.blade1 = calibration;
  assert.equal(await player.loadGeneratedVisual(library), false); assert.equal(requests, 1); assert.match(player.generatedVisualError, /network failure/);
  assert.equal(player.mesh, mesh); assert.equal(player.headMesh, head); assert.equal(player.rightArm, arm); assert.equal(player.blade1, blade);
  assert.equal(player.generatedVisualState, 'procedural'); assert.equal(player._importedCharacter, undefined);
  assert.equal(player._proceduralMotionRoot.children.find(object => object.material?.name === 'skin').visible, true);
  player.dispose();
});

test('Player ignores a load resolved after disposal and never releases shared template resources', async () => {
  const player = makePlayer(), fixture = syntheticFixture(); let resolve;
  const library = fixtureLibrary(fixture, () => new Promise(done => { resolve = done; }));
  const pending = player.loadGeneratedVisual(library);
  let releasedTemplate = 0;
  for (const resource of [fixture.geometry, ...fixture.mesh.material, fixture.texture]) resource.addEventListener('dispose', () => releasedTemplate++);
  player.dispose(); resolve(fixture.gltf);
  assert.equal(await pending, false); assert.equal(player.scene.children.length, 0); assert.equal(releasedTemplate, 0);
  assert.equal(player._importedCharacter, undefined);
});

test('a superseded Player request cannot replace or dispose the newer imported visual', async () => {
  const player = makePlayer(), first = syntheticFixture(), second = syntheticFixture(); let resolve;
  const pending = player.loadGeneratedVisual(fixtureLibrary(first, () => new Promise(done => { resolve = done; })));
  assert.equal(await player.loadGeneratedVisual(fixtureLibrary(second)), true);
  const installed = player._importedCharacter.adapter;
  resolve(first.gltf); assert.equal(await pending, false);
  assert.equal(player._importedCharacter.adapter, installed); assert.equal(player.generatedVisualState, 'imported');
  assert.equal(installed.update(0, false), true); player.dispose();
});

test('Player upgrade preserves weapons/FPS/cloak and disposes imported and socket accessories exactly once', async () => {
  const player = makePlayer(), fixture = syntheticFixture(), library = fixtureLibrary(fixture);
  let invalidations = 0; player.scene.addEventListener('visual-ready', () => invalidations++);
  const root = player.mesh, head = player.headMesh, arm = player.rightArm, leg = player.leftLeg;
  const blade = player.blade1, shield = player.shieldMesh, secondary = player.secWeaponMesh, glaive = player.plasmaGlaiveMesh;
  player.selectWeapon('katana', false); const geometry = secondary.geometry;
  player.toggleShieldBlock(); player.brandClanMark(); player.toggleCloak(); player.triggerPlasmaGlaive(); player.headMesh.visible = false;
  assert.equal(await player.loadGeneratedVisual(library), true);
  assert.equal(invalidations, 1, 'paused/photo rendering must refresh after asynchronous installation');
  const adapter = player._importedCharacter.adapter;
  assert.equal(player.mesh, root); assert.equal(player.headMesh, head); assert.equal(player.rightArm, arm); assert.equal(player.leftLeg, leg);
  assert.equal(head.position.y, 4.02); assert.equal(head.visible, false);
  assert.equal(player.blade1, blade); assert.equal(player.shieldMesh, shield); assert.equal(player.secWeaponMesh, secondary); assert.equal(secondary.geometry, geometry);
  assert.equal(secondary.parent, adapter.sockets.leftHand); assert.equal(glaive.parent, adapter.sockets.rightHand);
  assert.equal(shield.visible, true); assert.equal(secondary.visible, true); assert.equal(blade.visible, false); assert.equal(glaive.visible, true);
  assert.equal(player.clanMarkMesh.visible, false); assert.ok(adapter.headMeshes.every(mesh => !mesh.visible));
  assert.equal(player._proceduralMotionRoot.children.find(object => object.material?.name === 'skin').visible, false);
  for (const material of adapter.materials) { assert.equal(material.opacity, 0.22); assert.equal(material.depthWrite, false); }
  assert.equal(fixture.mesh.material[0].opacity, 1, 'cloaking a loaded actor cannot mutate the cached material');
  player.headMesh.visible = true; player.update(0.01);
  assert.equal(player.clanMarkMesh.visible, true); assert.ok(adapter.headMeshes.every(mesh => mesh.visible));
  player.toggleCloak();
  for (const material of adapter.materials) { assert.equal(material.opacity, 1); assert.equal(material.depthWrite, true); assert.equal(material.roughness, 1); }
  const replacement = new THREE.Group(); replacement.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial()));
  player.plasmaGlaiveMesh = replacement; player.update(0.01);
  assert.equal(replacement.parent, adapter.sockets.rightHand, 'late-created accessory uses its calibrated socket');
  assert.equal(glaive.parent, player.rightArm, 'replaced accessory stays owned by Player for cleanup');
  const geometries = new Set(), materials = new Set(); let geometryDisposals = 0, materialDisposals = 0, templateDisposals = 0;
  player.mesh.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) materials.add(material);
  });
  geometries.forEach(resource => resource.addEventListener('dispose', () => geometryDisposals++));
  materials.forEach(resource => resource.addEventListener('dispose', () => materialDisposals++));
  for (const resource of [fixture.geometry, ...fixture.mesh.material, fixture.texture]) resource.addEventListener('dispose', () => templateDisposals++);
  player.dispose(); player.dispose();
  assert.equal(geometryDisposals, geometries.size); assert.equal(materialDisposals, materials.size); assert.equal(templateDisposals, 0);
  assert.equal(player.scene.children.length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { loadSkinnedGlb } from './helpers/load-skinned-glb.mjs';
import { geometryAttributeHash } from '../js/graphics/CreatureSkinCorrections.js';
import { prepareImportedManeTemplate } from '../js/graphics/ImportedManeRig.js';
import { prepareImportedParts } from '../js/graphics/ImportedPartsPreparation.js';
import { createImportedCharacter } from '../js/graphics/ImportedCharacter.js';
import { createYautjaArticulation } from '../js/graphics/YautjaArticulation.js';
import { CITY_HUNTER_MANE_RIG } from '../js/graphics/CityHunterManeCalibration.js';
import { CITY_HUNTER_RIG } from '../js/graphics/CityHunterRig.js';

const config = CITY_HUNTER_MANE_RIG, sourceUrl = new URL('../public/models/city-hunter-body-corrected.glb', import.meta.url);
const raw = await loadSkinnedGlb(sourceUrl), sourceMesh = raw.scene.getObjectByName(config.meshName);
const prepare = candidate => prepareImportedManeTemplate(raw, candidate ?? config, { sourceSha256: config.sourceSha256 });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const surfaceHashes = mesh => Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name, attribute]) => [name, geometryAttributeHash(attribute)]));
const sourceState = () => {
  const result = [];
  raw.scene.traverse(node => {
    result.push([node.name, node.position.toArray(), node.quaternion.toArray(), node.scale.toArray()]);
    if (node.isMesh) result.push([surfaceHashes(node), geometryAttributeHash(node.geometry.index), node.geometry.groups, node.material.uuid]);
    if (node.isSkinnedMesh) result.push([node.skeleton.bones.map(bone => bone.name), node.skeleton.boneInverses.map(matrix => matrix.elements)]);
  });
  return hash(result);
};
const initialSource = sourceState(), selected = new Uint8Array(config.vertexCount), collar = new Uint8Array(config.vertexCount), strandVertices = [];
for (const strand of config.strands) {
  const data = Buffer.from(strand.vertices.data, 'base64'), ids = [];
  for (let i = 0; i < strand.vertices.count; i++) {
    const vertex = data.readUInt32LE(i * 7); selected[vertex] = 1; ids.push(vertex);
    if (!data[i * 7 + 6]) collar[vertex] = 1;
  }
  strandVertices.push(ids);
}
function makeAdapter({ prepared = true } = {}) {
  const setup = prepare(), articulation = { ...CITY_HUNTER_RIG.articulation, dreadlocks: [
    ...CITY_HUNTER_RIG.articulation.dreadlocks, ...(prepared ? setup.articulation.dreadlocks : [])
  ] };
  const adapter = createImportedCharacter({ headMesh: new THREE.Group() }, prepared ? setup.template : raw, {
    ...CITY_HUNTER_RIG, articulation, requireHeadPartition: true, footGrounding: undefined, sourceSha256: config.sourceSha256
  });
  adapter.root.updateMatrixWorld(true);
  return { adapter, mesh: adapter.model.getObjectByName(config.meshName) };
}
function skinPoint(mesh, index, output = new THREE.Vector3()) { return mesh.getVertexPosition(index, output).applyMatrix4(mesh.matrixWorld); }
function bonePose(root, descriptor) { return hash(descriptor.dreadlocks.map(strand => strand.nodes.map(name => root.getObjectByName(name).quaternion.toArray()))); }

test('ten actual free ends add measured weights without editing any source surface, bind, UV or resting vertex', async () => {
  const prepared = prepare(), mesh = prepared.template.scene.getObjectByName(config.meshName);
  assert.equal(prepared.diagnostics.freeEnds, 10); assert.equal(prepared.diagnostics.addedBones, 40);
  assert.equal(prepared.diagnostics.selectedVertices, 3190); assert.equal(prepared.diagnostics.weightedVertices, 2303);
  assert.equal(prepared.diagnostics.anchoredVertices, 887); assert.equal(mesh.skeleton.bones.length, sourceMesh.skeleton.bones.length + 40);
  assert.equal(prepare(structuredClone(config)).template.scene.uuid, prepared.template.scene.uuid);
  assert.notEqual(mesh.geometry.uuid, sourceMesh.geometry.uuid); assert.equal(mesh.material.uuid, sourceMesh.material.uuid);
  for (const name of Object.keys(sourceMesh.geometry.attributes).filter(name => !name.startsWith('skin'))) assert.equal(geometryAttributeHash(mesh.geometry.attributes[name]), geometryAttributeHash(sourceMesh.geometry.attributes[name]), name);
  assert.equal(geometryAttributeHash(mesh.geometry.index), config.indexHash);
  assert.equal(hash(mesh.geometry.groups), hash(sourceMesh.geometry.groups));
  const before = new THREE.Vector3(), after = new THREE.Vector3(); let maxRestError = 0, changedOutside = 0;
  for (let i = 0; i < selected.length; i++) {
    skinPoint(sourceMesh, i, before); skinPoint(mesh, i, after); maxRestError = Math.max(maxRestError, before.distanceTo(after));
    if (!selected[i] || collar[i]) for (let slot = 0; slot < 4; slot++) {
      const at = i * 4 + slot;
      if (mesh.geometry.attributes.skinIndex.array[at] !== sourceMesh.geometry.attributes.skinIndex.array[at] || mesh.geometry.attributes.skinWeight.array[at] !== sourceMesh.geometry.attributes.skinWeight.array[at]) changedOutside++;
    }
  }
  assert.equal(changedOutside, 0); assert.ok(maxRestError < 1e-6, `complete rest-space error ${maxRestError}`);
  assert.equal(createHash('sha256').update(await readFile(sourceUrl)).digest('hex'), config.sourceSha256);
  assert.equal(sourceState(), initialSource);
});

test('all ten free distal surfaces move independently while every collar, face, neck and body joint stays exact', () => {
  const revised = makeAdapter(), baseline = makeAdapter({ prepared: false });
  try {
    assert.equal(revised.adapter.articulation.stats.dreadlocks, 12);
    assert.equal(revised.adapter.articulation.stats.simulatedSegments, 38);
    for (let frame = 0; frame < 90; frame++) {
      const state = { wind: [0.6, 0, -0.2] }; revised.adapter.update(1 / 60, false, state); baseline.adapter.update(1 / 60, false, state);
    }
    const before = new THREE.Vector3(), after = new THREE.Vector3(); let fixedError = 0;
    const movement = strandVertices.map(() => 0);
    for (let i = 0; i < selected.length; i++) if (!selected[i] || collar[i]) {
      fixedError = Math.max(fixedError, skinPoint(revised.mesh, i, before).distanceTo(skinPoint(baseline.mesh, i, after)));
    }
    for (const [strandIndex, vertices] of strandVertices.entries()) for (const index of vertices) {
      movement[strandIndex] = Math.max(movement[strandIndex], skinPoint(revised.mesh, index, before).distanceTo(skinPoint(baseline.mesh, index, after)));
    }
    assert.ok(fixedError < 1e-6, `unselected and anchored vertices must stay exact: ${fixedError}`);
    assert.ok(movement.every(value => value > 0.001 && value < 0.14), `all ten actual free ends need bounded independent motion: ${movement.map(value => value.toFixed(6)).join(',')}`);
    for (const role of ['head', 'neck', 'hips', 'leftArm', 'rightArm']) assert.equal(hash(revised.adapter.bones[role].quaternion.toArray()), hash(baseline.adapter.bones[role].quaternion.toArray()), role);
    const others = []; revised.adapter.model.traverse(node => { if (node.isMesh && node.name !== config.meshName) others.push(node); });
    for (const mesh of others) {
      const original = raw.scene.getObjectByName(mesh.name);
      if (original?.isMesh) assert.equal(hash(surfaceHashes(mesh)), hash(surfaceHashes(original)), `unrelated mesh ${mesh.name}`);
    }
  } finally { revised.adapter.dispose(); baseline.adapter.dispose(); }
  assert.equal(sourceState(), initialSource);
});

test('fixed-step strand poses agree across frame rates, pause, FPS, LOD, reset and independent actor ownership', () => {
  const prepared = prepare(), poses = [];
  for (const fps of [30, 60, 120]) {
    const scene = cloneSkeleton(prepared.template.scene), other = cloneSkeleton(prepared.template.scene);
    const controller = createYautjaArticulation(scene, prepared.articulation), second = createYautjaArticulation(other, prepared.articulation);
    const rest = bonePose(scene, prepared.articulation), otherRest = bonePose(other, prepared.articulation);
    for (let frame = 0; frame < fps * 2; frame++) controller.update(1 / fps, { wind: [0.3, 0, 0.1] });
    const active = bonePose(scene, prepared.articulation);
    assert.notEqual(active, rest); assert.equal(bonePose(other, prepared.articulation), otherRest);
    assert.equal(controller.update(1, { paused: true }), false); assert.equal(controller.update(0), false);
    assert.equal(bonePose(scene, prepared.articulation), active);
    poses.push(hash(prepared.articulation.dreadlocks.map(strand => strand.nodes.map(name => scene.getObjectByName(name).quaternion.toArray().map(value => Number(value.toFixed(9)))))));
    controller.update(1 / fps, { headVisible: false }); assert.equal(bonePose(scene, prepared.articulation), rest);
    controller.update(1 / fps, { detailLevel: 2 }); assert.equal(bonePose(scene, prepared.articulation), rest);
    controller.update(1 / fps, { detailLevel: 1 }); assert.equal(controller.getState().hairActive, true);
    controller.reset(); assert.equal(bonePose(scene, prepared.articulation), rest);
    second.update(1 / fps, { wind: [-0.3, 0, 0] }); controller.dispose(); controller.dispose();
    assert.equal(bonePose(scene, prepared.articulation), rest); assert.equal(controller.update(1 / fps), false);
    assert.notEqual(bonePose(other, prepared.articulation), otherRest); second.dispose();
  }
  assert.equal(poses[0], poses[1]); assert.equal(poses[0], poses[2]); assert.equal(sourceState(), initialSource);
});

test('shared-source preparation survives the complete parts pipeline, head poses, transformed actors and a teleport', () => {
  const setup = prepare(), parts = prepareImportedParts(setup.template, CITY_HUNTER_RIG, { sourceSha256: config.sourceSha256 });
  assert.equal(parts.diagnostics.regionError, null); assert.equal(parts.diagnostics.hairError, null);
  const revised = createImportedCharacter({ headMesh: new THREE.Group() }, parts.gltf, {
    ...CITY_HUNTER_RIG, footGrounding: undefined, articulation: { ...parts.articulationDescriptor,
      dreadlocks: [...(parts.articulationDescriptor?.dreadlocks ?? []), ...setup.articulation.dreadlocks] }
  });
  parts.dispose();
  const baseline = makeAdapter({ prepared: false });
  const world = new THREE.Group(); world.rotation.y = 0.34; world.scale.setScalar(1.2); world.add(revised.root, baseline.adapter.root);
  const before = new THREE.Vector3(), after = new THREE.Vector3(); let fixedError = 0;
  try {
    for (let frame = 0; frame < 24; frame++) {
      revised.controls.head.rotation.set(Math.sin(frame / 6) * 0.12, Math.cos(frame / 7) * 0.4, 0);
      baseline.adapter.controls.head.quaternion.copy(revised.controls.head.quaternion);
      for (const adapter of [revised, baseline.adapter]) {
        adapter.root.position.set(frame === 12 ? 17 : 0, 0, frame / 30); adapter.root.rotation.y = Math.sin(frame / 10) * 0.6;
        adapter.update(1 / 60, false);
      }
      const mesh = revised.model.getObjectByName(config.meshName);
      for (let index = 0; index < collar.length; index++) if (collar[index]) fixedError = Math.max(fixedError,
        skinPoint(mesh, index, before).distanceTo(skinPoint(baseline.mesh, index, after)));
      for (const role of ['head', 'neck', 'hips']) assert.equal(hash(revised.bones[role].quaternion.toArray()), hash(baseline.adapter.bones[role].quaternion.toArray()));
    }
    assert.ok(fixedError < 1e-6, `moving attachment collar must remain exact: ${fixedError}`);
    assert.equal(revised.articulation.stats.dreadlocks, 12);
  } finally { revised.dispose(); baseline.adapter.dispose(); }
  assert.equal(sourceState(), initialSource);
});

test('adapter FPS hides the complete prepared mane and disposing one actor leaves the cached art and partner intact', () => {
  const first = makeAdapter(), second = makeAdapter(), preparedMesh = prepare().template.scene.getObjectByName(config.meshName);
  let ownGeometryDisposals = 0, sharedGeometryDisposals = 0, boneDisposals = 0;
  first.mesh.geometry.addEventListener('dispose', () => ownGeometryDisposals++);
  preparedMesh.geometry.addEventListener('dispose', () => sharedGeometryDisposals++);
  first.mesh.skeleton.computeBoneTexture(); first.mesh.skeleton.boneTexture.addEventListener('dispose', () => boneDisposals++);
  const firstBone = first.adapter.model.getObjectByName(prepare().articulation.dreadlocks[0].nodes[1]);
  const secondBone = second.adapter.model.getObjectByName(prepare().articulation.dreadlocks[0].nodes[1]);
  assert.notEqual(firstBone.uuid, secondBone.uuid);
  first.adapter.update(1 / 60, true); first.adapter.setHeadVisible(false); first.adapter.update(1 / 60, true);
  assert.equal(first.mesh.visible, false); assert.equal(first.adapter.headMeshes.every(mesh => !mesh.visible), true);
  first.adapter.setHeadVisible(true); assert.equal(first.mesh.visible, true);
  const partnerPose = bonePose(second.adapter.model, prepare().articulation);
  first.adapter.dispose(); first.adapter.dispose();
  assert.equal(ownGeometryDisposals, 1); assert.equal(sharedGeometryDisposals, 0); assert.equal(boneDisposals, 1);
  assert.equal(bonePose(second.adapter.model, prepare().articulation), partnerPose);
  second.adapter.update(1 / 60, true); second.adapter.dispose(); assert.equal(sourceState(), initialSource);
});

test('incorrect source, malformed tables, overlapping IDs, misplaced attachments and excessive motion fail before source edits', () => {
  assert.equal(prepareImportedManeTemplate(raw, null).template.scene.uuid, raw.scene.uuid);
  assert.throws(() => prepareImportedManeTemplate(raw, config, { sourceSha256: 'incorrect' }), /source SHA256/);
  const invalid = [];
  let candidate = structuredClone(config); candidate.positionHash = 'fnv1a32:00000000'; invalid.push(candidate);
  candidate = structuredClone(config); candidate.skinWeightHash = 'fnv1a32:00000000'; invalid.push(candidate);
  candidate = structuredClone(config); candidate.strands[0].vertices.data = 'bad'; invalid.push(candidate);
  candidate = structuredClone(config); candidate.strands[1].vertices = candidate.strands[0].vertices; invalid.push(candidate);
  candidate = structuredClone(config); candidate.strands[0].curve[1][0] = NaN; invalid.push(candidate);
  candidate = structuredClone(config); candidate.parentBone = 'Hips'; invalid.push(candidate);
  candidate = structuredClone(config); candidate.strands[0].maxAngle = 0.36; invalid.push(candidate);
  candidate = structuredClone(config); candidate.strands[0].stiffness = Infinity; invalid.push(candidate);
  for (const value of invalid) assert.throws(() => prepare(value), /ImportedManeRig/);
  assert.equal(sourceState(), initialSource); assert.equal(prepare().diagnostics.freeEnds, 10);
});

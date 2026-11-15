import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { loadSkinnedGlb } from './helpers/load-skinned-glb.mjs';
import { getCorrectedCreatureTemplate, geometryAttributeHash } from '../js/graphics/CreatureSkinCorrections.js';
import { prepareImportedTailTemplate } from '../js/graphics/ImportedTailRig.js';
import { createImportedCreature } from '../js/graphics/ImportedCreature.js';
import { BIG_CHAP_TAIL_RIG } from '../js/graphics/BigChapTailCalibration.js';
import { GENERATED_ASSETS } from '../js/graphics/GeneratedAssetManifest.js';
import { disposeObject } from '../js/engine/SceneResources.js';

const entry = GENERATED_ASSETS.xenomorph_warrior;
const raw = await loadSkinnedGlb(new URL('../public/models/big-chap-rigged.glb', import.meta.url));
for (const name of ['walk', 'run']) {
  const source = await loadSkinnedGlb(new URL(`../public/models/big-chap-${name}.glb`, import.meta.url));
  source.animations[0].name = name; raw.animations.push(source.animations[0]);
}
const corrected = getCorrectedCreatureTemplate(raw, entry.creatureRig.skinCorrections).template;
corrected.scene.updateMatrixWorld(true); corrected.scene.traverse(node => { if (node.isSkinnedMesh) node.skeleton.update(); });
const sourceMesh = corrected.scene.getObjectByName('char1');
const sourceState = {
  attributes: Object.fromEntries(Object.entries(sourceMesh.geometry.attributes).map(([name, value]) => [name, value.array.slice()])),
  inverse: sourceMesh.skeleton.boneInverses.map(matrix => matrix.elements.slice()),
  transforms: sourceMesh.skeleton.bones.map(bone => [...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray()])
};
const selected = new Uint8Array(BIG_CHAP_TAIL_RIG.vertexCount);
for (const [start, count] of BIG_CHAP_TAIL_RIG.vertexRanges) selected.fill(1, start, start + count);
const clipTemplates = Object.fromEntries(['walk', 'run'].map(clip => [clip, { ...raw, animations: raw.animations.filter(animation => animation.name === clip) }]));
const prepared = () => prepareImportedTailTemplate(corrected, BIG_CHAP_TAIL_RIG, { sourceSha256: entry.sha256 });
function makeAdapter(clip = 'run', parent = null, { tail = true } = {}) {
  const actor = new THREE.Group(); actor.userData.visualProfile = { standingHeight: 3.9536638259887695 };
  actor._creatureRig = { fallback: new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()) }; actor.add(actor._creatureRig.fallback);
  parent?.add(actor);
  const retained = new Set();
  const adapter = createImportedCreature(actor, clipTemplates[clip], {
    ...entry, creatureRig: { ...entry.creatureRig, clips: { [clip]: clip }, tailRig: tail ? BIG_CHAP_TAIL_RIG : undefined, footGrounding: undefined, ankleRig: undefined }
  }, retained);
  actor.add(adapter.root); actor._importedCreatureAdapter = adapter;
  return { actor, adapter, retained, mesh: adapter.model.getObjectByName('char1') };
}
function sourceIntact() {
  for (const [name, values] of Object.entries(sourceState.attributes)) assert.deepEqual(sourceMesh.geometry.attributes[name].array, values, `source ${name} is unchanged`);
  assert.deepEqual(sourceMesh.skeleton.boneInverses.map(matrix => matrix.elements), sourceState.inverse);
  assert.deepEqual(sourceMesh.skeleton.bones.map(bone => [...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray()]), sourceState.transforms);
}
const vertex = new THREE.Vector3();
function tailMinimum(mesh) {
  let min = Infinity;
  for (const [start, count] of BIG_CHAP_TAIL_RIG.vertexRanges) for (let i = start; i < start + count; i++) {
    mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld); min = Math.min(min, vertex.y);
  }
  return min;
}

test('the actual measured tail keeps all rest vertices, source surfaces, old joints and non-tail weights', async () => {
  const result = prepared(), mesh = result.template.scene.getObjectByName('char1');
  assert.equal(mesh.skeleton.bones.length, sourceMesh.skeleton.bones.length + 9);
  assert.equal(result.tail.weightedVertices, 28590);
  assert.ok(result.tail.buckets.length <= 257);
  assert.equal(prepareImportedTailTemplate(corrected, structuredClone(BIG_CHAP_TAIL_RIG), { sourceSha256: entry.sha256 }).template, result.template);
  for (const name of ['position', 'normal', 'uv', 'tangent']) assert.deepEqual(mesh.geometry.attributes[name].array, sourceState.attributes[name], `${name} does not change`);
  assert.equal(geometryAttributeHash(mesh.geometry.index), BIG_CHAP_TAIL_RIG.indexHash);
  const before = new THREE.Vector3(), after = new THREE.Vector3(); let maxRestError = 0;
  for (let i = 0; i < selected.length; i++) {
    sourceMesh.getVertexPosition(i, before).applyMatrix4(sourceMesh.matrixWorld);
    mesh.getVertexPosition(i, after).applyMatrix4(mesh.matrixWorld); maxRestError = Math.max(maxRestError, before.distanceTo(after));
    if (!selected[i]) for (let slot = 0; slot < 4; slot++) {
      const at = i * 4 + slot;
      assert.equal(mesh.geometry.attributes.skinIndex.array[at], sourceState.attributes.skinIndex[at]);
      assert.equal(mesh.geometry.attributes.skinWeight.array[at], sourceState.attributes.skinWeight[at]);
    }
  }
  assert.ok(maxRestError < 1e-6, `measured complete-rest error ${maxRestError}`);
  const rawBytes = await readFile(new URL('../public/models/big-chap-rigged.glb', import.meta.url));
  assert.equal(createHash('sha256').update(rawBytes).digest('hex'), entry.sha256);
  sourceIntact();
});

test('all actual tail vertices clear the floor across both real 33-phase locomotion cycles while the body stays exact', () => {
  for (const clip of ['walk', 'run']) {
    const revised = makeAdapter(clip), baseline = makeAdapter(clip, null, { tail: false });
    let oldMin = Infinity, newMin = Infinity, maxBodyError = 0, changed = false;
    const before = new THREE.Vector3(), after = new THREE.Vector3();
    for (let frame = 0; frame <= 32; frame++) {
      const phase = frame / 32 * Math.PI * 2;
      revised.adapter.update(phase, true); baseline.adapter.update(phase, true);
      oldMin = Math.min(oldMin, tailMinimum(baseline.mesh)); newMin = Math.min(newMin, tailMinimum(revised.mesh));
      assert.equal(revised.adapter.tailRig.diagnostics.groundLimited, false, `${clip}: sampled contact solver must converge`);
      assert.ok(revised.adapter.tailRig.diagnostics.lastGroundMinimum >= BIG_CHAP_TAIL_RIG.ground.clearance - 1e-4);
      for (let i = 0; i < selected.length; i += 113) {
        baseline.mesh.getVertexPosition(i, before).applyMatrix4(baseline.mesh.matrixWorld);
        revised.mesh.getVertexPosition(i, after).applyMatrix4(revised.mesh.matrixWorld);
        if (!selected[i]) maxBodyError = Math.max(maxBodyError, before.distanceTo(after));
        else if (before.distanceTo(after) > 0.02) changed = true;
      }
    }
    assert.ok(oldMin < -0.05, `${clip}: the fixture must expose the previous floor penetration`);
    assert.ok(newMin > 0, `${clip}: actual revised tail floor minimum ${newMin}`);
    assert.ok(maxBodyError < 1e-6, `${clip}: unselected body regions must remain identical`);
    assert.equal(changed, true, 'actual tail geometry must move independently of the old rigid region');
    revised.adapter.dispose(); baseline.adapter.dispose();
  }
  sourceIntact();
});

test('tail poses depend on simulation phase, not frame rate, and pause/LOD/reset preserve deterministic state', () => {
  const runs = [1 / 12, 1 / 120].map(step => {
    const { adapter } = makeAdapter();
    for (let phase = 0; phase < 2.31; phase += step) adapter.update(phase, true);
    adapter.update(2.31, true);
    const joints = adapter.tailRig.bones.map(bone => bone.quaternion.toArray());
    adapter.update(2.31, true);
    assert.deepEqual(adapter.tailRig.bones.map(bone => bone.quaternion.toArray()), joints, 'a stopped phase cannot integrate extra tail energy');
    adapter.setDetailLevel(2); adapter.update(5.4, true);
    assert.deepEqual(adapter.tailRig.bones.map(bone => bone.quaternion.toArray()), joints, 'hidden imported LOD does no additional work');
    adapter.setDetailLevel(0); adapter.update(2.31, true);
    assert.deepEqual(adapter.tailRig.bones.map(bone => bone.quaternion.toArray()), joints, 'returning LOD resumes at current phase without retained energy');
    adapter.update(0, false); adapter.update(2.31, true);
    assert.deepEqual(adapter.tailRig.bones.map(bone => bone.quaternion.toArray()), joints, 'pooled phase resets remain deterministic');
    adapter.dispose(); return joints;
  });
  assert.deepEqual(runs[0], runs[1]);
});

test('ground contact uses the current parent transform and never moves the actor or its gameplay root', () => {
  const world = new THREE.Group(), group = makeAdapter('run', world);
  world.position.set(31, 0, -17); world.rotation.y = 0.7;
  group.actor.position.set(11, 0, 4); group.actor.rotation.y = -1.2; group.actor.scale.setScalar(1.15);
  const initial = group.actor.position.toArray(), rootPosition = group.adapter.root.position.toArray();
  for (const phase of [0, 1.4, 3.1, 5.8]) {
    // No manual scene.updateMatrixWorld is permitted before the adapter call:
    // live actors move between renders, so contact must refresh the bind state.
    world.position.x += 2; group.actor.position.z += 0.5;
    group.adapter.update(phase, true);
    assert.ok(tailMinimum(group.mesh) > -1e-5);
    assert.deepEqual(group.adapter.root.position.toArray(), rootPosition);
    assert.equal(group.actor.position.x, initial[0]); assert.equal(group.actor.position.y, initial[1]);
  }
  group.adapter.dispose();
});

test('co-op instances share only prepared surfaces and release their own complete tail skeleton once', () => {
  const scene = new THREE.Scene(), first = makeAdapter('run', scene), second = makeAdapter('run', scene);
  assert.equal(first.mesh.geometry, second.mesh.geometry);
  assert.notEqual(first.adapter.tailRig.bones[3], second.adapter.tailRig.bones[3]);
  first.adapter.update(1.1, true); const saved = first.adapter.tailRig.bones.map(bone => bone.quaternion.toArray());
  second.adapter.update(4.2, true); assert.deepEqual(first.adapter.tailRig.bones.map(bone => bone.quaternion.toArray()), saved);
  let privateDisposals = 0, sharedDisposals = 0;
  first.mesh.skeleton.computeBoneTexture(); first.mesh.skeleton.boneTexture.addEventListener('dispose', () => privateDisposals++);
  first.mesh.geometry.addEventListener('dispose', () => sharedDisposals++);
  disposeObject(first.actor, first.retained); first.adapter.dispose(); first.adapter.dispose();
  assert.equal(privateDisposals, 1); assert.equal(sharedDisposals, 0);
  second.adapter.update(3.2, true); assert.ok(tailMinimum(second.mesh) > 0);
  disposeObject(second.actor, second.retained);
});

test('unmatched source, malformed parameters, wrong regions and unbounded motion reject before changing cached art', () => {
  const invalid = [];
  let candidate = structuredClone(BIG_CHAP_TAIL_RIG); candidate.positionHash = 'fnv1a32:00000000'; invalid.push(candidate);
  candidate = structuredClone(BIG_CHAP_TAIL_RIG); candidate.vertexParameters.data = 'bad'; invalid.push(candidate);
  candidate = structuredClone(BIG_CHAP_TAIL_RIG); candidate.vertexRanges.push([0, 1]); invalid.push(candidate);
  candidate = structuredClone(BIG_CHAP_TAIL_RIG); candidate.curve[2][0] = NaN; invalid.push(candidate);
  candidate = structuredClone(BIG_CHAP_TAIL_RIG); candidate.motion.yawAmplitude = Infinity; invalid.push(candidate);
  for (const config of invalid) assert.throws(() => prepareImportedTailTemplate(corrected, config, { sourceSha256: entry.sha256 }), /ImportedTailRig/);
  assert.throws(() => prepareImportedTailTemplate(corrected, BIG_CHAP_TAIL_RIG, { sourceSha256: 'incorrect' }), /source SHA256/);
  assert.throws(() => prepareImportedTailTemplate(raw, BIG_CHAP_TAIL_RIG, { sourceSha256: entry.sha256 }), /pelvis skin repair/);
  assert.equal(prepared().tail.weightedVertices, 28590); sourceIntact();
});

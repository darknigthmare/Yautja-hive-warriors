import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { loadSkinnedGlb } from './helpers/load-skinned-glb.mjs';
import { getCorrectedCreatureTemplate, geometryAttributeHash } from '../js/graphics/CreatureSkinCorrections.js';
import { prepareImportedTailTemplate, createImportedTailController } from '../js/graphics/ImportedTailRig.js';
import { prepareImportedAnkleTemplate, createImportedAnkleController } from '../js/graphics/ImportedAnkleRig.js';
import { createImportedCreature } from '../js/graphics/ImportedCreature.js';
import { BIG_CHAP_ANKLE_RIG } from '../js/graphics/BigChapAnkleCalibration.js';
import { BIG_CHAP_TAIL_RIG } from '../js/graphics/BigChapTailCalibration.js';
import { GENERATED_ASSETS } from '../js/graphics/GeneratedAssetManifest.js';

const entry = GENERATED_ASSETS.xenomorph_warrior;
const raw = await loadSkinnedGlb(new URL('../public/models/big-chap-rigged.glb', import.meta.url));
for (const name of ['walk', 'run']) {
  const url = new URL(`../public/models/big-chap-${name}.glb`, import.meta.url);
  assert.equal(createHash('sha256').update(await readFile(url)).digest('hex'), BIG_CHAP_ANKLE_RIG.clipReferences[name].sourceSha256);
  const source = await loadSkinnedGlb(url);
  source.animations[0].name = name; raw.animations.push(source.animations[0]);
}
const corrected = getCorrectedCreatureTemplate(raw, entry.creatureRig.skinCorrections).template;
const tailed = prepareImportedTailTemplate(corrected, BIG_CHAP_TAIL_RIG, { sourceSha256: entry.sha256 });
tailed.template.scene.updateMatrixWorld(true);
const sourceMesh = tailed.template.scene.getObjectByName('char1'); sourceMesh.skeleton.update();
const baselineAttributes = Object.fromEntries(Object.entries(sourceMesh.geometry.attributes).map(([name, value]) => [name, geometryAttributeHash(value)]));
const prepared = prepareImportedAnkleTemplate(tailed.template, BIG_CHAP_ANKLE_RIG, { sourceSha256: entry.sha256 });
const selected = new Uint8Array(BIG_CHAP_ANKLE_RIG.vertexCount);
for (const foot of BIG_CHAP_ANKLE_RIG.feet) for (const [start, count] of foot.vertexRanges) selected.fill(1, start, start + count);
const tailSelected = new Uint8Array(selected.length);
for (const [start, count] of BIG_CHAP_TAIL_RIG.vertexRanges) tailSelected.fill(1, start, start + count);
function make(clip = 'run', withAnkles = true) {
  const actor = new THREE.Group(); actor.userData.visualProfile = { standingHeight: 3.9536638259887695 };
  const input = withAnkles ? prepared : tailed;
  const adapter = createImportedCreature(actor, { ...input.template, animations: raw.animations.filter(animation => animation.name === clip) }, {
    ...entry, creatureRig: { ...entry.creatureRig, skinCorrections: undefined, tailRig: undefined, ankleRig: undefined, footGrounding: undefined, clips: { [clip]: clip } }
  });
  actor.add(adapter.root);
  const ankles = withAnkles ? createImportedAnkleController(adapter.root, adapter.model.parent, adapter.model, prepared.ankles) : null;
  const tail = createImportedTailController(adapter.root, adapter.model, tailed.tail);
  return { actor, adapter, ankles, tail, mesh: adapter.model.getObjectByName('char1'),
    update(phase, moving = true) { adapter.update(phase, moving); ankles?.update(clip, moving); tail.update(phase, moving); },
    dispose() { ankles?.dispose(); adapter.dispose(); } };
}
const point = new THREE.Vector3();
function minimum(mesh, ranges) {
  let min = Infinity;
  for (const [start, count] of ranges) for (let i = start; i < start + count; i++) { mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld); min = Math.min(min, point.y); }
  return min;
}

test('four real source-measured ankle/toe joints preserve the entire rest surface, UV, materials and all non-foot weights', async () => {
  const mesh = prepared.template.scene.getObjectByName('char1');
  assert.equal(mesh.skeleton.bones.length, 37);
  assert.equal(prepareImportedAnkleTemplate(tailed.template, structuredClone(BIG_CHAP_ANKLE_RIG), { sourceSha256: entry.sha256 }).template.scene.uuid, prepared.template.scene.uuid);
  for (const name of ['position', 'normal', 'uv', 'tangent']) assert.equal(geometryAttributeHash(mesh.geometry.attributes[name]), baselineAttributes[name]);
  assert.equal(geometryAttributeHash(mesh.geometry.index), BIG_CHAP_ANKLE_RIG.indexHash);
  assert.equal(mesh.material.uuid, sourceMesh.material.uuid);
  const before = new THREE.Vector3(), after = new THREE.Vector3(); let maxError = 0;
  for (let i = 0; i < selected.length; i++) {
    sourceMesh.getVertexPosition(i, before).applyMatrix4(sourceMesh.matrixWorld);
    mesh.getVertexPosition(i, after).applyMatrix4(mesh.matrixWorld); maxError = Math.max(maxError, before.distanceTo(after));
    if (!selected[i]) for (let slot = 0; slot < 4; slot++) {
      const at = i * 4 + slot;
      assert.equal(mesh.geometry.attributes.skinIndex.array[at], sourceMesh.geometry.attributes.skinIndex.array[at]);
      assert.equal(mesh.geometry.attributes.skinWeight.array[at], sourceMesh.geometry.attributes.skinWeight.array[at]);
    }
  }
  assert.ok(maxError < 1e-6, `complete rest error ${maxError}`);
  for (const [name, hash] of Object.entries(baselineAttributes)) assert.equal(geometryAttributeHash(sourceMesh.geometry.attributes[name]), hash);
  assert.equal(createHash('sha256').update(await readFile(new URL('../public/models/big-chap-rigged.glb', import.meta.url))).digest('hex'), entry.sha256);
});

test('all 8138 real foot vertices match compact exact supports through all 66 real walk/run poses, with visible articulation and tail clearance', t => {
  for (const clip of ['walk', 'run']) {
    const current = make(clip), baseline = make(clip, false);
    let airFrames = 0, contactFrames = 0, largestFootChange = 0, maxContactCorrection = 0, maxSupportError = 0, minFootY = Infinity;
    const distinct = new Set(), before = new THREE.Vector3(), after = new THREE.Vector3();
    for (let frame = 0; frame <= 32; frame++) {
      const phase = frame / 32 * Math.PI * 2;
      current.update(phase); baseline.update(phase);
      const d = current.ankles.diagnostics;
      assert.equal(d.supportVertices, 1953); assert.equal(d.articulatedJoints, 4); assert.equal(d.limited, false, `${clip} ${frame}: contact must stay bounded`);
      distinct.add(d.angles.flat().map(angle => angle.toFixed(5)).join(','));
      for (let side = 0; side < 2; side++) {
        const actual = minimum(current.mesh, BIG_CHAP_ANKLE_RIG.feet[side].vertexRanges);
        minFootY = Math.min(minFootY, actual); maxSupportError = Math.max(maxSupportError, Math.abs(actual - (d.feet[side].minY + d.visualWorldOffsetY)));
        assert.ok(Math.abs(actual - (d.feet[side].minY + d.visualWorldOffsetY)) < 1e-6, `${clip} ${frame}: hull is exact for every weighted source vertex`);
        assert.ok(actual >= .005 - 1e-6, `${clip} ${frame}: no foot penetrates ground`);
      }
      assert.ok(minimum(current.mesh, BIG_CHAP_TAIL_RIG.vertexRanges) > 0, 'independent nine-joint tail retains floor clearance');
      maxContactCorrection = Math.max(maxContactCorrection, Math.abs(d.visualWorldOffsetY));
      if (d.minFootYBefore > BIG_CHAP_ANKLE_RIG.ground.contactBand) { airFrames++; assert.equal(Math.abs(d.visualWorldOffsetY), 0); }
      if (d.minFootYBefore <= BIG_CHAP_ANKLE_RIG.ground.fullContactBand) { contactFrames++; assert.ok(Math.abs(d.minFootYAfter - .005) < 1e-6); }
      // Provider inverse binds carry a 100x scale. Compare actual world surfaces,
      // removing only the separately reported visual contact translation.
      for (let i = 0; i < selected.length; i++) if (selected[i]) {
        baseline.mesh.getVertexPosition(i, before).applyMatrix4(baseline.mesh.matrixWorld);
        current.mesh.getVertexPosition(i, after).applyMatrix4(current.mesh.matrixWorld); after.y -= d.visualWorldOffsetY;
        largestFootChange = Math.max(largestFootChange, before.distanceTo(after));
      }
      for (let i = 0; i < selected.length; i += 107) if (!selected[i] && !tailSelected[i]) {
        baseline.mesh.getVertexPosition(i, before); current.mesh.getVertexPosition(i, after);
        assert.ok(before.distanceTo(after) < 1e-6, 'untouched body keeps the exact original clip pose');
      }
    }
    assert.ok(distinct.size >= 15, `${clip}: real clip must articulate the new joints over the cycle`);
    assert.ok(largestFootChange > .015 && largestFootChange < .15, `${clip}: bounded actual foot surface articulation ${largestFootChange}`);
    assert.ok(airFrames > 0 && contactFrames > 0);
    assert.ok(maxContactCorrection < .18);
    t.diagnostic(JSON.stringify({ clip, poses: 33, airFrames, contactFrames, distinctJointPoses: distinct.size, largestFootChange, maxContactCorrection, maxSupportError, minFootY }));
    current.dispose(); baseline.dispose();
  }
});

test('the actual ImportedCreature pipeline prepares, updates and disposes the optional measured ankle rig', () => {
  const actor = new THREE.Group(); actor.userData.visualProfile = { standingHeight: 3.9536638259887695 };
  const adapter = createImportedCreature(actor, raw, { ...entry, creatureRig: {
    ...entry.creatureRig, ankleRig: BIG_CHAP_ANKLE_RIG, tailRig: BIG_CHAP_TAIL_RIG
  } });
  actor.add(adapter.root); const mesh = adapter.model.getObjectByName('char1');
  assert.equal(mesh.skeleton.bones.length, 37);
  assert.equal(adapter.ankleRig.diagnostics.articulatedJoints, 4);
  assert.equal(adapter.footGrounding, null);
  for (let frame = 0; frame <= 32; frame++) {
    adapter.update(frame / 32 * Math.PI * 2, true);
    for (const foot of BIG_CHAP_ANKLE_RIG.feet) assert.ok(minimum(mesh, foot.vertexRanges) >= .005 - 1e-6);
    assert.ok(minimum(mesh, BIG_CHAP_TAIL_RIG.vertexRanges) > 0);
  }
  const angles = adapter.ankleRig.bones.map(bone => bone.quaternion.toArray());
  adapter.setDetailLevel(2); adapter.update(1.3, true); assert.deepEqual(adapter.ankleRig.bones.map(bone => bone.quaternion.toArray()), angles);
  adapter.setDetailLevel(0); adapter.update(0, false); assert.deepEqual(adapter.ankleRig.diagnostics.angles, [[0, 0], [0, 0]]);
  adapter.dispose(); const disposed = adapter.ankleRig.bones.map(bone => bone.quaternion.toArray());
  adapter.update(1.4, true); assert.deepEqual(adapter.ankleRig.bones.map(bone => bone.quaternion.toArray()), disposed);
});

test('unmodified calf collars and welded UV seams retain continuity, with bounded real triangle-edge deformation in all 66 poses', t => {
  const mesh = prepared.template.scene.getObjectByName('char1'), index = mesh.geometry.index.array;
  const positions = mesh.geometry.attributes.position, skinIndex = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
  let boundaryEdges = 0; const edgeSet = new Set(), edges = [], vertices = new Set(), welded = new Map();
  const signature = vertex => Array.from({ length: 4 }, (_, slot) => weights.array[vertex * 4 + slot] > 0 ? `${skinIndex.array[vertex * 4 + slot]}:${weights.array[vertex * 4 + slot]}` : '').filter(Boolean).join('|');
  for (let vertex = 0; vertex < selected.length; vertex++) if (selected[vertex]) {
    const key = [positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)].join(','), value = signature(vertex);
    if (welded.has(key)) assert.equal(value, welded.get(key), 'coincident UV splits retain identical skin influences'); else welded.set(key, value);
  }
  for (let at = 0; at < index.length; at += 3) for (let edge = 0; edge < 3; edge++) {
    let a = index[at + edge], b = index[at + (edge + 1) % 3];
    if (!selected[a] && !selected[b]) continue;
    if (selected[a] !== selected[b]) {
      boundaryEdges++; const vertex = selected[a] ? a : b;
      assert.equal(weights.getX(vertex), 1, 'every region boundary keeps its exact original rigid calf');
      assert.equal(weights.getY(vertex), 0);
      assert.equal(skinIndex.getX(vertex), sourceMesh.geometry.attributes.skinIndex.getX(vertex));
    }
    if (a > b) [a, b] = [b, a]; const key = `${a}:${b}`;
    if (!edgeSet.has(key)) { edgeSet.add(key); edges.push([a, b]); vertices.add(a); vertices.add(b); }
  }
  assert.ok(boundaryEdges > 0);
  const before = new Float64Array(selected.length * 3), after = new Float64Array(selected.length * 3), v = new THREE.Vector3(); let maxEdgeChange = 0;
  for (const clip of ['walk', 'run']) {
    const current = make(clip), baseline = make(clip, false);
    for (let frame = 0; frame <= 32; frame++) {
      const phase = frame / 32 * Math.PI * 2; current.update(phase); baseline.update(phase);
      for (const vertex of vertices) {
        baseline.mesh.getVertexPosition(vertex, v).applyMatrix4(baseline.mesh.matrixWorld); before.set(v.toArray(), vertex * 3);
        current.mesh.getVertexPosition(vertex, v).applyMatrix4(current.mesh.matrixWorld); after.set(v.toArray(), vertex * 3);
      }
      for (const [a, b] of edges) {
        const length = values => Math.hypot(values[a * 3] - values[b * 3], values[a * 3 + 1] - values[b * 3 + 1], values[a * 3 + 2] - values[b * 3 + 2]);
        maxEdgeChange = Math.max(maxEdgeChange, Math.abs(length(before) - length(after)));
      }
    }
    current.dispose(); baseline.dispose();
  }
  assert.ok(maxEdgeChange < .015, `no long skin strips: maximum edge extension/compression ${maxEdgeChange}`);
  t.diagnostic(JSON.stringify({ boundaryEdges, weightedBoundaryEdges: 0, sourceFootEdges: edges.length, weldedFootPositions: welded.size, maxEdgeChange }));
});

test('private feet are phase deterministic, preserve idle/rest and obey live scale, LOD, wall orientation and disposal', () => {
  const first = make(), second = make(), parent = new THREE.Group(); parent.add(first.actor); parent.position.set(12, 0, -7); parent.rotation.y = .7; parent.scale.setScalar(1.15);
  first.update(2.31); const expected = first.ankles.bones.map(bone => bone.quaternion.toArray());
  const pose = first.ankles.diagnostics.visualWorldOffsetY;
  second.update(5.2); assert.deepEqual(first.ankles.bones.map(bone => bone.quaternion.toArray()), expected);
  assert.notEqual(first.ankles.bones[0].uuid, second.ankles.bones[0].uuid);
  assert.equal(first.mesh.geometry.uuid, second.mesh.geometry.uuid);
  for (const step of [1 / 12, 1 / 120]) {
    for (let phase = 0; phase < 2.31; phase += step) first.update(phase);
    first.update(2.31); assert.deepEqual(first.ankles.bones.map(bone => bone.quaternion.toArray()), expected); assert.equal(first.ankles.diagnostics.visualWorldOffsetY, pose);
  }
  first.ankles.setDetailLevel(2); first.ankles.update('run'); assert.deepEqual(first.ankles.bones.map(bone => bone.quaternion.toArray()), expected);
  first.ankles.setDetailLevel(0); first.update(2.31); assert.deepEqual(first.ankles.bones.map(bone => bone.quaternion.toArray()), expected);
  first.update(0, false); assert.deepEqual(first.ankles.diagnostics.angles, [[0, 0], [0, 0]]);
  const idle = first.ankles.diagnostics.visualWorldOffsetY; first.update(100, false); assert.equal(first.ankles.diagnostics.visualWorldOffsetY, idle);
  parent.scale.set(1.1, 1.25, .9); first.update(0);
  assert.ok(Math.abs(first.ankles.diagnostics.minFootYAfter - .005) < 1e-6, 'nonuniform live parent scale keeps exact world contact');
  first.adapter.root.rotation.x = Math.PI / 2; first.update(0); assert.equal(first.ankles.diagnostics.visualWorldOffsetY, 0); assert.equal(first.ankles.diagnostics.contact, false);
  first.adapter.root.rotation.x = 0; first.update(0); assert.ok(Math.abs(first.ankles.diagnostics.minFootYAfter - .005) < 1e-6);
  assert.deepEqual(first.actor.position.toArray(), [0, 0, 0]);
  first.ankles.dispose(); const after = first.ankles.bones.map(bone => bone.quaternion.toArray()); first.ankles.update('run'); assert.deepEqual(first.ankles.bones.map(bone => bone.quaternion.toArray()), after);
  first.dispose(); second.update(2.8); assert.equal(second.ankles.diagnostics.limited, false, 'disposing one actor preserves the shared template and other skeleton'); second.dispose();
});

test('a different source, unreviewed region, corrupt support or unsafe amplitude fails closed', () => {
  const apply = config => prepareImportedAnkleTemplate(tailed.template, config, { sourceSha256: entry.sha256 });
  assert.equal(apply(undefined).ankles, null);
  let config = structuredClone(BIG_CHAP_ANKLE_RIG); config.sourceSha256 = '0'.repeat(64); assert.throws(() => apply(config), /source SHA256/);
  config = structuredClone(BIG_CHAP_ANKLE_RIG); config.positionHash = 'invalid'; assert.throws(() => apply(config), /fingerprints/);
  config = structuredClone(BIG_CHAP_ANKLE_RIG); config.feet[0].supports[0].vertices[0] = 0; assert.throws(() => apply(config), /exact weight group/);
  config = structuredClone(BIG_CHAP_ANKLE_RIG); config.motion.maxAnkleRadians = .9; assert.throws(() => apply(config), /bounded/);
  config = structuredClone(BIG_CHAP_ANKLE_RIG); config.ground.maxCorrection = Infinity; assert.throws(() => apply(config), /bounded/);
  config = structuredClone(BIG_CHAP_ANKLE_RIG); config.feet[0].anklePivot[1] = 1e6; assert.throws(() => apply(config), /inside their measured/);
  for (const [name, hash] of Object.entries(baselineAttributes)) assert.equal(geometryAttributeHash(sourceMesh.geometry.attributes[name]), hash);
});

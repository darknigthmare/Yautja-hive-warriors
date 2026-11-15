import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { loadSkinnedGlb } from './helpers/load-skinned-glb.mjs';
import { createImportedCreature } from '../js/graphics/ImportedCreature.js';
import { createImportedCreatureGrounding } from '../js/graphics/ImportedCreatureGrounding.js';
import { BIG_CHAP_FOOT_GROUNDING } from '../js/graphics/BigChapFootCalibration.js';
import { BIG_CHAP_TAIL_RIG } from '../js/graphics/BigChapTailCalibration.js';
import { GENERATED_ASSETS } from '../js/graphics/GeneratedAssetManifest.js';

const entry = GENERATED_ASSETS.xenomorph_warrior;
const source = await loadSkinnedGlb(new URL('../public/models/big-chap-rigged.glb', import.meta.url));
const templates = {};
for (const clip of ['walk', 'run']) {
  const loaded = await loadSkinnedGlb(new URL(`../public/models/big-chap-${clip}.glb`, import.meta.url));
  loaded.animations[0].name = clip;
  templates[clip] = { ...source, animations: [loaded.animations[0]] };
}
const sourceMesh = source.scene.getObjectByName('char1');
const attributes = Object.fromEntries(Object.entries(sourceMesh.geometry.attributes).map(([key, value]) => [key, value.array.slice()]));
const footRegions = entry.creatureRig.skinCorrections.meshes[0].bindings.slice(1);
const point = new THREE.Vector3();
function minimum(mesh, ranges) {
  let value = Infinity;
  for (const [start, count] of ranges) for (let at = start; at < start + count; at++) {
    mesh.getVertexPosition(at, point).applyMatrix4(mesh.matrixWorld); value = Math.min(value, point.y);
  }
  return value;
}
function make(clip = 'run', enabled = true) {
  const actor = new THREE.Group(); actor.userData.visualProfile = { standingHeight: 3.9536638259887695 };
  const adapter = createImportedCreature(actor, templates[clip], { ...entry, creatureRig: {
    ...entry.creatureRig, clips: { [clip]: clip }, tailRig: BIG_CHAP_TAIL_RIG, ankleRig: undefined,
    footGrounding: enabled ? BIG_CHAP_FOOT_GROUNDING : undefined
  } });
  actor.add(adapter.root);
  return { actor, adapter, mesh: adapter.model.getObjectByName('char1') };
}

test('measured convex supports match all 8138 actual lower-leg/foot vertices through 66 source clip poses', () => {
  for (const clip of ['walk', 'run']) {
    const current = make(clip), original = make(clip, false); let airFrames = 0, contactFrames = 0;
    assert.equal(current.adapter.footGrounding.diagnostics.supportVertices, 515);
    assert.equal(current.adapter.footGrounding.diagnostics.ankleIK, false);
    for (let frame = 0; frame <= 32; frame++) {
      const phase = frame / 32 * Math.PI * 2;
      current.adapter.update(phase, true); original.adapter.update(phase, true);
      const diagnostics = current.adapter.footGrounding.diagnostics;
      let originalMin = Infinity;
      for (let foot = 0; foot < footRegions.length; foot++) {
        const before = minimum(original.mesh, footRegions[foot].vertexRanges);
        originalMin = Math.min(originalMin, before);
        assert.ok(Math.abs(before - diagnostics.feet[foot].minY) < 1e-6, 'convex support must equal the entire measured rigid region');
        assert.ok(minimum(current.mesh, footRegions[foot].vertexRanges) >= .005 - 1e-6, `${clip} phase ${frame}: no source foot vertices below floor`);
      }
      assert.ok(Math.abs(diagnostics.visualWorldOffsetY) <= BIG_CHAP_FOOT_GROUNDING.maxCorrection);
      assert.equal(diagnostics.limited, false);
      assert.ok(minimum(current.mesh, BIG_CHAP_TAIL_RIG.vertexRanges) > 0, 'subsequent tail correction stays above floor');
      if (originalMin > BIG_CHAP_FOOT_GROUNDING.contactBand) {
        airFrames++; assert.equal(Math.abs(diagnostics.visualWorldOffsetY), 0, 'genuine airborne frames retain source elevation');
      } else if (originalMin <= BIG_CHAP_FOOT_GROUNDING.fullContactBand) {
        contactFrames++; assert.ok(Math.abs(diagnostics.minFootYAfter - .005) < 1e-6);
      }
    }
    assert.ok(airFrames > 0 && contactFrames > 0, 'the fixture must distinguish airborne frames from contact');
    current.adapter.dispose(); original.adapter.dispose();
  }
});

test('idle has no accumulated bobbing, phase/frame-rate history, LOD work or gameplay displacement', () => {
  const current = make();
  current.actor.position.set(9, 0, -5); current.actor.rotation.y = 1.2;
  current.adapter.update(0, false);
  const idle = current.adapter.footGrounding.diagnostics.visualWorldOffsetY;
  const orientation = current.adapter.model.parent.position.toArray();
  assert.ok(Math.abs(current.adapter.footGrounding.diagnostics.minFootYAfter - .005) < 1e-6);
  for (const phase of [0.1, 1.5, 4.7, 25.8]) {
    current.adapter.update(phase, false);
    assert.equal(current.adapter.footGrounding.diagnostics.visualWorldOffsetY, idle);
    assert.deepEqual(current.adapter.model.parent.position.toArray(), orientation);
  }
  current.adapter.update(2.31, true); const expected = current.adapter.footGrounding.diagnostics.visualWorldOffsetY;
  for (const step of [1 / 12, 1 / 120]) {
    for (let phase = 0; phase < 2.31; phase += step) current.adapter.update(phase, true);
    current.adapter.update(2.31, true); assert.equal(current.adapter.footGrounding.diagnostics.visualWorldOffsetY, expected);
  }
  current.adapter.setDetailLevel(2); current.adapter.update(4.2, true);
  assert.equal(current.adapter.footGrounding.diagnostics.visualWorldOffsetY, expected);
  current.adapter.setDetailLevel(0); current.adapter.update(2.31, true);
  assert.equal(current.adapter.footGrounding.diagnostics.visualWorldOffsetY, expected);
  assert.deepEqual(current.actor.position.toArray(), [9, 0, -5]);
  assert.deepEqual(current.adapter.root.position.toArray(), [0, 0, 0]);
  current.adapter.dispose();
});

test('private instance corrections respect live parent scale and bypass wall-climbing orientation', () => {
  const first = make(), second = make(), parent = new THREE.Group(); parent.add(first.actor);
  parent.position.set(20, 0, 11); parent.rotation.y = .6; parent.scale.setScalar(1.15);
  first.adapter.update(0, true); second.adapter.update(3, true);
  assert.ok(Math.abs(first.adapter.footGrounding.diagnostics.minFootYAfter - .005) < 1e-6);
  const before = first.adapter.model.parent.position.toArray();
  second.adapter.update(5.2, true); assert.deepEqual(first.adapter.model.parent.position.toArray(), before);
  first.adapter.root.rotation.x = Math.PI / 2; first.adapter.update(0, true);
  assert.equal(first.adapter.footGrounding.diagnostics.visualWorldOffsetY, 0);
  assert.equal(first.adapter.footGrounding.diagnostics.contact, false);
  first.adapter.root.rotation.x = 0; first.adapter.update(0, true);
  assert.ok(Math.abs(first.adapter.footGrounding.diagnostics.minFootYAfter - .005) < 1e-6);
  first.adapter.dispose(); second.adapter.dispose();
});

test('optional calibration fails closed on a different source, region or unsafe limits without changing source art', async () => {
  const { adapter } = make();
  const apply = config => createImportedCreatureGrounding(adapter.root, adapter.model.parent, adapter.model, config, { sourceSha256: entry.sha256 });
  assert.equal(apply(undefined), null);
  let config = structuredClone(BIG_CHAP_FOOT_GROUNDING); config.sourceSha256 = 'invalid'; assert.throws(() => apply(config), /source-calibrated/);
  config = structuredClone(BIG_CHAP_FOOT_GROUNDING); config.positionHash = 'bad'; assert.throws(() => apply(config), /fingerprints/);
  config = structuredClone(BIG_CHAP_FOOT_GROUNDING); config.feet[0].supportVertices[0] = 0; assert.throws(() => apply(config), /rigid joint/);
  config = structuredClone(BIG_CHAP_FOOT_GROUNDING); config.maxCorrection = Infinity; assert.throws(() => apply(config), /bounded/);
  for (const [key, values] of Object.entries(attributes)) assert.deepEqual(sourceMesh.geometry.attributes[key].array, values);
  assert.equal(createHash('sha256').update(await readFile(new URL('../public/models/big-chap-rigged.glb', import.meta.url))).digest('hex'), entry.sha256);
  adapter.dispose();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyMaskedBodyRegions } from '../js/graphics/MaskedBodyRegions.js';
import { prepareImportedParts } from '../js/graphics/ImportedPartsPreparation.js';
import { composeCharacterWithBiomask, BIOMASK_GROUP_NAME } from '../js/graphics/BiomaskComposition.js';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';

const SOURCE_SHA = 'a'.repeat(64);
const audio = new Proxy({}, { get: () => () => {} });

// Synthetic two-region body only. The selected top face does not represent a
// production face cut or certify that any real biomask covers a whole region.
function fixture() {
  const scene = new THREE.Group(), hips = new THREE.Bone(); hips.name = 'Hips'; hips.position.y = 0.4;
  const bones = [hips], byName = new Map([[hips.name, hips]]); scene.add(hips);
  for (const [name, parent, position] of [
    ['Head', 'Hips', [0, 1.2, 0]], ['LeftArm', 'Hips', [-0.4, 0.7, 0]], ['RightArm', 'Hips', [0.4, 0.7, 0]],
    ['LeftUpLeg', 'Hips', [-0.2, -0.1, 0]], ['RightUpLeg', 'Hips', [0.2, -0.1, 0]],
    ['LeftForeArm', 'LeftArm', [-0.3, 0, 0]], ['RightForeArm', 'RightArm', [0.3, 0, 0]],
    ['LeftHand', 'LeftForeArm', [-0.2, 0, 0]], ['RightHand', 'RightForeArm', [0.2, 0, 0]],
    ['LeftFoot', 'LeftUpLeg', [0, -0.3, 0]], ['RightFoot', 'RightUpLeg', [0, -0.3, 0]]
  ]) {
    const bone = new THREE.Bone(); bone.name = name; bone.position.set(...position);
    byName.get(parent).add(bone); bones.push(bone); byName.set(name, bone);
  }
  const geometry = new THREE.BoxGeometry(0.7, 2, 0.4); geometry.translate(0, 1, 0);
  const skin = [], weights = [];
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    skin.push(geometry.attributes.position.getY(i) > 1 ? 1 : 0, 0, 0, 0); weights.push(1, 0, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skin, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const texture = new THREE.DataTexture(new Uint8Array([180, 140, 110, 255]), 1, 1);
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 }); material.name = 'fixture-skin';
  const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = 'FixtureBody'; scene.add(mesh);
  scene.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones), mesh.matrixWorld);
  const maskScene = new THREE.Group(), maskMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.7 });
  const maskMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.08), maskMaterial); maskMesh.name = 'fixture-mask-surface'; maskScene.add(maskMesh);
  const body = { scene, animations: [] }, mask = { scene: maskScene, animations: [] };
  const rig = { calibrated: true, height: 4.31, forwardAxis: '+z', boneMap: { hips: 'Hips', head: 'Head' },
    partRegions: { version: 1, sourceSha256: SOURCE_SHA, meshes: [{ meshIndex: 0, triangleCount: 12,
      regions: [{ id: 'covered-face', faceRanges: [[4, 2]] }], unassignedId: 'body-rest' }] },
    maskedBodyRegions: { calibrated: true, sourceSha256: SOURCE_SHA, ids: ['covered-face'] },
    biomask: { calibrated: true, assetKey: 'fixture_city_biomask', bone: 'Head',
      position: [0, 0, 0.1], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] }, accessories: {} };
  for (const [name, socket] of Object.entries({ blade1: 'rightHand', blade2: 'rightHand', shieldMesh: 'leftHand',
    secWeaponMesh: 'leftHand', plasmaGlaiveMesh: 'rightHand', clanMarkMesh: 'head' })) {
    rig.accessories[name] = { socket, position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] };
  }
  const entry = { status: 'verified', sha256: SOURCE_SHA, url: '/models/SYNTHETIC_city.glb', characterRig: rig };
  const maskEntry = { status: 'verified', url: '/models/SYNTHETIC_city_mask.glb' };
  const library = { getGeneratedAssetEntry: key => key === 'city_hunter' ? entry : key === rig.biomask.assetKey ? maskEntry : null,
    loadGeneratedAsset: async key => key === 'city_hunter' ? body : mask };
  return { body, mask, rig, entry, library, mesh, maskMesh, texture };
}

function preparedComposition(f) {
  const prepared = prepareImportedParts(f.body, f.rig, { sourceSha256: SOURCE_SHA });
  assert.equal(prepared.diagnostics.regionsPrepared, true);
  const composed = composeCharacterWithBiomask(prepared.gltf, f.mask, f.rig.biomask, { headBoneName: 'Head' });
  return { prepared, composed };
}
const surfaces = root => { const result = []; root.traverse(node => { if (node.isMesh) result.push(node); }); return result; };
const surfaceData = root => surfaces(root).map(mesh => ({ name: mesh.name, visible: mesh.visible,
  attributes: Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([key, value]) => [key, [...value.array]])),
  index: [...mesh.geometry.index.array], groups: structuredClone(mesh.geometry.groups), drawRange: { ...mesh.geometry.drawRange } }));
class FixturePlayer extends Player {
  // These tests inject tiny meshes explicitly. Enabling the shipping City
  // model must not turn a CPU fixture into a network/4K image loading test.
  loadGeneratedVisual(library) { return library ? super.loadGeneratedVisual(library) : Promise.resolve(false); }
}
async function actor() {
  const player = new FixturePlayer(new THREE.Scene(), CHARACTERS_DATA.find(value => value.id === 'city_hunter'), audio);
  await player.generatedVisualReady;
  return player;
}

test('absent coverage calibration is an exact no-op', () => {
  const f = fixture(), before = f.body.scene.toJSON();
  assert.equal(applyMaskedBodyRegions(f.body, undefined), f.body);
  assert.deepEqual(f.body.scene.toJSON(), before);
});

test('only measured leaf regions are hidden on private nodes while all surface data and prepared inputs remain unchanged', () => {
  const f = fixture(), source = f.body.scene.toJSON(), { prepared, composed } = preparedComposition(f);
  const before = surfaceData(composed.scene), preparedBefore = prepared.gltf.scene.toJSON();
  const result = applyMaskedBodyRegions(composed, f.rig.maskedBodyRegions, { sourceSha256: SOURCE_SHA });
  assert.notEqual(result.scene, composed.scene); assert.equal(result.disposeComposition, composed.disposeComposition);
  assert.equal(result.scene.getObjectByName('covered-face').visible, false);
  assert.equal(result.scene.getObjectByName('body-rest').visible, true);
  assert.equal(result.scene.getObjectByName('fixture-mask-surface').visible, true);
  const after = surfaceData(result.scene);
  assert.deepEqual(after.map(({ visible, ...value }) => value), before.map(({ visible, ...value }) => value));
  assert.deepEqual(surfaceData(composed.scene), before, 'composition input is unchanged too');
  for (const mesh of surfaces(result.scene)) {
    assert.notEqual(mesh, composed.scene.getObjectByName(mesh.name));
    assert.equal(mesh.geometry, composed.scene.getObjectByName(mesh.name).geometry);
    assert.equal(mesh.material, composed.scene.getObjectByName(mesh.name).material);
  }
  assert.notEqual(result.scene.getObjectByName('Head'), composed.scene.getObjectByName('Head'));
  const covered = result.scene.getObjectByName('covered-face');
  assert.equal(covered.skeleton.bones[1], result.scene.getObjectByName('Head'));
  assert.deepEqual(result.maskedBodyRegionDiagnostics.ids, ['covered-face']);
  assert.deepEqual(prepared.gltf.scene.toJSON(), preparedBefore); assert.deepEqual(f.body.scene.toJSON(), source);
  composed.disposeComposition?.(); prepared.dispose();
});

test('all calibration, ownership and duplicate checks precede visibility changes', () => {
  for (const mode of ['sha', 'hash-format', 'calibrated', 'empty', 'duplicate-id', 'missing-second', 'ambiguous', 'metadata', 'mask-region', 'children', 'missing-mask']) {
    const f = fixture(), { prepared, composed } = preparedComposition(f), config = structuredClone(f.rig.maskedBodyRegions);
    if (mode === 'sha') config.sourceSha256 = 'b'.repeat(64);
    if (mode === 'hash-format') config.sourceSha256 = 'invalid';
    if (mode === 'calibrated') config.calibrated = false;
    if (mode === 'empty') config.ids = [];
    if (mode === 'duplicate-id') config.ids.push('covered-face');
    if (mode === 'missing-second') config.ids.push('missing-region');
    if (mode === 'ambiguous') { const duplicate = new THREE.Group(); duplicate.name = 'covered-face'; composed.scene.add(duplicate); }
    if (mode === 'metadata') composed.scene.getObjectByName('covered-face').userData.importedPartRegion.id = 'other';
    if (mode === 'mask-region') {
      const maskMesh = composed.scene.getObjectByName('fixture-mask-surface');
      maskMesh.userData.importedPartRegion = { id: maskMesh.name }; config.ids = [maskMesh.name];
    }
    if (mode === 'children') composed.scene.getObjectByName('covered-face').add(new THREE.Group());
    if (mode === 'missing-mask') composed.scene.getObjectByName(BIOMASK_GROUP_NAME).removeFromParent();
    const before = composed.scene.toJSON(), preparedBefore = prepared.gltf.scene.toJSON();
    assert.throws(() => applyMaskedBodyRegions(composed, config, { sourceSha256: SOURCE_SHA }), /MaskedBodyRegions/, mode);
    assert.deepEqual(composed.scene.toJSON(), before, mode); assert.deepEqual(prepared.gltf.scene.toJSON(), preparedBefore, mode);
    assert.equal(composed.scene.getObjectByName('covered-face').visible, true, mode);
    composed.disposeComposition?.(); prepared.dispose();
  }
});

test('Player keeps measured face occlusion through FPS, cloak, head motion and private disposal without changing another actor', async () => {
  const f = fixture(), first = await actor(), second = await actor();
  const source = f.body.scene.toJSON(), maskSource = f.mask.scene.toJSON();
  first.toggleCloak(); first.headMesh.visible = false;
  assert.equal(await first.loadGeneratedVisual(f.library), true); assert.equal(await second.loadGeneratedVisual(f.library), true);
  const a = first._importedCharacter.adapter, b = second._importedCharacter.adapter;
  const hidden = a.model.getObjectByName('covered-face'), otherHidden = b.model.getObjectByName('covered-face');
  const mask = a.model.getObjectByName('fixture-mask-surface');
  assert.equal(hidden.visible, false); assert.equal(otherHidden.visible, false); assert.equal(mask.visible, false);
  assert.notEqual(hidden.geometry, otherHidden.geometry); assert.notEqual(hidden.material, otherHidden.material);
  assert.equal(hidden.material.map, f.texture); assert.equal(hidden.material.opacity, 0.22);
  first.headMesh.visible = true; first.headMesh.rotation.y = 0.2; first.update(1 / 60);
  assert.equal(hidden.visible, false, 'FPS exit must not restore occluded faces'); assert.equal(mask.visible, true);
  first.toggleCloak(); assert.equal(hidden.material.opacity, 1); assert.equal(hidden.visible, false);
  let ownedDisposals = 0, sourceDisposals = 0, otherDisposals = 0;
  [hidden.geometry, hidden.material].forEach(value => value.addEventListener('dispose', () => ownedDisposals++));
  [f.mesh.geometry, f.mesh.material, f.texture, f.maskMesh.geometry, f.maskMesh.material].forEach(value => value.addEventListener('dispose', () => sourceDisposals++));
  [otherHidden.geometry, otherHidden.material].forEach(value => value.addEventListener('dispose', () => otherDisposals++));
  first.dispose(); first.dispose(); assert.equal(ownedDisposals, 2); assert.equal(sourceDisposals, 0); assert.equal(otherDisposals, 0);
  assert.equal(second.generatedBiomaskState, 'attached'); assert.equal(otherHidden.visible, false);
  assert.deepEqual(f.body.scene.toJSON(), source); assert.deepEqual(f.mask.scene.toJSON(), maskSource); second.dispose();
});

test('malformed coverage, unavailable mask or unconfigured mask keeps every prepared body region visible and removes optional composition', async () => {
  for (const mode of ['coverage', 'network', 'unconfigured']) {
    const f = fixture(), player = await actor(), source = f.body.scene.toJSON();
    if (mode === 'coverage') f.rig.maskedBodyRegions.ids.push('missing-second-region');
    if (mode === 'network') f.library.loadGeneratedAsset = async key => {
      if (key !== 'city_hunter') throw new Error('fixture mask unavailable'); return f.body;
    };
    if (mode === 'unconfigured') f.rig.biomask.calibrated = false;
    assert.equal(await player.loadGeneratedVisual(f.library), true, mode);
    assert.equal(player.generatedVisualState, 'imported'); assert.equal(player._importedCharacter.biomask, null);
    assert.equal(player.generatedBiomaskState, mode === 'unconfigured' ? 'unconfigured' : 'unavailable');
    const model = player._importedCharacter.adapter.model;
    assert.equal(model.getObjectByName(BIOMASK_GROUP_NAME), undefined, mode);
    assert.equal(model.getObjectByName('covered-face').visible, true, mode);
    assert.ok(surfaces(model).filter(mesh => mesh.userData.importedPartRegion).every(mesh => mesh.visible), mode);
    assert.deepEqual(f.body.scene.toJSON(), source, mode); player.dispose();
  }
});

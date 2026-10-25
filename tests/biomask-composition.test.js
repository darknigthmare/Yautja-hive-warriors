import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BIOMASK_GROUP_NAME, parseBiomaskCalibration, composeCharacterWithBiomask } from '../js/graphics/BiomaskComposition.js';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';

// Synthetic ownership/skinning fixture only, never a shipping model/calibration.
function fixture() {
  const scene = new THREE.Group(), hips = new THREE.Bone(); hips.name = 'Hips'; hips.position.y = 0.4;
  const bones = [hips];
  for (const [name, parent, position] of [
    ['Head', hips, [0, 1.2, 0]], ['LeftArm', hips, [-0.4, 0.7, 0]], ['RightArm', hips, [0.4, 0.7, 0]],
    ['LeftUpLeg', hips, [-0.2, -0.1, 0]], ['RightUpLeg', hips, [0.2, -0.1, 0]]
  ]) { const b = new THREE.Bone(); b.name = name; b.position.set(...position); parent.add(b); bones.push(b); }
  for (const [name, parent, position] of [
    ['LeftForeArm', bones[2], [-0.3, 0, 0]], ['RightForeArm', bones[3], [0.3, 0, 0]],
    ['LeftHand', null, [-0.2, 0, 0]], ['RightHand', null, [0.2, 0, 0]],
    ['LeftFoot', bones[4], [0, -0.3, 0]], ['RightFoot', bones[5], [0, -0.3, 0]]
  ]) { const b = new THREE.Bone(); b.name = name; b.position.set(...position); (parent ?? bones[name === 'LeftHand' ? 6 : 7]).add(b); bones.push(b); }
  scene.add(hips);
  const geometry = new THREE.BoxGeometry(0.7, 2, 0.4); geometry.translate(0, 1, 0);
  const indices = [], weights = [];
  for (let i = 0; i < geometry.attributes.position.count; i++) { indices.push(geometry.attributes.position.getY(i) > 1 ? 1 : 0, 0, 0, 0); weights.push(1, 0, 0, 0); }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4)); geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const texture = new THREE.DataTexture(new Uint8Array([180, 140, 110, 255]), 1, 1);
  const material = new THREE.MeshStandardMaterial({ map: texture }); material.name = 'synthetic-skin';
  const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = 'synthetic-body'; scene.add(mesh); scene.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
  const maskScene = new THREE.Group(); const maskMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.32, metalness: 0.7 }); maskMaterial.name = 'synthetic-mask';
  const maskMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.08), maskMaterial); maskMesh.name = 'synthetic-mask-mesh'; maskScene.add(maskMesh);
  const body = { scene, animations: [] }, mask = { scene: maskScene, animations: [] };
  const biomask = { calibrated: true, assetKey: 'synthetic_biomask', bone: 'Head', position: [0, 0, 0.1], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] };
  const accessories = {};
  for (const [name, socket] of Object.entries({ blade1: 'rightHand', blade2: 'rightHand', shieldMesh: 'leftHand', secWeaponMesh: 'leftHand', plasmaGlaiveMesh: 'rightHand', clanMarkMesh: 'head' })) accessories[name] = { socket, position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] };
  const entry = { status: 'verified', url: '/models/synthetic-body.glb', characterRig: { calibrated: true, height: 4.31, forwardAxis: '+z', boneMap: { head: 'Head' }, accessories, biomask } };
  const maskEntry = { status: 'verified', url: '/models/synthetic-mask.glb' }, requests = [];
  const library = { getGeneratedAssetEntry: key => key === 'jungle_hunter' ? entry : key === biomask.assetKey ? maskEntry : null,
    loadGeneratedAsset: async key => { requests.push(key); return key === 'jungle_hunter' ? body : mask; } };
  return { body, mask, mesh, maskMesh, texture, entry, library, requests, biomask };
}
const audio = new Proxy({}, { get: () => () => {} });
const player = () => new Player(new THREE.Scene(), CHARACTERS_DATA[0], audio);

const maskMeshes = root => { const meshes = []; root.traverse(node => { if (node.isMesh) meshes.push(node); }); return meshes; };

test('biomask composition requires explicit transforms and clones graph/bones without changing cached surfaces', () => {
  const f = fixture(), before = f.body.scene.toJSON(), maskBefore = f.mask.scene.toJSON();
  assert.equal(parseBiomaskCalibration(undefined), null); assert.equal(parseBiomaskCalibration({ calibrated: false }), null);
  assert.throws(() => parseBiomaskCalibration({ ...f.biomask, scale: [0, 1, 1] }), /positive/);
  assert.throws(() => parseBiomaskCalibration({ ...f.biomask, quaternion: [0, 0, 0, 0] }), /quaternion/);
  const calibration = parseBiomaskCalibration(f.biomask), composed = composeCharacterWithBiomask(f.body, f.mask, calibration, { headBoneName: 'Head' });
  const mask = composed.scene.getObjectByName(BIOMASK_GROUP_NAME);
  assert.equal(mask.parent.name, 'Head'); assert.notEqual(composed.scene.getObjectByName('Head'), f.body.scene.getObjectByName('Head'));
  assert.deepEqual(mask.position.toArray(), [0, 0, 0.1]); assert.equal(maskMeshes(mask)[0].geometry, f.maskMesh.geometry);
  assert.equal(maskMeshes(mask)[0].material, f.maskMesh.material, 'adapter owns the later material clone, not the composition helper');
  assert.deepEqual(f.body.scene.toJSON(), before); assert.deepEqual(f.mask.scene.toJSON(), maskBefore);
  assert.throws(() => composeCharacterWithBiomask(f.body, f.mask, calibration, { headBoneName: 'OtherHead' }), /mapped character head/);
});

test('optional biomask follows FPS/cloak, has private surfaces and is disposed once without touching cache', async () => {
  const f = fixture(), first = player(), second = player(); first.toggleCloak(); first.headMesh.visible = false;
  assert.equal(await first.loadGeneratedVisual(f.library), true); assert.equal(await second.loadGeneratedVisual(f.library), true);
  assert.equal(first.generatedBiomaskState, 'attached');
  const a = first._importedCharacter.biomask.root, b = second._importedCharacter.biomask.root;
  const ma = maskMeshes(a)[0], mb = maskMeshes(b)[0];
  assert.notEqual(ma.geometry, f.maskMesh.geometry); assert.notEqual(ma.material, f.maskMesh.material); assert.notEqual(ma.material, mb.material); assert.equal(ma.material.map, f.texture);
  assert.equal(ma.visible, false); assert.equal(ma.material.opacity, 0.22); assert.equal(mb.material.opacity, 1);
  first.headMesh.visible = true; first.update(0.01); assert.equal(ma.visible, true); first.toggleCloak(); assert.equal(ma.material.roughness, 0.32);
  const before = a.getWorldPosition(new THREE.Vector3()); first._importedCharacter.adapter.bones.head.rotation.x += 0.2; first.mesh.updateMatrixWorld(true);
  assert.ok(a.getWorldPosition(new THREE.Vector3()).distanceTo(before) > 1e-5, 'mask is attached below the private head bone');
  let geometryDisposals = 0, materialDisposals = 0, cacheDisposals = 0;
  ma.geometry.addEventListener('dispose', () => geometryDisposals++); ma.material.addEventListener('dispose', () => materialDisposals++);
  [f.maskMesh.geometry, f.maskMesh.material, f.texture].forEach(resource => resource.addEventListener('dispose', () => cacheDisposals++));
  first.dispose(); first.dispose(); assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1); assert.equal(cacheDisposals, 0);
  assert.equal(second.generatedBiomaskState, 'attached'); second.dispose();
});

test('unconfigured, failed or malformed optional masks preserve a valid unmasked body', async () => {
  for (const mode of ['unconfigured', 'network', 'malformed']) {
    const f = fixture(), actor = player();
    if (mode === 'unconfigured') f.entry.characterRig.biomask.calibrated = false;
    if (mode === 'network') f.library.loadGeneratedAsset = async key => { if (key !== 'jungle_hunter') throw new Error('synthetic mask unavailable'); return f.body; };
    if (mode === 'malformed') f.maskMesh.geometry.attributes.position.setX(0, NaN);
    assert.equal(await actor.loadGeneratedVisual(f.library), true); assert.equal(actor.generatedVisualState, 'imported');
    assert.equal(actor._importedCharacter.biomask, null); assert.equal(actor.generatedBiomaskState, mode === 'unconfigured' ? 'unconfigured' : 'unavailable');
    if (mode === 'unconfigured') assert.deepEqual(f.requests, ['jungle_hunter']);
    actor.dispose();
  }
});

test('a mask cannot satisfy the FPS guard when the body head has no identifiable skin faces', async () => {
  const f = fixture(), actor = player(); f.mesh.geometry.attributes.skinIndex.array.fill(0);
  assert.equal(await actor.loadGeneratedVisual(f.library), false);
  assert.equal(actor.generatedVisualState, 'procedural'); assert.match(actor.generatedVisualError, /body head cannot be hidden/); actor.dispose();
});

test('a mask request resolved after Player disposal cannot attach or dispose template resources', async () => {
  const f = fixture(), actor = player(); let complete;
  f.library.loadGeneratedAsset = key => key === 'jungle_hunter' ? Promise.resolve(f.body) : new Promise(resolve => { complete = resolve; });
  const pending = actor.loadGeneratedVisual(f.library);
  while (!complete) await Promise.resolve();
  let cacheDisposals = 0; [f.maskMesh.geometry, f.maskMesh.material, f.texture].forEach(resource => resource.addEventListener('dispose', () => cacheDisposals++));
  actor.dispose(); complete(f.mask); assert.equal(await pending, false); assert.equal(actor.scene.children.length, 0); assert.equal(cacheDisposals, 0);
});

test('calibrated eye height and laser origin follow the imported actor and restore the procedural values', async () => {
  const f = fixture(), actor = player(), originalHeight = actor.cameraEyeHeight;
  const starts = actor.laserGroup.children.map(line => [...line.geometry.attributes.position.array.slice(0, 3)]);
  Object.assign(f.entry.characterRig, { cameraEyeHeight: 3.82, laserSight: { origin: [0.4, 4, 0.38], radius: 0.025 } });
  assert.equal(await actor.loadGeneratedVisual(f.library), true); assert.equal(actor.cameraEyeHeight, 3.82);
  actor.laserGroup.children.forEach((line, i) => {
    const attribute = line.geometry.attributes.position, angle = i / 3 * Math.PI * 2;
    assert.ok(Math.abs(attribute.getX(0) - (0.4 + Math.cos(angle) * 0.025)) < 1e-6);
    assert.ok(Math.abs(attribute.getY(0) - (4 + Math.sin(angle) * 0.025)) < 1e-6);
  });
  actor.updateLaserLock(null); actor._removeImportedCharacter();
  assert.equal(actor.cameraEyeHeight, originalHeight);
  actor.laserGroup.children.forEach((line, i) => assert.deepEqual([...line.geometry.attributes.position.array.slice(0, 3)], starts[i]));
  actor.dispose();
});

test('opaque filter components are cloned with the mask and participate in FPS, cloak and disposal', async () => {
  const f = fixture(), actor = player(), before = f.mask.scene.toJSON();
  f.entry.characterRig.biomask.eyeFilters = { calibrated: true, coordinateSpace: 'gltf-scene', filters: [-1, 1].map(side => ({
    name: side < 0 ? 'left' : 'right', vertices: [[side * 0.08 - 0.03, 0, 0.03], [side * 0.08 + 0.03, 0, 0.03], [side * 0.08, 0.05, 0.03]], indices: [0, 1, 2]
  })) };
  assert.equal(await actor.loadGeneratedVisual(f.library), true);
  const filters = maskMeshes(actor._importedCharacter.biomask.root).filter(mesh => mesh.userData.biomaskEyeFilter);
  assert.equal(filters.length, 2); assert.deepEqual(f.mask.scene.toJSON(), before);
  for (const mesh of filters) { assert.equal(mesh.material.transparent, false); assert.equal(mesh.material.opacity, 1); }
  actor.headMesh.visible = false; actor.update(0); assert.ok(filters.every(mesh => !mesh.visible));
  actor.headMesh.visible = true; actor.toggleCloak(); assert.ok(filters.every(mesh => mesh.material.opacity === 0.22));
  actor.update(0); assert.ok(filters.every(mesh => mesh.visible && mesh.material.opacity >= 0.12 && mesh.material.opacity <= 0.28));
  actor.toggleCloak(); assert.ok(filters.every(mesh => mesh.material.opacity === 1 && !mesh.material.transparent));
  let disposed = 0, sharedDisposed = 0;
  filters[0].material.map.addEventListener('dispose', () => sharedDisposed++);
  filters.forEach(mesh => { mesh.geometry.addEventListener('dispose', () => disposed++); mesh.material.addEventListener('dispose', () => disposed++); });
  actor.dispose(); actor.dispose(); assert.equal(disposed, 4); assert.equal(sharedDisposed, 0);
});

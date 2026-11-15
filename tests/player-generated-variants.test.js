import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';

// These tiny meshes and identity calibrations test ownership and variant routing.
// They are synthetic fixtures, never shipping assets or film-reference evidence.
function variantFixture(key, { mechanisms = false, baked = false } = {}) {
  const scene = new THREE.Group(), boneMap = {}, bones = [], byRole = {};
  const addBone = (role, parent, position) => {
    const bone = new THREE.Bone(); bone.name = `${key}_fixture_${role}`;
    bone.position.set(...position); parent.add(bone); bones.push(bone);
    boneMap[role] = bone.name; byRole[role] = bone; return bone;
  };
  const hips = addBone('hips', scene, [0, 0.4, 0]);
  addBone('head', hips, [0, 1.2, 0]);
  const leftArm = addBone('leftArm', hips, [-0.4, 0.7, 0]);
  const rightArm = addBone('rightArm', hips, [0.4, 0.7, 0]);
  const leftLeg = addBone('leftLeg', hips, [-0.2, -0.1, 0]);
  const rightLeg = addBone('rightLeg', hips, [0.2, -0.1, 0]);
  const leftForeArm = addBone('leftForeArm', leftArm, [-0.3, 0, 0]);
  const rightForeArm = addBone('rightForeArm', rightArm, [0.3, 0, 0]);
  addBone('leftHand', leftForeArm, [-0.2, 0, 0]);
  addBone('rightHand', rightForeArm, [0.2, 0, 0]);
  addBone('leftFoot', leftLeg, [0, -0.3, 0]);
  addBone('rightFoot', rightLeg, [0, -0.3, 0]);
  const geometry = new THREE.BoxGeometry(0.7, 2, 0.4); geometry.translate(0, 1, 0);
  const indices = [], weights = [];
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    indices.push(geometry.attributes.position.getY(i) > 1 ? 1 : 0, 0, 0, 0);
    weights.push(1, 0, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const material = new THREE.MeshStandardMaterial({ color: key === 'city_hunter' ? 0xbb7744 : 0x779955 });
  material.name = `${key}-fixture-skin`;
  const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = `${key}-fixture-body`;
  scene.add(mesh); scene.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
  const maskScene = new THREE.Group();
  maskScene.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.08), new THREE.MeshStandardMaterial()));
  const maskKey = `${key}_fixture_biomask`;
  const accessories = {};
  for (const [name, socket] of Object.entries({ blade1: 'rightHand', blade2: 'rightHand', shieldMesh: 'leftHand',
    secWeaponMesh: key === 'city_hunter' ? 'rightHand' : 'leftHand', plasmaGlaiveMesh: 'rightHand', clanMarkMesh: 'head' })) {
    accessories[name] = { socket, position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] };
  }
  const rig = { calibrated: true, height: key === 'city_hunter' ? 4.1 : 4.31, forwardAxis: '+z', boneMap, accessories,
    cameraEyeHeight: key === 'city_hunter' ? 3.7 : 3.9,
    laserSight: { origin: key === 'city_hunter' ? [0.25, 3.72, 0.3] : [-0.2, 3.95, 0.2], radius: 0.025 },
    biomask: { calibrated: true, assetKey: maskKey, bone: boneMap.head,
      position: [0, 0, 0.1], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] } };
  if (mechanisms) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.25, 0.02), material);
    blade.name = `${key}-fixture-native-blade`; blade.position.z = 0.35; byRole.rightHand.add(blade);
    const lid = new THREE.Group(); lid.name = `${key}-fixture-lid`; byRole.leftForeArm.add(lid);
    lid.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.01, 0.15), material));
    rig.articulation = { version: 1,
      wristblades: [{ id: `${key}-blade`, nodes: [blade.name], axis: [0, 0, 1], travel: 0.2, restState: 'extended' }],
      gauntlets: [{ id: `${key}-console`, node: lid.name, axis: [1, 0, 0], angle: 1.1, restState: 'closed' }] };
  }
  if (baked) {
    for (let i = 0; i < 2; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.25, 0.02), material);
      blade.name = `${key}-fixture-baked-blade${i}`; blade.position.set(i * 0.03, 0, 0.35); byRole.rightHand.add(blade);
    }
    rig.bakedWristblades = { calibrated: true, mode: 'static' };
  }
  return { key, rig, body: { scene, animations: [] }, mask: { scene: maskScene, animations: [] }, maskKey,
    entry: { status: 'verified', url: `/models/SYNTHETIC_${key}.glb`, characterRig: rig },
    maskEntry: { status: 'verified', url: `/models/SYNTHETIC_${maskKey}.glb` } };
}

function fixtureLibrary(...fixtures) {
  const entries = new Map(), assets = new Map(), requests = [];
  for (const f of fixtures) {
    entries.set(f.key, f.entry); entries.set(f.maskKey, f.maskEntry);
    assets.set(f.key, f.body); assets.set(f.maskKey, f.mask);
  }
  return { entries, assets, requests, getGeneratedAssetEntry: key => entries.get(key) ?? null,
    loadGeneratedAsset: async key => { requests.push(key); assert.ok(assets.has(key), `unexpected asset ${key}`); return assets.get(key); } };
}
const audio = new Proxy({}, { get: () => () => {} });
// Fixture tests must not start production-cache requests from the constructor.
class FixturePlayer extends Player {
  loadGeneratedVisual(library = { getGeneratedAssetEntry: () => null, loadGeneratedAsset: () => { throw new Error('unexpected fixture fetch'); } }) {
    return super.loadGeneratedVisual(library);
  }
}
async function actor(key, scene = new THREE.Scene(), second = false) {
  const data = CHARACTERS_DATA.find(value => value.id === key); assert.ok(data, key);
  const player = new FixturePlayer(scene, data, audio, second);
  await player.generatedVisualReady;
  return player;
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('two Yautja variants load their own body, biomask, bone names and accessory calibration', async () => {
  const jungle = variantFixture('jungle_hunter'), city = variantFixture('city_hunter');
  const library = fixtureLibrary(jungle, city), scene = new THREE.Scene();
  const first = await actor(jungle.key, scene), second = await actor(city.key, scene, true);
  const cachedBody = city.body.scene.toJSON(), cachedMask = city.mask.scene.toJSON();
  second.selectWeapon('katana', false); second.toggleCloak(); second.headMesh.visible = false;
  assert.deepEqual(await Promise.all([first.loadGeneratedVisual(library), second.loadGeneratedVisual(library)]), [true, true]);
  assert.deepEqual([...library.requests].sort(), [jungle.key, jungle.maskKey, city.key, city.maskKey].sort());
  for (const [player, fixture] of [[first, jungle], [second, city]]) {
    const imported = player._importedCharacter;
    assert.equal(player.mesh.userData.generatedAsset.key, fixture.key);
    assert.equal(player.mesh.userData.generatedAsset.biomask.key, fixture.maskKey);
    assert.equal(imported.biomask.root.parent.name, fixture.rig.boneMap.head);
    assert.equal(imported.adapter.bones.head.name, fixture.rig.boneMap.head);
    assert.equal(player.secWeaponMesh.parent, imported.adapter.sockets[fixture.rig.accessories.secWeaponMesh.socket]);
    assert.equal(player.cameraEyeHeight, fixture.rig.cameraEyeHeight);
    const starts = player.laserGroup.children.map(line => line.geometry.attributes.position);
    close(starts[0].getX(0), fixture.rig.laserSight.origin[0] + fixture.rig.laserSight.radius);
    close(starts[0].getY(0), fixture.rig.laserSight.origin[1]);
  }
  assert.notEqual(first._importedCharacter.adapter.bones.head, second._importedCharacter.adapter.bones.head);
  assert.ok(second._importedCharacter.adapter.headMeshes.every(mesh => !mesh.visible));
  assert.ok(first._importedCharacter.adapter.headMeshes.every(mesh => mesh.visible));
  assert.ok(second._importedCharacter.adapter.materials.every(material => material.opacity === 0.22));
  assert.ok(first._importedCharacter.adapter.materials.every(material => material.opacity === 1));
  assert.equal(second.blade1.visible, false); assert.equal(first.blade1.visible, true);
  second.headMesh.visible = true; second.update(1 / 60); second.toggleCloak();
  assert.ok(second._importedCharacter.adapter.headMeshes.every(mesh => mesh.visible));
  assert.deepEqual(city.body.scene.toJSON(), cachedBody); assert.deepEqual(city.mask.scene.toJSON(), cachedMask);
  first.dispose(); assert.equal(second.generatedVisualState, 'imported'); second.dispose();
});

test('an absent variant and non-verified or uncalibrated entries keep the procedural model without body requests', async () => {
  const jungle = variantFixture('jungle_hunter'), city = variantFixture('city_hunter');
  const library = fixtureLibrary(jungle), player = await actor('city_hunter');
  const original = player.mesh, originalHead = player.headMesh;
  assert.equal(await player.loadGeneratedVisual(library), false);
  assert.deepEqual(library.requests, [], 'must not borrow the Jungle Hunter entry for an absent City Hunter');
  library.entries.set(city.key, city.entry); library.assets.set(city.key, city.body);
  for (const status of ['draft', 'pending', 'failed']) {
    city.entry.status = status;
    assert.equal(await player.loadGeneratedVisual(library), false);
  }
  city.entry.status = 'verified'; city.rig.calibrated = false;
  assert.equal(await player.loadGeneratedVisual(library), false);
  city.rig.calibrated = true; delete city.rig.accessories.blade1;
  assert.equal(await player.loadGeneratedVisual(library), false);
  assert.deepEqual(library.requests, []); assert.equal(player.mesh, original); assert.equal(player.headMesh, originalHead);
  assert.equal(player.generatedVisualState, 'procedural');
  assert.equal(player.setWristbladeExtension('absent', 1), false);
  assert.equal(player.setGauntletOpen('absent', 1), false);
  player.dispose();
  const wolf = await actor('wolf_predator'); assert.equal(await wolf.loadGeneratedVisual(fixtureLibrary(jungle, city)), false); wolf.dispose();
});

test('a failed City Hunter load preserves gameplay objects and never falls back to another imported character', async () => {
  const city = variantFixture('city_hunter'), library = fixtureLibrary(city), player = await actor(city.key);
  const mesh = player.mesh, blade = player.blade1, parent = blade.parent, head = player.headMesh;
  library.loadGeneratedAsset = async key => { library.requests.push(key); throw new Error('fixture City body unavailable'); };
  assert.equal(await player.loadGeneratedVisual(library), false);
  assert.deepEqual(library.requests, ['city_hunter']); assert.equal(player.generatedVisualState, 'procedural');
  assert.match(player.generatedVisualError, /City body unavailable/);
  assert.equal(player.mesh, mesh); assert.equal(player.headMesh, head); assert.equal(player.blade1, blade); assert.equal(blade.parent, parent);
  assert.equal(blade.visible, true); assert.equal(player._importedCharacter, undefined); player.dispose();
});

test('a hunter requiring measured preparation keeps its playable fallback when calibration fails', async () => {
  const city = variantFixture('city_hunter'), library = fixtureLibrary(city), player = await actor(city.key);
  city.rig.requirePreparation = true;
  city.rig.partRegions = { version: 1, targetSha256: '0'.repeat(64), meshes: [] };
  const cached = city.body.scene.toJSON(), mesh = player.mesh, blade = player.blade1, parent = blade.parent;
  assert.equal(await player.loadGeneratedVisual(library), false);
  assert.match(player.generatedVisualError, /preparation failed/);
  assert.equal(player.generatedVisualState, 'procedural');
  assert.equal(player.mesh, mesh); assert.equal(player.blade1, blade); assert.equal(blade.parent, parent);
  assert.equal(blade.visible, true); assert.deepEqual(library.requests, [city.key]);
  assert.deepEqual(city.body.scene.toJSON(), cached);
  player.dispose();
});

test('a City Hunter mask referring to its own body is rejected without losing the valid unmasked City body', async () => {
  const city = variantFixture('city_hunter'), library = fixtureLibrary(city), player = await actor(city.key);
  city.rig.biomask.assetKey = city.key;
  assert.equal(await player.loadGeneratedVisual(library), true);
  assert.deepEqual(library.requests, [city.key]); assert.equal(player.generatedBiomaskState, 'unavailable');
  assert.match(player.generatedBiomaskError, /own asset key/);
  assert.equal(player.mesh.userData.generatedAsset.key, city.key); assert.equal(player._importedCharacter.biomask, null);
  player.dispose();
});

test('calibrated native blades follow weapon swaps per actor and explicit gauntlet commands, with no procedural duplicates', async () => {
  const city = variantFixture('city_hunter', { mechanisms: true }), library = fixtureLibrary(city);
  const first = await actor(city.key), second = await actor(city.key);
  first.selectWeapon('katana', false);
  assert.equal(await first.loadGeneratedVisual(library), true); assert.equal(await second.loadGeneratedVisual(library), true);
  const a = first._importedCharacter.adapter, b = second._importedCharacter.adapter;
  const bladeA = a.model.getObjectByName('city_hunter-fixture-native-blade');
  const bladeB = b.model.getObjectByName('city_hunter-fixture-native-blade');
  const sourceBlade = city.body.scene.getObjectByName('city_hunter-fixture-native-blade');
  const authored = sourceBlade.position.clone();
  assert.equal(a.articulation.getState().wristblades[0].target, 0);
  assert.equal(b.articulation.getState().wristblades[0].target, 1);
  assert.equal(first.blade1.visible, false); assert.equal(second.blade1.visible, false); assert.equal(second.blade2.visible, false);
  assert.equal(first.setGauntletOpen('city_hunter-console', 1), true);
  for (let i = 0; i < 40; i++) { first.update(1 / 60); second.update(1 / 60); }
  close(bladeA.position.z, authored.z - 0.2); close(bladeB.position.z, authored.z);
  close(a.articulation.getState().gauntlets[0].amount, 1); close(b.articulation.getState().gauntlets[0].amount, 0);
  second.selectWeapon('smart_disc', false); first.selectWeapon('wristblades', false);
  for (let i = 0; i < 40; i++) { first.update(1 / 60); second.update(1 / 60); }
  close(bladeA.position.z, authored.z); close(bladeB.position.z, authored.z - 0.2);
  assert.equal(first.blade1.visible, false, 'the extended native blade already supplies the weapon');
  assert.equal(first.setWristbladeExtension('city_hunter-blade', 0.5), true);
  for (let i = 0; i < 40; i++) first.update(1 / 60);
  close(bladeA.position.z, authored.z - 0.1);
  assert.deepEqual(sourceBlade.position.toArray(), authored.toArray(), 'cache template must remain untouched');
  first._removeImportedCharacter(); assert.equal(first.blade1.visible, true); assert.equal(first.blade2.visible, true);
  assert.equal(first.setGauntletOpen('city_hunter-console', 0), false);
  second._removeImportedCharacter(); assert.equal(second.blade1.visible, false, 'fallback still respects the selected secondary weapon');
  first.dispose(); second.dispose();
});

test('a calibrated static baked-blade marker suppresses City duplicates without inventing retraction or changing Jungle Hunter', async () => {
  const city = variantFixture('city_hunter', { baked: true }), jungle = variantFixture('jungle_hunter');
  const library = fixtureLibrary(city, jungle);
  const player = await actor(city.key);
  const original = await actor(jungle.key);
  assert.equal(await player.loadGeneratedVisual(library), true); assert.equal(await original.loadGeneratedVisual(library), true);
  assert.equal(player._importedCharacter.bakedWristblades, true); assert.equal(original._importedCharacter.bakedWristblades, false);
  assert.equal(player.blade1.visible, false); assert.equal(player.blade2.visible, false); assert.equal(original.blade1.visible, true);
  assert.equal(player._importedCharacter.adapter.articulation, null, 'a static declaration must not create actuators');
  const baked = player._importedCharacter.adapter.model.getObjectByName('city_hunter-fixture-baked-blade0');
  const rest = baked.position.clone(); assert.equal(player.setWristbladeExtension('fictional-motor', 0), false);
  player.selectWeapon('katana', false); player.update(1 / 60);
  assert.deepEqual(baked.position.toArray(), rest.toArray()); assert.equal(baked.visible, true);
  player.selectWeapon('wristblades', false); assert.equal(player.blade1.visible, false); assert.equal(player.blade2.visible, false);
  player._removeImportedCharacter(); assert.equal(player.blade1.visible, true); assert.equal(player.blade2.visible, true);
  assert.equal(original.blade1.visible, true); player.dispose(); original.dispose();
});

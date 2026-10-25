import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Player } from '../js/entities/Player.js';
import { getHunterGadgetEffects } from '../js/graphics/HunterGadgetEffects.js';
import { createImportedCharacter } from '../js/graphics/ImportedCharacter.js';
import { installCityHunterMechanisms } from '../js/graphics/CityHunterMechanisms.js';
import { CITY_HUNTER_RIG } from '../js/graphics/CityHunterRig.js';
import { CITY_HUNTER_CONSOLE } from '../js/graphics/CityHunterMechanismsCalibration.js';
import { GENERATED_ASSETS } from '../js/graphics/GeneratedAssetManifest.js';
import { HunterLocomotion } from '../js/graphics/HunterLocomotion.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';

const audio = new Proxy({}, { get: () => () => {} });
function ownerFixture() {
  const owner = { mesh: new THREE.Group(), _proceduralMotionRoot: new THREE.Group(), _disposed: false, isCloaked: false,
    audioEngine: audio, brandClanMark() {}, wristNukeHoloMesh: null };
  for (const role of ['hips', 'head', 'neck', 'leftArm', 'rightArm', 'leftForeArm', 'rightForeArm', 'leftHand', 'rightHand', 'leftLeg', 'rightLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot']) owner[role === 'head' ? 'headMesh' : role] = new THREE.Group();
  owner.leftArm.position.set(-0.66, 3.43, 0); owner.rightArm.position.set(0.66, 3.43, 0);
  owner.mesh.add(owner._proceduralMotionRoot); owner._proceduralMotionRoot.add(owner.leftArm, owner.rightArm);
  owner.mesh.updateMatrixWorld(true); return owner;
}
const templates = new Map();
async function loadTemplate(key) {
  if (!templates.has(key)) templates.set(key, (async () => {
    const entry = GENERATED_ASSETS[key], bytes = await readFile(new URL('../public' + entry.url, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    return new GLTFLoader().register(() => ({ name: 'QA_CPU_TEXTURE_STUB', loadTexture: async () => new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1) }))
      .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  })());
  return templates.get(key);
}
function sourceDigest(gltf) {
  const hash = createHash('sha256'), seen = new Set();
  gltf.scene.traverse(node => {
    if (!node.isMesh || seen.has(node.geometry)) return;
    seen.add(node.geometry);
    for (const attribute of [...Object.values(node.geometry.attributes), node.geometry.index].filter(Boolean)) hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
  });
  return hash.digest('hex');
}
async function attachImported(owner, key) {
  const entry = GENERATED_ASSETS[key], template = await loadTemplate(key), rig = key === 'city_hunter' ? CITY_HUNTER_RIG : entry.characterRig;
  const adapter = createImportedCharacter(owner, template, { ...rig, sourceSha256: entry.sha256, footGrounding: undefined, requireHeadPartition: true, animateWhenUncontrolled: false });
  owner.mesh.add(adapter.root); adapter.update(0, false);
  const mechanisms = key === 'city_hunter' ? installCityHunterMechanisms(adapter, { sourceSha256: entry.sha256 }) : null;
  owner._importedCharacter = { adapter, mechanisms };
  owner._gadgetEffects?.rebind(); return { adapter, mechanisms, template };
}
function advance(owner, delta) {
  owner._gadgetEffects?.update(delta);
  owner._importedCharacter?.adapter.update(delta, false);
  owner._importedCharacter?.mechanisms?.update(delta);
  owner._gadgetEffects?.rebind();
}
function cleanup(owner) { owner._gadgetEffects?.dispose(); owner._importedCharacter?.mechanisms?.dispose(); owner._importedCharacter?.adapter.dispose(); }
function resources(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set(); let meshes = 0, triangles = 0;
  root.traverse(node => {
    if (!node.isMesh) return;
    meshes++; geometries.add(node.geometry); triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) { materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); }
  });
  return { geometries, materials, textures, meshes, triangles };
}
function watchDisposal(resourceSet) { const counts = new Map([...resourceSet].map(value => [value, 0])); for (const value of resourceSet) value.addEventListener('dispose', () => counts.set(value, counts.get(value) + 1)); return counts; }
const everyOnce = counts => [...counts.values()].every(count => count === 1);

test('countdown uses six simulation seconds, real remaining signs, bounded geometry and one private disposal', t => {
  const owner = ownerFixture(), controller = getHunterGadgetEffects(owner);
  assert.deepEqual(Player.prototype.triggerNukeSelfDestruct.call(owner), { damage: 10000, radius: 60 }, 'visual work preserves the existing action contract');
  const root = owner.wristNukeHoloMesh, owned = resources(root);
  assert.equal(root.parent, owner._proceduralMotionRoot); assert.equal(root.userData.playerTransientEffect, true);
  assert.ok(owned.meshes <= 4 && owned.triangles < 1000); assert.equal(root.userData.displaySeconds, 6);
  const geometries = watchDisposal(owned.geometries), materials = watchDisposal(owned.materials), textures = watchDisposal(owned.textures);
  t.mock.method(Date, 'now', () => { throw new Error('No wall-clock animation'); });
  controller.update(1); assert.equal(root.userData.displaySeconds, 5); assert.equal(root.userData.remainingSeconds, 5);
  const frozen = controller.getState(), matrix = root.matrix.toArray();
  for (const delta of [0, -1, NaN, Infinity]) assert.equal(controller.update(delta), false);
  assert.equal(controller.update(1, { paused: true }), false);
  assert.deepEqual(controller.getState(), frozen); assert.deepEqual(root.matrix.toArray(), matrix);
  controller.update(4.999); assert.equal(root.userData.displaySeconds, 1); assert.ok(owner.wristNukeHoloMesh);
  controller.update(0.001); assert.equal(owner.wristNukeHoloMesh, null); assert.equal(root.parent, null);
  assert.equal(controller.getState().countdown, null);
  Player.prototype.clearNukeHoloMesh.call(owner); controller.dispose(); controller.dispose();
  assert.ok(everyOnce(geometries) && everyOnce(materials) && everyOnce(textures));
});

test('countdown state and display agree at30/60/120fps while restarting releases only the superseded effect', () => {
  const results = [];
  for (const fps of [30, 60, 120]) {
    const owner = ownerFixture(), controller = getHunterGadgetEffects(owner); controller.startCountdown();
    const old = owner.wristNukeHoloMesh, disposal = watchDisposal(resources(old).geometries);
    controller.startCountdown(); assert.ok(everyOnce(disposal)); assert.equal(old.parent, null);
    for (let frame = 0; frame < fps * 3; frame++) controller.update(1 / fps);
    results.push(controller.getState().countdown); cleanup(owner);
  }
  for (const state of results) { assert.equal(state.displaySeconds, 3); assert.ok(Math.abs(state.remainingSeconds - 3) < 1e-10); }
});

test('actual City hologram tracks the measured console through arm poses, actor transforms and metamorphosis scale without source changes', async () => {
  const owner = ownerFixture(), actual = await attachImported(owner, 'city_hunter'), controller = getHunterGadgetEffects(owner);
  const digest = sourceDigest(actual.template), borrowed = actual.mechanisms.lid.material;
  const sourceDispose = watchDisposal(new Set([borrowed])); controller.startCountdown();
  const external = new THREE.Group(); external.position.set(2, 0, -7); external.rotation.y = -0.4; external.scale.setScalar(1.2); external.add(owner.mesh);
  owner.mesh.position.set(3, 0, 4); owner.mesh.rotation.y = 0.7;
  for (const scale of [1, 1.8]) for (const [arm, forearm] of [[0, 0], [0.5, 0.4], [-0.5, -0.55]]) {
    owner.mesh.scale.setScalar(scale); owner.leftArm.rotation.x = arm; owner.leftForeArm.rotation.z = forearm; advance(owner, 0.01);
    const board = actual.mechanisms.consoleRoot, c = CITY_HUNTER_CONSOLE;
    const native = new THREE.Vector3(...c.center).addScaledVector(new THREE.Vector3(...c.u), c.interior.u).addScaledVector(new THREE.Vector3(...c.v), c.interior.v).addScaledVector(new THREE.Vector3(...c.n), c.interior.n - 0.0042);
    const outward = new THREE.Vector3(...c.n).negate().transformDirection(board.matrixWorld);
    const expected = native.applyMatrix4(board.matrixWorld).addScaledVector(outward, 0.12 * scale * 1.2);
    const rendered = owner.wristNukeHoloMesh.getWorldPosition(new THREE.Vector3());
    assert.ok(rendered.distanceTo(expected) < 1e-6, `actual measured board alignment at scale${scale}, arm${arm}`);
    assert.equal(owner.wristNukeHoloMesh.parent, actual.adapter.root);
    assert.equal(controller.getState().countdown.anchor, 'measured-city-console');
  }
  cleanup(owner); assert.equal(sourceDigest(actual.template), digest);
  assert.equal(sourceDispose.get(borrowed), 1, 'only adapter cleanup releases the borrowed body material');
});

test('late imported bodies rebind active effects before anatomy hiding and keep remaining time rather than restarting', async () => {
  const owner = ownerFixture(), controller = getHunterGadgetEffects(owner); controller.startCountdown(); controller.startTrophy(); controller.update(1.25);
  const countdown = owner.wristNukeHoloMesh, trophy = owner.mesh.getObjectByName('hunter-spine-trophy-effect');
  const actual = await attachImported(owner, 'city_hunter');
  assert.equal(countdown.parent, actual.adapter.root); assert.equal(trophy.parent, actual.adapter.root);
  assert.ok(Math.abs(actual.mechanisms.getState().holdRemaining - 4.75) < 1e-10);
  assert.equal(controller.getState().countdown.remainingSeconds, 4.75);
  // This is the actual loader's ancestor guard: imported descendants are kept.
  owner.mesh.traverse(node => {
    if (!node.isMesh) return;
    let ancestor = node; while (ancestor && ancestor !== actual.adapter.root) ancestor = ancestor.parent;
    if (!ancestor) node.visible = false;
  });
  assert.ok([...resources(countdown).geometries].length > 0); countdown.traverse(node => { if (node.isMesh) assert.equal(node.visible, true); });
  actual.mechanisms.dispose(); actual.adapter.dispose(); owner._importedCharacter = null; controller.rebind();
  assert.equal(countdown.parent, owner._proceduralMotionRoot); assert.equal(trophy.parent, owner._proceduralMotionRoot);
  assert.equal(controller.getState().countdown.remainingSeconds, 4.75); cleanup(owner);
});

test('Jungle countdown follows its real mapped forearm and generic coincident joints retain a finite fallback frame', async () => {
  const owner = ownerFixture(), actual = await attachImported(owner, 'jungle_hunter'), controller = getHunterGadgetEffects(owner);
  controller.startCountdown();
  for (const scale of [1, 1.8]) for (const angle of [-0.45, 0.2, 0.6]) {
    owner.mesh.scale.setScalar(scale); owner.leftArm.rotation.x = angle; advance(owner, 0.02);
    const elbow = actual.adapter.bones.leftForeArm.getWorldPosition(new THREE.Vector3()), wrist = actual.adapter.bones.leftHand.getWorldPosition(new THREE.Vector3());
    const anatomical = elbow.lerp(wrist, 0.76), rendered = owner.wristNukeHoloMesh.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(rendered.distanceTo(anatomical) - 0.16 * scale) < 1e-6);
    assert.equal(controller.getState().countdown.anchor, 'mapped-left-forearm');
  }
  cleanup(owner);
  const fallback = ownerFixture(), forearm = new THREE.Bone(), hand = new THREE.Bone(), root = new THREE.Group();
  root.add(forearm); forearm.add(hand); fallback.mesh.add(root); fallback._importedCharacter = { adapter: { root, bones: { leftForeArm: forearm, leftHand: hand } } };
  const effect = getHunterGadgetEffects(fallback); effect.startCountdown(); effect.rebind();
  assert.ok(fallback.wristNukeHoloMesh.matrixWorld.elements.every(Number.isFinite)); effect.dispose();
});

test('victim families produce distinct human, elongated xenomorph, royal and offspring skull silhouettes with private resources', () => {
  const dimensions = {};
  for (const [kind, family] of [['colonial_marine', 'human'], ['crusher', 'warrior'], ['predalien_queen', 'queen'], ['the_offspring', 'engineer']]) {
    const owner = ownerFixture(), controller = getHunterGadgetEffects(owner);
    assert.equal(Player.prototype.executeSpineRip.call(owner, kind), true);
    const effect = owner.mesh.getObjectByName('hunter-spine-trophy-effect'), skull = effect.getObjectByName('execution-anatomical-skull');
    assert.equal(controller.getState().trophy.family, family); assert.equal(effect.userData.victimKind, kind);
    skull.updateMatrixWorld(true); const local = new THREE.Box3();
    skull.traverse(node => { if (node.isMesh) { node.geometry.computeBoundingBox(); local.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld)); } });
    dimensions[family] = local.getSize(new THREE.Vector3());
    const owned = resources(effect), geometries = watchDisposal(owned.geometries), materials = watchDisposal(owned.materials);
    assert.ok(owned.meshes <= 6 && owned.triangles < 60000);
    effect.traverse(node => { if (node.isMesh) for (const attribute of ['position', 'normal', 'uv']) assert.ok(node.geometry.attributes[attribute].array.every(Number.isFinite)); });
    controller.dispose(); assert.ok(everyOnce(geometries) && everyOnce(materials));
  }
  assert.ok(dimensions.warrior.z > dimensions.human.z * 2, 'xenomorph head has a genuinely elongated skull');
  assert.ok(dimensions.queen.x > dimensions.warrior.x * 2, 'royal head retains its wide crown');
  assert.ok(dimensions.engineer.y > dimensions.human.y * 1.05, 'offspring/engineer family has a taller cranium');
});

test('anatomical trophy is bound to the actual City and Jungle right-hand sockets and source resources remain unchanged', async () => {
  for (const key of ['city_hunter', 'jungle_hunter']) {
    const owner = ownerFixture(), actual = await attachImported(owner, key), digest = sourceDigest(actual.template), controller = getHunterGadgetEffects(owner);
    assert.equal(Player.prototype.executeSpineRip.call(owner), true);
    const trophy = owner.mesh.getObjectByName('hunter-spine-trophy-effect'), owned = resources(trophy);
    assert.ok(trophy.getObjectByName('execution-anatomical-skull')); assert.ok(trophy.getObjectByName('execution-trophy-vertebrae'));
    assert.ok(owned.triangles > 5000 && owned.triangles < 50000 && owned.meshes <= 5, `${owned.triangles} triangles in${owned.meshes} meshes`);
    const geometries = watchDisposal(owned.geometries), materials = watchDisposal(owned.materials), textures = watchDisposal(owned.textures);
    for (const scale of [1, 1.8]) for (const angle of [-0.8, 0.3, 1]) {
      owner.mesh.scale.setScalar(scale); owner.rightArm.rotation.x = angle; advance(owner, 0.05);
      const expected = actual.adapter.sockets.rightHand.getWorldPosition(new THREE.Vector3()), position = trophy.getWorldPosition(new THREE.Vector3());
      assert.ok(position.distanceTo(expected) < 1e-6); assert.equal(controller.getState().trophy.anchor, 'imported-right-hand');
    }
    controller.update(3.5); assert.equal(trophy.parent, null); assert.equal(controller.getState().trophy, null);
    assert.ok(everyOnce(geometries) && everyOnce(materials)); assert.ok([...textures.values()].every(count => count === 0), 'shared PBR source maps remain cached');
    cleanup(owner); assert.equal(sourceDigest(actual.template), digest);
  }
});

test('trophy disposal restores only its own pose, and two players, cloaking, replacement and disposal remain independent', () => {
  const a = ownerFixture(), b = ownerFixture(), ca = getHunterGadgetEffects(a), cb = getHunterGadgetEffects(b);
  a.rightArm.rotation.set(0.13, 0.22, -0.1); const original = a.rightArm.quaternion.clone();
  ca.startTrophy(); cb.startTrophy(); const secondPose = b.rightArm.quaternion.clone();
  const first = a.mesh.getObjectByName('hunter-spine-trophy-effect'), firstDisposal = watchDisposal(resources(first).geometries);
  ca.startTrophy(); assert.ok(everyOnce(firstDisposal));
  a.isCloaked = true; ca.startCountdown(); ca.update(0.5);
  assert.ok([...resources(a.mesh.getObjectByName('hunter-spine-trophy-effect')).materials].every(material => material.opacity === 0.22 && !material.depthWrite));
  assert.ok(closeEnough(b.rightArm.quaternion, secondPose)); assert.equal(cb.getState().trophy.elapsed, 0);
  ca.stopTrophy(); assert.ok(closeEnough(a.rightArm.quaternion, original));
  ca.startTrophy(); a.rightArm.rotation.set(-0.25, 0.7, 0); const combatPose = a.rightArm.quaternion.clone(); ca.update(4);
  assert.ok(closeEnough(a.rightArm.quaternion, combatPose), 'cleanup never erases an intervening authored attack pose');
  a._disposed = true; ca.dispose(); ca.dispose(); assert.equal(a.wristNukeHoloMesh, null); assert.equal(ca.getState().disposed, true);
  assert.ok(b.mesh.getObjectByName('hunter-spine-trophy-effect')); assert.equal(cb.getState().disposed, false); cleanup(b);
});

test('an execution started mid-stride returns ownership to the real locomotion controller instead of freezing an old arm swing', () => {
  const owner = ownerFixture(); owner.position = owner.mesh.position; owner.moveSpeed = 18;
  owner.locomotion = new HunterLocomotion(owner);
  const gait = owner.locomotion.arms.find(arm => arm.node === owner.rightArm);
  owner.position.x += 0.25; owner.locomotion.update(1 / 60);
  assert.ok(gait.applied && !closeEnough(owner.rightArm.quaternion, gait.rest));
  const controller = getHunterGadgetEffects(owner); controller.startTrophy({ kind: 'warrior' });
  owner.position.x += 0.25; owner.locomotion.update(1 / 60);
  assert.equal(gait.applied, null, 'the authored execution temporarily owns this arm');
  controller.update(3.5); assert.ok(closeEnough(owner.rightArm.quaternion, gait.rest));
  owner.position.x += 0.25; owner.locomotion.update(1 / 60);
  assert.ok(gait.applied && !closeEnough(owner.rightArm.quaternion, gait.rest), 'walking resumes its arm swing after the trophy is released');
  cleanup(owner); owner.locomotion.dispose();
});

test('trophy camouflage recompiles private material programs only when transparency actually changes', () => {
  const owner = ownerFixture(), controller = getHunterGadgetEffects(owner); controller.startTrophy({ kind: 'warrior' });
  const owned = resources(owner.mesh.getObjectByName('hunter-spine-trophy-effect'));
  const originalVersions = new Map([...owned.materials].map(material => [material, material.version]));
  const check = (increments, transparent) => {
    for (const material of owned.materials) {
      assert.equal(material.version, originalVersions.get(material) + increments);
      assert.equal(material.transparent, transparent); assert.equal(material.depthWrite, !transparent);
      assert.equal(material.opacity, transparent ? 0.22 : 1);
    }
  };
  check(0, false); owner.isCloaked = true; controller.update(0.05); check(1, true);
  for (let frame = 0; frame < 12; frame++) { controller.update(0.05); controller.rebind(); }
  check(1, true);
  owner.isCloaked = false; controller.update(0.05); check(2, false);
  controller.rebind(); controller.update(0.05); check(2, false);
  owner.isCloaked = true; controller.update(0.05); check(3, true);
  cleanup(owner);
});

test('a real defeated player advances existing visual countdown and trophy only, without reviving gameplay or creating a ghost decoy', async () => {
  const audioCalls = [], trackedAudio = new Proxy({}, { get: (_target, name) => () => audioCalls.push(name) });
  const player = new Player(new THREE.Scene(), CHARACTERS_DATA.find(character => character.id === 'wolf_predator'), trackedAudio);
  await player.generatedVisualReady;
  const importedRoot = new THREE.Group(); player.mesh.add(importedRoot);
  const mechanismUpdates = [], mechanismTriggers = []; let mode = 'scan', holdRemaining = 0;
  const mechanisms = {
    trigger(nextMode, duration) { mode = nextMode; holdRemaining = duration; mechanismTriggers.push({ mode, duration }); },
    getState() { return { mode, holdRemaining }; },
    update(delta) { mechanismUpdates.push(delta); holdRemaining = Math.max(0, holdRemaining - delta); }
  };
  // The real Player still owns all gameplay state. This mechanical observer
  // rejects an attempt to resume the imported actor's body animation.
  player._importedCharacter = { mechanisms, adapter: { root: importedRoot, bones: {}, update() { throw new Error('A defeated body must not resume its actor update'); } } };
  try {
    player.triggerNukeSelfDestruct(); player.executeSpineRip('crusher');
    const countdown = player.wristNukeHoloMesh, trophy = player.mesh.getObjectByName('hunter-spine-trophy-effect');
    const countdownDisposal = watchDisposal(resources(countdown).geometries), trophyDisposal = watchDisposal(resources(trophy).geometries);
    player.hp = 0; player.position.set(4, 1.3, -5); player.mesh.position.copy(player.position);
    player.plasmaEnergy = 50; player.empCooldown = 9; player.combiStickCooldown = 7; player.holoDecoyCooldown = 0;
    player.isLeaping = true; player.leapVelocityY = 14; player.isCloaked = true;
    // A later death/combat pose must survive the trophy's expiration.
    player.rightArm.rotation.set(-0.3, 0.4, 0.1);
    let timerFired = 0; const timer = player.schedule(() => timerFired++, 500);
    const state = () => ({ hp: player.hp, energy: player.plasmaEnergy, emp: player.empCooldown, combi: player.combiStickCooldown,
      decoy: player.holoDecoyCooldown, position: player.position.toArray(), root: player.mesh.quaternion.toArray(),
      arm: player.rightArm.quaternion.toArray(), leapVelocity: player.leapVelocityY, leaping: player.isLeaping,
      cloakPhase: player.cloakShimmerTimer, gait: structuredClone(player.locomotion.state), timerTime: timer.time });
    const gameplay = state(), frozenEffects = player._gadgetEffects.getState(), frozenMatrix = countdown.matrixWorld.toArray();
    for (const delta of [0, -1, NaN, Infinity]) player.updateDefeatedEffects(delta);
    assert.deepEqual(player._gadgetEffects.getState(), frozenEffects); assert.deepEqual(countdown.matrixWorld.toArray(), frozenMatrix);
    assert.equal(mechanismUpdates.length, 0); assert.deepEqual(state(), gameplay);
    const audioBeforeDecoy = audioCalls.length, childrenBefore = player.scene.children.length;
    assert.equal(player.deployHoloDecoy(player.scene), null);
    assert.equal(audioCalls.length, audioBeforeDecoy); assert.equal(player.scene.children.length, childrenBefore);
    assert.equal(player.holoDecoyCooldown, 0, 'a dead owner cannot spend a cooldown or create a projection');
    player.updateDefeatedEffects(1);
    assert.equal(player._gadgetEffects.getState().countdown.remainingSeconds, 5);
    assert.equal(player._gadgetEffects.getState().trophy.remainingSeconds, 2.5);
    assert.equal(holdRemaining, 5); assert.deepEqual(mechanismUpdates, [1]); assert.deepEqual(state(), gameplay);
    player.hp = 1;
    const livingEffects = player._gadgetEffects.getState(); player.updateDefeatedEffects(1);
    assert.deepEqual(player._gadgetEffects.getState(), livingEffects); assert.deepEqual(mechanismUpdates, [1], 'alive actors cannot be advanced twice by the defeated-effects path');
    player.hp = 0; player.updateDefeatedEffects(2.5);
    assert.equal(player._gadgetEffects.getState().trophy, null); assert.equal(trophy.parent, null); assert.ok(everyOnce(trophyDisposal));
    assert.equal(player._gadgetEffects.getState().countdown.remainingSeconds, 2.5); assert.equal(holdRemaining, 2.5);
    player.updateDefeatedEffects(2.499); assert.ok(player.wristNukeHoloMesh); assert.equal(countdown.userData.displaySeconds, 1);
    player.updateDefeatedEffects(0.001);
    assert.equal(player.wristNukeHoloMesh, null); assert.equal(player._gadgetEffects.getState().countdown, null);
    assert.equal(holdRemaining, 0); assert.ok(everyOnce(countdownDisposal)); assert.equal(mechanismTriggers[0].duration, 6);
    assert.equal(timerFired, 0); assert.deepEqual(state(), gameplay);
  } finally {
    player._gadgetEffects?.dispose(); player._importedCharacter = null; importedRoot.removeFromParent(); player.dispose();
  }
});
const closeEnough = (a, b) => Math.abs(a.dot(b)) > 1 - 1e-10;

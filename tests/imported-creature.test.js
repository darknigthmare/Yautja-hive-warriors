import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createImportedCreature, requestImportedCreature } from '../js/graphics/ImportedCreature.js';
import { getCorrectedCreatureTemplate, geometryAttributeHash } from '../js/graphics/CreatureSkinCorrections.js';
import { createCreatureModel, animateCreatureModel, updateCreatureDetail } from '../js/graphics/CreatureModels.js';
import { disposeObject } from '../js/engine/SceneResources.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';

// Deliberately tiny, synthetic and unrelated to production art. These tests
// exercise skinning/lifecycle contracts; they make no claim about real assets.
function syntheticGLTF({ animations = true, armatureRoot = false } = {}) {
  const scene = new THREE.Group(); scene.name = 'SYNTHETIC_GLTF_TEST_FIXTURE';
  const geometry = new THREE.BoxGeometry(1, 2, 0.5); geometry.translate(0, 1, 0);
  const positions = geometry.attributes.position, indices = [], weights = [];
  for (let i = 0; i < positions.count; i++) {
    const bone = positions.getY(i) < 1 ? (positions.getX(i) < 0 ? 1 : 2) : (positions.getX(i) < 0 ? 3 : 4);
    indices.push(bone, 0, 0, 0); weights.push(1, 0, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const map = new THREE.DataTexture(new Uint8Array([80, 90, 100, 255]), 1, 1); map.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map });
  const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = 'synthetic-skinned-box';
  const hips = new THREE.Bone(); hips.name = 'hips'; hips.position.y = 1;
  const bones = [hips];
  for (const [name, x, y] of [['leftLeg', -0.2, -0.6], ['rightLeg', 0.2, -0.6], ['leftArm', -0.5, 0.5], ['rightArm', 0.5, 0.5]]) {
    const bone = new THREE.Bone(); bone.name = name; bone.position.set(x, y, 0); hips.add(bone); bones.push(bone);
  }
  if (armatureRoot) {
    const armature = new THREE.Bone(); armature.name = 'Armature'; armature.add(hips); mesh.add(armature);
    bones.unshift(armature);
    // The extra wrapper is joint zero; the four skinned limb influences shift.
    const skinIndex = geometry.attributes.skinIndex;
    for (let i = 0; i < skinIndex.count; i++) skinIndex.setX(i, skinIndex.getX(i) + 1);
  } else mesh.add(hips);
  scene.add(mesh); scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  const tracks = hips.children.map((bone, i) => {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), i % 2 ? -0.4 : 0.4);
    return new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, [0, 0.5, 1], [0, 0, 0, 1, ...q.toArray(), 0, 0, 0, 1]);
  });
  return { scene, animations: animations ? [new THREE.AnimationClip('SyntheticWalk', 1, tracks)] : [] };
}

const mappedEntry = { creatureRig: { bones: Object.fromEntries(['hips', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm'].map(name => [name, name])) } };
const actorParts = actor => Object.values(actor._creatureRig);
const importedMesh = adapter => adapter.model.getObjectByName('synthetic-skinned-box');
const request = (actor, template, retained = new Set(), entry = {}) => requestImportedCreature(actor, {
  key: 'SYNTHETIC_FIXTURE_ONLY', entry, retained, loadTemplate: () => template
});

function syntheticSkinCorrection(template) {
  const geometry = template.scene.getObjectByName('synthetic-skinned-box').geometry;
  return { calibrated: true, id: 'synthetic-tail-test', meshes: [{
    meshName: 'synthetic-skinned-box', vertexCount: geometry.attributes.position.count,
    indexCount: geometry.index.count, positionHash: geometryAttributeHash(geometry.attributes.position),
    indexHash: geometryAttributeHash(geometry.index), targetBone: 'hips',
    vertexRanges: [[0, 3]] // [start, count]: vertices 0, 1 and 2 only.
  }] };
}

function snapshotSkinSource(template) {
  const mesh = template.scene.getObjectByName('synthetic-skinned-box');
  return { mesh, geometry: mesh.geometry, material: mesh.material, index: mesh.geometry.index.array.slice(),
    attributes: Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name, attribute]) => [name,
      { attribute, values: attribute.array.slice() }])),
    boneInverses: mesh.skeleton.boneInverses.map(matrix => [...matrix.elements]),
    boneTransforms: mesh.skeleton.bones.map(bone => [...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray()]) };
}

function assertSkinSourceUnchanged(snapshot) {
  assert.equal(snapshot.mesh.geometry, snapshot.geometry); assert.equal(snapshot.mesh.material, snapshot.material);
  assert.deepEqual(snapshot.geometry.index.array, snapshot.index);
  for (const [name, before] of Object.entries(snapshot.attributes)) {
    assert.equal(snapshot.geometry.attributes[name], before.attribute, `source ${name} object stays intact`);
    assert.deepEqual(snapshot.geometry.attributes[name].array, before.values, `source ${name} values stay intact`);
  }
  assert.deepEqual(snapshot.mesh.skeleton.boneInverses.map(matrix => matrix.elements), snapshot.boneInverses);
  assert.deepEqual(snapshot.mesh.skeleton.bones.map(bone => [...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray()]), snapshot.boneTransforms);
}

test('static geometry, decorative bones, invalid skinning and unanimated unknown rigs keep the procedural fallback', async () => {
  const actor = createCreatureModel('warrior');
  const staticScene = new THREE.Group();
  staticScene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()), new THREE.Bone());
  assert.throws(() => createImportedCreature(actor, { scene: staticScene }), /static GLB/);
  assert.throws(() => createImportedCreature(actor, syntheticGLTF({ animations: false })), /no skeletal locomotion/);
  const rootOnly = syntheticGLTF({ animations: false });
  rootOnly.animations.push(new THREE.AnimationClip('Walk', 1, [new THREE.VectorKeyframeTrack('hips.position', [0, 1], [0, 1, 0, 0, 1, 4])]));
  assert.throws(() => createImportedCreature(actor, rootOnly), /no skeletal locomotion/, 'root translation alone must not enable a static imported replacement');
  const malformed = syntheticGLTF();
  malformed.scene.children[0].geometry.attributes.skinWeight.setX(0, NaN);
  assert.throws(() => createImportedCreature(actor, malformed), /invalid skin influence/);
  const scene = new THREE.Scene(); scene.add(actor);
  const pending = request(actor, { scene: staticScene });
  assert.equal(await pending.ready, null);
  assert.equal(actor.userData.importedCreature.status, 'rejected');
  assert.equal(actor.userData.visualSource, 'procedural');
  assert.ok(actorParts(actor).every(part => part.visible));
});

test('rigged clones share cached surfaces while bones, pose and local normalization remain independent', () => {
  const template = syntheticGLTF(), retained = new Set();
  const actor = createCreatureModel('warrior'), other = createCreatureModel('warrior');
  actor.position.set(100, -20, 4); actor.scale.set(2, 3, 2);
  animateCreatureModel(actor, Math.PI / 2, true);
  const a = createImportedCreature(actor, template, mappedEntry, retained);
  const b = createImportedCreature(other, template, mappedEntry, retained);
  const meshA = importedMesh(a), meshB = importedMesh(b), source = template.scene.children[0];
  assert.equal(meshA.geometry, source.geometry);
  assert.equal(meshA.material, source.material);
  assert.equal(meshB.geometry, source.geometry);
  assert.notEqual(meshA.skeleton, meshB.skeleton);
  assert.notEqual(a.bones.leftLeg, b.bones.leftLeg);
  assert.notEqual(a.bones.leftLeg, source.skeleton.bones[1]);
  const bounds = new THREE.Box3().setFromObject(a.root, true);
  assert.ok(Math.abs(bounds.min.y) < 1e-6, 'feet sit at actor-local zero');
  assert.ok(Math.abs(bounds.max.y - a.diagnostics.height) < 1e-6);
  assert.ok(a.diagnostics.height > 3.8 && a.diagnostics.height < 4.2);
  assert.equal(a.diagnostics.height, b.diagnostics.height, 'owner world transforms and current procedural pose do not affect local height');
  a.update(Math.PI, true);
  assert.ok(a.bones.leftLeg.quaternion.angleTo(b.bones.leftLeg.quaternion) > 0.1);
  assert.equal(source.skeleton.bones[1].quaternion.angleTo(b.bones.leftLeg.quaternion), 0);
  assert.ok(retained.has(source.geometry)); assert.ok(retained.has(source.material)); assert.ok(retained.has(source.material.map));
  assert.equal(a.diagnostics.locomotion, 'SyntheticWalk');
  a.update(Math.PI, false);
  assert.equal(a.bones.leftLeg.quaternion.angleTo(b.bones.leftLeg.quaternion), 0, 'idle without a clip returns to the rest pose');
  a.dispose(); b.dispose();
});

test('an explicit rig can animate from its neutral quaternions without guessed bone names', () => {
  const actor = createCreatureModel('warrior');
  const template = syntheticGLTF({ animations: false });
  const initial = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0.2, -0.3));
  template.scene.children[0].skeleton.bones[1].quaternion.copy(initial);
  const adapter = createImportedCreature(actor, template, mappedEntry);
  adapter.update(Math.PI / 2, true);
  assert.ok(adapter.bones.leftLeg.quaternion.angleTo(initial) > 0.3);
  adapter.update(0, false);
  assert.ok(adapter.bones.leftLeg.quaternion.angleTo(initial) < 1e-6);
  assert.equal(adapter.diagnostics.locomotion, 'calibrated-bones');
  adapter.dispose();
});

test('locomotion removes horizontal root motion without changing cached animation or gameplay position', () => {
  const actor = createCreatureModel('warrior'); actor.position.set(30, 0, -20);
  const template = syntheticGLTF();
  const track = new THREE.VectorKeyframeTrack('hips.position', [0, 0.5, 1], [0, 1, 0, 10, 1.2, 20, 20, 1, 40]);
  template.animations[0].tracks.push(track);
  const values = track.values.slice();
  const adapter = createImportedCreature(actor, template, mappedEntry);
  adapter.update(Math.PI, true);
  assert.equal(adapter.bones.hips.position.x, 0);
  assert.equal(adapter.bones.hips.position.z, 0);
  assert.ok(adapter.bones.hips.position.y > 1.1, 'vertical locomotion bounce remains');
  assert.deepEqual(actor.position.toArray(), [30, 0, -20]);
  assert.deepEqual(track.values, values, 'root motion correction never edits the shared clip');
  adapter.dispose();
});

test('implicit pelvis selection skips Armature wrappers and preserves unknown articulated joint names', () => {
  for (const unknownNames of [false, true]) {
    const actor = createCreatureModel('warrior'), template = syntheticGLTF({ armatureRoot: true });
    const source = template.scene.children[0], hips = source.skeleton.bones[1];
    if (unknownNames) {
      const names = new Map(source.skeleton.bones.map((bone, index) => [bone.name, `Joint_${index}`]));
      source.skeleton.bones.forEach(bone => { bone.name = names.get(bone.name); });
      for (const track of template.animations[0].tracks) {
        const at = track.name.lastIndexOf('.'); track.name = names.get(track.name.slice(0, at)) + track.name.slice(at);
      }
    } else hips.name = 'mixamorigHips'; // GLTFLoader sanitizes ':' in node/track names.
    const translation = new THREE.VectorKeyframeTrack(`${hips.name}.position`, [0, 0.5, 1], [0, 1, 0, 10, 1.2, 20, 20, 1, 40]);
    template.animations[0].tracks.push(translation);
    const originalValues = translation.values.slice();
    const adapter = createImportedCreature(actor, template);
    adapter.update(Math.PI, true);
    assert.equal(adapter.diagnostics.motionRootBone, hips.name);
    assert.equal(adapter.bones.hips.position.x, 0);
    assert.equal(adapter.bones.hips.position.z, 0);
    assert.ok(adapter.bones.hips.position.y > 1.1, 'vertical gait bounce remains');
    const animatedLimb = adapter.model.getObjectByName(unknownNames ? 'Joint_2' : 'leftLeg');
    assert.ok(animatedLimb.quaternion.angleTo(new THREE.Quaternion()) > 0.3, 'legitimate limb animation remains active, including unknown names');
    assert.equal(adapter.diagnostics.locomotion, 'SyntheticWalk');
    assert.deepEqual(translation.values, originalValues);
    assert.deepEqual(hips.position.toArray(), [0, 1, 0], 'the cached source rig is not moved');
    adapter.dispose();
  }
});

test('a Walking clip rotating only Armature is rejected while calibrated gait remains available', () => {
  const actor = createCreatureModel('warrior'), template = syntheticGLTF({ animations: false, armatureRoot: true });
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
  template.animations.push(new THREE.AnimationClip('WalkingRootOnly', 1, [
    new THREE.QuaternionKeyframeTrack('Armature.quaternion', [0, 0.5, 1], [0, 0, 0, 1, ...q.toArray(), 0, 0, 0, 1])
  ]));
  assert.throws(() => createImportedCreature(actor, template), /no skeletal locomotion/);
  assert.throws(() => createImportedCreature(actor, template, { creatureRig: { clips: { walk: 'WalkingRootOnly' } } }), /not a skeletal clip/);
  const calibrated = createImportedCreature(actor, template, mappedEntry);
  assert.equal(calibrated.diagnostics.locomotion, 'calibrated-bones');
  calibrated.update(Math.PI / 2, true);
  assert.ok(calibrated.bones.leftLeg.quaternion.angleTo(new THREE.Quaternion()) > 0.3);
  calibrated.dispose();
});

test('resolved loading waits for scene attachment and selects the current procedural LOD', async () => {
  const actor = createCreatureModel('warrior'), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const parent = new THREE.Group(); scene.add(parent);
  let visualReady = 0;
  scene.addEventListener('visual-ready', () => visualReady++);
  const pending = request(actor, syntheticGLTF());
  await pending.loaded;
  assert.equal(actor.userData.importedCreature.status, 'loaded');
  assert.equal(actor.getObjectByName('imported-creature'), undefined);
  assert.equal(visualReady, 0, 'loading alone does not invalidate a scene');
  actor.position.z = 50; parent.add(actor); updateCreatureDetail(scene, [camera]);
  const adapter = await pending.ready;
  assert.ok(adapter);
  assert.equal(visualReady, 1, 'successful attachment invalidates its effective ancestor scene exactly once');
  assert.equal(actor.userData.detailLevel, 2);
  assert.equal(adapter.root.visible, false);
  assert.ok(actorParts(actor).every(part => part.visible && part.geometry === part.userData.detailGeometries[2]));
  camera.position.z = 49; updateCreatureDetail(scene, [camera]);
  assert.equal(adapter.root.visible, true);
  assert.equal(actor.userData.visualSource, 'generated-rigged');
  assert.ok(actorParts(actor).every(part => !part.visible));
  const leg = importedMesh(adapter).skeleton.bones[1];
  animateCreatureModel(actor, Math.PI, true);
  assert.ok(leg.quaternion.angleTo(new THREE.Quaternion()) > 0.1, 'the existing animation entrypoint drives the imported rig');
  camera.position.z = -20; updateCreatureDetail(scene, [camera]);
  assert.equal(adapter.root.visible, false);
  assert.ok(actorParts(actor).every(part => part.visible));
  const pose = leg.quaternion.clone(); animateCreatureModel(actor, 2, true);
  assert.equal(leg.quaternion.angleTo(pose), 0, 'far imported skeletons do no animation work');
  const delayedActor = createCreatureModel('warrior'); delayedActor.position.z = 100; scene.add(delayedActor);
  let complete;
  const delayed = requestImportedCreature(delayedActor, { key: 'SYNTHETIC_FIXTURE_ONLY', entry: {},
    loadTemplate: () => new Promise(resolve => { complete = resolve; }) });
  await Promise.resolve(); updateCreatureDetail(scene, [camera]);
  complete(syntheticGLTF()); const delayedAdapter = await delayed.ready;
  assert.equal(delayedActor.userData.detailLevel, 2);
  assert.equal(delayedAdapter.root.visible, false, 'loading completion uses the distance at completion, not creation');
  assert.ok(actorParts(delayedActor).every(part => part.visible));
  actor.removeFromParent();
  scene.remove(delayedActor);
});

test('wave removal cancels a pending attachment and load failures leave all procedural parts visible', async () => {
  const scene = new THREE.Scene(), audio = new Proxy({}, { get: () => () => {} });
  let visualReady = 0;
  scene.addEventListener('visual-ready', () => visualReady++);
  const horde = new XenomorphHorde(scene, audio), actor = horde.createAlienMesh(false);
  scene.add(actor); horde.aliens.push({ mesh: actor });
  let resolveTemplate;
  const pending = requestImportedCreature(actor, { key: 'SYNTHETIC_FIXTURE_ONLY', entry: {}, retained: horde.sharedResources,
    loadTemplate: () => new Promise(resolve => { resolveTemplate = resolve; }) });
  await Promise.resolve(); horde.clearWave(); resolveTemplate(syntheticGLTF());
  await pending.loaded;
  assert.equal(await pending.ready, null);
  assert.equal(actor.userData.importedCreature.status, 'cancelled');
  assert.equal(actor.getObjectByName('imported-creature'), undefined);
  assert.equal(scene.children.length, 0);
  assert.equal(visualReady, 0, 'cancelled requests never dispatch visual-ready');
  const failed = createCreatureModel('warrior'); scene.add(failed);
  const failure = requestImportedCreature(failed, { key: 'SYNTHETIC_FIXTURE_ONLY', entry: {}, loadTemplate: () => Promise.reject(new Error('fixture network failure')) });
  assert.equal(await failure.ready, null);
  assert.equal(failed.userData.importedCreature.status, 'load-error');
  assert.ok(actorParts(failed).every(part => part.visible));
  assert.equal(visualReady, 0, 'failed loading never dispatches visual-ready');
});

test('cleanup releases private skeleton textures exactly once and preserves cache geometry/material/maps for another actor', async () => {
  const scene = new THREE.Scene(), template = syntheticGLTF(), retained = new Set();
  const first = createCreatureModel('warrior', retained), second = createCreatureModel('warrior', retained);
  scene.add(first, second);
  const [a, b] = await Promise.all([request(first, template, retained).ready, request(second, template, retained).ready]);
  const source = template.scene.children[0];
  let cacheDisposed = 0, privateDisposed = 0;
  for (const resource of [source.geometry, source.material, source.material.map]) resource.addEventListener('dispose', () => cacheDisposed++);
  for (const skeleton of a.skeletons) {
    skeleton.computeBoneTexture(); skeleton.boneTexture.addEventListener('dispose', () => privateDisposed++);
    assert.ok(!retained.has(skeleton.boneTexture), 'per-instance skeleton textures must not leak into the cache retention set');
  }
  const expected = a.skeletons.size;
  disposeObject(first, retained);
  assert.equal(privateDisposed, expected);
  assert.equal(cacheDisposed, 0);
  assert.equal(first.parent, null);
  assert.equal(b.root.visible, true);
  b.update(Math.PI, true);
  assert.ok(importedMesh(b).skeleton.bones[1].quaternion.angleTo(new THREE.Quaternion()) > 0.1);
  a.dispose(); assert.equal(privateDisposed, expected);
  disposeObject(second, retained); assert.equal(cacheDisposed, 0);
});

test('calibrated skin corrections share a distinct template while selected skin influences and actor bones stay isolated', () => {
  const template = syntheticGLTF(), source = snapshotSkinSource(template), correction = syntheticSkinCorrection(template);
  const retained = new Set(), actor = createCreatureModel('warrior'), other = createCreatureModel('warrior');
  const entry = { creatureRig: { skinCorrections: correction } };
  const a = createImportedCreature(actor, template, entry, retained);
  const b = createImportedCreature(other, template, { creatureRig: { skinCorrections: structuredClone(correction) } }, retained);
  const corrected = getCorrectedCreatureTemplate(template, correction).template;
  assert.notEqual(corrected, template);
  assert.equal(getCorrectedCreatureTemplate(template, structuredClone(correction)).template, corrected, 'equivalent parsed calibration shares the same prepared template');
  const preparedMesh = corrected.scene.getObjectByName('synthetic-skinned-box'), meshA = importedMesh(a), meshB = importedMesh(b);
  assert.notEqual(meshA.geometry, source.geometry);
  assert.equal(meshA.geometry, preparedMesh.geometry); assert.equal(meshB.geometry, meshA.geometry);
  assert.equal(meshA.material, source.material); assert.equal(meshB.material.map, source.material.map);
  assert.notEqual(meshA.skeleton, meshB.skeleton); assert.notEqual(a.bones.hips, b.bones.hips);
  assert.notEqual(a.bones.hips, preparedMesh.skeleton.bones[0]);
  for (const [name, before] of Object.entries(source.attributes)) {
    if (!['skinIndex', 'skinWeight'].includes(name)) assert.deepEqual(meshA.geometry.attributes[name].array, before.values, `${name} is never reshaped by a skin correction`);
  }
  assert.deepEqual(meshA.geometry.index.array, source.index);
  const indices = meshA.geometry.attributes.skinIndex, weights = meshA.geometry.attributes.skinWeight;
  const hipsIndex = meshA.skeleton.bones.findIndex(bone => bone.name === 'hips');
  for (let vertex = 0; vertex < indices.count; vertex++) for (let slot = 0; slot < 4; slot++) {
    const at = vertex * 4 + slot;
    if (vertex < 3) {
      assert.equal(indices.array[at], slot === 0 ? hipsIndex : 0);
      assert.equal(weights.array[at], slot === 0 ? 1 : 0);
    } else {
      assert.equal(indices.array[at], source.attributes.skinIndex.values[at], 'unselected skin indices remain exact');
      assert.equal(weights.array[at], source.attributes.skinWeight.values[at], 'unselected skin weights remain exact');
    }
  }
  assert.ok(retained.has(meshA.geometry)); assert.ok(retained.has(meshA.material)); assert.ok(retained.has(meshA.material.map));
  const changed = structuredClone(correction); changed.id = 'synthetic-other-tail-test';
  changed.meshes[0].targetBone = 'rightLeg'; changed.meshes[0].vertexRanges = [[4, 3]];
  const alternate = getCorrectedCreatureTemplate(template, changed).template;
  assert.notEqual(alternate, corrected);
  assert.notEqual(alternate.scene.getObjectByName('synthetic-skinned-box').geometry, meshA.geometry, 'different calibration cannot reuse the first corrected buffer');
  a.update(Math.PI, true); assert.ok(a.model.getObjectByName('leftLeg').quaternion.angleTo(b.model.getObjectByName('leftLeg').quaternion) > .1);
  assertSkinSourceUnchanged(source); a.dispose(); b.dispose();
});

test('removing a corrected creature releases its private skeleton and leaves corrected surfaces usable by another actor', async () => {
  const scene = new THREE.Scene(), template = syntheticGLTF(), source = snapshotSkinSource(template), retained = new Set();
  const entry = { creatureRig: { skinCorrections: syntheticSkinCorrection(template) } };
  const first = createCreatureModel('warrior', retained), second = createCreatureModel('warrior', retained); scene.add(first, second);
  const [a, b] = await Promise.all([request(first, template, retained, entry).ready, request(second, template, retained, structuredClone(entry)).ready]);
  assert.ok(a); assert.ok(b);
  const correctedGeometry = importedMesh(a).geometry;
  assert.notEqual(correctedGeometry, source.geometry); assert.equal(importedMesh(b).geometry, correctedGeometry);
  let sharedDisposed = 0, firstSkeletonDisposed = 0, secondSkeletonDisposed = 0;
  for (const resource of new Set([source.geometry, correctedGeometry, source.material, source.material.map])) resource.addEventListener('dispose', () => sharedDisposed++);
  for (const [adapter, increment] of [[a, () => firstSkeletonDisposed++], [b, () => secondSkeletonDisposed++]]) {
    for (const skeleton of adapter.skeletons) {
      skeleton.computeBoneTexture(); skeleton.boneTexture.addEventListener('dispose', increment);
      assert.ok(!retained.has(skeleton.boneTexture));
    }
  }
  disposeObject(first, retained);
  assert.equal(firstSkeletonDisposed, a.skeletons.size); assert.equal(secondSkeletonDisposed, 0); assert.equal(sharedDisposed, 0);
  b.update(Math.PI, true); assert.ok(b.model.getObjectByName('leftLeg').quaternion.angleTo(new THREE.Quaternion()) > .1);
  assert.equal(b.root.visible, true); assert.ok(retained.has(correctedGeometry));
  a.dispose(); assert.equal(firstSkeletonDisposed, a.skeletons.size);
  disposeObject(second, retained);
  assert.equal(secondSkeletonDisposed, b.skeletons.size); assert.equal(sharedDisposed, 0);
  assertSkinSourceUnchanged(source);
});

test('invalid skin calibration rejects attachment without poisoning the source or the valid corrected cache', async () => {
  const scene = new THREE.Scene(), template = syntheticGLTF(), source = snapshotSkinSource(template), correction = syntheticSkinCorrection(template);
  const prepared = getCorrectedCreatureTemplate(template, correction).template;
  const altered = source.geometry.attributes.position.clone(); altered.setX(0, altered.getX(0) + 1);
  const invalid = structuredClone(correction); invalid.meshes[0].positionHash = geometryAttributeHash(altered);
  const actor = createCreatureModel('warrior'); scene.add(actor);
  const pending = request(actor, template, new Set(), { creatureRig: { skinCorrections: invalid } });
  assert.equal(await pending.ready, null); assert.equal(actor.userData.importedCreature.status, 'rejected');
  assert.match(actor.userData.importedCreature.reason, /CreatureSkinCorrections/);
  assert.equal(actor.getObjectByName('imported-creature'), undefined);
  assert.equal(actor.userData.visualSource, 'procedural'); assert.ok(actorParts(actor).every(part => part.visible));
  assert.equal(getCorrectedCreatureTemplate(template, correction).template, prepared);
  assertSkinSourceUnchanged(source); actor.removeFromParent();
});

test('removal before a calibrated request resolves never attaches corrected geometry or changes the raw source', async () => {
  const scene = new THREE.Scene(), template = syntheticGLTF(), source = snapshotSkinSource(template), retained = new Set();
  const actor = createCreatureModel('warrior', retained); scene.add(actor); const retainedBefore = new Set(retained);
  let complete, visualReady = 0; scene.addEventListener('visual-ready', () => visualReady++);
  const pending = requestImportedCreature(actor, { key: 'SYNTHETIC_FIXTURE_ONLY', retained,
    entry: { creatureRig: { skinCorrections: syntheticSkinCorrection(template) } },
    loadTemplate: () => new Promise(resolve => { complete = resolve; }) });
  await Promise.resolve(); disposeObject(actor, retained); complete(template); await pending.loaded;
  assert.equal(await pending.ready, null); assert.equal(actor.userData.importedCreature.status, 'cancelled');
  assert.equal(actor.getObjectByName('imported-creature'), undefined); assert.equal(actor._importedCreatureAdapter, undefined);
  assert.equal(visualReady, 0); assert.deepEqual(retained, retainedBefore);
  assertSkinSourceUnchanged(source);
});

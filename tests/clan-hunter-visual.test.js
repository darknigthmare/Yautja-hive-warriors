import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildClanHunterModel, updateClanHunterVisual, getClanHunterVisualState, getClanHunterVisualCacheStats } from '../js/graphics/ClanHunterModel.js';
import { disposeObject } from '../js/engine/SceneResources.js';
import { YautjaAlliesManager } from '../js/entities/YautjaAllies.js';

function buffers(root) {
  const result = new Set();
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (const attr of Object.values(mesh.geometry.attributes)) result.add(attr.array);
    for (const attr of Object.values(mesh.geometry.morphAttributes).flat()) result.add(attr.array);
    if (mesh.geometry.index) result.add(mesh.geometry.index.array);
    if (mesh.isInstancedMesh) result.add(mesh.instanceMatrix.array);
  });
  return result;
}

function poseSnapshot(root) {
  return root.children.map(mesh => mesh.isInstancedMesh
    ? [...mesh.instanceMatrix.array]
    : [...mesh.morphTargetInfluences]);
}

test('clan hunter preserves finite actor bounds with nine batched surfaces, including all dread instances', () => {
  const root = buildClanHunterModel(0);
  let triangles = 0, meshes = 0;
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    meshes++;
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
    assert.ok(mesh.geometry.attributes.position && mesh.geometry.attributes.normal && mesh.geometry.attributes.uv);
    for (const array of buffers(mesh)) assert.ok(array.every(Number.isFinite));
    if (!mesh.isInstancedMesh) {
      assert.equal(mesh.geometry.morphAttributes.position.length, 2);
      assert.equal(mesh.geometry.morphAttributes.normal.length, 2);
    }
  });
  assert.ok(triangles >= 34000 && triangles <= 54000, `${triangles} submitted triangles`);
  assert.ok(meshes <= 9, `${meshes} draw surfaces`);
  const bounds = new THREE.Box3().setFromObject(root);
  assert.ok(bounds.min.y >= -.01 && bounds.min.y < .03, `feet at ${bounds.min.y}`);
  assert.ok(bounds.max.y > 4.09 && bounds.max.y < 4.12, `standing height ${bounds.max.y}`);
  assert.ok(bounds.max.x < 1.1 && bounds.min.x > -1.1, 'silhouette stays inside existing 1.3 collision radius laterally');
  assert.ok([...buffers(root)].reduce((total, array) => total + array.byteLength, 0) < 3_000_000, 'indexed body plus morph buffers stay below 3MB per actor');
  assert.equal(root.getObjectByName('clan-hunter-independent-dreads').count, 16);
  assert.equal(root.getObjectByName('clan-hunter-dread-bands').count, 16);
  assert.equal(root.userData.visualRig.filmPropReplica, false);
  disposeObject(root);
});

test('gait follows resolved displacement, leaves root physics unchanged and uses independently owned dread poses', () => {
  const a = { mesh: buildClanHunterModel(0), hp: 950, radius: 1.3 };
  const b = { mesh: buildClanHunterModel(1), hp: 950, radius: 1.3 };
  a.mesh.position.set(8, 0, -3); b.mesh.position.set(8, 0, -3);
  updateClanHunterVisual(a, .016); updateClanHunterVisual(b, .016);
  const idlePhase = getClanHunterVisualState(a.mesh).phase;
  updateClanHunterVisual(a, .1);
  assert.equal(getClanHunterVisualState(a.mesh).phase, idlePhase, 'blocked/idle motion does not step');
  const bPose = poseSnapshot(b.mesh);
  const beforeLocks = [...a.mesh.getObjectByName('clan-hunter-independent-dreads').instanceMatrix.array];
  a.mesh.position.z += .9;
  const physical = { position: a.mesh.position.clone(), rotation: a.mesh.rotation.clone(), scale: a.mesh.scale.clone() };
  updateClanHunterVisual(a, .1);
  assert.ok(getClanHunterVisualState(a.mesh).phase > idlePhase);
  assert.ok(a.mesh.children.some(mesh => mesh.morphTargetInfluences?.some(weight => weight > .1)));
  assert.deepEqual(poseSnapshot(b.mesh), bPose, 'another actor owns its own pose');
  assert.ok(a.mesh.position.equals(physical.position)); assert.ok(a.mesh.rotation.equals(physical.rotation)); assert.ok(a.mesh.scale.equals(physical.scale));
  assert.equal(a.radius, 1.3);
  const locks = a.mesh.getObjectByName('clan-hunter-independent-dreads');
  assert.notDeepEqual([...locks.instanceMatrix.array], beforeLocks, 'strand orientations respond to movement');
  for (let i = 0; i < locks.count; i++) assert.deepEqual([...locks.instanceMatrix.array.slice(i * 16 + 12, i * 16 + 15)], beforeLocks.slice(i * 16 + 12, i * 16 + 15), 'each lock remains attached to its own skull root');
  assert.notDeepEqual([...locks.instanceMatrix.array.slice(0, 16)], [...locks.instanceMatrix.array.slice(16, 32)], 'strands have separate attachment matrices');
  const aBuffers = buffers(a.mesh), bBuffers = buffers(b.mesh);
  assert.ok([...aBuffers].every(array => !bBuffers.has(array)), 'no actor shares mutable geometry, morph or instance buffers');
  disposeObject(a.mesh); disposeObject(b.mesh);
});

test('opaque eye slits and the five lower mask vents are visible in front of the shell', () => {
  const root = buildClanHunterModel(); root.updateMatrixWorld(true);
  for (const [x, y] of [[-.119, 3.202], [.119, 3.202], [0, 3.016], [.058, 3.034]]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x * 1.2, y * 1.2, 2), new THREE.Vector3(0, 0, -1));
    const front = ray.intersectObject(root, true)[0];
    assert.ok(front, `mask contour at ${x},${y}`);
    assert.equal(front.object.material.color.getHex(), 0x222c2d, 'eye/vent is exposed rather than buried in solid silver');
    assert.equal(front.object.material.transparent, false);
    assert.equal(front.object.material.emissive.getHex(), 0);
  }
  disposeObject(root);
});

test('pause, rescue and teleport do not generate footsteps or alter rescue posture pivots', () => {
  const actor = { mesh: buildClanHunterModel(), hp: 950 };
  updateClanHunterVisual(actor, .016); actor.mesh.position.x += .5; updateClanHunterVisual(actor, .1);
  const pivot = new THREE.Group(); pivot.name = 'ally-rescue-posture';
  for (const child of [...actor.mesh.children]) pivot.add(child);
  actor.mesh.add(pivot); pivot.rotation.z = Math.PI * .4;
  for (const mode of ['pause', 'downed', 'recovering']) {
    actor.isDowned = mode === 'downed'; actor.isRescueRecovering = mode === 'recovering';
    const clock = getClanHunterVisualState(actor.mesh), pose = pivot.children.map(mesh => mesh.isInstancedMesh ? [...mesh.instanceMatrix.array] : [...mesh.morphTargetInfluences]);
    actor.mesh.position.x += .3;
    updateClanHunterVisual(actor, mode === 'pause' ? 0 : .1);
    assert.deepEqual(getClanHunterVisualState(actor.mesh), clock);
    assert.deepEqual(pivot.children.map(mesh => mesh.isInstancedMesh ? [...mesh.instanceMatrix.array] : [...mesh.morphTargetInfluences]), pose);
    assert.equal(pivot.rotation.z, Math.PI * .4); assert.equal(pivot.parent, actor.mesh);
  }
  actor.isDowned = false; actor.isRescueRecovering = false;
  const phase = getClanHunterVisualState(actor.mesh).phase;
  actor.mesh.position.x += 100; updateClanHunterVisual(actor, .016);
  assert.equal(getClanHunterVisualState(actor.mesh).phase, phase, 'streaming relocation is not a long stride');
  disposeObject(actor.mesh);
});

test('ally manager updates its visible pose after formation, follow and no-target branches', () => {
  const scene = new THREE.Scene(), manager = new YautjaAlliesManager(scene, {});
  manager.spawnSquad(new THREE.Vector3(), 1);
  const actor = manager.allies[0];
  // Avoid random initial offset and run two steps: the visual records the first
  // resolved location and subsequently follows only actual navigation movement.
  actor.mesh.position.set(0, 0, 0);
  manager.update(.1, new THREE.Vector3(0, 0, 20), { aliens: [] });
  manager.updateVisuals(.1);
  const phase = getClanHunterVisualState(actor.mesh)?.phase;
  assert.notEqual(phase, undefined, 'public honor-guard factory is integrated');
  manager.update(.1, new THREE.Vector3(0, 0, 20), { aliens: [] });
  manager.updateVisuals(.1);
  assert.ok(getClanHunterVisualState(actor.mesh).phase > phase);
  const clock = getClanHunterVisualState(actor.mesh);
  manager.update(0, new THREE.Vector3(0, 0, 20), { aliens: [] });
  manager.updateVisuals(0);
  assert.deepEqual(getClanHunterVisualState(actor.mesh), clock);
  manager.clearSquad(); assert.equal(scene.children.length, 0);
});

test('final collision correction cancels attempted walking before the visual frame advances once', () => {
  const manager = new YautjaAlliesManager(new THREE.Scene(), {});
  manager.spawnSquad(new THREE.Vector3(), 1);
  const actor = manager.allies[0]; actor.mesh.position.set(0, 0, 0);
  manager.updateVisuals(.016);
  const initial = getClanHunterVisualState(actor.mesh);
  let elapsed = 0;
  for (const delta of [.016, .1, .016, .033, .016]) {
    manager.update(delta, new THREE.Vector3(0, 0, 20), { aliens: [] });
    assert.ok(actor.mesh.position.z > 0, 'AI attempted to follow the player');
    actor.mesh.position.z = 0; // Same-frame environment/APC final correction.
    manager.updateVisuals(delta); elapsed += delta;
    assert.equal(getClanHunterVisualState(actor.mesh).phase, initial.phase);
    assert.equal(getClanHunterVisualState(actor.mesh).stride, 0);
  }
  assert.ok(Math.abs(getClanHunterVisualState(actor.mesh).time - initial.time - elapsed) < 1e-10, 'clock advances once after final physics');
  manager.clearSquad();
});

test('bounded CPU template survives actor disposal and clones every rendered buffer and material privately', () => {
  const a = buildClanHunterModel(0), b = buildClanHunterModel(1);
  const cache = getClanHunterVisualCacheStats();
  assert.equal(cache.geometries, 9); assert.equal(cache.renderObjects, 0);
  assert.ok(cache.ownedBufferBytes < 3_000_000);
  const bSnapshots = [...buffers(b)].map(array => [array, array.slice()]);
  const pose = poseSnapshot(b), bMaterials = new Set(); let bDisposals = 0;
  b.traverse(mesh => {
    if (!mesh.isMesh) return;
    bMaterials.add(mesh.material);
    mesh.geometry.addEventListener('dispose', () => bDisposals++);
    mesh.material.addEventListener('dispose', () => bDisposals++);
  });
  a.traverse(mesh => { if (mesh.isMesh) assert.equal(bMaterials.has(mesh.material), false); });
  disposeObject(a);
  const c = buildClanHunterModel(2);
  assert.equal(bDisposals, 0, 'destroying one actor never disposes another actor or its materials');
  assert.deepEqual(getClanHunterVisualCacheStats(), cache, 'one fixed CPU template, independent of respawns');
  for (const [array, snapshot] of bSnapshots) assert.deepEqual(array, snapshot, 'positions/normals/colors/morphs/instances survive another actor disposal and respawn');
  assert.deepEqual(poseSnapshot(b), pose);
  const cBuffers = buffers(c); assert.ok(bSnapshots.every(([array]) => !cBuffers.has(array)));
  disposeObject(c); assert.equal(bDisposals, 0);
  disposeObject(b);
});

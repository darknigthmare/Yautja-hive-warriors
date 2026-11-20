import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCreatureModel, createEggModel, animateCreatureModel, updateCreatureDetail } from '../js/graphics/CreatureModels.js';
import { sculptCreature } from '../js/graphics/CreatureSculpt.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { BossManager } from '../js/entities/Bosses.js';

const audio = new Proxy({}, { get: () => () => {} });
const profiles = ['warrior', 'runner', 'facehugger', 'chestburster', 'egg', 'crusher', 'praetorian', 'officer',
  'neomorph', 'praetomorph', 'red_warrior', 'grid', 'boiler', 'spitter', 'queen', 'predalien', 'empress', 'imperial', 'offspring'];

test('creature geometry has finite positions/normals/UVs and bounded fused draw calls', () => {
  for (const kind of profiles) {
    const model = createCreatureModel(kind);
    const { triangles, drawCalls } = model.userData.visualProfile;
    const isBoss = ['queen', 'predalien', 'empress', 'imperial', 'offspring'].includes(kind);
    assert.ok(drawCalls <= (isBoss ? 18 : 14), `${kind} must not render every anatomical detail separately`);
    assert.ok(triangles > 700 && triangles <= 100000, `${kind} has an explicit polygon budget`);
    if (['warrior', 'runner', 'praetomorph', 'red_warrior'].includes(kind)) assert.ok(triangles >= 25000 && triangles <= 45000);
    if (isBoss) assert.ok(triangles >= 60000);
    assert.ok(model.userData.visualProfile.continuousCore);
    assert.ok(model.userData.visualProfile.adultProportions);
    for (const part of model.children) {
      const attributes = part.geometry.attributes;
      for (const attribute of ['position', 'normal', 'uv']) assert.ok([...attributes[attribute].array].every(Number.isFinite), `${kind}/${part.name}/${attribute}`);
      assert.equal(attributes.position.count, attributes.normal.count);
      assert.equal(attributes.position.count, attributes.uv.count);
      assert.ok(part.geometry.boundingSphere.radius > 0);
      assert.ok(part.material.isMeshStandardMaterial);
      if (part.name !== 'boil' && part.name !== 'acid-glands') {
        assert.ok(part.material.map?.isDataTexture, `${kind} has a PBR albedo map`);
        assert.ok(part.material.normalMap?.isDataTexture, `${kind} has actual surface relief`);
        assert.ok(part.material.roughnessMap?.isDataTexture, `${kind} has spatially varied roughness`);
      }
    }
  }
});

test('creatures have meaningful anatomical silhouette and independent articulated poses', () => {
  const warrior = createCreatureModel('warrior');
  const other = createCreatureModel('warrior');
  const bounds = new THREE.Box3().setFromObject(warrior);
  assert.ok(bounds.max.y > 3.8 && bounds.max.y < 4.2, 'a standing alien has a credible stature beside the 4.36-unit hunter');
  assert.ok(bounds.min.z < -3, 'a curved stinger tail extends behind the body');
  const headAndBody = warrior.getObjectByName('carapace');
  const cranium = warrior.getObjectByName('cranium');
  assert.ok(cranium.geometry.boundingBox.max.z > 0.7, 'the smooth cranium and jaw face forward');
  const skullSize = cranium.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(skullSize.y < bounds.getSize(new THREE.Vector3()).y * 0.19, 'the head is a low-profile adult cranium, not an oversized oval');
  assert.ok(skullSize.z > skullSize.x * 2.6, 'the cranial roof is long and narrow in profile');
  const legSize = warrior.getObjectByName('leg-left').geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(legSize.y > bounds.getSize(new THREE.Vector3()).y * 0.43, 'long digitigrade legs replace the short toy-like proportions');
  const coreSize = headAndBody.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(coreSize.y > coreSize.x * 2.2, 'thorax, long abdomen, pelvis and neck form an elongated continuous core');
  assert.ok(headAndBody.geometry.index, 'indexed continuous surfaces avoid tripling cached vertex memory');
  const bodyPositions = headAndBody.geometry.attributes.position;
  let waistWidth = 0, chestWidth = 0;
  for (let i = 0; i < bodyPositions.count; i++) {
    const y = bodyPositions.getY(i), x = Math.abs(bodyPositions.getX(i));
    if (y > 2.15 && y < 2.35) waistWidth = Math.max(waistWidth, x);
    if (y > 2.8 && y < 3.1) chestWidth = Math.max(chestWidth, x);
  }
  assert.ok(chestWidth > waistWidth * 1.25, 'the chest narrows into a waist rather than an undifferentiated capsule');
  for (const part of ['arm-left', 'arm-right', 'leg-left', 'leg-right', 'tail', 'ribs-and-tubes', 'teeth-and-claws']) assert.ok(warrior.getObjectByName(part));
  animateCreatureModel(warrior, Math.PI / 2, true);
  assert.ok(warrior.getObjectByName('leg-left').rotation.x > 0);
  assert.ok(warrior.getObjectByName('leg-right').rotation.x < 0);
  assert.equal(other.getObjectByName('leg-left').rotation.x, 0, 'shared buffers do not couple actor transforms');
  assert.equal(warrior.getObjectByName('carapace').geometry, other.getObjectByName('carapace').geometry);
  const queenBounds = new THREE.Box3().setFromObject(createCreatureModel('queen'));
  const offspringBounds = new THREE.Box3().setFromObject(createCreatureModel('offspring'));
  assert.ok(queenBounds.max.y > 8 && queenBounds.getSize(new THREE.Vector3()).x > 7, 'queen has an imposing flared crown');
  assert.ok(offspringBounds.max.y > 8 && offspringBounds.getSize(new THREE.Vector3()).x < 5, 'Offspring remains a slender pale humanoid');
  const facehugger = new THREE.Box3().setFromObject(createCreatureModel('facehugger'));
  assert.ok(facehugger.getSize(new THREE.Vector3()).x > facehugger.getSize(new THREE.Vector3()).y * 3, 'facehugger silhouette is wide and low');
});

test('wave cleanup retains cached creature geometry, while actors are removed', () => {
  const scene = new THREE.Scene();
  const horde = new XenomorphHorde(scene, audio);
  const first = horde.createAlienMesh(false);
  let disposed = 0;
  first.children.forEach(part => part.geometry.addEventListener('dispose', () => disposed++));
  scene.add(first);
  horde.aliens.push({ mesh: first });
  horde.clearWave();
  assert.equal(scene.children.length, 0);
  assert.equal(disposed, 0, 'clearing one wave cannot invalidate geometry still used by another actor');
  const next = horde.createAlienMesh(false);
  assert.equal(first.getObjectByName('carapace').geometry, next.getObjectByName('carapace').geometry);
});

test('boss cleanup retains its sculpted geometry for a fresh encounter', () => {
  const scene = new THREE.Scene();
  const boss = new BossManager(scene, audio);
  boss.spawnBoss('xenomorph_queen', new THREE.Vector3());
  const first = boss.activeBoss.mesh;
  const geometries = new Set();
  first.traverse(part => { if (part.isMesh && part.geometry) geometries.add(part.geometry); });
  assert.ok(geometries.size > 0, 'the grounded boss root contains real sculpted geometry');
  let disposed = 0;
  geometries.forEach(geometry => geometry.addEventListener('dispose', () => disposed++));
  boss.takeDamage(100000);
  assert.equal(scene.children.length, 0);
  assert.equal(disposed, 0);
  boss.spawnBoss('xenomorph_queen', new THREE.Vector3(8, 0, 8));
  assert.equal(boss.activeBoss.mesh.getObjectByName('carapace').geometry, first.getObjectByName('carapace').geometry);
  assert.deepEqual(boss.activeBoss.mesh.position.toArray(), [8, 0, 8]);
});

test('egg petals remain separate and visibly open when the gameplay hatch triggers', () => {
  const egg = createEggModel();
  assert.equal(egg.children.filter(part => part.name.startsWith('petal-')).length, 4);
  const horde = new XenomorphHorde(new THREE.Scene(), audio);
  horde.spawnOvimorphEggs(new THREE.Vector3(), 1);
  const instance = horde.eggs[0];
  const pose = instance.petals.map(petal => [petal.rotation.x, petal.rotation.z]);
  const player = { hp: 100, position: instance.mesh.position.clone(), takeDamage() {}, audioEngine: audio,
    triggerFacehuggerLatch() { this.isFacehuggerLatched = true; } };
  horde.update(0.1, player);
  assert.ok(instance.isOpen);
  assert.ok(instance.petals.some((petal, index) => Math.abs(petal.rotation.x - pose[index][0]) + Math.abs(petal.rotation.z - pose[index][1]) > 0.1));
  horde.update(0.71, player);
  assert.equal(horde.aliens.length, 1, 'visual replacement preserves the actual hatching behavior');
});

test('distance LOD reduces triangles while preserving anatomical parts, pivots and proportions', () => {
  for (const kind of ['warrior', 'queen', 'empress', 'offspring']) {
    const high = sculptCreature(kind, 1), mid = sculptCreature(kind, 0.55), far = sculptCreature(kind, 0.3);
    const count = sculpture => sculpture.parts.reduce((n, part) => n + (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3, 0);
    assert.ok(count(mid) < count(high) * 0.4);
    assert.ok(count(far) < count(high) * 0.2);
    assert.deepEqual(high.parts.map(p => p.name), mid.parts.map(p => p.name));
    assert.deepEqual(high.parts.map(p => p.name), far.parts.map(p => p.name));
    assert.equal(high.scale, far.scale);
    for (let i = 0; i < high.parts.length; i++) {
      assert.deepEqual(high.parts[i].pivot, mid.parts[i].pivot);
      assert.deepEqual(high.parts[i].pivot, far.parts[i].pivot);
      for (const comparison of [mid.parts[i], far.parts[i]]) {
        const a = high.parts[i].geometry.boundingBox, b = comparison.geometry.boundingBox;
        for (const axis of ['x', 'y', 'z']) {
          const tolerance = Math.max(0.018, (a.max[axis] - a.min[axis]) * 0.07);
          assert.ok(Math.abs(a.min[axis] - b.min[axis]) < tolerance, `${kind}/${comparison.name}: lower detail must retain silhouette`);
          assert.ok(Math.abs(a.max[axis] - b.max[axis]) < tolerance, `${kind}/${comparison.name}: lower detail must retain silhouette`);
        }
      }
    }
    // A low-detail generation must not leave a global resolution side effect.
    const repeated = sculptCreature(kind);
    assert.equal(count(repeated), count(high));
    assert.deepEqual(repeated.parts[0].geometry.attributes.position.array, high.parts[0].geometry.attributes.position.array);
  }
});

test('one coherent LOD uses the nearest co-op camera and preserves moving-part poses', () => {
  const scene = new THREE.Scene(), parent = new THREE.Group();
  parent.position.x = 10; scene.add(parent);
  const model = createCreatureModel('warrior'); model.position.x = 15; parent.add(model);
  const camera = new THREE.PerspectiveCamera(), camera2 = new THREE.PerspectiveCamera();
  camera2.position.x = 26;
  const poses = model.children.map(mesh => ({ position: mesh.position.toArray(), material: mesh.material }));
  animateCreatureModel(model, 1.2, true);
  const legPose = model.getObjectByName('leg-left').rotation.x;
  let lookups = 0;
  const worldPosition = model.getWorldPosition;
  model.getWorldPosition = function (target) { lookups++; return worldPosition.call(this, target); };
  for (const [cameras, level] of [[[camera], 1], [[camera, camera2], 0]]) {
    lookups = 0; updateCreatureDetail(scene, cameras);
    assert.equal(lookups, 1, 'one world position lookup per actor');
    assert.equal(model.userData.detailLevel, level);
    model.children.forEach((mesh, i) => {
      assert.equal(mesh.geometry, mesh.userData.detailGeometries[level]);
      assert.deepEqual(mesh.position.toArray(), poses[i].position);
      assert.equal(mesh.material, poses[i].material);
    });
    assert.equal(model.getObjectByName('leg-left').rotation.x, legPose);
  }
  camera.position.x = -40; updateCreatureDetail(scene, [camera]);
  assert.equal(model.userData.detailLevel, 2);
  assert.ok(model.children.every(mesh => mesh.geometry === mesh.userData.detailGeometries[2]));
  const another = createCreatureModel('warrior'); another.position.x = -39; scene.add(another);
  updateCreatureDetail(scene, [camera]);
  assert.equal(another.userData.detailLevel, 0, 'instances share buffers without sharing their chosen LOD');
  assert.equal(model.userData.detailLevel, 2);
});

test('all cached LOD buffers survive cleanup and distant hordes have a bounded polygon cost', () => {
  const scene = new THREE.Scene(), horde = new XenomorphHorde(scene, audio);
  const camera = new THREE.PerspectiveCamera();
  const actor = horde.createAlienMesh(false);
  let disposed = 0;
  const geometries = new Set(actor.children.flatMap(mesh => mesh.userData.detailGeometries));
  geometries.forEach(geometry => { assert.ok(horde.sharedResources.has(geometry)); geometry.addEventListener('dispose', () => disposed++); });
  scene.add(actor); horde.aliens.push({ mesh: actor });
  actor.position.z = 50; updateCreatureDetail(scene, [camera]);
  horde.clearWave(); assert.equal(disposed, 0);
  let triangles = 0;
  for (let i = 0; i < 200; i++) {
    const mesh = horde.createAlienMesh(false); mesh.position.set(i % 20, 0, 50 + Math.floor(i / 20)); scene.add(mesh);
  }
  updateCreatureDetail(scene, [camera]);
  scene.children.forEach(group => group.children.forEach(mesh => { triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3; }));
  assert.ok(triangles < 1200000, '200 distant warriors use about a million triangles instead of more than eight million');
  assert.ok(triangles < 200 * actor.userData.visualProfile.triangles * 0.2);
});

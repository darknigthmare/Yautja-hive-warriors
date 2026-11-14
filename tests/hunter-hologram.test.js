import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';
import { GENERATED_ASSETS } from '../js/graphics/GeneratedAssetManifest.js';
import { createImportedCharacter } from '../js/graphics/ImportedCharacter.js';
import { createHunterHologram } from '../js/graphics/HunterHologram.js';
import { geometryAttributeHash } from '../js/graphics/CreatureSkinCorrections.js';

const audio = new Proxy({}, { get: () => () => {} });
class OfflinePlayer extends Player {
  loadGeneratedVisual(library) { return library ? super.loadGeneratedVisual(library) : Promise.resolve(false); }
}
const actor = (key = 'wolf_predator', scene = new THREE.Scene(), second = false) =>
  new OfflinePlayer(scene, CHARACTERS_DATA.find(value => value.id === key), audio, second);
const meshes = root => { const result = []; root.traverse(node => { if (node.isMesh) result.push(node); }); return result; };
const sample = (mesh, index = 0) => mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
// Keep assertion diagnostics small: serializing a full Three graph on failure
// would include every typed geometry/texture buffer and its cyclic parents.
const surfaces = root => meshes(root).map(mesh => ({ geometry: mesh.geometry.uuid, positionHash: geometryAttributeHash(mesh.geometry.attributes.position),
  visible: mesh.visible, material: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(material => material.uuid), quaternion: mesh.quaternion.toArray() }));

let cityAssets;
async function cityLibrary() {
  cityAssets ??= (async () => {
    const loader = new GLTFLoader().register(() => ({ name: 'HOLOGRAM_CPU_TEXTURE_STUB',
      loadTexture: async () => new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1) }));
    const source = new Map();
    for (const key of ['city_hunter', 'city_hunter_biomask']) {
      const bytes = await readFile(new URL('../public' + GENERATED_ASSETS[key].url, import.meta.url));
      source.set(key, await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''));
    }
    return { source, getGeneratedAssetEntry: key => GENERATED_ASSETS[key], loadGeneratedAsset: async key => {
      assert.ok(source.has(key), `unexpected generation/clip request: ${key}`); return source.get(key);
    } };
  })();
  return cityAssets;
}

function smallImportedActor() {
  // Synthetic fixture distinguishes an FPS-hidden mask from a measured face
  // already hidden at import. It is not used as visual/fidelity evidence.
  const owner = { mesh: new THREE.Group(), headMesh: new THREE.Group(), data: { id: 'fixture' }, position: new THREE.Vector3() };
  owner.headMesh.visible = false;
  const scene = new THREE.Group(), hips = new THREE.Bone(), head = new THREE.Bone();
  hips.name = 'Hips'; head.name = 'Head'; head.position.y = 1; hips.add(head); scene.add(hips);
  const geometry = new THREE.BoxGeometry(0.7, 2, 0.4); geometry.translate(0, 1, 0);
  const skinIndex = [], skinWeight = [];
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    skinIndex.push(geometry.attributes.position.getY(i) > 1 ? 1 : 0, 0, 0, 0); skinWeight.push(1, 0, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  const skin = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial()); skin.name = 'fixture-body'; scene.add(skin);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.1), new THREE.MeshStandardMaterial());
  mask.name = 'fixture-visible-mask'; mask.position.set(0, 0.75, 0.25); head.add(mask);
  const covered = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.1), skin.material);
  covered.name = 'fixture-covered-anatomy'; covered.visible = false; covered.position.set(0, 0.75, 0.2); head.add(covered);
  scene.updateMatrixWorld(true); skin.bind(new THREE.Skeleton([hips, head]));
  const adapter = createImportedCharacter(owner, { scene, animations: [] }, { requireHeadPartition: true, height: 4.31 });
  owner.mesh.add(adapter.root); owner._importedCharacter = { adapter }; owner.mesh.updateMatrixWorld(true);
  return { owner, adapter };
}

test('procedural projection captures actual limbs, mask, pose, contact and scale without laser or transient FX', () => {
  const player = actor();
  player.mesh.position.set(4, 0, -8); player.position.copy(player.mesh.position);
  player.mesh.scale.setScalar(1.8); player.mesh.rotation.y = 0.7; player.leftArm.rotation.x = 0.3;
  player._proceduralMotionRoot.position.y = -0.035; player.headMesh.visible = false; player.toggleCloak();
  player.laserGroup.name = 'fixture-live-laser';
  const fx = new THREE.Mesh(new THREE.SphereGeometry(3), new THREE.MeshBasicMaterial());
  fx.name = 'fixture-transient-gadget'; fx.userData.playerTransientEffect = true; player.leftArm.add(fx);
  player.mesh.updateMatrixWorld(true);
  const before = surfaces(player._proceduralMotionRoot);
  const originals = meshes(player._proceduralMotionRoot), originalGeometries = new Set(originals.map(mesh => mesh.geometry));
  const originalMaterials = new Set(originals.flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
  const projection = createHunterHologram(player);
  try {
    assert.equal(projection.diagnostics.sourceKind, 'procedural');
    assert.ok(projection.diagnostics.visibleTriangles > 100_000, 'uses the complete detailed silhouette rather than a new primitive');
    assert.ok(projection.diagnostics.visibleTriangles < 220_000);
    assert.ok(projection.mesh.getObjectByName('left-shoulder-joint'));
    assert.ok(projection.mesh.getObjectByName('right-hip-joint'));
    assert.equal(projection.mesh.getObjectByName('bio-mask-and-dreadlocks').visible, true);
    assert.equal(player.headMesh.visible, false, 'cloning does not change live FPS visibility');
    assert.equal(projection.mesh.getObjectByName('fixture-transient-gadget'), undefined);
    assert.equal(projection.mesh.getObjectByName(player.laserGroup.name), undefined);
    assert.deepEqual(projection.mesh.scale.toArray(), [1.8, 1.8, 1.8]);
    const original = meshes(player.leftLeg)[0];
    const captured = meshes(projection.mesh.getObjectByName('left-hip-joint'))[0];
    assert.ok(sample(original, 30).distanceTo(sample(captured, 30)) < 1e-8, 'actual posed world surface is captured at deployment');
    for (const mesh of meshes(projection.mesh)) {
      assert.ok(!originalGeometries.has(mesh.geometry));
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        assert.ok(!originalMaterials.has(material)); assert.equal(material.map, null); assert.equal(material.depthWrite, false);
      }
    }
    assert.deepEqual(surfaces(player._proceduralMotionRoot), before);
  } finally { projection.dispose(); player.dispose(); }
});

test('FPS restores only original head visibility and never reactivates masked anatomical surfaces', () => {
  const { owner, adapter } = smallImportedActor(), projection = createHunterHologram(owner);
  try {
    const covered = adapter.model.getObjectByName('fixture-covered-anatomy');
    const mask = adapter.model.getObjectByName('fixture-visible-mask');
    assert.equal(adapter.getHeadRestVisibility(covered), false);
    assert.equal(adapter.getHeadRestVisibility(mask), true);
    assert.equal(adapter.getHeadRestVisibility(new THREE.Group()), null);
    assert.equal(covered.visible, false); assert.equal(mask.visible, false);
    assert.equal(projection.mesh.getObjectByName('fixture-covered-anatomy').visible, false);
    assert.equal(projection.mesh.getObjectByName('fixture-visible-mask').visible, true);
    assert.ok(projection.diagnostics.restoredHeads > 0); assert.ok(projection.diagnostics.preservedHiddenHeads > 0);
    const source = meshes(adapter.root).find(mesh => mesh.isSkinnedMesh), copy = meshes(projection.mesh).find(mesh => mesh.isSkinnedMesh);
    assert.ok(copy.skeleton !== source.skeleton);
    copy.skeleton.bones.forEach((bone, index) => assert.ok(bone !== source.skeleton.bones[index]));
    copy.skeleton.boneInverses.forEach((matrix, index) => assert.ok(matrix !== source.skeleton.boneInverses[index]));
  } finally { projection.dispose(); adapter.dispose(); }
});

test('scan timing is private, simulation-driven, frame-rate stable and frozen by absent/invalid steps', () => {
  const { owner, adapter } = smallImportedActor(), first = createHunterHologram(owner), second = createHunterHologram(owner);
  try {
    const a = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
    const b = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
    first.materials[0].onBeforeCompile(a); second.materials[0].onBeforeCompile(b);
    assert.notEqual(a.uniforms.hunterHoloTime, b.uniforms.hunterHoloTime);
    const originalNow = Date.now; Date.now = () => { throw Error('wall clock must not drive projections'); };
    try { first.update(1); for (let i = 0; i < 120; i++) second.update(1 / 120); }
    finally { Date.now = originalNow; }
    assert.ok(Math.abs(a.uniforms.hunterHoloTime.value - b.uniforms.hunterHoloTime.value) < 1e-12);
    assert.ok(Math.abs(first.materials[0].opacity - second.materials[0].opacity) < 1e-12);
    const before = { time: first.diagnostics.elapsed, opacity: first.materials[0].opacity };
    for (const delta of [0, -1, NaN, Infinity, undefined]) assert.equal(first.update(delta), false);
    assert.deepEqual({ time: first.diagnostics.elapsed, opacity: first.materials[0].opacity }, before);
    first.update(4.9); assert.ok(first.materials[0].opacity < 0.12, 'projection dissolves before its existing six-second expiration');
    assert.ok(second.materials[0].opacity > 0.2, 'the peer projection retains its own time');
  } finally { first.dispose(); second.dispose(); adapter.dispose(); }
});

test('real City body, separate mask and opened console survive source disposal with private buffers and joints', async () => {
  const library = await cityLibrary(), player = actor('city_hunter');
  assert.equal(await player.loadGeneratedVisual(library), true);
  player.headMesh.visible = false; player.toggleCloak(); player.update(0.01);
  const imported = player._importedCharacter;
  imported.mechanisms.trigger('emp', 2); imported.mechanisms.update(0.4);
  player.mesh.updateMatrixWorld(true);
  const sourceSurfaces = surfaces(imported.adapter.root), projection = createHunterHologram(player);
  const captured = meshes(projection.mesh).find(mesh => mesh.isSkinnedMesh), point = sample(captured, 12);
  let sourceGeometryDisposals = 0, projectionGeometryDisposals = 0, projectionMaterialDisposals = 0, projectionBoneTextureDisposals = 0;
  new Set(meshes(imported.adapter.root).map(mesh => mesh.geometry)).forEach(geometry => geometry.addEventListener('dispose', () => sourceGeometryDisposals++));
  projection.geometries.forEach(geometry => geometry.addEventListener('dispose', () => projectionGeometryDisposals++));
  projection.materials.forEach(material => material.addEventListener('dispose', () => projectionMaterialDisposals++));
  for (const skeleton of projection.skeletons) {
    skeleton.computeBoneTexture(); skeleton.boneTexture.addEventListener('dispose', () => projectionBoneTextureDisposals++);
  }
  assert.equal(projection.diagnostics.sourceAssetKey, 'city_hunter');
  assert.ok(projection.diagnostics.visibleTriangles > 300_000 && projection.diagnostics.visibleTriangles < 330_000);
  assert.ok(projection.diagnostics.geometryBytes < 48 * 1024 * 1024);
  assert.equal(projection.diagnostics.sharedSourceGeometries, 0);
  assert.equal(projection.diagnostics.copiedTextures, 0);
  assert.ok(projection.diagnostics.preservedHiddenHeads >= 1, 'measured facial occlusion survives the full-head projection');
  assert.equal(projection.mesh.getObjectByName('city-left-console-hinge').visible, true, 'the current actual mechanical pose is captured');
  assert.deepEqual(surfaces(imported.adapter.root), sourceSurfaces);
  player.dispose();
  assert.ok(sourceGeometryDisposals > 0); assert.equal(projectionGeometryDisposals, 0);
  projection.mesh.updateMatrixWorld(true); projection.skeletons.forEach(skeleton => skeleton.update());
  assert.ok(sample(captured, 12).distanceTo(point) < 1e-9, 'source lifetime cannot collapse the snapshot');
  assert.equal(projection.update(0.4), true);
  assert.equal(projection.dispose(), true); assert.equal(projection.dispose(), false);
  assert.equal(projectionGeometryDisposals, projection.geometries.size);
  assert.equal(projectionMaterialDisposals, projection.materials.length);
  assert.equal(projectionBoneTextureDisposals, projection.skeletons.size);
});

test('a deployed procedural snapshot stays complete across a late source import and existing gadget rules remain unchanged', async () => {
  const library = await cityLibrary(), scene = new THREE.Scene(), player = actor('city_hunter', scene);
  player.rotationY = 0.5; player.mesh.rotation.y = 0.5;
  const decoy = player.deployHoloDecoy(scene);
  assert.ok(decoy); assert.ok(decoy.mesh.parent === scene); assert.equal(decoy.life, 6); assert.equal(decoy.speed, 7.5);
  assert.equal(decoy.detonated, false); assert.equal(player.holoDecoyCooldown, 16);
  assert.ok(decoy.direction.distanceTo(new THREE.Vector3(Math.sin(0.5), 0, Math.cos(0.5))) < 1e-12);
  assert.equal(player.deployHoloDecoy(scene), null, 'cooldown is unchanged');
  const before = surfaces(decoy.mesh);
  assert.equal(await player.loadGeneratedVisual(library), true);
  assert.equal(decoy.diagnostics.sourceKind, 'procedural'); assert.deepEqual(surfaces(decoy.mesh), before);
  assert.ok(decoy.mesh.getObjectByName('bio-mask-and-dreadlocks').visible);
  player.holoDecoyCooldown = 0; player.isFacehuggerLatched = true;
  assert.equal(player.deployHoloDecoy(scene), null); assert.equal(player.holoDecoyCooldown, 0);
  player.dispose(); assert.equal(player.deployHoloDecoy(scene), null); decoy.dispose();
});

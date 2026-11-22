import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachImportedCompanion, updateImportedCompanion, disposeImportedCompanion, companionAssetKey } from '../js/graphics/ImportedCompanion.js';
import { disposeObject } from '../js/engine/SceneResources.js';

// A named companion swaps its procedural figure for a cached Meshy model without ever
// owning (or disposing) the template's GPU resources.
function template() {
  const geometry = new THREE.BoxGeometry(1, 2, 1); let disposed = false; geometry.addEventListener('dispose', () => { disposed = true; });
  const scene = new THREE.Group(); const body = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()); body.name = 'Hips'; body.position.y = 1; scene.add(body);
  const walk = new THREE.AnimationClip('walk', 1, [new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 1, 0, 0, 1.5, 0])]);
  return { gltf: { scene, animations: [walk] }, isDisposed: () => disposed };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('the model replaces the procedural figure at hunter height and walks only while moving', async () => {
  const source = template(), group = new THREE.Group(), procedural = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); group.add(procedural);
  const state = attachImportedCompanion(group, 'pack_harek', { height: 4.31, entry: { status: 'verified' }, load: async () => source.gltf });
  assert.equal(state.status, 'loading'); assert.equal(procedural.visible, true, 'the procedural figure stays until the model is ready');
  await settle(); await settle();
  assert.equal(state.status, 'ready'); assert.equal(procedural.visible, false);
  const bounds = new THREE.Box3().setFromObject(state.root, true);
  assert.ok(Math.abs(bounds.max.y - bounds.min.y - 4.31) < 1e-6 && Math.abs(bounds.min.y) < 1e-6, 'scaled to the hunters\' height, feet on the ground');
  updateImportedCompanion(group, .1); const standing = state.actions.walk.time;
  updateImportedCompanion(group, .1); assert.equal(state.actions.walk.time, standing, 'still while standing');
  group.position.x += 1; updateImportedCompanion(group, .1); assert.ok(state.actions.walk.time > standing, 'walks while moving');
  disposeObject(group);
  assert.equal(source.isDisposed(), false, 'disposing the companion never disposes the shared template');
});

test('no verified entry keeps the procedural figure; names map to pack keys', async () => {
  const group = new THREE.Group(); group.add(new THREE.Mesh());
  assert.equal(attachImportedCompanion(group, 'pack_unknown', { entry: null }), null);
  assert.equal(group.children[0].visible, true);
  assert.equal(companionAssetKey('Yena'), 'pack_yena'); assert.equal(companionAssetKey(null), null);
  const failing = new THREE.Group(), child = new THREE.Mesh(); failing.add(child);
  const state = attachImportedCompanion(failing, 'pack_tov', { entry: { status: 'verified' }, load: async () => { throw new Error('offline'); } });
  await settle(); await settle();
  assert.equal(state.status, 'rejected'); assert.equal(child.visible, true);
  disposeImportedCompanion(failing); assert.equal(failing.userData.importedCompanion, undefined);
});

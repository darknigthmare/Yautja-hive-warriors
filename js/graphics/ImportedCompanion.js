/* Optional Meshy model for a named non-player Yautja (Ascension pack, Saar) or the USCM
 * officer. The procedural model stays underneath until the verified GLB is loaded; any failure
 * keeps it. Identity, collision and combat never depend on this visual. */
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { getGeneratedAssetEntry, loadGeneratedAsset } from './GeneratedAssetLibrary.js';

/** Manifest key for a named companion, or null when it has no generated model. */
export const companionAssetKey = name => name ? `pack_${String(name).toLowerCase()}` : null;

export function attachImportedCompanion(group, key, { height = 4.31, load = loadGeneratedAsset, entry = getGeneratedAssetEntry(key) } = {}) {
  if (!group?.isObject3D || !entry) return null;
  if (group.userData.importedCompanion) return group.userData.importedCompanion;
  const state = { key, status: 'loading', root: null, mixer: null, actions: {}, current: null, last: null };
  group.userData.importedCompanion = state;
  Promise.resolve().then(() => load(key)).then(gltf => {
    if (state.status !== 'loading' || !gltf?.scene) return;
    const root = cloneSkeleton(gltf.scene); root.name = `imported-companion-${key}`;
    root.userData.sharedGeneratedClone = true; // geometry and materials belong to the cached template
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root, true), measured = bounds.max.y - bounds.min.y;
    if (!(measured > 1e-5)) throw new Error('empty companion model');
    root.scale.multiplyScalar(height / measured); root.updateMatrixWorld(true);
    root.position.y -= new THREE.Box3().setFromObject(root, true).min.y;
    root.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = true; mesh.frustumCulled = false; } });
    // The procedural figure and its marks hide only once the replacement is ready.
    state.hidden = group.children.filter(child => child.visible); state.hidden.forEach(child => { child.visible = false; });
    group.add(root); state.root = root;
    state.mixer = new THREE.AnimationMixer(root);
    for (const clip of gltf.animations ?? []) state.actions[clip.name] = state.mixer.clipAction(clip);
    // Standing pose: the first walk frame (arms down), not the A-pose bind.
    const walk = state.actions.walk;
    if (walk) { walk.play(); walk.paused = true; walk.time = 0; state.mixer.update(0); }
    state.status = 'ready';
  }).catch(error => { if (state.status === 'loading') { state.status = 'rejected'; state.reason = error.message; } });
  return state;
}

/** Walk while the group moves, stand still otherwise. */
export function updateImportedCompanion(group, delta) {
  const state = group?.userData?.importedCompanion;
  if (state?.status !== 'ready' || !state.mixer || !(delta > 0)) return;
  const position = group.position, moving = state.last ? Math.hypot(position.x - state.last.x, position.z - state.last.z) / delta > .8 : false;
  state.last = position.clone();
  const walk = state.actions.walk;
  if (walk) walk.paused = !moving;
  state.mixer.update(moving ? delta : 0);
}

export function disposeImportedCompanion(group) {
  const state = group?.userData?.importedCompanion;
  if (!state) return;
  if (state.status === 'loading') state.status = 'cancelled';
  state.mixer?.stopAllAction();
  if (state.root) { group.remove(state.root); state.hidden?.forEach(child => { child.visible = true; }); }
  delete group.userData.importedCompanion;
}

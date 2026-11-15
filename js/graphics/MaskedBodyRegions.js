/* Explicit, measured body occlusion beneath a successfully composed biomask. */
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { BIOMASK_GROUP_NAME } from './BiomaskComposition.js';

const HASH = /^[a-f0-9]{64}$/i;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const fail = message => { throw new Error(`MaskedBodyRegions: ${message}`); };

function measuredSelection(scene, ids) {
  const masks = [], matches = new Map(ids.map(id => [id, []]));
  scene.traverse(node => {
    if (node.name === BIOMASK_GROUP_NAME) masks.push(node);
    if (matches.has(node.name)) matches.get(node.name).push(node);
  });
  if (masks.length !== 1 || !masks[0].isGroup || masks[0].userData.generatedBiomask !== true || !masks[0].parent?.isBone) {
    fail('a uniquely composed biomask attached to a bone is required');
  }
  const mask = masks[0];
  let maskMeshes = 0;
  mask.traverse(node => { if (node.isMesh) maskMeshes++; });
  if (!maskMeshes) fail('the composed biomask has no surface');
  return ids.map(id => {
    const candidates = matches.get(id);
    if (candidates.length !== 1 || !candidates[0].isMesh || candidates[0].isInstancedMesh ||
        candidates[0].userData.importedPartRegion?.id !== id) fail(`region ${id} is missing, ambiguous or not an explicit body surface`);
    const mesh = candidates[0];
    let ancestor = mesh;
    while (ancestor && ancestor !== mask) ancestor = ancestor.parent;
    if (ancestor === mask) fail(`region ${id} belongs to the biomask`);
    // A visibility flag affects every descendant. Only a measured leaf surface
    // is accepted, so it cannot accidentally hide another region or equipment.
    if (mesh.children.length) fail(`region ${id} must be a leaf surface`);
    return mesh;
  });
}

/**
 * Optional rig.maskedBodyRegions={calibrated:true,sourceSha256,ids:[regionIds]}.
 * This is a visibility-only operation on explicitly recovered face regions;
 * it does not infer facial coverage, delete triangles or alter skin/PBR data.
 *
 * No descriptor returns the SAME GLTF. Otherwise all SHA/name/region/mask
 * checks finish before a private node clone receives any visibility changes.
 * The prepared body and the composed input are unchanged, including on error.
 * Geometry/materials/textures are shared here and remain owned by their cache
 * or preparation. ImportedCharacter makes its own surface clones afterwards.
 * The existing disposeComposition callback is preserved for its caller.
 *
 * Throws on malformed calibration. Callers must reject the optional mask and
 * fall back to the complete prepared body, never retain a half-applied mask.
 */
export function applyMaskedBodyRegions(gltf, descriptor, { sourceSha256 } = {}) {
  if (descriptor === undefined) return gltf;
  if (!gltf?.scene?.isObject3D || descriptor?.calibrated !== true) fail('a scene and explicitly calibrated region list are required');
  if (typeof descriptor.sourceSha256 !== 'string' || typeof sourceSha256 !== 'string' ||
      !HASH.test(descriptor.sourceSha256) || !HASH.test(sourceSha256) ||
      descriptor.sourceSha256.toLowerCase() !== sourceSha256.toLowerCase()) fail('measured source SHA-256 does not match the selected body');
  if (!Array.isArray(descriptor.ids) || !descriptor.ids.length || descriptor.ids.length > 128 ||
      descriptor.ids.some(id => typeof id !== 'string' || !SAFE_ID.test(id)) || new Set(descriptor.ids).size !== descriptor.ids.length) {
    fail('region ids must be a bounded, nonempty list of unique measured names');
  }
  measuredSelection(gltf.scene, descriptor.ids);
  const scene = cloneSkeleton(gltf.scene);
  const selected = measuredSelection(scene, descriptor.ids);
  // Commit only after every target has been checked on the private clone.
  selected.forEach(mesh => { mesh.visible = false; });
  return { ...gltf, scene, scenes: [scene], maskedBodyRegionDiagnostics: {
    applied: true, ids: [...descriptor.ids], sourceSha256: sourceSha256.toLowerCase(), surfaceDataModified: false
  } };
}

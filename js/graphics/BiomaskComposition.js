/* Compose cached body + static mask templates before the character adapter owns
 * geometry/material clones. No cache node, transform or surface is modified. */
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { IMPORTED_BONE_ALIASES } from './ImportedCharacter.js';
import { addBiomaskEyeFilters, parseBiomaskEyeFiltersCalibration } from './BiomaskEyeFilters.js';

export const BIOMASK_GROUP_NAME = 'generated-biomask';
const fail = message => { throw new Error(`Biomask: ${message}`); };
const canonical = name => name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(mixamorig\d*|armature|meshy|bip\d+|ccbase)/, '');

export function parseBiomaskCalibration(config) {
  if (!config || config.calibrated !== true) return null;
  if (typeof config.assetKey !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(config.assetKey) ||
      typeof config.bone !== 'string' || !config.bone.trim()) fail('a calibrated assetKey and exact head bone name are required');
  for (const [field, length] of [['position', 3], ['quaternion', 4], ['scale', 3]]) {
    if (!Array.isArray(config[field]) || config[field].length !== length || !config[field].every(Number.isFinite)) fail(`invalid ${field} calibration`);
  }
  if (config.scale.some(value => value <= 0)) fail('scale must be positive');
  const rotation = new THREE.Quaternion(...config.quaternion);
  if (rotation.lengthSq() < 1e-12) fail('quaternion must have a rotation');
  return { assetKey: config.assetKey, bone: config.bone, position: [...config.position],
    quaternion: rotation.normalize().toArray(), scale: [...config.scale],
    eyeFilters: parseBiomaskEyeFiltersCalibration(config.eyeFilters) };
}

/** Rigid mask only. Transforms are calibrated in the selected Head bone's raw
 * local units, before character height normalization or pose corrections. */
export function composeCharacterWithBiomask(body, mask, calibration, { headBoneName } = {}) {
  if (!body?.scene?.isObject3D || !mask?.scene?.isObject3D) fail('loaded body and mask scenes are required');
  if (!calibration) fail('mask calibration is required');
  if (headBoneName && headBoneName !== calibration.bone) fail('mask bone must match the mapped character head');
  if (!headBoneName && !IMPORTED_BONE_ALIASES.head.some(name => canonical(name) === canonical(calibration.bone))) fail('custom head names require an explicit body boneMap.head');
  if (body.scene.getObjectByName(BIOMASK_GROUP_NAME)) fail('the body already contains a generated mask');
  let meshes = 0;
  mask.scene.traverse(node => {
    if (node.isSkinnedMesh || node.isBone) fail('the separate mask must be a rigid, unskinned asset');
    if (node.isMesh) meshes++;
  });
  if (!meshes) fail('the mask scene has no mesh');
  const scene = cloneSkeleton(body.scene), matches = [];
  scene.traverse(node => { if (node.isBone && node.name === calibration.bone) matches.push(node); });
  if (matches.length !== 1) fail('the exact calibrated head bone is missing or ambiguous');
  const root = new THREE.Group(); root.name = BIOMASK_GROUP_NAME; root.userData.generatedBiomask = true;
  root.position.fromArray(calibration.position); root.quaternion.fromArray(calibration.quaternion); root.scale.fromArray(calibration.scale);
  const maskClone = mask.scene.clone(true);
  const eyeFilters = addBiomaskEyeFilters(maskClone, calibration.eyeFilters);
  root.add(maskClone); matches[0].add(root);
  // The adapter clones these temporary surfaces before this callback runs.
  // Original body/mask cache surfaces and the shared filter map stay alive.
  return { ...body, scene, scenes: [scene], disposeComposition: () => eyeFilters?.dispose() };
}

/* Retain the actual right housing and its PBR surface, carried as rigid armour.
 * The measured surfaces formerly blended upper arm, forearm and hand weights.
 * This does not extract the fused wristblades or claim a complete film prop. */
import * as THREE from 'three';
import { CITY_HUNTER_RIGHT_GAUNTLET } from './CityHunterRightGauntletCalibration.js';

const fail = message => { throw new Error(`CityHunterRightGauntlet: ${message}`); };
const finiteMatrix = matrix => matrix?.elements.every(Number.isFinite) && Math.abs(matrix.determinant()) > 1e-12;

export function installCityHunterRightGauntlet(adapter, { sourceSha256 } = {}) {
  const measured = CITY_HUNTER_RIGHT_GAUNTLET;
  if (sourceSha256 !== measured.sourceSha256) fail('source SHA-256 does not match the measured corrected body');
  if (!adapter?.root?.isObject3D || !adapter.model?.isObject3D) fail('requires a private imported-character adapter');
  if (adapter.root.getObjectByName(measured.id)) fail('right gauntlet is already installed');
  const entries = [], allMatches = new Map(measured.parts.map(part => [part.name, []]));
  adapter.model.traverse(node => { if (allMatches.has(node.name)) allMatches.get(node.name).push(node); });
  let bone;
  for (const part of measured.parts) {
    const matches = allMatches.get(part.name);
    if (matches.length !== 1 || !matches[0].isSkinnedMesh) fail(`measured housing ${part.name} is missing or ambiguous`);
    const source = matches[0], geometry = source.geometry;
    if (source.bindMode !== 'attached' || Array.isArray(source.material) || Object.keys(geometry.morphAttributes).length) fail('unsupported housing binding, morphs or materials');
    if (geometry.attributes.position?.count !== part.vertices || geometry.index?.count !== part.triangles * 3) fail(`measured housing ${part.name} topology changed`);
    geometry.computeBoundingBox();
    for (const [edge, values] of [['min', part.min], ['max', part.max]]) for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(geometry.boundingBox[edge].getComponent(axis) - values[axis]) > 2e-6) fail(`measured housing ${part.name} bounds changed`);
    }
    const joints = source.skeleton.bones.map((candidate, index) => candidate.name === measured.bone ? index : -1).filter(index => index >= 0);
    if (joints.length !== 1) fail('measured forearm bone is missing or ambiguous');
    const joint = joints[0], candidate = source.skeleton.bones[joint];
    if (bone && candidate !== bone) fail('housing surfaces do not share the same forearm');
    bone = candidate;
    const toBone = source.skeleton.boneInverses[joint].clone().multiply(source.bindMatrix);
    if (!finiteMatrix(toBone)) fail('invalid housing bind transform');
    entries.push({ source, part, toBone, originalVisible: source.visible });
  }

  const group = new THREE.Group(); group.name = measured.id;
  group.userData.cityHunterEquipment = { id: measured.id, interpretation: 'original-housing-rigid-on-measured-forearm', fullWristbladeSeparation: false };
  let disposed = false, enabled = true, maximumRestError = 0;
  const ownedGeometries = new Set();
  const dispose = () => {
    if (disposed) return;
    disposed = true; group.removeFromParent();
    for (const entry of entries) entry.source.visible = entry.originalVisible;
    for (const geometry of ownedGeometries) geometry.dispose();
  };
  try {
    for (const entry of entries) {
      const geometry = entry.source.geometry.clone(); ownedGeometries.add(geometry);
      geometry.applyMatrix4(entry.toBone); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const replacement = new THREE.Mesh(geometry, entry.source.material);
      replacement.name = `${entry.part.name}-rigid-right-housing`;
      replacement.castShadow = entry.source.castShadow; replacement.receiveShadow = entry.source.receiveShadow;
      replacement.renderOrder = entry.source.renderOrder; replacement.layers.mask = entry.source.layers.mask;
      replacement.visible = entry.originalVisible;
      replacement.userData.importedPartRegion = { ...entry.source.userData.importedPartRegion,
        rigidEquipmentReplacement: true, sourcePart: entry.part.name, fullWristbladeSeparation: false };
      entry.replacement = replacement; group.add(replacement);
    }
    bone.add(group); adapter.root.updateMatrixWorld(true);
    const expected = new THREE.Vector3(), actual = new THREE.Vector3();
    for (const entry of entries) {
      entry.source.skeleton.update(); let restError = 0;
      for (let vertex = 0; vertex < entry.part.vertices; vertex++) {
        entry.source.getVertexPosition(vertex, expected).applyMatrix4(entry.source.matrixWorld);
        actual.fromBufferAttribute(entry.replacement.geometry.attributes.position, vertex).applyMatrix4(entry.replacement.matrixWorld);
        restError = Math.max(restError, actual.distanceTo(expected));
      }
      if (!Number.isFinite(restError) || restError > 2e-5) fail('install before posing: rigid conversion would change the measured rest surface');
      entry.restError = restError; maximumRestError = Math.max(maximumRestError, restError);
    }
    for (const entry of entries) entry.source.visible = false;
    const setEnabled = value => {
      if (disposed) return false;
      enabled = Boolean(value); group.visible = enabled;
      for (const entry of entries) entry.source.visible = entry.originalVisible && !enabled;
      return true;
    };
    return {
      group, parts: entries.map(({ source, replacement }) => ({ source, replacement })), setEnabled,
      getState: () => ({ enabled: enabled && !disposed, disposed, fullWristbladeSeparation: false }),
      dispose,
      diagnostics: Object.freeze({ sourceSha256, rigidBone: measured.bone, triangles: entries.reduce((sum, entry) => sum + entry.part.triangles, 0),
        vertices: entries.reduce((sum, entry) => sum + entry.part.vertices, 0), addedDrawCalls: 0, maximumRestError,
        texture: 'original actor PBR materials borrowed; source UVs and triangle indices copied unchanged',
        fullWristbladeSeparation: false, parts: entries.map(entry => ({ name: entry.part.name, maximumRestError: entry.restError })) }),
    };
  } catch (error) { dispose(); throw error; }
}

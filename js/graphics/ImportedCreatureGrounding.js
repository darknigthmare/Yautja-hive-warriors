/* Exact convex supports of explicitly measured rigid foot regions. This is a
 * bounded visual height correction, not ankle articulation or foot IK. */
import * as THREE from 'three';
import { geometryAttributeHash } from './CreatureSkinCorrections.js';

const fail = message => { throw new Error(`ImportedCreatureGrounding: ${message}`); };
const UP = new THREE.Vector3(0, 1, 0);
const measuredSupportCache = new WeakMap();

export function createImportedCreatureGrounding(root, orientation, model, config, { sourceSha256 } = {}) {
  if (config === undefined || config === null) return null;
  if (config.calibrated !== true || !/^[a-f0-9]{64}$/.test(config.sourceSha256 ?? '') || config.sourceSha256 !== sourceSha256) fail('an exact source-calibrated grounding descriptor is required');
  const meshes = []; model.traverse(node => { if (node.name === config.meshName) meshes.push(node); });
  const mesh = meshes[0];
  if (meshes.length !== 1 || !mesh.isSkinnedMesh) fail('the measured mesh is missing or ambiguous');
  const geometry = mesh.geometry, positions = geometry.attributes.position, indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
  const key = JSON.stringify(config), cached = measuredSupportCache.get(geometry)?.get(key);
  if (!cached && (positions.count !== config.vertexCount || geometry.index?.count !== config.indexCount || geometryAttributeHash(positions) !== config.positionHash || geometryAttributeHash(geometry.index) !== config.indexHash)) fail('foot support geometry fingerprints do not match');
  const numbers = ['groundY', 'clearance', 'maxCorrection', 'contactBand', 'fullContactBand'];
  if (!numbers.every(key => Number.isFinite(config[key])) || config.maxCorrection <= 0 || config.maxCorrection > 0.25 || config.clearance < 0 || config.fullContactBand < 0 || config.contactBand <= config.fullContactBand) fail('ground contact limits must be finite and bounded');
  if (!Array.isArray(config.feet) || config.feet.length !== 2) fail('two measured foot supports are required');
  const allSupport = new Set();
  const measured = cached ?? config.feet.map(foot => {
    const matching = mesh.skeleton.bones.filter(bone => bone.name === foot.bone);
    if (matching.length !== 1 || !Array.isArray(foot.supportVertices) || foot.supportVertices.length < 4 || foot.supportVertices.length > 1024) fail('a foot needs an unambiguous joint and bounded measured hull');
    const boneIndex = mesh.skeleton.bones.indexOf(matching[0]), coordinates = new Float32Array(foot.supportVertices.length * 3);
    foot.supportVertices.forEach((vertex, index) => {
      if (!Number.isInteger(vertex) || vertex < 0 || vertex >= positions.count || allSupport.has(vertex)) fail('foot hull indices must be unique source vertices');
      allSupport.add(vertex);
      if (indices.getX(vertex) !== boneIndex || Math.abs(weights.getX(vertex) - 1) > 1e-6 || weights.getY(vertex) !== 0 || weights.getZ(vertex) !== 0 || weights.getW(vertex) !== 0) fail('a measured foot hull must follow its calibrated rigid joint');
      coordinates.set([positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)], index * 3);
    });
    return { name: foot.name, boneName: foot.bone, boneIndex, coordinates };
  });
  if (!cached) {
    let cache = measuredSupportCache.get(geometry); if (!cache) { cache = new Map(); measuredSupportCache.set(geometry, cache); }
    cache.set(key, measured);
  }
  // Geometry and source supports are immutable/cache shared; only joints and
  // runtime diagnostics belong to an actor. Never cache another actor's bone.
  const supports = measured.map(foot => {
    const bone = mesh.skeleton.bones[foot.boneIndex];
    if (bone?.name !== foot.boneName) fail('the private actor skeleton lost its measured foot joint');
    return { ...foot, bone };
  });
  const baseY = orientation.position.y, matrix = new THREE.Matrix4(), prefix = new THREE.Matrix4(), up = new THREE.Vector3(), q = new THREE.Quaternion();
  const diagnostics = { id: config.id, supportVertices: supports.reduce((sum, foot) => sum + foot.coordinates.length / 3, 0),
    method: 'measured-rigid-region-convex-support', ankleIK: false, minFootYBefore: null, minFootYAfter: null, visualWorldOffsetY: 0,
    limited: false, contact: false, feet: supports.map(foot => ({ name: foot.name, minY: null })) };
  const refresh = () => { root.updateWorldMatrix(true, false); root.updateMatrixWorld(true); mesh.skeleton.update(); };
  const update = () => {
    orientation.position.y = baseY; refresh();
    prefix.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
    let min = Infinity;
    supports.forEach((foot, index) => {
      matrix.copy(prefix).multiply(foot.bone.matrixWorld).multiply(mesh.skeleton.boneInverses[foot.boneIndex]).multiply(mesh.bindMatrix);
      const values = foot.coordinates, row = matrix.elements; let minimum = Infinity;
      for (let at = 0; at < values.length; at += 3) minimum = Math.min(minimum, row[1] * values[at] + row[5] * values[at + 1] + row[9] * values[at + 2] + row[13]);
      diagnostics.feet[index].minY = minimum; min = Math.min(min, minimum);
    });
    diagnostics.minFootYBefore = min;
    root.getWorldQuaternion(q); up.copy(UP).applyQuaternion(q);
    const verticalGain = root.matrixWorld.elements[5];
    if (up.y < 0.95 || Math.abs(verticalGain) < 1e-6) {
      diagnostics.visualWorldOffsetY = 0; diagnostics.minFootYAfter = min; diagnostics.contact = false; diagnostics.limited = false; return;
    }
    const relative = min - config.groundY;
    // Preserve genuine airborne frames. Attraction to the floor fades smoothly
    // before both feet leave the contact band; penetration is always lifted.
    let desired = config.clearance - relative;
    if (relative > config.fullContactBand) {
      const ratio = THREE.MathUtils.clamp((config.contactBand - relative) / (config.contactBand - config.fullContactBand), 0, 1);
      desired *= ratio * ratio * (3 - 2 * ratio);
    }
    const offset = THREE.MathUtils.clamp(desired, -config.maxCorrection, config.maxCorrection);
    orientation.position.y = baseY + offset / verticalGain;
    diagnostics.visualWorldOffsetY = offset; diagnostics.limited = Math.abs(desired - offset) > 1e-6;
    diagnostics.minFootYAfter = min + offset;
    diagnostics.contact = relative <= config.contactBand;
    refresh();
  };
  return { diagnostics, update, reset() { orientation.position.y = baseY; refresh(); } };
}

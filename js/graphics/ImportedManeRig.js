/* Calibrated free strand ends on an existing skinned surface. Preparation is
 * cached; actor clones keep private bones and use YautjaArticulation for motion.
 * No surface is cut, subdivided, moved, retextured, or attached to a fake head. */
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { geometryAttributeHash } from './CreatureSkinCorrections.js';

const preparedCache = new WeakMap();
const fail = message => { throw new Error(`ImportedManeRig: ${message}`); };
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
const vector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

function inspect(gltf, config) {
  if (config.calibrated !== true || !validId(config.id)) fail('an explicit calibrated mane is required');
  if (!gltf?.scene?.isObject3D || !Array.isArray(config.strands) || !config.strands.length || config.strands.length > 16) fail('one to sixteen measured strand ends are required');
  const matches = []; gltf.scene.traverse(node => { if (node.name === config.meshName) matches.push(node); });
  if (matches.length !== 1 || !matches[0].isSkinnedMesh) fail('the calibrated skinned mane is missing or ambiguous');
  const mesh = matches[0], geometry = mesh.geometry, position = geometry.attributes.position;
  if (position?.itemSize !== 3 || position.count !== config.vertexCount || position.count > 250_000 || (geometry.index?.count ?? 0) !== config.indexCount) fail('source geometry layout does not match');
  for (const [key, name] of [['positionHash', 'position'], ['indexHash', 'index'], ['skinIndexHash', 'skinIndex'], ['skinWeightHash', 'skinWeight']]) {
    const attribute = name === 'index' ? geometry.index : geometry.attributes[name];
    if (!attribute || geometryAttributeHash(attribute) !== config[key]) fail(`${key} does not match the measured surface`);
  }
  const index = geometry.attributes.skinIndex, weight = geometry.attributes.skinWeight;
  if (index.itemSize !== 4 || weight.itemSize !== 4 || index.count !== position.count || weight.count !== position.count) fail('invalid skin attribute layout');
  const parents = mesh.skeleton.bones.filter(bone => bone.name === config.parentBone);
  if (parents.length !== 1 || !parents[0].isBone) fail('the measured mane attachment is missing or ambiguous');
  const parentIndex = mesh.skeleton.bones.indexOf(parents[0]), assigned = new Uint8Array(position.count), names = new Set();
  let total = 0, anchored = 0, weighted = 0, jointCount = 0;
  const strands = config.strands.map(strand => {
    if (!validId(strand.id) || names.has(strand.id)) fail('strand IDs must be explicit and distinct'); names.add(strand.id);
    if (!Array.isArray(strand.curve) || strand.curve.length < 3 || strand.curve.length > 6 || !strand.curve.every(vector)) fail('a finite measured strand curve is required');
    for (let i = 1; i < strand.curve.length; i++) if (new THREE.Vector3(...strand.curve[i]).distanceToSquared(new THREE.Vector3(...strand.curve[i - 1])) < 1e-8) fail('strand curve contains a zero-length segment');
    for (const [name, min, max] of [['stiffness', 0, 150], ['damping', 0, 30], ['gravityScale', 0, 0.5], ['maxAngle', 0, 0.35]]) if (!Number.isFinite(strand[name]) || strand[name] < min || strand[name] > max) fail('strand motion must be finite and bounded');
    const packed = strand.vertices;
    if (packed?.encoding !== 'base64-u32u16u8le' || !Number.isInteger(packed.count) || packed.count < 16 || packed.count > 5000 ||
        typeof packed.data !== 'string' || packed.data.length > 50_000 || packed.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(packed.data)) fail('invalid measured strand table');
    let bytes;
    try { bytes = Uint8Array.from(atob(packed.data), char => char.charCodeAt(0)); } catch { fail('strand table encoding is malformed'); }
    if (bytes.length !== packed.count * 7 || geometryAttributeHash({ array: bytes }) !== packed.hash) fail('strand table fingerprint does not match');
    total += packed.count; jointCount += strand.curve.length;
    if (total > 10_000 || total >= position.count / 4 || jointCount > 96) fail('the calibrated free region exceeds its bounded budget');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), vertices = new Uint32Array(packed.count), parameters = new Uint16Array(packed.count), fades = new Uint8Array(packed.count);
    let previous = -1, collar = 0, distal = 0;
    for (let i = 0; i < packed.count; i++) {
      const vertex = view.getUint32(i * 7, true), fade = view.getUint8(i * 7 + 6);
      if (vertex <= previous || vertex >= position.count || assigned[vertex]) fail('measured vertex IDs must be ordered, disjoint and in bounds');
      let sourceWeight = 0;
      for (let slot = 0; slot < 4; slot++) {
        const amount = weight.getComponent(vertex, slot);
        if (amount && index.getComponent(vertex, slot) !== parentIndex) fail('measured strand source must be rigidly attached to its original head joint');
        sourceWeight += amount;
      }
      if (sourceWeight !== 1) fail('measured strand source must be rigidly attached to its original head joint');
      assigned[vertex] = 1; previous = vertex; vertices[i] = vertex; parameters[i] = view.getUint16(i * 7 + 4, true); fades[i] = fade;
      if (fade) { weighted++; distal++; } else { anchored++; collar++; }
    }
    if (!collar || !distal || !fades.some(value => value === 255)) fail('strand requires a fixed collar and a fully weighted distal region');
    return { config: strand, vertices, parameters, fades };
  });
  return { mesh, parentIndex, strands, total, anchored, weighted, jointCount };
}

/**
 * Returns an immutable-in-practice shared preparation and an additive version-1
 * articulation descriptor. Merge its dreadlocks into the actor's descriptor;
 * createImportedCharacter then supplies private bones, FPS/LOD/pause and dispose.
 * An absent calibration is a transparent pass-through.
 */
export function prepareImportedManeTemplate(gltf, config, { sourceSha256 } = {}) {
  if (config === undefined || config === null) return { template: gltf, articulation: null, diagnostics: null };
  if (typeof config.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(config.sourceSha256) || config.sourceSha256 !== sourceSha256) fail('source SHA256 does not match the measured mane');
  const key = JSON.stringify(config), cached = preparedCache.get(gltf)?.get(key);
  if (cached) return cached;
  const checked = inspect(gltf, config), scene = cloneSkeleton(gltf.scene); scene.updateMatrixWorld(true);
  const mesh = scene.getObjectByName(config.meshName), parent = mesh.skeleton.bones[checked.parentIndex];
  const originalSkin = new THREE.Matrix4().multiplyMatrices(parent.matrixWorld, mesh.skeleton.boneInverses[checked.parentIndex]);
  const sourceToWorld = mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse).multiply(originalSkin).multiply(mesh.bindMatrix);
  const originalBones = mesh.skeleton.bones, inverses = mesh.skeleton.boneInverses.map(matrix => matrix.clone()), newBones = [];
  const geometry = mesh.geometry.clone(); mesh.geometry = geometry;
  if (originalBones.length + checked.jointCount > 65535) fail('mane skeleton exceeds skin-index storage');
  if (geometry.attributes.skinIndex.array.BYTES_PER_ELEMENT === 1 && originalBones.length + checked.jointCount > 255) geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(geometry.attributes.skinIndex.array, 4));
  const index = geometry.attributes.skinIndex, weight = geometry.attributes.skinWeight, dreadlocks = [];
  for (const { config: strand, vertices, parameters, fades } of checked.strands) {
    let previous = parent; const boneNames = [], offset = originalBones.length + newBones.length;
    for (let i = 0; i < strand.curve.length; i++) {
      const name = `MeasuredMane_${config.id}_${strand.id}_${i}`;
      if (scene.getObjectByName(name)) fail('measured mane joints must not already exist');
      const bone = new THREE.Bone(); bone.name = name;
      bone.position.copy(previous.worldToLocal(new THREE.Vector3(...strand.curve[i]).applyMatrix4(sourceToWorld)));
      previous.add(bone); bone.updateWorldMatrix(true, false);
      // Every new inverse bind reproduces the original Head skin transform,
      // including the provider's unusual bind scales. All rest vertices match.
      inverses.push(bone.matrixWorld.clone().invert().multiply(originalSkin));
      newBones.push(bone); boneNames.push(name); previous = bone;
    }
    for (let i = 0; i < vertices.length; i++) {
      if (!fades[i]) continue; // Keep the entire source collar exactly unchanged.
      const parameter = parameters[i] / 65535 * (strand.curve.length - 1), a = Math.floor(parameter), b = Math.min(strand.curve.length - 1, a + 1), t = parameter - a, fade = fades[i] / 255;
      index.setXYZW(vertices[i], checked.parentIndex, offset + a, offset + b, 0);
      weight.setXYZW(vertices[i], 1 - fade, (1 - t) * fade, t * fade, 0);
    }
    dreadlocks.push({ id: `measured-${strand.id}`, nodes: boneNames, stiffness: strand.stiffness, damping: strand.damping, gravityScale: strand.gravityScale, maxAngle: strand.maxAngle });
  }
  mesh.bind(new THREE.Skeleton([...originalBones, ...newBones], inverses), mesh.bindMatrix.clone());
  index.needsUpdate = true; weight.needsUpdate = true; scene.updateMatrixWorld(true); mesh.skeleton.update();
  const result = {
    template: { ...gltf, scene, scenes: gltf.scenes?.map(item => item === gltf.scene ? scene : item) ?? [scene] },
    articulation: { version: 1, dreadlocks },
    diagnostics: Object.freeze({ id: config.id, meshName: config.meshName, sourceSha256, sourceGeometryUnchanged: true,
      selectedVertices: checked.total, weightedVertices: checked.weighted, anchoredVertices: checked.anchored,
      sourceVertices: config.vertexCount, freeEnds: dreadlocks.length, addedBones: checked.jointCount,
      simulatedSegments: checked.jointCount - dreadlocks.length, weldedSideBundlesUnchanged: true })
  };
  let cache = preparedCache.get(gltf); if (!cache) { cache = new Map(); preparedCache.set(gltf, cache); }
  cache.set(key, result); return result;
}

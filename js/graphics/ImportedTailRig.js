/* An explicit tail region becomes a real weighted chain. Source surfaces stay
 * immutable; a prepared template is shared and each actor owns its joints. */
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { geometryAttributeHash } from './CreatureSkinCorrections.js';

const preparedCache = new WeakMap();
const AXIS_UP = new THREE.Vector3(0, 1, 0);
const AXIS_SIDE = new THREE.Vector3(1, 0, 0);
const fail = message => { throw new Error(`ImportedTailRig: ${message}`); };
const finiteVector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

function inspect(gltf, config, sourceSha256) {
  if (config.calibrated !== true || typeof config.id !== 'string' || !config.id) fail('an explicit calibrated tail is required');
  if (config.motion && (!['yawAmplitude', 'pitchAmplitude', 'waveLag'].every(key => config.motion[key] === undefined || Number.isFinite(config.motion[key])) ||
      ['yawAmplitude', 'pitchAmplitude'].some(key => config.motion[key] !== undefined && (config.motion[key] < 0 || config.motion[key] > 0.2)))) fail('tail motion must be finite and bounded');
  if (config.sourceSha256 && config.sourceSha256 !== sourceSha256) fail('source SHA256 does not match the measured tail');
  if (!gltf?.scene?.isObject3D || !Array.isArray(config.curve) || config.curve.length < 3 || config.curve.length > 16 || !config.curve.every(finiteVector)) fail('a finite measured tail curve is required');
  const matches = []; gltf.scene.traverse(node => { if (node.name === config.meshName) matches.push(node); });
  if (matches.length !== 1 || !matches[0].isSkinnedMesh) fail('the calibrated skinned mesh is missing or ambiguous');
  const mesh = matches[0], geometry = mesh.geometry, position = geometry.attributes.position;
  if (position?.count !== config.vertexCount || (geometry.index?.count ?? 0) !== config.indexCount ||
      geometryAttributeHash(position) !== config.positionHash || geometryAttributeHash(geometry.index) !== config.indexHash) fail('source geometry fingerprints do not match');
  const parents = mesh.skeleton.bones.filter(bone => bone.name === config.parentBone);
  if (parents.length !== 1) fail('the tail attachment joint is missing or ambiguous');
  const parentIndex = mesh.skeleton.bones.indexOf(parents[0]);
  if (!Array.isArray(config.vertexRanges) || !config.vertexRanges.length) fail('explicit tail vertex ranges are required');
  let end = 0, count = 0;
  for (const range of config.vertexRanges) {
    if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isInteger) || range[0] < end || range[1] < 1 || range[0] + range[1] > position.count) fail('tail ranges must be ordered and disjoint');
    end = range[0] + range[1]; count += range[1];
    for (let i = range[0]; i < end; i++) {
      const index = geometry.attributes.skinIndex, weight = geometry.attributes.skinWeight;
      if (index.getX(i) !== parentIndex || Math.abs(weight.getX(i) - 1) > 1e-6 || weight.getY(i) !== 0 || weight.getZ(i) !== 0 || weight.getW(i) !== 0) fail('the measured tail must first receive its calibrated pelvis skin repair');
    }
  }
  const values = config.vertexParameters;
  if (count >= position.count || count > 100_000 || values?.encoding !== 'base64-u16le' || values.levels !== 65535 || values.count !== count || typeof values.data !== 'string') fail('invalid measured tail parameters');
  let bytes;
  try { bytes = Uint8Array.from(atob(values.data), char => char.charCodeAt(0)); } catch { fail('tail parameter encoding is malformed'); }
  if (bytes.length !== count * 2) fail('tail parameter count does not match its explicit region');
  const parameters = new Uint16Array(count);
  for (let i = 0; i < count; i++) parameters[i] = bytes[i * 2] | bytes[i * 2 + 1] << 8;
  if (!parameters.some(value => value > 0) || !parameters.some(value => value === 0)) fail('tail parameters must contain an anchored collar and weighted distal region');
  for (let i = 1; i < config.curve.length; i++) if (new THREE.Vector3(...config.curve[i]).distanceToSquared(new THREE.Vector3(...config.curve[i - 1])) < 1e-8) fail('tail curve contains a zero-length segment');
  return { mesh, parentIndex, parameters, count };
}

export function prepareImportedTailTemplate(gltf, config, { sourceSha256 } = {}) {
  if (config === undefined || config === null) return { template: gltf, tail: null };
  const key = JSON.stringify(config), cached = preparedCache.get(gltf)?.get(key);
  if (cached) {
    if (config.sourceSha256 && config.sourceSha256 !== sourceSha256) fail('source SHA256 does not match the measured tail');
    return cached;
  }
  const checked = inspect(gltf, config, sourceSha256);
  const scene = cloneSkeleton(gltf.scene); scene.updateMatrixWorld(true);
  const mesh = scene.getObjectByName(config.meshName), parent = mesh.skeleton.bones[checked.parentIndex];
  const originalSkin = new THREE.Matrix4().multiplyMatrices(parent.matrixWorld, mesh.skeleton.boneInverses[checked.parentIndex]);
  const sourceToWorld = mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse).multiply(originalSkin).multiply(mesh.bindMatrix);
  const geometry = mesh.geometry.clone(); mesh.geometry = geometry;
  const boneNames = [], tailBones = [], inverses = mesh.skeleton.boneInverses.map(matrix => matrix.clone());
  let previous = parent;
  for (let i = 0; i < config.curve.length; i++) {
    const name = `MeasuredTail_${i}`;
    if (scene.getObjectByName(name)) fail('measured tail joints must not already exist');
    const bone = new THREE.Bone(); bone.name = name;
    bone.position.copy(previous.worldToLocal(new THREE.Vector3(...config.curve[i]).applyMatrix4(sourceToWorld)));
    previous.add(bone); bone.updateWorldMatrix(true, false);
    // Match the exact original pelvis skin matrix, including unusual provider
    // inverse-bind scales. This preserves every rest-space source vertex.
    inverses.push(bone.matrixWorld.clone().invert().multiply(originalSkin));
    tailBones.push(bone); boneNames.push(name); previous = bone;
  }
  const originalBones = mesh.skeleton.bones;
  if (originalBones.length + tailBones.length > 65535) fail('tail skeleton exceeds skin-index storage');
  if (geometry.attributes.skinIndex.array.BYTES_PER_ELEMENT === 1 && originalBones.length + tailBones.length > 255) {
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(geometry.attributes.skinIndex.array, 4));
  }
  mesh.bind(new THREE.Skeleton([...originalBones, ...tailBones], inverses), mesh.bindMatrix.clone());
  const index = geometry.attributes.skinIndex, weight = geometry.attributes.skinWeight, buckets = new Map();
  const point = new THREE.Vector3(); let at = 0;
  for (const [start, count] of config.vertexRanges) for (let i = start; i < start + count; i++) {
    const level = checked.parameters[at++], parameter = level / 65535 * (tailBones.length - 1);
    const a = Math.floor(parameter), b = Math.min(tailBones.length - 1, a + 1), blend = parameter - a;
    index.setXYZW(i, originalBones.length + a, originalBones.length + b, 0, 0);
    weight.setXYZW(i, 1 - blend, blend, 0, 0);
    const bucketKey = `${a}:${Math.floor(blend * 32)}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket) { bucket = { a, b, minBlend: blend, maxBlend: blend, bounds: new THREE.Box3(), count: 0 }; buckets.set(bucketKey, bucket); }
    bucket.minBlend = Math.min(bucket.minBlend, blend); bucket.maxBlend = Math.max(bucket.maxBlend, blend);
    point.fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(mesh.bindMatrix);
    bucket.bounds.expandByPoint(point); bucket.count++;
  }
  index.needsUpdate = true; weight.needsUpdate = true;
  for (const bucket of buckets.values()) { bucket.blend = (bucket.minBlend + bucket.maxBlend) / 2; bucket.blendError = (bucket.maxBlend - bucket.minBlend) / 2; }
  scene.updateMatrixWorld(true); mesh.skeleton.update();
  const tail = { id: config.id, meshName: config.meshName, boneNames, originalBoneCount: originalBones.length,
    weightedVertices: checked.count, buckets: [...buckets.values()], config };
  const result = { template: { ...gltf, scene, scenes: gltf.scenes?.map(item => item === gltf.scene ? scene : item) ?? [scene] }, tail };
  let cache = preparedCache.get(gltf); if (!cache) { cache = new Map(); preparedCache.set(gltf, cache); }
  cache.set(key, result);
  return result;
}

export function createImportedTailController(root, model, prepared) {
  if (!prepared) return null;
  const mesh = model.getObjectByName(prepared.meshName), config = prepared.config;
  const bones = prepared.boneNames.map(name => model.getObjectByName(name));
  if (!mesh?.isSkinnedMesh || bones.some(bone => !bone?.isBone)) fail('the actor clone lost its measured tail joints');
  const rest = bones.map(bone => bone.quaternion.clone()), accumulated = new Float64Array(bones.length);
  const matrices = bones.map(() => new THREE.Matrix4()), prefix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion(), parentInverse = new THREE.Quaternion();
  const axis = new THREE.Vector3(), pivot = new THREE.Vector3(), candidate = new THREE.Vector3(), corner = new THREE.Vector3(), otherPoint = new THREE.Vector3();
  const ground = config.ground ?? {}, clearance = ground.clearance ?? 0.015;
  const maxCorrection = ground.maxJointCorrection ?? 0.3, iterations = ground.iterations ?? 9;
  if (![clearance, maxCorrection].every(Number.isFinite) || clearance < 0 || maxCorrection < 0 || maxCorrection > 0.5 || !Number.isInteger(iterations) || iterations < 1 || iterations > 16) fail('invalid tail ground constraints');
  const diagnostics = { id: prepared.id, boneCount: bones.length, weightedVertices: prepared.weightedVertices,
    envelopeBuckets: prepared.buckets.length, sourceGeometryUnchanged: true, privateActorBones: true,
    lastGroundMinimum: null, lastSolverIterations: 0, maxGroundCorrectionRadians: 0, groundLimited: false, phase: null };
  const updateMatrices = () => {
    // Parents can have moved since the previous render. Update them first,
    // then use SkinnedMesh.updateMatrixWorld so its attached inverse bind is
    // refreshed together with the current world transform.
    root.updateWorldMatrix(true, false); root.updateMatrixWorld(true);
    mesh.skeleton.update();
    prefix.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
    for (let i = 0; i < bones.length; i++) matrices[i].copy(prefix).multiply(bones[i].matrixWorld).multiply(mesh.skeleton.boneInverses[prepared.originalBoneCount + i]);
  };
  const minimumEnvelope = () => {
    let min = Infinity, owner = null;
    for (const bucket of prepared.buckets) {
      const a = matrices[bucket.a].elements, b = matrices[bucket.b].elements, t = bucket.blend, bounds = bucket.bounds;
      const x = a[1] * (1 - t) + b[1] * t, y = a[5] * (1 - t) + b[5] * t, z = a[9] * (1 - t) + b[9] * t;
      const dx = b[1] - a[1], dy = b[5] - a[5], dz = b[9] - a[9], dd = b[13] - a[13];
      const diffMin = dd + dx * (dx >= 0 ? bounds.min.x : bounds.max.x) + dy * (dy >= 0 ? bounds.min.y : bounds.max.y) + dz * (dz >= 0 ? bounds.min.z : bounds.max.z);
      const diffMax = dd + dx * (dx >= 0 ? bounds.max.x : bounds.min.x) + dy * (dy >= 0 ? bounds.max.y : bounds.min.y) + dz * (dz >= 0 ? bounds.max.z : bounds.min.z);
      // The interval term bounds every continuous blend in this small bucket;
      // runtime contact never needs to quantize the actual skin weights.
      const minimum = a[13] * (1 - t) + b[13] * t + x * (x >= 0 ? bounds.min.x : bounds.max.x) + y * (y >= 0 ? bounds.min.y : bounds.max.y) + z * (z >= 0 ? bounds.min.z : bounds.max.z) - bucket.blendError * Math.max(Math.abs(diffMin), Math.abs(diffMax));
      if (minimum < min) {
        min = minimum; owner = bucket;
        corner.set(x >= 0 ? bounds.min.x : bounds.max.x, y >= 0 ? bounds.min.y : bounds.max.y, z >= 0 ? bounds.min.z : bounds.max.z);
        candidate.copy(corner).applyMatrix4(matrices[bucket.a]).multiplyScalar(1 - t);
        candidate.add(otherPoint.copy(corner).applyMatrix4(matrices[bucket.b]).multiplyScalar(t));
      }
    }
    return { min, owner, point: candidate };
  };
  const update = (phase, moving = true) => {
    if (!Number.isFinite(phase)) return;
    accumulated.fill(0);
    const clock = Math.max(0, phase), ramp = Math.min(1, clock * 0.8), activity = moving ? 1 : 0.35;
    for (let i = 0; i < bones.length; i++) {
      bones[i].quaternion.copy(rest[i]);
      if (i === 0) continue; // The root collar remains anchored to the pelvis.
      const gain = Math.pow(i / (bones.length - 1), 0.7) * activity * ramp;
      quaternion.setFromAxisAngle(AXIS_UP, Math.sin(clock * 0.55 - i * (config.motion?.waveLag ?? 0.65)) * (config.motion?.yawAmplitude ?? 0.025) * gain);
      bones[i].quaternion.multiply(quaternion);
      quaternion.setFromAxisAngle(AXIS_SIDE, Math.sin(clock * 0.7 - i * 0.42) * (config.motion?.pitchAmplitude ?? 0.012) * gain);
      bones[i].quaternion.multiply(quaternion);
    }
    updateMatrices();
    let envelope = minimumEnvelope(), solved = 0;
    for (; solved < iterations && envelope.min < clearance - 1e-5; solved++) {
      let selected = -1, leverage = 0;
      for (let i = 1; i <= envelope.owner.a; i++) {
        if (accumulated[i] >= maxCorrection - 1e-6) continue;
        bones[i].getWorldPosition(pivot);
        const horizontal = Math.hypot(envelope.point.x - pivot.x, envelope.point.z - pivot.z);
        if (horizontal > leverage) { leverage = horizontal; selected = i; }
      }
      if (selected < 0 || leverage < 0.02) break;
      const bone = bones[selected]; bone.getWorldPosition(pivot);
      axis.set(-(envelope.point.z - pivot.z), 0, envelope.point.x - pivot.x).normalize();
      bone.parent.getWorldQuaternion(parentInverse).invert(); axis.applyQuaternion(parentInverse).normalize();
      const angle = Math.min(0.08, maxCorrection - accumulated[selected], (clearance - envelope.min) / leverage * 1.08);
      quaternion.setFromAxisAngle(axis, angle); bone.quaternion.premultiply(quaternion); accumulated[selected] += angle;
      updateMatrices(); envelope = minimumEnvelope();
    }
    diagnostics.phase = phase; diagnostics.lastGroundMinimum = envelope.min; diagnostics.lastSolverIterations = solved;
    diagnostics.maxGroundCorrectionRadians = Math.max(...accumulated); diagnostics.groundLimited = envelope.min < clearance - 1e-4;
  };
  return { bones, mesh, diagnostics, update, reset() { bones.forEach((bone, index) => bone.quaternion.copy(rest[index])); updateMatrices(); } };
}

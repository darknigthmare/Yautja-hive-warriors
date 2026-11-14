/* Source-measured ankle/toe joints. Immutable source surfaces, real skin
 * influences and exact convex support per weight bucket; no per-frame scan. */
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { geometryAttributeHash } from './CreatureSkinCorrections.js';

const cache = new WeakMap();
const fail = message => { throw new Error(`ImportedAnkleRig: ${message}`); };
const vector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const UP = new THREE.Vector3(0, 1, 0);
const components = ['getX', 'getY', 'getZ', 'getW'];

function inspect(gltf, config, sourceSha256) {
  if (config.calibrated !== true || !config.id || !/^[a-f0-9]{64}$/.test(config.sourceSha256 ?? '') || config.sourceSha256 !== sourceSha256) fail('an exact source-calibrated descriptor is required');
  if (!gltf?.scene?.isObject3D || !Array.isArray(config.feet) || config.feet.length !== 2 || config.levels !== 16) fail('two measured ankle regions and sixteen weight levels are required');
  const matches = []; gltf.scene.traverse(node => { if (node.name === config.meshName) matches.push(node); });
  const mesh = matches[0], geometry = mesh?.geometry;
  if (matches.length !== 1 || !mesh?.isSkinnedMesh) fail('the calibrated skinned mesh is missing or ambiguous');
  if (geometry.attributes.position.count !== config.vertexCount || geometry.index?.count !== config.indexCount || geometryAttributeHash(geometry.attributes.position) !== config.positionHash || geometryAttributeHash(geometry.index) !== config.indexHash) fail('source geometry fingerprints do not match');
  const ground = config.ground, motion = config.motion;
  if (!ground || !['groundY', 'clearance', 'maxCorrection', 'contactBand', 'fullContactBand'].every(key => Number.isFinite(ground[key])) || ground.clearance < 0 || ground.maxCorrection <= 0 || ground.maxCorrection > .25 || ground.fullContactBand < 0 || ground.contactBand <= ground.fullContactBand) fail('ground constraints must be finite and bounded');
  if (!motion || !['ankleGain', 'toeGain', 'maxAnkleRadians', 'maxToeRadians'].every(key => Number.isFinite(motion[key])) || motion.ankleGain < 0 || motion.ankleGain > 1 || motion.toeGain < 0 || motion.toeGain > 1 || motion.maxAnkleRadians <= 0 || motion.maxAnkleRadians > .25 || motion.maxToeRadians <= 0 || motion.maxToeRadians > .2) fail('joint rotations must be finite and bounded');
  if (!config.clipReferences || !Object.values(config.clipReferences).length || Object.values(config.clipReferences).some(clip => !/^[a-f0-9]{64}$/.test(clip.sourceSha256 ?? '') || config.feet.some(foot => [foot.sourceFootBone, foot.sourceToeBone].some(name => !Array.isArray(clip.quaternions?.[name]) || clip.quaternions[name].length !== 4 || !clip.quaternions[name].every(Number.isFinite) || Math.abs(Math.hypot(...clip.quaternions[name]) - 1) > .001)))) fail('measured source-clip reference rotations are required');
  const selected = new Set(); let totalSupports = 0;
  const feet = config.feet.map(foot => {
    if (![foot.anklePivot, foot.toePivot, foot.lateralAxis].every(vector) || Math.abs(Math.hypot(...foot.lateralAxis) - 1) > .001) fail('finite measured pivots and a unit lateral axis are required');
    const boneIndex = mesh.skeleton.bones.findIndex(bone => bone.name === foot.parentBone);
    if (boneIndex < 0 || mesh.skeleton.bones.filter(bone => bone.name === foot.parentBone).length !== 1 || [foot.sourceFootBone, foot.sourceToeBone].some(name => mesh.skeleton.bones.filter(bone => bone.name === name).length !== 1)) fail('the calibrated source joints are missing or ambiguous');
    if (!Array.isArray(foot.vertexRanges) || !foot.vertexRanges.length || foot.vertexLevels?.encoding !== 'base64-u8' || typeof foot.vertexLevels.data !== 'string') fail('explicit regions and measured weights are required');
    let levels; try { levels = Uint8Array.from(atob(foot.vertexLevels.data), char => char.charCodeAt(0)); } catch { fail('measured weights are malformed'); }
    const region = new Map(), bounds = new THREE.Box3(), point = new THREE.Vector3(); let at = 0, end = 0;
    for (const range of foot.vertexRanges) {
      if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isInteger) || range[0] < end || range[1] <= 0 || range[0] + range[1] > config.vertexCount) fail('region ranges must be ordered, disjoint and in bounds');
      end = range[0] + range[1];
      for (let i = range[0]; i < end; i++) {
        if (selected.has(i) || at >= levels.length || levels[at] > config.levels * 2) fail('measured weight regions overlap or are malformed');
        for (let slot = 0; slot < 4; slot++) if (geometry.attributes.skinIndex[components[slot]](i) !== (slot === 0 ? boneIndex : 0) || geometry.attributes.skinWeight[components[slot]](i) !== (slot === 0 ? 1 : 0)) fail('the region must receive its measured rigid-calf repair first');
        selected.add(i); region.set(i, levels[at++]); bounds.expandByPoint(point.fromBufferAttribute(geometry.attributes.position, i));
      }
    }
    if (at !== levels.length || at !== foot.vertexLevels.count || !levels.some(level => level === 0) || !levels.some(level => level > config.levels)) fail('the weight map must retain its calf collar and articulate its toes');
    for (const pivot of [foot.anklePivot, foot.toePivot]) if (!bounds.containsPoint(point.fromArray(pivot))) fail('joint pivots must remain inside their measured source region');
    if (!Array.isArray(foot.supports) || !foot.supports.length || foot.supports.length > 33) fail('bounded per-weight supports are required');
    const supported = new Set();
    for (const support of foot.supports) {
      if (!Number.isInteger(support.level) || supported.has(support.level) || !Array.isArray(support.vertices) || !support.vertices.length || support.vertices.length > 1024 || !Number.isFinite(support.maximumOutsideError) || support.maximumOutsideError > 1e-6) fail('invalid measured convex support');
      supported.add(support.level); const unique = new Set();
      for (const vertex of support.vertices) {
        if (!Number.isInteger(vertex) || region.get(vertex) !== support.level || unique.has(vertex)) fail('convex supports must belong to their exact weight group');
        unique.add(vertex);
      }
      totalSupports += support.vertices.length;
    }
    if ([...levels].some(level => !supported.has(level))) fail('every weight group requires a convex support');
    return { boneIndex, levels };
  });
  if (totalSupports !== config.supportVertices || totalSupports > 2048 || selected.size >= config.vertexCount) fail('the compact support budget does not match');
  return { mesh, feet };
}

/** Prepare once, before actor cloning/normalization. Tail may be prepared first. */
export function prepareImportedAnkleTemplate(gltf, config, { sourceSha256 } = {}) {
  if (config === undefined || config === null) return { template: gltf, ankles: null };
  if (config.sourceSha256 !== sourceSha256) fail('source SHA256 does not match the measured ankles');
  const key = JSON.stringify(config), cached = cache.get(gltf)?.get(key); if (cached) return cached;
  const checked = inspect(gltf, config, sourceSha256);
  const scene = cloneSkeleton(gltf.scene); scene.updateMatrixWorld(true);
  const mesh = scene.getObjectByName(config.meshName), geometry = mesh.geometry.clone(); mesh.geometry = geometry;
  const originalBones = [...mesh.skeleton.bones], newBones = [], inverses = mesh.skeleton.boneInverses.map(matrix => matrix.clone()), feet = [];
  if (originalBones.length + config.feet.length * 2 > 65535) fail('ankle joints exceed skin-index storage');
  if (originalBones.length + config.feet.length * 2 > 255 && geometry.attributes.skinIndex.array.BYTES_PER_ELEMENT === 1) geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(geometry.attributes.skinIndex.array, 4));
  for (let side = 0; side < config.feet.length; side++) {
    const foot = config.feet[side], { boneIndex, levels } = checked.feet[side], parent = originalBones[boneIndex];
    const originalSkin = parent.matrixWorld.clone().multiply(mesh.skeleton.boneInverses[boneIndex]);
    const sourceToWorld = mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse).multiply(originalSkin).multiply(mesh.bindMatrix);
    const axisWorld = new THREE.Vector3(...foot.lateralAxis).transformDirection(sourceToWorld), inverseParent = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    const axis = axisWorld.clone().applyQuaternion(inverseParent).normalize(), sourceAxes = [];
    for (const name of [foot.sourceFootBone, foot.sourceToeBone]) sourceAxes.push(axisWorld.clone().applyQuaternion(scene.getObjectByName(name).parent.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize());
    let previous = parent; const names = [], indices = [];
    for (const [joint, pivot] of [['Ankle', foot.anklePivot], ['Toe', foot.toePivot]]) {
      const bone = new THREE.Bone(); bone.name = `Measured${joint}_${foot.name}`;
      if (scene.getObjectByName(bone.name)) fail('measured ankle joints already exist');
      bone.position.copy(previous.worldToLocal(new THREE.Vector3(...pivot).applyMatrix4(sourceToWorld)));
      previous.add(bone); bone.updateWorldMatrix(true, false);
      indices.push(originalBones.length + newBones.length); newBones.push(bone); names.push(bone.name);
      // Preserve the provider's full inverse-bind scale and the exact rest skin.
      inverses.push(bone.matrixWorld.clone().invert().multiply(originalSkin)); previous = bone;
    }
    let at = 0; const skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
    for (const [start, count] of foot.vertexRanges) for (let i = start; i < start + count; i++) {
      const level = levels[at++], a = level <= config.levels ? boneIndex : indices[0], b = level <= config.levels ? indices[0] : indices[1];
      const blend = (level <= config.levels ? level : level - config.levels) / config.levels;
      skinIndex.setXYZW(i, a, b, 0, 0); skinWeight.setXYZW(i, 1 - blend, blend, 0, 0);
    }
    const supports = foot.supports.map(support => {
      const a = support.level <= config.levels ? boneIndex : indices[0], b = support.level <= config.levels ? indices[0] : indices[1];
      const blend = (support.level <= config.levels ? support.level : support.level - config.levels) / config.levels;
      const coordinates = new Float32Array(support.vertices.length * 3);
      support.vertices.forEach((vertex, at) => coordinates.set([geometry.attributes.position.getX(vertex), geometry.attributes.position.getY(vertex), geometry.attributes.position.getZ(vertex)], at * 3));
      return { a, b, blend, coordinates };
    });
    feet.push({ names, indices, axis: axis.toArray(), sourceAxes: sourceAxes.map(axis => axis.toArray()), supports });
  }
  mesh.bind(new THREE.Skeleton([...originalBones, ...newBones], inverses), mesh.bindMatrix.clone());
  geometry.attributes.skinIndex.needsUpdate = true; geometry.attributes.skinWeight.needsUpdate = true;
  scene.updateMatrixWorld(true); mesh.skeleton.update();
  const ankles = { config, feet, originalBoneCount: originalBones.length };
  const result = { template: { ...gltf, scene, scenes: gltf.scenes?.map(item => item === gltf.scene ? scene : item) ?? [scene] }, ankles };
  let map = cache.get(gltf); if (!map) { map = new Map(); cache.set(gltf, map); } map.set(key, result); return result;
}

/** Run after the source mixer/root-motion removal, before the tail controller.
 * Unknown clips/rest poses retain the exact rest foot; caller supplies clip name. */
export function createImportedAnkleController(root, orientation, model, prepared) {
  if (!prepared) return null;
  const { config } = prepared, mesh = model.getObjectByName(config.meshName), baseY = orientation.position.y;
  if (!mesh?.isSkinnedMesh) fail('the actor lost its measured mesh');
  const feet = prepared.feet.map((foot, side) => {
    const bones = foot.names.map(name => model.getObjectByName(name)), source = [config.feet[side].sourceFootBone, config.feet[side].sourceToeBone].map(name => model.getObjectByName(name));
    if ([...bones, ...source].some(bone => !bone?.isBone)) fail('the actor lost its private ankle joints');
    return { ...foot, bones, source, axis: new THREE.Vector3(...foot.axis), sourceAxes: foot.sourceAxes.map(axis => new THREE.Vector3(...axis)), rest: bones.map(bone => bone.quaternion.clone()) };
  });
  const matrices = mesh.skeleton.bones.map(() => new THREE.Matrix4()), prefix = new THREE.Matrix4(), delta = new THREE.Quaternion(), reference = new THREE.Quaternion(), rotation = new THREE.Quaternion(), q = new THREE.Quaternion(), up = new THREE.Vector3();
  const usedIndices = [...new Set(feet.flatMap(foot => foot.supports.flatMap(support => [support.a, support.b])))];
  let disposed = false, detailLevel = 0;
  const diagnostics = { id: config.id, articulatedJoints: 4, supportVertices: config.supportVertices, ankleIK: false, method: 'source-clip-measured-ankle-toe-skin', clip: null, moving: false, angles: [[0, 0], [0, 0]], minFootYBefore: null, minFootYAfter: null, visualWorldOffsetY: 0, limited: false, contact: false, feet: feet.map((_, side) => ({ name: config.feet[side].name, minY: null })) };
  const refresh = () => { root.updateWorldMatrix(true, false); root.updateMatrixWorld(true); mesh.skeleton.update(); };
  const update = (clipName, moving = true) => {
    if (disposed || detailLevel > 0 || !root.visible) return;
    const clip = moving ? config.clipReferences[clipName] : null;
    for (let side = 0; side < feet.length; side++) for (let joint = 0; joint < 2; joint++) {
      const foot = feet[side]; let angle = 0;
      if (clip) {
        const name = joint === 0 ? config.feet[side].sourceFootBone : config.feet[side].sourceToeBone;
        reference.fromArray(clip.quaternions[name]).invert(); delta.copy(foot.source[joint].quaternion).multiply(reference).normalize();
        const axis = foot.sourceAxes[joint];
        angle = 2 * Math.atan2(delta.x * axis.x + delta.y * axis.y + delta.z * axis.z, delta.w);
        angle = THREE.MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;
        const gain = joint === 0 ? config.motion.ankleGain : config.motion.toeGain, limit = joint === 0 ? config.motion.maxAnkleRadians : config.motion.maxToeRadians;
        angle = THREE.MathUtils.clamp(angle * gain, -limit, limit);
      }
      foot.bones[joint].quaternion.copy(foot.rest[joint]).multiply(rotation.setFromAxisAngle(foot.axis, angle));
      diagnostics.angles[side][joint] = angle;
    }
    orientation.position.y = baseY; refresh();
    prefix.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
    for (const index of usedIndices) matrices[index].copy(prefix).multiply(mesh.skeleton.bones[index].matrixWorld).multiply(mesh.skeleton.boneInverses[index]).multiply(mesh.bindMatrix);
    let minimum = Infinity;
    feet.forEach((foot, side) => {
      let min = Infinity;
      for (const support of foot.supports) {
        const a = matrices[support.a].elements, b = matrices[support.b].elements, t = support.blend, values = support.coordinates;
        const x = a[1] * (1 - t) + b[1] * t, y = a[5] * (1 - t) + b[5] * t, z = a[9] * (1 - t) + b[9] * t, w = a[13] * (1 - t) + b[13] * t;
        for (let at = 0; at < values.length; at += 3) min = Math.min(min, x * values[at] + y * values[at + 1] + z * values[at + 2] + w);
      }
      diagnostics.feet[side].minY = min; minimum = Math.min(minimum, min);
    });
    diagnostics.minFootYBefore = minimum; diagnostics.clip = clip ? clipName : null; diagnostics.moving = moving;
    root.getWorldQuaternion(q); up.copy(UP).applyQuaternion(q); const verticalGain = root.matrixWorld.elements[5], ground = config.ground;
    let desired = 0;
    if (up.y >= .95 && Math.abs(verticalGain) > 1e-6) {
      const relative = minimum - ground.groundY; desired = ground.clearance - relative;
      if (relative > ground.fullContactBand) { const ratio = THREE.MathUtils.clamp((ground.contactBand - relative) / (ground.contactBand - ground.fullContactBand), 0, 1); desired *= ratio * ratio * (3 - 2 * ratio); }
      diagnostics.contact = relative <= ground.contactBand;
    } else diagnostics.contact = false;
    const offset = THREE.MathUtils.clamp(desired, -ground.maxCorrection, ground.maxCorrection);
    if (offset !== 0) orientation.position.y = baseY + offset / verticalGain;
    diagnostics.visualWorldOffsetY = offset; diagnostics.minFootYAfter = minimum + offset; diagnostics.limited = Math.abs(desired - offset) > 1e-6; refresh();
  };
  const reset = () => { feet.forEach(foot => foot.bones.forEach((bone, index) => bone.quaternion.copy(foot.rest[index]))); orientation.position.y = baseY; refresh(); };
  return { mesh, bones: feet.flatMap(foot => foot.bones), diagnostics, update, reset, setDetailLevel(level) { detailLevel = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 1; }, dispose() { if (disposed) return; reset(); disposed = true; } };
}

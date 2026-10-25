/* GLB character adapter. This module does not load assets or replace Player's model. */
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createYautjaArticulation } from './YautjaArticulation.js';
import { createImportedFootGrounding } from './ImportedFootGrounding.js';

export const IMPORTED_BONE_ALIASES = Object.freeze({
  hips: ['hips', 'pelvis', 'hip'],
  head: ['head', 'headjoint', 'headjnt', 'skull', 'cranium'],
  neck: ['neck', 'neck1', 'neck01'],
  leftArm: ['leftarm', 'leftupperarm', 'upperarml', 'lupperarm', 'arml', 'larm'],
  rightArm: ['rightarm', 'rightupperarm', 'upperarmr', 'rupperarm', 'armr', 'rarm'],
  leftForeArm: ['leftforearm', 'leftlowerarm', 'forearml', 'lowerarml', 'lforearm'],
  rightForeArm: ['rightforearm', 'rightlowerarm', 'forearmr', 'lowerarmr', 'rforearm'],
  leftHand: ['lefthand', 'leftwrist', 'handl', 'wristl', 'lhand'],
  rightHand: ['righthand', 'rightwrist', 'handr', 'wristr', 'rhand'],
  leftLeg: ['leftupleg', 'leftupperleg', 'leftthigh', 'uplegl', 'thighl', 'lthigh'],
  rightLeg: ['rightupleg', 'rightupperleg', 'rightthigh', 'uplegr', 'thighr', 'rthigh'],
  leftLowerLeg: ['leftleg', 'leftlowerleg', 'leftcalf', 'lowerlegl', 'calfl', 'lcalf'],
  rightLowerLeg: ['rightleg', 'rightlowerleg', 'rightcalf', 'lowerlegr', 'calfr', 'rcalf'],
  leftFoot: ['leftfoot', 'footl', 'lfoot', 'leftankle'],
  rightFoot: ['rightfoot', 'footr', 'rfoot', 'rightankle']
});

const ROLES = ['leftArm', 'rightArm', 'leftForeArm', 'rightForeArm', 'leftLeg', 'rightLeg', 'head'];
const COMPONENT = ['getX', 'getY', 'getZ', 'getW'];
const X_AXIS = new THREE.Vector3(1, 0, 0);
const canonical = name => name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(mixamorig\d*|armature|meshy|bip\d+|ccbase)/, '');
const fail = message => { throw new Error(`ImportedCharacter: ${message}`); };

function quaternion(value) {
  let result;
  if (value?.isQuaternion) result = value.clone();
  else if (Array.isArray(value) && value.length === 3) result = new THREE.Quaternion().setFromEuler(new THREE.Euler(...value));
  else if (Array.isArray(value) && value.length === 4) result = new THREE.Quaternion(...value);
  else if (value === undefined) result = new THREE.Quaternion();
  else fail('rotation corrections must be a Quaternion or an array of 3 Euler / 4 quaternion values');
  if (![result.x, result.y, result.z, result.w].every(Number.isFinite) || result.lengthSq() < 1e-12) fail('invalid rotation correction');
  return result.normalize();
}

function validateSource(source, maxVertices) {
  const nodes = new Set(), geometries = new Set();
  source.traverse(node => nodes.add(node));
  let vertices = 0, meshCount = 0;
  source.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (mesh.isInstancedMesh) fail('instanced geometry is not a supported character mesh');
    meshCount++;
    const geometry = mesh.geometry, positions = geometry?.attributes.position;
    if (!positions || positions.itemSize !== 3) fail(`${mesh.name}: missing 3D positions`);
    vertices += positions.count;
    if (vertices > maxVertices) fail(`asset exceeds the ${maxVertices} vertex import budget`);
    if (!geometries.has(geometry)) {
      geometries.add(geometry);
      for (let i = 0; i < positions.count; i++) for (let axis = 0; axis < 3; axis++) {
        if (!Number.isFinite(positions[COMPONENT[axis]](i))) fail(`${mesh.name}: non-finite vertex`);
      }
      const count = geometry.index?.count ?? positions.count;
      const ranges = [...geometry.groups, geometry.drawRange];
      if (count % 3 || ranges.some(range => !Number.isInteger(range.start) || range.start < 0 || range.start % 3 ||
        (range.count !== Infinity && (!Number.isInteger(range.count) || range.count < 0 || range.count % 3)))) fail(`${mesh.name}: triangle ranges must be aligned`);
      if (geometry.index) for (let i = 0; i < count; i++) {
        const index = geometry.index.getX(i);
        if (!Number.isInteger(index) || index < 0 || index >= positions.count) fail(`${mesh.name}: invalid triangle index`);
      }
      for (const targets of Object.values(geometry.morphAttributes)) for (const attribute of targets) {
        if (attribute.count !== positions.count || !Number.isInteger(attribute.itemSize) || attribute.itemSize < 1 || attribute.itemSize > 4) fail(`${mesh.name}: invalid morph attribute`);
        for (let i = 0; i < attribute.count; i++) for (let axis = 0; axis < attribute.itemSize; axis++) {
          if (!Number.isFinite(attribute[COMPONENT[axis]](i))) fail(`${mesh.name}: non-finite morph vertex`);
        }
      }
    }
    if (mesh.morphTargetInfluences?.some(weight => !Number.isFinite(weight))) fail(`${mesh.name}: non-finite morph influence`);
    if (!mesh.isSkinnedMesh) return;
    const bones = mesh.skeleton?.bones, indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
    if (!bones?.length || bones.some(bone => !nodes.has(bone))) fail(`${mesh.name}: all skeleton bones must belong to gltf.scene`);
    const matrices = [mesh.bindMatrix, ...(mesh.skeleton.boneInverses ?? [])];
    if (mesh.skeleton.boneInverses?.length !== bones.length || matrices.some(matrix => !matrix?.elements.every(Number.isFinite) || matrix.determinant() === 0)) fail(`${mesh.name}: invalid bind matrix or bone inverse`);
    if (!indices || !weights || indices.itemSize !== 4 || weights.itemSize !== 4 || indices.count !== positions.count || weights.count !== positions.count) fail(`${mesh.name}: invalid skin attributes`);
    for (let i = 0; i < positions.count; i++) {
      let total = 0;
      for (let slot = 0; slot < 4; slot++) {
        const weight = weights[COMPONENT[slot]](i), index = indices[COMPONENT[slot]](i);
        if (!Number.isFinite(weight) || weight < 0 || (weight > 0 && (!Number.isInteger(index) || index < 0 || index >= bones.length))) fail(`${mesh.name}: invalid skin influence`);
        total += weight;
      }
      if (!Number.isFinite(total) || total <= 0) fail(`${mesh.name}: vertex has no skin influence`);
    }
  });
  if (!meshCount) fail('gltf.scene has no renderable mesh');
}

function findBones(model, boneMap) {
  const available = [];
  model.traverse(node => { if (node.isBone) available.push(node); });
  const bones = {};
  for (const [role, aliases] of Object.entries(IMPORTED_BONE_ALIASES)) {
    const explicit = boneMap[role];
    if (explicit !== undefined && typeof explicit !== 'string') fail(`boneMap.${role} must be a bone name`);
    const names = explicit ? [explicit] : aliases;
    for (const name of names) {
      const exact = available.find(bone => bone.name === name);
      const matches = exact ? [exact] : available.filter(bone => canonical(bone.name) === canonical(name));
      if (matches.length > 1) fail(`ambiguous ${role}; provide its exact boneMap name`);
      if (matches.length) { bones[role] = matches[0]; break; }
    }
    if (explicit && !bones[role]) fail(`boneMap.${role} does not exist: ${explicit}`);
  }
  return bones;
}

// Keep every source triangle once, including triangles outside drawRange. Prefix
// offsets translate groups/drawRange without changing their original visibility.
function indexedPartition(source, flags, wanted) {
  const count = source.index?.count ?? source.attributes.position.count;
  const indices = [], prefix = new Uint32Array(count / 3 + 1);
  for (let face = 0; face < count / 3; face++) {
    prefix[face] = indices.length;
    if (flags[face] === wanted) for (let corner = 0; corner < 3; corner++) {
      const at = face * 3 + corner;
      indices.push(source.index ? source.index.getX(at) : at);
    }
  }
  prefix[count / 3] = indices.length;
  const offset = old => prefix[Math.min(count / 3, old / 3)];
  const geometry = source.clone(); geometry.setIndex(indices); geometry.clearGroups();
  for (const group of source.groups) {
    const start = offset(group.start), end = offset(group.start + group.count);
    if (end > start) geometry.addGroup(start, end - start, group.materialIndex);
  }
  const start = offset(source.drawRange.start), end = offset(source.drawRange.start + source.drawRange.count);
  geometry.setDrawRange(start, end - start);
  return geometry;
}

function headFaces(mesh, headBones, threshold) {
  const geometry = mesh.geometry, indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
  const influence = new Float32Array(indices.count);
  for (let i = 0; i < indices.count; i++) {
    let total = 0, head = 0;
    for (let slot = 0; slot < 4; slot++) {
      const weight = weights[COMPONENT[slot]](i); total += weight;
      if (headBones.has(mesh.skeleton.bones[indices[COMPONENT[slot]](i)])) head += weight;
    }
    influence[i] = head / total;
  }
  const count = geometry.index?.count ?? geometry.attributes.position.count, flags = new Uint8Array(count / 3);
  for (let face = 0; face < flags.length; face++) for (let corner = 0; corner < 3; corner++) {
    const at = face * 3 + corner, index = geometry.index ? geometry.index.getX(at) : at;
    if (influence[index] >= threshold) { flags[face] = 1; break; }
  }
  return flags;
}

/**
 * Prepare an independent GLB visual without changing owner, its controllers or
 * scene. Attach adapter.root below Player.mesh and call update after Player's
 * pose writes. GLTFLoader/cache ownership belongs to the caller.
 *
 * Options: height=4.31; forwardAxis='+z' ('+x','-x','+z','-z', Y remains up);
 * boneMap={role:exactName}; poseOffsets={role:boneLocalEulerOrQuaternion};
 * controls={role:Object3D} overrides owner.leftArm/rightArm/leftLeg/rightLeg;
 * controlRest={role:{quaternion,position:[x,y,z]}} defaults to neutral rotation;
 * headWeightThreshold=.5 (a face is head if ANY vertex reaches that weight);
 * headMeshNames=[] explicitly identifies rigid head accessories;
 * requireHeadPartition=false rejects unsupported FPS rigs when true;
 * maxVertices=2e6, animateWhenUncontrolled=true, skinMaterialNames=[].
 * articulation, articulationOptions optionally describe measured, separately
 * bound Yautja strands/mechanisms. Bindings resolve against this private clone;
 * cached node references and animation-controlled body bones are rejected.
 * update(delta,moving,{paused,detailLevel,wind}) advances articulation after the
 * body pose; hidden heads suspend strands. Commands use adapter.articulation.
 *
 * root is normalized in character units, with feet at Y0 and X/Z centered.
 * bones contains mapped cloned bones; sockets exposes actual bone attachments
 * (bone-local units, calibration required). materials are per-instance clones;
 * material textures/clips remain shared cache assets and are never disposed.
 * No clips autoplay and no T/A-pose correction is guessed. This adapter poses
 * joints, not a complete animation retargeter, locomotion system or IK solver.
 */
export function createImportedCharacter(owner, gltf, options = {}) {
  owner ||= {};
  const height = options.height ?? 4.31, maxVertices = options.maxVertices ?? 2_000_000;
  const headWeightThreshold = options.headWeightThreshold ?? 0.5;
  const forwardAxis = options.forwardAxis ?? '+z', yaw = { '+z': 0, z: 0, '-z': Math.PI, '+x': -Math.PI / 2, x: -Math.PI / 2, '-x': Math.PI / 2 }[forwardAxis];
  if (!gltf?.scene?.isObject3D) fail('a loaded glTF scene is required');
  if (!Number.isFinite(height) || height <= 0 || !Number.isInteger(maxVertices) || maxVertices <= 0) fail('height and vertex budget must be positive');
  if (yaw === undefined) fail('forwardAxis must be +z, -z, +x or -x with Y up');
  if (!Number.isFinite(headWeightThreshold) || headWeightThreshold <= 0 || headWeightThreshold > 1) fail('headWeightThreshold must be between 0 and 1');
  validateSource(gltf.scene, maxVertices);

  const root = new THREE.Group(); root.name = 'imported-character';
  const orientation = new THREE.Group(); orientation.rotation.y = yaw; root.add(orientation);
  const geometries = new Set(), materialSet = new Set(), skeletons = new Set();
  let disposed = false, articulation = null, footGrounding = null;
  const dispose = () => {
    if (disposed) return;
    disposed = true; footGrounding?.dispose(); articulation?.dispose(); root.removeFromParent();
    geometries.forEach(geometry => geometry.dispose());
    materialSet.forEach(material => material.dispose());
    skeletons.forEach(skeleton => skeleton.dispose());
  };
  try {
    const model = cloneSkeleton(gltf.scene); orientation.add(model);
    const bones = findBones(model, options.boneMap ?? {});
    const headBones = new Set(); bones.head?.traverse(node => { if (node.isBone) headBones.add(node); });
    const headNames = new Set(options.headMeshNames ?? []), meshes = [];
    model.traverse(node => { if (node.isMesh) meshes.push(node); });
    const geometryCache = new Map(), materialCache = new Map(), headMeshes = [], morphPairs = [];
    const ownGeometry = source => {
      if (!geometryCache.has(source)) { const copy = source.clone(); geometryCache.set(source, copy); geometries.add(copy); }
      return geometryCache.get(source);
    };
    const ownMaterial = material => {
      if (!material?.isMaterial) fail('mesh has no valid material');
      if (!materialCache.has(material)) { const copy = material.clone(); materialCache.set(material, copy); materialSet.add(copy); }
      return materialCache.get(material);
    };
    for (const mesh of meshes) {
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(ownMaterial) : ownMaterial(mesh.material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      if (mesh.isSkinnedMesh) {
        if (!skeletons.has(mesh.skeleton)) {
          // SkeletonUtils clones bones, but Three's Skeleton.clone shares inverses.
          mesh.skeleton.boneInverses = mesh.skeleton.boneInverses.map(inverse => inverse.clone());
          skeletons.add(mesh.skeleton);
        }
        // Static bounds are invalid after controller animation; keep them conservative
        // until an integration adds animation-aware culling or per-clip bounds.
        mesh.frustumCulled = false;
        const flags = headFaces(mesh, headBones, headWeightThreshold), count = flags.reduce((sum, flag) => sum + flag, 0);
        if (count && count < flags.length) {
          const original = mesh.geometry;
          mesh.geometry = indexedPartition(original, flags, 0); geometries.add(mesh.geometry);
          const head = mesh.clone(false); head.name = `${mesh.name || 'mesh'}-head-partition`;
          head.geometry = indexedPartition(original, flags, 1); geometries.add(head.geometry);
          head.skeleton = mesh.skeleton;
          if (mesh.morphTargetInfluences) head.morphTargetInfluences = mesh.morphTargetInfluences;
          mesh.userData.importedPartition = 'body'; head.userData.importedPartition = 'head';
          mesh.parent.add(head); headMeshes.push(head); morphPairs.push([mesh, head]);
        } else {
          mesh.geometry = ownGeometry(mesh.geometry);
          if (count) { mesh.userData.importedPartition = 'head'; headMeshes.push(mesh); }
        }
      } else {
        mesh.geometry = ownGeometry(mesh.geometry);
        let ancestor = mesh.parent;
        while (ancestor && !headBones.has(ancestor)) ancestor = ancestor.parent;
        if (ancestor || headNames.has(mesh.name)) headMeshes.push(mesh);
      }
    }
    if (options.requireHeadPartition && !headMeshes.length) fail('head triangles cannot be identified; provide a head boneMap or rigid headMeshNames before enabling FPS');
    for (const [role, offset] of Object.entries(options.poseOffsets ?? {})) {
      if (!bones[role]) fail(`poseOffsets.${role} has no mapped bone`);
      bones[role].quaternion.multiply(quaternion(offset));
    }
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root, true), size = bounds.getSize(new THREE.Vector3());
    if (![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite) || size.y <= 1e-7) fail('asset has no finite standing height');
    const scale = height / size.y;
    orientation.scale.setScalar(scale);
    orientation.position.set(-(bounds.min.x + bounds.max.x) * scale / 2, -bounds.min.y * scale, -(bounds.min.z + bounds.max.z) * scale / 2);
    root.updateMatrixWorld(true);

    const controls = {};
    for (const role of ROLES) controls[role] = options.controls?.[role] ?? owner[role === 'head' ? 'headMesh' : role] ?? null;
    const bindings = [];
    for (const role of ROLES) if (bones[role]) {
      const bone = bones[role], control = controls[role], rest = options.controlRest?.[role];
      const controlPosition = new THREE.Vector3();
      if (rest?.position) controlPosition.fromArray(rest.position);
      else if (control) controlPosition.copy(control.position);
      if (role === 'leftArm' && !rest?.position && Number.isFinite(owner._leftArmRestX)) controlPosition.x = owner._leftArmRestX;
      if (!controlPosition.toArray().every(Number.isFinite)) fail(`invalid controlRest.${role}.position`);
      bindings.push({ role, bone, controlPosition, controlInverse: quaternion(rest?.quaternion).invert(),
        restQuaternion: bone.quaternion.clone(), restPosition: bone.position.clone() });
    }
    const depth = node => { let count = 0; while (node.parent) { count++; node = node.parent; } return count; };
    bindings.sort((a, b) => depth(a.bone) - depth(b.bone));
    const sockets = {}, socketFallbacks = {};
    for (const role of ['leftArm', 'rightArm', 'leftHand', 'rightHand', 'head']) {
      const side = role.startsWith('left') ? 'left' : 'right';
      const target = bones[role] ?? (role.endsWith('Hand') ? bones[`${side}ForeArm`] ?? bones[`${side}Arm`] : null);
      if (!target) continue;
      const socket = new THREE.Group(); socket.name = `imported-socket-${role}`; target.add(socket); sockets[role] = socket;
      socket.userData.boneName = target.name;
      if (!bones[role]) socketFallbacks[role] = target.name;
    }
    const materials = [...materialSet], skinNames = new Set(options.skinMaterialNames ?? []);
    const skinMaterials = materials.filter(material => skinNames.has(material.name) || /skin|flesh/i.test(material.name));
    const armorMaterials = materials.filter(material => !skinMaterials.includes(material));
    const originallyVisible = new Map(headMeshes.map(mesh => [mesh, mesh.visible]));
    let headOverride = null, phase = 0;
    const headVisible = () => headOverride ?? owner.headMesh?.visible ?? true;
    const syncHead = () => {
      const visible = headVisible();
      for (const mesh of headMeshes) mesh.visible = visible && originallyVisible.get(mesh);
    };
    const setHeadVisible = visible => {
      if (disposed || (visible === false && !headMeshes.length)) return false;
      headOverride = visible === null ? null : Boolean(visible); syncHead(); return true;
    };
    const deltaQ = new THREE.Quaternion(), localQ = new THREE.Quaternion();
    const rootInverse = new THREE.Quaternion(), parentRotation = new THREE.Quaternion(), parentInverse = new THREE.Quaternion();
    const inverseParent = new THREE.Matrix4(), linear = new THREE.Matrix3(), offset = new THREE.Vector3();
    if (options.articulation !== undefined) {
      articulation = createYautjaArticulation(root, options.articulation, {
        ...options.articulationOptions,
        forbiddenNodes: [...Object.values(bones), ...(options.articulationOptions?.forbiddenNodes ?? [])]
      });
    }
    if (options.footGrounding !== undefined) {
      footGrounding = createImportedFootGrounding(root, options.footGrounding, { sourceSha256: options.sourceSha256 });
    }
    const update = (delta = 0, moving = false, state = {}) => {
      if (disposed) return false;
      if (!Number.isFinite(delta) || delta < 0) fail('update delta must be finite and nonnegative');
      phase = (phase + Math.min(delta, 1) * 6) % (Math.PI * 2);
      root.updateMatrixWorld(true);
      root.getWorldQuaternion(rootInverse).invert();
      for (const binding of bindings) {
        const { role, bone, restQuaternion, restPosition } = binding, control = controls[role];
        deltaQ.identity();
        if (control) deltaQ.copy(control.quaternion).multiply(binding.controlInverse);
        else if (moving && options.animateWhenUncontrolled !== false && /^(left|right)(Arm|Leg)$/.test(role)) {
          const sign = role.startsWith('left') ? 1 : -1, amplitude = role.endsWith('Leg') ? 0.35 : -0.16;
          deltaQ.setFromAxisAngle(X_AXIS, Math.sin(phase) * sign * amplitude);
        }
        if (footGrounding && (role === 'leftLeg' || role === 'rightLeg')) {
          localQ.identity().slerp(deltaQ, options.footGrounding.motionGain); deltaQ.copy(localQ);
        }
        bone.parent.getWorldQuaternion(parentRotation).premultiply(rootInverse);
        parentInverse.copy(parentRotation).invert();
        localQ.copy(parentInverse).multiply(deltaQ).multiply(parentRotation);
        bone.quaternion.copy(localQ).multiply(restQuaternion); bone.position.copy(restPosition);
        if (control) {
          offset.copy(control.position).sub(binding.controlPosition);
          linear.setFromMatrix4(root.matrixWorld); offset.applyMatrix3(linear);
          inverseParent.copy(bone.parent.matrixWorld).invert(); linear.setFromMatrix4(inverseParent); offset.applyMatrix3(linear);
          bone.position.add(offset);
        }
        bone.updateMatrixWorld(true);
      }
      for (const [body, head] of morphPairs) head.morphTargetInfluences = body.morphTargetInfluences;
      syncHead(); root.updateMatrixWorld(true);
      skeletons.forEach(skeleton => skeleton.update());
      footGrounding?.apply();
      articulation?.update(delta, { ...state, headVisible: headVisible() && state.headVisible !== false });
      skeletons.forEach(skeleton => skeleton.update());
      return true;
    };
    syncHead();
    return { root, model, bones, controls, sockets, materials, skinMaterials, armorMaterials,
      headMeshes, getHeadRestVisibility: mesh => originallyVisible.get(mesh) ?? null,
      canHideHead: headMeshes.length > 0, animations: gltf.animations ?? [],
      diagnostics: { mappedBones: Object.fromEntries(Object.entries(bones).map(([role, bone]) => [role, bone.name])),
        missingBones: ['leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'head'].filter(role => !bones[role]),
        missingControls: ROLES.filter(role => !controls[role]),
        footGrounding: footGrounding?.diagnostics ?? null,
        socketFallbacks, normalizationScale: scale, targetHeight: height, forwardAxis, sharedTextures: true },
      articulation, footGrounding, get visualGroundOffsetY() { return footGrounding?.offsetY ?? 0; }, update, setHeadVisible, dispose };
  } catch (error) { dispose(); throw error; }
}

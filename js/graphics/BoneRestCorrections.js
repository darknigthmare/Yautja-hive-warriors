/* Measured rest pivots on a private, detached skeleton; no loading or animation rebasing. */
import * as THREE from 'three';

const fail = message => { throw new Error(`BoneRestCorrections: ${message}`); };
const HASH = /^[a-f0-9]{64}$/i;
const finiteMatrix = matrix => matrix?.elements.every(Number.isFinite) && Math.abs(matrix.determinant()) > 1e-20;
const snapshotNode = node => ({ node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(), matrix: node.matrix.clone(), matrixWorld: node.matrixWorld.clone(), matrixAutoUpdate: node.matrixAutoUpdate, matrixWorldAutoUpdate: node.matrixWorldAutoUpdate, matrixWorldNeedsUpdate: node.matrixWorldNeedsUpdate });
const matrixError = (a, b) => Math.max(...a.elements.map((value, index) => Math.abs(value - b.elements[index])));

/**
 * applyBoneRestCorrections(scene, descriptor, {sourceSha256, privateScene:true})
 *
 * The caller MUST supply its detached private scene clone, never a cached GLTF
 * template. No geometry, attribute, material, texture, clip or hierarchy is
 * rewritten. Existing selected joints move to measured parent-local positions;
 * their rotation and scale remain unchanged, and every descendant keeps its
 * complete world rest transform. All skeleton inverse-bind arrays/matrices are
 * cloned before any joint moves, including shared matrices in separate skins.
 * Every skin receives inverseNew = inverse(worldNew) * worldOld * inverseOld.
 * All rendered vertices and all unselected node world matrices are proved at
 * rest within1e-6; failure restores local/world transforms, flags, bind matrices
 * and original inverse-bind array identities. Success owns only new matrices.
 *
 * Descriptor: {version:1,calibrated:true,sourceSha256,joints:[
 *   {bone:'ExactExistingName',parent:'ExactExistingParent',position:[x,y,z]}
 * ]}. Measured joints must be distinct and in separate hierarchy branches.
 * A source hash fixes the input topology; counts and skin attributes are also
 * checked locally. Clips are outside this API: the caller must disable/remove
 * old local-transform clips on its private GLTF wrapper, without editing cache.
 */
export function applyBoneRestCorrections(scene, descriptor, { sourceSha256, privateScene = false } = {}) {
  if (!scene?.isObject3D || scene.parent) fail('a detached scene root is required');
  if (privateScene !== true) fail('the caller must explicitly provide a private scene clone');
  if (!HASH.test(sourceSha256 ?? '') || !HASH.test(descriptor?.sourceSha256 ?? '') || sourceSha256.toLowerCase() !== descriptor.sourceSha256.toLowerCase()) fail('measured source SHA-256 does not match');
  if (descriptor.version !== 1 || descriptor.calibrated !== true || !Array.isArray(descriptor.joints) || !descriptor.joints.length || descriptor.joints.length > 32) fail('calibrated version1 measured joints are required');
  const nodes = [], meshes = [], skeletons = new Set();
  scene.traverse(node => { nodes.push(node); if (node.isMesh) meshes.push(node); if (node.isSkinnedMesh) skeletons.add(node.skeleton); });
  const nodeSet = new Set(nodes), selected = new Set(), joints = [];
  for (const specification of descriptor.joints) {
    const { bone: name, parent, position } = specification;
    if (typeof name !== 'string' || !name.trim() || typeof parent !== 'string' || !parent.trim()) fail('exact measured joint and parent names are required');
    const matches = nodes.filter(node => node.isBone && node.name === name);
    if (matches.length !== 1 || selected.has(matches[0])) fail(`joint ${name} is missing, ambiguous or duplicated`);
    const joint = matches[0];
    if (!joint.parent || joint.parent.name !== parent || !nodeSet.has(joint.parent)) fail(`joint ${name} has a different measured parent`);
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) fail('measured parent-local positions must contain three finite values');
    if (joint.matrixWorldAutoUpdate === false) fail('measured joints require derived world transforms');
    selected.add(joint); joints.push({ joint, specification });
  }
  for (const joint of selected) {
    for (let parent = joint.parent; parent; parent = parent.parent) if (selected.has(parent)) fail('measured joints in the same ancestor branch require a separate calibration');
    if (![...skeletons].some(skeleton => skeleton?.bones.includes(joint))) fail(`joint ${joint.name} does not belong to a scene skin`);
  }
  let triangles = 0, vertices = 0;
  for (const mesh of meshes) {
    const geometry = mesh.geometry, position = geometry?.attributes?.position, count = geometry?.index?.count ?? position?.count;
    if (!position || position.itemSize !== 3 || !position.count || !Number.isInteger(count) || count % 3) fail('finite triangle topology is required');
    if (geometry.index) for (let index = 0; index < count; index++) { const vertex = geometry.index.getX(index); if (!Number.isInteger(vertex) || vertex < 0 || vertex >= position.count) fail('invalid triangle vertex'); }
    vertices += position.count; triangles += count / 3;
    if (!mesh.isSkinnedMesh) continue;
    const skeleton = mesh.skeleton, indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
    if (!skeleton?.bones.length || skeleton.bones.length !== skeleton.boneInverses.length || skeleton.bones.some(bone => !bone?.isBone || !nodeSet.has(bone)) || skeleton.boneInverses.some(matrix => !finiteMatrix(matrix)) || !finiteMatrix(mesh.bindMatrix) || !finiteMatrix(mesh.bindMatrixInverse)) fail('invalid or foreign skin binding');
    if (!indices || !weights || indices.itemSize !== 4 || weights.itemSize !== 4 || indices.count !== position.count || weights.count !== position.count || indices.normalized) fail('four unnormalized skin indices and weights are required');
    for (let vertex = 0; vertex < position.count; vertex++) {
      let total = 0;
      for (let slot = 0; slot < 4; slot++) {
        const bone = indices.getComponent(vertex, slot), weight = weights.getComponent(vertex, slot);
        if (!Number.isInteger(bone) || bone < 0 || bone >= skeleton.bones.length || !Number.isFinite(weight) || weight < 0 || weight > 1) fail('invalid skin influence');
        total += weight;
      }
      if (Math.abs(total - 1) > 1e-4) fail('skin weights must already be normalized');
    }
  }
  const savedNodes = nodes.map(snapshotNode);
  const savedSkins = meshes.filter(mesh => mesh.isSkinnedMesh).map(mesh => ({ mesh, bind: mesh.bindMatrix.clone(), inverse: mesh.bindMatrixInverse.clone() }));
  const savedSkeletons = new Map([...skeletons].map(skeleton => [skeleton, skeleton.boneInverses]));
  const restore = () => {
    for (const state of savedNodes) {
      const node = state.node;
      node.position.copy(state.position);
      // Pivot translation never changes a quaternion. Avoid firing its Euler
      // callback when unchanged: a valid multi-turn Euler representation would
      // otherwise be canonicalized during an unrelated failed transaction.
      if (!node.quaternion.equals(state.quaternion)) node.quaternion.copy(state.quaternion);
      node.scale.copy(state.scale);
      node.matrix.copy(state.matrix); node.matrixWorld.copy(state.matrixWorld);
      node.matrixAutoUpdate = state.matrixAutoUpdate; node.matrixWorldAutoUpdate = state.matrixWorldAutoUpdate; node.matrixWorldNeedsUpdate = state.matrixWorldNeedsUpdate;
    }
    for (const [skeleton, inverses] of savedSkeletons) skeleton.boneInverses = inverses;
    for (const { mesh, bind, inverse } of savedSkins) { mesh.bindMatrix.copy(bind); mesh.bindMatrixInverse.copy(inverse); }
  };
  try {
    scene.updateMatrixWorld(true);
    if (nodes.some(node => !finiteMatrix(node.matrixWorld))) fail('nonfinite or singular world rest transform');
    const oldWorld = new Map(nodes.map(node => [node, node.matrixWorld.clone()]));
    const oldLocal = new Map(nodes.map(node => [node, node.matrix.clone()]));
    const surfaces = [], point = new THREE.Vector3();
    for (const mesh of meshes) {
      const count = mesh.geometry.attributes.position.count, world = new Float64Array(count * 3);
      for (let vertex = 0; vertex < count; vertex++) {
        mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld);
        if (!point.toArray().every(Number.isFinite)) fail('nonfinite world rest surface');
        point.toArray(world, vertex * 3);
      }
      surfaces.push({ mesh, world });
    }
    // No inverse object borrowed from any caller/cache is ever changed.
    for (const skeleton of skeletons) skeleton.boneInverses = skeleton.boneInverses.map(matrix => matrix.clone());
    const corrections = [];
    for (const { joint, specification } of joints) {
      joint.position.fromArray(specification.position);
      if (joint.matrixAutoUpdate) joint.updateMatrix();
      else joint.matrix.setPosition(joint.position);
      joint.matrixWorldNeedsUpdate = true; scene.updateMatrixWorld(true);
      if (!finiteMatrix(joint.matrixWorld)) fail('singular corrected joint transform');
      const inverse = joint.matrixWorld.clone().invert();
      for (const child of joint.children) {
        if (child.matrixWorldAutoUpdate === false) fail('preserved descendants require derived world transforms');
        const local = inverse.clone().multiply(oldWorld.get(child)), before = oldLocal.get(child);
        // A pivot translation must not hide a rotation/scale/shear rewrite.
        for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15]) if (Math.abs(local.elements[index] - before.elements[index]) > 1e-7) fail('descendant linear rest transform would change');
        child.position.setFromMatrixPosition(local);
        child.matrix.copy(before).setPosition(child.position); child.matrixWorldNeedsUpdate = true;
      }
      scene.updateMatrixWorld(true);
      corrections.push({ bone: joint.name, parent: joint.parent.name, oldParentPosition: savedNodes.find(state => state.node === joint).position.toArray(), parentPosition: joint.position.toArray(), oldWorldPosition: new THREE.Vector3().setFromMatrixPosition(oldWorld.get(joint)).toArray(), worldPosition: new THREE.Vector3().setFromMatrixPosition(joint.matrixWorld).toArray() });
    }
    let maxDescendantWorldError = 0, preservedNodes = 0;
    for (const node of nodes) if (!selected.has(node)) {
      const error = matrixError(node.matrixWorld, oldWorld.get(node));
      if (!Number.isFinite(error) || error > 1e-6) fail('an unselected descendant world rest transform changed');
      maxDescendantWorldError = Math.max(maxDescendantWorldError, error); preservedNodes++;
    }
    for (const skeleton of skeletons) for (let index = 0; index < skeleton.bones.length; index++) {
      const bone = skeleton.bones[index], before = savedSkeletons.get(skeleton)[index];
      if (!finiteMatrix(bone.matrixWorld)) fail('invalid corrected bone world transform');
      const corrected = bone.matrixWorld.clone().invert().multiply(oldWorld.get(bone)).multiply(before);
      if (!finiteMatrix(corrected)) fail('invalid compensated inverse binding');
      skeleton.boneInverses[index].copy(corrected);
    }
    let maxRestWorldError = 0;
    for (const { mesh, world } of surfaces) for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) {
      mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld);
      const at = vertex * 3, error = Math.hypot(point.x - world[at], point.y - world[at + 1], point.z - world[at + 2]);
      if (!Number.isFinite(error) || error > 1e-6) fail('corrected binding changes a world rest surface');
      maxRestWorldError = Math.max(maxRestWorldError, error);
    }
    const diagnostics = { applied: true, sourceSha256: sourceSha256.toLowerCase(), correctedJoints: corrections.length, joints: corrections, skeletons: skeletons.size, inverseBindMatricesCloned: [...skeletons].reduce((total, skeleton) => total + skeleton.bones.length, 0), meshes: meshes.length, verticesVerified: vertices, trianglesVerified: triangles, unselectedWorldTransformsVerified: preservedNodes, maxDescendantWorldError, maxRestWorldError, geometryModified: false, animationsRebased: false };
    return { applied: true, diagnostics };
  } catch (error) {
    restore();
    if (String(error.message).startsWith('BoneRestCorrections:')) throw error;
    fail(error.message ?? 'transaction failed');
  }
}

/* Visual-only contact for a measured rigid leg region. No loading or physics. */
import * as THREE from 'three';

const CLAIMS = new WeakSet();
const COMPONENT = ['getX', 'getY', 'getZ', 'getW'];
const EPSILON = 1e-6;
const fail = message => { throw new Error(`ImportedFootGrounding: ${message}`); };
const finiteMatrix = matrix => matrix.elements.every(Number.isFinite) && Math.abs(matrix.determinant()) > 1e-15;
const difference = (a, b) => Math.max(...a.elements.map((value, i) => Math.abs(value - b.elements[i])));
const belongsTo = (bone, ancestor) => {
  for (let node = bone; node; node = node.parent) if (node === ancestor) return true;
  return false;
};

/**
 * Create after normalization, at the calibrated rest pose, on a PRIVATE clone.
 * config={version:1,calibrated:true,sourceSha256,motionGain,maxOffset,regions:[
 *   {regionId,upLegBone,vertexCount,triangleCount,supportVertexIndices,restSupportYZ}
 * ]}. restSupportYZ is the counterclockwise convex hull of ALL referenced leg
 * vertices, measured in root.parent's rest frame (Y/Z, game units). Its indices
 * address the actual compact SkinnedMesh geometry, including any FPS partition.
 *
 * The caller applies motionGain to the leg controllers. After posing bones,
 * apply() plants the lowest measured support at parent-local Y0 using ONLY the
 * visual root's Y. It corrects floating and penetration, without clamping an
 * unsafe offset. The measured region must stay rigid below its upper-leg bone;
 * calf/foot animation, morphing or Y projection depending on X are rejected.
 * Runtime refusal resets this controller's offset and returns false. This is
 * closest-foot grounding, not per-foot IK, a gait retargeter or anti-sliding.
 * reset/dispose restore the original root Y; no shared resources are disposed.
 */
export function createImportedFootGrounding(root, config, { sourceSha256 } = {}) {
  if (!root?.isObject3D || config?.version !== 1 || config.calibrated !== true) fail('a rendered root and calibrated version1 descriptor are required');
  if (CLAIMS.has(root)) fail('root already has a grounding controller');
  if (!/^[a-f0-9]{64}$/.test(config.sourceSha256 ?? '') || sourceSha256 !== config.sourceSha256) fail('source SHA256 does not match calibration');
  const { motionGain, maxOffset } = config;
  if (!Number.isFinite(motionGain) || motionGain <= 0 || motionGain > 1) fail('motionGain must be in (0,1]');
  if (!Number.isFinite(maxOffset) || maxOffset <= 0 || maxOffset > 0.15) fail('maxOffset must be in (0,.15] game units');
  if (!Array.isArray(config.regions) || config.regions.length !== 2) fail('exactly two measured leg regions are required');
  const initialY = root.position.y, skeletons = new Set(), nodes = [], ids = new Set(), upLegs = new Set();
  if (!Number.isFinite(initialY)) fail('root Y must be finite');
  root.traverse(node => { nodes.push(node); if (node.isSkinnedMesh) skeletons.add(node.skeleton); });
  const parentInverse = new THREE.Matrix4(), point = new THREE.Vector3(), relative = new THREE.Matrix4();
  const refresh = () => {
    root.parent?.updateWorldMatrix(true, false);
    // SkinnedMesh.updateMatrixWorld also refreshes its derived bind inverse.
    root.updateMatrixWorld(true);
    skeletons.forEach(skeleton => skeleton.update());
    if (root.parent) parentInverse.copy(root.parent.matrixWorld).invert(); else parentInverse.identity();
    if (!finiteMatrix(parentInverse)) fail('invalid actor parent transform');
  };
  const actorMatrix = node => new THREE.Matrix4().multiplyMatrices(parentInverse, node.matrixWorld);
  const positionAt = (mesh, index) => mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld).applyMatrix4(parentInverse);
  refresh();
  const regions = config.regions.map(spec => {
    if (typeof spec.regionId !== 'string' || !spec.regionId || ids.has(spec.regionId)) fail('region ids must be unique');
    ids.add(spec.regionId);
    const found = nodes.filter(node => node.isSkinnedMesh && (node.userData.importedPartRegion?.id ?? node.name) === spec.regionId);
    if (found.length !== 1) fail(`missing or ambiguous region ${spec.regionId}`);
    const mesh = found[0], geometry = mesh.geometry, positions = geometry.attributes.position;
    const count = geometry.index?.count ?? positions?.count;
    if (positions?.itemSize !== 3 || positions.count !== spec.vertexCount || count / 3 !== spec.triangleCount) fail(`${spec.regionId}: geometry count differs from calibration`);
    if (mesh.morphTargetInfluences?.some(weight => weight !== 0)) fail(`${spec.regionId}: active morphs are not calibrated`);
    const candidates = nodes.filter(node => node.isBone && node.name === spec.upLegBone);
    if (candidates.length !== 1 || upLegs.has(candidates[0])) fail(`${spec.regionId}: missing, ambiguous or duplicate upper-leg bone`);
    const upLeg = candidates[0]; upLegs.add(upLeg);
    const indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
    if (indices?.itemSize !== 4 || weights?.itemSize !== 4 || indices.count !== positions.count || weights.count !== positions.count) fail(`${spec.regionId}: invalid skin attributes`);
    const referenced = new Set();
    for (let at = 0; at < count; at++) {
      const vertex = geometry.index ? geometry.index.getX(at) : at;
      if (!Number.isInteger(vertex) || vertex < 0 || vertex >= positions.count) fail(`${spec.regionId}: invalid triangle index`);
      referenced.add(vertex);
    }
    const influenced = new Set();
    for (const vertex of referenced) {
      let total = 0;
      for (let slot = 0; slot < 4; slot++) {
        const weight = weights[COMPONENT[slot]](vertex), index = indices[COMPONENT[slot]](vertex);
        if (!Number.isFinite(weight) || weight < 0) fail(`${spec.regionId}: invalid skin weight`);
        total += weight;
        if (weight > 0) {
          const bone = Number.isInteger(index) ? mesh.skeleton.bones[index] : null;
          if (!bone || !belongsTo(bone, upLeg)) fail(`${spec.regionId}: foreign influence outside ${upLeg.name}`);
          influenced.add(bone);
        }
      }
      if (Math.abs(total - 1) > EPSILON) fail(`${spec.regionId}: skin weights must sum to one`);
    }
    const support = spec.supportVertexIndices, hull = spec.restSupportYZ;
    if (!Array.isArray(support) || support.length < 3 || support.length > 256 || new Set(support).size !== support.length ||
      support.some(index => !referenced.has(index)) || !Array.isArray(hull) || hull.length !== support.length ||
      hull.some(yz => !Array.isArray(yz) || yz.length !== 2 || !yz.every(Number.isFinite))) fail(`${spec.regionId}: invalid support hull`);
    let restError = 0, area = 0, coverageError = 0;
    for (let i = 0; i < support.length; i++) {
      const value = positionAt(mesh, support[i]), a = hull[i], b = hull[(i + 1) % hull.length], c = hull[(i + 2) % hull.length];
      restError = Math.max(restError, Math.abs(value.y - a[0]), Math.abs(value.z - a[1]));
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) <= 1e-12 ||
        (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-12) fail(`${spec.regionId}: hull must be convex and counterclockwise`);
      area += a[0] * b[1] - a[1] * b[0];
    }
    if (area <= 1e-10 || restError > EPSILON) fail(`${spec.regionId}: support rest calibration differs`);
    // An incomplete sole band is unsafe: certify containment of the entire leg.
    for (const vertex of referenced) {
      const value = positionAt(mesh, vertex);
      if (!value.toArray().every(Number.isFinite)) fail(`${spec.regionId}: non-finite rest vertex`);
      for (let i = 0; i < hull.length; i++) {
        const a = hull[i], b = hull[(i + 1) % hull.length], dy = b[0] - a[0], dz = b[1] - a[1];
        coverageError = Math.max(coverageError, -(dy * (value.z - a[1]) - dz * (value.y - a[0])) / Math.hypot(dy, dz));
      }
    }
    if (coverageError > EPSILON) fail(`${spec.regionId}: support hull does not contain all referenced vertices`);
    const restUpLeg = actorMatrix(upLeg), inverseUpLegWorld = upLeg.matrixWorld.clone().invert();
    if (!finiteMatrix(restUpLeg)) fail(`${spec.regionId}: invalid upper-leg transform`);
    return { mesh, upLeg, support: [...support], restUpLegInverse: restUpLeg.invert(),
      descendants: [...influenced].map(bone => ({ bone, relative: new THREE.Matrix4().multiplyMatrices(inverseUpLegWorld, bone.matrixWorld) })),
      diagnostics: { regionId: spec.regionId, supportVertices: support.length, referencedVertices: referenced.size, restError, coverageError } };
  });
  let restMinimumY = Infinity;
  for (const region of regions) for (const index of region.support) restMinimumY = Math.min(restMinimumY, positionAt(region.mesh, index).y);
  if (!Number.isFinite(restMinimumY) || Math.abs(restMinimumY) > maxOffset) fail('rest contact exceeds calibrated visual offset bound');
  const diagnostics = { status: 'ready', sourceSha256, motionGain, maxOffset, restMinimumY, regions: regions.map(region => region.diagnostics),
    offsetY: 0, minimumYBeforeOffset: null, minimumYAfterOffset: null, maxObservedAbsoluteOffset: 0, refusals: 0, lastError: null, lastRejectedOffsetY: null };
  let offsetY = 0, disposed = false;
  const reset = () => {
    if (disposed) return false;
    root.position.y = initialY; offsetY = 0; diagnostics.offsetY = 0; diagnostics.status = 'reset';
    diagnostics.lastError = null; diagnostics.minimumYBeforeOffset = null; diagnostics.minimumYAfterOffset = null;
    // Even an invalid external parent transform must not prevent restoring Y.
    try { refresh(); } catch (error) { diagnostics.lastError = error.message; }
    return true;
  };
  const refuse = (message, rejectedOffset = null) => {
    reset(); diagnostics.status = 'refused'; diagnostics.lastError = message; diagnostics.refusals++;
    diagnostics.lastRejectedOffsetY = rejectedOffset; diagnostics.minimumYAfterOffset = null; return false;
  };
  const apply = () => {
    if (disposed) return false;
    try {
      if (!Number.isFinite(root.position.y) || Math.abs(root.position.y - initialY - offsetY) > EPSILON) return refuse('visual root Y changed outside grounding controller');
      refresh(); let minimum = Infinity;
      for (const region of regions) {
        if (region.mesh.morphTargetInfluences?.some(weight => weight !== 0)) return refuse(`${region.diagnostics.regionId}: morph pose is not calibrated`);
        const current = actorMatrix(region.upLeg), delta = current.clone().multiply(region.restUpLegInverse);
        if (!finiteMatrix(current) || Math.abs(delta.elements[1]) > EPSILON) return refuse(`${region.diagnostics.regionId}: Y projection depends on X`);
        const inverse = region.upLeg.matrixWorld.clone().invert();
        for (const { bone, relative: rest } of region.descendants) {
          relative.multiplyMatrices(inverse, bone.matrixWorld);
          if (difference(relative, rest) > EPSILON) return refuse(`${region.diagnostics.regionId}: calf/foot relative pose changed`);
        }
        for (const index of region.support) minimum = Math.min(minimum, positionAt(region.mesh, index).y);
      }
      const baseMinimum = minimum - offsetY, desired = -baseMinimum;
      diagnostics.minimumYBeforeOffset = baseMinimum;
      if (!Number.isFinite(desired) || Math.abs(desired) > maxOffset) return refuse('required visual offset exceeds calibrated bound', desired);
      root.position.y = initialY + desired; offsetY = desired; refresh();
      diagnostics.offsetY = offsetY; diagnostics.minimumYAfterOffset = baseMinimum + offsetY;
      diagnostics.maxObservedAbsoluteOffset = Math.max(diagnostics.maxObservedAbsoluteOffset, Math.abs(offsetY));
      diagnostics.lastError = null; diagnostics.lastRejectedOffsetY = null; diagnostics.status = 'applied'; return true;
    } catch (error) { return refuse(error.message); }
  };
  const dispose = () => { if (disposed) return; reset(); disposed = true; diagnostics.status = 'disposed'; CLAIMS.delete(root); };
  CLAIMS.add(root);
  return { apply, reset, dispose, get offsetY() { return offsetY; }, diagnostics };
}

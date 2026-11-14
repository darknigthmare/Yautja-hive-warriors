/* Runtime skinning for explicitly measured hair pieces; no loading or asset export. */
import * as THREE from 'three';

const fail = message => { throw new Error(`SplitDreadlockRig: ${message}`); };
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$/;
const COMPONENT = ['getX', 'getY', 'getZ', 'getW'];

function vector(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) fail(`${label} must be a finite xyz point`);
  return new THREE.Vector3(...value);
}

function indices(value, count, label) {
  if (!Array.isArray(value)) fail(`${label} must explicitly list vertex indices`);
  const seen = new Set();
  for (const index of value) {
    if (!Number.isInteger(index) || index < 0 || index >= count || seen.has(index)) fail(`${label} has an invalid or duplicate vertex`);
    seen.add(index);
  }
  return seen;
}

function positiveUniform(matrix) {
  const e = matrix.elements;
  if (!e.every(Number.isFinite) || matrix.determinant() <= 1e-12) return false;
  const axes = [new THREE.Vector3(e[0], e[1], e[2]), new THREE.Vector3(e[4], e[5], e[6]), new THREE.Vector3(e[8], e[9], e[10])];
  const sizes = axes.map(axis => axis.length()), high = Math.max(...sizes);
  return Math.min(...sizes) > 1e-8 && high - Math.min(...sizes) < high * 1e-4 &&
    axes.every((axis, i) => axes.slice(i + 1).every(other => Math.abs(axis.dot(other)) < high * high * 1e-4));
}

function activeVertices(geometry, material) {
  const total = geometry.index?.count ?? geometry.attributes.position.count;
  if (!Number.isInteger(total) || total % 3) fail('hair geometry must contain triangles');
  const start = geometry.drawRange.start, amount = geometry.drawRange.count;
  if (!Number.isInteger(start) || start < 0 || start % 3 || (amount !== Infinity && (!Number.isInteger(amount) || amount < 0 || amount % 3))) fail('invalid draw range');
  const end = Math.min(total, start + amount), result = new Set();
  const multiple = Array.isArray(material);
  if (multiple ? !material.length || material.some(value => !value?.isMaterial) : !material?.isMaterial) fail('hair requires valid materials');
  // Three ignores geometry groups for a single material, and requires groups
  // for a material array. Match that rendering rule before accepting weights.
  const ranges = multiple ? geometry.groups : [{ start: 0, count: total }];
  for (const range of ranges) {
    if (!Number.isInteger(range.start) || range.start < 0 || range.start % 3 || !Number.isInteger(range.count) || range.count < 0 || range.count % 3) fail('invalid material group');
    if (multiple && !material[range.materialIndex]?.isMaterial) fail('material group has no material');
    for (let at = Math.max(start, range.start); at < Math.min(end, range.start + range.count); at++) {
      const vertex = geometry.index ? geometry.index.getX(at) : at;
      if (!Number.isInteger(vertex) || vertex < 0 || vertex >= geometry.attributes.position.count) fail('invalid triangle index');
      result.add(vertex);
    }
  }
  return result;
}

/**
 * createSplitDreadlockRig(sourceMesh, descriptor)
 *
 * Returns an UNATTACHED SkinnedMesh clone at the same authored local transform.
 * Caller replaces sourceMesh and parents it to the measured Head attachment.
 * No source pose, geometry, material, visibility or parent is changed here.
 *
 * descriptor.version=1, namespace is unique in the final actor (safe name).
 * rootVertices explicitly identifies cap vertices held rigidly to the anchor.
 * chains:[{id,joints:[[x,y,z],...],vertices:[indices],rootBlendLength?,radius?,
 *          stiffness?,damping?,gravityScale?,maxAngle?}]. Points use the source
 * geometry's LOCAL coordinates, not world/model-normalized coordinates.
 * A SINGLE already isolated piece may use allVertices:true instead of vertices.
 * Bouquets require disjoint, explicit vertex selections for each measured curve;
 * this module does not discover strands or assign them by an inferred angle.
 * radius is an optional maximum distance from selected vertices to the curve.
 * rootBlendLength fades from anchor to the chain near its root; rootVertices
 * remain fully rigid, regardless of the fade. Unselected vertices stay anchored.
 *
 * Surface interpolation uses the nearest point along the measured polyline,
 * with at most two chain bones plus the anchor per vertex. Every chain must
 * genuinely influence at least two non-tip bones used by rendered triangles.
 * Positions, triangles, UVs, colors, normals, groups and morph data are cloned
 * unchanged; only skinIndex/skinWeight and bone nodes are added in memory.
 *
 * Returns {mesh,anchorBone,chains,articulationDescriptor,diagnostics,dispose}.
 * Pass articulationDescriptor (or merge its dreadlocks) to YautjaArticulation
 * AFTER the replacement mesh belongs to the actor. It contains bone NAMES so
 * ImportedCharacter/SkeletonUtils can bind each private actor clone correctly.
 * dispose removes this mesh and releases its geometry/skeleton ONCE; source
 * materials/textures are shared and never disposed. Dispose this rig BEFORE
 * an owning SplitYautjaAssembly, which owns its own original clones/materials.
 * This is a measured skinning tool, not a fidelity or finished-hair certificate.
 */
export function createSplitDreadlockRig(source, descriptor) {
  if (!source?.isMesh || source.isSkinnedMesh || source.isInstancedMesh || source.children.length) fail('an unskinned, non-instanced leaf Mesh is required');
  if (descriptor?.version !== 1 || !Array.isArray(descriptor.chains) || !descriptor.chains.length || descriptor.chains.length > 64) fail('descriptor version1 requires1..64 measured chains');
  const namespace = descriptor.namespace;
  if (typeof namespace !== 'string' || !SAFE_NAME.test(namespace)) fail('a unique safe namespace is required');
  const positions = source.geometry?.attributes.position;
  if (!positions || positions.itemSize !== 3 || positions.count > 250_000 || !positions.count) fail('a bounded hair position attribute is required');
  for (let i = 0; i < positions.count; i++) for (let axis = 0; axis < 3; axis++) {
    if (!Number.isFinite(positions[COMPONENT[axis]](i))) fail('non-finite source vertex');
  }
  source.updateWorldMatrix(true, false);
  if (!positiveUniform(source.matrixWorld)) fail('hair requires a positive uniform transform without shear');
  const rendered = activeVertices(source.geometry, source.material);
  if (!rendered.size) fail('hair has no rendered vertices');
  const caps = indices(descriptor.rootVertices, positions.count, 'rootVertices');
  if (!caps.size) fail('at least one explicit cap vertex is required');
  if (![...caps].some(vertex => rendered.has(vertex))) fail('cap vertices must include a rendered vertex');
  const ownership = new Int16Array(positions.count).fill(-1), ids = new Set();
  const curves = descriptor.chains.map((value, index) => {
    if (!value || typeof value.id !== 'string' || !SAFE_NAME.test(value.id) || ids.has(value.id)) fail('chain ids must be unique safe names');
    ids.add(value.id);
    if (!Array.isArray(value.joints) || value.joints.length < 3 || value.joints.length > 16) fail('a measured curve requires3..16 joints');
    const points = value.joints.map((point, i) => vector(point, `chain${value.id} joint${i}`));
    const lengths = [], cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      const length = points[i].distanceTo(points[i - 1]);
      if (length < 1e-7 || length > 1000) fail('zero-length or unbounded curve segment');
      lengths.push(length); cumulative.push(cumulative.at(-1) + length);
    }
    const blend = value.rootBlendLength ?? 0;
    if (!Number.isFinite(blend) || blend < 0 || blend >= cumulative.at(-1)) fail('rootBlendLength must be shorter than its curve');
    const radius = value.radius ?? Infinity;
    if (!(radius === Infinity || Number.isFinite(radius) && radius > 0 && radius <= 1000)) fail('invalid curve radius');
    if (value.allVertices !== undefined && value.allVertices !== true) fail('allVertices must be true when supplied');
    if (value.allVertices && (descriptor.chains.length !== 1 || value.vertices !== undefined)) fail('allVertices is allowed only for one isolated curve without vertices');
    const selected = value.allVertices ? new Set(Array.from({ length: positions.count }, (_, i) => i)) : indices(value.vertices, positions.count, `chain${value.id} vertices`);
    if (!selected.size) fail('each chain requires an explicit nonempty surface selection');
    for (const vertex of selected) {
      if (ownership[vertex] !== -1) fail('surface vertices are shared by multiple chains');
      ownership[vertex] = index;
    }
    const physics = {};
    for (const [name, low, high] of [['stiffness', 0, 1000], ['damping', 0, 100], ['gravityScale', 0, 4], ['maxAngle', 0, Math.PI]]) {
      if (value[name] === undefined) continue;
      if (!Number.isFinite(value[name]) || value[name] < low || value[name] > high) fail(`invalid chain${value.id} ${name}`);
      physics[name] = value[name];
    }
    return { id: value.id, points, lengths, cumulative, blend, radius, selected, physics, offset: 0, bones: [], weighted: new Set(), influencedVertices: 0 };
  });

  const anchor = new THREE.Bone(); anchor.name = `${namespace}_Anchor`;
  const bones = [anchor];
  for (const curve of curves) {
    curve.offset = bones.length;
    let parent = anchor;
    for (let i = 0; i < curve.points.length; i++) {
      const bone = new THREE.Bone(); bone.name = `${namespace}_${curve.id}_${i}`;
      bone.position.copy(curve.points[i]);
      if (i) bone.position.sub(curve.points[i - 1]);
      parent.add(bone); parent = bone; curve.bones.push(bone); bones.push(bone);
    }
  }
  const skinIndices = new Uint16Array(positions.count * 4), skinWeights = new Float32Array(positions.count * 4);
  const point = new THREE.Vector3(), segment = new THREE.Vector3(), relative = new THREE.Vector3(), projected = new THREE.Vector3();
  let fullyAnchoredVertices = 0, selectedVertices = 0;
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const at = vertex * 4, owner = ownership[vertex];
    if (owner < 0 || caps.has(vertex)) { skinWeights[at] = 1; fullyAnchoredVertices++; continue; }
    selectedVertices++;
    const curve = curves[owner]; point.fromBufferAttribute(positions, vertex);
    let closest = Infinity, bestSegment = 0, bestT = 0;
    for (let i = 0; i < curve.lengths.length; i++) {
      segment.copy(curve.points[i + 1]).sub(curve.points[i]); relative.copy(point).sub(curve.points[i]);
      const t = THREE.MathUtils.clamp(relative.dot(segment) / (curve.lengths[i] * curve.lengths[i]), 0, 1);
      projected.copy(curve.points[i]).addScaledVector(segment, t);
      const distance = projected.distanceToSquared(point);
      if (distance < closest) { closest = distance; bestSegment = i; bestT = t; }
    }
    if (closest > curve.radius * curve.radius + 1e-12) fail(`chain${curve.id}: selected vertex${vertex} is outside the measured radius`);
    const along = curve.cumulative[bestSegment] + bestT * curve.lengths[bestSegment];
    const influence = curve.blend ? THREE.MathUtils.clamp(along / curve.blend, 0, 1) : 1;
    skinIndices[at] = curve.offset + bestSegment; skinWeights[at] = (1 - bestT) * influence;
    skinIndices[at + 1] = curve.offset + bestSegment + 1; skinWeights[at + 1] = bestT * influence;
    skinIndices[at + 2] = 0; skinWeights[at + 2] = 1 - influence;
    if (!influence) fullyAnchoredVertices++;
    if (rendered.has(vertex) && influence > 0) {
      curve.influencedVertices++;
      if (skinWeights[at] > 0) curve.weighted.add(bestSegment);
      if (skinWeights[at + 1] > 0) curve.weighted.add(bestSegment + 1);
    }
  }
  for (const curve of curves) if ([...curve.weighted].filter(index => index < curve.points.length - 1).length < 2) fail(`chain${curve.id}: at least two non-tip bones must influence rendered vertices`);

  const geometry = source.geometry.clone();
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, source.material);
  // Mesh.copy keeps matrix/matrixAutoUpdate, all authored transform and render
  // flags without borrowing a skeleton. Restore our private geometry afterwards.
  THREE.Mesh.prototype.copy.call(mesh, source, false); mesh.geometry = geometry;
  mesh.frustumCulled = false; mesh.add(anchor); mesh.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones); mesh.bind(skeleton); skeleton.update();
  let disposed = false;
  const dispose = () => {
    if (disposed) return false;
    disposed = true; mesh.removeFromParent(); skeleton.dispose(); geometry.dispose(); return true;
  };
  const articulationDescriptor = { version: 1, dreadlocks: curves.map(curve => ({ id: curve.id, nodes: curve.bones.map(bone => bone.name), ...curve.physics })) };
  return { mesh, anchorBone: anchor, chains: new Map(curves.map(curve => [curve.id, { bones: curve.bones, joints: curve.points.map(point => point.toArray()), weightedVertices: curve.influencedVertices }])),
    articulationDescriptor,
    diagnostics: { vertices: positions.count, selectedNonCapVertices: selectedVertices, fullyAnchoredVertices, renderedVertices: rendered.size,
      chainCount: curves.length, sourceGeometryModified: false, normalsAdded: false, materialsShared: true, unselectedVerticesAnchored: true },
    dispose };
}

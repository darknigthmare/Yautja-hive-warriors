/* Runtime face regions from an inspected correspondence; never infers anatomy. */
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const fail = message => { throw new Error(`ImportedPartRegions: ${message}`); };
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const COMPONENT = ['getX', 'getY', 'getZ', 'getW'];
const finiteMatrix = matrix => matrix?.elements.every(Number.isFinite) && Math.abs(matrix.determinant()) > 1e-20;
const rawArray = attribute => attribute.isInterleavedBufferAttribute ? attribute.data?.array : attribute.array;
function rawComponent(attribute, vertex, component) {
  return attribute.isInterleavedBufferAttribute
    ? attribute.data.array[vertex * attribute.data.stride + attribute.offset + component]
    : attribute.array[vertex * attribute.itemSize + component];
}
function validateAttribute(attribute, count, name) {
  const array = rawArray(attribute);
  if (!attribute || attribute.isInstancedBufferAttribute || !ArrayBuffer.isView(array) || array instanceof DataView ||
      !Number.isInteger(attribute.itemSize) || attribute.itemSize < 1 || attribute.itemSize > 16 || attribute.count !== count) fail(`invalid ${name} attribute`);
  for (let vertex = 0; vertex < count; vertex++) for (let component = 0; component < attribute.itemSize; component++) {
    const value = rawComponent(attribute, vertex, component);
    if (!Number.isFinite(attribute.isFloat16BufferAttribute ? THREE.DataUtils.fromHalfFloat(value) : value)) fail(`non-finite ${name} attribute`);
  }
}
function validateGeometry(mesh, nodes) {
  const geometry = mesh.geometry, position = geometry?.attributes?.position;
  if (!position || position.itemSize !== 3 || !position.count) fail('a finite position attribute is required');
  const vertices = position.count, count = geometry.index?.count ?? vertices;
  if (!Number.isInteger(count) || count % 3 || count > 6_000_000) fail('invalid triangle index count');
  for (const [name, attribute] of Object.entries(geometry.attributes)) validateAttribute(attribute, vertices, name);
  if (geometry.index) {
    if (geometry.index.itemSize !== 1 || geometry.index.normalized) fail('invalid triangle indices');
    for (let at = 0; at < count; at++) {
      const value = geometry.index.getX(at);
      if (!Number.isInteger(value) || value < 0 || value >= vertices) fail('invalid triangle index');
    }
  }
  const validRange = range => Number.isInteger(range.start) && range.start >= 0 && range.start % 3 === 0 &&
    (range.count === Infinity || Number.isInteger(range.count) && range.count >= 0 && range.count % 3 === 0);
  if (!validRange(geometry.drawRange) || geometry.groups.some(group => !validRange(group) || group.count === Infinity ||
      !Number.isInteger(group.materialIndex) || group.materialIndex < 0 || Array.isArray(mesh.material) && group.materialIndex >= mesh.material.length)) fail('unaligned triangle groups or drawRange');
  for (const [name, targets] of Object.entries(geometry.morphAttributes)) for (const attribute of targets) validateAttribute(attribute, vertices, `morph ${name}`);
  if (mesh.morphTargetInfluences?.some(value => !Number.isFinite(value))) fail('non-finite morph influence');
  if (mesh.isSkinnedMesh) {
    const skeleton = mesh.skeleton, indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
    if (!skeleton?.bones.length || skeleton.bones.some(bone => !nodes.has(bone)) ||
        skeleton.boneInverses.length !== skeleton.bones.length || skeleton.boneInverses.some(matrix => !finiteMatrix(matrix)) ||
        !finiteMatrix(mesh.bindMatrix) || !finiteMatrix(mesh.bindMatrixInverse)) fail('invalid or foreign skeleton binding');
    if (indices?.itemSize !== 4 || weights?.itemSize !== 4) fail('invalid skin attributes');
    for (let vertex = 0; vertex < vertices; vertex++) {
      let sum = 0;
      for (let slot = 0; slot < 4; slot++) {
        const weight = weights[COMPONENT[slot]](vertex), bone = indices[COMPONENT[slot]](vertex);
        if (!Number.isFinite(weight) || weight < 0 || weight > 0 && (!Number.isInteger(bone) || bone < 0 || bone >= skeleton.bones.length)) fail('invalid skin influence');
        sum += weight;
      }
      if (sum <= 0 || !Number.isFinite(sum)) fail('vertex without a skin influence');
    }
  }
  return { vertices, triangles: count / 3 };
}
function compactAttribute(attribute, vertices) {
  const array = new (rawArray(attribute).constructor)(vertices.length * attribute.itemSize);
  for (let i = 0; i < vertices.length; i++) for (let component = 0; component < attribute.itemSize; component++) {
    array[i * attribute.itemSize + component] = rawComponent(attribute, vertices[i], component);
  }
  const Attribute = attribute.isFloat16BufferAttribute ? THREE.Float16BufferAttribute : THREE.BufferAttribute;
  const result = new Attribute(array, attribute.itemSize, attribute.normalized);
  result.name = attribute.name; result.setUsage(attribute.usage ?? attribute.data?.usage ?? THREE.StaticDrawUsage);
  if (attribute.gpuType !== undefined) result.gpuType = attribute.gpuType;
  return result;
}
function compactGeometry(source, faces) {
  const original = source.index, vertices = [], vertexMap = new Map(), index = [];
  for (const face of faces) for (let corner = 0; corner < 3; corner++) {
    const vertex = original ? original.getX(face * 3 + corner) : face * 3 + corner;
    if (!vertexMap.has(vertex)) { vertexMap.set(vertex, vertices.length); vertices.push(vertex); }
    index.push(vertexMap.get(vertex));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.name = source.name; geometry.userData = JSON.parse(JSON.stringify(source.userData));
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, compactAttribute(attribute, vertices));
  for (const [name, targets] of Object.entries(source.morphAttributes)) geometry.morphAttributes[name] = targets.map(attribute => compactAttribute(attribute, vertices));
  geometry.morphTargetsRelative = source.morphTargetsRelative; geometry.setIndex(index);
  const end = source.drawRange.start + source.drawRange.count;
  const before = faces.filter(face => face * 3 < source.drawRange.start).length;
  const active = faces.filter(face => face * 3 >= source.drawRange.start && face * 3 < end).length;
  geometry.setDrawRange(before * 3, active * 3);
  for (const group of source.groups) {
    const start = faces.findIndex(face => face * 3 >= group.start && face * 3 < group.start + group.count);
    if (start < 0) continue;
    let count = 0;
    for (let at = start; at < faces.length && faces[at] * 3 < group.start + group.count; at++) count++;
    geometry.addGroup(start * 3, count * 3, group.materialIndex);
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, vertices: new Uint32Array(vertices) };
}
function selectedFaces(region, count) {
  if (Array.isArray(region.faces) === Array.isArray(region.faceRanges)) fail('a region needs either faces or faceRanges');
  let faces;
  if (Array.isArray(region.faces)) {
    if (region.faces.length > count) fail('face selection exceeds source triangle count');
    faces = [...region.faces];
  }
  else {
    faces = [];
    if (region.faceRanges.length > count) fail('face range count exceeds source triangle count');
    for (const range of region.faceRanges) {
      if (!Array.isArray(range) || range.length !== 2 || !Number.isInteger(range[0]) || !Number.isInteger(range[1]) || range[0] < 0 || range[1] <= 0 || range[0] + range[1] > count) fail('invalid face range');
      if (faces.length + range[1] > count) fail('face range expansion exceeds source triangle count');
      for (let at = range[0]; at < range[0] + range[1]; at++) faces.push(at);
    }
  }
  if (!faces.length || faces.length > count) fail('a region needs a nonempty bounded face selection');
  const unique = new Set();
  for (const face of faces) {
    if (!Number.isInteger(face) || face < 0 || face >= count || unique.has(face)) fail('invalid or duplicate face index');
    unique.add(face);
  }
  return faces.sort((a, b) => a - b);
}

/**
 * Create private full-scene clones and compact explicit face regions in memory.
 * No file loading, nearest-surface inference, source mutation or activation.
 *
 * descriptor={version:1,meshes:[{meshIndex,triangleCount,vertexCount?,regions:[
 *   {id,faces:[triangleIndices]} OR {id,faceRanges:[[firstFace,count],...]}
 * ],unassignedId}]}. meshIndex is source-scene DFS Mesh order. Every source
 * triangle is retained exactly once; unspecified/uncertain faces go into the
 * unassigned region and acquire NO inferred anatomical or mechanical meaning.
 * Caller must bind the inspected descriptor to the matching asset SHA in its
 * manifest. This synchronous helper checks counts/selections, not a file hash.
 *
 * Returns {gltf,scene,regions,metadata,diagnostics,resources,dispose}. Each region
 * retains exact attribute values and original triangle winding, with a compact
 * vertex table. metadata has original triangle/vertex indices. All mutable GPU
 * geometry/materials/skeletons are private; texture objects and clips are shared.
 * Skinned regions retain real weights and the cloned body skeleton. Do not
 * discard those weights to make a rigid hair Mesh without proving the bind pose.
 * In the directly returned scene, named morph tracks target the original node,
 * now an owning Group whose influence array is shared by its child parts.
 * Generic Object3D/SkeletonUtils recloning does NOT preserve that custom Group
 * binding: consumers that later clone must reject partitioned morph meshes
 * until they implement and verify relinking. prepareImportedParts refuses them
 * and retains the original glTF for the character/composition clone pipeline.
 * Bones/children keep local poses.
 */
export function createImportedPartRegions(gltf, descriptor) {
  if (!gltf?.scene?.isObject3D || descriptor?.version !== 1 || !Array.isArray(descriptor.meshes) ||
      !descriptor.meshes.length || descriptor.meshes.length > 64) fail('a glTF scene and descriptor version1 are required');
  const sourceMeshes = [], sourceNodes = new Set(); let sourceVertices = 0, sourceTriangles = 0;
  gltf.scene.traverse(node => {
    if (![...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()].every(Number.isFinite) ||
        node.quaternion.lengthSq() < 1e-12 || node.scale.toArray().some(value => Math.abs(value) < 1e-12) || !finiteMatrix(node.matrix)) fail('non-finite or singular source transform');
    sourceNodes.add(node); if (node.isMesh) sourceMeshes.push(node);
  });
  if (!sourceMeshes.length || sourceMeshes.length > 256) fail('source mesh budget exceeded');
  const summaries = sourceMeshes.map(mesh => {
    if (mesh.isInstancedMesh || !finiteMatrix(mesh.matrix)) fail('instanced or invalid transformed meshes are unsupported');
    const summary = validateGeometry(mesh, sourceNodes); sourceVertices += summary.vertices; sourceTriangles += summary.triangles;
    if (sourceVertices > 2_000_000) fail('source vertex budget exceeded');
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.length || materials.some(material => !material?.isMaterial)) fail('source material is invalid');
    return summary;
  });
  const ids = new Set(), selectors = new Map();
  const id = value => {
    if (typeof value !== 'string' || !SAFE_ID.test(value) || ids.has(value)) fail('region ids must be unique safe names');
    ids.add(value); return value;
  };
  for (const value of descriptor.meshes) {
    const at = value?.meshIndex;
    if (!Number.isInteger(at) || at < 0 || at >= sourceMeshes.length || selectors.has(at)) fail('unknown or duplicate meshIndex');
    const summary = summaries[at];
    if (value.triangleCount !== summary.triangles || value.vertexCount !== undefined && value.vertexCount !== summary.vertices) fail('source triangle or vertex count mismatch');
    if (!Array.isArray(value.regions) || !value.regions.length || value.regions.length > 128) fail('regions must be a bounded nonempty array');
    const assigned = new Uint8Array(summary.triangles);
    const regions = value.regions.map(region => {
      const name = id(region?.id), faces = selectedFaces(region, summary.triangles);
      for (const face of faces) { if (assigned[face]) fail('a face belongs to multiple regions'); assigned[face] = 1; }
      return { id: name, faces, unassigned: false };
    });
    const unassignedId = id(value.unassignedId), remaining = [];
    for (let face = 0; face < assigned.length; face++) if (!assigned[face]) remaining.push(face);
    if (remaining.length) regions.push({ id: unassignedId, faces: remaining, unassigned: true });
    selectors.set(at, regions);
  }
  const resources = new Set(), geometries = new Set(), materials = new Set(), skeletons = new Set();
  let scene, disposed = false;
  const dispose = () => {
    if (disposed) return; disposed = true; scene?.removeFromParent();
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); skeletons.forEach(skeleton => skeleton.dispose());
  };
  try {
    scene = cloneSkeleton(gltf.scene);
    const meshes = []; scene.traverse(node => { if (node.isMesh) meshes.push(node); });
    const materialCopies = new Map(), geometryCopies = new Map();
    const ownMaterial = material => {
      if (!materialCopies.has(material)) { const copy = material.clone(); materialCopies.set(material, copy); materials.add(copy); resources.add(copy); }
      return materialCopies.get(material);
    };
    for (const mesh of meshes) {
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(ownMaterial) : ownMaterial(mesh.material);
      if (mesh.isSkinnedMesh && !skeletons.has(mesh.skeleton)) {
        mesh.skeleton.boneInverses = mesh.skeleton.boneInverses.map(matrix => matrix.clone());
        skeletons.add(mesh.skeleton); resources.add(mesh.skeleton);
      }
    }
    const regions = new Map(), metadata = new Map(); let compactedVertices = 0, unassignedTriangles = 0, partitionedTriangles = 0;
    for (let at = 0; at < meshes.length; at++) {
      const mesh = meshes[at], selection = selectors.get(at);
      if (!selection) {
        if (!geometryCopies.has(mesh.geometry)) { const copy = mesh.geometry.clone(); geometryCopies.set(mesh.geometry, copy); geometries.add(copy); resources.add(copy); }
        mesh.geometry = geometryCopies.get(mesh.geometry); continue;
      }
      const group = new THREE.Group(); group.copy(mesh, false); group.name = mesh.name; group.uuid = mesh.uuid;
      const morphInfluences = mesh.morphTargetInfluences ? [...mesh.morphTargetInfluences] : undefined;
      if (morphInfluences) { group.morphTargetInfluences = morphInfluences; group.morphTargetDictionary = { ...mesh.morphTargetDictionary }; }
      for (const child of [...mesh.children]) group.add(child);
      for (const region of selection) {
        const result = compactGeometry(mesh.geometry, region.faces), part = mesh.clone(false);
        part.name = region.id; part.geometry = result.geometry;
        part.position.set(0, 0, 0); part.quaternion.identity(); part.scale.set(1, 1, 1); part.matrix.identity();
        part.matrixAutoUpdate = true; part.matrixWorldNeedsUpdate = true; part.visible = true;
        if (part.isSkinnedMesh) part.frustumCulled = false;
        if (morphInfluences) { part.morphTargetInfluences = morphInfluences; part.morphTargetDictionary = group.morphTargetDictionary; }
        // PropertyBinding checks geometry.morphAttributes even on a nonrendered
        // owner. Reuse a private compact geometry; do not retain full buffers.
        if (morphInfluences && !group.geometry) group.geometry = part.geometry;
        part.userData.importedPartRegion = { id: region.id, sourceMeshIndex: at, sourceName: mesh.name, unassigned: region.unassigned };
        group.add(part); geometries.add(part.geometry); resources.add(part.geometry); regions.set(region.id, part);
        metadata.set(region.id, { faces: new Uint32Array(region.faces), sourceVertexIndices: result.vertices, sourceMeshIndex: at, unassigned: region.unassigned });
        compactedVertices += result.vertices.length; partitionedTriangles += region.faces.length;
        if (region.unassigned) unassignedTriangles += region.faces.length;
      }
      if (mesh.parent) { const parent = mesh.parent, index = parent.children.indexOf(mesh); parent.remove(mesh); parent.add(group); parent.children.splice(parent.children.indexOf(group), 1); parent.children.splice(index, 0, group); }
      else if (scene === mesh) scene = group;
      else fail('selected mesh has no source parent');
    }
    scene.updateMatrixWorld(true); skeletons.forEach(skeleton => skeleton.update());
    return { scene, gltf: { ...gltf, scene }, regions, metadata, resources,
      diagnostics: { sourceMeshes: sourceMeshes.length, sourceVertices, sourceTriangles, partitionedMeshes: selectors.size,
        partitionedTriangles, unassignedTriangles, compactedVertices, outputRegions: regions.size,
        sourceModified: false, texturesShared: true, inferredRegions: false }, dispose };
  } catch (error) { dispose(); throw error; }
}

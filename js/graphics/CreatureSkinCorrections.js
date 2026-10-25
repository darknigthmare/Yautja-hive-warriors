/* Explicit, asset-calibrated skin weights. Rest geometry and cached input stay intact. */
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const corrected = new WeakMap();
const fail = message => { throw new Error(`CreatureSkinCorrections: ${message}`); };

/** Fingerprint exact attribute bytes, including type/layout from the loaded GLTF. */
export function geometryAttributeHash(attribute) {
  const array = attribute?.array;
  if (!ArrayBuffer.isView(array) || attribute.isInterleavedBufferAttribute) fail('a contiguous typed attribute is required');
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let hash = 0x811c9dc5;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193);
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function inspectCorrection(mesh, calibration) {
  if (!mesh?.isSkinnedMesh || !mesh.skeleton?.bones?.length) fail(`missing skinned mesh: ${calibration.meshName}`);
  const geometry = mesh.geometry, position = geometry.attributes.position;
  const index = geometry.index, skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
  if (position?.itemSize !== 3 || skinIndex?.itemSize !== 4 || skinWeight?.itemSize !== 4 ||
    position.count !== calibration.vertexCount || (index?.count ?? 0) !== calibration.indexCount ||
    skinIndex.count !== position.count || skinWeight.count !== position.count) fail('calibrated geometry layout does not match');
  for (const [name, attribute] of [['positionHash', position], ['indexHash', index], ['skinIndexHash', skinIndex], ['skinWeightHash', skinWeight]]) {
    if (name.endsWith('Hash') && calibration[name] === undefined && name.startsWith('skin')) continue;
    if (geometryAttributeHash(attribute) !== calibration[name]) fail(`${name} does not match calibrated source`);
  }
  const groups = calibration.bindings ?? [calibration];
  if (!Array.isArray(groups) || !groups.length || groups.length > 16) fail('invalid calibrated bindings');
  let selected = 0;
  const assigned = new Uint8Array(position.count), bindings = [];
  for (const group of groups) {
    const targetJoint = mesh.skeleton.bones.findIndex(bone => bone.name === group.targetBone);
    if (targetJoint < 0) fail(`target bone is missing: ${group.targetBone}`);
    const ranges = group.vertexRanges;
    if (!Array.isArray(ranges) || !ranges.length || ranges.length > position.count) fail('explicit vertex ranges are required');
    let end = 0, groupSelected = 0;
    const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const range of ranges) {
      if (!Array.isArray(range) || range.length !== 2) fail('vertex ranges must be [start,count]');
      const [start, count] = range;
      if (!Number.isInteger(start) || !Number.isInteger(count) || start < end || count <= 0 || start + count > position.count) fail('vertex ranges must be ordered, disjoint and in bounds');
      end = start + count; selected += count; groupSelected += count;
      for (let i = start; i < end; i++) {
        if (assigned[i]) fail('calibrated bindings cannot overlap');
        assigned[i] = 1;
        for (let axis = 0; axis < 3; axis++) {
          const value = position.array[i * 3 + axis];
          bounds.min[axis] = Math.min(bounds.min[axis], value); bounds.max[axis] = Math.max(bounds.max[axis], value);
        }
      }
    }
    bindings.push({ name: group.name ?? group.targetBone, targetBone: group.targetBone, ranges, targetJoint, selected: groupSelected, bounds });
  }
  if (selected >= position.count) fail('a correction cannot replace the entire creature skin');
  return { bindings, selected };
}

/**
 * Stable corrected template shared by actor clones. Only selected geometry is
 * cloned. Source bones, inverse binds, surfaces, animation tracks and vertices
 * are never edited. SceneResources retains the corrected shared geometry.
 */
export function getCorrectedCreatureTemplate(gltf, config) {
  if (config === undefined || config === null) return { template: gltf, diagnostics: null };
  if (config.calibrated !== true || typeof config.id !== 'string' || !config.id.trim()) fail('calibrated correction required');
  if (!gltf?.scene?.isObject3D || !Array.isArray(config.meshes) || !config.meshes.length || config.meshes.length > 8) fail('invalid correction template or mesh list');
  const key = JSON.stringify(config), cached = corrected.get(gltf)?.get(key);
  if (cached) return cached;
  const uniqueNames = new Set(), inspected = [];
  for (const calibration of config.meshes) {
    if (typeof calibration.meshName !== 'string' || uniqueNames.has(calibration.meshName)) fail('mesh names must be explicit and distinct');
    uniqueNames.add(calibration.meshName);
    const matches = [];
    gltf.scene.traverse(node => { if (node.name === calibration.meshName) matches.push(node); });
    if (matches.length !== 1) fail(`mesh name is missing or ambiguous: ${calibration.meshName}`);
    inspected.push({ calibration, ...inspectCorrection(matches[0], calibration) });
  }
  const scene = cloneSkeleton(gltf.scene), diagnostics = { id: config.id, sourceImmutable: true, restGeometryUnchanged: true, meshes: [] };
  for (const { calibration, bindings, selected } of inspected) {
    const mesh = scene.getObjectByName(calibration.meshName), geometry = mesh.geometry.clone();
    const skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
    for (const { ranges, targetJoint } of bindings) for (const [start, count] of ranges) for (let i = start; i < start + count; i++) {
        skinIndex.setXYZW(i, targetJoint, 0, 0, 0); skinWeight.setXYZW(i, 1, 0, 0, 0);
      }
    skinIndex.needsUpdate = true; skinWeight.needsUpdate = true;
    mesh.geometry = geometry;
    diagnostics.meshes.push({ meshName: mesh.name, selectedVertices: selected,
      rigidAttachment: true, bindings: bindings.map(({name,targetBone,selected,bounds}) => ({name,targetBone,selectedVertices:selected,bounds})),
      positionHash: geometryAttributeHash(geometry.attributes.position),
      sourceSkinIndexHash: calibration.skinIndexHash ?? null, sourceSkinWeightHash: calibration.skinWeightHash ?? null });
  }
  const result = { template: { ...gltf, scene, scenes: gltf.scenes?.map(source => source === gltf.scene ? scene : source) ?? [scene] }, diagnostics };
  let cache = corrected.get(gltf); if (!cache) { cache = new Map(); corrected.set(gltf, cache); }
  cache.set(key, result);
  return result;
}

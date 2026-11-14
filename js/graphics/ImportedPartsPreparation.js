/* Optional measured region/hair preparation before character pose calibration. */
import * as THREE from 'three';
import { createImportedPartRegions } from './ImportedPartRegions.js';
import { createSplitDreadlockRig } from './SplitDreadlockRig.js';
import { applyBoneRestCorrections } from './BoneRestCorrections.js';

const fail = message => { throw new Error(`ImportedPartsPreparation: ${message}`); };
const HASH = /^[a-f0-9]{64}$/i;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$/;
const identity = () => new THREE.Matrix4();
const finiteMatrix = matrix => matrix.elements.every(Number.isFinite) && Math.abs(matrix.determinant()) > 1e-12;
const sameMatrix = (left, right, tolerance) => left.elements.every((value, i) => Math.abs(value - right.elements[i]) <= tolerance);
const point = (array, label) => {
  if (!Array.isArray(array) || array.length !== 3 || !array.every(Number.isFinite)) fail(`invalid ${label}`);
  return new THREE.Vector3(...array);
};

function guardSource(descriptor, sourceSha256) {
  const expected = descriptor?.targetSha256 ?? descriptor?.sourceSha256;
  if (!HASH.test(expected ?? '') || !HASH.test(sourceSha256 ?? '') || expected.toLowerCase() !== sourceSha256.toLowerCase()) {
    fail('measured source SHA-256 does not match the selected asset');
  }
}

function measuredMatrix(values, label) {
  if (!Array.isArray(values) || values.length !== 16 || !values.every(Number.isFinite)) fail(`${label} must be an explicitly measured16-value matrix`);
  const result = new THREE.Matrix4().fromArray(values);
  if (!finiteMatrix(result) || result.determinant() <= 0 || Math.abs(values[3]) > 1e-10 || Math.abs(values[7]) > 1e-10 || Math.abs(values[11]) > 1e-10 || Math.abs(values[15] - 1) > 1e-10) fail(`invalid affine ${label}`);
  return result;
}

function findBone(scene, name) {
  if (typeof name !== 'string' || !name.trim()) fail('an exact measured head bone is required');
  const matches = [];
  scene.traverse(node => { if (node.isBone && node.name === name) matches.push(node); });
  if (matches.length !== 1) fail('measured head bone is missing or ambiguous');
  return matches[0];
}

function transformGeometry(source, matrix) {
  const geometry = source.clone(), normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const linear = new THREE.Matrix3().setFromMatrix4(matrix), value = new THREE.Vector3();
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    value.fromBufferAttribute(positions, i).applyMatrix4(matrix); positions.setXYZ(i, value.x, value.y, value.z);
  }
  if (geometry.attributes.normal) {
    const normals = geometry.attributes.normal;
    for (let i = 0; i < normals.count; i++) {
      value.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize(); normals.setXYZ(i, value.x, value.y, value.z);
    }
  }
  if (geometry.attributes.tangent) {
    const tangents = geometry.attributes.tangent;
    if (tangents.itemSize !== 4) { geometry.dispose(); fail('tangents must have four components'); }
    for (let i = 0; i < tangents.count; i++) {
      value.fromBufferAttribute(tangents, i).applyMatrix3(linear).normalize();
      tangents.setXYZW(i, value.x, value.y, value.z, tangents.getW(i));
    }
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

function transformCurve(descriptor, matrix) {
  const result = structuredClone(descriptor);
  if (result?.version !== 1 || !Array.isArray(result.chains)) fail('each hair piece requires its measured curve descriptor');
  // Conservative radius bound supports an affine change of coordinate space.
  // The root falloff is measured along the first curve segment near the cap.
  const e = matrix.elements;
  const radiusScale = Math.sqrt(e[0] ** 2 + e[1] ** 2 + e[2] ** 2 + e[4] ** 2 + e[5] ** 2 + e[6] ** 2 + e[8] ** 2 + e[9] ** 2 + e[10] ** 2);
  for (const chain of result.chains) {
    if (!Array.isArray(chain.joints) || chain.joints.length < 3) fail('measured hair requires at least three curve points');
    const before = chain.joints.map(value => point(value, 'curve point'));
    const after = before.map(value => value.clone().applyMatrix4(matrix));
    const firstLength = before[0].distanceTo(before[1]);
    if (firstLength < 1e-8) fail('a measured curve has a zero-length root segment');
    chain.joints = after.map(value => value.toArray());
    if (chain.radius !== undefined) chain.radius *= radiusScale;
    if (chain.rootBlendLength !== undefined) chain.rootBlendLength *= after[0].distanceTo(after[1]) / firstLength;
  }
  return result;
}

function selectedSkinVertices(specification, count) {
  const { vertexRanges, vertexIndices } = specification;
  const selected = new Uint8Array(count);
  if (vertexRanges === undefined && vertexIndices === undefined) { selected.fill(1); return selected; }
  if (vertexRanges !== undefined && vertexIndices !== undefined) fail('skin filter vertex selection must use ranges or indices, never both');
  if (vertexIndices !== undefined) {
    if (!Array.isArray(vertexIndices) || !vertexIndices.length || vertexIndices.length > count) fail('skin filter requires nonempty measured vertex indices');
    let previous = -1;
    for (const vertex of vertexIndices) {
      if (!Number.isInteger(vertex) || vertex <= previous || vertex < 0 || vertex >= count) fail('skin filter vertex indices must be ordered, unique and in bounds');
      selected[vertex] = 1; previous = vertex;
    }
  } else {
    if (!Array.isArray(vertexRanges) || !vertexRanges.length || vertexRanges.length > count) fail('skin filter requires nonempty measured vertex ranges');
    let end = 0;
    for (const range of vertexRanges) {
      if (!Array.isArray(range) || range.length !== 2 || !Number.isInteger(range[0]) || !Number.isInteger(range[1]) || range[0] < end || range[1] <= 0 || range[0] + range[1] > count) fail('skin filter vertex ranges must be ordered, disjoint and in bounds');
      selected.fill(1, range[0], range[0] + range[1]); end = range[0] + range[1];
    }
  }
  return selected;
}

function proveSkinCandidate(mesh, weights, skinIndices = mesh.geometry.attributes.skinIndex) {
  const geometry = mesh.geometry, original = geometry.attributes.skinWeight, originalIndices = geometry.attributes.skinIndex;
  mesh.skeleton.update();
  const worldRest = new Float64Array(geometry.attributes.position.count * 3), value = new THREE.Vector3();
  for (let vertex = 0; vertex < geometry.attributes.position.count; vertex++) {
    mesh.getVertexPosition(vertex, value).applyMatrix4(mesh.matrixWorld);
    if (!value.toArray().every(Number.isFinite)) fail(`skin region ${mesh.name} has a nonfinite rest surface`);
    value.toArray(worldRest, vertex * 3);
  }
  let maxRestWorldError = 0;
  geometry.setAttribute('skinWeight', weights); geometry.setAttribute('skinIndex', skinIndices);
  try {
    for (let vertex = 0; vertex < geometry.attributes.position.count; vertex++) {
      mesh.getVertexPosition(vertex, value).applyMatrix4(mesh.matrixWorld);
      const at = vertex * 3, error = Math.hypot(value.x - worldRest[at], value.y - worldRest[at + 1], value.z - worldRest[at + 2]);
      if (!Number.isFinite(error) || error > 1e-6) fail(`skin region ${mesh.name} changes its measured world rest surface`);
      maxRestWorldError = Math.max(maxRestWorldError, error);
    }
  } finally { geometry.setAttribute('skinWeight', original); geometry.setAttribute('skinIndex', originalIndices); }
  return { mesh, geometry, original, originalIndices, weights, skinIndices, worldRest, maxRestWorldError };
}

function stageMeasuredSkinReplacement(mesh, specification) {
  if (specification.keepBones !== undefined || specification.minRetainedWeight !== undefined || specification.blendWeights !== undefined) fail('explicit skin replacements cannot mix filter or blend settings');
  const geometry = mesh.geometry, positions = geometry.attributes.position, original = geometry.attributes.skinWeight, originalIndices = geometry.attributes.skinIndex;
  if (!original || !originalIndices || original.itemSize !== 4 || originalIndices.itemSize !== 4 || original.count !== positions.count || originalIndices.count !== positions.count || originalIndices.normalized) fail('skin replacements require four unnormalized bone indices per vertex');
  const selection = selectedSkinVertices(specification, positions.count), count = selection.reduce((total, value) => total + value, 0);
  if (!Array.isArray(specification.influences) || specification.influences.length !== count) fail('skin replacement influences must match the ordered selected vertices');
  const weights = new THREE.Float32BufferAttribute(new Float32Array(positions.count * 4), 4), skinIndices = originalIndices.clone();
  weights.name = original.name; weights.setUsage(original.usage);
  for (let vertex = 0; vertex < positions.count; vertex++) for (let slot = 0; slot < 4; slot++) weights.setComponent(vertex, slot, original.getComponent(vertex, slot));
  let selectedVertexCount = 0, modifiedVertices = 0, explicitInfluenceSlots = 0;
  const usedBones = new Set();
  for (let vertex = 0; vertex < positions.count; vertex++) {
    if (!selection[vertex]) continue;
    const influences = specification.influences[selectedVertexCount++];
    if (!Array.isArray(influences) || !influences.length || influences.length > 4) fail('skin replacement vertices require one to four measured influences');
    const names = new Set(), resolved = [];
    let total = 0;
    for (const influence of influences) {
      const name = influence?.bone, weight = influence?.weight;
      if (typeof name !== 'string' || !name.trim() || names.has(name)) fail('skin replacement bone names must be exact and unique per vertex');
      if (!Number.isFinite(weight) || weight <= 0 || weight > 1) fail('skin replacement weights must be finite and positive');
      const matches = mesh.skeleton.bones.flatMap((bone, index) => bone.name === name ? [index] : []);
      if (matches.length !== 1) fail(`skin replacement bone ${name} is missing or ambiguous`);
      names.add(name); usedBones.add(name); total += weight; resolved.push({ index: matches[0], weight });
    }
    if (!Number.isFinite(total) || Math.abs(total - 1) > 1e-6) fail('skin replacement weights must already be normalized');
    explicitInfluenceSlots += resolved.length;
    let modified = false;
    for (let slot = 0; slot < 4; slot++) {
      const boneIndex = resolved[slot]?.index ?? 0, weight = resolved[slot] ? resolved[slot].weight / total : 0;
      skinIndices.setComponent(vertex, slot, boneIndex); weights.setComponent(vertex, slot, weight);
      if (skinIndices.getComponent(vertex, slot) !== boneIndex) fail('measured bone index is not representable by the source joint attribute');
      if (skinIndices.getComponent(vertex, slot) !== originalIndices.getComponent(vertex, slot) || weights.getComponent(vertex, slot) !== original.getComponent(vertex, slot)) modified = true;
    }
    if (modified) modifiedVertices++;
  }
  const staged = proveSkinCandidate(mesh, weights, skinIndices);
  staged.report = { mode: 'replaceWeights', regionId: specification.regionId, vertexCount: positions.count, selectedVertexCount,
    modifiedVertices, explicitInfluenceSlots, boneNames: [...usedBones], maxRestWorldError: staged.maxRestWorldError };
  return staged;
}

// These are private region geometries. Stage and prove every candidate before
// committing any weight attribute; a failed later region leaves all originals.
function stageMeasuredSkinFilterPass(regions, specifications) {
  const staged = [], selected = new Set();
  for (const specification of specifications) {
    const id = specification.regionId;
    if (!SAFE_ID.test(id ?? '') || selected.has(id)) fail('skin filter region IDs must be unique measured names');
    selected.add(id);
    const mesh = regions.regions.get(id), geometry = mesh?.geometry, position = geometry?.attributes.position;
    if (!mesh?.isSkinnedMesh || !mesh.skeleton || !position || !finiteMatrix(mesh.matrixWorld)) fail(`skin filter region ${id} must be a valid skinned surface`);
    if (!Number.isInteger(specification.vertexCount) || position.count !== specification.vertexCount || !Number.isInteger(specification.triangleCount) || (geometry.index?.count ?? position.count) !== specification.triangleCount * 3) fail(`skin filter region ${id} topology differs from measurement`);
    if (Object.values(geometry.morphAttributes).some(value => value.length) || mesh.morphTargetInfluences?.some(value => value !== 0)) fail('morphing skin filters require a separately measured conversion');
    if (specification.mode === 'replaceWeights') { staged.push(stageMeasuredSkinReplacement(mesh, specification)); continue; }
    if (specification.mode !== undefined && specification.mode !== 'filter') fail('unknown measured skin preparation mode');
    if (specification.influences !== undefined) fail('explicit skin influences require mode replaceWeights');
    const names = specification.keepBones, minimum = specification.minRetainedWeight;
    if (!Array.isArray(names) || !names.length || names.length > mesh.skeleton.bones.length || new Set(names).size !== names.length || names.some(name => typeof name !== 'string' || !name.trim())) fail('skin filters require unique exact anatomical bone names');
    if (!Number.isFinite(minimum) || minimum <= 0 || minimum > 1) fail('skin filters require a measured retained weight threshold in (0,1]');
    const keep = new Set();
    for (const name of names) {
      const matches = mesh.skeleton.bones.flatMap((bone, index) => bone.name === name ? [index] : []);
      if (matches.length !== 1) fail(`skin filter bone ${name} is missing or ambiguous`);
      keep.add(matches[0]);
    }
    const indices = geometry.attributes.skinIndex, original = geometry.attributes.skinWeight;
    if (!indices || !original || indices.itemSize !== 4 || original.itemSize !== 4 || indices.count !== position.count || original.count !== position.count) fail('skin filters require four measured influences per vertex');
    const selection = selectedSkinVertices(specification, position.count);
    const blendWeights = specification.blendWeights, selectionCount = selection.reduce((total, value) => total + value, 0);
    if (blendWeights !== undefined && (!Array.isArray(blendWeights) || blendWeights.length !== selectionCount || [...blendWeights].some(alpha => !Number.isFinite(alpha) || alpha <= 0 || alpha > 1))) fail('skin filter blend weights must match the ordered selection with finite values in (0,1]');
    const weights = new THREE.Float32BufferAttribute(new Float32Array(position.count * 4), 4);
    weights.name = original.name; weights.setUsage(original.usage);
    let minRetainedWeight = 1, selectedVertexCount = 0, modifiedVertices = 0, removedInfluenceSlots = 0, attenuatedInfluenceSlots = 0, minBlendWeight = 1, maxBlendWeight = 0;
    for (let vertex = 0; vertex < position.count; vertex++) {
      if (!selection[vertex]) {
        for (let slot = 0; slot < 4; slot++) weights.setComponent(vertex, slot, original.getComponent(vertex, slot));
        continue;
      }
      const alpha = blendWeights?.[selectedVertexCount] ?? 1;
      selectedVertexCount++; minBlendWeight = Math.min(minBlendWeight, alpha); maxBlendWeight = Math.max(maxBlendWeight, alpha);
      let total = 0, retained = 0, removed = 0;
      for (let slot = 0; slot < 4; slot++) {
        const bone = indices.getComponent(vertex, slot), weight = original.getComponent(vertex, slot);
        if (!Number.isInteger(bone) || bone < 0 || bone >= mesh.skeleton.bones.length || !Number.isFinite(weight) || weight < 0 || weight > 1) fail(`skin filter region ${id} has invalid source influences`);
        total += weight;
        if (keep.has(bone)) retained += weight;
        else if (weight > 0) { removed++; attenuatedInfluenceSlots++; if (alpha === 1) removedInfluenceSlots++; }
      }
      if (!Number.isFinite(total) || Math.abs(total - 1) > 1e-4 || retained <= 0 || retained / total + 1e-8 < minimum) fail(`skin filter region ${id} retains less anatomical weight than measured`);
      minRetainedWeight = Math.min(minRetainedWeight, retained / total);
      if (removed) modifiedVertices++;
      for (let slot = 0; slot < 4; slot++) {
        const originalWeight = original.getComponent(vertex, slot);
        const target = keep.has(indices.getComponent(vertex, slot)) ? originalWeight / retained : 0;
        const weight = alpha === 1 ? target : originalWeight * (1 - alpha) + target * alpha;
        weights.setComponent(vertex, slot, weight);
      }
    }
    const candidate = proveSkinCandidate(mesh, weights);
    candidate.report = { mode: 'filter', regionId: id, vertexCount: position.count, selectedVertexCount, modifiedVertices, removedInfluenceSlots,
      attenuatedInfluenceSlots, minRetainedWeight, minBlendWeight, maxBlendWeight, maxRestWorldError: candidate.maxRestWorldError };
    staged.push(candidate);
  }
  return staged;
}

function applyMeasuredSkinFilters(regions, config, sourceSha256, diagnostics) {
  guardSource(config, sourceSha256);
  if (config.version !== 1 || config.calibrated !== true) fail('skin filters require calibrated version1 measured regions');
  if ((config.regions === undefined) === (config.passes === undefined)) fail('skin filters require regions or ordered passes, never both');
  const passes = config.passes === undefined ? [{ regions: config.regions }] : config.passes;
  if (!Array.isArray(passes) || !passes.length || passes.length > 64) fail('skin filters require nonempty bounded ordered passes');
  for (const pass of passes) if (!Array.isArray(pass?.regions) || !pass.regions.length || pass.regions.length > 128) fail('each skin filter pass requires nonempty bounded measured regions');
  regions.gltf.scene.updateMatrixWorld(true);
  const originals = new Map(), reports = [];
  let maxRestWorldError = 0;
  try {
    for (let passIndex = 0; passIndex < passes.length; passIndex++) {
      // Later passes deliberately read the committed output of earlier passes.
      const staged = stageMeasuredSkinFilterPass(regions, passes[passIndex].regions);
      for (const value of staged) {
        if (!originals.has(value.geometry)) originals.set(value.geometry, value);
        value.geometry.setAttribute('skinWeight', value.weights);
        value.geometry.setAttribute('skinIndex', value.skinIndices);
        reports.push({ passIndex, ...value.report });
      }
    }
    // Prove the cumulative result against the input before the first pass,
    // rather than allowing individually small errors to accumulate unnoticed.
    const point = new THREE.Vector3();
    for (const { mesh, worldRest } of originals.values()) {
      mesh.skeleton.update();
      for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) {
        mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld);
        const at = vertex * 3, error = Math.hypot(point.x - worldRest[at], point.y - worldRest[at + 1], point.z - worldRest[at + 2]);
        if (!Number.isFinite(error) || error > 1e-6) fail('ordered skin filters change their cumulative world rest surface');
        maxRestWorldError = Math.max(maxRestWorldError, error);
      }
    }
  } catch (error) {
    for (const { geometry, original, originalIndices } of originals.values()) {
      geometry.setAttribute('skinWeight', original); geometry.setAttribute('skinIndex', originalIndices);
    }
    throw error;
  }
  // Diagnostics commit together with the final result. A late failure exposes
  // no successful earlier passes or partially corrected geometry.
  diagnostics.skinFiltersPrepared = true;
  diagnostics.skinFilterPasses = passes.length;
  diagnostics.skinFilteredRegions = new Set(reports.map(value => value.regionId)).size;
  diagnostics.skinFilteredVertices = reports.reduce((total, value) => total + value.modifiedVertices, 0);
  diagnostics.skinFilterRegions = reports;
  diagnostics.skinMaxRestWorldError = maxRestWorldError;
}

/**
 * prepareImportedParts(gltf, characterRig, {sourceSha256})
 *
 * No descriptors: returns the SAME cached gltf and owns nothing (legacy assets).
 * partRegions: version1 region descriptor plus sourceSha256 (or targetSha256
 * on a transferred region map) of this exact GLB.
 * splitHair: {version:1,calibrated:true,sourceSha256,headBone,parts:[
 *   {regionId,vertexCount,triangleCount,meshLocalToHead:[16 measured values],
 *    neutralSkinMatrix?:[16 measured values],
 *    descriptor:{version:1,namespace,rootVertices,chains:[...]}}
 * ]}. Curves and cap indices must be measured against each FINAL compact region,
 * before poseOffsets. meshLocalToHead is the measured inverseHeadWorld*meshWorld.
 * partSkinFilters: {version:1,calibrated:true,sourceSha256,regions:[
 *   {regionId,vertexCount,triangleCount,keepBones:[exact existing bone names],
 *    minRetainedWeight:number in (0,1],
 *    vertexRanges?:[[start,count],...], vertexIndices?:[compact vertex indices],
 *    blendWeights?:[measured alpha per selected vertex in (0,1]]}
 * ]}. After partition and before hair, remove only non-anatomical influences
 * from these explicitly measured regions and renormalize their existing kept
 * weights. Every original skin index remains unchanged. All vertices must keep
 * at least the measured anatomical weight fraction, and their actual world
 * rest surface must remain within1e-6 before any region is committed. A failed
 * filter leaves all original region weights intact, with a diagnostic; optional
 * hair preparation remains independent. This never applies by default.
 * An optional selection is strictly ordered, disjoint and in bounds. Ranges and
 * indices are mutually exclusive; neither means the complete measured region.
 * Only selected vertices are filtered, while the rest proof covers the whole
 * region. This permits exact seam copies without changing an entire neighbor.
 * Optional blend weights follow ascending selected vertex order (all vertices
 * when no selection is provided). Each alpha interpolates existing original
 * weights toward their kept-and-renormalized values; omitted means alpha1.
 * Alpha0 vertices stay outside the selection. No radius or transition strength
 * is inferred here, and no new skin influence slot or bone is introduced.
 * The backward-compatible regions array represents one pass. Alternatively,
 * passes:[{regions:[...]},...] applies measured passes in order; the two fields
 * are exclusive. IDs are unique within each pass but may recur in later passes.
 * Later thresholds are measured on the preceding output. Every pass validates
 * before its commit; any late error restores the original weights from before
 * ALL passes and leaves success diagnostics empty. A cumulative whole-region
 * rest proof also compares the final output against the initial input. Reports
 * include passIndex (zero-based); skinFilteredVertices counts vertex operations
 * across passes, while skinFilteredRegions counts distinct region IDs.
 *
 * A region may explicitly opt into mode:'replaceWeights' with influences:[
 *   [{bone:'ExactExistingBone',weight:0.8},{bone:'OtherExistingBone',weight:0.2}],
 *   ...one list per selected vertex in ascending order...
 * ]. Each list contains1..4 distinct existing bone names and finite positive
 * weights, already normalized within1e-6. Only floating representation error is
 * normalized before writing Float32 weights; unused slots receive index0/weight0.
 * The region retains the same topology/selection guards. Filter-only keepBones,
 * minRetainedWeight and blendWeights are forbidden in this explicit mode. Skin
 * indices and weights are replaced together on private geometries; every target
 * index must be representable by the source joint attribute. This can introduce
 * an existing anatomical bone influence absent from that vertex, never a new
 * bone. There is no inference of target anatomy, positions or falloff. All pass
 * and cumulative rest proofs apply, and any failure restores BOTH attributes
 * from before all passes. Morph targets still require a separate verified path.
 *
 * Source and head rest transforms are verified, every skinned hair vertex must
 * equal its raw local position after an optional explicitly measured neutral
 * skin affine matrix (identity otherwise), within1e-6 in world units. Exporter
 * bind-unit conversions therefore require evidence; posed skin still fails.
 * meshLocalToHead excludes that neutral skin matrix; the bake includes both.
 * Morph targets on a partitioned source mesh are refused until their named
 * animation-owner Groups survive every later skeleton/composition clone. The
 * unchanged original body is retained rather than silently breaking its clips.
 * Region positions/normals/tangents are baked into Head-local coordinates,
 * preserving every world rest vertex, triangle, UV and other surface attribute.
 * The two new skin attributes intentionally replace the proven rest skin weights.
 *
 * Invalid region metadata keeps the original body. Invalid optional hair keeps
 * all recovered regions in their original skinned state. Diagnostics state the
 * refusal; no helper bones or fake hair motion are substituted. rigidEquipment
 * is reserved for a separately measured implementation and is not animated here.
 *
 * Return {gltf,regions,articulationDescriptor,diagnostics,dispose}. Call dispose
 * AFTER ImportedCharacter owns its clones; it releases temporary owned geometry,
 * materials and skeletons, never cached resources or shared textures.
 */
export function prepareImportedParts(gltf, rig = {}, { sourceSha256 } = {}) {
  const diagnostics = { regionsPrepared: false, hairPrepared: false, hairPieces: 0,
    hairMaxNeutralWorldError: 0, hairMaxRestWorldError: 0, regionError: null, hairError: null,
    skinFiltersPrepared: false, skinFilterPasses: 0, skinFilteredRegions: 0, skinFilteredVertices: 0,
    skinMaxRestWorldError: 0, skinFilterRegions: [], skinFilterError: null, rigidEquipmentPrepared: false,
    boneRestCorrectionsApplied: false, boneRestCorrectionError: null, boneRestCorrectionDiagnostics: null,
    animationsSuppressedForBoneRestCorrection: false, suppressedAnimationClips: 0,
    rigidEquipmentError: rig.rigidEquipment?.length ? 'Rigid equipment requires separately verified regions and measured actuator calibration' : null };
  let regions = null, hairRigs = [], disposed = false;
  const dispose = () => {
    if (disposed) return false;
    disposed = true; hairRigs.forEach(value => value.dispose()); regions?.dispose(); return true;
  };
  const result = { gltf, regions: new Map(), articulationDescriptor: rig.articulation, diagnostics, dispose };
  if (rig.partRegions === undefined && rig.splitHair === undefined && rig.partSkinFilters === undefined && rig.boneRestCorrections === undefined) return result;
  try {
    guardSource(rig.partRegions, sourceSha256);
    const sourceMeshes = [];
    gltf?.scene?.traverse(node => { if (node.isMesh) sourceMeshes.push(node); });
    for (const specification of rig.partRegions.meshes ?? []) {
      const mesh = sourceMeshes[specification.meshIndex];
      if (mesh && Object.values(mesh.geometry?.morphAttributes ?? {}).some(value => value.length)) {
        fail('partitioned morph animation requires a separately verified owner-clone path');
      }
    }
    regions = createImportedPartRegions(gltf, rig.partRegions);
    result.gltf = regions.gltf; result.regions = regions.regions; diagnostics.regionsPrepared = true;
  } catch (error) {
    diagnostics.regionError = error.message; return result;
  }
  if (rig.partSkinFilters !== undefined) {
    try { applyMeasuredSkinFilters(regions, rig.partSkinFilters, sourceSha256, diagnostics); }
    catch (error) { diagnostics.skinFilterError = error.message; }
  }
  if (rig.boneRestCorrections !== undefined) {
    try {
      const correction = applyBoneRestCorrections(regions.gltf.scene, rig.boneRestCorrections, { sourceSha256, privateScene: true });
      diagnostics.boneRestCorrectionsApplied = correction.applied;
      diagnostics.boneRestCorrectionDiagnostics = correction.diagnostics;
      // Source clips contain locals for the old joint pivots. The cache and
      // separate editing files retain them; corrected actors never autoplay them.
      diagnostics.suppressedAnimationClips = result.gltf.animations?.length ?? 0;
      diagnostics.animationsSuppressedForBoneRestCorrection = true;
      result.gltf = { ...result.gltf, animations: [] };
    } catch (error) { diagnostics.boneRestCorrectionError = error.message; }
  }
  if (rig.splitHair === undefined) return result;
  const staged = [], temporaryGeometry = [];
  try {
    const config = rig.splitHair;
    guardSource(config, sourceSha256);
    if (config.version !== 1 || config.calibrated !== true || !Array.isArray(config.parts) || !config.parts.length || config.parts.length > 64) fail('hair requires calibrated version1 measured parts');
    if (rig.boneMap?.head && config.headBone !== rig.boneMap.head) fail('hair anchor must match the mapped head');
    const scene = regions.gltf.scene, head = findBone(scene, config.headBone);
    scene.updateMatrixWorld(true);
    if (!finiteMatrix(head.matrixWorld) || head.matrixWorld.determinant() <= 0) fail('invalid measured head transform');
    const inverseHead = head.matrixWorld.clone().invert(), selected = new Set(), namespaces = new Set(), addedNames = new Set();
    for (const piece of config.parts) {
      if (!SAFE_ID.test(piece.regionId ?? '') || selected.has(piece.regionId)) fail('hair region IDs must be unique measured names');
      selected.add(piece.regionId);
      const source = regions.regions.get(piece.regionId);
      if (!source?.isMesh || source.isInstancedMesh || source.children.length) fail(`hair region${piece.regionId} must be a leaf surface`);
      const geometry = source.geometry, positions = geometry?.attributes.position;
      const count = (geometry?.index?.count ?? positions?.count ?? 0) / 3;
      if (!positions || !Number.isInteger(piece.vertexCount) || piece.vertexCount !== positions.count || !Number.isInteger(piece.triangleCount) || piece.triangleCount !== count) fail(`hair region${piece.regionId} topology differs from measurement`);
      if (Object.values(geometry.morphAttributes).some(value => value.length) || source.morphTargetInfluences?.some(value => value !== 0)) fail('morphing hair requires a separately measured conversion');
      source.updateWorldMatrix(true, false);
      const toHead = inverseHead.clone().multiply(source.matrixWorld);
      const expected = measuredMatrix(piece.meshLocalToHead, 'meshLocalToHead');
      if (!sameMatrix(toHead, expected, 1e-6)) fail(`hair region${piece.regionId} transform differs from its measured rest pose`);
      const neutral = piece.neutralSkinMatrix === undefined ? identity() : measuredMatrix(piece.neutralSkinMatrix, 'neutralSkinMatrix');
      if (!source.isSkinnedMesh && !sameMatrix(neutral, identity(), 1e-10)) fail('an unskinned region cannot use a neutral skin transform');
      if (source.isSkinnedMesh) source.skeleton.update();
      const raw = new THREE.Vector3(), skinned = new THREE.Vector3(), worldRest = [];
      for (let vertex = 0; vertex < positions.count; vertex++) {
        raw.fromBufferAttribute(positions, vertex).applyMatrix4(neutral).applyMatrix4(source.matrixWorld);
        source.getVertexPosition(vertex, skinned); skinned.applyMatrix4(source.matrixWorld);
        const error = raw.distanceTo(skinned);
        if (!Number.isFinite(error) || error > 1e-6) fail(`hair region${piece.regionId} is posed; cannot discard existing skin weights`);
        diagnostics.hairMaxNeutralWorldError = Math.max(diagnostics.hairMaxNeutralWorldError, error);
        worldRest.push(skinned.clone());
      }
      toHead.multiply(neutral);
      const transformed = transformGeometry(geometry, toHead); temporaryGeometry.push(transformed);
      const rigid = new THREE.Mesh(); THREE.Mesh.prototype.copy.call(rigid, source, false);
      rigid.geometry = transformed; rigid.position.set(0, 0, 0); rigid.quaternion.identity(); rigid.scale.set(1, 1, 1);
      rigid.matrix.copy(identity()); rigid.matrixAutoUpdate = true; head.add(rigid); rigid.updateWorldMatrix(true, true);
      let hair;
      try { hair = createSplitDreadlockRig(rigid, transformCurve(piece.descriptor, toHead)); }
      finally { rigid.removeFromParent(); }
      if (namespaces.has(piece.descriptor.namespace)) { hair.dispose(); fail('hair namespaces must be unique in the final actor'); }
      namespaces.add(piece.descriptor.namespace);
      let collision = false;
      hair.mesh.traverse(node => {
        if (!node.isBone) return;
        if (scene.getObjectByName(node.name) || addedNames.has(node.name)) collision = true;
        addedNames.add(node.name);
      });
      if (collision) { hair.dispose(); fail('generated hair bones collide with existing actor nodes'); }
      staged.push({ source, parent: source.parent, hair, worldRest, id: piece.regionId });
    }
    const base = rig.articulation ?? { version: 1 };
    const dreadlocks = [...(base.dreadlocks ?? []), ...staged.flatMap(value => value.hair.articulationDescriptor.dreadlocks)];
    if (new Set(dreadlocks.map(value => value.id)).size !== dreadlocks.length) fail('merged hair chain IDs must be unique');
    // Commit only after every piece passes. A failed second piece leaves the
    // complete original skinned regions rendered, including the first piece.
    for (const value of staged) {
      value.source.removeFromParent(); head.add(value.hair.mesh); regions.regions.set(value.id, value.hair.mesh);
    }
    hairRigs = staged.map(value => value.hair);
    result.articulationDescriptor = { ...base, version: 1, dreadlocks };
    diagnostics.hairPrepared = true; diagnostics.hairPieces = hairRigs.length;
    result.gltf.scene.updateMatrixWorld(true);
    for (const { hair, worldRest } of staged) {
      hair.mesh.skeleton.update();
      worldRest.forEach((before, vertex) => {
        const after = hair.mesh.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(hair.mesh.matrixWorld);
        const error = before.distanceTo(after);
        diagnostics.hairMaxRestWorldError = Math.max(diagnostics.hairMaxRestWorldError, error);
        if (!Number.isFinite(error) || error > 2e-6) fail('prepared hair changes its measured world rest surface');
      });
    }
  } catch (error) {
    for (const value of staged) {
      value.hair.dispose();
      // Commit-time errors must also restore original surfaces and region IDs.
      if (!value.source.parent) value.parent.add(value.source);
      regions.regions.set(value.id, value.source);
    }
    hairRigs = []; diagnostics.hairPrepared = false; diagnostics.hairPieces = 0;
    result.articulationDescriptor = rig.articulation; diagnostics.hairError = error.message;
  } finally { temporaryGeometry.forEach(value => value.dispose()); }
  return result;
}

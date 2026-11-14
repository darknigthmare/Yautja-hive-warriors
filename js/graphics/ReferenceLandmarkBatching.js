/* Static reference meshes become shared instances. Mechanism-held mesh nodes
 * remain live. Parent transform/visibility changes are mirrored after updates,
 * preserving opened doors, claimed props and moving feature groups. */
import * as THREE from 'three';
import { createSurfaceMaterial } from './SurfaceLibrary.js';

const IGNORED_FIELDS = new Set(['scene', 'root', 'referenceRoot', 'game', 'envObjects',
  'geometries', 'materials', 'referenceOwnedRoots', 'referenceResourceRefs', 'referenceProfile',
  'worldStreaming', 'tacticalBridges', 'navigation', 'referenceContacts', 'referenceInterest', 'referenceBatches', 'sectorVisuals', 'gateVisuals', 'objectiveMarkers', 'relayVisuals', 'corridorVisuals']);
const fingerprint = attribute => {
  let hash = 2166136261; const bytes = new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
  for (const value of bytes) hash = Math.imul(hash ^ value, 16777619);
  return `${attribute.itemSize}/${attribute.count}/${hash >>> 0}`;
};
const geometryKey = geometry => Object.entries(geometry.attributes).map(([key, value]) => key + fingerprint(value)).join('|') + (geometry.index ? fingerprint(geometry.index) : '');
function unitGeometry(source) {
  const p = source.parameters ?? {}; let reference = null, scale = [1, 1, 1];
  switch (source.type) {
    case 'BoxGeometry': reference = new THREE.BoxGeometry(p.width, p.height, p.depth, p.widthSegments, p.heightSegments, p.depthSegments); scale = [p.width, p.height, p.depth]; break;
    case 'SphereGeometry': reference = new THREE.SphereGeometry(p.radius, p.widthSegments, p.heightSegments, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength); scale = [p.radius, p.radius, p.radius]; break;
    case 'CylinderGeometry': reference = new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, p.radialSegments, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength); scale = [Math.max(p.radiusTop, p.radiusBottom), p.height, Math.max(p.radiusTop, p.radiusBottom)]; break;
    case 'ConeGeometry': reference = new THREE.ConeGeometry(p.radius, p.height, p.radialSegments, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength); scale = [p.radius, p.height, p.radius]; break;
    case 'PlaneGeometry': reference = new THREE.PlaneGeometry(p.width, p.height, p.widthSegments, p.heightSegments); scale = [p.width, p.height, 1]; break;
  }
  const matches = reference && geometryKey(reference) === geometryKey(source) && !scale.some(value => !Number.isFinite(value) || Math.abs(value) < 1e-8);
  reference?.dispose();
  if (!matches) return { geometry: source.clone(), scale: [1, 1, 1] };
  let geometry;
  switch (source.type) {
    case 'BoxGeometry': geometry = new THREE.BoxGeometry(1, 1, 1, p.widthSegments, p.heightSegments, p.depthSegments); break;
    case 'SphereGeometry': geometry = new THREE.SphereGeometry(1, p.widthSegments, p.heightSegments, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength); break;
    case 'CylinderGeometry': geometry = new THREE.CylinderGeometry(p.radiusTop / scale[0], p.radiusBottom / scale[0], 1, p.radialSegments, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength); break;
    case 'ConeGeometry': geometry = new THREE.ConeGeometry(1, 1, p.radialSegments, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength); break;
    case 'PlaneGeometry': geometry = new THREE.PlaneGeometry(1, 1, p.widthSegments, p.heightSegments); break;
  }
  return { geometry, scale };
}
function materialKey(material) {
  return JSON.stringify([material.type, material.emissive?.getHex(), material.emissiveIntensity,
    material.roughness, material.metalness, material.opacity, material.side, material.depthWrite,
    material.map?.uuid, material.normalMap?.uuid, material.roughnessMap?.uuid, material.normalScale?.toArray(), material.alphaTest, material.depthTest,
    material.blending, material.flatShading, material.toneMapped, material.fog, material.wireframe,
    material.metalnessMap?.uuid, material.emissiveMap?.uuid, material.alphaMap?.uuid, material.aoMap?.uuid]);
}

export function batchReferenceLandmarks(environment) {
  const protectedMeshes = new Set(), protectedMaterials = new Set(), seen = new Set(), templates = new Map();
  const inspect = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 6) return;
    seen.add(value);
    if (value.isObject3D) { if (value.isMesh) protectedMeshes.add(value); return; }
    if (value.isMaterial) { protectedMaterials.add(value); return; }
    if (value.isVector3 || value.isBufferGeometry || value instanceof Map || value instanceof Set) return;
    for (const item of Object.values(value)) inspect(item, depth + 1);
  };
  for (const [key, value] of Object.entries(environment)) if (!IGNORED_FIELDS.has(key)) inspect(value);
  // Salvage fades a complete marine subtree by traversal rather than a held mesh.
  for (const marine of environment.fallenMarines ?? []) marine.group?.traverse(node => { if (node.isMesh) protectedMeshes.add(node); });
  for (const mesh of protectedMeshes) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) protectedMaterials.add(material);

  const meshes = [], lights = [];
  environment.referenceRoot.traverse(node => {
    if (node.isPointLight) lights.push(node);
    if (node.isMesh) meshes.push(node);
  });
  for (const node of meshes) for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
    if (!material?.isMeshStandardMaterial || material.transparent || material.map) continue;
    const kind = material.metalness > .35 ? 'metal'
      : environment.type === 'hive' ? 'chitin'
      : environment.organic && material.roughness > .85 ? 'bark'
      : !environment.organic && material.roughness > .6 ? 'stone' : null;
    if (!kind) continue;
    if (!templates.has(kind)) templates.set(kind, createSurfaceMaterial(kind));
    const template = templates.get(kind);
    material.map = template.map; material.normalMap = template.normalMap;
    material.roughnessMap = template.roughnessMap; material.normalScale.copy(template.normalScale);
    material.needsUpdate = true;
  }
  const batches = new Map(), normalized = new Map();
  for (const mesh of meshes) {
    if (mesh.isSkinnedMesh || mesh.isInstancedMesh || protectedMeshes.has(mesh) || !mesh.visible ||
        Array.isArray(mesh.material) || mesh.material.transparent || Object.keys(mesh.geometry.morphAttributes).length) continue;
    if (!normalized.has(mesh.geometry)) normalized.set(mesh.geometry, unitGeometry(mesh.geometry));
    const unit = normalized.get(mesh.geometry);
    const preserveMaterial = protectedMaterials.has(mesh.material) || mesh.material.vertexColors || !mesh.material.color;
    const materialId = preserveMaterial ? mesh.material.uuid : materialKey(mesh.material);
    const key = geometryKey(unit.geometry) + '/' + materialId;
    if (!batches.has(key)) batches.set(key, { geometry: unit.geometry, material: mesh.material, preserveMaterial, entries: [] });
    mesh.updateMatrix();
    batches.get(key).entries.push({ node: mesh, parent: mesh.parent,
      local: mesh.matrix.clone().scale(new THREE.Vector3(...unit.scale)), visible: mesh.visible, color: mesh.material.color?.clone() });
  }
  const records = [], ownedGeometries = new Set(); let hiddenMeshes = 0;
  for (const batch of batches.values()) {
    if (batch.entries.length < 2) continue;
    const material = batch.preserveMaterial ? batch.material : batch.material.clone();
    if (!batch.preserveMaterial) material.color.setHex(0xffffff);
    const mesh = new THREE.InstancedMesh(batch.geometry, material, batch.entries.length);
    if (!batch.preserveMaterial) batch.entries.forEach((entry, i) => mesh.setColorAt(i, entry.color));
    mesh.name = `reference-shared-instances-${records.length}`;
    mesh.castShadow = batch.entries.some(entry => entry.node.castShadow); mesh.receiveShadow = true;
    mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.referenceFixedBatch = true; mesh.userData.sourceMeshes = batch.entries.length;
    for (const entry of batch.entries) { entry.node.removeFromParent(); hiddenMeshes++; }
    environment.addReferenceObject(mesh);
    ownedGeometries.add(mesh.geometry); records.push({ mesh, entries: batch.entries });
  }
  for (const unit of normalized.values()) if (!ownedGeometries.has(unit.geometry)) unit.geometry.dispose();
  templates.forEach(material => material.dispose());
  lights.sort((a, b) => b.intensity - a.intensity);
  for (const light of lights.slice(8)) light.visible = false;
  environment.referenceBatches = records;
  synchronizeReferenceLandmarks(environment);
  return { sourceMeshes: meshes.length, staticBatches: records.length, hiddenSourceMeshes: hiddenMeshes,
    pointLights: lights.length, activePointLights: Math.min(8, lights.length),
    interpretation: 'reference-inspired; fixed surfaces instanced, mechanism-held nodes retained' };
}

const inverseRoot = new THREE.Matrix4(), matrix = new THREE.Matrix4(), hidden = new THREE.Matrix4().makeScale(0, 0, 0);
export function synchronizeReferenceLandmarks(environment) {
  if (!environment.referenceRoot || !environment.referenceBatches?.length) return;
  environment.root.updateMatrixWorld(true);
  inverseRoot.copy(environment.referenceRoot.matrixWorld).invert();
  for (const record of environment.referenceBatches) {
    let anyVisible = false;
    for (let i = 0; i < record.entries.length; i++) {
      const entry = record.entries[i]; let visible = entry.visible, parent = entry.parent;
      while (parent && parent !== environment.referenceRoot) { if (!parent.visible) visible = false; parent = parent.parent; }
      visible &&= parent === environment.referenceRoot; anyVisible ||= visible;
      if (visible) matrix.copy(inverseRoot).multiply(entry.parent.matrixWorld).multiply(entry.local);
      record.mesh.setMatrixAt(i, visible ? matrix : hidden);
    }
    record.mesh.visible = anyVisible;
    record.mesh.instanceMatrix.needsUpdate = true;
  }
}

// CPU-side geometry accounting only; this does not measure a GPU or certify FPS.
import * as THREE from 'three';
import { createHonorGuardModel } from '../../../../js/graphics/SupportModels.js';
import { getClanHunterVisualCacheStats } from '../../../../js/graphics/ClanHunterModel.js';
import { disposeObject } from '../../../../js/engine/SceneResources.js';

const root = createHonorGuardModel(0), arrays = new Set(), materials = new Set();
let triangles = 0, drawMeshes = 0;
root.traverse(mesh => {
  if (!mesh.isMesh) return;
  drawMeshes++;
  triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
  materials.add(mesh.material);
  for (const attribute of Object.values(mesh.geometry.attributes)) arrays.add(attribute.array);
  for (const attribute of Object.values(mesh.geometry.morphAttributes).flat()) arrays.add(attribute.array);
  if (mesh.geometry.index) arrays.add(mesh.geometry.index.array);
  if (mesh.isInstancedMesh) arrays.add(mesh.instanceMatrix.array);
});
const box = new THREE.Box3().setFromObject(root);
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), engine: THREE.REVISION, triangles, drawMeshes, materials: materials.size,
  ownedBufferBytes: [...arrays].reduce((total, array) => total + array.byteLength, 0),
  bounds: { min: box.min.toArray(), max: box.max.toArray() }, anatomy: root.userData.anatomy, rig: root.userData.visualRig,
  constantCpuTemplate: getClanHunterVisualCacheStats() }, null, 2));
disposeObject(root);

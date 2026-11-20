// Run from any cwd: node docs/qa/fidelity-20261109/humans/measure-humans.mjs
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createMarineModel } from '../../../../js/graphics/SupportModels.js';
import { disposeObject } from '../../../../js/engine/SceneResources.js';

const hash = relative => createHash('sha256').update(readFileSync(new URL(relative, import.meta.url))).digest('hex');
const rows = [];
for (const role of ['marine', 'smartgunner', 'flametrooper', 'medic', 'commtech', 'sniper', 'sadar', 'exosuit']) {
  const group = createMarineModel(role);
  try {
    let triangles = 0, meshes = 0, finite = true;
    const materials = new Set();
    group.traverse(mesh => {
      if (!mesh.isMesh) return;
      meshes++;
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      materials.add(mesh.material);
      for (const attribute of ['position', 'normal', 'uv'])
        finite &&= Boolean(mesh.geometry.attributes[attribute]?.array.every(Number.isFinite));
    });
    const bounds = new THREE.Box3().setFromObject(group);
    rows.push({ role, triangles, meshes, materials: materials.size, finite,
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
      anatomy: group.userData.anatomy, visualFidelity1to1Verified: group.userData.visualFidelity1to1Verified });
  } finally { disposeObject(group); }
}
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), threeRevision: THREE.REVISION,
  sourceHashes: { MarineAnatomy: hash('../../../../js/graphics/MarineAnatomy.js'),
    SupportModels: hash('../../../../js/graphics/SupportModels.js') },
  method: 'actual factory buffer triangles and mesh/material batches; not FPS', rows }, null, 2));

// Release GPU resources owned by a removed object. Managers can retain shared assets.
export function disposeObject(object, retained = new Set()) {
  if (!object) return;
  object.removeFromParent();
  // A clone of a cached generated model shares its template's GPU resources: detach it, never dispose it.
  const sharedClones = [];
  object.traverse(child => { if (child !== object && child.userData?.sharedGeneratedClone) sharedClones.push(child); });
  sharedClones.forEach(child => child.removeFromParent());
  const geometries = new Set();
  const materials = new Set();
  const instances = new Set();
  object.traverse(child => {
    // In r160 instanceMatrix and instanceColor are released by the renderer's
    // InstancedMesh dispose listener, independently of geometry/material.
    if (child.isInstancedMesh && typeof child.dispose === 'function') instances.add(child);
    // A per-actor skeleton (merged creature body) owns its bone texture.
    if (child.isSkinnedMesh && child.userData?.ownsSkeleton) child.skeleton?.dispose();
    // A geometry flagged as a shared template (e.g. cached marine roles) outlives its clones.
    if (child.geometry && !retained.has(child.geometry) && !child.geometry.userData?.sharedTemplate) geometries.add(child.geometry);
    const list = Array.isArray(child.material) ? child.material : [child.material];
    list.forEach(material => {
      if (material && !retained.has(material)) materials.add(material);
    });
  });
  instances.forEach(mesh => mesh.dispose());
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}

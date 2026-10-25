// Release GPU resources owned by a removed object. Managers can retain shared assets.
export function disposeObject(object, retained = new Set()) {
  if (!object) return;
  object.removeFromParent();
  const geometries = new Set();
  const materials = new Set();
  object.traverse(child => {
    if (child.geometry && !retained.has(child.geometry)) geometries.add(child.geometry);
    const list = Array.isArray(child.material) ? child.material : [child.material];
    list.forEach(material => {
      if (material && !retained.has(material)) materials.add(material);
    });
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}

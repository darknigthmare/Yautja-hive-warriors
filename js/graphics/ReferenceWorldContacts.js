/* Grounded props share conservative physical cover between movement and rays.
 * Render-interest wrappers never disable physics. Insertion/cardinal lanes
 * remain reserved; tiny, elevated, transparent and purely decorative surfaces
 * are not silently promoted into solid boxes. */
import * as THREE from 'three';

const world = new THREE.Matrix4(), box = new THREE.Box3(), center = new THREE.Vector3(), size = new THREE.Vector3();
function connectedVisible(node, parent, root) {
  if (!node.visible) return false;
  while (parent && parent !== root) {
    if (!parent.visible && !parent.userData.referenceRenderCull) return false;
    parent = parent.parent;
  }
  return parent === root;
}

export function buildReferenceContacts(environment) {
  const contacts = [];
  environment.referenceRoot.updateMatrixWorld(true);
  environment.referenceRoot.traverse(mesh => {
    if (!mesh.isMesh || mesh.isInstancedMesh || Array.isArray(mesh.material) || mesh.material.transparent || !mesh.visible) return;
    mesh.geometry.computeBoundingBox();
    const localBounds = mesh.geometry.boundingBox.clone();
    box.copy(localBounds).applyMatrix4(mesh.matrixWorld); box.getCenter(center); box.getSize(size);
    if (size.y < .55 || box.min.y > .55 || size.x < .3 || size.z < .3 || Math.max(size.x, size.z) > 50) return;
    if (Math.abs(center.x) < size.x / 2 + 9 || Math.abs(center.z) < size.z / 2 + 9 || Math.hypot(center.x, center.z) < 15 + Math.hypot(size.x, size.z) / 2 || Math.abs(Math.hypot(center.x, center.z) - 28) < 4 + Math.hypot(size.x, size.z) / 2) {
      mesh.userData.referenceNonBlockingLaneProp = true; return;
    }
    const collider = { x: center.x, z: center.z, halfWidth: size.x / 2, halfDepth: size.z / 2,
      baseY: box.min.y, height: size.y, rotation: 0, enabled: true, owner: 'reference-ground-prop' };
    Object.defineProperty(collider, 'mesh', { value: mesh });
    const parent = mesh.parent;
    collider.isCollisionActive = () => connectedVisible(mesh, mesh.parent ?? parent, environment.referenceRoot);
    environment.colliders.push(collider);
    contacts.push({ collider, mesh, parent: mesh.parent, localBounds });
  });
  environment.referenceContacts = contacts;
  return contacts.length;
}

export function updateReferenceContacts(environment) {
  for (const contact of environment.referenceContacts ?? []) {
    const parent = contact.mesh.parent ?? contact.parent;
    contact.collider.enabled = connectedVisible(contact.mesh, parent, environment.referenceRoot);
    if (!contact.collider.enabled) continue;
    contact.mesh.updateMatrix(); world.copy(parent.matrixWorld).multiply(contact.mesh.matrix);
    box.copy(contact.localBounds).applyMatrix4(world); box.getCenter(center); box.getSize(size);
    Object.assign(contact.collider, { x: center.x, z: center.z, halfWidth: size.x / 2, halfDepth: size.z / 2,
      baseY: box.min.y, height: size.y });
  }
}

export function buildReferenceInterest(environment) {
  const records = [];
  const visit = parent => {
    for (const node of [...parent.children]) {
      if (!node.isGroup && !node.isMesh) continue;
      box.setFromObject(node, true); box.getSize(size);
      if (!Number.isFinite(size.x) || box.isEmpty()) continue;
      if (Math.hypot(size.x, size.z) > 42 && node.isGroup) { visit(node); continue; }
      if (Math.max(size.x, size.z) > 60) continue;
      const wrapper = new THREE.Group(); wrapper.name = 'reference-render-interest'; wrapper.userData.referenceRenderCull = true;
      parent.add(wrapper); wrapper.add(node);
      records.push({ wrapper, bounds: box.clone(), radius: (environment.referenceProfile?.builders.length ?? 0) > 20 ? 18 : 22 });
    }
  };
  visit(environment.referenceRoot); environment.referenceInterest = records;
  return records.length;
}

export function updateReferenceInterest(environment, positions) {
  for (const record of environment.referenceInterest ?? []) {
    record.wrapper.visible = positions.some(position => {
      const x = THREE.MathUtils.clamp(position.x, record.bounds.min.x, record.bounds.max.x);
      const z = THREE.MathUtils.clamp(position.z, record.bounds.min.z, record.bounds.max.z);
      return Math.hypot(position.x - x, position.z - z) < record.radius;
    });
  }
}

/* Boughs have a narrow physical footprint, not the enclosing XZ rectangle.
 * Their actual triangles own feet, projectiles and camera contacts. */
import * as THREE from 'three';

export function buildMeasuredCanopyBough(environment, parent, { id, from, to }, material) {
  const start = new THREE.Vector3(from[0], 6.025, from[1]), end = new THREE.Vector3(to[0], 6.025, to[1]);
  const span = end.clone().sub(start), length = span.length();
  const geometry = new THREE.CylinderGeometry(.65, .9, length, 16, 8);
  const vertices = geometry.attributes.position;
  for (let index = 0; index < vertices.count; index++) {
    const x = vertices.getX(index), y = vertices.getY(index), z = vertices.getZ(index);
    const irregularity = 1 + Math.sin(y * .8 + Math.atan2(z, x) * 3) * .04;
    vertices.setXYZ(index, x * irregularity, y, z * irregularity);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingBox();
  const mesh = new THREE.Mesh(geometry, material); mesh.name = id;
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize());
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); mesh.updateWorldMatrix(true, false);
  const box = geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  const bounds = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0), closest = new THREE.Vector2();
  const dx = to[0] - from[0], dz = to[1] - from[1], squaredLength = dx * dx + dz * dz;
  const surfaceAt = (x, z, underside = false) => {
    const t = Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / squaredLength));
    closest.set(from[0] + dx * t, from[1] + dz * t);
    if (Math.hypot(x - closest.x, z - closest.y) > .94) return NaN;
    mesh.updateWorldMatrix(true, false); ray.set(new THREE.Vector3(x, underside ? box.min.y - 1 : box.max.y + 1, z), underside ? up : down); ray.far = 4;
    return ray.intersectObject(mesh, false)[0]?.point.y ?? NaN;
  };
  const heightAt = (x, z) => surfaceAt(x, z);
  const resolveMovement = (position, radius, bodyHeight = 1.4) => {
    const top = heightAt(position.x, position.z);
    if (!Number.isFinite(top) || position.y >= top - .05) return;
    if (top <= position.y + .65) { position.y = top; return; }
    if (position.y + bodyHeight <= surfaceAt(position.x, position.z, true) - .025) return;
    // A diagonal branch is not its large AABB: expel an overlapping capsule
    // across the narrow bough, never ten metres to the rectangle's edge.
    const awayX = position.x - closest.x, awayZ = position.z - closest.y, distance = Math.hypot(awayX, awayZ);
    const normalX = distance > 1e-8 ? awayX / distance : dz / length;
    const normalZ = distance > 1e-8 ? awayZ / distance : -dx / length;
    const correction = Math.max(0, .94 + radius + .005 - distance);
    position.x += normalX * correction; position.z += normalZ * correction;
  };
  const record = { id, ...bounds, mesh, heightAt, from: [...from], to: [...to] };
  environment.registerReferenceWalkSurface?.(mesh, { id, bounds, heightAt, resolveMovement, kind: 'canopy', requiresCurrentLayer: true });
  return record;
}

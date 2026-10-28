/* Explicit, measured-in-game walk surfaces. Render culling never removes their
 * physical triangles. The registry does not turn every visual roof into a floor. */
import * as THREE from 'three';

const inside = (bounds, x, z) => x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
const vector = value => value?.isVector3 ? value.clone() : new THREE.Vector3(...value);

export function registerReferenceWalkSurface(environment, mesh, { id, bounds, heightAt, accesses = [], kind = 'deck', resolveMovement = null }) {
  if (!mesh?.isMesh || !id || !bounds || typeof heightAt !== 'function') throw new TypeError('A physical walk surface requires a mesh, ID and height function');
  const record = { id, mesh, kind, bounds: { ...bounds }, heightAt, accesses: accesses.map(access => {
    const bottom = vector(access.bottom), top = vector(access.top), outward = bottom.clone().sub(top).setY(0).normalize();
    const side = new THREE.Vector3(outward.z, 0, -outward.x), width = Math.min(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
    const approach = access.approach ? vector(access.approach) : bottom.clone().addScaledVector(outward, 1.5).addScaledVector(side, width / 2 + 1.75);
    return { bottom, top, approach };
  }) };
  const raycaster = new THREE.Raycaster(), direction = new THREE.Vector3();
  mesh.updateWorldMatrix(true, false); mesh.geometry.computeBoundingBox();
  const physicalBounds = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  resolveMovement ??= (position, radius, bodyHeight = 1.4) => {
    if (!inside(bounds, position.x, position.z)) return;
    const height = heightAt(position.x, position.z); if (!Number.isFinite(height) || position.y >= height - .05) return;
    if (height <= position.y + .65) { position.y = height; return; }
    if (position.y + bodyHeight <= height - .4) return;
    const edges = [[Math.abs(position.x - bounds.minX), 'x', bounds.minX - radius], [Math.abs(position.x - bounds.maxX), 'x', bounds.maxX + radius],
      [Math.abs(position.z - bounds.minZ), 'z', bounds.minZ - radius], [Math.abs(position.z - bounds.maxZ), 'z', bounds.maxZ + radius]];
    edges.sort((a, b) => a[0] - b[0]); position[edges[0][1]] = edges[0][2];
  };
  const collider = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2,
    halfWidth: (bounds.maxX - bounds.minX) / 2, halfDepth: (bounds.maxZ - bounds.minZ) / 2,
    height: Infinity, rotation: 0, owner: id, blocksNavigation: kind === 'ramp',
    navigationTest(point, radius) {
      if (kind !== 'ramp' || environment.navigation.usingVerticalAccess) return false;
      const x = Math.max(bounds.minX, Math.min(bounds.maxX, point.x)), z = Math.max(bounds.minZ, Math.min(bounds.maxZ, point.z));
      if (Math.hypot(point.x - x, point.z - z) >= radius) return false;
      const height = heightAt(x, z);
      return height > point.y + .15 && height < point.y + 1.8;
    },
    // Floors are resolved through height/ceiling contacts rather than an
    // infinitely tall XZ box, allowing movement under a raised gantry.
    resolveMovement, isCollisionActive: () => !!mesh.parent && !mesh.userData.physicsRemoved,
    traceSegment(from, to, { radius = 0 } = {}) {
      if (!collider.isCollisionActive()) return null;
      const start = vector(from), end = vector(to);
      if (Math.max(start.x, end.x) < physicalBounds.min.x - radius || Math.min(start.x, end.x) > physicalBounds.max.x + radius || Math.max(start.z, end.z) < physicalBounds.min.z - radius || Math.min(start.z, end.z) > physicalBounds.max.z + radius) return null;
      const length = start.distanceTo(end); if (length < 1e-9) return null;
      direction.copy(end).sub(start).normalize(); mesh.updateWorldMatrix(true, false);
      let nearest = null;
      const offsets = radius > 0 ? [[0, 0, 0], [radius, 0, 0], [-radius, 0, 0], [0, radius, 0], [0, -radius, 0], [0, 0, radius], [0, 0, -radius]] : [[0, 0, 0]];
      for (const offset of offsets) {
        const origin = start.clone().add(new THREE.Vector3(...offset)); raycaster.set(origin, direction); raycaster.near = 0; raycaster.far = length;
        const hit = raycaster.intersectObject(mesh, false)[0];
        if (hit && (!nearest || hit.distance < nearest.distance)) nearest = { t: hit.distance / length, distance: hit.distance,
          point: hit.point.clone().sub(new THREE.Vector3(...offset)), normal: hit.face.normal.clone().transformDirection(mesh.matrixWorld), collider };
      }
      return nearest;
    }
  };
  record.collider = collider; environment.referenceWalkSurfaces.push(record); environment.colliders.push(collider);
  mesh.name ||= id; mesh.userData.walkSurfaceId = id; return record;
}

export function referenceGroundElevation(environment, x, z) {
  for (const grate of environment.collapsibleFloorGrates ?? []) if (grate.isCollapsed && Math.hypot(x - grate.pos.x, z - grate.pos.z) <= 2.5) return -2.2;
  for (const trench of environment.acidTrenches ?? []) if (inside(trench, x, z) && !(trench.bridges ?? []).some(bridge => inside(bridge, x, z))) return trench.depth || -1.5;
  return 0;
}

export function referenceWalkElevation(environment, x, z, currentY, legacyHeight = 0) {
  const ground = referenceGroundElevation(environment, x, z), surfaces = environment.referenceWalkSurfaces ?? [];
  const candidates = surfaces.filter(surface => surface.collider.isCollisionActive() && inside(surface.bounds, x, z)).map(surface => surface.heightAt(x, z));
  const valid = candidates.filter(Number.isFinite).filter(height => !Number.isFinite(currentY) || height <= currentY + .65);
  // An explicitly registered surface takes precedence over historical nominal
  // elevations, which could differ from the visible deck's actual upper face.
  if (candidates.length) return valid.length ? Math.max(ground, ...valid) : ground;
  return !Number.isFinite(currentY) || legacyHeight <= currentY + .65 ? legacyHeight : ground;
}

export function referenceAccessWaypoint(environment, from, target) {
  const surfaces = environment.referenceWalkSurfaces ?? [];
  const source = surfaces.filter(surface => surface.accesses.length && inside(surface.bounds, from.x, from.z) && Number.isFinite(surface.heightAt(from.x, from.z)) && Math.abs(surface.heightAt(from.x, from.z) - from.y) <= .2);
  const destination = surfaces.filter(surface => surface.accesses.length && inside(surface.bounds, target.x, target.z) && Number.isFinite(surface.heightAt(target.x, target.z)) && (surface.kind === 'solid-deck' || Math.abs(surface.heightAt(target.x, target.z) - target.y) <= .8));
  const targetHeight = destination.length ? Math.max(...destination.map(surface => surface.heightAt(target.x, target.z))) : target.y;
  if (source.length && (!destination.length || targetHeight < from.y - .8)) {
    const access = source.flatMap(surface => surface.accesses).sort((a, b) => a.bottom.distanceToSquared(target) - b.bottom.distanceToSquared(target))[0];
    if (source.every(surface => surface.kind === 'ramp') && from.y <= access.bottom.y + .15 && Math.hypot(from.x - access.bottom.x, from.z - access.bottom.z) <= 1) return null;
    if (source.some(surface => surface.kind === 'ramp')) return access.bottom;
    return Math.hypot(from.x - access.top.x, from.z - access.top.z) > 1 && from.y >= access.top.y - .65 ? access.top : access.bottom;
  }
  if (destination.length && (!source.length || targetHeight > from.y + .8)) {
    const access = destination.flatMap(surface => surface.accesses).sort((a, b) => a.bottom.distanceToSquared(from) - b.bottom.distanceToSquared(from))[0];
    if (source.some(surface => surface.kind === 'ramp')) return access.top;
    const outward = access.bottom.clone().sub(access.top).setY(0).normalize();
    if (from.y <= access.bottom.y + .2 && from.clone().sub(access.bottom).dot(outward) < -.05) return access.approach;
    return Math.hypot(from.x - access.bottom.x, from.z - access.bottom.z) > .4 && from.y <= access.bottom.y + .65 ? access.bottom : access.top;
  }
  if (source.length && destination.length && !source.some(surface => destination.includes(surface))) {
    for (const a of source) for (const b of destination) {
      const minX = Math.max(a.bounds.minX, b.bounds.minX), maxX = Math.min(a.bounds.maxX, b.bounds.maxX);
      const minZ = Math.max(a.bounds.minZ, b.bounds.minZ), maxZ = Math.min(a.bounds.maxZ, b.bounds.maxZ);
      if (minX <= maxX && minZ <= maxZ) return new THREE.Vector3((minX + maxX) / 2, a.heightAt((minX + maxX) / 2, (minZ + maxZ) / 2), (minZ + maxZ) / 2);
    }
  }
  return null;
}

/** An extruded slope whose upper vertices match the authored height function. */
export function walkRampGeometry(width, run, rise, thickness = .25) {
  const w = width / 2, z = run / 2;
  const positions = [-w, -thickness, -z, w, -thickness, -z, w, rise - thickness, z, -w, rise - thickness, z,
    -w, 0, -z, w, 0, -z, w, rise, z, -w, rise, z];
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([4, 7, 6, 4, 6, 5, 0, 1, 2, 0, 2, 3, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]);
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); return geometry;
}

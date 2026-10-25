/* M577 silhouette study from NECA's licensed miniature photographs.
 * This is a local interpretation, not a scanned film-prop replica. +Z is front.
 * Flat hull plates, a recessed nose bay, a rear-return rail and an elevating
 * armored gun replace the old rounded hull and short roof-only slide. */
import * as THREE from 'three';
import { createSurfaceMaterial } from './SurfaceLibrary.js';
import { tireGeometry } from './SupportSculpt.js';

// The photographed miniature has a rail returning down the rear bulkhead.
// Travel dimensions below are a local mechanical reconstruction, not prop
// measurements. The shoe follows the same continuous centreline as the rails.
export const APC_RAIL = Object.freeze({
  stowedZ: -4.95, stowedHeight: 0.90, deployedZ: -2.30, height: 2.65,
  cornerZ: -4.45, cornerRadius: 0.50,
});
export const APC_DEPLOYMENT_SECONDS = 2.2;
export const APC_ELEVATION = Object.freeze({ min: -Math.PI / 12, max: Math.PI / 4 });
// Conservative horizontal envelope for every rail pose and firing direction,
// measured from the actual meshes. Physical contacts use the thinner pieces.
export const APC_NAVIGATION = Object.freeze({ centerZ: -0.70, halfWidth: 2.52, halfDepth: 5.80, height: 2.48, radius: 7.0 });

export function getAPCRailPose(value) {
  const amount = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
  const { deployedZ, height, cornerZ, cornerRadius, stowedZ, stowedHeight } = APC_RAIL;
  const roofLength = deployedZ - cornerZ, arcLength = cornerRadius * Math.PI / 2;
  const verticalLength = height - cornerRadius - stowedHeight;
  const distance = (1 - amount) * (roofLength + arcLength + verticalLength);
  if (distance <= roofLength) return { y: height, z: deployedZ - distance, rotationX: 0 };
  if (distance <= roofLength + arcLength) {
    const angle = (distance - roofLength) / cornerRadius;
    return { y: height - cornerRadius + cornerRadius * Math.cos(angle), z: cornerZ - cornerRadius * Math.sin(angle), rotationX: -angle };
  }
  return { y: height - cornerRadius - (distance - roofLength - arcLength), z: stowedZ, rotationX: -Math.PI / 2 };
}

function railGeometry(side, width, thickness, offset = 0) {
  const halfX = width / 2, halfY = thickness / 2, bevel = Math.min(width, thickness) * 0.18;
  const profile = [[-halfX + bevel, -halfY], [halfX - bevel, -halfY], [halfX, -halfY + bevel], [halfX, halfY - bevel],
    [halfX - bevel, halfY], [-halfX + bevel, halfY], [-halfX, halfY - bevel], [-halfX, -halfY + bevel]];
  const positions = [], uvs = [], indices = [], segments = 112;
  for (let station = 0; station <= segments; station++) {
    const pose = getAPCRailPose(station / segments), cosine = Math.cos(pose.rotationX), sine = Math.sin(pose.rotationX);
    for (let corner = 0; corner < profile.length; corner++) {
      const [x, y] = profile[corner];
      positions.push(side * 0.59 + x, pose.y + (y + offset) * cosine, pose.z + (y + offset) * sine);
      uvs.push(corner / profile.length, station / segments * 3);
      if (station < segments) {
        const a = station * profile.length + corner, b = (station + 1) * profile.length + corner;
        const c = (station + 1) * profile.length + (corner + 1) % profile.length, d = station * profile.length + (corner + 1) % profile.length;
        indices.push(a, c, b, a, d, c);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

// Intersect each moving piece's local volume with the actor's vertical
// interval. This follows yaw, elevation and rear stowage instead of leaving a
// permanent invisible roof box or a ground-level wall behind the carrier.
function sliceBox(box, matrix, bottom, top) {
  const corners = [];
  for (let bits = 0; bits < 8; bits++) corners.push(new THREE.Vector3(
    bits & 1 ? box.max.x : box.min.x, bits & 2 ? box.max.y : box.min.y, bits & 4 ? box.max.z : box.min.z,
  ).applyMatrix4(matrix));
  const points = [];
  const add = point => {
    if (!points.some(other => Math.hypot(other.x - point.x, other.z - point.z) < 1e-7)) points.push({ x: point.x, z: point.z });
  };
  for (const point of corners) if (point.y >= bottom && point.y <= top) add(point);
  for (let bits = 0; bits < 8; bits++) for (const mask of [1, 2, 4]) if (!(bits & mask)) {
    const a = corners[bits], b = corners[bits | mask];
    for (const height of [bottom, top]) {
      if (Math.abs(a.y - height) < 1e-8) add(a);
      if ((a.y < height && b.y > height) || (a.y > height && b.y < height)) add(a.clone().lerp(b, (height - a.y) / (b.y - a.y)));
      if (Math.abs(b.y - height) < 1e-8) add(b);
    }
  }
  if (points.length < 3) return null;
  // Projection can put some clipped 3D vertices inside the horizontal outline.
  // A true convex hull avoids concave/self-crossing polygons from angular sort.
  points.sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const chain = values => {
    const result = [];
    for (const p of values) {
      while (result.length >= 2 && cross(result.at(-2), result.at(-1), p) <= 1e-9) result.pop();
      result.push(p);
    }
    return result.slice(0, -1);
  };
  const polygon = [...chain(points), ...chain([...points].reverse())];
  return polygon.length >= 3 ? polygon : null;
}

function ownMeshBounds(node) {
  const box = new THREE.Box3();
  for (const mesh of node.children) if (mesh.isMesh) {
    mesh.geometry.computeBoundingBox(); box.union(mesh.geometry.boundingBox);
  }
  return box;
}

// Hard normals stay on plate boundaries. Subdividing a flat panel does not
// improve its silhouette, so detail is spent on tread, hubs and hardware.
function platedHull() {
  const stations = [
    [-4.72, 1.88, 0.73, 2.35], [-3.88, 2.02, 0.62, 2.40],
    [-1.70, 2.04, 0.62, 2.36], [1.45, 2.04, 0.62, 2.27], [3.42, 1.96, 0.83, 2.14]
  ];
  const ring = ([z, width, bottom, top]) => [
    [-width + 0.28, bottom, z], [width - 0.28, bottom, z],
    [width, bottom + 0.27, z], [width, top - 0.28, z],
    [width - 0.22, top, z], [-width + 0.22, top, z],
    [-width, top - 0.28, z], [-width, bottom + 0.27, z]
  ];
  const positions = [], uvs = [], indices = [];
  const quad = (a, b, c, d, width = 1, length = 1) => {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d); uvs.push(0, 0, width, 0, width, length, 0, length);
    indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
  };
  for (let i = 0; i < stations.length - 1; i++) {
    const a = ring(stations[i]), b = ring(stations[i + 1]);
    for (let side = 0; side < a.length; side++) {
      const next = (side + 1) % a.length;
      quad(a[side], b[side], b[next], a[next], 1, (stations[i + 1][0] - stations[i][0]) / 2);
    }
  }
  // Rear bulkhead closes the shell. The front remains open behind the separate
  // recessed bay, so no solid hull surface fills the weapon aperture.
  const rear = ring(stations[0]);
  for (let i = 1; i < rear.length - 1; i++) {
    const start = positions.length / 3;
    positions.push(...rear[0], ...rear[i], ...rear[i + 1]); uvs.push(0, 0, 1, 0, 1, 1);
    indices.push(start, start + 2, start + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function prism(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.022, bevelThickness: 0.022, steps: 1, curveSegments: 4 });
}

function turretHousing() {
  // Bilaterally symmetric armor, with a raised tapered rear and a narrower
  // forward receiver. Extruding an asymmetric XY pentagon made the old gun
  // lean sideways and left its long rear profile as a rectangular block.
  const stations = [
    [-0.85, 0.78, 0.56, 0.79], [-0.54, 0.95, 0.25, 0.87],
    [0.51, 0.85, 0.25, 0.88], [0.82, 0.46, 0.36, 0.72],
  ];
  const ring = ([z, width, bottom, top]) => [
    [-width + 0.11, bottom, z], [width - 0.11, bottom, z], [width, bottom + 0.065, z],
    [width, top - 0.065, z], [width - 0.11, top, z], [-width + 0.11, top, z],
    [-width, top - 0.065, z], [-width, bottom + 0.065, z],
  ];
  const positions = [], uvs = [], indices = [];
  const face = points => {
    const offset = positions.length / 3;
    const a = new THREE.Vector3(...points[0]), b = new THREE.Vector3(...points[1]), c = new THREE.Vector3(...points[2]);
    const normal = b.sub(a).cross(c.sub(a));
    const axis = Math.abs(normal.y) > Math.max(Math.abs(normal.x), Math.abs(normal.z)) ? 'y' : Math.abs(normal.x) > Math.abs(normal.z) ? 'x' : 'z';
    points.forEach(([x, y, z]) => { positions.push(x, y, z); uvs.push(axis === 'x' ? z + 1 : x + 1, axis === 'y' ? z + 1 : y); });
    for (let i = 1; i < points.length - 1; i++) indices.push(offset, offset + i + 1, offset + i);
  };
  for (let station = 0; station < stations.length - 1; station++) {
    const a = ring(stations[station]), b = ring(stations[station + 1]);
    for (let side = 0; side < a.length; side++) { const next = (side + 1) % a.length; face([a[side], b[side], b[next], a[next]]); }
  }
  face(ring(stations[0])); face(ring(stations.at(-1)).reverse());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function stencil(parts, material, text, origin, size = 0.055) {
  const glyphs = {
    '2': ['11110', '00001', '00001', '01110', '10000', '10000', '11111'],
    'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110']
  };
  [...text].forEach((character, index) => glyphs[character]?.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel === '1') parts.box(material, [origin[0] + (index * 6 + x) * size, origin[1] - y * size, origin[2]], [size * 0.89, size * 0.89, 0.006]);
  })));
}

export function buildAPCModel(Assembly) {
  const armor = createSurfaceMaterial('armor', { color: 0x525a40, roughness: 0.85, metalness: 0.12, normalScale: new THREE.Vector2(0.16, 0.16), envMapIntensity: 0.45, repeat: [2, 2] });
  const dark = createSurfaceMaterial('metal', { color: 0x202622, roughness: 0.57, metalness: 0.65, repeat: [2, 2] });
  const rubber = createSurfaceMaterial('leather', { color: 0x161916, roughness: 0.91, metalness: 0.01, repeat: [2, 2] });
  const steel = createSurfaceMaterial('metal', { color: 0x747b69, roughness: 0.48, metalness: 0.78, repeat: [2, 2] });
  const paint = new THREE.MeshStandardMaterial({ color: 0xc7cbbb, roughness: 0.88, metalness: 0.05 });
  const red = new THREE.MeshStandardMaterial({ color: 0x571c14, emissive: 0x7b160b, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.1 });
  const lamps = new THREE.MeshStandardMaterial({ color: 0xe0e3cf, emissive: 0xe0e3cf, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.1 });
  for (const [name, material] of Object.entries({ armor, dark, rubber, steel, paint, red, lamps })) material.name = `apc-${name}`;
  const hull = new Assembly('m577-armored-hull');
  hull.add(platedHull(), armor);
  hull.box(dark, [0, 0.69, -0.5], [3.35, 0.36, 7.7], false);
  // Recessed nose: two angular cheeks and a low bumper surround a real void.
  // The dark bulkhead is behind the gun, not an opaque window across its front.
  hull.box(dark, [0, 1.45, 3.43], [3.48, 0.94, 0.045]);
  hull.box(dark, [0, 1.28, 4.08], [3.48, 0.09, 1.25]);
  for (const side of [-1, 1]) {
    const cheek = prism([[3.35, 0.84], [4.94, 0.94], [4.94, 1.38], [3.35, 2.15]], 0.23);
    // Prism uses its first coordinate as Z, with the extrusion along X.
    cheek.rotateY(-Math.PI / 2); hull.add(cheek, armor, [side < 0 ? -1.75 : 1.98, 0, 0]);
    hull.box(armor, [side * 1.88, 1.05, 4.24], [0.29, 0.40, 1.35]);
    hull.box(lamps, [side * 1.43, 1.00, 4.955], [0.28, 0.14, 0.035]);
    hull.box(dark, [side * 1.43, 1.00, 4.981], [0.07, 0.19, 0.018]);
    hull.tube(steel, [[side * 1.11, 0.82, 4.96], [side * 1.11, 0.73, 5.02], [side * 0.96, 0.73, 5.02], [side * 0.96, 0.82, 4.96]], 0.037, 12, 8);
  }
  hull.box(armor, [0, 1.05, 4.87], [3.72, 0.50, 0.20]);
  hull.box(armor, [0, 1.72, 4.15], [0.15, 0.11, 1.60], false, [0.46, 0, 0]);
  hull.box(dark, [0.88, 1.77, 3.49], [1.02, 0.39, 0.05]);
  hull.box(steel, [0.88, 2.01, 3.48], [1.06, 0.047, 0.13]);
  stencil(hull, paint, '2D', [1.06, 1.22, 4.976], 0.052);

  // Four covered wheels have shallow armor dishes over pneumatic tires. The
  // old exposed silver car rims were unlike the miniature's military covers.
  const wheels = [];
  for (const side of [-1, 1]) for (const z of [-3.23, 2.68]) {
    const wheelY = 1.05;
    const center = new THREE.Vector3(side * 2.04, wheelY, z); wheels.push(center);
    hull.add(tireGeometry(1.0, 0.69), rubber, center.toArray());
    hull.cylinder(armor, [side * 2.407, wheelY, z], [0.82, 0.82], 0.09, [0, 0, Math.PI / 2], 64);
    hull.cylinder(armor, [side * 2.466, wheelY, z], [0.48, 0.55], 0.045, [0, 0, Math.PI / 2], 48);
    hull.add(new THREE.TorusGeometry(0.71, 0.017, 8, 56), dark, [side * 2.462, wheelY, z], [1, 1, 1], [0, Math.PI / 2, 0]);
    hull.cylinder(dark, [side * 2.50, wheelY, z], [0.16, 0.16], 0.025, [0, 0, Math.PI / 2], 28);
    for (let tread = 0; tread < 40; tread++) {
      const angle = tread / 40 * Math.PI * 2;
      hull.box(rubber, [side * 2.04, wheelY + Math.sin(angle) * 1.0, z + Math.cos(angle) * 1.0], [0.66, 0.045, 0.095], false, [angle, 0, 0]);
    }
    for (let bolt = 0; bolt < 8; bolt++) {
      const a = bolt / 8 * Math.PI * 2;
      hull.cylinder(steel, [side * 2.49, wheelY + Math.sin(a) * 0.39, z + Math.cos(a) * 0.39], [0.027, 0.027], 0.016, [0, 0, Math.PI / 2], 8);
    }
    hull.box(armor, [side * 2.04, 2.17, z], [0.88, 0.09, 2.24]);
    for (const lip of [-1, 1]) hull.box(armor, [side * 2.43, 1.94, z + lip * 1.0], [0.08, 0.38, 0.19], false, [lip * -0.35, 0, 0]);
  }
  // NECA's two side photographs show different flanks: an access door on
  // one side, a recessed service panel with two grilles on the other.
  for (const side of [-1, 1]) {
    hull.box(dark, [side * 2.047, 1.43, -0.26], [0.025, 1.41, 3.26]);
    if (side > 0) {
      hull.box(armor, [side * 2.069, 1.45, -0.26], [0.035, 1.31, 3.14]);
      hull.box(armor, [side * 2.095, 1.45, -0.26], [0.028, 1.21, 2.98]);
      for (const z of [-1.60, 1.06]) for (const y of [1.02, 1.83]) hull.cylinder(steel, [side * 2.11, y, z], [0.032, 0.032], 0.018, [0, 0, Math.PI / 2], 8);
      for (const z of [-1.63, 1.11]) hull.box(dark, [side * 2.105, 1.46, z], [0.04, 0.18, 0.11]);
      hull.tube(steel, [[2.13, 1.48, 0.7], [2.20, 1.48, 0.7], [2.20, 1.48, 0.48], [2.13, 1.48, 0.48]], 0.023, 8, 6);
    } else {
      hull.box(armor, [-2.069, 1.43, -0.26], [0.035, 1.30, 3.13]);
      for (const z of [-1.22, 0.78]) {
        hull.box(dark, [-2.092, 1.60, z], [0.025, 0.63, 0.66]);
        for (let slat = 0; slat < 10; slat++) hull.box(armor, [-2.113, 1.60, z + (slat - 4.5) * 0.062], [0.025, 0.57, 0.023]);
        hull.box(armor, [-2.12, 1.88, z + 0.12], [0.035, 0.22, 0.24]);
        hull.box(dark, [-2.093, 0.88, z], [0.025, 0.16, 1.02]);
        for (let slat = 0; slat < 3; slat++) hull.box(armor, [-2.113, 0.82 + slat * 0.052, z], [0.025, 0.018, 0.98]);
      }
      for (const z of [-0.37, 0.10]) hull.box(armor, [-2.11, 1.22, z], [0.05, 0.29, 0.36]);
      for (const z of [-1.68, 1.17]) for (const y of [1.02, 1.85]) hull.cylinder(steel, [-2.119, y, z], [0.028, 0.028], 0.018, [0, 0, Math.PI / 2], 8);
    }
    for (let vent = 0; vent < 5; vent++) hull.box(dark, [side * 2.08, 1.98 - vent * 0.075, -2.0], [0.045, 0.032, 0.45]);
    hull.box(armor, [side * 1.30, 2.46, -2.10], [0.58, 0.18, 1.18]);
    hull.box(dark, [side * 1.30, 2.557, -2.10], [0.47, 0.025, 1.0]);
    for (let rib = 0; rib < 12; rib++) hull.box(steel, [side * 1.30, 2.58, -2.56 + rib * 0.082], [0.45, 0.027, 0.019]);
    for (const z of [-4.17, -0.8, 2.1]) hull.tube(armor, [[side * 1.35, 2.38, z], [side * 1.35, 2.47, z], [side * 1.15, 2.47, z], [side * 1.15, 2.38, z]], 0.026, 8, 8);
    // Short welded attachment seams and maintenance fasteners stay proud of
    // the armor, rather than reading as floating decorative plates.
    for (const z of [-4.25, -1.55, 1.16]) {
      hull.tube(steel, [[side * 2.11, 1.01, z], [side * 2.11, 1.31, z], [side * 2.11, 1.70, z]], 0.012, 14, 6);
      for (const y of [1.12, 1.69]) hull.cylinder(steel, [side * 2.13, y, z + 0.10], [0.026, 0.026], 0.021, [0, 0, Math.PI / 2], 8);
    }
    hull.box(red, [side * 1.48, 1.19, -4.77], [0.21, 0.16, 0.035]);
  }
  // A separately plated low command roof leaves the long nose visibly flat.
  hull.add(prism([[-1.65, 0], [1.65, 0], [1.40, 0.17], [-1.40, 0.17]], 2.45), armor, [0, 2.31, -3.5]);
  hull.box(dark, [0, 2.50, -3.95], [0.75, 0.025, 1.04]);
  for (let slat = 0; slat < 8; slat++) hull.box(armor, [(slat - 3.5) * 0.094, 2.522, -3.95], [0.042, 0.025, 0.96]);
  for (const side of [-1, 1]) {
    // Rectangular guide with a narrow exposed running strip, not a round
    // pipe swallowing its steel track. Both sections follow the same return.
    hull.add(railGeometry(side, 0.20, 0.13), dark);
    hull.add(railGeometry(side, 0.12, 0.018, 0.075), steel);
    for (const z of [-4.15, -3.35, -2.52]) hull.box(armor, [side * 0.59, 2.62, z], [0.25, 0.12, 0.12]);
    for (const y of [1.0, 1.54, 2.02]) hull.box(armor, [side * 0.59, y, -4.82], [0.25, 0.12, 0.25]);
    hull.box(dark, [side * 0.59, 0.83, -4.95], [0.30, 0.15, 0.22]);
  }
  for (const side of [-1, 1]) hull.tube(dark, [[side * 1.62, 1.10, -4.77], [side * 1.62, 1.90, -4.91], [side * 1.62, 2.22, -4.91], [side * 1.62, 2.30, -4.72]], 0.073, 16, 10);
  const group = hull.finish(); group.name = 'm577-apc';
  group.userData.apc = { source: 'NECA licensed miniature photograph, interpreted', forwardAxis: '+z', wheelCount: 4, rail: APC_RAIL };

  const carrierParts = new Assembly('m577-turret-carriage');
  carrierParts.box(dark, [0, 0.26, 0], [1.30, 0.16, 0.84]);
  for (const side of [-1, 1]) for (const z of [-0.32, 0.32]) carrierParts.cylinder(dark, [side * 0.59, 0.205, z], [0.12, 0.12], 0.21, [0, 0, Math.PI / 2], 20);
  // The circular yaw bearing is rotationally symmetric, so it can share the
  // carriage's batch while the upper housing yaws independently above it.
  carrierParts.cylinder(dark, [0, 0.46, 0], [0.73, 0.87], 0.25, [0, 0, 0], 48);
  const carriage = carrierParts.finish(); carriage.position.set(0, APC_RAIL.height, APC_RAIL.deployedZ); group.add(carriage);

  const turret = new THREE.Group(); turret.name = 'm577-roof-turret'; group.add(turret);
  const gun = new THREE.Group(); gun.name = 'm577-elevating-gun'; gun.position.set(0, 0.46, -0.40); turret.add(gun);
  const turretParts = new Assembly('m577-roof-turret');
  turretParts.add(turretHousing(), armor, [0, -0.46, 0.40]);
  for (const side of [-1, 1]) turretParts.tube(armor, [[side * 0.58, 0.34, -0.08], [side * 0.58, 0.46, -0.08], [side * 0.37, 0.46, -0.08], [side * 0.37, 0.34, -0.08]], 0.035, 8, 8);
  // Rectangular forward receiver and compact twin tubes follow the licensed
  // side view. The entire armored housing elevates with this hinge.
  turretParts.box(armor, [0, 0.08, 1.20], [0.91, 0.32, 0.43], true);
  const housing = turretParts.finish(); gun.add(housing);
  const barrelParts = new Assembly('m577-recoiling-barrels');
  for (const side of [-1, 1]) {
    barrelParts.cylinder(dark, [side * 0.28, 0.09, 1.37], [0.12, 0.12], 0.37, [Math.PI / 2, 0, 0], 32);
    barrelParts.add(new THREE.CylinderGeometry(0.075, 0.075, 0.40, 32, 1, true), steel, [side * 0.28, 0.09, 1.74], [1, 1, 1], [Math.PI / 2, 0, 0]);
    barrelParts.add(new THREE.TorusGeometry(0.075, 0.020, 8, 32), steel, [side * 0.28, 0.09, 1.95]);
    barrelParts.cylinder(dark, [side * 0.28, 0.09, 1.85], [0.061, 0.061], 0.012, [Math.PI / 2, 0, 0], 28);
  }
  const barrels = barrelParts.finish(); gun.add(barrels);
  const muzzleSockets = [-1, 1].map(side => {
    const socket = new THREE.Object3D(); socket.name = `apc-muzzle-${side}`; socket.position.set(side * 0.28, 0.09, 1.98); barrels.add(socket); return socket;
  });

  const frontParts = new Assembly('m577-nose-gun');
  frontParts.cylinder(armor, [0, 0.07, 0], [0.39, 0.41], 0.18, [0, 0, 0], 48);
  frontParts.box(armor, [0, 0.20, 0.02], [0.53, 0.23, 0.61], true);
  frontParts.cylinder(dark, [0, 0.20, 0.51], [0.07, 0.09], 0.56, [Math.PI / 2, 0, 0], 24);
  frontParts.add(new THREE.TorusGeometry(0.07, 0.018, 8, 24), dark, [0, 0.20, 0.81]);
  const frontTurret = frontParts.finish(); frontTurret.position.set(-0.82, 1.33, 3.94); group.add(frontTurret);

  const flareMaterial = new THREE.MeshBasicMaterial({ color: 0xffd29d, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  flareMaterial.name = 'apc-muzzle-flash';
  const flareParts = new Assembly('m577-muzzle-flare');
  for (const side of [-1, 1]) {
    flareParts.add(new THREE.ConeGeometry(0.13, 0.55, 8), flareMaterial, [side * 0.28, 0.09, 2.19], [1, 1, 1], [Math.PI / 2, 0, 0]);
  }
  const muzzleFlash = flareParts.finish(); muzzleFlash.visible = false; barrels.add(muzzleFlash);
  let deployment = 1;
  const setTurretDeployment = value => {
    deployment = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
    const pose = getAPCRailPose(deployment);
    carriage.position.set(0, pose.y, pose.z); carriage.rotation.x = pose.rotationX;
    // Keep yaw above the bearing, including while that bearing turns over the
    // back corner. A stowing gun first returns to its safe longitudinal pose.
    turret.position.set(0, pose.y + Math.cos(pose.rotationX) * 0.29, pose.z + Math.sin(pose.rotationX) * 0.29);
    turret.rotation.x = pose.rotationX;
    if (deployment < 1) { turret.rotation.y = 0; gun.rotation.x = 0; }
  };
  const setTurretAim = worldTarget => {
    if (deployment < 1 || !worldTarget?.isVector3 || !worldTarget.toArray().every(Number.isFinite)) return false;
    group.updateMatrixWorld(true);
    const target = group.worldToLocal(worldTarget.clone());
    turret.rotation.y = Math.atan2(target.x - turret.position.x, target.z - turret.position.z);
    group.updateMatrixWorld(true);
    const direction = turret.worldToLocal(worldTarget.clone()).sub(gun.position);
    const distance = Math.hypot(direction.y, direction.z);
    // The barrel axis lies 0.09 above the hinge: accounting for this offset
    // makes the centre of the two parallel muzzles point at the real target.
    const elevation = Math.atan2(direction.y, direction.z) - Math.asin(THREE.MathUtils.clamp(0.09 / Math.max(distance, 1e-9), -1, 1));
    gun.rotation.x = -THREE.MathUtils.clamp(elevation, APC_ELEVATION.min, APC_ELEVATION.max);
    const frontDirection = target.clone().sub(frontTurret.position);
    const noseYaw = Math.atan2(frontDirection.x, frontDirection.z);
    frontTurret.rotation.y = THREE.MathUtils.clamp(noseYaw, -0.55, 0.55);
    return distance > 1.98 && elevation >= APC_ELEVATION.min && elevation <= APC_ELEVATION.max;
  };
  const collisionPieces = [carriage, housing, barrels].map(node => ({ node, box: ownMeshBounds(node) }));
  const getTurretCollisionPolygons = (bottom, top = bottom) => {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    return collisionPieces.map(({ node, box }) => sliceBox(box, inverse.clone().multiply(node.matrixWorld), bottom, top)).filter(Boolean);
  };
  setTurretDeployment(1);
  return { group, turret, carriage, gun, barrels, frontTurret, muzzleSockets, muzzleFlash, flareMaterial, rail: APC_RAIL, wheels, setTurretDeployment, setTurretAim, getTurretCollisionPolygons };
}

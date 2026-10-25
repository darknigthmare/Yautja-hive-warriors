/* M577 silhouette study from NECA's licensed miniature photograph.
 * This is a local interpretation, not a scanned film-prop replica. +Z is front.
 * Flat hull plates, a genuinely recessed nose bay and a translating roof sled
 * replace the old rounded loft and full-width glass windshield. */
import * as THREE from 'three';
import { createSurfaceMaterial } from './SurfaceLibrary.js';
import { tireGeometry } from './SupportSculpt.js';

export const APC_RAIL = Object.freeze({ stowedZ: -3.65, deployedZ: -2.30, height: 2.65 });

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
  // Side access doors are inset rectangles between, rather than over, wheels.
  for (const side of [-1, 1]) {
    hull.box(dark, [side * 2.047, 1.43, -0.26], [0.025, 1.41, 3.26]);
    hull.box(armor, [side * 2.069, 1.45, -0.26], [0.035, 1.31, 3.14]);
    hull.box(armor, [side * 2.095, 1.45, -0.26], [0.028, 1.21, 2.98]);
    for (const z of [-1.60, 1.06]) for (const y of [1.02, 1.83]) hull.cylinder(steel, [side * 2.11, y, z], [0.032, 0.032], 0.018, [0, 0, Math.PI / 2], 8);
    for (const z of [-1.63, 1.11]) hull.box(dark, [side * 2.105, 1.46, z], [0.04, 0.18, 0.11]);
    hull.tube(steel, [[side * 2.13, 1.48, 0.7], [side * 2.20, 1.48, 0.7], [side * 2.20, 1.48, 0.48], [side * 2.13, 1.48, 0.48]], 0.023, 8, 6);
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
  hull.add(prism([[-1.65, 0], [1.65, 0], [1.24, 0.35], [-1.24, 0.35]], 2.45), armor, [0, 2.31, -3.5]);
  hull.box(dark, [0, 2.56, -3.95], [1.23, 0.025, 1.04]);
  for (let slat = 0; slat < 12; slat++) hull.box(armor, [(slat - 5.5) * 0.094, 2.582, -3.95], [0.042, 0.025, 0.96]);
  for (const side of [-1, 1]) {
    hull.box(dark, [side * 0.59, 2.684, -2.42], [0.20, 0.13, 3.30]);
    hull.box(steel, [side * 0.59, 2.752, -2.42], [0.16, 0.038, 3.30]);
    for (const z of [-3.88, -2.42, -0.96]) hull.box(armor, [side * 0.59, 2.78, z], [0.24, 0.10, 0.09]);
  }
  hull.tube(dark, [[-1.62, 1.90, -4.77], [-1.62, 2.37, -4.91], [1.62, 2.37, -4.91], [1.62, 1.90, -4.77]], 0.073, 20, 10);
  const group = hull.finish(); group.name = 'm577-apc';
  group.userData.apc = { source: 'NECA licensed miniature photograph, interpreted', forwardAxis: '+z', wheelCount: 4, rail: APC_RAIL };

  const carrierParts = new Assembly('m577-turret-carriage');
  carrierParts.box(dark, [0, 0.11, 0], [1.30, 0.16, 0.84]);
  for (const side of [-1, 1]) for (const z of [-0.32, 0.32]) carrierParts.cylinder(dark, [side * 0.59, 0.015, z], [0.12, 0.12], 0.21, [0, 0, Math.PI / 2], 20);
  const carriage = carrierParts.finish(); carriage.position.set(0, APC_RAIL.height, APC_RAIL.deployedZ); group.add(carriage);

  const turretParts = new Assembly('m577-roof-turret');
  turretParts.cylinder(armor, [0, 0.17, 0], [0.73, 0.87], 0.25, [0, 0, 0], 48);
  turretParts.add(prism([[-0.93, 0.25], [0.93, 0.25], [0.82, 0.68], [0.33, 0.88], [-0.87, 0.74]], 1.67), armor, [0, 0, -0.85]);
  for (const side of [-1, 1]) turretParts.tube(armor, [[side * 0.58, 0.80, -0.48], [side * 0.58, 0.92, -0.48], [side * 0.37, 0.92, -0.48], [side * 0.37, 0.80, -0.48]], 0.035, 8, 8);
  const turret = turretParts.finish(); turret.position.set(0, APC_RAIL.height + 0.14, APC_RAIL.deployedZ); group.add(turret);
  const barrelParts = new Assembly('m577-recoiling-barrels');
  for (const side of [-1, 1]) {
    barrelParts.cylinder(dark, [side * 0.28, 0.55, 1.0], [0.12, 0.12], 0.77, [Math.PI / 2, 0, 0], 32);
    barrelParts.add(new THREE.CylinderGeometry(0.075, 0.075, 0.66, 32, 1, true), steel, [side * 0.28, 0.55, 1.57], [1, 1, 1], [Math.PI / 2, 0, 0]);
    barrelParts.add(new THREE.TorusGeometry(0.075, 0.020, 8, 32), steel, [side * 0.28, 0.55, 1.91]);
    barrelParts.cylinder(dark, [side * 0.28, 0.55, 1.81], [0.061, 0.061], 0.012, [Math.PI / 2, 0, 0], 28);
  }
  const barrels = barrelParts.finish(); turret.add(barrels);
  const muzzleSockets = [-1, 1].map(side => {
    const socket = new THREE.Object3D(); socket.name = `apc-muzzle-${side}`; socket.position.set(side * 0.28, 0.55, 1.94); barrels.add(socket); return socket;
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
    flareParts.add(new THREE.ConeGeometry(0.13, 0.55, 8), flareMaterial, [side * 0.28, 0.55, 2.15], [1, 1, 1], [Math.PI / 2, 0, 0]);
  }
  const muzzleFlash = flareParts.finish(); muzzleFlash.visible = false; barrels.add(muzzleFlash);
  const setTurretDeployment = value => {
    const deployment = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
    carriage.position.z = turret.position.z = THREE.MathUtils.lerp(APC_RAIL.stowedZ, APC_RAIL.deployedZ, deployment);
  };
  setTurretDeployment(1);
  return { group, turret, carriage, barrels, frontTurret, muzzleSockets, muzzleFlash, flareMaterial, rail: APC_RAIL, wheels, setTurretDeployment };
}

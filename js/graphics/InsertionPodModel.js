/* An occupied insertion capsule needs a real hollow shell. The two leaves are
 * separate rigid parts, with their origins on the visible vertical hinges.
 * Dimensions are in game units; this is an original interpretation of a Yautja
 * insertion craft, not a scanned or certified replica of a film prop. */
import * as THREE from 'three';
import { createSurfaceMaterial } from './SurfaceLibrary.js';
import { loftGeometry, sweptLimb } from './SupportSculpt.js';

const clamp01 = value => THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
const PROFILE = [
  [0.12, 1.65, 1.47], [0.48, 1.94, 1.66], [1.4, 1.93, 1.65],
  [3.2, 2.0, 1.76], [4.45, 1.91, 1.65], [5.05, 1.62, 1.39]
];

// A thick, open-front shell. Both skins have outward winding, and the edge
// strips close their thickness instead of covering the passenger cavity.
function cavityShell() {
  const path = new THREE.CatmullRomCurve3(PROFILE.map(([y, x, z]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.2);
  const radial = 56, rows = 56, columns = radial + 1, layerSize = (rows + 1) * columns;
  const positions = [], uvs = [], indices = [];
  const opening = Math.PI * 0.285;
  for (let inner = 0; inner < 2; inner++) for (let row = 0; row <= rows; row++) {
    const p = path.getPoint(row / rows);
    for (let column = 0; column <= radial; column++) {
      const angle = opening + column / radial * (Math.PI * 2 - opening * 2);
      const thickness = inner ? 0.14 : 0;
      positions.push(Math.sin(angle) * (p.x - thickness), p.y, Math.cos(angle) * (p.z - thickness));
      uvs.push(column / radial * 2, row / rows * 2);
      if (row < rows && column < radial) {
        const a = inner * layerSize + row * columns + column, b = a + columns;
        if (inner) indices.push(a, b, a + 1, b, b + 1, a + 1);
        else indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  for (const edge of [0, radial]) for (let row = 0; row < rows; row++) {
    const a = row * columns + edge, b = a + columns, c = a + layerSize, d = b + layerSize;
    if (edge === 0) indices.push(a, b, c, b, d, c);
    else indices.push(a, c, b, b, c, d);
  }
  for (const row of [0, rows]) for (let column = 0; column < radial; column++) {
    const a = row * columns + column, b = a + 1, c = a + layerSize, d = b + layerSize;
    if (row === 0) indices.push(a, c, b, b, c, d);
    else indices.push(a, b, c, b, d, c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function panelShape(side) {
  // Local x points inward from each hinge. The split line meets at x=0 in
  // world space; the top follows the capsule's tapered forehead.
  const shape = new THREE.Shape();
  const sign = -side;
  shape.moveTo(0, 0);
  shape.lineTo(sign * 1.53, 0);
  shape.lineTo(sign * 1.53, 4.22);
  shape.bezierCurveTo(sign * 1.45, 4.55, sign * 1.1, 4.76, sign * 0.76, 4.83);
  shape.lineTo(sign * 0.07, 4.65);
  shape.lineTo(0, 0);
  return shape;
}

function recessedGlyphs(parts, material, x, y, z, side = 1) {
  for (let row = 0; row < 4; row++) {
    const height = 0.12 + (row % 2) * 0.055;
    parts.box(material, [x, y - row * 0.21, z], [0.045, height, 0.018], false, [0, 0, side * 0.2]);
    parts.box(material, [x + side * 0.09, y + 0.035 - row * 0.21, z], [0.11, 0.035, 0.018]);
    if (row % 2 === 0) parts.box(material, [x + side * 0.14, y - 0.065 - row * 0.21, z], [0.035, 0.08, 0.018]);
  }
}

export function buildInsertionPodModel(Assembly) {
  const armor = createSurfaceMaterial('armor', { color: 0x65696a, metalness: 0.78, roughness: 0.4, repeat: [2, 2] });
  const dark = createSurfaceMaterial('metal', { color: 0x24282b, metalness: 0.72, roughness: 0.6, repeat: [2, 3] });
  const trim = createSurfaceMaterial('metal', { color: 0x9b927e, metalness: 0.86, roughness: 0.34, repeat: [2, 2] });
  const cradle = createSurfaceMaterial('leather', { color: 0x252c2b, metalness: 0.08, roughness: 0.88, repeat: [2, 3] });
  const indicator = new THREE.MeshStandardMaterial({ color: 0xbe432b, emissive: 0xd94321, emissiveIntensity: 1.8, roughness: 0.35, metalness: 0.2 });
  for (const [name, material] of Object.entries({ armor, dark, trim, cradle, indicator })) material.name = `capsule-${name}`;
  const shell = new Assembly('orbital-capsule-hull');
  shell.add(cavityShell(), armor);
  // A solid crown above the clear head opening joins the cut shell, while the
  // tapered base is behind the sill and never fills the cabin with a cylinder.
  shell.add(loftGeometry([[4.99, 1.64, 1.41], [5.36, 1.5, 1.28], [5.9, 1.08, 0.94], [6.46, 0.52, 0.48], [6.84, 0.055, 0.055]], { radial: 56, rows: 32 }), armor);
  shell.add(loftGeometry([[-0.14, 1.52, 1.35], [-0.07, 1.82, 1.6], [0, 1.83, 1.6]], { radial: 56, rows: 6 }), dark);
  // The narrow threshold is flush with the physical ground; feet do not need
  // to climb an invisible offset during the handoff to gameplay.
  shell.box(dark, [0, -0.037, 0.78], [2.95, 0.07, 1.45], true);
  for (let tread = 0; tread < 8; tread++) shell.box(trim, [(tread - 3.5) * 0.34, -0.007, 0.79], [0.025, 0.014, 1.05]);
  // Long armored ribs give a continuous seed silhouette, rather than unrelated
  // stacked rings. The central rear spine has a different material and inset.
  for (let rib = 0; rib < 7; rib++) {
    const angle = 1.03 + rib / 6 * (Math.PI * 2 - 2.06), x = Math.sin(angle), z = Math.cos(angle);
    shell.add(sweptLimb([
      [x * 1.79, 0.35, z * 1.56, 0.085, 0.12], [x * 2.01, 1.7, z * 1.77, 0.10, 0.13],
      [x * 2.035, 3.65, z * 1.79, 0.095, 0.12], [x * 1.59, 5.25, z * 1.38, 0.075, 0.095],
      [x * 0.48, 6.46, z * 0.44, 0.025, 0.035]
    ], 14, 30), rib === 3 ? trim : dark);
    for (let vent = 0; vent < 5; vent++) shell.box(dark, [x * 1.99, 2.25 + vent * 0.16, z * 1.76], [0.31, 0.055, 0.045], false, [0, angle, 0]);
    for (const y of [1.1, 4.2]) shell.cylinder(trim, [x * 2.015, y, z * 1.78], [0.052, 0.052], 0.038, [Math.PI / 2, angle, 0], 12);
  }
  // Rear propulsion nozzles: nested metal lips and dark wells, with no opaque
  // emissive disk pretending to be a hollow exhaust.
  const exhausts = [];
  for (const angle of [Math.PI - 0.65, Math.PI, Math.PI + 0.65]) {
    const x = Math.sin(angle) * 1.46, z = Math.cos(angle) * 1.33;
    shell.cylinder(dark, [x, 0.27, z], [0.21, 0.27], 0.32, [0, 0, 0], 28);
    shell.add(new THREE.TorusGeometry(0.20, 0.045, 8, 28), trim, [x, 0.12, z], [1, 1, 1], [Math.PI / 2, 0, 0]);
    exhausts.push(new THREE.Vector3(x, 0.03, z));
  }
  for (const side of [-1, 1]) {
    // Hinge barrels, locking receivers and an open stasis cradle. Padding is
    // behind the standing occupant; no solid seat intersects the exit path.
    shell.bone(dark, [side * 1.55, 0.22, 1.46], [side * 1.55, 4.57, 1.46], 0.075, 0.075, 16);
    for (const y of [0.55, 2.35, 4.2]) {
      shell.cylinder(trim, [side * 1.55, y, 1.46], [0.115, 0.115], 0.28, [0, 0, 0], 20);
      shell.box(dark, [side * 1.67, y, 1.31], [0.27, 0.17, 0.38], true);
    }
    shell.add(sweptLimb([[side * 0.64, 0.9, -1.05, 0.12], [side * 0.89, 2.1, -1.24, 0.14], [side * 0.93, 3.45, -1.17, 0.15], [side * 0.60, 4.31, -0.92, 0.1]], 16, 24), cradle);
    shell.tube(trim, [[side * 1.12, 0.45, -0.88], [side * 1.24, 2.6, -0.97], [side * 0.97, 4.49, -0.71]], 0.033, 22, 8);
    shell.box(dark, [side * 1.22, 2.65, -0.34], [0.18, 0.54, 0.23], true, [0.12, side * 0.2, 0]);
    for (let light = 0; light < 3; light++) shell.box(indicator, [side * 1.21, 2.8 - light * 0.10, -0.21], [0.075, 0.033, 0.018]);
    shell.tube(dark, [[side * 1.45, 1.0, -0.58], [side * 1.56, 1.8, -0.56], [side * 1.47, 3.82, -0.48], [side * 1.05, 4.65, -0.69]], 0.05, 28, 8);
  }
  shell.box(cradle, [0, 2.65, -1.32], [0.92, 2.75, 0.22], true);
  shell.box(cradle, [0, 4.08, -1.0], [0.58, 0.48, 0.23], true, [-0.2, 0, 0]);
  const group = shell.finish(); group.name = 'orbital-capsule';
  const door = new THREE.Group(); door.name = 'split-ejection-hatch'; group.add(door);
  const hinges = [];
  for (const side of [-1, 1]) {
    const leaf = new Assembly(side < 0 ? 'capsule-left-leaf' : 'capsule-right-leaf');
    const geometry = new THREE.ExtrudeGeometry(panelShape(side), { depth: 0.18, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.055, bevelThickness: 0.035, curveSegments: 12 });
    leaf.add(geometry, armor);
    const inward = -side;
    leaf.add(sweptLimb([[inward * 0.17, 0.15, 0.245, 0.06], [inward * 0.35, 1.5, 0.245, 0.08], [inward * 0.4, 3.6, 0.245, 0.07], [inward * 0.52, 4.56, 0.23, 0.045]], 14, 28), dark);
    leaf.tube(trim, [[inward * 1.44, 0.13, 0.245], [inward * 1.44, 2.65, 0.245], [inward * 1.41, 4.15, 0.245], [inward * 0.78, 4.67, 0.245]], 0.022, 32, 6);
    for (let rib = 0; rib < 7; rib++) leaf.box(dark, [inward * 0.80, 0.62 + rib * 0.35, 0.23], [0.69, 0.045, 0.024], false, [0, 0, inward * 0.13]);
    for (const y of [0.55, 2.35, 4.2]) leaf.box(trim, [inward * 0.1, y - 0.12, 0.10], [0.25, 0.13, 0.17], true);
    recessedGlyphs(leaf, trim, inward * 0.82, 3.67, 0.235, inward);
    const hinge = leaf.finish(); hinge.name = side < 0 ? 'capsule-left-hinge' : 'capsule-right-hinge';
    hinge.position.set(side * 1.55, 0.10, 1.46);
    hinge.userData.closedPosition = hinge.position.toArray();
    door.add(hinge); hinges.push(hinge);
  }
  group.userData.insertionPod = { clearHeight: 4.65, clearWidth: 2.9, interpretation: 'yautja-inspired-hollow-capsule', version: 2 };
  const updateOpening = value => {
    const opening = clamp01(value);
    hinges[0].rotation.y = -opening * Math.PI * 0.625;
    hinges[1].rotation.y = opening * Math.PI * 0.625;
    door.userData.opening = opening;
  };
  updateOpening(0);
  return { group, door, hinges, updateOpening, setOpening: updateOpening,
    seatPosition: new THREE.Vector3(0, 0, 0), exitPosition: new THREE.Vector3(0, 0, 4.2), exhausts,
    collisionProfile: Object.freeze({ shellRadiusX: 2.06, shellRadiusZ: 1.85,
      shellOpeningAngle: Math.PI * 0.285, hingeX: 1.55, hingeZ: 1.46,
      doorLength: 1.53, maxOpeningAngle: Math.PI * 0.625 }) };
}

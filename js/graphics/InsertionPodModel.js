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
const CROWN_PROFILE = [[4.99, 1.64, 1.41], [5.36, 1.5, 1.28], [5.9, 1.08, 0.94], [6.46, 0.52, 0.48], [6.84, 0.055, 0.055]];

// The pressure hull remains closed under the separated armor petals. Their
// shallow gaps reveal a real backing surface instead of opening the cabin.
function crownPanelGeometry(index, count) {
  const curves = [0, 1, 2].map(component => new THREE.CatmullRomCurve3(CROWN_PROFILE.map((p, i) => new THREE.Vector3(i / (CROWN_PROFILE.length - 1), p[component], 0)), false, 'catmullrom', .28));
  const rows = 24, radial = 6, columns = radial + 1, layer = (rows + 1) * columns;
  const position = [], uv = [], triangles = [], gap = .028;
  for (let inside = 0; inside < 2; inside++) for (let row = 0; row <= rows; row++) {
    const t = .025 + row / rows * .91, [y, rx, rz] = curves.map(curve => curve.getPoint(t).y);
    for (let segment = 0; segment <= radial; segment++) {
      const u = segment / radial, angle = (index + u) / count * Math.PI * 2 + gap * (1 - 2 * u);
      const relief = .016 * Math.sin(Math.PI * u) ** 2 - (inside ? .035 : 0);
      position.push(Math.cos(angle) * (rx + relief), y, Math.sin(angle) * (rz + relief));
      uv.push((index + u) / count * 2, t * 2);
      if (row < rows && segment < radial) {
        const a = inside * layer + row * columns + segment, b = a + columns;
        if (inside) triangles.push(a, a + 1, b, b, a + 1, b + 1);
        else triangles.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  for (const edge of [0, radial]) for (let row = 0; row < rows; row++) {
    const a = row * columns + edge, b = a + columns, c = a + layer, d = b + layer;
    if (edge === 0) triangles.push(a, c, b, b, c, d); else triangles.push(a, b, c, b, d, c);
  }
  for (const row of [0, rows]) for (let segment = 0; segment < radial; segment++) {
    const a = row * columns + segment, b = a + 1, c = a + layer, d = b + layer;
    if (row === 0) triangles.push(a, b, c, b, d, c); else triangles.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(triangles); geometry.computeVertexNormals();
  return geometry;
}

// Eight cylinder sections share one owned buffer and one draw. Only their
// vertices/normals move; the barrel length is fixed and the piston telescopes.
// No per-opening mesh, material, geometry or GPU instance buffer is allocated.
function hatchActuators(group, hinges, material) {
  const indexedTemplate = new THREE.CylinderGeometry(1, 1, 1, 12);
  const template = indexedTemplate.toNonIndexed(); indexedTemplate.dispose();
  const sourcePosition = template.attributes.position.array.slice(), sourceNormal = template.attributes.normal.array.slice();
  const vertices = template.attributes.position.count, sections = 8;
  const positions = new Float32Array(vertices * sections * 3), normals = new Float32Array(positions.length), colors = new Float32Array(positions.length), uvs = new Float32Array(vertices * sections * 2);
  const palette = [0x424c4b, 0xb4c1c3, 0x778482, 0x98a5a4].map(color => new THREE.Color(color));
  for (let section = 0; section < sections; section++) for (let vertex = 0; vertex < vertices; vertex++) {
    palette[section % 4].toArray(colors, (section * vertices + vertex) * 3);
    uvs.set(template.attributes.uv.array.subarray(vertex * 2, vertex * 2 + 2), (section * vertices + vertex) * 2);
  }
  template.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  const metal = material.clone(); metal.name = 'capsule-actuator-metal'; metal.color.set(0xffffff); metal.vertexColors = true;
  const mesh = new THREE.Mesh(geometry, metal); mesh.name = 'capsule-telescopic-actuators'; mesh.castShadow = true; mesh.receiveShadow = true;
  // Every valid pose stays in this local swept region; no changing bounding box
  // is needed during the cinematic or when a whole capsule fades/translates.
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-2.03, 4.16, .2), new THREE.Vector3(2.03, 4.5, 1.78));
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  group.add(mesh);
  const anchor = new THREE.Vector3(), end = new THREE.Vector3(), direction = new THREE.Vector3(), center = new THREE.Vector3();
  const quaternion = new THREE.Quaternion(), matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3(), scale = new THREE.Vector3(), point = new THREE.Vector3(), normal = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const metrics = Array.from({ length: 2 }, () => ({ anchor: [0, 0, 0], doorSocket: [0, 0, 0], distance: 0, barrelLength: .72, pistonLength: 0 }));
  const section = (index, start, along, from, length, radius) => {
    center.copy(start).addScaledVector(along, from + length / 2); quaternion.setFromUnitVectors(up, along);
    matrix.compose(center, quaternion, scale.set(radius, length, radius)); normalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < vertices; i++) {
      const at = (index * vertices + i) * 3;
      point.fromArray(sourcePosition, i * 3).applyMatrix4(matrix).toArray(positions, at);
      normal.fromArray(sourceNormal, i * 3).applyMatrix3(normalMatrix).normalize().toArray(normals, at);
    }
  };
  const update = () => {
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, hinge = hinges[i];
      anchor.set(side * 1.87, 4.34, .34);
      end.set(-side * .12, 4.25, .26).applyEuler(hinge.rotation).add(hinge.position);
      direction.copy(end).sub(anchor); const distance = direction.length(); direction.normalize();
      section(i * 4, anchor, direction, 0, .72, .08);
      section(i * 4 + 1, anchor, direction, .66, distance - .66, .035);
      section(i * 4 + 2, anchor, direction, .67, .055, .105);
      section(i * 4 + 3, anchor, direction, distance - .06, .06, .065);
      anchor.toArray(metrics[i].anchor); end.toArray(metrics[i].doorSocket);
      metrics[i].distance = distance; metrics[i].pistonLength = distance - .66;
    }
    geometry.attributes.position.needsUpdate = true; geometry.attributes.normal.needsUpdate = true;
  };
  return { mesh, update, metrics };
}

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
  const armor = createSurfaceMaterial('armor', { color: 0x596360, finish: 'painted', repeat: [2, 2] });
  const dark = createSurfaceMaterial('metal', { color: 0x242b2b, finish: 'matte', repeat: [2, 3] });
  const trim = createSurfaceMaterial('metal', { color: 0x989b91, finish: 'bare', repeat: [2, 2] });
  const cradle = createSurfaceMaterial('leather', { color: 0x252c2b, metalness: 0.08, roughness: 0.88, repeat: [2, 3] });
  const indicator = new THREE.MeshStandardMaterial({ color: 0x945532, emissive: 0xc26b36, emissiveIntensity: .67, roughness: 0.56, metalness: 0.05 });
  for (const [name, material] of Object.entries({ armor, dark, trim, cradle, indicator })) material.name = `capsule-${name}`;
  const shell = new Assembly('orbital-capsule-hull');
  shell.add(cavityShell(), armor);
  // A solid crown above the clear head opening joins the cut shell, while the
  // tapered base is behind the sill and never fills the cabin with a cylinder.
  shell.add(loftGeometry(CROWN_PROFILE.map(([y, x, z]) => [y, x * .975, z * .975]), { radial: 24, rows: 24 }), dark);
  for (let panel = 0; panel < 9; panel++) shell.add(crownPanelGeometry(panel, 9), armor);
  const collar = new THREE.TorusGeometry(1.64, .027, 6, 56); collar.rotateX(Math.PI / 2); collar.scale(1, 1, .86);
  shell.add(collar, trim, [0, 5.065, 0]);
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
      for (const offset of [-.065, .065]) shell.cylinder(trim, [side * 1.68, y + offset, 1.512], [.026, .026], .025, [Math.PI / 2, 0, 0], 12);
    }
    shell.add(sweptLimb([[side * 0.64, 0.9, -1.05, 0.12], [side * 0.89, 2.1, -1.24, 0.14], [side * 0.93, 3.45, -1.17, 0.15], [side * 0.60, 4.31, -0.92, 0.1]], 16, 24), cradle);
    shell.tube(trim, [[side * 1.12, 0.45, -0.88], [side * 1.24, 2.6, -0.97], [side * 0.97, 4.49, -0.71]], 0.033, 22, 8);
    shell.box(dark, [side * 1.22, 2.65, -0.34], [0.18, 0.54, 0.23], true, [0.12, side * 0.2, 0]);
    for (let light = 0; light < 3; light++) shell.box(indicator, [side * 1.21, 2.8 - light * 0.10, -0.21], [0.075, 0.033, 0.018]);
    shell.tube(dark, [[side * 1.45, 1.0, -0.58], [side * 1.56, 1.8, -0.56], [side * 1.47, 3.82, -0.48], [side * 1.05, 4.65, -0.69]], 0.05, 28, 8);
  }
  shell.box(cradle, [0, 2.65, -1.32], [0.92, 2.75, 0.22], true);
  shell.box(cradle, [0, 4.08, -1.0], [0.58, 0.48, 0.23], true, [-0.2, 0, 0]);
  // Separate lumbar/rib pads read as a fitted cradle rather than a flat slab.
  for (const side of [-1, 1]) for (let pad = 0; pad < 5; pad++) {
    shell.box(cradle, [side * .31, 1.53 + pad * .39, -1.169], [.27, .31, .065], true, [0, side * -.08, side * .055]);
  }
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
    leaf.tube(cradle, [[inward * 1.49, .1, -.009], [inward * 1.49, 2.55, -.009], [inward * 1.44, 4.16, -.009], [inward * .77, 4.75, -.009], [inward * .08, 4.53, -.009]], .023, 42, 6);
    // The raised surround and dark inset are both opaque armor, not windows.
    for (const y of [1.0, 2.2, 3.45]) {
      leaf.box(trim, [inward * .84, y, .224], [.71, .28, .024], true);
      leaf.box(dark, [inward * .84, y, .243], [.61, .18, .021], true);
      for (const x of [.53, 1.15]) leaf.cylinder(trim, [inward * x, y, .254], [.023, .023], .022, [Math.PI / 2, 0, 0], 12);
    }
    for (const y of [0.55, 2.35, 4.2]) leaf.box(trim, [inward * 0.1, y - 0.12, 0.10], [0.25, 0.13, 0.17], true);
    recessedGlyphs(leaf, trim, inward * 0.82, 3.67, 0.235, inward);
    const hinge = leaf.finish(); hinge.name = side < 0 ? 'capsule-left-hinge' : 'capsule-right-hinge';
    hinge.position.set(side * 1.55, 0.10, 1.46);
    hinge.userData.closedPosition = hinge.position.toArray();
    door.add(hinge); hinges.push(hinge);
  }
  const actuators = hatchActuators(group, hinges, trim);
  group.userData.insertionPod = { clearHeight: 4.65, clearWidth: 2.9, interpretation: 'yautja-inspired-hollow-capsule', version: 3,
    detail: { crownPanels: 9, independentHatchLeaves: 2, telescopicActuators: 2, actuatorSections: 8, pressureHullClosed: true, filmPropFidelity1to1Verified: false } };
  let previousOpening = NaN;
  const updateOpening = value => {
    const opening = clamp01(value);
    hinges[0].rotation.y = -opening * Math.PI * 0.625;
    hinges[1].rotation.y = opening * Math.PI * 0.625;
    door.userData.opening = opening;
    indicator.emissiveIntensity = .32 + (1 - opening) * .35;
    if (opening !== previousOpening) { actuators.update(); previousOpening = opening; }
  };
  updateOpening(0);
  return { group, door, hinges, updateOpening, setOpening: updateOpening, actuators,
    seatPosition: new THREE.Vector3(0, 0, 0), exitPosition: new THREE.Vector3(0, 0, 4.2), exhausts,
    collisionProfile: Object.freeze({ shellRadiusX: 2.06, shellRadiusZ: 1.85,
      shellOpeningAngle: Math.PI * 0.285, hingeX: 1.55, hingeZ: 1.46,
      doorLength: 1.53, maxOpeningAngle: Math.PI * 0.625 }) };
}

/* Wolf's fallback is a reference-led sculpt, not a scan of the film prop. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fittedPlate, gauss } from './HunterSculpt.js';

// Local head coordinates: +Z faces forward. Keep the adult skull and its socket.
const PROFILES = [
  [-0.28, 0.105, 0.15], [-0.25, 0.16, 0.178], [-0.18, 0.202, 0.166],
  [-0.085, 0.219, 0.158], [0.005, 0.249, 0.164], [0.08, 0.267, 0.174],
  [0.155, 0.264, 0.169], [0.235, 0.233, 0.149], [0.29, 0.196, 0.108],
  [0.313, 0.158, 0.079]
];

const CROWN_SCRATCHES = [
  [[-0.122, 0.218], [-0.078, 0.225], [-0.039, 0.214]],
  [[-0.132, 0.193], [-0.073, 0.2], [-0.017, 0.18]],
  [[-0.112, 0.165], [-0.066, 0.176], [-0.022, 0.157]]
];

export const WOLF_BIOMASK_CALIBRATION = Object.freeze({
  revision: 'wolf-biomask-reference-sculpt-v1',
  fidelity: 'procedural interpretation of Prime 1 REMAVP-01DXS promotional photographs; not measured 1:1',
  sourceProduct: 'https://www.prime1studio.com/avpr-wolf-predator/REMAVP-01DXS.html',
  sourceImages: ['b158-FePJW4LO.jpg', 'b191-WfqrcV0J.jpg', 'b195-5sime7UF.jpg', 'b196-emXxATFR.jpg'],
  shellSegments: [64, 48],
  shellOffset: [0, 0, 0.025],
  crownStuds: 12,
  eyeCenters: [[-0.117, -0.02], [0.117, -0.02]],
  lowerOutline: [[-0.202, -0.18], [-0.16, -0.25], [-0.105, -0.28], [0.105, -0.28], [0.16, -0.25], [0.202, -0.18]]
});

function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
}

function sculpt(x, y, z, theta) {
  const front = Math.max(0, Math.cos(theta));
  const ax = Math.abs(x);
  // The broad domed crown overhangs a narrow, angular lower face. The bridge
  // widens toward the chin; it is not the generic rounded muzzle/vent plate.
  const browY = -0.018 + ax * 0.32;
  const brow = gauss(y, browY, 0.015) * (0.029 + gauss(ax, 0.14, 0.085) * 0.017);
  const lensWell = gauss(ax, 0.117, 0.053) * gauss(y, -0.02, 0.023) * 0.018;
  const cheekHollow = gauss(ax, 0.142, 0.053) * gauss(y, -0.111, 0.045) * 0.039;
  const cheekFlange = gauss(ax, 0.18, 0.04) * gauss(y, -0.176, 0.072) * 0.016;
  const bridgeWidth = 0.054 + THREE.MathUtils.clamp(-y, 0, 0.28) * 0.28;
  const bridgeWeight = Math.exp(-((x / bridgeWidth) ** 8)) * THREE.MathUtils.clamp((-y - 0.02) / 0.04, 0, 1);
  const bridgeKeel = gauss(x, 0, 0.012) * gauss(y, -0.15, 0.14) * 0.004;
  const crownRim = gauss(ax, 0.226 - Math.max(y - 0.15, 0) * 0.73, 0.009)
    * gauss(y, 0.18, 0.115) * 0.009;
  let incision = 0;
  for (const path of CROWN_SCRATCHES) for (let i = 1; i < path.length; i++) {
    incision = Math.max(incision, gauss(segmentDistance(x, y, path[i - 1], path[i]), 0, 0.0022) * 0.0025);
  }
  // Very shallow hammered relief supplements the shared PBR normal map. No
  // detached noise particles or high-frequency displacement of the silhouette.
  const hammered = Math.sin(x * 383 + Math.sin(y * 193)) * Math.sin(y * 419 - x * 97) * 0.00035;
  const crownNotch = gauss(y, 0.313, 0.016) * (gauss(ax, 0.157, 0.055) * 0.005 - gauss(x, 0, 0.075) * 0.012);
  const reliefZ = z + front ** 3 * (brow + cheekFlange + crownRim - lensWell - cheekHollow - incision + hammered);
  // Broad near-planar trapezoid with a crisp change into the recessed cheeks,
  // rather than the rounded, long beak produced by a Gaussian muzzle bulge.
  const plateZ = 0.225 - y * 0.065 + bridgeKeel + hammered;
  return [x, y + crownNotch, THREE.MathUtils.lerp(reliefZ, Math.max(reliefZ, plateZ), front ** 2 * bridgeWeight)];
}

function projector(geometry) {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(0, 0, -1);
  return {
    point(x, y, lift = 0.0015) {
      ray.set(new THREE.Vector3(x, y, 1), direction);
      const hit = ray.intersectObject(mesh, false)[0];
      if (!hit) throw new Error(`Wolf detail outside the fitted shell: ${x}, ${y}`);
      return new THREE.Vector3(x, y, hit.point.z + lift);
    },
    dispose() { material.dispose(); }
  };
}

function makeGeometry(positions, indices, uv = null) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv ?? new Float32Array(positions.length / 3 * 2), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function join(parts) {
  const geometries = parts.map(part => part.index ? part.toNonIndexed() : part);
  const result = mergeGeometries(geometries, false);
  for (const part of new Set([...parts, ...geometries])) part.dispose();
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}

function eyePoint(side, u, v) {
  return [side * (0.052 + u * 0.13), -0.035 + u * 0.03 + v * 0.022 * Math.sin(Math.PI * u) ** 0.68];
}

// A thin ribbon follows the actual shell triangles, so engravings do not float
// above a guessed ellipsoid. The same routine makes the lens's diamond grille.
function ribbon(surface, input, width, lift = 0.002, taper = false) {
  const points = [input[0]];
  // Long engraving chords otherwise cut into a curved cheek between samples.
  for (let i = 1; i < input.length; i++) {
    const previous = input[i - 1], next = input[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(next[0] - previous[0], next[1] - previous[1]) / 0.012));
    for (let step = 1; step <= steps; step++) points.push([THREE.MathUtils.lerp(previous[0], next[0], step / steps), THREE.MathUtils.lerp(previous[1], next[1], step / steps)]);
  }
  const positions = [], indices = [], uv = [];
  for (let i = 0; i < points.length; i++) {
    const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    const dx = next[0] - previous[0], dy = next[1] - previous[1], length = Math.hypot(dx, dy);
    for (const side of [-1, 1]) {
      const localWidth = taper ? width * (0.08 + 0.92 * Math.sin(Math.PI * i / (points.length - 1)) ** 0.5) : width;
      const point = surface.point(points[i][0] - side * dy / length * localWidth / 2, points[i][1] + side * dx / length * localWidth / 2, lift);
      positions.push(...point.toArray()); uv.push(i / (points.length - 1), (side + 1) / 2);
    }
    if (i) { const a = (i - 1) * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return makeGeometry(positions, indices, uv);
}

function projectedCurve(surface, path, radius, segments = 18) {
  const curve = new THREE.CatmullRomCurve3(path.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  const points = curve.getPoints(segments).map(point => surface.point(point.x, point.y, 0.0008));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 4, false);
}

export function createWolfBiomaskParts() {
  const shell = fittedPlate(PROFILES, { radial: 64, longitudinal: 48, arcLength: Math.PI * 1.14, thickness: 0.009, sculpt });
  const surface = projector(shell), trim = [], inlays = [], lenses = [];
  try {
    for (const side of [-1, 1]) {
      const positions = [], uv = [], indices = [], columns = 16, rows = 6;
      for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
        const u = column / columns, v = row / rows * 2 - 1;
        positions.push(...surface.point(...eyePoint(side, u, v), 0.002).toArray()); uv.push(u, row / rows);
        if (row < rows && column < columns) {
          const a = row * (columns + 1) + column, b = a + columns + 1;
          // Reverse the left lens's parametrization so both face +Z.
          indices.push(...(side === 1 ? [a, a + 1, b, a + 1, b + 1, b] : [a, b, a + 1, a + 1, b, b + 1]));
        }
      }
      lenses.push(makeGeometry(positions, indices, uv));
      const outline = [];
      for (let i = 0; i <= 12; i++) outline.push(eyePoint(side, i / 12, 1));
      for (let i = 11; i >= 0; i--) outline.push(eyePoint(side, i / 12, -1));
      trim.push(projectedCurve(surface, outline, 0.0022, 28));

      // Fine metal lattice over an opaque dark lens. The photos have illuminated
      // mesh reflections; that lighting is not baked into glowing eye materials.
      for (const slope of [-2, 2]) for (let b = -1.5; b <= 1.51; b += 0.3) {
        const path = [];
        for (let step = 1; step < 24; step++) {
          const u = step / 24, v = slope * (u - 0.5) + b;
          if (Math.abs(v) < 0.91) path.push(eyePoint(side, u, v));
        }
        if (path.length > 1) trim.push(ribbon(surface, path, 0.00042, 0.0028));
      }

      // A narrow curved channel lies inside the sculpted subocular hollow.
      // Dense projected samples avoid black triangular patches above the face.
      inlays.push(ribbon(surface, [[side * 0.095, -0.09], [side * 0.12, -0.101], [side * 0.15, -0.11], [side * 0.178, -0.113]], 0.006, 0.0011, true));

      trim.push(projectedCurve(surface, [[side * 0.232, 0.09], [side * 0.232, 0.155], [side * 0.218, 0.218], [side * 0.19, 0.267], [side * 0.151, 0.308]], 0.0028, 18));
      const studSites = [[0.248, 0.094], [0.247, 0.15], [0.231, 0.213], [0.21, 0.255], [0.183, 0.286], [0.154, 0.306]];
      for (let i = 0; i < studSites.length; i++) {
        const [x, y] = studSites[i], base = surface.point(side * x, y, 0.001);
        const direction = new THREE.Vector3(side * 0.56, 0.24 + i * 0.06, 0.67).normalize();
        const height = 0.022 + (5 - i) * 0.0016;
        const stud = new THREE.ConeGeometry(0.0105, height, 8, 1);
        stud.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
        stud.translate(...base.addScaledVector(direction, height * 0.43).toArray()); trim.push(stud);
      }
      for (let i = 0; i < 3; i++) {
        inlays.push(ribbon(surface, [[side * (0.155 + i * 0.014), -0.174], [side * (0.125 + i * 0.014), -0.199], [side * (0.116 + i * 0.014), -0.224]], 0.0012, 0.0012));
        inlays.push(ribbon(surface, [[side * (0.012 + i * 0.011), -0.169], [side * (0.047 + i * 0.01), -0.228], [side * (0.066 + i * 0.008), -0.255]], 0.0011, 0.0012));
      }
    }
    for (const path of CROWN_SCRATCHES) inlays.push(ribbon(surface, path, 0.0014, 0.0006));
    const result = { shell, lenses: join(lenses), trim: join(trim), inlays: join(inlays) };
    for (const [name, geometry] of Object.entries(result)) {
      geometry.name = `wolf-biomask-${name}`;
      geometry.userData.wolfBiomask = true;
    }
    return result;
  } finally { surface.dispose(); }
}

export function attachWolfBiomask(head, { mask, dark }) {
  // The photographed shell is weathered, peened gunmetal. Preserve the shared
  // PBR maps and their ownership while giving this mask its own surface finish.
  mask.roughness = 0.66;
  mask.metalness = 0.72;
  mask.normalScale.set(1.7, 1.7);
  mask.envMapIntensity = 0.65;
  const parts = createWolfBiomaskParts();
  for (const [name, geometry] of Object.entries(parts)) {
    const mesh = new THREE.Mesh(geometry, ['lenses', 'inlays'].includes(name) ? dark : mask);
    mesh.name = `wolf-biomask-${name}`;
    mesh.position.set(...WOLF_BIOMASK_CALIBRATION.shellOffset);
    mesh.castShadow = true; mesh.receiveShadow = true;
    head.add(mesh);
  }
  head.userData.wolfBiomask = WOLF_BIOMASK_CALIBRATION.revision;
  return parts;
}

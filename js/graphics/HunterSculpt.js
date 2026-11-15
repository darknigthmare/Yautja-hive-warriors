/* Continuous anatomical lofts and swept detail for the playable hunter. */
import * as THREE from 'three';

const TAU = Math.PI * 2;
export const gauss = (value, center, width) => Math.exp(-(((value - center) / width) ** 2));

function cubic(a, b, c, d, t) {
  return b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
}

function sample(profiles, y, component) {
  let index = 0;
  while (index < profiles.length - 2 && profiles[index + 1][0] < y) index++;
  const a = profiles[Math.max(0, index - 1)][component] ?? 0;
  const b = profiles[index][component] ?? 0;
  const c = profiles[index + 1][component] ?? 0;
  const d = profiles[Math.min(profiles.length - 1, index + 2)][component] ?? 0;
  return cubic(a, b, c, d, THREE.MathUtils.clamp((y - profiles[index][0]) / (profiles[index + 1][0] - profiles[index][0]), 0, 1));
}

// Profile rows are [y, radiusX, radiusZ, centerX?, centerZ?]. Sculpt displaces
// one continuous skin surface; individual muscles are never glued-on spheres.
export function sculptLoft(profiles, { radial = 64, longitudinal = 80, arcStart = -Math.PI, arcLength = TAU, sculpt } = {}) {
  profiles = [...profiles].sort((a, b) => a[0] - b[0]);
  const low = profiles[0][0], high = profiles.at(-1)[0];
  const positions = [], uvs = [], indices = [];
  for (let ring = 0; ring <= longitudinal; ring++) {
    const t = ring / longitudinal, y = THREE.MathUtils.lerp(low, high, t);
    const rx = Math.max(0.0005, sample(profiles, y, 1));
    const rz = Math.max(0.0005, sample(profiles, y, 2));
    const cx = sample(profiles, y, 3), cz = sample(profiles, y, 4);
    for (let column = 0; column <= radial; column++) {
      const u = column / radial, theta = arcStart + u * arcLength;
      let point = [cx + Math.sin(theta) * rx, y, cz + Math.cos(theta) * rz];
      if (sculpt) point = sculpt(...point, theta, t);
      positions.push(...point); uvs.push(u, t);
      if (ring < longitudinal && column < radial) {
        const a = ring * (radial + 1) + column, b = a + radial + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Match the duplicated UV seam on closed lofts to avoid a hard lighting line.
  if (Math.abs(arcLength - TAU) < 0.0001) {
    const normal = geometry.attributes.normal;
    const averaged = new THREE.Vector3();
    for (let ring = 0; ring <= longitudinal; ring++) {
      const a = ring * (radial + 1), b = a + radial;
      averaged.set(normal.getX(a) + normal.getX(b), normal.getY(a) + normal.getY(b), normal.getZ(a) + normal.getZ(b)).normalize();
      normal.setXYZ(a, averaged.x, averaged.y, averaged.z); normal.setXYZ(b, averaged.x, averaged.y, averaged.z);
    }
  }
  geometry.userData.sculptedSurface = true;
  geometry.computeBoundingSphere();
  return geometry;
}

export function taperedSweep(points, radii, { longitudinal = 24, radial = 10 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const geometry = new THREE.TubeGeometry(curve, longitudinal, 1, radial, false);
  const positions = geometry.attributes.position;
  for (let ring = 0; ring <= longitudinal; ring++) {
    const t = ring / longitudinal, center = curve.getPointAt(t);
    const i = Math.min(radii.length - 2, Math.floor(t * (radii.length - 1)));
    const radius = THREE.MathUtils.lerp(radii[i], radii[i + 1], t * (radii.length - 1) - i);
    for (let column = 0; column <= radial; column++) {
      const at = ring * (radial + 1) + column;
      positions.setXYZ(at, center.x + (positions.getX(at) - center.x) * radius, center.y + (positions.getY(at) - center.y) * radius, center.z + (positions.getZ(at) - center.z) * radius);
    }
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

// A thin shell follows the body rather than covering it with a rounded cuboid.
export function fittedPlate(profiles, { radial = 48, longitudinal = 20, arcLength = Math.PI * 1.05, thickness = 0.018, sculpt } = {}) {
  const front = sculptLoft(profiles, { radial, longitudinal, arcStart: -arcLength / 2, arcLength, sculpt });
  const pos = front.attributes.position, normal = front.attributes.normal, uv = front.attributes.uv;
  const count = pos.count, positions = [], normals = [], uvs = [], indices = [];
  for (const side of [0, 1]) for (let i = 0; i < count; i++) {
    const sign = side ? -1 : 1;
    positions.push(pos.getX(i) + normal.getX(i) * thickness * sign / 2, pos.getY(i) + normal.getY(i) * thickness * sign / 2, pos.getZ(i) + normal.getZ(i) * thickness * sign / 2);
    normals.push(normal.getX(i) * sign, normal.getY(i) * sign, normal.getZ(i) * sign); uvs.push(uv.getX(i), uv.getY(i));
  }
  const frontIndex = front.index.array;
  for (let i = 0; i < frontIndex.length; i += 3) {
    const a = frontIndex[i], b = frontIndex[i + 1], c = frontIndex[i + 2];
    indices.push(a, b, c, a + count, c + count, b + count);
  }
  const edge = (a, b) => indices.push(a, a + count, b, b, a + count, b + count);
  for (let row = 0; row < longitudinal; row++) {
    edge(row * (radial + 1), (row + 1) * (radial + 1));
    edge(row * (radial + 1) + radial, (row + 1) * (radial + 1) + radial);
  }
  for (let column = 0; column < radial; column++) {
    edge(column, column + 1);
    edge(longitudinal * (radial + 1) + column, longitudinal * (radial + 1) + column + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeBoundingSphere(); front.dispose();
  geometry.userData.fittedArmor = true;
  return geometry;
}

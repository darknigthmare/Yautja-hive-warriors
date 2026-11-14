/* Smooth anatomical and hull surfaces. Profiles are lofted continuously instead of
 * stacking disconnected boxes, spheres and cylinders. All geometry has UVs/normals. */
import * as THREE from 'three';

const lerp = THREE.MathUtils.lerp;
const gaussian = (x, center, spread) => Math.exp(-(((x - center) / spread) ** 2));

export function loftGeometry(profile, { axis = 'y', radial = 48, rows = 40, superellipse = 2, muscle = 0 } = {}) {
  // Each station is [axis coordinate, horizontal radius, depth/height radius,
  // horizontal center, depth/height center]. Catmull interpolation preserves curves.
  const curves = [0, 1, 2, 3, 4].map(component => new THREE.CatmullRomCurve3(profile.map((p, i) => new THREE.Vector3(i / (profile.length - 1), p[component] || 0, 0)), false, 'catmullrom', 0.28));
  const positions = [], uvs = [], indices = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const v = curves.map(curve => curve.getPoint(t).y);
    const radiusX = Math.max(0.002, v[1]), radiusZ = Math.max(0.002, v[2]);
    for (let segment = 0; segment <= radial; segment++) {
      const angle = segment / radial * Math.PI * 2;
      const c = Math.cos(angle), s = Math.sin(angle);
      const cx = Math.sign(c) * Math.abs(c) ** (2 / superellipse);
      const sz = Math.sign(s) * Math.abs(s) ** (2 / superellipse);
      const sculpt = 1 + muscle * Math.cos(angle * 2) * Math.sin(t * Math.PI) ** 2;
      const x = v[3] + cx * radiusX * sculpt;
      const depth = v[4] + sz * radiusZ;
      if (axis === 'y') positions.push(x, v[0], depth);
      else positions.push(x, depth, v[0]);
      uvs.push(segment / radial, t);
      if (row < rows && segment < radial) {
        const a = row * (radial + 1) + segment, b = a + radial + 1;
        if (axis === 'y') indices.push(a, b, a + 1, b, b + 1, a + 1);
        else indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  // Profiles taper almost to zero at their ends. Flat fans close the tiny seams.
  for (const end of [0, rows]) {
    const center = positions.length / 3, ring = end * (radial + 1);
    const station = curves.map(curve => curve.getPoint(end / rows).y);
    if (axis === 'y') positions.push(station[3], station[0], station[4]);
    else positions.push(station[3], station[4], station[0]);
    uvs.push(0.5, end / rows);
    for (let segment = 0; segment < radial; segment++) {
      if ((end === 0) === (axis === 'y')) indices.push(center, ring + segment, ring + segment + 1);
      else indices.push(center, ring + segment + 1, ring + segment);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function sweptLimb(stations, radial = 32, rows = 28) {
  const curve = new THREE.CatmullRomCurve3(stations.map(p => new THREE.Vector3(...p.slice(0, 3))), false, 'catmullrom', 0.25);
  const frames = curve.computeFrenetFrames(rows, false);
  const radii = [3, 4].map(component => new THREE.CatmullRomCurve3(stations.map((p, i) => new THREE.Vector3(i / (stations.length - 1), p[component] ?? p[3], 0)), false, 'catmullrom', 0.25));
  const positions = [], uvs = [], indices = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, center = curve.getPoint(t), rx = Math.max(0.002, radii[0].getPoint(t).y), rz = Math.max(0.002, radii[1].getPoint(t).y);
    for (let segment = 0; segment <= radial; segment++) {
      const angle = segment / radial * Math.PI * 2;
      const point = center.clone().addScaledVector(frames.normals[row], Math.cos(angle) * rx).addScaledVector(frames.binormals[row], Math.sin(angle) * rz);
      positions.push(point.x, point.y, point.z); uvs.push(segment / radial, t);
      if (row < rows && segment < radial) {
        const a = row * (radial + 1) + segment, b = a + radial + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function sculptedFaceGeometry({ width = 0.15, height = 0.23, depth = 0.15, mask = false, radial = 48, rows = 36 } = {}) {
  const geometry = new THREE.SphereGeometry(1, radial, rows), p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * width, y = p.getY(i) * height, z = p.getZ(i) * depth;
    const normalizedY = y / height;
    // Jaw tapers continuously from cheekbones into an adult chin, not a sphere.
    x *= normalizedY < -0.1 ? lerp(0.72, 1, Math.min(1, (normalizedY + 1) / 0.9)) : 1;
    if (z > 0) {
      const front = Math.min(1, z / depth * 1.8);
      const nose = gaussian(x, 0, width * 0.19) * gaussian(y, height * 0.02, height * 0.29) * depth * (mask ? 0.42 : 0.29);
      const eyeSockets = (gaussian(x, -width * 0.45, width * 0.24) + gaussian(x, width * 0.45, width * 0.24)) * gaussian(y, height * 0.17, height * 0.16) * depth * 0.2;
      const brow = gaussian(y, height * 0.34, height * 0.12) * gaussian(Math.abs(x), width * 0.4, width * 0.4) * depth * 0.1;
      const cheek = gaussian(y, -height * 0.05, height * 0.19) * gaussian(Math.abs(x), width * 0.65, width * 0.3) * depth * 0.16;
      const chin = gaussian(y, -height * 0.64, height * 0.19) * gaussian(x, 0, width * 0.4) * depth * 0.13;
      z += (nose - eyeSockets + brow + cheek + chin) * front;
    }
    p.setXYZ(i, x, y, z);
  }
  p.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function tireGeometry(radius = 0.85, width = 0.7) {
  const geometry = new THREE.TorusGeometry(radius * 0.71, radius * 0.29, 16, 64);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const angle = Math.atan2(y, x);
    const groove = 1 + 0.014 * Math.cos(angle * 48 + Math.sign(z) * 0.7) * Math.max(0, 1 - Math.abs(z) / (radius * 0.28));
    p.setXYZ(i, z / (radius * 0.58) * width, y * groove, -x * groove);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

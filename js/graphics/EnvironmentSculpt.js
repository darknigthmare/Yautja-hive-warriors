/* Curved, indexed botanical forms and worn terrain edges, shared by instances. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function tube(curve, radii, segments = 5, radial = 6) {
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [], uvs = [], indices = [];
  for (let row = 0; row <= segments; row++) {
    const t = row / segments, center = curve.getPointAt(t);
    const radius = typeof radii === 'function' ? radii(t) : THREE.MathUtils.lerp(radii[0], radii[1], t);
    for (let column = 0; column <= radial; column++) {
      const angle = column / radial * Math.PI * 2;
      const point = center.clone().addScaledVector(frames.normals[row], Math.cos(angle) * radius).addScaledVector(frames.binormals[row], Math.sin(angle) * radius);
      positions.push(point.x, point.y, point.z); uvs.push(column / radial, t);
      if (row < segments && column < radial) {
        const a = row * (radial + 1) + column, b = a + radial + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function trunkCenter(t) {
  return new THREE.Vector3(Math.sin(t * 3.1) * 0.3 + t * 0.16, t * 12, Math.cos(t * 2.8) * 0.24 - 0.24);
}

function branchLayout(tropical, distant) {
  const branches = [];
  const tiers = tropical ? 4 : 7;
  const arms = tropical ? 3 : 3;
  for (let tier = 0; tier < tiers; tier++) for (let arm = 0; arm < arms; arm++) {
    const angle = tier * 2.399963 + arm / arms * Math.PI * 2;
    const t = tropical ? 0.39 + tier * 0.15 : 0.22 + tier * 0.1;
    const start = trunkCenter(t);
    const reach = tropical ? 3.2 + tier * 0.3 : 4.1 - tier * 0.43;
    const rise = tropical ? 1.2 + tier % 2 * 0.45 : -0.25 + tier * 0.08;
    const end = start.clone().add(new THREE.Vector3(Math.sin(angle) * reach, rise, Math.cos(angle) * reach));
    const middle = start.clone().lerp(end, 0.53).add(new THREE.Vector3(Math.cos(angle) * 0.2, tropical ? 0.4 : -0.35, Math.sin(angle) * 0.2));
    const curve = new THREE.CatmullRomCurve3([start, middle, end]);
    branches.push({ curve, angle, tier, reach, distant });
  }
  return branches;
}

export function sculptedTreeWoodGeometry(tropical = false, distant = false) {
  const pieces = [];
  const trunk = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, index) => trunkCenter(index / 8)));
  pieces.push(tube(trunk, t => 0.11 + 0.48 * (1 - t) ** 1.35 + 0.22 * Math.exp(-t * 22), distant ? 8 : 16, distant ? 6 : 10));
  for (const branch of branchLayout(tropical, distant)) {
    pieces.push(tube(branch.curve, [0.14 - branch.tier * 0.008, 0.018], distant ? 2 : 4, distant ? 4 : 5));
    if (!distant) {
      const origin = branch.curve.getPoint(0.6), tip = branch.curve.getPoint(0.95);
      const offshoot = new THREE.CatmullRomCurve3([origin, origin.clone().lerp(tip, 0.5).add(new THREE.Vector3(Math.cos(branch.angle) * 0.6, 0.18, -Math.sin(branch.angle) * 0.6)), tip.clone().add(new THREE.Vector3(Math.cos(branch.angle) * 0.9, 0.3, -Math.sin(branch.angle) * 0.9))]);
      pieces.push(tube(offshoot, [0.055, 0.009], 3, 4));
    }
  }
  if (!distant) for (let root = 0; root < 5; root++) {
    const angle = root / 5 * Math.PI * 2 + 0.25;
    const reach = 1.5 + root % 3 * 0.27;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(Math.sin(angle) * 0.7, 0.18, Math.cos(angle) * 0.7), new THREE.Vector3(Math.sin(angle) * reach, -0.02, Math.cos(angle) * reach)]);
    pieces.push(tube(curve, [0.25, 0.012], 4, 5));
  }
  const geometry = mergeGeometries(pieces, false);
  pieces.forEach(piece => piece.dispose());
  geometry.userData.botanicalForm = 'curved-trunk-branches-buttress-roots';
  return geometry;
}

function leafBuilder() {
  return { positions: [], colors: [], uvs: [], indices: [], leaves: 0 };
}

// A petiole, curled blade and raised midrib. Small leaves are attached to branch
// positions; a crown is no longer a few giant triangular cards around a pole.
function addLeaf(data, origin, direction, length, width, roll = 0, distant = false, tint = 0) {
  const forward = direction.clone().normalize();
  const side = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  if (side.lengthSq() < 0.1) side.set(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(side, forward).normalize();
  const rotatedSide = side.clone().multiplyScalar(Math.cos(roll)).addScaledVector(up, Math.sin(roll));
  const rotatedUp = up.clone().multiplyScalar(Math.cos(roll)).addScaledVector(side, -Math.sin(roll));
  const samples = distant ? [0, 0.5, 1] : [0, 0.25, 0.64, 1];
  const offset = data.positions.length / 3;
  for (const t of samples) {
    const span = Math.sin(Math.PI * t) ** 0.85 * width;
    const curl = Math.sin(Math.PI * t) * length * 0.14 - t * t * length * 0.11;
    for (let across = -1; across <= 1; across++) {
      const point = origin.clone().addScaledVector(forward, t * length).addScaledVector(rotatedSide, span * across).addScaledVector(rotatedUp, curl + (across === 0 ? span * 0.13 : 0));
      data.positions.push(point.x, point.y, point.z);
      data.uvs.push((across + 1) / 2, t);
      data.colors.push(0.64 + tint * 0.17, 0.74 + tint * 0.18, 0.59 + tint * 0.16);
    }
  }
  for (let row = 0; row < samples.length - 1; row++) {
    const a = offset + row * 3, b = a + 3;
    if (row === 0) data.indices.push(a + 1, b, b + 1, a + 1, b + 1, b + 2);
    else if (row === samples.length - 2) data.indices.push(a, b + 1, a + 1, a + 1, b + 1, a + 2);
    else data.indices.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  data.leaves++;
}

function finishLeaves(data, form) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
  geometry.setIndex(data.indices); geometry.computeVertexNormals();
  geometry.userData.leafCount = data.leaves;
  geometry.userData.botanicalForm = form;
  return geometry;
}

export function sculptedTreeCrownGeometry(tropical = false, distant = false) {
  const data = leafBuilder();
  const branches = branchLayout(tropical, distant);
  for (const branch of branches) {
    const pairs = distant ? 6 : tropical ? 16 : 14;
    for (let pair = 0; pair < pairs; pair++) for (const side of [-1, 1]) {
      const t = 0.18 + pair / pairs * 0.81;
      const origin = branch.curve.getPoint(t);
      origin.y += Math.sin(pair * 2.4 + branch.tier) * 0.24;
      const angle = branch.angle + side * (0.55 + 0.18 * Math.sin(pair * 3));
      const direction = new THREE.Vector3(Math.sin(angle), tropical ? 0.22 - pair % 3 * 0.14 : -0.12, Math.cos(angle));
      const distanceScale = distant ? 1.5 : 1;
      addLeaf(data, origin, direction, (tropical ? 1.05 : 0.74) * (0.7 + t * 0.4) * distanceScale, (tropical ? 0.24 : 0.19) * distanceScale, side * (0.5 + pair % 4 * 0.32), distant, pair % 5 / 5);
    }
  }
  return finishLeaves(data, tropical ? 'broadleaf-branch-crown' : 'layered-evergreen-sprays');
}

export function sculptedFernGeometry(tropical = false) {
  const data = leafBuilder();
  for (let frond = 0; frond < 5; frond++) {
    const angle = frond * 2.399963;
    const reach = (tropical ? 0.95 : 0.72) * (0.8 + frond % 3 * 0.09);
    const stemOffset = data.positions.length / 3;
    for (let step = 0; step <= 6; step++) {
      const t = step / 6;
      for (const side of [-1, 1]) {
        data.positions.push(Math.sin(angle) * t * reach + Math.cos(angle) * side * 0.011, Math.sin(t * Math.PI * 0.75) * 0.65, Math.cos(angle) * t * reach - Math.sin(angle) * side * 0.011);
        data.colors.push(0.35, 0.55, 0.3); data.uvs.push(0.5, 0.5);
      }
      if (step < 6) {
        const a = stemOffset + step * 2, b = a + 2;
        data.indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }

    for (let pair = 0; pair < 5; pair++) for (const side of [-1, 1]) {
      const t = 0.16 + pair * 0.17;
      const rise = Math.sin(t * Math.PI * 0.75) * 0.65;
      const origin = new THREE.Vector3(Math.sin(angle) * t * reach, rise, Math.cos(angle) * t * reach);
      const leafAngle = angle + side * (0.85 - t * 0.3);
      addLeaf(data, origin, new THREE.Vector3(Math.sin(leafAngle), 0.1 - t * 0.32, Math.cos(leafAngle)), 0.32 * (1 - t * 0.65), 0.075 * (1 - t * 0.7), side * 0.17, true, frond % 3 / 3);
    }
  }
  return finishLeaves(data, 'arched-pinnate-fern-fronds');
}

export function leafLitterGeometry() {
  const data = leafBuilder();
  for (let leaf = 0; leaf < 5; leaf++) {
    const angle = leaf * 2.399963;
    addLeaf(data, new THREE.Vector3(Math.sin(angle) * 0.3, 0.03, Math.cos(angle) * 0.3), new THREE.Vector3(Math.sin(angle), -0.05, Math.cos(angle)), 0.3, 0.095, leaf * 0.3, true, leaf % 3 / 3);
  }
  return finishLeaves(data, 'curled-fallen-leaves');
}

export function sculptedRockGeometry() {
  // Indexed latitude topology keeps shared vertex normals continuous after
  // erosion. Recomputing normals on a non-indexed icosahedron leaves flat faces.
  const geometry = new THREE.SphereGeometry(1, 32, 22);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const macro = Math.sin(x * 3.8 + z * 2.1) * 0.12 + Math.cos(z * 4.6 - y * 2.4) * 0.08;
    const erosion = macro + Math.sin(y * 9.3 + x * 5) * 0.025;
    positions.setXYZ(i, x * (0.91 + erosion), Math.max(-0.68, y * (0.92 + erosion * 0.7)), z * (1 + erosion));
  }
  geometry.computeVertexNormals();
  geometry.userData.sculptedRock = true;
  return geometry;
}

export function wornTrailGeometry(width, length, edgeColor, centerColor = new THREE.Color(1, 1, 1)) {
  const positions = [], uvs = [], colors = [], indices = [];
  const segments = 44, columns = 5;
  for (let row = 0; row <= segments; row++) {
    const z = -length / 2 + row / segments * length;
    const wander = Math.sin(z * 0.18) * 0.18 + Math.sin(z * 0.73) * 0.075;
    const erosion = Math.sin(z * 1.29) * 0.13 + Math.cos(z * 0.61) * 0.16;
    for (let col = 0; col < columns; col++) {
      const across = col / (columns - 1);
      const x = (across - 0.5) * (width + erosion) + wander;
      positions.push(x, 0, z); uvs.push(x / 5, -z / 5);
      const strength = col === 0 || col === columns - 1 ? 0 : 1;
      const color = edgeColor.clone().lerp(centerColor, strength);
      colors.push(color.r, color.g, color.b);
      if (row < segments && col < columns - 1) {
        const a = row * columns + col, b = a + columns;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function weatherGroundRing(geometry, edgeColor) {
  const position = geometry.attributes.position, colors = [];
  let min = Infinity, max = 0;
  for (let i = 0; i < position.count; i++) { const radius = Math.hypot(position.getX(i), position.getZ(i)); min = Math.min(min, radius); max = Math.max(max, radius); }
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i), r = Math.hypot(x, z), angle = Math.atan2(x, z);
    const wear = Math.sin(angle * 13) * 0.16 + Math.sin(angle * 29 + 0.4) * 0.07;
    position.setXYZ(i, x / r * (r + wear), position.getY(i), z / r * (r + wear));
    const t = (r - min) / (max - min);
    const color = edgeColor.clone().lerp(new THREE.Color(1, 1, 1), Math.min(1, Math.min(t, 1 - t) * 5));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function naturalBoundaryGeometry(halfSize) {
  const positions = [], colors = [], uvs = [], indices = [];
  const segments = 36, depthSegments = 4;
  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2, offset = positions.length / 3;
    for (let along = 0; along <= segments; along++) for (let depth = 0; depth <= depthSegments; depth++) {
      const t = along / segments, lateral = (t - 0.5) * (halfSize * 2 + 14);
      const outward = halfSize + depth / depthSegments * 9;
      const x = Math.sin(angle) * outward + Math.cos(angle) * lateral;
      const z = Math.cos(angle) * outward - Math.sin(angle) * lateral;
      const bank = Math.sin(depth / depthSegments * Math.PI * 0.7);
      const y = -0.12 + bank * (1.6 + Math.sin(lateral * 0.18 + side) * 0.65 + Math.cos(lateral * 0.49) * 0.17);
      positions.push(x, y, z); uvs.push(x / 5, -z / 5);
      const shade = 0.7 + Math.sin(lateral * 0.13 + depth) * 0.1;
      colors.push(shade, shade, shade);
      if (along < segments && depth < depthSegments) {
        const a = offset + along * (depthSegments + 1) + depth, b = a + depthSegments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.userData.worldGroundTileSize = 5;
  return geometry;
}

export function resinColumnGeometry() {
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => new THREE.Vector3(Math.sin(i * 0.7) * 0.18, i, Math.cos(i * 0.9) * 0.16)));
  const geometry = tube(curve, t => 0.82 + (1 - t) ** 2 * 0.43 + Math.sin(t * Math.PI * 11) * 0.045, 20, 14);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) position.setY(i, position.getY(i) - 4);
  geometry.computeVertexNormals();
  return geometry;
}

export function erodedObeliskGeometry() {
  const positions = [], uvs = [], indices = [];
  for (let row = 0; row <= 8; row++) {
    const t = row / 8, half = THREE.MathUtils.lerp(1.48, 0.7, t), clip = 0.15 - t * 0.07;
    const cross = [[-half + clip, -half], [half - clip, -half], [half, -half + clip], [half, half - clip], [half - clip, half], [-half + clip, half], [-half, half - clip], [-half, -half + clip]];
    for (let corner = 0; corner <= 8; corner++) {
      const [x, z] = cross[corner % 8];
      const wear = Math.sin(row * 1.7 + corner * 4.3) * 0.013;
      positions.push(x + wear, (t - 0.5) * 8.5, z + wear); uvs.push(corner / 8, t);
      if (row < 8 && corner < 8) {
        const a = row * 9 + corner, b = a + 9;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const bottomCenter = positions.length / 3;
  positions.push(0, -4.25, 0); uvs.push(0.5, 0.5);
  const topCenter = positions.length / 3;
  positions.push(0, 4.25, 0); uvs.push(0.5, 0.5);
  for (let corner = 0; corner < 8; corner++) {
    indices.push(bottomCenter, corner, corner + 1);
    indices.push(topCenter, 8 * 9 + corner + 1, 8 * 9 + corner);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.rotateY(-Math.PI / 4);
  return geometry;
}

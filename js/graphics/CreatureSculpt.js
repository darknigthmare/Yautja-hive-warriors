/* Continuous lofted anatomy. The radial profiles define muscle, bone and shell
   instead of piling spheres and cylinders into a toy-like silhouette. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = point => new THREE.Vector3(...point);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let tessellation = 1;
const segments = (count, minimum = 4) => tessellation === 1 ? count : Math.max(minimum, Math.round(count * tessellation));

function sweep(sections, rows = 56, radial = 24, sculpt = null) {
  rows = segments(rows, 3);
  radial = segments(radial, 4);
  const path = new THREE.CatmullRomCurve3(sections.map(section => V(section.slice(0, 3))), false, 'catmullrom', 0.25);
  const widths = new THREE.CatmullRomCurve3(sections.map(section => new THREE.Vector3(section[3], section[4], 0)), false, 'catmullrom', 0.25);
  const positions = [], uvs = [], indices = [];
  const axis = new THREE.Vector3(), tangent = new THREE.Vector3(), cross = new THREE.Vector3(), p = new THREE.Vector3();
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const center = path.getPoint(t), size = widths.getPoint(t);
    tangent.copy(path.getTangent(t)).normalize();
    axis.set(1, 0, 0).addScaledVector(tangent, -tangent.x);
    if (axis.lengthSq() < 0.001) axis.set(0, 0, 1).addScaledVector(tangent, -tangent.z);
    axis.normalize(); cross.crossVectors(axis, tangent).normalize();
    for (let column = 0; column <= radial; column++) {
      const angle = column / radial * Math.PI * 2;
      p.copy(center).addScaledVector(axis, Math.sin(angle) * Math.max(0.001, size.x))
        .addScaledVector(cross, Math.cos(angle) * Math.max(0.001, size.y));
      if (sculpt) sculpt(p, center, t, angle);
      positions.push(p.x, p.y, p.z); uvs.push(column / radial, t);
      if (row < rows && column < radial) {
        const a = row * (radial + 1) + column, b = a + radial + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function tendon(points, radius = 0.025, rows = 20, radial = 8, groove = 0) {
  return sweep(points.map((p, i) => [...p, radius * (i === 0 || i === points.length - 1 ? 0.42 : 1), radius * (i === 0 || i === points.length - 1 ? 0.42 : 1)]), rows, radial,
    groove ? (p, c, t) => { const f = 1 + Math.sin(t * Math.PI * 38) * groove; p.sub(c).multiplyScalar(f).add(c); } : null);
}

function merged(inputs) {
  const indexed = inputs.every(geometry => Boolean(geometry.index));
  const flattened = indexed ? inputs : inputs.map(geometry => geometry.index ? geometry.toNonIndexed() : geometry);
  const geometry = mergeGeometries(flattened);
  inputs.forEach(g => g.dispose());
  flattened.forEach((g, i) => { if (g !== inputs[i]) g.dispose(); });
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

function fanCrown(y, width, length, queen) {
  const cols = segments(queen ? 68 : 44, 8), rows = segments(queen ? 58 : 40, 8);
  const positions = [], uvs = [], indices = [];
  for (let surface = 0; surface < 2; surface++) {
    for (let row = 0; row <= rows; row++) {
      const v = row / rows;
      for (let col = 0; col <= cols; col++) {
        const u = col / cols * 2 - 1;
        const lateral = 0.18 * (1 - v) + Math.pow(Math.sin(v * Math.PI), 0.72) * width;
        const x = u * lateral;
        const outline = Math.pow(Math.abs(u), 8) * Math.sin(v * Math.PI * 12) * 0.015;
        const ridges = Math.pow(Math.max(0, Math.cos(u * Math.PI * 9)), 6) * Math.sin(v * Math.PI) * 0.07;
        const z = -0.35 - v * length;
        const arch = Math.sin(v * Math.PI) * (queen ? 0.75 : 0.4) + v * 0.3 - u * u * 0.24 + outline;
        const thickness = 0.11 + Math.sin(v * Math.PI) * (1 - u * u) * 0.1;
        positions.push(x, y + arch + (surface ? -thickness : thickness + ridges), z);
        uvs.push(col / cols, v);
        if (row < rows && col < cols) {
          const a = surface * (rows + 1) * (cols + 1) + row * (cols + 1) + col, b = a + cols + 1;
          if (surface) indices.push(a, b, a + 1, b, b + 1, a + 1);
          else indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
  }
  // Join the thin outer rim so the crown has volume from below and behind.
  const offset = (rows + 1) * (cols + 1);
  for (let col = 0; col < cols; col++) for (const row of [0, rows]) {
    const a = row * (cols + 1) + col; indices.push(a, a + offset, a + 1, a + offset, a + offset + 1, a + 1);
  }
  for (let row = 0; row < rows; row++) for (const col of [0, cols]) {
    const a = row * (cols + 1) + col, b = a + cols + 1; indices.push(a, b, a + offset, b, b + offset, a + offset);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function tooth(a, b, width = 0.02, detail = 1) {
  const mid = V(a).lerp(V(b), 0.5).toArray();
  return sweep([[...a, width, width * 0.8], [...mid, width * 0.68, width * 0.55], [...b, 0.001, 0.001]], detail > 1 ? 12 : 8, detail > 1 ? 10 : 7);
}

// Generation is synchronous. Restore the previous density even when a malformed
// profile fails, so a later high-detail model always keeps its exact tessellation.
export function sculptCreature(kind, detail = 1) {
  const previous = tessellation;
  tessellation = Number.isFinite(detail) ? clamp(detail, 0.15, 1) : 1;
  try { return buildCreatureSculpt(kind); }
  finally { tessellation = previous; }
}

function buildCreatureSculpt(kind) {
  const queen = ['queen', 'empress', 'imperial', 'predalien'].includes(kind);
  const offspring = kind === 'offspring';
  const boss = queen || offspring;
  const pale = ['offspring', 'neomorph', 'facehugger', 'chestburster'].includes(kind);
  const quadruped = ['runner', 'crusher'].includes(kind);
  const crusher = kind === 'crusher';
  const parts = [], core = [], ridges = [], jaw = [], head = [], tail = [], dark = [];
  const rows = boss ? 100 : 72, radial = boss ? 44 : 32;
  const add = (name, inputs, material, pivot = [0, 0, 0]) => {
    if (!inputs.length) return;
    const geometry = merged(inputs);
    geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
    parts.push({ name, geometry, material, pivot });
  };
  const features = { continuousCore: true, sweptSkull: true, digitigrade: !offspring && !quadruped,
    crown: queen || ['praetorian', 'officer', 'crusher'].includes(kind), crownTopology: 'single-fan', adultProportions: true };

  if (kind === 'egg') {
    core.push(sweep([[0, 0, 0, 0.18, 0.18], [0, 0.2, 0, 0.62, 0.62], [0, 0.75, 0, 0.75, 0.75], [0, 1.3, 0, 0.66, 0.66], [0, 1.7, 0, 0.47, 0.47], [0, 1.92, 0, 0.12, 0.12]], 80, 48,
      (p, c, t, a) => { const f = 1 + Math.sin(a * 8 + Math.sin(t * 7) * 0.4) * 0.026; p.x *= f; p.z *= f; }));
    for (let fold = 0; fold < 12; fold++) {
      const a = fold / 12 * Math.PI * 2;
      ridges.push(tendon([[Math.cos(a) * 0.45, 0.08, Math.sin(a) * 0.45], [Math.cos(a) * 0.72, 0.65, Math.sin(a) * 0.72], [Math.cos(a) * 0.62, 1.3, Math.sin(a) * 0.62], [Math.cos(a) * 0.2, 1.86, Math.sin(a) * 0.2]], 0.018, 22, 6));
    }
    for (let petal = 0; petal < 4; petal++) {
      const a = petal / 4 * Math.PI * 2;
      const samples = [[0.43, 1.53, 0.13], [0.38, 1.73, 0.17], [0.2, 1.94, 0.14], [0.07, 2.04, 0.001]].map(([r, y, w]) => [Math.cos(a) * r, y, Math.sin(a) * r, w, w * 0.5]);
      add(`petal-${petal}`, [sweep(samples, 28, 16)], 'flesh', [Math.cos(a) * 0.4, 1.53, Math.sin(a) * 0.4]);
    }
  } else if (kind === 'facehugger' || kind === 'chestburster') {
    const face = kind === 'facehugger';
    core.push(sweep(face ? [[0, 0.17, -0.52, 0.03, 0.025], [0, 0.23, -0.3, 0.24, 0.1], [0, 0.22, 0.1, 0.29, 0.12], [0, 0.18, 0.4, 0.17, 0.08], [0, 0.17, 0.5, 0.01, 0.01]]
      : [[0.3, 0.09, -0.9, 0.005, 0.005], [0.12, 0.13, -0.6, 0.09, 0.1], [0, 0.25, -0.1, 0.14, 0.14], [0, 0.34, 0.3, 0.18, 0.19], [0, 0.33, 0.65, 0.1, 0.1], [0, 0.32, 0.7, 0.01, 0.01]], 64, 28,
      (p, c, t) => { const f = 1 + Math.sin(t * Math.PI * 42) * 0.015; p.sub(c).multiplyScalar(f).add(c); }));
    if (face) {
      for (const side of [-1, 1]) for (let finger = 0; finger < 4; finger++) {
        const z = -0.32 + finger * 0.2, length = 0.68 + Math.sin(finger * Math.PI / 3) * 0.1;
        core.push(sweep([[side * 0.18, 0.2, z, 0.045, 0.04], [side * 0.46, 0.41, z - 0.04, 0.043, 0.034], [side * length, 0.2, z + 0.12, 0.027, 0.022], [side * (length - 0.04), 0.03, z + 0.34, 0.009, 0.007]], 24, 10,
          (p, c, t) => { const f = 1 + Math.cos(t * Math.PI * 14) * 0.08; p.sub(c).multiplyScalar(f).add(c); }));
      }
      tail.push(sweep([[0, 0.18, -0.4, 0.07, 0.055], [0.1, 0.23, -0.8, 0.055, 0.045], [0.38, 0.14, -1.3, 0.04, 0.035], [0.72, 0.14, -1.5, 0.025, 0.02], [0.88, 0.35, -1.24, 0.001, 0.001]], 64, 12));
    } else {
      for (const side of [-1, 1]) core.push(tendon([[side * 0.07, 0.3, 0.11], [side * 0.25, 0.18, 0.22], [side * 0.28, 0.05, 0.41]], 0.023, 16, 8));
      for (let n = 0; n < 8; n++) jaw.push(tooth([(n - 3.5) * 0.022, 0.32, 0.66], [(n - 3.5) * 0.019, 0.27, 0.72], 0.013));
    }
  } else {
    const crown = features.crown;
    const hipY = quadruped ? (crusher ? 1.32 : 1.06) : offspring ? 2.03 : queen ? 1.93 : 1.84;
    const chestY = quadruped ? (crusher ? 1.88 : 1.48) : offspring ? 3.0 : queen ? 3.25 : 2.86;
    const headY = quadruped ? (crusher ? 2.15 : 1.88) : offspring ? 4.15 : queen ? 4.01 : 3.66;
    const chestW = crusher ? 0.86 : queen ? 0.59 : offspring ? 0.4 : 0.38;
    const chestD = crusher ? 0.55 : queen ? 0.43 : 0.31;
    const sections = quadruped ? [[0, hipY - 0.16, -0.95, 0.12, 0.12], [0, hipY, -0.72, 0.42, 0.34], [0, chestY - 0.12, -0.2, chestW, chestD], [0, chestY, 0.38, chestW * 0.95, chestD], [0, headY - 0.18, 0.72, 0.2, 0.2]]
      : [[0, hipY - 0.27, -0.1, 0.05, 0.07], [0, hipY, -0.06, offspring ? 0.27 : 0.31, 0.24], [0, hipY + 0.22, -0.06, 0.24, 0.2], [0, hipY + 0.48, -0.11, offspring ? 0.19 : 0.21, 0.18],
        [0, chestY - 0.3, -0.04, chestW * 0.83, chestD * 0.88], [0, chestY, -0.01, chestW, chestD], [0, chestY + 0.19, -0.035, chestW * 1.01, chestD * 0.91],
        [0, chestY + 0.3, -0.045, chestW * 0.72, 0.225], [0, headY - 0.27, 0.045, offspring ? 0.11 : 0.135, 0.145], [0, headY - 0.07, 0.11, 0.14, 0.145]];
    core.push(sweep(sections, rows, radial, (p, c, t, a) => {
      const chestMask = Math.max(0, 1 - Math.abs(p.y - chestY) / 0.55);
      const front = Math.max(0, Math.cos(a));
      const grooves = Math.pow(Math.max(0, Math.cos((p.y - chestY) * 58 + Math.sin(a) * 1.4)), 6) * 0.014 * chestMask;
      p.z += (grooves - Math.exp(-p.x * p.x * 400) * 0.015 * chestMask) * front;
      p.x *= 1 + Math.sin(a * 6 + p.y * 5) * 0.009;
    }));
    if (offspring) {
      head.push(sweep([[0, 3.69, 0.17, 0.04, 0.05], [0, 3.76, 0.21, 0.12, 0.14], [0, 3.9, 0.17, 0.195, 0.21], [0, 4.08, 0.13, 0.215, 0.2], [0, 4.27, 0.09, 0.195, 0.17], [0, 4.43, 0.05, 0.11, 0.11], [0, 4.49, 0.04, 0.002, 0.002]], 96, 48,
        (p, c, t, a) => { if (p.z > c.z) { p.z += Math.exp(-p.x * p.x * 650) * Math.exp(-Math.pow((p.y - 3.99) * 6, 2)) * 0.065; } }));
      for (const side of [-1, 1]) {
        dark.push(sweep([[side * 0.13, 4.025, 0.3, 0.001, 0.001], [side * 0.13, 4.05, 0.32, 0.065, 0.017], [side * 0.13, 4.075, 0.31, 0.001, 0.001]], 20, 16));
      }
      dark.push(tendon([[-0.095, 3.82, 0.36], [0, 3.8, 0.38], [0.095, 3.82, 0.36]], 0.022, 24, 10));
    } else {
      // Narrow, low cranial roof, longer in profile than in section. The front
      // slopes down to the face rather than becoming a sphere perched on a neck.
      const frontZ = quadruped ? 1.46 : 0.75;
      const rearZ = quadruped ? -0.5 : -0.85;
      head.push(sweep([[0, headY - 0.04, rearZ - 0.18, 0.002, 0.002], [0, headY + 0.02, rearZ, 0.17, 0.12], [0, headY + 0.09, rearZ + 0.35, 0.27, 0.19],
        [0, headY + 0.08, frontZ - 0.65, crusher ? 0.48 : queen ? 0.33 : 0.295, crusher ? 0.27 : 0.21], [0, headY, frontZ - 0.25, queen ? 0.32 : 0.265, 0.17],
        [0, headY - 0.12, frontZ, 0.16, 0.1], [0, headY - 0.18, frontZ + 0.05, 0.005, 0.005]], boss ? 110 : 88, boss ? 52 : 36,
        (p, c, t, a) => { const groove = Math.sin(t * Math.PI * 12 + a * 6) * 0.003; p.sub(c).multiplyScalar(1 + groove).add(c); }));
      const mouthZ = frontZ - 0.01, mouthY = headY - 0.18;
      head.push(sweep([[-0.2, mouthY, mouthZ - 0.12, 0.012, 0.012], [-0.15, mouthY - 0.06, mouthZ + 0.08, 0.032, 0.032], [0, mouthY - 0.075, mouthZ + 0.14, 0.035, 0.032], [0.15, mouthY - 0.06, mouthZ + 0.08, 0.032, 0.032], [0.2, mouthY, mouthZ - 0.12, 0.012, 0.012]], 40, 12));
      dark.push(sweep([[-0.19, mouthY + 0.03, mouthZ, 0.006, 0.006], [-0.12, mouthY, mouthZ + 0.12, 0.035, 0.035], [0, mouthY + 0.005, mouthZ + 0.17, 0.04, 0.04], [0.12, mouthY, mouthZ + 0.12, 0.035, 0.035], [0.19, mouthY + 0.03, mouthZ, 0.006, 0.006]], 36, 10));
      for (let t = 0; t < 8; t++) {
        const x = (t - 3.5) * 0.037, recess = Math.abs(x) * 0.22;
        jaw.push(tooth([x, mouthY + 0.015 + recess, mouthZ + 0.16], [x * 0.97, mouthY - 0.027, mouthZ + 0.18], 0.01, boss ? 2 : 1));
        jaw.push(tooth([x, mouthY - 0.06 + recess, mouthZ + 0.14], [x, mouthY - 0.03, mouthZ + 0.17], 0.009, boss ? 2 : 1));
      }
      // Neck tendons meet the skull tangentially and pull back into the shoulders.
      for (const side of [-1, 1]) ridges.push(tendon([[side * 0.31, chestY + 0.08, -0.19], [side * 0.18, headY - 0.36, -0.16], [side * 0.12, headY - 0.08, -0.08]], 0.034, boss ? 36 : 24, 8));
    }
    // Thin structural ribs follow the thoracic section and are partially embedded
    // in its surface, avoiding the oversized horizontal pipe/hoop appearance.
    const sectionAt = y => {
      let lower = sections[0], upper = sections.at(-1);
      for (let i = 1; i < sections.length; i++) if (sections[i][1] >= y) { lower = sections[i - 1]; upper = sections[i]; break; }
      const t = clamp((y - lower[1]) / Math.max(0.001, upper[1] - lower[1]), 0, 1);
      return { z: THREE.MathUtils.lerp(lower[2], upper[2], t), w: THREE.MathUtils.lerp(lower[3], upper[3], t), d: THREE.MathUtils.lerp(lower[4], upper[4], t) };
    };
    const ribs = queen ? 9 : offspring ? 8 : 7;
    for (let rib = 0; rib < ribs; rib++) for (const side of [-1, 1]) {
      const y = chestY + 0.17 - rib * (queen ? 0.105 : 0.095);
      const surface = sectionAt(y);
      const points = [];
      for (let n = 0; n <= 7; n++) {
        const a = n / 7 * Math.PI;
        points.push([side * Math.sin(a) * (surface.w + 0.025), y + Math.sin(a) * 0.035, Math.cos(a) * (surface.d + 0.035) + surface.z]);
      }
      ridges.push(tendon(points, offspring ? 0.02 : 0.027, boss ? 30 : 22, boss ? 10 : 8));
    }
    const sternum = [chestY - 0.52, chestY - 0.27, chestY + 0.05, chestY + 0.22].map((y, i) => {
      const surface = sectionAt(y);
      return [0, y, surface.z + surface.d + 0.04, [0.01, 0.028, 0.026, 0.012][i], 0.018];
    });
    ridges.push(sweep(sternum, boss ? 48 : 36, boss ? 10 : 8));
    ridges.push(tendon([[0, hipY, -0.28], [0, hipY + 0.55, -0.25], [0, chestY, -chestD], [0, chestY + 0.35, -0.19]], 0.037, boss ? 56 : 40, 10, 0.16));
    if (!pale) for (const side of [-1, 1]) for (let pipe = 0; pipe < (queen ? 3 : 2); pipe++) {
      const y = chestY - 0.12 + pipe * 0.22, x = side * (0.23 + pipe * 0.055);
      ridges.push(sweep([[x, y, -chestD * 0.8, 0.04, 0.04], [x * 1.6, y + 0.21, -0.52, 0.065, 0.06], [x * 1.7, y + 0.56, -0.79, 0.08, 0.07], [x * 1.3, y + 0.74, -0.83, 0.07, 0.06]], boss ? 36 : 28, 10,
        (p, c, t) => { const f = 1 + Math.sin(t * Math.PI * 27) * 0.06; p.sub(c).multiplyScalar(f).add(c); }));
    }

    for (const side of [-1, 1]) {
      const leg = [], arm = [];
      const hip = [side * (crusher ? 0.64 : 0.24), hipY, quadruped ? -0.65 : -0.08];
      const knee = [side * (crusher ? 0.93 : 0.37), quadruped ? hipY * 0.55 : hipY * 0.61, quadruped ? -0.38 : 0.17];
      const hock = [side * (crusher ? 0.9 : 0.36), 0.46, quadruped ? -0.86 : offspring ? 0.02 : -0.29];
      const ankle = [side * (crusher ? 0.98 : 0.36), 0.15, quadruped ? -0.75 : -0.1];
      leg.push(sweep([[...hip, 0.14, 0.17], [side * (crusher ? 0.79 : 0.31), hipY - 0.27, quadruped ? -0.62 : -0.06, offspring ? 0.13 : 0.17, 0.17], [...knee, 0.11, 0.13],
        [knee[0], knee[1] - 0.2, knee[2] - 0.1, 0.13, 0.12], [...hock, 0.075, 0.095], [...ankle, 0.065, 0.08]], boss ? 80 : 64, boss ? 28 : 22,
        (p, c, t, a) => { p.z += Math.max(0, Math.cos(a)) * Math.sin(t * Math.PI * 6) * 0.009; }));
      for (let toe = 0; toe < 3; toe++) {
        const x = ankle[0] + (toe - 1) * 0.085;
        leg.push(sweep([[x, 0.15, ankle[2], 0.045, 0.05], [x + side * 0.015, 0.075, ankle[2] + 0.19, 0.04, 0.035], [x, 0.055, ankle[2] + 0.39, 0.008, 0.008]], boss ? 24 : 16, 8));
      }
      add(side < 0 ? 'leg-left' : 'leg-right', leg, 'body', hip);
      const shoulder = [side * (crusher ? 0.76 : chestW * 1.05), chestY + 0.12, quadruped ? 0.38 : 0];
      const elbow = [side * (crusher ? 1.01 : offspring ? 0.62 : 0.68), quadruped ? 0.92 : chestY - (queen ? 0.67 : 0.52), quadruped ? 0.54 : 0.07];
      const wrist = [side * (crusher ? 1.02 : offspring ? 0.7 : 0.72), quadruped ? 0.18 : hipY - 0.05, quadruped ? 0.92 : 0.22];
      arm.push(sweep([[...shoulder, 0.13, 0.14], [side * (crusher ? 0.92 : chestW * 1.42), shoulder[1] - 0.22, shoulder[2] + 0.025, offspring ? 0.1 : 0.14, 0.13],
        [...elbow, 0.075, 0.085], [elbow[0] * 1.03, elbow[1] - 0.17, elbow[2] + 0.04, 0.105, 0.09], [...wrist, 0.055, 0.075]], boss ? 76 : 56, boss ? 26 : 20));
      const hand = [wrist[0], wrist[1] - (quadruped ? 0.04 : 0.12), wrist[2] + 0.07];
      arm.push(sweep([[...wrist, 0.06, 0.04], [...hand, 0.095, 0.045], [hand[0], hand[1] - 0.07, hand[2] + 0.045, 0.06, 0.03]], 24, 14));
      for (let finger = 0; finger < 4; finger++) {
        const x = hand[0] + (finger - 1.5) * 0.052;
        const length = 0.22 + Math.sin(finger / 3 * Math.PI) * 0.065;
        arm.push(sweep([[x, hand[1] - 0.035, hand[2], 0.022, 0.019], [x + side * 0.016, quadruped ? 0.08 : hand[1] - length * 0.6, hand[2] + 0.12, 0.02, 0.016],
          [x + side * 0.012, quadruped ? 0.045 : hand[1] - length, hand[2] + 0.17, 0.013, 0.012], [x, quadruped ? 0.035 : hand[1] - length - 0.045, hand[2] + 0.24, 0.001, 0.001]], boss ? 26 : 18, 8,
          (p, c, t) => { const f = 1 + Math.sin(t * Math.PI * 8) * 0.05; p.sub(c).multiplyScalar(f).add(c); }));
      }
      add(side < 0 ? 'arm-left' : 'arm-right', arm, 'body', shoulder);
    }
    tail.push(sweep([[0, hipY - 0.08, -0.23, 0.105, 0.12], [0.08, hipY - 0.3, -0.76, 0.1, 0.105], [0.24, hipY - 0.65, -1.4, 0.075, 0.075], [0.7, 0.75, -2.1, 0.06, 0.06], [1.2, 1.06, -2.75, 0.04, 0.04], [1.1, 1.6, -3.15, 0.018, 0.018]], boss ? 144 : 104, boss ? 20 : 14,
      (p, c, t) => { const f = 1 + Math.pow(Math.max(0, Math.cos(t * Math.PI * 72)), 4) * 0.12; p.sub(c).multiplyScalar(f).add(c); }));
    tail.push(sweep([[1.1, 1.6, -3.15, 0.065, 0.025], [1.03, 1.79, -3.36, 0.07, 0.02], [0.92, 1.94, -3.57, 0.001, 0.001]], 24, 12));
    if (crown) {
      const width = queen ? 1.9 : crusher ? 0.85 : 0.74;
      ridges.push(fanCrown(headY + 0.12, width, queen ? 1.5 : 1.05, queen));
      if (queen) core.push(sweep([[0, headY - 0.17, -0.26, 0.14, 0.14], [0, headY + 0.01, -0.4, 0.24, 0.19], [0, headY + 0.12, -0.53, 0.17, 0.14]], 24, 12));
    }
    if (queen) for (const side of [-1, 1]) {
      const smallArms = [];
      smallArms.push(sweep([[side * 0.2, chestY - 0.15, 0.34, 0.055, 0.055], [side * 0.38, chestY - 0.47, 0.52, 0.04, 0.04], [side * 0.31, chestY - 0.66, 0.75, 0.025, 0.025]], 32, 12));
      for (let finger = 0; finger < 3; finger++) smallArms.push(tendon([[side * 0.31 + (finger - 1) * 0.04, chestY - 0.66, 0.75], [side * 0.35 + (finger - 1) * 0.04, chestY - 0.81, 0.82]], 0.014, 12, 6));
      ridges.push(merged(smallArms));
    }
    if (kind === 'predalien') {
      for (const side of [-1, 1]) for (const row of [-1, 1]) jaw.push(sweep([[side * 0.17, headY - 0.18, 0.67, 0.045, 0.045], [side * 0.35, headY - 0.2 + row * 0.12, 0.85, 0.055, 0.045], [side * 0.3, headY - 0.2 + row * 0.22, 1.04, 0.03, 0.025], [side * 0.18, headY - 0.17 + row * 0.15, 1.1, 0.001, 0.001]], 24, 10));
      for (let dread = 0; dread < 11; dread++) {
        const a = dread / 10 * Math.PI;
        ridges.push(tendon([[Math.cos(a) * 0.3, headY - 0.1, -0.5], [Math.cos(a) * 0.5, headY - 0.4, -0.88], [Math.cos(a) * 0.55, headY - 0.85, -1.04], [Math.cos(a) * 0.62, headY - 1.2, -0.93]], 0.043, 24, 8, 0.08));
      }
    }
    if (kind === 'grid') for (let scar = 0; scar < 8; scar++) ridges.push(tendon([[-0.24, headY + 0.035, -0.62 + scar * 0.17], [0, headY + 0.28, -0.62 + scar * 0.17], [0.24, headY + 0.035, -0.62 + scar * 0.17]], 0.009, 14, 6));
    if (kind === 'empress') for (const side of [-1, 1]) {
      const wing = [];
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.bezierCurveTo(side * 0.7, 1.1, side * 2.5, 1.8, side * 3.2, 1.2);
      shape.bezierCurveTo(side * 2.4, 0.9, side * 2.3, 0.3, side * 2.4, -0.25);
      shape.bezierCurveTo(side * 1.7, 0.2, side * 1.5, 0.1, side * 1.3, -0.55);
      shape.bezierCurveTo(side * 0.8, -0.1, side * 0.4, -0.15, 0, -0.65); shape.lineTo(0, 0);
      const membrane = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false, curveSegments: segments(32, 8) }); membrane.translate(side * 0.42, chestY + 0.2, -0.4); wing.push(membrane);
      for (let vein = 0; vein < 5; vein++) wing.push(tendon([[side * 0.42, chestY + 0.2, -0.4], [side * (1 + vein * 0.3), chestY + 0.7 + vein * 0.1, -0.37], [side * (1.5 + vein * 0.4), chestY + 0.1 + vein * 0.15, -0.4]], 0.025, 32, 8));
      add(side < 0 ? 'wing-left' : 'wing-right', wing, 'ridges', [side * 0.42, chestY + 0.2, -0.4]);
    }
    if (kind === 'spitter' || kind === 'boiler') {
      const glands = [];
      for (let gland = 0; gland < (kind === 'boiler' ? 7 : 4); gland++) {
        const a = gland * Math.PI * 0.73, x = Math.cos(a) * 0.27, z = Math.sin(a) * 0.21;
        glands.push(sweep([[x, chestY - 0.1, z, 0.001, 0.001], [x, chestY + 0.03, z, 0.1, 0.1], [x, chestY + 0.15, z, 0.001, 0.001]], 24, 16));
      }
      add(kind === 'boiler' ? 'boil' : 'acid-glands', glands, 'gland');
    }
  }
  add('carapace', core, 'body'); add('cranium', head, 'skull'); add('ribs-and-tubes', ridges, 'ridges');
  add('teeth-and-claws', jaw, 'tooth'); add('mouth-cavities', dark, 'dark'); add('tail', tail, 'body', [0, 1.5, -0.3]);
  const scale = ({ queen: 1.85, imperial: 2.15, empress: 1.95, predalien: 1.85, offspring: 2.05,
    praetorian: 1.17, officer: 1.08, crusher: 1.38, runner: 1.2 })[kind] || 1;
  return { parts, scale, features };
}

/* Sector-sized landmarks and corridor dressing. The combat floor remains Y0.
 * Static details merge by material, belong to EnvironmentManager and cull with
 * their sector. These are local set designs, not scans of film locations. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { beveledBlockGeometry } from './EnvironmentDetails.js';

const COLORS = {
  forest: [0x665d46, 0x56645b, 0xe3ba74], jungle: [0x77775b, 0x6b7151, 0xd8bc76],
  hive: [0x554852, 0x827481, 0xb5cba1], temple: [0x777c70, 0xa7a68b, 0xc9d1a7],
  rooftop: [0x626a69, 0x969e96, 0xf2bf78], station: [0x646e6b, 0xa5aaa0, 0xf4c288]
};
const SPOTS = [[25, 25], [29, 25], [25, 29], [32, 32], [35, 26], [26, 35], [36, 32], [32, 36]];
const QUADRANTS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

function footprintDistance(x, z, collider) {
  const dx = x - collider.x, dz = z - collider.z;
  if (collider.halfWidth == null) return Math.hypot(dx, dz) - (collider.radius ?? 0);
  const c = Math.cos(collider.rotation ?? 0), s = Math.sin(collider.rotation ?? 0);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.hypot(lx - THREE.MathUtils.clamp(lx, -collider.halfWidth, collider.halfWidth), lz - THREE.MathUtils.clamp(lz, -collider.halfDepth, collider.halfDepth));
}

function chooseSite(env, sector, radius, used, quadrant) {
  const [cx, cz] = sector.center;
  const [sx, sz] = QUADRANTS[quadrant];
  for (const [offsetX, offsetZ] of SPOTS) {
    const x = offsetX * sx, z = offsetZ * sz;
    if (Math.abs(x) - radius < 11 || Math.abs(z) - radius < 11) continue;
    if (Math.hypot(cx + x - sector.objective.position[0], cz + z - sector.objective.position[1]) < radius + 10) continue;
    if (used.some(site => Math.hypot(site.x - x, site.z - z) < site.radius + radius + 3)) continue;
    if (env.colliders.some(collider => footprintDistance(cx + x, cz + z, collider) < radius + 1)) continue;
    const result = { x, z, radius, scale: 1.2, quadrant }; used.push(result); return result;
  }
  return null;
}

function builder(env, parent, name, center, yaw = 0) {
  const type = env.type ?? 'forest', organic = type === 'forest' || type === 'jungle';
  const palette = COLORS[type] ?? COLORS.forest;
  const group = new THREE.Group(); group.name = name; group.position.set(center[0], 0, center[1]); group.rotation.y = yaw;
  parent.add(group); group.userData.environmentDetail = true;
  const material = (key, options) => env.material(`sector-set-${type}-${key}`, options);
  const mats = {
    structure: material('structure', { color: palette[0], roughness: organic || type === 'temple' ? 0.91 : 0.76, metalness: organic || type === 'temple' ? 0.04 : 0.24, surface: organic ? (type === 'jungle' ? 'stone' : 'bark') : type === 'temple' ? 'stone' : type === 'hive' ? 'chitin' : 'armor' }),
    edge: material('edge', { color: palette[1], roughness: 0.67, metalness: type === 'temple' ? 0.12 : 0.56, surface: type === 'temple' ? 'stone' : 'metal' }),
    dark: material('recess', { color: type === 'hive' ? 0x25232b : 0x252c29, roughness: 0.84, metalness: 0.15, surface: type === 'hive' ? 'chitin' : 'metal' }),
    signal: material('signal', { color: palette[2], emissive: palette[2], emissiveIntensity: 0.45, roughness: 0.55, metalness: 0.15, surface: 'metal' }),
    canvas: material('canvas', { color: 0x4b594b, roughness: 0.98, metalness: 0, surface: 'fabric' }),
    resin: material('resin', { color: 0x3e3941, roughness: 0.47, metalness: 0.14, surface: 'chitin' })
  };
  const shapes = {
    block: env.geometry('sector-set-beveled-block', beveledBlockGeometry),
    flat: env.geometry('sector-set-flat-block', () => new THREE.BoxGeometry(1, 1, 1)),
    cylinder: env.geometry('sector-set-cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 16)),
    sphere: env.geometry('sector-set-organic-node', () => new THREE.SphereGeometry(1, 16, 10))
  };
  const batches = new Map(), transform = new THREE.Matrix4(), local = new THREE.Matrix4(), feature = new THREE.Matrix4(), q = new THREE.Quaternion();
  let featureYaw = 0, featureScale = 1, pieceCount = 0, colliderCount = 0;
  const worldCenter = new THREE.Vector3(center[0], 0, center[1]), worldQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const add = (shape, mat, position, scale = [1, 1, 1], rotation = [0, 0, 0]) => {
    q.setFromEuler(new THREE.Euler(...rotation));
    local.compose(new THREE.Vector3(...position), q, new THREE.Vector3(...scale)); transform.multiplyMatrices(feature, local);
    const prepared = shape.index ? shape.toNonIndexed() : shape.clone(); prepared.applyMatrix4(transform);
    // Texel density follows physical dimensions instead of one texture stretched
    // over the entire building. UV seams stay on individual modelled panels.
    const p = prepared.attributes.position, n = prepared.attributes.normal, uv = prepared.attributes.uv;
    for (let vertex = 0; vertex < p.count; vertex++) {
      if (Math.abs(n.getY(vertex)) > 0.65) uv.setXY(vertex, p.getX(vertex) / 3, p.getZ(vertex) / 3);
      else if (Math.abs(n.getX(vertex)) > 0.65) uv.setXY(vertex, p.getZ(vertex) / 3, p.getY(vertex) / 3);
      else uv.setXY(vertex, p.getX(vertex) / 3, p.getY(vertex) / 3);
    }
    const pieces = batches.get(mat) ?? []; pieces.push(prepared); batches.set(mat, pieces); pieceCount++;
  };
  const solid = (position, size, rotation = 0) => {
    const point = new THREE.Vector3(...position).applyMatrix4(feature).applyQuaternion(worldQ).add(worldCenter);
    env.addBoxCollider(point.x, point.z, size[0] * featureScale / 2, size[2] * featureScale / 2, (position[1] + size[1] / 2) * featureScale, yaw + featureYaw + rotation);
    env.colliders.at(-1).owner = name; colliderCount++;
  };
  const box = (mat, p, size, rotation = [0, 0, 0], flat = false) => add(flat ? shapes.flat : shapes.block, mat, p, size, rotation);
  const solidBox = (mat, p, size, rotation = 0) => { box(mat, p, size, [0, rotation, 0]); solid(p, size, rotation); };
  const cylinder = (mat, p, scale, rotation = [0, 0, 0]) => add(shapes.cylinder, mat, p, scale, rotation);
  const sphere = (mat, p, scale) => add(shapes.sphere, mat, p, scale);
  const solidSphere = (mat, p, scale) => {
    sphere(mat, p, scale);
    const center = new THREE.Vector3(...p).applyMatrix4(feature).applyQuaternion(worldQ).add(worldCenter);
    const angle = yaw + featureYaw, cosine = Math.cos(angle), sine = Math.sin(angle);
    const a = scale[0] * featureScale, zRadius = scale[2] * featureScale, a2 = a * a, z2 = zRadius * zRadius, height = (p[1] + scale[1]) * featureScale;
    const collider = { x: center.x, z: center.z, halfWidth: a, halfDepth: zRadius, height, rotation: angle, owner: name, shape: 'ellipse',
      resolveMovement(position, radius) {
        if (position.y > height + 0.2) return position;
        const dx = position.x - center.x, dz = position.z - center.z;
        const x = dx * cosine - dz * sine, z = dx * sine + dz * cosine;
        if (Math.abs(x) > a + radius || Math.abs(z) > zRadius + radius) return position;
        const norm = x * x / a2 + z * z / z2;
        let nearestX, nearestZ, nx, nz;
        if (norm < 1) {
          const inverse = norm > 1e-12 ? 1 / Math.sqrt(norm) : 0;
          nearestX = x * inverse; nearestZ = inverse ? z * inverse : zRadius;
          nx = nearestX / a2; nz = nearestZ / z2;
        } else {
          // Nearest point on a convex ellipse. Bisection is bounded and only
          // needed near the core; it avoids its rectangular navigation margin.
          let low = 0, high = Math.max(a, zRadius) * (Math.hypot(x, z) + Math.max(a, zRadius));
          for (let iteration = 0; iteration < 32; iteration++) {
            const t = (low + high) / 2;
            const value = a2 * x * x / (t + a2) ** 2 + z2 * z * z / (t + z2) ** 2;
            if (value > 1) low = t; else high = t;
          }
          const t = (low + high) / 2;
          nearestX = a2 * x / (t + a2); nearestZ = z2 * z / (t + z2);
          nx = x - nearestX; nz = z - nearestZ;
          const distance = Math.hypot(nx, nz);
          if (distance >= radius) return position;
          if (distance < 1e-10) { nx = nearestX / a2; nz = nearestZ / z2; }
        }
        const length = Math.hypot(nx, nz);
        const resolvedX = nearestX + nx / length * radius, resolvedZ = nearestZ + nz / length * radius;
        position.x = center.x + resolvedX * cosine + resolvedZ * sine;
        position.z = center.z - resolvedX * sine + resolvedZ * cosine;
        return position;
      }
    };
    env.colliders.push(collider); colliderCount++;
  };
  const pipe = (mat, points, radius = 0.14, segments = 16) => {
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), segments, radius, 6, false);
    add(geometry, mat, [0, 0, 0]); geometry.dispose();
  };
  const scope = (site, rotation, callback) => {
    featureYaw = rotation; featureScale = site.scale ?? 1;
    feature.compose(new THREE.Vector3(site.x, 0, site.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation), new THREE.Vector3().setScalar(featureScale));
    callback(); feature.identity(); featureYaw = 0; featureScale = 1;
  };
  const finish = () => {
    let triangles = 0, drawMeshes = 0;
    for (const [mat, pieces] of batches) {
      const geometry = env.geometry(`${name}-batch-${drawMeshes}`, () => mergeGeometries(pieces, false)); pieces.forEach(piece => piece.dispose());
      const mesh = env.mesh(geometry, mat, [0, 0, 0], [1, 1, 1], group); mesh.name = `${name}-${drawMeshes++}`;
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    }
    group.userData.diagnostics = { triangles, drawMeshes, modelledPieces: pieceCount, colliders: colliderCount, floorY: 0 };
    return group;
  };
  return { group, mats, box, solid, solidBox, cylinder, sphere, solidSphere, pipe, scope, finish };
}

function hardware(b, x, z, width = 5, height = 3) {
  const m = b.mats;
  b.solidBox(m.structure, [x, height / 2, z], [width, height, 3]);
  b.box(m.dark, [x, height * 0.55, z + 1.52], [width * 0.78, height * 0.6, 0.1]);
  for (const side of [-1, 1]) b.box(m.edge, [x + side * (width / 2 - 0.24), height / 2, z + 1.59], [0.16, height * 0.84, 0.12]);
  for (let vent = 0; vent < 5; vent++) b.box(m.edge, [x - width * 0.29 + vent * width * 0.145, height * 0.6, z + 1.61], [0.14, height * 0.35, 0.12], [0, 0, 0], true);
  for (const side of [-1, 1]) for (const row of [0.2, 0.82]) b.cylinder(m.dark, [x + side * (width / 2 - 0.24), height * row, z + 1.68], [0.065, 0.035, 0.065], [Math.PI / 2, 0, 0]);
  b.box(m.signal, [x + width * 0.24, height * 0.25, z + 1.61], [0.35, 0.17, 0.12]);
  b.box(m.edge, [x, height + 0.05, z], [width + 0.25, 0.14, 3.2]);
}

function fieldShelter(b, command) {
  const m = b.mats;
  for (const side of [-1, 1]) for (const end of [-1, 1]) b.solidBox(m.structure, [side * 4.7, 3.5, end * 3.5], [0.35, 7, 0.35]);
  // The roof is an overhead visual, never a full-height collision blocking the
  // walkable space below it. Only the actual grounded posts are solid.
  for (const side of [-1, 1]) b.box(m.canvas, [side * 2.5, 7.2, 0], [5.25, 0.17, 8], [0, 0, side * 0.14]);
  b.box(m.edge, [0, 7.55, 0], [0.18, 0.18, 8.4]);
  hardware(b, command ? -1.7 : 0, -1, command ? 5.4 : 4.4, 2.5);
  for (let crate = 0; crate < 3; crate++) {
    const x = 3.2, z = -2.4 + crate * 2;
    b.solidBox(m.edge, [x, 0.8, z], [1.45, 1.6, 1.45]);
    b.box(m.dark, [x, 1.65, z], [1.54, 0.1, 1.54]);
    for (const side of [-1, 1]) b.box(m.dark, [x + side * 0.42, 0.8, z + 0.74], [0.09, 1.4, 0.06], [0, 0, 0], true);
  }
  if (command) {
    b.solidBox(m.edge, [-4, 5, -3], [0.22, 10, 0.22]);
    b.cylinder(m.dark, [-4, 9.6, -3], [1.2, 0.16, 1.2], [0.42, 0, 0]);
    b.box(m.signal, [-4, 10.2, -3], [0.28, 0.28, 0.28]);
  }
}

function stoneMonument(b, shrine) {
  const m = b.mats;
  for (const side of [-1, 1]) {
    const height = shrine ? 9 : 7;
    b.solidBox(m.structure, [side * 4.2, height / 2, -1.6], [2.5, height, 3]);
    b.box(m.edge, [side * 4.2, height + 0.17, -1.6], [3.1, 0.34, 3.6]);
    for (let row = 0; row < 5; row++) {
      b.box(m.dark, [side * 4.2, 1 + row * 1.25, -0.07], [1.8, 0.07, 0.07], [0, 0, 0], true);
      b.box(m.edge, [side * 4.2 - 0.25, 1.36 + row * 1.25, -0.02], [0.12, 0.45, 0.05], [0, 0, 0.32], true);
      b.box(m.edge, [side * 4.2 + 0.25, 1.3 + row * 1.25, -0.02], [0.36, 0.1, 0.06], [0, 0, -0.2], true);
    }
  }
  // Broken lintels preserve an opening and a readable ruin silhouette.
  for (const side of [-1, 1]) b.box(m.structure, [side * 2.9, shrine ? 9.2 : 7.2, -1.6], [4.8, 1, 3.3], [0, side * 0.05, side * -0.055]);
  b.solidBox(m.structure, [0, 0.75, 2.2], [4.4, 1.5, 2.7]);
  b.box(m.dark, [0, 1.56, 2.2], [3.9, 0.12, 2.3]);
  for (let mark = 0; mark < 6; mark++) b.box(m.signal, [-1.5 + mark * 0.6, 1.64, 2.2], [0.14, 0.035, 0.8], [0, mark % 2 ? 0.25 : -0.25, 0], true);
  for (const side of [-1, 1]) b.solidBox(m.structure, [side * 5.8, 0.7, 3.6], [1.6, 1.4, 2.2], side * 0.24);
}

function resinGrowth(b, royal) {
  const m = b.mats;
  b.solidBox(m.resin, [0, 1.1, -1.4], [5.8, 2.2, 4.8]);
  b.solidSphere(m.resin, [0, 2.8, -1.6], [3.6, 2.6, 2.6]);
  for (const side of [-1, 1]) {
    b.solidBox(m.resin, [side * 4.6, 2.4, -1.8], [1.5, 4.8, 2]);
    for (let rib = 0; rib < 4; rib++) {
      const z = -4 + rib * 1.6;
      b.pipe(m.edge, [[side * 5.2, 0.15, z], [side * 4.6, 3, z], [side * 2.9, royal ? 8.1 : 6, z - 0.3], [side * 0.9, royal ? 9 : 6.8, z - 0.8]], 0.18 + rib * 0.018, 14);
    }
  }
  for (let vent = 0; vent < 4; vent++) {
    const x = (vent - 1.5) * 1.1;
    b.cylinder(m.dark, [x, 4.9, -1.4], [0.34, 1.1, 0.34], [0.25, 0, -x * 0.08]);
    b.cylinder(m.signal, [x, 5.48, -1.26], [0.19, 0.06, 0.19], [0.25, 0, -x * 0.08]);
  }
  b.pipe(m.resin, [[-5, 0.18, 3.5], [-2.8, 0.4, 2.6], [0, 0.2, 3.4], [4.7, 0.15, 3]], 0.25, 16);
}

function machineBank(b, command) {
  const m = b.mats;
  hardware(b, -3.1, -0.9, 4.8, command ? 4.7 : 4);
  hardware(b, 3.1, -0.9, 4.8, command ? 3.6 : 5);
  for (const side of [-1, 1]) {
    b.pipe(m.edge, [[side * 5.8, 0.3, -2], [side * 6.6, 1, -2.4], [side * 6.6, 5.4, -2.4], [side * 4.2, 5.9, -2.2]], 0.22, 14);
    b.box(m.dark, [side * 4.9, 0.15, 3.5], [2.7, 0.3, 1.5]);
    for (let rung = 0; rung < 5; rung++) b.box(m.edge, [side * 4.9, 0.34, 2.95 + rung * 0.27], [2.3, 0.08, 0.09], [0, 0, 0], true);
  }
  if (command) {
    for (let panel = 0; panel < 3; panel++) {
      b.box(m.dark, [-2 + panel * 2, 3.2, 1.9], [1.6, 1.05, 0.24], [-0.18, 0, 0]);
      b.box(m.signal, [-2 + panel * 2, 3.22, 2.04], [1.3, 0.66, 0.04], [-0.18, 0, 0], true);
    }
    b.solidBox(m.structure, [0, 1.2, 2], [7, 2.4, 1.8]);
  }
}

function timberWorks(b) {
  const m = b.mats;
  for (let row = 0; row < 2; row++) for (let column = 0; column < 4 - row; column++) {
    const x = -3.6 + column * 2.1 + row * 0.9, y = 0.85 + row * 1.5;
    b.cylinder(m.structure, [x, y, -1], [0.85, 7.2, 0.85], [Math.PI / 2, 0, 0]);
    b.cylinder(m.structure, [x, y, 2.65], [0.68, 0.07, 0.68], [Math.PI / 2, 0, 0]);
  }
  b.solid([-0.45, 1.55, -1], [8.4, 3.1, 7.2]);
  // The collision box is hidden within the real solid stack, not in the clear
  // aisle or the space beneath an overhead roof.
  for (const z of [-3.5, 1.5]) b.box(m.edge, [-0.4, 1.7, z], [8.9, 0.2, 0.22]);
  b.solidBox(m.edge, [5.6, 1.1, -1.4], [1.9, 2.2, 3.6]);
}

function relaySpire(b) {
  const m = b.mats;
  hardware(b, 0, 0, 6, 3.2);
  b.solidBox(m.edge, [-3.8, 5.4, -2.4], [0.42, 10.8, 0.42]);
  for (let tier = 0; tier < 3; tier++) {
    const y = 7.3 + tier * 1.2;
    b.box(m.edge, [-3.8, y, -2.4], [3.8 - tier * 0.8, 0.14, 0.18]);
    for (const side of [-1, 1]) b.box(m.signal, [-3.8 + side * (1.7 - tier * 0.4), y, -2.4], [0.12, 0.55, 0.2]);
  }
  b.pipe(m.dark, [[-3.8, 10.3, -2.4], [-3.5, 5.4, -2.1], [-2.4, 3.3, -0.5], [0.2, 2.8, -0.5]], 0.08, 18);
}

function specimenRack(b) {
  const m = b.mats;
  for (let pod = -1; pod <= 1; pod++) {
    const x = pod * 3.5;
    b.solidBox(m.edge, [x, 0.25, -1], [2.5, 0.5, 2.5]);
    b.cylinder(m.edge, [x, 5.4, -1], [1.28, 0.2, 1.28]);
    b.cylinder(m.edge, [x, 0.65, -1], [1.28, 0.2, 1.28]);
    // Opaque containment vessels, not fake interactive eggs or extra enemies.
    b.solidSphere(m.resin, [x, 2.8, -1], [1.1, 2.5, 1.1]);
    b.box(m.signal, [x, 2.8, 0.13], [0.12, 3.2, 0.045], [0, 0, 0], true);
    for (const side of [-1, 1]) b.box(m.edge, [x + side * 1.03, 2.8, 0.06], [0.12, 4.8, 0.18]);
  }
  b.pipe(m.edge, [[-5, 0.25, -3], [-5, 5.8, -3], [0, 6.2, -3], [5, 5.8, -3], [5, 0.25, -3]], 0.2, 20);
}

function stoneWorkshop(b) {
  const m = b.mats;
  for (const side of [-1, 1]) {
    b.solidBox(m.structure, [side * 3.2, 0.9, -0.8], [3, 1.8, 7.2], side * 0.06);
    b.box(m.edge, [side * 3.2, 1.9, -0.8], [3.4, 0.25, 7.5], [0, side * 0.06, 0]);
    for (let piece = 0; piece < 4; piece++) b.box(m.dark, [side * 3.2, 2.13, -3.1 + piece * 1.5], [2.7, 0.18, 0.8], [0, side * 0.15, 0]);
    b.solidBox(m.structure, [side * 5.9, 2, -3.5], [1.8, 4, 2.2]);
    b.box(m.edge, [side * 5.9, 4.1, -3.5], [2.2, 0.2, 2.5]);
  }
  for (let mark = 0; mark < 5; mark++) b.box(m.signal, [-1.5 + mark * 0.75, 0.026, 4.4], [0.18, 0.035, 1.2], [0, (mark % 2 ? 1 : -1) * 0.22, 0], true);
}

export function buildBattlefieldSectorDetails(env, sector, parent) {
  if (!sector || !parent?.isObject3D) throw new Error('Sector details require an actual sector parent');
  if (sector.index === 0) return null; // Preserve the already detailed insertion zone.
  const name = `battlefield-sector-architecture-${sector.id}`;
  const existing = parent.getObjectByName(name); if (existing) return existing;
  const b = builder(env, parent, name, sector.center), sites = [];
  for (let quadrant = 0; quadrant < 4; quadrant++) chooseSite(env, sector, 11, sites, quadrant);
  const type = env.type, role = sector.id;
  for (const site of sites) b.scope(site, Math.atan2(-site.x, -site.z), () => {
    const primary = site.quadrant % 2 === 0;
    // Thin site pads establish a readable inhabited footprint. Their top stays
    // below the existing foot clearance; they do not introduce a raised floor.
    b.box(b.mats.dark, [0, 0.0015, 0], [17, 0.003, 14], [0, 0, 0], true);
    for (const side of [-1, 1]) b.box(b.mats.edge, [side * 8.35, 0.003, 0], [0.07, 0.001, 13.5], [0, 0, 0], true);
    if (type === 'hive' || role === 'nest' && (type === 'forest' || type === 'jungle')) resinGrowth(b, primary && (role === 'nest' || role === 'command'));
    else if (type === 'temple' || type === 'jungle') role === 'foundry' && primary ? stoneWorkshop(b) : stoneMonument(b, primary && (role === 'command' || role === 'nest'));
    else if (type === 'forest') {
      if (role === 'foundry' && primary || role === 'approach' && site.quadrant === 3) timberWorks(b);
      else if (role === 'relay' && primary || role === 'command' && site.quadrant === 3) relaySpire(b);
      else fieldShelter(b, primary && role === 'command');
    } else if (role === 'nest' && primary) specimenRack(b);
    else if (role === 'relay' && primary) relaySpire(b);
    else machineBank(b, primary && role === 'command');
  });
  b.group.userData.landmarks = sites;
  b.group.userData.role = `${type}-${role}`;
  return b.finish();
}

export function buildBattlefieldCorridorDetails(env, corridor, parent) {
  if (!corridor || !parent?.isObject3D) throw new Error('Corridor details require an actual corridor parent');
  const name = `battlefield-corridor-architecture-${corridor.id}`;
  const existing = parent.getObjectByName(name); if (existing) return existing;
  const b = builder(env, parent, name, corridor.center, corridor.axis === 'x' ? Math.PI / 2 : 0), m = b.mats;
  // Station corridors reuse their painted structural surface for the small
  // recess/drain pieces. Keep the separate edge and warm signal surfaces;
  // this removes one draw per corridor in the shared cooperative scene.
  if (env.type === 'station') m.dark = m.structure;
  // The barrier occupies local Z0. Details frame the two approaches and leave
  // both the barrier's motion and the central sixteen-unit aisle untouched.
  for (const z of [-13, 13]) {
    if (env.type === 'hive') {
      for (const side of [-1, 1]) {
        b.solidBox(m.resin, [side * 9.25, 3, z], [0.65, 6, 1.1]);
        b.pipe(m.resin, [[side * 9.1, 0.1, z], [side * 8.8, 4.8, z], [side * 6.1, 8.9, z], [side * 1.7, 10.2, z]], 0.28, 16);
      }
    } else {
      for (const side of [-1, 1]) {
        const height = env.type === 'temple' || env.type === 'jungle' ? 8.6 : 7.1;
        b.solidBox(m.structure, [side * 9.35, height / 2, z], [0.65, height, 1]);
        b.box(m.edge, [side * 9.35, height, z], [1.4, 0.3, 1.4]);
        for (let panel = 0; panel < 3; panel++) b.box(m.dark, [side * 8.99, 1.2 + panel * 1.65, z], [0.1, 0.55, 0.65], [0, 0, 0], true);
        b.box(m.signal, [side * 8.98, 4.1, z], [0.12, 0.24, 0.68], [0, 0, 0], true);
      }
      if (env.type !== 'rooftop') b.box(m.structure, [0, 8.8, z], [18.8, 0.5, 1], [0, 0, 0], true);
    }
  }
  // Recessed drains and floor seams clarify direction without creating steps.
  for (const side of [-1, 1]) for (let seam = -3; seam <= 3; seam++) {
    b.box(m.dark, [side * 7.9, 0.022, seam * 4.6], [0.38, 0.025, 2.8], [0, 0, 0], true);
    b.box(m.edge, [side * 7.9, 0.038, seam * 4.6], [0.05, 0.012, 2.4], [0, 0, 0], true);
  }
  b.group.userData.corridorAxis = corridor.axis;
  return b.finish();
}

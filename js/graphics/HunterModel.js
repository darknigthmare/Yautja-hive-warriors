/* Articulated hunter geometry. Silhouette detail is batched by material per joint. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSurfaceMaterial } from './SurfaceLibrary.js';
import { sculptLoft, taperedSweep, fittedPlate, gauss } from './HunterSculpt.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

function add(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const round = (x, y, z, radius = 0.06) => new RoundedBoxGeometry(x, y, z, 1, Math.min(radius, x / 3, y / 3, z / 3));
const sphere = (width = 18, height = 12) => new THREE.SphereGeometry(1, width, height);

function tube(parent, material, points, radius, segments = 8, sides = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => v(...p)));
  return add(parent, new THREE.TubeGeometry(curve, segments, radius, sides, false), material);
}

// Sample the actual tessellated surface, including its sculpted relief. This
// keeps small inlays and the body net above the skin instead of cutting through it.
function frontProjector(geometry) {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const surface = new THREE.Mesh(geometry, material);
  surface.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const direction = new THREE.Vector3(0, 0, -1);
  return {
    point(x, y, offset = 0.008) {
      ray.set(v(x, y, 2), direction);
      const hit = ray.intersectObject(surface, false)[0];
      return hit ? [x, y, hit.point.z + offset] : null;
    },
    dispose() { material.dispose(); }
  };
}

// All static details of a limb become a few draw calls, while the joint remains animated.
function batch(group, protectedObjects = []) {
  const protectedSet = new Set(protectedObjects);
  const byMaterial = new Map();
  for (const child of [...group.children]) {
    if (!child.isMesh || protectedSet.has(child)) continue;
    child.updateMatrix();
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(child.matrix);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    const list = byMaterial.get(child.material) || [];
    list.push({ mesh: child, geometry });
    byMaterial.set(child.material, list);
  }
  const disposed = new Set();
  for (const [material, entries] of byMaterial) {
    const merged = mergeGeometries(entries.map(entry => entry.geometry), false);
    merged.computeBoundingSphere();
    const mesh = add(group, merged, material);
    mesh.name = `hunter-detail-${material.name || material.type}`;
    for (const entry of entries) {
      group.remove(entry.mesh);
      entry.geometry.dispose();
      if (!disposed.has(entry.mesh.geometry)) { entry.mesh.geometry.dispose(); disposed.add(entry.mesh.geometry); }
    }
  }
}

function plateGeometry(points, depth = 0.06, bevel = 0.025) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, steps: 1, curveSegments: 6 });
}

function wristBladeGeometry() {
  const geometry = plateGeometry([[-0.07, 0], [0.07, 0], [0.055, 1.15], [0, 1.63], [-0.045, 1.3]], 0.025, 0.008);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

export function createHunterWeaponGeometry(id) {
  if (id === 'combistick') {
    const parts = [];
    const shaft = new THREE.CylinderGeometry(0.065, 0.065, 3.6, 16);
    shaft.rotateX(Math.PI / 2); parts.push(shaft);
    for (const z of [-1.65, -0.85, -0.55, 0.55, 0.85, 1.65]) {
      const ring = new THREE.TorusGeometry(0.085, 0.018, 6, 16);
      ring.translate(0, 0, z); parts.push(ring);
    }
    for (const sign of [-1, 1]) {
      const tip = new THREE.ConeGeometry(0.14, 0.4, 8);
      tip.rotateX(sign * Math.PI / 2); tip.translate(0, 0, -sign * 1.93); parts.push(tip);
    }
    const result = mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p), false);
    parts.forEach(p => p.dispose());
    return result;
  }
  if (id === 'katana') {
    const blade = plateGeometry([[-0.075, -0.2], [0.075, -0.2], [0.085, 1.65], [-0.04, 2.2], [-0.11, 1.55]], 0.035, 0.012);
    blade.rotateX(Math.PI / 2);
    return blade;
  }
  if (id === 'viking_axe') {
    const blade = plateGeometry([[-0.65, 0.75], [-0.48, 1.55], [0, 1.7], [0.48, 1.55], [0.65, 0.75], [0.12, 0.92], [0.08, -0.4], [-0.08, -0.4], [-0.12, 0.92]], 0.09, 0.025);
    blade.rotateX(Math.PI / 2);
    return blade;
  }
  if (id === 'shuriken') {
    const points = [];
    for (let i = 0; i < 12; i++) { const angle = i * Math.PI / 6; const radius = i % 2 ? 0.31 : 0.83; points.push([Math.sin(angle) * radius, Math.cos(angle) * radius]); }
    const geometry = plateGeometry(points, 0.055, 0.018); geometry.rotateX(Math.PI / 2); return geometry;
  }
  if (['alpha_sickle', 'compound_bow', 'plasma_whip'].includes(id)) return new THREE.TorusGeometry(0.72, 0.065, 10, 36, Math.PI * 1.4);
  // Beveled, lenticular disc has thickness and an edge without excessive hidden topology.
  return new THREE.LatheGeometry([new THREE.Vector2(0, -0.055), new THREE.Vector2(0.34, -0.06), new THREE.Vector2(0.64, -0.018), new THREE.Vector2(0.67, 0), new THREE.Vector2(0.6, 0.035), new THREE.Vector2(0.3, 0.07), new THREE.Vector2(0, 0.06)], 48);
}

export function buildHunterModel(owner) {
  const root = new THREE.Group(); root.name = `hunter-${owner.data.id}`;
  const colors = owner.data.colors;
  const primitive = ['alpha_predator', 'feral_predator'].includes(owner.data.id);
  const samurai = owner.data.id === 'samurai_predator';
  const heavy = owner.data.id === 'viking_predator';
  const wolf = owner.data.id === 'wolf_predator';
  const skin = createSurfaceMaterial('skin', { color: colors.skin, roughness: 0.73, metalness: 0.02 });
  const armor = createSurfaceMaterial(primitive ? 'bone' : 'armor', { color: colors.armor, roughness: primitive ? 0.72 : 0.61, metalness: primitive ? 0.04 : 0.68 });
  const maskColor = owner.data.id === 'jungle_hunter' ? 0x9aa2a6 : colors.mask;
  const mask = createSurfaceMaterial(primitive ? 'bone' : 'armor', { color: maskColor, roughness: primitive ? 0.64 : 0.4, metalness: primitive ? 0.05 : 0.7, side: THREE.DoubleSide });
  const leather = createSurfaceMaterial('leather', { color: 0x392d24, roughness: 0.92, metalness: 0 });
  const dreads = createSurfaceMaterial('leather', { color: colors.dreads, roughness: 0.8, metalness: 0 });
  const bone = createSurfaceMaterial('bone', { color: 0xbcae85, roughness: 0.76, metalness: 0.02 });
  const metal = createSurfaceMaterial('metal', { color: 0xadb6bc, roughness: 0.32, metalness: 0.9 });
  const dark = createSurfaceMaterial('metal', { color: 0x080d10, roughness: 0.52, metalness: 0.3 });
  const light = new THREE.MeshStandardMaterial({ color: colors.plasma, emissive: colors.plasma, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.3 });
  const target = new THREE.MeshStandardMaterial({ color: 0xb82716, emissive: 0xc80d03, emissiveIntensity: 1.4, roughness: 0.32 });
  const materials = [skin, armor, mask, leather, dreads, bone, metal, dark, light, target];
  materials.forEach((material, index) => material.name = ['skin', 'armor', 'bio-mask', 'leather', 'dreadlocks', 'bone', 'blade-alloy', 'gaskets', 'plasma', 'targeting'][index]);

  // The body is designed at its final adult proportions, with no post-build scaling.
  const torso = sculptLoft([
    [2.04, 0.19, 0.12], [2.12, 0.34, 0.22], [2.28, 0.35, 0.24],
    [2.46, 0.29, 0.205], [2.64, 0.31, 0.22], [2.88, 0.4, 0.245],
    [3.12, 0.49, 0.275], [3.32, 0.51, 0.265], [3.43, 0.43, 0.22],
    [3.5, 0.29, 0.16], [3.57, 0.145, 0.12], [3.72, 0.135, 0.115], [3.86, 0.13, 0.11]
  ], {
    radial: 96, longitudinal: 96,
    sculpt(x, y, z, theta) {
      const front = Math.max(0, Math.cos(theta)), back = Math.max(0, -Math.cos(theta));
      const pec = gauss(Math.abs(x), 0.25, 0.2) * gauss(y, 3.27, 0.17) * 0.08;
      const sternum = gauss(x, 0, 0.035) * gauss(y, 3.18, 0.27) * 0.026;
      let ab = 0;
      for (const at of [2.64, 2.81, 2.98]) ab += gauss(Math.abs(x), 0.13, 0.095) * gauss(y, at, 0.075) * 0.034;
      const oblique = Math.sin((y - 2.55) * 30 + Math.abs(x) * 5) * gauss(Math.abs(x), 0.27, 0.13) * gauss(y, 2.85, 0.3) * 0.009;
      const scapula = gauss(Math.abs(x), 0.28, 0.16) * gauss(y, 3.25, 0.23) * 0.035;
      const spine = gauss(x, 0, 0.035) * gauss(y, 3.03, 0.48) * 0.018;
      const clavicle = gauss(y, 3.48 - Math.abs(x) * 0.1, 0.018) * gauss(Math.abs(x), 0.2, 0.18) * 0.012;
      const collarNotch = gauss(x, 0, 0.035) * gauss(y, 3.53, 0.035) * 0.018;
      z += front ** 3 * (pec + ab + oblique + clavicle - sternum - collarNotch) - back ** 3 * (scapula - spine);
      return [x, y, z];
    }
  });
  add(root, torso, skin).name = 'continuous-anatomical-torso';
  const torsoFront = frontProjector(torso);

  // Leather belt and asymmetrical hanging cloth follow the pelvis rather than a box.
  add(root, sculptLoft([[2.16, 0.343, 0.24], [2.2, 0.362, 0.25], [2.27, 0.36, 0.25], [2.31, 0.34, 0.235]], { radial: 64, longitudinal: 8 }), leather);
  add(root, round(0.18, 0.15, 0.045, 0.02), armor, [0.045, 2.24, 0.27]);
  for (const side of [-1, 1]) {
    add(root, fittedPlate([[2.08, 0.34, 0.265], [2.16, 0.39, 0.28], [2.3, 0.375, 0.27], [2.36, 0.31, 0.24]], { radial: 24, longitudinal: 10, arcLength: 0.7 }), leather, [side * 0.06, 0, 0], [1, 1, 1], [0, side * 1.15, 0]);
    for (let fastener = 0; fastener < 2; fastener++) add(root, new THREE.TorusGeometry(0.035, 0.008, 8, 16), metal, [side * 0.29, 2.2 + fastener * 0.1, 0.22]);
  }
  const loin = plateGeometry([[-0.23, 0], [0.23, 0], [0.19, -0.35], [0.08, -0.51], [-0.15, -0.44]], 0.018, 0.007);
  add(root, loin, leather, [0.025, 2.15, 0.24], [1, 1, 1], [0.08, 0, -0.04]);
  for (let strip = -1; strip <= 1; strip++) tube(root, dreads, [[strip * 0.12, 2.14, 0.275], [strip * 0.1, 1.94, 0.3], [strip * 0.1 + 0.025, 1.74, 0.29]], 0.014, 12, 6);

  // Fine diagonals sit flush to the torso and preserve its continuous muscle form.
  for (let line = -4; line <= 4; line++) for (const direction of [-1, 1]) {
    const points = [];
    for (let step = 0; step <= 16; step++) {
      const y = 2.42 + step * 0.062;
      const x = direction * ((y - 2.92) * 0.52 + line * 0.14);
      const projected = torsoFront.point(x, y, 0.011);
      if (projected) points.push(projected);
    }
    if (points.length > 1) tube(root, leather, points, 0.006, points.length - 1, 5);
  }
  torsoFront.dispose();
  tube(root, leather, [[-0.43, 3.5, 0.12], [-0.29, 3.25, 0.33], [-0.03, 2.91, 0.29], [0.27, 2.37, 0.24]], 0.042, 24, 8);
  tube(root, leather, [[-0.43, 3.5, -0.12], [-0.29, 3.25, -0.29], [-0.03, 2.91, -0.27], [0.27, 2.37, -0.22]], 0.042, 24, 8);
  add(root, round(0.14, 0.18, 0.025, 0.015), metal, [-0.22, 3.15, 0.34], [1, 1, 1], [0, 0, -0.52]);

  owner.headMesh = new THREE.Group(); owner.headMesh.name = 'bio-mask-and-dreadlocks'; owner.headMesh.position.set(0, 4.02, 0.02); root.add(owner.headMesh);
  const head = owner.headMesh;
  const skullProfiles = [[-0.27, 0.075, 0.075], [-0.24, 0.14, 0.13], [-0.12, 0.19, 0.16], [0.06, 0.2, 0.175], [0.21, 0.17, 0.15], [0.29, 0.075, 0.07], [0.315, 0.004, 0.004]];
  add(head, sculptLoft(skullProfiles, { radial: 64, longitudinal: 48 }), skin, [0, 0, -0.025]);
  const maskProfiles = [[-0.28, 0.075, 0.135], [-0.24, 0.125, 0.185], [-0.15, 0.19, 0.18], [-0.055, 0.25, 0.18], [0.065, 0.265, 0.175], [0.17, 0.235, 0.157], [0.275, 0.14, 0.11], [0.31, 0.025, 0.035]];
  const maskGeometry = fittedPlate(maskProfiles, {
    radial: 64, longitudinal: 48, arcLength: Math.PI * 1.14, thickness: 0.009,
    sculpt(x, y, z, theta) {
      const front = Math.max(0, Math.cos(theta));
      const brow = gauss(y, 0.07, 0.025) * (0.018 + gauss(Math.abs(x), 0.14, 0.1) * 0.021);
      const bridgeRecess = gauss(x, 0, 0.036) * gauss(y, -0.015, 0.09) * 0.008;
      const cheek = gauss(Math.abs(x), 0.16, 0.038) * gauss(y, -0.1, 0.07) * 0.043;
      const muzzle = gauss(y, -0.205, 0.05) * Math.exp(-((x / 0.11) ** 6)) * 0.044;
      const foreheadGroove = gauss(Math.abs(x), 0.14, 0.009) * gauss(y, 0.19, 0.07) * 0.006;
      return [x, y, z + front ** 3 * (brow + cheek + muzzle - bridgeRecess - foreheadGroove)];
    }
  });
  add(head, maskGeometry, mask, [0, 0, 0.025]).name = 'sculpted-biomask';
  const maskFront = frontProjector(maskGeometry);
  for (const side of [-1, 1]) {
    // Black inset lenses are narrow parts of the brow, without glowing eye strips.
    const eyePoints = [], eyeUV = [], eyeIndices = [];
    for (let row = 0; row < 2; row++) for (let column = 0; column <= 12; column++) {
      const x = side * 0.11 + (column / 12 - 0.5) * 0.14;
      const y = 0.025 + side * (x - side * 0.11) * 0.035 + (row ? 0.006 : -0.005);
      const projected = maskFront.point(x, y, 0.003) || [x, y, 0.2]; projected[2] += 0.025;
      eyePoints.push(...projected); eyeUV.push(column / 12, row);
      if (!row && column < 12) eyeIndices.push(column, column + 1, column + 13, column + 1, column + 14, column + 13);
    }
    const eyeGeometry = new THREE.BufferGeometry(); eyeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(eyePoints, 3)); eyeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(eyeUV, 2)); eyeGeometry.setIndex(eyeIndices); eyeGeometry.computeVertexNormals();
    add(head, eyeGeometry, dark);
    for (let vent = 0; vent < 4; vent++) {
      const points = [];
      for (let step = 0; step <= 4; step++) {
        const x = side * (0.045 + vent * 0.022 + step * 0.00075), y = -0.16 - step * 0.013;
        const point = maskFront.point(x, y, 0.003);
        if (point) { point[2] += 0.025; points.push(point); }
      }
      if (points.length > 1) tube(head, dark, points, 0.0035, 6, 5);
    }
    if (primitive) {
      add(head, taperedSweep([[side * 0.11, -0.16, 0.16], [side * 0.22, -0.22, 0.18], [side * 0.17, -0.31, 0.25]], [0.035, 0.03, 0.002], { longitudinal: 18, radial: 10 }), bone);
    }
    if (samurai || heavy) {
      add(head, taperedSweep([[side * 0.13, 0.19, -0.07], [side * 0.23, 0.31, -0.02], [side * 0.28, 0.43, 0.04]], [0.032, 0.023, 0.002], { longitudinal: 18, radial: 10 }), mask);
    }
  }
  maskFront.dispose();
  if (wolf) for (const side of [-1, 1]) tube(head, dark, [[side * 0.035, 0.21, 0.16], [side * 0.06, 0.11, 0.2], [side * 0.1, -0.02, 0.218]], 0.0035, 12, 5);
  for (let i = 0; i < 24; i++) {
    const angle = Math.PI * 0.2 + i / 23 * Math.PI * 1.6;
    const x = Math.sin(angle), z = Math.cos(angle);
    const length = 0.64 + (i % 5) * 0.085 + Math.sin(i * 1.7) * 0.055;
    const tipX = x * (0.32 + (i % 3) * 0.018);
    add(head, taperedSweep([[x * 0.17, 0.11, z * 0.14 - 0.075], [x * 0.3, -0.11, z * 0.24 - 0.1], [x * 0.34, -0.43, z * 0.27 - 0.1], [tipX, -length, z * 0.26 - 0.09]], [0.026, 0.032, 0.027, 0.014], { longitudinal: 24, radial: 8 }), dreads);
    const beadY = -0.36 - (i % 3) * 0.07;
    add(head, new THREE.CylinderGeometry(0.035, 0.035, 0.045, 16), metal, [x * 0.34, beadY, z * 0.26 - 0.1], [1, 1, 1], [z * -0.12, 0, x * 0.12]);
  }
  for (let dot = 0; dot < 3; dot++) add(head, sphere(16, 12), target, [-0.215 + dot * 0.023, 0.12 + (dot % 2) * 0.025, 0.11], [0.008, 0.008, 0.008]);
  owner.clanMarkMesh = add(head, plateGeometry([[-0.012, 0.05], [0.022, 0.008], [0.003, 0.008], [0.012, -0.04], [-0.025, 0], [-0.003, 0]], 0.003, 0), light, [0, 0.17, 0.183]);
  owner.clanMarkMesh.visible = false;

  function buildArm(side) {
    const arm = new THREE.Group(); arm.name = side < 0 ? 'left-shoulder-joint' : 'right-shoulder-joint'; arm.position.set(side * 0.66, 3.43, 0); root.add(arm);
    add(arm, sculptLoft([
      [-1.34, 0.08, 0.065, side * 0.045, 0.035], [-1.2, 0.115, 0.095, side * 0.04, 0.035],
      [-1.02, 0.155, 0.12, side * 0.04, 0.03], [-0.82, 0.14, 0.115, side * 0.035, 0.005],
      [-0.69, 0.115, 0.11, side * 0.035, -0.005], [-0.53, 0.17, 0.145, side * 0.025, -0.01],
      [-0.25, 0.225, 0.175, 0, 0], [-0.05, 0.22, 0.18, 0, 0], [0.12, 0.145, 0.115, -side * 0.02, 0], [0.18, 0.025, 0.03, -side * 0.04, 0]
    ], {
      radial: 64, longitudinal: 72,
      sculpt(x, y, z, theta) {
        const front = Math.max(0, Math.cos(theta));
        z += gauss(y, -0.38, 0.2) * front ** 4 * 0.024 + gauss(y, -1.03, 0.22) * front ** 3 * 0.018;
        return [x, y, z];
      }
    }), skin).name = 'continuous-sculpted-arm';
    // A shallow formed plate has a sealed crown, inset panel and fastened rim;
    // the deltoid underneath supplies the volume instead of a spherical shell.
    const pauldron = new THREE.Group(); pauldron.name = 'formed-shoulder-plate';
    pauldron.rotation.set(0, side * 0.45, side * -0.2); arm.add(pauldron);
    const shoulderGeometry = fittedPlate([
      [-0.3, 0.165, 0.125], [-0.2, 0.245, 0.17], [-0.03, 0.245, 0.157],
      [0.105, 0.18, 0.13], [0.18, 0.025, 0.035]
    ], { radial: 40, longitudinal: 18, arcLength: Math.PI * 1.38, thickness: 0.018 });
    add(pauldron, shoulderGeometry, armor);
    const shoulderFront = frontProjector(shoulderGeometry);
    const seam = [[-0.13, -0.23], [-0.195, -0.15], [-0.18, 0.025], [-0.105, 0.095],
      [0.105, 0.095], [0.18, 0.025], [0.195, -0.15], [0.13, -0.23], [-0.13, -0.23]];
    const seamPoints = seam.map(([x, y]) => shoulderFront.point(x, y, 0.006)).filter(Boolean);
    tube(pauldron, metal, seamPoints, 0.004, 40, 5);
    for (const sign of [-1, 1]) {
      const channel = [[sign * 0.035, 0.07], [sign * 0.1, -0.035], [sign * 0.12, -0.16]]
        .map(([x, y]) => shoulderFront.point(x, y, 0.003)).filter(Boolean);
      tube(pauldron, dark, channel, 0.003, 14, 5);
      for (const y of [-0.19, 0.025]) {
        const point = shoulderFront.point(sign * 0.135, y, 0.007);
        if (point) add(pauldron, sphere(12, 8), metal, point, [0.009, 0.009, 0.005]);
      }
    }
    shoulderFront.dispose(); batch(pauldron);
    add(arm, fittedPlate([[-1.23, 0.12, 0.11], [-1.17, 0.16, 0.138], [-0.97, 0.18, 0.15], [-0.82, 0.155, 0.13], [-0.79, 0.13, 0.11]], { radial: 40, longitudinal: 24, arcLength: Math.PI * 1.35, thickness: 0.016 }), armor, [0.035 * side, 0, 0.015]);
    for (const y of [-0.87, -1.16]) add(arm, sculptLoft([[y - 0.02, 0.164, 0.14], [y, 0.17, 0.146], [y + 0.02, 0.164, 0.14]], { radial: 40, longitudinal: 4 }), leather, [0.035 * side, 0, 0.015]);
    add(arm, round(0.13, 0.17, 0.025, 0.02), dark, [0.035 * side, -0.995, 0.171]);
    for (let indicator = 0; indicator < 3; indicator++) add(arm, round(0.017, 0.05, 0.008, 0.003), side < 0 ? target : light, [0.035 * side - 0.033 + indicator * 0.033, -0.995, 0.19]);
    add(arm, sculptLoft([[-1.59, 0.065, 0.05], [-1.52, 0.11, 0.062], [-1.4, 0.105, 0.07], [-1.3, 0.07, 0.055]], { radial: 40, longitudinal: 24 }), skin, [side * 0.045, 0, 0.04]);
    const lengths = [0.22, 0.29, 0.28, 0.22];
    for (let finger = 0; finger < 4; finger++) {
      const x = side * 0.045 - 0.075 + finger * 0.05, end = -1.53 - lengths[finger];
      add(arm, taperedSweep([[x, -1.5, 0.08], [x + side * 0.008, -1.63, 0.095], [x + side * 0.012, end + 0.045, 0.14], [x + side * 0.012, end, 0.18]], [0.024, 0.028, 0.022, 0.014], { longitudinal: 18, radial: 8 }), skin);
      add(arm, taperedSweep([[x + side * 0.012, end + 0.025, 0.163], [x + side * 0.012, end - 0.015, 0.205], [x + side * 0.01, end - 0.02, 0.23]], [0.014, 0.012, 0.001], { longitudinal: 10, radial: 7 }), bone);
    }
    add(arm, taperedSweep([[side * -0.045, -1.36, 0.06], [side * -0.14, -1.46, 0.1], [side * -0.14, -1.57, 0.17]], [0.032, 0.027, 0.012], { longitudinal: 18, radial: 8 }), skin);
    return arm;
  }
  owner.leftArm = buildArm(-1); owner.rightArm = buildArm(1);
  owner.shieldMesh = add(owner.leftArm, sculptLoft([[-0.04, 0.03, 0.03], [-0.025, 0.55, 0.55], [0.025, 0.56, 0.56], [0.06, 0.08, 0.08]], { radial: 64, longitudinal: 12 }), primitive ? bone : armor, [-0.08, -1.04, 0.26], [1, 1, 1], [Math.PI / 2, 0, 0]);
  owner.shieldMesh.visible = false;
  owner.blade1 = add(owner.rightArm, wristBladeGeometry(), metal, [-0.05, -1.13, 0.2]);
  owner.blade2 = add(owner.rightArm, wristBladeGeometry(), metal, [0.06, -1.13, 0.2]);
  owner.secWeaponMesh = add(owner.leftArm, createHunterWeaponGeometry('smart_disc'), metal, [0.04, -1.47, 0.23]); owner.secWeaponMesh.visible = false;
  owner.plasmaGlaiveMesh = new THREE.Group(); owner.plasmaGlaiveMesh.position.set(0.035, -1.44, 0.22); owner.plasmaGlaiveMesh.rotation.x = Math.PI / 2; owner.plasmaGlaiveMesh.visible = false; owner.rightArm.add(owner.plasmaGlaiveMesh);
  add(owner.plasmaGlaiveMesh, new THREE.CylinderGeometry(0.04, 0.04, 3.4, 32), metal);
  for (const sign of [-1, 1]) add(owner.plasmaGlaiveMesh, plateGeometry([[-0.03, 0], [0.26, 0.15], [0.12, 0.9], [-0.05, 1.1]], 0.035, 0.01), light, [0, sign * 1.2, 0], [1, sign, 1]);

  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.name = side < 0 ? 'left-hip-joint' : 'right-hip-joint'; leg.position.set(side * 0.235, 2.18, 0); root.add(leg);
    add(leg, sculptLoft([
      [-1.99, 0.07, 0.07, 0, -0.015], [-1.83, 0.095, 0.105, 0, -0.025], [-1.56, 0.135, 0.16, 0, -0.08],
      [-1.32, 0.155, 0.17, 0, -0.075], [-1.04, 0.115, 0.115, 0, 0.025], [-0.9, 0.135, 0.14, 0, 0.045],
      [-0.65, 0.19, 0.185, 0, 0.005], [-0.35, 0.235, 0.215, 0, -0.01], [-0.08, 0.235, 0.22, 0, -0.015], [0.13, 0.12, 0.13, -side * 0.035, -0.035]
    ], {
      radial: 64, longitudinal: 88,
      sculpt(x, y, z, theta) {
        const front = Math.max(0, Math.cos(theta));
        z += front ** 4 * (gauss(y, -0.43, 0.3) * 0.026 + gauss(y, -0.99, 0.1) * 0.019);
        x += Math.sin(theta) * gauss(y, -0.55, 0.35) * 0.013;
        return [x, y, z];
      }
    }), skin).name = 'continuous-sculpted-leg';
    add(leg, fittedPlate([[-1.75, 0.075, 0.09], [-1.58, 0.11, 0.11], [-1.31, 0.135, 0.135], [-1.13, 0.125, 0.145], [-1.04, 0.075, 0.1]], { radial: 40, longitudinal: 28, arcLength: Math.PI * 0.94, thickness: 0.014 }), armor, [0, 0, 0.065]);
    add(leg, fittedPlate([[-1.1, 0.06, 0.08], [-1.0, 0.14, 0.15], [-0.92, 0.105, 0.11]], { radial: 32, longitudinal: 12, arcLength: Math.PI * 0.96, thickness: 0.014 }), armor, [0, 0, 0.07]);
    // A long anatomical instep and distinct toes replace the old rectangular boot.
    add(leg, sculptLoft([[-2.155, 0.055, 0.1, 0, 0.095], [-2.12, 0.135, 0.205, 0, 0.14], [-2.035, 0.14, 0.22, 0, 0.11], [-1.94, 0.075, 0.11, 0, 0.025]], { radial: 48, longitudinal: 28 }), leather);
    for (let toe = 0; toe < 3; toe++) {
      const x = (toe - 1) * 0.082;
      add(leg, taperedSweep([[x, -2.08, 0.23], [x, -2.105, 0.335], [x, -2.12, 0.41 - Math.abs(toe - 1) * 0.02]], [0.035, 0.038, 0.02], { longitudinal: 14, radial: 8 }), skin);
      add(leg, taperedSweep([[x, -2.105, 0.37], [x, -2.11, 0.435], [x, -2.12, 0.47]], [0.021, 0.017, 0.002], { longitudinal: 10, radial: 7 }), bone);
    }
    batch(leg);
    if (side < 0) owner.leftLeg = leg; else owner.rightLeg = leg;
  }

  const cannonCount = wolf ? 2 : 1;
  for (let cannon = 0; cannon < cannonCount; cannon++) {
    const side = cannon === 0 ? -1 : 1;
    tube(root, dark, [[side * 0.55, 3.47, -0.08], [side * 0.83, 3.39, -0.1], [side * 1.02, 3.41, -0.11]], 0.065, 20, 10);
    const housing = sculptLoft([[-0.39, 0.07, 0.08], [-0.32, 0.14, 0.135], [0.13, 0.145, 0.14], [0.31, 0.105, 0.105]], { radial: 48, longitudinal: 24 });
    add(root, housing, armor, [side * 1.02, 3.41, 0.04], [1, 1, 1], [Math.PI / 2, 0, 0]);
    add(root, new THREE.CylinderGeometry(0.095, 0.11, 0.25, 48), metal, [side * 1.02, 3.41, 0.48], [1, 1, 1], [Math.PI / 2, 0, 0]);
    add(root, new THREE.TorusGeometry(0.083, 0.015, 12, 32), dark, [side * 1.02, 3.41, 0.62]);
    add(root, sphere(24, 16), light, [side * 1.02, 3.41, 0.622], [0.055, 0.055, 0.012]);
    for (let fin = 0; fin < 5; fin++) add(root, new THREE.TorusGeometry(0.144, 0.012, 8, 32), metal, [side * 1.02, 3.41, -0.2 + fin * 0.075]);
  }
  for (const side of [-1, 1]) {
    add(root, sphere(24, 16), bone, [side * 0.3, 2.07, -0.24], [0.07, 0.09, 0.065]);
    for (const eye of [-1, 1]) add(root, sphere(16, 12), dark, [side * 0.3 + eye * 0.025, 2.095, -0.18], [0.014, 0.018, 0.008]);
    tube(root, leather, [[side * 0.25, 2.24, -0.19], [side * 0.32, 2.14, -0.24], [side * 0.3, 2.06, -0.24]], 0.01, 14, 6);
  }
  for (let plate = 0; plate < 6; plate++) add(root, fittedPlate([[0, 0.06, 0.025], [0.06, 0.09, 0.035], [0.11, 0.06, 0.025]], { radial: 12, longitudinal: 6, arcLength: Math.PI * 0.9, thickness: 0.009 }), armor, [0, 2.58 + plate * 0.145, -0.25], [1, 1, 1], [0, Math.PI, 0]);

  batch(root);
  batch(head, [owner.clanMarkMesh]);
  batch(owner.leftArm, [owner.shieldMesh, owner.secWeaponMesh]);
  batch(owner.rightArm, [owner.blade1, owner.blade2]);
  batch(owner.plasmaGlaiveMesh);
  owner._leftArmRestX = owner.leftArm.position.x;
  owner.skinMaterials = [skin];
  owner.armorMaterials = materials.filter(material => material !== skin);
  root.userData.modelRevision = 'anatomical-sculpt-v4';
  root.userData.fidelity = 'procedural interpretation';
  root.userData.adultProportions = true;
  root.updateMatrixWorld(true);
  return root;
}

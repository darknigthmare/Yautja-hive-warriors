/* Detailed support actors. Static pieces merge per surface; gameplay pivots stay separate. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSurfaceMaterial } from './SurfaceLibrary.js';
import { loftGeometry, sweptLimb, sculptedFaceGeometry, tireGeometry } from './SupportSculpt.js';
import { buildInsertionPodModel } from './InsertionPodModel.js';
import { buildAPCModel } from './APCModel.js';

class Assembly {
  constructor(name) { this.name = name; this.parts = new Map(); }
  add(geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    const prepared = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    prepared.applyMatrix4(transform);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(prepared);
    return this;
  }
  box(material, position, size, rounded = false, rotation = [0, 0, 0]) {
    const geometry = rounded ? new RoundedBoxGeometry(1, 1, 1, 3, 0.14) : new THREE.BoxGeometry(1, 1, 1);
    return this.add(geometry, material, position, size, rotation);
  }
  sphere(material, position, scale, segments = 28) {
    const radius = Math.max(...scale);
    const widthSegments = radius < 0.08 ? 12 : radius < 0.2 ? 20 : Math.max(24, segments);
    const heightSegments = radius < 0.08 ? 8 : radius < 0.2 ? 12 : 20;
    return this.add(new THREE.SphereGeometry(1, widthSegments, heightSegments), material, position, scale);
  }
  cylinder(material, position, radii, height, rotation = [0, 0, 0], segments = 24) {
    return this.add(new THREE.CylinderGeometry(radii[0], radii[1], height, Math.max(16, segments)), material, position, [1, 1, 1], rotation);
  }
  bone(material, from, to, radius, endRadius = radius * 0.9, segments = 10) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    return this.add(new THREE.CylinderGeometry(endRadius, radius, direction.length(), segments), material, a.clone().add(b).multiplyScalar(0.5).toArray(), [1, 1, 1], new THREE.Euler().setFromQuaternion(quaternion).toArray().slice(0, 3));
  }
  tube(material, points, radius, segments = 20, radialSegments = 10) {
    return this.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, radialSegments, false), material);
  }
  finish() {
    const group = new THREE.Group(); group.name = this.name;
    for (const [material, parts] of this.parts) {
      const geometry = mergeGeometries(parts, false);
      parts.forEach(part => part.dispose());
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.name = `${this.name}-${material.name || 'surface'}`;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

function surfaces(color = 0x52604b) {
  const armor = createSurfaceMaterial('armor', { color, roughness: 0.49, metalness: 0.65 });
  const dark = createSurfaceMaterial('metal', { color: 0x293139, roughness: 0.48, metalness: 0.75 });
  const cloth = createSurfaceMaterial('fabric', { color: 0x353c37, roughness: 0.9, metalness: 0 });
  const skin = createSurfaceMaterial('humanSkin', { color: 0xc4a08a, roughness: 0.66, metalness: 0, normalScale: new THREE.Vector2(0.2, 0.2) });
  const rubber = createSurfaceMaterial('leather', { color: 0x181b1c, roughness: 0.82, metalness: 0.05 });
  const steel = createSurfaceMaterial('metal', { color: 0x929d9b, roughness: 0.29, metalness: 0.86 });
  for (const [name, material] of Object.entries({ armor, dark, cloth, skin, rubber, steel })) material.name = name;
  return { armor, dark, cloth, skin, rubber, steel };
}
function glow(color) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2, roughness: 0.25, metalness: 0.15 }); }
function windowMaterial() { return new THREE.MeshPhysicalMaterial({ color: 0x263b46, roughness: 0.22, metalness: 0.08, clearcoat: 0.45, clearcoatRoughness: 0.2, transparent: true, opacity: 0.85, depthWrite: false }); }

function addHumanTorso(parts, mats, exposed = false) {
  const geometry = loftGeometry([
    [1.35, 0.1, 0.13], [1.49, 0.32, 0.22], [1.67, 0.27, 0.19],
    [1.88, 0.265, 0.2], [2.12, 0.32, 0.235], [2.4, 0.39, 0.25],
    [2.62, 0.415, 0.235], [2.7, 0.35, 0.19], [2.8, 0.17, 0.12],
    [2.86, 0.105, 0.09], [2.89, 0.1, 0.085]
  ], { radial: exposed ? 48 : 32, rows: exposed ? 40 : 24, muscle: 0.025 });
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    if (z <= 0) continue;
    const pec = Math.exp(-(((Math.abs(x) - 0.19) / 0.16) ** 2) - ((y - 2.49) / 0.17) ** 2) * 0.025;
    const sternum = Math.exp(-((x / 0.045) ** 2) - ((y - 2.4) / 0.28) ** 2) * 0.02;
    position.setZ(i, z + pec - sternum);
  }
  geometry.computeVertexNormals();
  parts.add(geometry, mats.cloth);
  parts.add(loftGeometry([[2.84, 0.092, 0.082], [2.91, 0.091, 0.083], [3.01, 0.082, 0.075]], { radial: 24, rows: 14 }), mats.skin);
}
function addHumanLegs(parts, mats, armored = true) {
  for (const side of [-1, 1]) {
    const hip = side * 0.205, knee = side * 0.23, ankle = side * 0.25;
    parts.add(sweptLimb([
      [hip, 1.58, -0.01, 0.165, 0.18], [hip, 1.31, -0.01, 0.185, 0.18],
      [knee, 0.93, 0.07, 0.115, 0.125], [knee, 0.73, 0.02, 0.135, 0.15],
      [ankle, 0.44, -0.04, 0.105, 0.11], [ankle, 0.2, -0.04, 0.08, 0.09]
    ], 32, 32), mats.cloth);
    if (armored) parts.add(loftGeometry([[0.76, 0.07, 0.04], [0.83, 0.13, 0.065], [0.98, 0.14, 0.06], [1.08, 0.08, 0.035]], { radial: 24, rows: 14 }), mats.armor, [knee, 0, 0.155]);
    parts.add(loftGeometry([[-0.22, 0.075, 0.07, 0, 0.16], [-0.14, 0.13, 0.13, 0, 0.16], [0.05, 0.145, 0.14, 0, 0.15], [0.27, 0.145, 0.09, 0, 0.105], [0.38, 0.065, 0.055, 0, 0.09]], { axis: 'z', radial: 24, rows: 20, superellipse: 2.6 }), mats.rubber, [ankle, 0, 0]);
    parts.add(loftGeometry([[-0.24, 0.08, 0.025, 0, 0.04], [-0.14, 0.14, 0.03, 0, 0.04], [0.12, 0.16, 0.03, 0, 0.04], [0.32, 0.145, 0.028, 0, 0.04], [0.4, 0.07, 0.02, 0, 0.04]], { axis: 'z', radial: 20, rows: 16, superellipse: 3 }), mats.dark, [ankle, 0, 0]);
    for (let lace = 0; lace < 4; lace++) parts.tube(mats.dark, [[ankle - 0.09, 0.26 - lace * 0.015, -0.04 + lace * 0.055], [ankle, 0.28 - lace * 0.015, -0.04 + lace * 0.055], [ankle + 0.09, 0.26 - lace * 0.015, -0.04 + lace * 0.055]], 0.008, 6, 5);
  }
}
function addHand(parts, mats, x, y, z, side) {
  parts.add(loftGeometry([[-0.12, 0.045, 0.027], [-0.08, 0.065, 0.035], [0.02, 0.07, 0.035], [0.075, 0.058, 0.025]], { radial: 24, rows: 14, superellipse: 2.6 }), mats.skin, [x, y, z], [1, 1, 1], [Math.PI / 2, 0, side * 0.15]);
  for (let finger = 0; finger < 4; finger++) {
    const offset = (finger - 1.5) * 0.033, reach = 0.095 - Math.abs(finger - 1.4) * 0.012;
    parts.add(sweptLimb([[x + offset, y - 0.04, z + 0.08, 0.017], [x + offset, y - 0.065, z + 0.12 + reach * 0.5, 0.016], [x + offset, y - 0.12, z + 0.11 + reach, 0.012], [x + offset, y - 0.145, z + 0.1 + reach, 0.004]], 10, 10), mats.skin);
  }
  parts.add(sweptLimb([[x - side * 0.065, y - 0.02, z + 0.005, 0.025], [x - side * 0.095, y - 0.06, z + 0.06, 0.021], [x - side * 0.055, y - 0.11, z + 0.1, 0.009]], 12, 10), mats.skin);
}
function addArms(parts, mats, armored = true) {
  for (const side of [-1, 1]) {
    const sx = side * 0.455, ex = side * 0.57;
    const wrist = side > 0 ? [0.3, 2.09, 0.58] : [0.06, 2.07, 0.99];
    parts.add(sweptLimb([
      // Bury the sleeve opening inside the pauldron instead of exposing its rim.
      [sx, 2.64, 0.0, 0.085, 0.095], [side * 0.52, 2.53, 0.005, 0.155, 0.17],
      [ex, 2.24, side < 0 ? 0.33 : 0.14, 0.105, 0.11],
      [side < 0 ? -0.3 : 0.44, 2.15, side < 0 ? 0.66 : 0.34, 0.12, 0.11],
      [...wrist, 0.068, 0.075]
    ], 32, 30), mats.cloth);
    if (armored) parts.add(new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.59), mats.armor, [sx, 2.58, -0.015], [0.185, 0.16, 0.215]);
    addHand(parts, mats, ...wrist, side);
  }
}
function addFace(parts, mats, position = [0, 3.18, 0.01]) {
  const [x, y, z] = position;
  parts.add(sculptedFaceGeometry(), mats.skin, position);
  const crease = createSurfaceMaterial('humanSkin', { color: 0x947262, roughness: 0.85, normalScale: new THREE.Vector2(0.1, 0.1) });
  const lips = createSurfaceMaterial('humanSkin', { color: 0xb58d80, roughness: 0.7, normalScale: new THREE.Vector2(0.1, 0.1) });
  const eyes = new THREE.MeshStandardMaterial({ color: 0x373b31, roughness: 0.42, metalness: 0 });
  const sclera = new THREE.MeshStandardMaterial({ color: 0x9b968a, roughness: 0.55, metalness: 0 });
  for (const side of [-1, 1]) {
    // Ears have a lobe, pinna and folded helix rather than a separate spherical bead.
    parts.add(loftGeometry([[-0.054, 0.011, 0.009], [-0.038, 0.018, 0.012], [0, 0.023, 0.014], [0.042, 0.018, 0.01], [0.058, 0.008, 0.006]], { radial: 20, rows: 18 }), mats.skin, [x + side * 0.15, y - 0.015, z - 0.018]);
    parts.tube(mats.skin, [[x + side * 0.16, y - 0.055, z - 0.012], [x + side * 0.173, y - 0.02, z - 0.009], [x + side * 0.174, y + 0.033, z - 0.016], [x + side * 0.16, y + 0.042, z - 0.023]], 0.005, 16, 6);
    parts.tube(crease, [[x + side * 0.16, y - 0.035, z - 0.003], [x + side * 0.164, y - 0.005, z - 0.001], [x + side * 0.16, y + 0.017, z - 0.009]], 0.003, 12, 5);
    const ex = x + side * 0.069;
    parts.sphere(crease, [ex, y + 0.038, z + 0.108], [0.031, 0.012, 0.006], 16);
    parts.sphere(sclera, [ex, y + 0.038, z + 0.111], [0.025, 0.008, 0.004], 16);
    parts.sphere(eyes, [ex, y + 0.038, z + 0.115], [0.009, 0.007, 0.004], 16);
    parts.tube(mats.skin, [[ex - 0.028, y + 0.038, z + 0.107], [ex, y + 0.047, z + 0.116], [ex + 0.028, y + 0.038, z + 0.107]], 0.004, 12, 5);
    parts.tube(mats.skin, [[ex - 0.027, y + 0.037, z + 0.108], [ex, y + 0.031, z + 0.115], [ex + 0.027, y + 0.037, z + 0.108]], 0.003, 12, 5);
    parts.tube(crease, [[x + side * 0.035, y + 0.071, z + 0.139], [x + side * 0.07, y + 0.077, z + 0.136], [x + side * 0.104, y + 0.066, z + 0.125]], 0.004, 12, 5);
    parts.sphere(mats.skin, [x + side * 0.014, y - 0.035, z + 0.162], [0.012, 0.009, 0.01], 16);
    parts.sphere(crease, [x + side * 0.014, y - 0.041, z + 0.166], [0.004, 0.003, 0.002], 12);
  }
  // The mouth is a neutral volumetric lip pair with a recessed, short opening.
  parts.add(sweptLimb([[x - 0.036, y - 0.105, z + 0.14, 0.002], [x - 0.012, y - 0.101, z + 0.151, 0.005], [x, y - 0.104, z + 0.155, 0.003], [x + 0.012, y - 0.101, z + 0.151, 0.005], [x + 0.036, y - 0.105, z + 0.14, 0.002]], 8, 20), lips);
  parts.add(sweptLimb([[x - 0.035, y - 0.109, z + 0.141, 0.0015], [x, y - 0.115, z + 0.152, 0.005], [x + 0.035, y - 0.109, z + 0.141, 0.0015]], 8, 16), lips);
  parts.tube(crease, [[x - 0.03, y - 0.107, z + 0.145], [x, y - 0.108, z + 0.155], [x + 0.03, y - 0.107, z + 0.145]], 0.0015, 14, 5);
}
function addRifle(parts, mats, smartgun = false) {
  const x = 0.3, y = 2.1;
  parts.add(loftGeometry([[-0.12, 0.04, 0.04, 0, 0], [0.03, 0.075, 0.08, 0, 0], [0.52, 0.073, 0.082, 0, 0], [0.83, 0.045, 0.052, 0, 0]], { axis: 'z', radial: 24, rows: 24, superellipse: 4 }), mats.dark, [x, y, 0.47]);
  parts.box(mats.armor, [x, y + 0.02, 0.84], [0.17, 0.13, 0.5], true);
  parts.box(mats.rubber, [x, y - 0.08, 0.48], [0.1, 0.23, 0.17], true, [0.18, 0, 0]);
  parts.box(mats.dark, [x, y - 0.05, 0.25], [0.13, 0.2, 0.25], true);
  parts.cylinder(mats.dark, [x, y, 1.49], [0.033, 0.04], 0.4, [Math.PI / 2, 0, 0], 32);
  parts.cylinder(mats.steel, [x, y, 1.7], [0.048, 0.048], 0.09, [Math.PI / 2, 0, 0], 32);
  parts.box(mats.dark, [x, y + 0.12, 0.84], [0.085, 0.065, 0.36], true);
  for (let slot = 0; slot < 6; slot++) parts.box(mats.steel, [x + 0.092, y + 0.02, 0.65 + slot * 0.08], [0.012, 0.035, 0.025]);
  if (smartgun) {
    parts.cylinder(mats.dark, [x, y - 0.16, 0.92], [0.15, 0.15], 0.19, [0, 0, Math.PI / 2], 32);
    parts.tube(mats.steel, [[0.02, 1.66, 0.01], [0.12, 1.76, 0.2], [x, 1.92, 0.8]], 0.027, 12, 8);
  } else parts.cylinder(mats.armor, [x, y - 0.14, 1.03], [0.08, 0.08], 0.4, [Math.PI / 2, 0, 0], 32);
}

// Functional silhouettes for the three actual human weapon types. These are
// in-game interpretations, not scans or proportion-verified film props.
function addFlamethrower(parts, mats) {
  const x = 0.30, y = 2.10;
  parts.box(mats.dark, [x, y, 0.70], [0.22, 0.21, 0.90], true);
  parts.box(mats.armor, [x, y + 0.12, 0.88], [0.22, 0.09, 0.42], true);
  parts.cylinder(mats.dark, [x, y + 0.01, 1.30], [0.095, 0.105], 0.57, [Math.PI / 2, 0, 0], 24);
  parts.cylinder(mats.steel, [x, y + 0.01, 1.63], [0.12, 0.12], 0.17, [Math.PI / 2, 0, 0], 24);
  parts.cylinder(mats.dark, [x, y + 0.01, 1.74], [0.065, 0.065], 0.025, [Math.PI / 2, 0, 0], 24);
  parts.box(mats.rubber, [x, y - 0.17, 0.48], [0.10, 0.35, 0.15], true);
  for (const side of [-1, 1]) {
    parts.cylinder(mats.armor, [side * 0.21, 2.13, -0.45], [0.13, 0.13], 0.76, [0, 0, 0], 20);
    parts.cylinder(mats.steel, [side * 0.21, 2.53, -0.45], [0.14, 0.14], 0.075, [0, 0, 0], 20);
  }
  parts.tube(mats.rubber, [[0.22, 1.85, -0.51], [0.58, 1.84, -0.22], [0.57, 1.96, 0.42], [x, 2.04, 0.85]], 0.036, 26, 10);
  parts.box(mats.armor, [0, 2.16, -0.65], [0.58, 0.87, 0.24], true);
}

export function createMarineModel(smartgunner = true) {
  const weaponKind = typeof smartgunner === 'string' ? smartgunner : smartgunner ? 'smartgunner' : 'flametrooper';
  if (!['marine', 'smartgunner', 'flametrooper'].includes(weaponKind)) throw new RangeError('Unknown Marine weapon silhouette');
  const mats = surfaces(weaponKind === 'smartgunner' ? 0x65715f : 0x766d54), parts = new Assembly('colonial-marine');
  addHumanTorso(parts, mats); addHumanLegs(parts, mats); addArms(parts, mats); addFace(parts, mats);
  // Fitted ballistic vest follows the chest profile; thin plates stay over the body.
  parts.add(loftGeometry([[1.74, 0.305, 0.235], [1.97, 0.31, 0.25], [2.2, 0.375, 0.275], [2.43, 0.43, 0.285], [2.62, 0.445, 0.26], [2.72, 0.4, 0.23]], { radial: 36, rows: 26, superellipse: 2.5 }), mats.armor);
  for (const side of [-1, 1]) {
    parts.tube(mats.rubber, [[side * 0.25, 2.76, -0.16], [side * 0.29, 2.7, 0.2], [side * 0.24, 2.23, 0.29], [side * 0.2, 1.98, 0.23]], 0.025, 20, 6);
    parts.box(mats.cloth, [side * 0.21, 1.9, 0.22], [0.16, 0.22, 0.09], true);
  }
  // Open helmet leaves a sculpted adult face and jaw visible.
  parts.add(loftGeometry([[3.25, 0.161, 0.168, 0, -0.014], [3.3, 0.174, 0.18, 0, -0.014], [3.37, 0.145, 0.15, 0, -0.02], [3.43, 0.075, 0.075, 0, -0.025], [3.445, 0.014, 0.014, 0, -0.025]], { radial: 40, rows: 24 }), mats.armor);
  parts.box(mats.armor, [0, 3.256, 0.148], [0.345, 0.022, 0.078], true, [-0.08, 0, 0]);
  parts.cylinder(mats.dark, [0.187, 3.18, -0.01], [0.045, 0.045], 0.04, [0, 0, Math.PI / 2], 24);
  parts.box(glow(0x9a594b), [0.13, 3.22, 0.19], [0.038, 0.018, 0.025], true);
  if (weaponKind === 'flametrooper') addFlamethrower(parts, mats);
  else addRifle(parts, mats, weaponKind === 'smartgunner');
  const group = parts.finish(); group.userData.anatomy = { headHeight: 0.46, standingHeight: 3.44, headsTall: 7.48 };
  group.userData.weaponKind = weaponKind;
  group.userData.visualFidelity1to1Verified = false;
  return group;
}

export function createSyntheticModel() {
  const mats = surfaces(0xb9c4c0), group = new THREE.Group(); group.name = 'combat-synthetic';
  mats.skin.color.set(0xc3b5a2);
  const torso = new Assembly('torso');
  addHumanTorso(torso, mats); addArms(torso, mats);
  torso.add(loftGeometry([[1.76, 0.31, 0.23], [2.05, 0.33, 0.27], [2.42, 0.43, 0.285], [2.62, 0.445, 0.26], [2.72, 0.39, 0.22]], { radial: 36, rows: 28, superellipse: 2.3 }), mats.armor);
  for (let rib = 0; rib < 5; rib++) torso.box(mats.dark, [0, 2.1 + rib * 0.075, 0.273], [0.34, 0.02, 0.012], true);
  const body = torso.finish();
  body.traverse(mesh => { if (mesh.isMesh) mesh.geometry.translate(0, -1.8, 0); });
  body.position.y = 1.8; group.add(body);
  const head = new Assembly('head'); addFace(head, mats, [0, 0, 0]);
  const headGroup = head.finish(); headGroup.position.set(0, 3.18, 0.01); group.add(headGroup);
  const visor = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.15, 4, 12), glow(0x93bfc2));
  visor.name = 'visor'; visor.rotation.z = Math.PI / 2; visor.position.set(0, 3.22, 0.16); group.add(visor);
  const legs = new Assembly('legs'); addHumanLegs(legs, mats);
  const detachableLegs = legs.finish();
  detachableLegs.traverse(mesh => { if (mesh.isMesh) mesh.material = mesh.material.clone(); }); group.add(detachableLegs);
  const gunParts = new Assembly('gun');
  gunParts.box(mats.dark, [0, 0, 0], [0.095, 0.13, 0.42], true);
  gunParts.cylinder(mats.steel, [0, 0.035, 0.25], [0.027, 0.027], 0.1, [Math.PI / 2, 0, 0], 32);
  const gun = gunParts.finish(); gun.position.set(0.3, 2.1, 0.65); group.add(gun);
  group.userData.anatomy = { headHeight: 0.46, standingHeight: 3.41, headsTall: 7.41 };
  return group;
}

export function createHonorGuardModel(index = 0) {
  const mats = surfaces(index % 2 ? 0x746b59 : 0x687575), parts = new Assembly('yautja-honor-guard');
  mats.skin = createSurfaceMaterial('skin', { color: 0xa28d69, roughness: 0.6, normalScale: new THREE.Vector2(0.35, 0.35) });
  const hide = mats.skin, bone = createSurfaceMaterial('bone', { color: 0xb8af91, roughness: 0.55 });
  addHumanTorso(parts, { ...mats, cloth: hide }, true);
  addHumanLegs(parts, { ...mats, cloth: hide });
  for (const side of [-1, 1]) {
    parts.add(sweptLimb([[side * 0.46, 2.72, 0, 0.19, 0.2], [side * 0.58, 2.43, 0, 0.19, 0.18], [side * 0.57, 2.12, 0.03, 0.12, 0.12], [side * 0.54, 1.89, 0.08, 0.15, 0.12], [side * 0.49, 1.64, 0.13, 0.085, 0.08]], 32, 30), hide);
    parts.add(loftGeometry([[2.37, 0.09, 0.05], [2.46, 0.19, 0.08], [2.66, 0.21, 0.11], [2.8, 0.11, 0.07]], { radial: 32, rows: 18 }), mats.armor, [side * 0.44, 0, 0.23]);
    parts.add(sweptLimb([[side * 0.54, 1.7, 0.1, 0.12, 0.12], [side * 0.56, 1.9, 0.07, 0.17, 0.15], [side * 0.57, 2.04, 0.03, 0.13, 0.11]], 24, 16), mats.armor);
    addHand(parts, mats, side * 0.49, 1.61, 0.13, side);
    parts.sphere(mats.armor, [side * 0.48, 2.71, -0.015], [0.24, 0.17, 0.25], 32);
  }
  parts.add(sculptedFaceGeometry({ width: 0.17, height: 0.23, depth: 0.18, mask: true }), mats.armor, [0, 3.18, 0.015]);
  const optics = glow(0xad6f4e);
  for (const side of [-1, 1]) {
    parts.tube(mats.dark, [[side * 0.029, 3.225, 0.17], [side * 0.075, 3.24, 0.18], [side * 0.126, 3.21, 0.135]], 0.018, 12, 6);
    parts.tube(optics, [[side * 0.04, 3.226, 0.185], [side * 0.075, 3.228, 0.19], [side * 0.112, 3.216, 0.159]], 0.006, 12, 5);
    parts.tube(mats.dark, [[side * 0.05, 3.11, 0.195], [side * 0.092, 3.04, 0.16], [side * 0.12, 3.01, 0.11]], 0.012, 12, 6);
  }
  for (let vent = 0; vent < 4; vent++) parts.box(mats.dark, [(vent - 1.5) * 0.028, 3.055, 0.185], [0.012, 0.055, 0.01], true);
  for (let dread = 0; dread < 14; dread++) {
    const angle = dread / 13 * Math.PI + Math.PI;
    const x = Math.cos(angle) * 0.17, z = Math.sin(angle) * 0.16 - 0.055;
    parts.add(sweptLimb([[x, 3.32, z, 0.024], [x * 1.5, 3.17, z - 0.05, 0.026], [x * 1.75, 2.89, z - 0.05, 0.022], [x * 1.7, 2.65, z - 0.02, 0.006]], 8, 20), mats.rubber);
    parts.cylinder(bone, [x * 1.74, 2.83, z - 0.043], [0.028, 0.028], 0.06, [0, 0, -x * 0.1], 12);
  }
  for (let blade = 0; blade < 2; blade++) parts.add(loftGeometry([[0.16, 0.022, 0.012], [0.35, 0.026, 0.012], [0.82, 0.018, 0.006], [1.0, 0.001, 0.001]], { axis: 'z', radial: 12, rows: 16, superellipse: 3 }), mats.steel, [0.46 + blade * 0.09, 1.61, 0]);
  parts.add(loftGeometry([[-0.34, 0.08, 0.09], [-0.15, 0.13, 0.12], [0.21, 0.105, 0.1], [0.31, 0.07, 0.07]], { axis: 'z', radial: 28, rows: 22, superellipse: 3 }), mats.armor, [-0.47, 2.9, 0]);
  parts.cylinder(optics, [-0.47, 2.9, 0.315], [0.039, 0.039], 0.018, [Math.PI / 2, 0, 0], 24);
  for (const side of [-1, 1]) parts.tube(mats.rubber, [[side * 0.19, 2.85, -0.1], [side * 0.25, 2.64, 0.25], [-side * 0.12, 2.02, 0.24], [-side * 0.21, 1.62, 0.2]], 0.024, 24, 8);
  const group = parts.finish(); group.scale.setScalar(1.2);
  group.userData.anatomy = { headHeight: 0.552, standingHeight: 4.1, headsTall: 7.43 };
  return group;
}

export function createHoundModel(skin, spike) {
  const parts = new Assembly('hunting-hound'), jaw = createSurfaceMaterial('bone', { color: 0xc4b28c, roughness: 0.5 });
  parts.add(loftGeometry([[-1.22, 0.12, 0.16, 0, 1.1], [-0.91, 0.43, 0.49, 0, 1.08], [-0.45, 0.44, 0.45, 0, 1.12], [0, 0.39, 0.39, 0, 1.13], [0.56, 0.58, 0.62, 0, 1.25], [0.92, 0.46, 0.54, 0, 1.32], [1.12, 0.24, 0.3, 0, 1.4]], { axis: 'z', radial: 48, rows: 44, muscle: 0.03 }), skin);
  parts.add(loftGeometry([[0.86, 0.25, 0.27, 0, 1.45], [1.16, 0.38, 0.32, 0, 1.58], [1.48, 0.35, 0.24, 0, 1.52], [1.86, 0.23, 0.14, 0, 1.42], [2.12, 0.16, 0.12, 0, 1.38]], { axis: 'z', radial: 40, rows: 32 }), skin);
  parts.add(loftGeometry([[1.0, 0.17, 0.09, 0, 1.2], [1.38, 0.26, 0.08, 0, 1.14], [1.81, 0.23, 0.065, 0, 1.19], [2.1, 0.13, 0.055, 0, 1.23]], { axis: 'z', radial: 28, rows: 24 }), skin);
  const mouth = createSurfaceMaterial('leather', { color: 0x221b19, roughness: 0.9 });
  parts.add(loftGeometry([[1.22, 0.19, 0.025, 0, 1.29], [1.7, 0.24, 0.035, 0, 1.3], [2.1, 0.14, 0.025, 0, 1.3]], { axis: 'z', radial: 20, rows: 16 }), mouth);
  for (const side of [-1, 1]) {
    parts.sphere(spike, [side * 0.29, 1.66, 1.44], [0.035, 0.025, 0.05]);
    parts.tube(skin, [[side * 0.24, 1.73, 1.26], [side * 0.31, 1.73, 1.43], [side * 0.29, 1.67, 1.58]], 0.045, 16, 8);
    for (let tooth = 0; tooth < 7; tooth++) {
      const z = 1.33 + tooth * 0.1;
      parts.add(sweptLimb([[side * (0.23 - tooth * 0.008), 1.36, z, 0.035], [side * (0.2 - tooth * 0.007), 1.21, z + 0.03, 0.003]], 8, 6), jaw);
    }
    for (const front of [-1, 1]) {
      const z = front * 0.73, hipY = front > 0 ? 1.3 : 1.15;
      parts.add(sweptLimb([[side * 0.45, hipY, z, 0.25, 0.23], [side * 0.53, 0.86, z - front * 0.18, 0.2, 0.18], [side * 0.61, 0.55, z + front * 0.08, 0.115, 0.13], [side * 0.6, 0.17, z + 0.18, 0.08, 0.1]], 28, 28), skin);
      parts.add(loftGeometry([[z - 0.02, 0.08, 0.08, 0, 0.11], [z + 0.16, 0.18, 0.12, 0, 0.12], [z + 0.44, 0.16, 0.08, 0, 0.08], [z + 0.54, 0.05, 0.04, 0, 0.06]], { axis: 'z', radial: 24, rows: 16 }), skin, [side * 0.6, 0, 0]);
      for (let claw = 0; claw < 3; claw++) parts.add(sweptLimb([[side * 0.6 + (claw - 1) * 0.1, 0.11, z + 0.4, 0.033], [side * 0.6 + (claw - 1) * 0.1, 0.075, z + 0.58, 0.018], [side * 0.6 + (claw - 1) * 0.1, 0.025, z + 0.66, 0.002]], 8, 8), jaw);
    }
  }
  for (let row = -3; row <= 3; row++) {
    const z = row * 0.29;
    parts.add(sweptLimb([[0, 1.57, z, 0.1], [0, 1.91, z - 0.12, 0.064], [0, 2.25 - Math.abs(row) * 0.1, z - 0.37, 0.002]], 10, 12), spike);
    for (const side of [-1, 1]) parts.add(sweptLimb([[side * 0.43, 1.45, z, 0.065], [side * 0.72, 1.67, z - 0.07, 0.04], [side * 0.98, 1.82, z - 0.21, 0.002]], 8, 10), spike);
  }
  parts.add(sweptLimb([[0, 1.15, -1.1, 0.12], [0.12, 0.96, -1.6, 0.09], [0.3, 0.7, -2.05, 0.055], [0.35, 0.6, -2.4, 0.003]], 18, 30), skin);
  return parts.finish();
}

function addPanelBolts(parts, material, x, y, z, width, height) {
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) parts.cylinder(material, [x + dx * width * 0.4, y + dy * height * 0.4, z], [0.035, 0.035], 0.03, [Math.PI / 2, 0, 0], 6);
}
function addThruster(parts, mats, x, y, z, radius = 0.7, direction = -1) {
  const glowMat = glow(0xf3883d);
  parts.cylinder(mats.dark, [x, y, z], [radius, radius * 0.92], radius * 1.5, [Math.PI / 2, 0, 0], 20);
  parts.cylinder(mats.steel, [x, y, z + direction * radius * 0.72], [radius * 0.94, radius * 0.94], radius * 0.1, [Math.PI / 2, 0, 0], 20);
  parts.cylinder(glowMat, [x, y, z + direction * radius * 0.78], [radius * 0.67, radius * 0.67], 0.03, [Math.PI / 2, 0, 0], 20);
  for (let fin = 0; fin < 8; fin++) {
    const angle = fin * Math.PI / 4;
    parts.box(mats.dark, [x + Math.cos(angle) * radius * 0.38, y + Math.sin(angle) * radius * 0.38, z + direction * radius * 0.8], [radius * 0.58, 0.04, 0.04], false, [0, 0, angle]);
  }
}

export function createAPCModel() {
  return buildAPCModel(Assembly);
}

export function createDropPodModel() {
  return buildInsertionPodModel(Assembly);
}

export function createDropshipModel() {
  const mats = surfaces(0x4f5c50), parts = new Assembly('cheyenne-dropship'), glass = windowMaterial();
  parts.add(loftGeometry([[-6.2, 1.2, 0.7, 0, 1.2], [-5.7, 1.8, 1.05, 0, 1.2], [-2.8, 1.96, 1.2, 0, 1.2], [0.6, 1.95, 1.2, 0, 1.2], [3.2, 1.72, 1.1, 0, 1.2], [5.0, 1.48, 0.93, 0, 1.1], [6.8, 0.83, 0.56, 0, 0.96], [7.6, 0.14, 0.24, 0, 0.84]], { axis: 'z', radial: 64, rows: 76, superellipse: 2.8 }), mats.armor);
  parts.add(loftGeometry([[3.4, 0.9, 0.1, 0, 2.11], [4.1, 1.18, 0.44, 0, 2.08], [5.3, 1.12, 0.48, 0, 1.97], [6.4, 0.6, 0.19, 0, 1.65], [6.9, 0.1, 0.06, 0, 1.45]], { axis: 'z', radial: 40, rows: 32, superellipse: 2.2 }), glass);
  parts.tube(mats.dark, [[0, 2.52, 4.15], [0, 2.49, 5.2], [0, 1.88, 6.4]], 0.04, 24, 8);
  parts.box(mats.dark, [0, 1.65, 6.46], [0.075, 0.46, 0.075], true, [-0.24, 0, 0]);
  // Shoulder intakes and cockpit framing follow the visible UD-4L silhouette
  // cues in NECA's official miniature photographs; this remains a local model.
  for (const side of [-1, 1]) {
    parts.add(loftGeometry([[-0.8, 0.2, 0.14], [-0.3, 0.47, 0.34], [1.8, 0.52, 0.37], [2.9, 0.44, 0.31], [3.22, 0.37, 0.26]], { axis: 'z', radial: 24, rows: 24, superellipse: 3.6 }), mats.armor, [side * 1.48, 2.22, 0]);
    parts.box(mats.dark, [side * 1.48, 2.25, 3.24], [0.65, 0.43, 0.035]);
    for (let vane = 0; vane < 5; vane++) parts.box(mats.steel, [side * 1.48, 2.08 + vane * 0.08, 3.27], [0.58, 0.025, 0.09], false, [-0.24, 0, 0]);
    parts.tube(mats.dark, [[side * 0.73, 2.33, 4.2], [side * 0.74, 2.3, 5.0], [side * 0.43, 1.96, 6.1], [side * 0.14, 1.57, 6.65]], 0.045, 20, 6);
    parts.tube(mats.dark, [[side * 0.06, 2.49, 4.75], [side * 0.76, 2.28, 4.75]], 0.035, 8, 6);
    parts.box(mats.dark, [side * 1.97, 1.33, -0.55], [0.045, 1.2, 2.25]);
    parts.box(mats.armor, [side * 2.01, 1.33, -0.55], [0.06, 1.06, 2.08]);
    parts.box(mats.steel, [side * 2.06, 1.46, 0.15], [0.045, 0.06, 0.32]);
    for (let fastener = 0; fastener < 4; fastener++) parts.cylinder(mats.steel, [side * 2.055, 0.92 + (fastener % 2) * 0.81, -1.35 + Math.floor(fastener / 2) * 1.59], [0.035, 0.035], 0.04, [0, 0, Math.PI / 2], 6);
  }
  for (const side of [-1, 1]) {
    parts.add(loftGeometry([[-1.4, 0.1, 0.03], [-1.2, 1.35, 0.11], [0.2, 1.6, 0.17], [1.2, 1.3, 0.1], [1.4, 0.07, 0.02]], { axis: 'z', radial: 32, rows: 32, superellipse: 2.4 }), mats.armor, [side * 3.1, 1.1, -0.3], [1, 1, 1], [0, side * 0.25, side * 0.025]);
    parts.box(mats.armor, [side * 4.5, 0.8, 0.6], [1.5, 1.3, 3.8], true);
    for (let rocket = 0; rocket < 6; rocket++) {
      parts.cylinder(mats.dark, [side * (4.2 + rocket % 2 * 0.6), 0.38 + Math.floor(rocket / 2) * 0.4, 2.52], [0.16, 0.16], 0.1, [Math.PI / 2, 0, 0]);
      parts.cylinder(mats.steel, [side * (4.2 + rocket % 2 * 0.6), 0.38 + Math.floor(rocket / 2) * 0.4, 2.48], [0.19, 0.19], 0.13, [Math.PI / 2, 0, 0]);
    }
    addThruster(parts, mats, side * 1.65, 1.5, -6.05, 0.82);
    // A swept bifid tail replaces the tall rectangular boards on the old hull.
    const stabilizer = new THREE.Shape();
    stabilizer.moveTo(0, 0.8); stabilizer.lineTo(side * 0.7, 0.5);
    stabilizer.lineTo(side * 3.1, -0.8); stabilizer.lineTo(side * 3.35, -1.35);
    stabilizer.lineTo(side * 0.35, -0.8); stabilizer.closePath();
    const stabilizerGeometry = new THREE.ExtrudeGeometry(stabilizer, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, steps: 1 });
    stabilizerGeometry.rotateX(Math.PI / 2);
    parts.add(stabilizerGeometry, mats.armor, [0, 1.7, -8.0]);
    const fin = new THREE.Shape();
    fin.moveTo(-1.1, 0); fin.lineTo(-0.65, 0.1); fin.lineTo(0.65, 1.25);
    fin.lineTo(1.15, 1.35); fin.lineTo(0.65, 0.05); fin.closePath();
    const finGeometry = new THREE.ExtrudeGeometry(fin, { depth: 0.09, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 1, steps: 1 });
    finGeometry.rotateY(Math.PI / 2);
    parts.add(finGeometry, mats.armor, [side * 1.6, 1.72, -8.1]);
    for (let panel = 0; panel < 4; panel++) parts.box(mats.dark, [side * 2.015, 1.22, -4.1 + panel * 1.6], [0.035, 1.45, 0.055]);
    parts.box(mats.dark, [side * 1.1, -0.18, -1.8], [0.55, 0.26, 5.8], true);
  }
  parts.add(loftGeometry([[-9.65, 0.05, 0.04, 0, 1.6], [-8.5, 0.32, 0.21, 0, 1.6], [-7.3, 0.48, 0.35, 0, 1.5], [-5.9, 1.02, 0.58, 0, 1.36]], { axis: 'z', radial: 24, rows: 24, superellipse: 3.4 }), mats.armor);
  for (let vent = 0; vent < 7; vent++) parts.box(mats.dark, [(vent - 3) * 0.28, 2.53, -2.8], [0.12, 0.045, 1.3]);
  parts.box(mats.dark, [0, 0.6, 7.01], [0.7, 0.4, 0.55], true);
  for (const side of [-1, 1]) parts.box(glow(0xb1d7c0), [side * 1.4, 1.0, 6.52], [0.3, 0.16, 0.05]);
  return parts.finish();
}

export function createSkimmerModel() {
  const mats = surfaces(0x67717a), parts = new Assembly('yautja-skimmer');
  const cannonMaterial = glow(0x76b8c2); cannonMaterial.name = 'skimmer-cannon-charge'; cannonMaterial.emissiveIntensity = 0.2;
  parts.add(loftGeometry([[-2.8, 0.07, 0.06, 0, 0.56], [-2.4, 0.38, 0.13, 0, 0.56], [-1.6, 0.78, 0.2, 0, 0.55], [-0.35, 0.87, 0.24, 0, 0.52], [0.7, 0.78, 0.29, 0, 0.53], [1.7, 0.65, 0.31, 0, 0.55], [2.3, 0.45, 0.2, 0, 0.55]], { axis: 'z', radial: 64, rows: 72, superellipse: 2.6 }), mats.armor);
  parts.add(loftGeometry([[-1.2, 0.12, 0.06, 0, 0.81], [-0.8, 0.39, 0.17, 0, 0.86], [-0.15, 0.37, 0.18, 0, 0.88], [0.65, 0.24, 0.08, 0, 0.88]], { axis: 'z', radial: 32, rows: 32 }), windowMaterial());
  parts.add(loftGeometry([[0.02, 0.26, 0.06, 0, 0.82], [0.4, 0.31, 0.08, 0, 0.86], [0.85, 0.28, 0.22, 0, 0.94], [1.0, 0.12, 0.27, 0, 0.98]], { axis: 'z', radial: 32, rows: 24, superellipse: 3 }), mats.rubber);
  for (const side of [-1, 1]) {
    parts.add(loftGeometry([[-2.05, 0.08, 0.07, 0, 0.58], [-1.75, 0.18, 0.16, 0, 0.56], [0.15, 0.22, 0.16, 0, 0.53], [1.45, 0.15, 0.2, 0, 0.55], [1.85, 0.05, 0.1, 0, 0.55]], { axis: 'z', radial: 32, rows: 36 }), mats.armor, [side * 0.91, 0, 0], [1, 1, 1], [0, side * 0.06, 0]);
    parts.cylinder(mats.dark, [side * 0.72, 0.57, -2.14], [0.095, 0.14], 1.3, [Math.PI / 2, 0, 0], 40);
    parts.cylinder(cannonMaterial, [side * 0.72, 0.57, -2.81], [0.065, 0.065], 0.025, [Math.PI / 2, 0, 0], 32);
    for (let slat = 0; slat < 7; slat++) parts.box(mats.dark, [side * 0.78, 0.82, 0.05 + slat * 0.19], [0.18, 0.025, 0.06], true, [0, side * 0.12, 0]);
    parts.tube(mats.dark, [[side * 0.42, 0.8, -1.5], [side * 0.54, 0.83, -0.6], [side * 0.47, 0.87, 0.34], [side * 0.38, 0.89, 1.12]], 0.012, 32, 6);
    // Layered skid plates and separate pressure lines break up the former smooth
    // hull without adding a draw call for every fastener and panel.
    parts.add(loftGeometry([[-1.8, 0.04, 0.025], [-1.4, 0.12, 0.04], [0.6, 0.13, 0.04], [1.4, 0.035, 0.025]], { axis: 'z', radial: 16, rows: 16, superellipse: 3 }), mats.dark, [side * 1.08, 0.44, 0]);
    for (let panel = 0; panel < 4; panel++) {
      const z = -1.35 + panel * 0.65;
      parts.box(mats.steel, [side * 0.98, 0.7, z], [0.09, 0.055, 0.4], false, [0, 0, side * 0.2]);
      parts.cylinder(mats.dark, [side * 0.98, 0.74, z - 0.13], [0.025, 0.025], 0.016, [0, 0, 0], 6);
      parts.cylinder(mats.dark, [side * 0.98, 0.74, z + 0.13], [0.025, 0.025], 0.016, [0, 0, 0], 6);
    }
    parts.tube(mats.steel, [[side * 0.48, 0.38, -1.1], [side * 0.69, 0.31, -0.8], [side * 0.73, 0.31, 0.95], [side * 0.44, 0.43, 1.65]], 0.023, 24, 6);
    for (const z of [-1.8, 1.3]) {
      parts.cylinder(mats.dark, [side * 0.72, 0.3, z], [0.2, 0.23], 0.13, [0, 0, 0], 24);
      parts.cylinder(mats.steel, [side * 0.72, 0.225, z], [0.145, 0.145], 0.025, [0, 0, 0], 24);
      for (let vane = 0; vane < 6; vane++) parts.box(mats.dark, [side * 0.72, 0.205, z], [0.25, 0.025, 0.025], false, [0, vane * Math.PI / 6, 0]);
    }
    // Shrouds, receiver rings and recessed bores read as mechanisms rather than
    // glowing cylinders when the craft is viewed from its forward quarter.
    for (const z of [-1.75, -2.1, -2.45]) parts.cylinder(mats.steel, [side * 0.72, 0.57, z], [0.15, 0.15], 0.045, [Math.PI / 2, 0, 0], 24);
    parts.add(new THREE.TorusGeometry(0.095, 0.028, 8, 24), mats.dark, [side * 0.72, 0.57, -2.84]);
  }
  const exhaustMaterial = glow(0x6aafb8); exhaustMaterial.name = 'skimmer-exhaust'; exhaustMaterial.emissiveIntensity = 0.65;
  parts.cylinder(mats.dark, [0, 0.6, 2.15], [0.43, 0.38], 0.68, [Math.PI / 2, 0, 0], 32);
  parts.add(new THREE.TorusGeometry(0.35, 0.06, 8, 32), mats.steel, [0, 0.6, 2.51]);
  parts.cylinder(exhaustMaterial, [0, 0.6, 2.49], [0.27, 0.27], 0.025, [Math.PI / 2, 0, 0], 32);
  for (let fin = 0; fin < 12; fin++) {
    const angle = fin * Math.PI / 6;
    parts.box(mats.dark, [Math.cos(angle) * 0.35, 0.6 + Math.sin(angle) * 0.35, 2.31], [0.14, 0.035, 0.4], false, [0, 0, angle]);
  }
  // The sculpt was authored nose-first along -Z. Keep a distinct visual pivot so
  // the gameplay root's +Z remains the same for movement, aiming and collisions.
  const group = new THREE.Group(); group.name = 'yautja-skimmer';
  const visual = parts.finish(); visual.name = 'skimmer-visual'; visual.rotation.y = Math.PI;
  group.add(visual);
  group.userData.forwardAxis = '+Z';
  group.userData.cannonMuzzles = [[-0.72, 0.57, 2.86], [0.72, 0.57, 2.86]];
  group.userData.exhaustPosition = [0, 0.6, -2.51];
  return group;
}

export function addSentryMechanicalDetails(swivel) {
  const mats = surfaces(0x758077), parts = new Assembly('sentry-mechanical-details');
  const receiver = swivel.children.find(child => child.geometry?.type === 'BoxGeometry' && child.geometry.parameters.width === 0.4 && child.geometry.parameters.depth === 0.7);
  if (receiver) { swivel.remove(receiver); receiver.geometry.dispose(); receiver.material.dispose(); }
  parts.add(loftGeometry([[-0.43, 0.13, 0.1], [-0.33, 0.24, 0.18], [0.1, 0.23, 0.18], [0.39, 0.16, 0.12]], { axis: 'z', radial: 40, rows: 28, superellipse: 3 }), mats.armor, [0, 0.02, 0]);
  for (const side of [-1, 1]) {
    parts.box(mats.dark, [side * 0.25, -0.03, -0.03], [0.06, 0.22, 0.48], true);
    for (let vent = 0; vent < 7; vent++) parts.box(mats.steel, [side * 0.285, 0.03, -0.24 + vent * 0.075], [0.015, 0.12, 0.025], true);
    parts.cylinder(mats.steel, [side * 0.1, 0, 0.75], [0.045, 0.055], 0.5, [Math.PI / 2, 0, 0], 32);
    parts.cylinder(mats.dark, [side * 0.1, 0, 1.01], [0.039, 0.039], 0.05, [Math.PI / 2, 0, 0], 32);
    for (let fin = 0; fin < 4; fin++) parts.cylinder(mats.steel, [side * 0.1, 0, 0.51 + fin * 0.1], [0.063, 0.063], 0.025, [Math.PI / 2, 0, 0], 32);
  }
  parts.tube(mats.rubber, [[-0.25, -0.1, -0.25], [-0.37, -0.32, -0.2], [-0.32, -0.4, 0.14]], 0.025, 18, 10);
  swivel.add(parts.finish());
}

export function addDroneMechanicalDetails(group, leftWing, rightWing) {
  // Replace the previous box wings/conical body while keeping the animated wing pivots.
  const geometries = new Set(), materials = new Set();
  group.traverse(mesh => { if (mesh.isMesh) { geometries.add(mesh.geometry); materials.add(mesh.material); } });
  group.clear(); leftWing.clear(); rightWing.clear();
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  group.add(leftWing, rightWing);
  const mats = surfaces(0x6d7a7f), parts = new Assembly('falcon-detail');
  parts.add(loftGeometry([[-0.95, 0.1, 0.075], [-0.65, 0.23, 0.14], [-0.15, 0.28, 0.17], [0.4, 0.24, 0.15], [0.9, 0.13, 0.095], [1.35, 0.012, 0.03, 0, -0.08]], { axis: 'z', radial: 40, rows: 40 }), mats.armor);
  parts.add(loftGeometry([[0.56, 0.06, 0.025, 0, 0.13], [0.78, 0.11, 0.035, 0, 0.13], [1.02, 0.05, 0.015, 0, 0.1]], { axis: 'z', radial: 24, rows: 20 }), windowMaterial());
  for (const side of [-1, 1]) {
    parts.cylinder(mats.dark, [side * 0.23, -0.13, 0.34], [0.042, 0.06], 0.63, [Math.PI / 2, 0, 0], 32);
    parts.cylinder(mats.steel, [side * 0.23, -0.13, 0.67], [0.05, 0.05], 0.07, [Math.PI / 2, 0, 0], 32);
    parts.add(sweptLimb([[side * 0.19, -0.12, 0.11, 0.025], [side * 0.28, -0.28, -0.08, 0.03], [side * 0.23, -0.39, 0.19, 0.008]], 12, 16), mats.dark);
    parts.box(glow(0x8d493a), [side * 0.11, 0.04, 0.9], [0.02, 0.015, 0.035], true);
  }
  addThruster(parts, mats, 0, 0, -0.82, 0.13);
  group.add(parts.finish());
  for (const [side, wing] of [[-1, leftWing], [1, rightWing]]) {
    const feathers = new Assembly('articulated-wing-panels');
    feathers.add(loftGeometry([[0, 0.22, 0.055], [0.35, 0.35, 0.055], [0.85, 0.29, 0.04, -0.08], [1.43, 0.12, 0.025, -0.21], [1.72, 0.006, 0.004, -0.28]], { axis: 'z', radial: 32, rows: 40 }), mats.armor, [0, 0, -0.1], [1, 1, 1], [0, side * Math.PI / 2, 0]);
    for (let panel = 0; panel < 5; panel++) {
      const span = 0.3 + panel * 0.25;
      feathers.add(loftGeometry([[-0.3, 0.07, 0.022], [0.02, 0.11, 0.03], [0.22, 0.07, 0.02], [0.33, 0.005, 0.005]], { axis: 'z', radial: 20, rows: 16 }), mats.dark, [side * span, -0.01, -0.27 - panel * 0.055], [1, 1, 1], [0, side * 0.13, 0]);
    }
    wing.add(feathers.finish());
  }
}

export function createSkullTrophy(kind, boneMaterial) {
  const parts = new Assembly(`${kind}-trophy`), cavity = createSurfaceMaterial('bone', { color: 0x25231f, roughness: 0.95 });
  if (kind === 'queen') {
    parts.add(loftGeometry([[-2.0, 0.04, 0.04, 0, 0.22], [-1.6, 1.25, 0.19, 0, 0.3], [-1.0, 1.3, 0.26, 0, 0.28], [-0.3, 0.8, 0.32, 0, 0.12], [0.5, 0.49, 0.35, 0, 0], [1.2, 0.3, 0.22, 0, -0.04], [1.5, 0.05, 0.05, 0, -0.08]], { axis: 'z', radial: 56, rows: 56 }), boneMaterial);
    for (let rib = -4; rib <= 4; rib++) {
      const x = rib * 0.25;
      parts.add(sweptLimb([[x * 0.2, 0.26, 0.35, 0.06], [x * 0.65, 0.47, -0.45, 0.075], [x, 0.51, -1.12, 0.055], [x * 1.1, 0.38, -1.7 + Math.abs(rib) * 0.09, 0.005]], 12, 24), boneMaterial);
    }
    parts.tube(cavity, [[-0.25, -0.15, 1.1], [0, -0.24, 1.45], [0.25, -0.15, 1.1]], 0.08, 28, 12);
    for (let tooth = 0; tooth < 12; tooth++) parts.add(sweptLimb([[(tooth - 5.5) * 0.045, -0.15, 1.3, 0.025], [(tooth - 5.5) * 0.041, -0.34, 1.38, 0.002]], 10, 8), boneMaterial);
  } else if (kind === 'trex') {
    parts.add(loftGeometry([[-0.7, 0.09, 0.11, 0, 0.26], [-0.45, 0.56, 0.58, 0, 0.25], [0.14, 0.62, 0.57, 0, 0.27], [0.7, 0.49, 0.41, 0, 0.18], [1.3, 0.43, 0.3, 0, 0.18], [2.0, 0.36, 0.25, 0, 0.12], [2.3, 0.21, 0.16, 0, 0.07]], { axis: 'z', radial: 56, rows: 56, superellipse: 2.5 }), boneMaterial);
    parts.add(loftGeometry([[0.1, 0.15, 0.1, 0, -0.45], [0.6, 0.3, 0.13, 0, -0.43], [1.5, 0.32, 0.1, 0, -0.35], [2.2, 0.15, 0.055, 0, -0.26]], { axis: 'z', radial: 32, rows: 36, superellipse: 2.5 }), boneMaterial);
    for (const side of [-1, 1]) {
      parts.sphere(cavity, [side * 0.57, 0.35, 0.29], [0.075, 0.24, 0.29], 32);
      parts.tube(boneMaterial, [[side * 0.55, 0.52, -0.06], [side * 0.64, 0.65, 0.26], [side * 0.5, 0.52, 0.71]], 0.075, 24, 12);
      parts.sphere(cavity, [side * 0.36, 0.2, 1.83], [0.035, 0.085, 0.13], 24);
      for (let tooth = 0; tooth < 12; tooth++) {
        const z = 0.38 + tooth * 0.15, width = 0.39 - tooth * 0.007;
        parts.add(sweptLimb([[side * width, -0.04, z, 0.045], [side * (width - 0.025), -0.25, z + 0.02, 0.028], [side * (width - 0.07), -0.36, z + 0.06, 0.002]], 10, 12), boneMaterial);
        parts.add(sweptLimb([[side * (width - 0.05), -0.33, z + 0.04, 0.033], [side * (width - 0.06), -0.17, z + 0.06, 0.002]], 10, 8), boneMaterial);
      }
    }
  } else {
    const elongation = kind === 'engineer' ? 1.18 : 1;
    const cranium = sculptedFaceGeometry({ width: 0.48, height: 0.59 * elongation, depth: 0.44, radial: 72, rows: 54 });
    const position = cranium.attributes.position, sourceIndices = cranium.index.array, kept = [];
    for (let triangle = 0; triangle < sourceIndices.length; triangle += 3) {
      const ids = [sourceIndices[triangle], sourceIndices[triangle + 1], sourceIndices[triangle + 2]];
      const x = ids.reduce((sum, id) => sum + position.getX(id), 0) / 3;
      const y = ids.reduce((sum, id) => sum + position.getY(id), 0) / 3;
      const z = ids.reduce((sum, id) => sum + position.getZ(id), 0) / 3;
      const orbit = ((Math.abs(x) - 0.195) / 0.145) ** 2 + ((y - 0.065) / 0.145) ** 2 < 1;
      const nasal = (x / 0.077) ** 2 + ((y + 0.12) / 0.13) ** 2 < 1;
      if (z > 0.2 && (orbit || nasal || y < -0.26)) continue;
      kept.push(...ids);
    }
    cranium.setIndex(kept); cranium.computeVertexNormals();
    parts.add(cranium, boneMaterial);
    for (const side of [-1, 1]) {
      parts.sphere(cavity, [side * 0.195, 0.065, 0.26], [0.145, 0.15, 0.08], 32);
      parts.tube(boneMaterial, [[side * 0.045, 0.21, 0.42], [side * 0.17, 0.26, 0.4], [side * 0.34, 0.18, 0.31]], 0.045, 24, 10);
      parts.tube(boneMaterial, [[side * 0.33, -0.04, 0.3], [side * 0.36, -0.18, 0.28], [side * 0.25, -0.25, 0.39]], 0.042, 24, 10);
    }
    parts.sphere(cavity, [0, -0.12, 0.3], [0.065, 0.12, 0.045], 24);
    parts.tube(boneMaterial, [[-0.37, -0.16, -0.04], [-0.37, -0.39, 0.15], [-0.25, -0.49, 0.36], [0, -0.5, 0.43], [0.25, -0.49, 0.36], [0.37, -0.39, 0.15], [0.37, -0.16, -0.04]], 0.065, 56, 14);
    for (let tooth = 0; tooth < 12; tooth++) {
      const angle = (tooth / 11 - 0.5) * Math.PI * 0.8, x = Math.sin(angle) * 0.29, z = Math.cos(angle) * 0.42;
      const height = tooth === 2 || tooth === 9 ? 0.12 : 0.085;
      parts.box(boneMaterial, [x, -0.28, z], [0.052, height, 0.065], true, [0.08, angle, 0]);
      parts.box(boneMaterial, [x * 0.93, -0.4, z * 0.96], [0.048, 0.072, 0.06], true, [-0.04, angle, 0]);
    }
  }
  return parts.finish();
}

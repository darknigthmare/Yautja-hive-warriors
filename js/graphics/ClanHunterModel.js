/* Original clan honor guard, anatomically guided by photographed Jungle Hunter
 * collectibles. This is a gameplay adaptation, not a scan or a certified film prop.
 * Source/proportion notes: docs/qa/fidelity-20261109/yautja/README.md.
 * Seven batched body surfaces + two instanced dread surfaces. All mutable pose
 * state belongs to one actor; the battle root and collision remain untouched. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Assembly } from './SupportAssembly.js';
import { loftGeometry, sweptLimb } from './SupportSculpt.js';
import { createSurfaceMaterial } from './SurfaceLibrary.js';

const visuals = new WeakMap();
// One CPU-only authored template per geometry. Templates are never attached to a
// scene or uploaded; every actor receives deep-cloned buffers and private poses.
let bodyTemplates = null;
let dreadTemplates = null;
const UP = new THREE.Vector3(0, 1, 0);
const SCALE = 1.2;
const DREAD_COUNT = 16;
const pivots = [[0, 0, 0], [-.49, 2.72, 0], [.49, 2.72, 0], [-.245, 1.61, 0], [.245, 1.61, 0]];
const strideAngles = [0, .19, -.19, -.29, .29];

class ClanAssembly extends Assembly {
  constructor() { super('clan-hunter'); this.region = 0; }
  add(geometry, material, position, scale, rotation) {
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute('clanRegion', new THREE.Float32BufferAttribute(new Float32Array(count).fill(this.region), 1));
    // Every part in a material batch has the same attribute layout. Pigmentation
    // is authored in object coordinates after assembly, never regenerated per frame.
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
    return super.add(geometry, material, position, scale, rotation);
  }
  box(material, position, size, rounded = false, rotation = [0, 0, 0]) {
    // Tiny mechanical bevels need fewer rings than a cranial or muscle contour.
    return this.add(rounded ? new RoundedBoxGeometry(1, 1, 1, 2, .14) : new THREE.BoxGeometry(1, 1, 1), material, position, size, rotation);
  }
}

function markSkin(mesh) {
  if (mesh.material.userData.surfaceType !== 'skin') return;
  const p = mesh.geometry.attributes.position, colors = mesh.geometry.attributes.color;
  const pale = new THREE.Color(0xd9bd7d), dark = new THREE.Color(0x534b33), ochre = new THREE.Color(0xa18b53);
  const color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // The chest/abdomen stay pale; flanks, shoulders and outer limbs have the
    // mottled ochre pattern visible in the reference, rather than brown fabric.
    const flank = Math.min(1, Math.abs(x) * 1.7 + Math.max(0, -.10 - z) * 1.6);
    const cells = Math.sin(x * 54 + Math.sin(y * 18) * 2.1) * Math.sin(y * 51 + z * 31) * Math.sin(z * 63 + x * 14);
    const spots = THREE.MathUtils.smoothstep(cells, .17, .48) * (.20 + flank * .7);
    color.copy(pale).lerp(ochre, flank * .52).lerp(dark, spots * .90);
    colors.setXYZ(i, color.r, color.g, color.b);
  }
}

function makeStrideTargets(mesh) {
  const unindexed = mesh.geometry;
  mesh.geometry = mergeVertices(unindexed, 1e-5); unindexed.dispose();
  const geometry = mesh.geometry, p = geometry.attributes.position, n = geometry.attributes.normal;
  const regions = geometry.attributes.clanRegion;
  const positions = [], normals = [];
  for (const sign of [1, -1]) {
    const dp = new Float32Array(p.count * 3), dn = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const region = regions.getX(i), angle = strideAngles[region] * sign;
      if (!angle) continue;
      const pivot = pivots[region], c = Math.cos(angle), s = Math.sin(angle);
      const y = p.getY(i) - pivot[1], z = p.getZ(i) - pivot[2];
      dp[i * 3 + 1] = y * c - z * s - y;
      dp[i * 3 + 2] = y * s + z * c - z;
      dn[i * 3 + 1] = n.getY(i) * c - n.getZ(i) * s - n.getY(i);
      dn[i * 3 + 2] = n.getY(i) * s + n.getZ(i) * c - n.getZ(i);
    }
    positions.push(new THREE.Float32BufferAttribute(dp, 3));
    normals.push(new THREE.Float32BufferAttribute(dn, 3));
  }
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = positions;
  geometry.morphAttributes.normal = normals;
  geometry.deleteAttribute('clanRegion');
  if (mesh.material.userData.surfaceType !== 'skin') geometry.deleteAttribute('color');
  // BufferGeometry's generic relative-morph box sums independent extrema. That
  // severely overstates mixed torso/limb batches; enclose actual authored poses.
  const box = new THREE.Box3(), point = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    point.fromBufferAttribute(p, i); box.expandByPoint(point);
    for (const target of positions) {
      point.set(p.getX(i) + target.getX(i), p.getY(i) + target.getY(i), p.getZ(i) + target.getZ(i));
      box.expandByPoint(point);
    }
  }
  geometry.boundingBox = box; geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
  mesh.updateMorphTargets();
}

function surfacePoint(geometry, radial, row, angle) {
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  const column = ((angle / (Math.PI * 2) % 1 + 1) % 1) * radial;
  const col = Math.floor(column), r = Math.floor(row), v = row - r, u = column - col;
  const indices = [r * (radial + 1) + col, r * (radial + 1) + col + 1, (r + 1) * (radial + 1) + col, (r + 1) * (radial + 1) + col + 1];
  const weights = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v];
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), sample = new THREE.Vector3();
  indices.forEach((index, i) => { point.addScaledVector(sample.fromBufferAttribute(p, index), weights[i]); normal.addScaledVector(sample.fromBufferAttribute(n, index), weights[i]); });
  return point.addScaledVector(normal.normalize(), .0085).toArray();
}

function addNet(assembly, material, torso) {
  // Intersecting helices follow the flank/chest ellipses; the front strands lie
  // on the exposed skin, not on a floating rectangular apron.
  for (const direction of [-1, 1]) for (let k = 0; k < 11; k++) {
    const points = [];
    for (let row = 0; row <= 12; row++) {
      const t = row / 12, y = 1.68 + t * .98;
      const angle = k / 11 * Math.PI * 2 + direction * t * 1.62;
      let section = 0;
      const p = torso.attributes.position;
      while (section < 43 && p.getY((section + 1) * 49) < y) section++;
      const low = p.getY(section * 49), high = p.getY((section + 1) * 49);
      points.push(surfacePoint(torso, 48, section + THREE.MathUtils.clamp((y - low) / (high - low), 0, .99999), angle));
    }
    assembly.tube(material, points, .0065, 12, 3);
  }
}

function hunterTorsoGeometry() {
  const geometry = loftGeometry([[1.47, .25, .17], [1.65, .32, .205], [1.90, .265, .18], [2.13, .315, .205], [2.38, .43, .245], [2.59, .48, .235], [2.73, .425, .185], [2.90, .165, .145]], { radial: 48, rows: 44, muscle: .035 });
  const positions = geometry.attributes.position;
  const gaussian = (value, center, spread) => Math.exp(-(((value - center) / spread) ** 2));
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const front = Math.min(1, Math.max(0, z) / .23) ** 3;
    const pectoral = .065 * gaussian(Math.abs(x), .225, .20) * gaussian(y, 2.48, .17);
    const sternum = -.012 * gaussian(x, 0, .026) * gaussian(y, 2.48, .18);
    const lowerPec = -.009 * gaussian(y, 2.30, .035) * gaussian(Math.abs(x), .21, .2);
    let abdomen = 0;
    for (const center of [1.94, 2.08, 2.22]) abdomen += .012 * gaussian(y, center, .067) * gaussian(Math.abs(x), .09, .085);
    // All muscles are relief in one continuous envelope. Avoid stacked spheres
    // and uncapped oblique tubes, which read as separate cushions or side plates.
    positions.setZ(i, z + front * (pectoral + sternum + lowerPec + abdomen));
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

function addArmor(assembly, m) {
  // Asymmetric overlapping scapular plates, raised ridges and leather straps.
  for (let layer = 0; layer < 3; layer++) {
    assembly.sphere(m.armor, [-.46 - layer * .025, 2.77 - layer * .045, -.012], [.23 + layer * .015, .12, .245], 24);
    assembly.tube(m.steel, [[-.66, 2.78 - layer * .046, .15], [-.51, 2.83 - layer * .046, .235], [-.30, 2.80 - layer * .046, .16]], .009, 10, 4);
  }
  assembly.tube(m.leather, [[-.46, 2.74, .16], [-.30, 2.56, .275], [-.04, 2.29, .26], [.28, 1.94, .19]], .043, 16, 5);
  assembly.tube(m.leather, [[-.46, 2.74, -.15], [-.30, 2.56, -.24], [-.04, 2.29, -.245], [.28, 1.94, -.19]], .041, 16, 5);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    assembly.sphere(m.bone, [-.37 + t * .52, 2.62 - t * .56, .30 - t * .025], [.019, .045, .020]);
  }
  assembly.cylinder(m.leather, [0, 1.64, 0], [.32, .34], .16, [0, 0, 0], 40);
  assembly.box(m.armor, [0, 1.64, .22], [.19, .145, .07], true);
  for (const side of [-1, 1]) {
    assembly.add(loftGeometry([[1.11, .10, .025, side * .16, .20], [1.28, .13, .04, side * .18, .22], [1.54, .16, .045, side * .17, .24], [1.64, .13, .02, side * .16, .23]], { radial: 20, rows: 9, superellipse: 3 }), m.leather);
    assembly.box(m.armor, [side * .23, 1.52, .245], [.20, .22, .045], true, [0, 0, side * -.15]);
  }
  // Shoulder weapon is a separate silhouette, still baked into the armor draw.
  assembly.box(m.dark, [-.48, 2.88, -.08], [.15, .22, .18], true);
  assembly.bone(m.armor, [-.48, 2.98, -.23], [-.48, 2.98, .28], .085, .073, 24);
  assembly.cylinder(m.dark, [-.48, 2.98, .292], [.052, .052], .012, [Math.PI / 2, 0, 0], 24);
  assembly.add(new THREE.TorusGeometry(.062, .012, 6, 24), m.steel, [-.48, 2.98, .298]);
  assembly.sphere(m.optic, [-.48, 2.98, .305], [.024, .024, .006]);
}

function addLimbs(assembly, m) {
  for (const side of [-1, 1]) {
    assembly.region = side < 0 ? 1 : 2;
    assembly.add(sweptLimb([[side * .44, 2.65, -.015, .13, .14], [side * .59, 2.50, 0, .18, .16], [side * .66, 2.30, .015, .135, .13], [side * .68, 2.14, .035, .12, .12], [side * .72, 1.91, .09, .14, .12], [side * .73, 1.74, .14, .095, .085]], 36, 26), m.skin);
    assembly.sphere(m.skin, [side * .73, 1.65, .17], [.105, .155, .105], 24);
    // Four distinct long fingers and a hooked opposing thumb, not mitten hands.
    for (let digit = 0; digit < 4; digit++) {
      const x = side * (.66 + digit * .043), y = 1.59 - Math.sin(digit / 3 * Math.PI) * .018;
      assembly.tube(m.skin, [[x, y, .20], [x, y - .12, .24], [x, y - .19, .275]], .025, 6, 5);
      assembly.bone(m.bone, [x, y - .18, .275], [x, y - .205, .31], .014, .002, 6);
    }
    assembly.tube(m.skin, [[side * .65, 1.70, .20], [side * .60, 1.62, .25], [side * .60, 1.55, .29]], .036, 7, 6);
    assembly.box(m.dark, [side * .715, 1.97, .065], [.26, .38, .24], true, [0, 0, side * .06]);
    assembly.box(m.armor, [side * .715, 1.98, .20], [.235, .34, .08], true);
    for (let i = 0; i < 3; i++) assembly.box(m.steel, [side * .715, 1.87 + i * .102, .247], [.21, .015, .014]);
    if (side < 0) {
      assembly.box(m.dark, [side * .715, 2.03, .26], [.19, .17, .035], true);
      assembly.box(m.optic, [side * .715, 2.03, .282], [.125, .075, .012], true);
    } else {
      // Paired wrist blades have a thick root and a narrow point; +Z is forward.
      for (const offset of [-.065, .065]) {
        assembly.add(loftGeometry([[.22, .019, .047], [.54, .018, .042], [.91, .003, .002]], { axis: 'z', radial: 8, rows: 12, superellipse: 3 }), m.steel, [side * .715 + offset, 1.98, 0]);
      }
    }
    assembly.region = side < 0 ? 3 : 4;
    const leg = sweptLimb([[side * .18, 1.60, 0, .14, .14], [side * .27, 1.39, .015, .235, .23], [side * .285, 1.10, .045, .17, .17], [side * .28, .96, .065, .135, .14], [side * .28, .72, -.005, .17, .14], [side * .27, .35, -.025, .105, .105], [side * .27, .18, 0, .10, .10]], 36, 28);
    for (const direction of [-1, 1]) for (let line = 0; line < 6; line++) {
      const points = [];
      for (let row = 0; row <= 8; row++) {
        const t = row / 8, angle = line / 6 * Math.PI * 2 + direction * t * 1.2;
        points.push(surfacePoint(leg, 36, (.065 + t * .265) * 28, angle));
      }
      assembly.tube(m.leather, points, .006, 8, 3);
    }
    assembly.add(leg, m.skin);
    assembly.add(loftGeometry([[.84, .075, .014, side * .285, .19], [.93, .145, .027, side * .285, .205], [1.02, .16, .036, side * .285, .205], [1.10, .10, .018, side * .285, .21]], { radial: 28, rows: 14, superellipse: 3.4 }), m.armor);
    assembly.tube(m.steel, [[side * .285 - .11, 1.025, .24], [side * .285, 1.043, .25], [side * .285 + .11, 1.025, .24]], .007, 8, 4);
    assembly.add(loftGeometry([[.22, .085, .025, side * .27, .11], [.48, .14, .06, side * .275, .115], [.75, .16, .065, side * .28, .12], [.88, .12, .03, side * .28, .14]], { radial: 28, rows: 14, superellipse: 3 }), m.armor);
    for (let band = 0; band < 2; band++) assembly.cylinder(m.leather, [side * .275, .39 + band * .35, -.015], [.14, .14], .06, [0, 0, 0], 20);
    assembly.tube(m.steel, [[side * .275, .27, .143], [side * .275, .55, .185], [side * .28, .82, .185]], .011, 12, 4);
    assembly.add(loftGeometry([[-.16, .075, .065], [-.05, .12, .09], [.19, .14, .075], [.29, .11, .04]], { axis: 'z', radial: 28, rows: 14, superellipse: 2.5 }), m.skin, [side * .27, .095, 0]);
    for (let toe = 0; toe < 3; toe++) {
      const x = side * .27 + (toe - 1) * .078;
      assembly.sphere(m.skin, [x, .08, .275], [.045, .055, .085]);
      assembly.bone(m.bone, [x, .085, .32], [x, .07, .385], .022, .001, 8);
    }
  }
  assembly.region = 0;
}

function addHead(assembly, m) {
  assembly.sphere(m.skin, [0, 2.91, -.015], [.175, .19, .16], 32);
  assembly.sphere(m.skin, [0, 3.15, -.02], [.255, .2667, .245], 40);
  // Broad cranial brow, cheek flare and long tapered jaw; no human nose/mouth.
  assembly.add(loftGeometry([[2.92, .095, .035, 0, .215], [2.98, .17, .055, 0, .26], [3.08, .237, .075, 0, .275], [3.24, .265, .082, 0, .24], [3.36, .225, .062, 0, .18], [3.405, .035, .01, 0, .14]], { radial: 48, rows: 26, superellipse: 2.6 }), m.armor);
  for (const side of [-1, 1]) {
    assembly.box(m.dark, [side * .119, 3.202, .327], [.158, .041, .026], true, [0, side * -.12, side * -.08]);
    assembly.tube(m.steel, [[side * .032, 3.245, .327], [side * .13, 3.25, .34], [side * .223, 3.225, .309]], .014, 9, 5);
    assembly.tube(m.dark, [[side * .207, 3.06, .31], [side * .22, 2.96, .22], [side * .165, 2.89, .10]], .025, 10, 6);
    assembly.tube(m.steel, [[side * .22, 3.105, .322], [side * .17, 3.035, .33], [side * .11, 2.97, .297]], .011, 9, 4);
  }
  for (let vent = -2; vent <= 2; vent++) assembly.box(m.dark, [vent * .029, 3.016 + Math.abs(vent) * .009, .346], [.009, .063, .012], false, [0, 0, vent * -.06]);
  for (let i = 0; i < 3; i++) assembly.sphere(m.optic, [-.227, 3.248 + i * .027, .297], [.008, .008, .005]);
}

function createDreadGeometries() {
  if (dreadTemplates) return dreadTemplates.map(geometry => geometry.clone());
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, -.23, -.04), new THREE.Vector3(.025, -.60, -.10), new THREE.Vector3(.055, -.94, -.045)]);
  const strandGeometry = new THREE.TubeGeometry(curve, 18, .038, 7, false);
  // Taper the last third of each lock while retaining the rounded cable body.
  const positions = strandGeometry.attributes.position;
  for (let row = 0; row <= 18; row++) {
    const t = row / 18, center = curve.getPointAt(t), taper = 1 - .65 * THREE.MathUtils.smoothstep(t, .65, 1);
    for (let radial = 0; radial <= 7; radial++) {
      const p = row * 8 + radial;
      positions.setXYZ(p, center.x + (positions.getX(p) - center.x) * taper, center.y + (positions.getY(p) - center.y) * taper, center.z + (positions.getZ(p) - center.z) * taper);
    }
  }
  strandGeometry.computeVertexNormals();
  const ringParts = [];
  for (const t of [.25, .53, .76]) {
    const ring = new THREE.CylinderGeometry(.043, .043, .043, 10, 1, true), point = curve.getPointAt(t);
    ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, curve.getTangentAt(t)));
    ring.translate(point.x, point.y, point.z); ringParts.push(ring);
  }
  const ringGeometry = mergeGeometries(ringParts, false); ringParts.forEach(part => part.dispose());
  dreadTemplates = [strandGeometry.clone(), ringGeometry.clone()];
  return [strandGeometry, ringGeometry];
}

function addDreads(root, m, index) {
  const [strandGeometry, ringGeometry] = createDreadGeometries();
  const locks = new THREE.InstancedMesh(strandGeometry, m.leather, DREAD_COUNT);
  const bands = new THREE.InstancedMesh(ringGeometry, m.bone, DREAD_COUNT);
  locks.name = 'clan-hunter-independent-dreads'; bands.name = 'clan-hunter-dread-bands';
  locks.castShadow = bands.castShadow = true; locks.receiveShadow = bands.receiveShadow = true;
  locks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bands.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const roots = [];
  for (let strand = 0; strand < DREAD_COUNT; strand++) {
    // The front face stays clear: roots span the temples and back of the skull.
    const angle = .13 + strand / (DREAD_COUNT - 1) * (Math.PI - .26);
    const x = Math.cos(angle) * .245, z = -Math.sin(angle) * .215 - .025;
    roots.push({ position: new THREE.Vector3(x, 3.25 - Math.sin(angle) * .045, z), rotation: new THREE.Euler(-.10 - Math.sin(angle) * .12, 0, Math.sign(x) * .10), length: .84 + (strand % 4) * .085, phase: strand * 1.917 + index * .63 });
  }
  root.add(locks, bands);
  // Sway stays inside this conservative actor-local bound. Avoid traversing all
  // instances to recompute their bounds on every frame.
  const bound = new THREE.Sphere(new THREE.Vector3(0, 2.77, -.13), .95);
  locks.boundingSphere = bound.clone(); bands.boundingSphere = bound.clone();
  locks.boundingBox = new THREE.Box3(new THREE.Vector3(-.52, 2.10, -.65), new THREE.Vector3(.52, 3.30, .13));
  bands.boundingBox = locks.boundingBox.clone();
  return { locks, bands, roots, matrix: new THREE.Matrix4(), quaternion: new THREE.Quaternion(), rotation: new THREE.Euler(), scale: new THREE.Vector3() };
}

function poseDreads(state, amount) {
  const { locks, bands, roots, matrix, quaternion, rotation, scale } = state.dreads;
  roots.forEach((root, i) => {
    rotation.copy(root.rotation);
    rotation.x += Math.sin(state.time * 2.1 + root.phase) * (.014 + amount * .055);
    rotation.z += Math.sin(state.time * 2.6 + root.phase * .81) * (.012 + amount * .045);
    quaternion.setFromEuler(rotation); scale.set(1, root.length, 1);
    matrix.compose(root.position, quaternion, scale);
    locks.setMatrixAt(i, matrix); bands.setMatrixAt(i, matrix);
  });
  locks.instanceMatrix.needsUpdate = true; bands.instanceMatrix.needsUpdate = true;
}

function createBody(m) {
  if (bodyTemplates) {
    const root = new THREE.Group();
    for (const template of bodyTemplates) {
      const mesh = new THREE.Mesh(template.geometry.clone(), m[template.materialKey]);
      mesh.name = template.name; mesh.castShadow = true; mesh.receiveShadow = true;
      root.add(mesh);
    }
    return root;
  }
  const assembly = new ClanAssembly();
  const torso = hunterTorsoGeometry(), netReference = torso.clone();
  assembly.add(torso, m.skin);
  for (const side of [-1, 1]) {
    assembly.sphere(m.skin, [side * .47, 2.65, -.015], [.185, .185, .185], 28);
  }
  addNet(assembly, m.leather, netReference); netReference.dispose();
  addArmor(assembly, m); addLimbs(assembly, m); addHead(assembly, m);
  const root = assembly.finish();
  root.children.forEach(mesh => { markSkin(mesh); makeStrideTargets(mesh); });
  const keys = new Map(Object.entries(m).map(([key, material]) => [material, key]));
  bodyTemplates = root.children.map(mesh => ({ geometry: mesh.geometry.clone(), name: mesh.name, materialKey: keys.get(mesh.material) }));
  return root;
}

export function buildClanHunterModel(index = 0) {
  const m = {
    skin: createSurfaceMaterial('skin', { color: 0xffffff, vertexColors: true, roughness: .65, metalness: 0, normalScale: new THREE.Vector2(.28, .28), repeat: [2, 3] }),
    armor: createSurfaceMaterial('armor', { color: index % 2 ? 0x7e817a : 0x8c9695, roughness: .45, metalness: .69 }),
    dark: createSurfaceMaterial('metal', { color: 0x222c2d, roughness: .52, metalness: .63 }),
    leather: createSurfaceMaterial('leather', { color: 0x252522, roughness: .87, metalness: .02 }),
    steel: createSurfaceMaterial('metal', { color: 0xb1b9b6, roughness: .31, metalness: .82 }),
    bone: createSurfaceMaterial('bone', { color: 0xb6a274, roughness: .56, metalness: .12 }),
    optic: new THREE.MeshStandardMaterial({ name: 'clan-amber-equipment', color: 0x744b26, emissive: 0xb83e11, emissiveIntensity: .52, roughness: .35, metalness: .15 })
  };
  const root = createBody(m); root.name = 'honor-guard'; root.scale.setScalar(SCALE);
  const bodyMeshes = [...root.children];
  const dreads = addDreads(root, m, index);
  const state = { bodyMeshes, dreads, time: 0, phase: 0, stride: 0, lastPosition: new THREE.Vector3(), positioned: false };
  visuals.set(root, state); poseDreads(state, 0);
  root.userData.anatomy = { headHeight: .64, standingHeight: 4.1, headsTall: 6.41, species: 'yautja', silhouette: 'original-clan-honor-guard' };
  root.userData.visualRig = { version: 1, strideTargets: 2, independentDreads: DREAD_COUNT, rootMotion: false, filmPropReplica: false };
  return root;
}

/** A visual-only pose, driven by the final resolved position after navigation.
 * Paused/downed/recovering actors do not advance pose or strand clocks. */
export function updateClanHunterVisual(actor, delta) {
  const root = actor?.mesh, state = root && visuals.get(root);
  if (!state || !Number.isFinite(delta) || delta <= 0) return false;
  if (!state.positioned) { state.lastPosition.copy(root.position); state.positioned = true; }
  const distance = Math.hypot(root.position.x - state.lastPosition.x, root.position.z - state.lastPosition.z);
  state.lastPosition.copy(root.position);
  if (actor.isDowned || actor.isRescueRecovering || actor.hp <= 0) return false;
  if (distance > 3) { state.stride = 0; state.bodyMeshes.forEach(mesh => mesh.morphTargetInfluences.fill(0)); return false; }
  state.time += Math.min(delta, .1);
  state.phase = (state.phase + distance * 2.4) % (Math.PI * 2);
  const moving = Math.min(1, distance / delta / 6);
  state.stride = THREE.MathUtils.lerp(state.stride, moving, 1 - Math.exp(-delta * 12));
  const wave = Math.sin(state.phase) * state.stride;
  state.bodyMeshes.forEach(mesh => { mesh.morphTargetInfluences[0] = Math.max(0, wave); mesh.morphTargetInfluences[1] = Math.max(0, -wave); });
  poseDreads(state, state.stride);
  return true;
}

/** Immutable diagnostic snapshot; no caller receives mutable animation state. */
export function getClanHunterVisualState(root) {
  const state = visuals.get(root);
  return state ? Object.freeze({ time: state.time, phase: state.phase, stride: state.stride, independentDreads: state.dreads.roots.length }) : null;
}

export function getClanHunterVisualCacheStats() {
  const geometries = [...(bodyTemplates?.map(template => template.geometry) ?? []), ...(dreadTemplates ?? [])];
  let ownedBufferBytes = 0;
  for (const geometry of geometries) {
    for (const attribute of Object.values(geometry.attributes)) ownedBufferBytes += attribute.array.byteLength;
    for (const attribute of Object.values(geometry.morphAttributes).flat()) ownedBufferBytes += attribute.array.byteLength;
    ownedBufferBytes += geometry.index?.array.byteLength ?? 0;
  }
  return Object.freeze({ geometries: geometries.length, ownedBufferBytes, renderObjects: 0 });
}

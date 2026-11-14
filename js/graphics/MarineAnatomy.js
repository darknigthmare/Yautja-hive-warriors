/* Human support anatomy and fitted equipment study. The same body also backs
 * corporate human roles: no faction badge, character likeness or new weapon
 * is inferred here. The role-specific weapon remains in SupportModels. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { loftGeometry, sweptLimb, sculptedFaceGeometry } from './SupportSculpt.js';

const ROLES = new Set(['marine', 'smartgunner', 'flametrooper', 'medic', 'commtech', 'sniper', 'sadar', 'exosuit']);
const BODY = Object.freeze({ standingHeight: 3.445, headHeight: .46, headCenter: Object.freeze([0, 3.18, .01]),
  rightWrist: Object.freeze([.30, 2.09, .58]), leftWrist: Object.freeze([.06, 2.07, .99]),
  visualFidelity1to1Verified: false });
const bell = (x, center, radius) => Math.exp(-(((x - center) / radius) ** 2));

// One bevel ring is enough for small fabric flaps, buckles and sole blocks.
// Assembly's generic three-ring rounded box is reserved for larger props.
function fitting(parts, material, position, size, rounded = false, rotation = [0, 0, 0]) {
  return parts.add(rounded ? new RoundedBoxGeometry(1, 1, 1, 1, .14) : new THREE.BoxGeometry(1, 1, 1),
    material, position, size, rotation);
}

function uniformTorso(parts, mats) {
  const geometry = loftGeometry([
    [1.24, .045, .10], [1.34, .27, .205], [1.55, .315, .225],
    [1.76, .265, .19], [2.02, .285, .205], [2.31, .36, .235],
    [2.56, .405, .225], [2.68, .35, .18], [2.77, .16, .11], [2.85, .12, .10], [2.91, .108, .09]
  ], { radial: 28, rows: 24 });
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const waistFold = bell(y, 1.76, .23) * Math.sin((y - 1.76) * 48 + x * 4) * .009;
    const collarFold = bell(y, 2.71, .12) * Math.sin(x * 24) * .006;
    p.setZ(i, z + Math.sign(z) * (waistFold + collarFold));
  }
  geometry.computeVertexNormals();
  parts.add(geometry, mats.cloth);
  parts.add(loftGeometry([[2.8, .105, .09], [2.93, .106, .088], [3.025, .09, .08]],
    { radial: 28, rows: 16 }), mats.skin);
  // The textile collar has a rolled edge and two short seams. It does not
  // create an opaque disc underneath the jaw.
  parts.add(new THREE.TorusGeometry(.119, .016, 7, 28), mats.cloth, [0, 2.906, 0], [1, 1, .83], [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) {
    parts.tube(mats.cloth, [[side * .13, 2.78, .105], [side * .25, 2.69, .15], [side * .35, 2.61, .16]], .009, 12, 5);
  }
}

function bootsAndLegs(parts, mats) {
  for (const side of [-1, 1]) {
    const hip = side * .205, knee = side * .23, ankle = side * .25;
    const trouser = sweptLimb([
      [hip, 1.61, -.015, .165, .18], [hip, 1.35, -.02, .18, .18],
      [knee, 1.08, .035, .135, .14], [knee, .91, .06, .113, .12],
      [ankle, .70, .005, .132, .145], [ankle, .47, -.035, .1, .11],
      [ankle, .30, -.04, .082, .09]
    ], 24, 22);
    const p = trouser.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i), fold = bell(y, 1.03, .18) * Math.sin(y * 62) * .01;
      p.setZ(i, z + Math.sign(z + .015) * fold);
    }
    trouser.computeVertexNormals(); parts.add(trouser, mats.cloth);
    // Closed side pockets follow the thigh instead of expanding into boxes.
    parts.add(loftGeometry([[1.12, .06, .035], [1.17, .10, .045], [1.39, .10, .045], [1.44, .055, .025]],
      { radial: 16, rows: 12, superellipse: 3 }), mats.cloth, [side * .32, 0, .02]);
    fitting(parts, mats.cloth, [side * .325, 1.41, .061], [.17, .035, .028], true);
    // The knee/shin insert has a chamfered outline and raised edge ribs.
    parts.add(loftGeometry([[.61, .055, .024], [.72, .10, .038], [.91, .137, .055],
      [1.025, .13, .052], [1.105, .066, .026]], { radial: 18, rows: 14, superellipse: 2.8 }), mats.armor, [knee, 0, .147]);
    for (const edge of [-1, 1]) parts.tube(mats.armor,
      [[knee + edge * .055, .68, .182], [knee + edge * .10, .88, .197], [knee + edge * .08, 1.05, .183]], .009, 12, 5);
    // A leather shaft, separate heel, broad toe and thin sole establish an
    // ankle rather than a single rubber ellipsoid. Their lowest surface is Y0.
    parts.add(loftGeometry([[.15, .09, .105], [.24, .118, .115], [.41, .108, .107], [.49, .091, .09]],
      { radial: 20, rows: 14, superellipse: 2.4 }), mats.rubber, [ankle, 0, -.035]);
    parts.add(loftGeometry([[-.235, .075, .065, 0, .13], [-.15, .122, .125, 0, .145],
      [.07, .144, .125, 0, .13], [.28, .14, .085, 0, .108], [.38, .065, .052, 0, .09]],
    { axis: 'z', radial: 18, rows: 14, superellipse: 2.8 }), mats.rubber, [ankle, 0, 0]);
    parts.add(loftGeometry([[-.245, .07, .025, 0, .033], [-.15, .132, .033, 0, .033],
      [.12, .151, .031, 0, .033], [.32, .14, .027, 0, .031], [.405, .062, .02, 0, .029]],
    { axis: 'z', radial: 18, rows: 14, superellipse: 3 }), mats.dark, [ankle, 0, 0]);
    fitting(parts, mats.dark, [ankle, .03, -.145], [.17, .06, .16], true);
    parts.add(new THREE.TorusGeometry(.11, .012, 6, 24), mats.rubber, [ankle, .47, -.035], [1, 1, .9], [Math.PI / 2, 0, 0]);
    for (let lace = 0; lace < 6; lace++) {
      const y = .40 - lace * .031, z = .064 + lace * .015;
      parts.tube(mats.cloth, [[ankle - .064, y + .012, z], [ankle, y, z + .009], [ankle + .064, y - .012, z]], .006, 5, 4);
      for (const edge of [-1, 1]) fitting(parts, mats.dark, [ankle + edge * .068, y, z], [.014, .015, .014]);
    }
    for (const edge of [-1, 1]) parts.tube(mats.rubber, [[ankle + edge * .095, .165, -.13],
      [ankle + edge * .134, .16, .08], [ankle + edge * .12, .13, .29]], .007, 12, 4);
    for (let lug = 0; lug < 5; lug++) for (const edge of [-1, 1])
      fitting(parts, mats.dark, [ankle + edge * .10, .012, -.16 + lug * .10], [.05, .024, .052]);
  }
}

// Match the existing static weapon meshes. These are visual hand placements;
// the actor root, collision radius and weapon transform are never changed.
function weaponPose(role) {
  const right = { kind: 'vertical', center: [.30, 2.00, .48], radiusX: .05, radiusZ: .085,
    side: 1, wrist: [.42, 2.055, .43] };
  const left = { kind: 'underbarrel', center: [.30, 1.96, 1.06], radiusX: .08, radiusY: .08,
    side: -1, wrist: [.13, 1.865, 1.035] };
  if (role === 'smartgunner') Object.assign(left, { center: [.30, 2.10, 1.15], radiusX: .073, radiusY: .08, wrist: [.13, 1.995, 1.12] });
  if (role === 'flametrooper') {
    Object.assign(right, { center: [.30, 1.96, .48], radiusZ: .075, wrist: [.42, 2.02, .43] });
    Object.assign(left, { center: [.30, 2.10, 1.09], radiusX: .11, radiusY: .105, wrist: [.12, 1.97, 1.06] });
  }
  if (role === 'medic') {
    Object.assign(right, { center: [.35, 1.90, .59], radiusX: .06, radiusZ: .07, wrist: [.48, 1.975, .54] });
    Object.assign(left, { kind: 'vertical', center: [.35, 1.875, .59], radiusX: .073, radiusZ: .082, wrist: [.20, 1.955, .54] });
  }
  if (role === 'commtech') {
    Object.assign(right, { center: [.31, 1.91, .62], radiusX: .055, radiusZ: .065, wrist: [.435, 1.99, .57] });
    Object.assign(left, { kind: 'vertical', center: [.31, 1.94, .90], radiusX: .045, radiusZ: .045, wrist: [.19, 2.015, .85] });
  }
  if (role === 'sadar') {
    Object.assign(right, { center: [-.53, 2.22, .65], radiusX: .075, radiusZ: .09, wrist: [-.35, 2.29, .60] });
    Object.assign(left, { center: [-.54, 2.56, 1.12], radiusX: .18, radiusY: .18, wrist: [-.71, 2.355, 1.09] });
  }
  if (role === 'exosuit') {
    Object.assign(right, { center: [.30, 2.045, .57], radiusX: .125, radiusZ: .07, wrist: [.48, 2.12, .52] });
    Object.assign(left, { center: [.30, 2.14, 1.08], radiusX: .125, radiusY: .145, wrist: [.12, 1.97, 1.05] });
  }
  return { right, left };
}

function hands(parts, mats, grip) {
  const [x, y, z] = grip.center, side = grip.side;
  if (grip.kind === 'vertical') {
    const rx = grip.radiusX, rz = grip.radiusZ;
    parts.add(loftGeometry([[-.09, .019, .035], [-.055, .027, .052], [.05, .026, .048], [.085, .018, .03]],
      { radial: 18, rows: 14, superellipse: 2.3 }), mats.skin, [x + side * (rx + .027), y - .012, z]);
    for (let finger = 0; finger < 4; finger++) {
      const fy = y + .055 - finger * .032;
      parts.add(sweptLimb([[x + side * (rx + .043), fy, z + rz * .35, .015],
        [x + side * (rx + .015), fy - .003, z + rz + .012, .015],
        [x - side * rx * .65, fy - .005, z + rz + .013, .013],
        [x - side * (rx + .012), fy - .008, z + .01, .009]], 8, 10), mats.skin);
    }
    parts.add(sweptLimb([[x + side * (rx + .038), y + .055, z - rz * .35, .023],
      [x + side * rx * .5, y + .069, z - rz - .008, .021],
      [x - side * rx * .45, y + .025, z - rz * .8, .011]], 10, 10), mats.skin);
  } else {
    const rx = grip.radiusX, ry = grip.radiusY;
    parts.add(loftGeometry([[-.085, .028, .018], [-.05, .05, .03], [.05, .05, .03], [.085, .028, .018]],
      { axis: 'z', radial: 18, rows: 14, superellipse: 2.3 }), mats.skin, [x - .08, y - ry - .025, z]);
    for (let finger = 0; finger < 4; finger++) {
      const fz = z + (finger - 1.5) * .03;
      parts.add(sweptLimb([[x - .09, y - ry - .01, fz, .015],
        [x - .02, y - ry - .027, fz + .003, .015], [x + .065, y - ry + .005, fz + .003, .014],
        [x + rx * .88, y - ry * .45, fz, .009]], 8, 10), mats.skin);
    }
    parts.add(sweptLimb([[x - .12, y - ry + .025, z - .07, .023],
      [x - rx - .01, y - ry * .25, z - .08, .021],
      [x - rx + .01, y + ry * .1, z - .06, .011]], 10, 10), mats.skin);
  }
}

function sleevesAndArms(parts, mats, pose) {
  for (const side of [-1, 1]) {
    const grip = side > 0 ? pose.right : pose.left, wrist = grip.wrist;
    const elbow = [side * .57, 2.25, side < 0 ? .33 : .14];
    const forearm = [elbow[0] * .48 + wrist[0] * .52, (elbow[1] + wrist[1]) / 2, (elbow[2] + wrist[2]) / 2 + .035];
    const geometry = sweptLimb([[side * .44, 2.65, -.005, .10, .11],
      [side * .52, 2.50, .005, .152, .161], [...elbow, .104, .11],
      [...forearm, .112, .102],
      [...wrist, .068, .073]], 24, 22);
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), fold = bell(y, 2.25, .14) * Math.sin(y * 57 + x * 5) * .008;
      p.setX(i, x + side * fold);
    }
    geometry.computeVertexNormals(); parts.add(geometry, mats.cloth);
    // Broad shallow M3-inspired plates have a flat crown and chamfered sides;
    // a spherical pauldron made the shoulders read as smooth inflated shells.
    const shoulder = loftGeometry([[-.205, .09, .035, 0, 2.635], [-.15, .18, .07, 0, 2.655],
      [.10, .18, .075, 0, 2.655], [.205, .11, .045, 0, 2.63]],
    { axis: 'z', radial: 20, rows: 14, superellipse: 3.6 });
    parts.add(shoulder, mats.armor, [side * .445, 0, -.012]);
    for (const z of [-.10, 0, .10]) parts.tube(mats.armor,
      [[side * .30, 2.64, z], [side * .34, 2.72, z], [side * .51, 2.72, z], [side * .59, 2.64, z]], .008, 10, 5);
    parts.tube(mats.cloth, [[side * .56, 2.53, -.085], [side * .65, 2.42, .0], [side * .63, 2.32, .13]], .011, 12, 5);
    parts.tube(mats.rubber, [[wrist[0] - side * .06, wrist[1] + .01, wrist[2] - .005],
      [wrist[0], wrist[1] - .025, wrist[2] + .056], [wrist[0] + side * .065, wrist[1] + .008, wrist[2] + .005]], .015, 12, 6);
    hands(parts, mats, grip);
  }
}

function fittedArmor(parts, mats) {
  const armor = loftGeometry([[1.95, .275, .222], [2.06, .32, .25], [2.28, .378, .28],
    [2.48, .432, .287], [2.64, .441, .263], [2.72, .376, .217]],
  { radial: 32, rows: 24, superellipse: 2.7 });
  const p = armor.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z > 0) {
      const pecPlane = bell(Math.abs(x), .20, .18) * bell(y, 2.48, .18) * .014;
      const sternum = bell(x, 0, .027) * bell(y, 2.40, .24) * .009;
      p.setZ(i, z + pecPlane - sternum);
    }
  }
  armor.computeVertexNormals(); parts.add(armor, mats.armor);
  for (const side of [-1, 1]) {
    parts.tube(mats.rubber, [[side * .25, 2.77, -.16], [side * .29, 2.70, .205],
      [side * .29, 2.34, .292], [side * .23, 1.98, .24]], .023, 22, 6);
    fitting(parts, mats.dark, [side * .286, 2.62, .27], [.074, .11, .027], true);
    fitting(parts, mats.steel, [side * .286, 2.62, .287], [.045, .065, .01], true);
    parts.tube(mats.armor, [[side * .37, 2.58, .23], [side * .335, 2.28, .258], [side * .275, 2.02, .236]], .011, 16, 5);
    fitting(parts, mats.armor, [side * .15, 2.13, .277], [.17, .026, .018], true);
  }
  // Ribbed flexible abdomen and a load-bearing belt remain distinct from the
  // ballistic chest. Pouches have a folded flap and closure, not luminous dots.
  for (let rib = 0; rib < 5; rib++) fitting(parts, mats.rubber, [0, 1.79 + rib * .034, .205], [.43, .018, .025], true);
  parts.add(loftGeometry([[1.54, .32, .235], [1.58, .328, .242], [1.66, .321, .233], [1.69, .31, .22]],
    { radial: 32, rows: 8, superellipse: 2.7 }), mats.rubber);
  fitting(parts, mats.dark, [0, 1.615, .251], [.13, .10, .026], true);
  fitting(parts, mats.steel, [0, 1.615, .267], [.075, .044, .012], true);
  for (const side of [-1, 1]) for (const slot of [0, 1]) {
    const x = side * (.15 + slot * .16), y = 1.77 + slot * .04;
    fitting(parts, mats.cloth, [x, y, .245], [.127, .255, .115], true);
    fitting(parts, mats.cloth, [x, y + .115, .26], [.143, .056, .12], true, [-.13, 0, 0]);
    fitting(parts, mats.rubber, [x, y + .065, .308], [.023, .053, .009], true);
    fitting(parts, mats.dark, [x, y + .052, .315], [.033, .019, .008], true);
  }
}

function facialAnatomy(parts, mats) {
  const center = new THREE.Vector3(...BODY.headCenter);
  const geometry = sculptedFaceGeometry({ width: .158, height: .23, depth: .156, radial: 40, rows: 30 });
  const projectorMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const surface = new THREE.Mesh(geometry, projectorMaterial); surface.position.copy(center); surface.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(0, 0, -1);
  const face = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .55, metalness: 0 });
  face.name = 'human-facial-features';
  const landmarks = [];
  const point = (x, y, offset = .003) => {
    ray.set(new THREE.Vector3(x, y, 1), direction);
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit) throw new Error('A human facial landmark must lie on its sculpted head');
    return [x, y, hit.point.z + offset];
  };
  const colored = (g, color, position, scale = [1, 1, 1]) => {
    const c = new THREE.Color(color), values = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < values.length; i += 3) { values[i] = c.r; values[i + 1] = c.g; values[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(values, 3)); parts.add(g, face, position, scale);
  };
  try {
    for (const side of [-1, 1]) {
      const x = side * .071, y = 3.218, eye = point(x, y, .0025);
      landmarks.push({ kind: 'eye', side, surface: point(x, y, 0), position: eye });
      colored(new THREE.SphereGeometry(1, 18, 12), 0x9a988e, eye, [.021, .0055, .0035]);
      colored(new THREE.SphereGeometry(1, 16, 10), 0x3c4635, [x, y, eye[2] + .0025], [.0075, .0055, .0025]);
      colored(new THREE.SphereGeometry(1, 12, 8), 0x111817, [x, y, eye[2] + .004], [.003, .0045, .0015]);
      const upper = [point(x - .023, y - .001, .004), point(x, y + .006, .005), point(x + .023, y - .001, .004)];
      const lower = [point(x - .021, y - .002, .004), point(x, y - .005, .004), point(x + .021, y - .002, .004)];
      parts.tube(mats.skin, upper, .0045, 12, 5); parts.tube(mats.skin, lower, .0035, 12, 5);
      const brow = [point(side * .036, 3.252, .004), point(side * .072, 3.257, .005), point(side * .107, 3.245, .004)];
      const browGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(brow.map(p => new THREE.Vector3(...p))), 12, .005, 5, false);
      colored(browGeometry, 0x4b4034, [0, 0, 0]);
      // Both nostril and ear folds are a few millimetres of detail, not black
      // spheres floating in front of a featureless head.
      const nostril = point(side * .017, 3.139, .005);
      colored(new THREE.SphereGeometry(1, 10, 6), 0x665047, nostril, [.004, .0028, .002]);
      parts.add(loftGeometry([[-.052, .012, .009], [-.035, .023, .012], [.018, .025, .013], [.052, .012, .008]],
        { radial: 18, rows: 16 }), mats.skin, [side * .16, 3.166, -.004]);
      parts.tube(mats.skin, [[side * .163, 3.121, .0], [side * .183, 3.153, .006],
        [side * .18, 3.201, -.004], [side * .162, 3.206, -.016]], .0055, 14, 6);
      const earFold = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * .17, 3.143, .008), new THREE.Vector3(side * .175, 3.17, .01), new THREE.Vector3(side * .167, 3.188, .004)
      ]), 10, .003, 4, false);
      colored(earFold, 0x957262, [0, 0, 0]);
    }
    const lipUpper = [-.037, -.014, 0, .014, .037].map((x, i) => [...point(x, 3.078 + (i === 1 || i === 3 ? .004 : 0), .004), i === 0 || i === 4 ? .0015 : .004]);
    const lipLower = [-.035, 0, .035].map((x, i) => [...point(x, 3.070 - (i === 1 ? .002 : 0), .004), i === 1 ? .004 : .0015]);
    colored(sweptLimb(lipUpper, 8, 18), 0xa57b70, [0, 0, 0]);
    colored(sweptLimb(lipLower, 8, 14), 0xb18b7e, [0, 0, 0]);
    const mouth = [-.031, 0, .031].map(x => new THREE.Vector3(...point(x, 3.074, .008)));
    colored(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouth), 12, .0018, 4, false), 0x6d5148, [0, 0, 0]);
    landmarks.push({ kind: 'mouth', position: point(0, 3.074, .008), surface: point(0, 3.074, 0) });
  } finally { projectorMaterial.dispose(); }
  // Consume the original only after all projections have used its real relief.
  parts.add(geometry, mats.skin, center.toArray());
  return landmarks;
}

function helmet(parts, mats) {
  parts.add(loftGeometry([[3.24, .173, .184, 0, -.012], [3.278, .192, .204, 0, -.018],
    [3.34, .169, .183, 0, -.025], [3.405, .115, .126, 0, -.025],
    [3.437, .048, .059, 0, -.025], [3.445, .008, .009, 0, -.025]],
  { radial: 36, rows: 20, superellipse: 2.25 }), mats.armor);
  // Flared brim and lower rear guard keep the face open. All fitting is in
  // the original 3.445-unit envelope used by the support body.
  fitting(parts, mats.armor, [0, 3.254, .167], [.361, .028, .082], true, [-.09, 0, 0]);
  parts.add(new THREE.CylinderGeometry(.19, .177, .10, 30, 1, true, Math.PI / 2, Math.PI),
    mats.armor, [0, 3.22, -.025]);
  parts.tube(mats.rubber, [[-.155, 3.21, .02], [-.123, 3.012, .034], [0, 2.972, .09], [.123, 3.012, .034], [.155, 3.21, .02]], .008, 30, 5);
  for (const side of [-1, 1]) {
    fitting(parts, mats.rubber, [side * .174, 3.225, -.006], [.032, .109, .083], true);
    fitting(parts, mats.armor, [side * .19, 3.227, -.01], [.023, .079, .075], true);
    parts.cylinder(mats.dark, [side * .206, 3.225, -.01], [.027, .027], .014, [0, 0, Math.PI / 2], 16);
    fitting(parts, mats.dark, [side * .12, 3.305, .135], [.022, .022, .018], true);
  }
  parts.tube(mats.rubber, [[-.2, 3.213, .025], [-.22, 3.116, .104], [-.107, 3.105, .156]], .0055, 18, 5);
  fitting(parts, mats.dark, [-.105, 3.105, .159], [.025, .014, .015], true);
}

/** Add only the body to a material-batched Assembly. Existing role equipment
 * is deliberately added afterwards by the original support-model factory. */
export function addMarineAnatomy(parts, mats, weaponKind = 'marine') {
  if (!ROLES.has(weaponKind)) throw new RangeError('Unknown Marine weapon silhouette');
  for (const method of ['add', 'box', 'sphere', 'tube', 'cylinder'])
    if (typeof parts?.[method] !== 'function') throw new TypeError('Marine anatomy requires a support Assembly');
  for (const name of ['armor', 'dark', 'cloth', 'skin', 'rubber', 'steel'])
    if (!mats?.[name]?.isMaterial) throw new TypeError('Marine anatomy requires the existing human surface family');
  const pose = weaponPose(weaponKind);
  uniformTorso(parts, mats); bootsAndLegs(parts, mats); sleevesAndArms(parts, mats, pose);
  fittedArmor(parts, mats); const landmarks = facialAnatomy(parts, mats); helmet(parts, mats);
  return { revision: 'human-support-anatomy-20261109', standingHeight: BODY.standingHeight,
    headHeight: BODY.headHeight, headsTall: BODY.standingHeight / BODY.headHeight,
    handAnchors: { right: [...pose.right.wrist], left: [...pose.left.wrist] },
    legacyHandAnchors: { right: [...BODY.rightWrist], left: [...BODY.leftWrist] },
    weaponGrips: [pose.right, pose.left].map(grip => ({ kind: grip.kind, position: [...grip.center], side: grip.side })),
    facialLandmarks: landmarks, factionInsigniaAdded: false,
    visualFidelity1to1Verified: false, equipmentRoleChanged: false };
}

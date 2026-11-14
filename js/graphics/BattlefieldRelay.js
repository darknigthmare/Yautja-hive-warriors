/* Interactive relay furniture, with the same physical footprint in every biome.
 * Its geometry/materials belong to EnvironmentManager; updates create no geometry. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const STATE_COLORS = { dormant: 0x485d60, 'awaiting-activation': 0xf5cc77, counterattack: 0xff8856, secured: 0x85ebba };

export function buildBattlefieldRelay(environment, sector, parent) {
  const env = environment, organic = env.type === 'hive', ritual = env.type === 'temple';
  const group = new THREE.Group(); group.name = 'battlefield-relay-console'; parent.add(group);
  const structure = env.material('relay-structure', { color: organic ? 0x615469 : ritual ? 0x8e968c : 0x69716a,
    roughness: organic ? 0.38 : ritual ? 0.84 : 0.55, metalness: ritual ? 0.08 : 0.58,
    surface: organic ? 'chitin' : ritual ? 'stone' : 'armor' });
  const recess = env.material('relay-recess', { color: 0x1b282b, roughness: 0.72, metalness: 0.4, surface: organic ? 'chitin' : 'metal' });
  const edges = env.material('relay-edges', { color: ritual ? 0xa8a582 : 0x9b9f8c, roughness: 0.42, metalness: ritual ? 0.42 : 0.78, surface: 'metal' });
  const signal = env.material(`relay-signal-${sector.id}`, { color: STATE_COLORS.dormant, emissive: STATE_COLORS.dormant, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.15, surface: 'metal' });
  const progressMaterial = env.material('relay-progress', { color: 0xffffff, roughness: 0.5, metalness: 0.25, surface: 'metal' });
  const box = env.geometry('relay-rounded-block', () => env.geometries.get('beveled-box')?.clone() ?? new THREE.BoxGeometry(1, 1, 1));
  const cylinder = env.geometry('relay-cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 24));
  const torus = env.geometry('relay-collar', () => new THREE.TorusGeometry(1, 0.055, 8, 28));
  const pieces = new Map(), matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  const add = (geometry, material, position, scale = [1, 1, 1], angles = [0, 0, 0]) => {
    rotation.setFromEuler(new THREE.Euler(...angles));
    matrix.compose(new THREE.Vector3(...position), rotation, new THREE.Vector3(...scale));
    const prepared = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    prepared.applyMatrix4(matrix);
    const bucket = pieces.get(material) ?? []; bucket.push(prepared); pieces.set(material, bucket);
  };
  const block = (material, position, scale, angles) => add(box, material, position, scale, angles);
  block(recess, [0, 0.04, 0], [2.55, 0.08, 2.3]);
  block(structure, [0, 0.24, 0], [1.7, 0.4, 1.45]);
  if (organic) {
    const membrane = env.geometry('relay-organic-shell', () => new THREE.SphereGeometry(1, 24, 18));
    add(membrane, structure, [0, 1.1, -0.16], [0.83, 1.12, 0.65]);
    for (const side of [-1, 1]) for (let rib = 0; rib < 5; rib++) {
      block(recess, [side * 0.67, 0.65 + rib * 0.25, -0.1], [0.13, 0.09, 0.9], [0, side * 0.14, side * 0.25]);
    }
  } else if (ritual) {
    block(structure, [0, 0.87, 0], [1.5, 1.26, 1.3]);
    block(edges, [0, 1.54, 0], [1.85, 0.12, 1.52]);
    for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
      block(recess, [side * 0.61, 0.6 + row * 0.23, 0.658], [0.06, 0.12, 0.018], [0, 0, side * 0.25]);
      block(edges, [side * 0.49, 0.64 + row * 0.23, 0.67], [0.12, 0.025, 0.018]);
    }
  } else {
    block(structure, [0, 1.05, -0.12], [1.35, 1.62, 1.1]);
    block(recess, [0, 1.35, 0.45], [1.13, 0.66, 0.12]);
    for (const side of [-1, 1]) {
      block(edges, [side * 0.69, 0.96, -0.12], [0.08, 1.55, 1.14]);
      for (let row = 0; row < 6; row++) block(recess, [side * 0.733, 0.53 + row * 0.1, -0.13], [0.025, 0.035, 0.67]);
    }
    block(edges, [0, 0.96, 0.64], [1.16, 0.08, 0.36], [-0.15, 0, 0]);
    for (let key = 0; key < 6; key++) block(recess, [(key - 2.5) * 0.15, 1.017, 0.67], [0.09, 0.025, 0.09]);
  }
  // The control face sits above the contact plane, with a protective frame and
  // actual recessed strips. No externally fetched text or canvas texture.
  block(recess, [0, 1.66, 0.47], [1.12, 0.76, 0.16], [-0.23, 0, 0]);
  block(signal, [0, 1.68, 0.56], [0.88, 0.49, 0.028], [-0.23, 0, 0]);
  for (let row = 0; row < 3; row++) {
    block(recess, [-0.08 + row * 0.05, 1.53 + row * 0.13, 0.609 - row * 0.03], [0.57 - row * 0.1, 0.045, 0.012]);
    block(edges, [-0.33, 1.53 + row * 0.13, 0.625 - row * 0.03], [0.035, 0.055, 0.018]);
  }
  for (const side of [-1, 1]) {
    // An antenna silhouette remains visible above troops without a full-screen
    // beam hiding the fight. Its light is driven by real objective state.
    add(cylinder, recess, [side * 0.97, 2.66, -0.59], [0.055, 5.25, 0.055]);
    for (const y of [1.9, 3.1, 4.2]) add(torus, edges, [side * 0.97, y, -0.59], [0.13, 0.13, 0.13], [Math.PI / 2, 0, 0]);
    add(cylinder, signal, [side * 0.97, 4.93, -0.59], [0.09, 0.38, 0.09]);
    add(torus, edges, [side * 0.97, 5.17, -0.59], [0.17, 0.17, 0.17], [Math.PI / 2, 0, 0]);
    for (const y of [0.5, 1.1, 1.8]) add(cylinder, edges, [side * 0.59, y, 0.49], [0.045, 0.04, 0.045], [Math.PI / 2, 0, 0]);
  }
  let index = 0;
  for (const [material, geometries] of pieces) {
    const geometry = env.geometry(`relay-${sector.id}-batched-${index++}`, () => mergeGeometries(geometries, false));
    geometries.forEach(item => item.dispose());
    const mesh = env.mesh(geometry, material, [0, 0, 0], [1, 1, 1], group);
    mesh.name = material === signal ? 'relay-signal-panels' : 'relay-console-detail';
  }
  const arc = env.geometry('relay-progress-segment', () => {
    const geometry = new THREE.RingGeometry(2.95, 3.17, 8, 1, 0, Math.PI * 2 / 12 * 0.78);
    geometry.rotateX(-Math.PI / 2); return geometry;
  });
  const segments = new THREE.InstancedMesh(arc, progressMaterial, 12); segments.name = 'relay-objective-progress';
  const dummy = new THREE.Object3D();
  for (let item = 0; item < 12; item++) {
    dummy.position.set(0, 0.04, 0); dummy.rotation.set(0, item / 12 * Math.PI * 2, 0); dummy.updateMatrix();
    segments.setMatrixAt(item, dummy.matrix); segments.setColorAt(item, new THREE.Color(STATE_COLORS.dormant));
  }
  segments.castShadow = false; group.add(segments);
  env.addBoxCollider(sector.objective.position[0], sector.objective.position[1], 0.9, 0.76, 2.15);
  let phase = 'dormant', ratio = 0, age = 0, previousKey = '';
  const color = new THREE.Color();
  const setState = (nextPhase, amount = 0) => {
    phase = STATE_COLORS[nextPhase] === undefined ? 'dormant' : nextPhase;
    ratio = THREE.MathUtils.clamp(Number.isFinite(amount) ? amount : 0, 0, 1);
    const key = `${phase}:${Math.floor(ratio * 12)}`;
    group.userData.relayPhase = phase; group.userData.progress = ratio;
    if (key === previousKey) return;
    previousKey = key;
    signal.color.setHex(STATE_COLORS[phase]); signal.emissive.setHex(STATE_COLORS[phase]);
    for (let item = 0; item < 12; item++) {
      color.setHex(phase === 'secured' || item < Math.floor(ratio * 12) ? STATE_COLORS.secured : phase === 'counterattack' ? STATE_COLORS.counterattack : STATE_COLORS.dormant);
      segments.setColorAt(item, color);
    }
    segments.instanceColor.needsUpdate = true;
  };
  const update = delta => {
    if (!Number.isFinite(delta) || delta <= 0) return;
    age += Math.min(delta, 0.1);
    signal.emissiveIntensity = phase === 'dormant' ? 0.15 : phase === 'counterattack' ? 0.65 + Math.sin(age * 5) * 0.15 : 0.55;
  };
  setState('dormant');
  return { group, segments, setState, update, getState: () => ({ phase, progress: ratio, time: age }) };
}

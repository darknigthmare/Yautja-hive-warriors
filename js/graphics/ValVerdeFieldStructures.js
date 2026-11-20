/* An original field-camp interpretation, not a reconstruction of a film set.
 * Centimetre-scale joints, planks and profiled sheet metal are real geometry.
 * Grounded wall sections are deliberately retained as physical cover by the
 * reference-contact builder; their visible timber has the same envelope.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSurfaceMaterial } from './SurfaceLibrary.js';

export const VAL_VERDE_FIELD_PLACEMENT = Object.freeze({
  shack: Object.freeze([14, 0, 14]),
  watchtower: Object.freeze([-14, 0, -14])
});

function plankGeometry(width, height, depth) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = geometry.attributes.uv;
  // The wood preset's fibres run along V. Project each long board in metres,
  // keeping the grain lengthwise instead of stretching a bark tile over a wall.
  const dimensions = [width, height, depth], grainAxis = dimensions.indexOf(Math.max(...dimensions));
  for (let index = 0; index < position.count; index++) {
    const point = [position.getX(index), position.getY(index), position.getZ(index)];
    const faceNormal = [Math.abs(normal.getX(index)), Math.abs(normal.getY(index)), Math.abs(normal.getZ(index))];
    const normalAxis = faceNormal.indexOf(Math.max(...faceNormal));
    const acrossAxis = [0, 1, 2].find(axis => axis !== grainAxis && axis !== normalAxis) ?? (grainAxis + 1) % 3;
    uv.setXY(index, point[acrossAxis] / .48 + .5, point[grainAxis] / 1.8 + .5);
  }
  geometry.userData.grainAxis = ['x', 'y', 'z'][grainAxis];
  return geometry;
}

function piece(group, geometry, material, position, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position); mesh.name = name;
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function beam(group, start, end, width, depth, material, name) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const mesh = piece(group, plankGeometry(width, a.distanceTo(b), depth), material,
    a.clone().add(b).multiplyScalar(.5).toArray(), name);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return mesh;
}

function wall(group, material, boards, name) {
  const pieces = boards.map(({ size, at }) => plankGeometry(...size).translate(...at));
  const geometry = mergeGeometries(pieces, false);
  pieces.forEach(geometry => geometry.dispose());
  return piece(group, geometry, material, [0, 0, 0], name);
}

export function corrugatedRoofGeometry(width = 5.1, halfDepth = 2.55, ridgeHeight = 3.22, eaveHeight = 2.7) {
  const positions = [], uv = [], indices = [];
  const columns = 500, rows = 3, waves = 60, amplitude = .014;
  // Two pitched sheets meet at a ridge. Corrugations run down the slope, with
  // an 85mm pitch and 14mm amplitude, including the silhouette at the eaves.
  for (const side of [-1, 1]) {
    const offset = positions.length / 3;
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const u = column / columns, t = row / rows;
      const corrugation = Math.cos(u * waves * Math.PI * 2) * amplitude;
      positions.push((u - .5) * width, ridgeHeight + (eaveHeight - ridgeHeight) * t + corrugation, side * t * halfDepth);
      uv.push(u * width / 1.5, t * halfDepth / 1.5);
      if (row < rows && column < columns) {
        const a = offset + row * (columns + 1) + column, b = a + columns + 1;
        if (side > 0) indices.push(a, b, a + 1, a + 1, b, b + 1);
        else indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.userData.fieldStructure = 'pitched-corrugated-tin';
  geometry.userData.corrugationPitchMetres = width / waves;
  geometry.userData.roofProfile = { width, halfDepth, ridgeHeight, eaveHeight, columns, waves, amplitude };
  return geometry;
}

export function corrugatedRoofHeightAt(x, z, profile) {
  const { width, halfDepth, ridgeHeight, eaveHeight, columns, waves, amplitude } = profile;
  const sample = THREE.MathUtils.clamp((x / width + .5) * columns, 0, columns);
  const column = Math.min(columns - 1, Math.floor(sample)), blend = sample - column;
  // Interpolate the same sampled vertices as the actual triangles, rather than
  // an ideal sine wave that sits slightly above the rendered corrugation.
  const a = Math.cos(column / columns * waves * Math.PI * 2) * amplitude;
  const b = Math.cos((column + 1) / columns * waves * Math.PI * 2) * amplitude;
  return ridgeHeight + (eaveHeight - ridgeHeight) * Math.abs(z) / halfDepth + THREE.MathUtils.lerp(a, b, blend);
}

export function buildValVerdeCommunicationsShack() {
  const group = new THREE.Group(); group.name = 'val-verde-communications-shack';
  group.position.set(...VAL_VERDE_FIELD_PLACEMENT.shack);
  group.userData.referenceInterpretation = 'original-guerrilla-field-camp';
  const timber = createSurfaceMaterial('wood', { color: 0xc3b18e, roughness: .92, metalness: 0, normalScale: new THREE.Vector2(.32, .32) });
  const framing = createSurfaceMaterial('wood', { color: 0x8e8165, roughness: .94, metalness: 0, normalScale: new THREE.Vector2(.26, .26) });
  const tin = createSurfaceMaterial('metal', { color: 0x8c9186, finish: 'bare', roughness: .77, metalness: .46, side: THREE.DoubleSide });
  const darkMetal = createSurfaceMaterial('metal', { color: 0x4e554d, finish: 'matte', roughness: .83, metalness: .25 });
  const rows = 12, pitch = .217, boardHeight = .211;
  const left = [], right = [], rear = [], frontLeft = [], frontRight = [];
  for (let row = 0; row < rows; row++) {
    const y = .12 + row * pitch + boardHeight / 2;
    // A raised observation slit belongs to the rear wall, above walking height.
    if (row >= 6 && row <= 8) {
      for (const sign of [-1, 1]) rear.push({ size: [1.49, boardHeight, .32], at: [sign * 1.455, y, -2.04] });
    } else rear.push({ size: [4.4, boardHeight, .32], at: [0, y, -2.04] });
    left.push({ size: [.32, boardHeight, 4.4], at: [-2.04, y, 0] });
    right.push({ size: [.32, boardHeight, 4.4], at: [2.04, y, 0] });
    frontLeft.push({ size: [1.4, boardHeight, .32], at: [-1.5, y, 2.04] });
    frontRight.push({ size: [1.4, boardHeight, .32], at: [1.5, y, 2.04] });
  }
  wall(group, timber, left, 'shack-west-timber-wall');
  wall(group, timber, right, 'shack-east-timber-wall');
  wall(group, timber, rear, 'shack-rear-wall-with-window');
  wall(group, timber, frontLeft, 'shack-door-left-wall');
  wall(group, timber, frontRight, 'shack-door-right-wall');
  piece(group, plankGeometry(1.6, .48, .32), timber, [0, 2.47, 2.04], 'shack-door-lintel');
  for (const x of [-.85, .85]) beam(group, [x, .12, 2.24], [x, 2.28, 2.24], .1, .1, framing, 'shack-door-jamb');
  for (const x of [-2.04, 2.04]) for (const z of [-2.04, 2.04]) {
    beam(group, [x, 0, z], [x, 2.8, z], .19, .19, framing, 'shack-corner-post');
    // Obvious mortise/strap assembly gives the roof a readable load path.
    piece(group, new THREE.BoxGeometry(.24, .16, .04), darkMetal, [x, 2.49, z + .19], 'shack-post-strap');
  }
  for (const z of [-2.04, 2.04]) {
    beam(group, [-2.26, 2.68, z], [2.26, 2.68, z], .16, .18, framing, 'shack-eave-beam');
    beam(group, [-2.16, .2, z], [2.16, .2, z], .14, .18, framing, 'shack-sill');
  }
  for (const x of [-1.96, 0, 1.96]) for (const side of [-1, 1]) {
    beam(group, [x, 3.18, 0], [x, 2.66, side * 2.42], .13, .14, framing, 'shack-rafter');
  }
  const roof = piece(group, corrugatedRoofGeometry(), tin, [0, 0, 0], 'shack-corrugated-tin-roof');
  roof.userData.fieldStructure = 'pitched-corrugated-tin';
  piece(group, new THREE.CylinderGeometry(.055, .055, 5.2, 8), tin, [0, 3.245, 0], 'shack-ridge-cap').rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    beam(group, [-2.55, 2.7, side * 2.55], [2.55, 2.7, side * 2.55], .045, .065, tin, 'shack-eave-fold');
  }
  // Distinct radio equipment instead of a pole growing from a solid cube.
  piece(group, new THREE.CylinderGeometry(.026, .038, 3.7, 10), darkMetal, [1.75, 4.45, -1.65], 'shack-radio-mast');
  for (let element = 0; element < 3; element++) {
    const rod = piece(group, new THREE.CylinderGeometry(.014, .014, 1.15 - element * .15, 7), darkMetal,
      [1.75, 5.52 + element * .25, -1.65], 'shack-radio-aerial');
    rod.rotation.z = Math.PI / 2;
  }
  return group;
}

export function buildValVerdeWatchtower() {
  const group = new THREE.Group(); group.name = 'val-verde-timber-watchtower';
  group.position.set(...VAL_VERDE_FIELD_PLACEMENT.watchtower);
  group.userData.referenceInterpretation = 'original-guerrilla-field-camp';
  const timber = createSurfaceMaterial('wood', { color: 0x9e9273, roughness: .94, metalness: 0 });
  const bagMaterial = createSurfaceMaterial('fabric', { color: 0x9c987e, roughness: .98, metalness: 0 });
  for (const x of [-1.8, 1.8]) for (const z of [-1.8, 1.8]) {
    piece(group, new THREE.CylinderGeometry(.2, .28, 6.2, 14), timber, [x, 3.1, z], 'watchtower-grounded-post');
  }
  for (const z of [-1.8, 1.8]) {
    beam(group, [-1.8, .55, z], [1.8, 5.2, z], .15, .15, timber, 'watchtower-cross-brace');
    beam(group, [1.8, .55, z], [-1.8, 5.2, z], .15, .15, timber, 'watchtower-cross-brace');
    beam(group, [-2.12, 5.23, z], [2.12, 5.23, z], .22, .25, timber, 'watchtower-deck-joist');
  }
  const deckBoards = Array.from({ length: 13 }, (_, board) => ({
    size: [4.2, .18, .294], at: [0, 5.5, -1.65 + board * .3]
  }));
  // A real notch leaves the last treads exposed. An uninterrupted front board
  // would overhang two steps and create a >65cm drop while descending.
  for (const side of [-1, 1]) deckBoards.push({ size: [1.3, .18, .294], at: [side * 1.45, 5.5, -1.95] });
  wall(group, timber, deckBoards, 'watchtower-deck');
  const bag = new THREE.SphereGeometry(1, 12, 8);
  for (const z of [-2, 2]) for (let row = 0; row < 2; row++) for (let column = 0; column < 6; column++) {
    if (z < 0 && column > 0 && column < 5) continue;
    const mesh = piece(group, bag, bagMaterial, [-1.73 + column * .67 + row * .06, 5.77 + row * .26, z], 'watchtower-filled-sandbag');
    mesh.scale.set(.39, .18, .25); mesh.rotation.y = Math.sin(column * 4.7 + row) * .075;
  }
  // Wide timber ladder treads have real upper faces. Their 31cm rise remains
  // within the game's step limit; the matching registry uses these exact steps.
  const foot = new THREE.Vector3(0, .08, -4.1), top = new THREE.Vector3(0, 5.63, -1.87);
  for (const x of [-.64, .64]) beam(group, [x, foot.y, foot.z], [x, top.y, top.z], .11, .14, timber, 'watchtower-ladder-stile');
  const steps = [], treadBoards = [];
  for (let rung = 0; rung < 18; rung++) {
    const at = foot.clone().lerp(top, (rung + .5) / 18);
    const halfDepth = rung === 17 ? .15 : .08;
    treadBoards.push({ size: [1.3, .07, halfDepth * 2], at: [0, at.y, at.z] });
    steps.push({ minZ: at.z - halfDepth, maxZ: at.z + halfDepth, topY: at.y + .035 });
  }
  const treads = wall(group, timber, treadBoards, 'watchtower-ladder-treads');
  treads.userData.ladderSteps = steps;
  treads.userData.referenceWalkContactOnly = true;
  treads.userData.measuredStairTreads = true;
  return group;
}

export function registerValVerdeFieldWalkSurfaces(environment, shack, tower) {
  if (!environment.registerReferenceWalkSurface) return [];
  const deck = tower.getObjectByName('watchtower-deck'), ladder = tower.getObjectByName('watchtower-ladder-treads');
  const roof = shack.getObjectByName('shack-corrugated-tin-roof');
  const tx = tower.position.x, tz = tower.position.z, sx = shack.position.x, sz = shack.position.z;
  const steps = ladder.userData.ladderSteps;
  const accesses = [{ bottom: [tx, steps[0].topY, tz + steps[0].minZ], top: [tx, 5.59, tz - 1.7] }];
  // Resolve each actual tread before the upper deck can reject a lower actor.
  const records = [environment.registerReferenceWalkSurface(ladder, {
    id: 'val-verde-watchtower-treads', kind: 'ramp', requiresCurrentLayer: true,
    bounds: { minX: tx - .65, maxX: tx + .65, minZ: tz + steps[0].minZ, maxZ: tz + steps.at(-1).maxZ },
    heightAt: (_x, z) => Math.max(...steps.filter(step => z - tz >= step.minZ - 1e-7 && z - tz <= step.maxZ + 1e-7).map(step => step.topY)), accesses
  }), environment.registerReferenceWalkSurface(deck, {
    id: 'val-verde-watchtower-deck', requiresCurrentLayer: true,
    bounds: { minX: tx - 2.1, maxX: tx + 2.1, minZ: tz - 2.097, maxZ: tz + 2.097 },
    heightAt: (x, z) => Math.abs(x - tx) < .8 && z < tz - 1.803 ? NaN : 5.59, accesses
  }), environment.registerReferenceWalkSurface(roof, {
    id: 'val-verde-shack-roof', requiresCurrentLayer: true,
    bounds: { minX: sx - 2.55, maxX: sx + 2.55, minZ: sz - 2.55, maxZ: sz + 2.55 },
    heightAt: (x, z) => corrugatedRoofHeightAt(x - sx, z - sz, roof.geometry.userData.roofProfile)
  })];
  for (const record of records) {
    const owner = record.id === 'val-verde-shack-roof' ? shack : tower;
    record.collider.isCollisionActive = () => {
      if (record.mesh.userData.physicsRemoved || !owner.parent) return false;
      let node = record.mesh;
      while (node && node !== environment.referenceRoot) {
        if (!node.visible && !node.userData.referenceRenderCull) return false;
        node = node.parent;
      }
      return node === environment.referenceRoot;
    };
  }
  return records;
}

// A player can cross several small, real treads in a 100ms frame. Sweep that
// movement through the measured steps instead of asking a 65cm step solver to
// jump directly to the last tread. This does not invent a support plane or
// change the global step limit; unrelated ground and airborne motion use the
// usual player path. Explicit input displacement avoids cross-frame state and
// cannot mistake a checkpoint teleport for walking up a ladder.
export function moveMeasuredStairTraversal(environment, position, displacement, delta, radius = .75, bodyHeight = 2.4) {
  if (!Number.isFinite(delta) || delta <= 0 || !position?.isVector3 || !displacement?.isVector3) return false;
  const distance = Math.hypot(displacement.x, displacement.z);
  if (!Number.isFinite(distance) || distance < 1e-8 || distance > 12.8) return false;
  const endX = position.x + displacement.x, endZ = position.z + displacement.z;
  const intersects = environment.referenceWalkSurfaces?.some(surface => {
    if (!surface.mesh.userData.measuredStairTreads || !surface.collider.isCollisionActive()) return false;
    const bounds = surface.bounds;
    return Math.max(position.x, endX) + radius >= bounds.minX && Math.min(position.x, endX) - radius <= bounds.maxX
      && Math.max(position.z, endZ) + radius >= bounds.minZ && Math.min(position.z, endZ) - radius <= bounds.maxZ;
  });
  if (!intersects) return false;
  const startingFloor = environment.getElevationAt(position.x, position.z, position.y);
  if (!Number.isFinite(startingFloor) || Math.abs(position.y - startingFloor) > .65) return false;
  const count = Math.ceil(distance / .05), tick = delta / count;
  const step = displacement.clone().setY(0).multiplyScalar(1 / count);
  for (let index = 0; index < count; index++) {
    position.add(step);
    const floor = environment.getElevationAt(position.x, position.z, position.y);
    if (Number.isFinite(floor)) {
      // Feet follow actual tread contacts in either direction. If support is
      // lost by stepping off the flight, preserve the usual smoothed fall.
      position.y = Math.abs(floor - position.y) <= .65 ? floor : THREE.MathUtils.lerp(position.y, floor, 1 - Math.exp(-18 * tick));
    }
    environment.resolveMovement(position, radius, bodyHeight);
  }
  return true;
}

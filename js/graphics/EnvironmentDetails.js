/* Owned, instanced environment detail. No downloads or DOM dependencies. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sculptedTreeWoodGeometry, sculptedTreeCrownGeometry, sculptedFernGeometry, leafLitterGeometry, sculptedRockGeometry } from './EnvironmentSculpt.js';

export function beveledBlockGeometry() {
  return new RoundedBoxGeometry(1, 1, 1, 1, 0.055);
}

// Coordinates are in metres on the combat plane. All horizontal surfaces use
// this projection so a long road, an annulus and a round pad share texel density
// and phase. The material's maps stay shared with repeat=[1,1].
export function projectGroundUV(geometry, tileSize = 5) {
  const positions = geometry.attributes.position;
  const uv = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    uv[i * 2] = positions.getX(i) / tileSize;
    uv[i * 2 + 1] = -positions.getZ(i) / tileSize;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.userData.worldGroundTileSize = tileSize;
  return geometry;
}

export function irregularRockGeometry() {
  return sculptedRockGeometry();
}

function batch(environment, name, geometry, material, entries, castShadow = true) {
  if (!entries.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
  mesh.name = `detail-${name}`;
  mesh.userData.environmentDetail = true;
  const dummy = new THREE.Object3D();
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    dummy.position.set(...entry.position);
    dummy.scale.set(...(entry.scale || [1, 1, 1]));
    dummy.rotation.set(...(entry.rotation || [0, 0, 0]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  environment.root.add(mesh);
  return mesh;
}

function mergeOwned(environment, key, geometries) {
  const merged = environment.geometry(key, () => mergeGeometries(geometries, false));
  geometries.forEach(geometry => geometry.dispose());
  return merged;
}

function makePipe(environment, material, points, radius = 0.12, segments = 20) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  return new THREE.TubeGeometry(curve, segments, radius, 7, false);
}

export function buildDetailedForest(environment, tropical) {
  const bark = environment.material('bark', { color: tropical ? 0x83725a : 0x74776b, roughness: 0.94, surface: 'bark', repeat: [1, 3] });
  const leaf = environment.material('leaf', { color: tropical ? 0x72894f : 0x6f8c55, roughness: 0.88, metalness: 0, surface: 'leaf', vertexColors: true, side: THREE.DoubleSide });
  const undergrowth = environment.material('undergrowth', { color: tropical ? 0x839454 : 0x7a9265, roughness: 0.94, metalness: 0, surface: 'leaf', vertexColors: true, side: THREE.DoubleSide });
  const litterMaterial = environment.material('fallen-leaf-material', { color: 0x655a3d, roughness: 0.98, metalness: 0, surface: 'leaf', vertexColors: true, side: THREE.DoubleSide });
  const rock = environment.material('rock', { color: tropical ? 0x8b8d79 : 0x829394, roughness: 0.92, surface: 'stone' });
  const woodGeometry = environment.geometry('tree-wood-sculpt', () => sculptedTreeWoodGeometry(tropical));
  const canopyGeometry = environment.geometry('canopy-sculpt', () => sculptedTreeCrownGeometry(tropical));
  const rockGeometry = environment.geometry('rock-hd', irregularRockGeometry);
  const trees = [];
  for (let i = 0; i < 40; i++) {
    const [x, z] = environment.pointInQuadrant(i, 19, 61);
    const scale = 0.8 + environment.random() * 0.4;
    const yaw = environment.random() * Math.PI * 2;
    trees.push({ position: [x, 0, z], scale: [scale, scale, scale], rotation: [Math.sin(i * 2.39) * 0.025, yaw, Math.cos(i * 3.15) * 0.027] });
    environment.addCollider(x, z, 1.05 * scale, 11 * scale);
  }
  batch(environment, 'tree-trunks', woodGeometry, bark, trees);
  batch(environment, 'individual-leaf-canopies', canopyGeometry, leaf, trees);
  for (let i = 0; i < 18; i++) {
    const [x, z] = environment.pointInQuadrant(i, 17, 58);
    const size = 0.8 + environment.random() * 1.1;
    const boulder = environment.mesh(rockGeometry, rock, [x, size * 0.6, z], [size * 1.4, size, size]);
    boulder.rotation.y = environment.random() * Math.PI;
    boulder.name = 'detail-eroded-boulder';
    environment.addCollider(x, z, size * 1.05, size * 1.5);
  }
  const ferns = [], litter = [];
  for (let i = 0; i < 760; i++) {
    const x = (environment.random() - 0.5) * 124;
    const z = (environment.random() - 0.5) * 124;
    if (environment.isClearLane(x, z)) continue;
    const scale = 0.55 + environment.random() * 0.55;
    const yaw = environment.random() * 6.28;
    if (ferns.length < 240) ferns.push({ position: [x, 0, z], scale: [scale, scale, scale], rotation: [0, yaw, 0] });
    if (i % 3 === 0) litter.push({ position: [x + 0.8, 0.025, z], scale: [scale, 0.4, scale], rotation: [0, environment.random() * 6.28, 0] });
  }
  batch(environment, 'ferns', environment.geometry('fern-sculpt', () => sculptedFernGeometry(tropical)), undergrowth, ferns, false);
  batch(environment, 'fallen-leaves', environment.geometry('leaf-litter-sculpt', leafLitterGeometry), litterMaterial, litter, false);
  const distant = [];
  for (let i = 0; i < 36; i++) {
    const angle = i / 36 * Math.PI * 2;
    const distance = 82 + i % 4 * 6;
    const height = 1.05 + i % 5 * 0.17;
    distant.push({ position: [Math.sin(angle) * distance, -0.12, Math.cos(angle) * distance], scale: [height, height, height], rotation: [Math.sin(i) * 0.025, angle * 3.7, Math.cos(i) * 0.028] });
  }
  batch(environment, 'distant-trunks', environment.geometry('distant-wood-sculpt', () => sculptedTreeWoodGeometry(tropical, true)), bark, distant, false);
  batch(environment, 'distant-canopies', environment.geometry('distant-canopy-sculpt', () => sculptedTreeCrownGeometry(tropical, true)), leaf, distant, false);
}

function addTempleDetails(environment) {
  const stone = environment.material('carved-stone', { color: 0xa8aeb1, roughness: 0.84, surface: 'stone', repeat: [1, 2] });
  const incisions = environment.material('stone-recess', { color: 0x283238, roughness: 0.95, surface: 'stone' });
  const blocks = [], recesses = [];
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const sx = quadrant % 2 ? 1 : -1, sz = quadrant < 2 ? -1 : 1;
    const x = sx * 37, z = sz * 37;
    for (let level = 0; level < 8; level++) {
      const width = 2.7 - level * 0.14;
      blocks.push({ position: [x, 1.65 + level * 0.94, z], scale: [width, 0.13, width], rotation: [0, Math.PI / 4, 0] });
      for (let face = 0; face < 4; face++) {
        const angle = face * Math.PI / 2;
        const across = 1.1 - level * 0.035;
        recesses.push({ position: [x + Math.sin(angle) * across, 2.0 + level * 0.82, z + Math.cos(angle) * across], scale: [0.07, 0.48, 0.07], rotation: [0, angle, level % 2 ? 0.28 : -0.28] });
      }
    }
    for (let tile = 0; tile < 12; tile++) {
      const angle = tile / 12 * Math.PI * 2;
      blocks.push({ position: [x + Math.cos(angle) * 3.5, 0.25, z + Math.sin(angle) * 3.5], scale: [0.8, 0.2, 0.65], rotation: [0.08, angle, -0.04] });
    }
  }
  batch(environment, 'carved-obelisk-bands', environment.geometry('detail-block', beveledBlockGeometry), stone, blocks);
  batch(environment, 'recessed-inscriptions', environment.geometry('box', () => new THREE.BoxGeometry(1, 1, 1)), incisions, recesses, false);
  // Distant stepped ziggurat gives the temple a recognizable architectural
  // silhouette. It is wholly beyond the playable boundary.
  for (let tier = 0; tier < 9; tier++) {
    const size = 82 - tier * 7.8;
    environment.box(stone, [0, tier * 2.6 + 1.3, -121], [size, 2.6, size * 0.8]).name = 'detail-distant-pyramid';
  }
  const columns = [];
  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2;
    for (let index = -3; index <= 3; index++) columns.push({ position: [Math.sin(angle) * 67 + Math.cos(angle) * index * 16, 2, Math.cos(angle) * 67 - Math.sin(angle) * index * 16], scale: [0.5, 4, 0.6], rotation: [0, angle, 0] });
  }
  batch(environment, 'boundary-masonry-joints', environment.geometry('detail-block', beveledBlockGeometry), stone, columns);
}

function addHiveDetails(environment) {
  const resin = environment.material('wet-resin-detail', { color: 0x666475, roughness: 0.24, metalness: 0.3, surface: 'chitin', repeat: [2, 3] });
  const membrane = environment.material('resin-membrane', { color: 0x736b52, roughness: 0.7, metalness: 0, surface: 'skin' });
  const tubes = [];
  for (let strand = 0; strand < 32; strand++) {
    const side = strand % 4, angle = side * Math.PI / 2;
    const along = (Math.floor(strand / 4) - 3.5) * 15;
    const baseX = Math.sin(angle) * 64 + Math.cos(angle) * along;
    const baseZ = Math.cos(angle) * 64 - Math.sin(angle) * along;
    tubes.push(makePipe(environment, resin, [[baseX, 0.2, baseZ], [baseX * 0.98, 2, baseZ * 0.98], [baseX * 1.01, 4.5, baseZ * 1.01], [baseX * 0.98, 7.5, baseZ * 0.98]], 0.15 + strand % 3 * 0.055, 18));
  }
  const veinMesh = environment.mesh(mergeOwned(environment, 'hive-tube-detail', tubes), resin);
  veinMesh.name = 'detail-resin-conduits';
  const sacs = [], collars = [];
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const x = (quadrant % 2 ? 1 : -1) * 38, z = (quadrant < 2 ? -1 : 1) * 38;
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2;
      const eggX = x + Math.cos(angle) * 3.2, eggZ = z + Math.sin(angle) * 3.2;
      collars.push({ position: [eggX, 1.9, eggZ], scale: [0.82, 0.82, 0.82], rotation: [Math.PI / 2, 0, 0] });
      for (let petal = 0; petal < 4; petal++) {
        const pAngle = petal * Math.PI / 2;
        sacs.push({ position: [eggX + Math.cos(pAngle) * 0.28, 2.35, eggZ + Math.sin(pAngle) * 0.28], scale: [0.16, 0.38, 0.16], rotation: [Math.sin(pAngle) * 0.25, 0, -Math.cos(pAngle) * 0.25] });
      }
    }
  }
  batch(environment, 'egg-petals', environment.geometry('resin-petal', () => new THREE.SphereGeometry(1, 8, 6)), membrane, sacs);
  batch(environment, 'egg-ribbing', environment.geometry('resin-collar', () => new THREE.TorusGeometry(1, 0.11, 6, 20)), resin, collars);
  const veins = [];
  for (let i = 0; i < 20; i++) {
    const angle = i / 20 * Math.PI * 2;
    const start = 38 + i % 3 * 5;
    veins.push(makePipe(environment, resin, [[Math.sin(angle) * start, 0.015, Math.cos(angle) * start], [Math.sin(angle + 0.05) * 51, 0.02, Math.cos(angle + 0.05) * 51], [Math.sin(angle - 0.04) * 64, 0.04, Math.cos(angle - 0.04) * 64]], 0.055, 14));
  }
  environment.mesh(mergeOwned(environment, 'hive-ground-veins', veins), resin).name = 'detail-organic-floor-veins';
}

function addIndustrialDetails(environment, station) {
  const metal = environment.material('brushed-metal-detail', { color: station ? 0x85969c : 0x6d7a80, roughness: 0.46, metalness: 0.8, surface: 'metal', repeat: [1, 2] });
  const dark = environment.material('vent-recess-detail', { color: 0x202b30, roughness: 0.75, metalness: 0.55, surface: 'metal' });
  const yellow = environment.material('warning-detail', { color: 0xc7a254, roughness: 0.65, metalness: 0.3, surface: 'armor' });
  const slats = [], trim = [], warnings = [], conduits = [];
  const fanRings = [], fanBlades = [];
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const sx = quadrant % 2 ? 1 : -1, sz = quadrant < 2 ? -1 : 1;
    const x = sx * 38, z = sz * 38;
    const front = z - sz * (station ? 4.1 : 3.1);
    for (let i = -8; i <= 8; i++) {
      slats.push({ position: [x + i * 0.4, 1.7, front], scale: [0.13, station ? 0.9 : 1.7, 0.1] });
    }
    trim.push({ position: [x, 0.35, front], scale: [8.3, 0.13, 0.22] });
    trim.push({ position: [x, station ? 2.75 : 2.9, front], scale: [8.3, 0.13, 0.22] });
    for (const side of [-1, 1]) {
      const cx = x + side * 2.25;
      fanRings.push({ position: [cx, station ? 3.2 : 3.7, z], scale: [1, 1, 1], rotation: [Math.PI / 2, 0, 0] });
      for (let blade = 0; blade < 5; blade++) fanBlades.push({ position: [cx, station ? 3.2 : 3.7, z], scale: [0.22, 0.06, 1.9], rotation: [0, blade / 5 * Math.PI, 0.12] });
      conduits.push(makePipe(environment, metal, [[x + side * 4.3, 0.25, z + sz * 1.9], [x + side * 4.5, 1.3, z + sz * 1.9], [x + side * 4.5, 2.7, z - sz * 1.7], [x + side * 3.8, 3.3, z - sz * 1.9]], 0.11, 15));
    }
    for (let stripe = 0; stripe < 9; stripe++) warnings.push({ position: [x - 3.2 + stripe * 0.8, 0.13, front - sz * 0.65], scale: [0.36, 0.04, 0.72], rotation: [0, 0.45, 0] });
    if (station) {
      const consoles = [];
      for (let panel = -2; panel <= 2; panel++) {
        consoles.push({ position: [x + panel * 1.55, 3.12, z - sz * 2.7], scale: [1.1, 0.15, 1.7] });
        // Repeated raised ribbing reads in grazing light instead of painted bands.
        for (let rib = 0; rib < 3; rib++) slats.push({ position: [x + panel * 1.55 - 0.32 + rib * 0.32, 3.23, z - sz * 2.7], scale: [0.08, 0.05, 1.4] });
      }
      batch(environment, `lab-service-panels-${quadrant}`, environment.geometry('detail-block', beveledBlockGeometry), metal, consoles);
    }
  }
  const box = environment.geometry('detail-block', beveledBlockGeometry);
  batch(environment, 'vent-slats', box, dark, slats);
  batch(environment, 'panel-frames', box, metal, trim);
  batch(environment, 'hazard-markings', box, yellow, warnings, false);
  batch(environment, 'ventilation-fan-rings', environment.geometry('fan-ring', () => new THREE.TorusGeometry(1.02, 0.1, 8, 28)), metal, fanRings);
  batch(environment, 'ventilation-fan-blades', box, dark, fanBlades);
  environment.mesh(mergeOwned(environment, 'service-pipes', conduits), metal).name = 'detail-service-pipework';
  const grates = [], puddles = [];
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    const x = Math.sin(angle) * 51, z = Math.cos(angle) * 51;
    for (let bar = 0; bar < 7; bar++) grates.push({ position: [x - 0.8 + bar * 0.26, 0.055, z], scale: [0.09, 0.04, 2.2], rotation: [0, angle, 0] });
    if (!station && i % 2 === 0) puddles.push({ position: [x + 2.6, 0.045, z + 2], scale: [2.4, 1.1, 1], rotation: [-Math.PI / 2, 0, angle] });
  }
  batch(environment, 'floor-drain-grates', box, dark, grates, false);
  if (!station) {
    const wet = environment.material('rain-puddles', { color: 0x4a5966, roughness: 0.08, metalness: 0.65, surface: 'metal' });
    batch(environment, 'rain-puddles', environment.geometry('puddle', () => new THREE.CircleGeometry(1, 32)), wet, puddles, false);
    addSkylineWindows(environment);
  }
}

function addSkylineWindows(environment) {
  const glass = environment.material('skyline-window-detail', { color: 0xdcc5a1, emissive: 0xffbc72, emissiveIntensity: 0.5, roughness: 0.28, metalness: 0.6, surface: 'metal' });
  const windows = [];
  // Window rows extend the building facade beyond the old four solid bands.
  for (const [index, building] of (environment.skylineBuildings || []).entries()) {
    const { x, z, height, side } = building;
    const angle = side * Math.PI / 2;
    const faceDepth = side % 2 ? 5.06 : 6.06;
    for (let row = 0; row * 2.2 < height - 2; row++) for (let column = -2; column <= 2; column++) {
      if ((row * 17 + index * 7 + column + side) % 4 === 0) continue;
      windows.push({ position: [x + Math.cos(angle) * column * 1.7 - Math.sin(angle) * faceDepth, -8 + row * 2.2, z - Math.sin(angle) * column * 1.7 - Math.cos(angle) * faceDepth], scale: [1.1, 1.2, 0.06], rotation: [0, angle, 0] });
    }
  }
  batch(environment, 'distant-city-windows', environment.geometry('box', () => new THREE.BoxGeometry(1, 1, 1)), glass, windows, false);
}

export function buildBiomeDetails(environment) {
  if (environment.type === 'temple') addTempleDetails(environment);
  else if (environment.type === 'hive') addHiveDetails(environment);
  else if (environment.type === 'station' || environment.type === 'rooftop') addIndustrialDetails(environment, environment.type === 'station');
}

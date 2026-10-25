/* Deterministic, resource-owned arenas with clear combat lanes and landmarks. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBattlefieldLayout, pointInBattlefieldRect } from '../data/BattlefieldLayouts.js';
import { createSurfaceMaterial } from '../graphics/SurfaceLibrary.js';
import { beveledBlockGeometry, buildDetailedForest, buildBiomeDetails, projectGroundUV } from '../graphics/EnvironmentDetails.js';
import { wornTrailGeometry, weatherGroundRing, naturalBoundaryGeometry, resinColumnGeometry, erodedObeliskGeometry } from '../graphics/EnvironmentSculpt.js';
import { buildBattlefieldRelay } from '../graphics/BattlefieldRelay.js';
import { buildBattlefieldSectorDetails, buildBattlefieldCorridorDetails } from '../graphics/BattlefieldSectorDetails.js';

export class EnvironmentManager {
  constructor(scene) {
    this.scene = scene;
    this.envObjects = [];
    this.colliders = [];
    this.halfSize = 66;
    this.geometries = new Map();
    this.materials = new Map();
    this.battlefieldLayout = null; this.openGates = new Set(); this.completedSectors = new Set();
    this.gateVisuals = new Map(); this.sectorVisuals = new Map(); this.objectiveMarkers = new Map();
    this.relayVisuals = new Map();
    this.corridorVisuals = new Map();
  }

  clearEnvironment() {
    this.envObjects.forEach(object => {
      object.traverse(child => { if (child.isInstancedMesh) child.dispose(); });
      this.scene.remove(object);
    });
    this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.envObjects = [];
    this.colliders = [];
    this.geometries.clear();
    this.materials.clear();
    this.root = null;
    this.skylineBuildings = [];
    this.battlefieldLayout = null;
    this.openGates = new Set();
    this.completedSectors = new Set();
    this.gateVisuals = new Map();
    this.sectorVisuals = new Map();
    this.objectiveMarkers = new Map();
    this.relayVisuals = new Map();
    this.corridorVisuals = new Map();
    this.activeSectorId = null;
    this._battlefieldRectsCache = null;
  }

  geometry(key, create) {
    if (!this.geometries.has(key)) this.geometries.set(key, create());
    return this.geometries.get(key);
  }

  material(name, parameters) {
    if (!this.materials.has(name)) {
      const { surface, ...options } = parameters;
      const organic = this.type === 'forest' || this.type === 'jungle';
      const fallback = /resin|hive|egg/.test(name) ? 'chitin'
        : /bark/.test(name) ? 'bark' : /leaf|undergrowth/.test(name) ? 'leaf'
        : /stone|rock/.test(name) || this.type === 'temple' ? 'stone'
        : name === 'floor' || name === 'path' ? (organic ? 'soil' : this.type === 'hive' ? 'chitin' : 'metal') : 'metal';
      this.materials.set(name, createSurfaceMaterial(surface || fallback, options));
    }
    return this.materials.get(name);
  }

  mesh(geometry, material, position = [0, 0, 0], scale = [1, 1, 1], parent = this.root) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  box(material, position, size, parent = this.root) {
    return this.mesh(this.geometry('beveled-box', beveledBlockGeometry), material, position, size, parent);
  }

  random() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  // Avoid the insertion area, the broad cardinal lanes, and the circular route.
  isClearLane(x, z) {
    const radius = Math.hypot(x, z);
    const landmark = this.type === 'forest'
      ? Math.hypot(x + 46, z + 45) < 9
      : this.type === 'jungle' && (Math.hypot(x - 41, z + 43) < 10 || Math.hypot(x + 41, z + 43) < 10);
    return landmark || radius < 15 || Math.abs(x) < 7 || Math.abs(z) < 7 || Math.abs(radius - 28) < 4;
  }

  pointInQuadrant(index, inner = 18, outer = 55) {
    const sx = index % 2 ? 1 : -1;
    const sz = Math.floor(index / 2) % 2 ? 1 : -1;
    for (let attempt = 0; attempt < 128; attempt++) {
      const x = sx * (inner + this.random() * (outer - inner));
      const z = sz * (inner + this.random() * (outer - inner));
      const separated = this.colliders.every(collider => collider.radius == null || Math.hypot(x - collider.x, z - collider.z) > collider.radius + 3);
      if (!this.isClearLane(x, z) && separated) return [x, z];
    }
    return [sx * 42, sz * 42];
  }

  buildLevelEnvironment(levelConfig) {
    this.clearEnvironment();
    this.halfSize = levelConfig.arenaHalfSize ?? 66;
    this.seed = levelConfig.seed ?? 1987;
    this.type = levelConfig.environmentType ?? ({ rain_forest: 'forest', hive_world: 'hive', pyramid: 'temple', la_rooftops: 'rooftop', romulus_station: 'station' }[levelConfig.theme] || 'jungle');
    this.root = new THREE.Group();
    this.root.name = `arena-${levelConfig.id}`;
    this.scene.add(this.root);
    this.envObjects.push(this.root);

    this.organic = this.type === 'forest' || this.type === 'jungle';
    const accent = levelConfig.accentColor ?? 0x70e6cd;
    this.floorMat = this.material('floor', { color: levelConfig.floorColor, roughness: this.type === 'rooftop' || this.type === 'station' ? 0.38 : 0.88, metalness: this.type === 'station' ? 0.45 : 0.05, vertexColors: true, repeat: [1, 1] });
    this.wallMat = this.material('walls', { color: levelConfig.wallColor, roughness: 0.76, metalness: this.type === 'station' ? 0.65 : 0.16 });
    this.trimMat = this.material('trim', { color: this.organic ? 0x80988b : accent, emissive: accent, emissiveIntensity: this.organic ? 0.16 : 0.5, roughness: this.organic ? 0.7 : 0.35, metalness: 0.45 });
    this.darkMat = this.material('dark', { color: 0x182228, roughness: 0.8, metalness: 0.35 });
    this.pathMat = this.material('path', { color: this.organic ? 0x50594b : levelConfig.wallColor, roughness: this.organic ? 0.96 : 0.85, metalness: this.organic ? 0 : 0.1, vertexColors: this.organic, repeat: [1, 1] });
    this.landingMat = this.material('landing-metal', { color: this.organic ? 0x5b6660 : levelConfig.wallColor, roughness: 0.64, metalness: 0.55, surface: 'metal', repeat: [1, 1] });

    this.buildGround();
    this.buildRoutes();
    if (!levelConfig.battlefield) this.buildBoundary();
    if (this.type === 'forest' || this.type === 'jungle') this.buildForest(this.type === 'jungle');
    else if (this.type === 'temple') this.buildTemple();
    else if (this.type === 'hive') this.buildHive();
    else if (this.type === 'rooftop') this.buildRooftop();
    else this.buildStation();
    buildBiomeDetails(this);
    if (levelConfig.battlefield) this.buildBattlefield(levelConfig);
    this.root.updateMatrixWorld(true);
  }

  buildGround() {
    const width = this.halfSize * 2 + 8;
    const geometry = new THREE.PlaneGeometry(width, width, 72, 72);
    geometry.rotateX(-Math.PI / 2);
    projectGroundUV(geometry);
    const positions = geometry.attributes.position;
    const colors = [];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const shade = 0.83 + Math.sin(x * 0.09 + z * 0.06) * 0.045 + Math.cos(z * 0.13 - x * 0.04) * 0.035 + this.random() * 0.025;
      colors.push(shade, shade, shade);
      // Movement uses a flat Y0 combat plane. Keep its visible surface at the
      // same height; the PBR normal map supplies the small soil/resin relief.
      positions.setY(i, 0);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    this.geometries.set('ground', geometry);
    const ground = this.mesh(geometry, this.floorMat);
    ground.name = 'detail-tessellated-ground';
    ground.castShadow = false;
  }

  buildBattlefield(levelConfig) {
    this.battlefieldLayout = createBattlefieldLayout(levelConfig);
    this.root.userData.battlefield = { sectors: 6, corridors: 5, ...this.battlefieldLayout.dimensions };
    const firstDetails = new THREE.Group(); firstDetails.name = 'sector-insertion-details';
    // Old distant silhouettes occupied the new connections. Retain their owned
    // resources for cleanup, but replace their backdrop with the actual map.
    const outsideBackdrop = /detail-(?:distant-|city-skyline|boundary-masonry-joints)/;
    for (const child of [...this.root.children]) {
      if (child.name === 'detail-tessellated-ground') continue;
      if (outsideBackdrop.test(child.name)) { child.visible = false; continue; }
      const firstExit = this.battlefieldLayout.sectors[1].center;
      const onExitLane = firstExit[0] === 0 ? Math.abs(child.position.x) < 10 : Math.abs(child.position.z) < 10;
      if (this.type === 'hive' && onExitLane && (child.geometry === this.geometries.get('hive-column') || child.geometry === this.geometries.get('spore'))) { child.visible = false; continue; }
      firstDetails.add(child);
    }
    this.root.add(firstDetails); this.sectorVisuals.set('insertion', firstDetails);
    const sectorFloor = this.geometry('battlefield-sector-floor', () => {
      const geometry = new THREE.PlaneGeometry(132, 132, 16, 16); geometry.rotateX(-Math.PI / 2); projectGroundUV(geometry);
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: geometry.attributes.position.count * 3 }, () => 0.87), 3));
      return geometry;
    });
    for (const sector of this.battlefieldLayout.sectors) {
      if (sector.id !== 'insertion') {
        const floor = this.mesh(sectorFloor, this.floorMat, [sector.center[0], 0, sector.center[1]]);
        floor.name = `battlefield-floor-${sector.id}`; floor.castShadow = false;
        const details = new THREE.Group(); details.name = `sector-${sector.id}-details`; this.root.add(details);
        this.sectorVisuals.set(sector.id, details);
        const architecture = buildBattlefieldSectorDetails(this, sector, details);
        this.buildSectorLandmarks(sector, details, architecture?.userData.landmarks);
      }
      const marker = new THREE.Group(); marker.position.set(sector.objective.position[0], 0, sector.objective.position[1]);
      marker.name = `battlefield-objective-${sector.id}`;
      const ring = this.mesh(this.geometry('battlefield-objective-ring', () => { const geometry = new THREE.RingGeometry(2.5, 2.8, 40); geometry.rotateX(-Math.PI / 2); return geometry; }), this.trimMat, [0, 0.035, 0], [1, 1, 1], marker);
      ring.castShadow = false;
      if (sector.objective.type === 'interact') {
        this.relayVisuals.set(sector.id, buildBattlefieldRelay(this, sector, marker));
      } else {
        for (const side of [-1, 1]) this.box(this.trimMat, [side * 2.9, 1.8, 0], [0.16, 3.6, 0.16], marker);
      }
      this.root.add(marker); this.objectiveMarkers.set(sector.id, marker);
    }
    for (const corridor of this.battlefieldLayout.corridors) {
      const width = corridor.bounds.maxX - corridor.bounds.minX, depth = corridor.bounds.maxZ - corridor.bounds.minZ;
      const geometry = this.geometry(`battlefield-floor-${corridor.id}`, () => { const geometry = new THREE.PlaneGeometry(width, depth); geometry.rotateX(-Math.PI / 2); projectGroundUV(geometry); geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: geometry.attributes.position.count * 3 }, () => 1), 3)); return geometry; });
      const floor = this.mesh(geometry, this.pathMat, [corridor.center[0], 0.012, corridor.center[1]]);
      floor.name = corridor.id; floor.castShadow = false;
      this.corridorVisuals.set(corridor.id, buildBattlefieldCorridorDetails(this, corridor, this.root));
    }
    this.buildBattlefieldWalls();
    const sealMat = this.material('battlefield-seal', { color: 0xf58b57, emissive: 0xc34918, emissiveIntensity: 0.75, roughness: 0.4, metalness: 0.25, transparent: true, opacity: 0.72, depthWrite: false, surface: 'metal' });
    for (const gate of this.battlefieldLayout.gates) {
      const frame = new THREE.Group(); frame.name = gate.id; frame.position.set(gate.center[0], 0, gate.center[1]);
      if (gate.axis === 'x') frame.rotation.y = Math.PI / 2;
      for (const side of [-1, 1]) {
        this.box(this.wallMat, [side * 10, 6, 0], [2, 12, 3], frame);
        this.box(this.trimMat, [side * 10, 6.4, -1.56], [0.35, 8.8, 0.12], frame);
      }
      this.box(this.wallMat, [0, 12, 0], [22, 1.4, 3], frame);
      const panel = new THREE.Group(); panel.name = `${gate.id}-seal`; frame.add(panel);
      this.box(sealMat, [0, 5.65, 0], [18, 11.3, 0.35], panel);
      for (let bar = -3; bar <= 3; bar++) this.box(this.trimMat, [bar * 2.4, 5.65, -0.23], [0.06, 10.8, 0.05], panel);
      // Gate barriers remain effective during jumps and skimmer movement.
      const collider = { x: gate.center[0], z: gate.center[1], halfWidth: gate.axis === 'x' ? 1 : 9, halfDepth: gate.axis === 'z' ? 1 : 9, height: Infinity, rotation: 0, gateId: gate.id };
      this.colliders.push(collider); this.root.add(frame); this.gateVisuals.set(gate.id, { frame, panel, collider });
    }
    this.setActiveSector(this.battlefieldLayout.entrySectorId);
  }

  buildSectorLandmarks(sector, parent, reservedSites = []) {
    const [cx, cz] = sector.center, entries = [];
    const reserved = (x, z, radius = 0) => reservedSites.some(site => Math.hypot(x - cx - site.x, z - cz - site.z) < site.radius + radius + 1);
    const addBatch = (name, geometry, material, placements, shadows = true) => {
      if (!placements.length) return null;
      const mesh = new THREE.InstancedMesh(geometry, material, placements.length), dummy = new THREE.Object3D();
      placements.forEach((entry, index) => { dummy.position.set(...entry.position); dummy.scale.set(...(entry.scale ?? [1, 1, 1])); dummy.rotation.set(0, entry.yaw ?? 0, 0); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix); });
      mesh.name = `battlefield-${sector.id}-${name}`; mesh.castShadow = shadows; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    if (this.organic) {
      for (let index = 0; index < 14; index++) {
        const angle = index / 14 * Math.PI * 2 + sector.index * 0.41, radius = 42 + (index % 3) * 5;
        const x = cx + Math.cos(angle) * radius, z = cz + Math.sin(angle) * radius;
        if (Math.abs(x - cx) < 12 || Math.abs(z - cz) < 12) continue;
        const scale = 0.8 + (index % 4) * 0.09;
        if (reserved(x, z, 1.05 * scale)) continue;
        entries.push({ position: [x, 0, z], scale: [scale, scale, scale], yaw: angle }); this.addCollider(x, z, 1.05 * scale, 11 * scale);
      }
      addBatch('tree-trunks', this.geometries.get('tree-wood-sculpt'), this.materials.get('bark'), entries);
      addBatch('canopies', this.geometries.get('canopy-sculpt'), this.materials.get('leaf'), entries);
      const ferns = [];
      for (let index = 0; index < 45; index++) {
        const angle = index * 2.399963, radius = 34 + index % 5 * 4;
        const x = cx + Math.cos(angle) * radius, z = cz + Math.sin(angle) * radius;
        if (Math.abs(x - cx) < 11 || Math.abs(z - cz) < 11) continue;
        if (reserved(x, z, 0.8)) continue;
        ferns.push({ position: [x, 0, z], scale: [0.8, 0.8, 0.8], yaw: angle });
      }
      addBatch('undergrowth', this.geometries.get('fern-sculpt'), this.materials.get('undergrowth'), ferns, false);
      const rocks = [];
      for (const [x, z] of [[-32, -34], [35, 32], [-43, 27], [30, -43]]) {
        if (reserved(cx + x, cz + z, 2.3)) continue;
        rocks.push({ position: [cx + x, 1.4, cz + z], scale: [2.3, 1.8, 2.4], yaw: sector.index }); this.addCollider(cx + x, cz + z, 2.3, 3.5);
      }
      addBatch('weathered-cover', this.geometries.get('rock-hd'), this.materials.get('rock'), rocks);
    } else {
      const blocks = [], accents = [];
      for (const [x, z] of [[-35, -35], [35, -35], [-35, 35], [35, 35]]) {
        if (reserved(cx + x, cz + z, Math.hypot(this.type === 'temple' ? 2.5 : 4.5, 3))) continue;
        const height = this.type === 'temple' ? 5.5 : this.type === 'hive' ? 5.8 : 3.1;
        blocks.push({ position: [cx + x, height / 2, cz + z], scale: [this.type === 'temple' ? 5 : 9, height, 6], yaw: 0 });
        accents.push({ position: [cx + x, height + 0.08, cz + z], scale: [7, 0.15, 0.25] });
        this.addBoxCollider(cx + x, cz + z, this.type === 'temple' ? 2.5 : 4.5, 3, height);
      }
      addBatch('fortified-cover', this.geometry('beveled-box', beveledBlockGeometry), this.wallMat, blocks);
      addBatch('cover-trim', this.geometry('beveled-box', beveledBlockGeometry), this.trimMat, accents, false);
      const landmarkGeometry = this.type === 'temple' ? this.geometry('obelisk', () => erodedObeliskGeometry()) : this.type === 'hive' ? this.geometry('hive-column', () => resinColumnGeometry()) : null;
      if (landmarkGeometry) {
        addBatch('landmarks', landmarkGeometry, this.wallMat, [[-48, -40], [48, 40], [-48, 40], [48, -40]].map(([x, z]) => ({ position: [cx + x, 4, cz + z], yaw: sector.index * 0.3 })));
      } else if (reservedSites.length < 4) {
        const panels = [];
        for (let index = 0; index < 16; index++) { const x = (index % 4 - 1.5) * 22, z = index < 8 ? -53 : 53; panels.push({ position: [cx + x, 0.024, cz + z], scale: [9, 0.025, 0.08] }); }
        addBatch('floor-panel-seams', this.geometry('beveled-box', beveledBlockGeometry), this.darkMat, panels, false);
      }
    }
    // The new occupied sites already provide taller landmarks and ground
    // markings. Avoid retaining four extra legacy mast draws per territory.
    if (reservedSites.length >= 4) return;
    // Distinct raised flag towers identify each territory from its approach.
    for (const side of [-1, 1]) {
      if (reserved(cx + side * 24, cz - 46, 1.4)) continue;
      this.box(this.wallMat, [cx + side * 24, 3, cz - 46], [1.1, 6, 1.1], parent);
      this.box(this.trimMat, [cx + side * 24, 5.6, cz - 46], [2.8, 0.55 + sector.index * 0.14, 0.25], parent);
    }
  }

  buildBattlefieldWalls() {
    const pieces = [], caps = [];
    const block = this.geometry('beveled-box', beveledBlockGeometry);
    const height = this.organic ? 6 : this.type === 'hive' ? 8 : 7;
    const append = (x, z, width, depth) => {
      const piece = block.clone().scale(width, height, depth).translate(x, height / 2 - 0.05, z);
      const uv = piece.attributes.uv, positions = piece.attributes.position, normals = piece.attributes.normal;
      for (let index = 0; index < positions.count; index++) {
        const px = positions.getX(index), py = positions.getY(index), pz = positions.getZ(index);
        if (Math.abs(normals.getY(index)) > 0.5) uv.setXY(index, px / 5, pz / 5);
        else if (Math.abs(normals.getX(index)) > 0.5) uv.setXY(index, pz / 5, py / 5);
        else uv.setXY(index, px / 5, py / 5);
      }
      pieces.push(piece);
      caps.push(block.clone().scale(width, 0.16, depth + 0.12).translate(x, height - 0.04, z));
      this.addBoxCollider(x, z, width / 2, depth / 2, height);
    };
    for (const sector of this.battlefieldLayout.sectors) {
      const openings = { north: [], south: [], west: [], east: [] };
      for (const corridor of this.battlefieldLayout.corridors.filter(item => item.from === sector.id || item.to === sector.id)) {
        const other = this.battlefieldLayout.sectors.find(item => item.id === (corridor.from === sector.id ? corridor.to : corridor.from));
        const dx = other.center[0] - sector.center[0], dz = other.center[1] - sector.center[1];
        openings[Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? 'west' : 'east') : (dz < 0 ? 'north' : 'south')].push([-10, 10]);
      }
      for (const side of Object.keys(openings)) {
        let cursor = -66;
        for (const [start, end] of [...openings[side].sort((a, b) => a[0] - b[0]), [66, 66]]) {
          if (start > cursor) {
            const along = (cursor + start) / 2, length = start - cursor;
            append(sector.center[0] + (side === 'east' ? 66 : side === 'west' ? -66 : along), sector.center[1] + (side === 'south' ? 66 : side === 'north' ? -66 : along), side === 'north' || side === 'south' ? length : 2, side === 'west' || side === 'east' ? length : 2);
          }
          cursor = Math.max(cursor, end);
        }
      }
    }
    for (const corridor of this.battlefieldLayout.corridors) {
      const from = this.battlefieldLayout.sectors.find(item => item.id === corridor.from), to = this.battlefieldLayout.sectors.find(item => item.id === corridor.to);
      const length = Math.hypot(to.center[0] - from.center[0], to.center[1] - from.center[1]) - 132;
      for (const side of [-1, 1]) append(corridor.center[0] + (corridor.axis === 'z' ? side * 10 : 0), corridor.center[1] + (corridor.axis === 'x' ? side * 10 : 0), corridor.axis === 'x' ? length : 2, corridor.axis === 'z' ? length : 2);
    }
    const boundaryMaterial = this.material('battlefield-boundary', { color: this.wallMat.color.getHex(), roughness: this.organic ? 0.96 : 0.76, metalness: this.organic || this.type === 'temple' ? 0.02 : 0.35, surface: this.organic || this.type === 'temple' ? 'stone' : this.type === 'hive' ? 'chitin' : 'metal' });
    for (const [key, source, material] of [['battlefield-walls', pieces, boundaryMaterial], ['battlefield-wall-caps', caps, this.organic ? boundaryMaterial : this.trimMat]]) {
      const geometry = this.geometry(key, () => mergeGeometries(source, false)); source.forEach(item => item.dispose());
      const mesh = this.mesh(geometry, material); mesh.name = key;
    }
  }

  getSectorAt(position) {
    return this.battlefieldLayout?.sectors.find(sector => pointInBattlefieldRect(position, sector.bounds)) ?? null;
  }

  isGateOpen(id) { return this.openGates.has(id); }

  openGate(id) {
    const visual = this.gateVisuals.get(id);
    if (!visual || this.openGates.has(id)) return false;
    this.openGates.add(id); this._battlefieldRectsCache = null; visual.panel.visible = false;
    this.colliders = this.colliders.filter(collider => collider !== visual.collider);
    const gate = this.battlefieldLayout.gates.find(item => item.id === id);
    this.completeSector(gate.from);
    return true;
  }

  completeSector(id) {
    const marker = this.objectiveMarkers.get(id);
    if (!marker || this.completedSectors.has(id)) return false;
    this.completedSectors.add(id); marker.userData.completed = true;
    this.relayVisuals.get(id)?.setState('secured', 1);
    const completed = this.material('battlefield-completed', { color: 0x76e3b6, emissive: 0x2abf8b, emissiveIntensity: 0.65, roughness: 0.4, metalness: 0.3, surface: 'metal' });
    marker.traverse(node => { if (node.isMesh && node.material === this.trimMat) node.material = completed; });
    marker.visible = true; return true;
  }

  setActiveSector(id) {
    if (!this.battlefieldLayout?.sectors.some(sector => sector.id === id)) return false;
    this.activeSectorId = id;
    const active = this.battlefieldLayout.sectors.find(sector => sector.id === id);
    this.updateBattlefieldVisibility([{ x: active.center[0], z: active.center[1] }]);
    for (const [sectorId, marker] of this.objectiveMarkers) marker.visible = sectorId === id || this.completedSectors.has(sectorId);
    return true;
  }

  updateBattlefieldObjectives(progression, delta = 0) {
    if (!progression) return;
    for (const [id, relay] of this.relayVisuals) {
      const state = progression.getSectorState(id);
      const sector = this.battlefieldLayout.sectors.find(item => item.id === id);
      const phase = state?.completed ? 'secured' : id !== progression.currentSector?.id ? 'dormant'
        : state?.interacted && sector.objective.defenseTarget ? 'counterattack' : 'awaiting-activation';
      relay.setState(phase, state?.completed ? 1 : (state?.defenseKills ?? 0) / (sector.objective.defenseTarget ?? 1));
      if (id === progression.currentSector?.id) relay.update(delta);
    }
  }

  updateBattlefieldVisibility(players) {
    if (!this.battlefieldLayout) return;
    const positions = (Array.isArray(players) ? players : [players]).map(player => player?.position ?? player).filter(position => Number.isFinite(position?.x) && Number.isFinite(position?.z));
    if (!positions.length) return;
    for (const sector of this.battlefieldLayout.sectors) {
      const group = this.sectorVisuals.get(sector.id);
      if (group) group.visible = positions.some(position => Math.hypot(position.x - sector.center[0], position.z - sector.center[1]) < 116);
    }
    for (const corridor of this.battlefieldLayout.corridors) {
      const group = this.corridorVisuals.get(corridor.id);
      if (group) group.visible = positions.some(position => Math.hypot(position.x - corridor.center[0], position.z - corridor.center[1]) < 130);
    }
  }

  accessibleBattlefieldRects() {
    if (this._battlefieldRectsCache) return this._battlefieldRectsCache;
    const layout = this.battlefieldLayout;
    if (!layout) return null;
    const reachable = new Set([layout.entrySectorId]);
    for (let pass = 0; pass < layout.sectors.length; pass++) {
      for (const gate of layout.gates) if (this.openGates.has(gate.id)) {
        if (reachable.has(gate.from)) reachable.add(gate.to);
        if (reachable.has(gate.to)) reachable.add(gate.from);
      }
    }
    const rectangles = layout.sectors.filter(sector => reachable.has(sector.id)).map(sector => sector.bounds);
    for (const corridor of layout.corridors) {
      const fromReachable = reachable.has(corridor.from), toReachable = reachable.has(corridor.to);
      if (fromReachable && toReachable) rectangles.push(corridor.bounds);
      else if (fromReachable || toReachable) {
        const origin = layout.sectors.find(sector => sector.id === (fromReachable ? corridor.from : corridor.to));
        const half = { ...corridor.bounds };
        if (corridor.axis === 'x') half[origin.center[0] < corridor.center[0] ? 'maxX' : 'minX'] = corridor.center[0];
        else half[origin.center[1] < corridor.center[1] ? 'maxZ' : 'minZ'] = corridor.center[1];
        rectangles.push(half);
      }
    }
    this._battlefieldRectsCache = rectangles;
    return rectangles;
  }

  projectToBattlefield(position, radius) {
    const rectangles = this.accessibleBattlefieldRects();
    if (!rectangles) return false;
    if (rectangles.some(bounds => pointInBattlefieldRect(position, bounds, radius))) return true;
    let distance = Infinity, nearestX = position.x, nearestZ = position.z;
    for (const bounds of rectangles) {
      const x = THREE.MathUtils.clamp(position.x, bounds.minX + radius, bounds.maxX - radius);
      const z = THREE.MathUtils.clamp(position.z, bounds.minZ + radius, bounds.maxZ - radius);
      const candidate = (position.x - x) ** 2 + (position.z - z) ** 2;
      if (candidate < distance) { distance = candidate; nearestX = x; nearestZ = z; }
    }
    position.x = nearestX; position.z = nearestZ; return true;
  }

  getSpawnPoint(sectorId, index = 0, playerPosition = null, distance = 30) {
    const sector = this.battlefieldLayout?.sectors.find(item => item.id === sectorId);
    if (!sector) return new THREE.Vector3(0, 0, -30);
    const players = Array.isArray(playerPosition) ? playerPosition : playerPosition ? [playerPosition] : [];
    const spacing = Math.max(24, Math.min(48, Number.isFinite(distance) ? distance : 30));
    let best = null, bestDistance = -Infinity;
    const clear = position => this.colliders.every(collider => {
      const dx = position.x - collider.x, dz = position.z - collider.z;
      if (collider.halfWidth == null) return Math.hypot(dx, dz) >= collider.radius + 2.2;
      const cosine = Math.cos(collider.rotation), sine = Math.sin(collider.rotation);
      const x = dx * cosine - dz * sine, z = dx * sine + dz * cosine;
      return Math.hypot(x - THREE.MathUtils.clamp(x, -collider.halfWidth, collider.halfWidth), z - THREE.MathUtils.clamp(z, -collider.halfDepth, collider.halfDepth)) >= 2.2;
    });
    for (let attempt = 0; attempt < 48; attempt++) {
      const angle = (index * 2.399963 + attempt * 0.618034) % (Math.PI * 2);
      const origin = players[0] ?? { x: sector.center[0], z: sector.center[1] };
      const candidate = new THREE.Vector3(THREE.MathUtils.clamp(origin.x + Math.cos(angle) * (spacing + attempt % 3 * 5), sector.bounds.minX + 7, sector.bounds.maxX - 7), 0, THREE.MathUtils.clamp(origin.z + Math.sin(angle) * (spacing + attempt % 3 * 5), sector.bounds.minZ + 7, sector.bounds.maxZ - 7));
      if (!clear(candidate)) continue;
      const nearest = players.length ? Math.min(...players.map(player => Math.hypot(candidate.x - player.x, candidate.z - player.z))) : Math.hypot(candidate.x - sector.center[0], candidate.z - sector.center[1]);
      if (nearest > bestDistance) { best = candidate; bestDistance = nearest; }
      if (nearest >= spacing) return candidate;
    }
    return best ?? new THREE.Vector3(sector.center[0], 0, sector.center[1]);
  }

  groundRing(radius, width, material, y = 0.025) {
    const geometry = this.geometry(`ring-${radius}-${width}`, () => {
      const isTrail = this.organic && material === this.pathMat;
      const ring = new THREE.RingGeometry(radius, radius + width, isTrail ? 160 : 80, isTrail ? 5 : 1);
      ring.rotateX(-Math.PI / 2);
      if (isTrail) weatherGroundRing(ring, this.trailEdgeColor());
      return projectGroundUV(ring);
    });
    const ring = this.mesh(geometry, material, [0, y, 0]);
    ring.name = `detail-world-tiled-ring-${radius}`;
    ring.castShadow = false;
    return ring;
  }

  trailEdgeColor() {
    // The same soil map and metre UV phase lets the trail edge blend into the
    // terrain by color, without an alpha decal or extra per-route texture.
    const floor = this.floorMat.color, path = this.pathMat.color;
    return new THREE.Color(floor.r / Math.max(0.001, path.r), floor.g / Math.max(0.001, path.g), floor.b / Math.max(0.001, path.b)).multiplyScalar(0.86);
  }

  buildRoutes() {
    // Open crossing and a 7 m circulation loop; marks stay flat and never obstruct movement.
    for (const [name, width, depth, y] of [['route-ns', 11, this.halfSize * 2, 0.015], ['route-ew', this.halfSize * 2, 11, 0.02]]) {
      const geometry = this.geometry(name, () => {
        const plane = this.organic
          ? wornTrailGeometry(11, this.halfSize * 2, this.trailEdgeColor())
          : new THREE.PlaneGeometry(width, depth);
        if (this.organic && width > depth) plane.rotateY(Math.PI / 2);
        else if (!this.organic) plane.rotateX(-Math.PI / 2);
        return projectGroundUV(plane);
      });
      const route = this.mesh(geometry, this.pathMat, [0, y, 0]);
      route.name = `detail-world-tiled-${name}`;
      route.castShadow = false;
    }
    this.groundRing(24.5, 7, this.pathMat, 0.027);
    this.groundRing(9.4, 0.2, this.trimMat, 0.04);
    if (!this.organic) {
      this.groundRing(24.5, 0.12, this.trimMat, 0.045);
      this.groundRing(31.4, 0.1, this.trimMat, 0.045);
    }

    for (let direction = 0; direction < 4; direction++) {
      const angle = direction * Math.PI / 2;
      for (let distance = 15; distance < this.halfSize - 4; distance += this.organic ? 16 : 8) {
        const x = Math.sin(angle) * distance;
        const z = Math.cos(angle) * distance;
        const strip = this.box(this.trimMat, [x, 0.045, z], [this.organic ? 0.65 : 1.2, 0.04, this.organic ? 0.085 : 0.16]);
        strip.rotation.y = angle;
        strip.castShadow = false;
      }
      // Distinctive paired navigation posts at the four entrances to the outer route.
      for (const side of [-1, 1]) {
        const x = Math.sin(angle) * 46 + Math.cos(angle) * side * 6.3;
        const z = Math.cos(angle) * 46 - Math.sin(angle) * side * 6.3;
        this.box(this.wallMat, [x, 1.3, z], [0.65, 2.6, 0.65]);
        this.box(this.trimMat, [x, 2.45, z], [0.72, 0.18, 0.72]);
      }
    }
    // A low compass landing pad marks the spawn without creating a collision.
    // The separate textured cap is the only top face; a second cap just below
    // it causes depth fighting when the arena is viewed from a distance.
    const disc = this.geometry('landing', () => new THREE.CylinderGeometry(8.9, 8.9, 0.08, 64, 1, true));
    const support = this.mesh(disc, this.darkMat, [0, 0.04, 0]);
    support.name = 'detail-landing-pad-support';
    support.castShadow = false;
    const capGeometry = this.geometry('landing-cap', () => {
      const cap = new THREE.CircleGeometry(8.9, 64);
      cap.rotateX(-Math.PI / 2);
      return projectGroundUV(cap);
    });
    const cap = this.mesh(capGeometry, this.landingMat, [0, 0.081, 0]);
    cap.name = 'detail-world-tiled-landing-cap';
    cap.castShadow = false;
    // Raised rim, seam lines and fasteners make the insertion disc a fabricated
    // structure rather than a perfect circle of featureless brown ground.
    this.groundRing(8.85, 0.23, this.darkMat, 0.087);
    const bolts = new THREE.InstancedMesh(this.geometry('landing-bolts', () => new THREE.SphereGeometry(0.055, 7, 5)), this.landingMat, 48);
    const seams = new THREE.InstancedMesh(this.geometry('landing-joint', () => new THREE.BoxGeometry(1, 1, 1)), this.darkMat, 12);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 48; i++) {
      const angle = i / 48 * Math.PI * 2;
      dummy.position.set(Math.sin(angle) * 8.55, 0.091, Math.cos(angle) * 8.55);
      dummy.scale.set(1, 0.4, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); bolts.setMatrixAt(i, dummy.matrix);
      if (i % 4 === 0) {
        dummy.position.set(Math.sin(angle) * 5.8, 0.084, Math.cos(angle) * 5.8);
        dummy.scale.set(0.025, 0.012, 5.8); dummy.rotation.set(0, angle, 0); dummy.updateMatrix(); seams.setMatrixAt(i / 4, dummy.matrix);
      }
    }
    bolts.name = 'detail-landing-fasteners'; seams.name = 'detail-landing-panel-seams';
    bolts.receiveShadow = seams.receiveShadow = true;
    this.root.add(bolts, seams);
    for (const side of [-1, 1]) this.box(this.trimMat, [side * 4.6, 0.1, 0], [0.18, 0.05, 5.3]);
    this.box(this.trimMat, [0, 0.1, 0], [9.2, 0.05, 0.18]);
  }

  buildBoundary() {
    if (this.organic) {
      const bank = this.mesh(this.geometry('natural-boundary-bank', () => naturalBoundaryGeometry(this.halfSize)), this.floorMat);
      bank.name = 'detail-natural-forest-bank';
      const rock = this.material('boundary-rock', { color: 0x647268, roughness: 0.95, surface: 'stone' });
      const boulders = new THREE.InstancedMesh(this.geometry('boundary-boulders', () => {
        // The same sculpted boulder form is reused outside the playable bounds.
        const geometry = new THREE.SphereGeometry(1, 18, 12);
        const position = geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
          const wear = 1 + Math.sin(x * 3 + z * 4) * 0.14 + Math.cos(y * 4 - x * 3) * 0.08;
          position.setXYZ(i, x * wear, Math.max(-0.6, y * wear), z * wear);
        }
        geometry.computeVertexNormals(); return geometry;
      }), rock, 24);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < 24; i++) {
        const side = Math.floor(i / 6), angle = side * Math.PI / 2;
        const lateral = (i % 6 - 2.5) * 21 + Math.sin(i * 2.4) * 2;
        const outward = this.halfSize + 3.8 + i % 3 * 0.8;
        dummy.position.set(Math.sin(angle) * outward + Math.cos(angle) * lateral, 0.5, Math.cos(angle) * outward - Math.sin(angle) * lateral);
        dummy.scale.set(1.5 + i % 3 * 0.35, 0.95 + i % 4 * 0.18, 1.4 + i % 2 * 0.55);
        dummy.rotation.set(0.1 * Math.sin(i), i * 2.4, 0.08 * Math.cos(i)); dummy.updateMatrix(); boulders.setMatrixAt(i, dummy.matrix);
      }
      boulders.name = 'detail-natural-boundary-boulders';
      boulders.castShadow = true; boulders.receiveShadow = true;
      this.root.add(boulders);
      return;
    }
    const extent = this.halfSize + 1;
    const height = this.type === 'station' ? 5.4 : this.type === 'temple' ? 4.4 : 1.65;
    for (const sign of [-1, 1]) {
      this.box(this.wallMat, [0, height / 2, sign * extent], [extent * 2, height, 1.2]);
      this.box(this.wallMat, [sign * extent, height / 2, 0], [1.2, height, extent * 2]);
      this.box(this.trimMat, [0, height - 0.08, sign * extent], [extent * 2, 0.1, 0.12]);
      this.box(this.trimMat, [sign * extent, height - 0.08, 0], [0.12, 0.1, extent * 2]);
    }
    for (let side = 0; side < 4; side++) {
      const angle = side * Math.PI / 2;
      for (let coordinate = -56; coordinate <= 56; coordinate += 16) {
        const x = Math.sin(angle) * extent + Math.cos(angle) * coordinate;
        const z = Math.cos(angle) * extent - Math.sin(angle) * coordinate;
        this.box(this.wallMat, [x, height / 2 + 0.3, z], [2.2, height + 0.6, 2.2]);
        this.box(this.trimMat, [x, height + 0.65, z], [0.45, 0.35, 0.45]);
      }
    }
  }

  addCollider(x, z, radius, height) {
    this.colliders.push({ x, z, radius, height });
  }

  addBoxCollider(x, z, halfWidth, halfDepth, height, rotation = 0) {
    this.colliders.push({ x, z, halfWidth, halfDepth, height, rotation });
  }

  buildForest(tropical) {
    buildDetailedForest(this, tropical);
    if (tropical) {
      // Abandoned field camp, outside the central and circular paths.
      for (const x of [-41, 41]) {
        const tent = this.mesh(this.geometry('tent', () => new THREE.CylinderGeometry(0, 5, 4.5, 4)), this.pathMat, [x, 2.25, -43], [1.4, 1, 1]);
        tent.rotation.y = Math.PI / 4;
        this.addCollider(x, -43, 4.8, 4.5);
        this.box(this.trimMat, [x, 0.16, -36], [7, 0.1, 0.3]);
      }
    } else {
      const tower = new THREE.Group(); tower.position.set(-46, 0, -45); this.root.add(tower);
      for (const x of [-3, 3]) for (const z of [-3, 3]) this.box(this.darkMat, [x, 4.2, z], [0.5, 8.4, 0.5], tower);
      this.box(this.wallMat, [0, 7.4, 0], [8, 0.5, 8], tower);
      this.box(this.trimMat, [0, 7.8, -3.8], [7, 0.16, 0.16], tower);
      this.box(this.wallMat, [0, 10, 0], [9, 0.4, 9], tower);
      for (const x of [-3, 3]) for (const z of [-3, 3]) this.addCollider(-46 + x, -45 + z, 0.4, 10);
    }
  }

  buildTemple() {
    const stone = this.material('stone', { color: 0x78899c, roughness: 0.87, metalness: 0.15 });
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const sx = quadrant % 2 ? 1 : -1;
      const sz = quadrant < 2 ? -1 : 1;
      const x = sx * 37, z = sz * 37;
      for (let step = 0; step < 3; step++) this.box(this.wallMat, [x, 0.25 + step * 0.4, z], [8 - step * 1.7, 0.5, 8 - step * 1.7]);
      const obelisk = this.mesh(this.geometry('obelisk', () => erodedObeliskGeometry()), stone, [x, 5, z]);
      obelisk.rotation.y = Math.PI / 4;
      this.addBoxCollider(x, z, 4, 4, 1.4);
      this.addCollider(x, z, 2, 9.25);
      for (let glyph = 0; glyph < 5; glyph++) {
        this.box(this.trimMat, [x, 2.4 + glyph * 0.85, z + (sz < 0 ? 1.5 : -1.5)], [0.8 - (glyph % 2) * 0.3, 0.15, 0.12]);
      }
      // Low tablets frame each diagonal route without enclosing it.
      const tablet = this.box(stone, [sx * 52, 1.2, sz * 18], [6, 2.4, 3]);
      tablet.rotation.y = sx * sz * 0.35;
      this.addBoxCollider(sx * 52, sz * 18, 3, 1.5, 2.4, sx * sz * 0.35);
    }
    for (const x of [-47, 47]) {
      this.box(this.wallMat, [x, 0.35, 0], [12, 0.5, 11]);

    }
    this.groundRing(14, 0.18, this.wallMat, 0.035);
    for (let i = 0; i < 24; i++) {
      const angle = i / 24 * Math.PI * 2;
      const glyph = this.box(this.trimMat, [Math.sin(angle) * 16, 0.06, Math.cos(angle) * 16], [0.24, 0.04, i % 3 === 0 ? 1.6 : 0.7]);
      glyph.rotation.y = angle;
    }
  }

  buildHive() {
    const resin = this.material('resin', { color: 0x4b3c57, roughness: 0.4, metalness: 0.42 });
    const bone = this.material('hive-bone', { color: 0x6f597a, roughness: 0.66, metalness: 0.2 });
    const egg = this.material('egg', { color: 0x716c4e, emissive: 0x42385c, emissiveIntensity: 0.25, roughness: 0.58 });
    const ribGeo = this.geometry('rib', () => new THREE.TorusGeometry(7.4, 0.45, 12, 48, Math.PI));
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const sx = quadrant % 2 ? 1 : -1, sz = quadrant < 2 ? -1 : 1;
      const x = sx * 38, z = sz * 38;
      for (let i = 0; i < 3; i++) {
        const rib = this.mesh(ribGeo, i % 2 ? bone : resin, [x + (i - 1) * 4, 0.3, z]);
        rib.rotation.y = Math.PI / 2;
        for (const side of [-1, 1]) this.addCollider(x + (i - 1) * 4, z + side * 7.4, 0.6, 1.2);
      }
      // Grouped nests stay away from insertion and the circulation loop.
      for (let i = 0; i < 5; i++) {
        const angle = i / 5 * Math.PI * 2;
        const eggX = x + Math.cos(angle) * 3.2, eggZ = z + Math.sin(angle) * 3.2;
        this.mesh(this.geometry('egg', () => new THREE.SphereGeometry(1, 18, 12)), egg, [eggX, 1.2, eggZ], [0.9, 1.35, 0.9]);
        this.addCollider(eggX, eggZ, 0.9, 2.55);
      }
      for (let root = 0; root < 3; root++) {
        const strand = this.box(resin, [sx * (38 + root * 3), 0.25, sz * 51], [0.7, 0.5, 18]);
        strand.rotation.y = sx * sz * 0.25;
      }
    }
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2;
      const radius = 58;
      this.mesh(this.geometry('hive-column', () => resinColumnGeometry()), resin, [Math.sin(angle) * radius, 4, Math.cos(angle) * radius]);
      this.mesh(this.geometry('spore', () => new THREE.SphereGeometry(0.35, 6, 5)), this.trimMat, [Math.sin(angle) * radius, 6.5, Math.cos(angle) * radius]);
    }
  }

  buildRooftop() {
    const metal = this.material('roof-metal', { color: 0x5c6771, roughness: 0.55, metalness: 0.7 });
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const sx = quadrant % 2 ? 1 : -1, sz = quadrant < 2 ? -1 : 1;
      const x = sx * 38, z = sz * 38;
      this.box(metal, [x, 1.8, z], [9, 3.6, 6]);
      for (let i = -2; i <= 2; i++) this.box(this.darkMat, [x + i * 1.4, 3.66, z], [0.65, 0.08, 4.8]);
      this.box(this.trimMat, [x, 1.7, z + (sz < 0 ? 3.04 : -3.04)], [7.7, 0.15, 0.08]);
      this.addBoxCollider(x, z, 4.5, 3, 3.6);
      for (let i = 0; i < 3; i++) this.box(this.pathMat, [sx * (47 + i * 3), 0.075, sz * 15], [0.9, 0.04, 7]);
    }
    // Instanced distant architecture never obstructs the playable roof.
    const skyline = new THREE.InstancedMesh(this.geometry('beveled-box', beveledBlockGeometry), this.wallMat, 32);
    this.skylineBuildings = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 32; i++) {
      const side = Math.floor(i / 8), angle = side * Math.PI / 2;
      const lateral = (i % 8 - 3.5) * 19;
      const radius = 88 + this.random() * 25;
      const x = Math.sin(angle) * radius + Math.cos(angle) * lateral;
      const z = Math.cos(angle) * radius - Math.sin(angle) * lateral;
      const height = 9 + this.random() * 24;
      dummy.position.set(x, height / 2 - 10, z);
      dummy.scale.set(10, height, 12);
      dummy.updateMatrix(); skyline.setMatrixAt(i, dummy.matrix);
      this.skylineBuildings.push({ x, z, height, side });
    }
    skyline.name = 'detail-city-skyline';
    this.root.add(skyline);
  }

  buildStation() {
    const shell = this.material('station-shell', { color: 0x758894, roughness: 0.55, metalness: 0.65 });
    const glass = this.material('lab-glass', { color: 0x1f6684, emissive: 0x10425b, emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.6 });
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const sx = quadrant % 2 ? 1 : -1, sz = quadrant < 2 ? -1 : 1;
      const x = sx * 38, z = sz * 38;
      this.box(shell, [x, 1.5, z], [9, 3, 8]);
      this.box(this.darkMat, [x, 3.05, z], [9.5, 0.18, 8.5]);
      this.box(glass, [x, 1.8, z + (sz < 0 ? 4.05 : -4.05)], [7.8, 1.4, 0.08]);
      this.box(this.trimMat, [x, 3.15, z], [9.4, 0.12, 0.16]);
      this.addBoxCollider(x, z, 4.75, 4.25, 3.3);
      for (let i = 0; i < 3; i++) {
        const cx = sx * (50 + i * 3.2), cz = sz * 19;
        this.mesh(this.geometry('cryo', () => new THREE.CapsuleGeometry(0.9, 1.2, 8, 20)), shell, [cx, 1.5, cz]);
        this.box(this.trimMat, [cx, 1.7, cz - sz * 0.92], [0.35, 1.4, 0.12]);
        this.addCollider(cx, cz, 1.0, 3);
      }
    }
    for (const x of [-21, 21]) {
      for (const z of [-60, 60]) {
        this.box(shell, [x, 4, z], [2, 8, 3]);
        this.box(this.trimMat, [x, 5.7, z + (z < 0 ? 1.55 : -1.55)], [0.35, 3.8, 0.1]);
      }
    }
    // Floor seams read as panels rather than a featureless plane.
    for (let offset = -60; offset <= 60; offset += 12) {
      this.box(this.darkMat, [offset, 0.025, 0], [0.06, 0.025, 126]);
      this.box(this.darkMat, [0, 0.027, offset], [126, 0.025, 0.06]);
    }
  }

  // Lightweight local steering for existing seek-based AI. It slides around a
  // convex prop instead of continually walking into it; it is not a navmesh.
  resolveAgentMovement(position, target, stepDistance, radius = 0.65) {
    const attemptX = position.x, attemptZ = position.z;
    let blocker = null;
    let closest = Infinity;
    for (const collider of this.colliders) {
      if (position.y > collider.height + 0.2) continue;
      const dx = attemptX - collider.x, dz = attemptZ - collider.z;
      let intersects;
      if (collider.halfWidth != null) {
        const cosine = Math.cos(collider.rotation), sine = Math.sin(collider.rotation);
        const x = dx * cosine - dz * sine, z = dx * sine + dz * cosine;
        const nearestX = THREE.MathUtils.clamp(x, -collider.halfWidth, collider.halfWidth);
        const nearestZ = THREE.MathUtils.clamp(z, -collider.halfDepth, collider.halfDepth);
        intersects = (x - nearestX) ** 2 + (z - nearestZ) ** 2 < radius ** 2;
      } else {
        intersects = dx * dx + dz * dz < (collider.radius + radius) ** 2;
      }
      if (intersects && dx * dx + dz * dz < closest) {
        closest = dx * dx + dz * dz;
        blocker = collider;
      }
    }
    this.resolveMovement(position, radius);
    if (!blocker || !target || !Number.isFinite(stepDistance) || stepDistance <= 0) return position;
    const pushX = position.x - attemptX, pushZ = position.z - attemptZ;
    const pushLength = Math.hypot(pushX, pushZ);
    if (pushLength < 0.00001) return position;
    // Pick a consistent side from the center-to-target ray. Using a face normal
    // alone would reverse direction every frame against a flat wall.
    const turn = (position.x - blocker.x) * (target.z - blocker.z) - (position.z - blocker.z) * (target.x - blocker.x);
    const side = turn < -0.0001 ? -1 : 1;
    const stride = Math.min(stepDistance, 0.8);
    position.x -= pushZ / pushLength * side * stride;
    position.z += pushX / pushLength * side * stride;
    return this.resolveMovement(position, radius);
  }

  // Resolve against the visible perimeter and only solid, waist-high props.
  // Called after movement by the game loop; y remains untouched for jump physics.
  resolveMovement(position, radius = 0.75) {
    const limit = this.halfSize - radius;
    if (!this.projectToBattlefield(position, radius)) {
      position.x = THREE.MathUtils.clamp(position.x, -limit, limit);
      position.z = THREE.MathUtils.clamp(position.z, -limit, limit);
    }
    for (let pass = 0; pass < 2; pass++) {
      for (const collider of this.colliders) {
        // Moving mechanisms can supply their actual shape while retaining a
        // conservative outline for spawn clearance and local AI steering.
        if (typeof collider.resolveMovement === 'function') {
          collider.resolveMovement(position, radius);
          continue;
        }
        if (position.y > collider.height + 0.2) continue;
        const dx = position.x - collider.x, dz = position.z - collider.z;
        if (collider.halfWidth != null) {
          // Work in the prop's local space, including rounded outside corners.
          const cosine = Math.cos(collider.rotation), sine = Math.sin(collider.rotation);
          let localX = dx * cosine - dz * sine, localZ = dx * sine + dz * cosine;
          const nearestX = THREE.MathUtils.clamp(localX, -collider.halfWidth, collider.halfWidth);
          const nearestZ = THREE.MathUtils.clamp(localZ, -collider.halfDepth, collider.halfDepth);
          const outsideX = localX - nearestX, outsideZ = localZ - nearestZ;
          const distance = Math.hypot(outsideX, outsideZ);
          if (distance >= radius) continue;
          if (distance > 0.0001) {
            localX = nearestX + outsideX / distance * radius;
            localZ = nearestZ + outsideZ / distance * radius;
          } else if (collider.halfWidth - Math.abs(localX) < collider.halfDepth - Math.abs(localZ)) {
            localX = (localX < 0 ? -1 : 1) * (collider.halfWidth + radius);
          } else {
            localZ = (localZ < 0 ? -1 : 1) * (collider.halfDepth + radius);
          }
          position.x = collider.x + localX * cosine + localZ * sine;
          position.z = collider.z - localX * sine + localZ * cosine;
        } else {
          const distance = Math.hypot(dx, dz);
          const separation = collider.radius + radius;
          if (distance < separation) {
            // Deterministic escape direction avoids NaNs at an exact prop center.
            const nx = distance > 0.0001 ? dx / distance : 1;
            const nz = distance > 0.0001 ? dz / distance : 0;
            position.x = collider.x + nx * separation;
            position.z = collider.z + nz * separation;
          }
        }
      }
    }
    if (!this.projectToBattlefield(position, radius)) {
      position.x = THREE.MathUtils.clamp(position.x, -limit, limit);
      position.z = THREE.MathUtils.clamp(position.z, -limit, limit);
    }
    return position;
  }
}

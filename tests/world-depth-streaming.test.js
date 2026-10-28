import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldGeometryStreaming } from '../js/graphics/WorldGeometryStreaming.js';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { pointInBattlefieldRect } from '../js/data/BattlefieldLayouts.js';

test('ahead-of-view buffer restoration obeys its byte budget while visible terrain and both players always take priority', () => {
  const root = new THREE.Group(), sectors = [], sectorVisuals = new Map(), meshes = [];
  for (let i = 0; i < 3; i++) {
    const group = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    group.add(mesh); root.add(group); meshes.push(mesh);
    const id = `room-${i}`; sectors.push({ id, bounds: { minX: i * 500 - 10, maxX: i * 500 + 10, minZ: -10, maxZ: 10 } }); sectorVisuals.set(id, group);
  }
  const environment = { root, battlefieldLayout: { sectors, corridors: [], gates: [] }, sectorVisuals, corridorVisuals: new Map(), gateVisuals: new Map(), tacticalBridges: new Map() };
  const stream = new WorldGeometryStreaming(environment, { restoreBudgetBytes: 0 }), far = stream.geometries.get(meshes[1].geometry), array = meshes[1].geometry.attributes.position.array;
  stream.update([{ x: 0, z: 0 }]); assert.equal(far.resident, false);
  stream.update([{ x: 350, z: 0 }]);
  assert.equal(far.resident, false); assert.equal(stream.getStats().lastAheadRestoredBytes, 0); assert.ok(stream.getStats().pendingResources > 0);
  stream.update([{ x: 380, z: 0 }]); assert.equal(far.resident, true);
  assert.ok(stream.getStats().lastMandatoryRestoredBytes > 0, 'a visible floor may exceed an ahead-only budget rather than disappear');
  stream.update([{ x: 380, z: 0 }, { x: 1000, z: 0 }]); assert.equal(stream.geometries.get(meshes[2].geometry).resident, true);
  assert.strictEqual(meshes[1].geometry.attributes.position.array, array);
  const count = stream.geometries.size;
  for (const x of [0, 500, 1000, 0]) stream.update([{ x, z: 0 }]);
  assert.equal(stream.geometries.size, count); assert.ok(Number.isFinite(stream.getStats().maxUpdateCpuMs));
  stream.dispose(); assert.equal(stream.getStats().pendingResources, 0);
  for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); }
});

test('three real sectors and a return preserve destruction, objectives, contacts and the same CPU buffers', t => {
  const e = new EnvironmentManager(new THREE.Scene()); e.buildLevelEnvironment({ ...LEVELS_DATA[0], mapId: 'LD-01', strategicMode: true, mapSeed: 17 });
  const layout = e.battlefieldLayout, bridge = e.tacticalBridges.values().next().value;
  e.damageTacticalBridge(bridge.id, 600); bridge.update(1.1); e.completeSector('insertion');
  const saved = e.serializeTacticalWorld(), arrays = [...e.worldStreaming.geometries.keys()].map(g => g.attributes.position?.array), registrySize = e.worldStreaming.geometries.size;
  const measurements = [];
  for (const sector of [layout.sectors[0], layout.sectors[Math.floor(layout.sectors.length / 2)], layout.sectors.at(-1), layout.sectors[0]]) {
    e.updateBattlefieldVisibility([{ x: sector.center[0], z: sector.center[1] }]);
    assert.ok(e.getWorldStreamingStats().lastAheadRestoredBytes <= e.getWorldStreamingStats().restoreBudgetBytes);
    assert.deepEqual(e.serializeTacticalWorld(), saved); assert.equal(e.completedSectors.has('insertion'), true);
    const stats = e.getWorldStreamingStats();
    measurements.push({ sector: sector.id, preparationCpuMs: stats.lastUpdateCpuMs, aheadPreparedBytes: stats.lastAheadRestoredBytes, mandatoryPreparedBytes: stats.lastMandatoryRestoredBytes, pendingBytes: stats.pendingBytes, eligibleGpuBytes: stats.eligibleGpuBytes });
  }
  assert.equal(e.worldStreaming.geometries.size, registrySize);
  [...e.worldStreaming.geometries.keys()].forEach((g, i) => assert.strictEqual(g.attributes.position?.array, arrays[i]));
  assert.equal(bridge.gapCollider.enabled, true); assert.equal(bridge.deck.visible, false);
  t.diagnostic(JSON.stringify({ measurement: 'Node CPU buffer preparation; no rendered GPU frame or actual VRAM measurement', budgetBytes: e.worldStreaming.restoreBudgetBytes, measurements }));
  e.clearEnvironment();
});

test('main and flank trails are actual upward-facing world geometry linked to physical exits, independently of the HUD', () => {
  const e = new EnvironmentManager(new THREE.Scene()); e.buildLevelEnvironment({ ...LEVELS_DATA[0], mapId: 'LD-01', strategicMode: true, mapSeed: 17 });
  const cues = e.routeCues.filter(cue => cue.sectorId === 'insertion');
  assert.ok(cues.some(cue => cue.kind === 'main' && cue.symbol === 'single-chevron'));
  assert.ok(cues.some(cue => cue.kind === 'flank' && cue.symbol === 'paired-chevrons'));
  const mesh = e.root.getObjectByName('battlefield-wayfinding-floor'); assert.ok(mesh?.isMesh);
  const normals = mesh.geometry.attributes.normal; for (let i = 0; i < normals.count; i++) assert.ok(normals.getY(i) > 0);
  for (const cue of e.routeCues) {
    assert.ok(e.battlefieldLayout.gates.some(gate => gate.id === cue.gateId));
    for (const [x, y, z] of cue.samples) {
      assert.ok(e.accessibleBattlefieldRects().some(bounds => pointInBattlefieldRect({ x, z }, bounds)));
      assert.ok(Math.abs(y - e.getElevationAt(x, z) - .045) < 1e-6);
    }
  }
  e.clearEnvironment(); assert.equal(e.routeCues.length, 0);
});

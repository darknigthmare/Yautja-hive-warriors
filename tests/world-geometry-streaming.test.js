import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

test('far zones release geometry/instance GPU allocations, preserve CPU templates and restore for either player', () => {
  const e = new EnvironmentManager(new THREE.Scene()); e.buildLevelEnvironment({ ...LEVELS_DATA[0], mapId: 'LD-01', strategicMode: true });
  const layout = e.battlefieldLayout, entry = layout.sectors[0], far = layout.sectors.at(-1);
  const a = new THREE.Vector3(...[entry.center[0], 0, entry.center[1]]), b = new THREE.Vector3(far.center[0], 0, far.center[1]);
  const unique = e.sectorVisuals.get(far.id).getObjectByName(`battlefield-sector-architecture-${far.id}`);
  const mesh = unique.children.find(mesh => mesh.isMesh), geometry = mesh.geometry, cpuArray = geometry.attributes.position.array;
  let released = 0; geometry.addEventListener('dispose', () => released++);
  e.updateBattlefieldVisibility([{ position: b }]); const restoredVersion = geometry.attributes.position.version;
  assert.ok(restoredVersion > 0); assert.strictEqual(geometry.attributes.position.array, cpuArray);
  e.updateBattlefieldVisibility([{ position: a }]); assert.equal(released, 1);
  const farStats = e.getWorldStreamingStats(); assert.ok(farStats.evictions > 0 && farStats.eligibleGpuBytes < farStats.templateBytes);
  e.updateBattlefieldVisibility([{ position: a }, { position: b }]);
  assert.ok(geometry.attributes.position.version > restoredVersion); assert.strictEqual(geometry.attributes.position.array, cpuArray);
  assert.equal(e.worldStreaming.geometries.get(geometry).resident, true);
  const dual = e.getWorldStreamingStats(); assert.ok(dual.eligibleGpuBytes > farStats.eligibleGpuBytes);
  e.updateBattlefieldVisibility([{ position: b }, { position: a }]); assert.equal(released, 1, 'changing player ordering cannot evict either live view');
  const contact = e.colliders.find(collider => collider.owner === unique.name);
  assert.ok(contact); assert.ok(e.traceSegment(new THREE.Vector3(contact.x, 20, contact.z), new THREE.Vector3(contact.x, 0, contact.z)));
  e.updateBattlefieldVisibility([{ position: a }]);
  assert.ok(e.traceSegment(new THREE.Vector3(contact.x, 20, contact.z), new THREE.Vector3(contact.x, 0, contact.z)), 'GPU eviction must preserve physical cover');
  const registrySize = e.worldStreaming.geometries.size;
  for (let cycle = 0; cycle < 12; cycle++) { e.updateBattlefieldVisibility([{ position: b }]); e.updateBattlefieldVisibility([{ position: a }]); }
  assert.equal(e.worldStreaming.geometries.size, registrySize, 'cycling cannot accumulate resident geometry records');
  assert.strictEqual(geometry.attributes.position.array, cpuArray, 'cycles cannot accumulate CPU copies');
  const streaming = e.worldStreaming; e.clearEnvironment(); assert.equal(streaming.geometries.size, 0); assert.equal(streaming.instances.size, 0); assert.equal(e.scene.children.length, 0);
});

test('streamed terrain returns with the same destroyed bridge and objective state', () => {
  const e = new EnvironmentManager(new THREE.Scene()); e.buildLevelEnvironment({ ...LEVELS_DATA[0], mapId: 'LD-01', strategicMode: true });
  const bridge = e.tacticalBridges.values().next().value; e.damageTacticalBridge(bridge.id, 600); bridge.update(1.1);
  e.completeSector('insertion'); const before = e.serializeTacticalWorld();
  const far = e.battlefieldLayout.sectors.at(-1); e.updateBattlefieldVisibility([{ x: far.center[0], z: far.center[1] }]);
  assert.equal(bridge.root.visible, false);
  e.updateBattlefieldVisibility([{ x: bridge.spec.center[0], z: bridge.spec.center[1] }]);
  assert.equal(bridge.root.visible, true); assert.equal(bridge.deck.visible, false); assert.equal(bridge.gapCollider.enabled, true);
  assert.deepEqual(e.serializeTacticalWorld(), before); assert.equal(e.completedSectors.has('insertion'), true);
  e.clearEnvironment();
});

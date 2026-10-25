import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBattlefieldLayout, pointInBattlefieldRect } from '../js/data/BattlefieldLayouts.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { EnvironmentManager } from '../js/entities/Environment.js';

for (const level of LEVELS_DATA) {
  test(`${level.id}: a large connected map has locked physical corridors, safe spawns and a complete route`, () => {
    const layout = createBattlefieldLayout(level);
    assert.equal(layout.sectors.length, 6); assert.equal(layout.corridors.length, 5); assert.equal(layout.gates.length, 5);
    assert.ok(Math.max(layout.dimensions.width, layout.dimensions.depth) >= 4.8 * 132);
    assert.deepEqual(layout.sectors.map(sector => sector.objective.type), ['kills', 'commander', 'interact', 'kills', 'commander', 'boss']);
    for (const sector of layout.sectors) {
      assert.ok(pointInBattlefieldRect({ x: sector.objective.position[0], z: sector.objective.position[1] }, sector.bounds, 8));
    }
    const env = new EnvironmentManager(new THREE.Scene()); env.buildLevelEnvironment(level);
    try {
      assert.equal(env.getSectorAt(new THREE.Vector3()).id, 'insertion');
      const originalColliders = env.colliders.length;
      for (let gateIndex = 0; gateIndex < layout.gates.length; gateIndex++) {
        const gate = layout.gates[gateIndex];
        const from = layout.sectors.find(sector => sector.id === gate.from), to = layout.sectors.find(sector => sector.id === gate.to);
        const direction = new THREE.Vector3(to.center[0] - from.center[0], 0, to.center[1] - from.center[1]).normalize();
        const blocked = new THREE.Vector3(...[gate.center[0], 0, gate.center[1]]).addScaledVector(direction, 3);
        env.resolveMovement(blocked);
        const side = blocked.clone().sub(new THREE.Vector3(gate.center[0], 0, gate.center[1])).dot(direction);
        assert.ok(side < -0.7, `gate ${gate.id} must physically stop entry before its plane`);
        const jumping = new THREE.Vector3(gate.center[0], 40, gate.center[1]).addScaledVector(direction, 3);
        env.resolveMovement(jumping); assert.equal(jumping.y, 40); assert.ok(jumping.clone().sub(new THREE.Vector3(gate.center[0], 40, gate.center[1])).dot(direction) < -0.7, 'jumping cannot bypass a locked territory');
        assert.equal(env.openGate(gate.id), true); assert.equal(env.openGate(gate.id), false);
        assert.equal(env.isGateOpen(gate.id), true); assert.equal(env.gateVisuals.get(gate.id).panel.visible, false);
        const actor = new THREE.Vector3(from.center[0], 0, from.center[1]);
        for (let step = 0; step < 425; step++) { actor.addScaledVector(direction, 0.4); env.resolveMovement(actor); }
        assert.ok(actor.distanceTo(new THREE.Vector3(to.center[0], 0, to.center[1])) < 0.01, `the open corridor ${gate.id} must be continuously walkable`);
        env.setActiveSector(to.id);
        for (let index = 0; index < 16; index++) {
          const spawn = env.getSpawnPoint(to.id, index, actor, 30);
          assert.ok(pointInBattlefieldRect(spawn, to.bounds, 2));
          assert.ok(spawn.distanceTo(actor) >= 29.99, 'reinforcements stay away from the player');
          const resolved = spawn.clone(); env.resolveMovement(resolved, 1.5); assert.ok(resolved.distanceTo(spawn) < 1e-5, 'spawn avoids solid scenery and perimeter');
        }
        const lateral = gate.axis === 'x' ? new THREE.Vector3(0, 0, 16) : new THREE.Vector3(16, 0, 0);
        const outside = new THREE.Vector3(gate.center[0], 0, gate.center[1]).add(lateral);
        env.resolveMovement(outside); assert.ok(Math.abs(gate.axis === 'x' ? outside.z - gate.center[1] : outside.x - gate.center[0]) <= 8.26, 'corridor side walls cannot be bypassed');
      }
      assert.equal(env.colliders.length, originalColliders - 5);
      const finalSector = layout.sectors.at(-1);
      const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(...[finalSector.center[0], 0, finalSector.center[1]]);
      env.updateBattlefieldVisibility([{ position: p1 }, { position: p2 }]);
      assert.equal(env.sectorVisuals.get('insertion').visible, true);
      assert.equal(env.sectorVisuals.get('nest').visible, true, 'co-op renders detail around both hunters');
      assert.equal(env.sectorVisuals.get('relay').visible, false, 'distant HD territory detail does not render in every camera');
      env.buildLevelEnvironment(level); assert.equal(env.openGates.size, 0); assert.equal(env.completedSectors.size, 0); assert.equal(env.activeSectorId, 'insertion');
    } finally { env.clearEnvironment(); }
    assert.equal(env.battlefieldLayout, null); assert.equal(env.sectorVisuals.size, 0); assert.equal(env.gateVisuals.size, 0);
  });
}

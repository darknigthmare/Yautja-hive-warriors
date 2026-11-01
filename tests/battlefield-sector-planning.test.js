import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BATTLEFIELD_MAP_VARIANTS } from '../js/data/BattlefieldMapVariants.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';
import { createBattlefieldLayout, pointInBattlefieldRect } from '../js/data/BattlefieldLayouts.js';
import { quietArrivalPocket } from '../js/data/BattlefieldSectorPlanning.js';
import { EnvironmentManager } from '../js/entities/Environment.js';

test('34 actual map plans give each extension separate quiet, decision and combat spaces with reproducible travel metrics', () => {
  const speed = CHARACTERS_DATA.find(character => character.id === 'jungle_hunter').stats.moveSpeed;
  for (const variant of BATTLEFIELD_MAP_VARIANTS) for (const mapSeed of [0, 17]) {
    const level = LEVELS_DATA.find(level => level.id === variant.baseLevelId);
    const layout = createBattlefieldLayout({ ...level, mapId: variant.id, strategicMode: true, mapSeed });
    assert.deepEqual(layout.sectors[0].center, [0, 0], 'the historic insertion anchor is not relocated for dressing');
    for (const sector of layout.sectors) {
      const { planning: plan } = sector;
      assert.equal(plan.zones.length, 3);
      for (const zone of plan.zones) assert.ok(pointInBattlefieldRect({ x: zone.center[0], z: zone.center[1] }, sector.bounds, zone.radius));
      const rear = plan.zones.find(zone => zone.kind === 'quiet'), decision = plan.zones.find(zone => zone.kind === 'decision');
      assert.ok(Math.hypot(rear.center[0] - decision.center[0], rear.center[1] - decision.center[1]) >= rear.radius + decision.radius);
      assert.equal(rear.newArrivalAllowed, false);
      assert.deepEqual(decision.center, sector.objective.position);
      assert.equal(plan.travel.movementUnitsPerSecond, speed);
      assert.equal(plan.capacity.desiredCombatants, sector.recommendedEnemies);
      const next = layout.sectors[sector.index + 1];
      if (next) assert.equal(plan.travel.nextCenterUnopposedSeconds, Math.hypot(next.center[0] - sector.center[0], next.center[1] - sector.center[1]) / speed);
    }
  }
});

test('real arrival placement reserves the rear observation pocket while keeping both players, objectives and scenery clear', () => {
  const env = new EnvironmentManager(new THREE.Scene()); env.buildLevelEnvironment(LEVELS_DATA[0]);
  try {
    env.battlefieldLayout.gates.forEach(gate => env.openGate(gate.id));
    for (const sector of env.battlefieldLayout.sectors) {
      const players = [new THREE.Vector3(...[sector.center[0] - 4, 0, sector.center[1]]), new THREE.Vector3(...[sector.center[0] + 4, 0, sector.center[1]])];
      for (let index = 0; index < 32; index++) {
        const spawn = env.getSpawnPoint(sector.id, index, players, 30);
        assert.equal(quietArrivalPocket(sector, spawn, 2.2), false);
        assert.ok(Math.min(...players.map(player => player.distanceTo(spawn))) >= 30 - 1e-7);
        const resolved = spawn.clone(); env.resolveMovement(resolved, 1.5); assert.ok(spawn.distanceTo(resolved) < 1e-6);
      }
    }
  } finally { env.clearEnvironment(); }
});

for (const level of LEVELS_DATA) test(`${level.id}: physical sector landmarks have two different shapes, and reciprocal 32-capsule traffic clears a real corridor`, () => {
  const env = new EnvironmentManager(new THREE.Scene()); env.buildLevelEnvironment(level);
  try {
    env.battlefieldLayout.gates.forEach(gate => env.openGate(gate.id));
    for (const sector of env.battlefieldLayout.sectors.slice(1)) {
      const architecture = env.sectorVisuals.get(sector.id).getObjectByName(`battlefield-sector-architecture-${sector.id}`);
      const signatures = new Set(architecture.userData.landmarks.map(landmark => landmark.signature));
      assert.ok(signatures.size >= 2, `${sector.id} must not use four identical structures distinguished only by color`);
      assert.strictEqual(architecture.userData.sectorPlanning, sector.planning);
    }
    const corridor = env.battlefieldLayout.corridors[1], axis = corridor.axis, other = axis === 'x' ? 'z' : 'x';
    const middle = corridor.center[axis === 'x' ? 0 : 1], lateralCenter = corridor.center[other === 'x' ? 0 : 1];
    const actors = [-1, 1].flatMap(sign => Array.from({ length: 16 }, (_, index) => {
      const position = new THREE.Vector3(corridor.center[0], 0, corridor.center[1]); position[axis] -= sign * (30 + index * 2);
      const target = position.clone(); target[axis] += sign * (70 + index * 2);
      return { position, target, sign, crossings: [] };
    }));
    let maxStep = 0;
    for (let frame = 0; frame < 1400; frame++) for (const actor of actors) {
      const { position, target } = actor;
      if (position.distanceTo(target) < .15) continue;
      const previous = position.clone(), step = Math.min(.1, position.distanceTo(target));
      position.addScaledVector(target.clone().sub(position).normalize(), step);
      env.resolveAgentMovement(position, target, step, .8, previous);
      maxStep = Math.max(maxStep, previous.distanceTo(position));
      if (Math.abs(position[axis] - middle) < 1) actor.crossings.push(position[other] - lateralCenter);
    }
    assert.ok(maxStep <= .10001, 'lane guidance never teleports or spends two movement steps');
    for (const actor of actors) {
      assert.ok(actor.position.distanceTo(actor.target) < .16, 'both assault and reverse evacuation reach the far approach');
      assert.ok(actor.crossings.length > 0);
      const expectedSide = actor.sign * (axis === 'z' ? 1 : -1);
      for (const lateral of actor.crossings) assert.ok(lateral * expectedSide >= 1.8, 'opposite traffic has a physically separate corridor line');
    }
  } finally { env.clearEnvironment(); }
});

test('lane steering cannot route around a closed gate or through an obstacle occupying its preferred side', () => {
  const env = new EnvironmentManager(new THREE.Scene()); env.buildLevelEnvironment(LEVELS_DATA[0]);
  try {
    const corridor = env.battlefieldLayout.corridors[0], gate = env.battlefieldLayout.gates[0];
    const from = new THREE.Vector3(corridor.center[0], 0, corridor.center[1] + 5), target = new THREE.Vector3(0, 0, -170);
    assert.deepEqual(env.getNavigationWaypoint(from, target, .8).toArray(), from.toArray());
    env.openGate(gate.id);
    env.addBoxCollider(-2.2, corridor.center[1] - 2, 1.1, 1.1, 5);
    const waypoint = env.getNavigationWaypoint(from, target, .8);
    const position = from.clone(), direction = waypoint.clone().sub(from).normalize();
    for (let step = 0; step < 120 && position.distanceTo(waypoint) > .15; step++) {
      const previous = position.clone(); position.addScaledVector(direction, .1); env.resolveAgentMovement(position, waypoint, .1, .8, previous);
      const fixed = position.clone(); env.resolveMovement(fixed, .8); assert.ok(fixed.distanceTo(position) < 1e-7);
    }
  } finally { env.clearEnvironment(); }
});

test('corridor route plans reuse their graph search and invalidate when a real gate changes', () => {
  const env = new EnvironmentManager(new THREE.Scene()); env.buildLevelEnvironment(LEVELS_DATA[0]);
  try {
    const gate = env.battlefieldLayout.gates[0]; env.openGate(gate.id);
    const from = new THREE.Vector3(0, 0, -78), target = new THREE.Vector3(0, 0, -170);
    const search = env.navigation.strategicPath.bind(env.navigation); let searches = 0;
    env.navigation.strategicPath = (...args) => { searches++; return search(...args); };
    const first = env.getNavigationWaypoint(from, target, .8);
    assert.ok(first.z < from.z);
    for (let frame = 0; frame < 20; frame++) { from.z -= .1; env.getNavigationWaypoint(from, target, .8); }
    assert.equal(searches, 1, 'local steering must not rebuild the strategic graph each frame');
    env.closeGate(gate.id);
    assert.deepEqual(env.getNavigationWaypoint(from, target, .8).toArray(), from.toArray());
    assert.equal(searches, 2, 'the existing terrain invalidation epoch invalidates the route cache');
    env.openGate(gate.id); assert.ok(env.getNavigationWaypoint(from, target, .8).z < from.z);
    assert.equal(searches, 3);
    const nextCorridor = env.battlefieldLayout.corridors[1]; from.set(nextCorridor.center[0], 0, nextCorridor.center[1]);
    env.getNavigationWaypoint(from, target, .8);
    assert.equal(searches, 4, 'moving to a different corridor cannot reuse a projection from behind another corner');
  } finally { env.clearEnvironment(); }
});

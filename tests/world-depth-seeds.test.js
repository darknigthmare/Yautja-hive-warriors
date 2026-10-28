import test from 'node:test';
import assert from 'node:assert/strict';
import { BATTLEFIELD_MAP_VARIANTS } from '../js/data/BattlefieldMapVariants.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { createBattlefieldLayout, pointInBattlefieldRect } from '../js/data/BattlefieldLayouts.js';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';

test('each of the 34 maps has reproducible, distinct seeded physical paths with stable named anchors', () => {
  for (const variant of BATTLEFIELD_MAP_VARIANTS) {
    const level = LEVELS_DATA.find(level => level.id === variant.baseLevelId);
    const build = mapSeed => createBattlefieldLayout({ ...level, mapId: variant.id, strategicMode: true, mapSeed });
    const original = build(0), first = build(17), second = build(90210);
    assert.deepEqual(first, build(17), `${variant.id} must reproduce the same checkpoint geometry`);
    assert.notDeepEqual(first.sectors.map(s => s.center), second.sectors.map(s => s.center), `${variant.id} cannot alias two seeds`);
    for (const layout of [first, second]) {
      assert.deepEqual(layout.sectors.map(s => s.id), original.sectors.map(s => s.id));
      assert.deepEqual(layout.gates.map(g => g.id), original.gates.map(g => g.id));
      assert.deepEqual(layout.frontAnchorIds, original.frontAnchorIds);
      assert.deepEqual(layout.sectors[0].center, [0, 0]);
      const regions = [...layout.sectors, ...layout.corridors].map(item => item.bounds);
      for (const route of layout.strategicRoutes) for (let i = 1; i < route.waypoints.length; i++) {
        const a = route.waypoints[i - 1], b = route.waypoints[i];
        assert.ok(a[0] === b[0] || a[1] === b[1], `${variant.id} diagonal route`);
        for (let step = 0; step <= 20; step++) {
          const x = a[0] + (b[0] - a[0]) * step / 20, z = a[1] + (b[1] - a[1]) * step / 20;
          assert.ok(regions.some(bounds => pointInBattlefieldRect({ x, z }, bounds, .65)), `${variant.id}/${route.id} leaves physical floor`);
        }
      }
      for (const sector of layout.sectors) assert.ok(pointInBattlefieldRect({ x: sector.objective.position[0], z: sector.objective.position[1] }, sector.bounds, 8));
    }
  }
});

test('invalid seeds fail before producing ambiguous checkpoint geometry', () => {
  for (const mapSeed of [-1, 1.2, Infinity, NaN, '17', 0x100000000]) assert.throws(() => createBattlefieldLayout({ mapId: 'LD-01', mapSeed }), /unsigned 32-bit/);
});

for (const variant of BATTLEFIELD_MAP_VARIANTS) test(`${variant.id}: two seeded constructions retain physically open complete routes`, () => {
  const e = new EnvironmentManager(new THREE.Scene()), level = LEVELS_DATA.find(level => level.id === variant.baseLevelId);
  const layouts = [];
  for (const mapSeed of [17, 90210]) {
    e.buildLevelEnvironment({ ...level, mapId: variant.id, strategicMode: true, mapSeed });
    const layout = e.battlefieldLayout; layouts.push(JSON.stringify(layout.sectors.map(s => s.center))); layout.gates.forEach(gate => e.openGate(gate.id));
    for (const route of layout.strategicRoutes) {
      const [startX, startZ] = route.waypoints[0], point = new THREE.Vector3(startX, e.getPlacementElevationAt(startX, startZ), startZ);
      for (let i = 1; i < route.waypoints.length; i++) {
        const a = route.waypoints[i - 1], b = route.waypoints[i], steps = Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]));
        for (let step = 1; step <= steps; step++) {
          const previousY = point.y;
          point.x = a[0] + (b[0] - a[0]) * step / steps; point.z = a[1] + (b[1] - a[1]) * step / steps;
          point.y = e.getElevationAt(point.x, point.z, previousY); const requested = point.clone(); e.resolveMovement(point, .65);
          assert.ok(point.distanceTo(requested) < 1e-5, `${variant.id}/seed${mapSeed}/${route.id} has a solid obstruction`);
          assert.ok(Math.abs(point.y - previousY) <= .66, `${variant.id}/seed${mapSeed}/${route.id} requires an unsupported vertical step`);
        }
      }
    }
    e.clearEnvironment(); assert.equal(e.scene.children.length, 0);
  }
  assert.notEqual(layouts[0], layouts[1]);
});

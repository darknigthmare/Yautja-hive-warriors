import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { BATTLEFIELD_MAP_VARIANTS } from '../js/data/BattlefieldMapVariants.js';
import { createBattlefieldLayout, pointInBattlefieldRect } from '../js/data/BattlefieldLayouts.js';
import { EnvironmentManager } from '../js/entities/Environment.js';

test('34 Excel maps have distinct real layouts, actual sector/front counts and measured orthogonal alternatives', () => {
  assert.equal(BATTLEFIELD_MAP_VARIANTS.length, 34);
  const layouts = new Set();
  for (const variant of BATTLEFIELD_MAP_VARIANTS) {
    const level = LEVELS_DATA.find(level => level.id === variant.baseLevelId);
    assert.ok(level, variant.id);
    const layout = createBattlefieldLayout({ ...level, mapId: variant.id, strategicMode: true });
    assert.equal(layout.sectors.length, variant.sectors);
    assert.equal(layout.frontAnchorIds.length, variant.fronts);
    assert.equal(layout.gates.length, variant.sectors + 1);
    assert.ok(layout.corridors.filter(corridor => corridor.tactical).length >= 4);
    assert.ok(layout.strategicRoutes.length >= variant.fronts + 1);
    layouts.add(JSON.stringify(layout.sectors.map(sector => [sector.center, sector.bounds])));
    for (const sector of layout.sectors) assert.ok(pointInBattlefieldRect({ x: sector.objective.position[0], z: sector.objective.position[1] }, sector.bounds, 8));
    for (const route of layout.strategicRoutes) {
      let length = 0;
      for (let index = 1; index < route.waypoints.length; index++) {
        const a = route.waypoints[index - 1], b = route.waypoints[index];
        assert.ok(a[0] === b[0] || a[1] === b[1], 'routes follow real orthogonal corridors rather than outside diagonals');
        length += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      assert.ok(Math.abs(route.travelSeconds - length / 6) < 1e-7);
    }
  }
  assert.equal(layouts.size, 34, 'maps cannot be 34 aliases of one physical layout');
});

for (const variant of BATTLEFIELD_MAP_VARIANTS) {
  test(`${variant.id}: every strategic route physically walks on the constructed map and all private resources leave once`, () => {
    const scene = new THREE.Scene(), environment = new EnvironmentManager(scene);
    const level = LEVELS_DATA.find(level => level.id === variant.baseLevelId);
    environment.buildLevelEnvironment({ ...level, mapId: variant.id, strategicMode: true });
    const layout = environment.battlefieldLayout;
    layout.gates.forEach(gate => environment.openGate(gate.id));
    for (const route of layout.strategicRoutes) {
      for (let index = 1; index < route.waypoints.length; index++) {
        const a = new THREE.Vector3(route.waypoints[index - 1][0], 0, route.waypoints[index - 1][1]);
        const b = new THREE.Vector3(route.waypoints[index][0], 0, route.waypoints[index][1]);
        const steps = Math.ceil(a.distanceTo(b) / 4);
        for (let step = 0; step <= steps; step++) {
          const point = a.clone().lerp(b, step / steps); point.y = environment.getElevationAt(point.x, point.z); const expected = point.clone();
          environment.resolveMovement(point, .65);
          assert.ok(point.distanceTo(expected) < 1e-5, `${variant.id}/${route.id}/${index}/${step}: solid wall crosses a declared route`);
          assert.ok(environment.accessibleBattlefieldRects().some(bounds => pointInBattlefieldRect(point, bounds, .64)));
        }
      }
    }
    const geometries = new Set(environment.geometries.values()), materials = new Set(environment.materials.values());
    const disposed = new Map();
    for (const resource of [...geometries, ...materials]) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) ?? 0) + 1));
    environment.clearEnvironment();
    for (const resource of [...geometries, ...materials]) assert.equal(disposed.get(resource), 1, 'each shared/derived resource leaves exactly once');
    assert.equal(scene.children.length, 0); assert.equal(environment.referenceTimers.length, 0); assert.equal(environment.referenceOwnedRoots.size, 0);
  });
}

test('standard hunts retain their six sectors and five locked connections without tactical bypasses', () => {
  for (const level of LEVELS_DATA) {
    const layout = createBattlefieldLayout(level);
    assert.equal(layout.sectors.length, 6); assert.equal(layout.corridors.length, 5);
    assert.ok(layout.corridors.every(corridor => !corridor.tactical));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { buildBattlefieldSectorDetails, buildBattlefieldCorridorDetails } from '../js/graphics/BattlefieldSectorDetails.js';

function localPoint(collider, x, z, y = 0) {
  return new THREE.Vector3(collider.x + x * Math.cos(collider.rotation) + z * Math.sin(collider.rotation), y,
    collider.z - x * Math.sin(collider.rotation) + z * Math.cos(collider.rotation));
}

function distanceToBox(point, collider) {
  const dx = point[0] - collider.x, dz = point[1] - collider.z;
  const c = Math.cos(collider.rotation), s = Math.sin(collider.rotation);
  const x = dx * c - dz * s, z = dx * s + dz * c;
  return Math.hypot(x - THREE.MathUtils.clamp(x, -collider.halfWidth, collider.halfWidth), z - THREE.MathUtils.clamp(z, -collider.halfDepth, collider.halfDepth));
}

function visibleMetrics(root) {
  let triangles = 0, calls = 0;
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (let ancestor = mesh; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return;
    calls++; triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * (mesh.count ?? 1);
  });
  return { triangles, calls };
}

for (const level of LEVELS_DATA) {
  test(`${level.environmentType}: sector architecture has distinct silhouettes, real footprints and clear battle routes`, () => {
    const env = new EnvironmentManager(new THREE.Scene()); env.buildLevelEnvironment(level);
    try {
      const frames = [];
      // Check every active territory with barriers still closed, including two
      // distant cooperative views. Opening all gates first would undercount the
      // actual barrier draws and conceal an excessive shared-scene budget.
      for (const sector of env.battlefieldLayout.sectors) {
        const position = new THREE.Vector3(sector.center[0], 0, sector.center[1]);
        for (const positions of [[{ position }], [{ position: new THREE.Vector3() }, { position }]]) {
          env.updateBattlefieldVisibility(positions);
          const frame = visibleMetrics(env.root); frames.push(frame);
          assert.ok(frame.triangles < 500000, `active/coop geometry budget ${frame.triangles}`);
          assert.ok(frame.calls <= 230, `active/coop potential draw submissions ${frame.calls}`);
        }
      }
      console.info('Architecture frame budget:', JSON.stringify({ type: level.environmentType,
        maximumTriangles: Math.max(...frames.map(frame => frame.triangles)), maximumPotentialSubmissions: Math.max(...frames.map(frame => frame.calls)) }));
      let addedTriangles = 0;
      const shapes = new Set(), ownedGeometries = new Set(env.geometries.values());
      for (const sector of env.battlefieldLayout.sectors.slice(1)) {
        const parent = env.sectorVisuals.get(sector.id);
        const group = parent.getObjectByName(`battlefield-sector-architecture-${sector.id}`);
        assert.ok(group, 'actual level construction installs architecture under its cullable sector');
        assert.equal(buildBattlefieldSectorDetails(env, sector, parent), group, 'repeated construction cannot duplicate owned geometry or collision');
        const d = group.userData.diagnostics;
        assert.ok(d.triangles > 1500 && d.triangles < 14000, `modelled architecture budget ${d.triangles}`);
        assert.ok(d.drawMeshes <= 6, `${d.drawMeshes} material batches`);
        assert.equal(group.userData.landmarks.length, 4, 'each quadrant has a substantial landmark before background dressing is placed');
        assert.equal(new Set(group.userData.landmarks.map(site => site.quadrant)).size, 4);
        for (const site of group.userData.landmarks) {
          assert.ok(Math.abs(site.x) <= 36 && Math.abs(site.z) <= 36, 'new landmarks cannot be displaced into distant foggy corners');
          assert.equal(site.scale, 1.2);
        }
        assert.equal(d.floorY, 0);
        addedTriangles += d.triangles;
        const box = new THREE.Box3().setFromObject(group); shapes.add(`${d.triangles}:${box.max.y.toFixed(2)}`);
        group.traverse(mesh => {
          if (!mesh.isMesh) return;
          assert.ok(ownedGeometries.has(mesh.geometry));
          assert.ok(mesh.material.map?.isDataTexture && mesh.material.normalMap?.isDataTexture && mesh.material.roughnessMap?.isDataTexture);
          for (const name of ['position', 'normal', 'uv']) assert.ok(mesh.geometry.attributes[name].array.every(Number.isFinite));
        });
        for (const collider of env.colliders.filter(value => value.owner === group.name)) {
          const c = Math.abs(Math.cos(collider.rotation)), s = Math.abs(Math.sin(collider.rotation));
          const extentX = c * collider.halfWidth + s * collider.halfDepth;
          const extentZ = s * collider.halfWidth + c * collider.halfDepth;
          assert.ok(Math.abs(collider.x - sector.center[0]) - extentX >= 11, 'new solids keep the north/south combat lane clear');
          assert.ok(Math.abs(collider.z - sector.center[1]) - extentZ >= 11, 'new solids keep the east/west combat lane clear');
          assert.ok(distanceToBox(sector.objective.position, collider) >= 10, 'objectives retain a real clear approach');
        }
      }
      assert.ok(shapes.size >= 2, 'sector roles are not identical copies with different names');
      for (const corridor of env.battlefieldLayout.corridors) {
        const group = env.corridorVisuals.get(corridor.id);
        assert.ok(group?.name === `battlefield-corridor-architecture-${corridor.id}`);
        assert.equal(buildBattlefieldCorridorDetails(env, corridor, env.root), group);
        assert.ok(group.userData.diagnostics.triangles > 1000 && group.userData.diagnostics.triangles < 6000);
        assert.ok(group.userData.diagnostics.drawMeshes <= 4);
        addedTriangles += group.userData.diagnostics.triangles;
        const gate = env.battlefieldLayout.gates.find(value => value.corridorId === corridor.id); env.openGate(gate.id);
        for (const lateral of [-5.5, 0, 5.5]) for (const along of [-20, -14, -12, 12, 14, 20]) {
          const requested = new THREE.Vector3(corridor.center[0] + (corridor.axis === 'x' ? along : lateral), 0,
            corridor.center[1] + (corridor.axis === 'z' ? along : lateral));
          const actual = requested.clone(); env.resolveMovement(actual, 1.2);
          assert.ok(actual.distanceTo(requested) < 1e-7, 'posts, drains and overhead details do not create invisible corridor barriers');
        }
      }
      assert.ok(addedTriangles < 100000, `full-network addition remains bounded: ${addedTriangles}`);
      const last = env.battlefieldLayout.corridors.at(-1);
      env.updateBattlefieldVisibility([{ position: new THREE.Vector3() }]);
      assert.equal(env.corridorVisuals.get(last.id).visible, false);
      env.updateBattlefieldVisibility([{ position: new THREE.Vector3() }, { position: new THREE.Vector3(last.center[0], 0, last.center[1]) }]);
      assert.equal(env.corridorVisuals.get(last.id).visible, true, 'co-op retains detail around either hunter');
    } finally { env.clearEnvironment(); }
  });
}

test('resin cores collide as their rotated ellipse rather than a hidden rectangular wall', () => {
  const env = new EnvironmentManager(new THREE.Scene()); env.buildLevelEnvironment(LEVELS_DATA.find(level => level.environmentType === 'hive'));
  try {
    const cores = env.colliders.filter(collider => collider.shape === 'ellipse');
    assert.ok(cores.length >= 5);
    for (const collider of cores) {
      const a = collider.halfWidth, b = collider.halfDepth;
      const side = localPoint(collider, a + 0.1, 0), expected = localPoint(collider, a + 0.75, 0);
      collider.resolveMovement(side, 0.75);
      assert.ok(side.distanceTo(expected) < 1e-6, 'bulging resin remains solid beyond its smaller base');
      const corner = localPoint(collider, a + 0.1, b + 0.1), before = corner.clone(); collider.resolveMovement(corner, 0.3);
      assert.ok(corner.distanceTo(before) < 1e-9, 'empty diagonal navigation margin is not a physical wall');
      const above = localPoint(collider, 0, 0, collider.height + 0.3), aboveBefore = above.clone(); collider.resolveMovement(above, 0.75);
      assert.deepEqual(above.toArray(), aboveBefore.toArray());
      const inside = localPoint(collider, 0, 0); collider.resolveMovement(inside, 0.75);
      assert.ok(inside.distanceTo(localPoint(collider, 0, b + 0.75)) < 1e-6);
    }
  } finally { env.clearEnvironment(); }
});

test('all static architecture resources are environment-owned and released exactly once on replay', () => {
  const scene = new THREE.Scene(), env = new EnvironmentManager(scene); env.buildLevelEnvironment(LEVELS_DATA[0]);
  const geometries = new Set(env.geometries.values()), materials = new Set(env.materials.values());
  let geometryDisposals = 0, materialDisposals = 0;
  geometries.forEach(geometry => geometry.addEventListener('dispose', () => geometryDisposals++));
  materials.forEach(material => material.addEventListener('dispose', () => materialDisposals++));
  const count = env.colliders.length, cached = env.geometries.size;
  for (const sector of env.battlefieldLayout.sectors.slice(1)) buildBattlefieldSectorDetails(env, sector, env.sectorVisuals.get(sector.id));
  for (const corridor of env.battlefieldLayout.corridors) buildBattlefieldCorridorDetails(env, corridor, env.root);
  assert.equal(env.colliders.length, count); assert.equal(env.geometries.size, cached);
  env.clearEnvironment();
  assert.equal(geometryDisposals, geometries.size); assert.equal(materialDisposals, materials.size);
  assert.equal(scene.children.length, 0); assert.equal(env.corridorVisuals.size, 0);
  env.clearEnvironment();
  assert.equal(geometryDisposals, geometries.size); assert.equal(materialDisposals, materials.size);
});

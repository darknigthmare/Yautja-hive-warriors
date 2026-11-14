import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { WeatherSystem } from '../js/engine/WeatherSystem.js';
import { resolveThirdPersonCamera } from '../js/engine/CameraCollision.js';
import { buildBattlefieldWayfinding } from '../js/graphics/BattlefieldWayfinding.js';
import { referenceLevelProfile } from '../js/data/ReferenceLevelMechanisms.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

const level = id => LEVELS_DATA.find(value => value.id === id);

test('mission steam belongs to authored industrial conduits and moves to the actual supporting floor', () => {
  const scene = new THREE.Scene(), weather = new WeatherSystem(scene);
  const sectors = [0, 1, 2, 3, 4].map(index => ({ index, center: [index * 100, 0], bounds: { minX: index * 100 - 30, maxX: index * 100 + 30 } }));
  const environment = id => ({ referenceProfile: referenceLevelProfile(id), battlefieldLayout: { sectors }, getPlacementElevationAt: () => 2.75 });
  for (const id of ['val_verde_jungle', 'gunnison_forest', 'prey_comanche_territory', 'game_preserve_planet', 'killer_of_killers_arena']) {
    weather.configureMissionSteamVents(level(id), environment(id));
    assert.equal(weather.steamVents.length, 0, id);
    assert.equal(scene.children.length, 0);
  }
  for (const id of ['romulus_station', 'charon_rogue_base']) {
    weather.configureMissionSteamVents(level(id), environment(id));
    assert.equal(weather.steamVents.length, 3);
    assert.ok(weather.steamVents.every(vent => vent.pos.x > 100 && vent.pos.y === 2.75 && vent.group.position.y === 2.8));
    assert.ok(weather.steamVents.every(vent => vent.group.userData.hazardContext === id));
  }
  weather.configureMissionSteamVents(level('val_verde_jungle'), environment('val_verde_jungle'));
  assert.equal(scene.children.length, 0, 'changing mission removes the previous industrial hazards');
  weather.clear();
});

test('steam has bounded soft alpha rather than opaque cone sheets, and releasing it preserves Three shared sprite geometry', () => {
  const scene = new THREE.Scene(), weather = new WeatherSystem(scene); weather.spawnSteamVents(1);
  const vent = weather.steamVents[0], plume = vent.steamMesh;
  assert.equal(plume.visible, false);
  assert.ok(plume.children.every(child => child.isSprite && child.material.map.isDataTexture && child.material.depthWrite === false));
  let cone = false; vent.group.traverse(node => { if (node.geometry?.type === 'ConeGeometry') cone = true; });
  assert.equal(cone, false);
  const sharedGeometry = plume.children[0].geometry, material = plume.material;
  let sharedDisposed = 0, materialDisposed = 0;
  sharedGeometry.addEventListener('dispose', () => sharedDisposed++); material.addEventListener('dispose', () => materialDisposed++);
  vent.cycleTimer = 0; weather.update(1 / 60); assert.equal(plume.visible, true);
  let maximumOpacity = 0;
  for (let frame = 0; frame < 145; frame++) { weather.update(1 / 60); maximumOpacity = Math.max(maximumOpacity, plume.material.opacity); }
  assert.ok(maximumOpacity > .3 && maximumOpacity <= .32);
  assert.equal(plume.visible, false);
  const remaining = vent.cycleTimer; weather.update(0); assert.equal(vent.cycleTimer, remaining);
  weather.clear(); weather.clear();
  assert.equal(materialDisposed, 1); assert.equal(sharedDisposed, 0); assert.equal(scene.children.length, 0);
});

test('Val Verde paint stays on the insertion floor while rounded canopy paths keep separate real upper contacts', () => {
  const environment = new EnvironmentManager(new THREE.Scene());
  try {
    environment.buildLevelEnvironment({ ...level('val_verde_jungle'), strategicMode: true, mapSeed: 1 });
    const positions = environment.root.getObjectByName('battlefield-wayfinding-floor').geometry.attributes.position;
    let inspected = 0;
    for (let index = 0; index < positions.count; index++) {
      if (Math.abs(positions.getX(index)) < 22 && Math.abs(positions.getZ(index)) < 30) {
        inspected++; assert.ok(Math.abs(positions.getY(index) - .045) < 1e-6, 'the old entire canopy AABB cannot elevate the paint');
      }
    }
    assert.ok(inspected >= 78);
    assert.equal(environment.getElevationAt(0, 6, 0), 0);
    assert.equal(environment.getPlacementElevationAt(0, 36), 0, 'unqualified placement does not spawn a ground actor on an overhead bough');
    const branch = environment.canopyBoughHighways[1], x = 10, z = -18, upper = branch.heightAt(x, z);
    assert.ok(upper > 6 && upper < 7.2);
    assert.equal(branch.mesh.geometry.type, 'CylinderGeometry');
    assert.ok(branch.mesh.material.normalMap?.isDataTexture);
    assert.equal(environment.getElevationAt(x, z, 0), 0);
    assert.ok(Math.abs(environment.getElevationAt(x, z, upper) - upper) < 1e-8);
    const contact = environment.traceSegment(new THREE.Vector3(x, 9, z), new THREE.Vector3(x, 4, z));
    assert.ok(contact && Math.abs(contact.point.y - upper) < .001, 'feet and projectile contact share rendered bough triangles');
    const camera = resolveThirdPersonCamera(new THREE.Vector3(x, 2, z), new THREE.Vector3(x, 9, z), environment);
    assert.equal(camera.collided, true); assert.ok(camera.position.y < 6);
    const lower = new THREE.Vector3(x, 0, z); environment.resolveMovement(lower, .65); assert.equal(lower.y, 0);
    const intersecting = new THREE.Vector3(x, 5.5, z), prior = intersecting.clone(); environment.resolveMovement(intersecting, .65);
    assert.ok(intersecting.distanceTo(prior) < 2, 'a diagonal bough contact cannot teleport an actor to its enclosing rectangle edge');
    environment.referenceRoot.visible = false;
    assert.ok(environment.traceSegment(new THREE.Vector3(x, 9, z), new THREE.Vector3(x, 4, z)), 'render culling cannot remove the upper contact');
  } finally { environment.clearEnvironment(); }
});

test('route paint follows an actual industrial access ramp onto its upper deck instead of staying on a fabricated flat layer', () => {
  const environment = new EnvironmentManager(new THREE.Scene());
  environment.root = new THREE.Group(); environment.referenceRoot = new THREE.Group(); environment.root.add(environment.referenceRoot); environment.scene.add(environment.root);
  try {
    environment.buildIndustrialCatwalks();
    environment.battlefieldLayout = { sectors: [{ id: 'ramp-entry', index: 0, center: [-28, 48] }], gates: [{ id: 'upper-access', from: 'ramp-entry', to: 'upper', center: [-28, 14] }] };
    const cues = buildBattlefieldWayfinding(environment), samples = cues[0].samples;
    assert.ok(samples.some(([, y]) => y > .5 && y < 4));
    assert.ok(samples.some(([, y]) => Math.abs(y - 5.445) < .001));
    const positions = environment.root.getObjectByName('battlefield-wayfinding-floor').geometry.attributes.position;
    let upperVertices = 0;
    for (let index = 0; index < positions.count; index++) if (positions.getZ(index) < 30 && positions.getY(index) > 5) {
      upperVertices++;
      assert.ok(Math.abs(positions.getY(index) - 5.445) < .001);
    }
    assert.ok(upperVertices > 0);
  } finally { environment.clearEnvironment(); }
});

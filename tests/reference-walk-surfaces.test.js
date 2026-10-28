import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

function fixture(builder) {
  const environment = new EnvironmentManager(new THREE.Scene()); environment.halfSize = 500;
  environment.root = new THREE.Group(); environment.referenceRoot = new THREE.Group();
  environment.root.add(environment.referenceRoot); environment.scene.add(environment.root); environment.envObjects.push(environment.root); environment[builder]();
  return environment;
}

function seek(environment, position, destination, steps = 2000) {
  const samples = [];
  for (let i = 0; i < steps && position.distanceTo(destination) > .2; i++) {
    const before = position.clone(), direction = destination.clone().sub(position).setY(0).normalize();
    position.addScaledVector(direction, .1); environment.resolveAgentMovement(position, destination, .1, .65);
    assert.ok(position.distanceTo(before) < .15, 'a ground actor uses the actual ramp without teleporting'); samples.push(position.clone());
  }
  assert.ok(position.distanceTo(destination) <= .2, `failed to reach ${destination.toArray()} from ${position.toArray()}`);
  return samples;
}

test('raised industrial floors preserve the lower layer, use real access slopes and stop jumps at the visible underside', () => {
  const e = fixture('buildIndustrialCatwalks');
  assert.equal(e.getElevationAt(-28, 18, 0), 0); assert.equal(e.getElevationAt(-28, 18, 5.4), 5.4);
  const actor = new THREE.Vector3(-28, 0, 18), upper = new THREE.Vector3(-28, 5.4, 18);
  const ascent = seek(e, actor, upper); assert.ok(ascent.some(p => p.z >= 44), 'an actor below the deck must first go to the ramp foot');
  assert.ok(ascent.some(p => p.y > 2 && p.y < 4));
  const descent = seek(e, actor, new THREE.Vector3(-28, 0, 50)); assert.ok(descent.some(p => p.z >= 44 && p.y < .4));
  for (let z = 31; z <= 45; z += .25) {
    const origin = new THREE.Vector3(-28, 9, z), hit = e.traceSegment(origin, origin.clone().setY(-1));
    assert.ok(hit); assert.ok(Math.abs(hit.point.y - e.getElevationAt(-28, z)) < .015, 'physical triangles and logical feet must match');
  }
  const jumper = new THREE.Vector3(-28, 4, 18), hit = e.resolveVerticalMovement(jumper, 0, 2.4);
  assert.equal(hit.blocked, true); assert.ok(Math.abs(hit.hitPoint.y - 5) < .015); assert.ok(jumper.y < 2.6);
  e.referenceRoot.visible = false;
  assert.ok(e.traceSegment(new THREE.Vector3(-28, 9, 18), new THREE.Vector3(-28, 0, 18)), 'render culling cannot remove the physical ceiling');
  e.clearEnvironment(); assert.equal(e.referenceWalkSurfaces.length, 0); assert.equal(e.scene.children.length, 0);
});

test('the solid helipad has four actual cardinal access routes rather than a step through its cylinder', () => {
  const e = fixture('buildLARooftopExpansionProps');
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    let previousHeight = 0;
    for (let distance = 16; distance >= 0; distance -= .1) {
      const p = new THREE.Vector3(dx * distance, previousHeight, dz * distance);
      p.y = e.getElevationAt(p.x, p.z, p.y); const requested = p.clone(); e.resolveMovement(p, .65);
      assert.ok(p.distanceTo(requested) < 1e-5, 'a visible ramp must be physically usable');
      assert.ok(Math.abs(p.y - previousHeight) < .08); previousHeight = p.y;
      const hit = e.traceSegment(new THREE.Vector3(p.x, 10, p.z), new THREE.Vector3(p.x, -1, p.z));
      if (distance < 13.9) assert.ok(hit && Math.abs(hit.point.y - p.y) < .08);
    }
    assert.equal(previousHeight, 4.5);
  }
  const insideBody = new THREE.Vector3(5, 0, 5); e.resolveMovement(insideBody, .65); assert.ok(Math.hypot(insideBody.x, insideBody.z) >= 8.04);
  assert.ok(e.traceSegment(new THREE.Vector3(7.2, .5, -20), new THREE.Vector3(7.2, .5, 20)), 'the tapered solid base is wider than its walkable top');
  e.clearEnvironment();
});

test('resin walkways leave insertion airspace clear and preserve real lower and upper crossing layers', () => {
  const e = fixture('buildHiveWorldExpansionProps');
  assert.equal(e.getElevationAt(0, 0, 0), 0); assert.equal(e.traceSegment(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 8, 0)), null);
  assert.equal(e.getElevationAt(40, 40, 0), 0); assert.equal(e.getElevationAt(40, 40, 4.7), 4.7);
  const actor = new THREE.Vector3(40, 0, 4), target = new THREE.Vector3(40, 4.7, 52);
  seek(e, actor, target); seek(e, actor, new THREE.Vector3(52, 4.7, 40));
  assert.equal(e.getElevationAt(actor.x, actor.z, actor.y), 4.7);
  const ray = e.traceSegment(new THREE.Vector3(40, 9, 40), new THREE.Vector3(40, -1, 40)); assert.ok(Math.abs(ray.point.y - 4.7) < .015);
  e.clearEnvironment();
});

test('a real USCM flametrooper leaves the lower layer, uses the ramp and reaches firing range on the upper deck', () => {
  const e = fixture('buildIndustrialCatwalks'), manager = new ColonialMarinesManager(e.scene, {});
  manager.environment = e; manager.hostileToPlayers = true;
  const actor = manager.spawnBattleUnit({ id: 'vertical-uscm', position: [-28, 18], hp: 150, maxHp: 150, factionId: 'human', actorType: 'flametrooper' }, { id: 'squad' });
  const target = { hp: 1000, position: new THREE.Vector3(-28, 5.4, 18), takeDamage(amount) { this.hp -= amount; } };
  let highest = 0, passedFoot = false;
  for (let i = 0; i < 2000; i++) {
    const before = actor.mesh.position.clone(); manager.update(1 / 60, target, { aliens: [] });
    assert.ok(actor.mesh.position.distanceTo(before) < .16); highest = Math.max(highest, actor.mesh.position.y);
    if (actor.mesh.position.z >= 44 && actor.mesh.position.y < .5) passedFoot = true;
    if (actor.mesh.position.y > 5.3 && actor.mesh.position.distanceTo(target.position) < 5) break;
  }
  assert.equal(passedFoot, true); assert.ok(highest > 5.3); assert.ok(actor.mesh.position.distanceTo(target.position) < 5);
  assert.ok(target.hp > 0); manager.clearSquad(); e.clearEnvironment();
});

test('the legacy Stargazer radius42 enclosure cannot teleport distant fronts back into the insertion room', () => {
  const e = new EnvironmentManager(new THREE.Scene());
  e.buildLevelEnvironment(LEVELS_DATA.find(level => level.id === 'stargazer_facility'));
  const player = { hp: 1000, position: new THREE.Vector3(200, 0, 200) }, alien = { hp: 100, mesh: new THREE.Group() };
  alien.mesh.position.set(205, 0, 200);
  assert.equal(e.stargazerEnergyDome.userData.arenaConfinement, false); assert.equal(e.stargazerEnergyDome.visible, false);
  e.updateLevelDesignV56(.1, player, { aliens: [alien] });
  assert.deepEqual(player.position.toArray(), [200, 0, 200]); assert.deepEqual(alien.mesh.position.toArray(), [205, 0, 200]);
  e.clearEnvironment();
});

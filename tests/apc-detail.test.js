import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAPCModel } from '../js/graphics/SupportModels.js';
import { APCVehicle } from '../js/entities/APCVehicle.js';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { disposeObject } from '../js/engine/SceneResources.js';

const audio = new Proxy({}, { get: () => () => {} });

test('M577 has four covered wheels, angular outward armor and a genuinely recessed nose', () => {
  const model = createAPCModel();
  assert.equal(model.wheels.length, 4);
  for (const side of [-1, 1]) assert.equal(model.wheels.filter(wheel => Math.sign(wheel.x) === side).length, 2);
  model.group.updateMatrixWorld(true);
  for (const wheel of model.wheels) {
    const side = Math.sign(wheel.x);
    const ray = new THREE.Raycaster(new THREE.Vector3(side * 5, wheel.y, wheel.z), new THREE.Vector3(-side, 0, 0));
    const contact = ray.intersectObject(model.group, true)[0];
    assert.ok(contact && Math.abs(contact.point.x) > 2.45, 'each declared wheel has a real outer armored cover');
  }
  const bounds = new THREE.Box3().setFromObject(model.group), size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.z / size.x > 1.9, 'body remains a long low carrier, not a squat truck');
  assert.ok(bounds.min.y >= -0.02 && bounds.min.y < 0.05, 'tires meet the ground');
  const roofRay = new THREE.Raycaster(new THREE.Vector3(0.8, 5, 1), new THREE.Vector3(0, -1, 0));
  const roof = roofRay.intersectObject(model.group, true)[0];
  assert.ok(roof && roof.point.y < 2.5, 'long forward armor deck stays low');
  assert.ok(roof.face.normal.y > 0.9, 'roof face has outward winding and a flat plate normal');
  const noseRay = new THREE.Raycaster(new THREE.Vector3(0.65, 1.57, 6), new THREE.Vector3(0, 0, -1));
  const recess = noseRay.intersectObject(model.group, true)[0];
  assert.ok(recess && recess.point.z < 3.55, 'nose bay is empty ahead of its actual rear bulkhead');
  const armor = model.group.getObjectByName('m577-armored-hull-apc-armor');
  assert.ok(armor);
  const normal = armor.geometry.attributes.normal;
  assert.ok(normal.array.every(Number.isFinite));
  assert.ok(Array.from({ length: normal.count }, (_, i) => normal.getY(i)).some(y => y > 0.999));
  disposeObject(model.group);
});

test('roof turret and carriage share their real rail while yaw leaves the fixed sled aligned', () => {
  const model = createAPCModel();
  for (const value of [0, 0.25, 0.5, 1]) {
    model.setTurretDeployment(value);
    assert.ok(model.turret.position.z >= model.rail.stowedZ && model.turret.position.z <= model.rail.deployedZ);
    assert.equal(model.turret.position.z, model.carriage.position.z);
  }
  model.turret.rotation.y = 0.7;
  assert.equal(model.carriage.rotation.y, 0, 'sliding carriage does not spin with gun housing');
  assert.equal(model.group.rotation.y, 0);
  assert.ok(model.rail.deployedZ - model.rail.stowedZ > 1);
  disposeObject(model.group);
});

test('APC deploys before shooting, aims from the actual roof pivot, recoils and resets without bonus damage', () => {
  const scene = new THREE.Scene(), sparks = [], shots = [];
  const apc = new APCVehicle(scene, audio, { emitSparks(position, count) { sparks.push({ position: position.clone(), count }); } });
  apc.spawn(new THREE.Vector3(4, 0, 8));
  const target = { mesh: new THREE.Group() }; target.mesh.position.set(10, 0, 21);
  const horde = { aliens: [target], checkMeleeHits(attack) { shots.push(attack); return []; } };
  apc.update(0.3, horde);
  assert.equal(shots.length, 0, 'the gun waits for its physical deployment');
  assert.ok(apc.model.turret.position.z > apc.model.rail.stowedZ);
  apc.update(0.65, horde);
  assert.equal(shots.length, 1);
  assert.equal(shots[0].damage, 240);
  assert.equal(shots[0].radius, 3.5);
  assert.equal(apc.model.barrels.position.z, -0.15);
  assert.equal(apc.model.muzzleFlash.visible, true);
  assert.equal(sparks.filter(spark => spark.count === 2).length, 2, 'both actual muzzles produce the shot effect');
  apc.mesh.updateMatrixWorld(true);
  const aim = target.mesh.position.clone().sub(apc.turretMesh.getWorldPosition(new THREE.Vector3())).setY(0).normalize();
  const forward = new THREE.Vector3(0, 0, 1).transformDirection(apc.turretMesh.matrixWorld).setY(0).normalize();
  assert.ok(aim.dot(forward) > 0.999999);
  assert.ok(Math.abs(apc.model.frontTurret.rotation.y) <= 0.55, 'nose gun stays inside its physical firing aperture');
  apc.update(0.4, { aliens: [] });
  assert.ok(apc.model.barrels.position.z > -0.001);
  assert.equal(apc.model.muzzleFlash.visible, false);
  const old = apc.mesh;
  apc.spawn(new THREE.Vector3());
  assert.equal(old.parent, null);
  assert.equal(apc.fireCooldown, 0);
  assert.equal(apc.deployment, 0);
  assert.equal(apc.recoil, 0);
  assert.equal(apc.weaponFlash, 0);
  apc.clear();
  assert.equal(scene.children.length, 0);
  assert.equal(apc.model, null);
});

test('APC surface detail remains finite within the existing mesh and triangle budget', () => {
  const model = createAPCModel(); let triangles = 0, meshes = 0;
  model.group.traverse(node => {
    if (!node.isMesh) return;
    meshes++;
    triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    for (const attribute of ['position', 'normal', 'uv']) assert.ok(node.geometry.attributes[attribute].array.every(Number.isFinite));
  });
  assert.ok(triangles >= 26000 && triangles <= 44000, `${triangles} triangles`);
  assert.ok(meshes <= 14, `${meshes} draw meshes`);
  disposeObject(model.group);
});

test('carrier collision follows the hull, wheel shoulders and rotation without trapping distant or airborne actors', () => {
  const apc = new APCVehicle(new THREE.Scene(), audio);
  apc.spawn(new THREE.Vector3(10, 0, 20));
  const inside = new THREE.Vector3(10, 0, 20);
  assert.equal(apc.resolveMovement(inside, 0.75), inside, 'resolver mutates and returns the actor position');
  assert.ok(Math.abs(inside.x - 10) >= 2.84 - 1e-9, 'ground-level actors cannot occupy the armor');
  const wheel = new THREE.Vector3(12.4, 0, 22.68);
  apc.resolveMovement(wheel, 0.75);
  assert.ok(wheel.x >= 13.27 - 1e-9, 'outer wheel shoulder also blocks movement');
  const away = new THREE.Vector3(50, 0, 70), above = new THREE.Vector3(10, 4.2, 20);
  apc.resolveMovement(away); apc.resolveMovement(above);
  assert.deepEqual(away.toArray(), [50, 0, 70]);
  assert.deepEqual(above.toArray(), [10, 4.2, 20]);
  apc.mesh.rotation.y = Math.PI / 2;
  const rotated = new THREE.Vector3(10, 0, 20);
  apc.resolveMovement(rotated, 0.75);
  assert.ok(Math.abs(rotated.z - 20) >= 2.84 - 1e-9, 'footprint rotates with rendered hull');
  apc.clear();
  const cleared = new THREE.Vector3(10, 0, 20); apc.resolveMovement(cleared);
  assert.deepEqual(cleared.toArray(), [10, 0, 20]);
});

test('environment delegates APC physics while retaining its conservative navigation outline', () => {
  const scene = new THREE.Scene(), env = new EnvironmentManager(scene);
  const apc = new APCVehicle(scene, audio);
  apc.spawn(new THREE.Vector3(10, 0, 20));
  env.colliders.push({
    x: 10, z: 20.08, halfWidth: 2.52, halfDepth: 4.84, height: 2.48, rotation: 0, owner: 'apc',
    resolveMovement: (position, radius) => apc.resolveMovement(position, radius),
  });
  const yAxis = new THREE.Vector3(0, 1, 0);
  const worldPoint = point => new THREE.Vector3(...point).applyAxisAngle(yAxis, apc.mesh.rotation.y).add(apc.mesh.position);
  const assertContact = (start, expected, radius, message) => {
    const position = worldPoint(start), expectedWorld = worldPoint(expected);
    assert.equal(env.resolveMovement(position, radius), position);
    assert.ok(position.distanceTo(expectedWorld) < 1e-9, `${message}: ${position.toArray()}`);
    // The extra carrier pass in the game loop must preserve the same contact.
    apc.resolveMovement(position, radius);
    assert.ok(position.distanceTo(expectedWorld) < 1e-9, `${message}: repeated resolution moved the actor`);
  };
  for (const yaw of [0, Math.PI / 2, -Math.PI / 3]) {
    apc.mesh.rotation.y = yaw;
    assertContact([2.4, 0, 0], [2.4, 0, 0], 0.1, 'narrow actor can pass the recessed middle flank');
    assertContact([3.05, 0, 0], [3.05, 0, 0], 0.75, 'player clears the actual hull without an invisible wide wall');
    assertContact([2.4, 0, 0], [2.84, 0, 0], 0.75, 'player contact follows the narrower central hull');
    assertContact([2.4, 0, 2.68], [3.27, 0, 2.68], 0.75, 'wheel armor still blocks its full width');
    assertContact([2.4, 2.6, 0], [2.4, 2.6, 0], 0.75, 'a roof-height jump clears the low side armor');
    const turretZ = apc.model.turret.position.z;
    assertContact([1.2, 3.2, turretZ], [1.8, 3.2, turretZ], 0.75, 'actual roof turret blocks above the navigation box height');
    assertContact([0, 4.2, turretZ], [0, 4.2, turretZ], 0.75, 'airborne actors clear the entire turret');
  }
  assert.equal(env.colliders[0].halfWidth, 2.52, 'navigation keeps the conservative wheel clearance');
  apc.clear();
});

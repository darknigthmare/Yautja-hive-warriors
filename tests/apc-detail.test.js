import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAPCModel } from '../js/graphics/SupportModels.js';
import { APCVehicle } from '../js/entities/APCVehicle.js';
import { APC_DEPLOYMENT_SECONDS, APC_ELEVATION } from '../js/graphics/APCModel.js';
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

test('roof turret follows a continuous rear return, lowers behind the hull and preserves an independent yaw bearing', () => {
  const model = createAPCModel();
  const forward = new THREE.Vector3(0, 0, 1), previous = new THREE.Vector3();
  let previousAngle = -Math.PI / 2;
  for (let index = 0; index <= 256; index++) {
    model.setTurretDeployment(index / 256);
    const point = model.carriage.position.clone();
    if (index) {
      const movement = point.clone().sub(previous);
      assert.ok(movement.length() < 0.018, 'there is no position jump at either rail junction');
      const tangent = forward.clone().applyEuler(model.carriage.rotation);
      assert.ok(movement.normalize().dot(tangent) > 0.9995, 'the shoe follows the rail tangent instead of sliding sideways');
      assert.ok(Math.abs(model.carriage.rotation.x - previousAngle) < 0.034, 'the shoe turns continuously over the corner');
    }
    previous.copy(point); previousAngle = model.carriage.rotation.x;
    model.group.updateMatrixWorld(true);
    // Every real vertex on the moving shoe and housing must stay outside the
    // solid hull. This checks the back corner, not just the endpoint poses.
    for (const piece of [model.carriage, model.gun]) piece.traverse(node => {
      if (!node.isMesh || node.parent === model.muzzleFlash) return;
      const position = node.geometry.attributes.position;
      for (let vertex = 0; vertex < position.count; vertex++) {
        const world = new THREE.Vector3().fromBufferAttribute(position, vertex).applyMatrix4(node.matrixWorld);
        if (world.z < -4.742 || world.z > -1.02 || Math.abs(world.x) > 1.0) continue;
        const hullTop = world.z < -3.88 ? 2.35 + (world.z + 4.72) / 0.84 * 0.05 : 2.40;
        const roofTop = world.z >= -3.522 && world.z <= -1.028 ? 2.502 : hullTop;
        assert.ok(world.y > Math.max(hullTop, roofTop) - 0.012, `moving geometry clips the hull at ${index}: ${world.toArray()}`);
      }
    });
  }
  model.setTurretDeployment(0);
  assert.ok(model.carriage.position.z < -4.72, 'stowed bearing is behind the rear bulkhead');
  assert.ok(model.carriage.position.y < 1, 'stowage actually lowers the assembly');
  const stowedMuzzle = model.muzzleSockets[0].getWorldPosition(new THREE.Vector3());
  assert.ok(stowedMuzzle.y < 2.65 && stowedMuzzle.y > 2.3, 'barrels fit below the roof rail in the transport pose');
  assert.ok(stowedMuzzle.z < -5, 'stowed barrels remain outside the armor');
  assert.equal(model.setTurretAim(new THREE.Vector3(8, 5, 20)), false, 'a stowed bearing cannot aim or fire');
  model.setTurretDeployment(1);
  model.turret.rotation.y = 0.7;
  assert.equal(model.carriage.rotation.y, 0, 'yaw does not spin the rail carriage');
  assert.equal(model.group.rotation.y, 0);
  model.setTurretDeployment(0.5);
  assert.equal(model.turret.rotation.y, 0, 'retraction restores safe longitudinal yaw');
  assert.equal(model.gun.rotation.x, 0);
  disposeObject(model.group);
});

test('APC deploys before shooting, aims both axes from real muzzles, recoils and preserves damage and cooldown', () => {
  const scene = new THREE.Scene(), sparks = [], shots = [];
  const apc = new APCVehicle(scene, audio, { emitSparks(position, count) { sparks.push({ position: position.clone(), count }); } });
  apc.spawn(new THREE.Vector3(4, 0, 8)); apc.mesh.rotation.y = 0.8;
  const target = { mesh: new THREE.Group(), hp: 350 }; target.mesh.position.set(10, 0, 21);
  const horde = { aliens: [target], checkMeleeHits(attack) { shots.push(attack); return []; } };
  apc.update(0.3, horde);
  assert.equal(shots.length, 0, 'the gun waits while being raised behind the hull');
  assert.ok(apc.model.carriage.position.y > apc.model.rail.stowedHeight);
  apc.update(APC_DEPLOYMENT_SECONDS - 0.3, horde);
  assert.equal(shots.length, 1);
  assert.equal(apc.hp, 2500); assert.equal(apc.maxHp, 2500);
  assert.equal(shots[0].damage, 240); assert.equal(shots[0].radius, 3.5);
  assert.equal(shots[0].type, 'heavy'); assert.equal(apc.fireCooldown, 1.1);
  assert.equal(apc.model.barrels.position.z, -0.15);
  assert.equal(apc.model.muzzleFlash.visible, true);
  const muzzleEffects = sparks.filter(spark => spark.count === 2);
  assert.equal(muzzleEffects.length, 2, 'both actual muzzles produce the shot effect');
  apc.mesh.updateMatrixWorld(true);
  const midpoint = apc.model.muzzleSockets.reduce((sum, socket) => sum.add(socket.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).multiplyScalar(0.5);
  const aim = apc.targetPos.clone().sub(midpoint).normalize();
  const direction = new THREE.Vector3(0, 0, 1).transformDirection(apc.model.barrels.matrixWorld);
  assert.ok(aim.dot(direction) > 0.999999999, 'yaw and pitch align the actual muzzle axis with the raised target point');
  for (let i = 0; i < 2; i++) assert.ok(muzzleEffects[i].position.distanceTo(apc.model.muzzleSockets[i].getWorldPosition(new THREE.Vector3())) < 1e-9);
  assert.ok(apc.model.gun.rotation.x > 0, 'gun housing lowers with the barrels to aim at a ground enemy');
  assert.ok(Math.abs(apc.model.frontTurret.rotation.y) <= 0.55);
  apc.update(0.4, horde);
  assert.equal(shots.length, 1, 'visual recoil cannot cause an extra damage event');
  assert.ok(apc.model.barrels.position.z > -0.001);
  assert.equal(apc.model.muzzleFlash.visible, false);
  apc.update(0.71, horde); assert.equal(shots.length, 2, 'the original 1.1 second cadence remains');
  const old = apc.mesh;
  apc.spawn(new THREE.Vector3());
  assert.equal(old.parent, null); assert.equal(apc.fireCooldown, 0); assert.equal(apc.deployment, 0);
  assert.equal(apc.recoil, 0); assert.equal(apc.weaponFlash, 0);
  apc.clear(); assert.equal(scene.children.length, 0); assert.equal(apc.model, null);
});

test('elevation follows high targets, respects physical stops and never fires at a dead or unreachable target', () => {
  const model = createAPCModel();
  model.group.position.set(11, 2, -8); model.group.rotation.y = -1.1;
  const high = new THREE.Vector3(24, 12, 8);
  assert.equal(model.setTurretAim(high), true);
  model.group.updateMatrixWorld(true);
  const mid = model.muzzleSockets.reduce((sum, socket) => sum.add(socket.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).multiplyScalar(0.5);
  assert.ok(high.clone().sub(mid).normalize().dot(new THREE.Vector3(0, 0, 1).transformDirection(model.barrels.matrixWorld)) > 0.999999999);
  assert.ok(model.gun.rotation.x < 0, 'the complete armored housing elevates');
  assert.equal(model.setTurretAim(new THREE.Vector3(11, 80, -8)), false);
  assert.equal(model.gun.rotation.x, -APC_ELEVATION.max);
  assert.equal(model.setTurretAim(new THREE.Vector3(NaN, 1, 1)), false);
  disposeObject(model.group);
  const shots = [], apc = new APCVehicle(new THREE.Scene(), audio);
  apc.spawn(new THREE.Vector3());
  const dead = { mesh: new THREE.Group(), hp: 0 }; dead.mesh.position.set(8, 0, 14);
  apc.update(APC_DEPLOYMENT_SECONDS, { aliens: [dead], checkMeleeHits(attack) { shots.push(attack); } });
  assert.equal(shots.length, 0); assert.equal(apc.fireCooldown, 0);
  apc.clear();
});

test('an enemy below the depression stop cannot block a reachable target or redirect its damage', () => {
  const apc = new APCVehicle(new THREE.Scene(), audio), shots = [];
  apc.spawn(new THREE.Vector3());
  const enemy = (position, hp = 350) => { const mesh = new THREE.Group(); mesh.position.set(...position); return { mesh, hp }; };
  const close = enemy([3.5, 0, -3]), reachable = enemy([12, 0, 18]), farther = enemy([-15, 0, 20]), dead = enemy([1, 0, 4], 0);
  const horde = { aliens: [farther, close, dead, reachable], checkMeleeHits(attack) { shots.push(attack); return []; } };
  apc.update(APC_DEPLOYMENT_SECONDS, horde);
  assert.equal(shots.length, 1, 'the first reachable target still receives a support burst');
  assert.ok(shots[0].origin.distanceTo(reachable.mesh.position) < 1e-9, 'damage is centred on the selected reachable enemy');
  assert.equal(shots[0].damage, 240); assert.equal(shots[0].radius, 3.5); assert.equal(apc.fireCooldown, 1.1);
  const muzzle = apc.model.muzzleSockets.reduce((sum, socket) => sum.add(socket.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).multiplyScalar(0.5);
  const target = reachable.mesh.position.clone().add(new THREE.Vector3(0, 1.25, 0));
  assert.ok(target.sub(muzzle).normalize().dot(new THREE.Vector3(0, 0, 1).transformDirection(apc.model.barrels.matrixWorld)) > 0.999999999, 'physical aim remains on the reachable target after rejecting the nearer one');
  apc.update(0.4, horde); assert.equal(shots.length, 1, 'selection cannot bypass the existing reload');
  apc.update(0.71, horde); assert.equal(shots.length, 2);
  apc.clear();
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

test('rear stowage blocks its real occupied height, clears after deployment and follows vehicle rotation', () => {
  const apc = new APCVehicle(new THREE.Scene(), audio);
  apc.spawn(new THREE.Vector3(10, 0, 20));
  const yAxis = new THREE.Vector3(0, 1, 0);
  for (const yaw of [0, Math.PI / 2, -Math.PI / 3]) {
    apc.mesh.rotation.y = yaw;
    apc.model.setTurretDeployment(0); apc.mesh.updateMatrixWorld(true);
    assert.equal(apc.model.getTurretCollisionPolygons(0).length, 0, 'the foot plane alone misses the stowed assembly');
    const standing = new THREE.Vector3(0, 0, -5.95).applyAxisAngle(yAxis, yaw).add(apc.mesh.position);
    const standingStart = standing.clone(); apc.resolveMovement(standing, 0.75);
    assert.ok(standing.distanceTo(standingStart) > 0.5, 'a standing player cannot put their torso through the low rear gun');
    const airborne = standingStart.clone().setY(3.0); apc.resolveMovement(airborne, 0.75);
    assert.ok(airborne.distanceTo(standingStart.clone().setY(3.0)) < 1e-9, 'feet above the entire stowed assembly clear it');
    const inside = apc.model.gun.localToWorld(new THREE.Vector3(0, 0.12, 0.2));
    const start = inside.clone(); apc.resolveMovement(inside, 0.25);
    assert.ok(inside.distanceTo(start) > 0.25, 'low rear housing is a physical obstacle in its stowed pose');
    const repeated = inside.clone(); apc.resolveMovement(inside, 0.25);
    assert.ok(inside.distanceTo(repeated) < 1e-9, 'a second contact pass cannot accumulate drift');
    apc.model.setTurretDeployment(1);
    const cleared = start.clone(); apc.resolveMovement(cleared, 0.25);
    assert.ok(cleared.distanceTo(start) < 1e-9, 'raising the housing clears the rear space without leaving an invisible wall');
    const releasedStanding = standingStart.clone(); apc.resolveMovement(releasedStanding, 0.75);
    assert.ok(releasedStanding.distanceTo(standingStart) < 1e-9, 'the standing player can enter that rear space once the gun has left it');
    const ground = new THREE.Vector3(0, 0, -5.65).applyAxisAngle(yAxis, yaw).add(apc.mesh.position);
    const before = ground.clone(); apc.resolveMovement(ground, 0.1);
    assert.ok(ground.distanceTo(before) < 1e-9, 'rear guide geometry does not become a full-height navigation wall');
    // Turning and elevating the complete housing changes its horizontal slice.
    apc.model.turret.rotation.y = 0.8; apc.model.gun.rotation.x = -0.5;
    apc.mesh.updateMatrixWorld(true);
    const elevated = apc.model.gun.localToWorld(new THREE.Vector3(0, 0.08, 0.6));
    const original = elevated.clone(); apc.resolveMovement(elevated, 0.2);
    assert.ok(elevated.distanceTo(original) > 0.2, 'collision follows the housing after both yaw and elevation');
    apc.model.setTurretDeployment(0.25);
    const lowActor = standingStart.clone(), tallActor = standingStart.clone();
    apc.resolveMovement(lowActor, 0.1, 0.5); apc.resolveMovement(tallActor, 0.1, 3.8);
    assert.ok(lowActor.distanceTo(standingStart) < 1e-9, 'an explicitly low actor passes below the rising gun');
    assert.ok(tallActor.distanceTo(standingStart) > 0.1, 'the same position with a standing torso remains blocked');
  }
  apc.clear();
});

test('navigation and spawn clearance enclose every stowage pose and all firing directions', () => {
  const apc = new APCVehicle(new THREE.Scene(), audio);
  assert.ok(apc.navigationRadius > 6.7, 'spawn clearance includes the rear return before a model exists');
  assert.equal(apc.getNavigationCollider(), null);
  apc.spawn(new THREE.Vector3(10, 0, 20));
  const collider = apc.getNavigationCollider();
  const inspect = () => {
    apc.mesh.updateMatrixWorld(true);
    apc.mesh.traverseVisible(node => {
      if (!node.isMesh) return;
      node.geometry.computeBoundingBox();
      const bounds = node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld);
      assert.ok(bounds.min.x >= collider.x - collider.halfWidth - 1e-7);
      assert.ok(bounds.max.x <= collider.x + collider.halfWidth + 1e-7);
      assert.ok(bounds.min.z >= collider.z - collider.halfDepth - 1e-7, `rear exceeds navigation clearance: ${bounds.min.z}`);
      assert.ok(bounds.max.z <= collider.z + collider.halfDepth + 1e-7);
      for (const x of [bounds.min.x, bounds.max.x]) for (const z of [bounds.min.z, bounds.max.z]) {
        assert.ok(Math.hypot(x - apc.mesh.position.x, z - apc.mesh.position.z) <= apc.navigationRadius);
      }
    });
  };
  for (let frame = 0; frame <= 128; frame++) { apc.model.setTurretDeployment(frame / 128); inspect(); }
  for (let angle = 0; angle < 32; angle++) for (const elevation of [APC_ELEVATION.min, 0, APC_ELEVATION.max]) {
    apc.model.turret.rotation.y = angle * Math.PI / 16;
    apc.model.gun.rotation.x = -elevation; inspect();
  }
  apc.mesh.rotation.y = Math.PI / 2;
  const turned = apc.getNavigationCollider();
  assert.ok(turned.x < apc.mesh.position.x && Math.abs(turned.z - apc.mesh.position.z) < 1e-9);
  assert.equal(turned.rotation, Math.PI / 2);
  apc.clear();
});

test('deployment timing is independent of frame rate and rejects paused or invalid time steps', () => {
  const snapshots = [];
  for (const steps of [30, 120]) {
    const apc = new APCVehicle(new THREE.Scene(), audio); apc.spawn(new THREE.Vector3());
    for (let index = 0; index < steps; index++) apc.update(APC_DEPLOYMENT_SECONDS * 0.5 / steps, { aliens: [] });
    snapshots.push({ position: apc.model.carriage.position.toArray(), angle: apc.model.carriage.rotation.x });
    const before = apc.model.carriage.position.clone(), progress = apc.deployment;
    for (const invalid of [0, -1, NaN, Infinity]) apc.update(invalid, { aliens: [] });
    assert.equal(apc.deployment, progress); assert.ok(apc.model.carriage.position.distanceTo(before) < 1e-12);
    apc.clear();
  }
  for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(snapshots[0].position[axis] - snapshots[1].position[axis]) < 1e-12);
  assert.ok(Math.abs(snapshots[0].angle - snapshots[1].angle) < 1e-12);
});

test('environment delegates APC physics while retaining its conservative navigation outline', () => {
  const scene = new THREE.Scene(), env = new EnvironmentManager(scene);
  const apc = new APCVehicle(scene, audio);
  apc.spawn(new THREE.Vector3(10, 0, 20));
  apc.model.setTurretDeployment(1);
  env.colliders.push(apc.getNavigationCollider());
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
    const roofContact = worldPoint([1.2, 3.2, turretZ]);
    env.resolveMovement(roofContact, 0.75);
    const roofLocal = roofContact.clone().sub(apc.mesh.position).applyAxisAngle(yAxis, -yaw);
    assert.ok(roofLocal.x > 1.65 && roofLocal.x < 1.8, 'the real yawed roof assembly blocks above the navigation box');
    const repeated = roofContact.clone(); apc.resolveMovement(roofContact, 0.75);
    assert.ok(roofContact.distanceTo(repeated) < 1e-9);
    assertContact([0, 4.2, turretZ], [0, 4.2, turretZ], 0.75, 'airborne actors clear the entire turret');
  }
  assert.equal(env.colliders[0].halfWidth, 2.52, 'navigation keeps the conservative wheel clearance');
  apc.clear();
});

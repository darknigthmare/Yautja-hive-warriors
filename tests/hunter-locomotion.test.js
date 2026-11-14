import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HunterLocomotion } from '../js/graphics/HunterLocomotion.js';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';

const close = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
function fixture() {
  const owner = { mesh: new THREE.Group(), position: new THREE.Vector3(), moveSpeed: 16, hp: 1000 };
  for (const [name, x] of [['leftLeg', -0.2], ['rightLeg', 0.2]]) {
    const leg = new THREE.Group(); leg.position.set(x, 1, 0); owner.mesh.add(leg); owner[name] = leg;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.5), new THREE.MeshStandardMaterial());
    shoe.position.set(0, -0.9, 0.15); leg.add(shoe);
  }
  for (const [name, x] of [['leftArm', -0.35], ['rightArm', 0.35]]) {
    owner[name] = new THREE.Group(); owner[name].position.set(x, 1.5, 0); owner.mesh.add(owner[name]);
  }
  owner.headMesh = new THREE.Group(); owner.headMesh.position.y = 1.8; owner.mesh.add(owner.headMesh);
  owner.laserGroup = new THREE.Group(); owner.mesh.add(owner.laserGroup);
  const locomotion = new HunterLocomotion(owner);
  const step = (delta, speed = 16) => {
    owner.position.z += speed * delta; owner.mesh.position.copy(owner.position); locomotion.update(delta);
  };
  return { owner, locomotion, step };
}

test('gait phase, transition strength and stops agree at30/60/120fps without wall-clock reads', () => {
  const originalNow = Date.now;
  Date.now = () => { throw new Error('locomotion must use simulation, not wall-clock time'); };
  try {
    const runs = [30, 60, 120].map(fps => {
      const f = fixture();
      for (let frame = 0; frame < fps * 2; frame++) f.step(1 / fps);
      const walking = structuredClone(f.locomotion.state);
      const phase = walking.phase;
      for (let frame = 0; frame < fps / 2; frame++) f.step(1 / fps, 0);
      const stopped = structuredClone(f.locomotion.state);
      close(stopped.phase, phase);
      const result = { walking, stopped, left: f.owner.leftLeg.rotation.x, right: f.owner.rightLeg.rotation.x };
      f.locomotion.dispose(); return result;
    });
    for (const run of runs) {
      close(run.walking.travelledDistance, 32); assert.equal(run.walking.stepCount, 10);
      assert.equal(run.walking.moving, true); assert.equal(run.stopped.moving, false);
      assert.ok(run.stopped.strength < 0.003);
      for (const key of ['phase', 'strength', 'speed', 'runBlend', 'travelledDistance']) close(run.walking[key], runs[0].walking[key]);
      for (const key of ['phase', 'strength', 'runBlend']) close(run.stopped[key], runs[0].stopped[key]);
      close(run.left, runs[0].left); close(run.right, runs[0].right);
    }
  } finally { Date.now = originalNow; }
});

test('actual resolved travel drives steps while blocked movement and teleports do not', () => {
  const f = fixture();
  for (let frame = 0; frame < 30; frame++) {
    const previous = f.owner.position.clone();
    f.owner.position.z += 16 / 60; // Input requests movement.
    f.owner.position.copy(previous); // World collision rejects it before Player.update.
    f.locomotion.update(1 / 60);
  }
  assert.equal(f.locomotion.state.travelledDistance, 0);
  assert.equal(f.locomotion.state.stepCount, 0);
  assert.equal(f.locomotion.state.moving, false);
  f.owner.position.set(120, 0, -50); f.locomotion.update(1 / 60);
  assert.equal(f.locomotion.state.teleports, 1);
  assert.equal(f.locomotion.state.travelledDistance, 0);
  f.step(1 / 60);
  assert.equal(f.locomotion.state.moving, true);
  close(f.locomotion.state.travelledDistance, 16 / 60);
});

test('zero, negative and invalid simulation steps leave gait, rendered pose and contact unchanged', () => {
  const f = fixture(); f.step(0.1);
  const state = structuredClone(f.locomotion.state), matrix = f.owner.leftLeg.quaternion.toArray();
  const offset = f.locomotion.visualRoot.position.y;
  for (const delta of [0, -0.1, NaN, Infinity]) assert.equal(f.locomotion.update(delta), false);
  assert.deepEqual(f.locomotion.state, state);
  assert.deepEqual(f.owner.leftLeg.quaternion.toArray(), matrix);
  assert.equal(f.locomotion.visualRoot.position.y, offset);
});

test('measured procedural soles contact the ground across the gait without moving actor/camera anchors or changing surfaces', () => {
  const f = fixture(), geometries = [], materialData = [];
  f.owner.mesh.traverse(node => { if (node.isMesh) { geometries.push(node.geometry.toJSON()); materialData.push(node.material.toJSON()); } });
  const offsets = [];
  for (let frame = 0; frame < 180; frame++) {
    f.step(1 / 60);
    f.owner.mesh.updateMatrixWorld(true);
    let min = Infinity;
    for (const leg of [f.owner.leftLeg, f.owner.rightLeg]) min = Math.min(min, new THREE.Box3().setFromObject(leg).min.y);
    close(min, f.owner.position.y, 1e-7);
    assert.equal(f.owner.position.y, 0); assert.equal(f.owner.mesh.position.y, 0);
    close(f.owner.laserGroup.position.y, f.locomotion.visualRoot.position.y);
    close(f.locomotion.state.supportMinimumY, 0);
    assert.ok(Math.abs(f.locomotion.state.visualOffsetY) <= 0.15);
    offsets.push(f.locomotion.state.visualOffsetY);
  }
  assert.ok(Math.max(...offsets) - Math.min(...offsets) > 0.01, 'contact responds to actual posed soles');
  assert.equal(f.locomotion.diagnostics.contactRefusals, 0);
  let index = 0;
  f.owner.mesh.traverse(node => { if (node.isMesh) { assert.deepEqual(node.geometry.toJSON(), geometries[index]); assert.deepEqual(node.material.toJSON(), materialData[index++]); } });
});

test('arm swing yields to attacks, guard and externally authored gadget poses then resumes smoothly', () => {
  const f = fixture(); for (let i = 0; i < 20; i++) f.step(1 / 60);
  assert.ok(Math.abs(f.owner.rightArm.rotation.x) > 0.01);
  f.owner.isAttacking = true; f.owner.rightArm.rotation.set(-1.1, 0.45, 0);
  const attack = f.owner.rightArm.quaternion.clone(); f.step(1 / 60);
  assert.ok(f.owner.rightArm.quaternion.angleTo(attack) < 1e-10);
  f.owner.isAttacking = false; f.owner.rightArm.rotation.set(-0.8, -0.4, 0);
  const gadget = f.owner.rightArm.quaternion.clone(); f.step(1 / 60);
  assert.ok(f.owner.rightArm.quaternion.angleTo(gadget) < 1e-10, 'timer-owned poses do not need a special animation flag');
  f.owner.rightArm.rotation.set(0, 0, 0); f.step(1 / 60);
  assert.ok(Math.abs(f.owner.rightArm.rotation.x) > 0.01);
  f.owner.isBlocking = true; f.owner.leftArm.rotation.x = -0.7;
  f.step(1 / 60); close(f.owner.leftArm.rotation.x, -0.7);
});

test('airborne/perched states and imported rigs do not acquire procedural root compensation', () => {
  const f = fixture(); f.step(0.1);
  f.owner.isLeaping = true; f.owner.position.y = 2; f.step(0.1);
  assert.equal(f.locomotion.state.moving, false); assert.equal(f.locomotion.state.grounded, false);
  assert.equal(f.locomotion.state.visualOffsetY, 0); assert.equal(f.owner.laserGroup.position.y, 0);
  f.owner.isLeaping = false; f.owner.position.y = 0; f.owner._importedCharacter = { adapter: {} }; f.step(0.1);
  assert.equal(f.locomotion.state.visualOffsetY, 0); assert.equal(f.locomotion.visualRoot.position.y, 0);
  f.owner._importedCharacter = { laserBaseY: 0.012, adapter: { visualGroundOffsetY: 0.075 } };
  f.owner.laserGroup.position.y = -0.05;
  f.locomotion.reset(f.owner.position);
  close(f.owner.laserGroup.position.y, 0.087, 1e-12, 'handoff preserves the currently rendered imported emitter height');
  assert.equal(f.locomotion.visualRoot.position.y, 0);
});

test('reset and two co-op controllers retain independent phase, geometry and pose ownership', () => {
  const first = fixture(), second = fixture();
  first.step(0.1); first.step(0.1);
  assert.equal(second.locomotion.state.phase, 0);
  assert.equal(second.owner.leftArm.rotation.x, 0);
  first.locomotion.reset(first.owner.position);
  assert.equal(first.locomotion.state.phase, 0); assert.equal(first.locomotion.state.travelledDistance, 0);
  close(first.owner.leftLeg.rotation.x, 0); assert.equal(first.locomotion.visualRoot.position.y, 0);
  second.step(0.1); assert.ok(second.locomotion.state.travelledDistance > 0);
  first.locomotion.dispose(); assert.equal(first.locomotion.update(0.1), false);
  assert.equal(second.locomotion.state.moving, true);
});

test('real Player procedural contact preserves actor motion and keeps laser and eye at the rendered head', async () => {
  class CpuPlayer extends Player { loadGeneratedVisual() { return Promise.resolve(false); } }
  const player = new CpuPlayer(new THREE.Scene(), CHARACTERS_DATA.find(data => data.id === 'wolf_predator'), new Proxy({}, { get: () => () => {} }));
  await player.generatedVisualReady;
  try {
    for (let frame = 0; frame < 90; frame++) {
      player.move(new THREE.Vector3(0, 0, 1), 1 / 60); player.update(1 / 60);
      player.mesh.updateMatrixWorld(true);
      const min = Math.min(...[player.leftLeg, player.rightLeg].map(leg => new THREE.Box3().setFromObject(leg, true).min.y));
      close(min, 0, 1e-6);
      close(player.cameraEyeHeight, player.headMesh.getWorldPosition(new THREE.Vector3()).y);
      close(player.laserGroup.position.y, player._proceduralMotionRoot.position.y);
      assert.equal(player.position.y, 0);
    }
    close(player.position.z, 17 * 1.5, 1e-6);
    assert.equal(player.locomotion.diagnostics.contactRefusals, 0);
    const emitter = player.laserGroup.children[0];
    const origin = new THREE.Vector3().fromBufferAttribute(emitter.geometry.attributes.position, 0);
    const eyeAtNormalScale = player.cameraEyeHeight;
    const emitterAtNormalScale = emitter.localToWorld(origin.clone()).y;
    player.mesh.scale.setScalar(1.8); player.mesh.updateMatrixWorld(true);
    close(player.cameraEyeHeight, player.headMesh.getWorldPosition(new THREE.Vector3()).y);
    close(player.cameraEyeHeight, eyeAtNormalScale * 1.8);
    close(emitter.localToWorld(origin.clone()).y, emitterAtNormalScale * 1.8);
    player.mesh.scale.setScalar(1);
    const angle = player.rotationY;
    player.move(new THREE.Vector3(1, 0, 0), 0);
    assert.equal(player.rotationY, angle);
    const turns = [30, 60, 120].map(fps => {
      player.rotationY = 0;
      for (let frame = 0; frame < fps; frame++) {
        player.move(new THREE.Vector3(1, 0, 0), 1 / fps);
        assert.ok(player.rotationY >= 0 && player.rotationY <= Math.PI / 2, 'turns cannot overshoot their intended heading');
      }
      return player.rotationY;
    });
    turns.forEach(turn => close(turn, turns[0]));
  } finally { player.dispose(); }
});

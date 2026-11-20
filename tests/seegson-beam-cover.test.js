import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { traceCombatSegment, hasCombatLineOfSight } from '../js/engine/CombatGeometry.js';

const playerSource = fs.readFileSync(new URL('../js/entities/Player.js', import.meta.url), 'utf8');
const start = playerSource.indexOf('  fireSeegsonBoltGun(');
const end = playerSource.indexOf('\n  }', start);
assert.notEqual(start, -1, 'production Seegson method exists');
assert.notEqual(end, -1, 'production Seegson method has an end');
// Run the real weapon method with real Three geometry and combat intersections.
// The scene, effect ownership, clock, audio and UI services are controlled here;
// this verifies mesh coordinates and cleanup delegation, not a WebGL screenshot.
const PlayerActions = vm.runInNewContext(`(class { ${playerSource.slice(start, end + 4)} })`, { THREE });
const wall = (overrides = {}) => ({ x: 0, z: 5, halfWidth: 5, halfDepth: 0.5, height: 4, ...overrides });

function fixture({ colliders = [], position = new THREE.Vector3(), rotation = 0 } = {}) {
  const scene = new THREE.Scene(), effects = [], removed = [], queue = [], traces = [], sounds = [], messages = [];
  const environment = {
    traceSegment(from, to, options) {
      const hit = traceCombatSegment(from, to, colliders, options);
      traces.push({ from: from.clone(), to: to.clone(), options, hit });
      return hit;
    },
    hasLineOfSight(from, to, options) { return hasCombatLineOfSight(from, to, colliders, options); },
  };
  const player = new PlayerActions();
  Object.assign(player, {
    position: position.clone(), rotationY: rotation, seegsonBoltAmmo: 10, seegsonBoltCooldown: 0,
    gameContext: { env: environment }, canUseArsenalEquipment: () => true,
    audioEngine: { playSeegsonBoltGunFire() { sounds.push('seegson'); } },
    schedule(callback, delay) { queue.push({ callback, delay }); },
    _addOwnedEffect(object) { effects.push(object); scene.add(object); },
    _removeOwnedEffect(object) {
      removed.push(object); object.removeFromParent();
      object.geometry.dispose(); object.material.dispose();
    },
  });
  const forward = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation)).normalize();
  const origin = position.clone().add(new THREE.Vector3(0, 2.3, 0));
  const fire = () => player.fireSeegsonBoltGun({ aliens: [] }, { activeBoss: null }, null, null,
    { showAnnouncement(message) { messages.push(message); } });
  return { player, scene, effects, removed, queue, traces, sounds, messages, forward, origin, fire };
}

function near(actual, expected, label, epsilon = 1e-5) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= epsilon,
    `${label}: expected ${expected}, got ${actual}`);
}
function assertShotCost(f) {
  assert.equal(f.player.seegsonBoltAmmo, 9);
  assert.equal(f.player.seegsonBoltCooldown, 1.6);
  assert.deepEqual(f.sounds, ['seegson']);
  assert.match(f.messages.at(-1), /TIR À VIDE.*\(9\/10\)/);
}
function assertBeam(f, length) {
  assert.equal(f.effects.length, 1, 'one beam effect');
  const mesh = f.effects[0];
  assert.ok(mesh.isMesh);
  mesh.updateMatrixWorld(true);
  const expectedCenter = f.origin.clone().addScaledVector(f.forward, length / 2);
  near(mesh.position.distanceTo(expectedCenter), 0, 'beam center');
  const vertices = mesh.geometry.getAttribute('position'), along = [], radii = [];
  for (let i = 0; i < vertices.count; i++) {
    const offset = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).sub(f.origin);
    const distance = offset.dot(f.forward);
    along.push(distance);
    radii.push(offset.addScaledVector(f.forward, -distance).length());
  }
  near(Math.min(...along), 0, 'visible starting cap stays at the muzzle');
  near(Math.max(...along), length, 'visible ending cap stops at the physical limit');
  near(Math.max(...radii), 0.06, 'visible radius');
  assert.equal(mesh.material.color.getHex(), 0xfb923c);
  assert.equal(mesh.material.opacity, 0.95);
  assert.equal(mesh.material.transparent, true);
  return mesh;
}

test('Seegson retains its full visible range, actual muzzle height and shot cost in clear space', () => {
  const f = fixture();
  assert.equal(f.fire(), true);
  assertBeam(f, 38); assertShotCost(f);
});

test('Seegson visible vertices stop at the nearest physical wall, including close or render-hidden cover', () => {
  for (const colliders of [
    [wall({ z: 20 }), wall()],
    [wall({ z: 0.4, halfDepth: 0.05 })],
    [wall({ mesh: { visible: false } })],
  ]) {
    const f = fixture({ colliders }); assert.equal(f.fire(), true);
    assertBeam(f, colliders.length === 1 && colliders[0].z === 0.4 ? 0.29 : 4.44);
    assertShotCost(f);
  }
});

test('Seegson transformed beam endpoints follow the player and real rotated or cylindrical cover', () => {
  const position = new THREE.Vector3(7, 3, -11), rotation = Math.PI / 3;
  const forward = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation));
  const center = position.clone().addScaledVector(forward, 10);
  for (const [collider, expected] of [
    [wall({ x: center.x, z: center.z, baseY: 3, rotation }), 9.44],
    [{ x: center.x, z: center.z, baseY: 3, height: 4, radius: 1 }, 8.94],
  ]) {
    const f = fixture({ colliders: [collider], position, rotation });
    assert.equal(f.fire(), true); assertBeam(f, expected);
  }
});

test('Seegson beam respects its real height and radius beside floors and overhead cover', () => {
  for (const [collider, expected] of [
    [wall({ height: 2.2 }), 38],
    [wall({ height: 2.27 }), 4.44],
    [wall({ baseY: 2.33, height: 1 }), 4.44],
    [wall({ baseY: 2.37, height: 1 }), 38],
  ]) {
    const f = fixture({ colliders: [collider] });
    assert.equal(f.fire(), true); assertBeam(f, expected);
  }
});

test('Seegson visible radius cannot pass through cover missed by its center line', () => {
  for (const [x, expected] of [[0.54, 4.44], [0.57, 38]]) {
    const collider = wall({ x, halfWidth: 0.5 });
    assert.equal(traceCombatSegment(new THREE.Vector3(0, 2.3, 0), new THREE.Vector3(0, 2.3, 38), [collider]), null);
    const f = fixture({ colliders: [collider] });
    assert.equal(f.fire(), true); assertBeam(f, expected);
  }
});

test('Seegson keeps full range past distant, disabled, nonblocking or destroyed cover', () => {
  for (const collider of [
    wall({ z: 39 }), wall({ enabled: false }), wall({ solid: false }),
    wall({ blocksProjectiles: false }), wall({ projectileBlocker: false }),
    wall({ isCollisionActive: () => false }),
  ]) {
    const f = fixture({ colliders: [collider] });
    assert.equal(f.fire(), true); assertBeam(f, 38); assertShotCost(f);
  }
});

test('Seegson accepts a physical custom collider that reports only a normalized hit fraction', () => {
  const collider = { resolveMovement() {}, traceSegment: () => ({ t: 0.25 }) };
  const f = fixture({ colliders: [collider] });
  assert.equal(f.fire(), true); assertBeam(f, 9.5);
  assert.equal(f.traces[0].hit.distance, undefined);
  assert.equal(f.traces[0].hit.point, undefined);
});

test('Seegson does not allocate a visible beam or cleanup timer when its muzzle is inside cover', () => {
  const f = fixture({ colliders: [wall({ z: 0 })] });
  assert.equal(f.fire(), true); assertShotCost(f);
  assert.equal(f.effects.length, 0);
  assert.equal(f.queue.length, 0);
  assert.equal(f.traces[0].hit.t, 0);
});

test('Seegson cleans only its own beam after 180ms and cannot repeat cleanup after early removal', () => {
  for (const early of [false, true]) {
    const f = fixture({ colliders: [wall()] }); assert.equal(f.fire(), true);
    const mesh = f.effects[0], unrelated = new THREE.Object3D(); f.scene.add(unrelated);
    let geometryDisposals = 0, materialDisposals = 0;
    mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
    mesh.material.addEventListener('dispose', () => materialDisposals++);
    assert.equal(f.queue.length, 1); assert.equal(f.queue[0].delay, 180);
    if (early) f.player._removeOwnedEffect(mesh);
    f.queue[0].callback();
    assert.equal(mesh.parent, null); assert.equal(unrelated.parent, f.scene);
    assert.deepEqual(f.removed, [mesh]);
    assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
    assertShotCost(f);
  }
});

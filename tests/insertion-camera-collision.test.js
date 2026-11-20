import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { DropPodEntrance } from '../js/entities/DropPodEntrance.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { cameraNearPlaneRadius, resolveThirdPersonCamera } from '../js/engine/CameraCollision.js';

// Exercise the actual application methods without its DOM/WebGL constructor.
const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const GameApp = vm.runInNewContext(`${source.slice(source.indexOf('class GameApp'), source.indexOf("window.addEventListener('DOMContentLoaded'"))};GameApp`,
  { THREE, cameraNearPlaneRadius, resolveThirdPersonCamera });

function actor(x) {
  const mesh = new THREE.Group(); mesh.position.x = x;
  return { mesh, position: mesh.position.clone(), rotationY: 0 };
}
function podModel() {
  return { group: new THREE.Group(), seatPosition: new THREE.Vector3(), exitPosition: new THREE.Vector3(0, 0, 4.2), updateOpening() {} };
}
function fixture(environment, cooperative = true) {
  const game = Object.create(GameApp.prototype);
  Object.assign(game, { env: environment, player: actor(0), player2: cooperative ? actor(6) : null,
    isPlaying: true, isPaused: false, photoMode: { isActive: false }, weaponWheel: { isOpen: false },
    renderer: { camera: new THREE.PerspectiveCamera(56, 16 / 9, .15, 600), cameraP2: new THREE.PerspectiveCamera(56, 8 / 9, .15, 600) },
    weather: { update() {} }, particles: { update() {} },
    ui: { updateHUD() {}, updateBattlefieldHUD() {} }, apc: { getSupportState() {} }, dropship: { getSupportState() {} },
    updateInsertionStatus() {} });
  game.dropPod = new DropPodEntrance(new THREE.Scene(), null, null, { modelFactory: podModel });
  game.dropPod.triggerDrop(new THREE.Vector3(), null, { players: [game.player, game.player2].filter(Boolean) });
  game.updateInsertionPresentation(0, true);
  return game;
}
function assertClear(game, index) {
  const camera = index ? game.renderer.cameraP2 : game.renderer.camera;
  const focus = game._insertionCameraFocus[index];
  const result = resolveThirdPersonCamera(focus, camera.position, game.env, { radius: cameraNearPlaneRadius(camera) });
  assert.equal(result.collided, false, `P${index + 1} insertion camera crosses ${result.hit?.collider.owner} in ${game.dropPod.phase} at ${game.dropPod.elapsed}`);
}

test('actual co-op insertion camera resolves the Val Verde canopy during opening and exit', () => {
  const environment = new EnvironmentManager(new THREE.Scene());
  environment.buildLevelEnvironment({ ...LEVELS_DATA.find(level => level.id === 'val_verde_jungle'), strategicMode: true, mapSeed: 1 });
  const game = fixture(environment);
  let openingFrames = 0, exitFrames = 0;
  try {
    for (let frame = 0; frame < 320 && game.dropPod.isActive; frame++) {
      game.update(1 / 60);
      for (const index of [0, 1]) assertClear(game, index);
      if (game.dropPod.phase === 'opening') openingFrames++;
      if (game.dropPod.phase === 'exiting') exitFrames++;
    }
    assert.ok(openingFrames > 60 && exitFrames > 60);
    assert.equal(game.dropPod.phase, 'complete');
    assert.equal(game.player.mesh.visible, true); assert.equal(game.player2.mesh.visible, true);
    assert.deepEqual(game.player.position.toArray(), [0, 0, 4.2]);
    assert.deepEqual(game.player2.position.toArray(), [6, 0, 4.2]);
    assert.notEqual(game.renderer.camera.position.x, game.renderer.cameraP2.position.x);
    assert.equal(environment.canopyBoughHighways[2].mesh.visible, true, 'physical resolution preserves the rendered bough');
  } finally { game.dropPod.clear(); environment.clearEnvironment(); }
});

test('pause and photo mode freeze both insertion cameras and the same capsule clock', () => {
  const environment = { colliders: [{ x: 10, z: 8, halfWidth: 4, halfDepth: .4, height: 20, owner: 'test-wall' }] };
  const game = fixture(environment);
  try {
    game.update(.5);
    const before = [game.renderer.camera.position.toArray(), game.renderer.cameraP2.position.toArray()];
    const focus = game._insertionCameraFocus.map(value => value.toArray()), elapsed = game.dropPod.elapsed;
    game.isPaused = true; game.update(1);
    assert.equal(game.dropPod.elapsed, elapsed);
    assert.deepEqual([game.renderer.camera.position.toArray(), game.renderer.cameraP2.position.toArray()], before);
    game.isPaused = false; game.photoMode.isActive = true; game.update(1);
    assert.equal(game.dropPod.elapsed, elapsed);
    assert.deepEqual(game._insertionCameraFocus.map(value => value.toArray()), focus);
    assert.deepEqual([game.renderer.camera.position.toArray(), game.renderer.cameraP2.position.toArray()], before);
    game.photoMode.isActive = false; game.update(.5);
    assert.equal(game.dropPod.elapsed, elapsed + .5);
    for (const index of [0, 1]) assertClear(game, index);
  } finally { game.dropPod.clear(); }
});

test('an idle insertion cannot overwrite either ordinary or photo camera', () => {
  const game = fixture({ colliders: [] });
  game.dropPod.clear();
  const first = game.renderer.camera.position.clone(), second = game.renderer.cameraP2.position.clone();
  game.updateInsertionPresentation(1, true);
  assert.deepEqual(game.renderer.camera.position.toArray(), first.toArray());
  assert.deepEqual(game.renderer.cameraP2.position.toArray(), second.toArray());
});

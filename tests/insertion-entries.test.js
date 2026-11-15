import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DropPodEntrance, INSERTION_TIMING } from '../js/entities/DropPodEntrance.js';
import { InsertionEffects } from '../js/entities/InsertionEffects.js';
import { createScoutShipModel, createBeamModel, SCOUT_HOVER } from '../js/graphics/InsertionVariants.js';
import { createDropPodModel } from '../js/graphics/SupportModels.js';
import { disposeObject } from '../js/engine/SceneResources.js';

/* Three entries (pod, Wolf's scout ship, mothership beam) share one timeline and never touch the
 * gameplay: the hunter ends at the exit, uncloaked, and the effects leave nothing behind. */
const TOTAL = INSERTION_TIMING.descending + INSERTION_TIMING.settling + INSERTION_TIMING.opening + INSERTION_TIMING.exiting;
function fakePlayer() {
  const mesh = new THREE.Group();
  return { mesh, position: new THREE.Vector3(), rotationY: 0, isCloaked: false, kitLocks: null, cloakToggles: 0,
    toggleCloak() { this.isCloaked = !this.isCloaked; this.cloakToggles++; return this.isCloaked; }, locomotion: { reset() {} } };
}

for (const entry of ['pod', 'scout', 'beam']) {
  test(`${entry}: same timeline, hunter set down at the exit, cloaked exit undone, effects cleared`, () => {
    const scene = new THREE.Scene(), shakes = [];
    const effects = new InsertionEffects(scene, null, { onShake: (...args) => shakes.push(args) });
    const insertion = new DropPodEntrance(scene, null, null, { effects });
    const player = fakePlayer(); let done = 0;
    insertion.triggerDrop(new THREE.Vector3(), () => done++, { players: [player], entry, biome: 'snow', cinematic: true });
    assert.equal(insertion.entry, entry);
    let sawCloak = false;
    for (let t = 0; t < TOTAL + .1; t += 1 / 60) { insertion.update(1 / 60); sawCloak ||= player.isCloaked; }
    assert.equal(done, 1); assert.equal(insertion.phase, 'complete');
    assert.ok(sawCloak, 'the hunter leaves cloaked');
    assert.equal(player.isCloaked, false, 'and decloaks once clear');
    assert.equal(shakes.length, 1, 'one touchdown shake');
    const exit = insertion.pods[0].model.exitPosition;
    assert.ok(player.position.distanceTo(exit) < 1e-6, 'the hunter stands at the exit');
    assert.ok(scene.getObjectByName('insertion-effects'));
    insertion.clear();
    assert.equal(scene.getObjectByName('insertion-effects'), undefined, 'effects disposed with the insertion');
  });
}

test('without cinematics the sequence is the plain one: no cloak, no effects, the drop pod', () => {
  const scene = new THREE.Scene(), insertion = new DropPodEntrance(scene, null, null, { effects: new InsertionEffects(scene) });
  const player = fakePlayer();
  insertion.triggerDrop(new THREE.Vector3(), null, { players: [player], entry: 'pod', cinematic: false });
  for (let t = 0; t < TOTAL + .1; t += 1 / 60) insertion.update(1 / 60);
  assert.equal(player.cloakToggles, 0);
  assert.equal(scene.getObjectByName('insertion-effects'), undefined);
  insertion.clear();
});

test('an Unblooded who has not learned the cloak exits visible', () => {
  const scene = new THREE.Scene(), insertion = new DropPodEntrance(scene, null, null, { effects: new InsertionEffects(scene) });
  const player = fakePlayer(); player.kitLocks = { cloak: true };
  insertion.triggerDrop(new THREE.Vector3(), null, { players: [player], entry: 'beam', cinematic: true });
  for (let t = 0; t < TOTAL + .1; t += 1 / 60) insertion.update(1 / 60);
  assert.equal(player.cloakToggles, 0);
  insertion.clear();
});

test('the scout ship hovers clear of a tall hunter and leaves; the beam neither falls nor blocks', () => {
  const scout = createScoutShipModel();
  scout.group.updateMatrixWorld(true);
  const belly = new THREE.Box3().setFromObject(scout.visual).min.y;
  assert.ok(belly - scout.seatPosition.y >= 4.3, `a 4.3 m hunter fits under the belly (${(belly - scout.seatPosition.y).toFixed(2)} m)`);
  assert.equal(scout.noCollision, true); assert.ok(SCOUT_HOVER > 8);
  scout.updateDeparture(3); assert.ok(scout.visual.position.y > SCOUT_HOVER + 10, 'it climbs away');
  const beam = createBeamModel();
  assert.equal(beam.anchored, true); assert.equal(beam.noCollision, true);
  beam.setPower(1); beam.setPower(0);
  for (const model of [scout, beam]) { assert.equal(model.group.userData.insertionVariant.fidelity1to1Verified, false); disposeObject(model.group); }
  const pod = createDropPodModel();
  assert.equal(pod.group.userData.insertionPod.detail.tailBlades, 3);
  assert.equal(pod.group.userData.insertionPod.detail.filmPropFidelity1to1Verified, false);
  disposeObject(pod.group);
});

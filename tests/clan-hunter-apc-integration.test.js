import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { YautjaAlliesManager } from '../js/entities/YautjaAllies.js';
import { APCVehicle } from '../js/entities/APCVehicle.js';
import { getClanHunterVisualState } from '../js/graphics/ClanHunterModel.js';
import { configureSupportFixture } from './helpers/finite-support-fixture.js';

test('an ally blocked by the real M577 does not stride before the final collision pass, even when frame durations vary', () => {
  const scene = new THREE.Scene(), allies = new YautjaAlliesManager(scene, {});
  const apc = configureSupportFixture(new APCVehicle(scene, null, null));
  try {
    assert.equal(apc.spawn(new THREE.Vector3()), true);
    allies.spawnSquad(new THREE.Vector3(), 1);
    const actor = allies.allies[0]; actor.mesh.position.set(0, 0, -6.06);
    apc.resolveMovement(actor.mesh.position, actor.radius);
    const contact = actor.mesh.position.clone(), destination = new THREE.Vector3(0, 0, 20);
    allies.updateVisuals(.016);
    let previous = getClanHunterVisualState(actor.mesh);
    for (const delta of [.016, .1, .016, .033, .016, .05]) {
      allies.update(delta, destination, { aliens: [] });
      assert.ok(actor.mesh.position.z > contact.z, 'navigation attempted a real step toward the player');
      assert.deepEqual(getClanHunterVisualState(actor.mesh), previous, 'navigation does not advance the visual before final contacts');
      // This matches main.js: manager AI, final physical contacts, visual pose.
      apc.resolveMovement(actor.mesh.position, actor.radius);
      assert.ok(actor.mesh.position.distanceTo(contact) < 1e-9, 'the physical carrier rejects the entire step');
      allies.updateVisuals(delta);
      const current = getClanHunterVisualState(actor.mesh);
      assert.equal(current.phase, previous.phase, 'zero final displacement cannot generate a footstep');
      assert.equal(current.stride, 0);
      assert.ok(Math.abs(current.time - previous.time - delta) < 1e-10, 'one final visual pass advances the idle clock exactly once');
      for (const child of actor.mesh.children) if (child.morphTargetInfluences) assert.ok(child.morphTargetInfluences.every(weight => weight === 0));
      previous = current;
    }
  } finally { allies.clearSquad(); apc.clear(); }
});

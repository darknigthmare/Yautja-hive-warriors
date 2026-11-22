import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../js/entities/Player.js';
import { GENERATED_ASSETS } from '../js/graphics/GeneratedAssetManifest.js';

// The four hunters with a separate biomask take it off for an execution and put it back.
test('a separate biomask comes off for its duration and returns', () => {
  const root = new THREE.Group(), hunter = { _importedCharacter: { biomask: { root } } };
  assert.equal(Player.prototype.unmaskFor.call(hunter, 2), true);
  assert.equal(Player.prototype.isUnmasked.call(hunter), true);
  // The countdown lives at the top of Player.update; replay it on the fake hunter.
  const tick = delta => { if (hunter.biomaskOffTimer > 0 && (hunter.biomaskOffTimer -= delta) <= 0) { hunter.biomaskOffTimer = 0; root.visible = true; } };
  tick(1); assert.equal(root.visible, false); tick(1.1); assert.equal(root.visible, true);
  assert.equal(Player.prototype.unmaskFor.call({ _importedCharacter: { biomask: null } }, 2), false, 'a built-in mask cannot come off');
});

test('Wolf, Alpha, Samurai and Viking wear a calibrated separate mask on a maskless body', () => {
  for (const key of ['wolf_predator', 'alpha_predator', 'samurai_predator', 'viking_predator']) {
    const entry = GENERATED_ASSETS[key], mask = entry.characterRig.biomask;
    assert.match(entry.url, /unmasked-rigged\.glb$/);
    assert.equal(mask.calibrated, true); assert.equal(mask.bone, 'Head'); assert.equal(mask.assetKey, `${key}_biomask`);
    assert.equal(GENERATED_ASSETS[mask.assetKey].status, 'verified');
    assert.ok(mask.scale.every(value => value > 0));
  }
});

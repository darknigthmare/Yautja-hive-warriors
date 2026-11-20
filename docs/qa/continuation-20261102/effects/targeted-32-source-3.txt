import test from 'node:test';
import assert from 'node:assert/strict';
import { TemporaryCombatEffects } from '../js/engine/TemporaryCombatEffects.js';

test('a zero-speed environmental hold expires to the other hunter slow, then to the exact base speed', () => {
  const hunter = new TemporaryCombatEffects(), environment = new TemporaryCombatEffects(), actor = { hp: 100, speed: 13.7 };
  assert.equal(hunter.slow(actor, 'neurotoxin', .7, 8), true);
  assert.equal(environment.slow(actor, 'cryogenic', 0, 2), true); assert.equal(actor.speed, 0);
  hunter.update(1); environment.update(0); assert.equal(actor.speed, 0, 'a paused update cannot release an immobilization');
  environment.update(2.01); assert.equal(actor.speed, 13.7 * .7);
  assert.equal(environment.targets.size, 0);
  hunter.update(7.01); assert.equal(actor.speed, 13.7); assert.equal(hunter.targets.size, 0);
});

test('disposing either overlapping owner preserves the remaining zero-speed hold or slow', () => {
  for (const first of ['hunter', 'environment']) {
    const hunter = new TemporaryCombatEffects(), environment = new TemporaryCombatEffects(), actor = { hp: 100, speed: 19.25 };
    hunter.slow(actor, 'emp', .3, 4); environment.slow(actor, 'nitrogen', 0, 3);
    if (first === 'hunter') {
      hunter.dispose(); assert.equal(actor.speed, 0); environment.dispose();
    } else {
      environment.dispose(); assert.equal(actor.speed, 19.25 * .3); hunter.dispose();
    }
    assert.equal(actor.speed, 19.25); assert.equal(hunter.targets.size + environment.targets.size, 0);
  }
});

test('a phase speed authored during a zero-speed hold becomes the restored base, without divide-by-zero', () => {
  const effects = new TemporaryCombatEffects(), actor = { hp: 100, speed: 11 };
  effects.slow(actor, 'cryogenic', 0, 2); actor.speed = 17;
  effects.update(.5); assert.equal(actor.speed, 0);
  effects.update(1.6); assert.equal(actor.speed, 17); assert.equal(effects.targets.size, 0);
  assert.equal(effects.slow(actor, 'invalid', -.01, 1), false);
  assert.equal(effects.slow(actor, 'invalid', 0, Infinity), false);
});

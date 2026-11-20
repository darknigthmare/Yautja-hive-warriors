import test from 'node:test';
import assert from 'node:assert/strict';
import { HUNTER_MUSOU_PROFILES, hunterMusouProfile, musouCovers } from '../js/data/hunterMusouProfiles.js';
import { HUNTER_COMBAT_STYLES } from '../js/data/hunterCombatStyles.js';

test('each playable hunter has its own Musou, marked as an adaptation', () => {
  assert.deepEqual(Object.keys(HUNTER_MUSOU_PROFILES).sort(), Object.keys(HUNTER_COMBAT_STYLES).sort());
  const names = new Set(Object.values(HUNTER_MUSOU_PROFILES).map(item => item.name));
  assert.equal(names.size, 7);
  for (const musou of Object.values(HUNTER_MUSOU_PROFILES)) {
    assert.equal(musou.status, 'original_gameplay_adaptation');
    assert.equal(musou.fidelity1to1Verified, false);
    assert.ok(['nova', 'cone', 'line'].includes(musou.shape));
    assert.ok(musou.damage > 0 && musou.bossDamage > 0 && musou.range > 0);
  }
  assert.equal(hunterMusouProfile('unknown'), HUNTER_MUSOU_PROFILES.jungle_hunter);
});

test('Musou shapes only cover targets inside them', () => {
  const origin = { x: 0, z: 0 }, facing = { x: 0, z: 1 };
  const nova = HUNTER_MUSOU_PROFILES.jungle_hunter;
  assert.equal(musouCovers(nova, origin, facing, { x: 0, z: -30 }), true);
  assert.equal(musouCovers(nova, origin, facing, { x: 0, z: -45 }), false);

  const cone = HUNTER_MUSOU_PROFILES.wolf_predator;
  assert.equal(musouCovers(cone, origin, facing, { x: 5, z: 30 }), true);
  assert.equal(musouCovers(cone, origin, facing, { x: 30, z: 5 }), false, 'outside the cone angle');
  assert.equal(musouCovers(cone, origin, facing, { x: 0, z: -10 }), false, 'behind the hunter');

  const line = HUNTER_MUSOU_PROFILES.feral_predator;
  assert.equal(musouCovers(line, origin, facing, { x: 2, z: 25 }), true);
  assert.equal(musouCovers(line, origin, facing, { x: 8, z: 25 }), false, 'beside the charge lane');
  assert.equal(musouCovers(line, origin, facing, { x: 0, z: -8 }), false, 'behind the charge');
  assert.equal(musouCovers(line, origin, facing, { x: 0, z: 0.5 }), true, 'a target touching the hunter is always hit');
});

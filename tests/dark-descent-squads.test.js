import test from 'node:test';
import assert from 'node:assert/strict';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { sourceUnitVisualKind } from '../js/data/SourceActorPresentation.js';

/* CTRL-084: AFF-25's Dark Descent squads carry the game's five classes instead of generic soldiers. */
test('AFF-25 squads are Sergeant, Gunner, Medic and an alternating Tecker or Recon', () => {
  const config = getBattleOperationConfig('AFF-25', { allowHumanController: true }), profiles = new Map(config.profiles.map(profile => [profile.id, profile]));
  const squads = config.groups.filter(group => group.sourceTemplateIds.includes('GRP-53'));
  assert.equal(squads.length, 8);
  const roles = squads.map(group => group.units.map(unit => profiles.get(unit.profileId).sourceRole));
  for (const [index, row] of roles.entries()) assert.deepEqual(row, ['Sergeant', 'Gunner', 'Medic', index % 2 ? 'Recon (rifle proxy)' : 'Tecker (repair proxy)']);
  const classes = new Set(roles.flat().map(role => role.split(' ')[0]));
  assert.deepEqual([...classes].sort(), ['Gunner', 'Medic', 'Recon', 'Sergeant', 'Tecker']);
  const first = squads[0].units.map(unit => ({ ...unit, species: 'human', actorType: profiles.get(unit.profileId).actorType }));
  assert.deepEqual(first.map(unit => sourceUnitVisualKind(unit)), [null, null, 'medic', 'commtech']);
  assert.equal(profiles.get(first[1].profileId).actorType, 'smartgunner');
  assert.equal(profiles.get(first[0].profileId).catalogueProfileId, 'HUM-004');
  assert.equal(squads.flatMap(group => group.units).length, 32, 'the same 32 allocated places');
});

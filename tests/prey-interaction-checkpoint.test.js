import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { prepareSarii, orderSarii, damageSarii } from '../js/entities/SariiCompanion.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';

const LEVEL = 'prey_comanche_territory', clone = value => JSON.parse(JSON.stringify(value));
function fixture(prey = true) {
  const environment = new EnvironmentManager(new THREE.Scene()), first = { hp: 800, maxHp: 1000, position: new THREE.Vector3(), taabeArrowAmmo: 0, naruAxeCharges: 0 };
  const second = { ...first, isPlayer2: true, position: new THREE.Vector3() };
  environment.referenceProfile = { id: prey ? LEVEL : 'LD-20' }; environment.game = { player: first, player2: second };
  if (prey) {
    for (const name of ['orangeFlowerPatch', 'adoliniPistolPedestal', 'taabeRockPerch', 'grizzlyBearCarcass', 'naruTomahawkTree', 'trapperMedicalTent', 'feralArsenalStation', 'trapperBaitTree', 'trapperCampfireSpit']) environment[name] = { pos: new THREE.Vector3(), group: new THREE.Group() };
    environment.boneMaskDecoy = { pos: new THREE.Vector3(), group: new THREE.Group(), lasers: [], isArmed: false, armedRemaining: 0 };
    environment.sariiCompanion = prepareSarii({ pos: new THREE.Vector3(1, .45, 0), group: new THREE.Group(), isTamed: false });
    environment.preyMudSinkhole = { pos: new THREE.Vector3(), radius: 5.5, bubbles: [] };
  }
  return { environment, first, second };
}

test('consumed pickups and cauldron survive a reconstructed scene without refunds, inventory gains or replayed damage', () => {
  const { environment, first } = fixture();
  for (const [name, flag] of [['orangeFlowerPatch','isHarvested'],['adoliniPistolPedestal','isClaimed'],['taabeRockPerch','isClaimed'],['grizzlyBearCarcass','isSkinned'],['naruTomahawkTree','isClaimed'],['trapperMedicalTent','isLooted'],['feralArsenalStation','isClaimed'],['trapperCampfireSpit','isToppled']]) environment[name][flag] = true;
  const saved = clone(environment.serializePreyInteractions()), resumed = fixture(), inventory = clone(resumed.first);
  assert.equal(resumed.environment.restorePreyInteractions(saved), true);
  assert.equal(resumed.environment.checkOrangeFlowerInteraction(resumed.first), false);
  assert.equal(resumed.environment.checkAdoliniPistolInteraction(resumed.first), false);
  assert.equal(resumed.environment.checkTaabeWarBowInteraction(resumed.first), false);
  assert.equal(resumed.environment.checkGrizzlyBearTrophyInteraction(resumed.first), false);
  assert.equal(resumed.environment.checkNaruTomahawkInteraction(resumed.first), false);
  assert.equal(resumed.environment.checkTrapperMedicalTentInteraction(resumed.first), false);
  assert.equal(resumed.environment.checkFeralArsenalInteraction(resumed.first), false);
  assert.equal(resumed.environment.checkTrapperCampfireInteraction(resumed.first), false);
  assert.deepEqual(clone(resumed.first), inventory); assert.equal(first.taabeArrowAmmo, 0);
  // Loading a prior unused snapshot into an already-used scene cannot reopen it.
  assert.equal(resumed.environment.restorePreyInteractions(fixture().environment.serializePreyInteractions()), true);
  assert.equal(resumed.environment.orangeFlowerPatch.isHarvested, true);
});

test('powder fire restores only its remaining lifetime and damage, never the blast or an exhausted fire', () => {
  const { environment, first } = fixture(), horde = new XenomorphHorde(new THREE.Scene(), {});
  const target = { hp: 10000, type: 'warrior', mesh: new THREE.Group() }; target.mesh.position.set(0, 0, 4); horde.aliens.push(target);
  environment.checkTrapperBaitTreeInteraction(first, null, null, horde); environment.updateLevelDesignV56(7, first, horde);
  assert.equal(target.hp, 8480); const saved = clone(environment.serializePreyInteractions()); assert.equal(saved.fire.remaining, 11);
  const resumed = fixture(); const before = target.hp;
  assert.equal(resumed.environment.restorePreyInteractions(saved), true); assert.equal(target.hp, before);
  assert.equal(resumed.environment.activePowderKegFire.timer, 11); assert.equal(resumed.environment.checkTrapperBaitTreeInteraction(resumed.first, null, null, horde), false);
  resumed.environment.updateLevelDesignV56(1, resumed.first, horde); assert.equal(target.hp, before - 110);
  assert.equal(resumed.environment.restorePreyInteractions(saved), true); assert.equal(resumed.environment.activePowderKegFire.timer, 10);
  resumed.environment.updateLevelDesignV56(99, resumed.first, horde); assert.equal(target.hp, before - 1210);
  assert.equal(resumed.environment.activePowderKegFire, null); resumed.environment.restorePreyInteractions(saved); assert.equal(resumed.environment.activePowderKegFire, null);
  assert.equal(resumed.first.taabeArrowAmmo, 0); environment.clearEnvironment(); resumed.environment.clearEnvironment(); horde.clearWave();
});

test('Sarii keeps the second owner, order, wounds and cooldown without healing, recruiting again or transferring ownership', () => {
  const { environment, second } = fixture(); orderSarii(environment, second, 'guard'); damageSarii(environment, 100);
  environment.sariiCompanion.biteCooldown = .2; environment.sariiCompanion.injuryCooldown = .1;
  const saved = clone(environment.serializePreyInteractions()), resumed = fixture();
  assert.equal(resumed.environment.restorePreyInteractions(saved), true);
  const dog = resumed.environment.sariiCompanion;
  assert.equal(dog.owner, resumed.second); assert.equal(dog.isTamed, true); assert.equal(dog.hp, 20); assert.equal(dog.order, 'retreat');
  assert.equal(dog.withdrawals, 1); assert.equal(dog.biteCooldown, .2); assert.equal(dog.injuryCooldown, .1);
  assert.equal(orderSarii(resumed.environment, resumed.first), false);
  const invalid = clone(saved); invalid.sarii.ownerId = 'player1'; assert.equal(resumed.environment.restorePreyInteractions(invalid), false);
  dog.hp = 10; resumed.environment.restorePreyInteractions(saved); assert.equal(dog.hp, 10);
});

test('expired camouflage is not refreshed while either restored player remains inside the same mud entry', () => {
  const { environment, first, second } = fixture(), coatings = [];
  first.applyPreyMudCamouflage = () => {}; second.applyPreyMudCamouflage = () => {};
  environment.updateLevelDesignV56(.1, first);
  const saved = clone(environment.serializePreyInteractions()); assert.deepEqual(saved.mudEntries, ['player1', 'player2']);
  const resumed = fixture(); resumed.first.applyPreyMudCamouflage = seconds => coatings.push(seconds); resumed.second.applyPreyMudCamouflage = seconds => coatings.push(seconds);
  assert.equal(resumed.environment.restorePreyInteractions(saved), true); resumed.environment.updateLevelDesignV56(.1, resumed.first); assert.deepEqual(coatings, []);
  resumed.first.position.x = 20; resumed.environment.updateLevelDesignV56(.1, resumed.first);
  resumed.first.position.x = 0; resumed.environment.updateLevelDesignV56(.1, resumed.first); assert.deepEqual(coatings, [30]);
});

test('profile, props, ownership and numeric checkpoint defects are rejected atomically before consuming or creating anything', () => {
  const { environment } = fixture(), saved = clone(environment.serializePreyInteractions());
  for (const mutate of [state => state.version++, state => state.sourceLevelId='jungle', state => state.profileId='LD-20',
    state => state.props.taabeRockPerch.present=false, state => state.props.orangeFlowerPatch.consumed='true',
    state => { state.props.trapperBaitTree.consumed=true; state.fire={position:[0,0,0],remaining:19,ownerFaction:'player_clan'}; },
    state => state.sarii.hp=121, state => state.mudEntries=['player3']]) {
    const invalid = clone(saved); mutate(invalid);
    assert.equal(environment.restorePreyInteractions(invalid), false); assert.deepEqual(clone(environment.serializePreyInteractions()), saved);
  }
  const other = fixture(false); assert.equal(other.environment.restorePreyInteractions(saved), false);
  assert.equal(other.environment.restorePreyInteractions(clone(other.environment.serializePreyInteractions())), true);
  assert.equal(environment.restorePreyInteractions(other.environment.serializePreyInteractions()), false);
});

test('checkpoint cancels transient laser guidance like discarded boss projectiles without arming a shot or awarding stock', () => {
  const { environment } = fixture(); environment.boneMaskDecoy.isArmed=true; environment.boneMaskDecoy.armedRemaining=8;
  const saved = clone(environment.serializePreyInteractions()), resumed = fixture();
  let armed = 0; resumed.environment.game.bosses={maskTarget:{life:8},armFeralMaskTrap(){armed++;}};
  assert.equal(resumed.environment.restorePreyInteractions(saved), true);
  assert.equal(resumed.environment.boneMaskDecoy.isArmed,false); assert.equal(resumed.environment.game.bosses.maskTarget,null); assert.equal(armed,0);
  assert.equal(resumed.first.taabeArrowAmmo,0);
});

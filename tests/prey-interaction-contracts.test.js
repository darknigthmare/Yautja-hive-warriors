import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { BossManager } from '../js/entities/Bosses.js';
import { CombatEvents } from '../js/engine/CombatEvents.js';
import { PREY_INTERACTION_RULES as RULES } from '../js/entities/ReferenceEnvironmentMechanisms.js';

const audio = new Proxy({}, { get: () => () => {} });
class CpuBosses extends BossManager { createBossMesh() { return new THREE.Group(); } }
const prop = () => ({ pos: new THREE.Vector3(), group: new THREE.Group() });
const hunter = () => ({ hp: 700, maxHp: 850, position: new THREE.Vector3(), rotationY: 0, factionId: 'player_clan',
  smartDiscCharges: 2, m41aGrenadeCharges: 3, plasmaEnergy: 9, score: 0,
  addScore() { throw new Error('An interaction cannot award nonexistent Player score'); } });
const actor = (x, z, hp = 2000, factionId = 'hostile') => {
  const mesh = new THREE.Group(); mesh.position.set(x, 0, z); return { mesh, hp, maxHp: hp, type: 'warrior', factionId };
};
function fixture() {
  const scene = new THREE.Scene(), environment = new EnvironmentManager(scene), horde = new XenomorphHorde(scene, audio);
  const bosses = new CpuBosses(scene, audio), ledger = new CombatEvents({ runId: 'prey-contract' }), messages = [];
  const simulation = { config: { playerFaction: 'player_clan' }, areHostile: (_, id) => id === 'hostile' };
  environment.game = { battleSimulation: simulation, bosses }; horde.battleSimulation = simulation;
  horde.combatEvents = bosses.combatEvents = ledger;
  return { environment, horde, bosses, ledger, messages, ui: { showAnnouncement: message => messages.push(message) } };
}

test('Adolini uses facing, finite range and the real cover ray; a consumed miss cannot hit a distant boss later', () => {
  for (const [x, z, cover] of [[0, 1000, false], [8, 8, false], [0, -8, false], [0, 10, true]]) {
    const { environment, horde, bosses, ledger } = fixture(), player = hunter();
    environment.adoliniPistolPedestal = prop(); bosses.spawnBoss('feral_predator_boss', new THREE.Vector3(x, 0, z));
    const boss = bosses.activeBoss, initial = boss.hp; boss.factionId = 'hostile';
    if (cover) environment.colliders.push({ x: 0, z: 5, halfWidth: 3, halfDepth: .3, height: 4 });
    assert.equal(environment.checkAdoliniPistolInteraction(player, null, audio, horde, bosses), true);
    assert.equal(boss.hp, initial); assert.equal(ledger.deaths.size, 0);
    boss.mesh.position.set(0, 0, 4);
    assert.equal(environment.checkAdoliniPistolInteraction(player, null, audio, horde, bosses), false);
    assert.equal(boss.hp, initial); bosses.clear();
  }
});

test('Adolini selects the first visible hostile body and routes NPC/boss deaths once through actual managers', () => {
  for (const bossTarget of [false, true]) {
    const { environment, horde, bosses, ledger } = fixture(), player = hunter();
    environment.adoliniPistolPedestal = prop();
    const allied = actor(0, 4, 100, 'friendly'), far = actor(0, 15, 2000);
    horde.aliens.push(allied, far);
    let target;
    if (bossTarget) { bosses.spawnBoss('feral_predator_boss', new THREE.Vector3(0, 0, 8)); target = bosses.activeBoss; target.hp = 600; target.factionId = 'hostile'; }
    else { target = actor(0, 8, 600); horde.aliens.push(target); }
    environment.checkAdoliniPistolInteraction(player, null, audio, horde, bosses);
    assert.equal(target.hp, 0); assert.equal(allied.hp, 100); assert.equal(far.hp, 2000);
    assert.equal(ledger.deaths.size, 1); assert.equal([...ledger.deaths.values()][0].cause, 'adolini_flintlock');
    assert.equal([...ledger.deaths.values()][0].killerFaction, 'player_clan');
    assert.equal(environment.checkAdoliniPistolInteraction(player, null, audio, horde, bosses), false);
    assert.equal(ledger.deaths.size, 1); bosses.clear(); horde.clearWave();
  }
});

test('bow and axe pickups equip their own resource, clamp stocks and preserve refused pickups', () => {
  const { environment, ui, messages } = fixture(), player = hunter(), equipped = [], buffs = [];
  environment.taabeRockPerch = prop(); environment.naruTomahawkTree = prop();
  player.taabeArrowAmmo = 10; player.naruAxeCharges = 3;
  player.equipPreyWeapon = id => { equipped.push(id); return false; };
  player.applyTaabeWarAgility = duration => buffs.push(duration);
  assert.equal(environment.checkTaabeWarBowInteraction(player, ui), true);
  assert.equal(environment.taabeRockPerch.isClaimed, undefined); assert.equal(player.taabeArrowAmmo, 10); assert.deepEqual(buffs, []);
  assert.equal(environment.checkNaruTomahawkInteraction(player, ui), true);
  assert.equal(environment.naruTomahawkTree.isClaimed, undefined); assert.equal(player.naruAxeCharges, 3);
  player.equipPreyWeapon = id => { equipped.push(id); player.activeWeapon = id; return true; };
  environment.checkTaabeWarBowInteraction(player, ui); environment.checkNaruTomahawkInteraction(player, ui);
  assert.equal(player.taabeArrowAmmo, 12); assert.equal(player.naruAxeCharges, 4); assert.deepEqual(buffs, [25]);
  assert.equal(player.activeWeapon, 'naru_axe'); assert.equal(player.smartDiscCharges, 2); assert.equal(player.m41aGrenadeCharges, 3);
  assert.match(messages.at(-2), /\+2 FLÈCHES.*30 %.*25 S/); assert.match(messages.at(-1), /\+1 FRAPPES.*MAXIMUM 4/);
  assert.equal(environment.checkTaabeWarBowInteraction(player), false); assert.equal(environment.checkNaruTomahawkInteraction(player), false);
});

test('flower, grizzly, medicine and Feral rack announce observed bounded resources without score/plasma substitutes', () => {
  const { environment, ui, messages } = fixture(), player = hunter(), flower = [];
  environment.orangeFlowerPatch = prop(); environment.grizzlyBearCarcass = prop();
  environment.trapperMedicalTent = prop(); environment.feralArsenalStation = prop();
  player.applyOrangeFlowerBuff = duration => flower.push(duration); player.shield = 175;
  player.medicompCharges = 5; player.feralBoltAmmo = 9;
  player.canUseArsenalEquipment = () => true;
  player.selectWeapon = id => { player.activeWeapon = id; return true; };
  environment.checkOrangeFlowerInteraction(player, ui); assert.deepEqual(flower, [35]);
  environment.checkGrizzlyBearTrophyInteraction(player, ui); assert.equal(player.hp, 850); assert.match(messages.at(-1), /\+150 PV/);
  player.hp = 700;
  environment.checkTrapperMedicalTentInteraction(player, ui); assert.equal(player.hp, 785); assert.equal(player.medicompCharges, 6);
  environment.checkFeralArsenalInteraction(player, ui); assert.equal(player.activeWeapon, 'crossbow'); assert.equal(player.feralBoltAmmo, 12);
  assert.equal(player.hp, 850); assert.equal(player.shield, 175); assert.match(messages.at(-1), /\+65 PV/);
  assert.equal(player.plasmaEnergy, 9); assert.equal(player.score, 0); assert.equal(player.smartDiscCharges, 2);
  assert.match(messages[0], /ESPÈCE ET TEMPÉRATURE NON CERTIFIÉES/); assert.ok(messages.every(message => !message.includes('SCORE')));
  const refused = hunter(); refused.canUseArsenalEquipment = () => false; environment.feralArsenalStation = prop();
  environment.checkFeralArsenalInteraction(refused, ui); assert.equal(environment.feralArsenalStation.isClaimed, undefined);
});

test('powder blast and fire use distinct radii, actual NPC/boss damage, cover, diplomacy and one ignition', () => {
  const { environment, horde, bosses, ui, messages, ledger } = fixture(), player = hunter();
  environment.trapperBaitTree = prop();
  const inner = actor(0, 5, 3000), outer = actor(0, 12, 2000), beyond = actor(0, 16.1), ally = actor(-4, 0, 2000, 'friendly'), blocked = actor(8, 0);
  horde.aliens.push(inner, outer, beyond, ally, blocked);
  environment.colliders.push({ x: 4, z: 0, halfWidth: .3, halfDepth: 2, height: 4 });
  bosses.spawnBoss('feral_predator_boss', new THREE.Vector3(0, 0, -5)); const boss = bosses.activeBoss; boss.factionId = 'hostile'; const initial = boss.hp;
  assert.equal(environment.checkTrapperBaitTreeInteraction(player, ui, audio, horde, bosses), true);
  assert.equal(inner.hp, 2250); assert.equal(outer.hp, 1250); assert.equal(beyond.hp, 2000); assert.equal(ally.hp, 2000); assert.equal(blocked.hp, 2000);
  assert.equal(boss.hp, initial - 750); assert.match(messages.at(-1), /SOUFFLE 16 U.*FEU 8,5 U.*18 S/);
  environment.updateLevelDesignV56(1, player, horde, bosses);
  assert.equal(inner.hp, 2140); assert.equal(outer.hp, 1250); assert.equal(boss.hp, initial - 860);
  assert.equal(ally.hp, 2000); assert.equal(blocked.hp, 2000); assert.equal(ledger.deaths.size, 0);
  assert.equal(environment.checkTrapperBaitTreeInteraction(player, ui, audio, horde, bosses), false);
  environment.clearEnvironment(); horde.clearWave(); bosses.clear();
});

test('powder fire damage clips the last timestep at expiration at30/60/120Hz and frees its owned mesh', () => {
  for (const hz of [30, 60, 120]) {
    const { environment, horde } = fixture(), player = hunter(), target = actor(0, 5, 10000);
    environment.trapperBaitTree = prop(); horde.aliens.push(target);
    environment.checkTrapperBaitTreeInteraction(player, null, audio, horde);
    const mesh = environment.activePowderKegFire.mesh; let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
    const expected = 10000 - RULES.powderBlastDamage - RULES.powderFireSeconds * RULES.powderFireDamagePerSecond;
    for (let frame = 0; frame < 20 * hz; frame++) environment.updateLevelDesignV56(1 / hz, player, horde);
    assert.ok(Math.abs(target.hp - expected) < 1e-6); assert.equal(environment.activePowderKegFire, null);
    assert.equal(disposed, 1); assert.equal(mesh.parent, null);
    horde.clearWave(); environment.clearEnvironment();
  }
  const { environment, horde } = fixture(), target = actor(0, 5, 10000), player = hunter();
  environment.trapperBaitTree = prop(); horde.aliens.push(target); environment.checkTrapperBaitTreeInteraction(player, null, audio, horde);
  environment.updateLevelDesignV56(99, player, horde); assert.equal(target.hp, 7270); assert.equal(environment.activePowderKegFire, null);
});

test('the cauldron hits actual Horde actor shape and manager death ledger, within7.5U and behind no cover', () => {
  const { environment, horde, bosses, ledger, ui, messages } = fixture(), player = hunter(); environment.trapperCampfireSpit = prop();
  const target = actor(0, 5, 120), far = actor(0, 7.6), ally = actor(-3, 0, 2000, 'friendly'), blocked = actor(6, 0);
  horde.aliens.push(target, far, ally, blocked); environment.colliders.push({ x: 3, z: 0, halfWidth: .3, halfDepth: 2, height: 4 });
  bosses.spawnBoss('feral_predator_boss', new THREE.Vector3(0, 0, -5)); const boss = bosses.activeBoss, before = boss.hp; boss.factionId = 'hostile';
  environment.checkTrapperCampfireInteraction(player, ui, audio, horde);
  assert.equal(target.hp, 0); assert.equal(ledger.deaths.size, 1); assert.equal([...ledger.deaths.values()][0].cause, 'trapper_cauldron');
  assert.equal(far.hp, 2000); assert.equal(ally.hp, 2000); assert.equal(blocked.hp, 2000); assert.equal(boss.hp, before - 500);
  assert.equal(player.hp, 775); assert.match(messages.at(-1), /500.*7,5 U.*\+75 PV/);
  assert.equal(environment.checkTrapperCampfireInteraction(player, ui, audio, horde), false);
  bosses.clear(); horde.clearWave();
});

test('mud is once per actual-volume entry per cooperative player, and pause/zero delta cannot consume or age interactions', () => {
  const { environment, horde } = fixture(), first = hunter(), second = hunter(), coatings = [];
  environment.game.player2 = second;
  first.applyPreyMudCamouflage = seconds => coatings.push(['first', seconds]); second.applyPreyMudCamouflage = seconds => coatings.push(['second', seconds]);
  environment.preyMudSinkhole = { pos: new THREE.Vector3(20, 0, 10), radius: 5.5, bubbles: [] };
  first.position.set(20, 0, 10); second.position.copy(first.position);
  environment.updateLevelDesignV56(0, first, horde); assert.deepEqual(coatings, []);
  environment.game.isPaused = true; environment.updateLevelDesignV56(1, first, horde); assert.deepEqual(coatings, []);
  environment.orangeFlowerPatch = prop(); first.position.set(0, 0, 0); first.applyOrangeFlowerBuff = () => assert.fail('paused buff');
  assert.equal(environment.checkOrangeFlowerInteraction(first), false); assert.equal(environment.orangeFlowerPatch.isHarvested, undefined);
  environment.game.isPaused = false; first.position.set(20, 0, 10); environment.updateLevelDesignV56(1, first, horde);
  assert.deepEqual(coatings, [['first', 30], ['second', 30]]);
  environment.updateLevelDesignV56(60, first, horde); assert.equal(coatings.length, 2, 'expiration while inside never refreshes');
  first.position.x += 10; environment.updateLevelDesignV56(1, first, horde); first.position.x -= 10;
  environment.updateLevelDesignV56(1, first, horde); assert.equal(coatings.length, 3);
  second.position.y = 3; environment.updateLevelDesignV56(1, first, horde); second.position.y = 0;
  environment.updateLevelDesignV56(1, first, horde); assert.equal(coatings.length, 4);
  environment.trapperBaitTree = prop(); first.position.set(0, 0, 0); environment.checkTrapperBaitTreeInteraction(first, null, audio, horde);
  const timer = environment.activePowderKegFire.timer; environment.game.isPaused = true;
  environment.updateLevelDesignV56(60, first, horde); assert.equal(environment.activePowderKegFire.timer, timer);
  environment.game.isPaused = false; environment.updateLevelDesignV56(0, first, horde); assert.equal(environment.activePowderKegFire.timer, timer);
  environment.clearEnvironment();
});

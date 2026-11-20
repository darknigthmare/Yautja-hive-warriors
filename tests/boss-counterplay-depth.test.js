import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BossManager } from '../js/entities/Bosses.js';
import { BossPhasePressure } from '../js/battlefield/BossPhasePressure.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BOSS_REGISTRY } from '../js/data/BossRegistry.js';
import { getBossCombatPattern } from '../js/data/BossCombatPatterns.js';

const audio = new Proxy({}, { get: () => () => {} });
class CombatOnlyManager extends BossManager { createBossMesh() { return new THREE.Group(); } }
const player = position => ({ hp: 10000, position: new THREE.Vector3(...position), mesh: new THREE.Group(), plasmaEnergy: 100, radius: 1,
  hits: [], takeDamage(amount, acid, attacker, context) { this.hp -= amount; this.hits.push({ amount, acid, type: attacker?.type, ...context }); } });
const tick = (manager, target, seconds) => { for (let frame = 0; frame < Math.round(seconds * 60); frame++) manager.update(1 / 60, target); };
const spawn = type => { const manager = new CombatOnlyManager(new THREE.Scene(), audio); manager.spawnBoss(type, new THREE.Vector3()); return manager; };

test('each boss exposes a response to its actual arsenal, without labelling a gameplay rule as measured film fidelity', () => {
  for (const definition of Object.values(BOSS_REGISTRY)) {
    const manager = spawn(definition.id), pattern = getBossCombatPattern(definition.id), state = manager.getEncounterReadout();
    assert.equal(state.mechanic, pattern.mechanic); assert.ok(state.read.length > 20 && state.response.length > 20);
    assert.equal(state.bossType, definition.id); assert.equal(definition.assetFidelity, 'interpreted-game-model');
    if (pattern.weapons) for (const weapon of pattern.weapons) assert.ok(definition.attacks.includes(weapon));
    manager.clear();
  }
});

test('City actually alternates disc/plasma, and its physical disc returns without dealing a second hit', () => {
  const manager = spawn('city_hunter_boss'), target = player([0, 0, 12]), boss = manager.activeBoss;
  manager.fireBossWeapon(target, 'disc'); boss.isStunned = true; boss.stunTimer = 30;
  let returning = false;
  for (let frame = 0; frame < 180; frame++) { manager.update(1 / 60, target); returning ||= manager.weaponProjectiles.some(shot => shot.returning); }
  assert.equal(returning, true); assert.equal(target.hits.length, 1); assert.equal(target.hits[0].attackKind, 'disc'); assert.equal(manager.weaponProjectiles.length, 0);
  boss.isStunned = false; boss.spitCooldown = 0; boss.specialCooldown = 100; boss.weaponSequence = 0;
  const kinds = new Set();
  for (let frame = 0; frame < 900; frame++) {
    target.position.copy(boss.mesh.position).add(new THREE.Vector3(0, 0, 15)); manager.update(1 / 60, target);
    for (const shot of manager.weaponProjectiles) kinds.add(shot.kind);
  }
  assert.ok(kinds.has('disc') && kinds.has('plasma')); assert.ok(boss.weaponSequence >= 2); manager.clear();
});

test('the three delayed Berserker rounds share a locked aim and one damage allowance per target', () => {
  const manager = spawn('berserker_super_predator'), target = player([0, 0, 12]), boss = manager.activeBoss;
  boss.isStunned = true; boss.stunTimer = 30; manager.fireBossWeapon(target, 'plasma');
  const paused = manager.weaponProjectiles[0].mesh.position.clone(), due = manager.pendingActions.map(item => item.life);
  manager.update(0, target); assert.deepEqual(manager.weaponProjectiles[0].mesh.position.toArray(), paused.toArray()); assert.deepEqual(manager.pendingActions.map(item => item.life), due);
  const identities = new Set(manager.weaponProjectiles.map(shot => shot.mesh.uuid));
  for (let frame = 0; frame < 240; frame++) { manager.update(1 / 60, target); for (const shot of manager.weaponProjectiles) identities.add(shot.mesh.uuid); }
  assert.equal(identities.size, 3); assert.equal(target.hits.length, 1); assert.equal(target.hits[0].amount, 60);
  assert.equal(manager.pendingActions.length, 0); assert.equal(manager.weaponProjectiles.length, 0); manager.clear();
});

test('front armor rewards a flank, heavy strikes overload the Engineer shield and interrupt the announced charge/brood', () => {
  const guard = spawn('praetorian'), boss = guard.activeBoss;
  let before = boss.hp; guard.takeDamage(100, null, { origin: new THREE.Vector3(0, 0, 4) }); assert.equal(before - boss.hp, 45);
  before = boss.hp; guard.takeDamage(100, null, { origin: new THREE.Vector3(0, 0, -4) }); assert.equal(before - boss.hp, 100); guard.clear();
  const engineer = spawn('awakened_engineer'), e = engineer.activeBoss; engineer.takeDamage(e.maxHp * .4); assert.equal(e.hasPhaseShield, true);
  const shield = e.phaseShieldHp; engineer.takeDamage(100, null, { attackKind: 'heavy' }); assert.equal(shield - e.phaseShieldHp, 120); engineer.clear();
  for (const [type, action] of [['ultimate_upgrade_predator', 'charge'], ['predalien_queen', 'embryos']]) {
    const manager = spawn(type), active = manager.activeBoss; active.pressureAction = action; active.pressureAim = new THREE.Vector3(0, 0, 15);
    manager.takeDamage(150, null, { attackKind: 'heavy' }); assert.equal(active.isStunned, true); assert.equal(active.pressureAction, null);
    assert.ok(active.exposedUntil > manager.time); tick(manager, player([0, 0, 15]), 1);
    assert.equal(active.charge, undefined); assert.equal(manager.pendingHatches.length, 0); manager.clear();
  }
});

test('a committed Rogue King charge into real movement cover opens a recovery window', () => {
  const manager = spawn('rogue_king_prime'), target = player([0, 0, 15]), boss = manager.activeBoss;
  manager.environment = { resolveMovement(position) { position.z = Math.min(2, position.z); } }; boss.specialCooldown = 0;
  for (let frame = 0; frame < 240 && !boss.isStunned; frame++) manager.update(1 / 60, target);
  assert.equal(boss.isStunned, true); assert.ok(boss.stunTimer > 2); assert.equal(boss.charge, null); assert.ok(boss.mesh.position.z <= 2); manager.clear();
});

test('ground attacks use the local floor and jump height, while cover blocks vortex pulls and shriek energy loss', () => {
  const manager = spawn('xenomorph_queen'), target = player([0, 3, 4]); manager.activeBoss.mesh.position.y = 3;
  manager.triggerTailWhip(target); assert.equal(target.hits.length, 1);
  target.position.set(0, 4.3, 4); manager.triggerTailWhip(target); assert.equal(target.hits.length, 1); manager.clear();
  const engineer = spawn('awakened_engineer'), blocked = player([0, 0, 8]); engineer.environment = { hasLineOfSight: () => false, resolveMovement() { throw new Error('Cover must be checked before pulling'); } };
  engineer.triggerEngineerGravitationalVortex(blocked); assert.deepEqual(blocked.position.toArray(), [0, 0, 8]); assert.equal(blocked.hits.length, 0); engineer.clear();
  const offspring = spawn('the_offspring'), concealed = player([0, 0, 8]); offspring.environment = { hasLineOfSight: () => false };
  offspring.activeBoss.shriekCooldown = 0; tick(offspring, concealed, 2); assert.equal(concealed.hits.length, 0); assert.equal(concealed.plasmaEnergy, 100); offspring.clear();
});

test('the Imperial aftershock has a real safe inner annulus, while the Titan emits three separated pulses', () => {
  const queen = spawn('imperial_queen'), target = player([0, 0, 4]); queen.activeBoss.isStunned = true; queen.activeBoss.stunTimer = 30;
  queen.triggerMatriarchRoyalSlam(target); assert.equal(target.hits.length, 1);
  tick(queen, target, 1); assert.equal(target.hits.length, 1, 'remaining inside the first radius avoids the outer annulus'); queen.clear();
  const titan = spawn('predalien_matriarch_titan'), grounded = player([0, 0, 4]); titan.activeBoss.isStunned = true; titan.activeBoss.stunTimer = 30;
  titan.triggerMatriarchRoyalSlam(grounded); assert.equal(grounded.hits.length, 1);
  tick(titan, grounded, .7); assert.equal(grounded.hits.length, 2); tick(titan, grounded, .7); assert.equal(grounded.hits.length, 3); titan.clear();
});

test('the Jungle laser keeps the warning aim and all delayed effects disappear on clear', () => {
  const manager = spawn('jungle_hunter_boss'), target = player([0, 0, 28]), boss = manager.activeBoss;
  boss.specialCooldown = 100; boss.spitCooldown = 0; manager.update(1 / 60, target);
  assert.equal(boss.pressureAction, 'plasma'); const aim = boss.pressureAim.clone(); assert.equal(boss.aimBeam.visible, true);
  target.position.x = 12; manager.update(1 / 60, target); assert.deepEqual(boss.pressureAim.toArray(), aim.toArray());
  let releases = 0; boss.aimBeam.geometry.addEventListener('dispose', () => releases++);
  manager.clear(); assert.equal(releases, 1); assert.equal(manager.scene.children.length, 0); assert.equal(manager.pendingActions.length, 0);
});

test('the cold-flower signature limits distant Feral acquisition without granting invisibility to close/directly visible hunters', () => {
  const manager = spawn('feral_predator_boss'), target = player([0, 0, 25]), boss = manager.activeBoss; target.getThermalSignatureMultiplier = () => .35;
  boss.specialCooldown = 100; boss.spitCooldown = 0; manager.environment = { hasLineOfSight: () => true };
  manager.update(1 / 60, target); assert.equal(boss.pressureAction, null); assert.equal(manager.weaponProjectiles.length, 0);
  target.position.z = 15; manager.update(1 / 60, target); assert.equal(boss.pressureAction, 'bolt');
  manager.clear(); manager.spawnBoss('feral_predator_boss', new THREE.Vector3()); manager.activeBoss.spitCooldown = 0; manager.activeBoss.specialCooldown = 100;
  target.position.z = 25; target.getThermalSignatureMultiplier = () => 1; manager.update(1 / 60, target); assert.equal(manager.activeBoss.pressureAction, 'bolt');
  manager.clear(); manager.spawnBoss('feral_predator_boss', new THREE.Vector3()); target.position.z = 5; target.getThermalSignatureMultiplier = () => .35;
  manager.environment = { hasLineOfSight: () => false }; assert.equal(manager._canFeralAcquire(target), true); manager.clear();
});

test('the area warning covers the actual tail reach and releases its owned geometry once', () => {
  const manager = spawn('xenomorph_queen'), target = player([0, 0, 7]), boss = manager.activeBoss; boss.tailWhipCooldown = 0;
  manager.update(1 / 60, target); assert.equal(boss.pressureAction, 'tail'); assert.ok(boss.attackWarning.geometry.parameters.outerRadius >= 8.5);
  let disposals = 0; boss.attackWarning.geometry.addEventListener('dispose', () => disposals++);
  boss.isStunned = true; boss.stunTimer = 3; manager.update(1 / 60, target); manager.clear(); assert.equal(disposals, 1);
});

test('a cull/checkpoint preserves boss resources and cooldowns, without healing remote wounds or replaying consumed volleys', () => {
  const manager = spawn('predalien_queen'), boss = manager.activeBoss, target = player([0, 0, 15]);
  manager.regurgitateChestbursters(target, { spawnChestburster() {} }); boss.weaponSequence = 3; boss.regurgitateCooldown = 6; boss.hp = 2000; boss.phase = 2;
  const saved = manager.serializeCombatState(); manager.clear(); manager.spawnBoss('predalien_queen', new THREE.Vector3());
  assert.equal(manager.restoreCombatState(saved), true); assert.equal(manager.activeBoss.hp, 2000); assert.equal(manager.activeBoss.broodAllowance, 5);
  assert.equal(manager.activeBoss.weaponSequence, 3); assert.equal(manager.activeBoss.regurgitateCooldown, 6); assert.equal(manager.pendingHatches.length, 0);
  assert.throws(() => manager.restoreCombatState({ ...saved, broodAllowance: 999 }), /checkpoint/); assert.equal(manager.activeBoss.broodAllowance, 5); manager.clear();
  const unit = { id: 'allocated-queen', sourceBossType: 'xenomorph_queen', factionId: 'hive', hp: 1600, maxHp: 3000, position: [0, 0] };
  manager.battleSimulation = { time: 20 }; const projected = manager.spawnBattleUnit(unit); projected.spitCooldown = 5; projected.weaponSequence = 3;
  manager.despawnBattleUnit(unit.id); manager.battleSimulation.time = 22; const resumed = manager.spawnBattleUnit({ ...unit, hp: 800, position: [80, 20] });
  assert.equal(resumed.hp, 800); assert.equal(resumed.phase, 3); assert.equal(resumed.spitCooldown, 3); assert.equal(resumed.weaponSequence, 3);
  assert.deepEqual(resumed.mesh.position.toArray(), [80, 0, 20]); manager.clear();
});

function pressureFixture() {
  const config = { id: 'boss-pressure-test', mode: 'original', context: { era: 'alternative', works: ['original'], continuities: ['original'] }, playerFaction: 'player_clan',
    factions: [{ id: 'player_clan', species: 'yautja' }, { id: 'hive', species: 'xenomorph' }], relations: [{ a: 'player_clan', b: 'hive', state: 'hostile' }],
    fronts: [{ id: 'base', position: [0, 0], radius: 15, owner: 'player_clan', criticalFor: ['player_clan'], reinforcementSource: true, captureThreshold: 3 },
      { id: 'supply', position: [40, 0], radius: 15, owner: 'player_clan', reinforcementSource: true, captureThreshold: 3 },
      { id: 'hive-front', position: [80, 0], radius: 15, owner: 'hive', reinforcementSource: true, captureThreshold: 3 }],
    routes: [{ id: 'base-supply', from: 'base', to: 'supply', travelSeconds: 2 }, { id: 'hive-supply', from: 'hive-front', to: 'supply', travelSeconds: 2 }],
    profiles: [{ id: 'p', species: 'yautja', maxHp: 100, damage: 0, attackInterval: 1 }, { id: 'h', species: 'xenomorph', maxHp: 100, damage: 10, attackInterval: 1 }],
    groups: [{ id: 'defenders', factionId: 'player_clan', frontId: 'base', position: [0, 0], units: Array.from({ length: 4 }, (_, i) => ({ id: `defender-${i}`, profileId: 'p', officer: i === 0 })) },
      { id: 'phase-squad', factionId: 'hive', frontId: 'hive-front', position: [80, 0], units: Array.from({ length: 4 }, (_, i) => ({ id: `raider-${i}`, profileId: 'h', officer: i === 0 })) }],
    budgets: { active: 8, byFaction: { player_clan: { active: 4, total: 4 }, hive: { active: 4, total: 4 } }, spawnDistance: 24, spawnInterval: 8, announcementSeconds: 3, arrivalsPerTick: 4 },
    objectives: { externalVictory: true, loseFronts: ['base'] }, ai: { enabled: false } };
  const simulation = new BattleSimulation(config), boss = { type: 'xenomorph_queen', battleUnitId: 'major', factionId: 'hive', hp: 3000, phase: 1 };
  return { simulation, boss, config };
}

test('a phase announces a real allocated attack on an optional front; its capture does not reset previous accomplishments', () => {
  const { simulation, boss } = pressureFixture(), messages = [], module = new BossPhasePressure({ simulation, getBoss: () => boss, announce: event => messages.push(event) });
  const identities = [...simulation.units.keys()]; simulation.objectiveKeys.add('earlier-archive-secured'); boss.phase = 2; module.update(.1);
  assert.equal(messages[0].status, 'announced'); assert.equal(messages[0].targetFrontId, 'supply'); assert.equal(simulation.getGroup('phase-squad').order.type, 'defend');
  module.update(60, { paused: true }); assert.ok(module.getHUDState().threats[0].remaining > 11);
  module.update(12); assert.equal(module.getHUDState().threats[0].status, 'launched'); assert.equal(simulation.getGroup('phase-squad').order.frontId, 'supply');
  for (let frame = 0; frame < 160; frame++) { simulation.update(.25); module.update(.25); }
  assert.equal(simulation.getFront('supply').owner, 'hive'); assert.equal(module.getHUDState().threats[0].status, 'lost');
  assert.ok(simulation.objectiveKeys.has('earlier-archive-secured')); assert.equal(simulation.getFront('base').owner, 'player_clan'); assert.deepEqual([...simulation.units.keys()], identities); assert.equal(simulation.assertConservation(), true);
  module.dispose(); simulation.dispose();
});

test('the warning survives checkpoint without duplicate orders; blocked routes and a truce are real ways to stop it', () => {
  const { simulation, boss } = pressureFixture(), module = new BossPhasePressure({ simulation, getBoss: () => boss }); boss.phase = 2; module.update(.1); module.update(5);
  const saved = module.serialize(), resumed = new BossPhasePressure({ simulation, getBoss: () => boss }); resumed.restore(saved); resumed.update(.1);
  assert.equal(resumed.getHUDState().threats.length, 1); assert.ok(resumed.getHUDState().threats[0].remaining > 6);
  const corrupt = structuredClone(saved); corrupt.threats[0].groupId = 'defenders'; assert.throws(() => resumed.restore(corrupt), /checkpoint/);
  simulation.setRouteOpen('hive-supply', false); resumed.update(8); assert.equal(resumed.getHUDState().threats[0].status, 'cancelled'); assert.equal(resumed.getHUDState().threats[0].reason, 'no_open_route');
  module.dispose(); resumed.dispose(); simulation.dispose();
  const other = pressureFixture(), diplomat = new BossPhasePressure({ simulation: other.simulation, getBoss: () => other.boss }); other.boss.phase = 2; diplomat.update(.1);
  other.simulation.setRelationship('player_clan', 'hive', 'neutral', 'negotiation'); diplomat.update(.1); assert.equal(diplomat.getHUDState().threats[0].reason, 'truce');
  diplomat.dispose(); other.simulation.dispose();
});

test('removing the boss visual does not cancel its allocated live secondary-front reaction', () => {
  const { simulation, boss } = pressureFixture(); boss.battleUnitId = 'raider-0'; let visibleBoss = boss;
  const module = new BossPhasePressure({ simulation, getBoss: () => visibleBoss }); boss.phase = 2; module.update(.1);
  visibleBoss = null; module.update(12);
  assert.equal(module.getHUDState().threats[0].status, 'launched'); assert.equal(simulation.getGroup('phase-squad').order.type, 'attack');
  module.dispose(); simulation.dispose();
});

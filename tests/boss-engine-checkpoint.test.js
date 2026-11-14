import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BossManager } from '../js/entities/Bosses.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { CombatDirector } from '../js/engine/CombatDirector.js';

const audio = new Proxy({}, { get: () => () => {} });
const config = {
  id: 'queen-checkpoint-flow', mode: 'original', context: { era: 'alternative', works: ['original'], continuities: ['original'] }, playerFaction: 'player_clan',
  factions: [{ id: 'player_clan', species: 'yautja' }, { id: 'hive', species: 'xenomorph' }, { id: 'humans', species: 'human' }],
  relations: [{ a: 'player_clan', b: 'hive', state: 'hostile' }, { a: 'player_clan', b: 'humans', state: 'neutral' }, { a: 'hive', b: 'humans', state: 'hostile' }],
  fronts: [{ id: 'base', position: [0, 0], radius: 40, owner: 'player_clan', reinforcementSource: true },
    { id: 'queen-front', position: [100, 0], radius: 40, owner: 'hive', reinforcementSource: true, captureThreshold: 300 },
    { id: 'human-base', position: [200, 0], radius: 40, owner: 'humans', reinforcementSource: true }],
  routes: [{ id: 'ab', from: 'base', to: 'queen-front', travelSeconds: 10 }, { id: 'bc', from: 'queen-front', to: 'human-base', travelSeconds: 10 }],
  profiles: [{ id: 'queen', species: 'xenomorph', actorType: 'queen', sourceBossType: 'xenomorph_queen', maxHp: 3000, damage: 0, attackInterval: 2, unique: true },
    { id: 'remote-attacker', species: 'human', actorType: 'marine', maxHp: 100, damage: 50, attackInterval: .25 }],
  groups: [{ id: 'queen-group', factionId: 'hive', frontId: 'queen-front', position: [100, 0], units: [{ id: 'queen-unit', profileId: 'queen', uniqueId: 'original-queen', officer: true, position: [100, 0] }] },
    { id: 'human-group', factionId: 'humans', frontId: 'queen-front', position: [100, 0], units: [{ id: 'human-unit', profileId: 'remote-attacker', position: [100, 0] }] }],
  budgets: { active: 1, byFaction: { player_clan: { active: 0, total: 0 }, hive: { active: 1, total: 1 }, humans: { active: 0, distant: 1, total: 1 } },
    spawnDistance: 24, spawnInterval: 8, announcementSeconds: 3, arrivalsPerTick: 1 }, objectives: { externalVictory: true }, ai: { enabled: false }
};

function sceneFlow(saved = null) {
  const scene = new THREE.Scene(), bossManager = new BossManager(scene, audio);
  const unused = key => ({ [key]: [], checkMeleeHits: () => [], cancelPendingSpawns() {}, getActiveCombatants: () => [],
    spawnBattleUnit() { throw new Error('A zero-budget faction must stay distant'); }, despawnBattleUnit() { return null; } });
  const game = { player: { hp: 1000, position: new THREE.Vector3(100, 0, 30), factionId: 'player_clan' }, player2: null,
    horde: unused('aliens'), marines: unused('marines'), allies: unused('allies'), synthetics: unused('androids'), bosses: bossManager, combatDirector: new CombatDirector(),
    env: { resolveMovement() {}, getElevationAt: () => 0, hasLineOfSight: () => true } };
  let bridge;
  const callbacks = { spawnGroup: (...args) => bridge.spawnGroup(...args), despawnGroup: (...args) => bridge.despawnGroup(...args) };
  const simulation = saved ? BattleSimulation.fromState(config, saved, callbacks) : new BattleSimulation(config, callbacks);
  game.battleSimulation = simulation; bridge = new BattleActorBridge(game); bridge.bind(simulation);
  const step = position => { game.player.position.set(position[0], 0, position[1]); bridge.sync(); simulation.update(.25, { players: [{ id: 'player1', hp: 1000, position }] }); bridge.sync(); };
  const dispose = () => { simulation.dispose(); bridge.dispose(); bossManager.clear(); assert.equal(scene.children.length, 0); };
  return { game, simulation, bridge, bossManager, step, dispose };
}

test('real BossManager → Bridge → simulation cull → checkpoint → new manager keeps resources while actual distant combat advances HP and phase', () => {
  const first = sceneFlow(); first.step([100, 30]);
  const queen = first.bossManager.activeBoss; assert.equal(queen.battleUnitId, 'queen-unit');
  first.bossManager.takeDamage(2050); assert.equal(queen.phase, 2); queen.spitCooldown = 5; queen.weaponSequence = 4; queen.broodAllowance = 2;
  first.bridge.sync(); const published = first.simulation.getUnit('queen-unit').encounterState;
  assert.equal(published.hp, 950); assert.equal(published.phase, 2); assert.equal(published.broodAllowance, 2);
  first.step([10000, 10000]); assert.equal(first.bossManager.activeBoss, null); assert.equal(first.simulation.getUnit('queen-unit').state, 'distant');
  const phasePhoto = first.simulation.getUnit('queen-unit').encounterState;
  for (let tick = 0; tick < 4; tick++) first.step([10000, 10000]);
  const remotelyWounded = first.simulation.getUnit('queen-unit'); assert.ok(remotelyWounded.hp < 900 && remotelyWounded.hp > 0);
  assert.equal(remotelyWounded.encounterState.hp, 950, 'the old photo cannot overwrite authoritative distant damage');
  const state = first.simulation.saveState(); first.dispose();
  const resumed = sceneFlow(state); resumed.step([100, 30]); const restored = resumed.bossManager.activeBoss;
  assert.equal(restored.hp, remotelyWounded.hp); assert.equal(restored.phase, 3); assert.equal(restored.broodAllowance, 2); assert.equal(restored.weaponSequence, 4);
  assert.ok(Math.abs(restored.spitCooldown - Math.max(0, 5 - (resumed.simulation.time - phasePhoto.simulationTime))) < 1e-6);
  assert.equal(restored.hasEnteredStun, true); assert.equal(resumed.simulation.assertConservation(), true); assert.equal(resumed.simulation.deaths.size, 0);
  const bad = resumed.simulation.getUnit('queen-unit').encounterState; assert.equal(resumed.simulation.syncUnit('human-unit', { encounterState: bad }), false);
  const corrupt = structuredClone(state); corrupt.units.find(unit => unit.id === 'queen-unit').encounterState.broodAllowance = 100;
  assert.throws(() => BattleSimulation.fromState(config, corrupt), /boss|encounter|save/i); resumed.dispose();
});

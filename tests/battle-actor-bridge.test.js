import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { createBattlefieldOperation } from '../js/battlefield/BattlefieldOperation.js';
import { createBattlefieldLayout } from '../js/data/BattlefieldLayouts.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

function fixture() {
  const player = { hp: 1000, position: new THREE.Vector3() };
  const manager = key => ({ [key]: [], checkMeleeHits() { return []; },
    spawnBattleUnit(unit, group) {
      const actor = { mesh: new THREE.Group(), battleUnitId: unit.id, factionId: unit.factionId,
        hp: unit.hp, maxHp: unit.maxHp, radius: 1, battleGroupId: group.id };
      actor.mesh.position.set(unit.position[0], 0, unit.position[1]); this[key].push(actor); return actor;
    },
    despawnBattleUnit(id) {
      const at = this[key].findIndex(actor => actor.battleUnitId === id); if (at < 0) return null;
      const [actor] = this[key].splice(at, 1); return { id, hp: actor.hp, position: [actor.mesh.position.x, actor.mesh.position.z] };
    },
    defeatCombatant(actor) {
      actor.hp = 0; this[key].splice(this[key].indexOf(actor), 1);
      return { id: `death:${actor.battleUnitId}`, entityId: actor.battleUnitId };
    }, cancelPendingSpawns() {} });
  const game = { player, horde: manager('aliens'), marines: manager('marines'), allies: manager('allies'),
    synthetics: manager('androids'), bosses: {}, combatDirector: {}, env: { resolveMovement() {} } };
  const config = createBattlefieldOperation(createBattlefieldLayout(LEVELS_DATA[0]), { levelId: LEVELS_DATA[0].id });
  const bridge = new BattleActorBridge(game);
  const simulation = new BattleSimulation(config, { spawnGroup: (...args) => bridge.spawnGroup(...args), despawnGroup: (...args) => bridge.despawnGroup(...args) });
  bridge.bind(simulation);
  const step = position => { player.position.set(position[0], 0, position[1]); bridge.sync(); simulation.update(.25, { players: [{ id: 'p1', hp: player.hp, position }] }); bridge.sync(); };
  return { game, config, bridge, simulation, step };
}

test('materialization projects real finite identities and culling preserves wounds instead of counting a death', () => {
  const { config, bridge, simulation, step } = fixture();
  step(config.fronts[0].position);
  assert.ok(bridge.actors.size > 0);
  assert.ok(bridge.actors.size <= config.budgets.active);
  const [id, { actor }] = bridge.actors.entries().next().value;
  actor.hp -= 37; bridge.sync();
  const hp = actor.hp;
  step([10000, 10000]);
  assert.equal(bridge.actors.has(id), false);
  assert.equal(simulation.getUnit(id).hp, hp);
  assert.equal(simulation.getUnit(id).state, 'distant');
  assert.equal(simulation.deaths.has(id), false);
  simulation.assertConservation(); bridge.dispose(); simulation.dispose();
});

test('the historical hive query also damages genuinely hostile humans while allied clan actors stay immune', () => {
  const { game, config, bridge, simulation, step } = fixture();
  step(config.fronts[0].position);
  const ally = [...bridge.actors.values()].find(entry => entry.actor.factionId === config.playerFaction).actor;
  assert.equal(bridge.hitOtherHostiles({ origin: ally.mesh.position, damage: 10, radius: 1 }).length, 0);
  step(config.fronts[1].position);
  const human = [...bridge.actors.values()].find(entry => entry.manager === game.marines).actor;
  const hits = game.horde.checkMeleeHits({ origin: human.mesh.position.clone(), radius: 1, damage: 10000 });
  assert.ok(hits.some(hit => hit.killed && hit.event?.entityId === human.battleUnitId));
  bridge.sync(); assert.equal(simulation.getUnit(human.battleUnitId).state, 'dead');
  simulation.assertConservation(); bridge.dispose(); simulation.dispose();
});

test('failed materialization rolls back earlier actors and teardown restores every borrowed manager hook', () => {
  const { game, config, bridge, simulation } = fixture();
  const group = simulation.getGroup(config.groups[0].id), units = simulation.getGroupUnits(group.id);
  const original = game.allies.spawnBattleUnit; let count = 0;
  game.allies.spawnBattleUnit = function(...args) { if (++count === 2) throw new Error('fixture second unit failed'); return original.apply(this, args); };
  assert.equal(bridge.spawnGroup(group, units), false);
  assert.equal(bridge.actors.size, 0); assert.equal(game.allies.allies.length, 0);
  assert.match(bridge.lastError, /second unit/);
  const query = bridge.originalMelee;
  bridge.dispose(); bridge.dispose();
  assert.equal(game.horde.checkMeleeHits, query);
  assert.equal(game.horde.battleSimulation, undefined);
  assert.equal(game.allies.combatActorsProvider, undefined);
  assert.equal(bridge.getStats().disposed, true); simulation.dispose();
});

test('physical cover rejects an otherwise in-range strike against a materialized human',()=>{
  const {game,config,bridge,simulation,step}=fixture();step(config.fronts[1].position);
  const human=[...bridge.actors.values()].find(entry=>entry.manager===game.marines).actor;
  const hp=human.hp;game.env.hasLineOfSight=()=>false;
  assert.deepEqual(bridge.hitOtherHostiles({origin:human.mesh.position.clone(),radius:3,damage:90}),[]);
  assert.equal(human.hp,hp);bridge.dispose();simulation.dispose();
});

test('a Queen uses the actual boss model, keeps its allocated identity, and leaves detail without dying',async()=>{
  const {BossManager}=await import('../js/entities/Bosses.js');
  const {game,bridge,simulation}=fixture();bridge.dispose();
  const scene=new THREE.Scene(),audio=new Proxy({}, {get:()=>()=>{}});game.bosses=new BossManager(scene,audio);game.combatDirector={release(){}};
  const queenBridge=new BattleActorBridge(game);queenBridge.bind(simulation);
  const unit={id:'allocated-queen',profileId:'queen-profile',groupId:'queen-group',species:'xenomorph',actorType:'queen',sourceBossType:'xenomorph_queen',hp:1777,maxHp:3000,position:[70,-70],factionId:'hive',officer:true};
  const group={id:'queen-group',species:'xenomorph',factionId:'hive'};
  assert.equal(queenBridge.spawnGroup(group,[unit]),true);
  assert.equal(game.bosses.activeBoss.type,'xenomorph_queen');assert.equal(game.bosses.activeBoss.battleUnitId,unit.id);
  assert.equal(game.bosses.activeBoss.hp,1777);assert.equal(game.bosses.activeBoss.maxHp,3000);
  assert.ok(game.bosses.activeBoss.mesh.children.length>5);
  const snapshots=queenBridge.despawnGroup(group,[unit]);assert.equal(snapshots[0].hp,1777);assert.equal(game.bosses.activeBoss,null);
  assert.equal(simulation.deaths.size,0);queenBridge.dispose();simulation.dispose();
});

test('an externally removed living actor releases group detail and preserves its injury without inventing a casualty',()=>{
  const{config,bridge,simulation,step}=fixture();step(config.fronts[0].position);
  const[id,{actor,manager}]=bridge.actors.entries().next().value;actor.hp-=19;const hp=actor.hp;
  manager.despawnBattleUnit(id);bridge.sync();
  assert.equal(simulation.deaths.has(id),false);assert.equal(simulation.getUnit(id).hp,hp);
  assert.equal(simulation.getUnit(id).state,'distant');assert.equal(bridge.actors.has(id),false);
  simulation.assertConservation();bridge.dispose();simulation.dispose();
});

test('real mission cleanup lets simulation cull through its bridge before clearing live callbacks and remains idempotent',async()=>{
  const{disposeBattleOperation}=await import('../js/battlefield/BattleOperationLifecycle.js');
  const{game,config,bridge,simulation,step}=fixture();step(config.fronts[0].position);
  game.battleSimulation=simulation;game.battleBridge=bridge;
  // The original callback read the live game field, so clearing it first broke
  // the actual exit-to-menu path whenever at least one group was detailed.
  simulation.callbacks.despawnGroup=(group,units)=>game.battleBridge.despawnGroup(group,units);
  assert.ok(bridge.actors.size>0);disposeBattleOperation(game);disposeBattleOperation(game);
  assert.equal(game.battleSimulation,null);assert.equal(game.battleBridge,null);
  assert.equal(bridge.actors.size,0);assert.equal(game.allies.allies.length,0);assert.equal(game.horde.battleSimulation,undefined);
});

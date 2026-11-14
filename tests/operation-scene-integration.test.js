import test from 'node:test';
import {createOperationScene}from'../js/battlefield/OperationScene.js';
import assert from 'node:assert/strict';
import {BATTLE_OPERATIONS} from '../js/data/BattleCatalog.js';
import {pointInBattlefieldRect} from '../js/data/BattlefieldLayouts.js';
import {BattleSimulation} from '../js/battlefield/BattleSimulation.js';
import {OperationObjectives} from '../js/battlefield/OperationObjectives.js';

function bind(operation){return createOperationScene({operationId:operation.id});}

test('every Yautja operation binds narrative tasks and real fronts inside its constructed map',()=>{
  for(const operation of BATTLE_OPERATIONS.filter(row=>!row.requiresHumanController)){
    const{layout,config}=bind(operation),simulation=new BattleSimulation(config),controller=new OperationObjectives(config,simulation);
    assert.equal(layout.mapId,operation.mapId);assert.ok(layout.sectors.length>=9);
    for(const task of controller.getHUDState().tasks)assert.ok(layout.sectors.some(sector=>pointInBattlefieldRect({x:task.position[0],z:task.position[1]},sector.bounds)),`${operation.id}/${task.id} is outside constructed terrain`);
    assert.equal(simulation.getHUDState().result,null);assert.ok(config.objectives.externalVictory);
    simulation.dispose();controller.dispose();
  }
});

test('a bound operation checkpoint preserves a detailed casualty and wounded survivor without materializing identities twice',()=>{
 const{config}=bind(BATTLE_OPERATIONS[0]);const simulation=new BattleSimulation(config);const controller=new OperationObjectives(config,simulation);
 const units=config.groups.flatMap(group=>group.units),dead=units[0],wounded=units[1];
 simulation.recordDeath({entityId:dead.id,cause:'integration-test'});const survivor=simulation.getUnit(wounded.id);simulation.syncUnit(wounded.id,{hp:survivor.maxHp-7,position:survivor.position});
 const saved=simulation.saveState(),objectiveSave=controller.serialize();
 const restored=BattleSimulation.fromState(config,saved);const resumed=new OperationObjectives(config,restored);resumed.restore(objectiveSave);
 assert.equal(restored.getUnit(dead.id).state,'dead');assert.equal(restored.getUnit(wounded.id).hp,survivor.maxHp-7);assert.deepEqual(restored.getCounts(),simulation.getCounts());
 assert.deepEqual(resumed.getHUDState().tasks,controller.getHUDState().tasks);assert.ok(restored.assertConservation());
 simulation.dispose();controller.dispose();restored.dispose();resumed.dispose();
});

test('visible cargo is an actual damageable mission identity with separate civilian/combat accounting and owned cleanup',async()=>{
  const THREE=await import('three');const{OperationWorld}=await import('../js/battlefield/OperationWorld.js');
  const{config}=bind(BATTLE_OPERATIONS[0]),simulation=new BattleSimulation(config),controller=new OperationObjectives(config,simulation);
  const scene=new THREE.Scene(),world=new OperationWorld(scene,{getElevationAt:()=>0},controller,config.playerFaction,'rival_clan');
  world.update(controller.getHUDState());const cargo=world.combatants.find(actor=>actor.mesh.name==='register');assert.ok(cargo);
  const hp=controller.getWorldEntities().find(entity=>entity.id==='register').hp;cargo.takeDamage(80);
  assert.equal(controller.getWorldEntities().find(entity=>entity.id==='register').hp,hp-80);assert.equal(cargo.hp,hp-80);
  assert.equal(cargo.factionId,config.playerFaction);assert.equal(simulation.deaths.size,0);
  assert.ok(scene.children.length);world.dispose();assert.equal(scene.children.length,0);controller.dispose();simulation.dispose();
});


test('briefing and mission launch share exactly the same forces, routes, narrative and finite identities',()=>{const briefing=createOperationScene({operationId:'AFF-09',players:2});const launch=createOperationScene({operationId:'AFF-09',players:2,level:briefing.level,layout:briefing.layout});assert.deepEqual(launch.config,briefing.config);assert.ok(briefing.config.routes.some(route=>route.open===false));assert.equal(briefing.layout.mapId,briefing.variant.id);});

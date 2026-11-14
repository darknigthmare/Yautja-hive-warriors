import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { formationSlots, formationDamageMultiplier, applyFormationImpact, updateFormation, formationAttackMultiplier } from '../js/battlefield/FormationTactics.js';
import { CompanionLoadouts } from '../js/battlefield/CompanionLoadouts.js';
import { createHiveConflictScenario } from '../js/battlefield/HiveConflictScenario.js';
import { createBattlefieldOperation } from '../js/battlefield/BattlefieldOperation.js';
import { createBattlefieldLayout } from '../js/data/BattlefieldLayouts.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { applyBattleFormationHit, maintainBattleFormation } from '../js/engine/BattleActorSupport.js';
const audio=new Proxy({},{get:()=>()=>{}});
const layout=()=>createBattlefieldLayout({environmentType:'forest'});
function setup(){
  const config=createHiveConflictScenario(layout());config.ai.enabled=false;config.profiles.forEach(profile=>profile.damage=0);
  const simulation=new BattleSimulation(config,{spawnGroup:()=>true});const front=config.fronts[0];
  simulation.update(.25,{players:[{id:'player1',hp:1000,position:front.position}]});
  const units=simulation.getActiveUnits().filter(unit=>unit.factionId==='player_clan'),actors=new Map();
  for(const unit of units){const mesh=new THREE.Group();mesh.position.set(unit.position[0],0,unit.position[1]);actors.set(unit.id,{actor:{mesh,hp:unit.hp,maxHp:unit.maxHp,battleUnitId:unit.id,battleGroupId:unit.groupId,factionId:unit.factionId}});}
  const p1={hp:500,maxHp:1000,isPlayer2:false,position:actors.get(units[0].id).actor.mesh.position.clone()};
  const companions=new CompanionLoadouts({simulation,actors,players:()=>[p1],environment:{hasLineOfSight:()=>true}});
  return {simulation,config,units,actors,p1,companions};
}
function advance(simulation,seconds){for(let frame=0;frame<seconds*4;frame++)simulation.update(.25);}

test('four formations have distinct finite slots, maintain spacing and rotate with their direction',()=>{
  const layouts=['wedge','line','phalanx','dispersed'].map(kind=>formationSlots(kind,9));
  assert.equal(new Set(layouts.map(slots=>JSON.stringify(slots))).size,4);
  for(const slots of layouts)for(let a=0;a<slots.length;a++)for(let b=a+1;b<slots.length;b++)assert.ok(Math.hypot(...slots[a].position.map((v,index)=>v-slots[b].position[index]))>1.5);
  const rotated=formationSlots('line',5,{origin:[20,10],target:[30,10]});assert.ok(rotated.every(slot=>slot.position[0]===20));
  assert.throws(()=>formationSlots('line',65),/64/);
});

test('a sweep breaks a line more effectively than dispersed troops, with one cohesion impact per swing',()=>{
  const {simulation}=setup(),group=[...simulation.groups.values()].find(group=>group.factionId==='amber_hive');
  group.formation='line';assert.ok(formationDamageMultiplier(group,'sweep')>formationDamageMultiplier({...group,formation:'dispersed'},'sweep')*2);
  const first=applyFormationImpact(simulation,{groupId:group.id,kind:'line_break',sourceFaction:'player_clan',attackId:'swing-1',hitUnitIds:[group.units[1]]});
  assert.equal(first.accepted,true);assert.ok(group.rootUntil>simulation.time);const cohesion=group.cohesion;
  const repeated=applyFormationImpact(simulation,{groupId:group.id,kind:'line_break',sourceFaction:'player_clan',attackId:'swing-1',hitUnitIds:[group.officerId]});
  assert.equal(repeated.accepted,false);assert.equal(group.cohesion,cohesion);assert.ok(group.officerThreatUntil>simulation.time);
  assert.equal(formationAttackMultiplier(group,simulation.time),0);updateFormation(group,3,simulation.time+8,{officerAlive:true});assert.ok(group.cohesion>cohesion);
  assert.equal(simulation.assertConservation(),true);
});

test('real actor damage uses formation response and roots movement without teleporting to a slot',()=>{
  const {simulation}=setup(),group=[...simulation.groups.values()].find(group=>group.factionId==='amber_hive');group.formation='phalanx';
  const actor={mesh:new THREE.Group(),hp:200,battleUnitId:group.units[1],battleGroupId:group.id,battleFormationTarget:[20,0],radius:1};
  const manager={battleSimulation:simulation,environment:{resolveAgentMovement(){}}};
  assert.equal(maintainBattleFormation(manager,actor,.1,10),true);assert.equal(actor.mesh.position.x,1);
  const attack={type:'line_break',damage:100,killerFaction:'player_clan'};
  assert.ok(applyBattleFormationHit(manager,actor,attack)>100);const position=actor.mesh.position.clone();maintainBattleFormation(manager,actor,.1,10);assert.deepEqual(actor.mesh.position.toArray(),position.toArray());
});

test('medic stock and cooldown survive re-equip, duplicate registration and checkpoints',()=>{
  const {simulation,units,companions,p1}=setup(),id=units[0].id;
  assert.equal(companions.register(id,{role:'medic'}).accepted,true);const result=companions.command(id,{type:'heal',targetPlayerId:'player1'});
  assert.equal(result.accepted,true);assert.equal(p1.hp,610);assert.equal(companions.getState().companions[0].charges.heal,2);
  assert.equal(companions.command(id,{type:'heal'}).reason,'ability_cooling_down');
  companions.equip(id,'medic_field');companions.register(id,{role:'medic'});assert.equal(companions.equip(id,'engineer_tools').accepted,false);
  const saved=companions.serialize(),restored=new CompanionLoadouts({simulation,actors:companions.actors,players:()=>[p1]});restored.restore(saved);
  assert.equal(restored.getState().companions[0].charges.heal,2);assert.equal(restored.command(id,{type:'heal'}).reason,'ability_cooling_down');
  assert.equal(simulation.units.size,96);assert.equal(simulation.assertConservation(),true);
});

test('a medic exhausts its finite stock and cannot heal through cover or refill by waiting',()=>{
  const {simulation,units,actors,companions,p1}=setup(),id=units[0].id;companions.register(id,{role:'medic'});
  companions.environment.hasLineOfSight=()=>false;
  assert.equal(companions.command(id,{type:'heal'}).accepted,false);assert.equal(companions.getState().companions[0].charges.heal,3);
  companions.environment.hasLineOfSight=()=>true;
  for(let use=0;use<3;use++){p1.hp=500;assert.equal(companions.command(id,{type:'heal'}).accepted,true);advance(simulation,13);companions.update(13);}
  companions.equip(id,'medic_field');p1.hp=400;assert.equal(companions.command(id,{type:'heal'}).reason,'charges_exhausted');
  const restored=new CompanionLoadouts({simulation,actors,players:()=>[p1]});restored.restore(companions.serialize());advance(simulation,60);restored.update(60);
  assert.equal(restored.command(id,{type:'heal'}).reason,'charges_exhausted');assert.equal(p1.hp,400);
});

test('formation wounds and temporary disruptions survive an operation checkpoint',()=>{
  const {simulation,config}=setup(),group=[...simulation.groups.values()].find(group=>group.factionId==='amber_hive');group.formation='phalanx';
  applyFormationImpact(simulation,{groupId:group.id,kind:'line_break',sourceFaction:'player_clan',attackId:'saved-swing',hitUnitIds:[group.officerId]});
  const saved=simulation.saveState(),restored=BattleSimulation.fromState(config,saved),copy=restored.groups.get(group.id);
  assert.equal(copy.cohesion,group.cohesion);assert.equal(copy.rootUntil,group.rootUntil);assert.equal(copy.officerThreatUntil,group.officerThreatUntil);
  assert.equal(applyFormationImpact(restored,{groupId:group.id,kind:'line_break',sourceFaction:'player_clan',attackId:'saved-swing',hitUnitIds:[group.officerId]}).accepted,false);
  assert.equal(restored.assertConservation(),true);
});

test('a companion order plans during pause, survives a checkpoint, then walks and treats its patient',()=>{
  const {simulation,units,actors,companions,p1}=setup(),id=units[0].id,actor=actors.get(id).actor;
  actor.mesh.position.set(0,0,0);p1.position.set(40,0,0);companions.register(id,{role:'medic'});simulation.paused=true;
  assert.equal(companions.queueOrder(id,{type:'heal',targetPlayerId:'player1'}).queued,true);assert.equal(companions.update(1),false);assert.equal(p1.hp,500);
  const restored=new CompanionLoadouts({simulation,actors,players:()=>[p1],environment:{hasLineOfSight:()=>true}});restored.restore(companions.serialize());
  assert.equal(restored.getState().companions[0].pending.order.type,'heal');simulation.paused=false;
  const manager={battleSimulation:simulation,environment:{resolveAgentMovement(){}}};
  restored.update(.1);maintainBattleFormation(manager,actor,.1,12);assert.ok(actor.mesh.position.x>0 && actor.mesh.position.x<2);
  for(let frame=0;frame<50;frame++){restored.update(.1);maintainBattleFormation(manager,actor,.1,12);}
  assert.equal(p1.hp,610);assert.equal(restored.getState().companions[0].charges.heal,2);assert.equal(restored.getState().companions[0].pending,undefined);
  assert.equal(simulation.units.size,96);
});

test('engineer and scout produce different real, finite effects and suppression expires',()=>{
  const {simulation,config,units,actors,companions}=setup();const [scout,engineer,support]=units;
  for(const [unit,role] of [[scout,'scout'],[engineer,'engineer'],[support,'support']])assert.equal(companions.register(unit.id,{role}).accepted,true);
  const allied=simulation.fronts.get(config.fronts[0].id),hostile=simulation.fronts.get(config.fronts[1].id);allied.sourceHP=700;
  actors.get(engineer.id).actor.mesh.position.set(...[allied.position[0],0,allied.position[1]]);
  assert.equal(companions.command(engineer.id,{type:'repair',frontId:allied.id}).accepted,true);assert.equal(allied.sourceHP,880);
  actors.get(engineer.id).actor.mesh.position.set(hostile.position[0],0,hostile.position[1]);
  assert.equal(companions.command(engineer.id,{type:'sabotage',frontId:hostile.id}).accepted,true);assert.equal(hostile.sourceHP,760);
  actors.get(scout.id).actor.mesh.position.set(hostile.position[0],0,hostile.position[1]);
  const report=companions.command(scout.id,{type:'recon',frontId:hostile.id});assert.equal(report.accepted,true);assert.ok(report.effect.groupIds.length>0);
  const group=simulation.groups.get(report.effect.groupIds[0]);assert.ok(group.revealedUntil>simulation.time);
  actors.get(support.id).actor.mesh.position.set(group.position[0],0,group.position[1]);
  assert.equal(companions.command(support.id,{type:'suppress',targetGroupId:group.id}).accepted,true);assert.ok(formationAttackMultiplier(group,simulation.time)<.6);
  const expires=group.suppressedUntil;advance(simulation,22);assert.ok(simulation.time>expires);assert.ok(formationAttackMultiplier(group,simulation.time)>.6);
  assert.equal(companions.getState().companions.find(entry=>entry.unitId===engineer.id).charges.sabotage,1);assert.equal(simulation.units.size,96);
});

test('two identified hives fight only in their declared scenario and never create extra reserve units',()=>{
  const built=layout(),normal=createBattlefieldOperation(built),config=createHiveConflictScenario(built),simulation=new BattleSimulation(config);
  assert.equal(normal.hiveConflict,undefined);assert.equal(config.hiveConflict.scope,'this-operation-only');
  assert.equal(simulation.factions.get('amber_hive').hiveIdentity,'amber-brood');assert.equal(simulation.areHostile('amber_hive','obsidian_hive'),true);
  const hp=faction=>[...simulation.units.values()].filter(unit=>unit.factionId===faction).reduce((sum,unit)=>sum+unit.hp,0);
  const initial=[hp('amber_hive'),hp('obsidian_hive')],ids=[...simulation.units.keys()];advance(simulation,20);
  assert.ok(hp('amber_hive')<initial[0]);assert.ok(hp('obsidian_hive')<initial[1]);
  simulation.setRelationship('amber_hive','obsidian_hive','neutral','scenario_truce');const after=[hp('amber_hive'),hp('obsidian_hive')];advance(simulation,10);assert.deepEqual([hp('amber_hive'),hp('obsidian_hive')],after);
  assert.deepEqual([...simulation.units.keys()],ids);assert.equal(simulation.assertConservation(),true);
});

test('a red warrior in an ordinary wave no longer attacks its own hive by color alone',()=>{
  class CheapHorde extends XenomorphHorde {createAlienMesh(){return new THREE.Group();}}
  const horde=new CheapHorde(new THREE.Scene(),audio),red=horde.spawnBattleUnit({id:'red',actorType:'red_warrior',factionId:'hive',hp:200,maxHp:200,position:[0,0]}),other=horde.spawnBattleUnit({id:'black',actorType:'warrior',factionId:'hive',hp:200,maxHp:200,position:[1,0]});
  const player={hp:1000,position:new THREE.Vector3(100,0,0),takeDamage(){}};for(let frame=0;frame<120;frame++)horde.update(1/60,player);
  assert.equal(red.hp,200);assert.equal(other.hp,200);horde.clearWave();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { originalMusouSquadRole, ORIGINAL_MUSOU_SQUAD_TEMPLATES }
  from '../js/data/OriginalMusouSquadRoles.js';

const missions=['AFF-06','AFF-07','AFF-08','AFF-09','AFF-10'];
const sourceTemplate=(config,group)=>config.groups.find(spec=>spec.id===group.id)?.sourceTemplateIds?.[0];

test('five original Musou missions distinguish source-audit platoon roles without a new soldier',()=>{
 const tally={};
 for(const mission of missions){
   const config=getBattleOperationConfig(mission),simulation=new BattleSimulation(config);
   const units=[...simulation.units.keys()],digest=simulation.digest;
   try{
     let mapped=0;const bySource={};
     for(const group of simulation.groups.values())for(const id of group.units){
       const unit=simulation.getUnit(id),original=originalMusouSquadRole(config,group,unit);
       if(!original)continue;
       mapped++;bySource[original.sourceGroupId]=(bySource[original.sourceGroupId]??0)+1;
       assert.equal(original.sourceOperationId,mission);
       assert.equal(original.source,'original-musou-audit-proposal');
       assert.equal(original.abilitiesImplemented,false);
       assert.equal(original.visualFidelity1to1Verified,false);
       assert.equal(unit.species,original.species);
       assert.equal(ORIGINAL_MUSOU_SQUAD_TEMPLATES[original.sourceGroupId][original.index].label,original.label);
     }
     tally[mission]=mapped;
     assert.ok(mapped>=8,mission+' must contain mapped source-proposal roles');
     assert.deepEqual([...simulation.units.keys()],units);
     assert.equal(simulation.digest,digest);
     assert.equal(simulation.assertConservation(),true);
     const saved=simulation.saveState(),restored=BattleSimulation.fromState(config,saved);
     try{assert.equal(restored.digest,digest);assert.deepEqual([...restored.units.keys()],units);}
     finally{restored.dispose();}
   }finally{simulation.dispose();}
 }
 assert.equal(Object.keys(tally).length,5);
});

test('original role metadata preserves named commander identity, does not invent one',()=>{
 const config=getBattleOperationConfig('AFF-06'),sim=new BattleSimulation(config);
 try{
   const boss=[...sim.units.values()].find(u=>u.uniqueId);
   assert.ok(boss,'the operation must have an already allocated named commander');
   assert.equal(originalMusouSquadRole(config,sim.groups.get(boss.groupId),boss),null);
   assert.equal(boss.officer,true);
   assert.ok(boss.profileName);
   const group=sim.groups.get(boss.groupId);
   const known=group.units.some(id=>originalMusouSquadRole(config,group,sim.getUnit(id)));
   assert.ok(known,'unnamed escorts still use the source battle role proposal');
 }finally{sim.dispose();}
});

test('other cross-media operations cannot pick contemporary Musou role labels by accident',()=>{
 const config=getBattleOperationConfig('AFF-27'),sim=new BattleSimulation(config);
 try{
   for(const group of sim.groups.values())for(const id of group.units)
     assert.equal(originalMusouSquadRole(config,group,sim.getUnit(id)),null);
 }finally{sim.dispose();}
});

test('a physical battle actor can display its original role without rewriting strategic identity',()=>{
 const config=getBattleOperationConfig('AFF-07'),sim=new BattleSimulation(config);
 try{
   const group=[...sim.groups.values()].find(g=>sourceTemplate(config,g)==='GRP-38');
   assert.ok(group);
   const first=sim.getUnit(group.units[0]);
   const fakeManager={
     spawnBattleUnit(unit){
       return {battleUnitId:unit.id,factionId:unit.factionId,
         mesh:{position:{x:0,y:0,z:0},userData:{}}};
     },despawnBattleUnit(){return true;}
   };
   const game={env:{resolveMovement(){},getElevationAt:()=>0},
     player:null,player2:null,allyRescue:null,horde:null};
   const bridge=Object.create(BattleActorBridge.prototype);
   bridge.game=game;bridge.simulation=sim;bridge.managers={human:fakeManager};
   bridge.actors=new Map();bridge.disposed=false;
   assert.equal(bridge.spawnGroup(group,[first]),true);
   const actor=bridge.actors.get(first.id).actor;
   assert.equal(actor.battleUnitId,first.id);
   assert.equal(actor.profileName,'Chef de sécurité industrielle');
   assert.equal(actor.originalMusouRole.sourceGroupId,'GRP-38');
   assert.equal(actor.mesh.userData.originalMusouRole,'squad_leader');
   assert.equal(sim.getUnit(first.id).profileName,first.profileName);
   assert.equal(sim.units.size,config.groups.reduce((sum,g)=>sum+g.units.length,0));
 }finally{sim.dispose();}
});

test('template labels have coherent squad size and biological species',()=>{
 const human=['GRP-37','GRP-38','GRP-39','GRP-40','GRP-41','GRP-42'];
 for(const id of human){
   const slots=ORIGINAL_MUSOU_SQUAD_TEMPLATES[id];
   assert.equal(slots.length,8,id);
   assert.ok(slots.every(u=>u.species==='human'&&u.label),id);
 }
 assert.equal(ORIGINAL_MUSOU_SQUAD_TEMPLATES['GRP-11'].length,8);
 assert.equal(ORIGINAL_MUSOU_SQUAD_TEMPLATES['GRP-12'].length,2);
 assert.equal(ORIGINAL_MUSOU_SQUAD_TEMPLATES['GRP-13'].length,4);
 for(const id of ['GRP-11','GRP-12','GRP-13'])
   assert.ok(ORIGINAL_MUSOU_SQUAD_TEMPLATES[id].every(x=>x.species==='yautja'),id);
});

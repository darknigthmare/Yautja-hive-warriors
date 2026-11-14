import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { MUSOU_BATTLE_IDENTITY, applyMusouOfficerBreak, buildMusouBattlePulse }
  from '../js/battlefield/MusouBattleFlow.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BATTLE_OPERATIONS, getBattleOperationConfig } from '../js/data/BattleCatalog.js';

const faction=(id,species)=>({id,species});
const front=(id,x)=>({id,position:[x,0],radius:42,owner:id==='front_a'?'player_clan':'hive'});
const group=(id,factionId,frontId,unitCount,officer=false)=>{
 const position=frontId==='front_a'?[4,0]:[104,0];
 return {id,factionId,frontId,position,state:'distant',morale:70,
 units:Array.from({length:unitCount},(_,i)=>({id:`${id}:${i}`,
 profileId:factionId,officer:officer&&i===0}))};
};
function fixture(){
 const groups=[
   group('player_squad','player_clan','front_a',2,true),
   group('marines','allied_marines','front_a',2,true),
   group('hive_leader','hive','front_a',2,true),
   group('hive_far','hive','front_b',1,true)
 ];
 return {id:'musou-officer-test',mode:'original',playerFaction:'player_clan',
 factions:[faction('player_clan','yautja'),faction('allied_marines','human'),
   faction('hive','xenomorph')],
 relations:[{a:'player_clan',b:'allied_marines',state:'allied'},
   {a:'player_clan',b:'hive',state:'hostile'},
   {a:'allied_marines',b:'hive',state:'hostile'}],
 fronts:[front('front_a',0),front('front_b',100)],
 routes:[{id:'ab',from:'front_a',to:'front_b',travelSeconds:12}],
 profiles:[{id:'player_clan',species:'yautja',maxHp:200,damage:15,attackInterval:2},
   {id:'allied_marines',species:'human',maxHp:200,damage:15,attackInterval:2},
   {id:'hive',species:'xenomorph',maxHp:200,damage:15,attackInterval:2}],
 groups,budgets:{active:8,byFaction:{player_clan:{active:2,reserve:0,total:2},
   allied_marines:{active:2,reserve:0,total:2},hive:{active:3,reserve:0,total:3}}},
 objectives:{externalVictory:true},ai:{enabled:false}};
}

test('gameplay identity is hunter action Musou, source-specific Extinction traits are supporting content',()=>{
 assert.equal(MUSOU_BATTLE_IDENTITY.genre,'large-army-action-musou');
 assert.match(MUSOU_BATTLE_IDENTITY.mainLoop,/hunter-action/);
 assert.match(MUSOU_BATTLE_IDENTITY.sourceContentRule,/never replace Musou/);
 assert.equal(MUSOU_BATTLE_IDENTITY.officerBreakMorale,8);
});

test('one confirmed officer loss changes the local battle and raises allied morale once',()=>{
 const sim=new BattleSimulation(fixture());
 try {
   const ids=[...sim.units.keys()],allocated=sim.units.size;
   const before={player:sim.groups.get('player_squad').morale,
     allied:sim.groups.get('marines').morale,enemyFar:sim.groups.get('hive_far').morale};
   const officerId='hive_leader:0';
   assert.equal(sim.recordDeath({entityId:officerId,killerFaction:'player_clan',
     cause:'hunter_melee'}),true);
   assert.equal(sim.groups.get('player_squad').morale,before.player+8);
   assert.equal(sim.groups.get('marines').morale,before.allied+8);
   assert.equal(sim.groups.get('hive_far').morale,before.enemyFar);
   assert.equal(sim.events.filter(e=>e.type==='musou_officer_broken').length,1);
   assert.equal(sim.events.find(e=>e.type==='musou_officer_broken').groups.length,2);
   assert.equal(sim.recordDeath({entityId:officerId,killerFaction:'player_clan'}),false);
   assert.equal(sim.events.filter(e=>e.type==='musou_officer_broken').length,1);
   assert.equal(sim.units.size,allocated);
   assert.deepEqual([...sim.units.keys()],ids);
   assert.equal(sim.assertConservation(),true);
   const saved=sim.saveState(),restored=BattleSimulation.fromState(fixture(),saved);
   try{
     assert.equal(restored.groups.get('player_squad').morale,before.player+8);
     assert.equal(restored.groups.get('marines').morale,before.allied+8);
     assert.equal(restored.getUnit(officerId).state,'dead');
     assert.equal(restored.digest,sim.digest);
   }finally{restored.dispose();}
 }finally{sim.dispose();}
});

test('ordinary losses, neutral encounters and an unknown killer do not give a Musou officer break',()=>{
 const sim=new BattleSimulation(fixture());
 try{
   assert.equal(sim.recordDeath({entityId:'hive_leader:1',killerFaction:'player_clan'}),true);
   assert.equal(sim.groups.get('player_squad').morale,70);
   assert.equal(sim.events.filter(e=>e.type==='musou_officer_broken').length,0);
   assert.equal(sim.recordDeath({entityId:'hive_far:0',killerFaction:null}),true);
   assert.equal(sim.groups.get('marines').morale,70);
   assert.equal(sim.events.filter(e=>e.type==='musou_officer_broken').length,0);
   assert.equal(applyMusouOfficerBreak(sim,{officer:true,killerFaction:'invalid',
     factionId:'hive',groupId:'hive_leader'}),null);
 }finally{sim.dispose();}
});

test('Musou HUD ranks critical front, endangered captain, then contested front without revealing hidden hostiles',()=>{
 const state={playerFaction:'player_clan',
   time:19,criticalFronts:[{frontId:'front_c',deadline:24}],
   fronts:[
     {id:'front_a',label:'Crête nord',position:[0,0],intelState:'reported',
      owner:'player_clan',contested:true},
     {id:'front_b',label:'Arène secrète',position:[200,0],intelState:'unknown',
      owner:'secret_clan',contested:true},
     {id:'front_c',label:'Extraction',position:[70,0],intelState:'reported',
      owner:'hive',contested:true},
     {id:'front_d',label:'Canyon',position:[20,0],intelState:'reported',
      owner:'allied_marines',contested:false}
   ],
   intelCounts:{player_clan:{exact:true},allied_marines:{exact:true},
     hive:{exact:false,knownAlive:4}},
   counts:{player_clan:{active:2,distant:8,reserve:3,dead:1},
     hive:{active:300,distant:400,reserve:800,dead:5}},
   groups:[
     {id:'guard',factionId:'allied_marines',frontId:'front_d',intelState:'observed',
      officerHP:20,officerMaxHP:100},
     {id:'secret',factionId:'hive',frontId:'front_b',intelState:'unknown',
      officerHP:100,officerMaxHP:100},
     {id:'enemy',factionId:'hive',frontId:'front_a',intelState:'reported',
      officerHP:100,officerMaxHP:100}
   ]};
 const original=structuredClone(state),pulse=buildMusouBattlePulse(state,
   [{position:[20,0],hp:100}]);
 assert.deepEqual(pulse.fronts.map(f=>f.id),['front_c','front_d','front_a']);
 assert.equal(pulse.fronts[0].action,'Reprendre le point décisif');
 assert.equal(pulse.fronts[1].action,'Secourir un capitaine allié');
 assert.equal(pulse.fronts[2].action,'Percer la ligne ennemie');
 assert.deepEqual(pulse.playerCombatants,{deployed:10,detailed:2,reserves:3,casualties:1});
 assert.equal(pulse.showEnemyExactCount,false);
 assert.equal(pulse.sourceRtsControlEnabled,false);
 assert.equal(JSON.stringify(state),JSON.stringify(original));
 const hidden=buildMusouBattlePulse({...state,fronts:[state.fronts[1]],groups:[state.groups[1]]},[]);
 assert.equal(hidden.fronts[0].positionKnown,false);
 assert.equal(hidden.fronts[0].observedEnemyGroups,0);
 assert.equal(hidden.fronts[0].ownerKnown,null);
 const blind=buildMusouBattlePulse({...state,
   fronts:[{id:'secret',label:'Zone non reconnue',intelState:'unknown',
     position:null,owner:'hive',contested:true}],groups:[]},
   [{position:[10,0],hp:100}]);
 assert.equal(blind.fronts[0].distanceToHero,null);
 assert.equal(blind.fronts[0].ownerKnown,null);
});

test('the officer break is local: distant allied formations do not receive map-wide morale',()=>{
 const sim=new BattleSimulation(fixture());
 try{
   sim.groups.get('player_squad').position=[1000,0];
   const before=sim.groups.get('player_squad').morale;
   assert.equal(sim.recordDeath({entityId:'hive_leader:0',killerFaction:'player_clan',
     cause:'player_strike'}),true);
   assert.equal(sim.groups.get('player_squad').morale,before);
   assert.equal(sim.groups.get('marines').morale,78);
   assert.deepEqual(sim.events.find(e=>e.type==='musou_officer_broken')?.groups,
     ['marines']);
   assert.equal(sim.assertConservation(),true);
 }finally{sim.dispose();}
});

test('all 27 operations retain their finite, unmodified tactical battle catalogue',()=>{
 for(const row of BATTLE_OPERATIONS){
   const source=getBattleOperationConfig(row.id,{allowHumanController:true});
   const signature=JSON.stringify(source);
   const sim=new BattleSimulation(source);
   try{
     const totals=Object.values(sim.getCounts()).reduce((sum,f)=>sum+f.allocated,0);
     assert.equal(totals,sim.units.size,row.id);
     assert.equal(sim.assertConservation(),true,row.id);
     const pulse=buildMusouBattlePulse(sim.getHUDState(),[]);
     assert.equal(pulse.genre,MUSOU_BATTLE_IDENTITY.genre);
     assert.equal(pulse.sourceRtsControlEnabled,false);
     const second=new BattleSimulation(source);
     try{assert.equal(sim.digest,second.digest,row.id);}finally{second.dispose();}
     assert.equal(JSON.stringify(source),signature,row.id);
   }finally{sim.dispose();}
 }
});

test('27-operation fidelity matrix flags the five actual fallback troop allocations and preserves budget totals',()=>{
 const matrix=JSON.parse(readFileSync(new URL('../docs/audits/2026-10-30/musou-crossmedia-gaps.json',import.meta.url),'utf8'));
 assert.equal(matrix.operationCount,27);
 assert.deepEqual(matrix.operations.map(row=>row.id).sort(),
   BATTLE_OPERATIONS.map(row=>row.id).sort());
 assert.deepEqual(matrix.allocationAudit.inferredBudgetOperationIds,
   ['AFF-06','AFF-07','AFF-08','AFF-09','AFF-10']);
 let sum=0;
 for(const row of matrix.operations){
   const operation=BATTLE_OPERATIONS.find(op=>op.id===row.id);
   assert.equal(row.gameplayMain,'musou-action-fronts-officers');
   assert.equal(row.map.id,operation.mapId);
   assert.deepEqual(row.namedCommanders.map(boss=>boss.id),operation.bossIds);
   const counts=Object.values(row.finiteAllocatedNpc);
   const planned=counts.reduce((total,state)=>total+state.enemy+state.ally,0);
   const configured=getBattleOperationConfig(row.id,{allowHumanController:true});
   const actual=Object.values(configured.budgets.byFaction).reduce((total,faction)=>total+faction.total,0);
   assert.equal(planned,actual,row.id+' budget must reconcile with the simulator');
   assert.equal(row.checks.explicitFrontGroupCompositionConfirmed,
     !matrix.allocationAudit.inferredBudgetOperationIds.includes(row.id),row.id);
   assert.equal(row.checks.physicalMap1to1Confirmed,false,row.id);
   sum+=planned;
 }
 assert.equal(sum,13524);
});

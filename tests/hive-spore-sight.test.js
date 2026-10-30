import test from 'node:test';
import assert from 'node:assert/strict';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { HIVE_SPORE_RULES, updateHiveSporeSight,
  getHiveSporeContacts, restoreHiveSporeSight } from '../js/battlefield/HiveSporeSight.js';

const actor=(id,species,actorType,factionId,groupId,position)=>({
  id,species,actorType,factionId,groupId,position,
  hp:100,maxHp:100,state:'distant',incapacitated:false
});
function fixture(){
  const ecology={banks:[{factionId:'hive',points:0}],nodes:[],sequence:0,spores:[]};
  const units=[
    actor('runner','xenomorph','runner','hive','hive-a',[0,0]),
    actor('marine','human','marine','human_force','human-a',[4,0]),
    actor('other-front','human','marine','human_force','human-b',[4,0]),
    actor('working-joe','synthetic','working_joe','human_force','synthetic-a',[4,0]),
    actor('clan','yautja','clan_hunter','player_clan','clan-a',[10,0])
  ];
  const groups=new Map([
    ['hive-a',{frontId:'front_a'}],['human-a',{frontId:'front_a'}],
    ['human-b',{frontId:'front_b'}],['synthetic-a',{frontId:'front_a'}],
    ['clan-a',{frontId:'front_a'}]
  ]);
  const fronts=new Map([
    ['front_a',{id:'front_a',position:[0,0]}],
    ['front_b',{id:'front_b',position:[70,0]}]
  ]);
  const map=new Map(units.map(unit=>[unit.id,unit]));
  return {ecology,units,groups,fronts,map,hostile:(a,b)=>a!==b};
}

test('only living organic targets within the same front leave timed spore echoes',()=>{
  const f=fixture();
  const current=updateHiveSporeSight(f.ecology,f.units,f.groups,f.fronts,f.hostile,1);
  assert.deepEqual(current.map(c=>c.targetUnitId).sort(),['clan','marine']);
  assert.ok(current.every(c=>c.sourceFaction==='hive'&&c.frontId==='front_a'));
  assert.ok(current.every(c=>c.expiresAt===11));
  assert.equal(getHiveSporeContacts(f.ecology,'human_force',1).length,0,
    'Yautja and human factions may not read hive-only reconnaissance as their own');
  assert.equal(f.units.length,5);
});

test('spore trails freeze last known positions, expire on sim time, and never follow vanished prey',()=>{
  const f=fixture();
  updateHiveSporeSight(f.ecology,f.units,f.groups,f.fronts,f.hostile,2);
  const last=getHiveSporeContacts(f.ecology,'hive',2);
  f.units.find(u=>u.id==='marine').position=[80,0];
  f.units.find(u=>u.id==='clan').position=[80,0];
  updateHiveSporeSight(f.ecology,f.units,f.groups,f.fronts,f.hostile,4);
  const echoes=getHiveSporeContacts(f.ecology,'hive',4);
  assert.deepEqual(echoes,last);
  assert.equal(getHiveSporeContacts(f.ecology,'hive',12.1).length,0);
  updateHiveSporeSight(f.ecology,f.units,f.groups,f.fronts,f.hostile,12.1);
  assert.equal(f.ecology.spores.length,0);
});

test('Hive Nodes, Runners, Praetorians and Queens are real emitters, with finite memory',()=>{
  const f=fixture();
  f.units[0].state='dead';f.units[0].hp=0;
  f.ecology.sequence=1;
  f.ecology.nodes=[{id:'hive-node:hive:1',factionId:'hive',position:[0,0],hp:280}];
  let echoes=updateHiveSporeSight(f.ecology,f.units,f.groups,f.fronts,f.hostile,2);
  assert.equal(echoes.length,2);
  assert.ok(echoes.every(x=>x.emitterId==='hive-node:hive:1'));
  f.ecology.nodes=[];
  for(const [index,role] of ['runner','praetorian','queen'].entries()){
    f.units[0].state='distant';f.units[0].hp=100;f.units[0].actorType=role;
    f.ecology.spores=[];
    echoes=updateHiveSporeSight(f.ecology,f.units,f.groups,f.fronts,f.hostile,3+index);
    assert.equal(echoes.length,2,role);
    assert.ok(echoes.every(x=>x.emitterId==='runner'),role);
  }
});

test('spore count is bounded even with 140 eligible hostiles, and never adds an actor',()=>{
  const f=fixture();
  for(let i=0;i<140;i++){
    const unit=actor('crowd-'+i,'human','marine','human_force','human-a',[(i%10)*.2,(i%9)*.3]);
    f.units.push(unit);f.map.set(unit.id,unit);
  }
  const before=f.map.size;
  updateHiveSporeSight(f.ecology,f.units,f.groups,f.fronts,f.hostile,1);
  assert.equal(f.ecology.spores.length,HIVE_SPORE_RULES.maxContactsPerHive);
  assert.equal(new Set(f.ecology.spores.map(e=>e.targetUnitId)).size,f.ecology.spores.length);
  assert.equal(f.map.size,before);
});

test('checkpoint validator rejects invented contacts, time travel, forgeries and duplicated sightings',()=>{
  const f=fixture();
  const valid=updateHiveSporeSight(f.ecology,f.units,f.groups,f.fronts,f.hostile,2);
  assert.deepEqual(restoreHiveSporeSight(valid,f.ecology,f.map,f.fronts,2),valid);
  const attacks=[
    entries=>{entries[0].expiresAt=Infinity;},
    entries=>{entries[0].observedAt=20;},
    entries=>{entries[0].targetUnitId='invented';},
    entries=>{entries[0].emitterId='invalid';},
    entries=>{entries[0].targetFaction='hive';},
    entries=>{entries[0].position=[10000000,0];},
    entries=>entries.push({...entries[0]})
  ];
  for(const attack of attacks){
    const forged=structuredClone(valid);attack(forged);
    assert.throws(()=>restoreHiveSporeSight(forged,f.ecology,f.map,f.fronts,2),
      /invalid saved hive spore sight/);
  }
  assert.deepEqual(restoreHiveSporeSight(undefined,f.ecology,f.map,f.fronts,2),[],
    'source-v1 checkpoints have no spore history and must restart empty');
});

test('AFF-27 only: actual BattleSimulation samples finite spores, saves them and keeps all identities',()=>{
  const config=getBattleOperationConfig('AFF-27'),sim=new BattleSimulation(config);
  try{
    const source=[...sim.units.values()].find(u=>u.actorType==='runner'&&u.species==='xenomorph'&&u.state==='distant');
    assert.ok(source);
    const frontId=sim.groups.get(source.groupId).frontId;
    const enemy=[...sim.units.values()].find(u=>u.species==='human'&&u.state==='distant' &&
      sim.groups.get(u.groupId).frontId===frontId);
    assert.ok(enemy,'a host must exist on the same front for spore observation');
    enemy.position=[...source.position];
    sim.time=1;sim.tick=4;sim._hiveNodeStep(.25);
    const reports=sim.getHiveSporeContacts(source.factionId);
    assert.ok(reports.some(r=>r.targetUnitId===enemy.id));
    assert.equal(sim.getHiveSporeContacts(sim.config.playerFaction).length,0);
    const modelView=sim.getHiveNodeState({nodesOnly:true});
    assert.deepEqual(Object.keys(modelView),['nodes']);
    assert.ok(!('spores' in modelView),'render snapshots cannot replicate tactical intel on every frame');
    const saved=sim.saveState(),restore=BattleSimulation.fromState(config,saved);
    try{
      assert.deepEqual(restore.getHiveSporeContacts(source.factionId),reports);
      assert.equal(restore.assertConservation(),true);
      assert.equal(restore.units.size,sim.units.size);
      assert.equal(restore.digest,sim.digest);
    }finally{restore.dispose();}
    const forged=structuredClone(saved);
    forged.hiveEcology.spores[0].expiresAt+=11;
    assert.throws(()=>BattleSimulation.fromState(config,forged),
      /invalid saved hive spore sight/);
  }finally{sim.dispose();}
});

test('non-Extinction operations never receive Hive spore intelligence',()=>{
  for(const operationId of ['AFF-01','AFF-13','AFF-16','AFF-25']){
    const sim=new BattleSimulation(getBattleOperationConfig(operationId,{allowHumanController:true}));
    try{
      sim.time=1;sim.tick=4;sim._hiveNodeStep(.25);
      assert.deepEqual(sim.getHiveSporeContacts('hive'),[]);
      assert.deepEqual(sim.getHiveNodeState().spores,[]);
    }finally{sim.dispose();}
  }
});

test('a Hive officer prioritizes a still-tracked spore front, then reverts when its echo is gone',()=>{
  const sim=Object.create(BattleSimulation.prototype),choices=[],events=[];
  sim.time=3;sim.nextStrategicOrder=0;sim.config={playerFaction:'player_clan',
    ai:{enabled:true,interval:10,minimumGarrisonGroups:1,assaultMinRatio:0,targetPreference:'weakest'}};
  sim.factions=new Map([['player_clan',{id:'player_clan',moraleModel:'clan'}],
    ['hive',{id:'hive',moraleModel:'hive'}]]);
  sim.units=new Map([['officer',{id:'officer',hp:200,state:'distant'}],
    ['soldier',{id:'soldier',hp:200,state:'distant'}]]);
  sim.groups=new Map([['squad',{id:'squad',factionId:'hive',
    frontId:'front_a',units:['officer','soldier'],path:[],
    materialized:false,reconstitution:null,officerId:'officer',
    delegated:false,morale:90}]]);
  sim.fronts=new Map([['front_a',{id:'front_a',owner:'player_clan'}],
    ['front_b',{id:'front_b',owner:'human_force'}],
    ['front_c',{id:'front_c',owner:'player_clan'}]]);
  sim.routes=new Map([['ab',{open:true,from:'front_a',to:'front_b'}],
    ['ac',{open:true,from:'front_a',to:'front_c'}]]);
  sim.relationship=(a,b)=>a===b?'allied':'hostile';
  sim.areHostile=(a,b)=>a!==b;
  sim.issueOrder=(id,order)=>{choices.push(order.frontId);return {accepted:true};};
  sim._emit=(type,data)=>events.push({type,data});
  sim.hiveEcology={banks:[{factionId:'hive'}],spores:[
    {sourceFaction:'hive',targetUnitId:'observed-hostile',
      frontId:'front_c',expiresAt:12}]};
  sim._strategicOrders();
  assert.equal(choices[0],'front_c');
  assert.equal(events[0].data.reason,'spore_tracked_hostile_front');
  sim.nextStrategicOrder=0;sim.hiveEcology.spores=[];
  sim._strategicOrders();
  assert.equal(choices[1],'front_b');
  assert.equal(events[1].data.reason,'open_hostile_front');
});

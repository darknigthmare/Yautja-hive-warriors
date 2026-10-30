import test from 'node:test';
import assert from 'node:assert/strict';
import { BATTLE_OPERATIONS, getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { sourceSquadSlots, sourceCommanderSlot, SOURCE_BOSS_SPECIES } from '../js/data/SourceBattleRoster.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';

const groupsOf=(config,sourceId)=>config.groups.filter(group=>group.sourceTemplateIds.includes(sourceId));
const profilesOf=config=>new Map(config.profiles.map(profile=>[profile.id,profile]));
const unitsOf=(config,sourceId)=>groupsOf(config,sourceId).flatMap(group=>group.units.map(unit=>({...unit,profile:profilesOf(config).get(unit.profileId)})));
const boss=(config,id)=>config.groups.flatMap(group=>group.units.map((unit,index)=>({...unit,group,index}))).find(unit=>unit.uniqueId===id);

test('source template resolver never invents or mutates a finite squad',()=>{
  const r=sourceSquadSlots('GRP-44',null,8),j=sourceSquadSlots('GRP-50',null,2);
  assert.equal(r.length,8);assert.equal(j.length,2);
  assert.equal(r.filter(unit=>unit.actorType==='runner').length,7);
  assert.equal(r.filter(unit=>unit.actorType==='spitter').length,1);
  assert.ok(j.every(unit=>unit.species==='synthetic'&&unit.actorType==='working_joe'));
  assert.equal(sourceSquadSlots('GRP-60','H-APPUI',7),null);
  assert.equal(sourceSquadSlots('GRP-60','unknown',8),null);
  assert.equal(sourceSquadSlots('GRP-59','garde',8).length,8);
  assert.equal(sourceCommanderSlot('GRP-59','C-QUEEN','BOS-39',8),7);
  assert.equal(sourceCommanderSlot('GRP-44',null,'BOS-33',8),7);
});

test('all 27 source rosters conserve every ID, squad, allocation and reserve from the legacy factory',()=>{
  for(const operation of BATTLE_OPERATIONS){
    const newer=getBattleOperationConfig(operation.id,{allowHumanController:true});
    const legacy=getBattleOperationConfig(operation.id,{allowHumanController:true,rosterDetail:'legacy'});
    assert.deepEqual(newer.groups.map(group=>({id:group.id,factionId:group.factionId,frontId:group.frontId,
      state:group.state,sourceState:group.sourceState,units:group.units.map(unit=>unit.id)})),
      legacy.groups.map(group=>({id:group.id,factionId:group.factionId,frontId:group.frontId,
        state:group.state,sourceState:group.sourceState,units:group.units.map(unit=>unit.id)})),operation.id);
    assert.deepEqual(newer.budgets,legacy.budgets,operation.id);
    const seen=new Set(),byProfile=profilesOf(newer);
    assert.deepEqual(BattleActorBridge.unsupportedProfiles(newer),[],operation.id);
    for(const group of newer.groups){
      for(const unit of group.units){
        assert.equal(seen.has(unit.id),false,unit.id);seen.add(unit.id);
        assert.ok(byProfile.has(unit.profileId),unit.id);
      }
    }
    const simulation=new BattleSimulation(newer);
    try{assert.equal(simulation.assertConservation(),true,operation.id);}
    finally{simulation.dispose();}
  }
});

test('Sevastopol has two independent xenos and Seegson synthetic forces, not Marine clones',()=>{
  const source=getBattleOperationConfig('AFF-13');
  const legacy=getBattleOperationConfig('AFF-13',{rosterDetail:'legacy'});
  assert.equal(source.factions.find(item=>item.id==='human_force').species,'synthetic');
  assert.ok(unitsOf(source,'GRP-50').every(unit=>unit.profile.actorType==='working_joe'&&unit.profile.species==='synthetic'));
  const key=rel=>[rel.a,rel.b].sort().join('|');
  const relation=source.relations.find(rel=>key(rel)==='hive|human_force');
  assert.equal(relation.state,'neutral');
  assert.equal(legacy.relations.find(rel=>key(rel)==='hive|human_force').state,'hostile');
});

test('LV-895 mixes seven real Runner roles with one Spitter and distinct WY synthetics',()=>{
  const config=getBattleOperationConfig('AFF-16');
  assert.equal(config.factions.find(item=>item.id==='human_force').species,'synthetic');
  for(const group of groupsOf(config,'GRP-44')){
    assert.equal(group.units.length,8);
    const actorTypes=group.units.map(unit=>profilesOf(config).get(unit.profileId).actorType);
    if(!group.units.some(unit=>unit.uniqueId)){
      assert.equal(actorTypes.filter(type=>type==='runner').length,7);
      assert.equal(actorTypes.filter(type=>type==='spitter').length,1);
    }
  }
  assert.ok(unitsOf(config,'GRP-46').every(unit=>unit.profile.actorType==='weyland_combat'));
  assert.equal(boss(config,'BOS-33').index,7);
});

test('Lethe and LV-742 preserve their canonical squad allocations and queen replacement',()=>{
  const lethe=getBattleOperationConfig('AFF-14');
  assert.equal(boss(lethe,'BOS-32').group.sourceTemplateIds[0],'GRP-45');
  const lv=getBattleOperationConfig('AFF-27'), profiles=profilesOf(lv);
  for(const group of groupsOf(lv,'GRP-58')){
    assert.deepEqual(group.units.map(unit=>profiles.get(unit.profileId).sourceRole),
     ['Warrior','Warrior','Warrior','Warrior','Runner','Runner','Drone (Warrior visual proxy)','Facehugger']);
  }
  for(const group of groupsOf(lv,'GRP-59')){
    assert.equal(group.units.length,8);
    const queen=group.units.find(unit=>unit.uniqueId==='BOS-39');
    if(queen){
      assert.equal(group.units.indexOf(queen),7);
      assert.equal(group.units.filter(unit=>unit.officer).length,1);
      assert.equal(profiles.get(queen.profileId).actorType,'queen');
    }else{
      assert.equal(group.units.filter(unit=>profiles.get(unit.profileId).actorType==='praetorian').length,2);
    }
  }
  assert.ok(unitsOf(lv,'GRP-60').some(unit=>unit.profile.species==='synthetic'&&unit.profile.actorType==='synthetic'));
  for(const group of groupsOf(lv,'GRP-61'))assert.equal(group.units.length,4);
  assert.equal(boss(lv,'BOS-39').index,7);
});

test('named commanders target their biological camp instead of a roster-array index',()=>{
  for(const id of ['AFF-11','AFF-12','AFF-16','AFF-27']){
    const config=getBattleOperationConfig(id);
    const factions=new Map(config.factions.map(f=>[f.id,f]));
    const IDs=id==='AFF-11'?['BOS-26','BOS-31']:id==='AFF-12'?['BOS-27','BOS-31']:id==='AFF-16'?['BOS-33']:['BOS-39'];
    for(const bossId of IDs){
      const unit=boss(config,bossId);
      assert.ok(unit,id+'/'+bossId);
      assert.equal(factions.get(unit.group.factionId).species,SOURCE_BOSS_SPECIES[bossId]);
    }
  }
});

test('a saved source or legacy configuration cannot be mistaken for the other',()=>{
  const source=getBattleOperationConfig('AFF-13');
  const legacy=getBattleOperationConfig('AFF-13',{rosterDetail:'legacy'});
  const a=new BattleSimulation(source),b=new BattleSimulation(legacy);
  try{
    const state=a.saveState(),oldState=b.saveState();
    assert.notEqual(a.digest,b.digest);
    const restored=BattleSimulation.fromState(source,state);
    const oldRestored=BattleSimulation.fromState(legacy,oldState);
    try{assert.equal(restored.assertConservation(),true);assert.equal(oldRestored.assertConservation(),true);}
    finally{restored.dispose();oldRestored.dispose();}
    assert.throws(()=>BattleSimulation.fromState(source,oldState),/save does not match/);
    assert.throws(()=>BattleSimulation.fromState(legacy,state),/save does not match/);
  }finally{a.dispose();b.dispose();}
});

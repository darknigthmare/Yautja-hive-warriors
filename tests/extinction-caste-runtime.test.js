import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getCreatureProfileStats, createCreatureModel } from '../js/graphics/CreatureModels.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { validExtinctionCasteUnit, EXTINCTION_CASTE_PROFILES } from '../js/battlefield/ExtinctionCastePolicy.js';

const sourceUnit=(type,index=1)=>({
  id:'allocated-'+type+'-'+index,
  profileId:EXTINCTION_CASTE_PROFILES[type].profileId,
  species:'xeno',actorType:type,factionId:'xeno-hive',groupId:'finite-hive',
  hp:350,maxHp:350,position:[3+index*4,8],role:'heavy',officer:false
});
const group={id:'finite-hive',factionId:'xeno-hive',order:{type:'defend'},
  targetPosition:[6,10],position:[6,10]};

test('Carrier and Ravager have source-specific sculpted silhouettes and consistent LOD profiles',()=>{
  const c=getCreatureProfileStats('carrier'),r=getCreatureProfileStats('ravager');
  assert.equal(c.caste,'carrier');
  assert.equal(r.caste,'ravager');
  assert.equal(c.extinctionTransportSockets,6);
  assert.equal(r.extinctionBladedForelimbs,true);
  assert.equal(c.visualFidelity1to1Verified,false);
  assert.equal(r.visualFidelity1to1Verified,false);
  assert.ok(c.triangles>3000&&r.triangles>3000);
  assert.ok(c.midTriangles<c.triangles);
  assert.ok(r.farTriangles<r.midTriangles);
  const carrier=createCreatureModel('carrier'),ravager=createCreatureModel('ravager');
  assert.ok(carrier.getObjectByName('carrier-dorsal-transport'));
  assert.ok(ravager.getObjectByName('arm-left'));
  assert.ok(ravager.getObjectByName('arm-right'));
  assert.equal(carrier.userData.visualSource,'procedural');
  assert.equal(ravager.userData.visualSource,'procedural');
});

test('exact Extinction profile IDs and LV-742 are required for detailed caste admission',()=>{
  for(const type of ['carrier','ravager']){
    const unit=sourceUnit(type);
    assert.equal(validExtinctionCasteUnit(unit,'AFF-27'),true);
    assert.equal(validExtinctionCasteUnit(unit,'AFF-14'),false);
    assert.equal(validExtinctionCasteUnit({...unit,profileId:'XEN-005'},'AFF-27'),false);
    assert.equal(validExtinctionCasteUnit({...unit,species:'human'},'AFF-27'),false);
    const config={id:'AFF-27',groups:[{units:[{profileId:unit.profileId}]}],
      profiles:[{id:unit.profileId,species:'xeno',actorType:type}]};
    assert.deepEqual(BattleActorBridge.unsupportedProfiles(config),[]);
    assert.deepEqual(BattleActorBridge.unsupportedProfiles({...config,id:'AFF-13'}),[unit.profileId]);
  }
});

test('two allocated source elite identities materialize, with no ghost parasites or duplicate units',()=>{
  const scene=new THREE.Scene(),horde=new XenomorphHorde(scene,null);
  horde.battleSimulation={config:{id:'AFF-27'}};
  const carrier=sourceUnit('carrier'),ravager=sourceUnit('ravager',2);
  try{
    const c=horde.spawnBattleUnit(carrier,group),r=horde.spawnBattleUnit(ravager,group);
    assert.equal(horde.aliens.length,2);
    assert.equal(scene.children.length,2);
    assert.deepEqual(new Set(horde.aliens.map(actor=>actor.battleUnitId)),
      new Set([carrier.id,ravager.id]));
    assert.equal(c.type,'carrier');assert.equal(r.type,'ravager');
    assert.equal(c.damage,12);assert.equal(r.damage,52);
    assert.ok(r.radius>c.radius);
    assert.equal(horde.getActiveCombatants().length,2);
    assert.ok(!horde.aliens.some(a=>a.type==='facehugger'),
      'dorsal sockets cannot spawn facehuggers from nothing');
    assert.equal(horde.spawnBattleUnit(carrier,group),c,'no duplicate ID on rematerialization');
    assert.equal(horde.despawnBattleUnit(carrier.id)?.id,carrier.id);
    assert.equal(horde.despawnBattleUnit(ravager.id)?.id,ravager.id);
    assert.equal(horde.aliens.length,0);
  }finally{horde.clearWave();}
});

test('a wrong-media operation and a forged profile cannot materialize Carrier/Ravager',()=>{
  const horde=new XenomorphHorde(new THREE.Scene(),null);
  try{
    horde.battleSimulation={config:{id:'AFF-14'}};
    assert.throws(()=>horde.spawnBattleUnit(sourceUnit('carrier'),group),/Extinction caste/);
    horde.battleSimulation={config:{id:'AFF-27'}};
    assert.throws(()=>horde.spawnBattleUnit({...sourceUnit('ravager'),profileId:'XEN-005'},group),
      /Extinction caste/);
    assert.equal(horde.aliens.length,0);
  }finally{horde.clearWave();}
});

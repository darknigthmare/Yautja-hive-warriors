import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { advanceCarrierFacehuggerFlight } from '../js/battlefield/ExtinctionCarrierFlight.js';

function fixture(){
  const config=createOperationScene({operationId:'AFF-27',
    extinctionVariant:'carrier-ravager',mapSeed:0}).config;
  const sim=new BattleSimulation(config),scene=new THREE.Scene();
  const horde=new XenomorphHorde(scene,null);
  horde.battleSimulation=sim;
  const source=[...sim.units.values()].find(u=>u.actorType==='carrier'),
    group=sim.groups.get(source.groupId);
  assert.ok(source&&group);
  group.materialized=true;group.state='active';source.state='active';
  const nav={canStand:()=>true,safeSpawnNear:target=>target.clone().add(new THREE.Vector3(2,0,0))};
  const env={navigation:nav,getElevationAt:()=>0,hasLineOfSight:()=>true};
  const game={horde,env,marines:{},allies:{},synthetics:{},bosses:{}};
  const bridge=new BattleActorBridge(game);bridge.simulation=sim;
  const carrier=horde.spawnBattleUnit(source,sim.getGroup(group.id));
  bridge.actors.set(source.id,{actor:carrier,manager:horde,groupId:group.id,unitId:source.id});
  const target={hp:200,position:carrier.mesh.position.clone().add(new THREE.Vector3(10,0,0)),
    factionId:sim.config.playerFaction,radius:1,takeDamage:()=>{}};
  return{sim,scene,horde,bridge,source,carrier,group,target,nav,env,
    dispose(){horde.clearWave();sim.dispose();}};
}
test('visible Carrier ejects a single originally allocated Facehugger into the full battle bridge',()=>{
  const f=fixture();
  try{
    const {sim,source,bridge,carrier,target,horde}=f,allocated=sim.units.size,
      before=sim.getCounts(),first=source.carrierCargoIds[0];
    const result=bridge.launchCarrierFacehugger(carrier,target);
    assert.equal(result.accepted,true);
    assert.equal(result.facehuggerId,first);
    assert.equal(source.carrierCargoIds.length,5);
    assert.equal(sim.units.get(first).carriedByCarrierId,undefined);
    assert.equal(sim.units.get(first).state,'active');
    assert.equal(bridge.actors.get(first).unitId,first);
    assert.equal(horde.aliens.length,2);
    assert.equal(sim.units.size,allocated);
    assert.equal(sim.getCounts()[source.factionId].active,before[source.factionId].active+1);
    const actor=bridge.actors.get(first).actor;
    assert.ok(actor.carrierFlight,'the original identity receives one flight arc');
    const y=actor.mesh.position.y;
    assert.equal(advanceCarrierFacehuggerFlight(actor,.5),true);
    assert.ok(actor.mesh.position.y>y-1);
    assert.equal(advanceCarrierFacehuggerFlight(actor,.5),true);
    assert.equal(actor.carrierFlight,null);
    assert.equal(actor.mesh.position.distanceTo(new THREE.Vector3(
      target.position.x+2,0,target.position.z))<.001,true);
    assert.equal(sim.assertConservation(),true);
  }finally{f.dispose();}
});

test('a blocked physical landing refuses the launch and retains all six original cargo IDs',()=>{
  const f=fixture();
  try{
    const {sim,source,bridge,carrier,target,nav}=f,
      before=sim.saveState(),size=sim.units.size;
    nav.safeSpawnNear=()=>null;
    const result=bridge.launchCarrierFacehugger(carrier,target);
    assert.equal(result.accepted,false);
    assert.deepEqual(sim.saveState(),before);
    assert.equal(sim.units.size,size);
    assert.equal(f.horde.aliens.length,1);
    assert.equal(sim.assertConservation(),true);
  }finally{f.dispose();}
});

test('source carrier projection is atomic and rejects a spent or wrongly owned Cargo unit',()=>{
  const f=fixture();
  try{
    const {sim,source,bridge,carrier,target}=f,first=source.carrierCargoIds[0];
    assert.equal(bridge.launchCarrierFacehugger(carrier,target).accepted,true);
    assert.equal(bridge.launchCarrierFacehugger(carrier,target).accepted,true);
    assert.notEqual(source.carrierCargoIds[0],first);
    assert.equal(sim.units.size,sim.initialAllocated);
    assert.equal(new Set(f.horde.aliens.map(a=>a.battleUnitId)).size,f.horde.aliens.length);
    assert.equal(sim.assertConservation(),true);
  }finally{f.dispose();}
});

test('detailed launch refuses a full near-player actor budget without unloading strategic cargo',()=>{
  const f=fixture();
  try{
    const {sim,bridge,source,carrier,target}=f,
      initial=sim.saveState();
    sim.budgets.active=sim.getActiveUnits().length;
    const result=bridge.launchCarrierFacehugger(carrier,target);
    assert.equal(result.accepted,false);
    assert.deepEqual(sim.saveState(),initial);
    assert.equal(source.carrierCargoIds.length,6);
    assert.equal(sim.assertConservation(),true);
  }finally{f.dispose();}
});

test('released Facehugger saves with original identity, without resurrecting six cargo actors',()=>{
  const f=fixture();
  try{
    const {sim,bridge,carrier,target,source}=f;
    const id=source.carrierCargoIds[0];
    assert.equal(bridge.launchCarrierFacehugger(carrier,target).accepted,true);
    const saved=sim.saveState(),restored=BattleSimulation.fromState(sim.config,saved);
    try{
      assert.equal(restored.units.get(id).carriedByCarrierId,undefined);
      assert.equal(restored.units.get(id).state,'distant',
        'all detailed actors become distant after a scene reload');
      assert.equal(restored.units.get(source.id).carrierCargoIds.length,5);
      assert.equal(restored.units.size,sim.units.size);
      assert.equal(restored.assertConservation(),true);
    }finally{restored.dispose();}
  }finally{f.dispose();}
});

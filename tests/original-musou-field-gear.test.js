import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { originalMusouSquadRole } from '../js/data/OriginalMusouSquadRoles.js';
import { attachOriginalMusouFieldGear } from '../js/graphics/OriginalMusouFieldGear.js';
import { disposeObject } from '../js/engine/SceneResources.js';

const selected=(operationId,sourceId,role)=>{
 const config=getBattleOperationConfig(operationId),sim=new BattleSimulation(config);
 let answer=null;
 for(const group of sim.groups.values()){
   for(const id of group.units){
     const unit=sim.getUnit(id),slot=originalMusouSquadRole(config,group,unit);
     if(slot?.sourceGroupId===sourceId && slot.role===role){answer={config,sim,group,unit,slot};break;}
   }
   if(answer)break;
 }
 if(!answer){sim.dispose();throw new Error(`Missing ${sourceId}/${role}`);}
 return answer;
};
const names=root=>root.children.map(child=>child.name);

test('original contemporary capture and radio squads have different real 3D equipment',()=>{
 const first=selected('AFF-06','GRP-37','capture_specialist');
 const second=selected('AFF-06','GRP-37','radio');
 const capture=new THREE.Group(),radio=new THREE.Group();
 try{
   const c=attachOriginalMusouFieldGear(capture,first.slot);
   const r=attachOriginalMusouFieldGear(radio,second.slot);
   assert.ok(c&&r);
   assert.equal(c.userData.visualFidelity1to1Verified,false);
   assert.equal(r.userData.visualFidelity1to1Verified,false);
   assert.ok(names(c).includes('present-day-body-armor'));
   assert.ok(names(c).includes('capture-coil'));
   assert.ok(!names(c).includes('radio-antenna'));
   assert.ok(names(r).includes('radio-antenna'));
   assert.ok(!names(r).includes('capture-coil'));
   assert.ok(c.children.some(x=>x.isMesh&&x.geometry));
   assert.equal(attachOriginalMusouFieldGear(capture,first.slot),c,
     'reinstall cannot create two captures/vests on the same actor');
   assert.equal(capture.children.length,1);
 }finally{disposeObject(capture);disposeObject(radio);first.sim.dispose();second.sim.dispose();}
});

test('original orbital shield and radio gear are not treated as identical rifleman meshes',()=>{
 const shield=selected('AFF-09','GRP-40','shield_guard');
 const radio=selected('AFF-10','GRP-41','radio');
 const objA=new THREE.Group(),objB=new THREE.Group();
 try{
   const s=attachOriginalMusouFieldGear(objA,shield.slot);
   const r=attachOriginalMusouFieldGear(objB,radio.slot);
   assert.ok(names(s).includes('orbital-shield-prototype'));
   assert.ok(names(r).includes('radio-antenna'));
   assert.ok(!names(s).includes('present-day-body-armor'),
     'future orbital role must not receive present-day industrial vest');
   assert.equal(s.userData.operationalAbilityImplemented,false,
     'visual shield is not falsely described as functional blocking');
   const shieldExtent=new THREE.Box3().setFromObject(objA);
   assert.ok(shieldExtent.min.x<-.5);
 }finally{disposeObject(objA);disposeObject(objB);shield.sim.dispose();radio.sim.dispose();}
});

test('non-source Yautja and alien roles never inherit invented human technology',()=>{
 const original=new THREE.Group();
 try{
   assert.equal(attachOriginalMusouFieldGear(original,{species:'yautja',sourceOperationId:'AFF-06',sourceRole:'scout',visualFidelity1to1Verified:false}),null);
   assert.equal(attachOriginalMusouFieldGear(original,{species:'human',sourceOperationId:'AFF-27',role:'radio',visualFidelity1to1Verified:false}),null);
   assert.equal(attachOriginalMusouFieldGear(original,{species:'human',sourceOperationId:'AFF-06',role:'radio',visualFidelity1to1Verified:true}),null);
   assert.equal(original.children.length,0);
 }finally{disposeObject(original);}
});

test('BattleActorBridge projects original-role gear onto a real mesh without changing the strategic officer',()=>{
 const {sim,config,group,unit,slot}=selected('AFF-06','GRP-37','radio');
 const scene=new THREE.Scene(), created=[];
 const manager={spawnBattleUnit(item){
   const mesh=new THREE.Group();scene.add(mesh);created.push(mesh);
   return {mesh,battleUnitId:item.id,profileName:'Original generic Marine',factionId:item.factionId};
 },despawnBattleUnit(id){created[0]?.removeFromParent();return {id};}};
 const bridge=Object.create(BattleActorBridge.prototype);
 bridge.simulation=sim;bridge.game={env:{resolveMovement(){},getElevationAt:()=>0},player:null,player2:null,allyRescue:null};
 bridge.managers={human:manager};bridge.actors=new Map();bridge.disposed=false;
 try{
   assert.equal(bridge.spawnGroup(group,[unit]),true);
   const actor=bridge.actors.get(unit.id).actor;
   assert.equal(actor.battleUnitId,unit.id);
   assert.equal(actor.profileName,'Radio armé');
   assert.ok(actor.mesh.getObjectByName('radio-antenna'));
   assert.ok(actor.mesh.getObjectByName('present-day-body-armor'));
   assert.equal(actor.mesh.userData.originalMusouRole,'radio');
   assert.equal(sim.getUnit(unit.id).profileName,unit.profileName);
   const second=new BattleSimulation(config);
   try{assert.equal(sim.digest,second.digest);}finally{second.dispose();}
   assert.equal(sim.assertConservation(),true);
 }finally{
   for(const mesh of created)disposeObject(mesh);
   sim.dispose();
 }
});

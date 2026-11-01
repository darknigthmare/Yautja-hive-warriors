import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { planM577Embark } from '../js/battlefield/APCSectionManifest.js';
import { APCMarineService } from '../js/battlefield/APCMarineService.js';
import { M577_DRIVE_POLICY } from '../js/battlefield/APCConvoyDrive.js';
import { BattlefieldNavigation } from '../js/engine/BattlefieldNavigation.js';
import { APCVehicle } from '../js/entities/APCVehicle.js';
import { APC_NAVIGATION } from '../js/graphics/APCModel.js';

const create=()=>new BattleSimulation(getBattleOperationConfig('AFF-27'));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function fixture({blocked=false,owner=true}={}){
  const sim=create();
  const group=[...sim.groups.values()].find(g=>
    sim.factions.get(g.factionId)?.species==='human'&&g.state==='distant'&&
    planM577Embark(sim,g.id,{ownerFaction:g.factionId,frontId:g.frontId,position:g.position}).accepted&&
    [...sim.routes.values()].some(r=>r.from===g.frontId||r.to===g.frontId));
  assert.ok(group,'finite USCM squad next to an existing road required');
  const route=[...sim.routes.values()].find(r=>r.from===group.frontId||r.to===group.frontId),
    target=route.from===group.frontId?route.to:route.from;
  // The standalone scenario fixture explicitly represents allied-held ends;
  // production never rewrites ownership to make an enemy friendly.
  if(owner){
    sim.fronts.get(group.frontId).owner=group.factionId;
    sim.fronts.get(target).owner=group.factionId;
    sim.relations.set([sim.config.playerFaction,group.factionId].sort().join('|'),'allied');
  }
  route.physicalGateIds=[...(route.physicalGateIds??[]),'M577_TEST_GATE'];
  route.physicalRouteId??=null;
  const gates=route.physicalGateIds.map(id=>({id}));
  let gateOpen=true,canStand=!blocked,moved=0;
  const env={
    battlefieldLayout:{gates,strategicRoutes:route.physicalRouteId?
      [{id:route.physicalRouteId,open:true}]:[]},
    isGateOpen:()=>gateOpen,isTacticalRouteAvailable:()=>true,
    navigation:{canStand:()=>canStand,safeSpawnNear:()=>null,gridCache:new Map(),actorPaths:new WeakMap()},
    getElevationAt:()=>0,
    getSectorAt:()=>null,
    colliders:[],
    openGates:new Set()
  };
  const mesh=new THREE.Group();mesh.position.set(group.position[0],0,group.position[1]);
  const apc={mesh,lastPosition:new THREE.Vector3(),policy:{context:{factionId:group.factionId}},
    isSupportActive:()=>true};
  const feedback=[];
  const service=new APCMarineService(apc,sim,env,{feedback:x=>feedback.push(x),onMove:()=>moved++});
  const boarded=service.boardNearest();
  assert.equal(boarded.accepted,true);
  return{sim,route,target,service,apc,feedback,env,group,
    setGate(v){gateOpen=v;},setStand(v){canStand=v;},get moves(){return moved;},
    dispose(){service.dispose();sim.dispose();}};
}
function driveToEnd(f,max=3500){
  let updates=0;
  for(;updates<max&&f.service.drive.active;updates++)f.service.update(.25);
  return updates;
}

test('heavy APC hull ignores only its own collider, never an independent wall or unsupported floor',()=>{
  const env={colliders:[{x:0,z:0,halfWidth:4,halfDepth:4,height:3,owner:'apc'}],
    accessibleBattlefieldRects:()=>[{minX:-20,maxX:20,minZ:-20,maxZ:20}],
    acidTrenches:[],getSectorAt:()=>null,openGates:new Set()};
  const nav=new BattlefieldNavigation(env),point=new THREE.Vector3(0,0,0);
  assert.equal(nav.canStand(point,.6),false);
  assert.equal(nav.canStand(point,.6,{ignoreOwner:'apc'}),true);
  env.colliders.push({x:0,z:0,halfWidth:2,halfDepth:2,height:3,owner:'steel-wall'});
  assert.equal(nav.canStand(point,.6,{ignoreOwner:'apc'}),false);
  assert.equal(nav.canStand(new THREE.Vector3(19.8,0,0),1,{ignoreOwner:'apc'}),false);
});

test('real finite M577 drives a continuous signed adjacent road with no new soldiers or front teleport',()=>{
  const f=fixture();
  try{
    const start=f.apc.mesh.position.clone(),manifest=f.sim.getAPCManifest(),
      ids=[...f.sim.units.keys()],digest=f.sim.digest,counts=f.sim.getCounts();
    const began=f.service.requestTravel(f.target);
    assert.equal(began.accepted,true);
    assert.equal(f.service.getHUDState().travelling,true);
    let previous=f.apc.mesh.position.clone();
    for(let i=0;i<3500&&f.service.drive.active;i++){
      f.service.update(.25);
      assert.ok(f.apc.mesh.position.distanceTo(previous)<=
        M577_DRIVE_POLICY.speed*M577_DRIVE_POLICY.maxDelta+.01);
      previous=f.apc.mesh.position.clone();
    }
    assert.equal(f.service.drive.active,false);
    assert.equal(f.service.drive.lastResult.reason,'arrived');
    assert.ok(f.moves>0);
    assert.ok(f.apc.mesh.position.distanceTo(start)>1);
    assert.equal(f.sim.getAPCManifest().frontId,f.target);
    assert.equal(f.sim.getAPCManifest().transit,undefined);
    assert.deepEqual(f.sim.getCounts(),counts);
    assert.deepEqual([...f.sim.units.keys()],ids);
    assert.equal(f.sim.digest,digest);
    assert.equal(f.sim.assertConservation(),true);
    assert.equal(manifest.crew.length+manifest.passengers.length,
      f.sim.getAPCManifest().crew.length+f.sim.getAPCManifest().passengers.length);
  }finally{f.dispose();}
});

test('closed physical gate stops the convoy without moving any seat and may resume once opened',()=>{
  const f=fixture();
  try{
    assert.equal(f.service.requestTravel(f.target).accepted,true);
    for(let i=0;i<80&&f.service.drive.active&&!f.sim.getAPCManifest().transit;i++)
      f.service.update(.25);
    assert.ok(f.sim.getAPCManifest().transit,'convoy entered its authenticated road');
    const before=f.sim.saveState(),p=f.apc.mesh.position.clone();
    f.setGate(false);
    f.service.update(.25);
    assert.equal(f.service.drive.active,false);
    assert.deepEqual(f.sim.saveState(),before);
    assert.ok(f.apc.mesh.position.equals(p));
    assert.equal(f.service.requestTravel(f.target).accepted,false);
    f.setGate(true);
    assert.equal(f.service.requestTravel(f.target).accepted,true);
    driveToEnd(f);
    assert.equal(f.service.drive.lastResult.reason,'arrived');
    assert.equal(f.sim.assertConservation(),true);
  }finally{f.dispose();}
});

test('no physically supported hull pose refuses movement and preserves the original seated roster',()=>{
  const f=fixture({blocked:true});
  try{
    const before=f.sim.saveState(),p=f.apc.mesh.position.clone();
    assert.equal(f.service.requestTravel(f.target).accepted,true);
    f.service.update(.25);
    assert.equal(f.service.drive.active,false);
    assert.equal(f.service.drive.lastResult.reason,'terrain_or_collision_blocked');
    assert.deepEqual(f.sim.saveState(),before);
    assert.ok(f.apc.mesh.position.equals(p));
    assert.equal(f.sim.assertConservation(),true);
  }finally{f.dispose();}
});

test('travel is a privileged allied service; hostile or missing pilots cannot dispatch free USCM troops',()=>{
  const f=fixture({owner:false});
  try{
    const before=f.sim.saveState(),m=f.sim.getAPCManifest();
    assert.equal(f.service.requestTravel(f.target).accepted,false);
    const r=f.sim.routes.get(f.route.id);
    assert.equal(m.factionId,f.group.factionId);
    assert.equal(r.from===m.frontId||r.to===m.frontId,true);
    assert.deepEqual(f.sim.saveState(),before);
  }finally{f.dispose();}
});

test('a mid-route checkpoint restarts at its actual 3D position and never duplicates crew or passagers',()=>{
  const f=fixture();
  try{
    assert.equal(f.service.requestTravel(f.target).accepted,true);
    for(let i=0;i<200&&f.service.drive.active&&!f.sim.getAPCManifest().transit;i++)
      f.service.update(.25);
    for(let i=0;i<5&&f.service.drive.active;i++)f.service.update(.25);
    const snapshot=f.sim.saveState(),transit=snapshot.apcManifest.transit,
      oldPos=f.apc.mesh.position.clone();
    assert.ok(transit);
    const restored=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),snapshot);
    const other=new THREE.Group();other.position.copy(oldPos);
    const carrier={mesh:other,policy:{context:{factionId:f.group.factionId}},
      isSupportActive:()=>true,lastPosition:new THREE.Vector3()};
    const retry=new APCMarineService(carrier,restored,f.env,{feedback:()=>{}});
    try{
      assert.equal(retry.validateCarrierPosition().accepted,true);
      assert.equal(retry.requestTravel(f.target).accepted,true);
      let last=other.position.clone();
      for(let i=0;i<3500&&retry.drive.active;i++){
        retry.update(.25);
        assert.ok(other.position.distanceTo(last)<=
          M577_DRIVE_POLICY.speed*M577_DRIVE_POLICY.maxDelta+.01);
        last=other.position.clone();
      }
      assert.equal(retry.drive.lastResult.reason,'arrived');
      assert.equal(restored.units.size,f.sim.units.size);
      assert.equal(restored.assertConservation(),true);
      assert.equal(restored.digest,f.sim.digest);
    }finally{retry.dispose();restored.dispose();}
  }finally{f.dispose();}
});

test('a real registered M577 collision object follows the same hull without replacing its identity',()=>{
  const apc=new APCVehicle(new THREE.Scene(),null,null);
  apc.mesh=new THREE.Group();apc.isActive=true;apc.policy={available:true};
  apc.mesh.position.set(2,0,5);
  const collider=apc.getNavigationCollider(),original=collider;
  assert.ok(collider);
  const old=[collider.x,collider.z,collider.rotation];
  apc.mesh.position.set(17,0,11);apc.mesh.rotation.y=Math.PI/3;
  assert.equal(apc.syncNavigationCollider(collider),true);
  assert.equal(collider,original,'the same registered collider is updated in-place');
  assert.notDeepEqual([collider.x,collider.z,collider.rotation],old);
  const expected=new THREE.Vector3(0,0,APC_NAVIGATION.centerZ)
    .applyAxisAngle(new THREE.Vector3(0,1,0),apc.mesh.rotation.y)
    .add(apc.mesh.position);
  assert.ok(Math.abs(collider.x-expected.x)<.001);
  assert.ok(Math.abs(collider.z-expected.z)<.001);
  apc.mesh=null;apc.isActive=false;
});

test('rendered carrier wheels spin after physical convoy movement but freeze on a blocked route',()=>{
  const f=fixture();
  const apc=new APCVehicle(new THREE.Scene(),null,null);
  apc.beginMission({missionId:'m577-wheel-integration',allowed:true,
    factionId:f.group.factionId});
  try{
    const start=f.apc.mesh.position;
    assert.equal(apc.spawn(new THREE.Vector3(start.x,start.y,start.z)),true);
    f.service.apc=apc;
    const before=new THREE.Matrix4(),after=new THREE.Matrix4();
    apc.model.wheelInstances.getMatrixAt(0,before);
    assert.equal(f.service.requestTravel(f.target).accepted,true);
    for(let i=0;i<5&&f.service.drive.active;i++)f.service.update(.25);
    apc.model.wheelInstances.getMatrixAt(0,after);
    assert.ok(!after.equals(before));
    const strategic=f.sim.getAPCManifest(),support=apc.serialize();
    assert.deepEqual(strategic.position,[support.position[0],support.position[2]]);
    f.setStand(false);
    const frozen=new THREE.Matrix4();apc.model.wheelInstances.getMatrixAt(0,frozen);
    f.service.update(.25);
    apc.model.wheelInstances.getMatrixAt(0,after);
    assert.ok(after.equals(frozen));
    assert.equal(f.sim.assertConservation(),true);
  }finally{f.dispose();apc.clear();}
});

test('replacing and clearing a rendered M577 release each owned wheel instance GPU buffer exactly once',()=>{
  const apc=new APCVehicle(new THREE.Scene(),null,null);
  apc.beginMission({missionId:'m577-wheel-disposal',allowed:true,factionId:'human_force'});
  assert.equal(apc.spawn(new THREE.Vector3(0,0,0)),true);
  const old=apc.model.wheelInstances;let oldDisposals=0;
  old.addEventListener('dispose',()=>oldDisposals++);
  assert.equal(apc.spawn(new THREE.Vector3(8,0,0)),true);
  assert.equal(oldDisposals,1,'replacement disposes old instance buffers once');
  const current=apc.model.wheelInstances;let newDisposals=0;
  current.addEventListener('dispose',()=>newDisposals++);
  apc.clear();apc.clear();
  assert.equal(newDisposals,1,'repeated clear never frees instances twice');
  assert.equal(apc.model,null);
  assert.equal(apc.mesh,null);
});

test('M577 swept 3x3 hull rejects a thin wall between two clear endpoint poses',()=>{
  const f=fixture();
  try{
    const start=f.apc.mesh.position.clone(),before=f.sim.saveState();
    const stripe=start.z+M577_DRIVE_POLICY.stepLength/2;
    // The two endpoints are walkable, but a narrow threshold intersects
    // the middle of the vehicle's real swept volume.
    f.env.navigation.canStand=sample=>Math.abs(sample.z-stripe)>.025;
    const target=[start.x,start.z+M577_DRIVE_POLICY.stepLength];
    assert.equal(f.service.drive._canOccupy(start,0),true);
    assert.equal(f.service.drive._canOccupy(
      new THREE.Vector3(target[0],start.y,target[1]),0),true);
    assert.equal(f.service.drive._moveToward(target,M577_DRIVE_POLICY.stepLength),false);
    assert.ok(f.apc.mesh.position.equals(start));
    assert.deepEqual(f.sim.saveState(),before);
    assert.equal(f.sim.assertConservation(),true);
  }finally{f.dispose();}
});

test('a clear M577 hull sweep preserves the finite USCM roster and admitted position',()=>{
  const f=fixture();
  try{
    const start=f.apc.mesh.position.clone(),count=f.sim.units.size;
    const target=[start.x,start.z+M577_DRIVE_POLICY.stepLength];
    assert.equal(f.service.drive._moveToward(target,M577_DRIVE_POLICY.stepLength),true);
    assert.ok(Math.abs(f.apc.mesh.position.z-target[1])<1e-9);
    assert.equal(f.sim.units.size,count);
    assert.equal(f.sim.assertConservation(),true);
  }finally{f.dispose();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { canBoardM577Unit, canCrewM577Unit, planM577Embark, validateM577CarrierCheckpoint, m577RouteWaypoints, m577PositionOnRoute, APC_SECTION_RULES }
  from '../js/battlefield/APCSectionManifest.js';
import { APCMarineService } from '../js/battlefield/APCMarineService.js';

const create=()=>new BattleSimulation(getBattleOperationConfig('AFF-27'));
const living=unit=>unit.hp>0&&['active','distant'].includes(unit.state);
const choose=simulation=>{
  const group=[...simulation.groups.values()].find(group=>
    simulation.factions.get(group.factionId)?.species==='human'&&
    group.state==='distant'&&!group.materialized&&
    group.units.length<=APC_SECTION_RULES.passengerSeats&&
    planM577Embark(simulation,group.id,{
      ownerFaction:group.factionId,frontId:group.frontId,position:group.position
    }).accepted);
  assert.ok(group,'source roster needs an existing finite USCM group that fits a M577');
  return {group,ownerFaction:group.factionId,position:[...group.position],frontId:group.frontId};
};
const board=(simulation)=>{
  const selection=choose(simulation);
  const result=simulation.boardAPC(selection.group.id,selection);
  assert.equal(result.accepted,true);
  return {selection,result,manifest:simulation.getAPCManifest()};
};
const seats=(manifest)=>[...manifest.crew,...manifest.passengers].map((unitId,i)=>({
  unitId,position:[manifest.position[0]+5.4,manifest.position[1]-5+i*1.8]
}));
function mockedService(simulation,selection,{floor=()=>0,canStand=()=>true}={}){
  const mesh=new THREE.Group();mesh.position.set(selection.position[0],0,selection.position[1]);
  const apc={mesh,policy:{context:{factionId:selection.ownerFaction}},
    isSupportActive(){return true;}};
  const env={getElevationAt:floor,getSectorAt:()=>null,
    hasLineOfSight:()=>true,
    navigation:{canStand,safeSpawnNear(point,radius,occupied){
      if(!canStand(point))return null;
      if(occupied.some(other=>Math.hypot(other.position.x-point.x,
        other.position.z-point.z)<radius+(other.radius??.8)+.25))return null;
      return point.clone();
    }}};
  const messages=[];
  const service=new APCMarineService(apc,simulation,env,{feedback:x=>messages.push(x)});
  return {apc,env,service,messages};
}

test('M577 carries a finite already-allocated USCM section: 12 passenger slots and independent crew',()=>{
  const simulation=create();
  try{
    const before=simulation.getCounts(),ids=[...simulation.units.keys()],{selection,result,manifest}=board(simulation);
    assert.ok(result.passengers.length>0&&result.passengers.length<=12);
    assert.equal(APC_SECTION_RULES.passengerSeats,12);
    assert.equal(APC_SECTION_RULES.crewPositions,2);
    assert.deepEqual(manifest.passengers,result.passengers);
    assert.deepEqual(manifest.crew,result.crew);
    assert.ok(manifest.crew.length<=2&&manifest.crew.length>0);
    assert.equal(manifest.passengers.length+manifest.crew.length,selection.group.units.length);
    assert.equal(simulation.groups.get(selection.group.id).apcCarrierId,'m577-apc');
    assert.deepEqual(manifest.passengers.map(id=>simulation.units.get(id).apcSeat),
      manifest.passengers.map((_,i)=>i));
    assert.deepEqual(manifest.crew.map(id=>simulation.units.get(id).apcCrewRole),
      ['driver','commander'].slice(0,manifest.crew.length));
    assert.equal(simulation._detailStep()??undefined,undefined);
    assert.equal(simulation.groups.get(selection.group.id).materialized,false);
    assert.equal(simulation.issueOrder(selection.group.id,{type:'attack',frontId:selection.frontId}).reason,'group_aboard_apc');
    assert.equal(simulation.getAPCManifest().passengers.length,result.passengers.length);
    assert.deepEqual(simulation.getCounts(),before,'passengers retain their original unit states');
    assert.deepEqual([...simulation.units.keys()],ids);
    assert.equal(simulation.assertConservation(),true);
  }finally{simulation.dispose();}
});

test('embarked Marines do not attack offscreen or capture a front, and no second group can board',()=>{
  const simulation=create();
  try{
    const {selection,manifest}=board(simulation);
    const first=manifest.passengers[0],u=simulation.units.get(first),attackBefore=u.nextAttack;
    const driver=simulation.units.get(manifest.crew[0]),driverAttackBefore=driver.nextAttack;
    const deathCount=simulation.deaths.size,front=simulation.fronts.get(selection.frontId);
    assert.equal(simulation.recordDeath({entityId:first,killerFaction:'hive',
      cause:'impossible_remote_hit_through_apc'}),false,
      'a seated Marine is protected by the hull until APC destruction');
    const captureBefore=structuredClone(front.capture);
    simulation.time+=.25;simulation._remoteCombat();simulation._captureStep(.25);
    assert.equal(u.nextAttack,attackBefore);
    assert.equal(driver.nextAttack,driverAttackBefore);
    assert.deepEqual([...simulation.units.keys()].length,simulation.initialAllocated);
    assert.equal(simulation.deaths.size,deathCount);
    const next=simulation.boardAPC(selection.group.id,selection);
    assert.equal(next.accepted,false);
    assert.deepEqual(simulation.apcManifest.passengers,manifest.passengers);
    assert.equal(simulation.assertConservation(),true);
    assert.ok(Object.keys(front.capture).length>=Object.keys(captureBefore).length,
      'other front actors may still capture; the APC contributes no combatReady units');
  }finally{simulation.dispose();}
});

test('M577 manifest persists through an exact BattleSimulation save while legacy checkpoints remain valid',()=>{
  const simulation=create();
  try{
    const {selection,manifest}=board(simulation);
    const saved=simulation.saveState(),restored=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),saved);
    try{
      assert.deepEqual(restored.getAPCManifest(),manifest);
      assert.equal(restored.digest,simulation.digest);
      assert.equal(restored.units.size,simulation.units.size);
      assert.deepEqual(restored.getCounts(),simulation.getCounts());
      assert.equal(restored.assertConservation(),true);
    }finally{restored.dispose();}
    const old=create();
    try{
      const previous=old.saveState();
      delete previous.apcManifest;
      const compatible=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),previous);
      try{assert.equal(compatible.getAPCManifest(),null);assert.equal(compatible.assertConservation(),true);}
      finally{compatible.dispose();}
    }finally{old.dispose();}
  }finally{simulation.dispose();}
});

test('forged seats, nonexistent soldiers and unauthorized group pointers are rejected at checkpoint restore',()=>{
  const simulation=create();
  try{
    const {manifest}=board(simulation),base=simulation.saveState();
    const mutations=[
      data=>data.apcManifest.passengers.push('invented'),
      data=>data.units.find(u=>u.id===manifest.passengers[0]).apcSeat=11,
      data=>data.units.find(u=>u.id===manifest.crew[0]).apcCrewRole='engineer',
      data=>data.apcManifest.passengers.push(manifest.passengers[0]),
      data=>data.apcManifest.groupId='unknown-group',
      data=>data.apcManifest.position=[Infinity,0],
      data=>data.apcManifest.boardedAt=data.time+40,
      data=>{data.apcManifest.position=[8000,8000];
        const group=data.groups.find(g=>g.id===manifest.groupId);
        group.position=[8000,8000];
        for(const unit of data.units)if([...manifest.crew,...manifest.passengers].includes(unit.id))
          unit.position=[8000,8000];},
      data=>data.apcManifest.ownerFaction='player_clan',
      data=>data.groups.find(g=>g.id===manifest.groupId).apcCarrierId=null,
      data=>{data.apcManifest=null;},
      data=>{data.units.find(u=>u.id===manifest.passengers[0]).factionId='hive';}
    ];
    for(const mutate of mutations){
      const fake=structuredClone(base);mutate(fake);
      assert.throws(()=>BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),fake),
        /invalid saved APC marine manifest|save rewrites an allocated identity/);
    }
  }finally{simulation.dispose();}
});

test('USCM boarding is denied to synthetics, armored Exosuits, infected and hostile factions',()=>{
  const sim=create();
  try{
    const {group,ownerFaction,frontId,position}=choose(sim);
    assert.equal(sim.boardAPC(group.id,{ownerFaction:'player_clan',frontId,position}).accepted,false,
      'hostile Yautja cannot magically command USCM APC passengers');
    const unit=sim.units.get(group.units[0]);
    const before=unit.incapacitated;
    unit.incapacitated=true;
    assert.equal(sim.boardAPC(group.id,{ownerFaction,frontId,position}).accepted,false);
    unit.incapacitated=before;
    assert.equal(sim.getAPCManifest(),null);
    assert.equal(canBoardM577Unit({...unit,species:'synthetic'}),false);
    assert.equal(canBoardM577Unit({...unit,actorType:'synthetic'}),false);
    assert.equal(canCrewM577Unit({...unit,actorType:'synthetic',species:'synthetic'}),true);
    assert.equal(canBoardM577Unit({...unit,apcSeat:0}),false);
    const oversized={...group,units:Array.from({length:15},(_,i)=>group.units[0])};
    sim.groups.set('oversized',{...oversized,id:'oversized'});
    assert.equal(planM577Embark(sim,'oversized',{ownerFaction,frontId,position}).accepted,false);
    sim.groups.delete('oversized');
    assert.equal(sim.assertConservation(),true);
  }finally{sim.dispose();}
});

test('safe APC disembark returns the same survivors to the same battle with finite, distinct positions',()=>{
  const sim=create(),selection=choose(sim);
  const f=mockedService(sim,selection);
  try{
    const boarded=f.service.boardNearest();
    assert.equal(boarded.accepted,true);
    const manifest=sim.getAPCManifest();
    assert.equal(sim.groups.get(manifest.groupId).factionId,selection.ownerFaction);
    const before=sim.units.size,roundTrip=sim.digest;
    const disembarked=f.service.disembark();
    assert.equal(disembarked.accepted,true);
    assert.equal(disembarked.passengerCount,manifest.passengers.length);
    assert.equal(disembarked.occupantCount,manifest.passengers.length+manifest.crew.length);
    assert.equal(sim.getAPCManifest(),null);
    for(const id of [...manifest.crew,...manifest.passengers]){
      assert.equal(sim.units.get(id).apcSeat,undefined);
      assert.equal(sim.units.get(id).apcCrewRole,undefined);
      assert.equal(sim.units.get(id).state,'distant');
      assert.ok(sim.units.get(id).hp>0);
    }
    assert.equal(sim.units.size,before);assert.equal(sim.digest,roundTrip);
    assert.equal(sim.assertConservation(),true);
    assert.ok(f.messages.some(x=>x.includes('embarqué')));
    assert.ok(f.messages.some(x=>x.includes('débarqués')));
  }finally{f.service.dispose();sim.dispose();}
});

test('blocked exits prevent ALL disembarkation and preserve seats and soldiers',()=>{
  const sim=create(),selection=choose(sim);
  const f=mockedService(sim,selection),countsBefore=sim.getCounts();
  try{
    assert.equal(f.service.boardNearest().accepted,true);
    const before=sim.saveState(),manifest=sim.getAPCManifest();
    f.env.navigation.canStand=()=>false;
    const answer=f.service.disembark();
    assert.equal(answer.accepted,false);
    assert.equal(answer.reason,'no_safe_marine_dismount');
    assert.deepEqual(sim.getAPCManifest(),manifest);
    assert.deepEqual(sim.getCounts(),countsBefore);
    assert.equal(sim.units.size,before.units.length);
    assert.equal(sim.assertConservation(),true);
  }finally{f.service.dispose();sim.dispose();}
});

test('destroying a loaded APC records exactly the real passenger casualties, once, with no replacement',()=>{
  const sim=create();
  try{
    const {manifest}=board(sim),before=sim.units.size,deaths=sim.deaths.size;
    const lost=sim.destroyAPCManifest(null);
    assert.equal(lost.accepted,true);
    assert.equal(lost.passengerCount,manifest.passengers.length);
    assert.equal(lost.occupantCount,manifest.passengers.length+manifest.crew.length);
    assert.equal(sim.getAPCManifest(),null);
    assert.equal(sim.deaths.size,deaths+manifest.passengers.length+manifest.crew.length);
    for(const unitId of [...manifest.crew,...manifest.passengers]){
      const soldier=sim.getUnit(unitId);
      assert.equal(soldier.state,'dead');
      assert.equal(soldier.hp,0);
      assert.equal(soldier.apcSeat,undefined);
      assert.equal(soldier.apcCrewRole,undefined);
      assert.equal(sim.deaths.get(unitId).cause,'m577_apc_destroyed_with_passengers');
    }
    assert.equal(sim.destroyAPCManifest(null).accepted,false);
    assert.equal(sim.units.size,before);
    assert.equal(sim.assertConservation(),true);
    const roundTrip=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),sim.saveState());
    try{assert.equal(roundTrip.deaths.size,sim.deaths.size);assert.equal(roundTrip.getAPCManifest(),null);}
    finally{roundTrip.dispose();}
  }finally{sim.dispose();}
});

test('carrier positions are updated only in bounded same-front steps without independent troop traversal',()=>{
  const sim=create();
  try{
    const {selection,manifest}=board(sim),before=sim.digest;
    const pos=[manifest.position[0]+1,manifest.position[1]+2];
    assert.equal(sim.moveAPCManifest(pos),true);
    assert.deepEqual(sim.groups.get(selection.group.id).position,pos);
    for(const id of manifest.passengers)assert.deepEqual(sim.units.get(id).position,pos);
    assert.equal(sim.moveAPCManifest([pos[0]+50,pos[1]]),false);
    assert.equal(sim.digest,before);
    const saved=sim.saveState(),reloaded=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),saved);
    try{assert.deepEqual(reloaded.getAPCManifest().position,pos);assert.equal(reloaded.assertConservation(),true);}
    finally{reloaded.dispose();}
  }finally{sim.dispose();}
});

test('M577 checkpoint refuses missing, undeployed or displaced carrier without changing finite identities',()=>{
  const sim=create();
  try{
    const {manifest}=board(sim),start=sim.saveState(),before=sim.units.size;
    const carrier={version:1,deployed:true,
      position:[manifest.position[0],0,manifest.position[1]]};
    const valid={version:1,apc:carrier};
    assert.equal(validateM577CarrierCheckpoint(manifest,valid),true);
    assert.equal(validateM577CarrierCheckpoint(null,null),true,
      'legacy snapshots without occupied M577 still load');
    for(const unsafe of [null,{version:1},{...valid,apc:{...carrier,deployed:false}},
      {...valid,apc:{...carrier,position:[carrier.position[0]+2,0,carrier.position[2]]}},
      {...valid,apc:{...carrier,position:[Infinity,0,carrier.position[2]]}},
      {...valid,apc:{...carrier,position:[carrier.position[0],0]}}]){
      assert.equal(validateM577CarrierCheckpoint(manifest,unsafe),false);
    }
    assert.deepEqual(sim.saveState(),start);
    assert.equal(sim.units.size,before);
    assert.equal(sim.assertConservation(),true);
  }finally{sim.dispose();}
});

test('M577 cannot disembark a squad from an unsynchronised hull; a bounded movement restores coherence',()=>{
  const sim=create(),selection=choose(sim),f=mockedService(sim,selection);
  try{
    assert.equal(f.service.boardNearest().accepted,true);
    const initial=sim.saveState(),manifest=sim.getAPCManifest();
    assert.equal(f.service.validateCarrierPosition().accepted,true);
    f.apc.mesh.position.x+=2;
    assert.equal(f.service.validateCarrierPosition().reason,'carrier_manifest_position_mismatch');
    const denied=f.service.disembark();
    assert.equal(denied.accepted,false);
    assert.equal(denied.reason,'carrier_manifest_position_mismatch');
    assert.deepEqual(sim.saveState(),initial,
      'an invalid physical exit never alters a seated soldier or its save');
    assert.equal(sim.moveAPCManifest([manifest.position[0]+2,manifest.position[1]]),true);
    assert.equal(f.service.validateCarrierPosition().accepted,true);
    assert.equal(f.service.disembark().accepted,true);
    assert.equal(sim.getAPCManifest(),null);
    assert.equal(sim.assertConservation(),true);
  }finally{f.service.dispose();sim.dispose();}
});

test('sequential finite APC moves stop at a front boundary and remain restorable',()=>{
  const sim=create();
  try{
    const {manifest}=board(sim),front=sim.fronts.get(manifest.frontId);
    const before=sim.units.size,signature=sim.digest;
    const delta=[manifest.position[0]-front.position[0],
      manifest.position[1]-front.position[1]];
    const magnitude=Math.hypot(...delta);
    const unit=magnitude>0.01?delta.map(x=>x/magnitude):[1,0];
    let successful=0,refused=false;
    for(let i=0;i<250;i++){
      const current=sim.getAPCManifest().position;
      const next=[current[0]+unit[0]*4,current[1]+unit[1]*4];
      if(!sim.moveAPCManifest(next)){refused=true;break;}
      successful++;
    }
    assert.equal(refused,true,'repeated 4-unit steps must not walk beyond the front');
    assert.ok(successful>0);
    const saved=sim.saveState();
    assert.ok(Math.hypot(saved.apcManifest.position[0]-front.position[0],
      saved.apcManifest.position[1]-front.position[1])<=front.radius+15);
    const reloaded=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),saved);
    try{
      assert.deepEqual(reloaded.getAPCManifest(),sim.getAPCManifest());
      assert.equal(reloaded.digest,signature);
      assert.equal(reloaded.units.size,before);
      assert.equal(reloaded.assertConservation(),true);
    }finally{reloaded.dispose();}
  }finally{sim.dispose();}
});

test('road transit preserves finite USCM identities and checkpoint geometry between front circles',()=>{
  const sim=create();
  try{
    const {manifest}=board(sim),route=[...sim.routes.values()]
      .find(row=>row.from===manifest.frontId||row.to===manifest.frontId);
    assert.ok(route,'the signed battle has a source-connected road');
    const target=route.from===manifest.frontId?route.to:route.from;
    const path=route.from===manifest.frontId?route.waypoints:[...route.waypoints].reverse();
    const anchor=path[0], start=sim.getAPCManifest().position;
    const approach=Math.ceil(Math.hypot(anchor[0]-start[0],anchor[1]-start[1])/3);
    for(let i=1;i<=approach;i++){
      const current=sim.getAPCManifest().position;
      const remaining=Math.hypot(anchor[0]-current[0],anchor[1]-current[1]);
      const move=Math.min(3,remaining);
      if(remaining>0.001)assert.equal(sim.moveAPCManifest([
        current[0]+(anchor[0]-current[0])/remaining*move,
        current[1]+(anchor[1]-current[1])/remaining*move]),true);
    }
    assert.equal(sim.beginAPCTransit(route.id,target),true);
    assert.equal(sim.disembarkAPC([],manifest.frontId).accepted,false);
    let sampled=false;
    for(let segment=1;segment<path.length;segment++){
      const a=path[segment-1],b=path[segment],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const steps=Math.max(1,Math.ceil(length/2));
      for(let step=1;step<=steps;step++){
        const next=[a[0]+(b[0]-a[0])*step/steps,a[1]+(b[1]-a[1])*step/steps];
        assert.equal(sim.moveAPCManifest(next),true);
        if(!sampled&&segment===1&&step>=Math.floor(steps/2)){
          const current=sim.saveState(),restored=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),current);
          try{assert.deepEqual(restored.getAPCManifest(),sim.getAPCManifest());
            assert.equal(restored.assertConservation(),true);}finally{restored.dispose();}
          sampled=true;
        }
      }
    }
    assert.equal(sim.completeAPCTransit(),true);
    assert.equal(sim.getAPCManifest().frontId,target);
    assert.equal(sim.getAPCManifest().transit,undefined);
    assert.equal(sim.units.size,sim.initialAllocated);
    assert.equal(sim.assertConservation(),true);
  }finally{sim.dispose();}
});

test('transit route identity, geometry and gate state are validated rather than enabling teleports',()=>{
  const sim=create();
  try{
    const {manifest}=board(sim),route=[...sim.routes.values()]
      .find(row=>row.from===manifest.frontId||row.to===manifest.frontId);
    const target=route.from===manifest.frontId?route.to:route.from;
    const base=sim.saveState();
    const fake=structuredClone(base);
    fake.apcManifest.transit={routeId:'invalid',fromFrontId:manifest.frontId,toFrontId:target};
    assert.throws(()=>BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),fake),
      /invalid saved APC marine manifest/);
    route.open=false;
    assert.equal(sim.beginAPCTransit(route.id,target),false);
    route.open=true;
    sim.routeAvailabilityProvider=()=>false;
    assert.equal(sim.beginAPCTransit(route.id,target),false);
    assert.equal(sim.assertConservation(),true);
    assert.equal(m577PositionOnRoute([9999,9999],route.waypoints),false);
    assert.equal(m577RouteWaypoints(sim,{routeId:route.id,fromFrontId:manifest.frontId,toFrontId:'FAKE'},manifest.frontId),null);
  }finally{sim.dispose();}
});

test('legitimate M577 post-boarding incapacitation survives a signed checkpoint with every finite seat intact',()=>{
  const simulation=create();
  try{
    const {manifest}=board(simulation);
    const passengerId=manifest.passengers[0],driverId=manifest.crew[0],
      counts=simulation.getCounts(),allocated=simulation.units.size;
    assert.ok(passengerId&&driverId);
    simulation.units.get(passengerId).incapacitated=true;
    simulation.units.get(driverId).incapacitated=true;
    const saved=simulation.saveState(),restored=BattleSimulation.fromState(
      getBattleOperationConfig('AFF-27'),saved);
    try{
      assert.equal(restored.units.get(passengerId).incapacitated,true);
      assert.equal(restored.units.get(driverId).incapacitated,true);
      assert.deepEqual(restored.getAPCManifest(),manifest);
      assert.deepEqual(restored.getCounts(),counts);
      assert.equal(restored.units.size,allocated);
      assert.equal(restored.assertConservation(),true);
      const origin={ownerFaction:manifest.ownerFaction,frontId:manifest.frontId,
        position:[...manifest.position]};
      const {service}=mockedService(restored,origin);
      try{
        assert.equal(service.drive._driverReady(restored.getAPCManifest()),false);
        assert.equal(service.requestTravel(manifest.frontId).reason,'real_driver_required');
        restored.units.get(driverId).incapacitated=false;
        assert.equal(service.drive._driverReady(restored.getAPCManifest()),true,
          'the same allocated driver recovers without a replacement');
      }finally{service.dispose();}
    }finally{restored.dispose();}
  }finally{simulation.dispose();}
});

test('M577 checkpoint must restore at the actual measured deck, not float above the same XZ point',()=>{
  const simulation=create();
  try{
    const {manifest}=board(simulation),p=manifest.position;
    const supports={version:1,apc:{version:1,deployed:true,
      position:[p[0],3,p[1]]}};
    const deck={getElevationAt:()=>3};
    assert.equal(validateM577CarrierCheckpoint(manifest,supports,deck),true);
    assert.equal(validateM577CarrierCheckpoint(manifest,supports,{
      getElevationAt:()=>0}),false);
    assert.equal(validateM577CarrierCheckpoint(manifest,supports,{
      getElevationAt:()=>Infinity}),false);
    assert.equal(validateM577CarrierCheckpoint(manifest,supports,{
      getElevationAt:()=>{throw new Error('missing deck');}}),false);
    assert.equal(validateM577CarrierCheckpoint(manifest,supports),true,
      'legacy headless support fixtures without geometry are backward-compatible');
    const fake=structuredClone(supports);
    fake.apc.position[1]=300;
    assert.equal(validateM577CarrierCheckpoint(manifest,fake,deck),false);
    assert.equal(simulation.assertConservation(),true);
  }finally{simulation.dispose();}
});

test('loaded M577 live support rejects same-XZ wrong-floor poses before saving or unloading',()=>{
  const sim=create();
  try{
    const {selection,manifest}=board(sim),{apc,env,service}=mockedService(sim,selection,{
      floor:()=>4});
    try{
      apc.mesh.position.y=4;
      assert.equal(service.validateCarrierPosition().accepted,true);
      apc.mesh.position.y=22;
      assert.equal(service.validateCarrierPosition().reason,'carrier_floor_mismatch');
      assert.equal(service.getHUDState().available,false);
      assert.equal(service.disembark().accepted,false);
      assert.deepEqual(sim.getAPCManifest(),manifest);
      apc.mesh.position.y=4;
      assert.equal(service.validateCarrierPosition().accepted,true);
    }finally{service.dispose();}
  }finally{sim.dispose();}
});

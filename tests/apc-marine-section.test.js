import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { canBoardM577Unit, canCrewM577Unit, planM577Embark, APC_SECTION_RULES }
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

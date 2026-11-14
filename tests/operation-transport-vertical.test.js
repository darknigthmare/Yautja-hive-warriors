import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OperationTransport } from '../js/entities/OperationTransport.js';

function fixture({ elevation = () => 0, canStand = () => true } = {}) {
  let gateOpen = true, bridgeIntact = true;
  const physicalRoute = {id:'actual-corridor',open:true};
  const route = {id:'front-a-to-front-b',from:'a',to:'b',open:true,
    physicalRouteId:physicalRoute.id,physicalGateIds:['actual-gate'],
    travelSeconds:12,waypoints:[[0,0],[100,0]]};
  const env = {
    battlefieldLayout:{gates:[{id:'actual-gate'}],strategicRoutes:[physicalRoute]},
    isGateOpen:()=>gateOpen,isTacticalRouteAvailable:()=>bridgeIntact,
    getElevationAt(x,z){return elevation(x,z);},
    resolveMovement(){},
    navigation:{canStand(position,radius){return canStand(position,radius);}}
  };
  const fronts=new Map([
    ['a',{id:'a',label:'Insertion',position:[0,0],owner:'clan',radius:30,contested:false}],
    ['b',{id:'b',label:'Relais',position:[100,0],owner:'clan',radius:30,contested:false}]
  ]);
  const simulation={config:{playerFaction:'clan'},result:null,disposed:false,
    relationship:(a,b)=>a===b?'allied':'hostile',areHostile:(a,b)=>a!==b,
    fronts,routes:new Map([[route.id,route]]),groups:new Map(),units:new Map()};
  const position=new THREE.Vector3(0,.5,0);
  const skimmer={position:position.clone(),mesh:new THREE.Group(),speed:32,isMounted:false,mountCooldown:0,
    rotationY:0,updateVisual(){}};
  skimmer.mesh.visible=true;
  const player={position:position.clone(),mesh:new THREE.Group(),hp:100};
  const feedback=[];
  const transport=new OperationTransport(env,skimmer,simulation,{feedback:s=>feedback.push(s)});
  return {env,simulation,route,physicalRoute,skimmer,player,transport,feedback,
    setGate(open){gateOpen=open;},setBridge(ok){bridgeIntact=ok;},
    start(){
      assert.equal(transport.interact(player),true);
      const result=transport.requestTravel(player,'b');
      assert.equal(result.accepted,true,JSON.stringify(result));
      transport.journey.boarding=0;
    },
    clear(){transport.dispose();}
  };
}

test('controlled Skimmer traverses a gradual raised approach in many steps, not a vertical teleport',()=>{
  const f=fixture({elevation:x=>Math.min(6,Math.max(0,x*.25))});
  try{
    f.start();
    let highestStep=0,largestPlanar=0,steps=0;
    for(;steps<350&&f.transport.journey;steps++){
      const before=f.skimmer.position.clone();
      f.transport.update(.1,f.player,{});
      highestStep=Math.max(highestStep,Math.abs(f.skimmer.position.y-before.y));
      largestPlanar=Math.max(largestPlanar,Math.hypot(
        f.skimmer.position.x-before.x,f.skimmer.position.z-before.z));
    }
    assert.equal(f.transport.lastResult?.reason,'arrived');
    assert.ok(f.skimmer.position.x>99);
    assert.ok(Math.abs(f.skimmer.position.y-6.5)<.0001);
    assert.ok(highestStep<=1.01,'even a powered skimmer may not jump to a new floor in one simulation step');
    assert.ok(largestPlanar<=3.2);
    assert.deepEqual(f.player.position.toArray(),f.skimmer.position.toArray());
  }finally{f.clear();}
});

test('a discontinuous eight-unit vertical deck stops assisted travel at its current position',()=>{
  const f=fixture({elevation:x=>x>=10?8:0});
  try{
    f.start();
    let maxVertical=0,stoppedAt=null;
    for(let i=0;i<100&&f.transport.journey;i++){
      const before=f.skimmer.position.clone();
      f.transport.update(.1,f.player,{});
      maxVertical=Math.max(maxVertical,Math.abs(f.skimmer.position.y-before.y));
      if(!f.transport.journey)stoppedAt=f.skimmer.position.clone();
    }
    assert.equal(f.transport.lastResult?.reason,'vertical_transfer_unavailable');
    assert.ok(stoppedAt?.x<11);
    assert.ok(maxVertical<1,'the skimmer remains on its current deck rather than jumping eight metres');
    assert.equal(f.skimmer.isMounted,true,'the pilot retains manual control');
    assert.equal(f.player.mesh.visible,false);
  }finally{f.clear();}
});

test('autopilot refuses a non-walkable constructed floor instead of jumping across the missing sector',()=>{
  const f=fixture({canStand:p=>p.x<=12});
  try{
    f.start();
    for(let i=0;i<100&&f.transport.journey;i++)f.transport.update(.1,f.player,{});
    assert.equal(f.transport.lastResult?.reason,'route_terrain_unavailable');
    assert.ok(f.skimmer.position.x<=12);
    assert.equal(f.skimmer.isMounted,true);
  }finally{f.clear();}
});

test('closing a physical gate during travel cancels autopilot although its strategic route stays open',()=>{
  const f=fixture();
  try{
    f.start();
    for(let i=0;i<10;i++)f.transport.update(.1,f.player,{});
    const at=f.skimmer.position.clone();
    f.setGate(false);
    assert.equal(f.route.open,true);
    assert.equal(f.transport.update(.1,f.player,{}),false);
    assert.equal(f.transport.lastResult.reason,'route_lost');
    assert.ok(f.skimmer.position.distanceTo(at)<1e-7);
    f.setGate(true); f.skimmer.mountCooldown=0;
    assert.equal(f.transport.requestTravel(f.player,'b').accepted,true);
    f.setBridge(false);
    assert.equal(f.transport.update(.1,f.player,{}),false);
    assert.equal(f.transport.lastResult.reason,'route_lost');
  }finally{f.clear();}
});

test('forged physical route identifiers or unbuilt gates cannot authorize a vehicle transfer',()=>{
  const f=fixture();
  try{
    assert.equal(f.transport.interact(f.player),true);
    f.route.physicalGateIds=['nonexistent-gate'];
    assert.equal(f.transport.requestTravel(f.player,'b').reason,'no_controlled_route');
    f.route.physicalGateIds=['actual-gate'];
    f.route.physicalRouteId='not-a-constructed-bridge';
    assert.equal(f.transport.requestTravel(f.player,'b').reason,'no_controlled_route');
    assert.equal(f.skimmer.position.x,0);
  }finally{f.clear();}
});

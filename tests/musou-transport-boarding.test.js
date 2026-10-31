import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OperationTransport } from '../js/entities/OperationTransport.js';

function fixture({floor=()=>0,standing=()=>true,withSearch=true}={}){
  const scene=new THREE.Scene();
  const vehicle={position:new THREE.Vector3(0,.5,0),mesh:new THREE.Group(),
    isMounted:false,mountCooldown:0,rotationY:0,updateVisual(){}};
  scene.add(vehicle.mesh);
  const player={hp:100,position:new THREE.Vector3(0,0,0),mesh:new THREE.Group()};
  scene.add(player.mesh);
  const env={
    getElevationAt(x,z,y){return floor(x,z,y);},
    resolveMovement(){},
    navigation:{canStand:standing}
  };
  if(withSearch) env.navigation.safeSpawnNear=(p,radius,occupied,maxDistance)=>{
    assert.equal(radius,.75);assert.equal(maxDistance,3);
    assert.ok(occupied.some(o=>o.position===vehicle.position));
    return standing(p) ? p.clone():null;
  };
  const sim={config:{playerFaction:'hunter'},disposed:false,result:null,
    fronts:new Map(),routes:new Map(),groups:new Map(),units:new Map(),
    areHostile:(a,b)=>a!==b,relationship:(a,b)=>a===b?'allied':'hostile'};
  const messages=[];
  const transport=new OperationTransport(env,vehicle,sim,{feedback:text=>messages.push(text)});
  return {vehicle,player,env,transport,messages,clean(){transport.dispose();}};
}

test('a Yautja on an overhead deck cannot board a Skimmer several metres below with the same XZ',()=>{
  const f=fixture();
  try {
    f.player.position.set(0,5.4,0);
    assert.equal(f.transport.interact(f.player),false);
    assert.equal(f.vehicle.isMounted,false);
    assert.equal(f.player.mesh.visible,true);
    f.player.position.set(0,0,0);
    assert.equal(f.transport.interact(f.player),true);
    assert.equal(f.player.mesh.visible,false);
    assert.equal(f.transport.isPassenger(f.player),true);
  } finally {f.clean();}
});

test('an elevated deck permits dismount on that same supported deck, never teleports to ground Y=0',()=>{
  const f=fixture({floor:()=>4.7,standing:p=>Math.abs(p.y-4.7)<.01});
  try{
    f.vehicle.position.set(40,5.2,40);
    f.player.position.set(40,4.7,40);
    assert.equal(f.transport.interact(f.player),true);
    f.vehicle.mountCooldown=0;
    assert.equal(f.transport.interact(f.player),true);
    assert.equal(f.vehicle.isMounted,false);
    assert.equal(f.player.mesh.visible,true);
    assert.equal(f.player.position.y,4.7);
    assert.ok(f.player.position.distanceTo(f.vehicle.position)<5);
    assert.equal(f.player.mesh.position.y,4.7);
  } finally {f.clean();}
});

test('hovering above an unconnected deck refuses dismount and preserves both vehicle and pilot',()=>{
  const f=fixture();
  try{
    assert.equal(f.transport.interact(f.player),true);
    f.vehicle.position.set(0,8.5,0);
    f.player.position.copy(f.vehicle.position);
    f.vehicle.mountCooldown=0;
    const before=f.player.position.clone();
    assert.equal(f.transport.interact(f.player),false);
    assert.equal(f.transport.lastResult.reason,'no_safe_dismount');
    assert.equal(f.player.mesh.visible,false);
    assert.equal(f.vehicle.isMounted,true);
    assert.equal(f.transport.isPassenger(f.player),true);
    assert.deepEqual(f.player.position.toArray(),before.toArray());
    assert.ok(f.messages.some(message=>message.includes('Débarquement impossible')));
  } finally {f.clean();}
});

test('blocked dock on the starboard side leads to the first legal alternative, with no hidden relocation',()=>{
  const f=fixture({standing:p=>p.x<=-3});
  try{
    assert.equal(f.transport.interact(f.player),true);
    f.vehicle.mountCooldown=0;
    assert.equal(f.transport.interact(f.player),true);
    assert.equal(f.player.position.x,-3.5);
    assert.equal(f.player.position.z,0);
    assert.equal(f.vehicle.position.x,0);
    assert.equal(f.vehicle.position.z,0);
  }finally{f.clean();}
});

test('no legal exit around a vehicle fails closed instead of spawning the hunter inside the hull',()=>{
  const f=fixture({standing:()=>false});
  try{
    assert.equal(f.transport.interact(f.player),true);
    f.vehicle.mountCooldown=0;
    assert.equal(f.transport.interact(f.player),false);
    assert.equal(f.transport.isPassenger(f.player),true);
    assert.equal(f.player.mesh.visible,false);
    assert.equal(f.player.position.x,0);
    assert.equal(f.player.position.z,0);
  }finally{f.clean();}
});

test('an existing unblocked flat-space transport still supports legacy boarding and dismount',()=>{
  const f=fixture({withSearch:false});
  try{
    assert.equal(f.transport.interact(f.player),true);
    f.vehicle.mountCooldown=0;
    assert.equal(f.transport.interact(f.player),true);
    assert.equal(f.vehicle.isMounted,false);
    assert.equal(f.player.mesh.visible,true);
    assert.equal(f.player.position.y,0);
    assert.ok(f.player.position.distanceTo(f.vehicle.position)>2.5);
  }finally{f.clean();}
});

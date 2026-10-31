import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BattlefieldNavigation } from '../js/engine/BattlefieldNavigation.js';
import { SyntheticsManager } from '../js/entities/Synthetics.js';
import { APCVehicle } from '../js/entities/APCVehicle.js';

const point=(x,z)=>new THREE.Vector3(x,0,z);
const box=(x,z,width,depth)=>({x,z,halfWidth:width,halfDepth:depth,
  baseY:0,height:4,rotation:0});
function arena(colliders=[],halfSize=66){
  const env={halfSize,colliders,acidTrenches:[],openGates:new Set(),
    battlefieldLayout:null,getSectorAt:()=>null,
    accessibleBattlefieldRects:()=>null,getElevationAt:()=>0};
  env.navigation=new BattlefieldNavigation(env);
  return env;
}

test('non-sector Musou arenas compute a real A* detour around visible cover',()=>{
  const env=arena([box(0,0,3,3)]),from=point(-22,0),to=point(22,0);
  const path=env.navigation.localPath(from,to,.65);
  assert.ok(path.length>2,'non-strategic maps need the same pathfinding as sector maps');
  assert.ok(path.some(p=>Math.abs(p.z)>3.65),'the A* route goes around a prop');
  assert.ok(path.every(p=>Math.hypot(Math.max(0,Math.abs(p.x)-3),
    Math.max(0,Math.abs(p.z)-3))>=.65));
  assert.ok(path.at(-1).distanceTo(to)<.01);
});

test('a target inside a vehicle collider yields a reachable outer contact, not a waypoint through its hull',()=>{
  const env=arena([box(0,0,2.52,5.8)],500),from=point(8,0),to=point(0,0);
  const path=env.navigation.localPath(from,to,.9);
  assert.ok(path.length>0,'the seeker should approach the perimeter of a real APC');
  assert.ok(path.at(-1).distanceTo(to)>2,'target inside support geometry is not a legal footstep');
  assert.ok(path.at(-1).distanceTo(from)<from.distanceTo(to));
  assert.ok(path.at(-1).x>0,'the closest point on a vehicle hull should be on the near flank');
  assert.ok(path.every(p=>env.navigation.canStand(p,.9)));
});

test('a truly impassable arena wall never returns a teleport to the hidden enemy',()=>{
  const env=arena([box(0,0,2,68)]),from=point(-22,0),to=point(22,0);
  assert.deepEqual(env.navigation.localPath(from,to,.65),[]);
  const next=env.navigation.waypoint(from,to,.65);
  assert.ok(next.distanceTo(from)<.01);
});

test('APC length is taken from its navigation hull: the Working Joe hits it but not through unrelated cover',()=>{
  const scene=new THREE.Scene(),audio=new Proxy({}, {get:()=>()=>{}}),
    apc=new APCVehicle(scene,audio,null);
  const environment=arena([],500);
  apc.beginMission({missionId:'arena-vehicle-surface',allowed:true,factionId:'player_clan'});
  assert.equal(apc.spawn(point(0,0)),true);
  environment.colliders.push(apc.getNavigationCollider());
  const manager=new SyntheticsManager(scene,audio);
  manager.environment=environment;
  manager.battleSimulation={groups:new Map(),time:0,config:{playerFaction:'player_clan'},
    areHostile:(a,b)=>a!==b};
  manager.combatActorsProvider=()=>[apc.getCombatant()];
  const soldier=manager.spawnBattleUnit({id:'physical-working-joe',actorType:'working_joe',
    position:[8,0],hp:150,maxHp:150,factionId:'weyland_yutani'});
  const p={position:point(200,0),hp:1000,takeDamage(amount){this.hp-=amount;}};
  const wall=box(6,0,.3,90);
  environment.colliders.push(wall);
  try{
    for(let frame=0;frame<170;frame++)manager.update(1/60,p,{aliens:[]});
    assert.equal(apc.hp,2500,'the real wall blocks all attacks');
    environment.colliders.splice(environment.colliders.indexOf(wall),1);
    for(let frame=0;frame<1300&&apc.hp===2500;frame++)
      manager.update(1/60,p,{aliens:[]});
    assert.ok(apc.hp<2500,
      `Working Joe must engage APC surface (hp=${apc.hp}, x=${soldier.mesh.position.x.toFixed(2)}, z=${soldier.mesh.position.z.toFixed(2)}, prep=${soldier._npcPreparation ?? 0})`);
    assert.equal(p.hp,1000);
  }finally{manager.clearSquad();apc.clear();}
});

test('a ground actor brushing the edge of a raised Hive ramp may escape OUTWARD, never enter the ramp through its wall',()=>{
  const ramp={x:40,z:15,halfWidth:3.2,halfDepth:7,baseY:0,height:Infinity,
    owner:'hive-south-ramp',navigationTest(p,radius){
      const x=Math.max(36.8,Math.min(43.2,p.x)),z=Math.max(8,Math.min(22,p.z));
      if(Math.hypot(p.x-x,p.z-z)>=radius)return false;
      const height=(z-8)/14*4.7;
      return height>p.y+.15&&height<p.y+1.8;
    }};
  const env=arena([ramp]),navigator=env.navigation;
  const from=point(36.19,13.27),goal=point(20,0);
  const exit=navigator.waypoint(from,goal,.65);
  assert.ok(exit.distanceTo(from)>1,
    'a tiny residual ramp contact must not pin the agent against an open floor');
  assert.ok(exit.x<from.x,'the egress must move away from the actual ramp edge');
  assert.ok(navigator.localPath(from,goal,.65).length>0,
    'A* must be allowed to attach from a capsule already touching its collision margin');
  const entering=navigator.waypoint(from,point(40,15),.65);
  assert.ok(Math.hypot(entering.x-40,entering.z-15)>2.5,
    'a vertical ramp cannot be crossed straight through its raised collision wall');
});

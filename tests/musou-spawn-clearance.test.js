import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BattlefieldNavigation } from '../js/engine/BattlefieldNavigation.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';

const bounds={minX:-60,maxX:60,minZ:-60,maxZ:60};
function scene({colliders=[],legacy=false}={}){
  const sector={id:'ground',center:[0,0],bounds};
  const env={
    colliders,acidTrenches:[],openGates:new Set(),
    battlefieldLayout:{sectors:[sector],corridors:[],strategicRoutes:[]},
    getSectorAt(p){return p.x>=-60&&p.x<=60&&p.z>=-60&&p.z<=60?sector:null;},
    accessibleBattlefieldRects(){return [bounds];},
    getElevationAt(){return 0;},
    resolveMovement(){},
  };
  env.navigation=new BattlefieldNavigation(env);
  const manager=key=>({
    [key]:[],
    spawnBattleUnit(unit,group){
      const mesh=new THREE.Group();
      mesh.position.set(unit.position[0],0,unit.position[1]);
      const actor={mesh,battleUnitId:unit.id,factionId:unit.factionId,groupId:group.id,
        species:unit.species,actorType:unit.actorType,hp:unit.hp,maxHp:unit.maxHp,radius:1};
      this[key].push(actor);return actor;
    },
    despawnBattleUnit(id){
      const index=this[key].findIndex(actor=>actor.battleUnitId===id);
      if(index<0)return null;
      const [removed]=this[key].splice(index,1);return {id,position:[removed.mesh.position.x,removed.mesh.position.z],hp:removed.hp};
    }
  });
  const game={
    env,player:{hp:100,position:new THREE.Vector3(1000,0,1000)},player2:null,
    horde:manager('aliens'),marines:manager('marines'),
    allies:manager('allies'),synthetics:manager('androids'),bosses:{}
  };
  const bridge=new BattleActorBridge(game);
  bridge.simulation={
    config:{id:'AFF-06',playerFaction:'player_clan',groups:[],
      context:legacy?{}:{frontAllocationProvenance:'original-audit-front-v1; not canon'}},
    relationship:(a,b)=>a===b?'allied':'hostile',
    budgets:{spawnDistance:24}
  };
  const group={id:'platoon',factionId:'player_clan',species:'yautja',
    units:['u0','u1','u2','u3']};
  const units=group.units.map((id,index)=>({id,groupId:group.id,
    species:'yautja',actorType:'clan_hunter',factionId:group.factionId,
    hp:200,maxHp:200,position:[index*1.3,0],state:'active'}));
  return {game,bridge,group,units,env};
}
const box=(halfWidth,halfDepth)=>({
  x:0,z:0,halfWidth,halfDepth,height:4,baseY:0,rotation:0
});

test('new Musou platoon relocates its finite soldiers around a solid pillar without overlap',()=>{
  const f=scene({colliders:[box(3,3)]});
  const originalPositions=f.units.map(unit=>[...unit.position]);
  try{
    assert.equal(f.bridge.spawnGroup(f.group,f.units),true);
    assert.equal(f.bridge.actors.size,4);
    const placed=[...f.bridge.actors.values()].map(e=>e.actor);
    assert.equal(new Set(placed.map(a=>a.battleUnitId)).size,4);
    for(const actor of placed){
      assert.equal(f.env.navigation.canStand(actor.mesh.position,actor.radius),true);
      assert.ok(actor.mesh.position.distanceTo(new THREE.Vector3(
        f.units.find(u=>u.id===actor.battleUnitId).position[0],0,0))<=18+.01);
    }
    for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
      assert.ok(placed[i].mesh.position.distanceTo(placed[j].mesh.position)>=2.25-.01);
    }
    assert.deepEqual(f.units.map(u=>u.position),originalPositions,
      'the strategic identities and signed positions remain unchanged by the physical projection');
  }finally{f.bridge.dispose();}
});

test('no valid floor around a platoon causes atomic rollback, never a spawn inside a wall',()=>{
  const f=scene({colliders:[box(60,60)]});
  try{
    assert.equal(f.bridge.spawnGroup(f.group,f.units),false);
    assert.match(f.bridge.lastError,/No physically safe Musou squad spawn/);
    assert.equal(f.bridge.actors.size,0);
    assert.equal(f.game.allies.allies.length,0);
    assert.equal(f.units.length,4);
  }finally{f.bridge.dispose();}
});

test('the same safe starting position is retained when no obstacle blocks the plan',()=>{
  const f=scene();
  try{
    assert.equal(f.bridge.spawnGroup(f.group,f.units),true);
    const placed=[...f.bridge.actors.values()].map(e=>e.actor.mesh.position);
    // The initial data has unit spacing 1.3 < two collision capsules, so only
    // the FIRST remains exactly at its original point; subsequent units
    // avoid overlapping existing materialized members.
    assert.equal(placed[0].x,0);
    assert.equal(placed[0].z,0);
    assert.ok(placed.every(p=>f.env.navigation.canStand(p,1)));
  }finally{f.bridge.dispose();}
});

test('historical fallback keeps its original materialization contract unchanged',()=>{
  const f=scene({colliders:[box(3,3)],legacy:true});
  try{
    assert.equal(f.bridge.spawnGroup(f.group,f.units),true);
    const first=f.bridge.actors.get('u0').actor.mesh.position;
    assert.equal(first.x,0);
    assert.equal(first.z,0);
    assert.equal(f.env.navigation.canStand(first,1),false,
      'the older historical projection must not silently move a saved identity');
  }finally{f.bridge.dispose();}
});

test('a closed gate collider blocks its footprint; only real opening makes that spot eligible',()=>{
  let closed=true;
  const gate={...box(2,2),isCollisionActive(){return closed;}};
  const f=scene({colliders:[gate]});
  try{
    const origin=new THREE.Vector3(0,0,0);
    assert.equal(f.env.navigation.canStand(origin,1),false);
    const detour=f.env.navigation.safeSpawnNear(origin,1);
    assert.ok(detour);
    assert.ok(detour.distanceTo(origin)>2);
    closed=false;
    assert.equal(f.env.navigation.canStand(origin,1),true);
    const open=f.env.navigation.safeSpawnNear(origin,1);
    assert.deepEqual(open.toArray(),origin.toArray());
  }finally{f.bridge.dispose();}
});

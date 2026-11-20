import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BattleCrowdProjection, CROWD_VISUAL_POLICY } from '../js/graphics/BattleCrowdProjection.js';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';

const seen=()=>({position:new THREE.Vector3(0,0,0),hp:100});
const point=(x,z)=>[x,z];
const unit=(id,species,x,z,state='distant')=>({
  id,species,position:point(x,z),state,hp:100,maxHp:100
});
const environment=()=>({getPlacementElevationAt:()=>0,navigation:{canStand:()=>true}});
const projection=(units,env=environment())=>{
  const scene=new THREE.Scene(),simulation={units:new Map(units.map(u=>[u.id,u]))},
    visual=new BattleCrowdProjection(scene,env,simulation);
  return {scene,simulation,visual,clear(){visual.dispose();}};
};

test('hundreds of existing distant units render in four instanced draws, never a second combat roster',()=>{
  const units=[
    ...Array.from({length:260},(_,i)=>unit('xeno-'+i,'xenomorph',70+(i%17),-16+(i%31))),
    ...Array.from({length:135},(_,i)=>unit('human-'+i,'human',80+(i%13),i%19)),
    ...Array.from({length:90},(_,i)=>unit('yautja-'+i,'yautja',68+(i%21),i%11)),
    ...Array.from({length:50},(_,i)=>unit('synthetic-'+i,'synthetic',110+i%23,i%15)),
    ...Array.from({length:20},(_,i)=>unit('active-'+i,'xenomorph',50+i%5,0,'active')),
    ...Array.from({length:10},(_,i)=>unit('reserve-'+i,'human',55,0,'reserve'))
  ];
  const f=projection(units);
  const originals=units.map(u=>({id:u.id,state:u.state,position:[...u.position]}));
  try{
    assert.equal(f.visual.update(.5,[seen()]),true);
    const stats=f.visual.getStats();
    assert.equal(stats.drawCallsAtMost,4);
    assert.equal(f.scene.children.length,4);
    assert.equal(stats.instanceCapacity,4*CROWD_VISUAL_POLICY.maxPerSpecies);
    assert.equal(stats.bySpecies.xenomorph,80);
    assert.equal(stats.bySpecies.human,80);
    assert.equal(stats.bySpecies.yautja,80);
    assert.equal(stats.bySpecies.synthetic,50);
    assert.ok(stats.visible<=320);
    for(const mesh of f.scene.children){
      assert.equal(mesh.isInstancedMesh,true);
      assert.equal(mesh.geometry,f.visual.geometry);
      assert.equal(mesh.userData.notACombatant,true);
      assert.equal(mesh.userData.visualFidelity1to1Verified,false);
      assert.equal(mesh.castShadow,false);
      assert.equal(mesh.raycast(new THREE.Raycaster(),[]),undefined);
    }
    assert.deepEqual(units.map(u=>({id:u.id,state:u.state,position:[...u.position]})),originals,
      'projection must never spawn, rewrite or duplicate the authoritative soldiers');
    assert.equal(f.simulation.units.size,units.length);
  }finally{f.clear();}
  assert.equal(f.scene.children.length,0);
});

test('detailed or dead soldiers disappear from the proxy pool without changing their persistent IDs',()=>{
  const units=[unit('one','human',75,0),unit('two','human',78,3),
    unit('three','human',80,6)];
  const f=projection(units);
  try{
    f.visual.update(.4,[seen()]);
    assert.equal(f.visual.getStats().bySpecies.human,3);
    units[0].state='active';units[1].state='dead';units[1].hp=0;
    f.visual.update(.4,[seen()]);
    assert.equal(f.visual.getStats().bySpecies.human,1);
    units[0].state='distant';units[0].position=[4,0];
    f.visual.update(.4,[seen()]);
    assert.equal(f.visual.getStats().bySpecies.human,1,
      'nearby, non-materialized placeholders are hidden from melee range');
    assert.equal(f.simulation.units.size,3);
  }finally{f.clear();}
});

test('the closest of two co-op players defines a no-proxy bubble for each screen',()=>{
  const units=[unit('one','yautja',70,0),unit('two','human',155,0),
    unit('three','xenomorph',195,0)];
  const f=projection(units);
  try{
    const playerA={position:new THREE.Vector3(0,0,0)};
    f.visual.update(.4,[playerA]);
    assert.equal(f.visual.getStats().visible,3);
    const playerB={position:new THREE.Vector3(170,0,0)};
    f.visual.update(.4,[playerA,playerB]);
    assert.equal(f.visual.getStats().visible,1);
    assert.equal(f.visual.getStats().bySpecies.yautja,1);
    f.visual.update(.4,[playerB]);
    assert.equal(f.visual.getStats().visible,1,
      'co-op and single-player changes must not leak stale copies');
  }finally{f.clear();}
});

test('refresh is bounded to 2.5 Hz, and blocked floors never produce floating silhouettes',()=>{
  const units=[unit('safe','human',75,0),unit('void','human',85,0)];
  const env={getPlacementElevationAt:(x)=>x===75?3:NaN,
    navigation:{canStand:(p)=>p.x===75}};
  const f=projection(units,env);
  try{
    assert.equal(f.visual.update(.2,[seen()]),false);
    assert.equal(f.visual.getStats().refreshes,0);
    assert.equal(f.visual.update(.2,[seen()]),true);
    assert.equal(f.visual.getStats().bySpecies.human,1);
    assert.equal(f.visual.getStats().refreshes,1);
    assert.equal(f.visual.update(.1,[seen()]),false);
    assert.equal(f.visual.getStats().refreshes,1);
    assert.equal(f.visual.update(0,[seen()],{force:true}),true);
    assert.equal(f.visual.getStats().refreshes,2);
  }finally{f.clear();}
});

test('visual cleanup frees its four instance pools and leaves underlying battle units intact',()=>{
  const f=projection([unit('u','human',55,0)]);
  f.visual.update(.4,[seen()]);
  const all=[...f.visual.meshes.values()],geometry=f.visual.geometry;
  let disposed=0;
  geometry.addEventListener('dispose',()=>disposed++);
  f.clear();f.clear();
  assert.equal(disposed,1);
  assert.equal(f.scene.children.length,0);
  assert.equal(all.every(m=>m.parent===null),true);
  assert.equal(f.simulation.units.size,1);
  assert.equal(f.visual.disposed,true);
  assert.equal(f.visual.update(.4,[seen()]),false);
});

test('real LV-742 sim keeps its original 952 strategic identities and digest under crowd rendering',()=>{
  const config=getBattleOperationConfig('AFF-27'),simulation=new BattleSimulation(config);
  const scene=new THREE.Scene(),visual=new BattleCrowdProjection(scene,environment(),simulation);
  const before=simulation.units.size,digest=simulation.digest,states=simulation.getCounts();
  try{
    const front=simulation.fronts.values().next().value;
    const [x,z]=front.position;
    visual.update(.4,[{position:new THREE.Vector3(x,0,z)}]);
    const stats=visual.getStats();
    assert.equal(stats.drawCallsAtMost,4);
    assert.ok(stats.visible<=320);
    assert.equal(visual.meshes.size,4);
    assert.equal(simulation.units.size,before);
    assert.equal(simulation.digest,digest);
    assert.deepEqual(simulation.getCounts(),states);
    assert.equal(simulation.assertConservation(),true);
  }finally{visual.dispose();simulation.dispose();}
  assert.equal(scene.children.length,0);
});

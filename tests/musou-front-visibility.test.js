import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BattleCrowdProjection, CROWD_VISUAL_POLICY }
  from '../js/graphics/BattleCrowdProjection.js';
import { selectMusouFrontCandidates, MUSOU_CROWD_FRONT_POLICY }
  from '../js/graphics/MusouFrontVisibility.js';

const soldier=(id,frontId,x,z,state='distant')=>({
  id,groupId:'g-'+frontId,species:'xenomorph',actorType:'warrior',
  state,hp:100,maxHp:100,position:[x,z]
});
function fixture(units,env={getPlacementElevationAt:()=>0,navigation:{canStand:()=>true}}){
  const scene=new THREE.Scene();
  const simulation={units:new Map(units.map(u=>[u.id,u])),
    groups:new Map([
      ['g-A',{id:'g-A',frontId:'front_a'}],
      ['g-B',{id:'g-B',frontId:'front_b'}],
      ['g-C',{id:'g-C',frontId:'front_c'}]
    ])};
  const visual=new BattleCrowdProjection(scene,env,simulation);
  return {visual,scene,simulation,dispose(){visual.dispose();}};
}
const observer=(x=0,z=0)=>({position:new THREE.Vector3(x,0,z)});

test('Musou LOD reserves some visibility for a second active front without additional draw calls',()=>{
  const units=[
    ...Array.from({length:220},(_,i)=>soldier('A-'+i,'A',70+(i%8)*.04,i%9)),
    ...Array.from({length:35},(_,i)=>soldier('B-'+i,'B',175+(i%8)*.03,i%9))
  ];
  const f=fixture(units),before=units.map(u=>[u.id,u.state,[...u.position]]);
  try{
    assert.equal(f.visual.update(.4,[observer()]),true);
    const stats=f.visual.getStats();
    assert.equal(stats.bySpecies.xenomorph,CROWD_VISUAL_POLICY.maxPerSpecies);
    assert.ok(stats.byFront['xenomorph:front_a']>=65);
    assert.ok(stats.byFront['xenomorph:front_b']>=MUSOU_CROWD_FRONT_POLICY.minimumPerVisibleFront,
      'a distant parallel battle must not disappear behind the first 80 nearby troops');
    assert.equal(stats.drawCallsAtMost,4);
    assert.equal(f.scene.children.length,4);
    assert.deepEqual(units.map(u=>[u.id,u.state,[...u.position]]),before);
    assert.equal(f.simulation.units.size,255);
  }finally{f.dispose();}
});

test('the historical closest-soldier ordering stays deterministic when no front/group metadata exists',()=>{
  const entries=[{id:'c',distSq:18},{id:'a',distSq:2},{id:'b',distSq:4}];
  assert.deepEqual(selectMusouFrontCandidates(entries,2).map(e=>e.id),['a','b','c']);
  assert.deepEqual(entries.map(e=>e.id),['c','a','b'],'pure selection never sorts the caller data');
  assert.deepEqual(selectMusouFrontCandidates(entries,0),[]);
  const f=fixture([soldier('z','A',90,0),soldier('a','A',70,0)]);
  try{
    f.visual.update(.4,[observer()]);
    assert.equal(f.visual.getStats().byFront['xenomorph:front_a'],2);
    assert.equal(f.visual.getStats().floorProbes,2);
  }finally{f.dispose();}
});

test('an obstructed nearest 80-unit cluster does not leave slots blank when legal fighters are behind it',()=>{
  const blocked=Array.from({length:83},(_,i)=>soldier('blocked-'+i,'A',70+(i%9)*.2,3));
  const safe=Array.from({length:45},(_,i)=>soldier('safe-'+i,'B',145+(i%9)*.4,4));
  const f=fixture([...blocked,...safe],{
    getPlacementElevationAt:()=>0,
    navigation:{canStand:position=>position.x>=140}
  });
  try{
    f.visual.update(.4,[observer()]);
    const stats=f.visual.getStats();
    assert.equal(stats.bySpecies.xenomorph,safe.length);
    assert.equal(stats.byFront['xenomorph:front_b'],safe.length);
    assert.ok(stats.floorProbes>safe.length);
    assert.ok(stats.floorProbes<=CROWD_VISUAL_POLICY.maxPerSpecies*
      MUSOU_CROWD_FRONT_POLICY.maxFloorProbesMultiplier);
    assert.equal(f.simulation.units.size,128);
  }finally{f.dispose();}
});

test('co-op proximity suppresses representations around either hunter even when fronts are balanced',()=>{
  const units=[
    ...Array.from({length:90},(_,i)=>soldier('A-'+i,'A',70+i%9,i%7)),
    ...Array.from({length:45},(_,i)=>soldier('B-'+i,'B',170+i%9,i%7)),
  ];
  const f=fixture(units);
  try{
    f.visual.update(.4,[observer()]);
    assert.ok(f.visual.getStats().byFront['xenomorph:front_b']>=8);
    f.visual.update(.4,[observer(),observer(170,0)]);
    assert.equal(f.visual.getStats().byFront['xenomorph:front_b'],undefined);
    assert.equal(f.visual.getStats().visible,80);
    assert.equal(f.visual.getStats().drawCallsAtMost,4);
  }finally{f.dispose();}
});

test('large battle selection bounds ground probes and never mutates finite squads or reserve groups',()=>{
  const units=[
    ...Array.from({length:620},(_,i)=>soldier('A-'+i,'A',70+(i%30)*.01,10)),
    ...Array.from({length:620},(_,i)=>soldier('B-'+i,'B',177+(i%30)*.01,8)),
    ...Array.from({length:30},(_,i)=>soldier('C-'+i,'C',99,0,'reserve'))
  ];
  const f=fixture(units,{getElevationAt:()=>0,navigation:{canStand:()=>false}});
  try{
    f.visual.update(.4,[observer()]);
    assert.equal(f.visual.getStats().sourceDistantUnits,1240);
    assert.equal(f.visual.getStats().visible,0);
    assert.ok(f.visual.getStats().floorProbes<=320);
    assert.equal(f.scene.children.length,4);
    assert.equal(f.simulation.units.size,1270);
    assert.equal(units.filter(u=>u.state==='reserve').length,30);
  }finally{f.dispose();}
});

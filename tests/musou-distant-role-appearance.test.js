import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DISTANT_CROWD_APPEARANCES, distantCrowdAppearance }
  from '../js/graphics/DistantCrowdRoleAppearance.js';
import { BattleCrowdProjection, CROWD_VISUAL_POLICY }
  from '../js/graphics/BattleCrowdProjection.js';

const unit=(id,species,actorType,x=70,z=0,extra={})=>({
  id,species,actorType,position:[x,z],state:'distant',hp:100,maxHp:100,...extra
});

test('source castes retain distinct procedural appearance tokens, never canonical asset claims',()=>{
  const warrior=distantCrowdAppearance(unit('warrior','xenomorph','warrior'));
  const queen=distantCrowdAppearance(unit('queen','xenomorph','queen'));
  const praetorian=distantCrowdAppearance(unit('p','xenomorph','praetorian'));
  const facehugger=distantCrowdAppearance(unit('fh','xenomorph','facehugger'));
  const runner=distantCrowdAppearance(unit('r','xenomorph','runner'));
  const drone=distantCrowdAppearance(unit('d','xenomorph','warrior',70,0,{
    profileId:'source_dark_hive_GRP-58_default_6'
  }));
  assert.equal(drone.role,'drone');
  assert.ok(queen.height>praetorian.height&&praetorian.height>warrior.height);
  assert.ok(facehugger.height<runner.height&&runner.height<warrior.height);
  assert.notEqual(facehugger.color,warrior.color);
  assert.equal(Object.isFrozen(queen),true);
  assert.equal(distantCrowdAppearance(unit('invalid','unknown','unit')),null);
  assert.equal(distantCrowdAppearance(unit('warrior2','xenomorph','warrior')),warrior,
    'no per-unit allocation is needed for repeated source role visuals');
});

test('source Marine specialists and Seegson Working Joe do not all share the same distant silhouette',()=>{
  const base=unit('marine','human','marine');
  const medic=unit('medic','human','marine',70,0,{
    profileId:'source_human_force_GRP-60_H-LIGNE_5'
  });
  const commtech=unit('tech','human','marine',70,0,{
    profileId:'source_human_force_GRP-60_H-LIGNE_6'
  });
  const exosuit=unit('frame','human','marine',70,0,{
    profileId:'source_human_force_GRP-60_H-APPUI_4'
  });
  const joe=unit('joe','synthetic','working_joe');
  const wy=unit('wy','synthetic','weyland_combat');
  assert.equal(distantCrowdAppearance(medic).role,'medic');
  assert.equal(distantCrowdAppearance(commtech).role,'commtech');
  assert.equal(distantCrowdAppearance(exosuit).role,'exosuit');
  assert.ok(distantCrowdAppearance(exosuit).width>distantCrowdAppearance(base).width);
  assert.notEqual(distantCrowdAppearance(joe).color,distantCrowdAppearance(wy).color);
  assert.equal(distantCrowdAppearance(unit('boss','human','marine',70,0,{officer:true})).role,'officer');
  assert.equal(distantCrowdAppearance(unit('leader','yautja','clan_hunter',70,0,{officer:true})).role,'officer');
});

test('large Musou battles keep FOUR InstancedMesh draws while displaying caste-specific matrices and tints',()=>{
  const all=[
    unit('warrior','xenomorph','warrior',68,0),
    unit('queen','xenomorph','queen',69,1),
    unit('facehugger','xenomorph','facehugger',70,2),
    unit('joe','synthetic','working_joe',73,0),
    unit('wy','synthetic','weyland_combat',74,1),
    unit('medic','human','marine',77,0,{profileId:'source_human_force_GRP-60_H-LIGNE_5'}),
    unit('exosuit','human','marine',78,0,{profileId:'source_human_force_GRP-60_H-APPUI_4'}),
    unit('hunter','yautja','clan_hunter',81,1)
  ];
  const scene=new THREE.Scene(),simulation={units:new Map(all.map(u=>[u.id,u]))};
  const env={getPlacementElevationAt:()=>0,navigation:{canStand:()=>true}};
  const view=new BattleCrowdProjection(scene,env,simulation);
  const getMatrix=(mesh,index)=>{
    const matrix=new THREE.Matrix4();mesh.getMatrixAt(index,matrix);
    const pos=new THREE.Vector3(),rot=new THREE.Quaternion(),scale=new THREE.Vector3();
    matrix.decompose(pos,rot,scale);
    return {pos,scale};
  };
  const getColor=(mesh,index)=>{const color=new THREE.Color();mesh.getColorAt(index,color);return color.getHex();};
  try{
    assert.equal(view.update(.4,[{position:new THREE.Vector3()}]),true);
    assert.equal(view.meshes.size,4);
    assert.equal(scene.children.length,4);
    assert.equal(view.getStats().visible,all.length);
    assert.equal(view.getStats().drawCallsAtMost,4);
    assert.equal(view.getStats().byRole['xenomorph:queen'],1);
    assert.equal(view.getStats().byRole['human:exosuit'],1);
    const alien=view.meshes.get('xenomorph');
    const warrior=getMatrix(alien,0),queen=getMatrix(alien,1),facehugger=getMatrix(alien,2);
    assert.ok(queen.scale.y>warrior.scale.y);
    assert.ok(facehugger.scale.y<warrior.scale.y);
    assert.ok(facehugger.pos.y<warrior.pos.y);
    assert.equal(getColor(alien,1),DISTANT_CROWD_APPEARANCES.xenomorph.queen.color);
    assert.equal(getColor(alien,2),DISTANT_CROWD_APPEARANCES.xenomorph.facehugger.color);
    const synthetic=view.meshes.get('synthetic');
    assert.notEqual(getColor(synthetic,0),getColor(synthetic,1));
    assert.equal(view.meshes.get('human').count,2);
    assert.ok(view.meshes.get('xenomorph').instanceColor);
    assert.deepEqual([...simulation.units.keys()],all.map(u=>u.id));
    all[1].state='active';all[2].hp=0;all[2].state='dead';
    view.update(.4,[{position:new THREE.Vector3()}]);
    assert.equal(view.getStats().bySpecies.xenomorph,1);
    assert.equal(view.getStats().byRole['xenomorph:queen'],undefined);
    assert.equal(view.getStats().byRole['xenomorph:facehugger'],undefined);
    assert.equal(simulation.units.size,all.length,'LOD never adds or retires strategic identities');
  }finally{view.dispose();}
  assert.equal(scene.children.length,0);
});

test('role variation reuses a fixed palette for hundreds of actors without adding species draws or costs per unit',()=>{
  const soldiers=Array.from({length:800},(_,i)=>unit('soldier-'+i,'xenomorph',
    i%6===0?'runner':i%6===1?'praetorian':i%6===2?'facehugger':'warrior',
    60+(i%18),i%19));
  const scene=new THREE.Scene(),sim={units:new Map(soldiers.map(u=>[u.id,u]))};
  const view=new BattleCrowdProjection(scene,{getElevationAt:()=>0},sim);
  try{
    view.update(.4,[{position:new THREE.Vector3()}]);
    assert.equal(view.meshes.size,4);
    assert.equal(view.meshes.get('xenomorph').count,CROWD_VISUAL_POLICY.maxPerSpecies);
    assert.ok(view.colors.size<=4,'role tints cached once, regardless of population');
    assert.equal(view.getStats().visible,80);
    assert.equal(view.getStats().sourceDistantUnits,800);
  }finally{view.dispose();}
  assert.equal(sim.units.size,800);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { HIVE_NODE_RULES } from '../js/battlefield/HiveNodeEcology.js';
import { FACEHUGGER_EXPOSURE, applyFacehuggerExposure, facehuggerOnHiveSpace } from '../js/battlefield/FacehuggerExposure.js';

const make = (id='AFF-27',callbacks={})=>new BattleSimulation(getBattleOperationConfig(id,{allowHumanController:true}),callbacks);
const findFace=sim=>[...sim.units.values()].find(u=>u.species==='xenomorph'&&u.actorType==='facehugger'&&u.state==='distant'&&u.hp>0);
const createNode=sim=>{
  for(const enemy of [...sim.units.values()].filter(u=>u.factionId==='human_force'&&u.state==='distant'&&u.hp>0).slice(0,HIVE_NODE_RULES.cost)) {
    assert.equal(sim.recordDeath({entityId:enemy.id,killerFaction:'hive',cause:'test-confirmed-hostile'}),true);
  }
  sim._hiveNodeStep(.25);
  const node=sim.getHiveNodeState().nodes[0];
  assert.ok(node);
  return node;
};

test('Facehuggers lose a small amount of HP only when outside same-faction Hive-space',()=>{
  const sim=make();
  try {
    const alien=findFace(sim);
    assert.ok(alien);
    const max=alien.hp;
    alien.position=[999,999];
    const callbacks=[],direct=applyFacehuggerExposure(sim.hiveEcology,[alien],.25,HIVE_NODE_RULES.radius);
    assert.equal(direct.length,1);
    assert.ok(Math.abs(max-alien.hp-FACEHUGGER_EXPOSURE.hpPerSecond*.25)<1e-8);
    assert.equal(direct[0].unitId,alien.id);
    const node=createNode(sim);
    alien.hp=max;
    alien.position=[node.position[0]+2,node.position[1]];
    assert.equal(facehuggerOnHiveSpace(sim.hiveEcology,alien,HIVE_NODE_RULES.radius),true);
    assert.deepEqual(applyFacehuggerExposure(sim.hiveEcology,[alien],.25,HIVE_NODE_RULES.radius),[]);
    assert.equal(alien.hp,max);
    alien.position=[node.position[0]+HIVE_NODE_RULES.radius+2,node.position[1]];
    assert.equal(facehuggerOnHiveSpace(sim.hiveEcology,alien,HIVE_NODE_RULES.radius),false);
    assert.equal(applyFacehuggerExposure(sim.hiveEcology,[alien],.25,HIVE_NODE_RULES.radius).length,1);
    assert.ok(alien.hp<max);
  }finally{sim.dispose();}
});

test('hive Facehugger exposure can truly die, without allocating a new soldier or awarding infestation',()=>{
  const health=[];
  const sim=make('AFF-27',{healBattleUnit(id,hp){health.push({id,hp});}});
  try{
    const alien=findFace(sim),before=sim.units.size;
    assert.ok(alien);
    const faction=sim.getHiveNodeState().banks.find(b=>b.factionId==='hive');
    const earned=faction.earned;
    alien.position=[999,999];alien.hp=.15;
    sim._hiveNodeStep(.25);
    assert.equal(sim.getUnit(alien.id).state,'dead');
    assert.equal(sim.getUnit(alien.id).hp,0);
    assert.equal(sim.deaths.get(alien.id).cause,'facehugger_outside_hive_space');
    assert.equal(sim.deaths.get(alien.id).killerFaction,null);
    assert.equal(faction.earned,earned);
    assert.ok(health.some(x=>x.id===alien.id&&x.hp===0));
    sim._hiveNodeStep(.25);
    assert.equal(sim.deaths.size,1,'the same Facehugger is never double-counted');
    assert.equal(sim.units.size,before);
    assert.equal(sim.assertConservation(),true);
    const restored=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),sim.saveState());
    try { assert.equal(restored.getUnit(alien.id).state,'dead');assert.equal(restored.units.size,before); }
    finally{restored.dispose();}
  }finally{sim.dispose();}
});

test('reserve, dead and foreign-species fighters cannot be damaged by the Facehugger exposure system',()=>{
  const sim=make();
  try{
    const face=findFace(sim);
    const makeUnit=(id,state,species,actorType)=>({...face,id,state,species,actorType,
      hp:state==='dead'?0:90,position:[1000,1000],damageTaken:0});
    const units=[
      makeUnit('reserve','reserve','xenomorph','facehugger'),
      makeUnit('dead','dead','xenomorph','facehugger'),
      makeUnit('synthetic','distant','synthetic','synthetic'),
      makeUnit('human','distant','human','marine'),
      makeUnit('warrior','distant','xenomorph','warrior')
    ];
    assert.deepEqual(applyFacehuggerExposure(sim.hiveEcology,units,.25,HIVE_NODE_RULES.radius),[]);
    assert.deepEqual(units.map(u=>u.hp),[90,0,90,90,90]);
  }finally{sim.dispose();}
});

test('attrition is disabled in non-Extinction maps, with no impact on legacy checkpoints',()=>{
  const sim=make('AFF-16'),other=make('AFF-27');
  try{
    const u={id:'test',species:'xenomorph',actorType:'facehugger',state:'distant',
      position:[20,20],factionId:'hive',hp:90,maxHp:100,damageTaken:0};
    assert.deepEqual(applyFacehuggerExposure(sim.hiveEcology,[u],.25),[]);
    assert.equal(u.hp,90);
    assert.deepEqual(applyFacehuggerExposure(other.hiveEcology,[u],0),[]);
    assert.deepEqual(applyFacehuggerExposure(other.hiveEcology,[u],2),[]);
    assert.equal(u.hp,90);
    const src=other.saveState();
    delete src.hiveEcology;
    const resumed=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),src);
    try{assert.equal(resumed.getHiveNodeState().nodes.length,0);assert.equal(resumed.assertConservation(),true);}
    finally{resumed.dispose();}
  }finally{sim.dispose();other.dispose();}
});

test('Facehugger exposure persists through a strategic tick and replay in AFF-27 without changing its roster',()=>{
  const sim=make('AFF-27');
  try{
    const id=findFace(sim).id;
    const u=sim.units.get(id),initial=u.hp;
    u.position=[999,999];
    const ids=[...sim.units.keys()];
    assert.equal(sim.update(.25,{players:[],paused:false}),true);
    assert.ok(u.hp<initial);
    const saved=sim.saveState(), restored=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),saved);
    try{
      assert.equal(restored.getUnit(id).hp,u.hp);
      assert.deepEqual([...restored.units.keys()],ids);
      assert.equal(restored.assertConservation(),true);
    }finally{restored.dispose();}
  }finally{sim.dispose();}
});

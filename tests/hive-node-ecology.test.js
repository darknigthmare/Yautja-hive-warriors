import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { sourceUnitVisualKind } from '../js/data/SourceActorPresentation.js';
import { HiveNodeWorld } from '../js/battlefield/HiveNodeWorld.js';
import { selectBattleTarget } from '../js/engine/BattleActorSupport.js';
import {
  HIVE_NODE_RULES, createHiveEcology, awardHiveInfestation, buildHiveNode,
  healHiveSpace, damageHiveNode, snapshotHiveEcology, restoreHiveEcology
} from '../js/battlefield/HiveNodeEcology.js';

const config = () => getBattleOperationConfig('AFF-27');
const make = () => new BattleSimulation(config());
const drone = simulation => [...simulation.units.values()].find(unit =>
  sourceUnitVisualKind(unit) === 'drone' && unit.state === 'distant');
const hostiles = simulation => [...simulation.units.values()].filter(unit =>
  unit.species === 'human' && unit.state === 'distant' && !unit.uniqueId);
function earnNodes(simulation, count = HIVE_NODE_RULES.cost) {
  const victims = hostiles(simulation);
  assert.ok(victims.length >= count);
  for (const unit of victims.slice(0, count)) {
    assert.equal(simulation.recordDeath({
      entityId: unit.id, killerFaction: 'hive', cause: 'fixture_hostile_kill'
    }), true);
  }
}

test('LV-742 nodes require confirmed hive kills and an existing source-role Drone', () => {
  const sim = make();
  try {
    const first = drone(sim);
    assert.ok(first, 'source GRP-58 or 59 must include the Drone');
    const identities = [...sim.units.keys()], counts = sim.getCounts();
    sim._hiveNodeStep(.25);
    assert.equal(sim.getHiveNodeState().nodes.length, 0);
    earnNodes(sim, 3);
    assert.equal(sim.getHiveNodeState().banks[0].points, 3);
    sim._hiveNodeStep(.25);
    const state = sim.getHiveNodeState();
    assert.equal(state.nodes.length, 1);
    const creator = sim.getUnit(state.nodes[0].builderId);
    assert.equal(sourceUnitVisualKind(creator), 'drone');
    const injured = [...sim.units.values()].find(unit =>
      unit.groupId === creator.groupId && unit.id !== creator.id && unit.hp > 20 &&
      unit.species === 'xenomorph' && ['active','distant'].includes(unit.state));
    assert.ok(injured);
    injured.hp -= 20;
    const hp = injured.hp;
    sim._hiveNodeStep(.25);
    assert.equal(state.nodes[0].hp, HIVE_NODE_RULES.nodeHP);
    assert.equal(state.banks[0].points, 0);
    assert.equal(state.banks[0].spent, 3);
    assert.equal(injured.hp, hp + 2);
    assert.deepEqual([...sim.units.keys()], identities);
    assert.equal(sim.getCounts().hive.allocated, counts.hive.allocated);
    assert.equal(sim.assertConservation(), true);
  } finally { sim.dispose(); }
});

test('hive bank is finite; drones cannot duplicate themselves or build for free', () => {
  const groups = [{id:'hive',species:'xenomorph'}], ecology = createHiveEcology('AFF-27', groups);
  const units = Array.from({length:5},(_,i)=>({
    id:`source-drone-${i}`, profileId:'source_hive_GRP-58_default_6',
    species:'xenomorph', actorType:'warrior', factionId:'hive',
    state:'distant', hp:120, maxHp:200, position:[i*25, 0]
  }));
  for (let i=0;i<9;i++)assert.equal(awardHiveInfestation(ecology,'hive','human_force',true),true);
  for (let i=0;i<3;i++)assert.ok(buildHiveNode(ecology,units,i+1));
  assert.equal(buildHiveNode(ecology,units,5),null);
  assert.equal(ecology.nodes.length,3);
  assert.equal(new Set(ecology.nodes.map(n=>n.builderId)).size,3);
  assert.equal(ecology.buildersUsed.length,3);
  assert.equal(ecology.banks[0].spent,9);
  assert.equal(ecology.banks[0].points,0);
  assert.equal(awardHiveInfestation(ecology,'hive','hive',true),false);
  assert.equal(awardHiveInfestation(ecology,'human_force','hive',true),false);
  assert.equal(awardHiveInfestation(ecology,'hive','human_force',false),false);
  assert.equal(damageHiveNode(ecology,ecology.nodes[0].id,10000,true).destroyed,true);
  assert.equal(ecology.nodes.length,2);
  assert.equal(buildHiveNode(ecology,units,6),null,'destroying a node never refunds infestation');
  for(let i=0;i<3;i++)awardHiveInfestation(ecology,'hive','human_force',true);
  const replacement = buildHiveNode(ecology,units,7);
  assert.ok(replacement);
  assert.ok(!ecology.nodes.some(node => node.builderId === units[0].id));
  assert.equal(ecology.nodes.length,3);
});

test('hive-space heals only living, non-incapacitated allocated Aliens within node radius', () => {
  const faction=[{id:'hive',species:'xenomorph'}], state=createHiveEcology('AFF-27', faction);
  state.nodes=[{id:'hive-node:hive:1', builderId:'builder',factionId:'hive',position:[0,0],hp:280,createdAt:0}];
  const makeUnit=(id,species,position,hp=100)=>({id,species,factionId:'hive',position,state:'distant',hp,maxHp:200});
  const near=makeUnit('near','xenomorph',[2,0]);
  const far=makeUnit('far','xenomorph',[12,0]);
  const dead=makeUnit('dead','xenomorph',[1,0],0);dead.state='dead';
  const reserve=makeUnit('reserve','xenomorph',[1,0]);reserve.state='reserve';
  const marine=makeUnit('marine','human',[1,0]);
  const down=makeUnit('down','xenomorph',[1,0]);down.incapacitated=true;
  const callbacks=[];
  const result=healHiveSpace(state,[near,far,dead,reserve,marine,down],.25,e=>callbacks.push(e));
  assert.equal(result.length,1);
  assert.equal(near.hp,102);
  assert.equal(callbacks[0].unitId,'near');
  assert.deepEqual([far.hp,dead.hp,reserve.hp,marine.hp,down.hp],[100,0,100,100,100]);
});

test('same-faction damage is rejected, but a hostile may destroy a node permanently',()=>{
  const sim=make();
  try{
    earnNodes(sim);
    sim._hiveNodeStep(.25);
    const node=sim.getHiveNodeState().nodes[0];
    assert.ok(node);
    assert.equal(sim.damageHiveNode(node.id,100,'hive'),null);
    assert.equal(sim.damageHiveNode(node.id,100,'untrusted'),null);
    assert.equal(sim.damageHiveNode(node.id,60,'player_clan').hp,node.hp-60);
    assert.equal(sim.damageHiveNode(node.id,1000,'player_clan').destroyed,true);
    assert.equal(sim.getHiveNodeState().nodes.length,0);
    assert.equal(sim.getHiveNodeState().banks[0].spent,3);
    assert.equal(sim.assertConservation(),true);
  }finally{sim.dispose();}
});

test('node bank, builder provenance and wounds survive the exact simulation save digest',()=>{
  const sim=make();
  try{
    earnNodes(sim);
    sim._hiveNodeStep(.25);
    const saved=sim.saveState(), node=saved.hiveEcology.nodes[0];
    assert.ok(node);
    const restored=BattleSimulation.fromState(config(),saved);
    try{
      assert.deepEqual(restored.getHiveNodeState(),saved.hiveEcology);
      assert.equal(restored.digest,sim.digest);
      assert.equal(restored.getCounts().hive.allocated,sim.getCounts().hive.allocated);
    }finally{restored.dispose();}
    const old=structuredClone(saved);delete old.hiveEcology;
    const historic=BattleSimulation.fromState(config(),old);
    try{
      assert.equal(historic.getHiveNodeState().nodes.length,0);
      assert.equal(historic.getHiveNodeState().banks[0].points,0);
    }finally{historic.dispose();}
    for(const mutate of [
      e=>e.banks[0].points=100,
      e=>{e.banks[0].points+=1;e.banks[0].earned+=1;},
      e=>e.nodes[0].hp=9999,
      e=>e.nodes[0].position=[Infinity,0],
      e=>e.nodes[0].builderId='unknown',
      e=>e.buildersUsed.push(e.buildersUsed[0]),
      e=>e.sequence=0
    ]) {
      const forged=structuredClone(saved);mutate(forged.hiveEcology);
      assert.throws(()=>BattleSimulation.fromState(config(),forged),/invalid persisted hive ecology/);
    }
  }finally{sim.dispose();}
});

test('node visual is a destructible NPC target, not a new combat-unit ID',()=>{
  const sim=make(),scene=new THREE.Scene(), env={getElevationAt:()=>0,hasLineOfSight:()=>true};
  let world=null;
  try{
    earnNodes(sim);sim._hiveNodeStep(.25);
    world=new HiveNodeWorld(scene,env,sim);
    world.update();
    assert.equal(world.combatants.length,1);
    assert.equal(sim.getCounts().hive.allocated,config().budgets.byFaction.hive.total);
    const node=world.combatants[0],original=node.hp;
    assert.equal(node.mesh.userData.visualFidelity1to1Verified,false);
    const attack={origin:node.position.clone(),radius:2,damage:45};
    assert.equal(world.hitWithAttack(attack,'player_clan').length,1);
    assert.equal(node.hp,original-45);
    assert.equal(world.hitWithAttack(attack,'player_clan').length,0,'same attack object cannot hit twice');
    const source={hp:150,factionId:'player_clan',mesh:new THREE.Group()};
    source.mesh.position.copy(node.position).add(new THREE.Vector3(3,0,0));
    const manager={battleSimulation:sim,combatActorsProvider:()=>world.combatants,time:1};
    const target=selectBattleTarget(manager,source);
    assert.ok(target?.isHiveNodeProxy);
    target.takeDamage(50);
    assert.equal(sim.getHiveNodeState().nodes[0].hp,original-95);
    const before=sim.units.size;
    node.takeDamage(1000,'player_clan');world.update();
    assert.equal(world.combatants.length,0);
    assert.equal(sim.units.size,before);
  }finally{world?.dispose();sim.dispose();}
});

test('node ecology remains dormant outside the Extinction LV-742 operation',()=>{
  for(const operationId of ['AFF-01','AFF-13','AFF-16','AFF-25']){
    const sim=new BattleSimulation(getBattleOperationConfig(operationId,{allowHumanController:true}));
    try{
      assert.deepEqual(sim.getHiveNodeState().banks,[],operationId);
      sim._hiveNodeStep(.25);
      assert.equal(sim.getHiveNodeState().nodes.length,0);
    }finally{sim.dispose();}
  }
});

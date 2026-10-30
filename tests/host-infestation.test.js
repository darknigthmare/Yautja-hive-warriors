import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { sourceUnitVisualKind } from '../js/data/SourceActorPresentation.js';
import { HOST_INFESTATION_RULES } from '../js/battlefield/HostInfestation.js';
import { selectBattleTarget } from '../js/engine/BattleActorSupport.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';
import { createMarineModel } from '../js/graphics/SupportModels.js';
import { attachHostParasiteVisual } from '../js/graphics/HostParasiteAttachment.js';
import { disposeObject } from '../js/engine/SceneResources.js';

const config=()=>getBattleOperationConfig('AFF-27');
const make=()=>new BattleSimulation(config());
const get=sim=>{
  const facehugger=[...sim.units.values()].find(u=>u.actorType==='facehugger'&&u.hp>0&&u.state==='distant');
  assert.ok(facehugger);
  const frontId=sim.groups.get(facehugger.groupId).frontId;
  const host=[...sim.units.values()].find(u=>u.factionId==='human_force'&&u.species==='human'&&u.actorType==='marine'&&
    sim.groups.get(u.groupId).frontId===frontId&&u.hp>0&&u.state==='distant'&&!sourceUnitVisualKind(u));
  assert.ok(host);
  facehugger.position=[...host.position];facehugger.state=host.state='active';
  return { facehugger,host };
};

test('a finite LV-742 Facehugger implants one allocated human and never respawns as a reserve',()=>{
  const sim=make();
  try{
    const {facehugger,host}=get(sim),originalCount=sim.units.size,sourceFaction=facehugger.factionId;
    const infection=sim.beginHostInfestation(facehugger.id,host.id);
    assert.ok(infection);
    assert.equal(infection.completesAt,sim.time+HOST_INFESTATION_RULES.incubationSeconds);
    assert.equal(facehugger.state,'dead');
    assert.equal(host.incapacitated,true);
    assert.equal(host.hp,host.maxHp);
    assert.equal(sim.beginHostInfestation(facehugger.id,host.id),null);
    assert.equal(sim.deaths.size,1);
    assert.equal(sim.deaths.get(facehugger.id).killerFaction,null);
    assert.equal(sim.hiveEcology.banks.find(b=>b.factionId===sourceFaction).earned,0);
    assert.equal(sim.units.size,originalCount);
    const saved=sim.saveState(),restored=BattleSimulation.fromState(config(),saved);
    try{
      assert.equal(restored.getUnit(facehugger.id).state,'dead');
      assert.equal(restored.getUnit(host.id).incapacitated,true);
      assert.deepEqual(restored.getUnit(host.id).infection,infection);
      restored.time=infection.completesAt;
      assert.equal(restored._hostInfestationStep(),1);
      assert.equal(restored.getUnit(host.id).state,'dead');
      assert.equal(restored.getUnit(facehugger.id).state,'dead');
      assert.equal(restored._hostInfestationStep(),0);
      assert.equal(restored.getUnit(host.id).infection,undefined);
      assert.equal(restored.deaths.size,2);
      assert.equal(restored.hiveEcology.banks.find(b=>b.factionId===sourceFaction).earned,1);
      assert.equal(restored.units.size,originalCount,'no adult spawned from an unallocated identity');
      assert.equal(restored.assertConservation(),true);
    }finally{restored.dispose();}
  }finally{sim.dispose();}
});

test('facehugger cannot infect the synthetic, the armored exosuit, or a conscious flametrooper',()=>{
  const sim=make();
  try{
    const {facehugger,host}=get(sim);
    const others=[...sim.units.values()].filter(u=>u.state==='distant'&&u.hp>0);
    const synthetic=others.find(u=>u.species==='synthetic'&&u.factionId!==facehugger.factionId);
    const flame=others.find(u=>u.actorType==='flametrooper'&&u.factionId!==facehugger.factionId);
    const exosuit=others.find(u=>sourceUnitVisualKind(u)==='exosuit'&&u.factionId!==facehugger.factionId);
    assert.ok(synthetic&&flame&&exosuit);
    for(const target of [synthetic,flame,exosuit]){
      target.state='active';target.position=[...facehugger.position];
      assert.equal(sim.beginHostInfestation(facehugger.id,target.id),null);
      assert.equal(target.incapacitated,false);
    }
    host.position=[facehugger.position[0]+HOST_INFESTATION_RULES.captureDistance+1,facehugger.position[1]];
    assert.equal(sim.beginHostInfestation(facehugger.id,host.id),null);
    host.position=[...facehugger.position];
    sim.setRelationship(facehugger.factionId,host.factionId,'neutral','test_temporary_truce');
    assert.equal(sim.beginHostInfestation(facehugger.id,host.id),null);
    assert.equal(sim.getUnit(facehugger.id).state,'active');
  }finally{sim.dispose();}
});

test('target-view permission refuses armored NPCs and links an accepted latch to the authoritative simulation',()=>{
  const sim=make();
  try{
    const {facehugger,host}=get(sim);
    const source={hp:facehugger.hp,battleUnitId:facehugger.id,factionId:facehugger.factionId,
      mesh:new THREE.Group(),combatManager:{battleSimulation:sim}};
    source.mesh.position.set(...[facehugger.position[0],0,facehugger.position[1]]);
    const actor={hp:host.hp,maxHp:host.maxHp,battleUnitId:host.id,factionId:host.factionId,
      type:'marine',mesh:new THREE.Group(),combatManager:{battleSimulation:sim}};
    actor.mesh.position.copy(source.mesh.position);
    const scene=new THREE.Scene();scene.add(actor.mesh);
    const manager={battleSimulation:sim,combatActorsProvider:()=>[actor],time:1};
    const selected=selectBattleTarget(manager,source);
    assert.ok(selected?.isBattleNPC);
    assert.equal(selected.canBeFacehugged,true);
    assert.equal(selected.triggerFacehuggerLatch(),true);
    assert.equal(actor.isFacehuggerLatched,true);
    assert.ok(actor.facehuggerHold>=HOST_INFESTATION_RULES.incubationSeconds);
    assert.equal(sim.getUnit(host.id).incapacitated,true);
    assert.equal(sim.getUnit(facehugger.id).state,'dead');
    assert.equal(selected.triggerFacehuggerLatch(),false);
  }finally{sim.dispose();}
});

test('a killed strategic host is removed from the physical bridge instead of being resurrected',()=>{
  const sim=make();
  try{
    const {facehugger,host}=get(sim);
    const infection=sim.beginHostInfestation(facehugger.id,host.id);
    sim.time=infection.completesAt;sim._hostInfestationStep();
    const mesh=new THREE.Group();
    let removed=0;
    const manager={marines:[],despawnBattleUnit(id){assert.equal(id,host.id);removed++;return{id};}};
    const staleActor={battleUnitId:host.id,mesh,hp:host.maxHp,isDowned:false};
    manager.marines.push(staleActor);
    const game={env:{getElevationAt:()=>0},horde:{aliens:[]},marines:manager,allies:{allies:[]},synthetics:{androids:[]},bosses:{}};
    const bridge=new BattleActorBridge(game);
    bridge.simulation=sim;
    bridge.actors.set(host.id,{actor:staleActor,manager,groupId:host.groupId,unitId:host.id});
    bridge.sync();
    assert.equal(removed,1);
    assert.equal(bridge.actors.size,0);
    assert.equal(sim.getUnit(host.id).state,'dead');
    assert.equal(sim.getCounts().human_force.dead>=1,true);
    assert.equal(sim.assertConservation(),true);
  }finally{sim.dispose();}
});

test('invalid infection checkpoint metadata cannot rewrite an existing human or synth',()=>{
  const sim=make();
  try{
    const {facehugger,host}=get(sim),inf=sim.beginHostInfestation(facehugger.id,host.id);
    const saved=sim.saveState();
    const changes=[
      info=>{info.completesAt+=100;},
      info=>{info.sourceUnitId='unallocated';},
      info=>{info.sourceFaction='human_force';},
      info=>{info.startedAt=-1;},
    ];
    for(const mutate of changes){
      const copy=structuredClone(saved);
      const victim=copy.units.find(u=>u.id===host.id);
      mutate(victim.infection);
      assert.throws(()=>BattleSimulation.fromState(config(),copy),/invalid saved host infestation/);
    }
    const sourceAlive=structuredClone(saved);
    sourceAlive.units.find(u=>u.id===facehugger.id).state='distant';
    assert.throws(()=>BattleSimulation.fromState(config(),sourceAlive),/invalid saved host infestation/);
    const forgedCause=structuredClone(saved);
    forgedCause.deaths.find(death=>death.entityId===facehugger.id).cause='unrelated-combat';
    assert.throws(()=>BattleSimulation.fromState(config(),forgedCause),
      /invalid saved host infestation/,'a combat casualty cannot be forged into a consumed parasite');
    const duplicatedSource=structuredClone(saved);
    const secondHost=duplicatedSource.units.find(u=>u.species==='human' &&
      u.factionId===host.factionId && u.id!==host.id && u.hp>0 && u.state==='distant');
    assert.ok(secondHost);
    secondHost.infection=structuredClone(inf);
    secondHost.incapacitated=true;
    assert.throws(()=>BattleSimulation.fromState(config(),duplicatedSource),
      /duplicated saved host infestation source/,'one parasite cannot impregnate two hosts');
    const legacy=structuredClone(saved);
    delete legacy.units.find(u=>u.id===host.id).infection;
    legacy.units.find(u=>u.id===host.id).incapacitated=false;
    const resumed=BattleSimulation.fromState(config(),legacy);
    try{assert.equal(resumed.getUnit(host.id).infection,undefined);}
    finally{resumed.dispose();}
  }finally{sim.dispose();}
});

test('the physical horde keeps a Facehugger when the target explicitly rejects implantation',()=>{
  const horde=Object.create(XenomorphHorde.prototype);
  const protectedMarine={type:'flametrooper',hp:100,position:new THREE.Vector3(),triggerFacehuggerLatch(){return false;}};
  assert.equal(horde._canParasitize(protectedMarine),true,
    'legacy physical target needs the explicit refusal, not a fabricated successful infection');
  assert.equal(protectedMarine.triggerFacehuggerLatch(),false);
});

test('procedural Facehugger-on-host visual is unique, attached and cleaned with the host',()=>{
  const marine=createMarineModel('marine');
  try{
    const first=attachHostParasiteVisual(marine);
    assert.ok(first);
    assert.equal(first.name,'facehugger-host-attachment');
    assert.equal(first.userData.visualFidelity1to1Verified,false);
    assert.ok(first.children.length>=10,'visible body, gripping legs and curved tail are real geometry');
    const second=attachHostParasiteVisual(marine);
    assert.equal(second,first,'no duplicate visual on repeated latch');
    assert.equal(marine.children.filter(child=>child.name===first.name).length,1);
  }finally{disposeObject(marine);}
});

test('a checkpoint re-materializes an infected Marine with its visible attached parasite',()=>{
  const sim=make(),scene=new THREE.Scene(),manager=new ColonialMarinesManager(scene,{});
  try{
    const {facehugger,host}=get(sim);
    assert.ok(sim.beginHostInfestation(facehugger.id,host.id));
    const saved=sim.saveState();
    const restored=BattleSimulation.fromState(config(),saved);
    try{
      const unit=restored.getUnit(host.id);
      assert.ok(unit.infection);
      const actor=manager.spawnBattleUnit(unit,restored.groups.get(unit.groupId));
      assert.equal(actor.battleUnitId,unit.id);
      assert.equal(actor.isDowned,true,'incubating Marine may not fight after materialization');
      const attachment=actor.mesh.getObjectByName('facehugger-host-attachment');
      assert.ok(attachment);
      assert.equal(attachment.userData.visualFidelity1to1Verified,false);
      assert.ok(manager.despawnBattleUnit(unit.id));
      assert.equal(scene.children.length,0);
    }finally{restored.dispose();}
  }finally{manager.clearSquad();sim.dispose();}
});

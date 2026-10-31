import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { physicalOperationRouteAvailable } from '../js/battlefield/PhysicalRouteAvailability.js';

const makeScene=()=>createOperationScene({operationId:'AFF-06',mapSeed:0,deploymentPlan:'authored'});
function fixture(){
  const scene=makeScene(),environment=new EnvironmentManager(new THREE.Scene());
  environment.buildLevelEnvironment({...scene.level,mapId:scene.variant?.id,
    mapSeed:scene.layout.mapSeed,battlefield:true,strategicMode:true});
  for(const gate of environment.battlefieldLayout.gates)environment.openGate(gate.id);
  const provider=(route,options)=>physicalOperationRouteAvailable(environment,route,options);
  const simulation=new BattleSimulation(scene.config,{routeAvailabilityProvider:provider});
  const route=[...simulation.routes.values()].find(r=>r.physicalRouteId && r.physicalGateIds?.length);
  assert.ok(route,'scene should own at least one physical front route with real gates');
  assert.ok(environment.battlefieldLayout.strategicRoutes.some(r=>r.id===route.physicalRouteId));
  assert.ok(route.physicalGateIds.every(id=>environment.battlefieldLayout.gates.some(g=>g.id===id)));
  return {scene,environment,simulation,route,clear(){
    simulation.dispose();environment.clearEnvironment();
  }};
}

test('finite front routes are linked to actual physical gates and tactical bridges, not only a logical open flag',()=>{
  const f=fixture();
  try{
    assert.equal(f.simulation._routeTraversable(f.route),true);
    const gate=f.route.physicalGateIds[0];
    assert.equal(f.environment.closeGate(gate),true);
    assert.equal(f.route.open,true,'the gameplay order remains logically open');
    assert.equal(physicalOperationRouteAvailable(f.environment,f.route),false);
    assert.equal(f.simulation._routeTraversable(f.route),false);
    assert.equal(physicalOperationRouteAvailable(f.environment,f.route,{opening:true}),true,
      'opening a mission door is allowed to precede its physical gate animation');
    assert.equal(f.environment.openGate(gate),true);
    assert.equal(f.simulation._routeTraversable(f.route),true);
  }finally{f.clear();}
});

test('a closing real door pauses in-transit squads without teleporting, then reopening resumes movement',()=>{
  const f=fixture();
  try{
    const path=f.simulation._path(f.route.from,f.route.to);
    assert.ok(path?.length>0);
    const first=f.simulation.routes.get(path[0].routeId);
    assert.ok(first.physicalGateIds?.length);
    const group=[...f.simulation.groups.values()].find(g=>g.frontId===path[0].from &&
      g.state==='distant'&&g.units.some(id=>f.simulation.getUnit(id)?.hp>0 &&
      f.simulation.getUnit(id)?.state==='distant'));
    assert.ok(group);
    assert.equal(f.simulation.issueOrder(group.id,{type:'attack',frontId:f.route.to}).accepted,true);
    f.simulation.time+=.25;f.simulation._moveGroups(.25);
    const at=[...group.position],progress=group.travelProgress;
    const door=first.physicalGateIds[0];
    assert.equal(f.environment.closeGate(door),true);
    f.simulation.time+=.25;f.simulation._moveGroups(.25);
    assert.deepEqual(group.position,at,'finite units cannot cross a newly sealed sector');
    assert.equal(group.travelProgress,progress);
    assert.equal(group.path[0].routeId,first.id);
    const oldFront=group.frontId;
    assert.equal(f.environment.openGate(door),true);
    f.simulation.time+=.25;f.simulation._moveGroups(.25);
    assert.notDeepEqual(group.position,at,'the same existing group resumes when the real gate is open');
    assert.equal(group.frontId,oldFront,'opening a gate never teleports a squad into its destination front');
    assert.equal(f.simulation.assertConservation(),true);
  }finally{f.clear();}
});

test('a destroyed tactical bridge blocks passage even if its door is open; repair permits resumption',()=>{
  const f=fixture();
  try{
    const route=f.route,physicalId=route.physicalRouteId;
    const original=f.environment.isTacticalRouteAvailable.bind(f.environment);
    let broken=true;
    f.environment.isTacticalRouteAvailable=id=>id===physicalId?!broken:original(id);
    assert.equal(f.simulation._routeTraversable(route),false);
    assert.equal(physicalOperationRouteAvailable(f.environment,route,{opening:true}),false);
    broken=false;
    assert.equal(f.simulation._routeTraversable(route),true);
  }finally{f.clear();}
});

test('missing or forged route gate identities fail closed and never spend reserve units',()=>{
  const f=fixture();
  try{
    const forged={...f.route,physicalGateIds:['gate-that-is-not-built']};
    assert.equal(physicalOperationRouteAvailable(f.environment,forged),false);
    assert.equal(physicalOperationRouteAvailable(f.environment,forged,{opening:true}),false,
      'a mission cannot manufacture or unlock an unknown physical gate');
    assert.equal(physicalOperationRouteAvailable(f.environment,
      {...f.route,physicalRouteId:'unregistered-tactical-road'}),false);
    assert.equal(physicalOperationRouteAvailable(f.environment,{...f.route,physicalGateIds:null}),false);
    const group=[...f.simulation.groups.values()].find(g=>g.frontId===f.route.from&&g.state==='reserve');
    const reserves=f.simulation.getCounts();
    const old=f.route.physicalGateIds[0];
    f.environment.closeGate(old);
    assert.equal(f.simulation._routeTraversable(f.route),false);
    assert.deepEqual(f.simulation.getCounts(),reserves,'closing physical gates consumes no soldiers');
    assert.equal(f.simulation.assertConservation(),true);
    assert.ok(group===undefined||group.units.length>0);
  }finally{f.clear();}
});

test('a checkpoint restored while a physical door is closed cannot bypass it by reloading the same finite route',()=>{
  const f=fixture();
  try{
    const gate=f.route.physicalGateIds[0];
    const save=f.simulation.saveState();
    f.environment.closeGate(gate);
    const restored=BattleSimulation.fromState(f.scene.config,save,{
      routeAvailabilityProvider:(route,options)=>physicalOperationRouteAvailable(f.environment,route,options)
    });
    try{
      assert.equal(restored.getUnit([...restored.units.keys()][0]).id,[...f.simulation.units.keys()][0]);
      assert.equal(restored._routeTraversable(restored.routes.get(f.route.id)),false);
      assert.equal(restored.assertConservation(),true);
      f.environment.openGate(gate);
      assert.equal(restored._routeTraversable(restored.routes.get(f.route.id)),true);
      assert.deepEqual(restored.getCounts(),f.simulation.getCounts());
    }finally{restored.dispose();}
  }finally{f.clear();}
});

test('a mission can logically open a closed gate without bypassing a destroyed bridge',()=>{
  const f=fixture();
  try{
    const route=f.route,gate=route.physicalGateIds[0];
    assert.equal(f.simulation.setRouteOpen(route.id,false,'test-locked-passage'),true);
    assert.equal(f.environment.closeGate(gate),true);
    assert.equal(f.simulation.setRouteOpen(route.id,true,'real-objective-unlocked'),true,
      'the door is still physically closed until the mission event executes');
    assert.equal(f.simulation._routeTraversable(route),false);
    f.environment.openGate(gate);
    assert.equal(f.simulation._routeTraversable(route),true);
    f.simulation.setRouteOpen(route.id,false);
    f.environment.isTacticalRouteAvailable=()=>false;
    assert.equal(f.simulation.setRouteOpen(route.id,true),false,
      'an unopened destroyed bridge cannot be unlocked merely by the HUD route flag');
  }finally{f.clear();}
});

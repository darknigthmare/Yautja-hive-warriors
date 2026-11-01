import test from 'node:test';
import assert from 'node:assert/strict';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { planFiniteCarrierLoad, validateFiniteCarrierCargo,
  CARRIER_CARGO_RULES } from '../js/battlefield/ExtinctionCarrierCargo.js';
import { applyFacehuggerExposure } from '../js/battlefield/FacehuggerExposure.js';

function fixture(){
  const config=structuredClone(getBattleOperationConfig('AFF-27'));
  const hive=new Set(config.factions.filter(f=>f.species==='xeno').map(f=>f.id));
  const group=config.groups.find(g=>hive.has(g.factionId)&&g.state==='distant'&&
    g.units.length>=8&&g.units.slice(1,8).every(u=>!u.officer&&!u.uniqueId));
  assert.ok(group,'require an existing eight-unit hive group on LV-742');
  const template=config.profiles.find(p=>p.id===group.units[1].profileId);
  assert.ok(template,'source squad template not found');
  function editProfile(id,type){
    const existing=config.profiles.find(p=>p.id===id);
    if(existing){
      assert.ok(!config.groups.some(g=>g.units.some(u=>u.profileId===id)),
        'test fixture must not rewrite an unrelated source unit profile');
      existing.species='xeno';existing.actorType=type;existing.maxHp=type==='carrier'?350:100;
    }else config.profiles.push({...template,id,name:type,species:'xeno',
      actorType:type,maxHp:type==='carrier'?350:100,role:'line'});
  }
  editProfile('XEN-009','carrier');
  editProfile('TEST-FINITE-FACEHUGGER','facehugger');
  group.units[1].profileId='XEN-009';
  for(const unit of group.units.slice(2,8))
    unit.profileId='TEST-FINITE-FACEHUGGER';
  const sim=new BattleSimulation(config),carrierId=group.units[1].id,
    passengerIds=group.units.slice(2,8).map(u=>u.id);
  return {config,sim,carrierId,passengerIds,groupId:group.id,
    dispose(){sim.dispose();}};
}
const snapshot=sim=>JSON.stringify(sim.getCounts());

test('source Carrier loads exactly six existing IDs, not six free facehuggers',()=>{
  const f=fixture();
  try{
    const {sim,carrierId,passengerIds}=f,before=snapshot(sim);
    assert.equal(CARRIER_CARGO_RULES.ordinaryCapacity,6);
    assert.equal(CARRIER_CARGO_RULES.upgradedCapacity,12);
    assert.equal(CARRIER_CARGO_RULES.upgradeImplemented,false);
    const result=sim.loadCarrierCargo(carrierId,passengerIds);
    assert.equal(result.accepted,true);
    assert.deepEqual(result.facehuggerIds,passengerIds);
    assert.deepEqual(sim.units.get(carrierId).carrierCargoIds,passengerIds);
    for(const id of passengerIds){
      const unit=sim.units.get(id);
      assert.equal(unit.carriedByCarrierId,carrierId);
      assert.deepEqual(unit.position,sim.units.get(carrierId).position);
    }
    assert.equal(sim.units.size,sim.initialAllocated);
    assert.equal(snapshot(sim),before);
    assert.equal(sim.assertConservation(),true);
    const doubled=sim.loadCarrierCargo(carrierId,passengerIds);
    assert.equal(doubled.accepted,false);
    assert.deepEqual(sim.units.get(carrierId).carrierCargoIds,passengerIds);
  }finally{f.dispose();}
});

test('Carrier cargo is protected from offscreen attack and front capture, yet can be unloaded as the SAME individuals',()=>{
  const f=fixture();
  try{
    const {sim,carrierId,passengerIds}=f;
    assert.equal(sim.loadCarrierCargo(carrierId,passengerIds).accepted,true);
    const attacks=passengerIds.map(id=>sim.units.get(id).nextAttack);
    sim._remoteCombat();
    sim._captureStep(.25);
    assert.deepEqual(passengerIds.map(id=>sim.units.get(id).nextAttack),attacks);
    const before=snapshot(sim);
    const release=sim.releaseCarrierCargo(carrierId,2);
    assert.equal(release.accepted,true);
    assert.deepEqual(release.facehuggerIds,passengerIds.slice(0,2));
    for(const id of passengerIds.slice(0,2))
      assert.equal(sim.units.get(id).carriedByCarrierId,undefined);
    assert.equal(sim.units.get(carrierId).carrierCargoIds.length,4);
    assert.equal(sim.releaseCarrierCargo(carrierId).accepted,true);
    assert.equal(sim.units.get(carrierId).carrierCargoIds,undefined);
    assert.equal(snapshot(sim),before);
    assert.equal(sim.assertConservation(),true);
  }finally{f.dispose();}
});

test('held Facehuggers retain health outside Hive-space and follow their one finite Carrier',()=>{
  const f=fixture();
  try{
    const {sim,carrierId,passengerIds}=f;
    assert.equal(sim.loadCarrierCargo(carrierId,passengerIds).accepted,true);
    const carrier=sim.units.get(carrierId);
    const originalHp=sim.units.get(passengerIds[0]).hp;
    const ecology={banks:[{id:'hive'}],nodes:[]};
    const exposure=applyFacehuggerExposure(ecology,sim.units.values(),.5,11);
    assert.equal(exposure.some(hit=>passengerIds.includes(hit.unitId)),false,
      'all six carried Facehuggers remain sheltered by this finite Carrier');
    const free=[...sim.units.values()].find(unit=>
      unit.species==='xenomorph'&&unit.actorType==='facehugger'&&
      unit.carriedByCarrierId===undefined&&unit.hp>0&&
      ['active','distant'].includes(unit.state));
    assert.ok(free,'the source allocation also has free Facehuggers');
    assert.ok(exposure.some(hit=>hit.unitId===free.id),
      'free Facehuggers still incur real environmental exposure outside Hive-space');
    assert.equal(sim.units.get(passengerIds[0]).hp,originalHp);
    assert.equal(sim.syncUnit(carrierId,{position:[carrier.position[0]+2,carrier.position[1]+1]}),true);
    for(const id of passengerIds)
      assert.deepEqual(sim.units.get(id).position,sim.units.get(carrierId).position);
    assert.equal(sim.assertConservation(),true);
  }finally{f.dispose();}
});

test('Carrier cargo survives version-1 checkpoint with zero changes to allocated identities',()=>{
  const f=fixture();
  try{
    const {sim,carrierId,passengerIds,config}=f;
    assert.equal(sim.loadCarrierCargo(carrierId,passengerIds).accepted,true);
    const saved=sim.saveState(),restored=BattleSimulation.fromState(config,saved);
    try{
      assert.deepEqual(restored.units.get(carrierId).carrierCargoIds,passengerIds);
      for(const id of passengerIds)
        assert.equal(restored.units.get(id).carriedByCarrierId,carrierId);
      assert.equal(restored.digest,sim.digest);
      assert.equal(restored.initialAllocated,sim.initialAllocated);
      assert.equal(restored.assertConservation(),true);
    }finally{restored.dispose();}
    const mutations=[
      state=>state.units.find(u=>u.id===carrierId).carrierCargoIds.push(passengerIds[0]),
      state=>state.units.find(u=>u.id===carrierId).carrierCargoIds.push('fake-hugger'),
      state=>state.units.find(u=>u.id===passengerIds[0]).carriedByCarrierId='fake-carrier',
      state=>state.units.find(u=>u.id===passengerIds[0]).position=[777,777],
      state=>state.units.find(u=>u.id===carrierId).carrierCargoIds=[],
      state=>state.units.find(u=>u.id===passengerIds[0]).carriedByCarrierId=undefined
    ];
    for(const mutation of mutations){
      const fake=structuredClone(saved);mutation(fake);
      assert.throws(()=>BattleSimulation.fromState(config,fake),/invalid saved Carrier cargo/);
    }
    assert.equal(sim.assertConservation(),true);
  }finally{f.dispose();}
});

test('Carrier death scatters its PREEXISTING cargo, without new entities, reserve, or additional kill credit',()=>{
  const f=fixture();
  try{
    const {sim,carrierId,passengerIds,config}=f;
    assert.equal(sim.loadCarrierCargo(carrierId,passengerIds).accepted,true);
    const initialSize=sim.units.size,deadBefore=sim.deaths.size;
    assert.equal(sim.recordDeath({entityId:passengerIds[0],cause:'illicit-remote-hit'}),false);
    assert.equal(sim.recordDeath({entityId:carrierId,cause:'carrier-destroyed'}),true);
    assert.equal(sim.units.get(carrierId).state,'dead');
    assert.equal(sim.deaths.size,deadBefore+1);
    assert.equal(sim.units.size,initialSize);
    for(const id of passengerIds){
      assert.equal(sim.units.get(id).carriedByCarrierId,undefined);
      assert.equal(sim.units.get(id).state,'distant');
    }
    assert.equal(sim.assertConservation(),true);
    const restored=BattleSimulation.fromState(config,sim.saveState());
    try{assert.equal(restored.assertConservation(),true);}
    finally{restored.dispose();}
  }finally{f.dispose();}
});

test('invalid Carrier cargo cannot cross factions, media, or the six-slot source limit',()=>{
  const f=fixture();
  try{
    const {sim,carrierId,passengerIds}=f;
    const old=snapshot(sim);
    assert.equal(sim.loadCarrierCargo(carrierId,[...passengerIds,passengerIds[0]]).accepted,false);
    assert.equal(sim.loadCarrierCargo(carrierId,[...passengerIds,'invented']).accepted,false);
    assert.equal(sim.loadCarrierCargo(carrierId,[passengerIds[0],passengerIds[0]]).accepted,false);
    assert.equal(planFiniteCarrierLoad({...sim,config:{id:'AFF-14'}},carrierId,passengerIds).accepted,false);
    assert.equal(snapshot(sim),old);
    assert.equal(validateFiniteCarrierCargo(sim,sim.units),true);
    assert.equal(sim.assertConservation(),true);
  }finally{f.dispose();}
});

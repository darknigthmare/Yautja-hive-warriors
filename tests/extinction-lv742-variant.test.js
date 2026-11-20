import test from 'node:test';
import assert from 'node:assert/strict';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { applyExtinctionBattleVariant } from '../js/battlefield/ExtinctionBattleVariant.js';

const listIds=config=>config.groups.flatMap(group=>group.units.map(u=>u.id)).sort();
const totals=config=>Object.fromEntries(Object.entries(config.budgets.byFaction).map(
  ([id,counts])=>[id,counts.total]));
const find=config=>config.groups.flatMap(g=>g.units.map(u=>({u,g})));
const scenario=(variant='none')=>createOperationScene({operationId:'AFF-27',
  mapSeed:0,extinctionVariant:variant}).config;

test('the selectable LV-742 source variant preserves ALL original finite IDs, factions and budgets',()=>{
  const normal=scenario(),variant=scenario('carrier-ravager');
  assert.deepEqual(listIds(variant),listIds(normal));
  assert.deepEqual(totals(variant),totals(normal));
  assert.equal(variant.groups.length,normal.groups.length);
  assert.equal(variant.context.extinctionCasteVariant,'carrier-ravager');
  assert.equal(variant.context.visualFidelity1to1Verified,false);
  assert.deepEqual(BattleActorBridge.unsupportedProfiles(variant),[]);
  const units=find(variant);
  const carrier=units.filter(({u})=>u.profileId==='XEN-009');
  const ravager=units.filter(({u})=>u.profileId==='XEN-010');
  assert.equal(carrier.length,1);assert.equal(ravager.length,1);
  const held=carrier[0].g.units.filter(u=>variant.profiles.some(p=>
    p.id===u.profileId&&p.actorType==='facehugger'));
  assert.equal(held.length,6);
  assert.equal(normal.profiles.some(p=>p.id==='XEN-009'),false);
  assert.equal(normal.profiles.some(p=>p.id==='XEN-010'),false);
});

test('the LV-742 variant boards exactly six existing Facehuggers at mission initialization',()=>{
  const config=scenario('carrier-ravager');
  const sim=new BattleSimulation(config);
  try{
    const carrier=[...sim.units.values()].find(u=>u.profileId==='XEN-009');
    const cargo=carrier.carrierCargoIds;
    assert.equal(cargo.length,6);
    for(const id of cargo){
      const occupant=sim.units.get(id);
      assert.equal(occupant.carriedByCarrierId,carrier.id);
      assert.equal(occupant.actorType,'facehugger');
      assert.equal(occupant.state,'distant');
    }
    assert.equal(sim.units.size,sim.initialAllocated);
    assert.equal(sim.assertConservation(),true);
    const saved=sim.saveState(),restored=BattleSimulation.fromState(config,saved);
    try{
      assert.deepEqual(restored.units.get(carrier.id).carrierCargoIds,cargo);
      assert.equal(restored.digest,sim.digest);
      assert.equal(restored.initialAllocated,sim.initialAllocated);
      assert.equal(restored.assertConservation(),true);
    }finally{restored.dispose();}
  }finally{sim.dispose();}
});

test('normal AFF-27 cannot be interpreted as the optional Carrier/Ravager checkpoint',()=>{
  const normal=scenario(),caste=scenario('carrier-ravager');
  const base=new BattleSimulation(normal),special=new BattleSimulation(caste);
  try{
    assert.notEqual(base.digest,special.digest);
    assert.deepEqual(listIds(caste),listIds(normal));
    assert.throws(()=>BattleSimulation.fromState(caste,base.saveState()),
      /save does not match this operation or has an invalid clock/);
    assert.throws(()=>BattleSimulation.fromState(normal,special.saveState()),
      /save does not match this operation or has an invalid clock/);
    assert.equal(base.assertConservation(),true);
    assert.equal(special.assertConservation(),true);
  }finally{base.dispose();special.dispose();}
});

test('the CASTE preset cannot leak into Lethe, Sevastopol or an unknown option',()=>{
  const base=getBattleOperationConfig('AFF-14');
  assert.throws(()=>applyExtinctionBattleVariant(base,'carrier-ravager'),
    /exclusive to AFF-27/);
  assert.throws(()=>createOperationScene({operationId:'AFF-13',
    extinctionVariant:'carrier-ravager'}),/exclusive to AFF-27/);
  assert.throws(()=>createOperationScene({operationId:'AFF-27',
    extinctionVariant:'auto-spawn'}),/exclusive to AFF-27/);
  assert.equal(applyExtinctionBattleVariant(base,'none'),base);
});

test('fronts/operation setup exposes an opt-in checkbox rather than silently changing the baseline',async()=>{
  const {readFileSync}=await import('node:fs');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const main=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
  assert.match(html,/id="extinction-variant-enabled"/);
  assert.match(main,/casteEligible=mode\.value==='fronts'&&select\.value==='AFF-27'/);
  assert.match(main,/saved\.scene\?\.extinctionVariant\?\?'none'/);
});

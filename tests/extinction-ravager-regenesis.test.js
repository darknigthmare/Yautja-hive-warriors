import test from 'node:test';
import assert from 'node:assert/strict';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { RAVAGER_REGENESIS, isUpgradedRavager } from '../js/battlefield/ExtinctionRavagerRegenesis.js';

function fixture({upgraded=true}={}){
  const config=structuredClone(getBattleOperationConfig('AFF-27'));
  const hive=new Set(config.factions.filter(f=>f.species==='xeno').map(f=>f.id));
  const group=config.groups.find(g=>hive.has(g.factionId)&&g.state==='distant'&&
    g.units.length>=3&&!g.units[1].officer&&!g.units[1].uniqueId);
  assert.ok(group,'an existing source Hive soldier must be reprofiled, not added');
  const original=config.profiles.find(p=>p.id===group.units[1].profileId);
  assert.ok(original);
  assert.ok(!config.profiles.some(p=>p.id==='XEN-010'),'fixture must not override existing production profile');
  config.profiles.push({...original,id:'XEN-010',name:'Ravager',
    actorType:'ravager',maxHp:1000,damage:52,attackInterval:2,
    ...(upgraded?{extinctionUpgrade:'colossal-resilience'}:{})});
  const id=group.units[1].id;group.units[1].profileId='XEN-010';
  const sim=new BattleSimulation(config);
  return{sim,config,id,dispose(){sim.dispose();}};
}

test('distant upgraded Ravager enters catalepsy with its existing identity and recovers at half HP',()=>{
  const f=fixture();
  try{
    const {sim,id,config}=f,unit=sim.units.get(id),startCount=sim.units.size,
      oldCounts=sim.getCounts(),digest=sim.digest;
    assert.equal(isUpgradedRavager(sim,unit),true);
    assert.equal(RAVAGER_REGENESIS.sourceVisualFidelity1to1Verified,false);
    assert.equal(RAVAGER_REGENESIS.upgradePurchaseUIImplemented,false);
    assert.equal(sim.damageDistantRavager(id,600,{damageType:'raw'}).reason,'ordinary_damage');
    assert.equal(sim.damageDistantRavager(id,350,{damageType:'raw'}).reason,'catalepsy_started');
    assert.equal(unit.incapacitated,true);
    assert.equal(unit.ravagerRegenesisSpent,true);
    assert.equal(unit.hp,50);
    assert.equal(sim.deaths.has(id),false);
    assert.equal(sim.damageDistantRavager(id,0,{damageType:'raw'}).cataleptic,true);
    assert.deepEqual(sim.getCounts(),oldCounts);
    const saved=sim.saveState(),restored=BattleSimulation.fromState(config,saved);
    try{
      assert.deepEqual(restored.units.get(id).ravagerCatalepsy,unit.ravagerCatalepsy);
      restored.time=restored.units.get(id).ravagerCatalepsy.recoverAt-.25;
      assert.equal(restored._ravagerRegenesisStep(),0);
      assert.equal(restored.units.get(id).incapacitated,true);
      restored.time+=.25;
      assert.equal(restored._ravagerRegenesisStep(),1);
      assert.equal(restored.units.get(id).hp,500);
      assert.equal(restored.units.get(id).incapacitated,false);
      assert.equal(restored.units.get(id).ravagerCatalepsy,undefined);
      assert.equal(restored.units.get(id).ravagerRegenesisSpent,true);
      assert.equal(restored.digest,digest);
      assert.equal(restored.units.size,startCount);
      assert.equal(restored.assertConservation(),true);
      assert.equal(restored.damageDistantRavager(id,450,{damageType:'raw'}).reason,'ordinary_damage');
      assert.equal(restored.units.get(id).ravagerCatalepsy,undefined,'no second free life');
    }finally{restored.dispose();}
  }finally{f.dispose();}
});

test('fire and gross terminal damage prevent distant Ravager regenesis',()=>{
  for(const cause of ['fire','napalm','raw']){
    const f=fixture();
    try{
      const {sim,id}=f,deathBefore=sim.deaths.size;
      const applied=cause==='raw'?sim.damageDistantRavager(id,5000,{damageType:cause}):
        sim.damageDistantRavager(id,5000,{damageType:cause});
      assert.equal(applied.killed,true);
      assert.equal(applied.cataleptic,false);
      assert.equal(sim.units.get(id).state,'dead');
      assert.equal(sim.deaths.size,deathBefore+1);
      assert.equal(sim.units.get(id).ravagerCatalepsy,undefined);
      assert.equal(sim.assertConservation(),true);
    }finally{f.dispose();}
  }
});

test('a cataleptic Ravager is vulnerable to additional hits and can die only once',()=>{
  const f=fixture();
  try{
    const {sim,id}=f;
    sim.damageDistantRavager(id,600,{damageType:'raw'});
    sim.damageDistantRavager(id,350,{damageType:'raw'});
    assert.equal(sim.units.get(id).incapacitated,true);
    assert.equal(sim.damageDistantRavager(id,90,{damageType:'kinetic'}).killed,true);
    assert.equal(sim.deaths.has(id),true);
    assert.equal(sim.units.get(id).ravagerCatalepsy,undefined);
    assert.equal(sim._ravagerRegenesisStep(),0);
    assert.equal(sim.recordDeath({entityId:id,cause:'duplicate'}),false);
    assert.equal(sim.assertConservation(),true);
  }finally{f.dispose();}
});

test('only mission-signed Extinction upgraded profile can carry a catalepsy save state',()=>{
  const f=fixture({upgraded:false});
  try{
    const {sim,config,id}=f,unit=sim.units.get(id);
    assert.equal(isUpgradedRavager(sim,unit),false);
    assert.equal(sim.damageDistantRavager(id,150,{damageType:'raw'}),null);
    const data=sim.saveState(),target=data.units.find(u=>u.id===id);
    target.ravagerRegenesisSpent=true;
    target.ravagerCatalepsy={startedAt:0,recoverAt:12};
    target.incapacitated=true;
    assert.throws(()=>BattleSimulation.fromState(config,data),/invalid saved Ravager regenesis/);
    assert.equal(sim.assertConservation(),true);
  }finally{f.dispose();}
});

test('forged catalepsy timer and premature resurrection are rejected on restore',()=>{
  const f=fixture();
  try{
    const {sim,id,config}=f;
    sim.damageDistantRavager(id,600,{damageType:'raw'});
    sim.damageDistantRavager(id,350,{damageType:'raw'});
    const saved=sim.saveState();
    const mutations=[
      u=>u.ravagerCatalepsy.recoverAt+=1000,
      u=>u.ravagerCatalepsy.startedAt=-1,
      u=>u.ravagerRegenesisSpent=false,
      u=>u.incapacitated=false,
      u=>u.ravagerCatalepsy={startedAt:0,recoverAt:12,bonusLives:4}
    ];
    for(const mutation of mutations){
      const data=structuredClone(saved);
      mutation(data.units.find(u=>u.id===id));
      assert.throws(()=>BattleSimulation.fromState(config,data),/invalid saved Ravager regenesis/);
    }
  }finally{f.dispose();}
});

test('upgraded Ravager resists medium kinetic damage without inventing source-exact combat statistics',()=>{
  const f=fixture();
  try{
    const {sim,id}=f,unit=sim.units.get(id);
    const r=sim.damageDistantRavager(id,100,{damageType:'kinetic'});
    assert.equal(Math.round(r.damage),82);
    assert.equal(unit.hp,918);
    assert.equal(unit.ravagerCatalepsy,undefined);
    assert.equal(sim.assertConservation(),true);
  }finally{f.dispose();}
});

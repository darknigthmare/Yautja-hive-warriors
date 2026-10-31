import test from 'node:test';
import assert from 'node:assert/strict';
import { BATTLE_OPERATIONS, getBattleOperationConfig, getBattleBudget } from '../js/data/BattleCatalog.js';
import { ORIGINAL_MUSOU_FRONT_PLANS, ORIGINAL_MUSOU_COMMANDER_FRONTS, getOriginalMusouFrontPlan }
  from '../js/data/OriginalMusouFrontAllocations.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { createOperationScene } from '../js/battlefield/OperationScene.js';

const audited=['AFF-06','AFF-07','AFF-08','AFF-09','AFF-10'];
const sum=(plan,category,side)=>plan[category].flatMap(front=>front[side]).reduce((n,row)=>n+row.npc,0);
const commander=(config)=>config.groups.flatMap(group=>group.units.filter(unit=>unit.uniqueId)
  .map(unit=>({group,unit}))).find(({unit})=>
  ['BOS-29','BOS-30','BOS-31'].some(id=>unit.uniqueId===id||unit.uniqueId===`${config.id}:${id}`));

test('five distinct audited source-front plans reproduce the exact written budgets without spawning civilians',()=>{
  assert.deepEqual(Object.keys(ORIGINAL_MUSOU_FRONT_PLANS),audited);
  for(const id of audited){
    const plan=getOriginalMusouFrontPlan(id),op=BATTLE_OPERATIONS.find(row=>row.id===id),budget=getBattleBudget(op.budgetId);
    assert.ok(plan);
    for(const [name,spec] of [['active',budget],['distant',budget],['reserve',budget]]){
      const label=name==='active'?'Active':name==='distant'?'Distant':'Reserve';
      assert.equal(sum(plan,name,'enemy'),spec['enemy'+label],id+'/'+name+'/enemy');
      assert.equal(sum(plan,name,'ally'),spec['ally'+label],id+'/'+name+'/ally');
    }
    for(const stage of ['active','distant','reserve'])for(const front of plan[stage]){
      const valid=stage==='reserve'?front.front==='Réserve':/^[A-D]$/.test(front.front);
      assert.equal(valid,true,id);
      for(const row of [...front.enemy,...front.ally]){
        assert.equal(Number.isSafeInteger(row.squads),true);
        assert.equal(row.npc % row.squads,0);
      }
    }
    assert.equal(Object.isFrozen(plan),true);
  }
  assert.equal(getOriginalMusouFrontPlan('constructor'),null);
  assert.equal(getOriginalMusouFrontPlan('__proto__'),null);
  assert.equal(getOriginalMusouFrontPlan('AFF-27'),null);
});

test('all five Musou commanders occupy their declared active eight-person command cell and distinct original identity',()=>{
  for(const id of audited){
    const config=getBattleOperationConfig(id),command=commander(config),source=ORIGINAL_MUSOU_COMMANDER_FRONTS[id];
    assert.ok(command,id);
    assert.deepEqual(command.group.sourceTemplateIds,['GRP-42']);
    assert.equal(command.group.units.length,8);
    assert.equal(command.group.frontId,`front_${source.front.toLowerCase()}`);
    assert.equal(command.group.sourceState,'active');
    assert.equal(command.group.units.filter(u=>u.uniqueId).length,1);
    const profile=config.profiles.find(p=>p.id===command.unit.profileId);
    assert.equal(profile.sourceBossId,source.boss);
    assert.equal(command.unit.officer,true);
    assert.equal(command.unit.uniqueId,id==='AFF-06'?source.boss:`${id}:${source.boss}`);
    assert.match(config.context.frontAllocationProvenance,/original-audit-front-v1/);
  }
});

test('the authored deployment keeps exactly the same 264/800 finite group IDs and reserves as the old plan',()=>{
  for(const id of audited){
    const modern=getBattleOperationConfig(id),legacy=getBattleOperationConfig(id,{deploymentPlan:'historical-fallback'});
    const identity=config=>config.groups.map(group=>({
      id:group.id,factionId:group.factionId,frontId:group.frontId,state:group.state,
      sourceState:group.sourceState,template:group.sourceTemplateIds,units:group.units.map(unit=>unit.id)
    }));
    assert.deepEqual(identity(modern),identity(legacy),id);
    assert.deepEqual(modern.budgets,legacy.budgets,id);
    assert.equal(modern.groups.reduce((sum,g)=>sum+g.units.length,0),id==='AFF-06'||id==='AFF-07'?264:800);
    assert.equal(modern.groups.filter(g=>g.sourceState==='reserve').reduce((n,g)=>n+g.units.length,0),
      id==='AFF-06'||id==='AFF-07'?64:264);
    assert.equal(modern.groups.flatMap(g=>g.units).filter(u=>u.uniqueId).length,1);
    assert.equal(legacy.context.frontAllocationProvenance,undefined);
    assert.equal(new Set(modern.groups.flatMap(g=>g.units).map(u=>u.id)).size,
      modern.groups.reduce((sum,g)=>sum+g.units.length,0));
  }
});

test('historical checkpoints remain loadable with their exact source roster, wounds and unique boss positions',()=>{
  for(const id of audited){
    const oldConfig=getBattleOperationConfig(id,{deploymentPlan:'historical-fallback'});
    const old=new BattleSimulation(oldConfig);
    const soldier=[...old.units.values()].find(unit=>!unit.uniqueId&&unit.hp>30);
    const total=old.units.size, woundedHP=soldier.hp-21;
    try{
      old.syncUnit(soldier.id,{hp:woundedHP,position:[...soldier.position]});
      const saved=old.saveState();
      const restored=BattleSimulation.fromState(oldConfig,saved);
      try{
        assert.equal(restored.units.size,total);
        assert.equal(restored.getUnit(soldier.id).hp,woundedHP);
        assert.equal(restored.assertConservation(),true);
        assert.deepEqual(restored.getCounts(),old.getCounts());
      }finally{restored.dispose();}
      assert.throws(()=>BattleSimulation.fromState(getBattleOperationConfig(id),saved),
        /save does not match this operation/);
    }finally{old.dispose();}
  }
});

test('the authored deployment persists its own boss identity without changing another incarnation',()=>{
  const ids=[];
  for(const id of audited){
    const config=getBattleOperationConfig(id),sim=new BattleSimulation(config);
    try{
      const boss=commander(config);
      ids.push(boss.unit.uniqueId);
      const saved=sim.saveState();
      const resumed=BattleSimulation.fromState(config,saved);
      try{
        assert.equal(resumed.getUnit(boss.unit.id).uniqueId,boss.unit.uniqueId);
        assert.equal(resumed.assertConservation(),true);
      }finally{resumed.dispose();}
    }finally{sim.dispose();}
  }
  assert.equal(new Set(ids).size,ids.length);
});

test('the scene router constructs either authored or historical layouts without changing the level and objectives',()=>{
  for(const id of audited){
    const now=createOperationScene({operationId:id,deploymentPlan:'authored'});
    const prior=createOperationScene({operationId:id,deploymentPlan:'historical-fallback'});
    assert.equal(now.layout.mapId,prior.layout.mapId);
    assert.equal(now.level.id,prior.level.id);
    assert.equal(now.config.objectives.externalVictory,true);
    assert.deepEqual(now.config.sourceObjectives,prior.config.sourceObjectives);
    const modernSim=new BattleSimulation(now.config),legacySim=new BattleSimulation(prior.config);
    try{assert.notEqual(modernSim.digest,legacySim.digest);}
    finally{modernSim.dispose();legacySim.dispose();}
    assert.equal(commander(now.config).group.sourceState,'active');
    // The historical fallback already respected the source command front.
    // The authored plan makes that correspondence explicit and scopes
    // repeated human officers to their independent mission incarnations.
    assert.equal(commander(prior.config).group.sourceState,'active');
  }
});

test('unrelated cross-media battles remain byte-for-byte equal under the new deployment switch',()=>{
  for(const operation of BATTLE_OPERATIONS.filter(row=>!audited.includes(row.id))){
    const options={allowHumanController:true};
    const now=getBattleOperationConfig(operation.id,{...options,deploymentPlan:'authored'});
    const prior=getBattleOperationConfig(operation.id,{...options,deploymentPlan:'historical-fallback'});
    assert.deepEqual(now,prior,operation.id);
  }
  assert.throws(()=>getBattleOperationConfig('AFF-06',{deploymentPlan:'unverified'}),/unknown front deployment plan/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { stageOriginalMusouGroups } from '../js/battlefield/OriginalMusouStaging.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';

const missions=['AFF-06','AFF-07','AFF-08','AFF-09','AFF-10'];
const squared=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
const within=(p,b,inset=0)=>
  p[0]>=b.minX+inset-1e-5&&p[0]<=b.maxX-inset+1e-5&&
  p[1]>=b.minZ+inset-1e-5&&p[1]<=b.maxZ-inset+1e-5;
const indexFor=(layout,id)=>layout.sectors.find(s=>s.id===id);

test('five authored ORIGINAL Musou maps stage all existing soldiers on unique sector-bound cells at three seeds',()=>{
 for(const id of missions)for(const seed of [0,53,0xabcdef]){
   const {config,layout}=createOperationScene({operationId:id,mapSeed:seed,deploymentPlan:'authored'});
   const stage=config.sceneBinding.musouStaging;
   assert.equal(stage.policy,'original-musou-sector-grid-v1',id);
   assert.equal(stage.fronts.length,config.fronts.length);
   assert.equal(config.context.visualFidelity1to1Verified,false);
   assert.equal(config.sceneBinding.originalGeographicProposalConstructed,false);
   const snapshots=new Set(),beforeUnits=config.groups.reduce((n,group)=>n+group.units.length,0);
   for(const front of config.fronts){
     const anchor=config.sceneBinding.frontSectorIds[config.fronts.indexOf(front)];
     const sector=indexFor(layout,anchor);
     assert.ok(sector, id+'/'+front.id);
     const groups=config.groups.filter(g=>g.frontId===front.id);
     const positions=groups.map(g=>g.position);
     assert.equal(stage.fronts.find(f=>f.frontId===front.id).groups,groups.length);
     assert.equal(new Set(positions.map(p=>p.join(','))).size,positions.length,id+'/'+front.id+'/unique-cells');
     for(let i=0;i<groups.length;i++){
       const group=groups[i];
       assert.ok(within(group.position,sector.bounds,7),id+'/'+group.id+'/stage-bounds');
       assert.ok(squared(group.position,sector.objective.position)>=
         (Math.max(9,(sector.objective.radius??0)+5)-1e-3)**2,id+'/'+group.id+'/free-objective');
       for(const task of config.operationObjectives?.tasks??[]){
         if(task.frontId!==front.id)continue;
         assert.ok(Math.sqrt(squared(group.position,task.position))>=
           Math.max(10,(task.radius??4.5)+6.1)-.01,
           id+'/'+group.id+'/'+task.id+'/narrative-interaction-clearance');
       }
       for(const gate of layout.gates){
         if(!Array.isArray(gate.center))continue;
         assert.ok(Math.sqrt(squared(group.position,gate.center))>=
           Math.max(5,(layout.corridorWidth??18)/2+2)-.01,
           id+'/'+group.id+'/'+gate.id+'/gate-clearance');
       }
       for(const unit of group.units){
         assert.ok(within(unit.position,sector.bounds,3.5),id+'/'+unit.id+'/member-bounds');
         assert.ok(squared(unit.position,group.position)<=3.2**2,id+'/'+unit.id+'/formation-radius');
         assert.equal(snapshots.has(unit.id),false,id+'/duplicate id');snapshots.add(unit.id);
       }
       for(let j=0;j<i;j++)
         assert.ok(Math.sqrt(squared(group.position,groups[j].position))>=11.99,id+'/'+group.id+'/spacing');
     }
   }
   assert.equal(snapshots.size,beforeUnits);
   const simulated=new BattleSimulation(config);
   try{assert.equal(simulated.assertConservation(),true);assert.equal(simulated.units.size,beforeUnits);}
   finally{simulated.dispose();}
 }
});

test('authoring is deterministic at a seed, but an alternative seed really changes stage coordinates',()=>{
 for(const id of missions){
   const first=createOperationScene({operationId:id,mapSeed:103,deploymentPlan:'authored'});
   const again=createOperationScene({operationId:id,mapSeed:103,deploymentPlan:'authored'});
   const alternate=createOperationScene({operationId:id,mapSeed:104,deploymentPlan:'authored'});
   const points=config=>config.groups.map(g=>g.position.join(','));
   assert.deepEqual(points(first.config),points(again.config),id);
   assert.notDeepEqual(points(first.config),points(alternate.config),id);
 }
});

test('an older save uses the unmodified legacy ring, reconstructing the same digest, deaths and soldier HP',()=>{
 for(const id of missions){
   const prior=createOperationScene({operationId:id,mapSeed:0,deploymentPlan:'historical-fallback'});
   const after=createOperationScene({operationId:id,mapSeed:0,deploymentPlan:'historical-fallback'});
   const authored=createOperationScene({operationId:id,mapSeed:0,deploymentPlan:'authored'});
   assert.deepEqual(prior.config,after.config,id);
   assert.equal(prior.config.sceneBinding.musouStaging,undefined,id);
   assert.ok(authored.config.sceneBinding.musouStaging);
   const legacy=new BattleSimulation(prior.config),beforeCount=legacy.units.size;
   try{
     const injured=[...legacy.units.values()].find(u=>u.hp>50&&!u.uniqueId&&u.state==='distant');
     assert.ok(injured);
     const hp=injured.hp-23;
     assert.equal(legacy.syncUnit(injured.id,{hp,position:[...injured.position]}),true);
     const save=legacy.saveState();
     const restored=BattleSimulation.fromState(after.config,save);
     try{
       assert.equal(restored.getUnit(injured.id).hp,hp);
       assert.equal(restored.units.size,beforeCount);
       assert.equal(restored.digest,legacy.digest);
       assert.equal(restored.assertConservation(),true);
     }finally{restored.dispose();}
     assert.throws(()=>BattleSimulation.fromState(authored.config,save),/save does not match/);
   }finally{legacy.dispose();}
 }
});

test('all other battles and pilot maps retain historical ring staging, regardless of the deployment switch',()=>{
 for(const id of ['AFF-01','AFF-11','AFF-13','AFF-27']){
   const one=createOperationScene({operationId:id,mapSeed:0,deploymentPlan:'authored'});
   const two=createOperationScene({operationId:id,mapSeed:0,deploymentPlan:'historical-fallback'});
   assert.deepEqual(one.config,two.config,id);
   assert.equal(one.config.sceneBinding.musouStaging,undefined);
 }
});

test('a deliberately undersized floor is rejected instead of spawning squads outside the built level',()=>{
 const config={
   playerFaction:'player_clan',context:{frontAllocationProvenance:'original-audit-front-v1; not canon'},
   fronts:[{id:'front_a'}],
   groups:Array.from({length:16},(_,index)=>({
     id:'squad-'+index,frontId:'front_a',factionId:'human_force',sourceState:'active',
     units:Array.from({length:8},(_,i)=>({id:index+':'+i}))
   }))
 };
 const layout={sectors:[{id:'tiny',center:[0,0],
   bounds:{minX:-15,maxX:15,minZ:-15,maxZ:15},
   objective:{position:[0,0],radius:8}}],corridorWidth:18,gates:[]};
 assert.throws(()=>stageOriginalMusouGroups(config,layout,['tiny']),/cannot fit/);
 assert.equal(config.groups[0].units.length,8);
});

test('Musou staging metadata never silently certifies canonical geometry or measured props',()=>{
 for(const id of missions){
   const {config}=createOperationScene({operationId:id});
   assert.equal(config.context.visualFidelity1to1Verified,false);
   assert.equal(config.sceneBinding.musouStaging.provenance.includes('not'),true);
   assert.equal(config.sceneBinding.originalGeographicProposalConstructed,false);
   assert.ok(config.sceneBinding.musouStaging.fronts.every(f=>f.allCentersInside));
 }
});

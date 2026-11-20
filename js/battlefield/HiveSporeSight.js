/* Extinction Hive spore-sight. This captures LAST OBSERVED POSITIONS, not
 * continuous omniscience; actors and structures already allocated to the
 * battle are the only emitters. Distances and TTL are game adaptations. */
export const HIVE_SPORE_RULES=Object.freeze({
  nodeRadius:18,runnerRadius:12,praetorianRadius:16,queenRadius:22,
  memorySeconds:10,maxContactsPerHive:96,maxEmittersPerHive:192,
  sampleEveryTicks:4,positionLimit:10000
});
const casteRadii=Object.freeze({runner:HIVE_SPORE_RULES.runnerRadius,
  praetorian:HIVE_SPORE_RULES.praetorianRadius,queen:HIVE_SPORE_RULES.queenRadius});
const point=p=>Array.isArray(p)&&p.length===2&&p.every(x=>Number.isFinite(x)&&Math.abs(x)<=HIVE_SPORE_RULES.positionLimit);
const distanceSquared=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
const alive=u=>u&&u.hp>0&&['active','distant'].includes(u.state)&&!u.incapacitated;
const copy=v=>JSON.parse(JSON.stringify(v));
const id=v=>typeof v==='string'&&v.length>0&&v.length<=128;
const entryKey=x=>x&&`${x.sourceFaction}:${x.targetUnitId}`;
const biology=u=>u&&u.species!=='synthetic'&&['human','yautja','xenomorph'].includes(u.species);
const invalid=()=>{throw new RangeError('invalid saved hive spore sight');};

function nearestFront(position,fronts){
  let chosen=null,minimum=Infinity;
  for(const front of fronts.values()){
    const d=distanceSquared(position,front.position);
    if(d<minimum){minimum=d;chosen=front.id;}
  }
  return chosen;
}

/** Every observation is front-scoped and source-bounded. A dead hive emitter
 * cannot paint new targets; old echoes expire after a fixed simulated time. */
export function updateHiveSporeSight(ecology,units,groups,fronts,isHostile,time){
  if(!ecology?.banks?.length||!Number.isFinite(time)||time<0||
    typeof isHostile!=='function')return [];
  const roster=[...units], sourceFactions=new Set(ecology.banks.map(b=>b.factionId));
  const byGroup=new Map(groups), byFront=new Map();
  for(const unit of roster) {
    const group=byGroup.get(unit.groupId),frontId=group?.frontId;
    if(!frontId||!alive(unit)||!point(unit.position)||!biology(unit))continue;
    if(!byFront.has(frontId))byFront.set(frontId,[]);
    byFront.get(frontId).push(unit);
  }
  const existing=(ecology.spores??[]).filter(e=>e.expiresAt>time);
  const result=new Map(existing.map(e=>[entryKey(e),e]));
  for(const faction of sourceFactions){
    const emitters=[];
    for(const node of ecology.nodes)if(node.hp>0&&node.factionId===faction&&point(node.position)){
      const frontId=nearestFront(node.position,fronts);
      if(frontId)emitters.push({id:node.id,frontId,position:node.position,radius:HIVE_SPORE_RULES.nodeRadius});
    }
    for(const unit of roster){
      const radius=casteRadii[unit.actorType];
      if(!radius||unit.factionId!==faction||unit.species!=='xenomorph'||
        !alive(unit)||!point(unit.position))continue;
      const frontId=byGroup.get(unit.groupId)?.frontId;
      if(frontId)emitters.push({id:unit.id,frontId,position:unit.position,radius});
    }
    emitters.sort((a,b)=>a.id.localeCompare(b.id));
    for(const emitter of emitters.slice(0,HIVE_SPORE_RULES.maxEmittersPerHive)){
      for(const enemy of byFront.get(emitter.frontId)??[]){
        if(enemy.factionId===faction||!isHostile(faction,enemy.factionId)||
          distanceSquared(emitter.position,enemy.position)>emitter.radius*emitter.radius)continue;
        const value={sourceFaction:faction,targetUnitId:enemy.id,targetFaction:enemy.factionId,
          frontId:emitter.frontId,emitterId:emitter.id,position:[...enemy.position],
          observedAt:time,expiresAt:time+HIVE_SPORE_RULES.memorySeconds};
        result.set(entryKey(value),value);
      }
    }
  }
  const filtered=[];
  for(const faction of sourceFactions) {
    const matches=[...result.values()].filter(e=>e.sourceFaction===faction);
    matches.sort((a,b)=>b.observedAt-a.observedAt||
      a.targetUnitId.localeCompare(b.targetUnitId));
    filtered.push(...matches.slice(0,HIVE_SPORE_RULES.maxContactsPerHive));
  }
  ecology.spores=filtered.sort((a,b)=>a.sourceFaction.localeCompare(b.sourceFaction)||
    a.targetUnitId.localeCompare(b.targetUnitId));
  return copy(ecology.spores);
}

export function getHiveSporeContacts(ecology,factionId,time){
  if(!ecology?.banks?.some(b=>b.factionId===factionId)||
    !Number.isFinite(time))return [];
  return copy((ecology.spores??[]).filter(e=>e.sourceFaction===factionId&&e.expiresAt>time));
}

/** Saved echoes cannot invent unit identities, timed clairvoyance, or a
 * synthetic-host spore. Old checkpoints without spores restart empty. */
export function restoreHiveSporeSight(saved,ecology,units,fronts,savedTime){
  if(saved===undefined)return [];
  if(!Array.isArray(saved)||!Number.isFinite(savedTime)||
    saved.length>HIVE_SPORE_RULES.maxContactsPerHive*ecology.banks.length||
    new Set(saved.map(entryKey)).size!==saved.length)invalid();
  const bankIds=new Set(ecology.banks.map(b=>b.factionId)),numbers=new Map();
  for(const item of saved){
    const target=units.get(item?.targetUnitId);
    if(!item||!bankIds.has(item.sourceFaction)||!target||
       target.factionId!==item.targetFaction||target.factionId===item.sourceFaction||
       !biology(target)||!fronts.has(item.frontId)||!point(item.position)||
       !id(item.emitterId)||!Number.isFinite(item.observedAt)||
       item.observedAt<0||item.observedAt>savedTime||
       !Number.isFinite(item.expiresAt)||
       Math.abs(item.expiresAt-item.observedAt-HIVE_SPORE_RULES.memorySeconds)>1e-6)invalid();
    const emitter=units.get(item.emitterId);
    const isCasteEmitter=emitter&&emitter.factionId===item.sourceFaction&&
      emitter.species==='xenomorph'&&Object.hasOwn(casteRadii,emitter.actorType);
    const isNodeEmitter=item.emitterId.startsWith(`hive-node:${item.sourceFaction}:`)&&
      Number(item.emitterId.split(':').at(-1))>0&&
      Number(item.emitterId.split(':').at(-1))<=ecology.sequence;
    if(!isCasteEmitter&&!isNodeEmitter)invalid();
    numbers.set(item.sourceFaction,(numbers.get(item.sourceFaction)??0)+1);
  }
  if([...numbers.values()].some(n=>n>HIVE_SPORE_RULES.maxContactsPerHive))invalid();
  return copy(saved);
}

/* Original tactical rules. Slots are movement goals, never actor teleports. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const FORMATION_PROFILES = Object.freeze({
  wedge: Object.freeze({ label: 'Pointe', spacing: 3.2, sweep: 1, line_break: .78, support_fire: 1, flank: 1.12 }),
  line: Object.freeze({ label: 'Ligne', spacing: 3, sweep: 1.45, line_break: 1.1, support_fire: 1, flank: 1.15 }),
  phalanx: Object.freeze({ label: 'Phalange', spacing: 2.5, sweep: .85, line_break: 1.5, support_fire: .8, flank: 1.4 }),
  dispersed: Object.freeze({ label: 'Dispersée', spacing: 6, sweep: .6, line_break: .7, support_fire: .85, flank: .8 })
});
export function normalizeFormation(kind) { return ({ swarm:'dispersed', column:'wedge', flank:'wedge' })[kind] ?? (Object.hasOwn(FORMATION_PROFILES,kind) ? kind : 'line'); }
export function initializeFormation(group) {
  group.formation = normalizeFormation(group.formation);
  group.cohesion = Number.isFinite(group.cohesion) ? clamp(group.cohesion,0,100) : 100;
  group.rootUntil ??= 0; group.suppressedUntil ??= 0; group.officerThreatUntil ??= 0;
  return group;
}

export function formationSlots(kind, count, { origin=[0,0], target=[0,1], spacing, cohesion=100 }={}) {
  if (!Number.isInteger(count) || count<0 || count>64 || ![origin,target].every(point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite))) throw new TypeError('Finite formation positions and zero to 64 units are required');
  kind=normalizeFormation(kind); const distance=Math.hypot(target[0]-origin[0],target[1]-origin[1]);
  const forward=distance>.001 ? [(target[0]-origin[0])/distance,(target[1]-origin[1])/distance] : [0,1], right=[forward[1],-forward[0]];
  const step=(Number.isFinite(spacing) ? clamp(spacing,1.5,12) : FORMATION_PROFILES[kind].spacing)*(1+(100-clamp(cohesion,0,100))*.006);
  const columns=Math.ceil(Math.sqrt(count));
  return Array.from({length:count},(_,index)=>{
    let lateral=0, depth=0;
    if(kind==='line') lateral=(index-(count-1)/2)*step;
    else if(kind==='wedge') { const row=Math.ceil(index/2); lateral=index===0 ? 0 : (index%2 ? -1 : 1)*row*step; depth=-row*step; }
    else if(kind==='phalanx') { lateral=(index%columns-(Math.min(columns,count)-1)/2)*step; depth=-Math.floor(index/columns)*step; }
    else { const angle=index*2.399963229728653, radius=step*Math.sqrt(index+.5); lateral=Math.cos(angle)*radius; depth=Math.sin(angle)*radius; }
    return {index,offset:[right[0]*lateral+forward[0]*depth,right[1]*lateral+forward[1]*depth],position:[origin[0]+right[0]*lateral+forward[0]*depth,origin[1]+right[1]*lateral+forward[1]*depth]};
  });
}

export function formationTargetForUnit(group, unitIds, unitId, {origin=group.position,target=group.targetPosition ?? group.position}={}) {
  const index=unitIds.indexOf(unitId); if(index<0)return null;
  return formationSlots(group.formation,unitIds.length,{origin,target,cohesion:group.cohesion})[index].position;
}
export function formationAttackKind(attack={}) {
  if(['sweep','line_break','support_fire','flank'].includes(attack.formationAttackKind))return attack.formationAttackKind;
  const type=String(attack.type ?? attack.attackKind ?? '');
  if(/sweep|whirl|spin|cleave|balayage|musou/i.test(type))return 'sweep';
  if(/line.?break|pierce|charge|lunge|thrust|shoulder/i.test(type))return 'line_break';
  if(/suppress|support.?fire/i.test(type))return 'support_fire';
  return null;
}
export function formationDamageMultiplier(group, kind) {
  if(!group || !kind)return 1;
  const profile=FORMATION_PROFILES[normalizeFormation(group.formation)], resilience=.65+.35*clamp(group.cohesion ?? 100,0,100)/100;
  return profile[kind]/resilience;
}
export function getFormationDamageMultiplier(simulation, actor, attack) {
  const group=simulation?.groups?.get(actor?.battleGroupId);return formationDamageMultiplier(group,formationAttackKind(attack));
}

export function applyFormationImpact(simulation,{groupId,kind,sourceFaction,attackId,hitUnitIds=[],strength=1}={}) {
  const group=simulation?.groups?.get(groupId);
  if(!group || simulation.disposed || simulation.result || !['sweep','line_break','support_fire','flank'].includes(kind) || !Number.isFinite(strength) || strength<=0 || sourceFaction && !simulation.areHostile(sourceFaction,group.factionId))return {accepted:false,reason:'invalid_impact'};
  const hits=hitUnitIds.filter(unitId=>group.units.includes(unitId)); if(!hits.length)return {accepted:false,reason:'no_formation_member_hit'};
  initializeFormation(group); group._formationImpacts ??= {};
  if(group.officerId && hits.includes(group.officerId))group.officerThreatUntil=Math.max(group.officerThreatUntil,simulation.time+8);
  const token=`hit:${attackId ?? `${kind}:${simulation.time}`}`;
  if(Object.hasOwn(group._formationImpacts,token))return {accepted:false,reason:'impact_already_applied'};
  group._formationImpacts[token]=simulation.time; for(const [key,time] of Object.entries(group._formationImpacts))if(time<simulation.time-12)delete group._formationImpacts[key];
  while(Object.keys(group._formationImpacts).length>128)delete group._formationImpacts[Object.keys(group._formationImpacts)[0]];
  const multiplier=formationDamageMultiplier(group,kind), loss=clamp(({sweep:18,line_break:26,support_fire:12,flank:22}[kind])*multiplier*strength,1,55);
  group.cohesion=Math.max(0,group.cohesion-loss); group.lastFormationImpact=simulation.time;
  const rooted=kind==='line_break' && group.formation!=='dispersed' && group.units.filter(unitId=>(simulation.units.get(unitId)?.hp ?? 0)>0).length>=3;
  if(rooted)group.rootUntil=Math.max(group.rootUntil,simulation.time+clamp(.5+loss/35,.5,1.75));
  if(kind==='support_fire')group.suppressedUntil=Math.max(group.suppressedUntil,simulation.time+4);
  const officerHit=!!group.officerId && hits.includes(group.officerId);
  if(officerHit || group.cohesion<35)group.officerThreatUntil=Math.max(group.officerThreatUntil,simulation.time+8);
  const result={accepted:true,groupId,kind,cohesion:group.cohesion,loss,rootUntil:group.rootUntil,officerThreatened:officerHit || group.cohesion<35};
  simulation._emit?.('formation_disrupted',result,officerHit ? 2 : 1);return result;
}

export function updateFormation(group,delta,time,{officerAlive=true}={}) {
  initializeFormation(group);if(!Number.isFinite(delta)||delta<=0)return;
  if(time-(group.lastFormationImpact ?? -100)>4)group.cohesion=Math.min(100,group.cohesion+delta*(officerAlive ? 3 : .7));
}
export function formationAttackMultiplier(group,time) {
  if((group?.rootUntil ?? 0)>time)return 0;
  return (.5+.5*(group?.cohesion ?? 100)/100)*((group?.suppressedUntil ?? 0)>time ? .55 : 1);
}

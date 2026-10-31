/* Stage original Musou squads in actual constructed SECTOR rectangles, not
 * 100 platoons on the same 34-unit ring.  This is a deterministic level-binding
 * study, not a certified reproduction of any film or AVP: Extinction map.
 * Only the five original, versioned AFF-06..10 front plans opt in.
 */
const sq=(value)=>value*value;
const point=(p)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const between=(value,min,max)=>value>=min&&value<=max;
const stateRank=Object.freeze({active:0,distant:1,reserve:2});
const round=(value)=>Math.round(value*1000)/1000;

function sectorSlots(sector, layout, protectedSites = []){
  const bounds=sector?.bounds;
  if(!bounds||!point(sector.center)||!Number.isFinite(bounds.minX)||
    !Number.isFinite(bounds.maxX)||!Number.isFinite(bounds.minZ)||
    !Number.isFinite(bounds.maxZ))throw new TypeError('OriginalMusouStaging: invalid bounded sector');
  const inset=9, pitch=12;
  const positions=[];
  for(let x=bounds.minX+inset;x<=bounds.maxX-inset+1e-8;x+=pitch){
    for(let z=bounds.minZ+inset;z<=bounds.maxZ-inset+1e-8;z+=pitch){
      const task=sector.objective;
      // Leave the hero's physical objective usable; don't place a group
      // directly onto a cargo lift, terminal or interaction hotspot.
      if(point(task?.position)&&Math.hypot(x-task.position[0],z-task.position[1])<
        Math.max(9,(task?.radius??0)+5))continue;
      // OperationObjectives binds these narrative interaction centers AFTER
      // BattlefieldOperation. The original task offset is already available
      // here, so keep room for the hero, carried cargo and a co-op partner.
      if(protectedSites.some(site=>point(site.position)&&
        Math.hypot(x-site.position[0],z-site.position[1])<
          Math.max(10,(site.radius??4.5)+6.1)))continue;
      const at=[round(x),round(z)];
      if((layout?.gates??[]).some(gate=>point(gate.center)&&
        Math.hypot(gate.center[0]-at[0],gate.center[1]-at[1])<
          Math.max(5,(layout.corridorWidth??18)/2 + 2)))continue;
      positions.push(at);
    }
  }
  return positions;
}

/** Mutates ONLY group and member positions within the copied, new-operation
 * configuration. Never changes group/unit IDs, count, role, faction, state,
 * supply or relative front ID. Reserve identities are still NOT materialized. */
export function stageOriginalMusouGroups(configuration,layout,anchorSectorIds){
  if(configuration?.context?.frontAllocationProvenance!=='original-audit-front-v1; not canon')
    return null;
  if(!Array.isArray(anchorSectorIds)||anchorSectorIds.length!==configuration.fronts.length)
    throw new TypeError('OriginalMusouStaging: invalid front anchors');
  const sectorById=new Map(layout.sectors.map(s=>[s.id,s]));
  const markers=[];
  for(let frontIndex=0;frontIndex<configuration.fronts.length;frontIndex++){
    const front=configuration.fronts[frontIndex],sector=sectorById.get(anchorSectorIds[frontIndex]);
    if(!sector)throw new Error('OriginalMusouStaging: missing real anchor sector');
    const groups=configuration.groups.filter(group=>group.frontId===front.id).sort((a,b)=>
      (stateRank[a.sourceState]??9)-(stateRank[b.sourceState]??9)||
      a.id.localeCompare(b.id));
    const sites=(configuration.operationObjectives?.tasks??[])
      .filter(task=>task.frontId===front.id&&point(task.offset))
      .map(task=>({position:[front.position[0]+task.offset[0],
        front.position[1]+task.offset[1]],radius:task.radius}));
    const candidates=sectorSlots(sector,layout,sites);
    if(candidates.length<groups.length)
      throw new Error(`OriginalMusouStaging: ${front.id} cannot fit ${groups.length} distinct groups on real floor (${candidates.length} safe cells)`);
    const halfWidth=(sector.bounds.maxX-sector.bounds.minX)/2;
    const halfDepth=(sector.bounds.maxZ-sector.bounds.minZ)/2;
    const used=new Set(),starts=[];
    for(const group of groups){
      const isFriendly=group.factionId===configuration.playerFaction;
      const desiredX=sector.center[0]+(isFriendly?-0.54:0.54)*halfWidth;
      const desiredZ=sector.center[1]+(group.sourceState==='reserve'?0.52:-0.18)*halfDepth;
      let chosen=null,score=Infinity,index=-1;
      for(let i=0;i<candidates.length;i++){
        if(used.has(i))continue;
        const at=candidates[i];
        // Squads of 8 have a 3.1-unit member ring. 12-unit cells
        // reserve ample horizontal separation between adjacent squads.
        const cost=sq(at[0]-desiredX)+sq(at[1]-desiredZ);
        if(cost<score){score=cost;chosen=at;index=i;}
      }
      if(!chosen)throw new Error('OriginalMusouStaging: no free position');
      used.add(index);group.position=[...chosen];
      for(let n=0;n<group.units.length;n++){
        const angle=2*Math.PI*n/group.units.length;
        group.units[n].position=[round(chosen[0]+Math.cos(angle)*3.1),
          round(chosen[1]+Math.sin(angle)*3.1)];
      }
      starts.push(group.position);
    }
    markers.push({frontId:front.id,sectorId:sector.id,groups:groups.length,
      cells:candidates.length,minimumSquadGap:12,memberRing:3.1,
      allCentersInside:starts.every(([x,z])=>between(x,sector.bounds.minX,sector.bounds.maxX)&&
        between(z,sector.bounds.minZ,sector.bounds.maxZ))});
  }
  return {policy:'original-musou-sector-grid-v1',fronts:markers,
    provenance:'original gameplay staging within real sector bounds; internal prop collision not certified'};
}

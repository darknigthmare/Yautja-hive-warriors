/* A source-scoped OPTIONAL LV-742 preset using pre-allocated identities.
 * It changes role/profiles in an expressly signed alternative configuration,
 * never population or the default AFF-27 mission and never an RTS economy. */
export const EXTINCTION_VARIANTS=Object.freeze({
  none:'none',casteAssault:'carrier-ravager'
});
export function applyExtinctionBattleVariant(config,variant='none'){
  if(variant==='none')return config;
  if(variant!==EXTINCTION_VARIANTS.casteAssault||config?.id!=='AFF-27')
    throw new RangeError('Extinction caste roster is exclusive to AFF-27 / LV-742');
  const hivies=new Set(config.factions.filter(f=>f.species==='xeno'||
    f.species==='xenomorph').map(f=>f.id));
  const eligible=template=>config.groups.find(g=>g.state==='distant'&&
    hivies.has(g.factionId)&&g.sourceTemplateIds?.includes(template)&&
    g.units.length===8&&g.units.slice(1).every(u=>!u.officer&&!u.uniqueId));
  const carrierGroup=eligible('GRP-58'),ravagerGroup=eligible('GRP-59');
  if(!carrierGroup||!ravagerGroup||carrierGroup===ravagerGroup)
    throw new Error('No verified source-sized Hive squad for the optional caste variant');
  const normal=carrierGroup.units[1],facehugger=carrierGroup.units[7],
    source=config.profiles.find(p=>p.id===normal.profileId),
    face=config.profiles.find(p=>p.id===facehugger.profileId);
  if(!source||face?.actorType!=='facehugger'||
     config.profiles.some(p=>p.id==='XEN-009'||p.id==='XEN-010'))
    throw new Error('Optional Extinction caste profile bindings are ambiguous');
  const created=(id,name,actorType,maxHp,damage)=>({
    ...source,id,name,actorType,maxHp,damage,role:'heavy',
    sourceProfileId:id,fidelity:'adaptation',
    visualFidelity1to1Verified:false,sourceScopedTo:'AFF-27'
  });
  config.profiles.push(created('XEN-009','Carrier','carrier',400,12),
    created('XEN-010','Ravager','ravager',1000,52));
  normal.profileId='XEN-009';
  for(const payload of carrierGroup.units.slice(2,8))payload.profileId=face.id;
  ravagerGroup.units[1].profileId='XEN-010';
  config.context??={};
  config.context.extinctionCasteVariant=variant;
  config.context.visualFidelity1to1Verified=false;
  config.adaptation=(config.adaptation??'')+
    ' Optional sourced Carrier/Ravager LV-742 roles REPLACE seven existing allocations; not the RTS gameplay.';
  return config;
}

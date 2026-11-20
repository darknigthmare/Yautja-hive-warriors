/* Original Musou operation squad identities (AFF-06..10).
 * These are source-audit role proposals, NOT 1:1 film/game castes.
 * Read only: uses existing config group/sourceTemplateIds and the allocated
 * unit index; does not modify the persistent profile, count or save digest. */
const human=(role,label)=>Object.freeze({species:'human',role,label});
const yautja=(role,label)=>Object.freeze({species:'yautja',role,label});
const H=human('rifleman','Fusilier de détachement');
const Y=yautja('hunter','Chasseur du clan');
const templates={
 'GRP-37':[human('squad_leader','Chef de capture'),H,H,H,H,
   human('capture_specialist','Spécialiste de capture'),
   human('capture_specialist','Spécialiste de capture'),
   human('radio','Radio armé')],
 'GRP-38':[human('squad_leader','Chef de sécurité industrielle'),H,H,H,H,
   human('support','Appui de sécurité'),human('sapper','Sapeur industriel armé'),
   human('observer','Observateur de convoi')],
 'GRP-39':[human('squad_leader','Chef de section coloniale'),H,H,H,H,
   human('smartgunner','Smartgunner colonial'),
   human('breacher','Spécialiste de brèche'),human('radio','Radio colonial')],
 'GRP-40':[human('squad_leader','Chef de sûreté orbitale'),H,H,H,H,
   human('shield_guard','Garde au bouclier'),
   human('technician','Technicien armé'),human('observer','Observateur orbital')],
 'GRP-41':[human('squad_leader','Chef du cordon militaire'),H,H,H,H,
   human('observer','Observateur du cordon'),
   human('radio','Radio armé'),human('support','Appui léger')],
 'GRP-42':[human('commander','Commandant de la force humaine'),
   human('radio','Radio de commandement'),human('radio','Radio de commandement'),
   human('guard','Garde de commandement'),human('guard','Garde de commandement'),
   human('counter_surveillance','Opérateur de contre-surveillance armé'),
   human('technician','Technicien armé'),
   human('liaison','Agent de liaison armé')],
 'GRP-11':[yautja('veteran','Vétéran Yautja'),Y,Y,Y,Y,Y,Y,Y],
 'GRP-12':[yautja('scout','Éclaireur Yautja'),yautja('scout','Éclaireur Yautja')],
 'GRP-13':[yautja('plasma_support','Tireur au canon plasma'),
   yautja('plasma_support','Tireur au canon plasma'),
   yautja('protector','Protecteur Yautja'),yautja('protector','Protecteur Yautja')]
};
export const ORIGINAL_MUSOU_SQUAD_TEMPLATES=Object.freeze(Object.fromEntries(
 Object.entries(templates).map(([id,slots])=>[id,Object.freeze(slots)])));
const operations=new Set(['AFF-06','AFF-07','AFF-08','AFF-09','AFF-10']);
export function originalMusouSquadRole(config,group,unit){
 if(!config||!operations.has(config.id)||!Array.isArray(config.groups)||
    !group||!Array.isArray(group.units)||!unit||unit.uniqueId||unit.sourceBossId)return null;
 const source=config.groups.find(spec=>spec.id===group.id);
 if(!source||source.factionId!==unit.factionId)return null;
 const templateId=source.sourceTemplateIds?.[0];
 const slots=ORIGINAL_MUSOU_SQUAD_TEMPLATES[templateId];
 if(!slots||slots.length!==group.units.length)return null;
 const index=group.units.indexOf(unit.id);
 if(index<0||slots[index].species!==unit.species)return null;
 return Object.freeze({
   ...slots[index],sourceGroupId:templateId,sourceOperationId:config.id,
   index,count:slots.length,source:'original-musou-audit-proposal',
   visualFidelity1to1Verified:false,abilitiesImplemented:false
 });
}

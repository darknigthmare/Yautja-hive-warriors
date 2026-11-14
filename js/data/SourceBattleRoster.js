/* Source-scoped squad identities. Tactical headcount is the audit allocation;
 * these slots never create soldiers, only identify roles inside an existing squad.
 * Visual approximations are declared explicitly, never certified as 1:1. */
const slot=(species,actorType,sourceRole,visual='proxy',catalogueProfileId=null)=>Object.freeze({species,actorType,sourceRole,visual,...(catalogueProfileId?{catalogueProfileId}:{})});
const x=(actorType,sourceRole,visual='proxy')=>slot('xeno',actorType,sourceRole,visual);
const h=(actorType,sourceRole,visual='proxy',catalogueProfileId=null)=>slot('human',actorType,sourceRole,visual,catalogueProfileId);
const s=(actorType,sourceRole,visual='proxy',catalogueProfileId=null)=>slot('synthetic',actorType,sourceRole,visual,catalogueProfileId);
const y=sourceRole=>slot('yautja','clan_hunter',sourceRole,'shared-clan-model');
const W=x('warrior','Warrior'), D=x('warrior','Drone (Warrior visual proxy)');
const R=x('runner','Runner'), P=x('praetorian','Praetorian');
const M=h('marine','Infantry'), SM=h('smartgunner','Smartgunner','specialist-model'), FL=h('flametrooper','Flamethrower','specialist-model');
const WG=s('weyland_combat','Weyland-Yutani combat synthetic','specialist-model');
const J=s('working_joe','Seegson Working Joe','specialist-model');
const XT=s('synthetic','Colonial Marines synthetic (Extinction visual proxy)');
// AVP: Extinction squad places keep their catalogue profile (CTRL-082).
const EM=h('marine','Infantry','proxy','HUM-001'), ESM=h('smartgunner','Smartgunner','specialist-model','HUM-002'), EFL=h('flametrooper','Flamethrower','specialist-model','HUM-003');
const ESN=h('marine','Sniper (rifle proxy)','proxy','HUM-036'), EMD=h('marine','Medic','proxy','HUM-037'), ECT=h('marine','CommTech','proxy','HUM-038');
const EXT=s('synthetic','Colonial Marines synthetic (Extinction visual proxy)','proxy','HUM-039'), EXO=h('marine','Exosuit + pilot (marine visual proxy)','proxy','HUM-040'), ESD=h('marine','SADAR (rifle proxy)','proxy','HUM-041');
const templates={
 'GRP-39':{default:[h('marine','Section leader'),M,M,M,M,SM,h('marine','Breach specialist'),h('marine','Radio operator')]},
 'GRP-44':{default:[R,R,R,R,R,R,R,x('spitter','Spitter','specialist-model')]},
 'GRP-45':{default:[P,W,W,W,W,W,W,W]},
 'GRP-46':{default:Array.from({length:8},()=>WG)},
 'GRP-50':{default:[J,J]},
 'GRP-58':{default:[W,W,W,W,R,R,D,x('facehugger','Facehugger','specialist-model')]},
 'GRP-59':{default:[W,W,W,W,D,D,P,P],'C-QUEEN':[W,W,W,W,D,D,P,P]},
 'GRP-60':{'H-LIGNE':[EM,EM,EM,ESM,EFL,EMD,ECT,EXT],
   'H-APPUI':[EM,ESM,ESN,ESD,EXO,EMD,ECT,EXT]},
 // Aliens: Dark Descent (CTRL-084): Sergeant, Gunner and Medic in every squad of four; the fourth
 // place alternates Tecker and Recon. Only the sergeant has a catalogue profile (HUM-004).
 'GRP-53':{default:[h('marine','Sergeant','proxy','HUM-004'),h('smartgunner','Gunner','specialist-model'),h('marine','Medic'),h('marine','Tecker (repair proxy)')],
   recon:[h('marine','Sergeant','proxy','HUM-004'),h('smartgunner','Gunner','specialist-model'),h('marine','Medic'),h('marine','Recon (rifle proxy)')]},
 'GRP-61':{'Y-CHASSE':[y('Hunter'),y('Brawler'),y('Spear Master'),y('Stalker')],
   'Y-APPUI':[y('Disc Master'),y('Vanguard'),y('Hydra'),y('Blazer')]}
};
// Pre-CTRL-082 GRP-60 labels without catalogue links: rebuilt only to resume older checkpoints.
const LEGACY_GRP_60=Object.freeze(Object.fromEntries(Object.entries({'H-LIGNE':[M,M,M,SM,FL,h('marine','Medic (unimplemented support)'),h('marine','CommTech (unimplemented repairs)'),XT],
   'H-APPUI':[M,SM,h('marine','Sniper (rifle proxy)'),h('marine','SADAR (rifle proxy)'),h('marine','Exosuit + pilot (marine visual proxy)'),h('marine','Medic (unimplemented support)'),h('marine','CommTech (unimplemented repairs)'),XT]}).map(([name,slots])=>[name,Object.freeze(slots)])));
export const SOURCE_BATTLE_SQUADS=Object.freeze(Object.fromEntries(Object.entries(templates).map(([id,variants])=>
 [id,Object.freeze(Object.fromEntries(Object.entries(variants).map(([name,slots])=>[name,Object.freeze(slots)])))])));
export const SOURCE_BOSS_SPECIES=Object.freeze({
 'BOS-26':'yautja','BOS-27':'yautja','BOS-28':'yautja',
 'BOS-29':'human','BOS-30':'human','BOS-31':'human',
 'BOS-32':'xeno','BOS-33':'xeno','BOS-34':'xeno',
 'BOS-35':'human','BOS-36':'human','BOS-37':'yautja',
 'BOS-38':'yautja','BOS-39':'xeno'
});
export function sourceSquadSlots(groupId,preset='default',count=0,{legacySourceLinks=false}={}){
 if(legacySourceLinks&&groupId==='GRP-53')return null; // pre-CTRL-084 checkpoints used generic profiles
 const variants=legacySourceLinks&&groupId==='GRP-60'?LEGACY_GRP_60:SOURCE_BATTLE_SQUADS[groupId];
 if(!variants)return null;
 const actualPreset=groupId==='GRP-59'&&preset==='garde'?'default':preset??'default', slots=Object.hasOwn(variants,actualPreset)?variants[actualPreset]:null;
 return slots?.length===count?slots:null; // No invented roles for partial/unknown formations.
}
export function sourceCommanderSlot(groupId,preset,bossId,count){
 if(count===8&&groupId==='GRP-59'&&preset==='C-QUEEN'&&bossId==='BOS-39')return 7;
 if(count===8&&groupId==='GRP-44'&&bossId==='BOS-33')return 7;
 return 0;
}

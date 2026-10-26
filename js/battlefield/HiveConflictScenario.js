/* An original mission-specific hive rivalry. This factory never changes the
 * catalogue proposals or the relationships of an existing normal operation. */
import { createBattlefieldOperation } from './BattlefieldOperation.js';
export const HIVE_CONFLICT_ID='original-two-hives';
export function createHiveConflictScenario(layout,{levelId='hive-conflict',activeBudget=32,players=1}={}) {
  const base=createBattlefieldOperation(layout,{levelId,activeBudget,players});
  const [landing,amber,obsidian]=base.fronts;
  landing.owner='player_clan';landing.label='Point de retrait du clan';
  amber.owner='amber_hive';amber.label='Territoire de la ruche Ambre';
  obsidian.owner='obsidian_hive';obsidian.label='Territoire de la ruche Obsidienne';
  const factions=[{id:'player_clan',label:'Expédition du clan',species:'yautja',allegiance:'player',moraleModel:'clan'},
    {id:'amber_hive',label:'Ruche Ambre',hiveIdentity:'amber-brood',species:'xenomorph',allegiance:'independent',moraleModel:'hive',color:0xd99a35},
    {id:'obsidian_hive',label:'Ruche Obsidienne',hiveIdentity:'obsidian-brood',species:'xenomorph',allegiance:'independent',moraleModel:'hive',color:0x9c63d9}];
  const profiles=[
    {id:'conflict-clan',species:'yautja',actorType:'yautja',role:'line',maxHp:340,damage:4,attackInterval:5},
    {id:'conflict-clan-officer',species:'yautja',actorType:'yautja',role:'officer',maxHp:440,damage:4.5,attackInterval:5},
    {id:'amber-warrior',species:'xenomorph',actorType:'red_warrior',role:'line',maxHp:210,damage:4,attackInterval:4.5,allowedFactions:['amber_hive']},
    {id:'amber-officer',species:'xenomorph',actorType:'officer',role:'officer',maxHp:330,damage:5,attackInterval:5,allowedFactions:['amber_hive']},
    {id:'obsidian-warrior',species:'xenomorph',actorType:'warrior',role:'line',maxHp:210,damage:4,attackInterval:4.5,allowedFactions:['obsidian_hive']},
    {id:'obsidian-officer',species:'xenomorph',actorType:'officer',role:'officer',maxHp:330,damage:5,attackInterval:5,allowedFactions:['obsidian_hive']}
  ].map(profile=>({...profile,fidelity:'original',provenance:'Original game mission; hive names, rivalry and tactical roles are not a media reconstruction.'}));
  const groups=[];
  const add=(factionId,index,front,reserve,prefix)=>{
    const position=[front.position[0]+Math.cos(index*2.4)*30,front.position[1]+Math.sin(index*2.4)*30],id=`${levelId}:${factionId}:${index}`;
    groups.push({id,label:`${factions.find(faction=>faction.id===factionId).label} — escouade ${index+1}`,factionId,frontId:front.id,
      reserveOriginId:factionId==='obsidian_hive' ? obsidian.id : front.id,position,state:reserve ? 'reserve' : 'distant',formation:factionId==='player_clan' ? 'wedge' : 'dispersed',
      units:Array.from({length:4},(_,at)=>({id:`${id}:${at}`,profileId:`${prefix}${at===0 ? '-officer' : ''}`,officer:at===0,position:[position[0]+Math.cos(at*Math.PI/2)*3,position[1]+Math.sin(at*Math.PI/2)*3]}))});
  };
  for(let index=0;index<4;index++)add('player_clan',index,landing,index===3,'conflict-clan');
  for(let index=0;index<10;index++) {
    add('amber_hive',index,amber,index>=7,'amber');
    add('obsidian_hive',index,index<3 ? amber : obsidian,index>=7,'obsidian');
  }
  // Explicit profile names avoid accidental aliases to unrelated named bosses.
  for(const group of groups)for(const unit of group.units)if(unit.profileId==='amber')unit.profileId='amber-warrior';else if(unit.profileId==='obsidian')unit.profileId='obsidian-warrior';
  return {...base,id:`${HIVE_CONFLICT_ID}:${levelId}`,label:'Conflit des ruches Ambre et Obsidienne',mode:'original',factions,profiles,groups,
    context:{...base.context,scenarioType:'two-identified-hives',originalScenario:true,visualFidelity1to1Verified:false},
    relations:[{a:'player_clan',b:'amber_hive',state:'hostile'},{a:'player_clan',b:'obsidian_hive',state:'hostile'},{a:'amber_hive',b:'obsidian_hive',state:'hostile'}],
    hiveConflict:{id:'amber-obsidian-rivalry',enabled:true,scope:'this-operation-only',hiveIds:['amber_hive','obsidian_hive'],territories:{amber_hive:amber.id,obsidian_hive:obsidian.id},
      briefing:'Deux ruches identifiées combattent déjà au front Ambre. Exploitez leur conflit pour isoler les sources de renfort, puis capturer les deux territoires. La couleur identifie l’appartenance ; elle ne décide jamais seule des relations.'},
    budgets:{...base.budgets,byFaction:{player_clan:{total:16,reserve:4,active:8},amber_hive:{total:40,reserve:12,active:12},obsidian_hive:{total:40,reserve:12,active:12}}},
    ai:{enabled:true,interval:20,minimumGarrisonGroups:1},
    objectives:{...base.objectives,captureFronts:[amber.id,obsidian.id],loseFronts:[landing.id],
      strategies:[{id:'isolate-rival-hives',conditions:[{type:'source_disabled',frontId:amber.id},{type:'source_disabled',frontId:obsidian.id},{type:'capture',frontId:obsidian.id}]},
        {id:'control-rival-territories',conditions:[{type:'capture',frontId:amber.id},{type:'capture',frontId:obsidian.id}]}]},
    designLimits:{...base.designLimits,hiveWarIsExplicitScenario:true,originalScenario:true}}
}

import { drawAccessibleMarker } from './AccessibilityPreferences.js';
import { CHARACTERS_DATA } from '../data/charactersData.js';
import { CARRIER_CARGO_RULES } from '../battlefield/ExtinctionCarrierCargo.js';

export function extinctionVariantBriefing(config){
 const variant=config.context?.extinctionCasteVariant;
 if(config.id!=='AFF-27'||!['carrier-ravager','carrier-ravager-enhanced'].includes(variant))return null;
 const carrierProfile=config.profiles.find(profile=>profile.id==='XEN-009');
 const carrierGroup=config.groups.find(group=>group.units.some(unit=>unit.profileId===carrierProfile?.id));
 const cargo=carrierGroup?.units.filter(unit=>config.profiles.find(profile=>profile.id===unit.profileId)?.actorType==='facehugger').length??0;
 const upgraded=carrierProfile?.extinctionUpgrade==='supercarrier-genome';
 const capacity=upgraded?CARRIER_CARGO_RULES.upgradedCapacity:CARRIER_CARGO_RULES.ordinaryCapacity;
 return upgraded
  ? `Variante évoluée — Supercarrier : ${cargo} parasites déjà alloués, capacité ${capacity}. Ravager : Résilience colossale ; le feu ou des dégâts excessifs empêchent son retour après catalepsie.`
  : `Variante optionnelle — Carrier et Ravager : ${cargo} parasites déjà alloués au Carrier, capacité ${capacity}.`;
}

/** The briefing reads the exact bound operation configuration used at launch. */
export class OperationBriefing {
 constructor(parent,{preferences=()=>({})}={}){this.preferences=preferences;this.root=document.createElement('section');this.root.className='operation-briefing glass-panel hidden';this.root.setAttribute('aria-label','Briefing de bataille');this.root.innerHTML='<h3>BRIEFING — OPÉRATION ORIGINALE</h3><canvas width="360" height="220" aria-label="Plan des fronts et passages"></canvas><div data-summary></div>';parent.querySelector('.loadout-grid-container').before(this.root);}
 render(scene){this.root.classList.toggle('hidden',!scene);if(!scene)return;const{config,layout,variant,level}=scene;const summary=this.root.querySelector('[data-summary]');summary.replaceChildren();
  const line=text=>{const p=document.createElement('p');p.textContent=text;summary.append(p);};line(config.label??config.id);line(`${variant?.name??level.name} · ${layout.sectors.length} secteurs · ${config.fronts.length} fronts · positions en unités de jeu.`);
  line('Forces alliées : '+config.groups.filter(group=>group.factionId===config.playerFaction).reduce((sum,group)=>sum+group.units.length,0)+' combattants alloués. Forces adverses : présence signalée ; réserves à confirmer par reconnaissance.');
  line(`Plafond de proximité : ${config.budgets.active} combattants. Les forces distantes restent actives ; leur position est connue par rapports, avec incertitude.`);
  if(config.difficulty)line(`Commandement adverse : ${config.difficulty.label}. Les effectifs, PV et dégâts restent identiques ; les décisions et prises de risque changent.`);
  if(layout.mapSeed)line('Disposition alternative : les mêmes fronts disposent de distances et de passages différents.');
  if(config.objectives.defeatWindow)line(`Front essentiel perdu : ${Math.ceil(config.objectives.defeatGraceSeconds)} s au minimum pour revenir et le reprendre, selon les voies ouvertes.`);
  if(config.detailedBudgetNotice)line(config.detailedBudgetNotice);
  if(scene.characterBriefing){const character=CHARACTERS_DATA.find(item=>item.id===scene.characterBriefing.characterId);line('Chasseur déployé : '+(character?.name??scene.characterBriefing.characterId??'non sélectionné')+' · '+scene.characterBriefing.role+'.');line(scene.characterBriefing.scopeNote);line(scene.characterBriefing.recognition.label+' · '+scene.characterBriefing.recognition.completedMissions+' mission(s) confirmée(s) pour ce chasseur · statut narratif inchangé.');if(scene.characterBriefing.recognition.commendations?.length)line('Services confirmés : '+scene.characterBriefing.recognition.commendations.map(item=>item.label).join(' ; '));if(scene.characterBriefing.relevantNamedConsequences.length)line('Pertes nommées déjà confirmées : '+scene.characterBriefing.relevantNamedConsequences.map(item=>item.uniqueId).join(', '));}
  if(config.hiveConflict?.briefing)line(config.hiveConflict.briefing);
  if(scene.encounterProvenance?.note)line(scene.encounterProvenance.note);
  const variantBriefing=extinctionVariantBriefing(config);if(variantBriefing)line(variantBriefing);
  const spec=config.operationObjectives;line('Objectifs : '+(spec?spec.tasks.map(task=>task.label).join(' → '):'Sécuriser les fronts hostiles ou épuiser leur population finie.'));
  line('Échecs : joueurs vaincus'+(spec?.failOnLoss?.length?' ; matériel ou groupe essentiel perdu ('+spec.failOnLoss.join(', ')+')':'')+(spec?.failOnEscape?.length?' ; convoi adverse parvenu à sa destination':'')+(config.objectives.loseFronts?.length?' ; front allié perdu durablement':'')+'.');
  line('Choisissez votre équipement et une première route. Les passages alternatifs autorisent une approche de flanc ; les noms de lieux désignent une adaptation.');
  const canvas=this.root.querySelector('canvas'),ctx=canvas.getContext('2d'),b=layout.bounds,scale=Math.min(330/(b.maxX-b.minX),190/(b.maxZ-b.minZ));const project=point=>[180+(point[0]-(b.minX+b.maxX)/2)*scale,110+(point[1]-(b.minZ+b.maxZ)/2)*scale];ctx.clearRect(0,0,360,220);
  for(const sector of layout.sectors){const[x,y]=project([sector.bounds.minX,sector.bounds.minZ]);ctx.fillStyle='#2d5045';ctx.fillRect(x,y,(sector.bounds.maxX-sector.bounds.minX)*scale,(sector.bounds.maxZ-sector.bounds.minZ)*scale);}
  for(const route of config.routes){ctx.beginPath();ctx.strokeStyle='#92bba5';for(const[index,point]of route.waypoints.entries()){const[x,y]=project(point);if(index)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();}
  for(const front of config.fronts){const[x,y]=project(front.position);drawAccessibleMarker(ctx,{x,y,size:6,role:front.owner===config.playerFaction?'ally':'objective',factionId:front.owner,label:front.label},this.preferences());ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillStyle='#f3f6df';ctx.fillText(front.label,x,y-11);}
 }
}

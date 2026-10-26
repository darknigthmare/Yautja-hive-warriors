/** The briefing reads the exact bound operation configuration used at launch. */
export class OperationBriefing {
 constructor(parent){this.root=document.createElement('section');this.root.className='operation-briefing glass-panel hidden';this.root.setAttribute('aria-label','Briefing de bataille');this.root.innerHTML='<h3>BRIEFING — OPÉRATION ORIGINALE</h3><canvas width="360" height="220" aria-label="Plan des fronts et passages"></canvas><div data-summary></div>';parent.querySelector('.loadout-grid-container').before(this.root);}
 render(scene){this.root.classList.toggle('hidden',!scene);if(!scene)return;const{config,layout,variant,level}=scene;const summary=this.root.querySelector('[data-summary]');summary.replaceChildren();
  const line=text=>{const p=document.createElement('p');p.textContent=text;summary.append(p);};line(config.label??config.id);line(`${variant?.name??level.name} · ${layout.sectors.length} secteurs · ${config.fronts.length} fronts · positions en unités de jeu.`);
  line('Forces alliées : '+config.groups.filter(group=>group.factionId===config.playerFaction).reduce((sum,group)=>sum+group.units.length,0)+' combattants alloués. Forces adverses : présence signalée ; réserves à confirmer par reconnaissance.');
  line(`Plafond de proximité : ${config.budgets.active} combattants. Les forces distantes restent actives ; leur position est connue par rapports, avec incertitude.`);
  if(config.detailedBudgetNotice)line(config.detailedBudgetNotice);
  if(scene.characterBriefing){line(scene.characterBriefing.scopeNote);line(scene.characterBriefing.recognition.label+' · statut narratif inchangé.');if(scene.characterBriefing.relevantNamedConsequences.length)line('Pertes nommées déjà confirmées : '+scene.characterBriefing.relevantNamedConsequences.map(item=>item.uniqueId).join(', '));}
  if(config.hiveConflict?.briefing)line(config.hiveConflict.briefing);
  const spec=config.operationObjectives;line('Objectifs : '+(spec?spec.tasks.map(task=>task.label).join(' → '):'Sécuriser les fronts hostiles ou épuiser leur population finie.'));
  line('Échecs : joueurs vaincus'+(spec?.failOnLoss?.length?' ; matériel ou groupe essentiel perdu ('+spec.failOnLoss.join(', ')+')':'')+(spec?.failOnEscape?.length?' ; convoi adverse parvenu à sa destination':'')+(config.objectives.loseFronts?.length?' ; front allié perdu durablement':'')+'.');
  line('Choisissez votre équipement et une première route. Les passages alternatifs autorisent une approche de flanc ; les noms de lieux désignent une adaptation.');
  const canvas=this.root.querySelector('canvas'),ctx=canvas.getContext('2d'),b=layout.bounds,scale=Math.min(330/(b.maxX-b.minX),190/(b.maxZ-b.minZ));const project=point=>[180+(point[0]-(b.minX+b.maxX)/2)*scale,110+(point[1]-(b.minZ+b.maxZ)/2)*scale];ctx.clearRect(0,0,360,220);
  for(const sector of layout.sectors){const[x,y]=project([sector.bounds.minX,sector.bounds.minZ]);ctx.fillStyle='#2d5045';ctx.fillRect(x,y,(sector.bounds.maxX-sector.bounds.minX)*scale,(sector.bounds.maxZ-sector.bounds.minZ)*scale);}
  for(const route of config.routes){ctx.beginPath();ctx.strokeStyle='#92bba5';for(const[index,point]of route.waypoints.entries()){const[x,y]=project(point);if(index)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();}
  for(const front of config.fronts){const[x,y]=project(front.position);ctx.fillStyle=front.owner===config.playerFaction?'#c0ffd3':'#f3b88f';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText(front.label,x,y-9);}
 }
}

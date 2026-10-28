/* Battlefield telemetry and real orders, separate from the cinematic hunt HUD. */
const compass=['N','NE','E','SE','S','SO','O','NO'];
export function operationAlertState(state,objectives,players=[]) {
  const locate=(frontId,text,remaining)=>{const front=state.fronts.find(item=>item.id===frontId),player=players.find(item=>item.hp>0);let direction='';if(front&&player){const dx=front.position[0]-player.position[0],dz=front.position[1]-player.position[1];direction=` · ${compass[(Math.round(Math.atan2(dx,-dz)/(Math.PI/4))+8)%8]} ${Math.round(Math.hypot(dx,dz))} u`; }return{frontId,text:`${text}${front?' · '+front.label:''}${remaining!==null&&remaining!==undefined?' · '+Math.max(0,Math.ceil(remaining))+' s':''}${direction}`};};
  if(state.criticalDeadline!==null&&state.criticalDeadline!==undefined){const alert=state.alerts.find(item=>item.type==='critical_front_lost');return locate(alert?.fronts?.[0],'DÉFAITE IMMINENTE — REPRENEZ LE FRONT',state.criticalDeadline-state.time);}
  const captain=state.groups.find(group=>group.factionId===state.playerFaction&&group.officerHP>0&&group.officerHP/group.officerMaxHP<=.25);if(captain)return locate(captain.frontId,'CAPITAINE EN DANGER',null);
  const reaction=[...(objectives?.reactions??[]),...(state.phaseThreats??[])].filter(item=>item.status==='announced').sort((a,b)=>a.remaining-b.remaining)[0];if(reaction)return locate(reaction.targetFrontId,reaction.label??'CONTRE-OFFENSIVE EN APPROCHE',reaction.remaining);
  const alert=state.alerts[0];if(!alert)return{text:'Les réserves et les pertes persistent entre les fronts.',frontId:null};
  const names={base_captured:'Le contrôle d’un front a changé',source_disabled:'Une source de renfort est neutralisée',unit_died:'Un capitaine est tombé',reinforcements_inbound:'Renforts en approche',reinforcements_arrived:'Renforts arrivés',critical_front_recovered:'Le front critique a été repris',front_delegated:'Un capitaine prend le commandement',tactic_ordered:'Une tactique collective est en cours',relations_changed:'Les relations entre factions ont changé',order_blocked:'Un ordre est bloqué par une route fermée'};
  const group=state.groups.find(item=>item.id===alert.groupId);return locate(alert.frontId??alert.targetFrontId??group?.frontId,names[alert.type]??'Nouveau rapport stratégique',alert.arrivalAt!==undefined?alert.arrivalAt-state.time:null);
}

export class OperationPanel {
  constructor({ onOrder, onAction, onCheckpoint, onMap } = {}) {
    this.root = document.createElement('section'); this.root.id = 'operation-panel';
    this.root.className = 'operation-panel hidden'; this.root.setAttribute('aria-label', 'Commandement des fronts');
    this.root.innerHTML = `<strong data-title>OPÉRATION ORIGINALE</strong><p data-counts></p><p data-fronts></p><p data-alert role="status"></p><p data-rescue role="status"></p><p data-tasks></p><p data-report-age></p><details><summary>ORDRES ET LOGISTIQUE</summary><label>Groupe <select data-group aria-label="Groupe allié"></select></label><label>Front <select data-front aria-label="Front cible"></select></label><label>Ordre <select data-order aria-label="Ordre"><option value="attack">Attaquer</option><option value="defend">Défendre</option><option value="regroup">Regrouper</option><option value="escort">Escorter</option><option value="retreat">Replier</option></select></label><div><button data-map>CARTE / ORDRES</button><button data-send>TRANSMETTRE</button><button data-rally>RALLIER</button><button data-sabotage>SABOTER</button><button data-save>SAUVEGARDER</button></div><small data-feedback></small></details>`;
    document.getElementById('in-game-hud').append(this.root);
    this.root.querySelector('[data-map]').onclick = () => onMap?.();
    this.root.querySelector('[data-send]').onclick = () => onOrder?.(this.root.querySelector('[data-group]').value, { type: this.root.querySelector('[data-order]').value, frontId: this.root.querySelector('[data-front]').value });
    this.root.querySelector('[data-rally]').onclick = () => onAction?.('rally', this.root.querySelector('[data-front]').value);
    this.root.querySelector('[data-sabotage]').onclick = () => onAction?.('sabotage', this.root.querySelector('[data-front]').value);
    this.root.querySelector('[data-save]').onclick = () => onCheckpoint?.();
  }
  feedback(message) { this.root.querySelector('[data-feedback]').textContent = message; }
  options(node, rows) {
    const signature = rows.map(row => row.id + row.label).join('|'); if (node.dataset.signature === signature) return;
    const selected = node.value; node.replaceChildren(...rows.map(row => { const option = document.createElement('option'); option.value = row.id; option.textContent = row.label; return option; }));
    node.value = rows.some(row => row.id === selected) ? selected : rows[0]?.id ?? ''; node.dataset.signature = signature;
  }
  update(state, objectives, players = []) {
    this.root.classList.toggle('hidden', !state); if (!state) return;
    this.root.querySelector('[data-title]').textContent = state.label + ' · AFFRONTEMENT ORIGINAL';
    this.root.querySelector('[data-counts]').textContent = Object.entries(state.intelCounts??{}).map(([id,c])=>c.exact?`${c.label??id} : ${state.counts[id].active} détaillés / ${state.counts[id].distant} distants / ${state.counts[id].reserve} réserve / ${state.counts[id].dead} pertes`:`${c.label??id} : ${c.knownAlive??0} signalés · réserves inconnues`).join(' · ');
    this.root.querySelector('[data-fronts]').textContent = state.fronts.map(front => `${front.label} : ${front.intelState==='unknown'?'inconnu':front.owner??'neutre'}${front.contested ? ' ⚔' : ''}`).join(' · ');
    this.root.querySelector('[data-alert]').textContent = operationAlertState(state,objectives,players).text;
    const patients=state.rescue?.records?.filter(record=>record.status==='downed')??[];
    this.root.querySelector('[data-rescue]').textContent=patients.length?`${patients.length} allié${patients.length>1?'s':''} à terre · secours nécessaire · ${Math.ceil(Math.min(...patients.map(record=>record.remaining)))} s avant la perte` : '';
    this.root.querySelector('[data-tasks]').textContent = objectives ? objectives.tasks.filter(task => task.available && task.status !== 'done').slice(0,3).map(task => `${task.prompt} (${Math.floor(task.progress / task.duration * 100)} %)`).join(' · ') : 'Sécurisez les fronts ou épuisez les forces hostiles.';
    this.options(this.root.querySelector('[data-front]'), state.fronts);
    const selectedGroup=state.groups.find(group=>group.id===this.root.querySelector('[data-group]').value);this.root.querySelector('[data-report-age]').textContent=selectedGroup?`Dernier rapport : ${Math.floor(selectedGroup.reportAge??0)} s${selectedGroup.precisePositionKnown?' · contact actuel':' · position estimée'}`:'';
    this.options(this.root.querySelector('[data-group]'), state.groups.filter(group => group.factionId === state.playerFaction && group.alive > 0).map(group => ({id:group.id,label:group.label})));
  }
}

export function captureBattleDebrief(simulation,objectives=null){
  if(!simulation)return null;
  const counts=simulation.getCounts(),states=['active','distant','reserve','dead','evacuated','captured'];
  const rows=Object.entries(counts).map(([factionId,value])=>({factionId,label:simulation.config.factions.find(faction=>faction.id===factionId)?.label??({player_clan:'Clan joueur',human_force:'Forces humaines',hive:'Ruche',rival_clan:'Clan rival'})[factionId]??factionId,...structuredClone(value),reconciled:states.reduce((sum,key)=>sum+value[key],0)===value.allocated}));
  const result=simulation.getResult?.()??simulation.result,narrative=objectives?.getHUDState?.();
  const strategy=objectives?.spec?.strategies.find(item=>item.id===result?.strategyId);
  const reasons={players_defeated:'Les chasseurs ont été vaincus.',all_players_defeated:'Les chasseurs ont été vaincus.',fronts_lost:'Les fronts essentiels ont été perdus.',time_limit:'Le délai de mission a expiré.',objective_complete:'Les objectifs ont été accomplis.',population_exhausted:'Les forces hostiles ont été épuisées.'};
  return{version:1,operationId:simulation.config.id,label:simulation.config.label??simulation.config.id,result:structuredClone(result),reason:strategy?.label??reasons[result?.reason]??(result?.outcome==='victory'?'Objectif de l’opération accompli.':'Les conditions de poursuite de l’opération ne sont plus réunies.'),rows,reconciled:rows.every(row=>row.reconciled),noncombatants:narrative?.noncombatants?structuredClone(narrative.noncombatants):null,named:[...simulation.units.values()].filter(unit=>unit.uniqueId&&['dead','evacuated','captured'].includes(unit.state)).map(unit=>({id:unit.uniqueId,label:unit.profileName??simulation.profiles.get(unit.profileId)?.name??unit.uniqueId,state:unit.state})),journal:structuredClone(simulation.getTacticalJournal(64))};
}

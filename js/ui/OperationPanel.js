import { intelligencePresentation } from './TacticalPresentation.js';
/* Live Musou battle triage. Orders are optional support, not a main RTS loop. */
import { buildMusouBattlePulse } from '../battlefield/MusouBattleFlow.js';
const compass=['N','NE','E','SE','S','SO','O','NO'];
export function hiveCoordinationFeedback(event, groups = [], fronts = []) {
  if (event?.type !== 'hive_coordination_disrupted') return null;
  const group = groups.find(item => item.id === event.groupId), front = fronts.find(item => item.id === event.frontId);
  const strength = event.coordinationStrength;
  const capacity = Number.isFinite(strength) && strength >= 0 && strength < 1 ? `coordination à ${Math.round(strength * 100)} %` : 'coordination réduite';
  return `RUCHE DÉSORGANISÉE · ${group?.label ?? event.groupLabel ?? event.groupId ?? 'Groupe de ruche'} · ${front?.label ?? event.frontLabel ?? event.frontId ?? 'Front concerné'} : ${capacity} — attaques coordonnées et vitesse de capture réduites.`;
}
export function operationAlertState(state,objectives,players=[]) {
  const locate=(frontId,text,remaining)=>{const front=state.fronts.find(item=>item.id===frontId),player=players.find(item=>item.hp>0);let direction='';if(front&&player){const dx=front.position[0]-player.position[0],dz=front.position[1]-player.position[1];direction=` · ${compass[(Math.round(Math.atan2(dx,-dz)/(Math.PI/4))+8)%8]} ${Math.round(Math.hypot(dx,dz))} u`; }return{frontId,text:`${text}${front?' · '+front.label:''}${remaining!==null&&remaining!==undefined?' · '+Math.max(0,Math.ceil(remaining))+' s':''}${direction}`};};
  if(state.criticalDeadline!==null&&state.criticalDeadline!==undefined){
    // Several fronts can have independent deadlines. The newest event may name
    // a later loss, or already be outside the player's filtered event feed.
    const urgent=(state.criticalFronts??[]).filter(loss=>typeof loss.frontId==='string'&&Number.isFinite(loss.deadline))
      .reduce((first,loss)=>!first||loss.deadline<first.deadline?loss:first,null);
    const alert=state.alerts.find(item=>item.type==='critical_front_lost');
    return locate(urgent?.frontId??alert?.fronts?.[0],'DÉFAITE IMMINENTE — REPRENEZ LE FRONT',(urgent?.deadline??state.criticalDeadline)-state.time);
  }
  const captain=state.groups.find(group=>group.factionId===state.playerFaction&&group.officerHP>0&&group.officerHP/group.officerMaxHP<=.25);if(captain)return locate(captain.frontId,'CAPITAINE EN DANGER',null);
  const reaction=[...(objectives?.reactions??[]),...(state.phaseThreats??[])].filter(item=>item.status==='announced').sort((a,b)=>a.remaining-b.remaining)[0];if(reaction)return locate(reaction.targetFrontId,reaction.label??'CONTRE-OFFENSIVE EN APPROCHE',reaction.remaining);
  const first=state.alerts[0],alert=first?.type==='unit_died'?(state.alerts.find(item=>item.type==='hive_coordination_disrupted'&&item.groupId===first.groupId&&item.time===first.time)??first):first;if(!alert)return{text:'Les réserves et les pertes persistent entre les fronts.',frontId:null};
  if(alert.type==='hive_coordination_disrupted')return{frontId:alert.frontId,text:hiveCoordinationFeedback(alert,state.groups,state.fronts)};
  const names={base_captured:'Le contrôle d’un front a changé',source_disabled:'Une source de renfort est neutralisée',unit_died:'Un capitaine est tombé',reinforcements_inbound:'Renforts en approche',reinforcements_arrived:'Renforts arrivés',critical_front_recovered:'Le front critique a été repris',front_delegated:'Un capitaine prend le commandement',tactic_ordered:'Une tactique collective est en cours',relations_changed:'Les relations entre factions ont changé',order_blocked:'Un ordre est bloqué par une route fermée',musou_officer_broken:'OFFICIER ENNEMI VAINCU — l’avant-garde alliée reprend courage'};
  const group=state.groups.find(item=>item.id===alert.groupId);return locate(alert.frontId??alert.targetFrontId??group?.frontId,names[alert.type]??'Nouveau rapport stratégique',alert.arrivalAt!==undefined?alert.arrivalAt-state.time:null);
}

export class OperationPanel {
  constructor({ onOrder, onAction, onCheckpoint, onMap } = {}) {
    this.root = document.createElement('section'); this.root.id = 'operation-panel';
    this.root.className = 'operation-panel hidden'; this.root.setAttribute('aria-label', 'Commandement des fronts');
    this.root.innerHTML = `<strong data-title>BATAILLE MUSOU</strong><p data-musou aria-live="off"></p><p data-counts></p><p data-fronts></p><p data-alert role="status"></p><p data-rescue role="status"></p><p data-tasks></p><p data-report-age></p><details><summary>TACTIQUES D'APPUI (OPTIONNELLES)</summary><label>Groupe <select data-group aria-label="Groupe allié"></select></label><label>Front <select data-front aria-label="Front cible"></select></label><label>Ordre <select data-order aria-label="Ordre"><option value="attack">Attaquer</option><option value="defend">Défendre</option><option value="regroup">Regrouper</option><option value="escort">Escorter</option><option value="retreat">Replier</option></select></label><div><button data-map>CARTE / ORDRES</button><button data-send>TRANSMETTRE</button><button data-rally>RALLIER</button><button data-sabotage>SABOTER</button><button data-apc-board>USCM M577 : EMBARQUER</button><button data-apc-exit>USCM M577 : DÉBARQUER</button><button data-apc-drive>USCM M577 : VERS FRONT</button><button data-apc-stop>USCM M577 : STOP</button><button data-save>SAUVEGARDER</button></div><small data-feedback></small></details>`;
    document.getElementById('in-game-hud').append(this.root);
    this.root.querySelector('[data-map]').onclick = () => onMap?.();
    this.root.querySelector('[data-send]').onclick = () => onOrder?.(this.root.querySelector('[data-group]').value, { type: this.root.querySelector('[data-order]').value, frontId: this.root.querySelector('[data-front]').value });
    this.root.querySelector('[data-rally]').onclick = () => onAction?.('rally', this.root.querySelector('[data-front]').value);
    this.root.querySelector('[data-sabotage]').onclick = () => onAction?.('sabotage', this.root.querySelector('[data-front]').value);
    this.root.querySelector('[data-apc-board]').onclick = () => onAction?.('apc-board', this.root.querySelector('[data-front]').value);
    this.root.querySelector('[data-apc-exit]').onclick = () => onAction?.('apc-disembark', this.root.querySelector('[data-front]').value);
    this.root.querySelector('[data-apc-drive]').onclick = () => onAction?.('apc-travel', this.root.querySelector('[data-front]').value);
    this.root.querySelector('[data-apc-stop]').onclick = () => onAction?.('apc-stop', this.root.querySelector('[data-front]').value);
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
    this.root.querySelector('[data-title]').textContent = state.label + ' · ACTION MUSOU / OBJECTIFS ORIGINAUX';
    const pulse=buildMusouBattlePulse(state,players);
    const header=pulse.fronts.map(f=>`${f.critical?'⚠ ':''}${f.label} : ${f.action}${f.distanceToHero!==null?' · '+f.distanceToHero+' u':''}`).join('  ·  ');
    const reserve=pulse.playerCombatants;
    this.root.querySelector('[data-musou]').textContent =
      `${pulse.largeArmyLabel}  ·  ${header}${reserve?`  ·  Alliés déployés : ${reserve.deployed} / réserve ${reserve.reserves}`:''}`;
    this.root.querySelector('[data-counts]').textContent = Object.entries(state.intelCounts??{}).map(([id,c])=>c.exact?`${c.label??id} : ${state.counts[id].active} détaillés / ${state.counts[id].distant} distants / ${state.counts[id].reserve} réserve / ${state.counts[id].dead} pertes`:`${c.label??id} : ${c.knownAlive??0} signalés · réserves inconnues`).join(' · ');
    const apc=state.apcTransport;
    const occupied=(apc?.passengers??0)+(apc?.crew??0);
    this.root.querySelector('[data-apc-board]').disabled=!apc?.available||occupied>0;
    this.root.querySelector('[data-apc-exit]').disabled=!apc?.canDisembark;
    this.root.querySelector('[data-apc-drive]').disabled=!apc?.canDrive;
    this.root.querySelector('[data-apc-stop]').disabled=!apc?.canStop;
    this.root.querySelector('[data-fronts]').textContent = state.fronts.map(front => `${front.label} : ${front.intelState==='unknown'?'inconnu':front.owner??'neutre'}${front.contested ? ' ⚔' : ''}`).join(' · ');
    this.root.querySelector('[data-alert]').textContent = operationAlertState(state,objectives,players).text;
    const patients=state.rescue?.records?.filter(record=>record.status==='downed')??[];
    this.root.querySelector('[data-rescue]').textContent=patients.length?`${patients.length} allié${patients.length>1?'s':''} à terre · secours nécessaire · ${Math.ceil(Math.min(...patients.map(record=>record.remaining)))} s avant la perte` : '';
    this.root.querySelector('[data-tasks]').textContent = objectives ? objectives.tasks.filter(task => task.available && task.status !== 'done').slice(0,3).map(task => `${task.prompt} (${Math.floor(task.progress / task.duration * 100)} %)`).join(' · ') : 'Sécurisez les fronts ou épuisez les forces hostiles.';
    this.options(this.root.querySelector('[data-front]'), state.fronts);
    const selectedGroup=state.groups.find(group=>group.id===this.root.querySelector('[data-group]').value);this.root.querySelector('[data-report-age]').textContent=selectedGroup?intelligencePresentation(selectedGroup).label:'';
    this.options(this.root.querySelector('[data-group]'), state.groups.filter(group => group.factionId === state.playerFaction && group.alive > 0).map(group => ({id:group.id,label:group.label})));
  }
}

function captureOutcomeCause(simulation,result){
  const fronts=result?.reason==='critical_front_lost'&&Array.isArray(result.fronts)
    ? [...new Set(result.fronts)].filter(id=>typeof id==='string').map(id=>{
      const front=simulation.getFront?.(id)??simulation.config.fronts?.find(item=>item.id===id);
      return{id,label:front?.label??null};
    }) : [];
  return{code:result?.reason??null,fronts};
}
function battleOutcomeReason(result,strategy,cause){
  if(strategy?.label)return strategy.label;
  if(cause.code==='critical_front_lost'){
    if(!cause.fronts.length||cause.fronts.some(front=>!front.label))return'Un ou plusieurs fronts critiques n’ont pas été repris avant l’expiration du délai.';
    const names=cause.fronts.map(front=>`« ${front.label} »`).join(' et ');
    return cause.fronts.length===1?`Le front critique ${names} n’a pas été repris avant l’expiration du délai.`:`Les fronts critiques ${names} n’ont pas été repris avant l’expiration du délai.`;
  }
  const reasons={players_defeated:'Les chasseurs ont été vaincus.',all_players_defeated:'Les chasseurs ont été vaincus.',fronts_lost:'Les fronts essentiels ont été perdus.',time_limit:'Le délai de mission a expiré.',operation_timeout:'Le délai de mission a expiré.',objective_complete:'Les objectifs ont été accomplis.',objectives_completed:'Les objectifs ont été accomplis.',population_exhausted:'Les forces hostiles ont été épuisées.'};
  return Object.hasOwn(reasons,cause.code)?reasons[cause.code]:(result?.outcome==='victory'?'Objectif de l’opération accompli.':'Les conditions de poursuite de l’opération ne sont plus réunies.');
}

export function captureBattleDebrief(simulation,objectives=null){
  if(!simulation)return null;
  const counts=simulation.getCounts(),states=['active','distant','reserve','dead','evacuated','captured'];
  const rows=Object.entries(counts).map(([factionId,value])=>({factionId,label:simulation.config.factions.find(faction=>faction.id===factionId)?.label??({player_clan:'Clan joueur',human_force:'Forces humaines',hive:'Ruche',rival_clan:'Clan rival'})[factionId]??factionId,...structuredClone(value),reconciled:states.reduce((sum,key)=>sum+value[key],0)===value.allocated}));
  const result=simulation.getResult?.()??simulation.result,narrative=objectives?.getHUDState?.();
  const strategy=objectives?.spec?.strategies.find(item=>item.id===result?.strategyId),cause=captureOutcomeCause(simulation,result);
  return{version:1,operationTime:simulation.time,playerFaction:simulation.config.playerFaction,tasks:structuredClone((narrative?.tasks??[]).map(task=>({id:task.id,label:task.label,status:task.status}))),groups:structuredClone([...simulation.groups.keys()].map(id=>simulation.getGroup(id)).map(group=>({id:group.id,label:group.label,factionId:group.factionId,alive:group.alive,officerHP:group.officerHP,delegated:group.delegated}))),operationId:simulation.config.id,label:simulation.config.label??simulation.config.id,result:structuredClone(result),cause,reason:battleOutcomeReason(result,strategy,cause),rows,reconciled:rows.every(row=>row.reconciled),noncombatants:narrative?.noncombatants?structuredClone(narrative.noncombatants):null,named:[...simulation.units.values()].filter(unit=>unit.uniqueId&&['dead','evacuated','captured'].includes(unit.state)).map(unit=>({id:unit.uniqueId,label:unit.profileName??simulation.profiles.get(unit.profileId)?.name??unit.uniqueId,state:unit.state})),journal:structuredClone(simulation.getTacticalJournal(64).map(event=>event.type==='hive_coordination_disrupted'?{...event,groupLabel:simulation.groups.get(event.groupId)?.label??event.groupId,frontLabel:simulation.fronts.get(event.frontId)?.label??event.frontId}:event))};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { OperationObjectives } from '../js/battlefield/OperationObjectives.js';
import { captureBattleDebrief } from '../js/ui/OperationPanel.js';
import { intelligencePresentation, commandRoutePreview, frontComparisonRows, commandAcknowledgement, debriefConsequences, combatReadabilityState } from '../js/ui/TacticalPresentation.js';
import { markerAppearance, AccessibilityPreferences } from '../js/ui/AccessibilityPreferences.js';

function configuration() {
 return { id:'tactical-readable',mode:'original',playerFaction:'clan',factions:[{id:'clan',species:'yautja'},{id:'hive',species:'xenomorph'}],relations:[{a:'clan',b:'hive',state:'hostile'}],
 fronts:[{id:'home',label:'Débarquement',owner:'clan',position:[0,0],reinforcementSource:true},{id:'junction',label:'Carrefour',owner:null,position:[100,0]},{id:'remote',label:'Nid',owner:'hive',position:[200,0],reinforcementSource:true}],
 routes:[{id:'direct',from:'home',to:'remote',travelSeconds:40,waypoints:[[0,0],[200,0]],open:false},{id:'west',from:'home',to:'junction',travelSeconds:10,waypoints:[[0,0],[100,0]]},{id:'east',from:'junction',to:'remote',travelSeconds:15,waypoints:[[100,0],[200,0]]}],
 profiles:[{id:'hunter',species:'yautja',maxHp:100,damage:0,attackInterval:2},{id:'warrior',species:'xenomorph',maxHp:100,damage:0,attackInterval:2}],
 groups:[{id:'hunters',label:'Lances du clan',factionId:'clan',frontId:'home',units:[{id:'leader',profileId:'hunter',officer:true},{id:'hunter2',profileId:'hunter'}]},{id:'brood',label:'Couvée cachée',factionId:'hive',frontId:'remote',units:[{id:'alien1',profileId:'warrior'}]}],objectives:{externalVictory:true},ai:{enabled:false} };
}

test('unknown reports never imply fresh contact or expose unobserved enemy counts',()=>{
 const simulation=new BattleSimulation(configuration());
 try {
  const state=simulation.getHUDState(),remote=state.fronts.find(front=>front.id==='remote'),report=intelligencePresentation(remote);
  assert.equal(report.age,null);assert.equal(report.uncertainty,null);assert.match(report.label,/aucun rapport/);assert.equal(report.precise,false);
  const rows=frontComparisonRows(state);assert.equal(rows.find(row=>row.id==='remote').control,'Contrôle inconnu');assert.match(rows.find(row=>row.id==='remote').forces,/0 autres/);
  assert.equal(state.groups.some(group=>group.id==='brood'),false);
 }finally{simulation.dispose();}
});

test('front comparison and text retain the old report age when the hidden group moves',()=>{
 const simulation=new BattleSimulation(configuration());
 try {
  simulation.update(.25,{players:[{id:'player1',hp:100,position:[200,0]}]});
  let state=simulation.getHUDState(),observed=state.groups.find(group=>group.id==='brood');assert.equal(intelligencePresentation(observed).precise,true);
  const old=[...observed.position];simulation.groups.get('brood').position=[1000,1000];
  for(let i=0;i<100;i++)simulation.update(.25,{players:[{id:'player1',hp:100,position:[-500,-500]}]});
  state=simulation.getHUDState();const last=state.groups.find(group=>group.id==='brood'),report=intelligencePresentation(last);
  assert.deepEqual(last.position,old);assert.equal(report.state,'stale');assert.equal(report.age,25);assert.ok(report.uncertainty>7);assert.match(report.label,/PÉRIMÉ.*25 s.*non actualisés/);
 }finally{simulation.dispose();}
});

test('route preview agrees with real accepted path and immediately excludes closed routes',()=>{
 const simulation=new BattleSimulation(configuration());
 try {
  const preview=commandRoutePreview(simulation.getHUDState(),['hunters'],'remote');
  assert.deepEqual(preview.routeIds,['west','east']);assert.equal(preview.groups[0].seconds,25);
  const answer=simulation.issueOrder('hunters',{type:'attack',frontId:'remote'});assert.equal(answer.accepted,true);assert.deepEqual(answer.path.map(edge=>edge.routeId),preview.routeIds);
  assert.match(commandAcknowledgement(answer,{groups:[simulation.getGroup('hunters')],front:{label:'Nid'}}),/Lances du clan.*Nid.*attaque.*arrivée/);
  simulation.setRouteOpen('east',false);
  const blocked=commandRoutePreview(simulation.getHUDState(),['hunters'],'remote');assert.deepEqual(blocked.routeIds,[]);assert.equal(blocked.groups[0].reachable,false);assert.match(blocked.text,/AUCUNE ROUTE OUVERTE/);
  assert.equal(simulation.issueOrder('hunters',{type:'attack',frontId:'remote'}).accepted,false);
 }finally{simulation.dispose();}
});

test('delegation and tactic acknowledgements describe actual accepted actions without promising an instant arrival',()=>{
 const simulation=new BattleSimulation(configuration());
 try{
  const group=simulation.getGroup('hunters'),answer=simulation.delegateFront('hunters','junction');
  assert.equal(answer.accepted,true);assert.equal(simulation.getGroup('hunters').delegated,true);
  assert.match(commandAcknowledgement(answer,{kind:'delegate',groups:[group],front:{label:'Carrefour'}}),/CAPITAINE DÉLÉGUÉ.*Carrefour.*combat réel/);
  const tactic=simulation.issueTactic(['hunters'],{type:'hold_line',frontId:'junction'});assert.equal(tactic.accepted,true);
  assert.match(commandAcknowledgement(tactic,{kind:'tactic',groups:[group]}),/20 s.*30 s.*rejoindre/);
  assert.equal(commandAcknowledgement({accepted:false,reason:'living_officer_required'}),null);
 }finally{simulation.dispose();}
});

test('debrief snapshots real objective completion and clan survivors before scene teardown',()=>{
 const config=getBattleOperationConfig('AFF-01'),simulation=new BattleSimulation(config),objectives=new OperationObjectives(config,simulation);
 try{
  const player={id:'player1',hp:1000,position:[0,0]},task=objectives.getHUDState().tasks.find(task=>task.id==='register');player.position=[...task.position];objectives.update(.01,[player]);assert.equal(objectives.interact(player).accepted,true);
  for(let t=0;t<task.duration+.25;t+=.25)objectives.update(.25,[player]);
  const allied=[...simulation.groups.values()].find(group=>group.factionId===config.playerFaction),unit=simulation.getGroupUnits(allied.id).find(unit=>unit.officer);simulation.recordDeath({entityId:unit.id});
  simulation.finishOperation({outcome:'defeat',reason:'players_defeated'});
  const debrief=captureBattleDebrief(simulation,objectives),source=structuredClone(debrief);simulation.dispose();objectives.dispose();
  const text=debriefConsequences({...debrief,characterId:'jungle_hunter',characterLabel:'Jungle Hunter'}).join('\n');
  assert.match(text,/Chasseur déployé : Jungle Hunter/);assert.match(text,new RegExp(task.label));assert.match(text,/Objectifs restés ouverts/);assert.match(text,/capitaine perdu/);assert.deepEqual(debrief,source);
 }finally{simulation.dispose();objectives.dispose();}
});

test('monochrome remains monochrome after persistence and preserves relationship shapes with flashes reduced',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const preferences=new AccessibilityPreferences({storage});preferences.set({palette:'monochrome',reducedFlashes:true});
 const restored=new AccessibilityPreferences({storage}),roles=['player','ally','hostile','neutral','objective','danger'],styles=roles.map(role=>markerAppearance({role,factionId:'hive'},restored.get()));
 assert.equal(restored.get().palette,'monochrome');assert.equal(restored.get().reducedFlashes,true);assert.deepEqual([...new Set(styles.map(style=>style.color))],['#FFFFFF']);assert.equal(new Set(styles.map(style=>style.shape)).size,6);assert.ok(styles.every(style=>style.glyph.length>0));preferences.dispose();restored.dispose();
});

test('combat readout reflects actual player costs, reveal expiry and the real parasite escape action',async()=>{
 const [{Player},THREE,{CHARACTERS_DATA}]=await Promise.all([import('../js/entities/Player.js'),import('three'),import('../js/data/charactersData.js')]);
 class OfflinePlayer extends Player{loadGeneratedVisual(){return Promise.resolve(false);}}
 const audio=new Proxy({},{get:()=>()=>{}}),player=new OfflinePlayer(new THREE.Scene(),CHARACTERS_DATA.find(item=>item.id==='jungle_hunter'),audio);
 try{
  let view=combatReadabilityState(player.getCombatState(),player.getWeaponState());assert.match(view.costs,new RegExp('Léger '+player.combatStyle.lightCost));assert.match(view.status,/VISIBLE/);assert.equal(view.impaired,false);
  player.isCloaked=true;view=combatReadabilityState(player.getCombatState());assert.match(view.status,/CAMOUFLÉ/);
  player.stealthRevealTimer=1.2;view=combatReadabilityState(player.getCombatState());assert.match(view.status,/REPÉRÉ 1.2 s/);assert.doesNotMatch(view.status,/CAMOUFLÉ/);
  player.update(1.3);view=combatReadabilityState(player.getCombatState());assert.doesNotMatch(view.status,/REPÉRÉ/);
  player.triggerFacehuggerLatch();assert.equal(player.isFacehuggerLatched,true);view=combatReadabilityState(player.getCombatState());assert.match(view.status,/PARASITE AGRIPPÉ.*12 s.*E × 5 : arracher/);assert.equal(view.impaired,true);
 }finally{player.dispose();}
});

test('combat readout preserves finite action resource and execution protection without advertising invulnerability',()=>{
 const view=combatReadabilityState({lightCost:10,nextHeavyCost:31.36,stealth:{concealed:false,revealedFor:3},impairments:[{kind:'ankle_grab',remaining:2.5,exit:'Déplacement ralenti temporairement'}],executionProtection:1.2},{actionResource:'arrows',actionCost:1});
 assert.equal(view.costs,'Léger 10 · Lourd 31.4 END');assert.match(view.status,/Action : 1 flèche/);assert.match(view.status,/CHEVILLE SAISIE.*2.5 s.*Déplacement ralenti temporairement/);assert.match(view.status,/SORTIE D’EXÉCUTION.*1.2 s/);assert.doesNotMatch(view.status,/invulnérab/i);
 assert.deepEqual(combatReadabilityState(null),{costs:'',status:'',impaired:false});
});

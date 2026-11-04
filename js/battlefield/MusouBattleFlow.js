/* Yautja Hive Warriors — action-Musou battlefield contract.
 * Primary loop: play a hunter, enter contested fronts, defeat officers,
 * rescue allies and shift the battle. Source-era traits (Hive Nodes, spores,
 * Extinction specialist units) modify that loop; they do not replace it with
 * an RTS economy, build order or drag-selection gameplay.
 *
 * These calculations are derived from existing allocated identities.
 * They never add actors, mutate save digests or reveal unknown enemy troops. */
export const MUSOU_BATTLE_IDENTITY = Object.freeze({
  genre: 'large-army-action-musou',
  mainLoop: 'hunter-action-fronts-officers-objectives',
  reference: 'Dynasty Warriors: Origins, large-force tactics / morale / officers',
  sourceContentRule: 'Predator/Alien media-specific units and abilities enrich the battle, never replace Musou combat',
  fidelityClaim: 'source-faithful-character-and-environment-goal; not-certified',
  officerBreakMorale: 8,
  prioritiesShown: 3,
  telemetryTimeBasis: 'simulation-time-not-frame-time'
});
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const positive=n=>Number.isFinite(n)&&n>0;
const isKnown=record=>record && record.intelState !== 'unknown' &&
  record.intelState !== 'stale' && record.intelState !== 'unseen';
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

/** Turning a real officer loss into a local momentum shift is the Musou
 * analogue of breaking an army command line. It does not reward invented
 * kills and it can only happen once through BattleSimulation.recordDeath. */
export function applyMusouOfficerBreak(simulation, death) {
  if (!simulation || !death?.officer || !death.killerFaction ||
      death.factionId===death.killerFaction ||
      !simulation.factions?.has(death.killerFaction) ||
      !simulation.areHostile(death.killerFaction,death.factionId)) return null;
  const group=simulation.groups.get(death.groupId);
  if (!group) return null;
  const changed=[];
  for(const candidate of simulation.groups.values()) {
    const front=simulation.fronts?.get(group.frontId);
    if(candidate.frontId!==group.frontId||candidate.path?.length||
      !front||!point(candidate.position)||!point(front.position)||
      distance(candidate.position,front.position)>front.radius||
      !candidate.units?.some(id=>{
        const u=simulation.units.get(id);
        return u?.hp>0 && !u.incapacitated && ['active','distant'].includes(u.state);
      }))continue;
    const same=candidate.factionId===death.killerFaction;
    const allied=simulation.relationship(candidate.factionId,death.killerFaction)==='allied';
    if(!same&&!allied)continue;
    const before=candidate.morale;
    simulation._changeMorale(candidate,MUSOU_BATTLE_IDENTITY.officerBreakMorale,
      'musou_enemy_officer_broken');
    if(candidate.morale>before)changed.push(candidate.id);
  }
  if(!changed.length)return null;
  const report={frontId:group.frontId,groupId:death.groupId,
    officerId:death.entityId,winningFaction:death.killerFaction,
    moraleBoost:MUSOU_BATTLE_IDENTITY.officerBreakMorale,groups:changed};
  simulation._emit('musou_officer_broken',report,3);
  return report;
}

/** HUD-facing triage uses only BattleIntel-safe snapshots. Never inspect
 * the secret roster, undiscovered officers or real-time enemy positions. */
export function buildMusouBattlePulse(state, players = []) {
  if(!state || !Array.isArray(state.fronts) || !Array.isArray(state.groups))return {
    genre:MUSOU_BATTLE_IDENTITY.genre,visible:false,fronts:[],headline:''
  };
  const playerFaction=state.playerFaction;
  const knownAllies=new Set(Object.entries(state.intelCounts??{})
    .filter(([,record])=>record?.exact).map(([id])=>id));
  knownAllies.add(playerFaction);
  const activePlayers=players.filter(p=>p&&positive(p.hp)&&point(p.position));
  const critical=new Set((state.criticalFronts??[]).map(x=>x.frontId));
  const frontReports=state.fronts.map(front=>{
    const known=isKnown(front);
    const nearby=point(front.position)&&activePlayers.length?Math.min(...activePlayers.map(p=>distance(p.position,front.position))):null;
    const groups=state.groups.filter(g=>g.frontId===front.id&&isKnown(g));
    const allies=groups.filter(g=>knownAllies.has(g.factionId));
    const danger=allies.filter(g=>positive(g.officerHP)&&positive(g.officerMaxHP)&&
      g.officerHP/g.officerMaxHP<=.35);
    const observedEnemy=groups.filter(g=>!knownAllies.has(g.factionId));
    // Enemy strength is last reported and may be incomplete: it is never
    // rendered as live/precise hostile troop count.
    const pressure=known && !!front.contested;
    const score=critical.has(front.id)?400:
      danger.length?300:
      pressure?220:
      known && front.owner && front.owner!==playerFaction && !knownAllies.has(front.owner)?120:40;
    const action=critical.has(front.id)?'Reprendre le point décisif':
      danger.length?'Secourir un capitaine allié':
      pressure?'Percer la ligne ennemie':
      observedEnemy.some(g=>positive(g.officerHP))?'Neutraliser un officier repéré':
      known?'Avancer vers les objectifs':'Reconnaître le secteur';
    return {id:front.id,label:front.label??front.id,
      intelState:front.intelState??'reported',
      critical:critical.has(front.id),pressure,alliedOfficerDanger:danger.length,
      observedEnemyGroups:observedEnemy.length,
      knownAlliedGroups:allies.length,
      distanceToHero:nearby===null?null:Math.round(nearby),
      priority:score,action,
      // Do not expose front owner/coordinates for completely unknown fronts.
      positionKnown:known, ownerKnown:known?front.owner??null:null,
      freshness:known?'Rapport connu':'Position non confirmée'};
  });
  frontReports.sort((a,b)=>b.priority-a.priority||
    (a.distanceToHero??Infinity)-(b.distanceToHero??Infinity)||
    a.id.localeCompare(b.id));
  const fronts=frontReports.slice(0,MUSOU_BATTLE_IDENTITY.prioritiesShown);
  const global=state.counts?.[playerFaction]??null;
  const playerCombatants=global && knownAllies.has(playerFaction)?{
    deployed:(global.active??0)+(global.distant??0),
    detailed:global.active??0,
    reserves:global.reserve??0,
    casualties:global.dead??0
  }:null;
  const headlines=fronts.map(f=>`${f.label} : ${f.action}`);
  return {visible:true,genre:MUSOU_BATTLE_IDENTITY.genre,
    headline:headlines[0]??'Progresser dans la bataille',
    fronts,playerCombatants,playersFighting:activePlayers.length,
    largeArmyLabel:'Bataille Musou — héros, officiers et armées parallèles',
    showEnemyExactCount:false,sourceRtsControlEnabled:false};
}

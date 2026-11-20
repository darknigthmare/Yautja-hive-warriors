/* Presentation consumes only the already filtered tactical HUD snapshot. It
 * must never query hidden simulation actors to improve a report. */
const finite = value => Number.isFinite(value) && value >= 0;
const orderNames = { attack: 'attaque', defend: 'défense', regroup: 'regroupement', escort: 'escorte', retreat: 'repli' };
const sourceNames = { player_sight: 'vue directe', recon: 'reconnaissance', deployment: 'déploiement', garrison_report: 'rapport de garnison', squad_report: 'rapport du groupe', allied_scout: 'éclaireur allié', debrief: 'bilan confirmé' };

export function intelligencePresentation(entity) {
  if (!entity || entity.intelState === 'unknown' || entity.reportAge === null) return { state: 'unknown', label: 'INCONNU · aucun rapport reçu', age: null, uncertainty: null, precise: false };
  const age = finite(entity.reportAge) ? Math.floor(entity.reportAge) : null;
  const precise = entity.precisePositionKnown === true;
  const stale = entity.intelState === 'stale';
  const status = precise ? 'CONTACT ACTUEL' : stale ? 'RAPPORT PÉRIMÉ' : 'DERNIÈRE POSITION SIGNALÉE';
  const source = sourceNames[entity.reportSource];
  return { state: precise ? 'current' : stale ? 'stale' : 'reported', age, precise,
    // This is a visual uncertainty halo, not an inferred world-space location.
    uncertainty: precise ? 0 : Math.min(24, 7 + (age ?? 0) / 5),
    label: `${status}${age === null ? ' · âge inconnu' : ` · ${age} s`}${source ? ` · ${source}` : ''}${precise ? '' : ' · position et effectifs non actualisés'}` };
}

function shortestRoute(state, from, to) {
  if (from === to) return { seconds: 0, routeIds: [], fronts: [from] };
  const validFronts = new Set((state.fronts ?? []).map(front => front.id));
  const queue = [{ id: from, seconds: 0, routeIds: [], fronts: [from] }], visited = new Set();
  while (queue.length) {
    queue.sort((a, b) => a.seconds - b.seconds || a.id.localeCompare(b.id));
    const current = queue.shift();
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    if (current.id === to) return current;
    for (const route of state.routes ?? []) {
      if (route.open === false || !finite(route.travelSeconds) || route.travelSeconds === 0) continue;
      const next = route.from === current.id ? route.to : route.to === current.id ? route.from : null;
      if (!next || !validFronts.has(next) || visited.has(next)) continue;
      queue.push({ id: next, seconds: current.seconds + route.travelSeconds, routeIds: [...current.routeIds, route.id], fronts: [...current.fronts, next] });
    }
  }
  return null;
}

export function commandRoutePreview(state, groupIds, frontId) {
  const front = state?.fronts?.find(item => item.id === frontId);
  const groups = (state?.groups ?? []).filter(group => groupIds.includes(group.id) && group.factionId === state.playerFaction && group.alive > 0);
  if (!front || !groups.length) return { routeIds: [], groups: [], text: 'Choisissez un groupe allié vivant et un front pour comparer les routes.' };
  const rows = groups.map(group => ({ group, route: shortestRoute(state, group.frontId, frontId) }));
  const text = rows.map(({ group, route }) => `${group.label} : ${route ? route.seconds ? `${Math.ceil(route.seconds)} s de trajet de front à front${group.path?.length ? ' · groupe déjà en transit' : ''}` : 'déjà sur ce front' : 'AUCUNE ROUTE OUVERTE'}${group.reconstitution?.required ? ' · reconstitution requise avant attaque' : ''}${group.officerHP > 0 ? group.delegated ? ' · capitaine autonome' : ' · capitaine disponible' : ' · aucun capitaine disponible'}`).join(' ; ');
  return { routeIds: [...new Set(rows.flatMap(row => row.route?.routeIds ?? []))], groups: rows.map(({ group, route }) => ({ id: group.id, reachable: route !== null, seconds: route?.seconds ?? null })), text: `${front.label} — ${text}. Estimation de trajet ; le combat, les obstacles et les nouveaux ordres peuvent la modifier.` };
}

export function frontComparisonRows(state) {
  return (state?.fronts ?? []).map(front => {
    const intel = intelligencePresentation(front);
    const known = (state.groups ?? []).filter(group => group.frontId === front.id && group.alive > 0);
    const own = known.filter(group => group.factionId === state.playerFaction);
    const reportedOther = known.filter(group => group.factionId !== state.playerFaction);
    return { id: front.id, label: front.label,
      control: intel.state === 'unknown' ? 'Contrôle inconnu' : `${front.owner ?? 'neutre'}${front.contested ? ' · DISPUTÉ' : ''}`,
      forces: `${own.reduce((sum, group) => sum + group.alive, 0)} alliés signalés · ${reportedOther.reduce((sum, group) => sum + group.alive, 0)} autres combattants signalés`,
      logistics: intel.state === 'unknown' ? 'Ravitaillement inconnu' : front.reinforcementSource ? front.sourceHP > 0 ? 'Source de renfort opérationnelle' : 'Source de renfort neutralisée' : 'Sans source de renfort',
      intel: intel.label, delegated: own.filter(group => group.delegated).map(group => group.label) };
  });
}

export function commandAcknowledgement(answer, { kind = 'order', groups = [], front = null } = {}) {
  if (!answer?.accepted) return null;
  const where = front ? ` vers ${front.label}` : '';
  const names = groups.map(group => group.label).join(', ');
  if (kind === 'delegate') return `CAPITAINE DÉLÉGUÉ${where} · ${groups[0]?.label??'Premier groupe sélectionné'}. Il défend puis décide selon le combat réel ; surveillez ses pertes et ses rapports.`;
  if (kind === 'tactic') return `TACTIQUE COORDONNÉE${where} · ${names}. Effet 20 s ; nouvelle coordination après 30 s. Les groupes doivent encore rejoindre leur position.`;
  if (answer.queued) return 'ACTION PLANIFIÉE · Le compagnon agira après reprise, s’il rejoint la portée et conserve ses charges.';
  const order = answer.order;
  if (order) return `ORDRE ACCEPTÉ · ${names || 'Groupe sélectionné'}${where} · ${orderNames[order.type] ?? order.type} · ${order.issuer === 'player2' ? 'Joueur 2' : order.issuer === 'officer' ? 'Capitaine' : 'Joueur 1'}. Cet ordre remplace le précédent ; l’arrivée sera annoncée séparément.`;
  return 'ACTION ACCEPTÉE · Consultez le journal et les stocks après la reprise.';
}

export function debriefConsequences(debrief) {
  if (!debrief) return [];
  const lines = [];
  if (debrief.characterLabel || debrief.characterId) lines.push(`Chasseur déployé : ${debrief.characterLabel ?? debrief.characterId}.`);
  if (finite(debrief.operationTime)) lines.push(`Temps de bataille : ${Math.floor(debrief.operationTime / 60)} min ${Math.floor(debrief.operationTime % 60)} s.`);
  const tasks = debrief.tasks ?? [];
  if (tasks.length) lines.push(`Objectifs accomplis : ${tasks.filter(task => task.status === 'done').map(task => task.label).join(' ; ') || 'aucun'}.`);
  const unfinished = tasks.filter(task => task.status !== 'done');
  if (unfinished.length) lines.push(`Objectifs restés ouverts : ${unfinished.map(task => task.label).join(' ; ')}.`);
  const groups = (debrief.groups ?? []).filter(group => group.factionId === debrief.playerFaction);
  if (groups.length) lines.push(`Groupes du clan : ${groups.map(group => `${group.label} — ${group.alive} survivants${group.officerHP === 0 ? ', capitaine perdu' : group.delegated ? ', front confié au capitaine' : ''}`).join(' ; ')}.`);
  const recognition = debrief.characterRecognition;
  if (recognition) lines.push(`${recognition.label} · ${recognition.completedMissions} mission(s) confirmée(s) pour ce chasseur${recognition.commendations?.length ? ' · ' + recognition.commendations.map(item => item.label).join(' ; ') : ''}. ${recognition.canonicalStatus ?? 'Statut narratif inchangé.'}`);
  return lines;
}

/** Compact state/cost copy follows the player's public combat snapshot. */
export function combatReadabilityState(combat, weapon = {}) {
  if (!combat) return { costs: '', status: '', impaired: false };
  const amount = value => finite(value) ? String(Math.round(value * 10) / 10) : '?';
  const costs = `Léger ${amount(combat.lightCost)} · Lourd ${amount(combat.nextHeavyCost)} END`;
  const status = [];
  if (combat.stealth?.concealed) status.push('◇ CAMOUFLÉ · embuscade possible');
  else if (combat.stealth?.revealedFor > 0) status.push(`! REPÉRÉ ${amount(combat.stealth.revealedFor)} s`);
  else status.push('○ VISIBLE');
  const names = { facehugger: 'PARASITE AGRIPPÉ', ankle_grab: 'CHEVILLE SAISIE' };
  const impairments = (combat.impairments ?? []).slice(0, 2);
  for (const effect of impairments) status.push(`! ${names[effect.kind] ?? 'ENTRAVE'}${finite(effect.remaining) ? ` · ${amount(effect.remaining)} s` : ''}${typeof effect.exit === 'string' ? ` · ${effect.exit}` : ''}`);
  if (combat.executionProtection > 0) status.push(`○ SORTIE D’EXÉCUTION · protection ${amount(combat.executionProtection)} s`);
  if (weapon.actionResource === 'arrows') status.unshift(`Action : ${amount(weapon.actionCost)} flèche`);
  else if (weapon.actionResource === 'axe_charges') status.unshift(`Action : ${amount(weapon.actionCost)} charge de hache`);
  return { costs, status: status.join(' · '), impaired: impairments.length > 0 };
}

/* Original campaign commendations. They do not assign canonical Yautja ranks,
 * alter character statistics or write to the honor/trophy wallets. */
const integer = (value, max = 4096) => Number.isInteger(value) && value >= 0 && value <= max;
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value);
const living = unit => unit.hp > 0 && !['dead', 'captured', 'evacuated'].includes(unit.state);

export function buildClanServiceEvidence(configuration, simulation, result, narrative = null) {
  const actual = simulation.getResult?.();
  const confirmed = !!actual && actual.outcome === result.outcome && actual.reason === result.reason;
  const controllerVerified = narrative?.simulation === simulation && narrative?.config?.id === configuration.id && narrative.getResult?.()?.outcome === result.outcome;
  const tasks = controllerVerified ? [...narrative.tasks.values()].filter(task => task.status === 'done') : [];
  const rescued = controllerVerified ? narrative.getWorldEntities().flatMap(entity => entity.members ?? []).filter(member => member.state === 'evacuated' && member.hp > 0).map(member => member.id) : [];
  const ownOfficers = [...simulation.units.values()].filter(unit => unit.factionId === configuration.playerFaction && unit.officer && unit.state !== 'reserve');
  const evidence = { version: 1, confirmedOutcome: confirmed, completedMission: confirmed && result.outcome === 'victory', narrativeVerified: controllerVerified,
    taskIds: tasks.map(task => task.id).slice(0, 24), defendedFronts: tasks.filter(task => task.type === 'defend' && simulation.relationship(simulation.getFrontState(task.frontId)?.owner, configuration.playerFaction) === 'allied').map(task => task.frontId),
    rescuedIndividualIds: [...new Set(rescued)].slice(0, 256),
    extractedCargo: tasks.filter(task => task.type === 'extract').flatMap(task => task.cargo ?? []).slice(0, 24),
    localAgreements: tasks.filter(task => task.type === 'negotiate' && simulation.relationship(configuration.playerFaction, task.factionId) === task.relationship).map(task => task.id).slice(0, 24),
    alliedOfficersAllocated: ownOfficers.length, alliedOfficersSurvived: ownOfficers.filter(living).length };
  return evidence;
}

export function validClanServiceEvidence(value) {
  return value?.version === 1 && ['confirmedOutcome', 'completedMission', 'narrativeVerified'].every(key => typeof value[key] === 'boolean') && (!value.completedMission || value.confirmedOutcome) &&
    [['taskIds', 24], ['defendedFronts', 24], ['rescuedIndividualIds', 256], ['extractedCargo', 24], ['localAgreements', 24]].every(([key, max]) => Array.isArray(value[key]) && value[key].length <= max && new Set(value[key]).size === value[key].length && value[key].every(validId)) &&
    integer(value.alliedOfficersAllocated) && integer(value.alliedOfficersSurvived) && value.alliedOfficersSurvived <= value.alliedOfficersAllocated &&
    (value.narrativeVerified || !value.taskIds.length && !value.defendedFronts.length && !value.rescuedIndividualIds.length && !value.extractedCargo.length && !value.localAgreements.length);
}

export function getClanRecognition(finalizedRuns, characterId = null) {
  const runs = finalizedRuns.filter(run => (!characterId || run.characterId === characterId) && validClanServiceEvidence(run.serviceEvidence));
  const successes = runs.filter(run => run.serviceEvidence.completedMission), count = key => successes.reduce((sum, run) => sum + run.serviceEvidence[key].length, 0);
  const defence = count('defendedFronts'), rescued = count('rescuedIndividualIds'), cargo = count('extractedCargo'), agreements = count('localAgreements');
  const honors = [];
  if (successes.length) honors.push({ id: 'mission_service', label: 'Service de mission reconnu', proofCount: successes.length });
  if (defence) honors.push({ id: 'front_defence', label: 'Défense de clan reconnue', proofCount: defence });
  if (rescued) honors.push({ id: 'people_extracted', label: 'Protection des personnes reconnue', proofCount: rescued });
  if (cargo) honors.push({ id: 'evidence_recovered', label: 'Récupération de preuves reconnue', proofCount: cargo });
  if (agreements) honors.push({ id: 'local_agreement', label: 'Négociation locale reconnue', proofCount: agreements });
  return { scope: 'original-clan-conflicts', characterId, originalSocialRules: true,
    label: successes.length >= 3 ? 'Prestige de service confirmé' : successes.length ? 'Premier service reconnu' : 'Aucun service confirmé',
    completedMissions: successes.length, commendations: honors,
    prestige: successes.length * 2 + Math.min(24, defence + cargo + agreements + (rescued > 0 ? 1 : 0)),
    narrativeRankChanged: false, canonicalStatus: 'Statut narratif inchangé : aucune cérémonie de promotion validée.',
    statBonuses: null, honorWalletDelta: 0, trophiesGranted: 0 };
}

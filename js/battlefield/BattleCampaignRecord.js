import { buildClanServiceEvidence, validClanServiceEvidence, getClanRecognition } from './ClanRecognition.js';

/* Optional original arcs. Independent operation presets stay independent until
 * the player opts in. This key never reads/writes the honor or trophy stores. */
const copy = value => JSON.parse(JSON.stringify(value));
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value);
const text = (value, max = 160) => typeof value === 'string' && value.length <= max;
const count = value => Number.isInteger(value) && value >= 0 && value <= 4096;
const STATES = ['active', 'distant', 'reserve', 'dead', 'evacuated', 'captured'];
const fail = message => { throw new Error(`BattleCampaignRecord: ${message}`); };
export const CLAN_CAMPAIGN_ARC_ID = 'original-clan-conflicts';
export const BATTLE_CAMPAIGN_ARCS = Object.freeze([Object.freeze({ id: CLAN_CAMPAIGN_ARC_ID,
  label: 'Conflits de clans — continuité originale du projet', mode: 'original', era: 'operation_specific',
  operationIds: Object.freeze(['AFF-01', 'AFF-02', 'AFF-03', 'AFF-04', 'AFF-05']), fidelity1to1Verified: false })]);

function validCounts(values) {
  return values && typeof values === 'object' && Object.keys(values).length <= 16 && Object.entries(values).every(([id, counts]) => validId(id) && count(counts.allocated) && STATES.every(state => count(counts[state])) && STATES.reduce((sum, state) => sum + counts[state], 0) === counts.allocated);
}
function validateStore(saved) {
  if (!saved || saved.version !== 1 || !Array.isArray(saved.arcs) || saved.arcs.length > BATTLE_CAMPAIGN_ARCS.length || new Set(saved.arcs.map(arc => arc.id)).size !== saved.arcs.length) fail('invalid campaign record');
  for (const arc of saved.arcs) {
    const definition = BATTLE_CAMPAIGN_ARCS.find(item => item.id === arc.id);
    if (!definition || !Array.isArray(arc.individuals) || arc.individuals.length > 256 || new Set(arc.individuals.map(item => item.uniqueId)).size !== arc.individuals.length || !Array.isArray(arc.runs) || arc.runs.length > 64 || new Set(arc.runs.map(run => run.runId)).size !== arc.runs.length || !Array.isArray(arc.fronts) || arc.fronts.length > 256 || new Set(arc.fronts.map(front => `${front.operationId}:${front.id}`)).size !== arc.fronts.length) fail('invalid arc allocation');
    for (const individual of arc.individuals) if (!validId(individual.uniqueId) || !['dead', 'captured', 'evacuated'].includes(individual.state) || !definition.operationIds.includes(individual.operationId) || !validId(individual.runId) || !Number.isFinite(individual.operationTime) || individual.operationTime < 0 || !text(individual.recordedAt, 64)) fail('invalid persistent individual');
    for (const run of arc.runs) if (!validId(run.runId) || !definition.operationIds.includes(run.operationId) || !['victory', 'defeat', 'withdrawn'].includes(run.outcome) || !text(run.reason, 120) || !Number.isFinite(run.operationTime) || run.operationTime < 0 || !validCounts(run.counts) || !text(run.recordedAt, 64) || run.characterId !== null && !validId(run.characterId) || !Array.isArray(run.completedTasks) || run.completedTasks.length > 24 || run.completedTasks.some(id => !validId(id))) fail('invalid operation receipt');
    for (const front of arc.fronts) if (!definition.operationIds.includes(front.operationId) || !validId(front.id) || front.owner !== null && !validId(front.owner) || !Number.isFinite(front.sourceHP) || front.sourceHP < 0 || !validId(front.runId)) fail('invalid persistent front');
    // Keep permanent bounded finalization tokens separately from the short
    // debrief ring. Evicting a detailed receipt must never permit a second award.
    arc.finalizedRuns ??= arc.runs.map(run => ({ runId: run.runId, operationId: run.operationId, outcome: run.outcome }));
    if (!Array.isArray(arc.finalizedRuns) || arc.finalizedRuns.length > 512 || new Set(arc.finalizedRuns.map(run => run.runId)).size !== arc.finalizedRuns.length || arc.finalizedRuns.some(run => !validId(run.runId) || !definition.operationIds.includes(run.operationId) || !['victory', 'defeat', 'withdrawn'].includes(run.outcome) || run.characterId !== undefined && run.characterId !== null && !validId(run.characterId) || run.serviceEvidence !== undefined && !validClanServiceEvidence(run.serviceEvidence)) || arc.runs.some(run => !arc.finalizedRuns.some(token => token.runId === run.runId && token.operationId === run.operationId && token.outcome === run.outcome))) fail('invalid finalized run ledger');
  }
  return copy(saved);
}

export class BattleCampaignRecord {
  constructor({ storage = null, key = 'yautja-battle-campaign-v1', now = () => new Date().toISOString() } = {}) {
    this.storage = storage; this.key = key; this.now = now; this.data = { version: 1, arcs: [] };
    this.status = 'empty'; this.lastError = null; this.writes = 0; this.readOnly = false;
    try {
      const raw = storage?.getItem(key);
      if (raw === null || raw === undefined) return;
      if (typeof raw !== 'string' || raw.length > 2 * 1024 * 1024) fail('record exceeds its bounded storage budget');
      this.data = validateStore(JSON.parse(raw)); this.status = 'loaded';
    } catch (error) {
      // Preserve an incompatible record until an explicit reset. A failed read
      // cannot wipe either this history or another system's valid trophies.
      this.status = 'unavailable_or_invalid'; this.lastError = String(error.message).slice(0, 160); this.readOnly = true;
    }
  }

  _scope(configuration, arcId) {
    if (!arcId) return null;
    const definition = BATTLE_CAMPAIGN_ARCS.find(arc => arc.id === arcId);
    if (!definition || !definition.operationIds.includes(configuration?.id) || configuration.mode !== definition.mode || configuration.context?.era !== definition.era) fail('operation is outside the explicitly selected original arc');
    return definition;
  }
  _arc(definition, create = false) {
    let arc = this.data.arcs.find(item => item.id === definition.id);
    if (!arc && create) { arc = { id: definition.id, individuals: [], runs: [], finalizedRuns: [], fronts: [] }; this.data.arcs.push(arc); }
    return arc;
  }
  _persist() {
    if (this.readOnly) return false;
    try {
      validateStore(this.data);
      const serialized = JSON.stringify(this.data);
      if (serialized.length > 2 * 1024 * 1024) fail('record exceeds its bounded storage budget');
      if (this.storage) { this.storage.setItem(this.key, serialized); this.writes++; }
      this.status = this.storage ? 'saved' : 'memory_only'; this.lastError = null; return true;
    } catch (error) { this.status = 'storage_unavailable'; this.lastError = String(error.message).slice(0, 160); return false; }
  }

  historyFor(configuration, { arcId = null } = {}) {
    const definition = this._scope(configuration, arcId), arc = definition && this._arc(definition);
    if (!arc) return { defeatedUniqueIds: [], capturedUniqueIds: [], arcId: definition?.id ?? null, priorOutcomes: [] };
    return { arcId: definition.id, label: definition.label,
      defeatedUniqueIds: arc.individuals.filter(item => item.state === 'dead').map(item => item.uniqueId),
      capturedUniqueIds: arc.individuals.filter(item => item.state === 'captured').map(item => item.uniqueId),
      priorOutcomes: arc.runs.slice(-8).map(run => ({ operationId: run.operationId, outcome: run.outcome, reason: run.reason, characterId: run.characterId })) };
  }

  observe(configuration, simulation, { arcId = null, runId } = {}) {
    const definition = this._scope(configuration, arcId);
    if (!definition) return { recorded: false, independent: true };
    if (this.readOnly) return { recorded: false, reason: 'incompatible_history_requires_explicit_reset' };
    if (!validId(runId) || simulation?.config?.id !== configuration.id || !simulation.getCampaignConsequences) fail('observation requires a matching operation and stable run id');
    const known = new Set(configuration.groups.flatMap(group => group.units.map(unit => unit.uniqueId ?? (configuration.profiles.find(profile => profile.id === unit.profileId)?.unique ? unit.profileId : null)).filter(Boolean)));
    const consequences = simulation.getCampaignConsequences(), states = [
      ...consequences.evacuatedUniqueIds.map(uniqueId => ({ uniqueId, state: 'evacuated' })),
      ...consequences.capturedUniqueIds.map(uniqueId => ({ uniqueId, state: 'captured' })),
      ...consequences.defeatedUniqueIds.map(uniqueId => ({ uniqueId, state: 'dead' }))
    ];
    if (states.some(item => !known.has(item.uniqueId))) fail('observation contains an unallocated named individual');
    const arc = this._arc(definition, true); let changed = false;
    for (const state of states) {
      const previous = arc.individuals.find(item => item.uniqueId === state.uniqueId);
      if (previous?.state === 'dead' || previous?.state === state.state) continue;
      const entry = { ...state, operationId: configuration.id, runId, operationTime: simulation.time, recordedAt: this.now() };
      if (previous) Object.assign(previous, entry);
      else if (arc.individuals.length < 256) arc.individuals.push(entry);
      else fail('the persistent unique-identity budget is exhausted');
      changed = true;
    }
    // Unchanged consequences can still be pending after a failed storage write.
    const persisted = changed || this.status === 'storage_unavailable' ? this._persist() : true;
    return { recorded: changed, persisted, history: this.historyFor(configuration, { arcId }) };
  }

  recordOutcome(configuration, simulation, result, { arcId = null, runId, characterId = null, narrative = null } = {}) {
    const definition = this._scope(configuration, arcId);
    if (!definition) return { recorded: false, independent: true };
    if (this.readOnly) return { recorded: false, reason: 'incompatible_history_requires_explicit_reset' };
    if (!validId(runId) || characterId !== null && !validId(characterId) || simulation?.config?.id !== configuration.id || !result || !['victory', 'defeat', 'withdrawn'].includes(result.outcome) || !text(result.reason, 120)) fail('a valid result and stable operation run id are required');
    const priorArc = this._arc(definition), existing = priorArc?.finalizedRuns.find(run => run.runId === runId);
    if (existing) {
      const persisted = this.status === 'storage_unavailable' ? this._persist() : ['saved', 'loaded', 'memory_only'].includes(this.status);
      return existing.operationId === configuration.id && existing.outcome === result.outcome ? { recorded: false, duplicate: true, persisted, receipt: copy(priorArc.runs.find(run => run.runId === runId) ?? existing) } : { recorded: false, duplicate: true, reason: 'run_already_finalized_with_another_result' };
    }
    if ((priorArc?.finalizedRuns.length ?? 0) >= 512) return { recorded: false, reason: 'campaign_run_budget_exhausted' };
    const confirmed = simulation.getResult?.() ?? simulation.result;
    if (result.outcome !== 'withdrawn' && (!confirmed || confirmed.outcome !== result.outcome || confirmed.reason !== result.reason)) fail('the receipt outcome is not confirmed by the battle simulation');
    if (result.outcome === 'withdrawn' && confirmed) fail('a completed battle cannot be rewritten as a withdrawal');
    this.observe(configuration, simulation, { arcId, runId });
    const counts = simulation.getCounts(); if (!validCounts(counts)) fail('battle counts do not reconcile');
    const objectiveState = narrative?.getHUDState?.() ?? narrative;
    const receipt = { runId, operationId: configuration.id, outcome: result.outcome, reason: result.reason,
      operationTime: simulation.time, recordedAt: this.now(), characterId,
      counts: copy(counts), strategyId: validId(result.strategyId) ? result.strategyId : null,
      completedTasks: (objectiveState?.tasks ?? []).filter(task => task.status === 'done' && validId(task.id)).map(task => task.id).slice(0, 24),
      serviceEvidence: buildClanServiceEvidence(configuration, simulation, result, narrative) };
    const arc = this._arc(definition, true); arc.runs.push(receipt); arc.finalizedRuns.push({ runId, operationId: configuration.id, outcome: result.outcome, characterId, serviceEvidence: copy(receipt.serviceEvidence) }); if (arc.runs.length > 64) arc.runs.shift();
    const snapshots = [...simulation.fronts.keys()].map(id => simulation.getFront(id));
    for (const front of snapshots) {
      const entry = { operationId: configuration.id, id: front.id, owner: front.owner, sourceHP: front.sourceHP, runId };
      const prior = arc.fronts.find(item => item.operationId === entry.operationId && item.id === entry.id);
      if (prior) Object.assign(prior, entry); else if (arc.fronts.length < 256) arc.fronts.push(entry);
    }
    const persisted = this._persist(); return { recorded: true, persisted, receipt: copy(receipt), debrief: this.getDebrief(arcId) };
  }

  getDebrief(arcId = CLAN_CAMPAIGN_ARC_ID) {
    const definition = BATTLE_CAMPAIGN_ARCS.find(item => item.id === arcId);
    if (!definition) return null;
    const arc = this._arc(definition);
    return { id: arcId, label: definition.label, originalScenario: true, fidelity1to1Verified: false, status: this.status,
      recordedRuns: arc?.finalizedRuns.length ?? 0, runs: copy(arc?.runs.slice(-8) ?? []),
      individuals: copy(arc?.individuals ?? []), fronts: copy(arc?.fronts ?? []), social: getClanRecognition(arc?.finalizedRuns ?? []),
      characterRecognition: [...new Set((arc?.finalizedRuns ?? []).map(run => run.characterId).filter(Boolean))].map(characterId => getClanRecognition(arc.finalizedRuns, characterId)), lastError: this.lastError };
  }

  getCharacterBriefing(configuration, { arcId = null, characterId = null } = {}) {
    const definition = this._scope(configuration, arcId);
    if (characterId !== null && !validId(characterId)) fail('invalid character identity');
    const arc = definition && this._arc(definition), history = this.historyFor(configuration, { arcId });
    const relevant = new Set(configuration.groups.flatMap(group => group.units.map(unit => unit.uniqueId).filter(Boolean)));
    return { characterId, arcId: definition?.id ?? null, originalScenario: !!definition, narrativeRankChanged: false,
      role: 'Chasseur déployé pour cette opération', objective: configuration.operationObjectives?.title ?? configuration.label ?? configuration.id,
      continuityEnabled: !!definition, priorMissions: history.priorOutcomes,
      relevantNamedConsequences: copy((arc?.individuals ?? []).filter(individual => relevant.has(individual.uniqueId))),
      recognition: getClanRecognition(arc?.finalizedRuns ?? [], characterId),
      scopeNote: definition ? 'Continuité originale sélectionnée ; les pertes confirmées de ce conflit restent acquises.' : 'Opération indépendante ; aucune chronologie générale imposée au personnage.' };
  }

  resetArc(arcId) {
    if (!BATTLE_CAMPAIGN_ARCS.some(arc => arc.id === arcId)) return false;
    if (this.readOnly) { this.data = { version: 1, arcs: [] }; this.readOnly = false; }
    this.data.arcs = this.data.arcs.filter(arc => arc.id !== arcId);
    return this._persist();
  }
}

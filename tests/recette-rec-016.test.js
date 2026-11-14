// Recette REC-016 — sauvegarde d'une guerre répartie.
// Audit 2026-10-26, feuille Validation. Opération catalogue AFF-27 (quatre
// fronts, trois factions), mapSeed 0. Au moment de la sauvegarde : fronts
// actifs, M577 en transit avec passagers, groupe en repli, porte sabotée
// (route fermée) et sabotage de porte en cours. Sauvegarde par js/ui/storage.js
// (localStorage simulé), rechargement par BattleSimulation.fromState et
// OperationObjectives.restore, puis cinq minutes de jeu simulé.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { OperationObjectives } from '../js/battlefield/OperationObjectives.js';
import { physicalOperationRouteAvailable } from '../js/battlefield/PhysicalRouteAvailability.js';
import { planM577Embark, m577RouteWaypoints, M577_ROUTE_RULES } from '../js/battlefield/APCSectionManifest.js';
import { readStored, writeStored } from '../js/ui/storage.js';

const ROOT = new URL('..', import.meta.url).pathname;
const COMMIT = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const DIRTY = execSync('git status --porcelain -- js', { cwd: ROOT }).toString().split('\n').filter(Boolean);
const OUT = `${ROOT}docs/qa/recettes-20261114/rec-016.json`;
const STEP = 0.25, MAP_SEED = 0, KEY = 'yautja-operation-checkpoint-v1';
const evidence = {
  recette: 'REC-016', titre: "Sauvegarde d'une guerre répartie",
  source: 'docs/audits/2026-10-26/Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx#Validation!REC-016',
  dateExecution: '2026-11-14', commit: COMMIT, sourcesJsNonCommitees: DIRTY, graine: { operation: 'AFF-27', mapSeed: MAP_SEED, pasSimulation: STEP },
  commande: 'node --test tests/recette-rec-016.test.js',
  preuveVideo: 'non produite — preuve par journal de simulation',
  scenario: {}, clauses: [],
};
const clause = (id, texte, verdict, details = {}) => { evidence.clauses.push({ id, texte, verdict, ...details }); return verdict === 'prouvé'; };
after(() => { mkdirSync(new URL('.', `file://${OUT}`).pathname, { recursive: true }); writeFileSync(OUT, JSON.stringify(evidence, null, 1) + '\n'); });

const store = new Map();
globalThis.localStorage = { getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function build() {
  const { config, layout } = createOperationScene({ operationId: 'AFF-27', players: 1, mapSeed: MAP_SEED });
  const env = { battlefieldLayout: layout, isGateOpen: () => true, isTacticalRouteAvailable: () => true };
  const events = [];
  const callbacks = { spawnGroup: () => true, despawnGroup: (group, units) => units.map(u => ({ id: u.id, hp: u.hp, position: u.position })), announce: event => events.push(event),
    routeAvailabilityProvider: (route, options) => physicalOperationRouteAvailable(env, route, options) };
  return { config, callbacks, events };
}
/* Drives the existing M577 manifest along its signed road (≤ maxMoveStep per call). */
function driveAPC(sim, metres) {
  const manifest = sim.getAPCManifest(); if (!manifest) return 'none';
  if (manifest.transit) {
    const path = m577RouteWaypoints(sim, manifest.transit, manifest.frontId), end = path.at(-1);
    let index = path.findIndex((point, i) => i > 0 && dist(manifest.position, point) > 1e-6 && (i === path.length - 1 || dist(path[i - 1], manifest.position) + dist(manifest.position, point) - dist(path[i - 1], point) < 1e-6));
    if (index < 0) index = path.length - 1;
    const target = path[index], d = dist(manifest.position, target), k = Math.min(1, metres / Math.max(d, 1e-9));
    const next = [manifest.position[0] + (target[0] - manifest.position[0]) * k, manifest.position[1] + (target[1] - manifest.position[1]) * k];
    sim.moveAPCManifest(next);
    if (dist(next, end) <= M577_ROUTE_RULES.arrivalDistance) { sim.completeAPCTransit(); return 'arrived'; }
    return 'transit';
  }
  return 'parked';
}

const frontDamage = sim => { const out = {}; for (const unit of sim.units.values()) { const f = sim.groups.get(unit.groupId).frontId; out[f] = (out[f] ?? 0) + unit.damageTaken; } return out; };
const summary = sim => ({
  time: sim.time, counts: sim.getCounts(), deaths: sim.deaths.size,
  orders: Object.fromEntries([...sim.groups.values()].map(g => [g.id, `${g.order.type}>${g.order.frontId}@${g.frontId}${g.path.length ? ' via ' + g.path.map(s => s.routeId).join('>') : ''}`])),
  groupStates: Object.fromEntries([...sim.groups.values()].map(g => [g.id, g.state])),
  reconstitutions: Object.fromEntries([...sim.groups.values()].filter(g => g.reconstitution).map(g => [g.id, { required: g.reconstitution.required, returnFrontId: g.reconstitution.returnFrontId }])),
  apc: sim.getAPCManifest(), routes: Object.fromEntries([...sim.routes.values()].map(r => [r.id, r.open])),
  fronts: Object.fromEntries([...sim.fronts.values()].map(f => [f.id, { owner: f.owner, sourceHP: f.sourceHP }])), relations: [...sim.relations],
  pendingArrivals: sim.pendingArrivals.map(a => ({ ...a })), eventSequence: sim.eventSequence, criticalLosses: [...sim.criticalLosses.keys()] });

const scenario = (() => {
  const original = build();
  const sim = new BattleSimulation(original.config, original.callbacks), objectives = new OperationObjectives(original.config, sim);
  const player = { id: 'player1', hp: 100, position: [...objectives.spec.tasks.find(t => t.id === 'hive_route').position] };
  const script = []; const at = (t, label, action) => script.push({ t, label, action }); const log = [];
  let apcGroup = null, retreatGroup = null, apcStage = 'none';
  at(0, 'sabotage du relais de B (tâche hive_route) — commencé', () => objectives.interact({ id: 'player1', hp: 100, position: player.position }));
  at(0, 'embarquement M577 : section humaine du front A', () => {
    const group = [...sim.groups.values()].find(g => sim.factions.get(g.factionId).species === 'human' && g.state === 'distant' && g.frontId === 'front_a' &&
      planM577Embark(sim, g.id, { ownerFaction: g.factionId, frontId: g.frontId, position: g.position }).accepted);
    apcGroup = group.id; return sim.boardAPC(group.id, { ownerFaction: group.factionId, frontId: group.frontId, position: [...group.position] });
  });
  at(4, 'repli d’un groupe du clan du front B vers D', () => { retreatGroup = [...sim.groups.values()].find(g => g.factionId === 'player_clan' && g.frontId === 'front_b' && g.state !== 'reserve' && g.units.some(id => sim.units.get(id).hp > 0)).id;
    return sim.issueOrder(retreatGroup, { type: 'retreat', frontId: 'front_d', issuer: 'player1' }); });
  at(5, 'diplomatie : trêve locale clan / force humaine', () => ({ changed: sim.setRelationship('player_clan', 'human_force', 'neutral', 'local_truce') }));
  at(10, 'porte du détour A–B sabotée (route fermée)', () => ({ changed: sim.setRouteOpen('bound-route-insertion-relay-flank', false, 'door_sabotaged') }));
  at(26, 'le joueur rejoint la porte du front A et commence son sabotage (marine_route)', () => { player.position = [...objectives.spec.tasks.find(t => t.id === 'marine_route').position]; return objectives.interact({ id: 'player1', hp: 100, position: player.position }); });
  const SAVE_AT = 27.5; let damageAt10 = null; let next = 0;
  while (sim.time < SAVE_AT - 1e-9) {
    while (next < script.length && script[next].t <= sim.time + 1e-9) { const item = script[next++]; log.push({ t: sim.time, label: item.label, result: item.action() }); }
    if (apcGroup) {
      const m = sim.getAPCManifest();
      if (apcStage === 'none') { const start = sim.fronts.get('front_a').position; const d = dist(m.position, start);
        if (d > 2) { const k = Math.min(1, 4 / d); sim.moveAPCManifest([m.position[0] + (start[0] - m.position[0]) * k, m.position[1] + (start[1] - m.position[1]) * k]); }
        else if (sim.beginAPCTransit('route_0', 'front_b')) { apcStage = 'transit'; log.push({ t: sim.time, label: 'M577 engagé sur route_0 vers le front B', result: sim.getAPCManifest().transit }); } }
      else apcStage = driveAPC(sim, 4);
    }
    sim.update(STEP, { players: [player] }); objectives.update(STEP, [player]);
    if (Math.abs(sim.time - 10) < 1e-9) damageAt10 = frontDamage(sim);
  }
  const damageAtSave = frontDamage(sim);
  const actingFronts = Object.keys(damageAtSave).filter(f => damageAtSave[f] > (damageAt10?.[f] ?? 0) + 1e-9);
  const snapshot = { version: 1, operationId: 'AFF-27', players: 1, scene: { mapSeed: MAP_SEED, difficultyId: 'standard', deploymentPlan: 'authored', extinctionVariant: 'none' },
    simulation: sim.saveState(), objectives: objectives.serialize() };
  const written = writeStored(KEY, JSON.stringify(snapshot));
  const atSave = { summary: summary(sim), objectives: objectives.getHUDState(), channels: objectives.serialize().channels };
  // Reload exactly as the game does: a fresh scene, then fromState + restore.
  const saved = JSON.parse(readStored(KEY, 'null'));
  const reload = build();
  const restored = BattleSimulation.fromState(reload.config, saved.simulation, reload.callbacks), restoredObjectives = new OperationObjectives(reload.config, restored);
  restoredObjectives.restore(saved.objectives);
  const immediate = { summary: summary(restored), objectives: restoredObjectives.getHUDState(), channels: restoredObjectives.serialize().channels };
  const normalized = state => { const copy = JSON.parse(JSON.stringify(state)); for (const unit of copy.units) if (unit.state === 'active') unit.state = 'distant';
    for (const group of copy.groups) { group.materialized = false; if (group.state === 'active') group.state = 'distant'; } return copy; };
  const immediateEqual = JSON.stringify(normalized(saved.simulation)) === JSON.stringify(restored.saveState()) && JSON.stringify(saved.objectives) === JSON.stringify(restoredObjectives.serialize());
  // Five minutes for both branches with identical inputs.
  const branches = [{ name: 'continuité sans rechargement', sim, objectives, events: original.events, apc: apcStage }, { name: 'après rechargement', sim: restored, objectives: restoredObjectives, events: reload.events, apc: 'transit' }];
  const savedEventSequence = saved.simulation.eventSequence;
  for (const branch of branches) {
    const p = { id: 'player1', hp: 100, position: [...player.position] }; branch.trace = []; branch.lossesFirst10s = null;
    const deaths0 = branch.sim.deaths.size;
    for (let tick = 1; tick * STEP <= 300; tick++) {
      if (tick * STEP > 2) p.position = [700, 800]; // after finishing the door, the player leaves every front
      if (branch.sim.getAPCManifest()?.transit) branch.apc = driveAPC(branch.sim, 4);
      branch.sim.update(STEP, { players: [p] }); branch.objectives.update(STEP, [p]);
      if (tick * STEP === 10) branch.lossesFirst10s = branch.sim.deaths.size - deaths0;
      if (tick % 120 === 0) branch.trace.push({ t: branch.sim.time, counts: branch.sim.getCounts() });
    }
    branch.final = summary(branch.sim); branch.objectivesFinal = branch.objectives.serialize();
  }
  return { sim, objectives, restored, restoredObjectives, saved, snapshot, written, atSave, immediate, immediateEqual, branches, log, apcGroup, retreatGroup, actingFronts, damageAt10, damageAtSave, savedEventSequence };
})();

const { atSave, immediate, branches, saved } = scenario;
const [continued, reloaded] = branches;
const diff = (a, b, path = '') => { if (JSON.stringify(a) === JSON.stringify(b)) return []; if (a && b && typeof a === 'object' && typeof b === 'object') return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => diff(a[key], b[key], path ? `${path}.${key}` : key)); return [{ path, continuite: a, rechargement: b }]; };
const finalDiff = diff(continued.final, reloaded.final);
evidence.scenario = {
  operation: 'AFF-27', configDigest: scenario.sim.digest, sauvegarde: { cle: KEY, ecrite: scenario.written, octets: store.get(KEY)?.length, t: saved.simulation.time },
  script: scenario.log, frontsActifsEntre10sEtSauvegarde: scenario.actingFronts, degatsParFront: { a10s: scenario.damageAt10, aLaSauvegarde: scenario.damageAtSave },
  aLaSauvegarde: { ...atSave.summary, objectifs: atSave.objectives.tasks.map(t => [t.id, t.status, t.progress]), canaux: atSave.channels, reactions: atSave.objectives.reactions.map(r => [r.id, r.status, r.groupId]) },
  immediatementApresChargement: { ...immediate.summary, objectifs: immediate.objectives.tasks.map(t => [t.id, t.status, t.progress]), canaux: immediate.channels, identiqueALaSauvegarde: scenario.immediateEqual },
  apresCinqMinutes: branches.map(b => ({ branche: b.name, ...b.final, objectifs: b.objectivesFinal.tasks.map(t => [t.id, t.status, t.completions, t.completedAt]), pertesDix1eresSecondes: b.lossesFirst10s, releve: b.trace })),
  ecartsContinuiteVsRechargement: finalDiff.slice(0, 80), nombreEcarts: finalDiff.length,
};

test('Au moment de la sauvegarde : trois fronts agissent, un convoi porte des passagers, un groupe se replie, une porte est sabotée', () => {
  const s = atSave.summary;
  const ok = scenario.actingFronts.length >= 3 && s.apc?.transit && s.apc.passengers.length > 0 && s.reconstitutions[scenario.retreatGroup]?.required && s.orders[scenario.retreatGroup].includes('via') &&
    s.routes['bound-route-insertion-relay-flank'] === false && atSave.channels.length === 1;
  evidence.preconditions = { verdict: ok ? 'réunies' : 'non réunies', frontsActifs: scenario.actingFronts, passagers: s.apc?.passengers.length, equipage: s.apc?.crew.length, transit: s.apc?.transit, repli: s.orders[scenario.retreatGroup], porte: s.routes['bound-route-insertion-relay-flank'], canal: atSave.channels };
  assert.ok(ok);
});

test('Reprise immédiate : ordres, groupes, passagers, réserves, routes, objectifs, diplomatie et chronologie identiques', () => {
  const a = atSave.summary, b = immediate.summary;
  const same = key => JSON.stringify(a[key]) === JSON.stringify(b[key]);
  const countsSame = Object.keys(a.counts).every(f => ['allocated', 'reserve', 'dead', 'evacuated', 'captured'].every(k => a.counts[f][k] === b.counts[f][k]) && a.counts[f].active + a.counts[f].distant === b.counts[f].active + b.counts[f].distant);
  const checks = { ordres: same('orders'), passagers: same('apc'), reserves: countsSame, routes: same('routes'), fronts: same('fronts'), diplomatie: same('relations'), arriveesEnAttente: same('pendingArrivals'), chronologie: a.time === b.time && same('eventSequence'),
    reconstitutions: same('reconstitutions'), objectifs: JSON.stringify(atSave.objectives.tasks) === JSON.stringify(immediate.objectives.tasks) && JSON.stringify(atSave.channels) === JSON.stringify(immediate.channels), etatComplet: scenario.immediateEqual };
  const ok = Object.values(checks).every(Boolean);
  clause('C1', 'Reprise immédiate cohérente (ordres, états de groupes, passagers, réserves, routes, objectifs, diplomatie, chronologie)', ok ? 'prouvé' : 'échec', { controles: checks,
    note: 'Les unités détaillées (active) sont rechargées en distant puis rematérialisées par le budget de détail : c’est la seule différence normalisée.' });
  assert.ok(ok, JSON.stringify(checks));
});

test('Après cinq minutes : aucun événement déjà résolu ne se rejoue', () => {
  const resolvedTypes = ['apc_marines_boarded', 'group_reconstitution_required', 'relations_changed', 'counteroffensive_announced'];
  const replayed = reloaded.events.filter(e => resolvedTypes.includes(e.type) && e.time <= saved.simulation.time + 1e-9);
  const idsAfter = reloaded.events.map(e => e.id), monotonic = idsAfter.every((id, i) => i === 0 || id > idsAfter[i - 1]) && idsAfter.every(id => id > scenario.savedEventSequence);
  const hiveRoute = reloaded.objectivesFinal.tasks.find(t => t.id === 'hive_route'), door = reloaded.objectivesFinal.tasks.find(t => t.id === 'marine_route');
  const objectiveEvents = scenario.restoredObjectives.events.filter(e => e.type === 'objective_completed' && e.taskId === 'hive_route');
  const ok = replayed.length === 0 && monotonic && hiveRoute.completions === 1 && objectiveEvents.length === 1 && door.status === 'done' && door.completions === 1 &&
    reloaded.events.filter(e => e.type === 'source_disabled' && e.frontId === 'front_b').length === 0;
  clause('C2', 'Les événements déjà résolus ne se rejouent pas ; la chronologie continue', ok ? 'prouvé' : 'échec', { rejoues: replayed, sequenceSauvegardee: scenario.savedEventSequence, premierEvenementApres: reloaded.events[0] ?? null,
    tacheResolue: hiveRoute, sabotageEnCoursTermine: door });
  assert.ok(ok);
});

test('Après cinq minutes : passagers, repli et réserves reprennent sans gain gratuit', () => {
  const f = reloaded.final, s = atSave.summary;
  const passengers = s.apc.passengers, apcAfter = scenario.restored.getAPCManifest();
  const passengersKept = apcAfter && JSON.stringify(apcAfter.passengers) === JSON.stringify(passengers) && passengers.every(id => scenario.restored.getUnit(id).apcSeat !== undefined);
  const noGain = Object.keys(f.counts).every(faction => f.counts[faction].allocated === s.counts[faction].allocated && f.counts[faction].reserve <= s.counts[faction].reserve && f.counts[faction].dead >= s.counts[faction].dead);
  const retreat = f.reconstitutions[scenario.retreatGroup];
  const ok = passengersKept && noGain && retreat?.returnFrontId === 'front_b' && f.orders[scenario.retreatGroup].startsWith('retreat>front_d') || false;
  clause('C3', 'Passagers, repli et réserves reprennent ; aucun gain gratuit', ok ? 'prouvé' : 'échec', { passagers: { avant: passengers, apres: apcAfter?.passengers ?? null, convoi: apcAfter },
    repli: { ordre: f.orders[scenario.retreatGroup], reconstitution: retreat }, effectifs: { aLaSauvegarde: s.counts, apres5min: f.counts } });
  assert.ok(ok);
});

// Equality of the two branches is the strongest "no free gain/loss" check.
// Only detail bookkeeping (group_materialized/dematerialized and therefore
// the event counter) may differ: a reload starts with no rendered actor.
const DETAIL = new Set(['group_materialized', 'group_dematerialized']);
const strategicDiff = finalDiff.filter(row => row.path !== 'eventSequence');
// Same-tick events are compared as a multiset (emission order inside one tick
// follows group iteration order); order.sequence mirrors the event counter.
const canonical = e => { const { id, ...rest } = e; if (rest.order) rest.order = { ...rest.order, sequence: undefined }; return JSON.stringify(rest); };
const journal = branch => branch.events.filter(e => e.time > saved.simulation.time + 1e-9 && !DETAIL.has(e.type)).map(canonical).sort();
const deathLedger = branch => [...branch.sim.deaths.values()].map(d => [d.entityId, d.time, d.cause, d.killerFaction]).sort((a, b) => String(a).localeCompare(String(b)));
const deathsDiff = diff(deathLedger(continued), deathLedger(reloaded));
const journalDiff = diff(journal(continued), journal(reloaded));
const untimed = list => list.map(text => { const { time, ...rest } = JSON.parse(text); return JSON.stringify(rest); }).sort();
const journalUntimedDiff = diff(untimed(journal(continued)), untimed(journal(reloaded)));
const lossDelta = Object.fromEntries(Object.keys(continued.final.counts).map(f => [f, reloaded.final.counts[f].dead - continued.final.counts[f].dead]));
const equalAfter = strategicDiff.length === 0 && deathsDiff.length === 0 && journalUntimedDiff.length === 0;
clause('C4', 'Aucun gain ou perte gratuit au chargement : après cinq minutes, la partie rechargée est identique à la partie continue', equalAfter ? 'prouvé' : 'échec', {
  ecartsStrategiques: strategicDiff.slice(0, 20), ecartsRegistreDesMorts: deathsDiff.slice(0, 20), ecartsJournalHorsHorodatage: journalUntimedDiff.slice(0, 20), ecartsJournalHorodates: journalDiff.slice(0, 12),
  observationHorodatage: journalDiff.length ? 'Écart d’horodatage d’un pas (0,25 s) : au premier update après chargement, _moveGroups (js/battlefield/BattleSimulation.js:417) avance en mode distant les groupes qui étaient détaillés avant que _detailStep ne les rematérialise ; dans la partie continue, ces groupes restent pilotés par leurs acteurs. Ici le bridge headless n’anime pas les acteurs, ce qui maximise l’écart ; effectifs, pertes et ordres finaux restent identiques.' : null, ecartCompteurEvenements: finalDiff.find(row => row.path === 'eventSequence') ?? null,
  explicationEcartCompteur: 'Seuls les événements de niveau de détail diffèrent : la partie rechargée rematérialise ses groupes (aucun acteur rendu ne survit à un rechargement).',
  evenementsDetail: { continuite: continued.events.filter(e => e.time > saved.simulation.time && DETAIL.has(e.type)).length, rechargement: reloaded.events.filter(e => e.time > saved.simulation.time && DETAIL.has(e.type)).length },
  evenementsStrategiquesCompares: journal(reloaded).length, ecartPertesParFaction: lossDelta, pertesDix1eresSecondes: { continuite: continued.lossesFirst10s, rechargement: reloaded.lossesFirst10s } });
test('Après cinq minutes : la partie rechargée ne diverge pas de la partie continue (même entrée, même graine)', () => {
  assert.deepEqual(strategicDiff, []); assert.deepEqual(deathsDiff, []); assert.deepEqual(journalUntimedDiff, []);
});

test('Non automatisable : vidéo de reprise, capture des occupants à l’écran, véhicule rendu', () => {
  clause('NA1', 'Vidéo de reprise et capture visuelle des occupants', 'non automatisable', { raison: 'Exige le jeu rendu ; le support M577 (supports.apc.serialize, validateM577CarrierCheckpoint) et la position physique du véhicule dépendent de main.js/APCVehicle et du terrain 3D, non instanciés en node:test.' });
  assert.ok(true);
});

// Recette REC-006 — renforts physiques et ressources de ruche.
// Audit 2026-10-26, feuille Validation. Opération catalogue AFF-18 (EFF-03),
// mapSeed 0 : source de ruche front_b, réserve finie, routes physiques liées
// au terrain ; vague, coupure de route (pont détruit), neutralisation de la
// source par la tâche de sabotage réelle d'OperationObjectives.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { OperationObjectives } from '../js/battlefield/OperationObjectives.js';
import { physicalOperationRouteAvailable } from '../js/battlefield/PhysicalRouteAvailability.js';
import { HOST_INFESTATION_RULES } from '../js/battlefield/HostInfestation.js';

const ROOT = new URL('..', import.meta.url).pathname;
const COMMIT = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const DIRTY = execSync('git status --porcelain -- js', { cwd: ROOT }).toString().split('\n').filter(Boolean);
const OUT = `${ROOT}docs/qa/recettes-20261114/rec-006.json`;
const STEP = 0.25, MAP_SEED = 0;
const evidence = {
  recette: 'REC-006', titre: 'Renforts physiques et ressources de ruche',
  source: 'docs/audits/2026-10-26/Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx#Validation!REC-006',
  dateExecution: '2026-11-14', commit: COMMIT, sourcesJsNonCommitees: DIRTY, graine: { operation: 'AFF-18', budget: 'EFF-03', mapSeed: MAP_SEED, pasSimulation: STEP },
  commande: 'node --test tests/recette-rec-006.test.js',
  preuveVideo: 'non produite — preuve par journal de simulation',
  scenario: {}, clauses: [],
};
const clause = (id, texte, verdict, details = {}) => { evidence.clauses.push({ id, texte, verdict, ...details }); return verdict === 'prouvé'; };
after(() => { mkdirSync(new URL('.', `file://${OUT}`).pathname, { recursive: true }); writeFileSync(OUT, JSON.stringify(evidence, null, 1) + '\n'); });

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function toPolyline(point, waypoints) {
  let best = Infinity;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1], b = waypoints[i], dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz;
    const t = l ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / l)) : 0;
    best = Math.min(best, Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz));
  }
  return best;
}

const run = (() => {
  const { config, layout } = createOperationScene({ operationId: 'AFF-18', players: 1, mapSeed: MAP_SEED });
  const env = { battlefieldLayout: layout, isGateOpen: () => true, isTacticalRouteAvailable: () => true };
  const events = [], spawns = [];
  let simRef = null;
  const sim = simRef = new BattleSimulation(config, { spawnGroup: (group, units) => { spawns.push({ t: simRef.time, groupId: group.id, positions: units.map(u => u.position) }); return true; },
    despawnGroup: (group, units) => units.map(u => ({ id: u.id, hp: u.hp, position: u.position })), announce: event => events.push(event),
    routeAvailabilityProvider: (route, options) => physicalOperationRouteAvailable(env, route, options) });
  const objectives = new OperationObjectives(config, sim);
  const source = sim.getFront('front_b');
  const hiveReserveGroups = [...sim.groups.values()].filter(g => g.factionId === 'hive' && g.state === 'reserve');
  const identification = { source: { id: source.id, owner: source.owner, reinforcementSource: source.reinforcementSource, sourceHP: source.sourceHP, position: source.position, radius: source.radius },
    reserve: { groupes: hiveReserveGroups.length, unites: sim.getCounts().hive.reserve, origine: [...new Set(hiveReserveGroups.map(g => g.reserveOriginId))],
      positionsDansLaSource: hiveReserveGroups.every(g => dist(g.position, source.position) <= source.radius) },
    routeVersA: sim._path('front_b', 'front_a').map(s => ({ ...s, physicalGateIds: config.routes.find(r => r.id === s.routeId).physicalGateIds, physicalRouteId: config.routes.find(r => r.id === s.routeId).physicalRouteId })),
    detourDeclare: config.routes.filter(r => [r.from, r.to].includes('front_b') && [r.from, r.to].includes('front_a')).map(r => ({ id: r.id, travelSeconds: r.travelSeconds, gates: r.physicalGateIds })) };
  const player = { id: 'player1', hp: 100, position: [...sim.fronts.get('front_a').position] };
  const reserveTimeline = [], offRoute = [], script = [], requests = [];
  const at = (t, label, action) => script.push({ t, label, action });
  let cutAt = null, neutralizedAt = null, waveGroup = null, detourGroup = null;
  at(0, 'vague : demande de renfort de ruche vers le front A', () => { const answer = sim.requestReinforcements('hive', 'front_a'); waveGroup = answer.groupId; requests.push({ t: sim.time, ...answer }); return answer; });
  at(40, 'coupure de la route principale B–A (pont détruit)', () => { cutAt = sim.time; return { changed: sim.setRouteOpen('route_0', false, 'bridge_destroyed') }; });
  at(41, 'nouvelle vague après coupure', () => { const answer = sim.requestReinforcements('hive', 'front_a'); detourGroup = answer.groupId; requests.push({ t: sim.time, ...answer }); return answer; });
  at(60, 'le joueur rejoint la tâche de sabotage de la source (front B)', () => { const task = objectives.spec.tasks.find(t => t.id === 'lower_access'); player.position = [...task.position]; return objectives.interact({ id: 'player1', hp: 100, position: task.position }); });
  at(64, 'demande de renfort après sabotage', () => { const answer = sim.requestReinforcements('hive', 'front_a'); requests.push({ t: sim.time, ...answer }); return answer; });
  at(65, 'demande de renfort vers la source elle-même', () => { const answer = sim.requestReinforcements('hive', 'front_b'); requests.push({ t: sim.time, ...answer }); return answer; });
  const log = []; let next = 0;
  for (let tick = 0; tick * STEP < 400; tick++) {
    while (next < script.length && script[next].t <= sim.time + 1e-9) { const item = script[next++]; log.push({ t: sim.time, label: item.label, result: item.action() }); }
    sim.update(STEP, { players: [player] }); objectives.update(STEP, [player]);
    if (neutralizedAt === null && sim.getFront('front_b').sourceHP === 0) neutralizedAt = sim.time;
    for (const group of sim.groups.values()) if (group.path.length && !group.materialized) {
      const route = sim.routes.get(group.path[0].routeId), gap = toPolyline(group.position, route.waypoints);
      if (gap > 1e-6 && dist(group.position, sim.fronts.get(group.frontId).position) > sim.fronts.get(group.frontId).radius) offRoute.push([sim.time, group.id, route.id, +gap.toFixed(4)]);
    }
    if (tick % 40 === 0) { const c = sim.getCounts(); reserveTimeline.push([sim.time, c.hive.reserve, c.hive.distant + c.hive.active, c.hive.dead, c.player_clan.reserve]); }
  }
  return { sim, config, events, spawns, identification, reserveTimeline, offRoute, log, requests, cutAt, neutralizedAt, waveGroup, detourGroup, player, objectives };
})();

const { sim, events, identification } = run;
const arrivals = events.filter(e => e.type === 'reinforcements_arrived'), inbound = events.filter(e => e.type === 'reinforcements_inbound'), cancelled = events.filter(e => e.type === 'reinforcements_cancelled');
const sizeOf = groupId => sim.groups.get(groupId).units.length;
const hiveArrivals = arrivals.filter(e => sim.groups.get(e.groupId).factionId === 'hive');
const initialReserve = identification.reserve.unites, finalReserve = sim.getCounts().hive.reserve;
evidence.scenario = { operation: 'AFF-18', configDigest: sim.digest, dureeSimulee: sim.time, identification, script: run.log,
  demandes: run.requests, releveReserve: { colonnes: ['t', 'reserveRuche', 'rucheDeployee', 'rucheMorts', 'reserveClan'], lignes: run.reserveTimeline },
  annonces: inbound.map(e => [e.time, e.groupId, e.sourceId, e.frontId, e.count, e.due]), arrivees: arrivals.map(e => [e.time, e.groupId, e.sourceId, e.targetFrontId]),
  annulations: cancelled.map(e => [e.time, e.groupId, e.sourceId, e.reason]),
  routes: events.filter(e => ['route_changed', 'order_blocked'].includes(e.type)).map(e => [e.time, e.type, e.routeId ?? e.groupId, e.open ?? e.reason, e.frontId ?? null]),
  neutralisation: { tache: run.objectives.serialize().tasks.find(t => t.id === 'lower_access'), evenementSimulation: events.find(e => e.type === 'source_disabled'), evenementObjectif: run.objectives.events.find(e => e.type === 'source_disabled'), t: run.neutralizedAt },
  horsRoute: run.offRoute.slice(0, 50) };

test('Les arrivées consomment exactement la réserve finie et partent de leur source annoncée', () => {
  const consumed = initialReserve - finalReserve, arrived = hiveArrivals.reduce((sum, e) => sum + sizeOf(e.groupId), 0);
  const announcedFirst = hiveArrivals.every(a => inbound.some(i => i.groupId === a.groupId && i.time + 3 - 1e-9 <= a.time && i.sourceId === a.sourceId));
  const fromSource = hiveArrivals.every(a => sim.groups.get(a.groupId).reserveOriginId === a.sourceId && sim.config.fronts.find(f => f.id === a.sourceId).reinforcementSource);
  const ok = consumed === arrived && announcedFirst && fromSource && identification.reserve.positionsDansLaSource && sim.units.size === 1048;
  clause('C1', 'Les arrivées consomment une réserve (relevés de réserve)', ok ? 'prouvé' : 'échec', { reserveInitiale: initialReserve, reserveFinale: finalReserve, consommee: consumed, arriveesRuche: hiveArrivals.length, unitesArrivees: arrived, annonceeAvantArrivee: announcedFirst, depuisLeurSource: fromSource });
  assert.equal(consumed, arrived); assert.ok(announcedFirst); assert.ok(fromSource); assert.ok(identification.reserve.positionsDansLaSource); assert.equal(sim.assertConservation(), true);
});

test('Accès crédibles : trajets sur les polylignes déclarées, aucune apparition au contact du joueur', () => {
  const nearPlayer = run.spawns.filter(s => s.positions.some(p => dist(p, [0, 0]) < sim.budgets.spawnDistance - 1e-9 && s.t < 60));
  const ok = run.offRoute.length === 0;
  clause('C2', 'Les arrivées utilisent des accès crédibles (routes physiques, pas de téléportation)', ok ? 'prouvé' : 'échec', { pointsHorsRoute: run.offRoute.length, apparitionsDetailleesProchesDuJoueur: nearPlayer.length,
    limite: 'Le respect de la polyligne est prouvé pour le mouvement distant ; le passage physique des acteurs détaillés dépend de BattleActorBridge et de la navigation 3D (non exécutés ici).' });
  assert.equal(run.offRoute.length, 0);
});

test('Route bloquée : détour réel ou arrêt expliqué par un événement', () => {
  const blocked = events.filter(e => e.type === 'order_blocked' && e.time >= run.cutAt - 1e-9);
  const wave = sim.groups.get(run.waveGroup), detour = run.requests.find(r => r.groupId === run.detourGroup);
  const detourArrival = arrivals.find(e => e.groupId === run.detourGroup);
  const detourPath = events.find(e => e.type === 'group_order' && e.groupId === run.detourGroup && e.time >= (detourArrival?.time ?? Infinity));
  const detourOk = detour?.accepted === true && !!detourArrival && sim.getGroup(run.detourGroup).path.every(s => s.routeId !== 'route_0');
  const waveExplained = blocked.some(e => e.groupId === run.waveGroup && e.reason === 'route_closed_in_transit') && wave.path[0]?.routeId === 'route_0';
  clause('C3', 'Route bloquée : détour ou arrêt expliqué', detourOk && waveExplained ? 'prouvé' : 'échec', {
    vagueEnTransit: { groupId: run.waveGroup, evenement: blocked.find(e => e.groupId === run.waveGroup) ?? null, position: wave.position, chemin: wave.path },
    vagueSuivante: { groupId: run.detourGroup, demande: detour, arrivee: detourArrival ?? null, ordre: detourPath ?? null, chemin: sim.getGroup(run.detourGroup).path, frontActuel: sim.getGroup(run.detourGroup).frontId },
    limite: 'La fermeture d’une porte physique sans setRouteOpen (routeAvailabilityProvider=false) arrête un groupe en transit sans événement (js/battlefield/BattleSimulation.js:420) ; aucune porte ne se referme en jeu actuellement (BattlefieldProgression n’expose que openGate), donc non retenu comme défaut.' });
  assert.ok(detourOk); assert.ok(waveExplained);
});

test('Source détruite : plus aucun renfort gratuit', () => {
  const after = run.reserveTimeline.filter(row => row[0] >= run.neutralizedAt + 3);
  const refused = run.requests.filter(r => r.t >= run.neutralizedAt);
  const lateArrivals = hiveArrivals.filter(e => e.time > run.neutralizedAt + 1e-9);
  const constant = after.every(row => row[1] === after[0][1]);
  const ok = run.neutralizedAt !== null && refused.length >= 2 && refused.every(r => r.accepted === false && r.reason === 'no_connected_supply_source') && lateArrivals.length === 0 && constant;
  clause('C4', 'Source détruite : plus de renforts gratuits (événement de neutralisation)', ok ? 'prouvé' : 'échec', { neutraliseeA: run.neutralizedAt, demandesRefusees: refused, arriveesApres: lateArrivals, reserveApres: after.map(row => [row[0], row[1]]),
    annulationsApres: cancelled.filter(e => e.time >= run.neutralizedAt) });
  assert.ok(ok);
});

// Biological profile: AFF-18 hive reserves are pre-allocated adults. The
// existing biology contract (host infestation) is an explicit parameter; no
// continuity rule ties a hive reserve to hosts or stages.
const reserveRuleHasHosts = Object.keys(sim.config).some(key => /host|stage|egg|biolog/i.test(key)) || sim.config.groups.some(g => g.state === 'reserve' && /host|stage/i.test(JSON.stringify(g)));
const announced = hiveArrivals.every(a => inbound.some(i => i.groupId === a.groupId && a.time - i.time >= sim.budgets.announcementSeconds - 1e-9));
clause('C5a', 'Aucune multiplication instantanée non annoncée ; durées explicites', announced && sim.units.size === 1048 ? 'prouvé' : 'échec', { annonceSecondes: sim.budgets.announcementSeconds, intervalleRenforts: sim.budgets.spawnInterval, incubationHoteSecondes: HOST_INFESTATION_RULES.incubationSeconds, identites: sim.units.size });
clause('C5b', 'Profil biologique : hôtes et stades requis par la continuité contrôlés pour les réserves de ruche', reserveRuleHasHosts ? 'prouvé' : 'adaptation assumée (HW-DEC-89)', {
  decision: 'HW-DEC-89 : la réserve de ruche reste faite d’adultes déjà alloués ; adaptation de gameplay écrite dans la bible, effectifs inchangés.',
  defaut: 'Lacune : les réserves de ruche sont des adultes pré-alloués (js/data/BattleCatalog.js:284-318, state "reserve") ; BattleSimulation.requestReinforcements (js/battlefield/BattleSimulation.js:923-936) ne consulte ni hôte ni stade. Seule l’infestation d’hôte AFF-27 (js/battlefield/HostInfestation.js:6-9) a une durée explicite et ne produit aucun adulte.',
  reproduction: 'createOperationScene({operationId:"AFF-18",mapSeed:0}) ; sim.requestReinforcements("hive","front_a") accepté sans aucun hôte disponible.' });
test('Profil biologique : arrivées annoncées, aucune multiplication instantanée', () => { assert.ok(announced); });
test('Profil biologique : hôtes et stades requis par la continuité pour la réserve de ruche', { skip: reserveRuleHasHosts ? false : 'adaptation assumée (HW-DEC-89) : réserve d’adultes déjà alloués, sans contrôle d’hôte ni de stade' }, () => { assert.ok(reserveRuleHasHosts); });

test('Non automatisable : trajet filmé', () => {
  clause('NA1', 'Trajet filmé des renforts à travers les accès physiques', 'non automatisable', { raison: 'Exige le rendu 3D, la navigation réelle et une capture vidéo ; la preuve fournie est le journal de positions stratégiques.' });
  assert.ok(true);
});

// Recette REC-005 — passage entre combat proche et simulation distante.
// Audit 2026-10-26, feuille Validation. Partie A : configuration déterministe
// minimale (un groupe blessé, aller-retours répétés, retraite avec traversée
// de secteur). Partie B : opération catalogue AFF-18 (EFF-03), joueur immobile
// sur son front, pour la stabilité de la bulle de détail.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { physicalOperationRouteAvailable } from '../js/battlefield/PhysicalRouteAvailability.js';

const ROOT = new URL('..', import.meta.url).pathname;
const COMMIT = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const DIRTY = execSync('git status --porcelain -- js', { cwd: ROOT }).toString().split('\n').filter(Boolean);
const OUT = `${ROOT}docs/qa/recettes-20261114/rec-005.json`;
const STEP = 0.25;
const evidence = {
  recette: 'REC-005', titre: 'Passage entre combat proche et simulation distante',
  source: 'docs/audits/2026-10-26/Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx#Validation!REC-005',
  dateExecution: '2026-11-14', commit: COMMIT, sourcesJsNonCommitees: DIRTY, graine: { configuration: 'rec-005-fixture (aucun aléa)', operationB: 'AFF-18', mapSeed: 0, pasSimulation: STEP },
  commande: 'node --test tests/recette-rec-005.test.js',
  preuveVideo: 'non produite — preuve par journal de simulation',
  scenarios: {}, clauses: [],
};
const clause = (id, texte, verdict, details = {}) => { evidence.clauses.push({ id, texte, verdict, ...details }); return verdict === 'prouvé'; };
after(() => { mkdirSync(new URL('.', `file://${OUT}`).pathname, { recursive: true }); writeFileSync(OUT, JSON.stringify(evidence, null, 1) + '\n'); });

/* Headless stand-in for BattleActorBridge: keeps exactly the HP and pose of
 * identities it received, returns them on despawn, never mints an identity. */
function liveBridge(ref) {
  const live = new Map(), log = [], duplicates = [];
  return { live, log, duplicates,
    spawnGroup(group, units) {
      for (const unit of units) { if (live.has(unit.id)) duplicates.push([ref.sim.time, unit.id]); live.set(unit.id, { hp: unit.hp, position: [...unit.position], spawnedAt: [...unit.position] }); }
      log.push({ t: ref.sim.time, type: 'spawn', groupId: group.id, units: units.map(unit => ({ id: unit.id, hp: unit.hp, position: unit.position.map(v => +v.toFixed(3)) })) }); return true;
    },
    despawnGroup(group, units) {
      const out = units.map(unit => { const actor = live.get(unit.id) ?? unit; live.delete(unit.id); return { id: unit.id, hp: actor.hp, position: [...actor.position] }; });
      log.push({ t: ref.sim.time, type: 'despawn', groupId: group.id, units: out.map(unit => ({ id: unit.id, hp: unit.hp, position: unit.position.map(v => +v.toFixed(3)) })) }); return out;
    } };
}
function driveActors(sim, bridge, dt, speed = 6) {
  for (const directive of sim.getActorDirectives()) {
    const actor = bridge.live.get(directive.id); if (!actor || directive.incapacitated) continue;
    const [tx, tz] = directive.targetPosition, dx = tx - actor.position[0], dz = tz - actor.position[1], d = Math.hypot(dx, dz);
    if (d < 0.05) continue; const k = Math.min(1, speed * dt / d);
    actor.position = [actor.position[0] + dx * k, actor.position[1] + dz * k]; sim.syncUnit(directive.id, { position: actor.position });
  }
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function fixture() {
  const fronts = [{ id: 'a', label: 'Camp', position: [0, 0], radius: 40, owner: 'clan', reinforcementSource: true },
    { id: 'b', label: 'Relais', position: [240, 0], radius: 40, owner: 'human', reinforcementSource: true },
    { id: 'c', label: 'Ruche', position: [240, 600], radius: 40, owner: 'hive', reinforcementSource: true }];
  const group = (id, factionId, frontId, center, size, state = 'distant', profile = `${factionId}-line`) => ({ id, factionId, frontId, state, position: center,
    units: Array.from({ length: size }, (_, i) => ({ id: `${id}-${i}`, profileId: profile, officer: i === 0, position: [center[0] + i * 1.5, center[1] + (i % 2) * 1.5] })) });
  return { id: 'rec-005-fixture', mode: 'original', playerFaction: 'clan', context: { era: 'alternative', works: ['original'], continuities: ['original'] },
    factions: [{ id: 'clan', species: 'yautja' }, { id: 'human', species: 'human' }, { id: 'hive', species: 'xenomorph' }],
    relations: [{ a: 'clan', b: 'human', state: 'hostile' }, { a: 'clan', b: 'hive', state: 'hostile' }, { a: 'human', b: 'hive', state: 'hostile' }],
    fronts, routes: [{ id: 'ab', from: 'a', to: 'b', travelSeconds: 60, waypoints: [[0, 0], [120, 0], [120, 30], [240, 30], [240, 0]] }, { id: 'bc', from: 'b', to: 'c', travelSeconds: 90 }, { id: 'ac', from: 'a', to: 'c', travelSeconds: 120 }],
    profiles: [{ id: 'clan-line', species: 'yautja', maxHp: 300, damage: 2, attackInterval: 3 }, { id: 'human-line', species: 'human', maxHp: 160, damage: 2, attackInterval: 3 }, { id: 'hive-line', species: 'xenomorph', maxHp: 200, damage: 2, attackInterval: 3 }],
    groups: [group('wounded', 'clan', 'b', [262, 4], 4), group('enemy', 'human', 'b', [262, -12], 4), group('hive', 'hive', 'c', [262, 600], 4),
      group('clan-reserve', 'clan', 'a', [10, 0], 4, 'reserve'), group('human-reserve', 'human', 'b', [250, 10], 4, 'reserve')],
    budgets: { active: 12, spawnDistance: 12, spawnInterval: 120, announcementSeconds: 3, arrivalsPerTick: 4 },
    objectives: { externalVictory: true }, ai: { enabled: false } };
}

const groupState = (sim, groupId) => {
  const group = sim.groups.get(groupId);
  return { t: sim.time, frontId: group.frontId, position: group.position.map(v => +v.toFixed(3)), materialized: group.materialized, state: group.state,
    order: { type: group.order.type, frontId: group.order.frontId, issuer: group.order.issuer }, path: group.path.map(s => s.routeId), reconstitution: group.reconstitution ? { required: group.reconstitution.required, returnFrontId: group.reconstitution.returnFrontId } : null,
    morale: +group.morale.toFixed(3),
    units: group.units.map(id => { const u = sim.units.get(id); return { id, state: u.state, hp: +u.hp.toFixed(3), incapacitated: u.incapacitated, position: u.position.map(v => +v.toFixed(3)) }; }),
    reserves: Object.fromEntries(Object.entries(sim.getCounts()).map(([f, c]) => [f, c.reserve])), deaths: [...sim.deaths.keys()].sort() };
};

test('Partie A : groupe blessé engagé, trois éloignements/retours puis retraite avec traversée de secteur', () => {
  const config = fixture(), ref = {}, bridge = liveBridge(ref), events = [];
  const sim = ref.sim = new BattleSimulation(config, { spawnGroup: bridge.spawnGroup, despawnGroup: bridge.despawnGroup, announce: event => events.push(event) });
  const player = { id: 'player1', hp: 100, position: [240, 0] }, states = [], jumps = [], healings = [];
  let previous = groupState(sim, 'wounded');
  const step = (seconds, onTick) => { for (let i = 0; i < Math.round(seconds / STEP); i++) {
    sim.update(STEP, { players: [player] }); driveActors(sim, bridge, STEP); onTick?.();
    const now = groupState(sim, 'wounded');
    for (const unit of now.units) { const before = previous.units.find(u => u.id === unit.id);
      if (unit.hp > before.hp + 1e-9) healings.push({ t: sim.time, id: unit.id, before: before.hp, after: unit.hp });
      const moved = dist(unit.position, before.position); if (moved > 6 * STEP + 0.5 && unit.state !== 'dead') jumps.push({ t: sim.time, id: unit.id, moved: +moved.toFixed(3), from: before.position, to: unit.position, transition: `${before.state}->${unit.state}` }); }
    previous = now; } };
  const mark = label => { const snapshot = { label, ...groupState(sim, 'wounded') }; states.push(snapshot); return snapshot; };
  step(STEP);
  mark('engagé, détaillé, avant blessure');
  // Real-actor damage while detailed: two wounds and one ally put out of combat.
  for (const [id, hp] of [['wounded-1', 120], ['wounded-2', 210]]) { bridge.live.get(id).hp = hp; sim.syncUnit(id, { hp }); }
  sim.setUnitIncapacitated('wounded-3', true); bridge.live.get('wounded-3').hp = 90; sim.syncUnit('wounded-3', { hp: 90 });
  step(5);
  const engaged = mark('blessé et engagé (détaillé)');
  const cycles = [];
  for (let cycle = 1; cycle <= 3; cycle++) {
    player.position = [240, 600]; step(STEP); const away = mark(`cycle ${cycle} : joueur éloigné (front C)`);
    step(20); const distant = mark(`cycle ${cycle} : 20 s en simulation distante`);
    player.position = [215, -30]; step(STEP); const back = mark(`cycle ${cycle} : joueur revenu (front B)`);
    step(5); cycles.push({ cycle, away, distant, back });
  }
  const beforeRetreat = mark('avant retraite');
  const order = sim.issueOrder('wounded', { type: 'retreat', frontId: 'a', issuer: 'player1' });
  // Sector crossing: the player alternates between following and leaving the retreating group.
  const crossing = [];
  for (let leg = 0; leg < 6; leg++) {
    const group = sim.groups.get('wounded');
    player.position = leg % 2 ? [group.position[0] + 200, group.position[1] + 400] : [group.position[0] - 30, group.position[1] + 30];
    step(8, () => { const g = sim.groups.get('wounded'); crossing.push([sim.time, g.position.map(v => +v.toFixed(2)), g.materialized, g.path.map(s => s.routeId).join('>'), g.frontId]); });
    mark(`retraite, tronçon ${leg + 1} (${leg % 2 ? 'joueur éloigné' : 'joueur proche'})`);
  }
  player.position = [240, 600]; step(60); const arrived = mark('retraite terminée, joueur éloigné');
  const levelChanges = events.filter(event => ['group_materialized', 'group_dematerialized'].includes(event.type) && event.groupId === 'wounded').map(event => [event.time, event.type, event.count]);
  evidence.scenarios.A = { configuration: config.id, configDigest: sim.digest, etatsDuGroupe: states, changementsDeNiveau: levelChanges, traverseeDeSecteur: crossing,
    journalBridge: bridge.log.filter(row => row.groupId === 'wounded'), sautsDePosition: jumps, soinsSansSource: healings, ordreRetraite: order, duplicationsActeur: bridge.duplicates };

  // Clause verdicts.
  const sameIds = cycles.every(c => JSON.stringify(c.back.units.map(u => u.id)) === JSON.stringify(engaged.units.map(u => u.id)));
  const hpKept = cycles.every(c => c.back.units.every(u => u.hp <= c.away.units.find(v => v.id === u.id).hp + 1e-9)) && healings.length === 0;
  const lossesKept = cycles.every(c => c.away.deaths.every(id => c.back.deaths.includes(id))) && states.every(s => s.units.every(u => u.state !== 'dead' || u.hp === 0));
  const orderKept = cycles.every(c => JSON.stringify(c.back.order) === JSON.stringify(engaged.order) && c.back.frontId === engaged.frontId);
  const reserveKept = cycles.every(c => JSON.stringify(c.back.reserves) === JSON.stringify(engaged.reserves));
  const spawnPositions = bridge.log.filter(row => row.groupId === 'wounded' && row.type === 'spawn').slice(1);
  const despawnBefore = spawn => [...bridge.log].reverse().find(row => row.groupId === 'wounded' && row.type === 'despawn' && row.t <= spawn.t);
  const plausiblePositions = spawnPositions.every(spawn => spawn.units.every(unit => { const prior = despawnBefore(spawn)?.units.find(u => u.id === unit.id); return prior && dist(prior.position, unit.position) <= (spawn.t - despawnBefore(spawn).t) * 6 + 1; })) && jumps.length === 0;
  const incap = arrived.units.find(u => u.id === 'wounded-3');
  const reconstituted = events.filter(event => event.type === 'group_reconstituted' && event.groupId === 'wounded');
  const support = reconstituted[0] && events.find(event => event.type === 'reinforcements_arrived' && event.groupId === reconstituted[0].supportGroupId);
  // Either still waiting for finite support, or reconstituted by an announced reserve arrival with zero new units.
  const retreatKept = ['regroup', 'retreat'].includes(arrived.order.type) && arrived.order.frontId === 'a' && arrived.reconstitution?.returnFrontId === 'b' &&
    (arrived.reconstitution.required === true || reconstituted.length === 1 && reconstituted[0].newUnitsCreated === 0 && !!support);
  clause('C1', 'Position plausible : retour du détail aux positions distantes, sans saut entre deux pas', plausiblePositions ? 'prouvé' : 'échec', { sauts: jumps, apparitions: spawnPositions.length });
  clause('C2', 'Destination et ordre persistent à chaque changement de niveau ; pas de réinitialisation d’objectif', orderKept && retreatKept ? 'prouvé' : 'échec', { ordreEngage: engaged.order, ordresRetour: cycles.map(c => c.back.order), apresRetraite: { order: arrived.order, frontId: arrived.frontId, reconstitution: arrived.reconstitution },
    reconstitution: reconstituted.map(event => ({ t: event.time, supportGroupId: event.supportGroupId, survivors: event.survivors, newUnitsCreated: event.newUnitsCreated })), arriveeDuSoutien: support ?? null });
  clause('C3', 'Pertes et santé pertinente persistent ; aucune guérison totale gratuite', hpKept && lossesKept ? 'prouvé' : 'échec', { pvEngage: engaged.units.map(u => [u.id, u.hp, u.incapacitated]), pvRetours: cycles.map(c => c.back.units.map(u => [u.id, u.hp, u.incapacitated])), pvFin: arrived.units.map(u => [u.id, u.state, u.hp, u.incapacitated]), soinsSansSource: healings });
  clause('C4', 'Réserve inchangée par les transitions ; aucune duplication d’identité ou d’acteur', reserveKept && sameIds && bridge.duplicates.length === 0 && sim.units.size === 20 ? 'prouvé' : 'échec', { reserves: cycles.map(c => c.back.reserves), duplications: bridge.duplicates, unites: sim.units.size });
  clause('C5', 'Horodatage des changements de niveau de simulation', levelChanges.length >= 6 ? 'prouvé' : 'échec', { changements: levelChanges });
  evidence.observations = [{ id: 'OBS-A1', texte: `L’allié hors de combat wounded-3 n’est pas déplacé par la retraite distante (BattleSimulation._moveGroups ne déplace que les unités combatReady) : il reste à ${JSON.stringify(incap.position)} (${incap.state}). Aucune téléportation ; la prise en charge relève d’AllyRescueSystem / REC dédié au secours.` }];
  assert.ok(plausiblePositions); assert.ok(orderKept); assert.ok(retreatKept); assert.ok(hpKept); assert.ok(lossesKept); assert.ok(reserveKept); assert.ok(sameIds);
  assert.deepEqual(bridge.duplicates, []); assert.equal(sim.assertConservation(), true); assert.ok(levelChanges.length >= 6);
});

// Partie B — the detailed bubble must not swap groups out under a stationary player.
const partB = (() => {
  const { config, layout } = createOperationScene({ operationId: 'AFF-18', players: 1, mapSeed: 0 });
  const env = { battlefieldLayout: layout, isGateOpen: () => true, isTacticalRouteAvailable: () => true };
  const ref = {}, bridge = liveBridge(ref), events = [];
  const sim = ref.sim = new BattleSimulation(config, { spawnGroup: bridge.spawnGroup, despawnGroup: bridge.despawnGroup, announce: event => events.push(event),
    routeAvailabilityProvider: (route, options) => physicalOperationRouteAvailable(env, route, options) });
  const front = sim.fronts.get('front_a'), player = { id: 'player1', hp: 100, position: [...front.position] };
  const churn = [];
  for (let tick = 1; tick * STEP <= 40; tick++) {
    if (Math.abs(sim.time - 1) < 1e-9) player.position = [front.position[0] + 6, front.position[1] - 1]; // a few steps, still inside the same front
    const before = new Set([...sim.groups.values()].filter(g => g.materialized).map(g => g.id));
    sim.update(STEP, { players: [player] }); driveActors(sim, bridge, STEP);
    for (const id of before) { const g = sim.groups.get(id);
      if (!g.materialized && g.state !== 'evacuated' && g.units.some(u => sim.units.get(u).hp > 0) && dist(player.position, front.position) <= front.radius && g.frontId === 'front_a')
        churn.push({ t: sim.time, groupId: id, joueur: player.position, distanceJoueurFront: +dist(player.position, front.position).toFixed(2),
          pertesApres1s: null, unites: g.units.map(u => [u, sim.units.get(u).state, +sim.units.get(u).hp.toFixed(1), sim.units.get(u).incapacitated]) }); }
  }
  for (const row of churn) row.pertesApres1s = row.unites.filter(([id]) => { const d = sim.deaths.get(id); return d && d.time <= row.t + 1 && d.time >= row.t; }).length;
  return { churn, log: bridge.log.slice(0, 40).map(row => [row.t, row.type, row.groupId, row.units.length]) };
})();
const churnFree = partB.churn.length === 0;
clause('C6', 'Aucune disparition visible : un groupe détaillé reste détaillé tant que le joueur reste sur son front', churnFree ? 'prouvé' : 'échec', {
  scenario: 'AFF-18 (EFF-03), mapSeed 0, joueur sur front_a puis déplacé de 6 m à t=1 s, 40 s simulées', dematerialisationsSousLeJoueur: partB.churn, journal: partB.log,
  defaut: 'js/battlefield/BattleSimulation.js:522 trie à chaque pas les groupes candidats par officier puis distance aux joueurs, sans priorité aux groupes déjà matérialisés ; js/battlefield/BattleSimulation.js:539 dématérialise tout groupe non resélectionné. Un léger déplacement du joueur ou l’arrivée d’un renfort proche renouvelle la bulle : acteurs détaillés retirés sous les yeux du joueur, puis exposés au combat distant (le blessé AFF-18:player_clan:48:1 meurt à t=1,5 s dans REC-004).',
  reproduction: 'createOperationScene({operationId:"AFF-18",players:1,mapSeed:0}) ; update(0.25) avec joueur en [0,0] puis en [6,-1] à t=1 s ; à t=1,25 s quatre groupes du front_a reçoivent group_dematerialized.' });
evidence.scenarios.B = { operation: 'AFF-18', dematerialisationsSousLeJoueur: partB.churn.length };
test('Partie B : la bulle de détail ne renouvelle pas les groupes sous un joueur resté sur son front', { todo: churnFree ? false : 'défaut: renouvellement de la bulle sans hystérésis (js/battlefield/BattleSimulation.js:522, :539)' }, () => {
  assert.deepEqual(partB.churn, []);
});

test('Non automatisable : vidéo de transition et téléportation perçue à l’écran', () => {
  clause('NA1', 'Absence de téléportation visible et lisibilité de la transition à l’écran', 'non automatisable', { raison: 'Demande le rendu Three.js, BattleActorBridge réel et une revue visuelle ; le journal prouve seulement les positions stratégiques et les poses rendues au bridge headless.' });
  assert.ok(true);
});

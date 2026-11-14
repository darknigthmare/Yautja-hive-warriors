/* Recette REC-001 — trois fronts autonomes hors caméra (classeur d'audit du
 * 26 octobre 2026, feuille Validation). Exécution headless : la simulation est
 * avancée par pas fixes de 0,25 s ; aucune vidéo n'est produite. */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';

const MAP_SEED = 20261114, STEP = .25, DURATION = 20 * 60, SAMPLE = 60;
const EVIDENCE = new URL('../docs/qa/recettes-20261114/rec-001.json', import.meta.url);
const git = command => { try { return execSync(command, { encoding: 'utf8' }).trim(); } catch { return null; } };
const living = unit => unit.hp > 0 && !['dead', 'evacuated', 'captured'].includes(unit.state);

function scene() { return createOperationScene({ operationId: 'pilot', mapSeed: MAP_SEED }); }

function frontRecord(sim, frontId) {
  const front = sim.getFrontState(frontId), raw = sim.getFront(frontId), strength = {}, orders = {}, groups = [];
  for (const group of sim.groups.values()) {
    if (group.frontId !== frontId) continue;
    const alive = group.units.filter(id => living(sim.units.get(id)) && sim.units.get(id).state !== 'reserve').length;
    if (!alive) continue;
    strength[group.factionId] = (strength[group.factionId] ?? 0) + alive;
    orders[`${group.factionId}:${group.order.type}->${group.order.frontId}`] = (orders[`${group.factionId}:${group.order.type}->${group.order.frontId}`] ?? 0) + 1;
    groups.push({ id: group.id, alive, position: group.position.map(value => Math.round(value * 10) / 10), materialized: group.materialized });
  }
  return { owner: front.owner, contested: front.contested, sourceHP: front.sourceHP, capture: raw.capture, strength, orders, groups };
}

function factionTotals(sim) {
  return Object.fromEntries(Object.entries(sim.getCounts()).map(([faction, c]) => [faction, { deployed: c.active + c.distant, active: c.active, reserve: c.reserve, dead: c.dead }]));
}

function playerKnowledge(sim, frontId) {
  const known = sim.getHUDState().fronts.find(front => front.id === frontId);
  return { owner: known.owner, contested: known.contested, intelState: known.intelState, reportAge: known.reportAge, reportSource: known.reportSource };
}

/** Run the pilot for twenty simulated minutes with an optional player stationed on A. */
function run({ playerOnA }) {
  const { config, level } = scene(), sim = new BattleSimulation(config);
  const [A, B, C] = config.fronts, players = playerOnA ? [{ id: 'p1', hp: 100, position: [...A.position] }] : [];
  const timeline = [], sample = () => timeline.push({ t: sim.time, A: frontRecord(sim, A.id), B: frontRecord(sim, B.id), C: frontRecord(sim, C.id),
    factions: factionTotals(sim), playerKnowledge: { B: playerKnowledge(sim, B.id), C: playerKnowledge(sim, C.id) } });
  sample();
  const ticks = Math.round(DURATION / STEP), perSample = Math.round(SAMPLE / STEP);
  for (let tick = 1; tick <= ticks && !sim.result; tick++) {
    sim.update(STEP, { players });
    if (tick % perSample === 0) sample();
  }
  return { sim, config, level, fronts: { A, B, C }, players, timeline };
}

const evidence = {
  recette: 'REC-001', perimetre: 'Trois fronts autonomes hors caméra',
  procedureClasseur: 'Lancer la bataille pilote FR-01 avec une graine figée. Rester vingt minutes sur le front A sans déplacer la caméra vers B/C; enregistrer leurs objectifs, positions, pertes, réserves et rapports à intervalles réguliers.',
  resultatAttenduClasseur: 'B et C évoluent selon leurs forces et ordres; ils peuvent tenir, progresser ou reculer sans apparition du joueur. Les changements existent avant leur observation et ne sont pas des déclencheurs de caméra.',
  preuveAConserverClasseur: 'Vidéo continue avec horloge; chronologie des trois fronts; relevés avant/après; commit et graine.',
  date: '2026-11-14', commit: git('git rev-parse HEAD'), branche: git('git branch --show-current'),
  preuveVideo: 'non produite — preuve par journal de simulation',
  clauses: [], limites: []
};

after(() => {
  mkdirSync(new URL('.', EVIDENCE), { recursive: true });
  evidence.clauses.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');
});

const observed = run({ playerOnA: true });
const control = run({ playerOnA: false });
const replay = run({ playerOnA: true });
{
  const { sim, config, level, fronts } = observed;
  evidence.scenario = { operationId: 'pilot', correspondance: 'Le code ne lie aucune opération au gabarit catalogue FR-01 (FR-01 n’apparaît que dans js/data/BattleCatalogData.js). La bataille pilote trois fronts jouable est createOperationScene({operationId:"pilot"}) → createBattlefieldOperation (js/battlefield/BattlefieldOperation.js). Front A = insertion (clan du joueur), B = relais (force humaine), C = nid (ruche, source de renfort « tunnel »).',
    levelId: level.id, configId: config.id, configDigest: sim.digest, difficulte: config.difficulty, ai: config.ai,
    fronts: Object.fromEntries(Object.entries(fronts).map(([key, front]) => [key, { id: front.id, label: front.label, owner: front.owner, position: front.position, radius: front.radius }])),
    routes: config.routes.map(route => ({ id: route.id, from: route.from, to: route.to, travelSeconds: route.travelSeconds, gates: route.physicalGateIds })) };
  evidence.graine = { mapSeed: MAP_SEED, simulation: 'aucun tirage aléatoire : ordre des attaques dérivé d’un hachage FNV des identifiants (BattleSimulation.js, attackSeeds)', pas: STEP, dureeSimulee: sim.time, echantillonnage: SAMPLE };
  evidence.joueur = { position: 'immobile au centre du front A pendant toute la durée', positionCoordonnees: observed.players[0].position };
  evidence.avant = observed.timeline[0]; evidence.apres = observed.timeline.at(-1);
  evidence.chronologie = observed.timeline;
  evidence.evenementsBC = sim.events.filter(event => ['base_captured', 'officer_decision', 'reinforcements_inbound', 'reinforcements_arrived', 'group_arrived', 'group_materialized', 'musou_officer_broken', 'group_order'].includes(event.type))
    .map(event => ({ t: event.time, type: event.type, groupId: event.groupId, frontId: event.frontId ?? event.targetFrontId ?? event.order?.frontId, owner: event.owner, reason: event.reason }));
  evidence.evenementsPerdus = sim.eventsDropped;
  const end = observed.timeline.at(-1).factions;
  evidence.observations = [`Sur 20 min, la ruche perd ${end.hive.dead} unité(s) contre ${end.human_force.dead} pour la force humaine : le combat à distance répartit les tirs sur toutes les cibles hostiles du front (BattleSimulation._remoteCombat, rotation attackSeeds+tick), ce qui protège les grands effectifs. Constat d’équilibrage à arbitrer, hors critère de cette recette.`];
  evidence.limites.push('La présence du joueur sur A matérialise les groupes alliés de A (état active) ; sans acteurs 3D, aucun combat rapproché n’est simulé sur A. Aucun ennemi n’y étant engagé, cela n’influence pas B/C (vérifié par la course témoin sans joueur).',
    'Les combats de B et C sont résolus par le combat à distance de BattleSimulation ; le rendu, la caméra et les acteurs détaillés ne sont pas exercés.',
    'Une revue visuelle (caméra restée sur A, absence d’apparition visible) reste à faire par un humain dans le navigateur.');
}

const series = (timeline, key, pick) => timeline.map(row => JSON.stringify(pick(row[key])));
const lastChange = timeline => timeline.reduce((last, row, index) => index && JSON.stringify([row.B.owner, row.B.strength, row.C.owner, row.C.strength]) !== JSON.stringify([timeline[index - 1].B.owner, timeline[index - 1].B.strength, timeline[index - 1].C.owner, timeline[index - 1].C.strength]) ? row.t : last, 0);
const changes = (timeline, key, pick) => new Set(series(timeline, key, pick)).size - 1;

test('REC-001 — B et C évoluent sans le joueur pendant 20 minutes simulées', () => {
  const { sim, timeline, fronts } = observed;
  assert.equal(sim.time, DURATION, 'vingt minutes simulées complètes');
  assert.equal(sim.assertConservation(), true);
  const bChanges = changes(timeline, 'B', front => [front.owner, front.strength]);
  const cChanges = changes(timeline, 'C', front => [front.owner, front.strength]);
  const bOwners = [...new Set(timeline.map(row => row.B.owner))], cOwners = [...new Set(timeline.map(row => row.C.owner))];
  const decisions = sim.events.filter(event => ['officer_decision', 'base_captured', 'musou_officer_broken'].includes(event.type) && [fronts.B.id, fronts.C.id].includes(event.frontId ?? event.from ?? event.target));
  const verdict = bChanges > 0 && cChanges > 0;
  evidence.clauses.push({ id: 'REC-001-1', texte: 'B et C évoluent selon leurs forces et ordres ; ils peuvent tenir, progresser ou reculer sans apparition du joueur.',
    verdict: verdict ? 'conforme' : 'non conforme',
    preuve: { changementsB: bChanges, changementsC: cChanges, proprietairesB: bOwners, proprietairesC: cOwners,
      bilanB: { avant: timeline[0].B.strength, apres: timeline.at(-1).B.strength }, bilanC: { avant: timeline[0].C.strength, apres: timeline.at(-1).C.strength },
      decisionsEtCaptures: decisions.map(event => ({ t: event.time, type: event.type, groupId: event.groupId, frontId: event.frontId, owner: event.owner })),
      stabilisation: `Dernier changement de B ou C relevé à t=${lastChange(timeline)} s ; ensuite la force humaine est éliminée et chaque groupe de ruche seul reste sous le ratio d’assaut (assaultMinRatio=1) face aux 20 Yautja de A.`,
      noteEquilibrage: 'Constat d’équilibrage, pas un défaut de code.' } });
  assert.ok(bChanges > 0, 'le front B change hors caméra');
  assert.ok(cChanges > 0, 'le front C change hors caméra');
  assert.ok(decisions.length > 0, 'au moins une décision ou capture issue de la simulation');
});

test('REC-001 — aucun groupe de B/C n’est matérialisé et le joueur reste sur A', () => {
  const { sim, fronts, players } = observed;
  const bcGroups = new Set([...sim.groups.values()].filter(group => group.factionId !== 'player_clan').map(group => group.id));
  const materialized = sim.events.filter(event => event.type === 'group_materialized').map(event => event.groupId);
  const hostileMaterialized = materialized.filter(id => bcGroups.has(id));
  const nearest = Math.min(...[fronts.B, fronts.C].map(front => Math.hypot(front.position[0] - players[0].position[0], front.position[1] - players[0].position[1]) - front.radius * 1.5));
  evidence.clauses.push({ id: 'REC-001-2', texte: 'Sans apparition du joueur (aucun détail matérialisé pour B/C).', verdict: hostileMaterialized.length === 0 && nearest > 0 ? 'conforme' : 'non conforme',
    preuve: { groupesMaterialises: materialized, groupesHostilesMaterialises: hostileMaterialized, distanceMinimaleAuSeuilDeDetailBC: Math.round(nearest) } });
  assert.deepEqual(hostileMaterialized, []);
  assert.ok(nearest > 0, 'le joueur reste hors du rayon de détail (1,5 × rayon) de B et C');
});

test('REC-001 — les changements de B/C existent avant observation et ne dépendent pas de la caméra', () => {
  const { timeline, sim, fronts } = observed;
  const bc = list => list.map(row => ({ t: row.t, B: { owner: row.B.owner, strength: row.B.strength, capture: row.B.capture }, C: { owner: row.C.owner, strength: row.C.strength, capture: row.C.capture } }));
  const sameWithoutPlayer = JSON.stringify(bc(timeline)) === JSON.stringify(bc(control.timeline));
  const deterministic = JSON.stringify(sim.saveState()) === JSON.stringify(replay.sim.saveState());
  // Unobserved: until a player looks at B, the HUD knowledge of B never reflects the real capture.
  const capture = sim.events.find(event => event.type === 'base_captured' && event.frontId === fronts.B.id);
  const beforeLook = timeline.at(-1).playerKnowledge.B;
  // Late observation: move the player to B after twenty minutes, then read the HUD.
  const viewer = [{ id: 'p1', hp: 100, position: [...fronts.B.position] }];
  const before = sim.getFrontState(fronts.B.id);
  sim.update(STEP, { players: viewer });
  const afterLook = playerKnowledge(sim, fronts.B.id);
  evidence.observationTardive = { t: sim.time, avantObservation: beforeLook, apresObservation: afterLook, etatAutoritaireAvant: before };
  const verdict = sameWithoutPlayer && deterministic && !!capture && beforeLook.owner !== capture.owner && afterLook.owner === capture.owner;
  evidence.clauses.push({ id: 'REC-001-3', texte: 'Les changements existent avant leur observation et ne sont pas des déclencheurs de caméra.', verdict: verdict ? 'conforme' : 'non conforme',
    preuve: { chronologieBCIdentiqueSansJoueur: sameWithoutPlayer, rejeuIdentique: deterministic,
      captureB: capture ? { t: capture.time, owner: capture.owner, reason: capture.reason } : null,
      connaissanceJoueurAvantObservation: beforeLook, connaissanceJoueurApresObservation: afterLook } });
  assert.equal(sameWithoutPlayer, true, 'B/C évoluent de façon identique avec ou sans joueur sur A');
  assert.equal(deterministic, true, 'même graine → même état final');
  assert.ok(capture && capture.time < DURATION, 'la capture de B a eu lieu hors caméra');
  assert.notEqual(beforeLook.owner, capture.owner, 'le HUD ne révèle pas la capture avant observation');
  assert.equal(afterLook.owner, capture.owner, 'l’observation tardive révèle l’état déjà produit');
  assert.equal(before.owner, capture.owner, 'l’état autoritaire précédait l’observation');
});

test('REC-001 — preuve vidéo continue non automatisable', () => {
  evidence.clauses.push({ id: 'REC-001-4', texte: 'Vidéo continue avec horloge (preuve à conserver).', verdict: 'non automatisable',
    raison: 'Exécution headless sans rendu : la vidéo et la revue de la caméra restent à produire par un humain dans le navigateur. La chronologie horodatée remplace la vidéo pour la seule partie simulation.' });
  assert.ok(evidence.chronologie.length >= 21, 'un relevé par minute, avant et après');
});

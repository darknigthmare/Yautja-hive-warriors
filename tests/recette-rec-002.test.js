/* Recette REC-002 — choix d'intervention et conséquences parallèles.
 * Deux branches rejouées depuis la même configuration (graine, difficulté,
 * équipement identiques), comparées au même instant simulé. */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';

const MAP_SEED = 20261114, STEP = .25, COMPARE_AT = 450, END = 900;
const PLAYER_SPEED = 10, MANEUVER = 1.2; // assumptions declared by BattleStrategy.measureDefeatReturn
const EVIDENCE = new URL('../docs/qa/recettes-20261114/rec-002.json', import.meta.url);
const git = command => { try { return execSync(command, { encoding: 'utf8' }).trim(); } catch { return null; } };
const living = unit => unit.hp > 0 && !['dead', 'evacuated', 'captured'].includes(unit.state);
const length = points => points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - points[index][0], point[1] - points[index][1]), 0);

const { config, level } = createOperationScene({ operationId: 'pilot', mapSeed: MAP_SEED });
const [A, B, C] = config.fronts;

/** Physical walking time of the player along the simulation's own shortest path. */
function walkSeconds(sim, from, to) {
  const path = sim._path(from, to); if (!path) return null;
  const metres = path.reduce((sum, segment) => sum + length(sim.routes.get(segment.routeId).waypoints), 0);
  return { routes: path.map(segment => segment.routeId), distance: Math.round(metres), seconds: Math.ceil(metres * MANEUVER / PLAYER_SPEED) };
}

function bilan(sim) {
  const fronts = {};
  for (const front of [A, B, C]) {
    const state = sim.getFrontState(front.id), strength = {};
    for (const group of sim.groups.values()) if (group.frontId === front.id) {
      const alive = group.units.filter(id => living(sim.units.get(id)) && sim.units.get(id).state !== 'reserve').length;
      if (alive) strength[group.factionId] = (strength[group.factionId] ?? 0) + alive;
    }
    fronts[front.id] = { owner: state.owner, sourceHP: state.sourceHP, contested: state.contested, strength,
      captures: sim.events.filter(event => event.type === 'base_captured' && event.frontId === front.id).map(event => ({ t: event.time, owner: event.owner, reason: event.reason })) };
  }
  const counts = Object.fromEntries(Object.entries(sim.getCounts()).map(([faction, c]) => [faction, { deployed: c.active + c.distant, reserve: c.reserve, dead: c.dead }]));
  const reinforcements = sim.events.filter(event => event.type.startsWith('reinforcements_')).map(event => ({ t: event.time, type: event.type, groupId: event.groupId, frontId: event.frontId ?? event.targetFrontId, reason: event.reason }));
  const access = [...sim.routes.values()].map(route => ({ id: route.id, open: route.open }));
  const hiveSources = [...sim.fronts.values()].filter(front => front.owner === 'hive' && front.reinforcementSource && front.sourceHP > 0).map(front => front.id);
  return { t: sim.time, fronts, counts, reinforcements, access, hiveSources, result: sim.getResult() };
}

function play(branch) {
  const sim = new BattleSimulation(config), orders = [], snapshots = {};
  const clan = [...sim.groups.values()].filter(group => group.factionId === 'player_clan' && group.state !== 'reserve').map(group => group.id);
  const toC = walkSeconds(sim, A.id, C.id);
  if (branch === 'secourir_B') for (const groupId of clan) orders.push({ t: sim.time, groupId, order: 'attack', frontId: B.id, answer: sim.issueOrder(groupId, { type: 'attack', frontId: B.id }) });
  let sabotageDone = false;
  for (let tick = 1; tick <= END / STEP && !sim.result; tick++) {
    sim.update(STEP, { players: [] });
    if (branch === 'fermer_tunnel_C' && !sabotageDone && sim.time >= toC.seconds) {
      sabotageDone = true;
      // The player arrives physically at C's reinforcement source, then uses the existing sabotage interaction.
      const answer = sim.interact({ id: 'p1', hp: 100, position: [...C.position] }, { type: 'sabotage', frontId: C.id, damage: 1000 });
      orders.push({ t: sim.time, actor: 'p1', action: 'sabotage', frontId: C.id, trajet: toC, answer });
    }
    if (Math.abs(sim.time - COMPARE_AT) < 1e-9) snapshots.compare = bilan(sim);
  }
  snapshots.end = bilan(sim);
  return { sim, orders, snapshots, toC, timeline: sim.events.filter(event => ['group_order', 'group_arrived', 'base_captured', 'source_disabled', 'critical_front_lost', 'operation_finished', 'officer_decision'].includes(event.type))
    .map(event => ({ t: event.time, type: event.type, groupId: event.groupId, frontId: event.frontId ?? event.order?.frontId ?? event.target, owner: event.owner, issuer: event.order?.issuer, outcome: event.outcome, reason: event.reason })) };
}

const branches = { reference: play('reference'), secourir_B: play('secourir_B'), fermer_tunnel_C: play('fermer_tunnel_C') };
const evidence = {
  recette: 'REC-002', perimetre: "Choix d'intervention et conséquences parallèles",
  procedureClasseur: 'Rejouer deux fois une même situation initiale. Première partie : secourir B; seconde : fermer le tunnel de C. Conserver difficulté et équipement, puis comparer le résultat militaire à un instant identique.',
  resultatAttenduClasseur: "Les décisions changent les renforts, les pertes, les accès ou l'extraction de façon explicable. Les fronts non secourus ne retrouvent pas artificiellement le même résultat imposé.",
  preuveAConserverClasseur: 'Deux replays comparables; bilan par front; chronologie des ordres et objectifs; justification des différences.',
  date: '2026-11-14', commit: git('git rev-parse HEAD'), branche: git('git branch --show-current'),
  preuveVideo: 'non produite — preuve par journal de simulation',
  graine: { mapSeed: MAP_SEED, simulation: 'déterministe, sans tirage aléatoire', pas: STEP },
  scenario: { operationId: 'pilot', levelId: level.id, configId: config.id, configDigest: new BattleSimulation(config).digest, difficulte: config.difficulty,
    equipement: 'configuration identique pour les branches (même objet config, profils et budgets inchangés)',
    correspondance: 'Pilote trois fronts du code (FR-01 n’est pas lié à une opération jouable). A = insertion (clan), B = relais (force humaine, front disputé à secourir), C = nid (ruche ; sa source de renfort tient lieu de « tunnel »).' },
  branches: {
    reference: 'Aucune intervention : contrôle.',
    secourir_B: 'À t=0, les 4 groupes de clan déployés reçoivent l’ordre « attaque » vers B (issueOrder, émetteur player1).',
    fermer_tunnel_C: 'Le joueur marche de A à C par le plus court chemin ouvert (10 u/s, facteur 1,2), puis sabote la source de C (interact sabotage, 1000 PV). Les groupes de clan gardent A.'
  },
  instantCompare: COMPARE_AT, finSimulee: END, clauses: [],
  limites: ['La présence physique et le combat du joueur ne sont pas simulés en headless (players: [] pendant les mises à jour) : seule l’action de sabotage, au temps d’arrivée calculé, représente le joueur.',
    'Le trajet du joueur vers C traverse B (disputé) sans combat simulé : le délai réel en jeu sera au moins égal à la valeur calculée.',
    'Revue visuelle des deux replays (lisibilité des conséquences dans le HUD) à faire par un humain.']
};
for (const [name, branch] of Object.entries(branches)) evidence.branches[`${name}_resultat`] = { ordres: branch.orders, chronologie: branch.timeline, bilanInstantCompare: branch.snapshots.compare, bilanFin: branch.snapshots.end };

after(() => {
  mkdirSync(new URL('.', EVIDENCE), { recursive: true });
  evidence.clauses.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');
});

test('REC-002 — mêmes conditions initiales pour les deux parties', () => {
  const digests = Object.values(branches).map(branch => branch.sim.digest);
  assert.equal(new Set(digests).size, 1, 'même configuration signée');
  assert.ok(branches.secourir_B.orders.every(order => order.answer.accepted), 'ordres de secours acceptés');
  const sabotage = branches.fermer_tunnel_C.orders[0];
  assert.equal(sabotage.answer.accepted, true, 'sabotage accepté à l’arrivée');
  assert.ok(sabotage.t >= sabotage.trajet.seconds, 'pas de sabotage avant le trajet physique');
  for (const branch of Object.values(branches)) assert.equal(branch.sim.assertConservation(), true);
});

test('REC-002 — les décisions changent pertes, accès ou extraction de façon explicable', () => {
  const ref = branches.reference.snapshots.compare, help = branches.secourir_B.snapshots.compare, cut = branches.fermer_tunnel_C.snapshots.compare;
  const differs = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
  const lossDiff = { secourir_B: differs(help.counts, ref.counts), fermer_tunnel_C: differs(cut.counts, ref.counts), entreBranches: differs(help.counts, cut.counts) };
  const ownerDiff = differs(Object.fromEntries(Object.entries(help.fronts).map(([id, f]) => [id, f.owner])), Object.fromEntries(Object.entries(cut.fronts).map(([id, f]) => [id, f.owner])));
  const reinforcementDiff = differs(help.reinforcements, cut.reinforcements);
  const lastInbound = Math.max(...branches.reference.snapshots.end.reinforcements.filter(event => event.type === 'reinforcements_arrived').map(event => event.t));
  evidence.clauses.push({ id: 'REC-002-1', texte: "Les décisions changent les renforts, les pertes, les accès ou l'extraction de façon explicable.",
    verdict: (lossDiff.entreBranches || ownerDiff) ? 'conforme' : 'non conforme',
    preuve: { pertesDifferentes: lossDiff, proprietairesDifferents: ownerDiff, renfortsDifferents: reinforcementDiff,
      pertesAInstant: { reference: ref.counts, secourir_B: help.counts, fermer_tunnel_C: cut.counts },
      sourcesDeRucheAInstant: { reference: ref.hiveSources, secourir_B: help.hiveSources, fermer_tunnel_C: cut.hiveSources },
      resultatFinal: { reference: branches.reference.snapshots.end.result, secourir_B: branches.secourir_B.snapshots.end.result, fermer_tunnel_C: branches.fermer_tunnel_C.snapshots.end.result } },
    justification: [
      'secourir_B : le clan quitte A et combat sur B (pertes clan et ruche), prend B ; A reste vide, la ruche le capture, le front critique déclenche le délai puis la défaite (A non repris).',
      'fermer_tunnel_C : sans source active jusqu’à la prise de B, la coordination de ruche passe à 0,65 (BattleSimulation._remoteCombat) : la ruche perd davantage contre les humains et capture B plus tard ; A reste tenu.',
      `Renforts : identiques dans les trois parties. Les réserves finies sont toutes engagées au plus tard à t=${lastInbound} s, avant l’arrivée physique la plus rapide du joueur en C (${branches.fermer_tunnel_C.toC.seconds} s) : fermer le « tunnel » ne peut plus retenir de renfort dans ce pilote. Constat de conception à arbitrer, pas un défaut de code.`] });
  assert.ok(lossDiff.entreBranches, 'les pertes diffèrent entre les deux choix au même instant');
  assert.ok(lossDiff.secourir_B && lossDiff.fermer_tunnel_C, 'chaque choix modifie les pertes par rapport au contrôle');
  assert.equal(cut.fronts[C.id].sourceHP, 0, 'l’accès de renfort de C reste fermé');
  assert.equal(help.fronts[C.id].sourceHP, 1000, 'C reste une source si le joueur secourt B');
});

test('REC-002 — les fronts non secourus ne retrouvent pas un résultat imposé', () => {
  const help = branches.secourir_B.snapshots.compare, cut = branches.fermer_tunnel_C.snapshots.compare, ref = branches.reference.snapshots.compare;
  const capturesFromSimulation = Object.values(branches).every(branch => branch.sim.events.filter(event => event.type === 'base_captured').every(event => event.reason === 'unopposed_presence'));
  const bUnhelpedVsHelped = JSON.stringify(cut.fronts[B.id]) !== JSON.stringify(help.fronts[B.id]);
  const bUnhelpedVsRef = JSON.stringify(cut.fronts[B.id].captures) !== JSON.stringify(ref.fronts[B.id].captures);
  const cUnhelpedVsRef = JSON.stringify(help.fronts[C.id]) !== JSON.stringify(ref.fronts[C.id]);
  evidence.clauses.push({ id: 'REC-002-2', texte: 'Les fronts non secourus ne retrouvent pas artificiellement le même résultat imposé.',
    verdict: capturesFromSimulation && bUnhelpedVsHelped && bUnhelpedVsRef ? 'conforme' : 'non conforme',
    preuve: { capturesToutesParPresenceSimulee: capturesFromSimulation,
      B_nonSecouru_vs_secouru: { nonSecouru: cut.fronts[B.id], secouru: help.fronts[B.id], different: bUnhelpedVsHelped },
      B_nonSecouru_vs_reference: { nonSecouru: cut.fronts[B.id].captures, reference: ref.fronts[B.id].captures, different: bUnhelpedVsRef },
      C_nonSecouru_vs_reference: { nonSecouru: help.fronts[C.id], reference: ref.fronts[C.id], different: cUnhelpedVsRef } } });
  assert.equal(capturesFromSimulation, true, 'aucune capture scriptée');
  assert.ok(bUnhelpedVsHelped, 'B non secouru ≠ B secouru');
  assert.ok(bUnhelpedVsRef, 'B non secouru suit sa propre chronologie (capture déplacée par la coordination de ruche réduite)');
});

test('REC-002 — replays vidéo comparables non automatisables', () => {
  evidence.clauses.push({ id: 'REC-002-3', texte: 'Deux replays comparables (preuve à conserver).', verdict: 'non automatisable',
    raison: 'Aucun rendu en headless : les deux replays vidéo restent à enregistrer par un humain. Les chronologies d’ordres, objectifs et bilans par front sont fournies dans ce journal.' });
  assert.ok(evidence.branches.secourir_B_resultat.chronologie.length > 0 && evidence.branches.fermer_tunnel_C_resultat.chronologie.length > 0);
});

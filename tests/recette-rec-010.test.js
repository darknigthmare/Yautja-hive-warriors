/* Recette REC-010 — ordres alliés et rôles de groupe, sur deux fronts du
 * pilote (A = insertion, B = relais), sans joueur présent sur le terrain. */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { battleCommandFeedback } from '../js/ui/CommandMap.js';
import { commandAcknowledgement } from '../js/ui/TacticalPresentation.js';

const MAP_SEED = 20261114, STEP = .25, END = 900;
const EVIDENCE = new URL('../docs/qa/recettes-20261114/rec-010.json', import.meta.url);
const git = command => { try { return execSync(command, { encoding: 'utf8' }).trim(); } catch { return null; } };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round = point => point.map(value => Math.round(value * 10) / 10);

const { config, level } = createOperationScene({ operationId: 'pilot', mapSeed: MAP_SEED });
const [A, B] = config.fronts;
const sim = new BattleSimulation(config);
const clan = [...sim.groups.values()].filter(group => group.factionId === 'player_clan');
const [hold, flankA, flankB, escort] = clan.filter(group => group.state !== 'reserve').map(group => group.id);
const reserve = clan.find(group => group.state === 'reserve').id;
const hostile = [...sim.groups.values()].find(group => group.factionId === 'hive' && group.frontId === B.id).id;
const ledger = [], samples = [];

function command(label, groupIds, call, kind = 'order', front = null) {
  const answer = call(), groups = groupIds.map(id => sim.getGroup(id)).filter(Boolean);
  const entry = { t: sim.time, ordre: label, groupes: groupIds, accepte: answer.accepted, raison: answer.reason ?? null,
    retourJoueur: battleCommandFeedback(answer), accuse: commandAcknowledgement(answer, { kind, groups, front }) };
  ledger.push(entry); return { answer, entry };
}
const advance = (seconds, onTick = () => {}) => { for (let tick = 0; tick < Math.round(seconds / STEP) && !sim.result; tick++) { sim.update(STEP, { players: [] }); onTick(); } };
const sample = () => samples.push({ t: sim.time, groupes: Object.fromEntries([hold, flankA, flankB, escort, reserve].map(id => {
  const group = sim.getGroup(id); return [id, { front: group.frontId, ordre: `${group.order.type}->${group.order.frontId}`, emetteur: group.order.issuer, position: round(group.position), vivants: group.alive, enTrajet: group.path.length > 0, formation: group.formation }];
})), B: sim.getFrontState(B.id).owner });

// --- t = 0 : ordres sur deux fronts ---------------------------------------
const orders = {
  hold: command('tenir A', [hold], () => sim.issueOrder(hold, { type: 'defend', frontId: A.id }), 'order', A),
  reserveDirect: command('ordre direct à un groupe en réserve', [reserve], () => sim.issueOrder(reserve, { type: 'attack', frontId: B.id })),
  pincerSolo: command('contourner seul (encerclement à un groupe)', [flankA], () => sim.issueTactic([flankA], { type: 'pincer', frontId: B.id }), 'tactic', B),
  pincer: command('contourner B à deux groupes', [flankA, flankB], () => sim.issueTactic([flankA, flankB], { type: 'pincer', frontId: B.id }), 'tactic', B),
  escort: command('escorter vers B', [escort], () => sim.issueOrder(escort, { type: 'escort', frontId: B.id }), 'order', B),
  reinforce: command('renforcer B (réserve finie)', [reserve], () => sim.requestReinforcements(sim.config.playerFaction, B.id), 'reinforce', B),
  hostileTactic: command('tactique sur un groupe de la ruche', [hostile], () => sim.issueTactic([hostile], { type: 'hold_line', frontId: B.id }), 'tactic', B)
};
sample();

// --- coupure de route pendant l'ordre -------------------------------------
const mainRoute = 'route-insertion-relay-main';
let cut = null;
advance(60, () => {
  if (cut || !sim.getGroup(flankA).path.length) return;
  const group = sim.getGroup(flankA);
  if (dist(group.position, A.position) <= A.radius + 5) return;
  cut = { t: sim.time, position: round(group.position), accepted: sim.setRouteOpen(mainRoute, false, 'recette_coupure') };
});
sample();
const blocked = sim.events.filter(event => event.type === 'order_blocked').map(event => ({ t: event.time, groupId: event.groupId, reason: event.reason }));
const heldAt = round(sim.getGroup(flankA).position);
advance(20);
const stillHeld = JSON.stringify(round(sim.getGroup(flankA).position)) === JSON.stringify(heldAt);
orders.afterCut = command('nouvel ordre au groupe bloqué en trajet', [flankA], () => sim.issueOrder(flankA, { type: 'attack', frontId: B.id }), 'order', B);
sim.setRouteOpen(mainRoute, true, 'recette_reouverture');
const reopenAt = sim.time;
let escortOrders = new Set(), delegatedAbandon = null;
orders.delegate = command('déléguer A au capitaine du groupe qui tient', [hold], () => sim.delegateFront(hold, A.id), 'delegate', A);
const supportWatch = () => {
  const e = sim.getGroup(escort); escortOrders.add(`${e.order.type}->${e.order.frontId}:${e.order.issuer}`);
  const h = sim.getGroup(hold);
  if (!delegatedAbandon && h.order.frontId !== A.id) {
    // A delegated captain may act on its own while another allied group still garrisons its front.
    const otherGarrison = [...sim.groups.values()].filter(group => group.id !== hold && group.factionId === 'player_clan' && group.frontId === A.id && !group.path.length && !group.reconstitution?.required && !['retreat', 'regroup'].includes(group.order.type) && group.units.some(id => sim.units.get(id).hp > 0 && sim.units.get(id).state !== 'reserve')).map(group => group.id);
    delegatedAbandon = { t: sim.time, order: h.order, autresGroupesSurA: otherGarrison };
  }
};
for (let block = 0; block < 6; block++) { advance(60, supportWatch); sample(); }

// --- rôle et taille incompatibles, puis repli ------------------------------
const officer = sim.getGroup(flankB).officerId;
sim.recordDeath({ entityId: officer, killerFaction: 'hive', cause: 'recette_perte_officier' });
orders.noOfficer = command('déléguer un front à un groupe sans capitaine', [flankB], () => sim.delegateFront(flankB, B.id), 'delegate', B);
orders.retreat = command('replier l’escorte de B vers A', [escort], () => sim.issueOrder(escort, { type: 'retreat', frontId: A.id }), 'order', A);
orders.attackAfterRetreat = command('relancer l’escorte repliée à l’attaque', [escort], () => sim.issueOrder(escort, { type: 'attack', frontId: B.id }), 'order', B);
advance(END - sim.time, () => sample.tick = (sample.tick ?? 0) + 1); sample();

const arrivals = sim.events.filter(event => event.type === 'group_arrived' && clan.some(group => group.id === event.groupId)).map(event => ({ t: event.time, groupId: event.groupId, frontId: event.frontId }));
const captures = sim.events.filter(event => event.type === 'base_captured').map(event => ({ t: event.time, frontId: event.frontId, owner: event.owner, reason: event.reason }));
const clanOfficerDecisions = sim.events.filter(event => event.type === 'officer_decision' && clan.some(group => group.id === event.groupId));

const evidence = {
  recette: 'REC-010', perimetre: 'Ordres alliés et rôles de groupe',
  procedureClasseur: "Donner tenir, contourner, renforcer, escorter et replier à plusieurs groupes sur deux fronts. Couper une route pendant l'ordre; demander ensuite une tâche incompatible avec le rôle ou la taille d'une unité.",
  resultatAttenduClasseur: "Chaque groupe confirme, exécute ou refuse avec une raison compréhensible. Les alliés peuvent sécuriser un objectif sans présence du joueur; un soutien n'abandonne pas systématiquement sa tâche pour poursuivre une cible isolée.",
  preuveAConserverClasseur: 'Vidéo avec statut des ordres; destinations et trajets; objectifs accomplis sans joueur; motifs de refus.',
  date: '2026-11-14', commit: git('git rev-parse HEAD'), branche: git('git branch --show-current'),
  preuveVideo: 'non produite — preuve par journal de simulation',
  graine: { mapSeed: MAP_SEED, simulation: 'déterministe, sans tirage aléatoire', pas: STEP, duree: sim.time },
  scenario: { operationId: 'pilot', levelId: level.id, configId: config.id, configDigest: sim.digest, difficulte: config.difficulty, fronts: { A: A.id, B: B.id },
    groupes: { tenir: hold, contournement: [flankA, flankB], escorte: escort, reserve, groupeHostileCible: hostile }, joueur: 'absent (players: [] à chaque mise à jour)' },
  ordres: ledger, coupureRoute: { route: mainRoute, ...cut, ordresBloques: blocked, positionTenue: stillHeld, reouvertureA: reopenAt },
  arrivees: arrivals, captures, decisionsCapitainesClan: clanOfficerDecisions.map(event => ({ t: event.time, groupId: event.groupId, from: event.from, target: event.target, reason: event.reason })),
  releves: samples, clauses: [],
  limites: ['La perte du capitaine du second groupe de contournement est injectée par la recette (recordDeath) pour obtenir une demande incompatible avec le rôle « capitaine ».',
    'La poursuite d’une cible isolée par les acteurs détaillés (BattleActorBridge, IA de combat) n’est pas exercée headless : seule la couche stratégique est prouvée.',
    'Les accusés de réception affichent les libellés bruts des groupes (« player_clan 1 ») : lisibilité à juger par un humain.',
    'L’API ne porte aucun contrôle de rôle métier (médecin, artilleur…) sur les ordres de groupe : la seule incompatibilité de rôle vérifiable ici est l’exigence d’un capitaine vivant pour la délégation et l’appartenance alliée pour les tactiques.']
};

after(() => {
  mkdirSync(new URL('.', EVIDENCE), { recursive: true });
  evidence.clauses.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');
});

test('REC-010 — chaque ordre est confirmé ou refusé avec une raison compréhensible', () => {
  const generic = 'Action impossible dans la situation actuelle.';
  const refusals = ledger.filter(entry => !entry.accepte), confirmations = ledger.filter(entry => entry.accepte);
  const unclear = refusals.filter(entry => !entry.raison || entry.retourJoueur === generic);
  const unconfirmed = confirmations.filter(entry => !entry.accuse);
  evidence.clauses.push({ id: 'REC-010-1', texte: 'Chaque groupe confirme ou refuse avec une raison compréhensible.', verdict: !unclear.length && !unconfirmed.length ? 'conforme' : 'non conforme',
    preuve: { confirmations: confirmations.map(entry => ({ ordre: entry.ordre, accuse: entry.accuse })), refus: refusals.map(entry => ({ ordre: entry.ordre, raison: entry.raison, retourJoueur: entry.retourJoueur })), refusSansTexte: unclear } });
  assert.equal(orders.hold.answer.accepted, true); assert.equal(orders.pincer.answer.accepted, true);
  assert.equal(orders.escort.answer.accepted, true); assert.equal(orders.reinforce.answer.accepted, true);
  assert.equal(orders.retreat.answer.accepted, true); assert.equal(orders.delegate.answer.accepted, true);
  assert.equal(orders.reserveDirect.answer.reason, 'group_in_reserve');
  assert.equal(orders.pincerSolo.answer.reason, 'two_groups_required', 'taille incompatible');
  assert.equal(orders.hostileTactic.answer.reason, 'allied_available_groups_required');
  assert.equal(orders.noOfficer.answer.reason, 'living_officer_required', 'rôle de capitaine requis');
  assert.equal(orders.attackAfterRetreat.answer.reason, 'reconstitution_required');
  assert.deepEqual(unclear, [], 'aucun refus sans texte joueur');
  assert.deepEqual(unconfirmed, [], 'chaque ordre accepté a un accusé de réception');
});

test('REC-010 — la coupure de route pendant l’ordre est signalée, tenue sans téléportation, puis reprise', () => {
  const flankArrived = arrivals.find(item => item.groupId === flankA && item.frontId === B.id);
  const ok = cut?.accepted && blocked.some(item => item.groupId === flankA && item.reason === 'route_closed_in_transit') && stillHeld &&
    orders.afterCut.answer.reason === 'route_closed_in_transit' && flankArrived && flankArrived.t > reopenAt;
  evidence.clauses.push({ id: 'REC-010-2', texte: 'Coupure de route pendant l’ordre : refus motivé, position conservée, exécution après réouverture.', verdict: ok ? 'conforme' : 'non conforme',
    preuve: { coupure: cut, ordresBloques: blocked, positionTenue: stillHeld, refusApresCoupure: orders.afterCut.entry, arriveeApresReouverture: flankArrived ?? null } });
  assert.ok(cut?.accepted, 'route coupée pendant le trajet');
  assert.ok(blocked.some(item => item.groupId === flankA && item.reason === 'route_closed_in_transit'));
  assert.equal(stillHeld, true, 'le groupe garde sa position réelle');
  assert.equal(orders.afterCut.answer.reason, 'route_closed_in_transit');
  assert.ok(flankArrived && flankArrived.t > reopenAt, 'exécution après réouverture');
});

test('REC-010 — les ordres sont exécutés et les alliés sécurisent B sans joueur', () => {
  const at = id => arrivals.filter(item => item.groupId === id).map(item => item.frontId);
  const clanCapture = captures.find(item => item.frontId === B.id && item.owner === 'player_clan');
  const escortReachedB = at(escort).includes(B.id), reserveReachedB = at(reserve).includes(B.id);
  const retreatDone = at(escort).includes(A.id);
  evidence.clauses.push({ id: 'REC-010-3', texte: 'Les ordres sont exécutés ; les alliés peuvent sécuriser un objectif sans présence du joueur.', verdict: clanCapture && escortReachedB && reserveReachedB && retreatDone ? 'conforme' : 'non conforme',
    preuve: { arrivees: arrivals, captureB: clanCapture ?? null, escorteArriveeB: escortReachedB, renfortArriveB: reserveReachedB, replieArriveA: retreatDone, groupeQuiTientResteSurA: sim.getGroup(hold).frontId === A.id } });
  assert.ok(escortReachedB && reserveReachedB, 'escorte et renfort atteignent B');
  assert.ok(clanCapture, 'B capturé par le clan sans joueur');
  assert.ok(retreatDone, 'le repli rejoint A par la route');
  assert.ok(sim.getGroup(hold).frontId === A.id || delegatedAbandon?.autresGroupesSurA.length >= 1);
  assert.equal(sim.assertConservation(), true);
});

test('REC-010 — un soutien n’abandonne pas sa tâche pour une cible isolée', () => {
  const escortStable = [...escortOrders].every(value => value === `escort->${B.id}:player1`);
  evidence.clauses.push({ id: 'REC-010-4', texte: "Un soutien n'abandonne pas systématiquement sa tâche pour poursuivre une cible isolée.", verdict: escortStable && (!delegatedAbandon || delegatedAbandon.autresGroupesSurA.length >= 1) ? 'conforme (couche stratégique)' : 'non conforme',
    preuve: { ordresObservesEscorte: [...escortOrders], capitaineDelegueAQuitteA: delegatedAbandon, decisionsCapitainesClan: clanOfficerDecisions.length },
    nonAutomatisable: 'Le comportement de poursuite des acteurs détaillés (ciblage rapproché) reste à vérifier en jeu par un humain.' });
  assert.equal(escortStable, true, 'l’escorte garde son ordre jusqu’au repli demandé');
  assert.ok(!delegatedAbandon || delegatedAbandon.autresGroupesSurA.length >= 1, 'le capitaine délégué ne quitte A que si un autre groupe allié y reste');
});

test('REC-010 — vidéo avec statut des ordres non automatisable', () => {
  evidence.clauses.push({ id: 'REC-010-5', texte: 'Vidéo avec statut des ordres (preuve à conserver).', verdict: 'non automatisable',
    raison: 'Aucun rendu headless : statut des ordres, destinations, trajets et motifs de refus sont journalisés ; la vidéo et la lisibilité de la carte de commandement restent à vérifier par un humain.' });
  assert.ok(samples.length >= 8);
});

/* Recette REC-003 — alertes et temps réel pour porter secours.
 * Seuils fixés avant exécution (hypothèses déjà déclarées par
 * BattleStrategy.measureDefeatReturn) : marche 10 u/s, facteur de manœuvre
 * 1,2, réaction 12 s, reprise = captureThreshold du front critique. */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { operationAlertState } from '../js/ui/OperationPanel.js';

const MAP_SEED = 20261114, STEP = .25, ATTACK_AT = 40, LIMIT = 1200;
const THRESHOLDS = Object.freeze({ playerSpeed: 10, maneuverFactor: 1.2, reactionSeconds: 12, source: 'BattleStrategy.measureDefeatReturn defaults, fixed before execution' });
const EVIDENCE = new URL('../docs/qa/recettes-20261114/rec-003.json', import.meta.url);
const git = command => { try { return execSync(command, { encoding: 'utf8' }).trim(); } catch { return null; } };
const length = points => points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - points[index][0], point[1] - points[index][1]), 0);

const { config, level } = createOperationScene({ operationId: 'pilot', mapSeed: MAP_SEED });
const [A, B, C] = config.fronts;
const POSITIONS = { B: { id: 'p1', hp: 100, position: [...B.position], frontId: B.id }, C: { id: 'p1', hp: 100, position: [...C.position], frontId: C.id } };

function travel(sim, fromFront) {
  const path = sim._path(fromFront, A.id);
  if (!path) return { reachable: false, routes: [], distance: null, seconds: null };
  const distance = path.reduce((sum, segment) => sum + length(sim.routes.get(segment.routeId).waypoints), 0);
  return { reachable: true, routes: path.map(segment => segment.routeId), distance: Math.round(distance), seconds: Math.ceil(distance * THRESHOLDS.maneuverFactor / THRESHOLDS.playerSpeed) };
}

/** Same seed and orders; only the passage state differs between variants. */
function scenario({ closeBefore = [], closeAfterCapture = [] } = {}) {
  const sim = new BattleSimulation(config), journal = [], seen = new Set(), marks = {};
  for (const routeId of closeBefore) journal.push({ t: sim.time, action: 'route_closed', routeId, accepted: sim.setRouteOpen(routeId, false, 'recette_passage_bloque') });
  const tick = () => {
    sim.update(STEP, { players: [] });
    const hud = sim.getHUDState(), known = hud.fronts.find(front => front.id === A.id);
    for (const [name, player] of Object.entries(POSITIONS)) {
      const text = operationAlertState(hud, null, [player]).text, key = `${name}:${text.replace(/\d+ s/, 'N s')}`;
      if (!seen.has(key)) { seen.add(key); journal.push({ t: sim.time, position: name, alerte: text }); }
    }
    if (marks.firstInfo === undefined && known.contested === true) marks.firstInfo = { t: sim.time, source: known.reportSource, reportAge: known.reportAge };
    if (marks.firstAlertNamingA === undefined && /Clairière d’insertion/.test(operationAlertState(hud, null, [POSITIONS.C]).text) && !/Renforts/.test(operationAlertState(hud, null, [POSITIONS.C]).text)) marks.firstAlertNamingA = { t: sim.time, text: operationAlertState(hud, null, [POSITIONS.C]).text };
    if (marks.firstAllyDeath === undefined && sim.events.some(event => event.type === 'unit_died' && sim.getUnit(event.entityId ?? event.unitId)?.factionId === 'player_clan')) marks.firstAllyDeath = sim.time;
    if (marks.criticalAlert === undefined && hud.criticalDeadline !== null) marks.criticalAlert = { t: sim.time, deadline: hud.criticalDeadline, criticalFronts: hud.criticalFronts, hudAlertTypes: hud.alerts.map(alert => alert.type) };
    return hud;
  };
  while (sim.time < ATTACK_AT) tick();
  const attackers = [...sim.groups.values()].filter(group => group.factionId !== 'player_clan' && group.units.some(id => sim.units.get(id).hp > 0)).map(group => group.id);
  for (const groupId of attackers) sim.issueOrder(groupId, { type: 'attack', frontId: A.id, issuer: 'scenario' });
  // Since focused remote fire (HW-DEC-92) a full garrison holds A: the recipe measures alerts and rescue
  // time, not balance, so all clan groups but one leave A to make its loss reachable.
  const garrison = [...sim.groups.values()].filter(group => group.factionId === 'player_clan' && group.frontId === A.id && group.units.some(id => sim.units.get(id).hp > 0)).map(group => group.id).sort();
  for (const groupId of garrison.slice(1)) sim.issueOrder(groupId, { type: 'defend', frontId: B.id, issuer: 'scenario' });
  journal.push({ t: sim.time, action: 'attaque_declenchee', vers: A.id, groupes: attackers.length, garnisonRestante: garrison.slice(0, 1) });
  while (!sim.criticalLosses.size && sim.time < LIMIT) tick();
  marks.capture = sim.events.find(event => event.type === 'base_captured' && event.frontId === A.id)?.time ?? null;
  for (const routeId of closeAfterCapture) journal.push({ t: sim.time, action: 'route_closed', routeId, accepted: sim.setRouteOpen(routeId, false, 'recette_passage_bloque') });
  let hud = tick();
  marks.afterCut = { t: sim.time, deadline: hud.criticalDeadline, criticalFronts: hud.criticalFronts, hudAlertTypes: hud.alerts.map(alert => alert.type),
    alerteC: operationAlertState(hud, null, [POSITIONS.C]).text, alerteB: operationAlertState(hud, null, [POSITIONS.B]).text };
  marks.travel = Object.fromEntries(Object.entries(POSITIONS).map(([name, player]) => [name, travel(sim, player.frontId)]));
  while (!sim.result && sim.time < LIMIT) hud = tick();
  marks.result = sim.getResult();
  marks.simEvents = sim.events.filter(event => /^critical_|route_changed|order_blocked/.test(event.type)).map(event => ({ t: event.time, type: event.type, routeId: event.routeId, deadline: event.deadline, unreachableFrontIds: event.unreachableFrontIds, reason: event.reason }));
  return { sim, journal, marks };
}

function feasibility(marks, recapture) {
  const deadline = marks.afterCut.deadline;
  return Object.fromEntries(Object.entries(marks.travel).map(([name, route]) => {
    const needed = route.reachable ? route.seconds + recapture + THRESHOLDS.reactionSeconds : null;
    const available = deadline - marks.criticalAlert.t;
    return [name, { trajet: route, secondesNecessaires: needed, secondesDisponiblesApresAlerte: available, faisable: route.reachable && needed <= available }];
  }));
}

const recapture = config.fronts[0].captureThreshold;
const open = scenario();
const detour = scenario({ closeBefore: ['route-insertion-relay-main'] });
const sealed = scenario({ closeAfterCapture: ['route-insertion-relay-main', 'route-insertion-relay-flank'] });

const evidence = {
  recette: 'REC-003', perimetre: 'Alertes et temps réel pour porter secours',
  procedureClasseur: "Déclencher une attaque sur un front distant depuis plusieurs positions du joueur. Mesurer le délai d'alerte, la durée de trajet par les routes accessibles et le temps restant avant rupture; répéter avec un passage bloqué.",
  resultatAttenduClasseur: "Le joueur reçoit une information exploitable avant la conséquence irréversible, ou la mission signale clairement qu'un ordre distant est nécessaire. Aucune alerte urgente ne demande un trajet impossible sans l'annoncer.",
  preuveAConserverClasseur: 'Chronométrages; vitesses et routes déclarées; captures des alertes; seuils de délai fixés avant recette.',
  date: '2026-11-14', commit: git('git rev-parse HEAD'), branche: git('git branch --show-current'),
  preuveVideo: 'non produite — preuve par journal de simulation',
  graine: { mapSeed: MAP_SEED, simulation: 'déterministe, sans tirage aléatoire', pas: STEP },
  scenario: { operationId: 'pilot', levelId: level.id, configId: config.id, configDigest: open.sim.digest, difficulte: config.difficulty,
    attaque: `À t=${ATTACK_AT} s, tous les groupes ruche et humains reçoivent l’ordre d’attaquer A (insertion, front critique du joueur) — déclenchement de recette par issueOrder(issuer "scenario").`,
    positionsJoueur: Object.fromEntries(Object.entries(POSITIONS).map(([name, player]) => [name, player.position])),
    conséquenceIrréversible: 'Défaite « critical_front_lost » à l’échéance ; la capture de A et la mort des alliés sont mesurées aussi.',
    routesDeclarees: config.routes.map(route => ({ id: route.id, from: route.from, to: route.to, longueur: Math.round(length(route.waypoints)), travelSecondsGroupes: route.travelSeconds })) },
  seuils: { ...THRESHOLDS, recaptureSeconds: recapture, regle: 'alerte + trajet×1,2/10 u/s + réaction 12 s + reprise ≤ échéance' },
  variantes: {}, clauses: [],
  limites: ['Captures d’alertes = texte de operationAlertState (js/ui/OperationPanel.js), fonction pure du panneau ; pas de capture d’écran.',
    'Le joueur n’est pas transmis à update() : sa présence matérialiserait les groupes du front où il se trouve sans combat détaillé headless.',
    'Le trajet calculé ignore les combats traversés ; le ressenti du délai reste à valider par un humain en jeu.']
};
for (const [name, variant] of Object.entries({ ouvert: open, detour_route_principale_fermee: detour, passage_scelle_apres_capture: sealed }))
  evidence.variantes[name] = { jalons: variant.marks, faisabilite: feasibility(variant.marks, recapture), capturesAlertes: variant.journal };

after(() => {
  mkdirSync(new URL('.', EVIDENCE), { recursive: true });
  evidence.clauses.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');
});

test('REC-003 — routes ouvertes : l’alerte précède la conséquence irréversible avec un trajet faisable', () => {
  const { marks } = open, check = feasibility(marks, recapture);
  const ok = marks.criticalAlert && marks.criticalAlert.t < marks.afterCut.deadline && Object.values(check).every(item => item.faisable);
  evidence.clauses.push({ id: 'REC-003-1', texte: 'Le joueur reçoit une information exploitable avant la conséquence irréversible (routes ouvertes).', verdict: ok ? 'conforme' : 'non conforme',
    preuve: { premiereInformation: marks.firstInfo, premiereAlerteNommantA: marks.firstAlertNamingA, premiereMortAlliee: marks.firstAllyDeath, captureA: marks.capture,
      alerteCritique: marks.criticalAlert, echeance: marks.afterCut.deadline, tempsInformationAvantRupture: marks.capture - marks.firstInfo.t, faisabilite: check },
    observation: `La première information (A disputé dans le HUD, rapport de garnison) arrive à t=${marks.firstInfo.t} s ; la première mort alliée à t=${marks.firstAllyDeath} s. La mort des alliés est irréversible mais n’est annoncée en texte d’alerte qu’au moment « capitaine en danger » : à juger par un humain.` });
  assert.ok(marks.firstInfo && marks.firstInfo.t < marks.capture, 'une information sur A précède sa capture');
  assert.ok(ok, 'échéance atteignable depuis B et C');
  assert.equal(marks.result?.reason, 'critical_front_lost', 'sans intervention, la conséquence se produit bien à l’échéance');
  assert.equal(marks.result.time, marks.afterCut.deadline);
});

test('REC-003 — passage principal bloqué avant l’attaque : détour mesuré et toujours faisable', () => {
  const { marks } = detour, check = feasibility(marks, recapture);
  const usesFlank = Object.values(marks.travel).every(route => route.routes.includes('route-insertion-relay-flank'));
  const ok = usesFlank && Object.values(check).every(item => item.faisable);
  evidence.clauses.push({ id: 'REC-003-2', texte: 'Répétition avec un passage bloqué (détour disponible) : trajet accessible et délai suffisant.', verdict: ok ? 'conforme' : 'non conforme',
    preuve: { faisabilite: check, echeance: marks.afterCut.deadline, alerteCritique: marks.criticalAlert, evenements: marks.simEvents } });
  assert.ok(usesFlank, 'le trajet passe par le contournement réel');
  assert.ok(ok, 'l’échéance couvre le détour');
});

test('REC-003 — passage scellé : la simulation annonce la coupure', () => {
  const { marks } = sealed, blocked = marks.simEvents.find(event => event.type === 'critical_return_route_blocked');
  const unreachable = Object.values(marks.travel).every(route => !route.reachable);
  evidence.clauses.push({ id: 'REC-003-3a', texte: 'Coupure totale : la simulation calcule et émet l’impossibilité du retour.', verdict: blocked && unreachable ? 'conforme' : 'non conforme',
    preuve: { evenement: blocked, criticalFronts: marks.afterCut.criticalFronts, trajets: marks.travel } });
  assert.ok(unreachable, 'B et C ne relient plus A');
  assert.ok(blocked && blocked.unreachableFrontIds.includes(B.id) && blocked.unreachableFrontIds.includes(C.id));
});

const sealedAnnounced = () => {
  const { marks } = sealed;
  const panelSaysBlocked = [marks.afterCut.alerteB, marks.afterCut.alerteC].every(text => /route|passage|bloqu|inaccessible|ordre distant|rouvr/i.test(text));
  const feedHasBlocked = marks.afterCut.hudAlertTypes.includes('critical_return_route_blocked');
  return { panelSaysBlocked, feedHasBlocked };
};
{
  const status = sealedAnnounced(), { marks } = sealed;
  evidence.clauses.push({ id: 'REC-003-3b', texte: "Aucune alerte urgente ne demande un trajet impossible sans l'annoncer (ou la mission signale qu'un ordre distant est nécessaire).",
    verdict: status.panelSaysBlocked || status.feedHasBlocked ? 'conforme' : 'non conforme',
    preuve: { alerteAffichee_B: marks.afterCut.alerteB, alerteAffichee_C: marks.afterCut.alerteC, typesAlertesHUD: marks.afterCut.hudAlertTypes, resultat: marks.result },
    defaut: status.panelSaysBlocked || status.feedHasBlocked ? null : {
      resume: 'Après la coupure totale, le panneau affiche toujours « DÉFAITE IMMINENTE — REPRENEZ LE FRONT » avec le compte à rebours, sans signaler que le front est inaccessible ni proposer d’ordre distant ; l’échéance expire et la mission est perdue.',
      emplacements: [
        'js/ui/OperationPanel.js:15-21 — operationAlertState() construit l’alerte urgente depuis criticalFronts sans lire unreachableFrontIds.',
        'js/battlefield/BattleIntel.js:114-121 — allowsEvent() exige un rapport de front observé après l’événement ; A étant tombé sans observateur allié, critical_return_route_blocked (priorité 4) est filtré de hud.alerts.',
        'js/battlefield/BattleSimulation.js:1112-1122 — la perte critique garde son échéance alors que unreachableFrontIds couvre tous les autres fronts ; la défaite survient à l’échéance.'],
      reproduction: 'node --test tests/recette-rec-003.test.js (variante passage_scelle_apres_capture) : pilote gunnison_forest, mapSeed 20261114, attaque de A à t=40 s, fermeture de route-insertion-relay-main et route-insertion-relay-flank à la capture de A, lecture de operationAlertState(getHUDState()).' } });
}

test('REC-003 — passage scellé : l’alerte urgente annonce l’impossibilité du trajet', () => {
  const status = sealedAnnounced();
  assert.ok(status.panelSaysBlocked || status.feedHasBlocked, 'la coupure doit être annoncée au joueur');
});

test('REC-003 — captures d’écran des alertes non automatisables', () => {
  evidence.clauses.push({ id: 'REC-003-4', texte: 'Captures des alertes (preuve à conserver).', verdict: 'non automatisable',
    raison: 'Pas de rendu headless : seules les chaînes d’alerte du panneau sont journalisées. Les captures d’écran restent à produire dans le navigateur.' });
  assert.ok(evidence.variantes.ouvert.capturesAlertes.length > 0);
});

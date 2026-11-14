// Recette REC-023 — deux joueurs sur des fronts séparés (EFF-07, coop locale).
// Audit 2026-10-26, feuille Validation. Opération catalogue AFF-14 lancée
// comme le jeu le fait en coopération (createOperationScene, players: 2,
// mapSeed 0) ; ses allocations sont comparées au budget EFF-07.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { OperationObjectives } from '../js/battlefield/OperationObjectives.js';
import { physicalOperationRouteAvailable } from '../js/battlefield/PhysicalRouteAvailability.js';
import { combatRewardIdentity } from '../js/battlefield/OperationRewards.js';
import { getBattleBudget, getBattleOperationConfig } from '../js/data/BattleCatalog.js';

const ROOT = new URL('..', import.meta.url).pathname;
const COMMIT = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const DIRTY = execSync('git status --porcelain -- js', { cwd: ROOT }).toString().split('\n').filter(Boolean);
const OUT = `${ROOT}docs/qa/recettes-20261114/rec-023.json`;
const STEP = 0.25, MAP_SEED = 0;
const evidence = {
  recette: 'REC-023', titre: 'Deux joueurs sur des fronts séparés',
  source: 'docs/audits/2026-10-26/Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx#Validation!REC-023',
  dateExecution: '2026-11-14', commit: COMMIT, sourcesJsNonCommitees: DIRTY, graine: { operation: 'AFF-14', joueurs: 2, mapSeed: MAP_SEED, pasSimulation: STEP },
  commande: 'node --test tests/recette-rec-023.test.js',
  preuveVideo: 'non produite — preuve par journal de simulation',
  scenario: {}, clauses: [],
};
const clause = (id, texte, verdict, details = {}) => { evidence.clauses.push({ id, texte, verdict, ...details }); return verdict === 'prouvé'; };
after(() => { mkdirSync(new URL('.', `file://${OUT}`).pathname, { recursive: true }); writeFileSync(OUT, JSON.stringify(evidence, null, 1) + '\n'); });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const run = (() => {
  const { config, layout } = createOperationScene({ operationId: 'AFF-14', players: 2, mapSeed: MAP_SEED });
  const env = { battlefieldLayout: layout, isGateOpen: () => true, isTacticalRouteAvailable: () => true };
  const events = [], spawns = [], live = new Map(), duplicateActors = [];
  let sim = null;
  sim = new BattleSimulation(config, {
    spawnGroup: (group, units) => { for (const u of units) { if (live.has(u.id)) duplicateActors.push([sim.time, u.id]); live.set(u.id, group.id); } spawns.push([sim.time, 'spawn', group.id, units.length]); return true; },
    despawnGroup: (group, units) => { for (const u of units) live.delete(u.id); spawns.push([sim.time, 'despawn', group.id, units.length]); return units.map(u => ({ id: u.id, hp: u.hp, position: u.position })); },
    announce: event => events.push(event), routeAvailabilityProvider: (route, options) => physicalOperationRouteAvailable(env, route, options) });
  const objectives = new OperationObjectives(config, sim, { onEvent: event => events.push({ ...event, source: 'objectives' }) });
  const front = id => sim.fronts.get(id);
  const p1 = { id: 'player1', hp: 100, position: [...front('front_a').position] }, p2 = { id: 'player2', hp: 100, position: [...front('front_b').position] };
  const bossId = [...sim.units.values()].find(u => u.uniqueId === 'BOS-32').id, bossGroup = sim.units.get(bossId).groupId;
  const samples = [], script = [], log = []; const at = (t, label, action) => script.push({ t, label, action });
  const sharedGroupWindow = { from: 60, to: 90 }, bossWindow = { from: 100, to: 140 };
  let sharedGroup = null, rewardIds = [];
  at(20, 'J2 lance le sabotage du tunnel B', () => { const task = objectives.spec.tasks.find(t => t.id === 'tunnel_one'); p2.position = [...task.position]; return objectives.interact({ ...p2 }); });
  at(20.5, 'J1 tente le même dispositif (même tâche)', () => { const saved = [...p1.position]; const task = objectives.spec.tasks.find(t => t.id === 'tunnel_one'); const answer = objectives.interact({ id: 'player1', hp: 100, position: task.position }); p1.position = saved; return answer; });
  at(60, 'J2 rejoint la zone de J1 (chevauchement des bulles)', () => { p2.position = [front('front_a').position[0] + 10, front('front_a').position[1] + 6]; return { p2: p2.position }; });
  at(61, 'groupe partagé repéré dans les deux bulles', () => { sharedGroup = [...sim.groups.values()].find(g => g.materialized && g.frontId === 'front_a' && g.factionId === 'hive')?.id ?? null; return { sharedGroup }; });
  const nearBoss = offset => { const b = sim.units.get(bossId).position; return [b[0] - 30, b[1] + offset]; };
  at(100, 'J1 passe par le boss nommé (front C, à 30 m)', () => { p1.position = nearBoss(0); return { p1: p1.position, boss: sim.getUnit(bossId).position, etatBoss: sim.getUnit(bossId).state }; });
  at(110, 'J2 passe par le boss nommé (front C, à 30 m)', () => { p2.position = nearBoss(8); return { p2: p2.position, etatBoss: sim.getUnit(bossId).state }; });
  at(125, 'mort du boss signalée par les deux joueurs (callbacks acteurs)', () => {
    const first = sim.recordDeath({ entityId: bossId, killerFaction: 'player_clan', cause: 'hunter_melee' }), second = sim.recordDeath({ entityId: bossId, killerFaction: 'player_clan', cause: 'player2_combo' });
    const death = events.find(e => e.type === 'unit_died' && e.entityId === bossId); const game = { rewardSessionId: 'rec-023-run' };
    rewardIds = [combatRewardIdentity(game, death).id, combatRewardIdentity(game, { ...death }).id];
    for (const e of events.filter(e => e.type === 'unit_died' && e.entityId === bossId)) objectives.recordEvent(e);
    return { premier: first, second, rewardIds };
  });
  let next = 0, prevC = null;
  for (let tick = 0; tick * STEP < 160; tick++) {
    while (next < script.length && script[next].t <= sim.time + 1e-9) { const item = script[next++]; log.push({ t: sim.time, label: item.label, result: item.action() }); }
    sim.update(STEP, { players: [p1, p2] }); objectives.update(STEP, [p1, p2]);
    const bubble = player => new Set([...sim.fronts.values()].filter(f => dist(player.position, f.position) <= f.radius * 1.5).map(f => f.id));
    const b1 = bubble(p1), b2 = bubble(p2), active = sim.getActiveUnits();
    const inB1 = active.filter(u => b1.has(sim.groups.get(u.groupId).frontId)), inB2 = active.filter(u => b2.has(sim.groups.get(u.groupId).frontId));
    const counts = sim.getCounts(), cUnits = [...sim.units.values()].filter(u => sim.groups.get(u.groupId).frontId === 'front_c');
    const cState = { damage: +cUnits.reduce((s, u) => s + u.damageTaken, 0).toFixed(1), dead: cUnits.filter(u => u.state === 'dead').length, owner: front('front_c').owner };
    samples.push({ t: sim.time, horloge: sim.time, actifsTotal: active.length, actifsUniques: new Set(active.map(u => u.id)).size,
      parFaction: Object.fromEntries(Object.entries(counts).map(([f, c]) => [f, c.active])), bulle1: inB1.length, bulle2: inB2.length,
      intersection: inB1.filter(u => inB2.some(v => v.id === u.id)).length, frontsJ1: [...b1], frontsJ2: [...b2], frontC: cState,
      groupePartageSpawns: sharedGroup ? spawns.filter(s => s[2] === sharedGroup && s[1] === 'spawn' && s[0] >= sharedGroupWindow.from).length : null });
    prevC = cState;
  }
  return { sim, config, objectives, events, spawns, samples, log, duplicateActors, bossId, bossGroup, sharedGroup, sharedGroupWindow, bossWindow, rewardIds, hud: sim.getHUDState(), objectivesHud: objectives.getHUDState() };
})();

const { sim, samples } = run;
const budget07 = getBattleBudget('EFF-07');
const eff07 = getBattleOperationConfig('AFF-14', { budgetId: 'EFF-07', playerCount: 2 });
const pick = (from, to) => samples.filter(s => s.t > from && s.t <= to);
evidence.scenario = { operation: 'AFF-14', configDigest: sim.digest, budgetLance: sim.config.budgetId, contexteJoueurs: sim.config.context.players,
  budgetEFF07: { ennemi: budget07.enemy, allie: budget07.ally, joueurs: budget07.playerActive, note: budget07.notes },
  allocationsCoopJeu: sim.config.budgets.byFaction, allocationsEFF07Catalogue: eff07.budgets.byFaction, plafondDetaille: sim.budgets.active, desiredActive: sim.config.budgets.desiredActive,
  script: run.log, detailBoss: run.spawns.filter(s => s[2] === run.bossGroup), releves: { pas: '1 relevé sur 8 (2 s)', lignes: samples.filter((_, i) => i % 8 === 7) }, journalDetail: run.spawns.slice(0, 120),
  chronologieFronts: run.events.filter(e => e.priority >= 2 && e.source !== 'objectives').slice(0, 120).map(e => [e.time, e.type, e.frontId ?? e.targetFrontId ?? null, e.groupId ?? e.entityId ?? null]),
  hudFinal: { fronts: run.hud.fronts.map(f => ({ id: f.id, owner: f.owner, contested: f.contested, sourceHP: f.sourceHP })), alertes: run.hud.alerts.map(a => [a.time, a.type, a.frontId ?? a.targetFrontId ?? null]), counts: run.hud.counts } };

test('EFF-07 : la coop du jeu alloue exactement les effectifs EFF-07 (mêmes totaux et réserves)', () => {
  const same = JSON.stringify(sim.config.budgets.byFaction) === JSON.stringify(eff07.budgets.byFaction);
  const totals = sim.getCounts().hive.allocated === budget07.enemy.total && sim.getCounts().player_clan.allocated === budget07.ally.total;
  clause('C0', 'Effectifs EFF-07 conservés en coop (1 000 ennemis, 48 alliés, 2 joueurs hors effectifs)', same && totals ? 'prouvé' : 'échec', { allocationsCoop: sim.config.budgets.byFaction, allocationsEFF07: eff07.budgets.byFaction,
    remarque: `La coop du jeu lance AFF-14 avec le budget de l’opération (EFF-03) et context.players=2 ; EFF-07 a les mêmes totaux. Cible EFF-07 de 128 ennemis actifs (64 par bulle) non atteinte : plafond provisoire de ${sim.budgets.active} acteurs détaillés (AGENTS.md, contrat 2), à mesurer sur matériel avant tout relèvement.` });
  assert.ok(same && totals);
});

test('Horloge et bataille communes ; les deux bulles partagent un seul budget global', () => {
  const separated = pick(1, 60), overlap = pick(61, 90);
  const withinBudget = samples.every(s => s.actifsTotal <= sim.budgets.active && s.actifsTotal === s.actifsUniques && Object.entries(s.parFaction).every(([f, n]) => n <= sim.config.budgets.byFaction[f].active));
  const bothBubbles = separated.some(s => s.bulle1 > 0 && s.bulle2 > 0) && separated.every(s => s.intersection === 0 && s.bulle1 + s.bulle2 <= sim.budgets.active);
  const oneClock = samples.every((s, i) => s.horloge === (i + 1) * STEP);
  const maxSeparated = Math.max(...separated.map(s => s.bulle1 + s.bulle2));
  const ok = withinBudget && bothBubbles && oneClock;
  clause('C1', 'Horloge commune ; les deux bulles partagent le budget global (compteurs globaux et par bulle)', ok ? 'prouvé' : 'échec', { plafond: sim.budgets.active, maxBulle1PlusBulle2Separees: maxSeparated,
    exemplesSepares: separated.filter((_, i) => i % 40 === 0).map(s => ({ t: s.t, bulle1: s.bulle1, bulle2: s.bulle2, total: s.actifsTotal, parFaction: s.parFaction })) });
  assert.ok(ok);
});

test('Chevauchement des bulles : groupe partagé et boss nommé comptés et matérialisés une seule fois', () => {
  const overlap = pick(61, 90);
  const sharedOnce = run.sharedGroup && run.spawns.filter(s => s[2] === run.sharedGroup && s[1] === 'spawn' && s[0] > run.sharedGroupWindow.from && s[0] <= run.sharedGroupWindow.to).length === 0 &&
    overlap.every(s => s.actifsTotal === s.actifsUniques && s.intersection <= s.actifsTotal && s.actifsTotal <= sim.budgets.active);
  const bossSpawns = run.spawns.filter(s => s[2] === run.bossGroup && s[1] === 'spawn' && s[0] >= run.bossWindow.from - 10 && s[0] <= run.bossWindow.to);
  const bossDeaths = run.events.filter(e => e.type === 'unit_died' && e.entityId === run.bossId && e.source !== 'objectives');
  const matriarch = run.objectives.serialize().tasks.find(t => t.id === 'matriarch');
  const ok = sharedOnce && run.duplicateActors.length === 0 && bossSpawns.length === 1 && run.log.find(row => row.label.startsWith('J2 passe'))?.result.etatBoss === 'active' && bossDeaths.length === 1 && sim.deaths.get(run.bossId).cause === 'hunter_melee' && matriarch.completions === 1 && new Set(run.rewardIds).size === 1;
  clause('C2', 'Le chevauchement ne duplique ni groupe, ni boss, ni récompense', ok ? 'prouvé' : 'échec', { groupePartage: run.sharedGroup, spawnsGroupePartagePendantChevauchement: run.spawns.filter(s => s[2] === run.sharedGroup && s[0] > 60 && s[0] <= 90),
    acteursDupliques: run.duplicateActors, boss: { id: run.bossId, groupe: run.bossGroup, spawns: bossSpawns, morts: bossDeaths.length, cause: sim.deaths.get(run.bossId).cause, tache: matriarch }, recompense: { identifiants: run.rewardIds, fonction: 'combatRewardIdentity (js/battlefield/OperationRewards.js:3)' },
    chevauchement: overlap.filter((_, i) => i % 20 === 0).map(s => ({ t: s.t, bulle1: s.bulle1, bulle2: s.bulle2, intersection: s.intersection, total: s.actifsTotal })) });
  assert.ok(ok);
});

test('Renforts non dupliqués par la présence de deux joueurs', () => {
  const inbound = run.events.filter(e => e.type === 'reinforcements_inbound');
  const perFactionInterval = {};
  for (const e of inbound) { const key = `${e.factionId}:${Math.floor((e.time - 1e-9) / sim.budgets.spawnInterval)}`; perFactionInterval[key] = (perFactionInterval[key] ?? 0) + 1; }
  const reaction = run.events.filter(e => e.source === 'objectives' && e.type === 'counteroffensive_announced');
  const partnerRefused = run.log.find(row => row.label.startsWith('J1 tente'))?.result;
  const uniqueGroups = new Set(inbound.map(e => e.groupId)).size === inbound.length;
  const reserveDrop = run.sim.config.budgets.byFaction.hive.reserve - sim.getCounts().hive.reserve;
  const arrivedHive = run.events.filter(e => e.type === 'reinforcements_arrived' && sim.groups.get(e.groupId).factionId === 'hive').reduce((s, e) => s + sim.groups.get(e.groupId).units.length, 0);
  const ok = Object.values(perFactionInterval).every(n => n <= 2) && uniqueGroups && reaction.length <= 1 && partnerRefused?.accepted === false && reserveDrop === arrivedHive;
  clause('C3', 'Le chevauchement ne duplique aucun renfort ; une tâche partagée ne déclenche qu’une réaction', ok ? 'prouvé' : 'échec', { annoncesParFactionEtIntervalle: perFactionInterval, groupesUniques: uniqueGroups,
    reactionAnnoncee: reaction, refusPartenaire: partnerRefused, reserveRucheConsommee: reserveDrop, unitesArriveesRuche: arrivedHive,
    note: 'Au plus deux annonces par faction et par intervalle : une automatique (par faction, indépendante du nombre de joueurs) et, au besoin, une réaction d’objectif.' });
  assert.ok(ok);
});

test('Le front C continue hors de vue ; l’information nécessaire est publiée pour les deux joueurs', () => {
  const c = pick(0, 100).map(s => s.frontC), changed = c.at(-1).damage > c[0].damage || c.at(-1).dead > c[0].dead;
  const unseen = pick(0, 100).every(s => !s.frontsJ1.includes('front_c') && !s.frontsJ2.includes('front_c'));
  const hud = run.hud, fronts = new Set(hud.fronts.map(f => f.id));
  const alertsFronts = new Set(run.events.filter(e => e.priority >= 2 && (e.frontId || e.targetFrontId)).map(e => e.frontId ?? e.targetFrontId));
  const ok = changed && unseen && ['front_a', 'front_b', 'front_c'].every(f => fronts.has(f)) && alertsFronts.size >= 2;
  clause('C4', 'Le front C continue hors de vue ; chaque joueur reçoit les informations nécessaires (HUD stratégique partagé)', ok ? 'prouvé' : 'échec', { frontC: { debut: c[0], fin: c.at(-1) }, frontCHorsDesBulles: unseen,
    hud: { fronts: [...fronts], frontsAlertes: [...alertsFronts], alertesFinales: hud.alerts.length },
    limite: 'Le HUD stratégique est unique et partagé ; la répartition à l’écran (écran scindé, carte de commande par joueur) n’est pas rendue en node:test (cf. tests/command-map-coop-selection.test.js pour la sélection du joueur émetteur).' });
  assert.ok(ok);
});

test('Non automatisable : capture des deux vues', () => {
  clause('NA1', 'Capture des deux vues (écran scindé) et lisibilité de l’information par joueur', 'non automatisable', { raison: 'Exige Renderer.setSplitScreen, le HUD DOM et une revue visuelle ; aucun rendu en node:test.' });
  assert.ok(true);
});

// Recette REC-019 (audit du 26/10/2026, feuille Validation) — boss dépendant de
// la bataille. Opération AFF-14 (Lethe : deux voies de ruche, Praetorian BOS-32,
// extraction au front A), graine figée. Quatre parties comparables :
// tunnels ouverts/fermés × extraction intacte/menacée. Aucun code source modifié.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { OperationObjectives } from '../js/battlefield/OperationObjectives.js';

const ID = 'REC-019', OPERATION = 'AFF-14', BOSS = 'BOS-32', SEED = 1114;
const ROOT = new URL('../', import.meta.url);
const commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const clauses = [], replays = [];
function check(key, attendu, fn) {
  try { const details = fn(); clauses.push({ clause: key, attendu, verdict: 'prouvé', details }); return details; }
  catch (error) { clauses.push({ clause: key, attendu, verdict: 'échec', details: String(error.message).slice(0, 600) }); throw error; }
}
after(() => {
  const out = new URL('docs/qa/recettes-20261114/', ROOT); mkdirSync(out, { recursive: true });
  writeFileSync(new URL(`${ID.toLowerCase()}.json`, out), JSON.stringify({
    id: ID, source: 'docs/audits/2026-10-26/Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx#Validation',
    perimetre: 'Boss dépendant de la bataille', operation: OPERATION, boss: BOSS, seed: SEED, commit, date: '2026-11-14',
    commande: 'node --test tests/recette-rec-019.test.js', preuveVideo: 'non produite — preuve par journal',
    replaysComparatifs: replays, clauses,
    nonAutomatisable: [{ element: 'arène et combat du boss à l’écran', raison: 'pas de rendu ni de BossManager en Node ; l’arène est le front C simulé, le combat est réduit à la mort enregistrée de l’unité allouée.' }],
    limites: ['AFF-14 : les routes stratégiques ne sont pas liées aux portes physiques (voir REC-012) ; la route du boss est ici la route logique du front C vers A.']
  }, null, 2) + '\n');
});

const player = position => ({ id: 'p1', hp: 1000, position: [...position] });
function step(f, seconds, actor) {
  for (let t = 0; t < seconds; t += .25) { f.sim.update(.25, { players: actor ? [actor] : [] }); f.objectives.update(.25, actor ? [actor] : []); }
}
function channel(f, taskId) {
  const task = f.objectives.getHUDState().tasks.find(item => item.id === taskId), actor = player(task.position);
  const answer = f.objectives.interact(actor);
  if (answer.accepted) step(f, task.duration + .5, actor);
  return { taskId, accepted: answer.accepted, feedback: answer.feedback, status: f.objectives.getHUDState().tasks.find(item => item.id === taskId).status };
}
const owner = (f, id) => f.sim.fronts.get(id).owner;
const livingAt = (f, factionId, frontId) => [...f.sim.units.values()].filter(u => u.factionId === factionId && u.hp > 0 && u.state !== 'reserve' && f.sim.groups.get(u.groupId).frontId === frontId).length;

function replay({ tunnels, extraction }) {
  const { config } = createOperationScene({ operationId: OPERATION, mapSeed: SEED });
  config.ai = { ...(config.ai ?? {}), interval: 300 }; // keep the comparison about player objectives, not officer timing
  const events = [];
  const sim = new BattleSimulation(config, { spawnGroup: (group) => { events.push({ type: 'materialized', groupId: group.id }); return true; }, despawnGroup: () => [] });
  const objectives = new OperationObjectives(config, sim, { onEvent: event => events.push({ type: event.type, taskId: event.taskId ?? null, t: event.time }) });
  const f = { config, sim, objectives, events }, log = { scenario: `tunnels_${tunnels}+extraction_${extraction}`, chronologie: [] };
  const mark = (event, extra = {}) => log.chronologie.push({ t: sim.time, event, ...extra });
  const boss = [...sim.units.values()].find(u => u.uniqueId === BOSS), bossGroup = sim.groups.get(boss.groupId);
  mark('debut', { boss: boss.id, frontBoss: bossGroup.frontId, sourcesRuche: [...sim.fronts.values()].filter(fr => fr.owner === 'hive').map(fr => [fr.id, fr.sourceHP]) });
  // Two allies die before the boss; their loss must survive the boss's death.
  const allies = [...sim.units.values()].filter(u => u.factionId === 'player_clan' && u.state !== 'reserve').slice(0, 2);
  for (const ally of allies) sim.recordDeath({ entityId: ally.id, killerFaction: 'hive', cause: 'rec019_prior_loss' });
  if (tunnels === 'fermes') { mark('sabotage', channel(f, 'tunnel_one')); mark('sabotage', channel(f, 'tunnel_two')); }
  if (extraction === 'menacee') { sim.captureBase('front_a', 'hive', 'rec019_extraction_threat'); mark('extraction_menacee', { ownerA: owner(f, 'front_a') }); }
  // Reach the boss front with a living player.
  const arena = sim.fronts.get(bossGroup.frontId), approach = player([arena.position[0] + arena.radius * 1.2, arena.position[1]]);
  const hiveBefore = livingAt(f, 'hive', arena.id);
  const support = sim.requestReinforcements('hive', arena.id);
  step(f, 20, approach);
  const context = { front: arena.id, renfortVersBoss: { accepted: support.accepted, reason: support.reason ?? null, source: support.sourceId ?? null, count: support.count ?? 0 },
    sourcesRuche: Object.fromEntries([...sim.fronts.values()].map(fr => [fr.id, { owner: fr.owner, sourceHP: fr.sourceHP }])),
    rucheVivanteAuFrontBoss: { avant: hiveBefore, apres20s: livingAt(f, 'hive', arena.id) },
    bossMaterialise: events.some(e => e.type === 'materialized' && e.groupId === bossGroup.id),
    extraction: (() => { const task = objectives.getHUDState().tasks.find(t => t.id === 'lethe_exit'); return { disponible: task.available, raison: objectives._blocked(objectives.tasks.get('lethe_exit'), player(task.position)) }; })() };
  mark('arrivee_boss', context);
  // The boss's own movement: a cause (order) and an open logical route, never a teleport.
  const toA = sim.issueOrder(bossGroup.id, { type: 'attack', frontId: 'front_a', issuer: 'rec019_boss' });
  const bossRoute = { accepted: toA.accepted, reason: toA.reason ?? null, chemin: toA.path?.map(leg => leg.routeId) ?? null };
  // While materialized the real actor owns its pose; once the player leaves the
  // arena the simulation moves the finite group along its declared path.
  const before = [...sim.groups.get(bossGroup.id).position]; step(f, 10, null);
  bossRoute.deplacement10s = Math.round(Math.hypot(sim.groups.get(bossGroup.id).position[0] - before[0], sim.groups.get(bossGroup.id).position[1] - before[1]) * 100) / 100;
  bossRoute.frontApres10s = sim.groups.get(bossGroup.id).frontId;
  bossRoute.longueurRoute = Math.round(toA.path?.reduce((sum, leg) => sum + sim.routes.get(leg.routeId).waypoints.slice(1).reduce((s, p, i, a) => s + Math.hypot(p[0] - sim.routes.get(leg.routeId).waypoints[i][0], p[1] - sim.routes.get(leg.routeId).waypoints[i][1]), 0), 0) ?? 0);
  mark('route_boss', bossRoute);
  // Kill the allocated boss and observe what does NOT come back.
  const preKill = { alliesMorts: allies.map(a => [a.id, sim.units.get(a.id).state, sim.units.get(a.id).hp]), ownerA: owner(f, 'front_a'),
    sources: Object.fromEntries([...sim.fronts.values()].map(fr => [fr.id, fr.sourceHP])), tunnels: ['tunnel_one', 'tunnel_two'].map(id => objectives.tasks.get(id).status) };
  sim.recordDeath({ entityId: boss.id, killerFaction: 'player_clan', cause: 'rec019_boss_kill' });
  objectives.recordEvent({ type: 'unit_died', data: { uniqueId: BOSS } }); step(f, 1, approach);
  const postKill = { alliesMorts: allies.map(a => [a.id, sim.units.get(a.id).state, sim.units.get(a.id).hp]), ownerA: owner(f, 'front_a'),
    sources: Object.fromEntries([...sim.fronts.values()].map(fr => [fr.id, fr.sourceHP])), tunnels: ['tunnel_one', 'tunnel_two'].map(id => objectives.tasks.get(id).status),
    matriarch: objectives.tasks.get('matriarch').status, rucheVivante: [...sim.units.values()].filter(u => u.factionId === 'hive' && u.hp > 0).length };
  mark('boss_tue', { avant: preKill, apres: postKill });
  // Aftermath: attempt the extraction.
  const exit = channel(f, 'lethe_exit');
  const result = objectives.getResult() ?? sim.result ?? null;
  const consequences = sim.getCampaignConsequences();
  mark('extraction', { ...exit, resultat: result && { outcome: result.outcome, reason: result.reason } });
  Object.assign(log, { contexteBoss: context, routeBoss: bossRoute, avantMort: preKill, apresMort: postKill, extractionFinale: exit,
    issue: result ? { outcome: result.outcome, reason: result.reason } : { outcome: 'en_cours', reason: exit.feedback },
    consequences: { defeatedUniqueIds: consequences.defeatedUniqueIds, comptes: sim.getCounts() } });
  replays.push(log); objectives.dispose(); sim.dispose();
  return log;
}

test('REC-019 — previous objectives change the boss context and its aftermath (four comparable replays)', () => {
  const runs = {};
  for (const tunnels of ['ouverts', 'fermes']) for (const extraction of ['intacte', 'menacee']) runs[`${tunnels}/${extraction}`] = replay({ tunnels, extraction });
  check('contexte_boss_depend_des_tunnels', 'Les objectifs précédents changent le contexte du boss : tunnels ouverts → renfort de ruche vers l’arène ; fermés → aucune source connectée.', () => {
    for (const extraction of ['intacte', 'menacee']) {
      const open = runs[`ouverts/${extraction}`].contexteBoss, shut = runs[`fermes/${extraction}`].contexteBoss;
      assert.equal(open.renfortVersBoss.accepted, true, `open tunnels feed the boss front (${extraction})`);
      assert.equal(shut.renfortVersBoss.accepted, false); assert.equal(shut.renfortVersBoss.reason, 'no_connected_supply_source');
      assert.equal(shut.sourcesRuche.front_b.sourceHP, 0); assert.equal(shut.sourcesRuche.front_c.sourceHP, 0);
      assert.ok(open.sourcesRuche.front_b.sourceHP > 0);
    }
    return Object.fromEntries(Object.entries(runs).map(([k, r]) => [k, r.contexteBoss.renfortVersBoss]));
  });
  check('fuite_extraction', 'Possibilités de fuite : l’extraction dépend des tunnels fermés et d’un front A tenu.', () => {
    assert.match(runs['ouverts/intacte'].contexteBoss.extraction.raison, /objectif préalable/);
    assert.equal(runs['fermes/intacte'].contexteBoss.extraction.disponible, true);
    assert.equal(runs['fermes/intacte'].issue.outcome, 'victory');
    assert.notEqual(runs['fermes/menacee'].issue.outcome, 'victory', 'a threatened extraction is not won by killing the boss');
    assert.notEqual(runs['ouverts/intacte'].issue.outcome, 'victory');
    return Object.fromEntries(Object.entries(runs).map(([k, r]) => [k, { extractionAvantBoss: r.contexteBoss.extraction, issue: r.issue }]));
  });
  check('arrivee_cause_route', 'L’arrivée du boss a une cause et une route : unité allouée du front C, matérialisée par la présence du joueur, déplacée seulement par un ordre sur une route ouverte.', () => {
    for (const run of Object.values(runs)) {
      assert.equal(run.contexteBoss.bossMaterialise, true);
      assert.equal(run.routeBoss.accepted, true); assert.deepEqual(run.routeBoss.chemin, ['route_1', 'route_0']);
      assert.equal(run.routeBoss.frontApres10s, 'front_c', 'no teleport to the destination front');
      assert.ok(run.routeBoss.deplacement10s > 0 && run.routeBoss.deplacement10s < run.routeBoss.longueurRoute / 4, JSON.stringify(run.routeBoss));
    }
    return Object.fromEntries(Object.entries(runs).map(([k, r]) => [k, r.routeBoss]));
  });
  check('mort_boss_ne_restaure_pas', 'Tuer le boss ne restaure pas automatiquement les objectifs perdus ou les alliés morts.', () => {
    for (const [key, run] of Object.entries(runs)) {
      assert.deepEqual(run.apresMort.alliesMorts, run.avantMort.alliesMorts, `${key}: dead allies stay dead`);
      assert.ok(run.apresMort.alliesMorts.every(([, state, hp]) => state === 'dead' && hp === 0));
      assert.deepEqual(run.apresMort.sources, run.avantMort.sources, `${key}: sources neither restored nor destroyed`);
      assert.deepEqual(run.apresMort.tunnels, run.avantMort.tunnels, `${key}: tunnel objectives are not auto-completed`);
      assert.equal(run.apresMort.matriarch, 'done');
      assert.ok(run.apresMort.rucheVivante > 0, `${key}: the hive is not wiped out by the boss death`);
      if (key.endsWith('menacee')) assert.equal(run.apresMort.ownerA, run.avantMort.ownerA, `${key}: lost extraction front is not handed back`);
    }
    return Object.fromEntries(Object.entries(runs).map(([k, r]) => [k, { avant: r.avantMort, apres: r.apresMort }]));
  });
  check('apres_combat_differe', 'L’après-combat diffère selon les objectifs précédents (issue, effectifs, conséquences).', () => {
    const outcomes = Object.fromEntries(Object.entries(runs).map(([k, r]) => [k, r.issue.outcome]));
    assert.ok(new Set(Object.values(outcomes)).size > 1, JSON.stringify(outcomes));
    for (const run of Object.values(runs)) assert.ok(run.consequences.defeatedUniqueIds.includes(BOSS));
    return { issues: outcomes, rucheVivanteApresBoss: Object.fromEntries(Object.entries(runs).map(([k, r]) => [k, r.apresMort.rucheVivante])) };
  });
});

test('REC-019 — observations on the AFF-14 extraction rule and campaign scope', () => {
  const { config } = createOperationScene({ operationId: OPERATION, mapSeed: SEED });
  const exit = config.operationObjectives.tasks.find(task => task.id === 'lethe_exit');
  assert.deepEqual(exit.requires, ['tunnel_one', 'tunnel_two']);
  assert.ok(exit.requiresAny.some(branch => branch.length === 1 && branch[0] === 'matriarch'));
  clauses.push({ clause: 'observation_branche_matriarch', attendu: 'Information : cohérence de la règle d’extraction.', verdict: 'observation',
    details: { fichier: 'js/battlefield/OperationObjectiveSpecs.js:54', requires: exit.requires, requiresAny: exit.requiresAny,
      note: 'La branche requiresAny [["matriarch"]] ne peut jamais suffire seule car requires impose déjà les deux tunnels ; tuer le Praetorian n’ouvre donc jamais l’extraction (conforme à « tuer le boss ne restaure pas tout », mais la branche est inopérante).' } });
  clauses.push({ clause: 'consequences_campagne', attendu: 'Bilan de victoire et conséquences de campagne.', verdict: 'partiel',
    details: { note: 'AFF-14 n’appartient à aucun arc de campagne (BATTLE_CAMPAIGN_ARCS ne couvre que AFF-01..05) : seules les conséquences locales getCampaignConsequences() sont produites et comparées ; aucune propagation inter-opérations n’est testable pour ce boss.',
      fichier: 'js/battlefield/BattleCampaignRecord.js:12-14' } });
});

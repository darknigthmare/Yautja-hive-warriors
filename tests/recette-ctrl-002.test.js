// Recette CTRL-002 (contrôle du 27/10/2026, AFF-13 Sevastopol) — exécution headless.
// Au niveau de la mission préparée, simulée et projetée dans les vrais
// gestionnaires : les Working Joes de GRP-50 restent des synthétiques Seegson,
// jamais des Marines humains ; 32 Joes et 8 adultes xénomorphes sont conservés.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { BATTLE_DIFFICULTIES } from '../js/battlefield/BattleStrategy.js';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';
import { SyntheticsManager } from '../js/entities/Synthetics.js';

const ID = 'CTRL-002', OPERATION = 'AFF-13', SEED = 1114, SEEDS = [0, 1114, 0xBEEF];
const ROOT = new URL('../', import.meta.url);
const commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const clauses = [], timeline = [], matrix = [];
function check(key, attendu, fn) {
  try { const details = fn(); clauses.push({ clause: key, attendu, verdict: 'prouvé', details }); return details; }
  catch (error) { clauses.push({ clause: key, attendu, verdict: 'échec', details: String(error.message).slice(0, 600) }); throw error; }
}
after(() => {
  const out = new URL('docs/qa/recettes-20261114/', ROOT); mkdirSync(out, { recursive: true });
  writeFileSync(new URL(`${ID}.json`, out), JSON.stringify({
    id: ID, source: 'docs/audits/2026-10-27/Yautja_Hive_Warriors_Controle_Completude_2026-10-27.xlsx#Controle_roster ; docs/audits/2026-10-27/implementation-followup-20261101.json',
    sujet: 'AFF-13 : Working Joes remplacés par humains', operation: OPERATION, seed: SEED, seedsMatrice: SEEDS, commit,
    date: '2026-11-14', commande: 'node --test tests/recette-ctrl-002.test.js', niveau: 'runtime mission (createOperationScene → BattleSimulation → BattleActorBridge → SyntheticsManager/ColonialMarinesManager réels, sans rendu WebGL)',
    preuveVideo: 'non produite — preuve par journal', matrice: matrix, chronologie: timeline, clauses,
    limites: ['Aucun rendu navigateur ni revue visuelle : la forme des Working Joes n’est pas certifiée 1:1.', 'Le moral de la faction synthétique reste le proxy human_morale déclaré par simulationLimitation.',
      'La relation neutre Joes/ruche est locale à AFF-13 ; le comportement fin des Joes face aux xénomorphes en mission visuelle reste à recetter.']
  }, null, 2) + '\n');
});

const audio = new Proxy({}, { get: () => () => {} });
/** Real human/synthetic managers; xeno, Yautja and boss managers are recorders
 * that keep the identity contract (same battleUnitId, a positioned mesh). */
function runtime(operationId, { seed = SEED, difficultyId = 'standard', players = 1 } = {}) {
  const scene = createOperationScene({ operationId, mapSeed: seed, difficultyId, players });
  const config = scene.config, three = new THREE.Scene();
  const env = { hasLineOfSight: () => true, resolveAgentMovement() {}, resolveMovement() {}, getElevationAt: () => 0 };
  const recorder = kind => ({ kind, spawned: [], spawnBattleUnit(unit) { this.spawned.push(unit.id);
    return { mesh: { position: new THREE.Vector3(unit.position[0], 0, unit.position[1]), userData: {} }, battleUnitId: unit.id, type: unit.actorType, radius: 1 }; },
  despawnBattleUnit() { return null; } });
  const marines = new ColonialMarinesManager(three, audio), synthetics = new SyntheticsManager(three, audio);
  const game = { horde: recorder('xenomorph'), marines, allies: recorder('yautja'), synthetics, bosses: recorder('queen'), env, player: null, player2: null };
  const bridge = new BattleActorBridge(game), projected = [];
  const sim = new BattleSimulation(config, {
    spawnGroup: (group, units) => { const ok = bridge.spawnGroup(group, units);
      if (ok) for (const unit of units) { const entry = bridge.actors.get(unit.id); projected.push({ unitId: unit.id, groupId: group.id, factionId: unit.factionId,
        species: unit.species, actorType: unit.actorType, manager: entry.manager === synthetics ? 'synthetics' : entry.manager === marines ? 'marines' : entry.manager.kind, actorTypeRendered: entry.actor.type }); }
      return ok; },
    despawnGroup: (group, units) => bridge.despawnGroup(group, units) });
  bridge.simulation = sim;
  for (const manager of [marines, synthetics]) { manager.battleSimulation = sim; manager.environment = env; }
  return { scene, config, sim, bridge, projected, marines, synthetics, dispose() { sim.dispose(); marines.clearSquad?.(); synthetics.clearSquad?.(); } };
}
/** Visit each front with a living player so the ordinary detail step chooses
 * the groups. Then project every remaining allocated group once. */
function visitAllFronts(r, seconds = 6) {
  for (const front of r.sim.fronts.values()) {
    const players = [{ id: 'p1', hp: 1000, position: [front.position[0] + front.radius * .9, front.position[1]] }];
    for (let t = 0; t < seconds; t += .25) r.sim.update(.25, { players });
    timeline.push({ t: r.sim.time, event: 'joueur_sur_front', frontId: front.id, acteursDetailles: r.bridge.actors.size });
  }
}
function projectEverything(r) {
  const seen = [];
  for (const group of r.sim.groups.values()) {
    const units = group.units.map(id => r.sim.units.get(id)).filter(unit => unit.hp > 0 && !r.bridge.actors.has(unit.id)).map(unit => structuredClone({ ...unit, position: unit.position }));
    if (!units.length) continue;
    const snapshot = r.sim._groupSnapshot(group);
    assert.equal(r.bridge.spawnGroup(snapshot, units), true, `${group.id}: ${r.bridge.lastError}`);
    for (const unit of units) { const entry = r.bridge.actors.get(unit.id);
      seen.push({ unitId: unit.id, factionId: unit.factionId, species: unit.species, actorType: unit.actorType, profileId: unit.profileId,
        manager: entry.manager === r.synthetics ? 'synthetics' : entry.manager === r.marines ? 'marines' : entry.manager.kind, rendered: entry.actor.type }); }
    r.bridge.despawnGroup(snapshot, units);
  }
  return seen;
}
const tally = rows => rows.reduce((acc, row) => { const key = `${row.factionId}|${row.species}|${row.actorType}|${row.manager}|${row.rendered ?? row.actorTypeRendered}`; acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});

const key = rel => [rel.a, rel.b].sort().join('|');

test('CTRL-002 — the AFF-13 mission keeps 32 GRP-50 Working Joes as Seegson synthetics and 8 adult xenomorphs', () => {
  const r = runtime(OPERATION);
  try {
    check('groupe_vers_profil', 'Associer GRP-50 au véritable manager des synthétiques et au profil Working Joe.', () => {
      const faction = r.config.factions.find(item => item.species === 'synthetic');
      assert.ok(faction); assert.equal(faction.label, 'Working Joes Seegson');
      const profiles = new Map(r.config.profiles.map(profile => [profile.id, profile]));
      const joes = r.config.groups.filter(group => group.sourceTemplateIds.includes('GRP-50')).flatMap(group => group.units.map(unit => ({ unit, group, profile: profiles.get(unit.profileId) })));
      assert.equal(joes.length, 32);
      for (const { unit, group, profile } of joes) { assert.equal(group.factionId, faction.id); assert.equal(profile.species, 'synthetic', unit.id);
        assert.equal(profile.actorType, 'working_joe', unit.id); assert.doesNotMatch(profile.id, /^original_human_/); }
      return { factionId: faction.id, label: faction.label, joes: joes.length, profils: [...new Set(joes.map(row => row.profile.id))] };
    });
    check('effectifs_source', 'Conserver 32 Joes et 8 adultes xénomorphes dans la force ennemie source, sans humain.', () => {
      const units = [...r.sim.units.values()];
      const joes = units.filter(u => u.actorType === 'working_joe' && u.species === 'synthetic');
      const xenos = units.filter(u => u.factionId === 'hive');
      assert.equal(joes.length, 32); assert.equal(xenos.length, 8);
      assert.equal(units.filter(u => u.species === 'human').length, 0);
      assert.equal(xenos.filter(u => u.uniqueId === 'BOS-34').length, 1, 'the Sevastopol stalker replaces one allocated adult');
      return { joes: joes.length, adultesXeno: xenos.length, traqueurBOS34: 1, humains: 0, comptes: r.sim.getCounts() };
    });
    check('relation_locale', 'Les Joes ne deviennent pas automatiquement une troisième armée anti-xéno : relation locale neutre Joes/ruche, hostiles au clan.', () => {
      assert.equal(r.sim.relationship('hive', 'human_force'), 'neutral');
      assert.equal(r.sim.relationship('player_clan', 'human_force'), 'hostile');
      return Object.fromEntries(r.config.relations.map(rel => [key(rel), rel.state]));
    });
    visitAllFronts(r);
    check('materialisation_naturelle', 'Les Joes détaillés par l’étape de détail sont rendus par SyntheticsManager en working_joe.', () => {
      const joes = r.projected.filter(row => row.actorType === 'working_joe');
      assert.ok(joes.length > 0, 'at least one Joe pair materializes');
      assert.ok(joes.every(row => row.manager === 'synthetics' && row.actorTypeRendered === 'working_joe'));
      assert.equal(r.projected.filter(row => row.manager === 'marines').length, 0);
      assert.equal(r.marines.marines.length, 0);
      return tally(r.projected);
    });
    const all = check('projection_totale', 'Chaque Joe alloué, projeté une fois, garde son espèce et son gestionnaire ; aucune unité n’est rendue en Marine.', () => {
      const live = new Set(r.bridge.actors.keys()), rows = projectEverything(r);
      const liveJoes = [...live].filter(id => r.sim.units.get(id).actorType === 'working_joe');
      const dead = [...r.sim.units.values()].filter(u => u.actorType === 'working_joe' && u.hp <= 0).length;
      const joes = rows.filter(row => row.actorType === 'working_joe');
      assert.equal(joes.length + liveJoes.length + dead, 32);
      assert.ok(joes.every(row => row.manager === 'synthetics' && row.rendered === 'working_joe'));
      assert.ok(liveJoes.every(id => r.bridge.actors.get(id).manager === r.synthetics));
      assert.ok(rows.every(row => row.manager !== 'marines'));
      assert.equal(r.sim.assertConservation(), true);
      return { projeteesMaintenant: rows.length, dejaProjetees: live.size, joesMortsAvantProjection: dead, repartition: tally(rows) };
    });
    timeline.push({ t: r.sim.time, event: 'projection_totale', repartition: all.repartition });
  } finally { r.dispose(); }
});

test('CTRL-002 — seeds, difficulties and co-op keep 32 Joes and no human', () => {
  check('matrice_graine_difficulte', 'Graine, difficulté et coopération ne remplacent pas les Joes.', () => {
    for (const seed of SEEDS) for (const difficultyId of Object.keys(BATTLE_DIFFICULTIES)) for (const players of [1, 2]) {
      const r = runtime(OPERATION, { seed, difficultyId, players });
      try {
        const units = [...r.sim.units.values()];
        const row = { seed, difficultyId, players, workingJoes: units.filter(u => u.actorType === 'working_joe' && u.species === 'synthetic').length,
          adultesXeno: units.filter(u => u.factionId === 'hive').length, humains: units.filter(u => u.species === 'human').length,
          relationRucheJoes: r.sim.relationship('hive', 'human_force') };
        matrix.push(row);
        assert.deepEqual([row.workingJoes, row.adultesXeno, row.humains, row.relationRucheJoes], [32, 8, 0, 'neutral'], JSON.stringify(row));
      } finally { r.dispose(); }
    }
    return { combinaisons: matrix.length };
  });
});

test('CTRL-002 — a saved AFF-13 mission reloads Working Joe identities unchanged', () => {
  const r = runtime(OPERATION);
  try {
    check('sauvegarde_recharge', 'Une recharge de sauvegarde courante conserve les 32 Joes, leur profil et leur relation locale.', () => {
      visitAllFronts(r, 2);
      const restored = BattleSimulation.fromState(r.config, r.sim.saveState());
      try {
        const pick = sim => [...sim.units.values()].filter(u => u.actorType === 'working_joe').map(u => [u.id, u.profileId, u.species]);
        assert.deepEqual(pick(restored), pick(r.sim)); assert.equal(pick(restored).length, 32);
        assert.equal(restored.relationship('hive', 'human_force'), 'neutral');
        return { joesRecharges: 32 };
      } finally { restored.dispose(); }
    });
  } finally { r.dispose(); }
});

test('CTRL-002 — observation: the legacy-checkpoint fallback builds AFF-13 Joes as generic humans', () => {
  const legacy = createOperationScene({ operationId: OPERATION, mapSeed: SEED, legacyRoster: true }).config;
  const profiles = new Map(legacy.profiles.map(p => [p.id, p]));
  const species = legacy.groups.filter(g => g.sourceTemplateIds.includes('GRP-50')).flatMap(g => g.units.map(u => profiles.get(u.profileId).species));
  assert.ok(species.every(item => item === 'human'));
  clauses.push({ clause: 'observation_compatibilite_ancienne_sauvegarde', attendu: 'Information (pas un critère du contrôle) : reprise des sauvegardes signées avant le roster source.',
    verdict: 'observation', details: { fichier: 'js/main.js:261-277 (repli legacyRoster) ; js/data/BattleCatalog.js:316 (rosterDetail legacy)', grp50EnHumainsDansLeRepli: species.length,
      relationLegacy: legacy.relations.find(rel => key(rel) === 'hive|human_force').state,
      note: 'Une ancienne sauvegarde AFF-13 reste simulée avec original_human_* et une relation ruche/Joes hostile ; repli volontaire mais hors du contrat CTRL-002.' } });
});

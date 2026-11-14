// Recette CTRL-001 (contrôle du 27/10/2026, AFF-16) — exécution headless.
// Vérifie au niveau de la mission réellement préparée (createOperationScene),
// simulée (BattleSimulation) puis projetée par BattleActorBridge dans les vrais
// gestionnaires de combat, que les synthétiques Weyland-Yutani de GRP-46 ne
// deviennent pas des humains. Aucun code source n'est modifié par cette recette.
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

const ID = 'CTRL-001', OPERATION = 'AFF-16', SEED = 1114, SEEDS = [0, 1114, 0xBEEF];
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
    sujet: 'AFF-16 : synthétiques Weyland-Yutani remplacés par humains', operation: OPERATION, seed: SEED, seedsMatrice: SEEDS, commit,
    date: '2026-11-14', commande: 'node --test tests/recette-ctrl-001.test.js', niveau: 'runtime mission (createOperationScene → BattleSimulation → BattleActorBridge → SyntheticsManager/ColonialMarinesManager réels, sans rendu WebGL)',
    preuveVideo: 'non produite — preuve par journal', matrice: matrix, chronologie: timeline, clauses,
    limites: ['Aucun rendu navigateur ni revue visuelle : la forme des maillages n’est pas certifiée 1:1.', 'Le moral de la faction synthétique reste le proxy human_morale déclaré par simulationLimitation.']
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

test('CTRL-001 — the AFF-16 mission keeps GRP-46 Weyland-Yutani synthetics as synthetic actors, never Marine humans', () => {
  const r = runtime(OPERATION);
  try {
    check('allocation_runtime', 'Conserver une faction synthetic et une correspondance explicite groupe → profil (GRP-46 → weyland_combat).', () => {
      const faction = r.config.factions.find(item => item.species === 'synthetic');
      assert.ok(faction, 'a synthetic faction exists in the prepared mission');
      const grp46 = r.config.groups.filter(group => group.sourceTemplateIds.includes('GRP-46'));
      assert.ok(grp46.length > 0);
      const profiles = new Map(r.config.profiles.map(profile => [profile.id, profile]));
      for (const group of grp46) { assert.equal(group.factionId, faction.id);
        for (const unit of group.units) { const profile = profiles.get(unit.profileId);
          assert.equal(profile.species, 'synthetic', unit.id); assert.equal(profile.actorType, 'weyland_combat', unit.id);
          assert.doesNotMatch(profile.id, /^original_human_/, unit.id); } }
      return { factionId: faction.id, label: faction.label, groupesGRP46: grp46.length, profils: [...new Set(grp46.flatMap(g => g.units.map(u => u.profileId)))] };
    });
    check('effectif_192', 'Vérifier les 192 synthétiques alloués sans ajouter d’humains ni modifier les comptes.', () => {
      const units = [...r.sim.units.values()], synth = units.filter(unit => unit.species === 'synthetic');
      assert.equal(synth.length, 192);
      assert.equal(units.filter(unit => unit.species === 'human').length, 0, 'no human is simulated in AFF-16');
      assert.equal(r.sim.assertConservation(), true);
      return { simules: units.length, synthetiques: synth.length, humains: 0, parFaction: r.sim.getCounts() };
    });
    visitAllFronts(r);
    check('materialisation_naturelle', 'Les unités détaillées par l’étape de détail (joueur présent) sont projetées dans SyntheticsManager, pas ColonialMarinesManager.', () => {
      const synth = r.projected.filter(row => row.species === 'synthetic');
      assert.ok(synth.length > 0, 'at least one GRP-46 squad materializes through the ordinary detail step');
      assert.ok(synth.every(row => row.manager === 'synthetics' && row.actorTypeRendered === 'weyland_combat'));
      assert.equal(r.marines.marines.length, 0); assert.equal(r.projected.filter(row => row.manager === 'marines').length, 0);
      return tally(r.projected);
    });
    const all = check('projection_totale', 'Chaque unité allouée de la mission, projetée une fois, garde son espèce et son gestionnaire.', () => {
      const live = new Set(r.bridge.actors.keys()), rows = projectEverything(r), synth = rows.filter(row => row.species === 'synthetic');
      const already = live;
      const liveSynth = [...live].filter(id => r.sim.units.get(id).species === 'synthetic');
      const deadSynth = [...r.sim.units.values()].filter(u => u.species === 'synthetic' && u.hp <= 0).length;
      assert.equal(synth.length + liveSynth.length + deadSynth, 192, 'every allocated synthetic is projected once or recorded dead');
      assert.ok(liveSynth.every(id => r.bridge.actors.get(id).manager === r.synthetics));
      assert.ok(synth.every(row => row.manager === 'synthetics' && row.rendered === 'weyland_combat'));
      assert.ok(rows.every(row => row.manager !== 'marines'), 'no unit of AFF-16 is rendered by the Marine manager');
      assert.equal(r.sim.assertConservation(), true);
      return { projeteesMaintenant: rows.length, dejaProjetees: already.size, synthetiquesMortsAvantProjection: deadSynth, repartition: tally(rows) };
    });
    timeline.push({ t: r.sim.time, event: 'projection_totale', repartition: all.repartition });
  } finally { r.dispose(); }
});

test('CTRL-001 — seeds, difficulties and co-op do not convert any allocated synthetic into a human', () => {
  check('matrice_graine_difficulte', 'Le changement de graine, de difficulté ou de nombre de joueurs ne remplace pas les synthétiques.', () => {
    for (const seed of SEEDS) for (const difficultyId of Object.keys(BATTLE_DIFFICULTIES)) for (const players of [1, 2]) {
      const r = runtime(OPERATION, { seed, difficultyId, players });
      try {
        const units = [...r.sim.units.values()];
        const row = { seed, difficultyId, players, synthetiques: units.filter(u => u.species === 'synthetic').length,
          humains: units.filter(u => u.species === 'human').length, profilsHumainsGeneriques: units.filter(u => /^original_human_/.test(u.profileId)).length };
        matrix.push(row);
        assert.deepEqual([row.synthetiques, row.humains, row.profilsHumainsGeneriques], [192, 0, 0], JSON.stringify(row));
      } finally { r.dispose(); }
    }
    return { combinaisons: matrix.length };
  });
});

test('CTRL-001 — a saved AFF-16 mission reloads its synthetic identities unchanged', () => {
  const r = runtime(OPERATION);
  try {
    check('sauvegarde_recharge', 'Une recharge de sauvegarde courante conserve espèce, profil et identifiant des synthétiques.', () => {
      visitAllFronts(r, 2);
      const restored = BattleSimulation.fromState(r.config, r.sim.saveState());
      try {
        const before = [...r.sim.units.values()].filter(u => u.species === 'synthetic').map(u => [u.id, u.profileId, u.actorType]);
        const afterRows = [...restored.units.values()].filter(u => u.species === 'synthetic').map(u => [u.id, u.profileId, u.actorType]);
        assert.deepEqual(afterRows, before); assert.equal(afterRows.length, 192);
        return { synthetiquesRecharges: afterRows.length };
      } finally { restored.dispose(); }
    });
  } finally { r.dispose(); }
});

test('CTRL-001 — observation: the legacy-checkpoint fallback still builds AFF-16 with generic human profiles', () => {
  // main.js:261-277 retries an OLD checkpoint (signed against the generic roster)
  // with legacyRoster:true. This keeps historical identities but means such a
  // reloaded mission still simulates the WY synthetics as original_human_*.
  const legacy = createOperationScene({ operationId: OPERATION, mapSeed: SEED, legacyRoster: true }).config;
  const profiles = new Map(legacy.profiles.map(p => [p.id, p]));
  const species = legacy.groups.filter(g => g.sourceTemplateIds.includes('GRP-46')).flatMap(g => g.units.map(u => profiles.get(u.profileId).species));
  assert.ok(species.every(item => item === 'human'));
  clauses.push({ clause: 'observation_compatibilite_ancienne_sauvegarde', attendu: 'Information (pas un critère du contrôle) : chemin de reprise des sauvegardes signées avant le roster source.',
    verdict: 'observation', details: { fichier: 'js/main.js:261-277 (repli legacyRoster) ; js/data/BattleCatalog.js:316 (rosterDetail legacy)', grp46EnHumainsDansLeRepli: species.length,
      note: 'Une ancienne sauvegarde AFF-16 rechargée reste simulée avec original_human_* ; ce repli est volontaire (identités signées), mais il réintroduit l’écart CTRL-001 pour ces sauvegardes.' } });
});

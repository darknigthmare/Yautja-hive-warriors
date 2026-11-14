// Recette CTRL-082 (contrôle du 27/10/2026, AFF-27 LV-742) — exécution headless.
// Au niveau de la mission préparée, simulée et projetée dans les vrais
// gestionnaires : les neuf rôles Extinction de GRP-60 (Infantry, Smartgunner,
// Flamethrower, Medic, CommTech, Synthetic, Sniper, SADAR, Exosuit) ne sont pas
// remplacés par des Marines génériques. Aucun code source n'est modifié.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { BATTLE_DIFFICULTIES } from '../js/battlefield/BattleStrategy.js';
import { EXTINCTION_VARIANTS } from '../js/battlefield/ExtinctionBattleVariant.js';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';
import { SyntheticsManager } from '../js/entities/Synthetics.js';

const ID = 'CTRL-082', OPERATION = 'AFF-27', SEED = 1114, SEEDS = [0, 1114];
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
    sujet: 'AFF-27 : neuf rôles Extinction remplacés par Marines génériques', operation: OPERATION, seed: SEED, seedsMatrice: SEEDS, commit,
    date: '2026-11-14', commande: 'node --test tests/recette-ctrl-082.test.js', niveau: 'runtime mission (createOperationScene → BattleSimulation → BattleActorBridge → ColonialMarinesManager/SyntheticsManager réels, sans rendu WebGL)',
    preuveVideo: 'non produite — preuve par journal', matrice: matrix, chronologie: timeline, clauses,
    limites: ['Les effectifs sont ceux de la proposition du projet, pas des nombres canoniques du RTS.', 'Aucune revue visuelle : sniper, SADAR, Exosuit, Medic et CommTech restent des maillages procéduraux non certifiés 1:1 (SOURCE_PRESENTATION_STATUS).']
  }, null, 2) + '\n');
});

const NINE = ['Infantry', 'Smartgunner', 'Flamethrower', 'Medic', 'CommTech', 'Synthetic', 'Sniper', 'SADAR', 'Exosuit'];
const roleOf = sourceRole => NINE.find(role => String(sourceRole ?? '').startsWith(role === 'Synthetic' ? 'Colonial Marines synthetic' : role)) ?? null;
const EXPECTED = { Infantry: 68, Smartgunner: 24, Flamethrower: 22, Medic: 24, CommTech: 24, Synthetic: 24, Sniper: 2, SADAR: 2, Exosuit: 2 };

const audio = new Proxy({}, { get: () => () => {} });
/** Real human/synthetic managers; xeno, Yautja and boss managers are recorders
 * that keep the identity contract (same battleUnitId, a positioned mesh). */
function runtime(operationId, { seed = SEED, difficultyId = 'standard', players = 1, extinctionVariant = 'none' } = {}) {
  const scene = createOperationScene({ operationId, mapSeed: seed, difficultyId, players, extinctionVariant });
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
        species: unit.species, actorType: unit.actorType, manager: entry.manager === synthetics ? 'synthetics' : entry.manager === marines ? 'marines' : entry.manager.kind, actorTypeRendered: entry.actor.type, visual: entry.actor.sourceVisualKind ?? null, label: entry.actor.profileName ?? null }); }
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
        manager: entry.manager === r.synthetics ? 'synthetics' : entry.manager === r.marines ? 'marines' : entry.manager.kind, rendered: entry.actor.type, visual: entry.actor.sourceVisualKind ?? null, sourceRole: r.sim.profiles.get(unit.profileId)?.sourceRole ?? null }); }
    r.bridge.despawnGroup(snapshot, units);
  }
  return seen;
}
const tally = rows => rows.reduce((acc, row) => { const key = `${row.factionId}|${row.species}|${row.actorType}|${row.manager}|${row.rendered ?? row.actorTypeRendered}`; acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});

const grp60 = sim => [...sim.units.values()].filter(u => sim.groups.get(u.groupId) && /_GRP-60_/.test(u.profileId));

test('CTRL-082 — AFF-27 simulates the nine GRP-60 Extinction roles in 192 finite places, none as a generic Marine', () => {
  const r = runtime(OPERATION);
  try {
    check('neuf_roles_alloues', 'Les 22 sections H-LIGNE et 2 H-APPUI de GRP-60 allouent 192 combattants répartis en neuf rôles, dont 24 Synthetic et 2 Exosuits pilotés.', () => {
      const groups = r.config.groups.filter(g => g.sourceTemplateIds.includes('GRP-60'));
      const units = [...r.sim.units.values()].filter(u => r.config.groups.find(g => g.id === u.groupId)?.sourceTemplateIds.includes('GRP-60'));
      const counts = Object.fromEntries(NINE.map(role => [role, units.filter(u => roleOf(r.sim.profiles.get(u.profileId).sourceRole) === role).length]));
      assert.equal(units.length, 192); assert.equal(groups.length, 24);
      assert.deepEqual(counts, EXPECTED);
      assert.equal(units.filter(u => roleOf(r.sim.profiles.get(u.profileId).sourceRole) === null).length, 0);
      return { sections: groups.length, places: units.length, parRole: counts };
    });
    check('aucun_marine_generique', 'Aucune place de GRP-60 n’utilise original_human_soldier/officer.', () => {
      const units = [...r.sim.units.values()].filter(u => r.config.groups.find(g => g.id === u.groupId)?.sourceTemplateIds.includes('GRP-60'));
      assert.equal(units.filter(u => /^original_human_/.test(u.profileId)).length, 0);
      return { profilsGeneriques: 0, profilsSource: [...new Set(units.map(u => u.profileId.replace(/_\d+$/, '')))] };
    });
    check('espece_vs_affiliation', 'Séparer l’espèce synthetic de l’affiliation USCM ; un pilote dans son Exosuit compte une fois.', () => {
      const units = [...r.sim.units.values()].filter(u => r.config.groups.find(g => g.id === u.groupId)?.sourceTemplateIds.includes('GRP-60'));
      const synth = units.filter(u => roleOf(r.sim.profiles.get(u.profileId).sourceRole) === 'Synthetic');
      assert.ok(synth.every(u => u.species === 'synthetic' && u.factionId === 'human_force'));
      assert.ok(units.filter(u => u.species === 'human').every(u => u.factionId === 'human_force'));
      const exo = units.filter(u => roleOf(r.sim.profiles.get(u.profileId).sourceRole) === 'Exosuit');
      assert.equal(exo.length, 2); assert.equal(new Set(exo.map(u => u.groupId)).size, 2, 'one pilot+frame identity per H-APPUI section');
      assert.ok(exo.every(u => u.exosuitArmor === 100), 'the frame is a finite stock on the same identity, not a second soldier');
      return { synthetiquesUSCM: synth.length, faction: 'human_force', exosuits: exo.map(u => ({ id: u.id, species: u.species, exosuitArmor: u.exosuitArmor })) };
    });
    visitAllFronts(r);
    check('materialisation_naturelle', 'Les places GRP-60 détaillées sont rendues avec leur rôle (arme ou visuel spécialiste), pas en Marine fusilier générique.', () => {
      const rows = r.projected.filter(row => row.factionId === 'human_force');
      assert.ok(rows.length > 0, 'at least one GRP-60 section materializes');
      return tally(rows);
    });
    const all = check('projection_totale', 'Chaque place allouée (192, mission fraîche avant tout combat), projetée une fois, conserve son rôle dans le gestionnaire réel.', () => {
      const fresh = runtime(OPERATION);
      try {
        const rows = projectEverything(fresh).filter(row => row.factionId === 'human_force');
        const byRole = {};
        for (const row of rows) { const role = roleOf(row.sourceRole); (byRole[role] ??= new Set()).add(`${row.manager}|${row.rendered}|${row.visual}`); }
        const expected = { Infantry: 'marines|marine|null', Smartgunner: 'marines|smartgunner|null', Flamethrower: 'marines|flametrooper|null',
          Medic: 'marines|marine|medic', CommTech: 'marines|marine|commtech', Synthetic: 'synthetics|weyland_combat|null',
          Sniper: 'marines|marine|sniper', SADAR: 'marines|marine|sadar', Exosuit: 'marines|marine|exosuit' };
        assert.equal(rows.length, 192);
        assert.deepEqual(Object.keys(byRole).sort(), Object.keys(expected).sort());
        for (const [role, signature] of Object.entries(expected)) assert.deepEqual([...byRole[role]], [signature], role);
        assert.equal(new Set(Object.values(expected)).size, 9, 'nine distinguishable runtime signatures');
        assert.equal(fresh.sim.assertConservation(), true);
        return { projetees: rows.length, signatures: Object.fromEntries(Object.entries(byRole).map(([k, v]) => [k, [...v]])),
          effectifsProjetesParRole: Object.fromEntries(NINE.map(role => [role, rows.filter(row => roleOf(row.sourceRole) === role).length])) };
      } finally { fresh.dispose(); }
    });
    timeline.push({ t: r.sim.time, event: 'projection_totale', signatures: all.signatures });
  } finally { r.dispose(); }
});

test('CTRL-082 — seeds, difficulties, Extinction variants and co-op keep the nine roles and counts', () => {
  check('matrice', 'Graine, difficulté, variante Extinction et coopération ne remplacent aucun rôle par un Marine générique.', () => {
    for (const seed of SEEDS) for (const difficultyId of Object.keys(BATTLE_DIFFICULTIES)) for (const extinctionVariant of Object.values(EXTINCTION_VARIANTS)) for (const players of [1, 2]) {
      const r = runtime(OPERATION, { seed, difficultyId, players, extinctionVariant });
      try {
        const units = grp60(r.sim);
        const parRole = Object.fromEntries(NINE.map(role => [role, units.filter(u => roleOf(r.sim.profiles.get(u.profileId).sourceRole) === role).length]));
        const row = { seed, difficultyId, extinctionVariant, players, places: units.length, generiques: [...r.sim.units.values()].filter(u => /^original_human_/.test(u.profileId)).length, parRole };
        matrix.push(row);
        assert.equal(row.places, 192); assert.equal(row.generiques, 0); assert.deepEqual(parRole, EXPECTED, JSON.stringify(row));
      } finally { r.dispose(); }
    }
    return { combinaisons: matrix.length };
  });
});

test('CTRL-082 — a saved AFF-27 mission reloads all nine roles and specialist stocks unchanged', () => {
  const r = runtime(OPERATION);
  try {
    check('sauvegarde_recharge', 'Une recharge conserve identités, rôles et stocks finis des spécialistes (pas de nouvelles munitions).', () => {
      visitAllFronts(r, 2);
      const sniper = grp60(r.sim).find(u => roleOf(r.sim.profiles.get(u.profileId).sourceRole) === 'Sniper');
      const restored = BattleSimulation.fromState(r.config, r.sim.saveState());
      try {
        const pick = sim => grp60(sim).map(u => [u.id, u.profileId, u.species, u.actorType, u.sniperRounds ?? null, u.exosuitArmor ?? null]);
        assert.deepEqual(pick(restored), pick(r.sim)); assert.equal(pick(restored).length, 192);
        return { placesRechargees: 192, sniperRounds: restored.units.get(sniper.id).sniperRounds };
      } finally { restored.dispose(); }
    });
  } finally { r.dispose(); }
});

test('CTRL-082 — each allocated place keeps the catalogue profile ID of its Extinction role (HUM-001/002/003/036-041)',
  { todo: 'défaut: js/data/BattleCatalog.js:195-210 (applySourceSquadProfiles) ne recopie aucun identifiant HUM-0xx dans les profils source_* ; js/data/SourceBattleRoster.js:4-23 ne porte que actorType/sourceRole' }, () => {
  const config = createOperationScene({ operationId: OPERATION, mapSeed: SEED }).config;
  const used = config.profiles.filter(p => /_GRP-60_/.test(p.id));
  const linked = used.filter(p => /^HUM-0(0[123]|3[6-9]|4[01])$/.test(p.sourceProfileId ?? p.catalogueProfileId ?? ''));
  clauses.push({ clause: 'identifiants_catalogue_HUM', attendu: 'Conserver entry.profile et les identifiants de profils (HUM-001/002/003/036–041) dans chaque place allouée.',
    verdict: linked.length === used.length ? 'prouvé' : 'échec (défaut)', details: { profilsGRP60: used.length, relies: linked.length,
      entryProfileConserve: used.every(p => /_GRP-60_(H-LIGNE|H-APPUI)_/.test(p.id)),
      reproduction: "createOperationScene({operationId:'AFF-27',mapSeed:1114}).config.profiles.filter(p=>/_GRP-60_/.test(p.id)).map(p=>p.sourceProfileId) → tous undefined",
      fichier: 'js/data/BattleCatalog.js:195-210 ; js/data/SourceBattleRoster.js:23-24' } });
  assert.equal(linked.length, used.length, `${used.length - linked.length} GRP-60 profiles have no HUM-0xx catalogue link`);
});

test('CTRL-082 — observations: obsolete "unimplemented" labels and WY actor type on USCM synthetics', () => {
  const r = runtime(OPERATION);
  try {
    const medic = grp60(r.sim).find(u => roleOf(r.sim.profiles.get(u.profileId).sourceRole) === 'Medic');
    const comm = grp60(r.sim).find(u => roleOf(r.sim.profiles.get(u.profileId).sourceRole) === 'CommTech');
    assert.equal(medic.medicalSupply, 2); assert.equal(comm.repairParts, 3);
    clauses.push({ clause: 'observation_libelles', attendu: 'Information : cohérence libellé / mécanique.', verdict: 'observation',
      details: { fichier: 'js/data/SourceBattleRoster.js:23-24', note: 'Les sourceRole « Medic (unimplemented support) » et « CommTech (unimplemented repairs) » sont affichés alors que BattleSimulation alloue medicalSupply=2 / repairParts=3 et expose applyMedicHeal / applyCommTechRepair (js/battlefield/BattleSimulation.js:631-682).' } });
    const xt = grp60(r.sim).find(u => u.species === 'synthetic');
    const actor = r.synthetics.spawnBattleUnit(structuredClone(xt), r.sim._groupSnapshot(r.sim.groups.get(xt.groupId)));
    assert.equal(actor.type, 'weyland_combat');
    clauses.push({ clause: 'observation_type_acteur_synthetique_uscm', attendu: 'Information : l’affiliation USCM est portée par la faction ; le type d’acteur du synthétique est nommé weyland_combat.', verdict: 'observation',
      details: { fichier: 'js/entities/Synthetics.js:384', faction: xt.factionId, actorTypeSimulation: xt.actorType, typeActeurRendu: actor.type,
        note: 'Le synthétique Colonial Marines d’Extinction est rendu par le même type que les synthétiques de combat Weyland-Yutani ; pas de remplacement par un humain, mais libellé d’affiliation ambigu.' } });
    r.synthetics.despawnBattleUnit(xt.id);
  } finally { r.dispose(); }
});

// Recette REC-007 (audit du 26/10/2026, feuille Validation) — compatibilité des
// factions et compositions par preset. Exécute les validateurs existants
// (validateBattleRoster, BattleSimulation._checkProfile, BossRegistry,
// prepareBossEncounter, sectorSupportPlan) et produit la matrice
// d'autorisations. Aucun code source n'est modifié.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BATTLE_OPERATIONS, getBattleProfile, getBattleGroup, getBattleOperationConfig, validateBattleRoster } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { bossAllowedInLevel } from '../js/data/BossRegistry.js';
import { prepareBossEncounter } from '../js/data/BossEncounterValidation.js';
import { sectorSupportPlan } from '../js/data/LevelEncounterPolicy.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

const ID = 'REC-007', SEED = 1114;
const ROOT = new URL('../', import.meta.url);
const commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const clauses = [], matrix = [], bossMatrix = [], groupsByPreset = [];
function check(key, attendu, fn) {
  try { const details = fn(); clauses.push({ clause: key, attendu, verdict: 'prouvé', details }); return details; }
  catch (error) { clauses.push({ clause: key, attendu, verdict: 'échec', details: String(error.message).slice(0, 600) }); throw error; }
}
after(() => {
  const out = new URL('docs/qa/recettes-20261114/', ROOT); mkdirSync(out, { recursive: true });
  writeFileSync(new URL(`${ID.toLowerCase()}.json`, out), JSON.stringify({
    id: ID, source: 'docs/audits/2026-10-26/Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx#Validation',
    perimetre: 'Compatibilité des factions et compositions', seed: SEED, commit, date: '2026-11-14', commande: 'node --test tests/recette-rec-007.test.js',
    preuveVideo: 'non produite — preuve par journal',
    matriceAutorisations: matrix, matriceBossNiveaux: bossMatrix, groupesEtRelationsParPreset: groupsByPreset, clauses,
    nonAutomatisable: [{ element: 'captures des refus et libellés à l’écran', raison: 'aucune interface de sélection de preset n’est rendue en Node ; les libellés de refus sont conservés ici tels que retournés par les validateurs.' }]
  }, null, 2) + '\n');
});

// Reconstitution presets: one selected work per preset, as validateBattleRoster expects.
const PRESETS = [
  { id: 'reconstitution:predator-1987', mode: 'reconstruction', works: ['Predator (1987)'], level: 'val_verde_jungle' },
  { id: 'reconstitution:charon-rogue', mode: 'reconstruction', works: [getBattleProfile('XEN-030').work], level: 'charon_rogue_base' },
  { id: 'reconstitution:romulus', mode: 'reconstruction', works: [getBattleProfile('XEN-027').work], level: 'romulus_station' },
  { id: 'variante-guerre:original', mode: 'original', works: [], level: null },
  { id: 'variante-guerre:clan_war', mode: 'clan_war', works: [], level: null },
  { id: 'hypothetique:crossover', mode: 'crossover', works: ['Predator (1987)'], level: 'val_verde_jungle' }
];
const CANDIDATES = [
  { label: 'USCM (Sergent des Colonial Marines)', profileId: 'HUM-004' },
  { label: 'Rogue', profileId: 'XEN-030' },
  { label: 'Offspring', profileId: 'XEN-027' },
  { label: 'Jungle Hunter (contrôle positif 1987)', profileId: 'YAU-001' }
];
const roster = (preset, candidate) => {
  const verdict = validateBattleRoster([{ profileId: candidate.profileId, count: 1 }], { mode: preset.mode, works: preset.works });
  const row = { preset: preset.id, mode: preset.mode, oeuvres: preset.works, profil: candidate.profileId, libelle: candidate.label,
    oeuvreProfil: getBattleProfile(candidate.profileId).work, autorise: verdict.valid, refus: verdict.errors,
    divergenceSignalee: Object.hasOwn(verdict, 'divergence') || Object.hasOwn(verdict, 'divergences') || Object.hasOwn(verdict, 'warnings') };
  matrix.push(row); return row;
};
/** Minimal two-camp simulation contract; the profile keeps its catalogue work. */
function probe({ mode, works, profileId }) {
  const source = getBattleProfile(profileId);
  // The Offspring catalogue family is 'other' (hybrid); the simulation knows only
  // four species, so the probe carries it as a xenomorph-line organism.
  const species = ['xeno', 'other'].includes(source.species) ? 'xenomorph' : source.species;
  return { id: `rec007-${mode}-${profileId}`, mode, playerFaction: 'clan',
    context: { era: 'preset', works, continuities: [], allowAdaptations: true },
    factions: [{ id: 'clan', species: 'yautja', moraleModel: 'clan' }, { id: 'humans', species, moraleModel: species === 'xenomorph' ? 'hive' : species === 'yautja' ? 'clan' : 'human' }],
    relations: [{ a: 'clan', b: 'humans', state: 'hostile' }],
    fronts: [{ id: 'a', position: [0, 0], owner: 'clan' }, { id: 'b', position: [120, 0], owner: 'humans' }],
    routes: [{ id: 'ab', from: 'a', to: 'b', travelSeconds: 10 }],
    profiles: [{ id: 'clan-hunter', species: 'yautja', actorType: 'yautja', fidelity: 'source' },
      { id: profileId, species, actorType: species === 'human' ? 'marine' : species === 'yautja' ? 'yautja' : 'warrior', allowedWorks: [source.work], fidelity: 'source' }],
    groups: [{ id: 'g-clan', factionId: 'clan', frontId: 'a', units: [{ id: 'c1', profileId: 'clan-hunter' }] },
      { id: 'g-other', factionId: 'humans', frontId: 'b', units: [{ id: 'h1', profileId }] }] };
}
const simulate = config => { try { const sim = new BattleSimulation(config); const d = structuredClone(sim.config.context); sim.dispose(); return { accepted: true, context: d }; }
  catch (error) { return { accepted: false, error: error.message }; } };

test('REC-007 — reconstruction presets refuse every combination outside their work (USCM 1987, Rogue outside Charon, Offspring outside Romulus)', () => {
  for (const preset of PRESETS) for (const candidate of CANDIDATES) roster(preset, candidate);
  check('reconstitution_refuse', 'Un preset de reconstitution refuse ou retire les combinaisons non autorisées.', () => {
    const at = (preset, profile) => matrix.find(row => row.preset === preset && row.profil === profile);
    for (const [preset, profile] of [['reconstitution:predator-1987', 'HUM-004'], ['reconstitution:predator-1987', 'XEN-030'], ['reconstitution:predator-1987', 'XEN-027'],
      ['reconstitution:charon-rogue', 'XEN-027'], ['reconstitution:charon-rogue', 'HUM-004'], ['reconstitution:romulus', 'XEN-030'], ['reconstitution:romulus', 'HUM-004']]) {
      const row = at(preset, profile); assert.equal(row.autorise, false, `${preset}/${profile}`);
      assert.ok(row.refus.some(error => /outside the selected reconstruction/.test(error)), `${preset}/${profile}: explicit refusal label`);
    }
    for (const [preset, profile] of [['reconstitution:predator-1987', 'YAU-001'], ['reconstitution:charon-rogue', 'XEN-030'], ['reconstitution:romulus', 'XEN-027']])
      assert.equal(at(preset, profile).autorise, true, `${preset}/${profile} positive control`);
    return { refusVerifies: 7, controlesPositifs: 3, exempleLibelle: at('reconstitution:predator-1987', 'HUM-004').refus };
  });
  check('simulation_reconstitution_refuse', 'La simulation d’un preset de reconstitution refuse elle-même le profil hors œuvre (pas seulement le validateur de roster).', () => {
    const rows = [];
    for (const [works, profileId, expected] of [[['Predator (1987)'], 'HUM-004', false], [['Alien: Romulus'], 'XEN-030', false], [[getBattleProfile('XEN-030').work], 'XEN-027', false], [[getBattleProfile('HUM-004').work], 'HUM-004', true]]) {
      const outcome = simulate(probe({ mode: 'reconstruction', works, profileId }));
      rows.push({ mode: 'reconstruction', works, profileId, ...outcome }); assert.equal(outcome.accepted, expected, `${profileId} in ${works}`);
      if (!expected) assert.match(outcome.error, /outside the operation's work/);
    }
    matrix.push(...rows.map(row => ({ preset: 'simulation', ...row })));
    return rows;
  });
  check('boss_niveau_reconstitution', 'Les boss nommés Rogue/Offspring sont refusés hors de leur niveau en mode niveau/reconstitution.', () => {
    for (const bossId of ['rogue_king_prime', 'the_offspring', 'jungle_hunter_boss']) for (const level of LEVELS_DATA) for (const mode of ['reconstruction', 'crossover']) {
      bossMatrix.push({ bossId, levelId: level.id, mode, autorise: bossAllowedInLevel(bossId, level.id, { mode }) });
    }
    const allowed = (boss, mode) => bossMatrix.filter(row => row.bossId === boss && row.mode === mode && row.autorise).map(row => row.levelId);
    assert.deepEqual(allowed('rogue_king_prime', 'reconstruction'), ['charon_rogue_base']);
    assert.deepEqual(allowed('the_offspring', 'reconstruction'), ['romulus_station']);
    assert.deepEqual(allowed('jungle_hunter_boss', 'reconstruction'), ['val_verde_jungle']);
    const val = LEVELS_DATA.find(level => level.id === 'val_verde_jungle');
    assert.throws(() => prepareBossEncounter({ level: val, bossType: 'rogue_king_prime', mode: 'level' }), /differs from the announced level boss/);
    return { rogue: allowed('rogue_king_prime', 'reconstruction'), offspring: allowed('the_offspring', 'reconstruction') };
  });
  check('soutien_usc_1987', 'Le preset de campagne Predator 1987 (Val Verde) ne fournit ni Marines ni synthétiques coloniaux en soutien.', () => {
    const plan = [0, 1, 2, 3, 4, 5].map(index => sectorSupportPlan('val_verde_jungle', index));
    assert.ok(plan.every(item => item.marines === 0 && item.synthetics === 0 && item.apc === false));
    const charon = sectorSupportPlan('charon_rogue_base', 3);
    assert.ok(charon.marines > 0, 'positive control: a future site can field colonial support');
    return { val_verde_jungle: plan, charon_rogue_base_secteur3: charon };
  });
});

test('REC-007 — hypothetical (crossover) mode may allow the divergent combinations', () => {
  check('hypothetique_permet', 'Un mode hypothétique peut permettre les combinaisons.', () => {
    const crossover = matrix.filter(row => row.preset === 'hypothetique:crossover');
    assert.ok(crossover.length === CANDIDATES.length && crossover.every(row => row.autorise));
    const sim = simulate(probe({ mode: 'crossover', works: ['Predator (1987)'], profileId: 'HUM-004' }));
    assert.equal(sim.accepted, true);
    assert.equal(bossAllowedInLevel('rogue_king_prime', 'val_verde_jungle', { mode: 'crossover' }), true);
    const val = LEVELS_DATA.find(level => level.id === 'val_verde_jungle');
    const encounter = prepareBossEncounter({ level: val, bossType: 'rogue_king_prime', mode: 'crossover' });
    assert.equal(encounter.mode, 'crossover');
    return { roster: crossover.map(row => [row.profil, row.autorise]), simulation: sim, rencontreBoss: { mode: encounter.mode, bossType: encounter.bossType, levelId: encounter.levelId } };
  });
});

test('REC-007 — hypothetical mode flags the divergence from the reconstruction it permits',
  { todo: 'défaut: js/data/BattleCatalog.js:104-125 (validateBattleRoster) et js/battlefield/BattleSimulation.js:216-220 (_checkProfile) acceptent le mode crossover sans retourner ni enregistrer de divergence ; seul prepareBossEncounter garde mode:"crossover"' }, () => {
  const row = matrix.find(item => item.preset === 'hypothetique:crossover' && item.profil === 'HUM-004');
  const sim = simulate(probe({ mode: 'crossover', works: ['Predator (1987)'], profileId: 'HUM-004' }));
  const flagged = row.divergenceSignalee || Object.keys(sim.context ?? {}).some(key => /diverg/i.test(key));
  clauses.push({ clause: 'hypothetique_signale_divergence', attendu: 'Un mode hypothétique peut les permettre en signalant la divergence.', verdict: flagged ? 'prouvé' : 'échec (défaut)',
    details: { retourValidateur: { autorise: row.autorise, refus: row.refus, clefs: ['valid', 'errors'] }, contexteSimulation: sim.context,
      reproduction: "validateBattleRoster([{profileId:'HUM-004'}],{mode:'crossover',works:['Predator (1987)']}) → {valid:true, errors:[]} sans champ de divergence",
      fichiers: ['js/data/BattleCatalog.js:104-125', 'js/battlefield/BattleSimulation.js:216-220'] } });
  assert.equal(flagged, true, 'no divergence notice is produced for an out-of-work crossover deployment');
});

test('REC-007 — a human/Yautja alliance never appears without an explicit event', () => {
  check('alliance_sans_evenement', 'Pas d’alliance humain/Yautja sans événement : un humain ne peut pas entrer dans le clan joueur, et aucune opération ne commence alliée.', () => {
    const config = probe({ mode: 'original', works: [], profileId: 'HUM-004' });
    config.groups[0].units.push({ id: 'intrus', profileId: 'HUM-004' });
    config.factions[1].species = 'human';
    const outcome = simulate(config);
    assert.equal(outcome.accepted, false); assert.match(outcome.error, /does not belong to faction clan/);
    const starts = [];
    for (const operation of BATTLE_OPERATIONS) {
      const c = getBattleOperationConfig(operation.id, { allowHumanController: true });
      const human = c.factions.filter(f => ['human', 'synthetic'].includes(f.species)).map(f => f.id);
      for (const rel of c.relations) if ([rel.a, rel.b].includes(c.playerFaction) && [rel.a, rel.b].some(id => human.includes(id))) {
        starts.push({ operation: operation.id, playerSpecies: c.factions[0].species, paire: `${rel.a}|${rel.b}`, etatInitial: rel.state });
        assert.notEqual(rel.state, 'allied', operation.id);
      }
    }
    return { refusIntrus: outcome.error, relationsInitialesJoueurHumains: starts };
  });
  check('alliance_par_evenement', 'Un accord local passe par une tâche négociée explicite et un événement daté, sans alliance universelle.', () => {
    const negotiated = BATTLE_OPERATIONS.flatMap(operation => getBattleOperationConfig(operation.id, { allowHumanController: true }).operationObjectives.tasks
      .filter(task => task.type === 'negotiate').map(task => ({ operation: operation.id, task: task.id, factionId: task.factionId, relation: task.relationship, requires: task.requires })));
    assert.ok(negotiated.length > 0);
    assert.ok(negotiated.every(item => item.relation !== 'allied'), 'no negotiated task produces a universal alliance');
    return negotiated;
  });
});

test('REC-007 — groups keep their own relations and do not join one team by proximity', () => {
  check('relations_propres', 'Les groupes conservent leurs propres relations et n’adoptent pas tous une même équipe par proximité.', () => {
    const rows = [];
    for (const operationId of ['AFF-13', 'AFF-16', 'AFF-11']) {
      const { config } = createOperationScene({ operationId, mapSeed: SEED });
      const sim = new BattleSimulation(config), relations = () => Object.fromEntries([...sim.relations.entries()]);
      const factionsBefore = new Map([...sim.units.values()].map(u => [u.id, u.factionId])), start = relations();
      // Proximity stress: every living group is ordered onto the same front.
      const target = [...sim.fronts.keys()][1];
      for (const group of sim.groups.values()) sim.issueOrder(group.id, { type: 'attack', frontId: target, issuer: 'rec007' });
      for (let t = 0; t < 180; t += .25) sim.update(.25, { players: [] });
      assert.deepEqual(relations(), start, operationId);
      assert.ok([...sim.units.values()].every(u => factionsBefore.get(u.id) === u.factionId), `${operationId}: no unit changes camp`);
      const crossKills = [...sim.deaths.values()].filter(d => d.killerFaction && !sim.areHostile(d.killerFaction, d.factionId));
      assert.equal(crossKills.length, 0, `${operationId}: only hostile pairs kill each other`);
      const row = { operation: operationId, groupes: sim.groups.size, factions: config.factions.map(f => ({ id: f.id, species: f.species, label: f.label ?? null })),
        relationsInitiales: start, relationsApres180s: relations(), morts: sim.deaths.size, mortsEntrePairesNonHostiles: 0 };
      rows.push(row); groupsByPreset.push(row); sim.dispose();
    }
    const sevastopol = rows.find(row => row.operation === 'AFF-13');
    assert.equal(Object.entries(sevastopol.relationsApres180s).find(([k]) => k.includes('hive') && k.includes('human_force'))[1], 'neutral');
    return rows.map(row => ({ operation: row.operation, relations: row.relationsApres180s, morts: row.morts }));
  });
});

test('REC-007 — police, gangs and OWLF mixture', () => {
  const grp25 = getBattleGroup('GRP-25');
  const used = BATTLE_OPERATIONS.filter(operation => [...operation.enemyGroupIds, ...operation.alliedGroupIds].includes('GRP-25')).map(operation => operation.id);
  assert.deepEqual(used, []);
  clauses.push({ clause: 'police_gangs_owlf', attendu: 'Mélange police/gangs/OWLF : groupes distincts, relations propres.', verdict: 'non automatisable',
    details: { raison: 'Aucun preset ni opération ne déploie GRP-25 (« Forces de Los Angeles », statut « ' + grp25.status + ' ») et aucun profil police/gang/OWLF n’existe dans BATTLE_PROFILES ; rien à exécuter.',
      restrictionSource: grp25.restrictions, observation: 'js/data/BattleCatalog.js:147-153 (allocatedCamp) range tout groupe ni xéno ni Yautja dans la seule faction human_force : un futur preset police+gangs+OWLF serait fusionné en un camp unique sans règle dédiée.' } });
});

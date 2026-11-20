// Recette REC-008 (audit du 26/10/2026, feuille Validation) — personnages nommés,
// variantes biologiques et unicité. Suit des boss nommés alloués (Reine BOS-39,
// Praetorian BOS-32, Kher BOS-26) à travers éloignement, réentrée, retraite,
// sauvegarde/recharge et continuité de campagne, puis contrôle la provenance
// et les restrictions des variantes. La validation humaine reste à l'auteur.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BattleCampaignRecord, CLAN_CAMPAIGN_ARC_ID } from '../js/battlefield/BattleCampaignRecord.js';
import { BATTLE_SOURCES, BATTLE_FIDELITY_RULES, getBattleProfile, validateBattleRoster } from '../js/data/BattleCatalog.js';
import { BOSS_REGISTRY } from '../js/data/BossRegistry.js';

const ID = 'REC-008', SEED = 1114;
const ROOT = new URL('../', import.meta.url);
const commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const clauses = [], timeline = [], provenance = [];
function check(key, attendu, fn) {
  try { const details = fn(); clauses.push({ clause: key, attendu, verdict: 'prouvé', details }); return details; }
  catch (error) { clauses.push({ clause: key, attendu, verdict: 'échec', details: String(error.message).slice(0, 600) }); throw error; }
}
after(() => {
  const out = new URL('docs/qa/recettes-20261114/', ROOT); mkdirSync(out, { recursive: true });
  writeFileSync(new URL(`${ID.toLowerCase()}.json`, out), JSON.stringify({
    id: ID, source: 'docs/audits/2026-10-26/Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx#Validation',
    perimetre: 'Personnages nommés, variantes biologiques et unicité', seed: SEED, commit, date: '2026-11-14', commande: 'node --test tests/recette-rec-008.test.js',
    preuveVideo: 'non produite — preuve par journal', chronologie: timeline, registreProvenance: provenance, clauses,
    validationHumaine: { statut: 'à réaliser par l’auteur', objet: 'captures côte à côte, références visuelles sélectionnées et validation de chaque variante (Dog Alien, Runner, Praetorian, Predalien, Reines, Rogue, Offspring)',
      raison: 'la ressemblance visuelle et la fidélité biologique ne se prouvent pas par un test Node ; aucune capture n’est produite ici.' }
  }, null, 2) + '\n');
});

const named = (sim, uniqueId) => [...sim.units.values()].filter(unit => unit.uniqueId === uniqueId);
/** Finds a deterministic player position inside the boss front's detail radius
 * that is far enough from every boss-group member to permit materialization. */
function observerFor(sim, unit) {
  const group = sim.groups.get(unit.groupId), front = sim.fronts.get(group.frontId);
  const members = group.units.map(id => sim.units.get(id).position), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const dirs = [[group.position[0] - front.position[0], group.position[1] - front.position[1]], [1, 0], [0, 1], [-1, 0], [0, -1]];
  for (const [dx, dz] of dirs) { const n = Math.hypot(dx, dz) || 1;
    for (let gap = sim.budgets.spawnDistance + 2; gap <= sim.budgets.spawnDistance + 30; gap += 2) {
      const p = [group.position[0] + dx / n * gap, group.position[1] + dz / n * gap];
      const nearest = [...sim.groups.values()].filter(g => g.factionId === group.factionId && g.frontId === group.frontId)
        .sort((x, y) => d(x.position, p) - d(y.position, p) || x.id.localeCompare(y.id))[0];
      if (d(p, front.position) <= front.radius * 1.45 && members.every(m => d(m, p) >= sim.budgets.spawnDistance + 1) && nearest === group) return p;
    } }
  throw new Error('no observer position');
}
function follow(operationId, uniqueId) {
  const { config } = createOperationScene({ operationId, mapSeed: SEED });
  const spawned = [], log = (event, extra = {}) => timeline.push({ operation: operationId, uniqueId, t: sim.time, event, ...extra });
  let hpOnScreen = null; const heals = [];
  const sim = new BattleSimulation(config, {
    healBattleUnit: (unitId, hp) => { if (unitId === boss?.id) heals.push({ t: sim.time, hp }); },
    spawnGroup: (group, units) => { spawned.push(...units.map(u => u.id)); return true; },
    despawnGroup: (group, units) => units.map(u => ({ id: u.id, hp: u.uniqueId === uniqueId && hpOnScreen !== null ? hpOnScreen : u.hp, position: u.position })) });
  var boss = named(sim, uniqueId)[0];
  return { config, sim, boss, spawned, heals, log, setScreenHp: hp => { hpOnScreen = hp; } };
}

test('REC-008 — a named boss is never a series officer and is followed through distance, re-entry, retreat and reload', () => {
  for (const [operationId, uniqueId] of [['AFF-27', 'BOS-39'], ['AFF-14', 'BOS-32']]) {
    const f = follow(operationId, uniqueId), { sim } = f;
    try {
      check(`${operationId}:${uniqueId}:identite`, 'Le personnage nommé n’est pas cloné comme officier de série : une seule unité, profil de commandant unique, absent des réserves génériques.', () => {
        const units = named(sim, uniqueId); assert.equal(units.length, 1);
        const unit = units[0], profile = sim.profiles.get(unit.profileId);
        assert.equal(profile.unique, true); assert.equal(profile.id, `original_commander_${uniqueId}`); assert.equal(unit.officer, true);
        assert.equal([...sim.units.values()].filter(u => u.profileId === profile.id).length, 1, 'no other unit shares the named profile');
        const seriesOfficers = [...sim.units.values()].filter(u => u.officer && !u.uniqueId);
        assert.ok(seriesOfficers.every(u => !sim.profiles.get(u.profileId).unique), 'series officers use non-unique profiles');
        assert.notEqual(unit.state, 'reserve');
        f.log('alloue', { unitId: unit.id, profileId: profile.id, groupId: unit.groupId, frontId: sim.groups.get(unit.groupId).frontId, hp: unit.hp, officiersDeSerie: seriesOfficers.length });
        return { unitId: unit.id, profileId: profile.id, sourceBossType: unit.sourceBossType, actorType: unit.actorType, officiersDeSerie: seriesOfficers.length };
      });
      check(`${operationId}:${uniqueId}:eloignement_reentree`, 'Éloignement puis réentrée : même identifiant, PV conservés, aucun doublon.', () => {
        const id = f.boss.id, near = observerFor(sim, f.boss), far = [near[0] + 5000, near[1] + 5000];
        for (let t = 0; t < 2; t += .25) sim.update(.25, { players: [{ id: 'p1', hp: 1000, position: near }] });
        assert.equal(sim.units.get(id).state, 'active', 'the named unit materializes near the player');
        f.log('materialise', { unitId: id });
        f.setScreenHp(sim.units.get(id).maxHp * .6);
        for (let t = 0; t < 2; t += .25) sim.update(.25, { players: [{ id: 'p1', hp: 1000, position: far }] });
        assert.equal(sim.units.get(id).state, 'distant'); const hp = sim.units.get(id).hp;
        // Only the documented hive-space ecology (healHiveSpace) may change HP while distant.
        assert.equal(hp, f.heals.at(-1)?.hp ?? sim.units.get(id).maxHp * .6, 'wounds taken on screen are kept while distant, except explicit hive-space healing');
        assert.ok(hp < sim.units.get(id).maxHp * .7, 'leaving camera range does not restore the named boss');
        f.log('eloigne', { unitId: id, hp, soinsEspaceRuche: f.heals.length });
        for (let t = 0; t < 2; t += .25) sim.update(.25, { players: [{ id: 'p1', hp: 1000, position: near }] });
        assert.equal(sim.units.get(id).state, 'active'); assert.equal(sim.units.get(id).hp, f.heals.at(-1)?.hp ?? hp, 're-entry keeps the simulated HP (plus only journaled hive-space healing)');
        assert.ok(sim.units.get(id).hp < sim.units.get(id).maxHp);
        assert.equal(named(sim, uniqueId).length, 1); assert.equal(f.spawned.filter(u => u === id).length, 2, 'one rematerialization of the same identity');
        f.log('reentree', { unitId: id, hp: sim.units.get(id).hp });
        return { unitId: id, hpEcran: sim.units.get(id).maxHp * .6, hpApresEloignement: hp, soinsEspaceRucheJournalises: f.heals.slice(), materialisations: 2 };
      });
      check(`${operationId}:${uniqueId}:retraite`, 'Retraite et reconstitution : les renforts mobilisés ne dupliquent pas le personnage nommé.', () => {
        const group = sim.groups.get(f.boss.groupId), other = [...sim.fronts.keys()].find(front => front !== group.frontId);
        const answer = sim.issueOrder(group.id, { type: 'retreat', frontId: other, issuer: 'officer' });
        f.log('retraite', { groupId: group.id, accepted: answer.accepted, reason: answer.reason ?? null });
        const total = sim.units.size;
        for (let t = 0; t < 90; t += .25) sim.update(.25, { players: [] });
        assert.equal(sim.units.size, total); assert.equal(named(sim, uniqueId).length, 1);
        assert.equal([...sim.units.values()].filter(u => u.profileId === `original_commander_${uniqueId}`).length, 1);
        assert.equal(sim.assertConservation(), true);
        f.log('apres_retraite', { etat: sim.units.get(f.boss.id).state, hp: sim.units.get(f.boss.id).hp, groupe: sim.groups.get(f.boss.groupId).order });
        return { ordreAccepte: answer.accepted, unites: total, exemplairesDuNomme: 1 };
      });
      check(`${operationId}:${uniqueId}:recharge`, 'Recharge de partie : identité, PV et unicité restaurés sans clone.', () => {
        const state = sim.saveState(), restored = BattleSimulation.fromState(f.config, state);
        try {
          const a = sim.units.get(f.boss.id), b = restored.units.get(f.boss.id);
          assert.deepEqual([b.id, b.uniqueId, b.hp, b.profileId], [a.id, a.uniqueId, a.hp, a.profileId]);
          assert.equal(named(restored, uniqueId).length, 1); assert.equal(restored.unique.get(uniqueId), f.boss.id);
          f.log('recharge', { unitId: b.id, hp: b.hp });
          return { unitId: b.id, hp: b.hp };
        } finally { restored.dispose(); }
      });
    } finally { sim.dispose(); }
  }
});

test('REC-008 — a named Yautja killed in one operation stays dead in the next opted-in operation (no resurrection or clone)', () => {
  check('AFF-01→AFF-03:BOS-26:campagne', 'Un personnage nommé mort n’est ni ressuscité ni recréé comme officier de série dans l’opération suivante.', () => {
    const disk = new Map(), storage = { getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value) };
    const book = new BattleCampaignRecord({ storage, now: () => '2026-11-14T12:00:00.000Z' });
    const first = createOperationScene({ operationId: 'AFF-01', mapSeed: SEED }).config, sim = new BattleSimulation(first);
    const kher = named(sim, 'BOS-26')[0];
    assert.equal(sim.recordDeath({ entityId: kher.id, killerFaction: first.playerFaction, cause: 'rec008' }), true);
    assert.equal(book.observe(first, sim, { arcId: CLAN_CAMPAIGN_ARC_ID, runId: 'rec008-run' }).recorded, true);
    const later = createOperationScene({ operationId: 'AFF-03', mapSeed: SEED }).config;
    const history = new BattleCampaignRecord({ storage }).historyFor(later, { arcId: CLAN_CAMPAIGN_ARC_ID });
    const next = new BattleSimulation(later, { history }), again = named(next, 'BOS-26');
    assert.equal(again.length, 1); assert.equal(again[0].state, 'dead'); assert.equal(again[0].hp, 0);
    assert.equal([...next.units.values()].filter(u => u.profileId === again[0].profileId && u.hp > 0).length, 0);
    timeline.push({ operation: 'AFF-01', uniqueId: 'BOS-26', event: 'mort', unitId: kher.id }, { operation: 'AFF-03', uniqueId: 'BOS-26', event: 'herite_mort', unitId: again[0].id });
    sim.dispose(); next.dispose();
    return { historique: history.defeatedUniqueIds, etatAFF03: again[0].state };
  });
  check('BOS-30:portee_par_mission', 'Un même archétype de boss original (BOS-30) dans deux opérations reste deux individus distincts identifiés par mission.', () => {
    const a = createOperationScene({ operationId: 'AFF-07', mapSeed: SEED }).config, b = createOperationScene({ operationId: 'AFF-09', mapSeed: SEED }).config;
    const pick = c => c.groups.flatMap(g => g.units).find(u => /BOS-30$/.test(u.uniqueId ?? ''));
    assert.equal(pick(a).uniqueId, 'AFF-07:BOS-30'); assert.equal(pick(b).uniqueId, 'AFF-09:BOS-30');
    return { AFF07: pick(a).uniqueId, AFF09: pick(b).uniqueId };
  });
  check('roster_unicite', 'Le validateur refuse de multiplier ou de verser en réserve générique un profil nommé.', () => {
    const rows = [];
    for (const profileId of ['XEN-007', 'XEN-011', 'XEN-027', 'XEN-030', 'YAU-001']) {
      const twice = validateBattleRoster([{ profileId, count: 2 }], { mode: 'crossover' });
      const reserve = validateBattleRoster([{ profileId, count: 1 }], { mode: 'crossover', reserve: true });
      assert.equal(twice.valid, false); assert.ok(twice.errors.some(e => /named identity must occur once/.test(e)));
      assert.equal(reserve.valid, false); assert.ok(reserve.errors.some(e => /cannot enter a generic reserve/.test(e)));
      rows.push({ profileId, doubleRefuse: twice.errors, reserveRefusee: reserve.errors });
    }
    return rows;
  });
});

test('REC-008 — each compared variant carries provenance and restrictions; unverified model/behaviour stays flagged', () => {
  const sourceIds = new Set(BATTLE_SOURCES.map(source => source.id));
  const VARIANTS = [['Runner de jeu', 'XEN-006'], ['Praetorian', 'XEN-008'], ['Predalien', 'XEN-011'], ['Reine xénomorphe', 'XEN-007'], ['Pathogen Queen', 'XEN-019'],
    ['Red Queen Mother', 'XEN-032'], ['Rogue', 'XEN-030'], ['Offspring', 'XEN-027']];
  check('provenance_restrictions', 'Chaque variante possède provenance et restrictions ; modèle, comportement ou biologie non vérifiés restent identifiés comme tels.', () => {
    for (const [label, id] of VARIANTS) {
      const p = getBattleProfile(id);
      assert.ok(p.evidence.sourceIds.length > 0 && p.evidence.sourceIds.every(s => sourceIds.has(s)), `${id}: resolved sources`);
      assert.ok(p.evidence.urls.length > 0, `${id}: source URL`);
      assert.ok(String(p.design.restrictions).length > 20, `${id}: restrictions`);
      assert.equal(p.visualFidelity1to1Verified, false); assert.equal(p.renderedAssetVerified, false);
      assert.match(p.evidence.status, /adaptation|vérifier|documenter/, `${id}: unverified scope declared`);
      provenance.push({ variante: label, profil: id, oeuvre: p.work, famille: p.sourceFamily, sources: p.evidence.sourceIds, urls: p.evidence.urls,
        statutPreuve: p.evidence.status, restrictions: p.design.restrictions, unique: p.eligibility.unique, fidelite1to1: false, hote: 'non structuré dans le profil' });
    }
    const dog = BATTLE_FIDELITY_RULES.find(rule => rule.id === 'LORE-011');
    assert.match(dog.subject, /Dog Alien/); assert.match(dog.status, /NON CERTIFIEE/); assert.match(dog.source, /LORE-S08/);
    provenance.push({ variante: 'Dog Alien', profil: null, regle: dog.id, statut: dog.status, sources: dog.source.split('\n').filter(line => /^LORE-S/.test(line)), regleFidelite: dog.rule, limites: dog.limits,
      note: 'Aucun profil de combat : la variante ne peut être instanciée ni clonée ; seule la règle de fidélité porte provenance et restrictions.' });
    for (const id of ['rogue_king_prime', 'the_offspring', 'predalien', 'xenomorph_queen', 'praetorian']) {
      const boss = BOSS_REGISTRY[id]; assert.equal(boss.unique, true); assert.equal(boss.ordinarySpawn, false); assert.equal(boss.assetFidelity, 'interpreted-game-model'); assert.ok(boss.source.length > 10);
      provenance.push({ variante: `boss:${id}`, source: boss.source, unique: true, ordinarySpawn: false, assetFidelity: boss.assetFidelity, niveaux: boss.levels });
    }
    return { variantes: VARIANTS.length + 1, bossRegistres: 5 };
  });
  clauses.push({ clause: 'observation_hote', attendu: 'LORE-011 demande « hôte et version renseignés » par modèle.', verdict: 'observation',
    details: { note: 'Les profils XEN-* n’ont pas de champ hôte structuré ; l’hôte reste implicite dans les restrictions textuelles. À compléter par l’auteur si la règle LORE-011 doit être satisfaite.', fichier: 'js/data/BattleCatalog.js:44-57 (BATTLE_PROFILES)' } });
  clauses.push({ clause: 'validation_humaine', attendu: 'Captures côte à côte, références visuelles sélectionnées et validation humaine.', verdict: 'validation humaine (laissée à l’auteur)',
    details: { raison: 'Non automatisable : jugement visuel et choix des références par l’auteur.' } });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { BATTLE_CATALOG_PROVENANCE, BATTLE_PROFILES, BATTLE_MAPS, BATTLE_OPERATIONS,
  BATTLE_GROUPS, BATTLE_BUDGETS, BATTLE_FRONTS, BATTLE_SOURCES, BATTLE_BOSSES,
  getBattleOperationConfig, getBattleProfile, getBattleOperation, getBattleBudget,
  validateBattleCatalog, validateBattleRoster, validateCharacterArsenal } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';

const source = JSON.parse(await readFile(new URL('../docs/audits/2026-10-26/audit-data.json', import.meta.url)));
const sheet = name => source.sheets.find(item => item.name === name).rows;

test('catalogue is reproducible from the preserved PR audit, with source rather than rendered-asset status', async () => {
  assert.equal(BATTLE_CATALOG_PROVENANCE.codeSnapshot, '0f37cc52f9d83a4abecc17b80f7bfc67701677cf');
  assert.equal(createHash('sha256').update(await readFile(new URL('../docs/audits/2026-10-26/audit-data.json', import.meta.url))).digest('hex'), BATTLE_CATALOG_PROVENANCE.auditSha256);
  assert.deepEqual([BATTLE_PROFILES.length, BATTLE_MAPS.length, BATTLE_OPERATIONS.length, BATTLE_GROUPS.length, BATTLE_BUDGETS.length, BATTLE_FRONTS.length, BATTLE_SOURCES.length, BATTLE_BOSSES.length], [115, 34, 27, 62, 17, 40, 70, 39]);
  assert.equal(validateBattleCatalog().valid, true);
  execFileSync(process.execPath, [new URL('../scripts/sync-battle-catalog.mjs', import.meta.url).pathname, '--check']);
  assert.ok(BATTLE_PROFILES.every(profile => profile.visualFidelity1to1Verified === false && profile.renderedAssetVerified === false));
  assert.ok(BATTLE_MAPS.every(map => map.geometryFidelity === 'not_measured' && map.dimensions.unit === 'game_unit'));
});

test('all 27 proposed operations allocate exactly their source budget with no extra commander, pilot, civilian or player', () => {
  for (const operation of BATTLE_OPERATIONS) {
    const config = getBattleOperationConfig(operation.id, { allowHumanController: true }), budget = getBattleBudget(operation.budgetId);
    const units = config.groups.flatMap(group => group.units);
    assert.equal(units.length, budget.enemy.total + budget.ally.total, operation.id);
    assert.equal(new Set(units.map(unit => unit.id)).size, units.length, operation.id);
    assert.equal(config.groups.filter(group => group.factionId === config.playerFaction).reduce((sum, group) => sum + group.units.length, 0), budget.ally.total);
    for (const [id, allocation] of Object.entries(config.budgets.byFaction)) {
      const groups = config.groups.filter(group => group.factionId === id);
      assert.equal(groups.reduce((sum, group) => sum + group.units.length, 0), allocation.total);
      for (const state of ['active', 'distant', 'reserve']) assert.equal(groups.filter(group => group.sourceState === state).reduce((sum, group) => sum + group.units.length, 0), config.sourceDetailedBudget.byFaction[id][state]);
    }
    const named = units.map(unit => unit.uniqueId).filter(Boolean); assert.equal(new Set(named).size, named.length);
    assert.ok(config.groups.every(group => group.sourceTemplateIds.every(id => BATTLE_GROUPS.some(template => template.id === id))));
    assert.equal(config.mode, 'original'); assert.equal(config.context.visualFidelity1to1Verified, false);
  }
});

test('all 27 operations cap detail at 32 while preserving every allocated identity, source budget and finite reserve', () => {
  let playable = 0;
  for (const operation of BATTLE_OPERATIONS) {
    const normal = getBattleOperationConfig(operation.id, { allowHumanController: true });
    const experimental = getBattleOperationConfig(operation.id, { allowHumanController: true, maxDetailedAgents: 256, experimentalDetailBudget: true });
    if (!operation.requiresHumanController) playable++;
    assert.equal(normal.budgets.active, Math.min(32, normal.desiredDetailedBudget), operation.id);
    assert.equal(normal.budgets.desiredActive, experimental.budgets.active);
    assert.deepEqual(normal.groups, experimental.groups, 'detail cannot split/delete squads or change reserve identities');
    assert.equal(Object.values(normal.budgets.byFaction).reduce((sum, allocation) => sum + allocation.active, 0), normal.budgets.active);
    for (const [id, allocation] of Object.entries(normal.budgets.byFaction)) {
      const original = normal.sourceDetailedBudget.byFaction[id];
      assert.equal(allocation.total, original.total); assert.equal(allocation.reserve, original.reserve);
      assert.equal(allocation.active + allocation.distant + allocation.reserve, allocation.total);
      assert.equal(allocation.distant - original.distant, original.active - allocation.active, 'surplus stays distant');
      assert.ok(allocation.active >= Math.max(...normal.groups.filter(group => group.factionId === id).map(group => group.units.length)), 'a complete group of each camp must fit');
    }
    assert.equal(normal.detailBudgetPolicy.hardwareProfiled, false);
    assert.match(normal.detailedBudgetNotice, /simulées à distance/);
    const simulation = new BattleSimulation(normal);
    try { assert.equal(simulation.assertConservation(), true); assert.equal(simulation.units.size, normal.groups.reduce((sum, group) => sum + group.units.length, 0)); }
    finally { simulation.dispose(); }
  }
  assert.equal(playable, 25);
  assert.throws(() => getBattleOperationConfig('AFF-27', { maxDetailedAgents: 136 }), /explicit experimentalDetailBudget/);
  assert.throws(() => getBattleOperationConfig('AFF-27', { maxDetailedAgents: 136, experimentalDetailBudget: 'yes' }), /explicit experimentalDetailBudget/);
  assert.throws(() => getBattleOperationConfig('AFF-27', { maxDetailedAgents: 8 }), /cannot fit one allocated group per faction/);
});

test('every initial supplied reserve group fits its announced arrival allowance and keeps exactly its allocated identities', () => {
  for (const operation of BATTLE_OPERATIONS) {
    const config = getBattleOperationConfig(operation.id, { allowHumanController: true });
    config.ai = { enabled: false }; config.profiles.forEach(profile => { profile.damage = 0; });
    const simulation = new BattleSimulation(config), before = [...simulation.units.keys()];
    try {
      const reserves = config.groups.filter(group => group.state === 'reserve');
      for (const group of reserves) {
        assert.ok(group.units.length <= config.budgets.arrivalsPerTick, `${operation.id}/${group.id}: whole finite squad must fit the arrival allowance`);
        const result = simulation.requestReinforcements(group.factionId, group.frontId, group.id);
        assert.equal(result.accepted, true, `${operation.id}/${group.id}: initial source and route exist: ${result.reason}`);
      }
      simulation.update(2); assert.equal([...simulation.units.values()].filter(unit => unit.state === 'reserve').length, reserves.reduce((sum, group) => sum + group.units.length, 0), 'warning precedes the actual arrival');
      simulation.update(1.25);
      assert.equal([...simulation.units.values()].filter(unit => unit.state === 'reserve').length, 0);
      assert.deepEqual([...simulation.units.keys()], before); assert.equal(simulation.deaths.size, 0); assert.equal(simulation.assertConservation(), true);
    } finally { simulation.dispose(); }
  }
});

test('three independent camps preserve the exact per-species allocations in the Excel rather than rounding ratios', () => {
  const expected = { 'AFF-11': { rival_clan: 48, human_force: 336 }, 'AFF-12': { rival_clan: 96, human_force: 288 },
    'AFF-13': { hive: 8, human_force: 32 }, 'AFF-15': { hive: 736, human_force: 192 },
    'AFF-16': { hive: 736, human_force: 192 }, 'AFF-17': { hive: 736, human_force: 192 },
    'AFF-19': { hive: 8, human_force: 32 }, 'AFF-27': { hive: 736, human_force: 192 } };
  for (const [id, factions] of Object.entries(expected)) {
    const config = getBattleOperationConfig(id); assert.equal(config.factions.length, 3);
    for (const [faction, total] of Object.entries(factions)) assert.equal(config.budgets.byFaction[faction].total, total, `${id}/${faction}`);
    assert.equal(config.relations.length, 3); assert.ok(config.relations.every(relation => relation.state === 'hostile' && relation.a !== relation.b));
  }
});

test('LV-742 starts on D and the single queen occupies an existing eight-unit C group; human commanders follow their declared group', () => {
  const config = getBattleOperationConfig('AFF-27'), queen = config.groups.filter(group => group.units.some(unit => unit.uniqueId === 'BOS-39'));
  assert.equal(queen.length, 1); assert.equal(queen[0].units.length, 8); assert.equal(queen[0].frontId, 'front_c');
  assert.deepEqual(config.objectives.loseFronts, ['front_d']); assert.deepEqual(config.objectives.captureFronts, ['front_a', 'front_b', 'front_c']);
  assert.equal(config.groups.reduce((sum, group) => sum + group.units.length, 0), 952);
  const port = getBattleOperationConfig('AFF-06');
  const commander = port.groups.find(group => group.units.some(unit => unit.uniqueId === 'BOS-29'));
  assert.equal(commander.frontId, 'front_c'); assert.deepEqual(commander.sourceTemplateIds, ['GRP-42']);
  const raid = getBattleOperationConfig('AFF-01'), sequel = getBattleOperationConfig('AFF-03');
  assert.ok(raid.groups.some(group => group.units.some(unit => unit.uniqueId === 'BOS-26')));
  assert.ok(sequel.groups.some(group => group.units.some(unit => unit.uniqueId === 'BOS-26')), 'campaign can recognize the same Kher identity instead of an operation-specific clone');
});

test('named, excluded, uncertain and noncombatant profiles cannot silently become generic army reserves', () => {
  assert.equal(validateBattleRoster([{ profileId: 'YAU-001' }, { profileId: 'YAU-001' }]).valid, false);
  assert.equal(validateBattleRoster([{ profileId: 'XEN-007', count: 8 }]).valid, false);
  assert.equal(validateBattleRoster([{ profileId: 'HUM-032' }], { reserve: true }).valid, false);
  for (const profileId of ['YAU-011', 'YAU-019', 'YAU-023', 'HUM-025', 'HUM-028', 'HUM-035', 'YAU-037']) assert.equal(validateBattleRoster([{ profileId }]).valid, false, profileId);
  for (const profileId of ['XEN-001', 'XEN-003', 'HUM-014']) assert.equal(validateBattleRoster([{ profileId }], { reserve: true }).valid, false, profileId);
  assert.equal(validateBattleRoster([{ profileId: 'XEN-001', purpose: 'structure' }]).valid, true);
  assert.equal(validateBattleRoster([{ profileId: 'XEN-005', count: 8 }], { reserve: true }).valid, true);
});

test('reconstructions restrict source works and do not merge Pathogen, Neomorph or PHG incarnations into universal castes', () => {
  assert.equal(validateBattleRoster([{ profileId: 'XEN-005' }], { mode: 'reconstruction', works: ['Prey (2022)'] }).valid, false);
  const feral = getBattleProfile('YAU-004'); assert.equal(validateBattleRoster([{ profileId: feral.id }], { mode: 'reconstruction', works: [feral.work] }).valid, true);
  assert.equal(validateBattleRoster([{ profileId: 'YAU-029' }], { works: ['Killer of Killers'] }).valid, false);
  assert.notEqual(getBattleProfile('XEN-022').species, 'xeno'); assert.notEqual(getBattleProfile('XEN-024').species, 'xeno');
  assert.notEqual(getBattleProfile('YAU-010').id, getBattleProfile('YAU-017').id);
  assert.ok(getBattleProfile('YAU-006').design.restrictions.includes('Killer of Killers'));
});

test('character equipment permissions distinguish Jungle, City, Feral and PHG while free play stays explicit', () => {
  assert.equal(validateCharacterArsenal('jungle_hunter', ['wristblades', 'plasma_caster']).valid, true);
  assert.equal(validateCharacterArsenal('jungle_hunter', ['smart_disc', 'combistick']).valid, false);
  assert.equal(validateCharacterArsenal('city_hunter', ['smart_disc', 'combistick']).valid, true);
  assert.equal(validateCharacterArsenal('feral_predator', ['crossbow', 'feral_shield']).valid, true);
  assert.equal(validateCharacterArsenal('feral_predator', ['plasma_caster', 'dual_caster']).valid, false);
  assert.equal(validateCharacterArsenal('samurai_predator', ['katana']).valid, true);
  assert.equal(validateCharacterArsenal('viking_predator', ['viking_axe']).valid, true);
  assert.equal(validateCharacterArsenal('alpha_predator', ['alpha_sickle']).valid, true);
  assert.equal(validateCharacterArsenal('jungle_hunter', ['smart_disc'], { mode: 'crossover' }).valid, true);
  assert.equal(validateCharacterArsenal('jungle_hunter', ['missing_button_action'], { mode: 'crossover' }).valid, false);
});

test('scene positions, cooperative players and low-detail capacity preserve immutable source records and all identities', () => {
  const positions = [[0, 0], [50, 100], [-50, 150]], first = getBattleOperationConfig('AFF-14', { playerCount: 2, frontPositions: positions });
  const second = getBattleOperationConfig('AFF-14', { budgetId: 'EFF-08', frontPositions: positions });
  assert.equal(first.context.players, 2); assert.deepEqual(first.fronts.map(front => front.position), positions);
  assert.deepEqual(first.groups.map(group => group.units.map(unit => unit.id)), second.groups.map(group => group.units.map(unit => unit.id)));
  assert.equal(second.budgets.active, 32); assert.equal(second.desiredDetailedBudget, 54); assert.equal(second.budgets.byFaction.player_clan.active, 6);
  first.groups[0].units[0].id = 'private mutation'; first.fronts[0].position[0] = 999;
  assert.notEqual(second.groups[0].units[0].id, 'private mutation'); assert.equal(positions[0][0], 0);
  assert.ok(Object.isFrozen(getBattleOperation('AFF-14').forceAllocation.active[0]));
  assert.equal(sheet('Affrontements').find(operation => operation.id === 'AFF-14').budgetId, 'EFF-03');
});

test('unsupported controller, unknown references and invented budgets fail before creating an army', () => {
  assert.throws(() => getBattleOperationConfig('AFF-25'), /human controller/);
  assert.throws(() => getBattleOperationConfig('AFF-26'), /human controller/);
  assert.throws(() => getBattleOperationConfig('AFF-99'), /unknown operation/);
  assert.throws(() => getBattleOperationConfig('AFF-01', { playerCount: 3 }), /one or two/);
  assert.throws(() => getBattleOperationConfig('AFF-01', { budgetId: 'EFF-05' }), /finite force/);
  assert.throws(() => getBattleOperationConfig('AFF-01', { frontPositions: [[NaN, 0], [1, 2], [3, 4]] }), /finite front/);
  assert.equal(validateBattleRoster([{ profileId: 'UNSOURCED' }]).valid, false);
});

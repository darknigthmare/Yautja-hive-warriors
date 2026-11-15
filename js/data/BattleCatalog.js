/* PR #3 source catalogue. A sourced profile, a proposed operation and a rendered
 * character are separate records; none of these exports certifies a 1:1 asset. */
import { BATTLE_CATALOG_DATA as source } from './BattleCatalogData.js';
import { ULTIMATE_YAUTJA_ARMORY } from './charactersData.js';
import { createOperationObjectiveSpec } from '../battlefield/OperationObjectiveSpecs.js';

const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const fail = message => { throw new Error(`BattleCatalog: ${message}`); };
const clone = value => structuredClone(value);
export const BATTLE_CATALOG_PROVENANCE = freeze({ ...source.provenance,
  auditPath: 'docs/audits/2026-10-26/audit-data.json', catalogueIsRenderedContent: false });
export const BATTLE_SOURCES = freeze(source.sources.map(row => ({ ...row })));
const sourceIndex = new Map(BATTLE_SOURCES.map(row => [row.id, row]));

function eligibility(row) {
  const text = row.spawnEligibility, lower = text.toLocaleLowerCase('fr');
  const excluded = lower.includes('exclu'), unique = lower.includes('unique') || lower.includes('nommée');
  const equipment = lower.includes('matériel'), civilian = /civils|civile|pas horde|hors horde/.test(lower);
  const classification = lower.includes('classification');
  const structure = row.id === 'XEN-001', juvenile = row.id === 'XEN-003';
  const rosterUnverified = lower.includes('composition exacte à documenter') || lower.includes('personnages uniques + groupe');
  const contextual = lower.includes('preset') || lower.includes('variante originale') || lower.includes('sur preuve');
  return { sourceLabel: text, category: excluded ? 'excluded' : structure ? 'structure' : juvenile ? 'juvenile' : unique ? 'unique' : equipment ? 'equipment' : civilian ? 'civilian' : classification ? 'classification' : contextual ? 'contextual' : lower === 'élite' ? 'elite' : 'common',
    excludedFromSpawn: excluded || equipment || classification || rosterUnverified, unique, rosterUnverified,
    combatant: !excluded && !equipment && !civilian && !classification && !structure && !juvenile,
    genericReserveAllowed: !excluded && !unique && !equipment && !civilian && !classification && !structure && !juvenile,
    requiresSourcePreset: lower.includes('preset'), originalWarOnly: lower.includes('variante originale') };
}
function species(row) {
  if (row.faction === 'Yautja' || row.faction === 'Matériel Yautja') return 'yautja';
  if (row.faction.includes('Synthétiques')) return 'synthetic';
  if (row.id.startsWith('HUM-')) return 'human';
  if (row.faction === 'Xénomorphes') return 'xeno';
  return 'other'; // Pathogen, Neomorph, Deacon, Trilobite and Eye remain distinct.
}
export const BATTLE_PROFILES = freeze(source.profiles.map(row => ({
  id: row.id, name: row.name, species: species(row), sourceFamily: row.faction, kind: row.kind,
  work: row.work, medium: row.medium, continuity: row.continuity, eligibility: eligibility(row),
  evidence: { status: row.evidenceStatus, fact: row.evidenceFact, sourceIds: [...row.sourceIds],
    urls: [...new Set(row.sourceIds.map(id => sourceIndex.get(id)?.url).filter(Boolean))] },
  design: { role: row.combatRole, groupRule: row.groupRule, compatiblePlaces: row.compatiblePlaces,
    allowedMatchups: row.allowedMatchups, restrictions: row.restrictions, remainingWork: row.missingWork },
  auditCodeStatus: row.codeStatus, visualFidelity1to1Verified: false, renderedAssetVerified: false,
})));

const levelBindings = ['gunnison_forest', 'xenomorph_prime', 'antarctic_pyramid', 'la_rooftops',
  'val_verde_jungle', 'romulus_station', 'charon_rogue_base', 'game_preserve_planet', 'stargazer_facility', 'prey_comanche_territory'];
const biomeHints = ['forest', 'hive', 'temple', 'city', 'jungle', 'station', 'industrial', 'jungle', 'industrial', 'forest',
  'industrial', 'temple', 'hive', 'station', 'jungle', 'temple', 'temple', 'industrial', 'industrial', 'station', 'city',
  'station', 'industrial', 'jungle', 'industrial', 'city', 'industrial', 'station', 'city', 'jungle', 'jungle', 'forest', 'industrial', 'hive'];
export const BATTLE_MAPS = freeze(source.maps.map((row, index) => ({ ...row, name: row.place,
  codeLevelId: levelBindings[index] ?? null, biomeHint: biomeHints[index],
  dimensions: { width: row.width, length: row.length, unit: 'game_unit', status: 'proposed_design_envelope' },
  geometryFidelity: 'not_measured', designOrigin: 'project_adaptation',
})));
export const BATTLE_GROUPS = freeze(source.groups.map(row => ({ ...row })));
export const BATTLE_BUDGETS = freeze(source.budgets.map(row => ({ ...row,
  enemy: { active: row.enemyActive, distant: row.enemyDistant, reserve: row.enemyReserve, total: row.enemyActive + row.enemyDistant + row.enemyReserve },
  ally: { active: row.allyActive, distant: row.allyDistant, reserve: row.allyReserve, total: row.allyActive + row.allyDistant + row.allyReserve },
  populationBasis: 'non_player_combatants', playersCountedSeparately: true, hardwareValidated: false,
})));
export const BATTLE_FRONTS = freeze(source.fronts.map(row => ({ ...row })));
export const BATTLE_BOSSES = freeze(source.bosses.map(row => ({ ...row, renderedAssetVerified: false })));
export const BATTLE_FIDELITY_RULES = freeze(source.fidelityRules.map(row => ({ ...row })));
export const BATTLE_MEDIA_PLACES = freeze(source.mediaPlaces.map(row => ({ ...row })));
export const BATTLE_OPERATIONS = freeze(source.operations.map(row => ({ ...row,
  mode: 'original', scenarioOrigin: 'audit_design_proposal', visualFidelity1to1Verified: false,
  playerSpecies: ['AFF-25', 'AFF-26'].includes(row.id) ? 'human' : 'yautja',
  requiresHumanController: ['AFF-25', 'AFF-26'].includes(row.id),
  runtimeStatus: 'catalogue_configuration_requires_scene_binding',
})));
const indexes = new Map();
function lookup(rows, id, label) {
  if (!indexes.has(rows)) indexes.set(rows, new Map(rows.map(row => [row.id, row])));
  const value = indexes.get(rows).get(id); if (!value) fail(`unknown ${label}: ${id}`); return value;
}
export const getBattleProfile = id => lookup(BATTLE_PROFILES, id, 'profile');
export const getBattleMap = id => lookup(BATTLE_MAPS, id, 'map');
export const getBattleOperation = id => lookup(BATTLE_OPERATIONS, id, 'operation');
export const getBattleBudget = id => lookup(BATTLE_BUDGETS, id, 'budget');
export const getBattleGroup = id => lookup(BATTLE_GROUPS, id, 'group');
export const getBattleFront = id => lookup(BATTLE_FRONTS, id, 'front');
export const getBattleBoss = id => lookup(BATTLE_BOSSES, id, 'boss');
export function getBattleOperationScene(operationId) {
  const operation = getBattleOperation(operationId), map = getBattleMap(operation.mapId);
  const fallback = { forest: 'gunnison_forest', hive: 'xenomorph_prime', temple: 'antarctic_pyramid',
    city: 'la_rooftops', jungle: 'val_verde_jungle', station: 'romulus_station', industrial: 'stargazer_facility' };
  return { levelId: map.codeLevelId ?? fallback[map.biomeHint], mapId: map.id, mapName: map.name,
    adaptedBiome: map.codeLevelId === null, exactGeometryVerified: false,
    label: `${operation.title} — opération originale${map.codeLevelId ? '' : ', terrain de biome adapté'}` };
}

/** Validate explicit deployments. A named or excluded profile can never become
 * an anonymous reserve template, even in free/crossover play. */
export function validateBattleRoster(deployments, { mode = 'original', works = [], reserve = false } = {}) {
  const errors = [], unique = new Set();
  if (!['original', 'clan_war', 'crossover', 'reconstruction'].includes(mode)) errors.push('unknown scenario mode');
  if (!Array.isArray(deployments)) return { valid: false, errors: ['roster must be an array'] };
  for (const deployment of deployments) {
    let profile;
    try { profile = getBattleProfile(deployment.profileId); } catch { errors.push(`unknown profile ${deployment.profileId}`); continue; }
    const count = deployment.count ?? 1, e = profile.eligibility;
    if (!Number.isInteger(count) || count < 1) errors.push(`${profile.id}: count must be a positive integer`);
    if (e.excludedFromSpawn) errors.push(`${profile.id}: excluded from combat spawn`);
    if (!e.combatant && !['civilian', 'structure', 'life_cycle'].includes(deployment.purpose)) errors.push(`${profile.id}: not a generic combatant`);
    if (reserve && !e.genericReserveAllowed) errors.push(`${profile.id}: cannot enter a generic reserve`);
    if (e.unique) {
      if (count !== 1 || unique.has(profile.id)) errors.push(`${profile.id}: named identity must occur once`);
      unique.add(profile.id);
    }
    if (mode === 'reconstruction' && !works.includes(profile.work)) errors.push(`${profile.id}: work is outside the selected reconstruction`);
    if (e.originalWarOnly && mode === 'reconstruction' && count > 1) errors.push(`${profile.id}: mass warfare is an original variant`);
    if (e.requiresSourcePreset && !works.includes(profile.work)) errors.push(`${profile.id}: source-game preset is required`);
  }
  return { valid: errors.length === 0, errors };
}

// Conservative adaptation rules, linked to the audit rather than a claim that
// every film prop and scene has been reconstructed. IDs match charactersData.
export const CHARACTER_ARSENAL_RULES = freeze({
  jungle_hunter: { profileId: 'YAU-001', work: 'Predator (1987)', weapons: ['wristblades', 'plasma_caster'], gadgets: ['medicomp', 'cloak', 'thermal_mask', 'audio_lure', 'nuke_gauntlet'], evidenceRules: ['LORE-017', 'FID-AR-01'] },
  city_hunter: { profileId: 'YAU-002', work: 'Predator 2', weapons: ['wristblades', 'combistick', 'smart_disc', 'netgun', 'speargun', 'plasma_caster'], gadgets: ['medicomp', 'cloak', 'thermal_mask', 'nuke_gauntlet'], evidenceRules: ['LORE-017', 'FID-AR-02'] },
  wolf_predator: { profileId: 'YAU-003', work: 'AVP Requiem', weapons: ['wristblades', 'combistick', 'shuriken', 'dual_caster', 'plasma_pistol'], gadgets: ['medicomp', 'cloak', 'thermal_mask', 'acid_solvent'], evidenceRules: ['LORE-014', 'FID-AR-03'] },
  feral_predator: { profileId: 'YAU-004', work: 'Prey', weapons: ['wristblades', 'feral_shield', 'crossbow'], gadgets: ['cloak', 'thermal_mask'], evidenceRules: ['LORE-018', 'FID-AR-04'] },
  alpha_predator: { profileId: 'YAU-005', work: 'Predator: Hunting Grounds', weapons: ['wristblades', 'alpha_sickle'], gadgets: ['medicomp', 'cloak', 'thermal_mask'], evidenceRules: ['LORE-019', 'FID-AR-05'] },
  samurai_predator: { profileId: 'YAU-006', work: 'Predator: Hunting Grounds', weapons: ['wristblades', 'katana'], gadgets: ['medicomp', 'cloak', 'thermal_mask'], evidenceRules: ['LORE-019', 'FID-AR-05'] },
  viking_predator: { profileId: 'YAU-007', work: 'Predator: Hunting Grounds', weapons: ['wristblades', 'viking_axe'], gadgets: ['medicomp', 'cloak', 'thermal_mask'], evidenceRules: ['LORE-019', 'FID-AR-05'] },
});
export function validateCharacterArsenal(characterId, equipment, { mode = 'reconstruction' } = {}) {
  const rule = CHARACTER_ARSENAL_RULES[characterId]; if (!rule) return { valid: false, errors: ['unknown character arsenal'] };
  const items = Array.isArray(equipment) ? equipment : [equipment?.primary, equipment?.secondary, ...(equipment?.gadgets ?? [])].filter(Boolean);
  const allowed = new Set([...rule.weapons, ...rule.gadgets]), known = new Set(ULTIMATE_YAUTJA_ARMORY.map(item => item.id));
  const errors = items.filter(id => !known.has(id)).map(id => `unknown equipment: ${id}`);
  if (mode === 'reconstruction') errors.push(...items.filter(id => !allowed.has(id)).map(id => `${characterId}: ${id} requires an adapted/free loadout`));
  return { valid: errors.length === 0, errors, fidelity1to1Verified: false, rule: clone(rule) };
}

function allocatedCamp(entry, side, playerSpecies) {
  if (side === 'ally') return { id: 'player_clan', species: playerSpecies };
  const group = getBattleGroup(entry.groupId), hint = `${entry.camp ?? ''} ${group.faction}`.toLocaleLowerCase('fr');
  if (/xénom|xenom|ruche/.test(hint)) return { id: 'hive', species: 'xeno' };
  if (/yautja|clan rival/.test(hint) && !/force humaine/.test(hint)) return { id: 'rival_clan', species: 'yautja' };
  return { id: 'human_force', species: 'human' };
}
function proposedAllocation(operation) {
  if (operation.forceAllocation) return operation.forceAllocation;
  // AFF-06..10 describe exact counts in prose rather than forceAllocation.
  // This is a reviewed translation of those five rows, not a text parser.
  const small = ['AFF-06', 'AFF-07'].includes(operation.id);
  const active = small ? [32, 16, 16] : [48, 32, 24, 24], distant = small ? [32, 48, 48] : [96, 96, 96, 96];
  const troopId = operation.enemyGroupIds[0], commandFront = operation.id === 'AFF-06' ? 2 : operation.id === 'AFF-10' ? 1 : 0;
  const entry = (groupId, npc, unitSize) => ({ groupId, npc, squads: npc / unitSize });
  const placements = (counts, category) => counts.map((npc, index) => {
    const command = category === 'active' && index === commandFront;
    const enemy = [entry(troopId, npc - (command ? 8 : 0), 8)]; if (command) enemy.push(entry('GRP-42', 8, 8));
    let ally = [];
    if (small) { if (category === 'active' && index === 0) ally = [entry('GRP-13', 4, 4)]; if (category === 'distant' && index > 0) ally = [entry('GRP-12', 2, 2)]; }
    else if (category === 'active' && index === 0 || category === 'distant' && index === 2) ally = [entry('GRP-11', 8, 8)];
    else if (category === 'active' && index === 1 || category === 'distant' && index === 3) ally = [entry('GRP-13', 4, 4)];
    return { front: String.fromCharCode(65 + index), enemy, ally };
  });
  return { active: placements(active, 'active'), distant: placements(distant, 'distant'), reserve: [{ front: 'Réserve', enemy: [entry(troopId, small ? 64 : 256, 8)], ally: small ? [] : [entry('GRP-11', 8, 8)] }] };
}
function genericProfile(speciesId, role = 'soldier') {
  return { id: `original_${speciesId}_${role}`, species: speciesId, role,
    actorType: speciesId === 'xeno' ? 'warrior' : speciesId === 'yautja' ? 'clan_hunter' : 'marine',
    maxHp: role === 'officer' ? 480 : speciesId === 'yautja' ? 300 : speciesId === 'xeno' ? 200 : 160,
    damage: role === 'officer' ? 32 : 18, attackInterval: speciesId === 'human' ? 2.4 : 2.0,
    rare: role === 'officer', unique: false, excludedFromSpawn: false, allowedWorks: [], allowedEras: [], allowedFactions: [],
    fidelity: 'original', provenance: 'project battlefield archetype, not a named media individual', visualFidelity1to1Verified: false };
}
function commanderProfile(speciesId, boss) {
  const profile = { ...genericProfile(speciesId, 'officer'), id: `original_commander_${boss.id}`, name: boss.name, unique: true, sourceBossId: boss.id };
  if (boss.id === 'BOS-39') Object.assign(profile, { actorType: 'queen', sourceBossType: 'xenomorph_queen', maxHp: 3000,
    provenance: 'Original LV-742 operation queen; native queen rendering is required, not a renamed Warrior.' });
  if (boss.id === 'BOS-32') Object.assign(profile, { actorType: 'praetorian', sourceBossType: 'praetorian', maxHp: 1200 });
  if (boss.id === 'BOS-33') Object.assign(profile, { actorType: 'spitter', sourceBossType: null });
  return profile;
}

function capDetailedAgents(byFaction, groups, ceiling) {
  const desired = Object.values(byFaction).reduce((sum, allocation) => sum + allocation.active, 0);
  const active = Math.min(desired, ceiling), original = clone(byFaction);
  if (active === desired) return { active, desired, original };
  const rows = Object.entries(byFaction).map(([id, allocation]) => ({ id, allocation, desired: allocation.active,
    quantum: Math.min(allocation.active, Math.max(1, ...groups.filter(group => group.factionId === id).map(group => group.units.length))) }));
  const minimum = rows.reduce((sum, row) => sum + row.quantum, 0);
  if (active < minimum) fail(`detail ceiling ${ceiling} cannot fit one allocated group per faction (${minimum})`);
  for (const row of rows) row.allocation.active = row.quantum;
  let remaining = active - minimum;
  // Prefer complete squads; no individual is split, deleted or moved into a
  // new reserve. These are capacities, while every live ID stays simulated.
  while (remaining > 0) {
    const candidates = rows.filter(row => row.quantum <= remaining && row.allocation.active + row.quantum <= row.desired)
      .sort((a, b) => (b.desired / desired * active - b.allocation.active) - (a.desired / desired * active - a.allocation.active));
    if (!candidates.length) break;
    const row = candidates[0]; row.allocation.active += row.quantum; remaining -= row.quantum;
  }
  while (remaining > 0) {
    const row = rows.filter(row => row.allocation.active < row.desired)
      .sort((a, b) => (b.desired / desired * active - b.allocation.active) - (a.desired / desired * active - a.allocation.active))[0];
    row.allocation.active++; remaining--;
  }
  for (const row of rows) row.allocation.distant = row.allocation.total - row.allocation.reserve - row.allocation.active;
  return { active, desired, original };
}

/** Translate one proposed operation into the persistent simulation contract.
 * Positions are overridable by the actual scene layout; source dimensions are
 * not silently treated as a constructed or certified map. */
export function getBattleOperationConfig(operationId, { playerCount = 1, budgetId, frontPositions, allowHumanController = false,
  maxDetailedAgents = 32, experimentalDetailBudget = false } = {}) {
  const operation = getBattleOperation(operationId), map = getBattleMap(operation.mapId), frontSpec = getBattleFront(operation.frontId), budget = getBattleBudget(budgetId ?? operation.budgetId);
  if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > 2) fail('one or two players are required');
  if (!Number.isInteger(maxDetailedAgents) || maxDetailedAgents < 1 || maxDetailedAgents > 512) fail('detail ceiling must be an integer from 1 to 512');
  if (maxDetailedAgents > 32 && experimentalDetailBudget !== true) fail('more than 32 detailed agents requires an explicit experimentalDetailBudget option; hardware performance is unverified');
  if (operation.requiresHumanController && !allowHumanController) fail(`${operation.id}: optional human controller is not implemented by this catalogue`);
  const count = Math.max(3, Math.min(5, budget.fronts)), positions = frontPositions ?? Array.from({ length: count }, (_, index) => [Math.cos(index / count * Math.PI * 2) * 120, Math.sin(index / count * Math.PI * 2) * 120]);
  if (!Array.isArray(positions) || positions.length !== count || positions.some(position => !Array.isArray(position) || position.length !== 2 || position.some(value => !Number.isFinite(value)))) fail(`exactly ${count} finite front positions are required`);
  const playerFaction = 'player_clan', camps = new Map(), forceAllocation = proposedAllocation(operation), playerFrontIndex = operationId === 'AFF-27' ? 3 : 0;
  for (const category of ['active', 'distant', 'reserve']) for (const placement of forceAllocation[category]) for (const side of ['enemy', 'ally']) for (const entry of placement[side]) {
    const camp = allocatedCamp(entry, side, operation.playerSpecies); camps.set(camp.id, camp);
  }
  const sides = [...camps.values()].filter(camp => camp.id !== playerFaction);
  const factions = [{ id: playerFaction, species: operation.playerSpecies, allegiance: 'player', moraleModel: operation.playerSpecies === 'human' ? 'human_morale' : 'clan_cohesion' },
    ...sides.map(side => ({ id: side.id, species: side.species, allegiance: 'independent', moraleModel: side.species === 'xeno' ? 'hive_coordination' : side.species === 'yautja' ? 'clan_cohesion' : 'human_morale' }))];
  const relations = factions.flatMap((faction, index) => factions.slice(index + 1).map(other => ({ a: faction.id, b: other.id, state: 'hostile' })));
  const fronts = Array.from({ length: count }, (_, index) => ({ id: `front_${String.fromCharCode(97 + index)}`, label: frontSpec[`front${String.fromCharCode(65 + index)}`] || `Front ${index + 1}`,
    position: [...positions[index]], radius: 15, owner: index === playerFrontIndex ? playerFaction : sides[index % sides.length].id,
    baseHP: 1000, captureThreshold: 100, reinforcementSource: true, criticalFor: index === playerFrontIndex ? [playerFaction] : [] }));
  const routes = [];
  for (let index = 0; index < count; index++) {
    const from = fronts[index], to = fronts[(index + 1) % count];
    routes.push({ id: `route_${index}`, from: from.id, to: to.id, travelSeconds: 20, open: true });
  }
  if (count > 3) routes.push({ id: 'route_cross', from: fronts[0].id, to: fronts[2].id, travelSeconds: 25, open: true });
  const byFaction = Object.fromEntries(factions.map(faction => [faction.id, { active: 0, distant: 0, reserve: 0, total: 0 }]));
  const profiles = [...new Set(factions.map(faction => faction.species))].flatMap(kind => [genericProfile(kind), genericProfile(kind, 'officer')]);
  const groups = [];
  const assignedBosses = new Set();
  for (const category of ['active', 'distant', 'reserve']) for (const placement of forceAllocation[category]) for (const side of ['enemy', 'ally']) for (const entry of placement[side]) {
    const faction = allocatedCamp(entry, side, operation.playerSpecies), allocation = byFaction[faction.id];
    allocation[category] += entry.npc; allocation.total += entry.npc;
    const sizes = Array.from({ length: entry.squads }, (_, index) => Math.floor(entry.npc / entry.squads) + (index < entry.npc % entry.squads ? 1 : 0));
    for (const quantity of sizes) {
      if (!quantity) continue;
      const id = `${operationId}:${faction.id}:${groups.length}`, frontIndex = /^[A-E]$/.test(placement.front) ? placement.front.charCodeAt(0) - 65 : fronts.findIndex(front => front.owner === faction.id);
      const group = { id, factionId: faction.id, frontId: fronts[Math.max(0, frontIndex)]?.id ?? fronts[0].id,
        state: category === 'reserve' ? 'reserve' : 'distant', sourceState: category, sourceTemplateIds: [entry.groupId],
        units: Array.from({ length: quantity }, (_, index) => ({ id: `${id}:${index}`, profileId: `original_${faction.species}_${index === 0 ? 'officer' : 'soldier'}`, officer: index === 0 })) };
      if (entry.bossId && !assignedBosses.has(entry.bossId)) {
        const boss = getBattleBoss(entry.bossId), profile = commanderProfile(faction.species, boss);
        profiles.push(profile); group.units[0] = { ...group.units[0], profileId: profile.id, uniqueId: boss.id, officer: true }; assignedBosses.add(boss.id);
      }
      if (entry.groupId === 'GRP-57') {
        const theta = getBattleProfile('HUM-032'), profile = { ...genericProfile('human', 'officer'), id: 'adapted_theta', name: theta.name, unique: true, fidelity: 'adaptation', sourceProfileId: theta.id };
        if (!profiles.some(item => item.id === profile.id)) profiles.push(profile);
        group.units[0] = { ...group.units[0], profileId: profile.id, uniqueId: 'HUM-032', officer: true };
      }
      groups.push(group);
    }
  }
  const enemyTotal = sides.reduce((sum, camp) => sum + byFaction[camp.id].total, 0);
  if (enemyTotal !== budget.enemy.total || byFaction[playerFaction].total !== budget.ally.total) fail('selected budget changes the proposed finite force; explicit reallocation is required');
  if (budget.id !== operation.budgetId) {
    // A lower detail preset keeps every allocated ID/reserve and moves only
    // simulation capacity. It never removes distant troops to improve FPS.
    const original = getBattleBudget(operation.budgetId);
    if (budget.enemy.reserve !== original.enemy.reserve || budget.ally.reserve !== original.ally.reserve) fail('preset would change finite reserves');
    let used = 0;
    sides.forEach((camp, index) => {
      const allocation = byFaction[camp.id], active = index === sides.length - 1 ? budget.enemy.active - used : Math.floor(budget.enemy.active * allocation.total / enemyTotal);
      used += active; allocation.active = active; allocation.distant = allocation.total - allocation.reserve - active;
    });
    byFaction[playerFaction].active = budget.ally.active; byFaction[playerFaction].distant = budget.ally.distant;
  }
  // A commander replaces an allocated opponent. No boss is added on top of the
  // finite force count, and repeated access to this factory does not spawn it.
  for (let index = 0; index < operation.bossIds.length; index++) {
    if (assignedBosses.has(operation.bossIds[index])) continue;
    const faction = factions[1 + index % sides.length];
    const preferredTemplate = faction.species === 'human' ? 'GRP-42' : faction.species === 'yautja' ? 'GRP-36' : 'GRP-62';
    const group = groups.find(item => item.factionId === faction.id && item.state === 'distant' && item.sourceTemplateIds.includes(preferredTemplate))
      ?? groups.find(item => item.factionId === faction.id && item.state === 'distant');
    if (!group) continue;
    const boss = getBattleBoss(operation.bossIds[index]), profile = commanderProfile(faction.species, boss);
    profiles.push(profile); group.units[0] = { ...group.units[0], profileId: profile.id, uniqueId: boss.id, officer: true };
  }
  const detail = capDetailedAgents(byFaction, groups, maxDetailedAgents);
  const configuration = { id: operationId, name: operation.title, mode: 'original', playerFaction,
    mapId: map.id, levelId: getBattleOperationScene(operationId).levelId, sceneRecommendation: getBattleOperationScene(operationId), frontId: frontSpec.id, budgetId: budget.id,
    context: { era: 'operation_specific', works: [map.continuity], continuities: [operation.continuity], players: playerCount,
      designOrigin: 'audit_operation_proposal', allowAdaptations: true, requiresSceneBinding: true, visualFidelity1to1Verified: false },
    desiredDetailedBudget: detail.desired, sourceDetailedBudget: { budgetId: budget.id, active: detail.desired, byFaction: detail.original },
    detailBudgetPolicy: { maxDetailedAgents, capped: detail.active < detail.desired, experimental: maxDetailedAgents > 32, hardwareProfiled: false },
    detailedBudgetNotice: `Plafond provisoire : ${detail.active} combattants proches ; proposition source : ${detail.desired}. Les unités excédentaires restent simulées à distance. Performances sur matériel non mesurées.`,
    factions, relations, budgets: { active: detail.active, desiredActive: detail.desired, maxDetailedAgents, byFaction, spawnInterval: 8,
      // A finite eight-member group must fit one announced arrival. Otherwise
      // every such reserve is rejected before it can use its physical source.
      arrivalsPerTick: Math.max(4, ...groups.filter(group => group.state === 'reserve').map(group => group.units.length)) },
    fronts, routes, profiles, groups,
    objectives: { externalVictory: true, captureFronts: fronts.filter((front, index) => index !== playerFrontIndex).map(front => front.id), killCommanders: [], evacuateGroups: [], loseFronts: [fronts[playerFrontIndex].id], defeatGraceSeconds: 30 },
    sourceObjectives: { objectives: operation.objectives, victory: operation.victory, defeat: operation.defeat,
      reinforcementRules: operation.reinforcementRules, parallelConsequences: operation.parallelConsequences, acceptance: operation.acceptance },
    adaptation: 'Original operation adapted from the audit. Physical objectives and narrative strategies are executed by OperationObjectives; source prose and visual-fidelity limits remain separate.',
    provenance: clone(BATTLE_CATALOG_PROVENANCE) };
  configuration.operationObjectives = createOperationObjectiveSpec(operation, configuration);
  return configuration;
}

/** Structural coverage is distinct from executing every gameplay acceptance. */
export function validateBattleCatalog() {
  const errors = [];
  for (const [name, rows] of Object.entries({ profiles: BATTLE_PROFILES, maps: BATTLE_MAPS, operations: BATTLE_OPERATIONS, groups: BATTLE_GROUPS, budgets: BATTLE_BUDGETS, fronts: BATTLE_FRONTS, bosses: BATTLE_BOSSES })) {
    if (new Set(rows.map(row => row.id)).size !== rows.length) errors.push(`${name}: duplicate IDs`);
  }
  for (const profile of BATTLE_PROFILES) for (const id of profile.evidence.sourceIds) if (!sourceIndex.has(id)) errors.push(`${profile.id}: missing source ${id}`);
  for (const operation of BATTLE_OPERATIONS) {
    for (const [getter, id] of [[getBattleMap, operation.mapId], [getBattleFront, operation.frontId], [getBattleBudget, operation.budgetId], ...operation.alliedGroupIds.map(id => [getBattleGroup, id]), ...operation.enemyGroupIds.map(id => [getBattleGroup, id]), ...operation.bossIds.map(id => [getBattleBoss, id])]) {
      try { getter(id); } catch { errors.push(`${operation.id}: unresolved reference ${id}`); }
    }
  }
  for (const budget of BATTLE_BUDGETS) for (const side of ['enemy', 'ally']) if (Object.values(budget[side]).some(value => !Number.isInteger(value) || value < 0)) errors.push(`${budget.id}: invalid ${side} allocation`);
  return { valid: errors.length === 0, errors, counts: { profiles: BATTLE_PROFILES.length, maps: BATTLE_MAPS.length, operations: BATTLE_OPERATIONS.length, groups: BATTLE_GROUPS.length, budgets: BATTLE_BUDGETS.length, fronts: BATTLE_FRONTS.length, sources: BATTLE_SOURCES.length } };
}

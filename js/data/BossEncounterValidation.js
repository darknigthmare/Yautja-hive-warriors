/* Validate an encounter before changing the running scene. Geographic layouts
 * and statistics remain game adaptations; this certifies identities/contracts. */
import { getBossDefinition, bossAllowedInLevel } from './BossRegistry.js';

const MODES = new Set(['level', 'sandbox', 'operation', 'crossover']);
const key = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value);
const failure = message => { throw new TypeError(`Boss encounter configuration: ${message}`); };

export function prepareBossEncounter({ level, bossType = level?.bossType, mode = 'level' } = {}) {
  if (!level || !key(level.id)) failure('a level identity is required');
  if (!MODES.has(mode)) failure('unknown encounter mode');
  const definition = getBossDefinition(bossType);
  if (mode === 'level') {
    const announced = getBossDefinition(level.bossType);
    if (definition.id !== announced.id) failure('requested boss differs from the announced level boss');
    if (!bossAllowedInLevel(definition.id, level.id)) failure('boss is not assigned to this level; choose an explicit alternate mode');
  }
  return Object.freeze({ version: 1, bossType: definition.id, modelId: definition.id, combatId: definition.id,
    label: definition.label, levelId: level.id, mode, species: definition.species,
    maxHp: definition.hp, height: definition.height, source: definition.source,
    assetFidelity: definition.assetFidelity, fidelity1to1Verified: false });
}

export function validatePreparedBossEncounter(prepared, bossType) {
  const definition = getBossDefinition(bossType);
  if (!prepared || prepared.version !== 1 || !MODES.has(prepared.mode) || !key(prepared.levelId) ||
      prepared.bossType !== definition.id || prepared.modelId !== definition.id || prepared.combatId !== definition.id ||
      prepared.label !== definition.label || prepared.maxHp !== definition.hp || prepared.height !== definition.height) failure('prepared identity/model/combat contract changed');
  if (prepared.mode === 'level' && !bossAllowedInLevel(definition.id, prepared.levelId)) failure('prepared boss/level pairing changed');
  return definition;
}

/** Catalogue mini-bosses remain actors of their normal manager. Only an
 * explicit queen projection uses the one major-boss slot. */
export function validateOperationBossConfiguration(config, level) {
  if (!config || !Array.isArray(config.profiles) || !Array.isArray(config.groups) || !key(level?.id)) failure('operation profiles/groups/level are required');
  const profiles = new Map(config.profiles.map(profile => [profile.id, profile])), seen = new Set(), major = [], mini = [];
  if (profiles.size !== config.profiles.length) failure('duplicate profile identity');
  for (const group of config.groups) for (const unit of group.units ?? []) {
    if (!key(unit.id) || seen.has(unit.id)) failure('duplicate or invalid allocated identity');
    seen.add(unit.id);
    const profile = profiles.get(unit.profileId);
    if (!profile) failure('allocated profile is missing');
    if (profile.actorType === 'queen' && !profile.sourceBossType) failure('queen profile has no explicit boss identity');
    if (!profile.sourceBossType) continue;
    const prepared = prepareBossEncounter({ level, bossType: profile.sourceBossType, mode: 'operation' });
    if (prepared.species === 'xenomorph' && !['xeno', 'xenomorph'].includes(profile.species)) failure('boss profile species does not match its encounter');
    if (profile.actorType === 'queen') {
      if (prepared.bossType !== 'xenomorph_queen') failure('queen renderer cannot stand in for another boss');
      major.push({ ...prepared, unitId: unit.id, groupId: group.id });
    } else {
      if (profile.actorType !== 'praetorian' || prepared.bossType !== 'praetorian') failure('unsupported mini-boss renderer/encounter pairing');
      mini.push({ ...prepared, unitId: unit.id, groupId: group.id });
    }
  }
  if (major.length > 1) failure('this operation requires more than the supported single major-boss slot');
  return { major, mini, identitiesChecked: seen.size };
}

export const BOSS_COOLDOWN_KEYS = Object.freeze(['contactCooldown', 'tailWhipCooldown', 'spitCooldown', 'regurgitateCooldown', 'shriekCooldown', 'specialCooldown', 'weaponRecovery']);
const COMBAT_STATE_KEYS = new Set(['version', 'bossType', 'battleUnitId', 'hp', 'maxHp', 'position', 'phase', 'isStunned', 'stunTimer', 'hasEnteredStun', 'phaseShieldHp',
  'hasPhaseShield', 'broodAllowance', 'weaponSequence', 'shieldRemaining', 'exposedRemaining', 'cooldowns', 'attackWasInProgress', 'simulationTime']);

/** Pure bounded validation for the simulation/checkpoint owner. The snapshot's
 * HP describes when it was taken; the simulation's current HP remains supreme. */
export function validateBossCombatState(state, { bossType = state?.bossType, battleUnitId = state?.battleUnitId, maxHp = state?.maxHp } = {}) {
  const finite = (value, max = 1e6) => Number.isFinite(value) && value >= 0 && value <= max;
  const definition = getBossDefinition(bossType);
  if (!state || typeof state !== 'object' || Array.isArray(state) || Object.keys(state).some(key => !COMBAT_STATE_KEYS.has(key)) || state.version !== 1 || state.bossType !== definition.id ||
    state.battleUnitId !== battleUnitId || (state.battleUnitId !== null && !key(state.battleUnitId)) || !finite(maxHp) || maxHp <= 0 || state.maxHp !== maxHp ||
    !finite(state.hp, maxHp) || state.hp <= 0 || !Array.isArray(state.position) || state.position.length !== 3 || !state.position.every(value => Number.isFinite(value) && Math.abs(value) <= 1e7) ||
    !Number.isInteger(state.phase) || state.phase < (state.hp <= maxHp * .3 ? 3 : state.hp <= maxHp * .65 ? 2 : 1) || state.phase > 3 ||
    !Number.isInteger(state.weaponSequence) || !finite(state.weaponSequence) || !Number.isInteger(state.broodAllowance) || !finite(state.broodAllowance, 6) || !finite(state.phaseShieldHp, 1800) ||
    ![state.isStunned, state.hasEnteredStun, state.hasPhaseShield, state.attackWasInProgress].every(value => typeof value === 'boolean') ||
    !finite(state.stunTimer, 120) || !finite(state.shieldRemaining, 120) || !finite(state.exposedRemaining, 120) || (state.simulationTime !== null && !finite(state.simulationTime, 1e9)) ||
    !state.cooldowns || Object.keys(state.cooldowns).length !== BOSS_COOLDOWN_KEYS.length || BOSS_COOLDOWN_KEYS.some(key => !Object.hasOwn(state.cooldowns, key) || !finite(state.cooldowns[key], 120))) failure('invalid boss combat checkpoint');
  return structuredClone(state);
}

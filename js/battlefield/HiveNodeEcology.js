/* Finite hive ecology for LV-742. Nodes are destructible structures, never
 * battle units, soldiers, reserves or eggs. All costs are gameplay adaptations.
 * Extinction: Drone alone builds nodes, hive-space heals; infestation is earned
 * from confirmed hostile casualties, not from free timed spawns. */
import { sourceUnitVisualKind } from '../data/SourceActorPresentation.js';

export const HIVE_NODE_RULES = Object.freeze({
  cost: 3, bankCap: 12, maxNodesPerFaction: 3, nodeHP: 280,
  radius: 11, healPerSecond: 8, minSpacing: 16, maxPosition: 10000,
});

const distance = (a,b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const point = p => Array.isArray(p) && p.length === 2 &&
  p.every(x => Number.isFinite(x) && Math.abs(x) <= HIVE_NODE_RULES.maxPosition);
const int = (v,lo,hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
const copy = obj => JSON.parse(JSON.stringify(obj));
const fail = () => { throw new RangeError('invalid persisted hive ecology'); };

const isDrone = unit => unit && unit.species === 'xenomorph' &&
  sourceUnitVisualKind(unit) === 'drone' &&
  unit.hp > 0 && !unit.incapacitated &&
  (unit.state === 'active' || unit.state === 'distant');

export function createHiveEcology(operationId, factions = []) {
  const banks = operationId === 'AFF-27' ? factions
    .filter(f => ['xeno','xenomorph'].includes(f.species))
    .map(f => ({ factionId: f.id, points: 0, earned: 0, spent: 0 })) : [];
  return { version: 1, sequence: 0, banks, nodes: [], buildersUsed: [], spores: [] };
}

export function awardHiveInfestation(ecology, killerFaction, victimFaction, isHostile) {
  const bank = ecology?.banks?.find(b => b.factionId === killerFaction);
  if (!bank || !victimFaction || victimFaction === killerFaction || !isHostile ||
      bank.points >= HIVE_NODE_RULES.bankCap) return false;
  bank.points++; bank.earned++;
  return true;
}

export function buildHiveNode(ecology, units, time) {
  if (!ecology?.banks?.length || !Number.isFinite(time) || time < 0) return null;
  for (const bank of ecology.banks) {
    if (bank.points < HIVE_NODE_RULES.cost ||
        ecology.nodes.filter(node => node.factionId === bank.factionId).length >= HIVE_NODE_RULES.maxNodesPerFaction)
      continue;
    const candidates = [...units].filter(unit => isDrone(unit) &&
      unit.factionId === bank.factionId && point(unit.position) &&
      !ecology.buildersUsed.includes(unit.id) &&
      ecology.nodes.every(node => distance(node.position, unit.position) >= HIVE_NODE_RULES.minSpacing));
    candidates.sort((a,b) => a.id.localeCompare(b.id));
    const drone = candidates[0]; if (!drone) continue;
    bank.points -= HIVE_NODE_RULES.cost; bank.spent += HIVE_NODE_RULES.cost;
    const node = {
      id: `hive-node:${bank.factionId}:${++ecology.sequence}`,
      builderId: drone.id, factionId: drone.factionId, position: [...drone.position],
      hp: HIVE_NODE_RULES.nodeHP, createdAt: time
    };
    ecology.nodes.push(node); ecology.buildersUsed.push(drone.id);
    return copy(node);
  }
  return null;
}

export function healHiveSpace(ecology, units, delta, onHeal = null) {
  if (!ecology?.nodes?.length || !Number.isFinite(delta) || delta <= 0 || delta > 1) return [];
  const healed = [];
  for (const unit of units) {
    if (!unit || unit.species !== 'xenomorph' || !['active','distant'].includes(unit.state) ||
        !(unit.hp > 0) || unit.incapacitated || !(unit.hp < unit.maxHp) || !point(unit.position)) continue;
    const node = ecology.nodes.find(node => node.factionId === unit.factionId &&
      node.hp > 0 && distance(node.position, unit.position) <= HIVE_NODE_RULES.radius);
    if (!node) continue;
    const before = unit.hp;
    unit.hp = Math.min(unit.maxHp, unit.hp + HIVE_NODE_RULES.healPerSecond * delta);
    if (unit.hp === before) continue;
    const entry = { unitId: unit.id, hp: unit.hp, amount: unit.hp - before, nodeId: node.id };
    healed.push(entry); onHeal?.(entry);
  }
  return healed;
}

export function damageHiveNode(ecology, nodeId, amount, hostile) {
  if (!ecology?.nodes || !Number.isFinite(amount) || amount <= 0 || !hostile) return null;
  const index = ecology.nodes.findIndex(node => node.id === nodeId);
  if (index === -1) return null;
  const node = ecology.nodes[index];
  node.hp = Math.max(0, node.hp - amount);
  const result = { nodeId, factionId: node.factionId, hp: node.hp, destroyed: node.hp === 0 };
  if (result.destroyed) ecology.nodes.splice(index, 1);
  return result;
}

export function snapshotHiveEcology(ecology) { return copy(ecology); }

export function restoreHiveEcology(initial, saved, units, savedTime, deathLedger = null) {
  if (saved === undefined || saved === null) return initial;
  if (!saved || saved.version !== 1 || !int(saved.sequence,0,1000000) ||
      !Array.isArray(saved.banks) || saved.banks.length !== initial.banks.length ||
      !Array.isArray(saved.nodes) || !Array.isArray(saved.buildersUsed) ||
      saved.buildersUsed.length > units.size || saved.buildersUsed.length > saved.sequence || saved.nodes.length > saved.buildersUsed.length ||
      new Set(saved.buildersUsed).size !== saved.buildersUsed.length) fail();
  const validBanks = new Set(initial.banks.map(b => b.factionId));
  if (new Set(saved.banks.map(b => b?.factionId)).size !== validBanks.size ||
      saved.banks.some(b => !validBanks.has(b?.factionId) ||
        !int(b.points,0,HIVE_NODE_RULES.bankCap) ||
        !int(b.earned,0,1000000) || !int(b.spent,0,1000000) ||
        b.spent % HIVE_NODE_RULES.cost !== 0 || b.earned !== b.points + b.spent)) fail();
  if (deathLedger) for (const bank of saved.banks) {
    const confirmed = [...deathLedger.values()].filter(death => death.killerFaction === bank.factionId &&
      death.factionId !== bank.factionId).length;
    if (bank.earned > confirmed) fail(); // Never fabricate infestation currency in a checkpoint.
  }
  const creators = new Map();
  for (const id of saved.buildersUsed) {
    const unit = units.get(id);
    if (!unit || unit.species !== 'xenomorph' ||
        sourceUnitVisualKind(unit) !== 'drone' || !validBanks.has(unit.factionId)) fail();
    creators.set(id,unit);
  }
  if (saved.nodes.length > validBanks.size * HIVE_NODE_RULES.maxNodesPerFaction ||
      new Set(saved.nodes.map(n => n?.id)).size !== saved.nodes.length ||
      new Set(saved.nodes.map(n => n?.builderId)).size !== saved.nodes.length) fail();
  for (const node of saved.nodes) {
    const creator=creators.get(node?.builderId);
    const match=/^hive-node:([a-zA-Z0-9_.-]+):([1-9]\d*)$/.exec(node?.id ?? '');
    if (!creator || !match || match[1] !== creator.factionId ||
        Number(match[2]) > saved.sequence || node.factionId !== creator.factionId ||
        !point(node.position) || !Number.isFinite(node.hp) ||
        node.hp <= 0 || node.hp > HIVE_NODE_RULES.nodeHP ||
        !Number.isFinite(node.createdAt) || node.createdAt < 0 || node.createdAt > savedTime) fail();
  }
  for (let i = 0; i < saved.nodes.length; i++) for (let j = 0; j < i; j++) {
    if (distance(saved.nodes[i].position, saved.nodes[j].position) < HIVE_NODE_RULES.minSpacing) fail();
  }
  for (const b of saved.banks) {
    if (saved.nodes.filter(node => node.factionId === b.factionId).length > HIVE_NODE_RULES.maxNodesPerFaction) fail();
    if (saved.buildersUsed.filter(id => creators.get(id).factionId === b.factionId).length >
        b.spent / HIVE_NODE_RULES.cost) fail();
  }
  return copy(saved);
}

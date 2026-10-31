/* Extinction ecology: Facehuggers are vulnerable away from Hive-space.
 * This is not a breeding/spawning pipeline. Damage rate is a project tuning
 * value, not a measured AVP: Extinction statistic. */
export const FACEHUGGER_EXPOSURE = Object.freeze({
  hpPerSecond: 0.8, maxDeltaSeconds: 1,
  source: 'Aliens versus Predator: Extinction, PS2 manual, Healing / Gathering Hosts',
  fidelity: 'source-role-mechanic; project-balance-number'
});

const finitePoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const distSq = (a,b) => (a[0]-b[0]) ** 2 + (a[1]-b[1]) ** 2;

export function facehuggerOnHiveSpace(ecology, unit, radius = 11) {
  if (!ecology?.banks?.length || !unit || !finitePoint(unit.position)) return false;
  return ecology.nodes.some(node => node.hp > 0 && node.factionId === unit.factionId &&
    finitePoint(node.position) && distSq(node.position,unit.position) <= radius*radius);
}

/** Return bounded HP changes. Caller owns death events, UI and rendering sync,
 * thereby preserving exactly one authoritative soldier identity and loss. */
export function applyFacehuggerExposure(ecology, units, delta, radius = 11) {
  if (!ecology?.banks?.length || !Number.isFinite(delta) || delta <= 0 ||
      delta > FACEHUGGER_EXPOSURE.maxDeltaSeconds) return [];
  const affected=[];
  for (const unit of units) {
    if (!unit || unit.species !== 'xenomorph' || unit.actorType !== 'facehugger' ||
        !['active','distant'].includes(unit.state) || !(unit.hp > 0) ||
        !Number.isFinite(unit.maxHp) || !finitePoint(unit.position) ||
        facehuggerOnHiveSpace(ecology,unit,radius)) continue;
    const next = Math.max(0,unit.hp-FACEHUGGER_EXPOSURE.hpPerSecond*delta);
    const damage = unit.hp-next;
    if (!(damage > 0)) continue;
    unit.hp=next;
    unit.damageTaken=(unit.damageTaken??0)+damage;
    affected.push({ unitId:unit.id,hp:next,damage,expired:next===0 });
  }
  return affected;
}

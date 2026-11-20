import { traceCombatSegment } from './CombatGeometry.js';

// One physical first impact, shared by the wooden PREY arrow's actor and cover
// checks. It cannot damage a second overlapping target or a target behind cover.
export function traceSingleProjectileImpact(from, to, targets, environment, isHostile = () => true) {
  const walls = environment?.traceSegment?.(from, to, { radius: .06 });
  const colliders = [];
  const seen = new Set();
  for (const entry of targets) {
    const actor = entry?.actor, position = actor?.mesh?.position ?? actor?.position;
    if (!actor || seen.has(actor) || actor.hp <= 0 || actor.isLatched || !position || ![position.x,position.y,position.z].every(Number.isFinite) || !isHostile(actor)) continue;
    seen.add(actor);
    colliders.push({ x:position.x, z:position.z, baseY:position.y, radius:actor.radius ?? (entry.kind==='boss'?3:1), height:actor.getCollisionHeight?.() ?? (entry.kind==='boss'?5:2.8), entry });
  }
  const hit = traceCombatSegment(from, to, colliders, { radius: .06 });
  if (walls && (!hit || walls.t <= hit.t)) return { ...walls, kind:'wall' };
  return hit ? { ...hit, ...hit.collider.entry } : null;
}

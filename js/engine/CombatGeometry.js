/* The same physical cover used for movement also stops finite combat segments. */
import * as THREE from 'three';

const xyz = point => point?.isVector3 ? [point.x, point.y, point.z] : Array.isArray(point) ? point : null;
const finite = point => point?.length === 3 && point.every(Number.isFinite);
function slab(start, delta, low, high) {
  if (Math.abs(delta) < 1e-10) return start < low || start > high ? null : [-Infinity, Infinity, 0];
  const a = (low - start) / delta, b = (high - start) / delta;
  return a <= b ? [a, b, -1] : [b, a, 1];
}

export function traceCombatSegment(from, to, colliders = [], { radius = 0, ignoreOwner, ignore = new Set() } = {}) {
  const a = xyz(from), b = xyz(to);
  if (!finite(a) || !finite(b) || !Number.isFinite(radius) || radius < 0) return null;
  const d = b.map((value, axis) => value - a[axis]), length = Math.hypot(...d);
  if (length < 1e-9) return null;
  let closest = null;
  for (const collider of colliders) {
    if (!collider || ignore.has(collider) || collider.enabled === false || collider.solid === false || collider.blocksProjectiles === false ||
      collider.projectileBlocker === false || (ignoreOwner && collider.owner === ignoreOwner) ||
      (typeof collider.isCollisionActive === 'function' && collider.isCollisionActive() === false)) continue;
    if (typeof collider.traceSegment === 'function') {
      const hit = collider.traceSegment(from, to, { radius });
      if (hit && Number.isFinite(hit.t) && hit.t >= 0 && hit.t <= 1 && (!closest || hit.t < closest.t)) closest = { ...hit, collider };
      continue;
    }
    // A custom movement resolver may have a conservative navigation envelope.
    // It must supply its own physical ray test rather than block that envelope.
    if (typeof collider.resolveMovement === 'function') continue;
    const x = collider.x, z = collider.z;
    if (![x, z].every(Number.isFinite)) continue;
    const bottom = collider.minY ?? collider.baseY ?? 0, height = collider.height ?? Infinity;
    if (!Number.isFinite(bottom) || !(height > 0)) continue;
    const y = slab(a[1], d[1], bottom - radius, bottom + height + radius); if (!y) continue;
    let enter = y[0], exit = y[1], normal = [0, y[2], 0];
    const yaw = Number.isFinite(collider.rotation) ? collider.rotation : 0, c = Math.cos(yaw), s = Math.sin(yaw);
    const local = [(a[0] - x) * c - (a[2] - z) * s, 0, (a[0] - x) * s + (a[2] - z) * c];
    const delta = [d[0] * c - d[2] * s, d[1], d[0] * s + d[2] * c];
    if (Number.isFinite(collider.radius) && collider.radius > 0) {
      const r = collider.radius + radius, qa = delta[0] ** 2 + delta[2] ** 2;
      const qb = 2 * (local[0] * delta[0] + local[2] * delta[2]), qc = local[0] ** 2 + local[2] ** 2 - r ** 2;
      if (qa < 1e-12) { if (qc > 0) continue; }
      else {
        const discriminant = qb ** 2 - 4 * qa * qc; if (discriminant < 0) continue;
        const root = Math.sqrt(discriminant), first = (-qb - root) / (2 * qa), last = (-qb + root) / (2 * qa);
        if (first > enter) { enter = first; normal = [(local[0] + delta[0] * first) / r, 0, (local[2] + delta[2] * first) / r]; }
        exit = Math.min(exit, last);
      }
    } else {
      if (![collider.halfWidth, collider.halfDepth].every(value => Number.isFinite(value) && value > 0)) continue;
      let missed = false;
      for (const [axis, extent] of [[0, collider.halfWidth], [2, collider.halfDepth]]) {
        const span = slab(local[axis], delta[axis], -extent - radius, extent + radius);
        if (!span) { missed = true; break; }
        if (span[0] > enter) { enter = span[0]; normal = [0, 0, 0]; normal[axis] = span[2]; }
        exit = Math.min(exit, span[1]);
      }
      if (missed) continue;
    }
    const t = Math.max(0, enter);
    if (exit < t || t > 1 || exit < 0 || closest && closest.t <= t) continue;
    closest = { t, distance: length * t, point: new THREE.Vector3(a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t),
      normal: new THREE.Vector3(normal[0] * c + normal[2] * s, normal[1], -normal[0] * s + normal[2] * c), collider };
  }
  return closest;
}

export const hasCombatLineOfSight = (from, to, colliders, options) => !traceCombatSegment(from, to, colliders, options);

import * as THREE from 'three';

// Legacy powers share the same scenario/era/physical-roof authority as the
// finite supports. Unknown geometry or context cannot authorize an airstrike.
export function canAccessLegacyAir(context, target, radius = 0) {
  if (context?.allowed !== true || typeof context.canAccessAir !== 'function' || !target?.isVector3 ||
      ![target.x, target.y, target.z, radius].every(Number.isFinite) || radius < 0) return false;
  const points = [target.clone()];
  if (radius > 0) for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4;
    points.push(target.clone().add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)));
  }
  try { return points.every(point => context.canAccessAir(point.clone()) === true); } catch { return false; }
}

export function canHitLegacyAirTarget(context, target) {
  return canAccessLegacyAir(context, target?.mesh?.position ?? target?.position ?? target);
}

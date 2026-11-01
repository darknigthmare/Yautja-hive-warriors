import * as THREE from 'three';

// Roles are a projection of existing identities, never another allocation.
// Ordinary riflemen must not silently acquire the smartgunner's heavy weapon.
export function humanSquadRole(unit, group) {
  if (unit.actorType === 'flametrooper') return 'flametrooper';
  if (unit.actorType === 'smartgunner') return 'smartgunner';
  if (unit.officer || unit.role === 'officer') return 'team_leader';
  const slot = (group?.units ?? []).findIndex(entry => (typeof entry === 'string' ? entry : entry.id) === unit.id);
  return slot >= 0 && slot % 4 === 1 ? 'pointman' : 'rifleman';
}

// A second rank waits while its allocated partner advances; time windows are
// finite and contain no stun/root. An explicit retreat/regroup always wins.
export function humanFireTeamState(actor, teammates, time, distance, covered, { range, stopping }) {
  if (['retreat', 'regroup'].includes(actor.battleOrder?.type)) return 'ordered-withdrawal';
  if (actor.hp < actor.maxHp * .3 && distance < 9) return 'withdraw';
  const partner = teammates.find(other => other !== actor && other.hp > 0 && other.battleGroupId === actor.battleGroupId &&
    other.mesh.position.distanceToSquared(actor.mesh.position) < 28 ** 2 && other.squadRole !== 'flametrooper');
  if (!partner || !actor.battleGroupId || covered || distance <= stopping || distance > range) return 'engage';
  const phase = Math.floor(time / 3) % 2;
  const rank = actor.squadRole === 'pointman' || actor.squadRole === 'flametrooper' ? 0 : 1;
  return rank !== phase ? 'covering' : 'advance';
}

// Friendly bodies block ordinary NPC shots as well as walls. Do not use an
// infinite ray: a friendly behind the intended target does not block it.
export function hasFriendlyFireLane(actor, targetPosition, teammates) {
  const origin = actor.mesh.position, dx = targetPosition.x - origin.x, dz = targetPosition.z - origin.z;
  const length2 = dx * dx + dz * dz;
  if (length2 < .01) return true;
  return !teammates.some(other => {
    if (other === actor || other.hp <= 0 || other.factionId !== actor.factionId) return false;
    const p = other.mesh.position, t = ((p.x - origin.x) * dx + (p.z - origin.z) * dz) / length2;
    if (t <= .04 || t >= .98) return false;
    const shotY = origin.y + 2 + (targetPosition.y + 1.6 - origin.y - 2) * t;
    return p.y <= shotY && p.y + 3.4 >= shotY && (p.x - origin.x - dx * t) ** 2 + (p.z - origin.z - dz * t) ** 2 < .85 ** 2;
  });
}

export function moveSquadActor(manager, actor, destination, delta, speed, stop = 0) {
  const previous = actor.mesh.position.clone();
  const access = manager.environment?.getVerticalNavigationTarget?.(previous, destination);
  const direction = (access ?? destination).clone().sub(previous).setY(0), distance = direction.length();
  const step = Math.min(speed * delta, Math.max(0, distance - (access ? 0 : stop)));
  if (!(step > 0)) return false;
  actor.mesh.position.addScaledVector(direction.normalize(), step);
  manager.environment?.resolveAgentMovement?.(actor.mesh.position, destination, step, actor.radius ?? .8, previous);
  actor.mesh.rotation.y = Math.atan2(direction.x, direction.z);
  return actor.mesh.position.distanceToSquared(previous) > .000001;
}

export function syntheticServiceAnchor(manager, unit, group) {
  const front = manager.battleSimulation?.fronts?.get(group?.reserveOriginId ?? group?.frontId);
  const point = front?.position ?? group?.position ?? unit.position;
  return new THREE.Vector3(point[0], 0, point[1]);
}

export function syntheticDuty(unit) {
  return ['civilian', 'civil', 'noncombatant'].includes(unit.role) ? 'civilian' : unit.actorType === 'working_joe' ? 'industrial' : 'security';
}

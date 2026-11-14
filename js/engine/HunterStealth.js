/* Gameplay adaptation: camouflage lowers acquisition range, never damage immunity. */
export function canDetectConcealedTarget(observer, target, environment = null) {
  if (!(target?.isCloaked || target?.isInsertionConcealed) || target.stealthRevealTimer > 0 || target.cloakFlickerTimer > 0 || target.isAttacking ||
      target.isFacehuggerLatched || target.isRoyalFacehuggerLatched) return true;
  const origin = observer?.mesh?.position ?? observer?.position;
  const position = target.position ?? target.mesh?.position;
  if (!origin?.isVector3 || !position?.isVector3) return false;
  const type = observer.type ?? observer.actorType ?? '';
  const range = observer.definition ? 10 : observer.species === 'xenomorph' ||
    /warrior|runner|facehugger|crusher|praetorian|alien|spitter|boiler/.test(type) ? 7 :
    /synthetic|working_joe|weyland_combat/.test(type) ? 5 : 3.5;
  if (origin.distanceToSquared(position) > range * range) return false;
  return !environment?.hasLineOfSight || environment.hasLineOfSight(origin.clone().setY(origin.y + 1.2),
    position.clone().setY(position.y + 1.2));
}

export function isHunterAmbushPosition(player, target) {
  const position = target?.mesh?.position;
  if (!player?.position?.isVector3 || !position?.isVector3 || !(target.hp > 0) || target.isLatched ||
      Math.abs(position.y - player.position.y) > 2.5) return false;
  const dx = player.position.x - position.x, dz = player.position.z - position.z, distance = Math.hypot(dx, dz);
  if (distance < .1) return false;
  const targetYaw = target.mesh.rotation.y, playerYaw = player.rotationY;
  return (Math.sin(targetYaw) * dx + Math.cos(targetYaw) * dz) / distance < -.45 &&
    (-Math.sin(playerYaw) * dx - Math.cos(playerYaw) * dz) / distance > .3;
}

// Route the extra damage through the normal manager: one death, one score and
// the same cover/faction checks. One light swing can ambush only one target.
export function createHunterStealthAttack(player, attack, horde) {
  if (!attack?.stealthPrepared || !(player?.isCloaked || player?.isInsertionConcealed) || player.cloakFlickerTimer > 0) return attack;
  const simulation = horde?.battleSimulation, faction = attack.killerFaction ?? simulation?.config.playerFaction;
  let selected = null, nearest = Infinity;
  for (const target of horde?.aliens ?? []) {
    const unaware = attack.stealthUnawareTargets ? attack.stealthUnawareTargets.has(target) : target._npcTarget !== player;
    if (!isHunterAmbushPosition(player, target) || !unaware ||
        simulation && target.factionId && !simulation.areHostile(faction, target.factionId)) continue;
    const distance = player.position.distanceToSquared(target.mesh.position);
    if (distance > (attack.radius + (target.radius ?? 1)) ** 2 || distance >= nearest) continue;
    const from = player.position.clone().setY(player.position.y + 1.2), to = target.mesh.position.clone().setY(target.mesh.position.y + 1.2);
    if (horde.environment?.hasLineOfSight && !horde.environment.hasLineOfSight(from, to)) continue;
    selected = target; nearest = distance;
  }
  if (!selected) return attack;
  const result = { ...attack, ambushApplied: false, ambushTargetId: selected.battleUnitId ?? null,
    damageForTarget(target, amount) {
      if (target !== selected) return amount;
      result.ambushApplied = true; return amount * 2.5;
    } };
  return result;
}

export function canExecuteCombatTarget(player, victim, { range = 6, environment, simulation, requireStun = false, maxHealthFraction = 1 } = {}) {
  const position = victim?.mesh?.position;
  if (!(player?.hp > 0) || !(victim?.hp > 0) || !player.position?.isVector3 || !position?.isVector3 ||
      player.isFacehuggerLatched || player.isRoyalFacehuggerLatched || player.executionProtectionTimer > 0 ||
      victim.executionConsumed || requireStun && !victim.isStunned ||
      !Number.isFinite(range) || range <= 0 || range > 8 || player.position.distanceTo(position) > range ||
      victim.hp > victim.maxHp * maxHealthFraction) return false;
  if (simulation && victim.factionId && !simulation.areHostile(simulation.config.playerFaction, victim.factionId)) return false;
  return !environment?.hasLineOfSight || environment.hasLineOfSight(player.position.clone().setY(player.position.y + 1.2),
    position.clone().setY(position.y + Math.min(1.2, victim.radius ?? 1.2)));
}

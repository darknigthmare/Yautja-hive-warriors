/* One Musou per playable hunter (HW-DEC-85).
 * Original gameplay adaptation: each shape follows the kit's combat style in
 * hunterCombatStyles.js, not a film scene. Values are provisional, pending playtests.
 * All damage still goes through XenomorphHorde.checkMeleeHits and the boss and
 * Bad Blood damage paths; no unit is created and every death keeps its usual
 * BattleSimulation.recordDeath route. */
const profile = (name, shape, range, damage, bossDamage, extra = {}) => Object.freeze({
  name, shape, range, damage, bossDamage,
  halfAngleDegrees: extra.halfAngleDegrees ?? 180, width: extra.width ?? 0,
  launchVelY: extra.launchVelY ?? 28, knockback: extra.knockback ?? 18, color: extra.color ?? 0x00ffff,
  morale: 20, status: 'original_gameplay_adaptation', fidelity1to1Verified: false
});

export const HUNTER_MUSOU_PROFILES = Object.freeze({
  jungle_hunter: profile('Tempête plasma', 'nova', 40, 1200, 1500),
  city_hunter: profile('Ruée urbaine', 'nova', 28, 1400, 1500, { knockback: 26, color: 0x66ccff }),
  wolf_predator: profile('Nettoyeur', 'cone', 44, 1500, 1700, { halfAngleDegrees: 35, color: 0x99ffcc, launchVelY: 18 }),
  feral_predator: profile('Charge du bouclier', 'line', 36, 1600, 1500, { width: 6, knockback: 30, color: 0xffaa44 }),
  alpha_predator: profile('Jugement de l’Ancien', 'nova', 46, 1100, 1600, { color: 0xff66ff }),
  samurai_predator: profile('Iaijutsu', 'cone', 30, 1700, 1800, { halfAngleDegrees: 50, color: 0xffffff, launchVelY: 14 }),
  viking_predator: profile('Fureur boréale', 'nova', 34, 1500, 1600, { launchVelY: 36, knockback: 24, color: 0x88bbff })
});

export const hunterMusouProfile = characterId => HUNTER_MUSOU_PROFILES[characterId] ?? HUNTER_MUSOU_PROFILES.jungle_hunter;

/** Whether a target on the ground plane lies inside the Musou shape.
 * origin, facing and target are {x, z}; facing need not be normalised. */
export function musouCovers(musou, origin, facing, target, targetRadius = 1) {
  const dx = target.x - origin.x, dz = target.z - origin.z, distance = Math.hypot(dx, dz);
  if (distance > musou.range + targetRadius) return false;
  if (musou.shape === 'nova' || distance <= targetRadius) return true;
  const length = Math.hypot(facing.x, facing.z) || 1, fx = facing.x / length, fz = facing.z / length;
  const along = dx * fx + dz * fz;
  if (musou.shape === 'line') return along >= -targetRadius && Math.abs(dx * fz - dz * fx) <= musou.width / 2 + targetRadius;
  const cosine = along / distance;
  return cosine >= Math.cos(musou.halfAngleDegrees * Math.PI / 180);
}

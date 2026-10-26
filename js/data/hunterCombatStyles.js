/* Original musou balancing for the seven playable kits, not film choreography.
 * All times are simulation seconds; distances remain game units. */
const styles = {
  jungle_hunter: ['balanced', 5, .065, .060, 1, .16, .10, 1, 1, 1, 3, 16, 18, 2.4, 1, false, 'Recovery exposes the hunter after a crowd finisher.'],
  city_hunter: ['mobile', 4, .045, .055, .85, .12, .09, .85, .96, .95, 2.6, 15, 21, 2, 1.08, false, 'Shorter reach and lighter individual impacts.'],
  wolf_predator: ['precision', 3, .075, .055, .97, .18, .10, 1.06, 1.04, 1.08, 4, 20, 17, 2.6, 1, false, 'Short light chain and deliberate heavy commitment.'],
  feral_predator: ['pressure', 4, .045, .075, .93, .14, .10, .97, 1.06, 1.05, 3.8, 21, 17, 3, 1.04, false, 'Finite bolts; shield and sustained aggression consume reserves.'],
  alpha_predator: ['reach', 4, .085, .075, 1.09, .19, .11, 1.1, 1.1, 1.1, 4.2, 24, 16, 3.2, .95, false, 'Longer preparation and recovery.'],
  samurai_predator: ['duelist', 3, .04, .045, .8, .10, .08, .88, 1.03, 1.05, 4, 24, 16, 3, 1.02, false, 'Narrow active windows and costly crowd attacks.'],
  viking_predator: ['committed', 3, .12, .09, 1.22, .23, .12, 1.25, 1.12, 1.25, 5, 29, 13, 4, .9, true, 'Slow mobility, expensive finishers and long recovery.']
};
export const HUNTER_COMBAT_STYLES = Object.freeze(Object.fromEntries(Object.entries(styles).map(([id, x]) => [id, Object.freeze({
  id: x[0], lightChainLength: x[1], lightWindup: x[2], lightActive: x[3], lightRecovery: x[4],
  heavyWindup: x[5], heavyActive: x[6], heavyRecovery: x[7], reach: x[8], damage: x[9],
  lightCost: x[10], heavyCost: x[11], regeneration: x[12], crowdCooldown: x[13], mobility: x[14],
  heavyHyperarmor: x[15], weakness: x[16], status: 'original_gameplay_adaptation', fidelity1to1Verified: false
})])));
export const hunterCombatStyle = characterId => HUNTER_COMBAT_STYLES[characterId] ?? HUNTER_COMBAT_STYLES.jungle_hunter;

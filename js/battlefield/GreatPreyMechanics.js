/* Signature mechanics of the eight Ascension great prey (design/gdd/campagne-unblooded.md §5,
 * BossCombatPatterns). Each one keeps the CombatDirector wind-up and warning ring of the boss
 * framework: a mechanic changes where, when or how the prey strikes and when it is exposed,
 * never its identity, HP pool or the attack budget. Numbers are first guesses, in game units. */

export const GREAT_PREY_TUNING = Object.freeze({
  perchHeight: 4,            // Vara-Kesh: strong branch the Reaper pounces from
  hydraHeads: 3,             // Eshra: one head falls per third of HP lost
  burrowDepth: 2.2,          // Kharuun: the Maw travels under the sand while charging
  hivePulse: { period: 6, warning: 1.2, radius: 7, damage: 45 },
  steamCycle: 8,             // Rukh Tal: the Spur charges only in the last 1.5 s of a cycle
  steamWindow: 1.5,
  watcherPerch: 6,           // Dharos: the Watcher waits high until the hunter comes close
  watcherEngage: 12,
  landingExposure: 2,        // seconds of exposure after a signature landing or emergence
});

const mechanicOf = boss => boss?.pattern?.mechanic ?? null;
export const isGreatPrey = boss => boss?.definition?.ascension === true;

/** Hydra heads still standing; HP is the only state, so a restored checkpoint agrees. */
export function hydraHeads(boss) {
  if (mechanicOf(boss) !== 'many-heads') return null;
  return Math.max(1, Math.ceil(boss.hp / boss.maxHp * GREAT_PREY_TUNING.hydraHeads));
}

/** Per-frame state before the boss chooses an action. */
export function stepGreatPrey(boss, player, distance, delta) {
  const mechanic = mechanicOf(boss);
  if (mechanic === 'steam-cycle-charge') {
    boss.steamCycle = ((boss.steamCycle ?? 0) + delta) % GREAT_PREY_TUNING.steamCycle;
    boss.steamVenting = boss.steamCycle >= GREAT_PREY_TUNING.steamCycle - GREAT_PREY_TUNING.steamWindow;
  }
  if (mechanic === 'swarm-core') {
    boss.swarmClock = (boss.swarmClock ?? 0) + delta;
    const { period, warning } = GREAT_PREY_TUNING.hivePulse;
    boss.swarmContracting = boss.swarmClock % period >= period - warning;
  }
  if (mechanic === 'window-drop' && !boss.charge) {
    // Perched while the hunter is far; the drop itself is the leap.
    // Once it has dropped it fights on the ground; it climbs back only if the hunter breaks far away.
    boss.perched = distance > GREAT_PREY_TUNING.watcherEngage * (boss.hasDropped ? 2 : 1);
    if (boss.mesh) boss.mesh.position.y = boss.perched ? GREAT_PREY_TUNING.watcherPerch : 0;
  }
  if (mechanic === 'frozen-corridor-charge') {
    // The Jaw is only seen by thermal vision while it prepares its charge (Bible V6 "écho thermique").
    const thermal = player?.visionMode === 1 || player?.visionMode === 'thermal'; // cycleVisionMode: 1 is thermal
    boss.thermalHidden = boss.pressureAction === 'charge' && !thermal;
    if (boss.visualModel) boss.visualModel.visible = !boss.thermalHidden;
  }
}

/** Whether a signature mechanic lets the prey start this action now. */
export function greatPreyAllows(boss, action) {
  const mechanic = mechanicOf(boss);
  if (mechanic === 'steam-cycle-charge' && action === 'charge') return boss.steamVenting === true;
  return true;
}

/** Called when a charge or leap starts. */
export function startGreatPreyCharge(boss, charge) {
  const mechanic = mechanicOf(boss);
  if (mechanic === 'branch-pounce' && charge.kind === 'leap') { charge.startY = GREAT_PREY_TUNING.perchHeight; boss.mesh.position.y = charge.startY; charge.landY = 0; }
  if (mechanic === 'window-drop' && charge.kind === 'leap') { charge.startY = GREAT_PREY_TUNING.watcherPerch; boss.mesh.position.y = charge.startY; charge.landY = 0; boss.perched = false; boss.hasDropped = true; }
  if (mechanic === 'emerging-charge' && charge.kind === 'charge') { boss.burrowed = true; if (boss.visualModel) boss.visualModel.position.y -= GREAT_PREY_TUNING.burrowDepth; }
  if (mechanic === 'shore-switch' && charge.kind === 'leap') { boss.diving = true; boss.diveOrigin = boss.mesh.position.clone(); }
  if (mechanic === 'steam-cycle-charge') boss.steamCycle = 0;
}

/** Called when a charge or leap ends. Returns extra actions for the manager to queue. */
export function endGreatPreyCharge(boss, charge, player, placeBoss) {
  const mechanic = mechanicOf(boss), actions = [];
  if (Number.isFinite(charge.landY)) boss.mesh.position.y = charge.landY;
  if (mechanic === 'emerging-charge' && boss.burrowed) {
    boss.burrowed = false; if (boss.visualModel) boss.visualModel.position.y += GREAT_PREY_TUNING.burrowDepth;
    actions.push({ kind: 'shockwave', life: .35, radius: 4.5, innerRadius: 0, damage: 40, color: 0xc9a46b });
  }
  if (mechanic === 'shore-switch' && boss.diving && player?.position) {
    // It surfaces on the opposite shore: mirrored across the hunter, at the same distance.
    boss.diving = false;
    // Mirror the shore it dove from, not where the leap ended: it lands near the hunter.
    const offset = (boss.diveOrigin ?? boss.mesh.position).clone().sub(player.position).setY(0); boss.diveOrigin = null;
    const opposite = player.position.clone().sub(offset.setLength(Math.max(8, Math.min(16, offset.length()))));
    opposite.y = boss.mesh.position.y;
    boss.mesh.position.copy(placeBoss?.(opposite) ?? opposite);
  }
  if (mechanic === 'window-drop' && charge.kind === 'leap') actions.push({ kind: 'shockwave', life: .3, radius: 4, innerRadius: 0, damage: 50, color: 0x9fa7b0 });
  if (['branch-pounce', 'window-drop', 'emerging-charge', 'shore-switch', 'steam-cycle-charge'].includes(mechanic)) boss.signatureExposure = GREAT_PREY_TUNING.landingExposure;
  return actions;
}

/** Damage multiplier the prey takes now (0 = cannot be hit). */
export function greatPreyDamageFactor(boss) {
  if (boss.burrowed || boss.diving) return 0;
  if (mechanicOf(boss) === 'swarm-core' && boss.swarmContracting) return .25; // the swarm shields its core
  return 1;
}

/** Melee damage multiplier the prey deals now. */
export function greatPreyMeleeFactor(boss) {
  const heads = hydraHeads(boss);
  return heads === null ? 1 : heads / GREAT_PREY_TUNING.hydraHeads;
}

/** Hive pulse: due at the end of each contraction; the manager turns it into a shockwave. */
export function dueHivePulse(boss, delta) {
  if (mechanicOf(boss) !== 'swarm-core') return null;
  const { period, radius, damage } = GREAT_PREY_TUNING.hivePulse, before = (boss.swarmClock ?? 0) - delta;
  return Math.floor(before / period) < Math.floor((boss.swarmClock ?? 0) / period) ? { kind: 'shockwave', life: .2, radius, innerRadius: 0, damage, color: 0x7a2f45 } : null;
}

/** Readout line for the HUD, shown with the boss attack readout. */
export function greatPreyReadout(boss) {
  switch (mechanicOf(boss)) {
    case 'many-heads': return `Têtes : ${hydraHeads(boss)}/${GREAT_PREY_TUNING.hydraHeads}`;
    case 'steam-cycle-charge': return boss.steamVenting ? 'La vapeur siffle : charge imminente' : `Cycle de vapeur : ${Math.ceil(GREAT_PREY_TUNING.steamCycle - (boss.steamCycle ?? 0))} s`;
    case 'swarm-core': return boss.swarmContracting ? 'La nuée se resserre : reculez' : 'La nuée s’ouvre : frappez le centre';
    case 'emerging-charge': return boss.burrowed ? 'Sous le sable : intouchable' : null;
    case 'shore-switch': return boss.diving ? 'Immergé : surveillez l’autre rive' : null;
    case 'window-drop': return boss.perched ? 'Le Guetteur observe depuis la hauteur' : null;
    case 'frozen-corridor-charge': return boss.thermalHidden ? 'Écho thermique : passez en vision thermique' : null;
    default: return null;
  }
}

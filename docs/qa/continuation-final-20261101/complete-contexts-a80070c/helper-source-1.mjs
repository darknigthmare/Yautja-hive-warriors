/** Shorten combat and travel while exercising real mission objectives, enemy
 * defeat callbacks, gate collision and the final BossManager encounter.
 * This is an integration check, not a human combat playthrough. */
import { finishMissionInsertion } from './finish-insertion.mjs';

export async function reachBattlefieldSector(page, stopAtSectorIndex = 5) {
  await finishMissionInsertion(page);
  return page.evaluate(stopAtSectorIndex => {
    const g = window.game, mission = g.battlefield, progression = g.battlefieldProgression;
    if (!mission || !progression || !g.env.battlefieldLayout) throw new Error('Connected battlefield mission missing');
    const player = g.player, layout = g.env.battlefieldLayout, visited = [];
    const movementMetrics = { maximumGroundCorrection: 0, maximumRequestedHorizontalStep: 0 };
    const ground = point => {
      const height = g.env.getElevationAt(point.x, point.z, point.y), correction = Math.abs(height - point.y);
      if (!Number.isFinite(height) || correction > .66) throw new Error(`Assisted route would skip a physical height: ${point.toArray()} to ${height}`);
      movementMetrics.maximumGroundCorrection = Math.max(movementMetrics.maximumGroundCorrection, correction);
      point.y = height;
    };
    const step = (delta = 0.001) => {
      g.update(delta);
      if (!g.isPlaying || !g.player) throw new Error('Mission ended before its final battlefield encounter');
    };
    const moveTo = target => {
      const targetHeight = g.env.getPlacementElevationAt?.(target[0], target[1]) ?? g.env.getElevationAt(target[0], target[1], 0);
      const destination = player.position.clone().set(target[0], targetHeight, target[1]);
      const remaining = () => Math.hypot(player.position.x - destination.x, player.position.z - destination.z);
      for (let index = 0; remaining() > 0.01 && index < 1000; index++) {
        // The fixture advances X/Z faster than simulation time. Use the actual
        // measured floor before asking production navigation for its next leg,
        // rather than carrying the departure platform's height toward all goals.
        ground(player.position); player.mesh.position.copy(player.position);
        const waypoint = g.env.getNavigationWaypoint?.(player.position, destination, .65) ?? destination;
        const direction = waypoint.clone().sub(player.position); direction.y = 0;
        const distance = direction.length();
        const requested = player.position.clone().addScaledVector(direction.normalize(), Math.min(0.7, distance));
        movementMetrics.maximumRequestedHorizontalStep = Math.max(movementMetrics.maximumRequestedHorizontalStep,
          Math.hypot(requested.x - player.position.x, requested.z - player.position.z));
        ground(requested);
        g.env.resolveMovement(requested, .75, player.getCollisionHeight?.() ?? 2.4);
        g.dropPod.resolveMovement?.(requested, .75, player.getCollisionHeight?.() ?? 2.4);
        if (requested.distanceTo(player.position) < 0.001) throw new Error('Blocked battlefield route before ' + destination.toArray());
        player.position.copy(requested); player.mesh.position.copy(requested); step();
      }
      if (remaining() > 0.01) throw new Error(`Battlefield travel did not reach ${destination.toArray()} from ${player.position.toArray()}`);
    };
    for (const sector of layout.sectors) {
      // Resume an existing mission without walking back through prior sectors.
      if (sector.index < progression.currentSector.index) continue;
      if (sector.index === 0 && g.dropPod.pods.length) {
        // Keep the real shell/door collision active. First walk in front of all
        // cabins, then around their footprint toward the map's first passage.
        // Some biomes put that passage east/west rather than north/south.
        const pods = g.dropPod.pods, firstGate = layout.gates.find(gate => gate.from === sector.id);
        const minX = Math.min(...pods.map(pod => pod.targetPosition.x)) - 5;
        const maxX = Math.max(...pods.map(pod => pod.targetPosition.x)) + 5;
        const rearZ = Math.min(...pods.map(pod => pod.targetPosition.z)) - 5;
        const frontZ = Math.max(...pods.map(pod => pod.targetPosition.z)) + 4.5;
        moveTo([player.position.x, frontZ]);
        if (firstGate.axis === 'x') {
          const sideX = firstGate.center[0] > sector.center[0] ? maxX : minX;
          moveTo([sideX, frontZ]); moveTo([sideX, sector.center[1]]);
        } else if (firstGate.center[1] < sector.center[1]) {
          moveTo([minX, frontZ]); moveTo([minX, rearZ]);
        }
      } else moveTo(sector.center);
      if (progression.currentSector.id !== sector.id || !progression.currentState.entered) throw new Error('Sector did not start on physical entry: ' + sector.id);
      visited.push(sector.id);
      if (sector.index === stopAtSectorIndex && sector.objective.type !== 'boss') {
        return { visited, completed: progression.completedSectorIds, openGates: progression.openGateIds, boss: null, movementMetrics };
      }
      if (sector.objective.type === 'boss') {
        if (!g.bosses.activeBoss || !g.bossSpawned) throw new Error('Final sector did not spawn its actual boss');
        return { visited, completed: progression.completedSectorIds, openGates: progression.openGateIds, boss: g.bosses.activeBoss.type, movementMetrics };
      }
      if (sector.objective.type === 'interact' && !progression.currentState.completed) {
        // The terminal is now a solid prop; approach its usable front edge.
        moveTo([sector.objective.position[0], sector.objective.position[1] + 3]);
        if (!progression.canInteract(player)) throw new Error('In-range sector terminal cannot be activated');
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }));
        step();
      }
      if (!progression.currentState.completed) {
        // Damage actual encounter enemies; the normal death callback, rather
        // than a direct objective-state edit, must earn every gate opening.
        // An activated relay now also needs its real counterattack defeated.
        for (let round = 0; !progression.currentState.completed && round < 30; round++) {
          // Explicitly shorten each fight through the real damage/death ledger.
          // A map-wide melee strike now correctly stops at physical cover and
          // is no longer an appropriate progress-only test fixture.
          for (const enemy of [...g.horde.getActiveCombatants()]) g.horde.applyDamage(enemy, 1_000_000, { cause: 'qa-shortened-fight', killerFaction: 'player_clan' });
          step();
          if (progression.currentState.completed) break;
          if (!g.horde.remainingCount) throw new Error('Encounter exhausted before its objective: ' + sector.id);
          for (let frame = 0; frame < 31; frame++) step(0.1);
        }
      }
      if (!progression.getSectorState(sector.id).completed) throw new Error('Sector objective failed to open its gate: ' + sector.id);
      for (const gate of layout.gates.filter(gate => gate.from === sector.id)) {
        if (!progression.isGateOpen(gate.id) || !g.env.isGateOpen(gate.id)) throw new Error('Objective state and physical gate differ: ' + gate.id);
      }
    }
    throw new Error('Battlefield has no requested sector');
  }, stopAtSectorIndex);
}

export async function reachFinalBattlefieldBoss(page) {
  return reachBattlefieldSector(page, 5);
}

export async function defeatFinalBattlefieldEncounter(page) {
  const route = await reachFinalBattlefieldBoss(page);
  await page.evaluate(() => { game.bosses.takeDamage(1_000_000); game.update(0.001); });
  await page.waitForFunction(() => !game.isPlaying);
  return route;
}

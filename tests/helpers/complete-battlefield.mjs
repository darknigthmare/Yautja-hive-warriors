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
    const step = (delta = 0.001) => {
      g.update(delta);
      if (!g.isPlaying || !g.player) throw new Error('Mission ended before its final battlefield encounter');
    };
    const moveTo = target => {
      const destination = player.position.clone().set(target[0], 0, target[1]);
      for (let index = 0; player.position.distanceTo(destination) > 0.01 && index < 1000; index++) {
        const direction = destination.clone().sub(player.position); direction.y = 0;
        const distance = direction.length();
        const requested = player.position.clone().addScaledVector(direction.normalize(), Math.min(0.7, distance));
        g.env.resolveMovement(requested);
        g.dropPod.resolveMovement?.(requested);
        if (requested.distanceTo(player.position) < 0.001) throw new Error('Blocked battlefield route before ' + destination.toArray());
        player.position.copy(requested); player.mesh.position.copy(requested); step();
      }
      if (player.position.distanceTo(destination) > 0.01) throw new Error(`Battlefield travel did not reach ${destination.toArray()} from ${player.position.toArray()}`);
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
        return { visited, completed: progression.completedSectorIds, openGates: progression.openGateIds, boss: null };
      }
      if (sector.objective.type === 'boss') {
        if (!g.bosses.activeBoss || !g.bossSpawned) throw new Error('Final sector did not spawn its actual boss');
        return { visited, completed: progression.completedSectorIds, openGates: progression.openGateIds, boss: g.bosses.activeBoss.type };
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
          const hits = g.horde.checkMeleeHits({ origin: player.position, radius: 200, damage: 1_000_000 });
          g.registerHits(hits); step();
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

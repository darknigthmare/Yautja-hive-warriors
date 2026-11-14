/** Exercise the real cinematic update path before tests start issuing combat
 * inputs. Advancing simulation avoids depending on WebGL frame rate in CI. */
export async function finishMissionInsertion(page) {
  return page.evaluate(() => {
    const g = window.game;
    if (!g?.isPlaying || !g.player) throw new Error('Insertion requires a running mission');
    const initiallyPaused = g.isPaused;
    let simulated = 0;
    try {
      g.isPaused = false;
      while (g.dropPod.isActive && simulated < 15) {
        g.update(1 / 60); simulated += 1 / 60;
        if (!g.isPlaying || !g.player) throw new Error('Mission ended during insertion');
      }
      if (g.dropPod.isActive) throw new Error(`Insertion did not finish: ${g.dropPod.phase}`);
      return { simulated, phase: g.dropPod.phase, visible: g.player.mesh.visible };
    } finally { g.isPaused = initiallyPaused; }
  });
}

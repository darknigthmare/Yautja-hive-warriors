import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { reachBattlefieldSector, reachFinalBattlefieldBoss, defeatFinalBattlefieldEncounter } from './helpers/complete-battlefield.mjs';
import { finishMissionInsertion } from './helpers/finish-insertion.mjs';

const baseURL = 'http://127.0.0.1:4181';
let server;
let browser;
let serverOutput = '';
before(async () => {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4181', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { serverOutput += chunk; });
  server.stderr.on('data', chunk => { serverOutput += chunk; });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(baseURL)).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Gameplay preview did not start: ${serverOutput}`);
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
});
after(async () => { await browser?.close(); server?.kill('SIGTERM'); });

async function createSession() {
  const context = await browser.newContext({ viewport: { width: 1100, height: 780 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.game);
  if (await page.evaluate(() => window.game.renderer.softwareRenderer)) await page.setViewportSize({ width: 800, height: 600 });
  return { page, context, errors };
}
async function launchHunt(page, coop = false) {
  await page.locator(coop ? '#btn-open-coop' : '#btn-start-game').click();
  await page.locator('#btn-confirm-char').click();
  await page.locator('#btn-launch-mission').click();
  await page.locator('#btn-confirm-loadout').click();
  await page.waitForFunction(() => window.game.isPlaying && !!window.game.player);
  await finishMissionInsertion(page);
}

test('insertion hides hunters until touchdown, opens occupied capsules and survives pause, co-op and replay', { timeout: 120000 }, async () => {
  const { page, context, errors } = await createSession();
  try {
    const sequence = await page.evaluate(() => {
      const g = game;
      g.startMission({ enemyCount: 12 });
      g.togglePause(true);
      const bladeFrontMax = () => {
        g.renderer.scene.updateMatrixWorld(true);
        const pod = g.dropPod.pods[0]; let maximum = -Infinity;
        for (const blade of [g.player.blade1, g.player.blade2]) {
          if (!blade?.visible || !blade.geometry) continue;
          const attribute = blade.geometry.attributes.position;
          for (let index = 0; index < attribute.count; index++) {
            const vertex = g.player.position.clone().fromBufferAttribute(attribute, index).applyMatrix4(blade.matrixWorld);
            maximum = Math.max(maximum, pod.group.worldToLocal(vertex).z);
          }
        }
        return Number.isFinite(maximum) ? maximum : null;
      };
      const read = () => ({ phase: g.dropPod.phase, active: g.dropPod.isActive,
        progress: g.dropPod.progress, elapsed: g.dropPod.elapsed,
        visible: g.player.mesh.visible, position: g.player.position.toArray(),
        hatchOpening: g.dropPod.doorMesh.userData.opening, hp: g.player.hp,
        directorTime: g.combatDirector.time, pending: g.horde.pendingSpawnCount,
        bladeFrontMax: bladeFrontMax(),
        enemies: g.horde.aliens.map(enemy => enemy.mesh.position.toArray()) });
      const step = delta => { g.isPaused = false; g.update(delta); g.isPaused = true; };
      const advanceUntil = predicate => {
        let steps = 0;
        while (!predicate() && steps++ < 1200) step(1 / 120);
        if (!predicate()) throw new Error(`Insertion stalled in ${g.dropPod.phase}`);
      };
      const initial = read();
      // These events pass through the real keyboard/mouse guards. Neither
      // photo mode nor the wheel may stall a locked cinematic.
      g.isPaused = false;
      for (const code of ['KeyW', 'KeyC', 'KeyO', 'KeyR', 'KeyG', 'Space']) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code }));
      }
      window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
      window.dispatchEvent(new MouseEvent('mousedown', { button: 1 }));
      const input = { attacking: g.player.isAttacking, blocking: g.player.isBlocking,
        photo: g.photoMode.isActive, wheel: g.weaponWheel.isOpen, mounted: g.skimmer.isMounted };
      for (const code of ['KeyW', 'KeyC', 'KeyO', 'KeyR', 'KeyG', 'Space']) {
        window.dispatchEvent(new KeyboardEvent('keyup', { code }));
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      const pausedBefore = read(); g.update(0.5); const pausedAfter = read();
      if (!g.isPaused) throw new Error('Escape did not pause insertion');
      advanceUntil(() => g.dropPod.phase === 'settling');
      const settled = read();
      advanceUntil(() => g.dropPod.phase === 'opening');
      const openingStart = read(); step(0.45); const openingMid = read();
      advanceUntil(() => g.dropPod.phase === 'exiting');
      const exitStart = read(); step(0.65); const exitMid = read();
      advanceUntil(() => !g.dropPod.isActive);
      const complete = read();
      return { initial, input, pausedBefore, pausedAfter, settled, openingStart, openingMid,
        exitStart, exitMid, complete, graceRemaining: g.combatDirector.graceUntil - g.combatDirector.time };
    });
    assert.equal(sequence.initial.phase, 'descending');
    assert.equal(sequence.initial.visible, false);
    assert.deepEqual(sequence.input, { attacking: false, blocking: false, photo: false, wheel: false, mounted: false });
    assert.deepEqual(sequence.pausedAfter, sequence.pausedBefore, 'Paused simulation cannot advance descent, hatch or enemies.');
    assert.equal(sequence.settled.visible, false, 'The closed capsule conceals the hunter until it has landed.');
    assert.equal(sequence.openingStart.visible, true);
    assert.ok(sequence.openingStart.bladeFrontMax === null || sequence.openingStart.bladeFrontMax <= 1.46,
      'Deployed external blades stay inside the cabin as the closed leaves start opening.');
    assert.equal(sequence.openingMid.visible, true, 'The moving leaves reveal the actual occupant rather than an empty cabin.');
    assert.ok(sequence.openingMid.hatchOpening > sequence.openingStart.hatchOpening, 'The two hatch leaves move over time.');
    assert.equal(sequence.exitStart.visible, true);
    assert.equal(sequence.exitMid.visible, true);
    assert.ok(sequence.exitMid.position[2] > sequence.exitStart.position[2] + 0.2, 'The hunter walks out through the opening.');
    for (const frame of [sequence.settled, sequence.openingStart, sequence.openingMid, sequence.exitStart, sequence.exitMid]) {
      assert.deepEqual(frame.enemies, sequence.initial.enemies, 'Enemies wait for the full exit sequence.');
      assert.equal(frame.pending, sequence.initial.pending);
      assert.equal(frame.hp, sequence.initial.hp);
      assert.equal(frame.directorTime, 0, 'Insertion does not consume the opening protection.');
    }
    assert.equal(sequence.complete.active, false);
    assert.equal(sequence.complete.visible, true);
    assert.ok(sequence.graceRemaining >= 6.9, 'Seven seconds of combat protection start at handoff.');

    const replay = await page.evaluate(() => {
      const g = game, oldPlayer = g.player, oldPod = g.dropPod.podMesh;
      g.startMission({ enemyCount: 12 });
      g.togglePause(true);
      const solo = { active: g.dropPod.isActive, visible: g.player.mesh.visible,
        playerReplaced: oldPlayer !== g.player, oldPodRemoved: !oldPod.parent };
      g.isCoOp = true; g.renderer.setSplitScreen(true); g.startMission({ enemyCount: 12 });
      g.togglePause(true);
      const initial = { pods: g.dropPod.pods.length, p1Visible: g.player.mesh.visible,
        p2Visible: g.player2.mesh.visible, p1: g.player.position.toArray(), p2: g.player2.position.toArray() };
      // Cancel while airborne, rather than only cleaning up a completed prop.
      const airbornePods = g.dropPod.pods.map(pod => pod.group);
      g.returnToMenu();
      return { solo, initial, cleaned: airbornePods.every(pod => !pod.parent),
        playing: g.isPlaying, player: g.player, player2: g.player2, active: g.dropPod.isActive };
    });
    assert.deepEqual(replay.solo, { active: true, visible: false, playerReplaced: true, oldPodRemoved: true });
    assert.equal(replay.initial.pods, 2);
    assert.equal(replay.initial.p1Visible, false); assert.equal(replay.initial.p2Visible, false);
    assert.ok(Math.abs(replay.initial.p1[0] - replay.initial.p2[0]) >= 4, 'Co-op hunters get separate capsules.');
    assert.equal(replay.cleaned, true); assert.equal(replay.playing, false);
    assert.equal(replay.player, null); assert.equal(replay.player2, null); assert.equal(replay.active, false);
    console.log('Insertion phase checks:', JSON.stringify(sequence));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('connected battlefield leaves time to act before reinforcements and keeps combat responsive', async () => {
  const { page, context, errors } = await createSession();
  try {
    await launchHunt(page);
    await page.keyboard.press('Escape');
    const opening = await page.evaluate(() => {
      const g = game, player = g.player, initiallyPaused = g.isPaused;
      const initial = { hp: player.hp, maxHp: player.maxHp, active: g.horde.aliens.length,
        pending: g.horde.pendingSpawnCount, remaining: g.horde.remainingCount,
        sectors: g.env.battlefieldLayout?.sectors.length, gates: g.env.openGates.size,
        blocking: player.isBlocking, cloaked: player.isCloaked, perched: player.isPerched };
      let elapsed = 0;
      try {
        g.isPaused = false;
        while (elapsed < 6 && g.isPlaying) { g.update(0.1); elapsed += 0.1; }
      } finally { g.isPaused = initiallyPaused; }
      return { initial, elapsed, hp: player.hp, grace: g.combatDirector.isInGrace,
        active: g.horde.aliens.length, pending: g.horde.pendingSpawnCount,
        latched: player.isFacehuggerLatched, gates: g.env.openGates.size,
        objective: document.querySelector('#battlefield-objective-text').textContent,
        progress: document.querySelector('#battlefield-sector-count').textContent };
    });
    assert.equal(opening.initial.sectors, 6);
    assert.ok(opening.initial.active > 0 && opening.initial.active <= 6);
    assert.ok(opening.initial.pending > 0, 'The encounter reserves later squads instead of flooding the first frame.');
    assert.equal(opening.initial.active + opening.initial.pending, opening.initial.remaining);
    assert.equal(opening.initial.hp, opening.initial.maxHp);
    assert.equal(opening.initial.blocking, false); assert.equal(opening.initial.cloaked, false); assert.equal(opening.initial.perched, false);
    assert.equal(opening.hp, opening.initial.maxHp, 'An unprotected player survives the readable opening without damage.');
    assert.equal(opening.grace, true); assert.equal(opening.latched, false);
    assert.equal(opening.gates, 0, 'The first gate still requires its real kill objective.');
    assert.match(opening.objective, /12/); assert.match(opening.progress, /1 \/ 6/);
    await page.locator('#btn-resume-game').click();
    const start = await page.evaluate(() => game.player.position.z);
    await page.keyboard.down('KeyW');
    try { await page.waitForFunction(z => game.player.position.z < z - 0.01, start); }
    finally { await page.keyboard.up('KeyW'); }
    const attacking = await page.evaluate(() => {
      window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
      window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
      return { hp: game.player.hp, attacking: game.player.isAttacking, playing: game.isPlaying };
    });
    assert.ok(attacking.playing && attacking.hp > 0 && attacking.attacking, 'Movement and melee accept input during the opening.');
    await page.keyboard.press('Escape');
    const pressure = await page.evaluate(() => {
      const g = game, initiallyPaused = g.isPaused, maxHp = g.player.maxHp;
      let elapsed = 0, lastHP = g.player.hp, maximumFrameDamage = 0;
      try {
        g.isPaused = false;
        while (elapsed < 6 && g.isPlaying) {
          g.update(0.1); elapsed += 0.1;
          maximumFrameDamage = Math.max(maximumFrameDamage, lastHP - g.player.hp); lastHP = g.player.hp;
        }
        return { hp: g.player?.hp ?? 0, playing: g.isPlaying, maximumFrameDamage, maxHp,
          engagements: [...g.combatDirector.engagements.values()].map(group => group.size) };
      } finally { g.isPaused = initiallyPaused; }
    });
    assert.ok(pressure.playing && pressure.hp > 0, 'Later squads do not instantly kill the player after insertion protection.');
    assert.ok(pressure.maximumFrameDamage < pressure.maxHp * 0.15, 'A single simulation step cannot deliver the old simultaneous attack flood.');
    assert.ok(pressure.engagements.every(count => count <= 3));
    await page.locator('#btn-pause-menu-return').click();
    assert.deepEqual(await page.evaluate(() => ({ pending: game.horde.pendingSpawnCount, remaining: game.horde.remainingCount,
      battlefield: game.battlefield, attacks: game.combatDirector.attacks.size })),
      { pending: 0, remaining: 0, battlefield: null, attacks: 0 });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('relay activation keeps its gate locked until the real counterattack is defeated', { timeout: 120000 }, async () => {
  const { page, context, errors } = await createSession();
  try {
    await launchHunt(page);
    await reachBattlefieldSector(page, 2);
    const result = await page.evaluate(() => {
      const g = game, progression = g.battlefieldProgression, sector = progression.currentSector;
      const gate = g.env.battlefieldLayout.gates.find(entry => entry.from === sector.id);
      const target = sector.objective.defenseTarget;
      // Isolate objective accounting from supporting factions that can defeat
      // the same small first batch while simulated waiting advances.
      g.allies.clearSquad(); g.marines.clearSquad(); g.synthetics.clearSquad();
      const read = () => ({ ...progression.currentState, active: g.horde.aliens.length,
        queued: g.horde.pendingSpawnCount, gate: g.env.isGateOpen(gate.id),
        objective: document.getElementById('battlefield-objective-text').textContent });
      const damageEncounter = () => {
        // Assisted objective-flow fixture: settle actual actors through their
        // damage/death callbacks, including those protected by scenery.
        for (const enemy of [...g.horde.getActiveCombatants()]) g.horde.applyDamage(enemy, 1_000_000, { cause: 'qa-shortened-fight', killerFaction: 'player_clan' });
        g.update(0.001);
      };
      g.isPaused = false;
      // Pre-activation defeats are real encounter deaths, but cannot be banked
      // as completed relay defense before the player activates the terminal.
      damageEncounter();
      const beforeActivation = read();
      g.player.position.set(sector.objective.position[0], 0, sector.objective.position[1] + 3);
      g.player.mesh.position.copy(g.player.position);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
      g.update(0.001);
      const activated = read();
      // The sector's real grace period precedes its spawn cadence. Wait for
      // an actual eligible enemy instead of assuming3.1s already spawned one.
      let firstBatchWait = 0;
      let firstEnemy;
      for (let frame = 0; frame < 200 && !firstEnemy; frame++) {
        g.update(0.1); firstBatchWait += 0.1;
        firstEnemy = g.horde.aliens.find(enemy => enemy.hp > 0 && !enemy.isLatched && enemy.type !== 'boiler');
      }
      if (!firstEnemy) throw Error('No real counterattack enemy arrived after its grace and spawn delay');
      const candidates = Array.from({ length: 8 }, (_, index) => g.player.position.clone().set(
        sector.center[0] + Math.cos(index * Math.PI / 4) * 12, 0,
        sector.center[1] + Math.sin(index * Math.PI / 4) * 12));
      const others = [...g.horde.aliens.filter(enemy => enemy !== firstEnemy), ...g.horde.chestbursters];
      candidates.sort((a, b) => Math.min(...others.map(enemy => enemy.mesh.position.distanceTo(b)), Infinity) - Math.min(...others.map(enemy => enemy.mesh.position.distanceTo(a)), Infinity));
      firstEnemy.mesh.position.copy(candidates[0]);
      const partialHits = g.horde.checkMeleeHits({ origin: firstEnemy.mesh.position.clone(), radius: 0, damage: 1_000_000 });
      g.registerHits(partialHits); g.update(0.001);
      const partial = read();
      for (let round = 0; !progression.currentState.completed && round < 12; round++) {
        for (let frame = 0; frame < 31; frame++) g.update(0.1);
        damageEncounter();
      }
      g.isPaused = true;
      return { target, beforeActivation, activated, firstBatchWait, partial, complete: read(),
        missionAlive: g.isPlaying && g.player.hp > 0 };
    });
    console.log('Relay defense state checks:', JSON.stringify(result));
    assert.ok(result.target >= 8 && result.target <= 12);
    assert.equal(result.beforeActivation.interacted, false);
    assert.equal(result.beforeActivation.defenseKills, 0);
    assert.equal(result.beforeActivation.gate, false);
    assert.equal(result.activated.interacted, true);
    assert.equal(result.activated.defenseKills, 0);
    assert.equal(result.activated.gate, false, 'Pressing E starts defense rather than instantly opening the gate.');
    assert.equal(result.activated.active, result.beforeActivation.active, 'Activation queues reinforcements without flooding the player immediately.');
    assert.ok(result.activated.queued > result.beforeActivation.queued);
    assert.match(result.activated.objective, /CONTRE-ATTAQUE|contre-attaque/i);
    assert.ok(result.firstBatchWait >= 2.9, 'Activation retains grace and delayed reinforcement cadence');
    assert.ok(result.partial.defenseKills > 0 && result.partial.defenseKills < result.target);
    assert.equal(result.partial.gate, false, 'A partial defense cannot unlock the corridor.');
    assert.equal(result.complete.completed, true);
    assert.equal(result.complete.gate, true);
    assert.ok(result.complete.defenseKills >= result.target);
    assert.equal(result.missionAlive, true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('campaign advances through five real maps and finishes after the final boss', async () => {
  const { page, context, errors } = await createSession();
  try {
    await page.locator('#btn-open-story').click();
    const levels = ['gunnison_forest', 'val_verde_jungle', 'antarctic_pyramid', 'xenomorph_prime', 'romulus_station'];
    for (let chapter = 0; chapter < levels.length; chapter++) {
      assert.equal(await page.evaluate(() => game.ui.selectedLevel.id), levels[chapter]);
      await page.locator('#btn-confirm-loadout').click();
      await page.waitForFunction(() => game.isPlaying);
      const route = await defeatFinalBattlefieldEncounter(page);
      assert.equal(route.visited.length, 6);
      assert.equal(route.completed.length, 5);
      assert.equal(route.openGates.length, 5);
      assert.equal(await page.evaluate(() => game.player), null);
      if (chapter < levels.length - 1) {
        assert.match(await page.locator('#btn-replay').innerText(), /CHAPITRE SUIVANT/);
        assert.equal(await page.evaluate(() => game.pendingChapter.chapter), chapter + 2);
        await page.locator('#btn-replay').click();
      }
    }
    assert.match(await page.locator('#end-title').innerText(), /CAMPAGNE ACCOMPLIE/);
    assert.equal(await page.evaluate(() => game.campaign.isActive), false);
    await page.locator('#btn-menu-return').click();
    assert.equal(await page.locator('#main-menu').isVisible(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('pause and photo mode freeze mission tasks; menu return cancels effects and timers', async () => {
  const { page, context, errors } = await createSession();
  try {
    await launchHunt(page);
    // A late GLB attachment correctly requests ONE paused frame. Settle those
    // visual promises before measuring whether a frozen scene renders again.
    await page.keyboard.press('Escape');
    const visualSettlement = await page.evaluate(async () => {
      window.pauseVisualQA = { readyEvents: [], invalidations: [] };
      game.renderer.scene.addEventListener('visual-ready', () => pauseVisualQA.readyEvents.push({
        paused: game.isPaused, frame: game.renderer.renderer.info.render.frame, needsRender: game.renderer.needsRender
      }));
      const requestRender = game.renderer.requestRender;
      game.renderer.requestRender = function (...args) {
        pauseVisualQA.invalidations.push({ paused: game.isPaused, frame: game.renderer.renderer.info.render.frame });
        return requestRender.apply(this, args);
      };
      const pending = [game.player.generatedVisualReady, game.player2?.generatedVisualReady];
      game.renderer.scene.traverse(node => { if (node._importedCreatureRequest?.ready) pending.push(node._importedCreatureRequest.ready); });
      await Promise.all(pending.filter(Boolean));
      return { promises: pending.filter(Boolean).length, readyEvents: pauseVisualQA.readyEvents };
    });
    console.log('Paused visual settlement:', JSON.stringify(visualSettlement));
    await page.waitForFunction(() => !game.renderer.needsRender);
    await page.locator('#btn-resume-game').click();
    await page.evaluate(() => {
      game.triggerNukeCountdownSequence();
      game.triggerPathogenUrnStrike();
      game.deployHoloDecoy();
    });
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => game.isPaused), true);
    await page.waitForFunction(() => !game.renderer.needsRender);
    const pausedFrame = await page.evaluate(() => game.renderer.renderer.info.render.frame);
    const paused = await page.evaluate(() => game.missionTasks.map(task => task.remaining));
    await page.waitForTimeout(350);
    assert.deepEqual(await page.evaluate(() => game.missionTasks.map(task => task.remaining)), paused);
    const pausedRenderState = await page.evaluate(() => ({ frame: game.renderer.renderer.info.render.frame, ...pauseVisualQA }));
    assert.equal(pausedRenderState.frame, pausedFrame, `Pause releases repeated GPU rendering: ${JSON.stringify(pausedRenderState)}`);
    await page.locator('#btn-resume-game').click();
    await page.keyboard.press('KeyO');
    assert.equal(await page.evaluate(() => game.photoMode.isActive), true);
    await page.waitForFunction(() => !game.renderer.needsRender);
    const photoFrame = await page.evaluate(() => game.renderer.renderer.info.render.frame);
    const photo = await page.evaluate(() => game.missionTasks.map(task => task.remaining));
    await page.waitForTimeout(250);
    assert.deepEqual(await page.evaluate(() => game.missionTasks.map(task => task.remaining)), photo);
    assert.equal(await page.evaluate(() => game.renderer.renderer.info.render.frame), photoFrame, 'Photo mode retains one stable rendered frame until invalidated.');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.locator('#btn-pause-menu-return').click();
    assert.deepEqual(await page.evaluate(() => ({
      playing: game.isPlaying, player: game.player, projectiles: game.projectiles.length,
      decoys: game.holoDecoys.length, pools: game.pathogenPools.length, tasks: game.missionTasks.length,
      nuke: game.nukeCountingDown, overlayHidden: document.querySelector('#nuke-countdown-overlay').classList.contains('hidden')
    })), { playing: false, player: null, projectiles: 0, decoys: 0, pools: 0, tasks: 0, nuke: false, overlayHidden: true });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('sandbox honors the enemy slider and can be completed without spawning another boss', async () => {
  const { page, context, errors } = await createSession();
  try {
    await page.locator('#btn-open-sandbox').click();
    await page.locator('#slider-sandbox-count').evaluate(slider => {
      slider.value = '40';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#btn-launch-sandbox').click();
    assert.equal(await page.evaluate(() => game.missionMode), 'sandbox');
    const initial = await page.evaluate(() => ({ count: game.horde.aliens.length, remaining: game.horde.remainingCount, waves: game.totalWaves, boss: !!game.bosses.activeBoss }));
    // Allied fire may already remove an enemy after the click: restart the same
    // setup synchronously to check the exact spawn count before simulation ticks.
    assert.deepEqual(await page.evaluate(() => { game.startSandboxMission({ enemyCount: 40, bossType: 'xenomorph_queen' }); return { count: game.horde.aliens.length, pending: game.horde.pendingSpawnCount, remaining: game.horde.remainingCount, waves: game.totalWaves, boss: !!game.bosses.activeBoss }; }), { count: 6, pending: 34, remaining: 40, waves: 1, boss: true });
    assert.ok(initial.count <= 6 && initial.count > 0, 'The first squad stays small while the slider controls total reinforcements.');
    assert.ok(initial.remaining <= 40 && initial.remaining >= initial.count);
    await finishMissionInsertion(page);
    await page.evaluate(() => { game.horde.clearWave(); game.bosses.takeDamage(1_000_000); game.update(0.001); });
    assert.equal(await page.evaluate(() => game.isPlaying), false);
    assert.match(await page.locator('#end-title').innerText(), /VICTOIRE/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('melee damages bosses and a close-range trophy execution records a real final victory and releases its visual', async () => {
  const { page, context, errors } = await createSession();
  try {
    await launchHunt(page);
    await reachFinalBattlefieldBoss(page);
    const results = await page.evaluate(() => {
      const mission = game.battlefield;
      const boss = game.bosses.activeBoss;
      boss.mesh.position.copy(game.player.position).add({ x: 0, y: 0, z: 3 });
      const before = boss.hp;
      game.performLightAttack();
      const instantDamage = before - boss.hp;
      for (let frame = 0; boss.hp === before && frame < 90; frame++) game.update(1 / 120);
      const meleeDamage = before - boss.hp;
      boss.isStunned = true;
      game.checkTrophyExecution();
      const healthyTargetSurvived = !!game.bosses.activeBoss;
      // Assisted execution fixture: first earn a real melee impact, then put
      // the boss in the documented wounded execution window.
      boss.hp = boss.maxHp * .25;
      boss.mesh.position.set(40, 0, 40);
      game.checkTrophyExecution();
      const farTargetSurvived = !!game.bosses.activeBoss;
      boss.mesh.position.copy(game.player.position).add({ x: 0, y: 0, z: 3 });
      game.checkTrophyExecution();
      const trophy = game.player.mesh.getObjectByName('hunter-spine-trophy-effect');
      const trophyState = game.player._gadgetEffects?.getState().trophy;
      const geometries = new Set(), materials = new Set();
      trophy?.traverse(mesh => {
        if (mesh.geometry) geometries.add(mesh.geometry);
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (material) materials.add(material);
      });
      let geometryDisposals = 0, materialDisposals = 0;
      geometries.forEach(geometry => geometry.addEventListener('dispose', () => geometryDisposals++));
      materials.forEach(material => material.addEventListener('dispose', () => materialDisposals++));
      const state = { instantDamage, meleeDamage, healthyTargetSurvived, farTargetSurvived, nearbyExecuted: !game.bosses.activeBoss,
        defeatedBossHp: boss.hp, victimKind: boss.type, trophyFamily: trophyState?.family,
        trophyVictimKind: trophyState?.victimKind, renderedFamily: trophy?.userData.trophyFamily,
        trophyGeometries: geometries.size, trophyMaterials: materials.size };
      game.update(0.001);
      return { ...state, missionComplete: mission.complete,
        finalSectorComplete: mission.progression.currentState.completed,
        isPlaying: game.isPlaying, finalPlayerCleared: game.player === null,
        trophyRemoved: trophy?.parent === null, geometryDisposals, materialDisposals };
    });
    assert.ok(results.meleeDamage > 0);
    assert.equal(results.instantDamage, 0, 'Melee damage follows the active animation window.');
    assert.equal(results.healthyTargetSurvived, true, 'A healthy stunned boss cannot be executed.');
    assert.equal(results.farTargetSurvived, true);
    assert.equal(results.nearbyExecuted, true);
    assert.equal(results.defeatedBossHp, 0, 'An execution must report a real boss death rather than only removing a living encounter.');
    assert.equal(results.victimKind, 'predalien_queen');
    assert.equal(results.trophyFamily, 'queen', 'A queen execution must show its actual skull family, not a human sphere.');
    assert.equal(results.renderedFamily, 'queen');
    assert.equal(results.trophyVictimKind, results.victimKind);
    assert.ok(results.trophyGeometries > 0 && results.trophyMaterials > 0);
    assert.equal(results.missionComplete, true);
    assert.equal(results.finalSectorComplete, true);
    assert.equal(results.isPlaying, false);
    assert.equal(results.finalPlayerCleared, true);
    assert.equal(results.trophyRemoved, true);
    assert.equal(results.geometryDisposals, results.trophyGeometries, 'Ending the victorious mission releases every trophy geometry once.');
    assert.equal(results.materialDisposals, results.trophyMaterials, 'Ending the victorious mission releases every trophy material once.');
    assert.match(await page.locator('#end-title').innerText(), /VICTOIRE/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('co-op has independent movement and combat and continues while one hunter survives', async () => {
  const { page, context, errors } = await createSession();
  try {
    await launchHunt(page, true);
    assert.equal(await page.evaluate(() => !!game.player2 && game.renderer.isSplitScreen), true);
    const before = await page.evaluate(() => ({ p1x: game.player.position.x, p2x: game.player2.position.x }));
    await page.keyboard.down('ArrowRight');
    try { await page.waitForFunction(initial => game.player2.position.x > initial + 0.01, before.p2x); }
    finally { await page.keyboard.up('ArrowRight'); }
    const after = await page.evaluate(() => ({ p1x: game.player.position.x, p2x: game.player2.position.x }));
    assert.ok(after.p2x > before.p2x);
    assert.equal(after.p1x, before.p1x);
    // Capture readiness and the result together: no render frame can clear an
    // attack between dispatch and this read, while combat may affect readiness
    // between earlier Playwright calls. Report the actual input guards on failure.
    const attack = await page.evaluate(() => {
      const before = { playing: game.isPlaying, paused: game.isPaused, coop: game.isCoOp,
        photo: game.photoMode.isActive, wheel: game.weaponWheel.isOpen,
        hp: game.player2.hp, latched: game.player2.isFacehuggerLatched,
        attacking: game.player2.isAttacking, weapon: game.player2.activeWeapon,
        attackTimer: game.player2.attackTimer, timing: game.player2.weaponProfile.timing };
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter' }));
      return { before, attacking: game.player2.isAttacking };
    });
    assert.equal(attack.attacking, true, `Co-op Enter state: ${JSON.stringify(attack)}`);
    await page.evaluate(() => { game.player2.hp = game.player2.maxHp; game.player.hp = 0; game.update(0.001); });
    assert.equal(await page.evaluate(() => game.isPlaying), true);
    await page.evaluate(() => { game.player2.hp = 0; game.update(0.001); });
    assert.equal(await page.evaluate(() => game.isPlaying), false);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

// Auxiliary browser scenario only. The caller owns Chrome, frozen-build pins,
// screenshots, failure archives and final mission cleanup.
import assert from 'node:assert/strict';
import { createOperationScene } from '../../../js/battlefield/OperationScene.js';

export async function verifyUiCoopSmoke({ page, captureScreen, finishMissionInsertion }) {
  const row = { status: 'running', scope: 'Source menus, small-map legends, real co-op insertion cameras, finite pilot command and actual checkpoint reload.',
    assistance: ['Pause global gameplay between real UI inputs.', 'Advance actual GameApp.update in 1/60 steps for insertion and three seconds of pilot gameplay.',
      'Render through EngineRenderer.render without changing either game camera.', 'Read physical canopy traces at the two captured insertion stages; CPU tests separately cover the complete sequence.',
      'Checkpoint replay repeats the normal insertion exit; player position is recorded rather than claimed unchanged. No save, actor, resource, phase or simulation clock is patched.'],
    captures: [], checks: {}, selections: [], briefings: [] };
  const check = (name, condition) => { row.checks[name] = Boolean(condition); assert.ok(condition, name); };
  const capture = async name => { const result = await captureScreen(name); row.captures.push(result); return result; };
  const progress = message => console.log(JSON.stringify({ stage: 'ui-coop-smoke', message, at: new Date().toISOString() }));
  const expectedFronts = createOperationScene({ operationId: 'AFF-27' }).config.fronts.map(front => ({ id: front.id, label: front.label }));
  const resourceFields = ['hp', 'plasmaEnergy', 'musouEnergy', 'stamina', 'medicompCharges', 'royalJellyFlasks', 'feralBoltAmmo', 'bearTrapCharges', 'acidSolventCharges', 'm41aGrenadeCharges', 'm77GaussAmmo', 'seegsonBoltAmmo', 'taabeArrowAmmo', 'naruAxeCharges'];
  const sourceCards = () => page.evaluate(() => ({ level: game.ui.selectedLevel.id, bound: game.ui._operationLevelBound,
    cards: [...document.querySelectorAll('.level-card')].map(card => ({ id: card.dataset.levelId, selected: card.classList.contains('selected'), pressed: card.getAttribute('aria-pressed'), disabled: card.disabled })),
    notice: document.querySelector('[data-operation-level-notice]')?.textContent,
    noticeHidden: document.querySelector('[data-operation-level-notice]')?.classList.contains('hidden'),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 }));
  const verifySource = state => {
    assert.equal(state.level, 'xenomorph_prime'); assert.equal(state.bound, true);
    assert.deepEqual(state.cards.filter(card => card.selected).map(card => card.id), ['xenomorph_prime']);
    assert.deepEqual(state.cards.filter(card => card.pressed === 'true').map(card => card.id), ['xenomorph_prime']);
    assert.ok(state.cards.every(card => card.disabled)); assert.equal(state.noticeHidden, false);
    assert.match(state.notice, /Terrain de cette opération.*Trois fronts.*Chasse/); assert.equal(state.horizontalOverflow, false);
  };

  await page.setViewportSize({ width: 800, height: 600 });
  await page.locator('#btn-open-coop').click();
  await page.locator('#btn-confirm-char').click();
  await page.locator('#mission-mode-select').selectOption('fronts');
  await page.locator('#operation-select').selectOption('AFF-27');
  check('actualCoopMenu', await page.evaluate(() => game.isCoOp && game.renderer.isSplitScreen));
  for (const size of [{ width: 800, height: 600 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await page.locator('[data-operation-level-notice]').scrollIntoViewIfNeeded();
    const state = await sourceCards(); verifySource(state); row.selections.push({ viewport: size, ...state });
    await capture(`aff27-linked-terrain-${size.width}x${size.height}`);
  }
  check('sourceTerrainTruthAtBothSizes', row.selections.length === 2);
  await page.locator('#extinction-variant-enabled').check();
  assert.equal(await page.locator('#extinction-variant-upgraded').isChecked(), false);
  assert.equal(await page.locator('#extinction-variant-upgraded').isEnabled(), true);
  progress('Actual co-op menus selected AFF-27 with one source terrain at both viewport sizes.');

  for (const enhanced of [false, true]) {
    if (enhanced) await page.locator('#extinction-variant-upgraded').check();
    await page.locator('#btn-launch-mission').click();
    await page.locator('.operation-briefing').waitFor({ state: 'visible' });
    const briefing = { enhanced, variant: await page.evaluate(() => game.extinctionVariant), summary: await page.locator('.operation-briefing [data-summary]').textContent(), layouts: [] };
    assert.equal(briefing.variant, enhanced ? 'carrier-ravager-enhanced' : 'carrier-ravager');
    if (enhanced) assert.match(briefing.summary, /Variante évoluée.*Supercarrier.*6 parasites.*capacité 12.*Résilience colossale.*catalepsie/);
    else assert.match(briefing.summary, /Variante optionnelle.*Carrier et Ravager.*6 parasites.*capacité 6/);
    for (const size of [{ width: 800, height: 600 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(size);
      const list = page.locator('.operation-briefing [data-front-index]');
      await list.scrollIntoViewIfNeeded(); await list.focus();
      const before = await list.evaluate(node => node.scrollTop);
      await list.press('End');
      const layout = await page.evaluate(() => {
        const figure = document.querySelector('.operation-briefing-plan'), canvas = figure.querySelector('canvas'), list = figure.querySelector('[data-front-index]');
        const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
        return { viewport: { width: innerWidth, height: innerHeight }, canvas: rect(canvas), list: rect(list),
          describedBy: canvas.getAttribute('aria-describedby'), captionId: list.parentElement.id,
          focused: document.activeElement === list, outlineStyle: getComputedStyle(list).outlineStyle,
          outlineWidth: getComputedStyle(list).outlineWidth, scrollTop: list.scrollTop, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight,
          listOverflow: list.scrollWidth > list.clientWidth + 1, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          entries: [...list.children].map(li => ({ id: li.dataset.frontId, key: li.querySelector('b').textContent, text: li.querySelector('span').textContent, accessible: li.getAttribute('aria-label'), rect: rect(li) })) };
      });
      assert.equal(layout.describedBy, layout.captionId); assert.equal(layout.focused, true);
      assert.equal(layout.outlineStyle, 'solid'); assert.equal(layout.outlineWidth, '3px');
      assert.equal(layout.listOverflow, false); assert.equal(layout.pageOverflow, false);
      assert.ok(layout.list.y >= layout.canvas.bottom, 'legend follows the canvas instead of painting over it');
      assert.deepEqual(layout.entries.map(entry => ({ id: entry.id, label: entry.text })), expectedFronts);
      assert.deepEqual(layout.entries.map(entry => entry.key), ['1', '2', '3', '4']);
      for (let i = 1; i < layout.entries.length; i++) assert.ok(layout.entries[i].rect.y >= layout.entries[i - 1].rect.bottom, 'front descriptions occupy separate flow rows');
      assert.ok(layout.canvas.x >= -1 && layout.canvas.right <= size.width + 1);
      if (layout.scrollHeight > layout.clientHeight + 1) assert.ok(layout.scrollTop > before, 'a real End key scrolls the focused front list');
      briefing.layouts.push(layout);
      await capture(`aff27-${enhanced ? 'enhanced' : 'standard'}-legend-${size.width}x${size.height}`);
      await list.press('Home');
    }
    row.briefings.push(briefing);
    await page.locator('#btn-back-to-levels').click();
  }
  check('standardSixAndEnhancedCapacityTwelve', row.briefings.length === 2);
  check('completeNonoverlappingKeyboardLegendsAtBothSizes', row.briefings.every(briefing => briefing.layouts.length === 2));
  progress('Both caste briefings and complete keyboard-scrolled front legends verified at both sizes.');

  await page.locator('#operation-select').selectOption('pilot');
  row.freeSelection = await sourceCards();
  assert.equal(row.freeSelection.bound, false); assert.ok(row.freeSelection.cards.every(card => !card.disabled));
  assert.equal(row.freeSelection.noticeHidden, true);
  await page.locator('.level-card[data-level-id="val_verde_jungle"]').click();
  check('pilotReleasesTerrainCards', await page.evaluate(() => game.ui.selectedLevel.id === 'val_verde_jungle'));
  await page.locator('#operation-layout-select').selectOption('1');
  await page.locator('#operation-difficulty-select').selectOption('standard');
  await page.locator('#btn-launch-mission').click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('#btn-confirm-loadout').click({ timeout: 180000 });
  await page.waitForFunction(() => game.isPlaying && !!game.player && !!game.player2, null, { timeout: 180000 });
  row.initialInsertion = await page.evaluate(async () => {
    const g = game; g.isPaused = true;
    const before = [g.player, g.player2].map(player => ({ visible: player.mesh.visible, hp: player.hp, position: player.position.toArray() }));
    await Promise.all([g.player.generatedVisualReady, g.player2.generatedVisualReady]);
    return { coop: g.isCoOp, splitScreen: g.renderer.isSplitScreen, phase: g.dropPod.phase, elapsed: g.dropPod.elapsed, active: g.dropPod.isActive,
      level: g.ui.selectedLevel.id, mapSeed: g.operationMapSeed, before,
      afterImports: [g.player, g.player2].map(player => ({ visible: player.mesh.visible, hp: player.hp, visual: player.generatedVisualState, position: player.position.toArray() })) };
  });
  check('bothHuntersHiddenDuringArrival', row.initialInsertion.active && row.initialInsertion.before.every(player => !player.visible) && row.initialInsertion.afterImports.every(player => !player.visible));
  assert.equal(row.initialInsertion.level, 'val_verde_jungle'); assert.equal(row.initialInsertion.mapSeed, 1);
  assert.equal(row.initialInsertion.coop, true); assert.equal(row.initialInsertion.splitScreen, true);
  row.insertionStages = [];
  for (const [target, expectedPhase] of [[1.8, 'opening'], [3.25, 'exiting']]) {
    const stage = await page.evaluate(target => {
      const g = game; let ticks = 0;
      try {
        g.isPaused = false;
        while (g.dropPod.isActive && g.dropPod.elapsed < target && ticks < 1000) { g.update(1 / 60); ticks++; }
      } finally { g.isPaused = true; }
      const cameras = [g.renderer.camera, g.renderer.cameraP2].map((camera, index) => {
        const focus = g._insertionCameraFocus[index];
        const h = camera.near * Math.tan(camera.fov * Math.PI / 360) / (camera.zoom ?? 1);
        const radius = Math.min(1.2, Math.max(.25, Math.hypot(h, h * camera.aspect)));
        const canopy = g.env.colliders.filter(collider => collider.owner?.startsWith('val-verde-canopy-') && collider.isCollisionActive?.());
        const canopyHits = canopy.map(collider => ({ owner: collider.owner, hit: collider.traceSegment(focus, camera.position, { radius }) })).filter(row => row.hit).map(row => ({ owner: row.owner, t: row.hit.t }));
        const all = g.env.traceSegment(focus, camera.position, { radius });
        return { player: index + 1, focus: focus.toArray(), camera: camera.position.toArray(), radius, near: camera.near, fov: camera.fov, aspect: camera.aspect, zoom: camera.zoom,
          canopyOwners: canopy.map(collider => collider.owner), canopyHits, allPhysicalHit: all ? { owner: all.collider?.owner, t: all.t } : null };
      });
      const beforeRender = cameras.map(row => row.camera);
      g.renderer.render();
      return { target, ticks, phase: g.dropPod.phase, elapsed: g.dropPod.elapsed, openingProgress: g.dropPod.openingProgress,
        players: [g.player, g.player2].map(player => ({ hp: player.hp, visible: player.mesh.visible, position: player.position.toArray() })),
        splitScreen: g.renderer.isSplitScreen, cameras, cameraPositionsAfterRender: [g.renderer.camera.position.toArray(), g.renderer.cameraP2.position.toArray()], beforeRender };
    }, target);
    assert.equal(stage.phase, expectedPhase); assert.ok(stage.ticks > 0); assert.equal(stage.splitScreen, true);
    assert.ok(stage.players.every(player => player.visible && player.hp > 0));
    assert.deepEqual(stage.cameraPositionsAfterRender, stage.beforeRender, 'rendering does not reposition the genuine cameras');
    assert.notDeepEqual(stage.cameras[0].camera, stage.cameras[1].camera);
    for (const camera of stage.cameras) {
      assert.ok([...camera.camera, ...camera.focus, camera.radius].every(Number.isFinite));
      assert.equal(camera.canopyOwners.length, 4); assert.equal(camera.canopyHits.length, 0);
      assert.equal(camera.allPhysicalHit, null);
    }
    row.insertionStages.push(stage); await capture(`val-verde-real-coop-${expectedPhase}`);
  }
  check('realOpeningAndExitCamerasAvoidCanopyAtCapturedStages', row.insertionStages.length === 2);
  row.insertionComplete = await finishMissionInsertion(page);
  assert.equal(row.insertionComplete.phase, 'complete'); assert.equal(row.insertionComplete.visible, true);
  row.pilot = await page.evaluate(() => {
    const g = game; g.isPaused = false;
    try { for (let i = 0; i < 180; i++) g.update(1 / 60); } finally { g.isPaused = true; }
    g.renderer.render();
    const s = g.battleSimulation, counts = s.getCounts();
    return { operation: g.operationId, coop: g.isCoOp, splitScreen: g.renderer.isSplitScreen, ids: [...s.units.keys()].sort(), allocated: s.initialAllocated,
      digest: s.digest, run: g.campaignRunId, time: s.time, actors: g.battleBridge.actors.size,
      active: Object.values(counts).reduce((sum, count) => sum + count.active, 0), cap: s.budgets.active, conserved: s.assertConservation(),
      players: [g.player, g.player2].map(player => ({ hp: player.hp, visible: player.mesh.visible })), hud: document.getElementById('hud-wave-counter').textContent };
  });
  check('cooperativeFinitePilotHasNonzeroActorsAndFrontsHud', row.pilot.operation === 'pilot' && row.pilot.coop && row.pilot.splitScreen && row.pilot.actors > 0 && row.pilot.actors === row.pilot.active && row.pilot.active <= 32 && row.pilot.cap === 32 && row.pilot.conserved && row.pilot.ids.length === row.pilot.allocated && row.pilot.players.every(player => player.visible && player.hp > 0) && /FRONTS/.test(row.pilot.hud));
  await capture('val-verde-coop-after-insertion');
  progress('Genuine split-screen insertion opening/exit cameras and populated finite pilot verified.');

  await page.evaluate(() => { game.isPaused = true; game.keys = {}; game.ui.showScreen(game.ui.inGameHud); document.activeElement?.blur(); });
  await page.locator('#btn-hud-map').click();
  await page.locator('#command-map-modal').waitFor({ state: 'visible' });
  row.selection = await page.evaluate(() => {
    const state = game.battleSimulation.getHUDState(), group = state.groups.find(group => group.factionId === state.playerFaction && group.alive > 0 && group.officerHP > 0 && group.state !== 'reserve');
    if (!group) throw Error('No actual allocated living commandable captain');
    return { groupId: group.id, frontId: group.frontId };
  });
  await page.locator('#command-map-modal [data-groups]').selectOption([row.selection.groupId]);
  await page.locator('#command-map-modal [data-front]').selectOption(row.selection.frontId);
  await page.locator('#command-map-modal [data-order]').selectOption('defend');
  await page.locator('#command-map-modal [data-send]').click();
  row.order = await page.evaluate(id => ({ ...game.battleSimulation.getGroup(id).order, paused: game.isPaused, feedback: document.querySelector('#command-map-modal [data-feedback]').textContent }), row.selection.groupId);
  assert.equal(row.order.type, 'defend'); assert.equal(row.order.frontId, row.selection.frontId); assert.equal(row.order.paused, true); assert.match(row.order.feedback, /ORDRE ACCEPTÉ/);
  await capture('pilot-coop-real-defend-order');
  await page.locator('#command-map-modal [data-close]').click();
  // Freeze again before Playwright's real pause-button hit testing.
  await page.evaluate(() => { game.isPaused = true; });
  await page.locator('#btn-pause-game').click();
  row.pauseBefore = await page.evaluate(() => ({ paused: game.isPaused, time: game.battleSimulation.time, hp: [game.player.hp, game.player2.hp] }));
  await page.waitForTimeout(400);
  row.pauseAfter = await page.evaluate(() => ({ paused: game.isPaused, time: game.battleSimulation.time, hp: [game.player.hp, game.player2.hp] }));
  assert.deepEqual(row.pauseAfter, row.pauseBefore); assert.equal(row.pauseBefore.paused, true);
  await capture('pilot-coop-real-pause');
  await page.locator('#btn-resume-game').click();
  await page.evaluate(() => { game.isPaused = true; });
  if (!await page.locator('#operation-panel details').evaluate(node => node.open)) await page.locator('#operation-panel summary').click();
  await page.locator('#operation-panel [data-save]').click();
  row.saved = await page.evaluate(({ groupId, fields }) => {
    const saved = JSON.parse(localStorage.getItem('yautja-operation-checkpoint-v1'));
    const resources = state => Object.fromEntries(fields.filter(field => Number.isFinite(state[field])).map(field => [field, state[field]]));
    return { version: saved.version, operation: saved.operationId, players: saved.players, level: saved.levelId, run: saved.campaignRunId,
      scene: saved.scene, ids: saved.simulation.units.map(unit => unit.id).sort(), time: saved.simulation.time,
      group: saved.simulation.groups.find(group => group.id === groupId), playerResources: saved.playerStates.map(resources),
      playerPositions: saved.playerStates.map(state => ({ position: state.position, positionY: state.positionY })) };
  }, { groupId: row.selection.groupId, fields: resourceFields });
  assert.equal(row.saved.version, 1); assert.equal(row.saved.players, 2); assert.equal(row.saved.level, 'val_verde_jungle');
  assert.equal(row.saved.run, row.pilot.run); assert.deepEqual(row.saved.ids, row.pilot.ids); assert.equal(row.saved.group.order.type, 'defend');
  progress('Actual co-op command, pause clock/HP freeze and real checkpoint save verified; reloading now.');
  await page.reload({ waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForFunction(() => Boolean(window.game), null, { timeout: 180000 });
  await page.locator('#btn-start-game').click(); await page.locator('#btn-confirm-char').click();
  await page.locator('#btn-resume-operation').click({ timeout: 180000 });
  await page.waitForFunction(() => game.isPlaying && !!game.player && !!game.player2, null, { timeout: 180000 });
  await page.evaluate(async () => { game.isPaused = true; await Promise.all([game.player.generatedVisualReady, game.player2.generatedVisualReady]); });
  row.resumeInsertion = await finishMissionInsertion(page);
  row.resumed = await page.evaluate(({ groupId, fields }) => {
    const g = game, s = g.battleSimulation, resources = player => Object.fromEntries(fields.filter(field => Number.isFinite(player[field])).map(field => [field, player[field]]));
    g.updateBattleOperation(0); g.renderer.render();
    return { operation: g.operationId, coop: g.isCoOp, splitScreen: g.renderer.isSplitScreen, level: g.ui.selectedLevel.id, run: g.campaignRunId,
      scene: { mapSeed: g.operationMapSeed, difficultyId: g.operationDifficulty, deploymentPlan: g.operationDeploymentPlan ?? 'authored', extinctionVariant: g.extinctionVariant ?? 'none' },
      ids: [...s.units.keys()].sort(), digest: s.digest, time: s.time, group: s.getGroup(groupId), conserved: s.assertConservation(),
      playerResources: [g.player, g.player2].map(resources), playerPositions: [g.player, g.player2].map(player => player.position.toArray()),
      visible: [g.player.mesh.visible, g.player2.mesh.visible], paused: g.isPaused };
  }, { groupId: row.selection.groupId, fields: resourceFields });
  assert.equal(row.resumed.operation, row.saved.operation); assert.equal(row.resumed.coop, true); assert.equal(row.resumed.splitScreen, true);
  assert.equal(row.resumed.level, row.saved.level); assert.equal(row.resumed.run, row.saved.run);
  assert.equal(row.resumed.digest, row.pilot.digest); assert.deepEqual(row.resumed.scene, row.saved.scene); assert.deepEqual(row.resumed.ids, row.saved.ids);
  assert.equal(row.resumed.group.order.type, 'defend'); assert.equal(row.resumed.group.order.frontId, row.selection.frontId);
  assert.equal(row.resumed.conserved, true); assert.equal(row.resumed.time, row.saved.time);
  assert.deepEqual(row.resumed.playerResources, row.saved.playerResources); assert.deepEqual(row.resumed.visible, [true, true]); assert.equal(row.resumed.paused, true);
  check('realReloadPreservesCoopCheckpointIdentitiesOrderResourcesAndClock', true);
  await capture('pilot-coop-real-checkpoint-resumed');
  row.status = 'passed'; progress('Co-op checkpoint resumed through actual menus with finite identities, order, resources and clock preserved.');
  return row;
}

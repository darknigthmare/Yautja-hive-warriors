import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import { createBrowserCleanup, boundedBrowserDiagnostic } from './helpers/browser-cleanup.mjs';
import { reachFinalBattlefieldBoss } from './helpers/complete-battlefield.mjs';
import { finishMissionInsertion } from './helpers/finish-insertion.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const deployment = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
let server, baseURL;
const activeSessions = new Set();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png' };

before(async () => {
  assert.ok(existsSync(resolve(dist, 'index.html')), 'Build the app before running browser tests.');
  // Serve the real production assets with the same CSP configured on Vercel.
  server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const target = resolve(dist, path === '/' ? 'index.html' : `.${path}`);
      if (!target.startsWith(dist + sep)) { res.writeHead(403).end(); return; }
      if (!(await stat(target)).isFile()) { res.writeHead(404).end(); return; }
      for (const { key, value } of deployment.headers[0].headers) res.setHeader(key, value);
      res.setHeader('Content-Type', mime[extname(target)] || 'application/octet-stream');
      res.end(await readFile(target));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolveListening => server.listen(0, '127.0.0.1', resolveListening));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try {
    const results = await Promise.allSettled([...activeSessions].map(session => session.close()));
    const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (failures.length) throw new AggregateError(failures, 'Browser sessions failed to close');
  } finally {
    if (server) await new Promise(done => server.close(done));
  }
});

async function withGame(signal, run, { viewport = { width: 1366, height: 900 }, corruptStorage = false } = {}) {
  const installedChromium = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const cleanup = createBrowserCleanup(signal); activeSessions.add(cleanup);
  let page;
  const errors = [], failedRequests = [], externalRequests = [];
  try {
    signal.throwIfAborted();
    const browser = cleanup.own(await chromium.launch({
      executablePath: installedChromium, headless: true,
      args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
      env: { ...process.env, XDG_CACHE_HOME: '/tmp/yautja-test-cache', XDG_CONFIG_HOME: '/tmp/yautja-test-config' }
    }));
    signal.throwIfAborted();
    const context = cleanup.own(await browser.newContext({ viewport }));
    signal.throwIfAborted();
    page = await context.newPage();
    signal.throwIfAborted();
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('request', request => {
      if (!request.url().startsWith(baseURL) && /^https?:/.test(request.url())) externalRequests.push(request.url());
    });
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    if (corruptStorage) await context.addInitScript(() => {
      localStorage.setItem('yautja_forge_upgrades', '{broken-json');
      localStorage.setItem('yautja_total_kos', 'NaN');
      localStorage.setItem('yautja_skulls', '-100');
      localStorage.setItem('yautja_max_combo', 'Infinity');
    });
    const response = await page.goto(baseURL, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => Boolean(window.game));
    await run(page);
    assert.deepEqual(errors, [], 'No page errors, CSP violations or failed shaders.');
    assert.deepEqual(failedRequests, [], 'Every requested asset must load.');
    assert.deepEqual(externalRequests, [], 'Gameplay, fonts and effects must be self-hosted.');
  } catch (error) {
    const state = await boundedBrowserDiagnostic(page, signal, () => ({
      playing: window.game?.isPlaying, paused: window.game?.isPaused,
      hp: window.game?.player?.hp, latched: window.game?.player?.isFacehuggerLatched,
      photo: window.game?.photoMode?.isActive,
      position: window.game?.player?.position.toArray(),
      screens: [...document.querySelectorAll('.ui-screen:not(.hidden)')].map(element => element.id)
    }));
    console.error('Browser failure state:', JSON.stringify({ state, errors, failedRequests }));
    throw error;
  } finally {
    cleanup.detach();
    try { await cleanup.close(); } finally { activeSessions.delete(cleanup); }
  }
}

async function screen(page, id) {
  await page.waitForFunction(expected => {
    const visible = [...document.querySelectorAll('.ui-screen:not(.hidden)')].map(element => element.id);
    return visible.length === 1 && visible[0] === expected;
  }, id);
}

async function launchHunt(page, { coop = false, level = 0, character = 0 } = {}) {
  await page.locator(coop ? '#btn-open-coop' : '#btn-start-game').click();
  await screen(page, 'char-select-menu');
  await page.locator('.char-btn-card').nth(character).click();
  await page.locator('#btn-confirm-char').click();
  await screen(page, 'level-select-menu');
  await page.locator('.level-card').nth(level).click();
  await page.locator('#btn-launch-mission').click();
  await screen(page, 'loadout-prep-screen');
  await page.locator('#btn-confirm-loadout').click();
  await page.waitForFunction(() => window.game.isPlaying && Boolean(window.game.player));
  await screen(page, 'in-game-hud');
  await finishMissionInsertion(page);
}

test('production: self-hosted startup tolerates damaged saved data', { timeout: 60000 }, async t => {
  await withGame(t.signal, async page => {
    await screen(page, 'main-menu');
    const state = await page.evaluate(() => ({
      canvas: document.querySelector('#canvas-container canvas')?.width > 0,
      stats: window.game.ui.trophyStats,
      balance: window.game.forge.getBalance(),
      name: document.title
    }));
    assert.ok(state.canvas);
    assert.match(state.name, /HIVE WARRIORS/);
    assert.deepEqual(state.stats, { totalKos: 0, skullsCollected: 0, highestCombo: 0 });
    assert.equal(state.balance, 0);
  }, { corruptStorage: true });
});

test('menus: every modal closes cleanly, settings persist, keyboard focus is visible', { timeout: 60000 }, async t => {
  await withGame(t.signal, async page => {
    for (const [open, id, close] of [
      ['btn-open-codex', 'codex-modal', 'btn-close-codex'],
      ['btn-open-sandbox', 'sandbox-modal', 'btn-close-sandbox'],
      ['btn-open-forge', 'forge-modal', 'btn-close-forge'],
      ['btn-open-trophies', 'trophy-modal', 'btn-close-trophies'],
      ['btn-open-options', 'options-modal', 'btn-close-options']
    ]) {
      await page.locator(`#${open}`).click();
      await screen(page, id);
      assert.ok(await page.locator(`#${close}`).isVisible());
      await page.locator(`#${close}`).click();
      await screen(page, 'main-menu');
    }
    await page.locator('#btn-open-options').click();
    await page.locator('#setting-graphics-quality').selectOption('high');
    assert.equal(await page.evaluate(() => window.game.renderer.getQuality()), 'high');
    await page.locator('#setting-volume').fill('0');
    await page.locator('#setting-reduced-motion').check();
    await page.keyboard.press('Escape');
    await screen(page, 'main-menu');
    assert.equal(await page.evaluate(() => localStorage.getItem('yautja_audio_volume')), '0');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.game));
    assert.equal(await page.evaluate(() => window.game.audio.volume), 0);
    assert.equal(await page.evaluate(() => window.game.renderer.getQuality()), 'high');
    assert.ok(await page.locator('body').evaluate(body => body.classList.contains('reduced-motion')));
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.activeElement?.tagName === 'BUTTON'));
  });
});

test('solo: selected loadout, movement, pause, photo, defeat, replay and cleanup', { timeout: 180000 }, async t => {
  await withGame(t.signal, async page => {
    // Keep software WebGL regression runs affordable with the denser models.
    if (await page.evaluate(() => window.game.renderer.softwareRenderer)) await page.setViewportSize({ width: 800, height: 600 });
    await launchHunt(page, { character: 1, level: 1 });
    assert.ok(await page.evaluate(() => window.game.env.envObjects.length > 0));
    const start = await page.evaluate(() => window.game.player.position.z);
    await page.keyboard.down('KeyW');
    try { await page.waitForFunction(initial => window.game.player.position.z < initial - 0.01, start); }
    finally { await page.keyboard.up('KeyW'); }
    assert.ok(await page.evaluate(initial => window.game.player.position.z < initial, start), 'W moves forward.');
    await page.keyboard.press('Escape');
    await screen(page, 'pause-menu');
    const paused = await page.evaluate(() => window.game.player.position.toArray());
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => window.game.player.position.toArray()), paused);
    await page.locator('#btn-resume-game').click();
    await screen(page, 'in-game-hud');
    await page.keyboard.press('KeyO');
    assert.ok(await page.evaluate(() => window.game.photoMode.isActive));
    const orbitStart = await page.evaluate(() => game.renderer.camera.position.toArray());
    await page.mouse.move(440, 420);
    await page.mouse.down();
    await page.mouse.move(535, 445);
    await page.mouse.up();
    await page.waitForFunction(initial => game.renderer.camera.position.distanceTo({ x: initial[0], y: initial[1], z: initial[2] }) > 0.1, orbitStart);
    const zoomStart = await page.evaluate(() => game.renderer.camera.position.distanceTo(game.photoMode.controls.target));
    await page.mouse.wheel(0, -240);
    await page.waitForFunction(initial => game.renderer.camera.position.distanceTo(game.photoMode.controls.target) < initial - 0.05, zoomStart);
    const snapshotReady = page.waitForEvent('download', { timeout: 60000 });
    // A download is the expected result; there is no page navigation to await.
    await page.locator('#btn-snap-photo').click({ noWaitAfter: true });
    const snapshot = await snapshotReady;
    const png = await readFile(await snapshot.path());
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(png.length > 5000, 'Photo mode exports a rendered image.');
    await page.locator('#btn-exit-photo').click();
    assert.equal(await page.evaluate(() => window.game.photoMode.isActive), false);
    assert.equal(await page.evaluate(() => game.photoMode.controls.enabled), false);
    // Simulate a terminal combat state; verify the real update/end/replay path.
    await page.evaluate(() => { window.game.player.hp = 0; window.game.update(0.016); });
    await screen(page, 'game-over-screen');
    assert.equal(await page.evaluate(() => window.game.isPlaying), false);
    assert.equal(await page.evaluate(() => window.game.player), null);
    await page.locator('#btn-replay').click();
    await screen(page, 'loadout-prep-screen');
    await page.locator('#btn-confirm-loadout').click();
    await screen(page, 'in-game-hud');
    await page.keyboard.press('Escape');
    await page.locator('#btn-pause-menu-return').click();
    await screen(page, 'main-menu');
    assert.deepEqual(await page.evaluate(() => ({
      player: window.game.player, aliens: window.game.horde.aliens.length,
      pending: window.game.missionTasks.length, projectiles: window.game.projectiles.length,
      boss: window.game.bosses.activeBoss, coop: window.game.renderer.isSplitScreen
    })), { player: null, aliens: 0, pending: 0, projectiles: 0, boss: null, coop: false });
  });
});

test('campaign: a boss victory advances the chapter and loads its actual arena', { timeout: 90000 }, async t => {
  await withGame(t.signal, async page => {
    if (await page.evaluate(() => window.game.renderer.softwareRenderer)) await page.setViewportSize({ width: 800, height: 600 });
    await page.locator('#btn-open-story').click();
    await screen(page, 'loadout-prep-screen');
    await page.locator('#btn-confirm-loadout').click();
    await screen(page, 'in-game-hud');
    const first = await page.evaluate(() => window.game.ui.selectedLevel.id);
    const route = await reachFinalBattlefieldBoss(page);
    assert.equal(route.visited.length, 6, 'All six connected sectors are physically entered.');
    assert.equal(route.completed.length, 5, 'Kills, commanders and the terminal open the five passages.');
    assert.equal(route.openGates.length, 5);
    await page.evaluate(() => { window.game.bosses.takeDamage(1000000); window.game.update(0.016); });
    await screen(page, 'game-over-screen');
    assert.equal(await page.evaluate(() => window.game.campaign.currentChapterIndex), 1);
    assert.match(await page.locator('#end-title').innerText(), /CHAPITRE/);
    await page.locator('#btn-replay').click();
    await page.locator('#btn-confirm-loadout').click();
    await screen(page, 'in-game-hud');
    assert.notEqual(await page.evaluate(() => window.game.ui.selectedLevel.id), first);
  });
});

test('coop: two players render at correct aspect and share pause/cleanup', { timeout: 90000 }, async t => {
  await withGame(t.signal, async page => {
    if (await page.evaluate(() => window.game.renderer.softwareRenderer)) await page.setViewportSize({ width: 800, height: 600 });
    await launchHunt(page, { coop: true });
    const state = await page.evaluate(() => ({
      two: Boolean(window.game.player2), split: window.game.renderer.isSplitScreen,
      aspect: window.game.renderer.camera.aspect, width: innerWidth, height: innerHeight
    }));
    assert.ok(state.two && state.split);
    assert.ok(Math.abs(state.aspect - state.width / 2 / state.height) < 0.001);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Numpad0');
    await page.keyboard.press('NumpadDecimal');
    await page.keyboard.press('Escape');
    await page.locator('#btn-pause-menu-return').click();
    await screen(page, 'main-menu');
    assert.equal(await page.evaluate(() => window.game.player2), null);
    assert.equal(await page.evaluate(() => window.game.renderer.isSplitScreen), false);
  });
});

test('mobile: 390px menus have no horizontal overflow and remain navigable', { timeout: 60000 }, async t => {
  await withGame(t.signal, async page => {
    await screen(page, 'main-menu');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('#btn-open-options').click();
    await screen(page, 'options-modal');
    await page.locator('#btn-close-options').click();
    await page.locator('#btn-start-game').click();
    await screen(page, 'char-select-menu');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('#btn-confirm-char').click();
    await screen(page, 'level-select-menu');
    await page.locator('.level-card').last().click();
    await page.locator('#btn-launch-mission').click();
    await screen(page, 'loadout-prep-screen');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.ok(await page.locator('#btn-confirm-loadout').isVisible());
  }, { viewport: { width: 390, height: 844 } });
});

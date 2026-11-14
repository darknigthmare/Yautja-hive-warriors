import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { finishMissionInsertion } from './helpers/finish-insertion.mjs';

const baseURL = 'http://127.0.0.1:4192';
let server, browser;
before(async () => {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4192', '--strictPort'], {
    cwd: resolve(import.meta.dirname, '..'), stdio: 'ignore'
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch(baseURL)).ok; } catch { /* Wait for the preview. */ }
    if (ready) break;
    await new Promise(done => setTimeout(done, 100));
  }
  assert.ok(ready, 'Production preview must start before rendering tests.');
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
    env: { ...process.env, XDG_CACHE_HOME: '/tmp/yautja-render-cache', XDG_CONFIG_HOME: '/tmp/yautja-render-config' } });
});
after(async () => { await browser?.close(); server?.kill('SIGTERM'); });

test('production rendering presets compile, export an image and preserve independent co-op viewports', { timeout: 120000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 480, height: 320 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.game);
    await page.evaluate(() => {
      game.startMission({ enemyCount: 1 }); game.togglePause(true);
    });
    await finishMissionInsertion(page);
    await page.evaluate(() => {
      game.renderer.camera.position.set(8, 7, 12); game.renderer.camera.lookAt(0, 2, 0);
    });
    const refreshedWhilePaused = await page.evaluate(() => {
      game.renderer.render();
      const before = game.renderer.needsRender;
      game.renderer.scene.dispatchEvent({ type: 'visual-ready' });
      return { before, after: game.renderer.needsRender, paused: game.isPaused };
    });
    assert.deepEqual(refreshedWhilePaused, { before: false, after: true, paused: true }, 'An asynchronous visual must invalidate a paused frame.');
    for (const quality of ['low', 'balanced', 'high']) {
      const result = await page.evaluate(requested => {
        const renderer = game.renderer;
        renderer.setQuality(requested, { persist: false, allowSoftwareEffects: true });
        renderer.render();
        return { info: renderer.getQualityInfo(), image: renderer.renderer.domElement.toDataURL('image/png') };
      }, quality);
      assert.equal(result.info.requested, quality);
      if (result.info.effective === quality) {
        assert.equal(result.info.postprocessing, quality !== 'low');
        assert.equal(result.info.ambientOcclusion, quality === 'high');
      } else assert.equal(result.info.effective, 'low');
      const png = Buffer.from(result.image.split(',')[1], 'base64');
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.ok(png.length > 5000, 'The composed frame is a rendered scene, not an empty buffer.');
    }
    await page.evaluate(() => { game.renderer.setSplitScreen(true); game.renderer.render(); });
    assert.equal(await page.evaluate(() => game.renderer.getQualityInfo().postprocessing), false);
    await page.setViewportSize({ width: 639, height: 479 });
    await page.waitForFunction(() => game.renderer.width === 639 && game.renderer.height === 479);
    const aspects = await page.evaluate(() => ({ left: game.renderer.camera.aspect, right: game.renderer.cameraP2.aspect }));
    assert.ok(Math.abs(aspects.left - 319 / 479) < 0.000001);
    assert.ok(Math.abs(aspects.right - 320 / 479) < 0.000001);
    const solo = await page.evaluate(() => {
      const renderer = game.renderer; renderer.setSplitScreen(false); renderer.render();
      return { ...renderer.getQualityInfo(), aspect: renderer.camera.aspect };
    });
    assert.ok(Math.abs(solo.aspect - 639 / 479) < 0.000001);
    if (solo.effective === 'high') assert.equal(solo.postprocessing, true);
    await page.evaluate(() => game.renderer.setQuality('high'));
    const info = await page.evaluate(() => game.renderer.getQualityInfo());
    if (info.softwareRenderer) assert.equal(info.effective, 'low');
    assert.equal(await page.evaluate(() => localStorage.getItem('yautja_graphics_quality')), 'high');
    assert.deepEqual(errors, [], 'Shader compilation, render targets and quality transitions must remain valid.');
  } finally { await context.close(); }
});

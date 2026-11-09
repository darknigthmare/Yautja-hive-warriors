// Exploratory source inspection only; this never grants a frozen release pass.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args = process.argv.slice(2), at = args.indexOf('--output'), out = resolve(args[at + 1] ?? '');
assert.ok(at >= 0 && out.startsWith('/workspace/qa/fidelity-20261109/exploratory-') && args.includes('--root-browser-go'));
const base = 'http://127.0.0.1:4353', hash = bytes => createHash('sha256').update(bytes).digest('hex');
const meta = async () => { const r = await fetch(base + '/__fidelity_meta'); assert.equal(r.status, 200); return r.json(); };
const report = { status: 'running', releasePass: false, scope: 'Exploratory unfrozen source studio only; no production gameplay or final release claim.', humanTesters: 0, fidelity1to1Verified: false, hardwarePerformanceMeasured: false, before: await meta(), captures: [], errors: [] };
await mkdir(out); let browser;
const helper = await readFile(new URL(import.meta.url)); report.helperSha256 = hash(helper); await writeFile(resolve(out, 'helper-source.mjs'), helper);
try {
  const { chromium } = await import(pathToFileURL('/workspace/Yautja-fidelity-20261109/node_modules/playwright/index.mjs').href);
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 }), page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); }); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(base + '/__fidelity_studio', { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForFunction(() => window.__fidelityStudio?.ready, null, { timeout: 180000 });
  const assets = [['honor-guard', 'front', 0], ['honor-guard', 'quarter', 0], ['marine:marine', 'front', 0], ['marine:marine', 'quarter', 0]];
  if (!args.includes('--bodies-only')) assets.push(['capsule', 'quarter', 1]);
  for (const [kind, view, opening] of assets) {
    const data = await page.evaluate(({ kind, view, opening }) => __fidelityStudio.render(kind, view, opening), { kind, view, opening });
    const path = kind.replace(':', '-') + '-' + view + '.png'; await page.screenshot({ path: resolve(out, path), animations: 'disabled' });
    report.captures.push({ path, sha256: hash(await readFile(resolve(out, path))), data });
    if (view === 'front') {
      const crop = kind.replace(':', '-') + '-face-native-crop.png', clip = kind === 'honor-guard' ? { x: 500, y: 20, width: 280, height: 300 } : { x: 520, y: 145, width: 240, height: 240 };
      await page.screenshot({ path: resolve(out, crop), clip, animations: 'disabled' }); report.captures.push({ path: crop, sha256: hash(await readFile(resolve(out, crop))), nativeCrop: clip, cameraChanged: false, resized: false });
    }
  }
  const data = await page.evaluate(() => __fidelityStudio.roleSheet()), path = 'roleSheet.png'; await page.screenshot({ path: resolve(out, path), animations: 'disabled' });
  report.captures.push({ path, sha256: hash(await readFile(resolve(out, path))), data });
  report.status = 'captured_exploratory_only'; report.after = await meta(); report.sourceChangedDuringInspection = report.before.source.sha256 !== report.after.source.sha256;
} catch (error) { report.status = 'failed'; report.error = error.stack; }
finally { await browser?.close(); await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ status: report.status, out, error: report.error })); }
if (report.status === 'failed') process.exitCode = 1;

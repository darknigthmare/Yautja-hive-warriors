// Visual component fixture using the actual bundled manager constructors.
// It does not claim a complete mission, source allocation or human playtest.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const options = {};
for (let i = 2; i < process.argv.length; i += 2) options[process.argv[i]] = process.argv[i + 1];
const baseURL = options['--base-url'], output = resolve(options['--output']);
assert.ok(baseURL); assert.match(options['--expected-index'], /^[a-f0-9]{64}$/); assert.match(options['--expected-source'], /^[a-f0-9]{40}$/);
const hash = value => createHash('sha256').update(value).digest('hex');
const root = resolve(import.meta.dirname, '../../../..');
async function tree(path, prefix = '') {
  const files = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const absolute = resolve(path, entry.name), relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await tree(absolute, `${relative}/`));
    else files.push({ path: relative, sha256: hash(await readFile(absolute)) });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
await mkdir(output);
const report = { schemaVersion: 1, status: 'running', startedAt: new Date().toISOString(),
  scope: 'Two rendered component fixtures using real bundled manager classes and damage paths; fixture identities only, not a full mission or source-allocated operation.',
  humanTesters: 0, fidelity1to1Verified: false, hardwarePerformanceVerified: false,
  assistances: ['Isolated scenes built with actual bundled constructors; fixture military IDs and relation/LOS callbacks, no physical environment or complete operation.', 'Manager simulation advances in explicit 0.05/0.1-second steps and renders once at a feedback event.'],
  cases: [], errors: [], failedRequests: [], externalRequests: [] };
let browser;
const before = await tree(resolve(root, 'dist'));
await writeFile(resolve(output, 'dist-before.json'), JSON.stringify(before, null, 2) + '\n');
try {
  const served = await fetch(baseURL); assert.equal(served.status, 200);
  const index = Buffer.from(await served.arrayBuffer()); assert.equal(hash(index), options['--expected-index']);
  assert.equal(hash(await readFile(resolve(root, 'dist/index.html'))), options['--expected-index']);
  const servedInfo = await fetch(new URL('/build-info.json', baseURL)); assert.equal(servedInfo.status, 200);
  const infoBytes = Buffer.from(await servedInfo.arrayBuffer());
  assert.equal(hash(infoBytes), hash(await readFile(resolve(root, 'dist/build-info.json'))));
  report.buildInfo = JSON.parse(infoBytes);
  assert.equal(report.buildInfo.sourceCommit, options['--expected-source']);
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
  page.on('pageerror', error => report.errors.push(error.message)); page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), failure: request.failure() }));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('request', request => { const url = new URL(request.url()); if (!['data:', 'blob:'].includes(url.protocol) && url.origin !== new URL(baseURL).origin) report.externalRequests.push(request.url()); });
  await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForFunction(() => !!window.game?.marines && !!window.game?.synthetics, null, { timeout: 180000 });
  for (const mode of ['reciprocal-fire', 'industrial-warning']) {
    const entry = { id: mode, status: 'running' }; report.cases.push(entry);
    const result = await page.evaluate(mode => {
      const g = window.game; g.isPaused = true;
      const scene = new g.renderer.scene.constructor(); scene.background = g.renderer.scene.background.clone(); scene.environment = g.renderer.scene.environment;
      for (const light of [g.renderer.ambientLight, g.renderer.dirLight, g.renderer.rimLight]) scene.add(light.clone());
      const vector = (x, y, z) => g.renderer.camera.position.clone().set(x, y, z);
      const camera = g.renderer.camera.clone(); camera.position.set(13, 12, 22); camera.lookAt(4, 1.5, 0);
      const audio = new Proxy({}, { get: () => () => {} });
      const marine = new g.marines.constructor(scene, audio), synthetics = new g.synthetics.constructor(scene, audio);
      const sim = { time: 0, groups: new Map(), fronts: new Map([['home', { position: [0, 0] }]]), config: { playerFaction: 'player' }, areHostile: (a, b) => a !== b };
      const env = { hasLineOfSight: () => true, resolveAgentMovement() {} };
      marine.battleSimulation = synthetics.battleSimulation = sim; marine.environment = synthetics.environment = env;
      const group = { id: 'fixture', units: ['marine', 'security', 'joe'], frontId: 'home', reserveOriginId: 'home', position: [0, 0], order: { type: 'attack' }, targetPosition: [12, 0] };
      const unit = (id, actorType, factionId, position) => ({ id, actorType, factionId, position, hp: 150, maxHp: 150 });
      const player = { hp: 10000, position: vector(mode === 'industrial-warning' ? 2 : 900, 0, 0), takeDamage(amount) { this.hp -= amount; } };
      let details;
      if (mode === 'reciprocal-fire') {
        const human = marine.spawnBattleUnit(unit('marine', 'marine', 'uscm', [0, 0]), group);
        const guard = synthetics.spawnBattleUnit(unit('security', 'weyland_combat', 'corporate', [12, 0]), group);
        const provider = () => [...marine.marines, ...synthetics.androids]; marine.combatActorsProvider = synthetics.combatActorsProvider = provider;
        let humanFeedbackSamples = 0, syntheticFeedbackSamples = 0, frames = 0;
        for (let frame = 0; frame < 120; frame++) {
          marine.update(.05, player, { aliens: [] }); synthetics.update(.05, player, { aliens: [] });
          humanFeedbackSamples += marine.npcShotEffects?.length ?? 0; syntheticFeedbackSamples += synthetics.npcShotEffects?.length ?? 0; frames++;
          if (human.hp < 150 && guard.hp < 150 && (marine.npcShotEffects?.length || synthetics.npcShotEffects?.length)) break;
        }
        details = { humanHP: human.hp, securityHP: guard.hp, humanFeedbackSamples, syntheticFeedbackSamples, simulationSeconds: frames * .05, playerHP: player.hp,
          visibleFeedback: scene.children.filter(node => node.name === 'npc-confirmed-shot').length };
      } else {
        const joe = synthetics.spawnBattleUnit(unit('joe', 'working_joe', 'seegson', [0, 0]), group);
        for (let i = 0; i < 10; i++) synthetics.update(.1, player, { aliens: [] });
        details = { state: joe.mesh.userData.syntheticState, visibleWarning: joe.intrusionWarning?.visible === true, simulationSeconds: 1, playerHP: player.hp };
      }
      g.renderer.renderer.render(scene, camera);
      const png = g.renderer.renderer.domElement.toDataURL('image/png');
      marine.clearSquad(); synthetics.clearSquad();
      details.remainingActorOrFeedbackNodes = scene.children.filter(node => !node.isLight).length;
      return { details, png };
    }, mode);
    if (mode === 'reciprocal-fire') { assert.ok(result.details.humanHP < 150 && result.details.securityHP < 150); assert.ok(result.details.humanFeedbackSamples && result.details.syntheticFeedbackSamples && result.details.visibleFeedback); }
    else { assert.equal(result.details.state, 'intrusion-warning'); assert.equal(result.details.visibleWarning, true); }
    assert.equal(result.details.playerHP, 10000); assert.equal(result.details.remainingActorOrFeedbackNodes, 0);
    const image = Buffer.from(result.png.split(',')[1], 'base64'); await writeFile(resolve(output, `${mode}.png`), image);
    Object.assign(entry, { status: 'passed', ...result.details, image: `${mode}.png`, imageSha256: hash(image) });
  }
  assert.equal(report.errors.length, 0); assert.equal(report.failedRequests.length, 0); assert.equal(report.externalRequests.length, 0); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }
finally {
  await browser?.close(); report.finishedAt = new Date().toISOString();
  const after = await tree(resolve(root, 'dist'));
  report.distUnchanged = JSON.stringify(before) === JSON.stringify(after);
  if (!report.distUnchanged) { report.status = 'failed'; process.exitCode = 1; }
  await writeFile(resolve(output, 'dist-after.json'), JSON.stringify(after, null, 2) + '\n');
  for (const entry of report.cases) if (entry.status === 'running') entry.status = 'failed';
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const evidence = (await readdir(output)).filter(name => name !== 'manifest.json');
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(await Promise.all(evidence.map(async path => ({ path, sha256: hash(await readFile(resolve(output, path))) }))), null, 2) + '\n');
}

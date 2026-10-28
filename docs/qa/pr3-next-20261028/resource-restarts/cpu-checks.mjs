// Explicit local harness tests. No preview, Chromium, Git or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCycles, installResourceDiagnostics, parseOptions, settleAssetPromises } from './harness-lib.mjs';

const args = ['--expected-index', 'a'.repeat(64), '--expected-source', 'b'.repeat(40), '--output', '/tmp/resource-fixture-never-created'];
function fixture() {
  const texture = { uuid: 'shared-fixture', alive: true, width: 1024, height: 1024, gpuAllocated: true, observedDisposed: false };
  return Array.from({ length: 10 }, (_, index) => ({ phase: 'measured', status: 'completed',
    active: { sharedImportedTextures: [structuredClone(texture)] },
    cleanupSettled: { gpuCounters: { geometries: 100, textures: 50, programs: 17 },
      scene: { children: 12, nodes: 333, renderableNodes: 100, geometries: 80, materials: 40, textures: 12 },
      sharedCachedTextures: [structuredClone(texture)], hordeCachedPlayers: 0, playerPresent: false, playing: false, liveActors: { aliens: 0, boss: 0 } },
    cpuHeap: { forcedGC: true, usedSize: 1000 + index * 25 } }));
}

test('final index and source pins are mandatory before a run, with ten measured cycles fixed', () => {
  const valid = parseOptions(args); assert.equal(valid.warmups, 5); assert.equal(valid.measured, 10);
  assert.equal(parseOptions([...args, '--warmups', '20']).warmups, 20);
  for (const values of [[], ['--expected-index', 'a'.repeat(64)], [...args, '--expected-source', 'HEAD'], [...args, '--expected-index', 'bad'],
    [...args, '--warmups', '1'], [...args, '--warmups', '21'], [...args, '--output'], [...args, '--port', 'NaN'], [...args, '--measured', '1']]) {
    assert.throws(() => parseOptions(values));
  }
});

async function checkDeadline(playerReady, timeoutMs, action) {
  const originalWindow = globalThis.window, originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  let scheduled = 0, cancelled = 0;
  globalThis.window = { game: { player: { generatedVisualReady: playerReady, generatedVisualState: 'imported' }, renderer: { scene: { traverse() {} } } } };
  globalThis.setTimeout = (callback, delay) => { scheduled++; return originalSet(callback, delay); };
  globalThis.clearTimeout = timer => { cancelled++; return originalClear(timer); };
  try { await action(() => settleAssetPromises({ timeoutMs })); }
  finally { globalThis.window = originalWindow; globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; }
  assert.equal(scheduled, 1); assert.equal(cancelled, 1, 'The losing or expired deadline must always be cancelled');
}

test('successful asset settlement cancels its loser timer and returns no fulfilled resource graph', async () => {
  const graph = { geometry: { fixture: true }, children: [] }; graph.children.push(graph);
  await checkDeadline(Promise.resolve(graph), 1000, async run => {
    const result = await run(); assert.deepEqual(result, { awaitedPromises: 1, settled: ['fulfilled'], playerState: 'imported', playerError: null });
    assert.doesNotThrow(() => JSON.stringify(result));
  });
});

test('asset timeout clears its deadline even when the model promise never resolves', async () => {
  await checkDeadline(new Promise(() => {}), 1, run => assert.rejects(run(), /Async asset settle deadline/));
});

test('resource observers share one listener and retain only shared UUID strings beyond weak references', () => {
  const originalWindow = globalThis.window; globalThis.window = {};
  try {
    installResourceDiagnostics(); const q = window.__restartResourceQA;
    let listener;
    const resource = { uuid: 'imported-texture', isTexture: true, addEventListener(name, value) { assert.equal(name, 'dispose'); listener = value; } };
    q.sharedByUuid.set(resource.uuid, new WeakRef(resource)); q.observe(resource); assert.equal(listener, q.onDispose);
    listener({ target: resource }); listener({ target: resource }); assert.equal(q.totals.textures, 1);
    assert.deepEqual([...q.textureDisposeUuids], ['imported-texture']);
    const procedural = { uuid: 'per-cycle-texture', isTexture: true };
    q.onDispose({ target: procedural }); assert.equal(q.totals.textures, 2); assert.equal(q.textureDisposeUuids.size, 1);
    assert.ok(q.seen instanceof WeakSet && q.disposed instanceof WeakSet);
    assert.ok([...q.sharedByUuid.values()].every(value => value instanceof WeakRef));
  } finally { globalThis.window = originalWindow; }
});

test('all ten stable cleanup samples and actual resident textures pass without declaring a stable heap', () => {
  const result = assessCycles(fixture()); assert.equal(result.passedResourceCriterion, true);
  assert.equal(result.countersStable, true); assert.equal(result.texturesResident, true); assert.equal(result.playersReleased, true);
  assert.equal(result.cpuHeapAfterGC.firstToLast, 225); assert.equal(result.cpuHeapAfterGC.allTenStable, false);
  assert.equal(result.cpuHeapAfterGC.assessment, 'positive_delta_observed_no_general_leak_claim');
});

test('an intermediate resource increase fails even when first and last samples match', () => {
  const cycles = fixture(); cycles[4].cleanupSettled.gpuCounters.geometries++;
  const result = assessCycles(cycles); assert.equal(result.trends.gpuGeometries.firstToLast, 0);
  assert.equal(result.countersStable, false); assert.equal(result.passedResourceCriterion, false);
});

test('changed UUID, missing upload, disposal or invalid image dimensions each fail shared-texture residency', () => {
  for (const change of [cycle => { cycle.active.sharedImportedTextures[0].uuid = 'replacement'; },
    cycle => { cycle.cleanupSettled.sharedCachedTextures[0].gpuAllocated = false; },
    cycle => { cycle.cleanupSettled.sharedCachedTextures[0].observedDisposed = true; },
    cycle => { cycle.active.sharedImportedTextures[0].width = 0; },
    cycle => { cycle.cleanupSettled.sharedCachedTextures[0].alive = false; }]) {
    const cycles = fixture(); change(cycles[7]); const result = assessCycles(cycles);
    assert.equal(result.texturesResident, false); assert.equal(result.passedResourceCriterion, false);
  }
});

test('retained Horde players or combat actors fail cleanup independently of stable GPU counters', () => {
  for (const change of [cycle => { cycle.cleanupSettled.hordeCachedPlayers = 1; },
    cycle => { cycle.cleanupSettled.liveActors.aliens = 1; }, cycle => { cycle.cleanupSettled.playerPresent = true; }]) {
    const cycles = fixture(); change(cycles[8]); assert.equal(assessCycles(cycles).playersReleased, false);
  }
});

test('an incomplete or shorter measured window can never be reported as ten passed restarts', () => {
  assert.throws(() => assessCycles(fixture().slice(0, 9)), /All ten/);
  const cycles = fixture(); cycles[9].status = 'failed'; assert.throws(() => assessCycles(cycles), /did not complete/);
});

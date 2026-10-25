import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserCleanup, boundedBrowserDiagnostic } from './helpers/browser-cleanup.mjs';

test('a Node deadline signal closes owned browser/context and rejects a pending browser operation before another test can retain it', async () => {
  const controller = new AbortController(), cleanup = createBrowserCleanup(controller.signal);
  let rejectOperation, browserCloses = 0, contextCloses = 0;
  const pendingOperation = new Promise((resolve, reject) => { rejectOperation = reject; });
  const rejection = assert.rejects(pendingOperation, /browser closed/);
  cleanup.own({ close() { browserCloses++; rejectOperation(new Error('browser closed')); } });
  cleanup.own({ close() { contextCloses++; } });
  controller.abort(new Error('synthetic Node deadline'));
  await rejection; await cleanup.close(); await cleanup.close(); cleanup.detach();
  assert.equal(browserCloses, 1); assert.equal(contextCloses, 1);
});

test('a failed context close cannot prevent browser close, and handles arriving after abort are also released once', async () => {
  const controller = new AbortController(), cleanup = createBrowserCleanup(controller.signal);
  let browserCloses = 0, contextCloses = 0, lateCloses = 0;
  cleanup.own({ close() { contextCloses++; throw new Error('context close failed'); } });
  cleanup.own({ close() { browserCloses++; } });
  controller.abort();
  await assert.rejects(cleanup.close(), /cleanup failed/);
  cleanup.own({ close() { lateCloses++; } });
  await assert.rejects(cleanup.close(), /cleanup failed/); cleanup.detach();
  assert.equal(browserCloses, 1); assert.equal(contextCloses, 1); assert.equal(lateCloses, 1);
});

test('cleanup covers partial browser initialization and removes its abort listener', async () => {
  const controller = new AbortController(), cleanup = createBrowserCleanup(controller.signal);
  let browserCloses = 0;
  cleanup.own({ close() { browserCloses++; } });
  // An exception during context/page creation still runs the same finally path.
  try { throw new Error('context creation failed'); }
  catch { await cleanup.close(); }
  finally { cleanup.detach(); }
  controller.abort(); await Promise.resolve(); assert.equal(browserCloses, 1);
});

test('failure diagnostics are bounded and skip already closed or aborted pages', async () => {
  let evaluations = 0;
  const blocked = { isClosed: () => false, evaluate: () => { evaluations++; return new Promise(() => {}); } };
  assert.equal(await boundedBrowserDiagnostic(blocked, null, () => null, 5), null);
  assert.equal(evaluations, 1);
  const controller = new AbortController(); controller.abort();
  assert.equal(await boundedBrowserDiagnostic(blocked, controller.signal, () => null), null);
  assert.equal(await boundedBrowserDiagnostic({ ...blocked, isClosed: () => true }, null, () => null), null);
  assert.equal(evaluations, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserCleanup } from './helpers/browser-cleanup.mjs';

test('browser cleanup closes dependent contexts before browser exactly once',async()=>{
  const order=[],cleanup=createBrowserCleanup();
  const browser={close:async()=>{order.push('browser');}};
  const context={close:async()=>{order.push('context');}};
  cleanup.own(browser);cleanup.own(context);
  await cleanup.close();await cleanup.close();
  assert.deepEqual(order,['context','browser']);
  cleanup.detach();
});

test('browser cleanup accepts an already-closed Playwright handle but never hides other errors',async()=>{
  const cleanup=createBrowserCleanup();
  cleanup.own({close:async()=>{throw new Error('Target page, context or browser has been closed');}});
  await cleanup.close();
  const bad=createBrowserCleanup(),exception=new Error('real IO or transport failure');
  bad.own({close:async()=>{throw exception;}});
  await assert.rejects(bad.close(),error=>{
    assert.equal(error instanceof AggregateError,true);
    assert.equal(error.errors.length,1);
    assert.equal(error.errors[0],exception);
    return true;
  });
});

test('abort and later teardown share one close and remain idempotent',async()=>{
  const abort=new AbortController(),cleanup=createBrowserCleanup(abort.signal),called=[];
  cleanup.own({close:async()=>{called.push('browser');}});
  abort.abort();
  await cleanup.close();
  await Promise.resolve();
  assert.deepEqual(called,['browser']);
  cleanup.detach();
});

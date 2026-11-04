// Test-only resource ownership. A node:test deadline aborts its signal, but does
// not stop the async test function or pending Playwright commands by itself.
export function createBrowserCleanup(signal) {
  const resources = new Set(), closing = new Map();
  const closeOnce = resource => {
    if (!closing.has(resource)) closing.set(resource, Promise.resolve().then(() => resource.close()));
    return closing.get(resource);
  };
  const close = async () => {
    // Contexts must close before their parent browser. Closing both in
    // parallel races browser.close against browserContext.close, producing
    // spurious failures even when the gameplay scenario completed normally.
    const failures = [];
    for (const resource of [...resources].reverse()) {
      try { await closeOnce(resource); }
      catch (error) {
        const message = String(error?.message ?? error);
        // Playwright reports this only when another test-abort/Chromium crash
        // has already closed the handle. Other cleanup failures still fail CI.
        if (!/Target page, context or browser has been closed|Browser has been closed|Context has been closed/i.test(message))
          failures.push(error);
      }
    }
    if (failures.length) throw new AggregateError(failures, 'Browser test resource cleanup failed');
  };
  const onAbort = () => { void close().catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });
  return {
    own(resource) {
      resources.add(resource);
      // Launch/context creation can resolve after the Node deadline. Such late
      // handles still belong to this test and must be closed as soon as known.
      if (signal?.aborted) void close().catch(() => {});
      return resource;
    },
    close,
    detach: () => signal?.removeEventListener('abort', onAbort)
  };
}

export async function boundedBrowserDiagnostic(page, signal, read, timeoutMs = 1500) {
  if (!page || signal?.aborted || page.isClosed()) return null;
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => page.evaluate(read)).catch(() => null),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
}

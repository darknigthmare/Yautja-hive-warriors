import test from 'node:test';
import assert from 'node:assert/strict';
import { HonorLedger } from '../js/engine/HonorLedger.js';

const store = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
};

test('legacy earned/spent honor migrates once and caller-supplied funds cannot alter the balance', () => {
  const storage = store(), ledger = new HonorLedger({ storage, earned: 10000, spent: 3500 });
  assert.equal(ledger.balance, 6500);
  assert.equal(ledger.spend({ id: 'forge:hp:2', amount: 7000 }), false);
  assert.equal(ledger.spend({ id: 'forge:damage:1', amount: 3500 }), true);
  assert.equal(ledger.spend({ id: 'forge:damage:1', amount: 3500 }), false);
  assert.equal(ledger.balance, 3000);
  const reloaded = new HonorLedger({ storage, earned: 99999999, spent: 0 });
  assert.equal(reloaded.balance, 3000); assert.equal(reloaded.hasTransaction('forge:damage:1'), true);
});

test('a combat identity earns once, including French trophy names across persistence', () => {
  const storage = store(), ledger = new HonorLedger({ storage });
  const death = { id: 'mission-1:death:alien-7', amount: 100, trophy: 'Crâne de Prétorien', sessionId: 'mission-1' };
  assert.equal(ledger.earn(death), true); assert.equal(ledger.earn(death), false);
  const restored = new HonorLedger({ storage }); assert.equal(restored.earn(death), false);
  assert.deepEqual(restored.getSnapshot().trophies, ['Crâne de Prétorien']); assert.equal(restored.balance, 100);
});

test('settling a mission compacts deaths while preserving exact old-session replay rejection and purchases', () => {
  const storage = store(), ledger = new HonorLedger({ storage });
  for (let i = 0; i < 1200; i++) assert.equal(ledger.earn({ id: `run:death:${i}`, sessionId: 'run', amount: 100 }), true);
  assert.equal(ledger.spend({ id: 'forge:hp:1', amount: 3500 }), true);
  assert.equal(ledger.closeSession('run'), true);
  const next = new HonorLedger({ storage });
  assert.equal(next.hasTransaction('run:death:1'), false); assert.equal(next.hasTransaction('forge:hp:1'), true);
  assert.equal(next.earn({ id: 'run:death:1', sessionId: 'run', amount: 100 }), false);
  assert.equal(next.balance, 116500);
  assert.equal(next.earn({ id: 'new:death:1', sessionId: 'new', amount: 100 }), true);
});

test('quota failures roll back both credit and debit without inventing funds or upgrade receipts', () => {
  const storage = store(), ledger = new HonorLedger({ storage, earned: 10000 });
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(ledger.earn({ id: 'credit', amount: 100 }), false);
  assert.equal(ledger.spend({ id: 'forge:hp:1', amount: 3500 }), false);
  assert.equal(ledger.balance, 10000); assert.equal(ledger.hasTransaction('credit'), false); assert.equal(ledger.hasTransaction('forge:hp:1'), false);
  assert.equal(ledger.getSnapshot().persistent, false);
});

test('corrupt saves, invalid amounts and unavailable storage remain finite and playable', () => {
  const storage = store(); storage.setItem('yautja_honor_ledger_v1', '{broken');
  const ledger = new HonorLedger({ storage, earned: 500 });
  for (const value of [-1, Infinity, NaN, 1.5, 1e14]) {
    assert.equal(ledger.earn({ id: 'bad', amount: value }), false);
    assert.equal(ledger.spend({ id: 'bad', amount: value }), false);
  }
  assert.equal(ledger.balance, 500);
  const memory = new HonorLedger({ storage: null });
  assert.equal(memory.earn({ id: 'private:death:1', amount: 100 }), true); assert.equal(memory.balance, 100); assert.equal(memory.persistent, false);
});

test('failed combat credits remain pending once and settle after storage recovers without reopening a finished run', () => {
  const storage = store(), write = storage.setItem, ledger = new HonorLedger({ storage });
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const reward = { id: 'run:death:7', amount: 100, sessionId: 'run', trophy: 'Crâne' };
  assert.equal(ledger.earn(reward), false); assert.equal(ledger.earn(reward), false);
  assert.equal(ledger.hasPendingReward(reward.id), true); assert.equal(ledger.getSnapshot().pendingHonor, 100);
  assert.equal(ledger.closeSession('run'), false); assert.equal(ledger.balance, 0);
  storage.setItem = write;
  assert.equal(ledger.retryPending(), true); assert.equal(ledger.retryPending(), true);
  assert.equal(ledger.balance, 100); assert.equal(ledger.getSnapshot().pendingRewards, 0);
  assert.equal(ledger.closeSession('run'), true);
  const restored = new HonorLedger({ storage });
  assert.equal(restored.earn(reward), false); assert.equal(restored.balance, 100);
});

const LEDGER_KEY = 'yautja_honor_ledger_v1';
const preservedTrophy = 'Crâne de Prétorien — sauvegarde existante';
const invalidRecords = [
  ['invalid earned balance', JSON.stringify({ version: 1, earned: 'bad', spent: 0, trophies: [preservedTrophy] }), 'invalid_record'],
  ['spent greater than earned', JSON.stringify({ version: 1, earned: 50, spent: 100, trophies: [preservedTrophy] }), 'invalid_record'],
  ['future schema', JSON.stringify({ version: 2, earned: 900, spent: 0, trophies: [preservedTrophy] }), 'unsupported_version'],
  ['invalid transaction container', JSON.stringify({ version: 1, earned: 900, spent: 0, transactions: [], trophies: [preservedTrophy] }), 'invalid_record'],
  ['invalid transaction receipt', JSON.stringify({ version: 1, earned: 900, spent: 0, transactions: { reward: { amount: '100' } }, trophies: [preservedTrophy] }), 'invalid_record'],
  ['invalid finalized session', JSON.stringify({ version: 1, earned: 900, spent: 0, closedSessions: { finished: false }, trophies: [preservedTrophy] }), 'invalid_record'],
  ['partly malformed trophy list', JSON.stringify({ version: 1, earned: 900, spent: 0, trophies: [preservedTrophy, 17] }), 'invalid_record'],
  ['truncated JSON', '{"version":1,"trophies":["Crâne"]', 'parse_error'],
  ['explicit null record', 'null', 'invalid_record'],
  ['empty stored string', '', 'parse_error'],
];

for (const [description, original, reason] of invalidRecords) {
  test(`startup preserves ${description} without overwriting progress or enabling purchases`, () => {
    const storage = store(); storage.values.set(LEDGER_KEY, original);
    let writes = 0; const write = storage.setItem;
    storage.setItem = (key, value) => { writes++; return write(key, value); };
    const ledger = new HonorLedger({ storage, earned: 800 });
    assert.equal(storage.getItem(LEDGER_KEY), original);
    assert.equal(writes, 0);
    const state = ledger.getSnapshot();
    assert.equal(state.recoveryRequired, true); assert.equal(state.readOnly, true);
    assert.equal(state.recoveryReason, reason); assert.equal(state.status, 'recovery_required');
    assert.equal(state.persistent, false);
    if (original.includes(preservedTrophy)) assert.deepEqual(state.trophies, [preservedTrophy]);
    assert.equal(ledger.spend({ id: 'forge:hp:1', amount: 100 }), false);
    assert.equal(ledger.earn({ id: 'new:death:1', amount: 100, sessionId: 'new', trophy: 'Nouveau trophée' }), false);
    assert.equal(ledger.hasPendingReward('new:death:1'), true);
    assert.equal(ledger.retryPending(), false); assert.equal(ledger.closeSession('new'), false);
    assert.equal(ledger.retryRecovery(), false);
    assert.equal(storage.getItem(LEDGER_KEY), original); assert.equal(writes, 0);
  });
}

test('a denied read never becomes an empty save, and a later retry settles pending honor once', () => {
  const storage = store(), original = JSON.stringify({ version: 1, earned: 500, spent: 0, trophies: [preservedTrophy] });
  storage.values.set(LEDGER_KEY, original);
  let readable = false, writes = 0;
  const read = storage.getItem, write = storage.setItem;
  storage.getItem = key => { if (!readable) throw new Error('Storage denied'); return read(key); };
  storage.setItem = (key, value) => { writes++; return write(key, value); };
  const ledger = new HonorLedger({ storage, earned: 999999 });
  assert.equal(ledger.getSnapshot().recoveryReason, 'storage_read_failed');
  assert.equal(writes, 0);
  assert.equal(ledger.earn({ id: 'new:death:2', amount: 100, sessionId: 'new', trophy: 'Nouveau trophée' }), false);
  assert.equal(ledger.retryRecovery(), false); assert.equal(writes, 0);
  assert.equal(storage.values.get(LEDGER_KEY), original);
  readable = true;
  assert.equal(ledger.retryRecovery(), true);
  assert.equal(ledger.balance, 600); assert.equal(ledger.getSnapshot().pendingRewards, 0);
  assert.equal(ledger.getSnapshot().recoveryRequired, false); assert.equal(ledger.getSnapshot().readOnly, false);
  assert.equal(ledger.getSnapshot().persistent, true);
  assert.deepEqual(ledger.getSnapshot().trophies, [preservedTrophy, 'Nouveau trophée']);
  assert.equal(ledger.retryRecovery(), true); assert.equal(ledger.balance, 600);
  assert.equal(ledger.earn({ id: 'new:death:2', amount: 100, sessionId: 'new' }), false);
});

test('known version-one saves may omit additive ledgers without a destructive startup rewrite', () => {
  const storage = store(), original = JSON.stringify({ version: 1, earned: 200, spent: 50, trophies: [preservedTrophy] });
  storage.values.set(LEDGER_KEY, original);
  const ledger = new HonorLedger({ storage });
  assert.equal(ledger.balance, 150); assert.equal(ledger.getSnapshot().status, 'loaded');
  assert.equal(ledger.getSnapshot().recoveryRequired, false);
  assert.equal(storage.getItem(LEDGER_KEY), original);
  assert.equal(ledger.earn({ id: 'new:reward', amount: 25 }), true);
  assert.equal(ledger.balance, 175); assert.deepEqual(new HonorLedger({ storage }).getSnapshot().trophies, [preservedTrophy]);
});

test('recovery reconciles pending rewards against restored receipts and closed sessions', () => {
  const storage = store(); storage.values.set(LEDGER_KEY, '{broken');
  const ledger = new HonorLedger({ storage });
  for (const reward of [
    { id: 'duplicate', amount: 100, sessionId: 'old', trophy: 'Déjà acquis' },
    { id: 'closed:reward', amount: 200, sessionId: 'closed', trophy: 'Session clôturée' },
    { id: 'new:reward', amount: 50, sessionId: 'new', trophy: 'À conserver' },
  ]) assert.equal(ledger.earn(reward), false);
  storage.values.set(LEDGER_KEY, JSON.stringify({
    version: 1, earned: 1000, spent: 150,
    transactions: { duplicate: { amount: 100, kind: 'combat', sessionId: 'old' }, 'forge:hp:1': { amount: -150, kind: 'upgrade' } },
    closedSessions: { closed: true }, trophies: [preservedTrophy, 'Déjà acquis', 'Session clôturée'],
  }));
  assert.equal(ledger.retryRecovery(), true);
  const snapshot = ledger.getSnapshot();
  assert.equal(snapshot.earned, 1050); assert.equal(snapshot.spent, 150); assert.equal(snapshot.balance, 900);
  assert.equal(snapshot.pendingRewards, 0); assert.equal(snapshot.recoveryRequired, false);
  assert.deepEqual(snapshot.trophies, [preservedTrophy, 'Déjà acquis', 'Session clôturée', 'À conserver']);
  assert.equal(ledger.hasTransaction('forge:hp:1'), true); assert.equal(ledger.hasTransaction('closed:reward'), false);
  assert.equal(ledger.earn({ id: 'duplicate', amount: 100, sessionId: 'old' }), false);
  assert.equal(ledger.earn({ id: 'another', amount: 100, sessionId: 'closed' }), false);
  const restored = new HonorLedger({ storage });
  assert.equal(restored.balance, 900); assert.deepEqual(restored.getSnapshot().trophies, snapshot.trophies);
});

test('recovery can validate restored data while retaining pending credits through another quota failure', () => {
  const storage = store(); storage.values.set(LEDGER_KEY, '{broken');
  const ledger = new HonorLedger({ storage });
  assert.equal(ledger.earn({ id: 'new:reward', amount: 75, trophy: 'En attente' }), false);
  const restored = JSON.stringify({ version: 1, earned: 500, spent: 0, trophies: [preservedTrophy] });
  storage.values.set(LEDGER_KEY, restored);
  const write = storage.setItem; storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(ledger.retryRecovery(), false);
  assert.equal(ledger.getSnapshot().recoveryRequired, false); assert.equal(ledger.getSnapshot().status, 'storage_unavailable');
  assert.equal(ledger.balance, 500); assert.equal(ledger.getSnapshot().pendingHonor, 75);
  assert.equal(storage.getItem(LEDGER_KEY), restored);
  storage.setItem = write;
  assert.equal(ledger.retryPending(), true); assert.equal(ledger.balance, 575);
  assert.equal(ledger.getSnapshot().status, 'saved'); assert.equal(ledger.getSnapshot().pendingRewards, 0);
  assert.deepEqual(ledger.getSnapshot().trophies, [preservedTrophy, 'En attente']);
});

test('explicit memory-only play stays writable without claiming persistent or recovery state', () => {
  const ledger = new HonorLedger({ storage: null, earned: 200 });
  assert.equal(ledger.getSnapshot().status, 'memory_only');
  assert.equal(ledger.getSnapshot().recoveryRequired, false);
  assert.equal(ledger.getSnapshot().readOnly, false); assert.equal(ledger.getSnapshot().persistent, false);
  assert.equal(ledger.earn({ id: 'memory:reward', amount: 100 }), true);
  assert.equal(ledger.spend({ id: 'memory:purchase', amount: 50 }), true);
  assert.equal(ledger.balance, 250); assert.equal(ledger.retryRecovery(), true);
});

test('an undefined storage response is not proof that the saved ledger is absent', () => {
  let writes = 0;
  const ledger = new HonorLedger({ storage: { getItem: () => undefined, setItem: () => { writes++; } }, earned: 500 });
  assert.equal(ledger.getSnapshot().recoveryRequired, true);
  assert.equal(ledger.getSnapshot().recoveryReason, 'invalid_record');
  assert.equal(writes, 0); assert.equal(ledger.retryRecovery(), false); assert.equal(writes, 0);
});

test('denied access to the browser storage object retains a retriable read failure', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = store(), original = JSON.stringify({ version: 1, earned: 500, spent: 0, trophies: [preservedTrophy] });
  storage.values.set(LEDGER_KEY, original);
  let readable = false;
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() {
      if (!readable) throw new Error('SecurityError');
      return storage;
    } });
    const ledger = new HonorLedger({ earned: 999999 });
    assert.equal(ledger.getSnapshot().recoveryReason, 'storage_read_failed');
    assert.equal(ledger.getSnapshot().readOnly, true);
    assert.equal(ledger.earn({ id: 'during:denied', amount: 50 }), false);
    assert.equal(ledger.retryRecovery(), false);
    assert.equal(storage.getItem(LEDGER_KEY), original);
    readable = true;
    assert.equal(ledger.retryRecovery(), true); assert.equal(ledger.balance, 550);
    assert.deepEqual(ledger.getSnapshot().trophies, [preservedTrophy]);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('retryRecovery retries an initial migration write without claiming success while quota remains full', () => {
  const storage = store(), write = storage.setItem;
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const ledger = new HonorLedger({ storage, earned: 500, spent: 100 });
  assert.equal(ledger.getSnapshot().status, 'storage_unavailable');
  assert.equal(ledger.getSnapshot().readOnly, false);
  assert.equal(ledger.retryRecovery(), false);
  assert.equal(storage.getItem(LEDGER_KEY), null);
  storage.setItem = write;
  assert.equal(ledger.retryRecovery(), true); assert.equal(ledger.getSnapshot().status, 'saved');
  assert.equal(new HonorLedger({ storage }).balance, 400);
});

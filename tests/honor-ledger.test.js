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

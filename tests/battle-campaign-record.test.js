import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleCampaignRecord, CLAN_CAMPAIGN_ARC_ID } from '../js/battlefield/BattleCampaignRecord.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';

const arcId = CLAN_CAMPAIGN_ARC_ID;
const now = () => '2026-10-26T12:00:00.000Z';
function storage() {
  const values = new Map([['yautja-honor', '{"balance":42}'], ['yautja-trophies', '["existing"]']]);
  return { values, blocked: false, getItem(key) { return values.get(key) ?? null; }, setItem(key, value) { if (this.blocked) throw new Error('quota'); values.set(key, value); } };
}
function mission(id = 'AFF-01', history) {
  const config = getBattleOperationConfig(id), sim = new BattleSimulation(config, { history });
  return { config, sim };
}
function win(sim) { return sim.finishOperation({ outcome: 'victory', reason: 'narrative_strategy', strategyId: 'archives' }); }

test('original clan continuity is opt-in and carries an actual named loss into a later operation only', () => {
  const disk = storage(), book = new BattleCampaignRecord({ storage: disk, now }), first = mission();
  const named = [...first.sim.units.values()].find(unit => unit.uniqueId === 'BOS-26');
  first.sim.recordDeath({ entityId: named.id, killerFaction: first.config.playerFaction });
  assert.equal(book.observe(first.config, first.sim, { runId: 'independent' }).independent, true);
  assert.equal(book.writes, 0);
  assert.equal(book.observe(first.config, first.sim, { arcId, runId: 'run-a' }).recorded, true);
  const reloaded = new BattleCampaignRecord({ storage: disk, now }), laterConfig = getBattleOperationConfig('AFF-03');
  const history = reloaded.historyFor(laterConfig, { arcId });
  assert.deepEqual(history.defeatedUniqueIds, ['BOS-26']);
  const later = new BattleSimulation(laterConfig, { history }), laterNamed = [...later.units.values()].find(unit => unit.uniqueId === 'BOS-26');
  assert.equal(laterNamed.state, 'dead'); assert.equal(laterNamed.hp, 0); assert.equal(later.assertConservation(), true);
  assert.equal(mission('AFF-03').sim.getUnit(laterNamed.id).state, 'distant');
  assert.equal(disk.values.get('yautja-honor'), '{"balance":42}'); assert.equal(disk.values.get('yautja-trophies'), '["existing"]');
  assert.equal(book.getDebrief().originalScenario, true); assert.equal(book.getDebrief().fidelity1to1Verified, false);
  assert.throws(() => book.historyFor(getBattleOperationConfig('AFF-06'), { arcId }), /outside/);
  assert.throws(() => book.historyFor({ ...first.config, mode: 'reconstruction' }, { arcId }), /outside/);
});

test('suspension preserves a run; only an actual confirmed result or explicit withdrawal finalizes it once', () => {
  const disk = storage(), book = new BattleCampaignRecord({ storage: disk, now }), { config, sim } = mission();
  const options = { arcId, runId: 'resume-same-id', characterId: 'jungle_hunter' };
  book.observe(config, sim, options); assert.equal(book.getDebrief().recordedRuns, 0);
  const restored = BattleSimulation.fromState(config, sim.saveState(), { history: book.historyFor(config, { arcId }) });
  assert.throws(() => book.recordOutcome(config, restored, { outcome: 'victory', reason: 'forged' }, options), /not confirmed/);
  win(restored);
  const narrative = { tasks: [{ id: 'archive', status: 'done' }, { id: 'extract', status: 'active' }] };
  const result = book.recordOutcome(config, restored, restored.getResult(), { ...options, narrative });
  assert.equal(result.recorded, true); assert.deepEqual(result.receipt.completedTasks, ['archive']);
  assert.deepEqual(result.receipt.counts, restored.getCounts());
  assert.equal(book.recordOutcome(config, restored, restored.getResult(), options).duplicate, true);
  assert.equal(book.recordOutcome(config, restored, { outcome: 'withdrawn', reason: 'abandon' }, options).reason, 'run_already_finalized_with_another_result');
  assert.equal(book.getDebrief().recordedRuns, 1);
  const another = mission();
  assert.equal(book.recordOutcome(another.config, another.sim, { outcome: 'withdrawn', reason: 'explicit_abandon' }, { arcId, runId: 'abandoned' }).recorded, true);
  win(another.sim);
  assert.equal(book.recordOutcome(another.config, another.sim, another.sim.getResult(), { arcId, runId: 'abandoned' }).reason, 'run_already_finalized_with_another_result');
});

test('finalized run IDs survive the 64-receipt debrief ring and a temporary quota failure retries safely', () => {
  const disk = storage(), book = new BattleCampaignRecord({ storage: disk, now }), { config, sim } = mission(); win(sim);
  for (let index = 0; index < 70; index++) assert.equal(book.recordOutcome(config, sim, sim.getResult(), { arcId, runId: `run-${index}` }).recorded, true);
  assert.equal(book.data.arcs[0].runs.length, 64); assert.equal(book.getDebrief().recordedRuns, 70);
  assert.equal(new BattleCampaignRecord({ storage: disk, now }).recordOutcome(config, sim, sim.getResult(), { arcId, runId: 'run-0' }).duplicate, true);
  disk.blocked = true;
  assert.equal(book.recordOutcome(config, sim, sim.getResult(), { arcId, runId: 'quota-retry' }).persisted, false);
  disk.blocked = false;
  assert.equal(book.recordOutcome(config, sim, sim.getResult(), { arcId, runId: 'quota-retry' }).persisted, true);
  assert.equal(new BattleCampaignRecord({ storage: disk, now }).getDebrief().recordedRuns, 71);
});

test('observing the same named loss retries a recovered store and prevents resurrection after reload', () => {
  const disk = storage(), book = new BattleCampaignRecord({ storage: disk, now }), { config, sim } = mission();
  const options = { arcId, runId: 'named-loss-retry' }, named = [...sim.units.values()].find(unit => unit.uniqueId === 'BOS-26');
  assert.equal(sim.recordDeath({ entityId: named.id, killerFaction: config.playerFaction }), true);
  disk.blocked = true;
  const first = book.observe(config, sim, options);
  assert.equal(first.recorded, true); assert.equal(first.persisted, false); assert.equal(book.writes, 0);
  disk.blocked = false;
  const retry = book.observe(config, sim, options);
  assert.equal(retry.recorded, false); assert.equal(retry.persisted, true); assert.equal(book.writes, 1);
  assert.equal(book.status, 'saved'); assert.equal(book.lastError, null);
  const reloaded = new BattleCampaignRecord({ storage: disk, now }), laterConfig = getBattleOperationConfig('AFF-03');
  const history = reloaded.historyFor(laterConfig, { arcId });
  assert.deepEqual(history.defeatedUniqueIds, ['BOS-26']);
  const later = new BattleSimulation(laterConfig, { history }), laterNamed = [...later.units.values()].find(unit => unit.uniqueId === 'BOS-26');
  assert.equal(laterNamed.state, 'dead'); assert.equal(laterNamed.hp, 0); assert.equal(later.assertConservation(), true);
  assert.equal(book.observe(config, sim, options).persisted, true); assert.equal(book.writes, 1);
  assert.equal(book.data.arcs[0].individuals.length, 1); assert.equal(book.getDebrief().recordedRuns, 0);
  assert.equal(disk.values.get('yautja-honor'), '{"balance":42}'); assert.equal(disk.values.get('yautja-trophies'), '["existing"]');
});

test('an unchanged named loss never reports persisted while the store remains unavailable', () => {
  const disk = storage(), key = 'yautja-battle-campaign-v1', previous = JSON.stringify({ version: 1, arcs: [] });
  disk.values.set(key, previous);
  const book = new BattleCampaignRecord({ storage: disk, now }), { config, sim } = mission(), options = { arcId, runId: 'named-loss-blocked' };
  sim.recordDeath({ entityId: [...sim.units.values()].find(unit => unit.uniqueId === 'BOS-26').id });
  disk.blocked = true;
  assert.equal(book.observe(config, sim, options).persisted, false);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = book.observe(config, sim, options);
    assert.equal(response.recorded, false); assert.equal(response.persisted, false);
    assert.equal(book.status, 'storage_unavailable'); assert.equal(book.writes, 0);
    assert.equal(disk.values.get(key), previous);
    assert.deepEqual(response.history.defeatedUniqueIds, ['BOS-26']);
  }
});

test('observing a named loss already loaded from a valid store performs no redundant write', () => {
  const disk = storage(), book = new BattleCampaignRecord({ storage: disk, now }), { config, sim } = mission(), options = { arcId, runId: 'named-loss-loaded' };
  sim.recordDeath({ entityId: [...sim.units.values()].find(unit => unit.uniqueId === 'BOS-26').id });
  assert.equal(book.observe(config, sim, options).persisted, true);
  const previous = disk.values.get(book.key), reloaded = new BattleCampaignRecord({ storage: disk, now });
  const response = reloaded.observe(config, sim, options);
  assert.equal(response.recorded, false); assert.equal(response.persisted, true);
  assert.equal(reloaded.status, 'loaded'); assert.equal(reloaded.writes, 0); assert.equal(disk.values.get(book.key), previous);
});

test('incompatible records remain untouched until explicit reset, isolated from existing stores', () => {
  const disk = storage(), key = 'yautja-battle-campaign-v1', corrupt = '{"version":999,"arcs":[]}'; disk.values.set(key, corrupt);
  const book = new BattleCampaignRecord({ storage: disk, now }), { config, sim } = mission(); win(sim);
  assert.equal(book.readOnly, true); assert.equal(book.recordOutcome(config, sim, sim.getResult(), { arcId, runId: 'blocked' }).recorded, false);
  assert.equal(disk.values.get(key), corrupt); assert.equal(book.resetArc('unknown'), false);
  assert.equal(book.resetArc(arcId), true); assert.equal(book.readOnly, false);
  assert.equal(book.recordOutcome(config, sim, sim.getResult(), { arcId, runId: 'after-explicit-reset' }).recorded, true);
  assert.equal(disk.values.get('yautja-honor'), '{"balance":42}'); assert.equal(disk.values.get('yautja-trophies'), '["existing"]');
});

test('an older checkpoint cannot revive a unique individual already confirmed dead by the campaign', () => {
  const book = new BattleCampaignRecord({ now }), { config, sim } = mission(), older = sim.saveState();
  sim.recordDeath({ entityId: [...sim.units.values()].find(unit => unit.uniqueId).id });
  assert.equal(book.observe(config, sim, { arcId, runId: 'loss-before-reload' }).persisted, true);
  assert.equal(book.status, 'memory_only'); assert.equal(book.writes, 0);
  assert.throws(() => BattleSimulation.fromState(config, older, { history: book.historyFor(config, { arcId }) }), /revive/);
  const restored = BattleSimulation.fromState(config, sim.saveState(), { history: book.historyFor(config, { arcId }) });
  assert.equal(restored.assertConservation(), true);
});

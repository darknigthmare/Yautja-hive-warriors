import test from 'node:test';
import assert from 'node:assert/strict';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { carrierCargoCapacity } from '../js/battlefield/ExtinctionCarrierCargo.js';
import { applyExtinctionBattleVariant, isExtinctionCasteVariant } from '../js/battlefield/ExtinctionBattleVariant.js';
import { extinctionVariantBriefing } from '../js/ui/OperationBriefing.js';

const scenario = extinctionVariant => createOperationScene({ operationId: 'AFF-27', mapSeed: 0, extinctionVariant }).config;
const ids = config => config.groups.flatMap(g => g.units.map(u => u.id)).sort();
const byProfile = (sim, id) => [...sim.units.values()].find(u => u.profileId === id);

test('the evolved LV-742 scenario signs upgrades without adding soldiers, cargo or starting HP', () => {
  const normal = scenario('none'), basic = scenario('carrier-ravager'), evolved = scenario('carrier-ravager-enhanced');
  assert.deepEqual(ids(evolved), ids(normal)); assert.deepEqual(ids(evolved), ids(basic));
  assert.deepEqual(evolved.budgets, basic.budgets); assert.deepEqual(evolved.budgets, normal.budgets);
  assert.equal(evolved.groups.length, normal.groups.length);
  const a = new BattleSimulation(basic), b = new BattleSimulation(evolved);
  try {
    assert.equal(extinctionVariantBriefing(normal), null);
    assert.match(extinctionVariantBriefing(basic), /Variante optionnelle.*6 parasites.*capacité 6/);
    assert.equal(carrierCargoCapacity(a, byProfile(a, 'XEN-009')), 6);
    const carrier = byProfile(b, 'XEN-009'), ravager = byProfile(b, 'XEN-010');
    assert.equal(carrierCargoCapacity(b, carrier), 12);
    assert.equal(carrier.carrierCargoIds.length, 6, 'Extra capacity never fabricates six more parasites');
    const briefing=extinctionVariantBriefing(evolved);
    assert.ok(briefing.includes(`${carrier.carrierCargoIds.length} parasites déjà alloués`));
    assert.ok(briefing.includes(`capacité ${carrierCargoCapacity(b, carrier)}`));
    assert.match(briefing, /Supercarrier.*Résilience colossale.*catalepsie/);
    for (const id of carrier.carrierCargoIds) {
      const passenger = b.units.get(id);
      assert.equal(passenger.carriedByCarrierId, carrier.id); assert.equal(passenger.actorType, 'facehugger');
      assert.equal(passenger.groupId, carrier.groupId);
    }
    assert.equal(carrier.hp, byProfile(a, 'XEN-009').hp); assert.equal(ravager.hp, byProfile(a, 'XEN-010').hp);
    assert.equal(evolved.profiles.find(p => p.id === 'XEN-010').extinctionUpgrade, 'colossal-resilience');
    assert.equal(b.units.size, b.initialAllocated); assert.equal(b.assertConservation(), true);
    const restored = BattleSimulation.fromState(evolved, b.saveState());
    try {
      assert.equal(restored.digest, b.digest); assert.deepEqual([...restored.units.keys()].sort(), ids(evolved));
      assert.deepEqual(byProfile(restored, 'XEN-009').carrierCargoIds, carrier.carrierCargoIds);
      assert.equal(restored.assertConservation(), true);
    } finally { restored.dispose(); }
  } finally { a.dispose(); b.dispose(); }
});

test('normal, basic and evolved checkpoints cannot be exchanged or upgraded by a live actor flag', () => {
  const configs = ['none', 'carrier-ravager', 'carrier-ravager-enhanced'].map(scenario);
  const sims = configs.map(c => new BattleSimulation(c));
  try {
    assert.equal(new Set(sims.map(s => s.digest)).size, 3);
    for (let i = 0; i < sims.length; i++) for (let j = 0; j < sims.length; j++) if (i !== j)
      assert.throws(() => BattleSimulation.fromState(configs[j], sims[i].saveState()), /save does not match/);
    const basicCarrier = byProfile(sims[1], 'XEN-009');
    basicCarrier.extinctionUpgrade = 'supercarrier-genome';
    assert.equal(carrierCargoCapacity(sims[1], basicCarrier), 6, 'Only the signed configuration authorizes capacity');
  } finally { for (const s of sims) s.dispose(); }
});

test('the evolved scenario rejects another continuity and unknown variant before mutating its configuration', () => {
  const config = getBattleOperationConfig('AFF-14'), before = structuredClone(config);
  assert.throws(() => applyExtinctionBattleVariant(config, 'carrier-ravager-enhanced'), /exclusive to AFF-27/);
  assert.deepEqual(config, before);
  for (const value of ['__proto__', 'constructor', 'auto-upgrade', null]) {
    assert.equal(isExtinctionCasteVariant(value), false);
    assert.throws(() => applyExtinctionBattleVariant(structuredClone(config), value), /exclusive to AFF-27/);
  }
});

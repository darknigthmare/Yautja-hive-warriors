import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { AllyRescueSystem } from '../js/battlefield/AllyRescueSystem.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';

// Actual source variant and owner damage APIs. No new soldier, rescue record,
// death or timer is introduced to make the cataleptic body reloadable.
function fixture({ upgraded = true, operationId = 'AFF-27' } = {}) {
  const config = createOperationScene({ operationId: 'AFF-27', mapSeed: 0,
    extinctionVariant: upgraded ? 'carrier-ravager-enhanced' : 'carrier-ravager' }).config;
  const sim = new BattleSimulation(config), actors = new Map();
  // A deliberately corrupted runtime context must not grant a second owner;
  // construct the genuine variant first so its cargo admission remains real.
  if (operationId !== 'AFF-27') sim.config.id = operationId;
  const rescue = new AllyRescueSystem({ simulation: sim, actors });
  const unit = [...sim.units.values()].find(unit => unit.actorType === 'ravager');
  assert.ok(unit); assert.equal(unit.state, 'distant');
  const ids = [...sim.units.keys()].sort();
  return { config, sim, actors, rescue, unit, ids,
    phase() {
      assert.equal(sim.damageDistantRavager(unit.id, 600, { damageType: 'raw' }).reason, 'ordinary_damage');
      assert.equal(sim.damageDistantRavager(unit.id, 350, { damageType: 'raw' }).reason, 'catalepsy_started');
      assert.equal(unit.hp, 50); assert.equal(unit.incapacitated, true);
    },
    dispose() { rescue.dispose(); sim.dispose(); } };
}

function fakeMedicalRecord(unit) {
  return { unitId: unit.id, status: 'downed', remaining: 25,
    position: [unit.position[0], 0, unit.position[1]], maxHp: unit.maxHp,
    downedOnce: true, recoveryRemaining: 0, cause: 'forged_rescue_owner', killerFaction: null };
}

test('real signed Ravager phase and empty medical state compose across checkpoint restoration', () => {
  const f = fixture(); let restored, medical;
  try {
    f.phase(); const phase = structuredClone(f.unit.ravagerCatalepsy);
    const saved = f.sim.saveState(), rescueSaved = f.rescue.serialize();
    assert.deepEqual(rescueSaved.records, []);
    restored = BattleSimulation.fromState(f.config, saved);
    medical = new AllyRescueSystem({ simulation: restored, actors: new Map() });
    assert.equal(medical.restore(rescueSaved), true);
    const actual = restored.getUnit(f.unit.id);
    assert.equal(actual.hp, 50); assert.equal(actual.incapacitated, true);
    assert.equal(actual.ravagerRegenesisSpent, true); assert.deepEqual(actual.ravagerCatalepsy, phase);
    assert.equal(restored.time, saved.time); assert.equal(restored.digest, f.sim.digest);
    assert.deepEqual([...restored.units.keys()].sort(), f.ids);
    assert.equal(restored.deaths.size, 0); assert.equal(restored.assertConservation(), true);
    assert.deepEqual(medical.serialize().records, []);
  } finally { medical?.dispose(); restored?.dispose(); f.dispose(); }
});

test('medical materialization never changes a real cataleptic Ravager HP, pose or owner timer', () => {
  const f = fixture(), scene = new THREE.Scene(), horde = new XenomorphHorde(scene, null);
  try {
    f.phase(); horde.battleSimulation = f.sim;
    const actor = horde.spawnBattleUnit(f.sim.getUnit(f.unit.id), f.sim.getGroup(f.unit.groupId));
    horde.update(0, { hp: 1000, position: actor.mesh.position.clone().add(new THREE.Vector3(0, 0, 30)) });
    const hp = actor.hp, downed = actor.isDowned, pose = actor.ravagerVisual.rotation.toArray(),
      children = [...actor.mesh.children], phase = structuredClone(f.unit.ravagerCatalepsy);
    f.actors.set(f.unit.id, { actor, manager: horde });
    for (let i = 0; i < 3; i++) {
      assert.equal(f.rescue.onMaterialize(actor), false);
      assert.equal(actor.hp, hp); assert.equal(actor.isDowned, downed);
      assert.deepEqual(actor.ravagerVisual.rotation.toArray(), pose);
      assert.deepEqual(actor.mesh.children, children);
      assert.equal(actor.mesh.getObjectByName('ally-rescue-posture'), undefined);
      assert.equal(f.rescue.records.size, 0);
      assert.deepEqual(f.unit.ravagerCatalepsy, phase);
    }
    assert.equal(f.rescue.onDematerialize(f.unit.id, { position: [1, 2] }), false);
    f.rescue.update(25); assert.equal(f.unit.hp, 50); assert.equal(f.unit.incapacitated, true);
    assert.equal(f.sim.deaths.size, 0); assert.equal(f.rescue.events.length, 0);
  } finally { horde.clearWave(); f.dispose(); }
});

test('a medical record cannot steal a legal one-HP Ravager phase or its spent upgrade', () => {
  const f = fixture();
  try {
    f.phase(); f.sim.damageDistantRavager(f.unit.id, 49, { damageType: 'raw' });
    assert.equal(f.unit.hp, 1); assert.ok(f.unit.ravagerCatalepsy);
    const saved = f.rescue.serialize(); saved.records.push(fakeMedicalRecord(f.unit));
    assert.throws(() => f.rescue.restore(saved), /Invalid persistent rescue casualty/);
    assert.equal(f.rescue.records.size, 0); assert.equal(f.unit.hp, 1);
    assert.equal(f.unit.ravagerRegenesisSpent, true); assert.equal(f.unit.incapacitated, true);
  } finally { f.dispose(); }
});

test('genuine allied Yautja orphan incapacity is still refused without its medical timer', () => {
  const f = fixture();
  try {
    const ally = [...f.sim.units.values()].find(unit => unit.species === 'yautja' &&
      f.sim.relationship(unit.factionId, f.config.playerFaction) === 'allied');
    assert.ok(ally); ally.hp = 1; ally.incapacitated = true;
    assert.throws(() => f.rescue.restore(f.rescue.serialize()), /Incapacitated unit has no saved rescue timer/);
  } finally { f.dispose(); }
});

test('unphased, unsigned, wrong-continuity and malformed Ravager incapacity remain orphan errors', () => {
  const variants = [
    { upgraded: true, mutate: unit => { delete unit.ravagerCatalepsy; } },
    { upgraded: false, mutate: unit => { unit.hp = 50; unit.ravagerCatalepsy = { startedAt: 0, recoverAt: 12 }; unit.ravagerRegenesisSpent = true; } },
    { upgraded: true, operationId: 'AFF-14', mutate: unit => { unit.hp = 50; unit.ravagerCatalepsy = { startedAt: 0, recoverAt: 12 }; unit.ravagerRegenesisSpent = true; } },
    ...[
      unit => { unit.ravagerCatalepsy.recoverAt = 1200; },
      unit => { unit.ravagerCatalepsy.startedAt = 1; },
      unit => { unit.ravagerCatalepsy.extra = true; },
      unit => { unit.ravagerRegenesisSpent = false; },
      unit => { unit.hp = unit.maxHp; }
    ].map(mutate => ({ upgraded: true, mutate }))
  ];
  for (const options of variants) {
    const f = fixture(options);
    try {
      if (options.upgraded && options.operationId !== 'AFF-14') f.phase();
      f.unit.incapacitated = true; options.mutate(f.unit);
      assert.throws(() => f.rescue.restore(f.rescue.serialize()), /Incapacitated unit has no saved rescue timer/);
    } finally { f.dispose(); }
  }
});

test('malformed phase plus forged medical record cannot bypass either owner validation', () => {
  const f = fixture();
  try {
    f.phase(); f.sim.damageDistantRavager(f.unit.id, 49, { damageType: 'raw' });
    f.unit.ravagerCatalepsy.recoverAt = 1200;
    assert.throws(() => BattleSimulation.fromState(f.config, f.sim.saveState()), /invalid saved Ravager regenesis/);
    const saved = f.rescue.serialize(); saved.records.push(fakeMedicalRecord(f.unit));
    assert.throws(() => f.rescue.restore(saved), /Invalid persistent rescue casualty/);
  } finally { f.dispose(); }
});

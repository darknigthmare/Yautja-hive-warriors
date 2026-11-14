import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { CombatEvents } from '../js/engine/CombatEvents.js';
import { selectBattleTarget } from '../js/engine/BattleActorSupport.js';

const stateHash = state => createHash('sha256').update(JSON.stringify(state)).digest('hex');

function fixture({ upgraded = true } = {}) {
  const config = createOperationScene({ operationId: 'AFF-27', mapSeed: 0,
    extinctionVariant: upgraded ? 'carrier-ravager-enhanced' : 'carrier-ravager' }).config;
  config.ai.enabled = false;
  const scene = new THREE.Scene(), audio = new Proxy({}, { get: () => () => {} });
  const horde = new XenomorphHorde(scene, audio);
  let bridge;
  const sim = new BattleSimulation(config, {
    spawnGroup: () => false, // This fixture isolates an already detailed survivor.
    despawnGroup: (...args) => bridge.despawnGroup(...args),
    healBattleUnit: (id, hp) => { const a = bridge.actors.get(id)?.actor; if (a) a.hp = hp; }
  });
  const unit = [...sim.units.values()].find(u => u.actorType === 'ravager');
  const group = sim.groups.get(unit.groupId);
  // A single surviving member of a real allocated group is a valid detail
  // state. Its seven prior casualties stay finite, in the real death ledger.
  for (const id of group.units) if (id !== unit.id)
    sim.recordDeath({ entityId: id, cause: 'fixture-prior-battle' });
  unit.state = 'active'; group.state = 'active'; group.materialized = true;
  const player = { hp: 1000, factionId: config.playerFaction,
    position: new THREE.Vector3(unit.position[0], 2, unit.position[1] + 30),
    takeDamage() { throw new Error('a cataleptic Ravager must not attack'); } };
  const env = { getElevationAt: () => 2, hasLineOfSight: () => true, resolveMovement() {},
    navigation: { canStand: () => true, safeSpawnNear: p => p.clone() } };
  bridge = new BattleActorBridge({ player, horde, env, marines: {}, allies: {},
    synthetics: {}, bosses: {} });
  bridge.bind(sim);
  horde.combatEvents = new CombatEvents({ runId: 'detailed-ravager' });
  horde.combatEvents.subscribe(event => sim.recordDeath(event));
  assert.equal(bridge.spawnGroup(sim.getGroup(group.id), [sim.getUnit(unit.id)]), true, bridge.lastError);
  const actor = bridge.actors.get(unit.id).actor;
  player.position.copy(actor.mesh.position).add(new THREE.Vector3(0, 0, 10));
  bridge.sync();
  const tick = dt => {
    bridge.sync();
    sim.update(dt, { players: [{ id: 'p1', hp: 1000,
      position: [player.position.x, player.position.z] }] });
    horde.update(dt, player); bridge.sync();
  };
  return { config, sim, scene, horde, bridge, unit, actor, group, player, env, tick,
    dispose() { bridge.dispose(); horde.clearWave(); sim.dispose(); } };
}

function nearDeath(f) {
  f.horde.applyDamage(f.actor, 600, { cause: 'raw', killerFaction: f.config.playerFaction });
  return f.horde.checkMeleeHits({ origin: f.actor.mesh.position.clone(),
    radius: .1, damage: 350, type: 'wristblades', killerFaction: f.config.playerFaction });
}

test('real melee starts a visible finite catalepsy, without death, movement or a new identity', () => {
  const f = fixture();
  try {
    const { sim, unit, actor, bridge, horde } = f;
    const total = sim.units.size, counts = sim.getCounts(), position = actor.mesh.position.clone();
    const hit = nearDeath(f)[0];
    assert.equal(hit.killed, false); assert.equal(unit.hp, 50);
    assert.equal(actor.hp, 50); assert.equal(actor.isDowned, true);
    assert.equal(unit.ravagerRegenesisSpent, true);
    assert.equal(sim.deaths.has(unit.id), false); assert.equal(horde.deadCount, 0);
    assert.equal(horde.combatEvents.deaths.size, 0);
    for (let i = 0; i < 4; i++) f.tick(.25);
    assert.ok(actor.ravagerVisual.rotation.z < -1.5, 'an actor-owned visual falls');
    assert.deepEqual(actor.mesh.position.toArray(), position.toArray(), 'collision root does not fall or move');
    actor.mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(actor.ravagerVisual);
    assert.ok(Math.abs(box.min.y - 2) < .001, 'fallen body remains on the same real floor');
    assert.equal(bridge.actors.get(unit.id).actor, actor);
    assert.equal(sim.units.size, total); assert.deepEqual(sim.getCounts(), counts);
    for (let i = 0; i < 43; i++) f.tick(.25);
    assert.equal(unit.ravagerCatalepsy.recoverAt, 12);
    assert.equal(unit.incapacitated, true);
    f.tick(.25);
    assert.equal(unit.incapacitated, false); assert.equal(actor.isDowned, false);
    assert.ok(unit.hp >= 500); assert.equal(actor.hp, unit.hp);
    assert.equal(unit.ravagerCatalepsy, undefined);
    assert.equal(bridge.actors.get(unit.id).actor, actor);
    assert.equal(sim.units.size, total); assert.equal(sim.assertConservation(), true);
    for (let i = 0; i < 3; i++) f.tick(.25);
    assert.ok(Math.abs(actor.ravagerVisual.rotation.z) < .001, 'the finite get-up returns the visual to its original pose');
    assert.equal(actor.ravagerVisual.userData.ravagerCatalepsyPose, false);
    horde.applyDamage(actor, actor.hp - 50, { cause: 'raw' });
    assert.equal(actor.hp, 50); assert.equal(actor.isDowned, false, 'the spent upgrade cannot start a second phase');
    horde.applyDamage(actor, 100, { cause: 'raw' });
    assert.equal(unit.state, 'dead'); assert.equal(horde.deadCount, 1);
  } finally { f.dispose(); }
});

test('real NPC target damage enters the shared phase and typed flame fire finishes it once', () => {
  const f = fixture();
  try {
    const hostile = [...f.sim.factions.values()].find(x => x.species === 'human' &&
      f.sim.areHostile(x.id, f.unit.factionId));
    assert.ok(hostile);
    const shooter = { mesh: new THREE.Group(), factionId: hostile.id, type: 'marine' };
    shooter.mesh.position.copy(f.actor.mesh.position).add(new THREE.Vector3(0, 0, 8));
    const manager = { battleSimulation: f.sim, combatActorsProvider: () => [f.actor],
      environment: f.env, time: 0 };
    f.horde.applyDamage(f.actor, 600, { cause: 'raw', killerFaction: hostile.id });
    const target = selectBattleTarget(manager, shooter);
    assert.equal(target.actor, f.actor);
    target.takeDamage(350);
    assert.equal(f.unit.hp, 113); assert.equal(f.actor.isDowned, true);
    assert.equal(f.horde.combatEvents.deaths.size, 0);
    shooter.type = 'flametrooper'; target.takeDamage(1);
    assert.equal(f.unit.state, 'dead'); assert.equal(f.unit.hp, 0);
    assert.equal(f.unit.ravagerCatalepsy, undefined);
    assert.equal(f.horde.combatEvents.deaths.size, 1); assert.equal(f.horde.deadCount, 1);
    assert.equal(f.sim.deaths.get(f.unit.id).killerFaction, hostile.id);
    target.takeDamage(1000); f.bridge.sync();
    assert.equal(f.horde.combatEvents.deaths.size, 1); assert.equal(f.horde.deadCount, 1);
    assert.equal(f.bridge.actors.has(f.unit.id), false);
    assert.equal(f.sim.assertConservation(), true);
  } finally { f.dispose(); }
});

test('unsigned normal Ravager, incendiary damage and excessive hits cannot gain a free life', () => {
  for (const mode of ['unsigned', 'fire', 'excess']) {
    const f = fixture({ upgraded: mode !== 'unsigned' });
    try {
      if (mode === 'fire') {
        f.horde.applyDamage(f.actor, 950, { cause: 'fire' });
        assert.equal(f.unit.ravagerCatalepsy, undefined);
        f.horde.applyDamage(f.actor, 100, { cause: 'fire' });
      } else if (mode === 'excess') f.horde.applyDamage(f.actor, 5000, { cause: 'raw' });
      else {
        f.horde.applyDamage(f.actor, 600, { cause: 'raw' });
        f.horde.applyDamage(f.actor, 450, { cause: 'raw' });
      }
      f.bridge.sync();
      assert.equal(f.unit.state, 'dead'); assert.equal(f.unit.ravagerCatalepsy, undefined);
      assert.equal(f.horde.combatEvents.deaths.size, 1);
      assert.equal(f.unit.ravagerRegenesisSpent, undefined);
      assert.equal(f.sim.assertConservation(), true);
    } finally { f.dispose(); }
  }
});

test('active and distant checkpoint restores retain one original catalepsy deadline and spent upgrade', () => {
  const f = fixture();
  try {
    nearDeath(f); f.tick(.25);
    const deadline = f.unit.ravagerCatalepsy.recoverAt;
    const active = f.sim.saveState();
    assert.equal(active.units.find(u => u.id === f.unit.id).state, 'active');
    f.sim._dematerialize(f.group);
    assert.equal(f.bridge.actors.size, 0); assert.equal(f.unit.state, 'distant');
    assert.equal(f.sim.deaths.has(f.unit.id), false);
    for (const saved of [active, f.sim.saveState()]) {
      const restored = BattleSimulation.fromState(f.config, saved);
      try {
        const unit = restored.units.get(f.unit.id);
        assert.equal(unit.state, 'distant'); assert.equal(unit.incapacitated, true);
        assert.equal(unit.ravagerCatalepsy.recoverAt, deadline);
        assert.equal(unit.ravagerRegenesisSpent, true);
        restored.time = deadline; restored._ravagerRegenesisStep();
        assert.equal(unit.hp, 500); assert.equal(unit.incapacitated, false);
        assert.equal(restored.units.size, f.sim.units.size);
        assert.equal(restored.assertConservation(), true);
      } finally { restored.dispose(); }
    }
    const tampered = structuredClone(active);
    tampered.units.find(u => u.id === f.unit.id).hp = 500;
    assert.throws(() => BattleSimulation.fromState(f.config, tampered), /invalid saved Ravager regenesis/);
  } finally { f.dispose(); }
});

test('pause and delta zero preserve the phase, body pose and real hurt state', () => {
  const f = fixture();
  try {
    nearDeath(f); f.tick(.25);
    f.sim.paused = true;
    const saved = f.sim.saveState(), transform = f.actor.ravagerVisual.matrix.clone();
    assert.equal(f.horde.applyDamage(f.actor, 1, { cause: 'fire' }).damage, 0);
    assert.equal(f.sim._ravagerRegenesisStep(), 0);
    f.sim.update(10, { paused: true }); f.horde.update(0, f.player); f.bridge.sync();
    assert.equal(stateHash(f.sim.saveState()), stateHash(saved));
    assert.ok(f.actor.ravagerVisual.matrix.equals(transform));
    assert.equal(f.actor.hp, 50); assert.equal(f.actor.isDowned, true);
  } finally { f.dispose(); }
});

test('legacy direct HP loss is settled before death and cannot erase a detailed cataleptic body', () => {
  const f = fixture();
  try {
    f.horde.applyDamage(f.actor, 600, { cause: 'raw' });
    f.actor.hp -= 450;
    f.horde.update(0, f.player); f.bridge.sync();
    assert.equal(f.actor.hp, 1); assert.equal(f.unit.hp, 1);
    assert.equal(f.actor.isDowned, true); assert.equal(f.horde.deadCount, 0);
    assert.equal(f.bridge.actors.get(f.unit.id).actor, f.actor);
    f.horde.applyDamage(f.actor, 100, { cause: 'raw' }); f.bridge.sync();
    assert.equal(f.unit.state, 'dead'); assert.equal(f.horde.deadCount, 1);
  } finally { f.dispose(); }
});

test('net and stun clocks expire without a target, and an oversized delta cannot multiply net damage', () => {
  const scene = new THREE.Scene(), horde = new XenomorphHorde(scene, null);
  const actor = { mesh: new THREE.Group(), hp: 500, maxHp: 500, speed: 10,
    isNetEntangled: true, netTimer: 1, isStunned: true, stunTimer: 2 };
  horde.aliens.push(actor); scene.add(actor.mesh);
  try {
    horde.update(10, null);
    assert.equal(actor.hp, 475); assert.equal(actor.netTimer, 0);
    assert.equal(actor.isNetEntangled, false); assert.equal(actor.isStunned, false);
    assert.equal(actor.stunTimer, 0); assert.deepEqual(actor.mesh.position.toArray(), [0, 0, 0]);
  } finally { horde.clearWave(); }
});

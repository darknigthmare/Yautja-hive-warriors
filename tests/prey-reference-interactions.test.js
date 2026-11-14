import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { prepareSarii, orderSarii, damageSarii, updateSarii } from '../js/entities/SariiCompanion.js';

const dogFixture = () => {
  const environment = new EnvironmentManager(new THREE.Scene());
  const owner = { hp: 850, position: new THREE.Vector3(), smartDiscCharges: 2, medicompCharges: 3, score: 0,
    addScore(amount) { this.score += amount; } };
  const group = new THREE.Group(); group.position.set(1, .45, 0);
  environment.sariiCompanion = prepareSarii({ group, pos: group.position.clone(), isTamed: false });
  return { environment, owner, state: environment.sariiCompanion };
};

test('Sarii joins once without futuristic loot, accepts explicit orders and cannot be stolen by the second player', () => {
  const { environment, owner, state } = dogFixture();
  assert.equal(environment.checkSariiCompanionInteraction(owner), true);
  assert.equal(state.isTamed, true); assert.equal(state.order, 'follow');
  assert.equal(owner.smartDiscCharges, 2); assert.equal(owner.medicompCharges, 3); assert.equal(owner.score, 0);
  for (const order of ['hold', 'guard', 'retreat', 'follow']) assert.equal(orderSarii(environment, owner, order), true);
  const other = { hp: 850, position: owner.position.clone() };
  assert.equal(orderSarii(environment, other, 'guard'), false);
  assert.equal(state.owner, owner); assert.equal(state.id, 'sarii');
});

test('wounds force a persistent retreat without repeated withdrawal events or unlimited automatic healing', () => {
  const { environment, owner, state } = dogFixture();
  const events = []; environment.onCompanionEvent = event => events.push(event);
  orderSarii(environment, owner, 'guard'); state.pos.set(12, .45, 12); state.group.position.copy(state.pos);
  assert.equal(damageSarii(environment, 100), true);
  assert.equal(state.hp, 20); assert.equal(state.wounded, true); assert.equal(state.order, 'retreat');
  assert.equal(orderSarii(environment, owner, 'guard'), false);
  for (let frame = 0; frame < 600; frame++) updateSarii(environment, 1 / 30, owner, { aliens: [] });
  assert.ok(state.pos.distanceTo(state.home) < .6); assert.equal(state.retired, true);
  assert.equal(state.hp, 20); assert.equal(events.length, 1); assert.equal(state.withdrawals, 1);
});

test('guard bites one hostile target on a finite cadence at30/60/120fps, while following and allied actors receive no free damage', () => {
  const counts = [];
  for (const hz of [30, 60, 120]) {
    const { environment, owner, state } = dogFixture();
    orderSarii(environment, owner); orderSarii(environment, owner, 'guard');
    const enemy = { hp: 500, factionId: 'hostile', mesh: new THREE.Group() }; enemy.mesh.position.set(1, 0, 0);
    const allied = { hp: 500, factionId: 'friendly', mesh: new THREE.Group() }; allied.mesh.position.set(.5, 0, 0);
    environment.game = { battleSimulation: { areHostile: (_, id) => id === 'hostile' } };
    const hits = [], horde = { aliens: [allied, enemy], applyDamage(target, amount, details) { hits.push({ target, amount, details }); target.hp -= amount; } };
    for (let frame = 0; frame < 4 * hz; frame++) updateSarii(environment, 1 / hz, owner, horde);
    assert.ok(hits.every(hit => hit.target === enemy && hit.amount === 18 && hit.details.killerFaction === 'player_clan'));
    assert.equal(allied.hp, 500); counts.push(hits.length);
    orderSarii(environment, owner, 'follow');
    for (let frame = 0; frame < hz; frame++) updateSarii(environment, 1 / hz, owner, horde);
    assert.equal(hits.length, counts.at(-1));
    assert.equal(state.id, 'sarii');
  }
  assert.deepEqual(counts, [5, 5, 5]);
});

test('the three-laser bone mask arms a real projectile trap and never applies instant boss damage', () => {
  const environment = new EnvironmentManager(new THREE.Scene()), group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial(), geometry = new THREE.CylinderGeometry(.015, .015, 12, 4);
  const lasers = Array.from({ length: 3 }, () => { const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; group.add(mesh); return mesh; });
  environment.boneMaskDecoy = { group, pos: new THREE.Vector3(0, 1.4, 0), lasers, isArmed: false };
  const owner = { position: new THREE.Vector3(), hp: 850 };
  const boss = { hp: 8600, type: 'feral_predator_boss', mesh: new THREE.Group() }; boss.mesh.position.set(0, 0, 15);
  const calls = [], manager = { activeBoss: boss, armFeralMaskTrap(origin, aim) { calls.push({ origin: origin.toArray(), aim: aim.toArray() }); return true; } };
  assert.equal(environment.checkBoneMaskDecoyInteraction(owner, null, null, manager), true);
  assert.equal(boss.hp, 8600); assert.equal(calls.length, 1); assert.deepEqual(calls[0].aim, [0, 2.1, 15]);
  assert.equal(environment.boneMaskDecoy.armedRemaining, 16);
  assert.ok(lasers.every(beam => beam.visible && beam.scale.y > 0));
  material.dispose(); geometry.dispose();
});

test('the origin of another biome cannot grant Prey mud camouflage without an actual mud basin', () => {
  const environment = new EnvironmentManager(new THREE.Scene()), coatings = [];
  const owner = { hp: 850, position: new THREE.Vector3(), applyPreyMudCamouflage: seconds => coatings.push(seconds) };
  environment.updateLevelDesignV56(1 / 60, owner); assert.deepEqual(coatings, []);
  environment.preyMudSinkhole = { pos: new THREE.Vector3(20, 0, 10), radius: 5.5 };
  environment.updateLevelDesignV56(1 / 60, owner); assert.deepEqual(coatings, []);
  owner.position.set(20, 0, 10); environment.updateLevelDesignV56(1 / 60, owner); assert.deepEqual(coatings, [30]);
  environment.preyMudSinkhole = null; environment.updateLevelDesignV56(1 / 60, owner); assert.deepEqual(coatings, [30]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { CombatDirector } from '../js/engine/CombatDirector.js';
import { BattlefieldMission } from '../js/engine/BattlefieldMission.js';
import { createBattlefieldLayout } from '../js/data/BattlefieldLayouts.js';

const audio = new Proxy({}, { get: () => () => {} });
class CheapHorde extends XenomorphHorde {
  createAlienMesh() { return new THREE.Group(); }
  createChestbursterMesh() { return new THREE.Group(); }
  spawnOvimorphEggs() {}
}
const player = () => ({ hp: 1000, position: new THREE.Vector3(), takeDamage() {}, audioEngine: audio, triggerFacehuggerLatch() {} });

function withRandom(value, action) {
  const original = Math.random;
  try { Math.random = () => value; return action(); }
  finally { Math.random = original; }
}

test('a relay response adds delayed squads while preserving defenders, previous progress and simulation grace', () => {
  const horde = new CheapHorde(new THREE.Scene(), audio), p = player();
  horde.combatDirector = new CombatDirector({ graceSeconds: 0 });
  horde.spawnPositionProvider = () => new THREE.Vector3(40, 0, 0);
  horde.spawnWave(10, p.position);
  horde.deadCount = 17;
  const defenders = [...horde.aliens], priorQueue = horde.pendingSpawnCount;
  horde.spawnTimer = 0.01;
  assert.equal(horde.enqueueReinforcements(12), 12);
  assert.deepEqual(horde.aliens, defenders, 'activation neither despawns nor creates an immediate enemy');
  assert.equal(horde.pendingSpawnCount, priorQueue + 12);
  assert.equal(horde.deadCount, 17);
  assert.equal(horde.spawnSequence, 6, 'the existing encounter sequence and introductions are not restarted');
  assert.equal(horde.spawnTimer, 3);
  for (let frame = 0; frame < 29; frame++) { horde.combatDirector.update(0.1, [p]); horde.update(0.1, p); }
  assert.equal(horde.aliens.length, 6, 'a full telegraph remains before the next batch');
  for (let frame = 0; frame < 2; frame++) { horde.combatDirector.update(0.1, [p]); horde.update(0.1, p); }
  assert.equal(horde.aliens.length, 10, 'the existing four-at-a-time cadence handles reinforcements');
  assert.equal(horde.pendingSpawnCount, priorQueue + 8);
  horde.clearWave();
});

test('relay queues stay bounded, retain unsafe pending spawns and can be cancelled without late enemies', () => {
  const scene = new THREE.Scene(), horde = new CheapHorde(scene, audio), p = player();
  horde.combatDirector = new CombatDirector({ graceSeconds: 2 });
  horde.spawnPositionProvider = () => null;
  assert.equal(horde.enqueueReinforcements(250), 200);
  assert.equal(horde.enqueueReinforcements(1), 0);
  for (const count of [0, -1, NaN, Infinity, 'invalid']) assert.equal(horde.enqueueReinforcements(count), 0);
  for (let frame = 0; frame < 60; frame++) { horde.combatDirector.update(0.1, [p]); horde.update(0.1, p); }
  assert.equal(horde.aliens.length, 0);
  assert.equal(horde.pendingSpawnCount, 200, 'an unsafe provider never consumes requested reinforcements');
  assert.equal(horde.cancelPendingSpawns(), 200);
  horde.spawnPositionProvider = () => new THREE.Vector3(40, 0, 0);
  horde.update(20, p);
  assert.equal(horde.remainingCount, 0);
  horde.clearWave();
  assert.equal(scene.children.length, 0);
});

test('actual horde deaths earn the relay defense gate while progressive reinforcements never replace its encounter', () => {
  const scene = new THREE.Scene(), horde = new CheapHorde(scene, audio), p = player();
  horde.combatDirector = new CombatDirector({ graceSeconds: 0 });
  const layout = createBattlefieldLayout({ id: 'test', environmentType: 'forest' }), opened = [];
  const environment = {
    battlefieldLayout: layout, setActiveSector() {}, completeSector() {}, openGate(id) { opened.push(id); },
    getSpawnPoint(id, index, position) { return position.clone().add(new THREE.Vector3(34 + index % 4, 0, 0)); }
  };
  const mission = new BattlefieldMission({ environment, horde, bosses: {}, level: {} });
  // Shorten the earlier objectives; the relay itself uses real horde damage,
  // death callbacks, delayed queues and gate opening rather than state edits.
  for (const sector of layout.sectors.slice(0, 2)) {
    p.position.set(sector.center[0], 0, sector.center[1]); mission.update([p]);
    mission.progression.recordKill({ sectorId: sector.id, count: sector.objective.target, kind: sector.objective.type === 'commander' ? 'commander' : 'regular' });
    mission.update([p]);
  }
  const relay = layout.sectors[2]; p.position.set(relay.objective.position[0], 0, relay.objective.position[1]); mission.update([p]);
  assert.equal(horde.aliens.length, 6);
  horde.checkMeleeHits({ origin: p.position, radius: 200, damage: 1_000_000 });
  mission.update([p]);
  assert.equal(mission.progression.currentState.defenseKills, 0);
  const before = horde.deadCount;
  assert.equal(mission.interact(p), true);
  assert.equal(opened.length, 2);
  for (let batch = 0; !mission.progression.currentState.completed && batch < 10; batch++) {
    for (let frame = 0; frame < 31; frame++) { horde.combatDirector.update(0.1, [p]); horde.update(0.1, p); mission.update([p]); }
    assert.ok(horde.aliens.length <= 4, 'the counter-attack arrives through four-enemy batches');
    horde.checkMeleeHits({ origin: p.position, radius: 200, damage: 1_000_000 });
    mission.update([p]);
  }
  assert.equal(mission.progression.currentState.completed, true);
  assert.equal(mission.progression.currentState.defenseKills, relay.objective.defenseTarget);
  assert.ok(horde.deadCount - before >= relay.objective.defenseTarget, 'one blast may also kill spawned chestbursters after the capped objective is secured');
  assert.equal(opened.length, 3);
  assert.equal(horde.pendingSpawnCount, 0);
  mission.dispose(); horde.clearWave();
  assert.equal(scene.children.length, 0);
});

test('an exhausted relay stays completable when every ordinary post-introduction spawn rolls facehugger', () => {
  const scene = new THREE.Scene(), horde = new CheapHorde(scene, audio), p = player();
  horde.combatDirector = new CombatDirector({ graceSeconds: 0 });
  const original = createBattlefieldLayout({ id: 'facehugger-regression', environmentType: 'station' });
  const relay = original.sectors[2], next = original.sectors[3], gate = original.gates[2];
  // Start a real two-room mission at the relay, without editing objective state
  // or synthesizing any death notification to skip unrelated encounters.
  const layout = { ...original, entrySectorId: relay.id, sectors: [relay, next],
    gates: [gate], corridors: [original.corridors[2]] };
  const opened = [], defeats = [];
  horde.onDefeated = record => defeats.push(record);
  const environment = {
    battlefieldLayout: layout, setActiveSector() {}, completeSector() {}, openGate(id) { opened.push(id); },
    getSpawnPoint(id, index, position) { return position.clone().add(new THREE.Vector3(34 + index % 4, 0, 0)); }
  };
  const mission = new BattlefieldMission({ environment, horde, bosses: {}, level: {} });
  p.position.set(relay.objective.position[0], 0, relay.objective.position[1]);
  const advance = delta => withRandom(0, () => {
    horde.combatDirector.update(delta, [p]); horde.update(delta, p); mission.update([p]);
  });
  const eliminateSquad = () => withRandom(0.99, () => {
    const hits = horde.checkMeleeHits({ origin: p.position, radius: 200, damage: 1_000_000 });
    assert.ok(hits.length > 0);
    assert.ok(hits.every(hit => hit.killed));
    mission.update([p]);
  });
  try {
    withRandom(0, () => mission.update([p]));
    eliminateSquad();
    let ordinaryFacehuggers = 0;
    while (horde.pendingSpawnCount) {
      advance(3.01);
      ordinaryFacehuggers += horde.aliens.filter(enemy => enemy.type === 'facehugger').length;
      eliminateSquad();
    }
    assert.equal(ordinaryFacehuggers, 8, 'the ordinary wave still permits every eligible regular to become a facehugger');
    assert.equal(horde.remainingCount, 0, 'all original defenders really died before activation');
    assert.equal(defeats.length, relay.recommendedEnemies);
    assert.equal(mission.progression.currentState.defenseKills, 0, 'pre-activation deaths never satisfy the defense');
    assert.equal(opened.length, 0);
    const before = defeats.length;
    assert.equal(mission.interact(p), true);
    assert.equal(horde.aliens.length, 0, 'activation creates no immediate flood');
    assert.equal(horde.pendingSpawnCount, relay.objective.defenseTarget + 4);
    for (let batch = 0; batch < relay.objective.defenseTarget / 4; batch++) {
      advance(2.99);
      assert.equal(horde.aliens.length, 0, 'each squad waits three simulation seconds');
      advance(0.02);
      assert.equal(horde.aliens.length, 4, 'exactly four reinforcements arrive in a batch');
      assert.ok(horde.aliens.every(enemy => enemy.type !== 'facehugger'), 'even a forced successful latch roll cannot consume quota reinforcements');
      eliminateSquad();
      assert.equal(mission.progression.currentState.defenseKills, (batch + 1) * 4);
    }
    assert.equal(defeats.length - before, relay.objective.defenseTarget, 'only real melee deaths earned the post-activation quota');
    assert.equal(mission.progression.currentState.completed, true);
    assert.equal(mission.progression.isGateOpen(gate.id), true);
    assert.deepEqual(opened, [gate.id]);
    assert.equal(horde.pendingSpawnCount, 0, 'securing the relay cancels the unused safety squad');
    advance(20);
    assert.equal(horde.remainingCount, 0, 'cancelled reinforcements cannot appear later');
  } finally { mission.dispose(); horde.clearWave(); }
  assert.equal(scene.children.length, 0);
});

function finiteMission(sectorIndex = 0) {
  const scene = new THREE.Scene(), horde = new CheapHorde(scene, audio), p = player();
  horde.combatDirector = new CombatDirector({ graceSeconds: 0 });
  const original = createBattlefieldLayout({ id: 'finite-recovery', environmentType: 'forest' });
  const [sector, next] = original.sectors.slice(sectorIndex, sectorIndex + 2), gate = original.gates[sectorIndex];
  const layout = { ...original, entrySectorId: sector.id, sectors: [sector, next],
    gates: [gate], corridors: [original.corridors[sectorIndex]] };
  const opened = [], defeats = [], requests = [];
  horde.onDefeated = record => defeats.push(record);
  const enqueue = horde.enqueueReinforcements.bind(horde);
  horde.enqueueReinforcements = count => { requests.push(count); return enqueue(count); };
  const environment = {
    battlefieldLayout: layout, setActiveSector() {}, completeSector() {}, openGate(id) { opened.push(id); },
    getSpawnPoint(id, index, position) {
      return position.clone().add(new THREE.Vector3(Math.cos(index) * 34, 0, Math.sin(index) * 34));
    }
  };
  p.position.set(sector.center[0], 0, sector.center[1]);
  const mission = new BattlefieldMission({ environment, horde, bosses: {}, level: {} });
  return { scene, horde, p, sector, gate, opened, defeats, requests, mission };
}

test('consumed ordinary facehuggers replenish only the missing kill quota, without fake deaths or immediate pressure', () => {
  const { scene, horde, p, sector, gate, opened, defeats, requests, mission } = finiteMission();
  let latches = 0;
  // The player fixture completes each latch QTE immediately. Enemy movement,
  // attack permissions, windups, consumption and disposal remain real.
  p.triggerFacehuggerLatch = () => { latches++; };
  const damage = origin => withRandom(0.99, () => horde.checkMeleeHits({ origin, radius: 0, damage: 1_000_000 }));
  const advance = delta => withRandom(0, () => {
    horde.combatDirector.update(delta, [p]); horde.update(delta, p);
  });
  try {
    withRandom(0, () => mission.update([p]));
    for (const enemy of [...horde.aliens]) damage(enemy.mesh.position.clone());
    assert.equal(defeats.length, 6, 'the six introductory enemies die through real melee');
    mission.update([p]);
    for (let frame = 0; frame < 1000 && horde.remainingCount; frame++) {
      advance(0.1);
      // Kill only the two non-consumable special enemies when they arrive.
      for (const enemy of horde.aliens.filter(enemy => enemy.type !== 'facehugger')) damage(enemy.mesh.position.clone());
      if (horde.remainingCount) mission.update([p]);
    }
    assert.equal(latches, 10, 'all ten eligible ordinary enemies were actually consumed by latching');
    assert.equal(horde.remainingCount, 0);
    assert.equal(defeats.length, 8, 'a consumed facehugger grants no fabricated defeat');
    assert.equal(mission.progression.currentState.kills, 8);
    assert.deepEqual(requests, [], 'remaining enemies or pending squads suppress recovery');
    assert.equal(opened.length, 0);

    p.hp = 0; mission.update([p]);
    assert.deepEqual(requests, [], 'a dead hunter cannot schedule a replacement attack');
    p.hp = 1000; mission.update([p]);
    const missing = sector.objective.target - defeats.length;
    assert.equal(missing, 4);
    assert.deepEqual(requests, [missing]);
    assert.equal(horde.pendingSpawnCount, missing, 'only the actual deficit is queued');
    assert.equal(horde.aliens.length, 0);
    assert.equal(mission.progression.currentState.kills, 8);
    const timer = horde.spawnTimer, time = horde.combatDirector.time;
    for (let iteration = 0; iteration < 20; iteration++) { advance(0); mission.update([p]); }
    assert.equal(horde.spawnTimer, timer, 'without simulation time the queued response stays paused');
    assert.equal(horde.combatDirector.time, time);
    assert.deepEqual(requests, [missing], 'repeated objective updates do not multiply the queue');
    advance(2.99); mission.update([p]);
    assert.equal(horde.aliens.length, 0);
    advance(0.02); mission.update([p]);
    assert.equal(horde.aliens.length, missing);
    assert.ok(horde.aliens.every(enemy => enemy.type !== 'facehugger'));
    for (const enemy of [...horde.aliens]) damage(enemy.mesh.position.clone());
    mission.update([p]);
    assert.equal(defeats.length, sector.objective.target, 'real replacement kills alone finish the quota');
    assert.equal(mission.progression.currentState.completed, true);
    assert.equal(mission.progression.isGateOpen(gate.id), true);
    assert.deepEqual(opened, [gate.id]);
    assert.deepEqual(requests, [missing]);
  } finally { mission.dispose(); horde.clearWave(); }
  assert.equal(scene.children.length, 0);
});

for (const [sectorIndex, name] of [[1, 'commander'], [2, 'unactivated relay']]) {
  test(`an exhausted ${name} cannot be replaced by an ordinary kill-quota recovery`, () => {
    const { scene, horde, p, opened, requests, mission } = finiteMission(sectorIndex);
    try {
      withRandom(0, () => mission.update([p]));
      assert.ok(horde.remainingCount > 0);
      horde.clearWave();
      for (let iteration = 0; iteration < 5; iteration++) mission.update([p]);
      assert.deepEqual(requests, []);
      assert.equal(horde.remainingCount, 0);
      assert.equal(mission.progression.currentState.completed, false);
      assert.equal(opened.length, 0);
    } finally { mission.dispose(); horde.clearWave(); }
    assert.equal(scene.children.length, 0);
  });
}

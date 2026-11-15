import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CombatDirector } from '../js/engine/CombatDirector.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';

const audio = new Proxy({}, { get: () => () => {} });
function fighter(position = new THREE.Vector3()) {
  return { position, hp: 1000, audioEngine: audio, takeDamage(amount) { this.hp -= amount; },
    triggerFacehuggerLatch() { this.isFacehuggerLatched = true; } };
}

test('crowds share one telegraphed attack turn per player and cannot hit during insertion grace', () => {
  const director = new CombatDirector({ graceSeconds: 7 });
  const player = fighter(), crowd = Array.from({ length: 32 }, () => ({}));
  const impacts = [];
  for (let frame = 0; frame < 900; frame++) {
    director.update(1 / 60, [player]);
    let windups = 0;
    for (const attacker of crowd) {
      if (director.requestAttack(attacker, player)) impacts.push(director.time);
      if (director.getAttackState(attacker)?.phase === 'windup') windups++;
    }
    assert.ok(windups <= 1, 'different enemy managers must share their preparation quota');
    if (director.time < 7) assert.equal(impacts.length, 0);
  }
  assert.ok(impacts.length >= 3, 'attack turns resume after protection; this is not invulnerability');
  assert.ok(impacts[0] >= 7.65, 'the first attack needs its full visible preparation after grace');
  for (let i = 1; i < impacts.length; i++) assert.ok(impacts[i] - impacts[i - 1] >= 0.7 - 1e-9);
});

test('engagement and acid pressure are bounded per living cooperative target; cleanup releases turns', () => {
  const director = new CombatDirector({ graceSeconds: 0 });
  const p1 = fighter(), p2 = fighter(new THREE.Vector3(20, 0, 0));
  director.update(0, [p1, p2]);
  const enemies = Array.from({ length: 12 }, () => ({}));
  assert.equal(enemies.filter(enemy => director.canEngage(enemy, p1)).length, 3);
  assert.equal(enemies.filter(enemy => director.canEngage(enemy, p2)).length, 3);
  assert.equal(director.selectTarget(new THREE.Vector3(19, 0, 0)), p2);
  director.requestAttack(enemies[0], p1);
  director.requestAttack(enemies[1], p2);
  assert.equal(director.getAttackState(enemies[0]).target, p1);
  assert.equal(director.getAttackState(enemies[1]).target, p2);
  for (let i = 0; i < 20; i++) director.applyHazardDamage({}, p1, 18);
  assert.equal(p1.hp, 988, 'twenty overlapping droplets share the same12HP initial acid budget');
  assert.equal(p2.hp, 1000);
  director.update(1, [p1, p2]);
  for (let i = 0; i < 20; i++) director.applyHazardDamage({}, p1, 18);
  assert.equal(p1.hp, 976, 'the whole field recharges12HP per second rather than per pool');
  director.release(enemies[0]);
  assert.equal(director.getAttackState(enemies[0]), null);
  director.reset();
  assert.equal(director.isInGrace, true);
  assert.equal(director.attacks.size, 0);
  assert.equal(director.engagements.size, 0);
});

class CheapHorde extends XenomorphHorde {
  createAlienMesh() { return new THREE.Group(); }
  spawnOvimorphEggs() {}
}

test('an introductory warrior stays reachable on the ground even when the stalker roll would succeed', () => {
  const horde = new CheapHorde(new THREE.Scene(), audio);
  horde.combatDirector = new CombatDirector();
  const random = Math.random;
  let calls = 0;
  try {
    Math.random = () => ++calls === 1 ? 0.9 : 0.1;
    horde._spawnRegular(new THREE.Vector3(34, 0, 0));
  } finally { Math.random = random; }
  assert.equal(horde.aliens[0].type, 'warrior');
  assert.equal(horde.aliens[0].isWallStalker, false);
  assert.equal(horde.aliens[0].wallClimbPhase, 'grounded');
  horde.clearWave();
});

test('simulation batches preserve the complete wave and never consume a queued spawn without a safe sector point', () => {
  const scene = new THREE.Scene(), player = fighter();
  const horde = new CheapHorde(scene, audio);
  horde.combatDirector = new CombatDirector({ graceSeconds: 7 });
  horde.spawnPositionProvider = () => new THREE.Vector3(36, 0, 0);
  horde.spawnWave(18, player.position);
  assert.equal(horde.aliens.length, 6);
  assert.equal(horde.pendingSpawnCount, 12);
  assert.equal(horde.remainingCount, 18);
  assert.ok(horde.aliens.every(enemy => ['warrior', 'runner'].includes(enemy.type)), 'the first squad does not open with latch/kamikaze elites');
  for (let frame = 0; frame < 60; frame++) { horde.combatDirector.update(0.1, [player]); horde.update(0.1, player); }
  assert.equal(horde.aliens.length, 6, 'the insertion grace does not flood additional squads');
  horde.spawnPositionProvider = () => null;
  for (let frame = 0; frame < 50; frame++) { horde.combatDirector.update(0.1, [player]); horde.update(0.1, player); }
  assert.equal(horde.pendingSpawnCount, 12, 'blocked corridors do not silently remove reinforcements');
  horde.spawnPositionProvider = () => new THREE.Vector3(36, 0, 0);
  for (let frame = 0; frame < 31; frame++) { horde.combatDirector.update(0.1, [player]); horde.update(0.1, player); }
  assert.equal(horde.aliens.length, 10);
  assert.equal(horde.pendingSpawnCount, 8);
  assert.equal(horde.cancelPendingSpawns(), 8);
  assert.equal(horde.remainingCount, 10);
  horde.clearWave();
  horde.update(20, player);
  assert.equal(horde.remainingCount, 0);
  assert.equal(scene.children.length, 0, 'late reinforcements and warning rings cannot survive cleanup');
});

test('real horde callbacks report each defeat once and distinguish the objective commander', () => {
  const horde = new CheapHorde(new THREE.Scene(), audio), events = [];
  horde.onDefeated = event => events.push(event);
  const commander = { mesh: new THREE.Group(), type: 'officer', isOfficer: true, objectiveCommander: true };
  commander.mesh.position.set(4, 0, 8);
  horde.recordDefeat(commander); horde.recordDefeat(commander);
  assert.equal(horde.deadCount, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'commander');
  assert.deepEqual(events[0].position.toArray(), [4, 0, 8]);
  commander.mesh.position.x = 20;
  assert.equal(events[0].position.x, 4, 'objective events retain their death location');
});

test('a real horde update protects both hunters from stacked acid, contact and latch during startup', () => {
  const horde = new CheapHorde(new THREE.Scene(), audio);
  const p1 = fighter(new THREE.Vector3(30, 0, 0)), p2 = fighter();
  horde.combatDirector = new CombatDirector({ graceSeconds: 2 });
  for (let index = 0; index < 24; index++) {
    const mesh = new THREE.Group(); mesh.position.set(index % 2 * 0.1, 0, index % 3 * 0.1); horde.scene.add(mesh);
    horde.aliens.push({ mesh, type: index === 0 ? 'facehugger' : 'warrior', pressureId: index,
      hp: 120, maxHp: 120, damage: 25, speed: 11, radius: 1 });
  }
  for (let index = 0; index < 20; index++) {
    const mesh = new THREE.Group(); horde.scene.add(mesh);
    horde.acidPools.push({ mesh, life: 10 });
  }
  const burster = new THREE.Group(); horde.scene.add(burster);
  horde.chestbursters.push({ mesh: burster, hp: 30, speed: 20, damage: 12 });
  for (let frame = 0; frame < 19; frame++) {
    horde.combatDirector.update(0.1, [p1, p2]); horde.update(0.1, p1, p2);
    assert.equal(p1.hp, 1000); assert.equal(p2.hp, 1000);
    assert.equal(p2.isFacehuggerLatched, undefined);
  }
  for (let frame = 0; frame < 12; frame++) { horde.combatDirector.update(0.1, [p1, p2]); horde.update(0.1, p1, p2); }
  assert.equal(p1.hp, 1000, 'the distant first player must not receive player2 contact hazards');
  assert.ok(p2.hp < 1000, 'pressure becomes dangerous after the opening window');
  assert.ok(p2.hp > 940, `overlapping acid and one attack turn must remain bounded: ${p2.hp}`);
  assert.ok(horde.attackCues.size <= 2, 'a crowd cannot display dozens of simultaneous actual windups');
  horde.clearWave();
  assert.equal(horde.scene.children.length, 0);
});

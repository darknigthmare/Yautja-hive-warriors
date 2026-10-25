import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CombatDirector } from '../js/engine/CombatDirector.js';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';
import { SyntheticsManager } from '../js/entities/Synthetics.js';
import { BossManager } from '../js/entities/Bosses.js';
import { BadBloodManager } from '../js/entities/BadBloodEncounter.js';

const audio = new Proxy({}, { get: () => () => {} });
class Marines extends ColonialMarinesManager {
  createMarineMesh() { return new THREE.Group(); }
  createSentryGunMesh() { return new THREE.Group(); }
}
class Synthetics extends SyntheticsManager { createSyntheticMesh() { return new THREE.Group(); } }
class Boss extends BossManager { createBossMesh() { return new THREE.Group(); } }
class BadBlood extends BadBloodManager { createBadBloodMesh() { return new THREE.Group(); } }
const horde = () => ({ aliens: [], checkMeleeHits() {}, spawnChestburster() {} });
const player = (position = new THREE.Vector3()) => ({ position, hp: 10000, mesh: new THREE.Group(), audioEngine: audio, plasmaEnergy: 100,
  hits: [], takeDamage(amount) { this.hp -= amount; this.hits.push(amount); } });

function battle() {
  const scene = new THREE.Scene(), director = new CombatDirector({ graceSeconds: 7 });
  const marine = new Marines(scene, audio), synthetic = new Synthetics(scene, audio), boss = new Boss(scene, audio), rogue = new BadBlood(scene, audio);
  marine.spawnSquad(new THREE.Vector3(), 2); synthetic.spawnSquad(new THREE.Vector3(), 3);
  boss.spawnBoss('xenomorph_queen', new THREE.Vector3(3, 0, 0)); rogue.spawnAmbush(new THREE.Vector3());
  for (const manager of [marine, synthetic, boss, rogue]) manager.combatDirector = director;
  for (const actor of [...marine.marines, ...synthetic.androids, boss.activeBoss, rogue.badBlood]) actor.mesh.position.set(3, 0, 0);
  const p = player(), enemies = horde();
  return { scene, director, marine, synthetic, boss, rogue, p, enemies,
    update(delta) { director.update(delta, [p]); marine.update(delta, p, enemies); synthetic.update(delta, p, enemies); boss.update(delta, p, enemies); rogue.update(delta, p); },
    clear() { marine.clearSquad(); synthetic.clearSquad(); boss.clear(); rogue.clear(); } };
}

test('all hostile factions share startup grace and one prepared attack turn; cleanup releases every marker and reservation', () => {
  const b = battle();
  try {
    for (let frame = 0; frame < 600; frame++) {
      b.update(1 / 100);
      assert.equal(b.p.hits.length, 0, 'six seconds of close body contact must not hurt before preparation/grace');
    }
    let observedWarning = false, firstHitAt = null;
    for (let frame = 0; frame < 1800; frame++) {
      const before = b.p.hits.length; b.update(1 / 100);
      const warnings = [...b.synthetic.androids, b.boss.activeBoss, b.rogue.badBlood].filter(Boolean).filter(actor => actor.mesh.userData.attackTelegraph);
      assert.ok(warnings.length <= 1, 'a single player must never face simultaneous faction windups');
      if (warnings.length) observedWarning = true;
      if (b.p.hits.length > before) {
        firstHitAt ??= b.director.time;
        assert.ok(observedWarning, 'a readable warning must precede actual damage');
        assert.equal(b.p.hits.length - before, 1, 'no damage stack in the same simulation step');
      }
    }
    assert.ok(firstHitAt >= 7.35, `startup and actual preparation must precede the first hit: ${firstHitAt}`);
    assert.ok(b.p.hits.length > 0, 'hostiles remain dangerous after the safe opening');
    assert.ok(b.p.hits.length < 20, 'crowd size does not multiply damage into a contact flood');
  } finally { b.clear(); }
  assert.equal(b.director.attacks.size, 0);
  assert.equal(b.scene.children.length, 0);
});

test('USCM holds cover when the hive is gone and only fires on actual hive targets by default', () => {
  const manager = new Marines(new THREE.Scene(), audio), p = player(), enemies = horde();
  manager.spawnSquad(new THREE.Vector3(), 4);
  for (const marine of manager.marines) marine.mesh.position.set(3, 0, 0);
  for (let frame = 0; frame < 600; frame++) manager.update(1 / 60, p, enemies);
  assert.equal(p.hits.length, 0, 'support soldiers that cannot be attacked must never secretly target the player');
  const alien = { mesh: new THREE.Group(), hp: 100000 }; alien.mesh.position.set(4, 0, 0); enemies.aliens.push(alien);
  for (let frame = 0; frame < 600; frame++) manager.update(1 / 60, p, enemies);
  assert.ok(alien.hp < 100000);
  assert.equal(p.hits.length, 0);
  manager.clearSquad();
});

function standaloneShots(dt) {
  const manager = new Marines(new THREE.Scene(), audio), p = player(), enemies = horde();
  manager.hostileToPlayers = true; manager.spawnSquad(new THREE.Vector3(), 1);
  const marine = manager.marines[0]; marine.mesh.position.set(3, 0, 0); marine.grenadeCooldown = 1000;
  for (let frame = 0; frame < Math.round(10 / dt); frame++) manager.update(dt, p, enemies);
  manager.clearSquad(); return p.hits;
}

test('faction fire cadence uses simulation seconds and stays bounded at10fps,60fps and120fps', () => {
  const slow = standaloneShots(0.1), regular = standaloneShots(1 / 60), fast = standaloneShots(1 / 120);
  assert.ok(regular.length >= 3 && regular.length <= 5);
  assert.ok(Math.abs(slow.length - regular.length) <= 1);
  assert.ok(Math.abs(fast.length - regular.length) <= 1);
  for (const shots of [slow, regular, fast]) assert.ok(shots.reduce((a, b) => a + b, 0) < 60, 'rendering more frames must not multiply DPS');
});

test('cooperative hostile targeting chooses the nearest living player and transfers a winding attack after death', () => {
  const manager = new Synthetics(new THREE.Scene(), audio), director = new CombatDirector({ graceSeconds: 0 });
  manager.combatDirector = director; manager.spawnSquad(new THREE.Vector3(), 1);
  manager.androids[0].mesh.position.set(0, 0, 0); manager.androids[0].shootCooldown = 0;
  const far = player(new THREE.Vector3(10, 0, 0)), near = player(new THREE.Vector3(1, 0, 0)), enemies = horde();
  for (let frame = 0; frame < 120; frame++) { director.update(1 / 60, [far, near]); manager.update(1 / 60, far, enemies); }
  assert.equal(far.hits.length, 0); assert.equal(near.hits.length, 1);
  near.hp = 0;
  for (let frame = 0; frame < 300; frame++) { director.update(1 / 60, [far]); manager.update(1 / 60, far, enemies); }
  assert.ok(far.hits.length > 0, 'a surviving partner remains a valid target');
  manager.clearSquad(); assert.equal(director.attacks.size, 0);
});

test('boss embryo volley cannot apply three stacked hits to one player in one frame', () => {
  const manager = new Boss(new THREE.Scene(), audio), p = player(), enemies = horde();
  manager.spawnBoss('predalien_queen', new THREE.Vector3(20, 0, 0)); manager.regurgitateChestbursters(p, enemies);
  for (const projectile of manager.embryoProjectiles) { projectile.mesh.position.copy(p.position); projectile.velocity.set(0, 0, 0); }
  manager.update(0, p, enemies);
  assert.deepEqual(p.hits, [60]);
  manager.clear();
});

test('preparation warning stays on the visible combat plane for scaled and vertically animated actors', () => {
  const manager = new Synthetics(new THREE.Scene(), audio), director = new CombatDirector({ graceSeconds: 0 });
  manager.combatDirector = director; manager.spawnSquad(new THREE.Vector3(), 1);
  const syn = manager.androids[0]; syn.mesh.position.set(0, 0.2, 0); syn.mesh.scale.setScalar(2); syn.shootCooldown = 0;
  const p = player(new THREE.Vector3(1, 0, 0)); director.update(0, [p]); manager.update(0, p, horde());
  const warning = syn.attackWarning; assert.ok(warning?.visible);
  assert.ok(Math.abs(warning.getWorldPosition(new THREE.Vector3()).y - 0.035) < 1e-8);
  manager.clearSquad(); assert.equal(director.attacks.size, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BossManager } from '../js/entities/Bosses.js';
import { BOSS_REGISTRY } from '../js/data/BossRegistry.js';

// These tests exercise the production combat manager, not its visual builders.
// A stripped mesh keeps the suite about damage/trajectory/resource rules;
// neither film fidelity, camera readability nor human reaction is certified.
class CombatManager extends BossManager { createBossMesh() { return new THREE.Group(); } }
const audio = new Proxy({}, { get: () => () => {} });
const player = (x = 0, y = 0, z = 8) => ({
  hp: 10000, position: new THREE.Vector3(x, y, z), mesh: new THREE.Group(),
  radius: 1, plasmaEnergy: 100, hits: [],
  takeDamage(amount, acid, attacker, context) {
    this.hp -= amount; this.hits.push({ amount, acid, ...context });
  }
});
function fixture(type, run) {
  const manager = new CombatManager(new THREE.Scene(), audio);
  manager.spawnBoss(type, new THREE.Vector3());
  try { return run(manager, manager.activeBoss); }
  finally {
    manager.clear();
    assert.equal(manager.scene.children.length, 0);
    for (const key of ['pendingActions', 'pendingHatches', 'weaponProjectiles', 'effects']) assert.equal(manager[key].length, 0);
  }
}
function tick(manager, target, seconds, horde = null) {
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) manager.update(1 / 60, target, horde);
}
function prepare(manager, target, action, horde = null) {
  const boss = manager.activeBoss;
  for (const key of ['tailWhipCooldown', 'specialCooldown', 'regurgitateCooldown', 'shriekCooldown', 'spitCooldown', 'contactCooldown']) boss[key] = 999;
  const key = ({ tail: 'tailWhipCooldown', embryos: 'regurgitateCooldown', shriek: 'shriekCooldown', plasma: 'spitCooldown', disc: 'spitCooldown', bolt: 'spitCooldown' })[action] ?? 'specialCooldown';
  boss[key] = 0;
  manager.update(1 / 60, target, horde);
  assert.equal(boss.pressureAction, action, `the real selector must prepare ${action}`);
  assert.equal(manager.getEncounterReadout().preparing, true);
  assert.ok(boss.attackWarning?.visible, 'a combat preparation must expose its warning');
  return boss;
}
function stopAI(boss) { boss.isStunned = true; boss.stunTimer = 30; }
function releasePrepared(manager, target, horde = null) {
  for (let frame = 0; frame < 100 && manager.activeBoss.pressureAction; frame++) manager.update(1 / 60, target, horde);
  assert.equal(manager.activeBoss.pressureAction, null);
}
function leapTrial(type, dodge) {
  return fixture(type, (manager, boss) => {
    const target = player(0, 0, 12); prepare(manager, target, 'leap');
    const aim = boss.pressureAim.clone();
    if (dodge) target.position.x = 12;
    releasePrepared(manager, target);
    assert.equal(boss.charge?.kind, 'leap');
    assert.ok(boss.charge.direction.distanceTo(aim.clone().normalize()) < 1e-8, 'the leap keeps its warned direction');
    manager.update(.25, target); assert.ok(boss.mesh.position.y > 1);
    tick(manager, target, .65);
    assert.equal(boss.charge, null); assert.equal(boss.mesh.position.y, 0);
    assert.ok(boss.exposedUntil > manager.time, 'landing grants a bounded recovery');
    return target.hits.reduce((sum, hit) => sum + hit.amount, 0);
  });
}

const cases = [
  ['xenomorph_queen', 'circular-tail', () => fixture('xenomorph_queen', manager => {
    const grounded = player(0, 0, 4), jumped = player(0, 1.3, 4);
    manager.triggerTailWhip(grounded); manager.triggerTailWhip(jumped);
    assert.equal(grounded.hits[0].amount, 100); assert.equal(jumped.hits.length, 0);
  })],
  ['praetorian', 'frontal-carapace', () => fixture('praetorian', (manager, boss) => {
    const hp = boss.hp; manager.takeDamage(100, null, { origin: new THREE.Vector3(0, 0, 4) });
    const frontal = hp - boss.hp, beforeFlank = boss.hp;
    manager.takeDamage(100, null, { origin: new THREE.Vector3(4, 0, 0) });
    assert.equal(frontal, 45); assert.equal(beforeFlank - boss.hp, 100);
  })],
  ['predalien', 'frontal-tail-pounce', () => {
    for (const [dodge, expected] of [[false, 100], [true, 0]]) fixture('predalien', manager => {
      const target = player(0, 0, 4); prepare(manager, target, 'tail');
      if (dodge) target.position.set(4, 0, 0);
      releasePrepared(manager, target);
      assert.equal(target.hits.reduce((sum, hit) => sum + hit.amount, 0), expected);
    });
  }],
  ['predalien_queen', 'interruptible-brood', () => {
    for (const heavy of [false, true]) fixture('predalien_queen', (manager, boss) => {
      let births = 0; const horde = { spawnChestburster() { births++; } }, target = player(0, 0, 12);
      prepare(manager, target, 'embryos', horde);
      manager.takeDamage(100, null, { attackKind: heavy ? 'heavy' : 'melee' });
      assert.equal(boss.isStunned, heavy); tick(manager, target, 1.9, horde);
      assert.equal(births, heavy ? 0 : 1); assert.equal(boss.broodAllowance, heavy ? 6 : 5);
    });
  }],
  ['imperial_queen', 'annular-aftershock', () => {
    for (const [returnInside, expected] of [[false, 65], [true, 0]]) fixture('imperial_queen', (manager, boss) => {
      const target = player(0, 0, 11); stopAI(boss); manager.triggerMatriarchRoyalSlam(target);
      assert.equal(target.hits.length, 0, 'the initial radius does not reach the outer annulus');
      if (returnInside) target.position.z = 4;
      tick(manager, target, .9);
      assert.equal(target.hits.reduce((sum, hit) => sum + hit.amount, 0), expected);
    });
  }],
  ['empress_matriarch', 'directional-gale', () => {
    for (const [dodge, expected] of [[false, 65], [true, 0]]) fixture('empress_matriarch', manager => {
      const target = player(0, 0, 8); prepare(manager, target, 'gale');
      if (dodge) target.position.set(8, 0, 0);
      releasePrepared(manager, target);
      assert.equal(target.hits.reduce((sum, hit) => sum + hit.amount, 0), expected);
    });
  }],
  ['the_offspring', 'focused-shriek', () => {
    for (const [dodge, hpLoss, energy] of [[false, 60, 75], [true, 0, 100]]) fixture('the_offspring', manager => {
      const target = player(0, 0, 8); prepare(manager, target, 'shriek');
      if (dodge) target.position.set(8, 0, 0);
      releasePrepared(manager, target);
      assert.equal(10000 - target.hp, hpLoss); assert.equal(target.plasmaEnergy, energy);
    });
  }],
  ['predalien_abomination', 'brood-pounce', () => {
    assert.equal(leapTrial('predalien_abomination', false), 70);
    assert.equal(leapTrial('predalien_abomination', true), 0);
    fixture('predalien_abomination', (manager, boss) => {
      let births = 0; const horde = { spawnChestburster() { births++; } };
      for (let i = 0; i < 4; i++) manager.triggerPregnantBurstFrenzy(horde);
      assert.equal(boss.broodAllowance, 0); assert.equal(manager.pendingHatches.length, 6);
      stopAI(boss); tick(manager, player(0, 0, 30), .7, horde); assert.equal(births, 6);
    });
  }],
  ['predalien_matriarch_titan', 'three-seismic-pulses', () => {
    for (const [evacuate, expected] of [[false, 3], [true, 1]]) fixture('predalien_matriarch_titan', (manager, boss) => {
      const target = player(0, 0, 4); stopAI(boss); manager.triggerMatriarchRoyalSlam(target);
      assert.equal(target.hits.length, 1);
      if (evacuate) target.position.z = 16;
      tick(manager, target, 1.4); assert.equal(target.hits.length, expected);
    });
  }],
  ['rogue_king_prime', 'wall-stagger', () => {
    for (const wall of [false, true]) fixture('rogue_king_prime', (manager, boss) => {
      const target = player(0, 0, 15);
      if (wall) manager.environment = { resolveMovement(position) { position.z = Math.min(2, position.z); } };
      prepare(manager, target, 'charge'); releasePrepared(manager, target);
      tick(manager, target, .75);
      assert.equal(boss.isStunned, wall);
      if (wall) { assert.ok(boss.mesh.position.z <= 2); assert.ok(boss.exposedUntil > manager.time); }
      else assert.ok(boss.mesh.position.z > 8);
    });
  }],
  ['awakened_engineer', 'heavy-shield-overload', () => {
    const erosion = heavy => fixture('awakened_engineer', (manager, boss) => {
      manager.takeDamage(boss.maxHp * .4); assert.equal(boss.hasPhaseShield, true);
      const before = boss.phaseShieldHp; manager.takeDamage(100, null, { attackKind: heavy ? 'heavy' : 'melee' });
      return before - boss.phaseShieldHp;
    });
    assert.equal(erosion(false), 60); assert.equal(erosion(true), 120);
    fixture('awakened_engineer', manager => {
      const target = player(0, 0, 8); manager.environment = { hasLineOfSight: () => false };
      manager.triggerEngineerGravitationalVortex(target);
      assert.deepEqual(target.position.toArray(), [0, 0, 8]); assert.equal(target.hits.length, 0);
    });
  }],
  ['trilobite_prime', 'low-constriction', () => fixture('trilobite_prime', manager => {
    const grounded = player(0, 0, 4), jumped = player(0, 1.3, 4), outside = player(0, 0, 6);
    manager.triggerTrilobiteConstrict(grounded); manager.triggerTrilobiteConstrict(jumped); manager.triggerTrilobiteConstrict(outside);
    assert.equal(grounded.hits[0].amount, 65); assert.equal(jumped.hits.length, 0); assert.equal(outside.hits.length, 0);
  })],
  ['berserker_super_predator', 'shared-plasma-burst', () => {
    for (const dodge of [false, true]) fixture('berserker_super_predator', (manager, boss) => {
      const target = player(0, 0, 12); manager.fireBossWeapon(target, 'plasma'); stopAI(boss);
      if (dodge) target.position.x = 10;
      const shots = new Set(manager.weaponProjectiles.map(shot => shot.mesh.uuid));
      for (let i = 0; i < 240; i++) { manager.update(1 / 60, target); for (const shot of manager.weaponProjectiles) shots.add(shot.mesh.uuid); }
      assert.equal(shots.size, 3); assert.equal(target.hits.length, dodge ? 0 : 1);
      if (!dodge) assert.equal(target.hits[0].amount, 60);
    });
  }],
  ['ultimate_upgrade_predator', 'heavy-charge-interrupt', () => {
    for (const heavy of [false, true]) fixture('ultimate_upgrade_predator', (manager, boss) => {
      const target = player(0, 0, 15); prepare(manager, target, 'charge');
      manager.takeDamage(100, null, { attackKind: heavy ? 'heavy' : 'melee' });
      assert.equal(boss.isStunned, heavy); tick(manager, target, 1.4);
      assert.equal(Boolean(boss.charge), !heavy);
      if (heavy) assert.equal(boss.pressureAction, null);
    });
  }],
  ['feral_predator_boss', 'mask-guided-bolt', () => {
    for (const mask of [false, true]) fixture('feral_predator_boss', (manager, boss) => {
      const target = player(15, 0, 0);
      if (mask) { assert.equal(manager.armFeralMaskTrap(new THREE.Vector3(4, 0, 3)), true); assert.equal(boss.hp, boss.maxHp); }
      manager.fireBossWeapon(target, 'bolt'); stopAI(boss);
      tick(manager, target, 1.3);
      assert.equal(boss.maxHp - boss.hp, mask ? 1200 : 0);
      if (mask) assert.equal(target.hits.length, 0); else assert.equal(target.hits.length, 1);
    });
  }],
  ['apex_gladiator_predator', 'landing-aftershock', () => {
    for (const [jump, expected] of [[false, 55], [true, 0]]) fixture('apex_gladiator_predator', (manager, boss) => {
      const target = player(0, 0, 12);
      prepare(manager, target, 'leap'); target.position.x = 12;
      releasePrepared(manager, target);
      assert.equal(boss.charge?.kind, 'leap');
      for (let frame = 0; frame < 60 && boss.charge; frame++) manager.update(1 / 60, target);
      assert.equal(target.hits.length, 0, 'the first lateral dodge avoids the landing itself');
      assert.equal(boss.charge, null); assert.equal(manager.pendingActions.length, 1);
      target.position.copy(boss.mesh.position).add(new THREE.Vector3(0, jump ? 1.3 : 0, 4));
      stopAI(boss); tick(manager, target, .7);
      assert.equal(target.hits.reduce((sum, hit) => sum + hit.amount, 0), expected);
    });
  }],
  ['jungle_hunter_boss', 'laser-committed-plasma', () => {
    for (const dodge of [false, true]) fixture('jungle_hunter_boss', (manager, boss) => {
      const target = player(0, 0, 20); prepare(manager, target, 'plasma');
      const aim = boss.pressureAim.clone(); assert.equal(boss.aimBeam.visible, true);
      if (dodge) target.position.x = 10;
      manager.update(1 / 60, target); assert.deepEqual(boss.pressureAim.toArray(), aim.toArray());
      releasePrepared(manager, target); stopAI(boss); tick(manager, target, 1.8);
      assert.equal(target.hits.length, dodge ? 0 : 1);
    });
  }],
  ['city_hunter_boss', 'returning-disc', () => fixture('city_hunter_boss', (manager, boss) => {
    const target = player(0, 0, 12); manager.fireBossWeapon(target, 'disc'); stopAI(boss);
    let returning = false;
    for (let i = 0; i < 180; i++) { manager.update(1 / 60, target); returning ||= manager.weaponProjectiles.some(shot => shot.returning); }
    assert.equal(returning, true); assert.equal(target.hits.length, 1); assert.equal(target.hits[0].attackKind, 'disc');
    assert.equal(manager.weaponProjectiles.length, 0);
    const avoided = player(0, 0, 12); manager.fireBossWeapon(avoided, 'disc'); avoided.position.x = 10;
    tick(manager, avoided, 3); assert.equal(avoided.hits.length, 0);
  })]
];

test('the counterplay matrix covers every registered encounter exactly once', () => {
  assert.deepEqual(cases.map(([id]) => id).sort(), Object.keys(BOSS_REGISTRY).sort());
  assert.equal(new Set(cases.map(([, mechanic]) => mechanic)).size, 18);
});
for (const [id, mechanic, run] of cases) test(`${id}: ${mechanic} has a real measured response`, run);

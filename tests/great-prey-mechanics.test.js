import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BossManager } from '../js/entities/Bosses.js';
import { GREAT_PREY_TUNING, hydraHeads } from '../js/battlefield/GreatPreyMechanics.js';

// The eight Ascension great prey keep their own signature (GDD campagne-unblooded §5).
const audio = new Proxy({}, { get: () => () => {} });
const hunter = (position = [0, 0, 15]) => ({ hp: 1e9, maxHp: 1e9, position: new THREE.Vector3(...position), mesh: new THREE.Group(), radius: 1,
  visionMode: 0, hits: [], takeDamage(amount, acid, attacker, context) { this.hits.push({ amount, kind: context?.attackKind }); return true; } });
const arena = id => { const manager = new BossManager(new THREE.Scene(), audio); const boss = manager.spawnBoss(id, new THREE.Vector3()); return { manager, boss }; };
const run = (manager, player, seconds, each = () => {}) => { for (let t = 0; t < seconds; t += 1 / 30) { manager.update(1 / 30, player); if (each(t) === false) break; } };

test('Eshra: each third of HP fells a head and weakens the remaining strikes', () => {
  const { manager, boss } = arena('eshra_hydra');
  assert.equal(hydraHeads(boss), 3);
  boss.hp = boss.maxHp * .6; assert.equal(hydraHeads(boss), 2);
  boss.hp = boss.maxHp * .32; assert.equal(hydraHeads(boss), 1);
  boss.hasEnteredStun = true; boss.phase = 3; // past its stagger, so it keeps striking
  const player = hunter([0, 0, 2]); boss.contactCooldown = 0;
  run(manager, player, 4, () => player.hits.length === 0);
  assert.ok(player.hits.length, 'the last head still strikes');
  assert.ok(Math.abs(player.hits[0].amount - 35 / 3) < 1e-6, `one head of three: ${player.hits[0].amount}`);
  manager.clear();
});

test('Rukh Tal: the Spur charges only at the end of a steam cycle, then is exposed', () => {
  const { manager, boss } = arena('rukh_tal_spur');
  const player = hunter([0, 0, 15]); let cycleAtCharge = null;
  boss.specialCooldown = 0;
  // The hunter keeps its distance, as the response asks; otherwise the Spur fights at close range.
  run(manager, player, 20, () => { if (boss.charge && cycleAtCharge === null) { cycleAtCharge = boss.lastSteamCycleAtStart; return false; } boss.lastSteamCycleAtStart = boss.steamCycle; player.position.z = boss.mesh.position.z + 15; });
  assert.notEqual(cycleAtCharge, null, 'the Spur charged');
  assert.ok(cycleAtCharge >= GREAT_PREY_TUNING.steamCycle - GREAT_PREY_TUNING.steamWindow - 1e-6, `charged at cycle ${cycleAtCharge}`);
  run(manager, player, 2, () => !!boss.charge);
  run(manager, player, .1);
  assert.ok(boss.exposedUntil - manager.time >= GREAT_PREY_TUNING.landingExposure - .2, 'exposed after the charge');
  manager.clear();
});

test('Kharuun: the Maw cannot be hit while it travels under the sand, then emerges with a shockwave', () => {
  const { manager, boss } = arena('kharuun_sand_maw');
  const player = hunter([0, 0, 15]); boss.specialCooldown = 0;
  run(manager, player, 10, () => !boss.charge);
  assert.ok(boss.burrowed, 'buried during the charge');
  assert.equal(manager.takeDamage(500, null, { killerFaction: 'player_clan' }), null);
  assert.equal(boss.hp, boss.maxHp);
  run(manager, player, 2, () => !!boss.charge);
  assert.equal(boss.burrowed, false);
  assert.ok(manager.pendingActions.some(action => action.kind === 'shockwave' && action.owner === boss), 'emergence shockwave');
  manager.clear();
});

test('Oshara: after a dive the Swimmer surfaces on the opposite side of the hunter', () => {
  const { manager, boss } = arena('oshara_swimmer');
  const player = hunter([0, 0, 15]); boss.specialCooldown = 0;
  run(manager, player, 10, () => !boss.charge);
  assert.ok(boss.diving, 'immersed during the leap');
  const before = boss.mesh.position.clone().sub(player.position).setY(0);
  run(manager, player, 2, () => !!boss.charge);
  const after = boss.mesh.position.clone().sub(player.position).setY(0);
  assert.ok(before.dot(after) < 0, `switched shore: ${before.toArray()} -> ${after.toArray()}`);
  manager.clear();
});

test('Dharos: the Watcher waits high while the hunter is far, then drops with a landing shockwave', () => {
  const { manager, boss } = arena('dharos_watcher');
  const far = hunter([0, 0, 40]);
  run(manager, far, .5);
  assert.equal(boss.mesh.position.y, GREAT_PREY_TUNING.watcherPerch);
  const near = hunter([0, 0, 15]); boss.specialCooldown = 0; boss.perched = true;
  boss.mesh.position.y = GREAT_PREY_TUNING.watcherPerch;
  run(manager, near, 10, () => !boss.charge);
  run(manager, near, 2, () => !!boss.charge);
  assert.equal(boss.mesh.position.y, 0, 'landed');
  assert.ok(manager.pendingActions.some(action => action.kind === 'shockwave'), 'landing shockwave');
  manager.clear();
});

test('Vara-Kesh: the Reaper pounces from a strong branch and lands on the ground', () => {
  const { manager, boss } = arena('vara_kesh_reaper');
  const player = hunter([0, 0, 15]); boss.specialCooldown = 0; let startY = null;
  run(manager, player, 10, () => { if (boss.charge) { startY = boss.charge.startY; return false; } });
  assert.equal(startY, GREAT_PREY_TUNING.perchHeight);
  run(manager, player, 2, () => !!boss.charge);
  assert.equal(boss.mesh.position.y, 0);
  manager.clear();
});

test('Terek-Va: the swarm pulses on a fixed period and shields its core while it contracts', () => {
  const { manager, boss } = arena('terek_va_hive_mind');
  const player = hunter([0, 0, 30]); let pulses = 0, shielded = false;
  const seen = new Set();
  run(manager, player, GREAT_PREY_TUNING.hivePulse.period * 2 + .2, () => {
    for (const action of manager.pendingActions) if (action.owner === boss && action.kind === 'shockwave' && !seen.has(action)) { seen.add(action); pulses++; }
    if (boss.swarmContracting) shielded = true;
  });
  assert.equal(pulses, 2);
  assert.ok(shielded);
  boss.swarmContracting = true; const hp = boss.hp;
  manager.takeDamage(400, null, { killerFaction: 'player_clan' });
  assert.equal(hp - boss.hp, 100, 'a quarter of the damage reaches the core');
  manager.clear();
});

test('Nereth: the Jaw prepares its charge unseen except in thermal vision', () => {
  const { manager, boss } = arena('nereth_jaw');
  const player = hunter([0, 0, 15]); boss.specialCooldown = 0; let hidden = false;
  let preparing = 0;
  run(manager, player, 10, () => { if (boss.pressureAction === 'charge' && !boss.charge && ++preparing > 3) { hidden = boss.visualModel.visible === false; return false; } });
  assert.ok(hidden, 'hidden in normal vision');
  player.visionMode = 1; manager.update(1 / 30, player);
  assert.equal(boss.visualModel.visible, true, 'visible in thermal vision');
  manager.clear();
});

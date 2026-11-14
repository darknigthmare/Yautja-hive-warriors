import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { TemporaryCombatEffects } from '../js/engine/TemporaryCombatEffects.js';

const audio = new Proxy({}, { get: () => () => {} });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function fixture() {
  const scene = new THREE.Scene(), env = new EnvironmentManager(scene);
  env.root = new THREE.Group(); env.referenceRoot = new THREE.Group(); env.root.add(env.referenceRoot); scene.add(env.root); env.envObjects.push(env.root);
  env.type = 'station'; env.organic = false;
  const horde = new XenomorphHorde(scene, audio);
  const actor = horde.spawnBattleUnit({ id: 'frenzy-victim', actorType: 'warrior', factionId: 'hive', position: [0, 0], hp: 10000, maxHp: 10000 });
  actor.speed = 13.7;
  const player = { position: new THREE.Vector3(30, 0, 0), hp: 10000, musouEnergy: 0, takeDamage() {} };
  env.dutchChallengeRock = { pos: player.position.clone(), cooldown: 0 };
  return { env, horde, actor, player, clear() { env.clearEnvironment(); horde.clearWave(); } };
}

test('the real Dutch challenge preserves cryogenic hold, the other hunter slow and a newly authored phase speed', () => {
  const f = fixture(), { env, horde, actor, player } = f, hunter = new TemporaryCombatEffects(), messages = [];
  try {
    hunter.slow(actor, 'hunter-neurotoxin', .4, 25);
    env.environmentCombatEffects.slow(actor, 'nitrogen', 0, 2);
    assert.equal(env.checkDutchChallengeRoar(player, { showAnnouncement(message) { messages.push(message); } }, audio, horde), true);
    assert.equal(actor.speed, 0, 'the challenge must not replace zero speed with a guessed creature default');
    env.update(2.1, horde, audio, player); near(actor.speed, 13.7 * 1.35 * .4);
    hunter.dispose(); near(actor.speed, 13.7 * 1.35);
    actor.speed = 19.2; env.update(.1, horde, audio, player); near(actor.speed, 19.2 * 1.35);
    env.update(10.1, horde, audio, player); near(actor.speed, 19.2);
    assert.equal(env.environmentCombatEffects.targets.size, 0);
    assert.ok(messages.some(message => message.includes('12S')));
    assert.ok(messages.every(message => !message.includes('ATTIRÉE')), 'the HUD must not promise a lure that the actual AI never consumes');
  } finally { hunter.dispose(); f.clear(); }
});

test('a second available Dutch challenge does not compound permanently, and inactive hunters cannot trigger it', () => {
  const f = fixture(), { env, horde, actor, player } = f;
  try {
    env.game = { isPaused: true };
    assert.equal(env.checkDutchChallengeRoar(player, null, audio, horde), false); near(actor.speed, 13.7); assert.equal(player.musouEnergy, 0);
    env.game.isPaused = false; player.hp = 0;
    assert.equal(env.checkDutchChallengeRoar(player, null, audio, horde), false); near(actor.speed, 13.7);
    player.hp = 10000;
    for (let repeat = 0; repeat < 3; repeat++) {
      assert.equal(env.checkDutchChallengeRoar(player, null, audio, horde), true); near(actor.speed, 13.7 * 1.35);
      env.update(45.1, horde, audio, player); env.updateLevelDesignV56(45.1, player, horde, null, audio);
      near(actor.speed, 13.7);
    }
    assert.equal(player.musouEnergy, 100); assert.equal(env.environmentCombatEffects.targets.size, 0);
  } finally { f.clear(); }
});

test('actual mutagen contacts expire after leaving, stay bounded while overlapping and freeze with the game', () => {
  const f = fixture(), { env, horde, actor, player } = f;
  try {
    env.spawnMutagenPuddle(new THREE.Vector3()); env.spawnMutagenPuddle(new THREE.Vector3());
    for (let frame = 0; frame < 30; frame++) {
      env.update(1 / 60, horde, audio, player); env.updateMutagenPuddles(1 / 60, player, horde, audio);
    }
    near(actor.speed, 13.7 * 1.35); assert.equal(Object.hasOwn(actor, 'isMutagenBerserk'), false);
    const life = env.mutagenPuddles.map(puddle => puddle.life);
    env.game = { isPaused: true }; env.update(10, horde, audio, player); env.updateMutagenPuddles(10, player, horde, audio);
    assert.deepEqual(env.mutagenPuddles.map(puddle => puddle.life), life); near(actor.speed, 13.7 * 1.35);
    env.game.isPaused = false; env.game.photoMode = { isActive: true }; env.updateMutagenPuddles(10, player, horde, audio);
    assert.deepEqual(env.mutagenPuddles.map(puddle => puddle.life), life);
    env.game.photoMode.isActive = false; actor.mesh.position.x = 10;
    env.update(.3, horde, audio, player); env.updateMutagenPuddles(.3, player, horde, audio); near(actor.speed, 13.7);
    actor.mesh.position.x = 0; env.updateMutagenPuddles(.1, player, horde, audio); near(actor.speed, 13.7 * 1.35);
    env.clearEnvironment(); near(actor.speed, 13.7); assert.equal(env.environmentCombatEffects.targets.size, 0);
  } finally { f.clear(); }
});

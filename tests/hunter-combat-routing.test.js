import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { createHunterStealthAttack } from '../js/engine/HunterStealth.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { BadBloodManager } from '../js/entities/BadBloodEncounter.js';
import { CombatEvents } from '../js/engine/CombatEvents.js';
import { HonorLedger } from '../js/engine/HonorLedger.js';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';

const main = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const method = name => {
  const start = main.indexOf(`  ${name}(`), end = main.indexOf('\n  }', start);
  assert.notEqual(start, -1); assert.notEqual(end, -1); return main.slice(start, end + 4);
};
const Actions = vm.runInNewContext(`(class Actions { ${['resolveLightAttack', 'performCoopAttack', 'checkTrophyExecution',
  'hitBadBloodFromPlayer', 'awardTrophy', 'saveClanHonorVault'].map(method).join('\n')} })`,
{ THREE, createHunterStealthAttack, document: { getElementById: () => null } });
const audio = new Proxy({}, { get: () => () => {} });
class OfflinePlayer extends Player { loadGeneratedVisual() { return Promise.resolve(false); } }
const hunter = () => new OfflinePlayer(new THREE.Scene(), CHARACTERS_DATA.find(data => data.id === 'jungle_hunter'), audio);
class CPUEncounter extends BadBloodManager { createBadBloodMesh() { return new THREE.Group(); } }
const noop = () => {};

function fixture() {
  const game = new Actions(), p1 = hunter(), p2 = hunter(), horde = new XenomorphHorde(new THREE.Scene(), audio);
  const ledger = new CombatEvents({ runId: 'routing' }), values = new Map(), hits = [], scheduled = [];
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  horde.combatEvents = ledger;
  horde.spawnAcidSplash = horde.spawnAcidPool = horde.spawnChestburster = horde.spawnZeroGAcidGlobule = noop;
  const badBlood = new CPUEncounter(new THREE.Scene(), audio); badBlood.combatEvents = ledger; badBlood.centralDeathScoring = true;
  Object.assign(game, { player: p1, player2: p2, horde, badBlood, bosses: { activeBoss: null },
    synthetics: { androids: [], checkHits: noop }, weather: { checkExplosions: noop }, env: null,
    particles: {}, audio, ui: { showAnnouncement: noop, showExecutionPrompt: noop },
    score: 0, sessionSkulls: 0, missionRun: 'routing', isPlaying: true, combatEvents: ledger,
    forge: { honorLedger: new HonorLedger({ storage }) }, waveIndex: 1,
    registerHits: records => hits.push(...records), scheduleAttackImpact: (owner, attack, callback) => scheduled.push(callback),
    shiftBattlefieldMorale: noop, triggerCameraFovSurge: noop, triggerCameraShake: noop });
  const close = () => { p1.dispose(); p2.dispose(); horde.clearWave(); badBlood.clear(); };
  return { game, hits, scheduled, ledger, close };
}

function rearVictims(horde) {
  for (const [id, z] of [['first', 2], ['second', 3]]) {
    const actor = { battleUnitId: id, type: 'warrior', hp: 1000, maxHp: 1000, radius: 1, mesh: new THREE.Group() };
    actor.mesh.position.z = z; horde.aliens.push(actor); horde.scene.add(actor.mesh);
  }
  return [...horde.aliens];
}

for (const cooperative of [false, true]) test(`the production ${cooperative ? 'P2 scheduled' : 'P1'} light route applies one rear bonus with the correct owner`, () => {
  const { game, hits, scheduled, close } = fixture();
  const [first, second] = rearVictims(game.horde), player = cooperative ? game.player2 : game.player;
  try {
    player.position.set(0, 0, 0); player.rotationY = 0; player.isCloaked = true;
    if (cooperative) {
      game.player.position.x = 100;
      const light = player.lightAttack.bind(player); player.lightAttack = () => ({ ...light(), damage: 100, radius: 5 });
      game.performCoopAttack('Enter'); assert.equal(first.hp, 1000); assert.equal(scheduled.length, 1); scheduled[0]();
    } else game.resolveLightAttack({ ...player.lightAttack(), damage: 100, radius: 5 });
    assert.equal(first.hp, 750); assert.equal(second.hp, 900); assert.equal(hits.length, 2);
    assert.equal(game.forge.honorLedger.balance, 0); assert.equal(game.score, 0);
  } finally { close(); }
});

test('a wall appearing before impact leaves the actual ambush metadata false', () => {
  const { game, close } = fixture(), [first] = rearVictims(game.horde);
  let visible = true; game.horde.environment = { hasLineOfSight: () => visible };
  try {
    game.player.isCloaked = true;
    const attack = createHunterStealthAttack(game.player, { ...game.player.lightAttack(), origin: game.player.position, radius: 5, damage: 100 }, game.horde);
    assert.equal(attack.ambushApplied, false); visible = false;
    assert.equal(game.horde.checkMeleeHits(attack).length, 0); assert.equal(attack.ambushApplied, false); assert.equal(first.hp, 1000);
  } finally { close(); }
});

test('the production execution route respects cover before awarding or consuming its short pose', () => {
  const { game, close } = fixture();
  const victim = { battleUnitId: 'subboss', type: 'crusher', hp: 200, maxHp: 2000, isStunned: true, mesh: new THREE.Group() };
  victim.mesh.position.z = 3; game.horde.aliens.push(victim); game.horde.scene.add(victim.mesh);
  const oldWindow = globalThis.window;
  game.env = { hasLineOfSight: () => false }; globalThis.window = { gameInstance: game };
  try {
    assert.equal(game.checkTrophyExecution(), false); assert.equal(victim.hp, 200);
    assert.equal(game.forge.honorLedger.balance, 0); assert.equal(game.player.executionProtectionTimer, 0);
    game.env.hasLineOfSight = () => true;
    assert.equal(game.checkTrophyExecution(), true); assert.equal(victim.hp, 0);
    assert.equal(game.forge.honorLedger.balance, 1200); assert.equal(game.sessionSkulls, 1);
    assert.ok(game.player.executionProtectionTimer > 0);
    game.checkTrophyExecution(); assert.equal(game.forge.honorLedger.balance, 1200); assert.equal(game.sessionSkulls, 1);
  } finally { globalThis.window = oldWindow; close(); }
});

test('the actual Bad Blood manager, P2 melee router and trophy ledger survive a lethal clear exactly once', () => {
  const { game, ledger, close } = fixture();
  let visible = false; game.env = { hasLineOfSight: () => visible };
  game.player.position.set(100, 0, 0); game.player2.position.set(0, 0, 0);
  game.badBlood.spawnAmbush(game.player2.position); game.badBlood.badBlood.mesh.position.set(0, 0, 2); game.badBlood.badBlood.hp = 50;
  const victim = game.badBlood.badBlood;
  try {
    const attack = { damage: 100, radius: 5, origin: game.player2.position };
    assert.equal(game.hitBadBloodFromPlayer(attack, game.player2), false); assert.equal(victim.hp, 50);
    visible = true;
    assert.equal(game.hitBadBloodFromPlayer(attack, game.player2), true);
    assert.equal(game.badBlood.badBlood, null); assert.equal(ledger.getSnapshot().deaths.length, 1);
    assert.equal(game.forge.honorLedger.balance, 2200); assert.equal(game.sessionSkulls, 1);
    assert.equal(game.player.trophiesCollected.length, 0); assert.equal(game.player2.trophiesCollected.length, 1);
    assert.equal(game.hitBadBloodFromPlayer(attack, game.player2), false);
    assert.equal(game.forge.honorLedger.balance, 2200); assert.equal(game.score, 2200);
  } finally { close(); }
});

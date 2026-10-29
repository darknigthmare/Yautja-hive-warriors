import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { HonorLedger } from '../js/engine/HonorLedger.js';
import { ForgeShop } from '../js/ui/ForgeShop.js';

const HONOR_KEY = 'yautja_honor_ledger_v1', CLAN_KEY = 'yautja_clan_forge';
const keys = ['barbedCombiStick', 'serratedSmartDisc', 'overchargedCoil', 'masterWristblades', 'enkiduBattleplate',
  'burnerPlasmaCoil', 'cauterizingWristblade', 'ceramicThermalArmor', 'dlexTargetingHUD'];
const playerSource = fs.readFileSync(new URL('../js/entities/Player.js', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
function method(source, name) {
  const start = source.indexOf(`  ${name}(`), end = source.indexOf('\n  }', start);
  assert.notEqual(start, -1, `production method ${name}`); assert.notEqual(end, -1, `end of ${name}`);
  return source.slice(start, end + 4);
}
const contextGetter = playerSource.match(/^  get gameContext\(\).*$/m)?.[0];
assert.ok(contextGetter, 'production game context getter');
// Run the production persistence/action methods without constructing a WebGL scene.
const playerMethods = `${contextGetter}\n${method(playerSource, 'loadClanForgeUpgrades')}`;
const menuMethods = ['purchaseClanForgeUpgrade', 'refreshClanForgeUI'].map(name => method(mainSource, name)).join('\n');

function storage(initial = []) {
  const values = new Map(initial);
  return { values, writes: [], failClan: false, getItem: key => values.get(key) ?? null,
    setItem(key, value) {
      this.writes.push(key);
      if (this.failClan && key === CLAN_KEY) throw new Error('QuotaExceededError');
      values.set(key, String(value));
    } };
}
function ledgerRecord(purchases = []) {
  const backing = storage(), ledger = new HonorLedger({ storage: backing, earned: 20000 });
  for (const [key, cost] of purchases) assert.equal(ledger.spend({ id: `clan-forge:${key}`, amount: cost, kind: 'clan-upgrade' }), true);
  return backing.values.get(HONOR_KEY);
}
function withWorld(backing, run) {
  const previous = Object.fromEntries(['document', 'window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const document = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} }, window = {};
  try {
    for (const [key, value] of Object.entries({ document, window, localStorage: backing })) {
      Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    const globals = { document, window, localStorage: backing, console: { warn() {} } };
    const PlayerMethods = vm.runInNewContext(`(class PlayerMethods { ${playerMethods} })`, globals);
    const GameMenus = vm.runInNewContext(`(class GameMenus { ${menuMethods} })`, globals);
    const game = new GameMenus(); window.game = game;
    game.ui = { showAnnouncement() {} }; game.audio = { playClanForgeHammerClang() {} };
    game.forge = new ForgeShop({});
    const createPlayer = (maxHp = 1000) => {
      const player = new PlayerMethods();
      Object.assign(player, { data: { stats: { maxHp: 1000 } }, maxHp, hp: 600, meleeDamage: 100, plasmaDamage: 100,
        royalJellyFlasks: 20, forgeUpgrades: Object.fromEntries(keys.map(key => [key, false])),
        parryWindowDuration: 0.42, hasEnkiduArmor: false, acidResistance: 0, gauntletCooldownReduction: 1,
        hasBurnerCoil: false, hasCauterizingWristblade: false, hasCeramicThermalArmor: false, hasDlexTargetingHUD: false });
      player.loadClanForgeUpgrades();
      return player;
    };
    game.player = createPlayer();
    return run({ game, createPlayer });
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
}

test('a real clan purchase survives a failed second storage write and reload without another debit', () => {
  const backing = storage([[HONOR_KEY, ledgerRecord()]]); backing.failClan = true;
  withWorld(backing, ({ game, createPlayer }) => {
    game.purchaseClanForgeUpgrade('masterWristblades', 3000, 5);
    const beforeReload = game.player;
    assert.equal(game.forge.honorLedger.balance, 17000);
    assert.equal(beforeReload.royalJellyFlasks, 15);
    assert.equal(backing.values.has(CLAN_KEY), false);
    assert.deepEqual(backing.writes, [HONOR_KEY, CLAN_KEY]);
    game.forge.honorLedger = new HonorLedger({ storage: backing });
    const reloaded = createPlayer();
    assert.equal(reloaded.forgeUpgrades.masterWristblades, true);
    assert.equal(reloaded.parryWindowDuration, 0.58);
    assert.equal(beforeReload.parryWindowDuration, 0.58);
    assert.equal(game.forge.honorLedger.balance, 17000);
    assert.deepEqual(backing.writes, [HONOR_KEY, CLAN_KEY]);
    game.player = reloaded;
    game.purchaseClanForgeUpgrade('masterWristblades', 3000, 5);
    assert.equal(reloaded.royalJellyFlasks, 20); assert.equal(game.forge.honorLedger.balance, 17000);
  });
});

test('the production retry restores clan effects in session and repeated refreshes preserve existing HP bonuses', () => {
  const original = '{broken', restored = ledgerRecord([['enkiduBattleplate', 3000]]);
  const backing = storage([[HONOR_KEY, original]]);
  withWorld(backing, ({ game, createPlayer }) => {
    game.player = createPlayer(1200);
    game.player2 = createPlayer(1200);
    assert.equal(game.player.hasEnkiduArmor, false); assert.equal(game.player.maxHp, 1200);
    assert.equal(game.forge.retryHonorSave(), false);
    assert.equal(game.player.maxHp, 1200); assert.equal(backing.values.get(HONOR_KEY), original);
    backing.values.set(HONOR_KEY, restored);
    assert.equal(game.forge.retryHonorSave(), true);
    assert.equal(game.player.hasEnkiduArmor, true); assert.equal(game.player.maxHp, 1450);
    assert.equal(game.player2.hasEnkiduArmor, true); assert.equal(game.player2.maxHp, 1450);
    for (let i = 0; i < 3; i++) {
      game.refreshClanForgeUI(); assert.equal(game.forge.retryHonorSave(), true);
    }
    assert.equal(game.player.maxHp, 1450); assert.equal(game.player.hp, 600);
    assert.equal(game.player2.maxHp, 1450); assert.equal(game.player2.hp, 600);
    assert.equal(game.player.meleeDamage, 100); assert.equal(game.player.plasmaDamage, 100);
    assert.equal(game.player.royalJellyFlasks, 20);
    assert.equal(game.forge.honorLedger.balance, 17000); assert.equal(backing.writes.length, 0);
  });
});

test('invalid and future honor records do not grant clan upgrades or overwrite either saved slot', () => {
  for (const original of ['{broken', JSON.stringify({ version: 2, earned: 20000, spent: 3000,
    transactions: { 'clan-forge:masterWristblades': { amount: -3000, kind: 'clan-upgrade' } } }),
  JSON.stringify({ version: 1, earned: 20000, spent: 3000,
    transactions: { 'clan-forge:masterWristblades': { amount: '-3000', kind: 'clan-upgrade' } } })]) {
    const backing = storage([[HONOR_KEY, original]]);
    withWorld(backing, ({ game }) => {
      assert.equal(game.forge.honorLedger.getSnapshot().recoveryRequired, true);
      assert.equal(game.player.forgeUpgrades.masterWristblades, false);
      assert.equal(game.player.parryWindowDuration, 0.42);
      assert.equal(backing.values.get(HONOR_KEY), original); assert.equal(backing.writes.length, 0);
    });
  }
});

test('historical clan-only purchases still apply once without charging honor or replacing saved data', () => {
  const saved = JSON.stringify({ masterWristblades: true, enkiduBattleplate: true });
  const backing = storage([[CLAN_KEY, saved]]);
  withWorld(backing, ({ game, createPlayer }) => {
    const player = createPlayer(1200);
    for (let i = 0; i < 3; i++) player.loadClanForgeUpgrades();
    assert.equal(player.forgeUpgrades.masterWristblades, true); assert.equal(player.parryWindowDuration, 0.58);
    assert.equal(player.maxHp, 1450); assert.equal(player.hp, 600);
    assert.equal(game.forge.honorLedger.balance, 0);
    assert.equal(game.forge.honorLedger.hasTransaction('clan-forge:masterWristblades'), false);
    assert.equal(backing.values.get(CLAN_KEY), saved); assert.deepEqual(backing.writes, [HONOR_KEY]);
  });
});

test('malformed clan data cannot suppress valid receipts or inject keys, prototypes or non-boolean purchases', () => {
  for (const saved of ['{broken', '[]', 'null',
    '{"unknownUpgrade":true,"__proto__":{"polluted":true},"constructor":true,"masterWristblades":"true","enkiduBattleplate":1}']) {
    const backing = storage([[HONOR_KEY, ledgerRecord([['burnerPlasmaCoil', 3500]])], [CLAN_KEY, saved]]);
    withWorld(backing, ({ game }) => {
      const player = game.player;
      assert.equal(player.forgeUpgrades.burnerPlasmaCoil, true); assert.equal(player.hasBurnerCoil, true);
      assert.equal(player.forgeUpgrades.masterWristblades, false); assert.equal(player.hasEnkiduArmor, false);
      assert.deepEqual(Object.keys(player.forgeUpgrades).sort(), [...keys].sort());
      assert.equal(Object.hasOwn(player.forgeUpgrades, '__proto__'), false);
      assert.equal(player.forgeUpgrades.polluted, undefined);
      assert.equal(backing.values.get(CLAN_KEY), saved); assert.equal(backing.writes.length, 0);
    });
  }
});

test('only recognized clan debit receipts can restore upgrades', () => {
  const record = JSON.stringify({ version: 1, earned: 20100, spent: 900, transactions: {
    'clan-forge:masterWristblades': { amount: 100, kind: 'combat' },
    'clan-forge:enkiduBattleplate': { amount: -300, kind: 'upgrade' },
    'clan-forge:burnerPlasmaCoil': { amount: 0, kind: 'clan-upgrade' },
    'clan-forge:ceramicThermalArmor': { amount: -300, kind: 'clan-upgrade' },
    'clan-forge:__proto__': { amount: -100, kind: 'clan-upgrade' },
    'clan-forge:unknownUpgrade': { amount: -200, kind: 'clan-upgrade' },
  } });
  const backing = storage([[HONOR_KEY, record]]);
  withWorld(backing, ({ game }) => {
    assert.equal(game.forge.honorLedger.getSnapshot().recoveryRequired, false);
    assert.equal(game.player.forgeUpgrades.masterWristblades, false);
    assert.equal(game.player.forgeUpgrades.enkiduBattleplate, false);
    assert.equal(game.player.forgeUpgrades.burnerPlasmaCoil, false);
    assert.equal(game.player.forgeUpgrades.ceramicThermalArmor, true);
    assert.equal(game.player.hasCeramicThermalArmor, true);
    assert.deepEqual(Object.keys(game.player.forgeUpgrades).sort(), [...keys].sort());
    assert.equal(game.player.maxHp, 1000); assert.equal(backing.writes.length, 0);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ForgeShop } from '../js/ui/ForgeShop.js';
import { HonorLedger } from '../js/engine/HonorLedger.js';

const KEY = 'yautja_honor_ledger_v1';
const main = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
// Execute the real menu/action methods without constructing a WebGL scene.
const methodNames = ['refreshClanHonorVaultUI', 'refreshClanForgeUI', 'refreshMothershipBridgeUI',
  'purchaseClanForgeUpgrade', 'callPlanetaryOrbitalBarrage', 'callOrbitalDropPodResupply', 'callEldersEmergencyBlessing'];
const methods = methodNames.map(name => {
  const start = main.indexOf(`  ${name}(`);
  assert.notEqual(start, -1, `production method ${name}`);
  const end = main.indexOf('\n  }', start);
  assert.notEqual(end, -1, `end of production method ${name}`);
  return main.slice(start, end + 4);
}).join('\n');

function storage(initial = []) {
  const values = new Map(initial);
  return { values, writes: 0, getItem: key => values.get(key) ?? null,
    setItem(key, value) { this.writes++; values.set(key, String(value)); } };
}
function node() {
  const listeners = new Map();
  return { hidden: false, disabled: false, textContent: '', innerText: '', children: [], style: {},
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute(name, value) { this[name] = value; },
    addEventListener(name, fn) { listeners.set(name, fn); },
    click() { if (!this.disabled) return listeners.get('click')?.(); },
    appendChild(child) { this.children.push(child); } };
}
function withUI(backing, run, getter = null) {
  const previous = Object.fromEntries(['document', 'window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const elements = new Map(), announcements = [];
  const panels = Array.from({ length: 4 }, () => {
    const panel = node(); panel.message = node(); panel.retry = node();
    panel.querySelector = selector => selector === '[data-honor-save-message]' ? panel.message : panel.retry;
    return panel;
  });
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); },
    querySelectorAll(selector) { return selector === '[data-honor-save-panel]' ? panels : selector === '[data-honor-save-retry]' ? panels.map(p => p.retry) : []; },
    createElement: node, addEventListener() {},
  };
  let sounds = 0;
  try {
    const window = {};
    Object.defineProperties(globalThis, {
      document: { configurable: true, value: document },
      window: { configurable: true, value: window },
      localStorage: getter ? { configurable: true, get: getter } : { configurable: true, value: backing },
    });
    const GameMenus = vm.runInNewContext(`(class GameMenus { ${methods} })`, { document, window });
    const game = new GameMenus(); window.game = game;
    game.ui = { trophyStats: {}, showAnnouncement: message => announcements.push(message) };
    game.player = { forgeUpgrades: {}, royalJellyFlasks: 10, loadClanForgeUpgrades() {} };
    game.waveIndex = 1; game.sessionSkulls = 0; game.comboHits = 0;
    const forge = new ForgeShop({ playSkullSnap() { sounds++; } }); game.forge = forge;
    return run({ forge, game, document, elements, panels, announcements, sounds: () => sounds });
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
}

test('protected honor is visible in all four menus and actual purchase/support handlers cannot consume resources', () => {
  const raw = JSON.stringify({ version: 1, earned: 'bad', spent: 0, trophies: ['Crâne <img src=x>'] });
  const backing = storage([[KEY, raw], ['yautja_total_kos', '100']]);
  withUI(backing, ({ forge, game, document, panels, announcements, sounds }) => {
    game.refreshClanHonorVaultUI(); game.refreshClanForgeUI(); game.refreshMothershipBridgeUI();
    assert.equal(document.getElementById('forge-honor-balance').textContent, 'À RÉCUPÉRER');
    assert.equal(document.getElementById('clan-forge-honor-balance').innerText, 'À RÉCUPÉRER');
    assert.equal(document.getElementById('vault-lifetime-honor').innerText, 'À RÉCUPÉRER');
    assert.equal(document.getElementById('vault-trophies-list').children[0].innerText, '🏆 Crâne <img src=x>');
    for (const id of ['btn-buy-hp', 'btn-buy-dmg', 'btn-forge-combistick', 'btn-orbital-barrage', 'btn-drop-pod-resupply', 'btn-elders-blessing']) {
      assert.equal(document.getElementById(id).disabled, true, id);
    }
    for (const panel of panels) { assert.equal(panel.hidden, false); assert.match(panel.message.textContent, /données d’origine sont conservées/); }
    assert.equal(forge.buyUpgrade('hp'), 0);
    game.purchaseClanForgeUpgrade('barbedCombiStick', 1500, 2);
    assert.equal(game.callPlanetaryOrbitalBarrage(), false);
    game.callOrbitalDropPodResupply(); game.callEldersEmergencyBlessing();
    assert.equal(game.player.royalJellyFlasks, 10); assert.deepEqual(game.player.forgeUpgrades, {});
    assert.equal(forge.upgrades.hpLevel, 0); assert.equal(sounds(), 0);
    assert.match(announcements.at(-1), /achats sont suspendus/);
    assert.equal(panels[0].retry.click(), false);
    assert.equal(backing.values.get(KEY), raw); assert.equal(backing.writes, 0);
  });
});

test('the retry button reconciles pending honor, refreshes menus and restores purchases without another page load', () => {
  const raw = '{broken', backing = storage([[KEY, raw]]);
  const restored = storage(), ledger = new HonorLedger({ storage: restored, earned: 20000 });
  assert.equal(ledger.spend({ id: 'forge:hp:1', amount: 3500 }), true);
  withUI(backing, ({ forge, game, document, panels }) => {
    let partnerRefreshes = 0;
    game.player2 = { loadClanForgeUpgrades() { partnerRefreshes++; } };
    assert.equal(forge.honorLedger.earn({ id: 'run:death:1', amount: 100, sessionId: 'run' }), false);
    forge.render(); assert.match(panels[0].message.textContent, /100 points restent en attente/);
    backing.values.set(KEY, restored.values.get(KEY));
    assert.equal(panels[0].retry.click(), true);
    assert.equal(forge.getBalance(), 16600); assert.equal(forge.honorLedger.getSnapshot().pendingRewards, 0);
    assert.equal(forge.upgrades.hpLevel, 1);
    assert.equal(partnerRefreshes, 1);
    assert.match(document.getElementById('btn-buy-hp').textContent, /NIVEAU 1\/5/);
    assert.equal(document.getElementById('btn-buy-hp').disabled, false);
    assert.equal(document.getElementById('btn-forge-combistick').disabled, false);
    assert.equal(document.getElementById('btn-orbital-barrage').disabled, false);
    assert.match(document.getElementById('vault-lifetime-honor').innerText, /20.?100 PTS/);
    for (const panel of panels) assert.equal(panel.hidden, true);
    const nextPlayer = { maxHp: 1000, hp: 1000, meleeDamage: 100, plasmaDamage: 100 };
    forge.applyStatsToPlayer(nextPlayer); assert.equal(nextPlayer.maxHp, 1200);
    assert.equal(forge.buyUpgrade('hp'), 7000); assert.equal(forge.getBalance(), 9600); assert.equal(forge.upgrades.hpLevel, 2);
    assert.equal(forge.honorLedger.earn({ id: 'run:death:1', amount: 100, sessionId: 'run' }), false);
    assert.equal(new HonorLedger({ storage: backing }).balance, 9600);
    assert.equal(game.player.royalJellyFlasks, 10);
  });
});

test('a failed initial migration never announces recovery until the write actually succeeds', () => {
  const backing = storage([['yautja_total_kos', '100']]), write = backing.setItem;
  let allowed = false;
  backing.setItem = function (...args) { if (!allowed) throw new Error('QuotaExceededError'); return write.apply(this, args); };
  withUI(backing, ({ forge, panels, announcements }) => {
    assert.equal(forge.honorLedger.getSnapshot().status, 'storage_unavailable');
    assert.equal(forge.honorLedger.getSnapshot().pendingRewards, 0);
    assert.equal(panels[0].retry.click(), false);
    assert.match(announcements.at(-1), /n’a pas encore abouti/);
    assert.equal(backing.values.has(KEY), false); assert.equal(panels[0].hidden, false);
    allowed = true;
    assert.equal(panels[0].retry.click(), true);
    assert.equal(forge.honorLedger.getSnapshot().status, 'saved');
    assert.equal(JSON.parse(backing.values.get(KEY)).earned, 10000);
    assert.match(announcements.at(-1), /Registre d’honneur disponible/);
    assert.equal(panels[0].hidden, true);
  });
});

test('a denied browser storage getter can recover through the production forge button', () => {
  const backing = storage(), ledger = new HonorLedger({ storage: backing, earned: 5000 });
  const original = backing.values.get(KEY); let denied = true;
  withUI(backing, ({ forge, panels }) => {
    assert.equal(forge.honorLedger.getSnapshot().recoveryReason, 'storage_read_failed');
    assert.match(panels[0].message.textContent, /stockage de l’honneur est inaccessible/);
    assert.equal(panels[0].retry.click(), false); assert.equal(backing.values.get(KEY), original);
    denied = false; assert.equal(panels[0].retry.click(), true);
    assert.equal(forge.getBalance(), 5000); assert.equal(forge.buyUpgrade('hp'), 3500);
  }, () => { if (denied) throw new Error('SecurityError'); return backing; });
  assert.equal(ledger.balance, 5000); // The independent old object was not mutated.
});

test('session-only play is explicit and does not offer a misleading persistence retry', () => {
  withUI(undefined, ({ forge, panels }) => {
    assert.equal(forge.honorLedger.getSnapshot().status, 'memory_only');
    for (const panel of panels) {
      assert.equal(panel.hidden, false); assert.match(panel.message.textContent, /session uniquement/);
      assert.equal(panel.retry.hidden, true); assert.equal(panel.retry.disabled, true);
    }
    assert.equal(forge.honorLedger.earn({ id: 'session:reward', amount: 5000 }), true);
    assert.equal(forge.buyUpgrade('hp'), 3500); assert.equal(forge.getBalance(), 1500);
  });
});

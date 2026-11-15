import test from 'node:test';
import assert from 'node:assert/strict';
import { ForgeShop } from '../js/ui/ForgeShop.js';

test('two actual forge purchases debit persistent funds and reload cannot spend caller-supplied score', () => {
  const previous = Object.fromEntries(['document', 'window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const values = new Map([['yautja_total_kos', '100']]), announcements = []; let sounds = 0;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  try {
    Object.defineProperties(globalThis, {
      localStorage: { configurable: true, value: storage },
      document: { configurable: true, value: { getElementById: () => null, addEventListener() {} } },
      window: { configurable: true, value: { game: { ui: { showAnnouncement: text => announcements.push(text) } } } },
    });
    const audio = { playSkullSnap() { sounds++; } }, first = new ForgeShop(audio);
    assert.equal(first.getBalance(), 10000);
    assert.equal(first.buyUpgrade('hp', 999999999), 3500); assert.equal(first.getBalance(), 6500);
    assert.equal(first.buyUpgrade('damage', -1), 3500); assert.equal(first.getBalance(), 3000);
    const resumed = new ForgeShop(audio);
    assert.equal(resumed.getBalance(), 3000); assert.equal(resumed.upgrades.hpLevel, 1); assert.equal(resumed.upgrades.damageLevel, 1);
    assert.equal(resumed.upgrades.spentHonor, 7000); assert.equal(sounds, 2);
    assert.equal(resumed.buyUpgrade('hp', 1e12), 0); assert.equal(resumed.getBalance(), 3000);
    assert.equal(new ForgeShop(audio).getBalance(), 3000); assert.match(announcements.at(-1), /Honneur insuffisant/);
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});

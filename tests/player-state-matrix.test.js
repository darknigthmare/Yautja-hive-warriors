import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';

/* AUD-091: no pair of player states may leave the hunter stuck. Timed states must end on their
 * own; toggles (perch, shield, cloak) must end when toggled again; a Facehugger latch must end
 * by struggle. Each state is started through its real method, as the input handlers do. */
const audio = new Proxy({}, { get: () => () => {} });
class OfflinePlayer extends Player { loadGeneratedVisual() { return Promise.resolve(false); } }
const ui = { showAnnouncement() {} }, particles = new Proxy({}, { get: () => () => {} });
const timed = {
  light: p => p.lightAttack(), heavy: p => p.heavyAttack(),
  dash: p => p.performHunterShadowDash(null, null), parry: p => p.performWristbladeParry(null, null, ui),
  musou: p => { p.musouEnergy = 100; return p.triggerMusouOverload(); },
  exosuit: p => p.activateCyberExosuit(ui, particles)
};
const toggles = { perch: ['togglePerch', 'isPerched'], shield: ['toggleShieldBlock', 'isBlocking'], cloak: ['toggleCloak', 'isCloaked'] };
const busy = p => ['isAttacking', 'isShadowDashing', 'isParrying', 'isMusouActive', 'isExosuitActive', 'isFacehuggerLatched'].filter(flag => p[flag]);
const frame = p => { p.update(1 / 30); p.updateDualPlasmaBeam?.(1 / 30, null, null, null); };
const hunter = () => new OfflinePlayer(new THREE.Scene(), CHARACTERS_DATA.find(data => data.id === 'jungle_hunter'), audio);

test('every pair of timed states ends on its own within 60 seconds', () => {
  const names = Object.keys(timed), stuck = [];
  for (let i = 0; i < names.length; i++) for (let j = i; j < names.length; j++) {
    const player = hunter();
    try {
      timed[names[i]](player); timed[names[j]](player);
      for (let t = 0; t < 60 * 30 && busy(player).length; t++) frame(player);
      if (busy(player).length) stuck.push(`${names[i]}+${names[j]}: ${busy(player).join(',')}`);
    } finally { player.dispose(); }
  }
  assert.deepEqual(stuck, []);
});

test('toggles end when toggled again, even over a timed state, and a latch ends by struggling', () => {
  for (const [name, [method, flag]] of Object.entries(toggles)) for (const [other, start] of Object.entries(timed)) {
    const player = hunter();
    try {
      player[method](ui); start(player); frame(player);
      assert.equal(player[flag], true, `${name} on`);
      player[method](ui); frame(player);
      assert.equal(player[flag], false, `${name} off over ${other}`);
    } finally { player.dispose(); }
  }
  const player = hunter();
  try {
    player.triggerFacehuggerLatch?.({ mesh: new THREE.Group(), hp: 1 });
    if (player.isFacehuggerLatched) {
      for (let t = 0; t < 200 && player.isFacehuggerLatched && player.hp > 0; t++) { player.struggleQTE(); frame(player); }
      assert.ok(!player.isFacehuggerLatched || player.hp <= 0, 'a latch has an exit');
    }
  } finally { player.dispose(); }
});

test('parry windows last their announced duration and always close', () => {
  for (const delta of [1 / 30, 1 / 60, 1 / 144]) {
    const player = hunter();
    try {
      player.performWristbladeParry(null, null, ui);
      const window = player.parryTimer; let open = 0;
      while (player.isParrying && open < 1000) { player.update(delta); open++; }
      assert.ok(Math.abs(open * delta - window) <= delta + 1e-9, `parry lasts ${(open * delta).toFixed(3)} s for ${window} s at ${delta}`);
      player.isParrying = true; player.parryTimer = .5;
      for (let t = 0; t < Math.ceil(.6 / delta); t++) player.update(delta);
      assert.equal(player.isParrying, false, 'a manual 0.5 s window closes too');
    } finally { player.dispose(); }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { hunterMusouProfile, musouCovers } from '../js/data/hunterMusouProfiles.js';

/* AUD-090: the Musou shape never authorizes damage through a wall, for the boss as for the horde. */
const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const GameApp = vm.runInNewContext(`${source.slice(source.indexOf('class GameApp'), source.indexOf("window.addEventListener('DOMContentLoaded'"))};GameApp`,
  { THREE, hunterMusouProfile, musouCovers, document: { getElementById: () => null } });

function fixture(wall) {
  const game = Object.create(GameApp.prototype), hits = { boss: 0, badBlood: 0 };
  const boss = { hp: 1000, mesh: { position: new THREE.Vector3(0, 0, 10) }, radius: 3 };
  Object.assign(game, {
    player: { data: { id: 'jungle_hunter' }, rotationY: 0, position: new THREE.Vector3(0, 0, 0) },
    ui: { showAnnouncement() {} }, audio: { playOmniPlasmaStorm() {} }, renderer: { scene: { add() {} } }, missionEffects: [],
    triggerCameraShake() {}, triggerCameraFovSurge() {}, scheduleMissionTask() {}, shiftBattlefieldMorale() {}, registerHits() {},
    horde: { checkMeleeHits: () => [] }, synthetics: { androids: [] }, particles: { spawnPlasmaScorch() {} },
    bosses: { activeBoss: boss, takeDamage: amount => { hits.boss += amount; return boss.hp; } },
    badBlood: { isActive: true, badBlood: { mesh: { position: new THREE.Vector3(2, 0, 8) } }, takeDamage: amount => { hits.badBlood += amount; } },
    battleSimulation: null,
    env: { hasLineOfSight: (from, to) => !(wall && Math.min(from.z, to.z) < 5 && Math.max(from.z, to.z) > 5) }
  });
  return { game, hits };
}

test('a Musou hits the boss and Bad Blood in the open, not through a wall', () => {
  const open = fixture(false); open.game.executeMusouOverload();
  assert.ok(open.hits.boss > 0); assert.ok(open.hits.badBlood > 0);
  const walled = fixture(true); walled.game.executeMusouOverload();
  assert.equal(walled.hits.boss, 0); assert.equal(walled.hits.badBlood, 0);
});

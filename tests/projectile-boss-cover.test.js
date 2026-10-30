import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { traceCombatSegment, hasCombatLineOfSight } from '../js/engine/CombatGeometry.js';

// Run the production projectile loop and boss damage methods without starting
// the unrelated WebGL, audio or model-loading services. No combat logic is copied.
const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const classStart = source.indexOf('class GameApp'), bootstrap = source.indexOf("window.addEventListener('DOMContentLoaded'");
assert.ok(classStart >= 0 && bootstrap > classStart);
const GameApp = vm.runInNewContext(`${source.slice(classStart, bootstrap)};GameApp`, { THREE });
const loopStart = source.indexOf('    for (let i = this.projectiles.length - 1; i >= 0; i--) {');
const loopEnd = source.indexOf('\n    this.badBlood.update(', loopStart);
assert.ok(loopStart >= 0 && loopEnd > loopStart);
const advanceProjectiles = vm.runInNewContext(`(function (delta) { ${source.slice(loopStart, loopEnd)} })`, { THREE });
const bossSource = readFileSync(new URL('../js/entities/Bosses.js', import.meta.url), 'utf8');
const bossClassStart = bossSource.indexOf('export class BossManager');
assert.ok(bossClassStart >= 0);
const BossManager = vm.runInNewContext(`${bossSource.slice(bossClassStart).replace(/^export /, '')};BossManager`, { THREE });

const wall = extra => ({ x: 2.5, z: 0, halfWidth: .1, halfDepth: 2, height: 4, ...extra });
function fixture(kind, colliders = [], height = 1.5) {
  const effects = [], damageResults = [], removed = [];
  const audio = new Proxy({}, { get: (_, name) => () => effects.push(['audio', name]) });
  const bosses = new BossManager(new THREE.Scene(), audio);
  const boss = bosses.activeBoss = { mesh: new THREE.Group(), type: 'queen', hp: 1000, maxHp: 1000,
    phase: 1, definition: { label: 'Queen' }, pattern: {}, exposedUntil: 0 };
  boss.mesh.position.set(4.5, 0, 0);
  const takeDamage = bosses.takeDamage;
  bosses.takeDamage = function (...args) { const result = takeDamage.apply(this, args); damageResults.push(result); return result; };
  const environment = new Proxy({ colliders, tacticalBridges: new Map(),
    traceSegment(from, to, options) { return traceCombatSegment(from, to, this.colliders, options); },
    hasLineOfSight(from, to, options) { return hasCombatLineOfSight(from, to, this.colliders, options); }
  }, { get: (target, key) => target[key] ?? (() => false) });
  const player = { position: new THREE.Vector3(-5, 0, 0) }, projectile = { mesh: new THREE.Group(), owner: player,
    damage: 75, life: 2, pierceRemaining: 6 };
  projectile.mesh.position.set(0, height, 0);
  if (kind === 'smart_disc') Object.assign(projectile, { isSmartDisc: true, startPos: projectile.mesh.position.clone(),
    waypoints: [new THREE.Vector3(10, height, 0)], progress: 0, speed: .5 });
  else Object.assign(projectile, { [kind === 'combistick' ? 'isCombiStick' : 'isShuriken']: true,
    direction: new THREE.Vector3(1, 0, 0), speed: 10 });
  const game = Object.create(GameApp.prototype);
  Object.assign(game, { player, projectiles: [projectile], bosses, env: environment, audio,
    horde: { checkMeleeHits: () => [] }, synthetics: { checkHits: () => [] },
    particles: { emitSparks: (_, count) => effects.push(['sparks', count]) },
    gore: { spawnDismemberment: (_, type) => effects.push(['gore', type]) },
    registerHits() {}, removeEffectMesh(mesh) { removed.push(mesh); } });
  return { game, projectile, boss, effects, damageResults, removed, step: () => advanceProjectiles.call(game, .1) };
}

for (const kind of ['smart_disc', 'combistick', 'shuriken']) {
  test(`${kind} cannot hit a nearby boss through solid or rotated cover before the projectile reaches that cover`, () => {
    for (const cover of [wall(), wall({ rotation: Math.PI / 4 })]) {
      const { game, projectile, boss, effects, damageResults, step } = fixture(kind, [cover]);
      step();
      assert.equal(boss.hp, 1000); assert.deepEqual(damageResults, []); assert.deepEqual(effects, []);
      assert.equal(projectile.pierceRemaining, 6); assert.equal(game.projectiles[0], projectile);
      assert.ok(projectile.mesh.position.distanceTo(new THREE.Vector3(1, 1.5, 0)) < 1e-9);
      assert.equal(projectile.life, 1.9);
    }
  });

  test(`${kind} uses the projectile's actual low height when a low wall hides the boss`, () => {
    const { projectile, boss, effects, damageResults, step } = fixture(kind, [wall({ height: 1 })], .2);
    step();
    assert.equal(boss.hp, 1000); assert.deepEqual(damageResults, []); assert.deepEqual(effects, []);
    assert.equal(projectile.pierceRemaining, 6);
  });

  test(`${kind} retains damage and impact effects through clear space, above low cover and past a wall behind the projectile`, () => {
    for (const colliders of [[], [wall({ height: .5 })], [wall({ enabled: false })], [wall({ x: -2 })]]) {
      const { game, projectile, boss, effects, damageResults, step } = fixture(kind, colliders);
      step();
      assert.equal(boss.hp, 925); assert.deepEqual(damageResults, [null], 'a nonlethal accepted hit returns no death event');
      assert.equal(projectile.pierceRemaining, kind === 'smart_disc' ? 6 : 5);
      assert.equal(game.projectiles[0], projectile); assert.ok(effects.length > 0);
      assert.ok(projectile.mesh.position.distanceTo(new THREE.Vector3(1, 1.5, 0)) < 1e-9);
    }
  });

  test(`${kind} still stops on a crossed physical wall without spending a boss penetration`, () => {
    const { game, projectile, boss, effects, damageResults, removed, step } = fixture(kind, [wall({ x: .5 })]);
    step();
    assert.equal(boss.hp, 1000); assert.deepEqual(damageResults, []); assert.equal(projectile.pierceRemaining, 6);
    assert.equal(game.projectiles.length, 0); assert.deepEqual(removed, [projectile.mesh]);
    assert.deepEqual(effects, [['sparks', 6]], 'only the existing wall-impact effect is emitted');
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WeatherSystem } from '../js/engine/WeatherSystem.js';
import { APCVehicle } from '../js/entities/APCVehicle.js';
import { CheyenneDropship } from '../js/entities/CheyenneDropship.js';
import { EngineRenderer } from '../js/engine/Renderer.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

test('each recent weather mode is finite, pauses, follows the scene quality and disposes its owned particles once', () => {
  const scene = new THREE.Scene(), weather = new WeatherSystem(scene);
  for (const type of ['rain', 'storm', 'zero_g_cryo', 'toxic_spores', 'humid_mist', 'autumn_gale', 'morning_haze', 'stasis_aurora']) {
    weather.setWeather(type);
    const particles = weather.weatherParticles ?? weather.weather;
    const before = particles.geometry.attributes.position.array.slice();
    weather.update(0); assert.deepEqual(particles.geometry.attributes.position.array, before);
    for (let i = 0; i < 60; i++) weather.update(1 / 60, new THREE.Vector3(300, 0, -200));
    assert.ok([...particles.geometry.attributes.position.array].every(Number.isFinite), type);
    let disposed = 0; particles.geometry.addEventListener('dispose', () => disposed++);
    weather.clear(); weather.clear(); assert.equal(disposed, 1, type); assert.equal(scene.children.length, 0);
  }
});

test('steam damage integrates elapsed seconds at 30, 60 and 120 FPS and vent counts are bounded', () => {
  const damages = [];
  for (const fps of [30, 60, 120]) {
    const scene = new THREE.Scene(), weather = new WeatherSystem(scene); weather.spawnSteamVents(1);
    const vent = weather.steamVents[0]; vent.isErupting = true; vent.eruptDuration = 2.4;
    const enemy = { hp: 1000, mesh: new THREE.Group(), isAirborne: true }; enemy.mesh.position.copy(vent.pos);
    for (let i = 0; i < fps; i++) weather.update(1 / fps, undefined, null, null, { aliens: [enemy] });
    damages.push(1000 - enemy.hp); weather.clear();
    weather.spawnSteamVents(1000); assert.equal(weather.steamVents.length, 12); weather.clear(); assert.equal(scene.children.length, 0);
  }
  for (const damage of damages) assert.ok(Math.abs(damage - 95) < 1e-8);
});

test('Cheyenne launches six real micro-rockets on the simulation clock, applies impacts, and cancels them on clear', () => {
  const scene = new THREE.Scene(), strikes = [], ship = new CheyenneDropship(scene, null, null);
  const horde = { checkMeleeHits: hit => strikes.push({ damage: hit.damage, radius: hit.radius }) };
  ship.triggerAirstrike(new THREE.Vector3(), horde);
  ship.update(0, horde); assert.equal(ship.microRockets.length, 0);
  for (let i = 0; i < 600; i++) ship.update(1 / 60, horde);
  assert.equal(strikes.filter(hit => hit.damage === 210).length, 6);
  assert.equal(ship.microRockets.length, 0); assert.equal(ship.pendingStrikes.length, 0);
  ship.clear(); assert.equal(scene.children.length, 0);
  ship.triggerAirstrike(new THREE.Vector3(), horde); ship.update(1.21, horde); ship.clear();
  const count = strikes.length; ship.update(10, horde); assert.equal(strikes.length, count); assert.equal(scene.children.length, 0);
});

test('APC prioritizes an attainable boss through its real muzzle, preserves reload and removes tracer resources', () => {
  const scene = new THREE.Scene(), apc = new APCVehicle(scene, null, null), damage = [];
  apc.spawn(new THREE.Vector3());
  const boss = { hp: 1000, mesh: new THREE.Group() }; boss.mesh.position.set(0, 0, 24);
  const ordinary = { hp: 100, mesh: new THREE.Group() }; ordinary.mesh.position.set(15, 0, 15);
  const bosses = { activeBoss: boss, takeDamage: value => { damage.push(value); boss.hp -= value; } };
  const horde = { aliens: [ordinary], checkMeleeHits() { throw new Error('Boss priority must not hit ordinary troops'); } };
  apc.update(2.2, horde, bosses); assert.deepEqual(damage, [240]); assert.equal(apc.tracers.length, 2);
  apc.update(.1, horde, bosses); assert.equal(damage.length, 1);
  apc.clear(); assert.equal(scene.children.length, 0); assert.equal(apc.tracers.length, 0);
});

test('all eleven biome light palettes restore after vision and lightning instead of returning to the old generic sky', () => {
  const renderer = Object.create(EngineRenderer.prototype);
  Object.assign(renderer, { scene: new THREE.Scene(), renderer: {}, ambientLight: new THREE.HemisphereLight(), dirLight: new THREE.DirectionalLight(), rimLight: new THREE.DirectionalLight(),
    flashDuration: .35, requestRender() {}, skyMaterial: { uniforms: { horizon: { value: new THREE.Color() }, zenith: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, cloudCover: {}, stars: {} } } });
  renderer.scene.fog = new THREE.FogExp2(); renderer.scene.background = new THREE.Color();
  const palettes = new Set();
  for (const level of LEVELS_DATA) {
    renderer.updateLevelEnvironment(level); const state = [renderer.ambientLight.color.getHex(), renderer.dirLight.color.getHex(), renderer.renderer.toneMappingExposure];
    palettes.add(renderer.skyMaterial.uniforms.zenith.value.getHex());
    renderer.setVisionMode('thermal'); renderer.setVisionMode('normal');
    assert.deepEqual([renderer.ambientLight.color.getHex(), renderer.dirLight.color.getHex(), renderer.renderer.toneMappingExposure], state);
    renderer.triggerLightningFlash(); const paused = renderer.lightningFlashTimer; renderer.update(0); assert.equal(renderer.lightningFlashTimer, paused);
    renderer.update(1); assert.deepEqual([renderer.ambientLight.color.getHex(), renderer.dirLight.color.getHex(), renderer.renderer.toneMappingExposure], state);
  }
  assert.equal(palettes.size, 11);
});

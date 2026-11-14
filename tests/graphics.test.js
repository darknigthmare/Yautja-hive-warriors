import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WeatherSystem } from '../js/engine/WeatherSystem.js';

test('biome weather creates a single animated batch and releases its previous buffers', () => {
  const scene = new THREE.Scene();
  const weather = new WeatherSystem(scene);
  weather.setWeather('rain_forest');
  assert.equal(weather.weather.type, 'LineSegments');
  assert.equal(weather.weather.geometry.attributes.position.count, 1080);
  const previousGeometry = weather.weather.geometry;
  let disposed = false;
  previousGeometry.addEventListener('dispose', () => { disposed = true; });
  const rainY = previousGeometry.attributes.position.array[1];
  weather.update(0.05);
  assert.notEqual(previousGeometry.attributes.position.array[1], rainY);
  weather.setWeather('hive_world');
  assert.equal(disposed, true);
  assert.equal(scene.children.length, 1);
  assert.equal(weather.weather.type, 'Points');
  assert.equal(weather.weather.geometry.attributes.position.count, 220);
  weather.clear();
  assert.equal(scene.children.length, 0);
  assert.equal(weather.weather, null);
});

test('gas explosions apply one area hit and expire without wall-clock timers', () => {
  const scene = new THREE.Scene();
  const weather = new WeatherSystem(scene);
  weather.spawnGasPipes(6);
  assert.equal(weather.pipes.length, 6);
  assert.ok(weather.pipes.every(pipe => Math.hypot(pipe.pos.x, pipe.pos.z) >= 26.99));
  const position = weather.pipes[0].pos.clone();
  const hits = [];
  const horde = { checkMeleeHits(attack) { hits.push(attack); } };
  let sparks = 0;
  weather.checkExplosions(position, 1, horde, { emitSparks() { sparks++; } });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].damage, 850);
  assert.equal(sparks, 1);
  assert.equal(weather.pipes.length, 5);
  assert.equal(weather.effects.length, 1);
  const effectMaterial = weather.effects[0].mesh.material;
  let disposed = false;
  effectMaterial.addEventListener('dispose', () => { disposed = true; });
  for (let frame = 0; frame < 5; frame++) weather.update(0.1);
  assert.equal(weather.effects.length, 0);
  assert.equal(disposed, true);
  weather.clear();
  assert.equal(scene.children.length, 0);
});

test('rebuilding hazards reuses geometry and cannot accumulate old pipes', () => {
  const scene = new THREE.Scene();
  const weather = new WeatherSystem(scene);
  weather.spawnGasPipes(6);
  const sharedGeometry = weather.pipes[0].mesh.children[0].geometry;
  weather.spawnGasPipes(4);
  assert.equal(scene.children.length, 4);
  assert.equal(weather.pipes.length, 4);
  assert.equal(weather.pipes[0].mesh.children[0].geometry, sharedGeometry);
  weather.spawnGasPipes(30);
  assert.equal(weather.pipes.length, 12);
  weather.clear();
  assert.equal(scene.children.length, 0);
});

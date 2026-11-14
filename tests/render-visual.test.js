import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getRenderQualityProfile, normalizeRenderQuality, isSoftwareGraphicsRenderer } from '../js/graphics/renderQuality.js';
import { WeatherSystem } from '../js/engine/WeatherSystem.js';

test('unsupported graphics fall back safely without overwriting the requested quality', () => {
  for (const limits of [{ softwareRenderer: true }, { webgl2: false }, { floatTargets: false }, { maxTextureSize: 1024 }]) {
    const profile = getRenderQualityProfile('high', limits);
    assert.equal(profile.quality, 'high');
    assert.equal(profile.effectiveQuality, 'low');
    assert.equal(profile.postprocessing, false);
    assert.equal(profile.ambientOcclusion, false);
    assert.ok(profile.shadowSize <= (limits.maxTextureSize || 4096));
  }
  assert.equal(getRenderQualityProfile('high', { softwareRenderer: true, allowSoftwareEffects: true }).ambientOcclusion, true);
  assert.equal(getRenderQualityProfile('high', { softwareRenderer: true }).shadowSize, 512);
});

test('quality budgets scale shadows and contact effects while bounding compact displays', () => {
  const low = getRenderQualityProfile('low');
  const balanced = getRenderQualityProfile('balanced');
  const high = getRenderQualityProfile('high');
  assert.ok(low.shadowSize < balanced.shadowSize && balanced.shadowSize < high.shadowSize);
  assert.equal(balanced.ambientOcclusion, false);
  assert.equal(high.ambientOcclusion, true);
  assert.ok(high.bloomStrength < 0.3, 'bloom must retain bright surface detail');
  assert.ok(getRenderQualityProfile('high', { compact: true }).maxPixelRatio <= 1.25);
  assert.equal(normalizeRenderQuality('__proto__'), 'balanced');
  assert.equal(normalizeRenderQuality('unavailable'), 'balanced');
  assert.ok(isSoftwareGraphicsRenderer('ANGLE (Google, Vulkan SwiftShader Device)'));
  assert.equal(isSoftwareGraphicsRenderer('NVIDIA GeForce RTX'), false);
});

test('quality changes rebuild bounded weather and release ripple resources', () => {
  const scene = new THREE.Scene();
  const weather = new WeatherSystem(scene);
  scene.userData.graphicsQuality = 'high';
  weather.setWeather('rain_forest');
  assert.equal(weather.weather.geometry.attributes.position.count, 1620);
  assert.equal(weather.ripples.count, 96);
  let disposed = 0;
  weather.ripples.geometry.addEventListener('dispose', () => disposed++);
  weather.ripples.material.addEventListener('dispose', () => disposed++);
  scene.userData.graphicsQuality = 'low';
  weather.update(0.016);
  assert.equal(disposed, 2);
  assert.equal(weather.weather.geometry.attributes.position.count, 540);
  assert.equal(weather.ripples, null);
  assert.equal(scene.children.length, 1);
  weather.setWeather('hive_world');
  assert.ok(weather.weather.material.map.isDataTexture, 'airborne particles use a soft alpha sprite rather than opaque squares');
  weather.clear();
  assert.equal(scene.children.length, 0);
});

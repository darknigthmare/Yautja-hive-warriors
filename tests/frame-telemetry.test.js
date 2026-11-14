import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FrameTelemetry } from '../js/engine/FrameTelemetry.js';
import { EngineRenderer } from '../js/engine/Renderer.js';

test('frame telemetry bounds its history and distinguishes CPU duration from display intervals and unavailable GPU timing', () => {
  const telemetry = new FrameTelemetry({ capacity: 10, softwareRenderer: true });
  for (let i = 0; i < 100; i++) telemetry.record({ startedAt: i * 20, endedAt: i * 20 + 3, render: { calls: 123 }, memory: { geometries: 42 } });
  const state = telemetry.snapshot();
  assert.equal(state.samples, 10); assert.equal(state.averageRenderCpuMs, 3); assert.equal(state.averageIntervalMs, 20);
  assert.equal(state.observedFps, 50); assert.equal(state.p95FrameIntervalMs, 20);
  assert.equal(state.softwareRenderer, true); assert.equal(state.gpuTimeAvailable, false);
  assert.equal(state.calls, 123); assert.equal(state.geometries, 42);
  telemetry.record({ startedAt: 9000, endedAt: 9002 });
  assert.equal(telemetry.snapshot().samples, 1); assert.equal(telemetry.snapshot().observedFps, null);
  telemetry.reset(); assert.equal(telemetry.snapshot().samples, 0);
});

function fixture() {
  const engine = Object.create(EngineRenderer.prototype), scene = new THREE.Scene();
  const info = { autoReset: true, render: { calls: 999, triangles: 999 }, memory: { geometries: 4, textures: 2 }, reset() { this.render.calls = 0; this.render.triangles = 0; } };
  const renderer = { info, setRenderTarget() {}, setScissorTest() {}, setViewport() {}, setScissor() {}, clear() {},
    render() { if (info.autoReset) info.reset(); info.render.calls += 7; info.render.triangles += 120; } };
  Object.assign(engine, { scene, renderer, width: 801, height: 600, camera: new THREE.PerspectiveCamera(), cameraP2: new THREE.PerspectiveCamera(),
    _direction: new THREE.Vector3(), _focus: new THREE.Vector3(), _lightOffset: new THREE.Vector3(), _rimOffset: new THREE.Vector3(),
    dirLight: new THREE.DirectionalLight(), rimLight: new THREE.DirectionalLight(), sky: new THREE.Group(), skyMaterial: { uniforms: { time: {} } },
    _skyTime: 0, frameTelemetry: new FrameTelemetry(), _soloDetailCameras: [], _coopDetailCameras: [] });
  return engine;
}

test('renderer counters include both co-op viewports and every composer pass and restore counter policy after errors', () => {
  const originalDocument = globalThis.document;
  globalThis.document = { body: { classList: { contains: () => false } } };
  try {
    const engine = fixture(); engine.isSplitScreen = true; engine.render();
    assert.equal(engine.getFrameStats().calls, 14); assert.equal(engine.getFrameStats().triangles, 240); assert.equal(engine.getFrameStats().views, 2);
    assert.equal(engine.renderer.info.autoReset, true);
    engine.isSplitScreen = false; engine.composer = { render() { for (let i = 0; i < 4; i++) engine.renderer.render(); } };
    engine.render(); assert.equal(engine.getFrameStats().calls, 28); assert.equal(engine.getFrameStats().triangles, 480);
    assert.equal(engine.getFrameStats().postprocessing, true); assert.equal(engine.getFrameStats().views, 1);
    engine.composer.render = () => { throw new Error('GPU unavailable'); };
    assert.throws(() => engine.render(), /GPU unavailable/); assert.equal(engine.renderer.info.autoReset, true);
  } finally { globalThis.document = originalDocument; }
});

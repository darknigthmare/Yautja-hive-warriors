import test from 'node:test';
import assert from 'node:assert/strict';
import { MouseCamera, FIXED_CAMERA_OFFSET } from '../js/engine/MouseCamera.js';

const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('the mouse camera is off by default and keeps the fixed v70 camera', () => {
  const camera = new MouseCamera({ storage: memory() });
  assert.equal(camera.enabled, false);
  camera.onMouseMove(400);
  assert.deepEqual(camera.offset(), { ...FIXED_CAMERA_OFFSET });
  const move = { x: 0, z: -1 }; assert.deepEqual(camera.rotateMove(move), { x: 0, z: -1 });
});

test('once enabled, yaw turns the camera and the moves together, and co-op keeps the fixed camera', () => {
  const storage = memory(), camera = new MouseCamera({ storage });
  camera.setEnabled(true);
  assert.equal(new MouseCamera({ storage }).enabled, true, 'the choice is remembered');
  camera.yaw = Math.PI / 2;
  const offset = camera.offset();
  assert.ok(close(offset.x, 16) && close(offset.z, 0) && offset.y === 10);
  // Forward (away from the camera) must point opposite the camera offset.
  const forward = camera.rotateMove({ x: 0, z: -1 });
  assert.ok(close(forward.x, -1) && close(forward.z, 0));
  assert.deepEqual(camera.offset(true), { ...FIXED_CAMERA_OFFSET });
  assert.deepEqual(camera.rotateMove({ x: 0, z: -1 }, true), { x: 0, z: -1 });
  camera.setEnabled(false); assert.equal(camera.yaw, 0);
});

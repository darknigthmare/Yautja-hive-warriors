import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSurfaceMaterial, getSurfaceStats, setTextureAnisotropy } from '../js/graphics/SurfaceLibrary.js';

test('PBR maps have actual surface variation and valid normals rather than flat colors', () => {
  for (const type of ['soil', 'stone', 'metal', 'armor', 'bark', 'chitin', 'skin', 'humanSkin', 'fabric', 'leather', 'bone', 'leaf', 'net']) {
    const material = createSurfaceMaterial(type);
    const { data, width } = material.map.image;
    assert.ok(width >= 256);
    assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(material.normalMap.colorSpace, THREE.NoColorSpace);
    assert.ok(new Set(data.filter((_, i) => i % 4 === 0)).size > (type === 'humanSkin' ? 12 : 20), `${type} albedo has useful variation`);
    const normals = material.normalMap.image.data;
    for (let i = 0; i < normals.length; i += 100) {
      const n = [normals[i], normals[i + 1], normals[i + 2]].map(value => value / 255 * 2 - 1);
      assert.ok(Math.abs(Math.hypot(...n) - 1) < 0.015);
    }
    assert.equal(material.map.generateMipmaps, true);
    material.dispose();
  }
});

test('surface maps are shared safely and repeat settings cannot leak between materials', () => {
  const a = createSurfaceMaterial('stone', { repeat: [12, 12], color: 0xffffff });
  const b = createSurfaceMaterial('stone', { repeat: [12, 12], color: 0x888888 });
  const c = createSurfaceMaterial('stone', { repeat: [2, 3] });
  assert.equal(a.map, b.map);
  assert.notEqual(a, b);
  assert.notEqual(a.map, c.map);
  assert.equal(a.map.image.data, c.map.image.data);
  a.dispose();
  assert.equal(b.map.image.data.length, 1024 * 1024 * 4);
  setTextureAnisotropy(16);
  assert.equal(b.map.anisotropy, 8);
  assert.equal(createSurfaceMaterial('bone').map.anisotropy, 8);
  assert.throws(() => createSurfaceMaterial('stone', { repeat: [0, 1] }));
  assert.ok(getSurfaceStats().sourceBytes < 224 * 1024 * 1024, 'the shared 2K source cache stays below 224 MiB');
});

test('organic surfaces distinguish human pores from hunter pigmentation and preserve controlled reflections', () => {
  const human = createSurfaceMaterial('humanSkin');
  const hunter = createSurfaceMaterial('skin');
  const armor = createSurfaceMaterial('armor');
  const chitin = createSurfaceMaterial('chitin');
  assert.equal(hunter.map.image.width, 2048);
  assert.equal(armor.map.image.width, 2048);
  assert.equal(chitin.map.image.width, 2048);
  assert.equal(human.map.image.width, 1024);
  assert.notEqual(human.map, hunter.map);
  assert.ok(human.normalScale.x < hunter.normalScale.x);
  assert.ok(human.envMapIntensity < armor.envMapIntensity);
  const data = human.map.image.data;
  let chromatic = 0;
  for (let i = 0; i < data.length; i += 400) if (data[i] !== data[i + 2]) chromatic++;
  assert.ok(chromatic > 500, 'Human skin includes subtle warm/cool color variation rather than grayscale tint alone.');
  for (const material of [human, hunter, armor, chitin]) material.dispose();
});

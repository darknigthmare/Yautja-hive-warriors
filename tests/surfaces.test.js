import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSurfaceMaterial, getSurfaceStats, setTextureAnisotropy } from '../js/graphics/SurfaceLibrary.js';

test('PBR maps have actual surface variation and valid normals rather than flat colors', () => {
  for (const type of ['soil', 'stone', 'metal', 'armor', 'bark', 'wood', 'chitin', 'skin', 'humanSkin', 'fabric', 'leather', 'bone', 'leaf', 'net']) {
    const material = createSurfaceMaterial(type);
    const { data, width } = material.map.image;
    assert.ok(width >= 256);
    assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(material.normalMap.colorSpace, THREE.NoColorSpace);
    assert.equal(material.roughnessMap.colorSpace, THREE.NoColorSpace);
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
  for (const channel of ['map', 'normalMap', 'roughnessMap']) {
    assert.equal(a[channel].source, c[channel].source, `${channel} repeat views share their Three Source, not only JS bytes`);
    assert.notEqual(a[channel].repeat, c[channel].repeat);
    assert.deepEqual(a[channel].repeat.toArray(), [12, 12]);
    assert.deepEqual(c[channel].repeat.toArray(), [2, 3]);
  }
  assert.notEqual(a.map.source, a.normalMap.source, 'Color and normal data have independent storage and color space.');
  let disposedMaps = 0;
  for (const texture of [a.map, a.normalMap, a.roughnessMap]) texture.addEventListener('dispose', () => disposedMaps++);
  a.dispose();
  assert.equal(disposedMaps, 0, 'Actor material disposal must leave borrowed cache maps alive.');
  assert.equal(b.map.image.data.length, 1024 * 1024 * 4);
  setTextureAnisotropy(16);
  assert.equal(b.map.anisotropy, 8);
  assert.equal(createSurfaceMaterial('bone').map.anisotropy, 8);
  assert.throws(() => createSurfaceMaterial('stone', { repeat: [0, 1] }));
  assert.ok(getSurfaceStats().sourceBytes < 224 * 1024 * 1024, 'the source cache including sawn timber stays below 224 MiB');
  assert.equal(getSurfaceStats().sharedImageSources, getSurfaceStats().types.length * 3);
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

test('coated and exposed metal share maps while retaining distinct physical finishes and caller overrides', () => {
  const painted = createSurfaceMaterial('armor', { finish: 'painted' });
  const bare = createSurfaceMaterial('armor', { finish: 'bare' });
  const matte = createSurfaceMaterial('metal', { finish: 'matte' });
  const custom = createSurfaceMaterial('armor', { finish: 'painted', metalness: 0.22, roughness: 0.73, envMapIntensity: 0.38 });
  assert.ok(painted.metalness < 0.2, 'Paint is primarily dielectric.');
  assert.ok(bare.metalness > 0.8, 'Exposed trim retains metal reflectance.');
  assert.ok(bare.roughness < painted.roughness && painted.roughness < matte.roughness);
  assert.ok(bare.envMapIntensity > painted.envMapIntensity && painted.envMapIntensity > matte.envMapIntensity);
  assert.equal(painted.map, bare.map);
  assert.equal(painted.normalMap, bare.normalMap);
  assert.equal(painted.roughnessMap, bare.roughnessMap);
  assert.equal(custom.metalness, 0.22);
  assert.equal(custom.roughness, 0.73);
  assert.equal(custom.envMapIntensity, 0.38);
  assert.equal(painted.userData.surfaceFinish, 'painted');
  assert.equal('finish' in painted, false, 'Library options must not leak into Three material properties.');
  assert.throws(() => createSurfaceMaterial('metal', { finish: 'chrome-plastic' }), /Unsupported/);
  assert.throws(() => createSurfaceMaterial('fabric', { finish: 'bare' }), /Unsupported/);
  assert.throws(() => createSurfaceMaterial('constructor'), /Unknown surface/);
  for (const material of [painted, bare, matte, custom]) material.dispose();
});

function redContrast(texture) {
  const { data, width, height } = texture.image;
  let sum = 0, sumSquared = 0, across = 0, along = 0, seamX = 0, seamY = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const red = data[(y * width + x) * 4];
    sum += red; sumSquared += red * red;
    if (x) across += Math.abs(red - data[(y * width + x - 1) * 4]);
    else seamX += Math.abs(red - data[(y * width + width - 1) * 4]);
    if (y) along += Math.abs(red - data[((y - 1) * width + x) * 4]);
    else seamY += Math.abs(red - data[((height - 1) * width + x) * 4]);
  }
  const count = width * height;
  return {
    standardDeviation: Math.sqrt(sumSquared / count - (sum / count) ** 2),
    across: across / (height * (width - 1)), along: along / (width * (height - 1)),
    seamX: seamX / height, seamY: seamY / width
  };
}

test('sawn timber has restrained longitudinal grain and no bright wrap seam', () => {
  const timber = createSurfaceMaterial('wood');
  const bark = createSurfaceMaterial('bark');
  assert.equal(timber.map.image.width, 512, 'Sawn boards do not require a new 2K image set.');
  const wood = redContrast(timber.map), tree = redContrast(bark.map);
  assert.ok(wood.across > wood.along * 3, 'The fibres run along V, matching longitudinal board UVs.');
  assert.ok(wood.standardDeviation < 10 && tree.standardDeviation < 20, 'Wood reflectance must not bake white and black zebra bands into lighting.');
  assert.ok(wood.seamX < wood.across * 2 && wood.seamY < wood.along * 2, 'Repeat boundaries have no extra albedo stripe.');
  assert.ok(timber.normalScale.x < bark.normalScale.x, 'Machined boards need less relief than tree bark.');
  assert.notEqual(timber.map.image.data, bark.map.image.data);
  timber.dispose(); bark.dispose();
});

test('fabric roughness follows yarn detail and organic maps remain dielectric by default', () => {
  const cloth = createSurfaceMaterial('fabric');
  const chitin = createSurfaceMaterial('chitin');
  const values = new Set();
  const roughness = cloth.roughnessMap.image.data;
  for (let i = 1; i < roughness.length; i += 4) values.add(roughness[i]);
  assert.ok(values.size >= 12, 'Uniform roughness makes woven uniforms read as smooth plastic.');
  assert.ok(chitin.metalness < 0.1, 'Chitin is a dielectric surface, not polished metal.');
  assert.equal(cloth.map.generateMipmaps, true);
  assert.equal(cloth.normalMap.minFilter, THREE.LinearMipmapLinearFilter);
  assert.equal(cloth.map.wrapS, THREE.RepeatWrapping);
  const tiled = createSurfaceMaterial('wood', { repeat: new Float32Array([2, 3]) });
  assert.deepEqual(tiled.map.repeat.toArray(), [2, 3]);
  assert.throws(() => createSurfaceMaterial('wood', { repeat: null }), /positive numbers/);
  cloth.dispose(); chitin.dispose(); tiled.dispose();
});

test('fine 1K and 2K normal maps retain detail above RGB8 quantization', () => {
  for (const type of ['humanSkin', 'skin', 'chitin', 'armor', 'metal']) {
    const material = createSurfaceMaterial(type);
    const data = material.normalMap.image.data;
    let detailed = 0, sampled = 0;
    for (let i = 0; i < data.length; i += 4 * 43) {
      sampled++;
      if (Math.abs(data[i] - 127.5) > 1.5 || Math.abs(data[i + 1] - 127.5) > 1.5) detailed++;
    }
    assert.ok(detailed > sampled * 0.2, `${type} should not spend its 1K/2K normal map on almost-flat 127/128 pixels.`);
    material.dispose();
  }
});

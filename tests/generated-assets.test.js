import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGeneratedAssetLibrary, collectGeneratedResources } from '../js/graphics/GeneratedAssetLibrary.js';

const verified = { status: 'verified', url: '/models/fixture.glb' };

test('generated library excludes pending assets and remote signed URLs', async () => {
  let requests = 0;
  const library = createGeneratedAssetLibrary({
    pending: { ...verified, status: 'pending' }, remote: { ...verified, url: 'https://example.test/model.glb?signature=private' },
    traversal: { ...verified, url: '/models/../fixture.glb' }
  }, { loadAsync() { requests++; } });
  for (const key of ['pending', 'remote', 'traversal', 'toString', 'unknown']) {
    assert.equal(library.getGeneratedAssetEntry(key), null);
    await assert.rejects(library.loadGeneratedAsset(key), /No verified generated asset/);
  }
  assert.equal(requests, 0);
});

test('co-op actors share one concurrent template request and failed requests can recover', async () => {
  let requests = 0;
  const gltf = { scene: new THREE.Group() };
  const library = createGeneratedAssetLibrary({ fixture: verified }, {
    async loadAsync(url) {
      assert.equal(url, '/models/fixture.glb');
      if (++requests === 1) throw new Error('temporary failure');
      return gltf;
    }
  });
  const first = library.loadGeneratedAsset('fixture');
  assert.equal(first, library.loadGeneratedAsset('fixture'));
  await assert.rejects(first, /temporary failure/);
  const [a, b] = await Promise.all([library.loadGeneratedAsset('fixture'), library.loadGeneratedAsset('fixture')]);
  assert.equal(a, gltf); assert.equal(a, b); assert.equal(requests, 2);
});

test('template retention includes every material, geometry and shared PBR texture', () => {
  const texture = new THREE.Texture();
  const materials = [new THREE.MeshStandardMaterial({ map: texture }), new THREE.MeshStandardMaterial({ normalMap: texture })];
  const geometry = new THREE.BoxGeometry();
  const scene = new THREE.Group(); scene.add(new THREE.Mesh(geometry, materials));
  const retained = collectGeneratedResources({ scene });
  assert.deepEqual(retained, new Set([geometry, ...materials, texture]));
  geometry.dispose(); materials.forEach(material => material.dispose()); texture.dispose();
});

test('generated body shares separately loaded locomotion clips without renaming source clips', async () => {
  const scene = new THREE.Group();
  const original = new THREE.AnimationClip('provider-name', 1, [new THREE.QuaternionKeyframeTrack('LeftUpLeg.quaternion', [0, 1], [0, 0, 0, 1, 0.2, 0, 0, 0.98])]);
  const body = { scene, animations: [] }, requests = [];
  const library = createGeneratedAssetLibrary({ creature: { ...verified, animationUrls: { walk: '/models/walk.glb', run: '/models/run.glb' } } }, {
    async loadAsync(url) { requests.push(url); return url === '/models/fixture.glb' ? body : { scene: new THREE.Group(), animations: [original] }; }
  });
  const [a, b] = await Promise.all([library.loadGeneratedAsset('creature'), library.loadGeneratedAsset('creature')]);
  assert.equal(a, b); assert.equal(a.scene, scene);
  assert.deepEqual(a.animations.map(clip => clip.name), ['walk', 'run']);
  assert.equal(original.name, 'provider-name'); assert.equal(body.animations.length, 0);
  assert.equal(requests.length, 3);
});

test('animation sources reject remote URLs and an incomplete clip load can recover', async () => {
  const bad = createGeneratedAssetLibrary({ creature: { ...verified, animationUrls: { walk: 'https://example.test/signed.glb' } } });
  assert.equal(bad.getGeneratedAssetEntry('creature'), null);
  let failed = true;
  const clip = new THREE.AnimationClip('walk', 1, [new THREE.NumberKeyframeTrack('Hips.position[x]', [0, 1], [0, 1])]);
  const library = createGeneratedAssetLibrary({ creature: { ...verified, animationUrls: { walk: '/models/walk.glb' } } }, {
    async loadAsync(url) { return { scene: new THREE.Group(), animations: url.includes('walk') && !failed ? [clip] : [] }; }
  });
  await assert.rejects(library.loadGeneratedAsset('creature'), /Missing generated animation/);
  failed = false;
  assert.equal((await library.loadGeneratedAsset('creature')).animations[0].name, 'walk');
});

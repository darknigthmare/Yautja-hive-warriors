import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWolfBiomaskParts, WOLF_BIOMASK_CALIBRATION } from '../js/graphics/WolfBiomask.js';
import { buildHunterModel } from '../js/graphics/HunterModel.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';
import { disposeObject } from '../js/engine/SceneResources.js';

const triangles = geometry => (geometry.index?.count ?? geometry.attributes.position.count) / 3;

function withParts(run) {
  const parts = createWolfBiomaskParts();
  try { run(parts); } finally { for (const geometry of Object.values(parts)) geometry.dispose(); }
}

function surfaceSampler(parts) {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const meshes = Object.fromEntries(Object.entries(parts).map(([name, geometry]) => [name, new THREE.Mesh(geometry, material)]));
  const ray = new THREE.Raycaster(), forward = new THREE.Vector3(0, 0, -1);
  for (const mesh of Object.values(meshes)) mesh.updateMatrixWorld(true);
  return {
    depth(name, x, y) {
      ray.set(new THREE.Vector3(x, y, 1), forward);
      return ray.intersectObject(meshes[name], false)[0]?.point.z;
    },
    dispose() { material.dispose(); }
  };
}

test('Wolf has a broad crown, tapered jaw and a projecting bridge above recessed cheeks', () => withParts(parts => {
  const sample = surfaceSampler(parts);
  try {
    const crown = sample.depth('shell', 0.245, 0.13);
    assert.ok(Number.isFinite(crown), 'the crown extends beyond the narrow lower cheek');
    assert.equal(sample.depth('shell', 0.245, -0.18), undefined, 'the lower jaw must not reuse the broad generic oval');
    const bridge = sample.depth('shell', 0, -0.18), cheek = sample.depth('shell', 0.13, -0.075);
    assert.ok(bridge - cheek > 0.10, 'the trapezoidal nose/keel must project ahead of the cheek channels');
    assert.ok(Math.abs(sample.depth('shell', 0, -0.16) - sample.depth('shell', 0.04, -0.16)) < 0.009, 'the nose must have a broad front plane rather than a rounded beak');
    parts.shell.computeBoundingBox();
    const size = parts.shell.boundingBox.getSize(new THREE.Vector3());
    assert.ok(size.y > 0.59 && size.y < 0.62, 'the Wolf sculpt must preserve the adult head height');
    assert.ok(size.x > 0.53 && size.x < 0.56);
    assert.equal(WOLF_BIOMASK_CALIBRATION.crownStuds, 12);
  } finally { sample.dispose(); }
}));

test('opaque almond lenses and fine metal grille follow the actual Wolf shell', () => withParts(parts => {
  const sample = surfaceSampler(parts);
  try {
    for (const side of [-1, 1]) for (const [x, y] of [[0.09, -0.025], [0.125, -0.018], [0.16, -0.011]]) {
      const shell = sample.depth('shell', side * x, y), lens = sample.depth('lenses', side * x, y);
      assert.ok(Number.isFinite(lens), 'both lenses must be intact, including the outer corners');
      assert.ok(lens > shell && lens - shell < 0.005, 'lens must conform to the shell instead of floating');
    }
    assert.equal(sample.depth('lenses', 0, -0.02), undefined, 'the central bridge separates the two eyes');
    for (const name of ['lenses', 'trim', 'inlays']) {
      const positions = parts[name].attributes.position;
      for (let i = 0; i < positions.count; i += 7) {
        const shell = sample.depth('shell', positions.getX(i), positions.getY(i));
        if (name !== 'trim') {
          assert.ok(Number.isFinite(shell), `${name} must remain attached to the real face silhouette`);
          assert.ok(Math.abs(positions.getZ(i) - shell) < 0.005);
        } else if (!Number.isFinite(shell)) {
          // The crown studs intentionally break the outline. Their tips may
          // extend beyond its frontal projection, but stay within a short
          // stud length of the actual shell rather than becoming floating horns.
          const shellVertices = parts.shell.attributes.position;
          let nearest = Infinity;
          for (let vertex = 0; vertex < shellVertices.count; vertex++) {
            nearest = Math.min(nearest, Math.hypot(positions.getX(i) - shellVertices.getX(vertex), positions.getY(i) - shellVertices.getY(vertex), positions.getZ(i) - shellVertices.getZ(vertex)));
          }
          assert.ok(nearest < 0.035, 'a crown stud tip must remain close to its fitted base');
        }
      }
    }
  } finally { sample.dispose(); }
}));

test('Wolf detail remains textured, finite, bounded and individually disposable', () => {
  const parts = createWolfBiomaskParts(), disposalCounts = new Map();
  let total = 0;
  try {
    for (const [name, geometry] of Object.entries(parts)) {
      total += triangles(geometry);
      assert.ok(geometry.attributes.normal && geometry.attributes.uv, `${name} requires PBR surface attributes`);
      for (const attribute of Object.values(geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value));
      disposalCounts.set(name, 0);
      geometry.addEventListener('dispose', () => disposalCounts.set(name, disposalCounts.get(name) + 1));
    }
    assert.ok(total < 15600, `mask detail exceeds its replacement budget: ${total}`);
  } finally { for (const geometry of Object.values(parts)) geometry.dispose(); }
  for (const [name, count] of disposalCounts) assert.equal(count, 1, `${name} owns a normal disposable geometry`);
});

test('the Wolf mask uses existing opaque PBR materials and follows the head visibility/socket', () => {
  const owner = { data: CHARACTERS_DATA.find(character => character.id === 'wolf_predator') };
  const root = buildHunterModel(owner);
  try {
    assert.equal(owner.headMesh.userData.wolfBiomask, WOLF_BIOMASK_CALIBRATION.revision);
    assert.deepEqual(owner.headMesh.position.toArray(), [0, 4.02, 0.02]);
    assert.equal(owner.headMesh.parent.uuid, root.uuid);
    let trianglesTotal = 0, meshCount = 0;
    root.traverse(object => { if (object.isMesh) { trianglesTotal += triangles(object.geometry); meshCount++; } });
    assert.ok(trianglesTotal < 180000, `hero budget exceeded: ${trianglesTotal}`);
    assert.ok(meshCount < 65, 'studs and engraving lines must be batched by material');
    const eyeMaterial = owner.headMesh.children.find(mesh => mesh.material?.name === 'gaskets').material;
    assert.equal(eyeMaterial.emissive.getHex(), 0);
    assert.equal(eyeMaterial.transparent, false);
    assert.equal(eyeMaterial.opacity, 1);
    assert.ok(owner.armorMaterials.some(material => material.uuid === eyeMaterial.uuid), 'cloak restoration owns the eye material');
    owner.headMesh.visible = false;
    let visibleHeadMeshes = 0;
    owner.headMesh.traverseVisible(object => { if (object.isMesh) visibleHeadMeshes++; });
    assert.equal(visibleHeadMeshes, 0, 'FPS visibility hides the complete shell, grille and studs');
  } finally { disposeObject(root); }
});

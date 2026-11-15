import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';

const audio = new Proxy({}, { get: () => () => {} });
const makePlayer = (index = 0, scene = new THREE.Scene()) => new Player(scene, CHARACTERS_DATA[index], audio);
function triangleCount(root) {
  let count = 0;
  root.traverse(object => { if (object.isMesh) count += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; });
  return count;
}

function weldedComponents(geometry) {
  const positions = geometry.attributes.position;
  const identities = new Map(), parents = [];
  const rootOf = id => { while (parents[id] !== id) { parents[id] = parents[parents[id]]; id = parents[id]; } return id; };
  const identify = index => {
    const key = [positions.getX(index), positions.getY(index), positions.getZ(index)].map(value => Math.round(value * 100000)).join(',');
    if (!identities.has(key)) { identities.set(key, parents.length); parents.push(parents.length); }
    return identities.get(key);
  };
  const count = geometry.index?.count ?? positions.count;
  for (let triangle = 0; triangle < count; triangle += 3) {
    const ids = [0, 1, 2].map(offset => identify(geometry.index ? geometry.index.getX(triangle + offset) : triangle + offset));
    parents[rootOf(ids[1])] = rootOf(ids[0]); parents[rootOf(ids[2])] = rootOf(ids[0]);
  }
  return new Set(parents.map((_, index) => rootOf(index))).size;
}

test('pectoral, abdominal, waist and neck contours form one continuous sculpted torso', () => {
  const player = makePlayer();
  const torso = player._proceduralMotionRoot.children.find(object => object.isMesh && object.material.name === 'skin');
  assert.ok(torso, 'the skin torso must exist');
  assert.ok(triangleCount(torso) >= 15000, 'surface sampling must support the sculpted contours');
  assert.equal(weldedComponents(torso.geometry), 1, 'torso muscles must not be separate spheres glued together');
  assert.equal(player.mesh.scale.x, 1); assert.equal(player.mesh.scale.y, 1);
  assert.equal(player.headMesh.scale.y, 1, 'adult proportions are modeled directly rather than squashing the old head');
  player.dispose();
});

test('all hunter silhouettes contain real surface detail within a bounded hero budget', () => {
  for (let index = 0; index < CHARACTERS_DATA.length; index++) {
    const player = makePlayer(index);
    const triangles = triangleCount(player.mesh);
    assert.ok(triangles > 80000, 'continuous sculpted anatomy must replace the old primitive assembly');
    assert.ok(triangles < 180000, `hero geometry exceeds its budget: ${triangles}`);
    let drawCalls = 0;
    player.mesh.traverse(object => {
      if (!object.isMesh) return;
      drawCalls++;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.array.length; i++) assert.ok(Number.isFinite(positions.array[i]), 'no invalid vertices');
      assert.ok(object.geometry.attributes.normal, 'detailed PBR geometry requires normals');
      assert.ok(object.geometry.attributes.uv, 'the surface must support texture maps');
    });
    assert.ok(drawCalls < 65, 'decorative parts must be batched instead of hundreds of draw calls');
    assert.equal(player.headMesh.parent, player._proceduralMotionRoot);
    assert.equal(player._proceduralMotionRoot.parent, player.mesh, 'visual contact stays below the unchanged physical actor');
    assert.equal(player.clanMarkMesh.parent, player.headMesh, 'first-person mode hides forehead and hair together');
    player.dispose();
  }
});

test('wrist equipment follows the attack joint instead of floating beside the hunter', () => {
  const player = makePlayer();
  assert.equal(player.blade1.parent, player.rightArm);
  assert.equal(player.blade2.parent, player.rightArm);
  assert.equal(player.shieldMesh.parent, player.leftArm);
  assert.equal(player.secWeaponMesh.parent, player.leftArm);
  assert.equal(player.plasmaGlaiveMesh.parent, player.rightArm);
  player.mesh.updateMatrixWorld(true);
  const before = player.blade1.getWorldPosition(new THREE.Vector3());
  assert.ok(player.lightAttack());
  player.mesh.updateMatrixWorld(true);
  const attacking = player.blade1.getWorldPosition(new THREE.Vector3());
  assert.ok(before.distanceTo(attacking) > 0.5, 'the blade must follow the attacking forearm');
  const startFoot = player.leftLeg.getWorldPosition(new THREE.Vector3());
  player.move(new THREE.Vector3(0, 0, 1), 0.1);
  player.mesh.updateMatrixWorld(true);
  assert.ok(player.leftLeg.getWorldPosition(new THREE.Vector3()).distanceTo(startFoot) > 1);
  player.dispose();
});

test('hero has a small non-emissive mask, longer grounded legs and credible head-to-body proportions', () => {
  const player = makePlayer();
  player.mesh.updateMatrixWorld(true);
  const bodyBounds = new THREE.Box3();
  player.mesh.traverseVisible(object => {
    if (object.isMesh) bodyBounds.union(new THREE.Box3().setFromObject(object));
  });
  const cranium = new THREE.Box3();
  for (const object of player.headMesh.children) {
    if (object.isMesh && ['skin', 'bio-mask'].includes(object.material.name)) cranium.union(new THREE.Box3().setFromObject(object));
  }
  const bodyHeight = bodyBounds.getSize(new THREE.Vector3()).y;
  const skullHeight = cranium.getSize(new THREE.Vector3()).y;
  assert.ok(skullHeight > 0.55 && skullHeight < 0.64, `oversized helmet: ${skullHeight}`);
  assert.ok(bodyHeight / skullHeight > 6.7 && bodyHeight / skullHeight < 7.8, 'small head relative to a tall humanoid body');
  assert.ok(bodyBounds.min.y >= 0 && bodyBounds.min.y < 0.06, 'proportions preserve ground contact');
  assert.ok(bodyBounds.getSize(new THREE.Vector3()).x < bodyHeight * 0.52, 'the armored silhouette must not remain as wide as the old figurine');
  assert.ok(player.leftLeg.position.y > bodyHeight * 0.46, 'hips are no longer too low');
  const eyesAndVents = player.headMesh.children.find(object => object.material?.name === 'gaskets');
  assert.equal(eyesAndVents.material.emissive.getHex(), 0, 'eye slits must stay dark instead of glowing orange');
  const restX = player.leftArm.position.x;
  player.toggleShieldBlock();
  player.toggleShieldBlock();
  assert.equal(player.leftArm.position.x, restX, 'blocking restores the fitted shoulder pivot');
  player.dispose();
});

test('the body net and dark eye slits remain visible above their fitted surfaces', () => {
  const player = makePlayer();
  const torso = player._proceduralMotionRoot.children.find(object => object.isMesh && object.material.name === 'skin');
  const net = player._proceduralMotionRoot.children.find(object => object.isMesh && object.material.name === 'leather');
  const mask = player.headMesh.children.find(object => object.isMesh && object.material.name === 'bio-mask');
  const eyes = player.headMesh.children.find(object => object.isMesh && object.material.name === 'gaskets');
  const ray = new THREE.Raycaster();
  const hitAt = (mesh, x, y) => {
    ray.set(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
    return ray.intersectObject(mesh, false)[0]?.point.z;
  };
  // These crossings cover abdomen, central pectorals and outer pectorals;
  // the previous analytic ellipsoid put wires inside the sculpted relief.
  for (const [x, y] of [[-0.2544, 2.7], [0.0256, 2.7], [-0.0464, 3.1], [0.2336, 3.1], [0.0576, 3.3], [0.3376, 3.3]]) {
    const skinDepth = hitAt(torso, x, y), wireDepth = hitAt(net, x, y);
    assert.ok(Number.isFinite(wireDepth) && wireDepth > skinDepth + 0.002, `net is buried at ${x}, ${y}`);
  }
  for (const x of [-0.11, 0.11]) {
    const maskDepth = hitAt(mask, x, 4.045), lensDepth = hitAt(eyes, x, 4.045);
    assert.ok(Number.isFinite(lensDepth) && lensDepth > maskDepth, 'black lens must face forward and sit outside the mask');
    assert.ok(lensDepth - maskDepth < 0.01, 'lens should conform to the face rather than float in front');
  }
  const positions = torso.geometry.attributes.position;
  let neckRadius = 0;
  for (let i = 0; i < positions.count; i++) if (Math.abs(positions.getY(i) - 3.6) < 0.012) neckRadius = Math.max(neckRadius, Math.abs(positions.getX(i)));
  assert.ok(neckRadius > 0.11 && neckRadius < 0.16, 'the clavicles must end below a short narrow neck');
  player.dispose();
});

test('cloak restoration preserves skin, bone, metal, lens and cloth surface properties', () => {
  const player = makePlayer(2);
  const materials = [...player.skinMaterials, ...player.armorMaterials];
  const originals = materials.map(material => ({ roughness: material.roughness, metalness: material.metalness, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite }));
  assert.equal(player.toggleCloak(), true);
  for (const material of materials) {
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    assert.equal(material.opacity, 0.22);
  }
  assert.equal(player.toggleCloak(), false);
  materials.forEach((material, index) => {
    for (const [key, value] of Object.entries(originals[index])) assert.equal(material[key], value, `${material.name}: ${key}`);
  });
  player.dispose();
});

test('hero disposal releases owned geometry and materials without disposing shared surface maps', () => {
  const scene = new THREE.Scene();
  const player = makePlayer(0, scene);
  const survivor = makePlayer(1, scene);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  player.mesh.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) {
      materials.add(object.material);
      for (const value of Object.values(object.material)) if (value?.isTexture) textures.add(value);
    }
  });
  let disposedGeometries = 0, disposedMaterials = 0, disposedTextures = 0;
  geometries.forEach(geometry => geometry.addEventListener('dispose', () => disposedGeometries++));
  materials.forEach(material => material.addEventListener('dispose', () => disposedMaterials++));
  textures.forEach(texture => texture.addEventListener('dispose', () => disposedTextures++));
  player.dispose();
  assert.equal(disposedGeometries, geometries.size);
  assert.equal(disposedMaterials, materials.size);
  assert.equal(disposedTextures, 0, 'texture library is shared for the lifetime of the application');
  assert.equal(scene.children.length, 1);
  assert.equal(survivor.skinMaterials[0].map.isTexture, true);
  survivor.dispose();
  assert.equal(scene.children.length, 0);
});

test('every equipped weapon remains finite across repeated geometry replacement', () => {
  const player = makePlayer();
  const ids = ['wristblades', 'combistick', 'katana', 'alpha_sickle', 'viking_axe', 'smart_disc', 'shuriken', 'compound_bow', 'plasma_whip'];
  for (const id of [...ids, ...ids.reverse()]) {
    assert.equal(player.selectWeapon(id, false), true);
    const geometry = player.secWeaponMesh.geometry;
    geometry.computeBoundingSphere();
    assert.ok(Number.isFinite(geometry.boundingSphere.radius));
    assert.ok(geometry.boundingSphere.radius > 0);
    assert.ok((geometry.index?.count ?? geometry.attributes.position.count) / 3 < 4000);
  }
  player.dispose();
});

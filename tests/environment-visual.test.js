import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { erodedObeliskGeometry } from '../js/graphics/EnvironmentSculpt.js';

function visualMetrics(root) {
  const metrics = { triangles: 0, residentTriangles: 0, calls: 0, instances: 0, uniqueGeometries: new Set() };
  root.traverse(object => {
    if (!object.isMesh) return;
    assert.ok(object.geometry.attributes.normal, `${object.name} needs surface normals`);
    assert.ok(object.geometry.attributes.uv, `${object.name} needs texture coordinates`);
    const instances = object.isInstancedMesh ? object.count : 1;
    const triangles = (object.geometry.index?.count || object.geometry.attributes.position.count) / 3 * instances;
    metrics.residentTriangles += triangles;
    let visible = true, ancestor = object;
    while (ancestor) { if (!ancestor.visible) visible = false; ancestor = ancestor.parent; }
    if (visible) { metrics.calls++; metrics.instances += object.isInstancedMesh ? object.count : 0; metrics.triangles += triangles; }
    metrics.uniqueGeometries.add(object.geometry);
  });
  return metrics;
}

for (const level of LEVELS_DATA) {
  test(`${level.id}: textured environment stays inside its rendering budget`, () => {
    const scene = new THREE.Scene();
    const environment = new EnvironmentManager(scene);
    environment.buildLevelEnvironment(level);
    const metrics = visualMetrics(environment.root);
    assert.ok(metrics.triangles > 30000, 'the environment should include modeled surface/prop detail');
    assert.ok(metrics.triangles < 500000, `visible sector triangles include instances: ${metrics.triangles}`);
    assert.ok(metrics.residentTriangles < 1200000, 'the whole six-sector map must share detail, not duplicate six full arenas');
    assert.ok(metrics.calls < 230, `prop details must remain batched: ${metrics.calls}`);
    assert.ok(environment.floorMat.map?.isDataTexture, 'ground albedo must load locally, including in Node');
    assert.ok(environment.floorMat.normalMap?.isDataTexture, 'the ground needs real micro-surface normals');
    assert.ok(environment.floorMat.roughnessMap?.isDataTexture, 'roughness must vary over the surface');
    assert.equal(environment.floorMat.map.repeat.x, 1, 'ground tiling belongs to metre-based UVs, not texture clones');
    const ground = environment.root.getObjectByName('detail-tessellated-ground');
    assert.equal(ground.geometry.attributes.position.count, 73 * 73);
    const point = new THREE.Vector3();
    for (let vertex = 0; vertex < ground.geometry.attributes.position.count; vertex++) {
      point.fromBufferAttribute(ground.geometry.attributes.position, vertex).applyMatrix4(ground.matrixWorld);
      assert.equal(point.y, 0, 'visible terrain must meet the flat movement/contact plane');
    }
    // Every unique geometry must belong to the environment and be freed once.
    const owned = new Set(environment.geometries.values());
    for (const geometry of metrics.uniqueGeometries) assert.ok(owned.has(geometry), 'scene geometry was not registered for disposal');
    let disposed = 0;
    metrics.uniqueGeometries.forEach(geometry => geometry.addEventListener('dispose', () => disposed++));
    environment.clearEnvironment();
    assert.equal(disposed, metrics.uniqueGeometries.size);
    assert.equal(scene.children.length, 0);
  });
}

test('forest canopies and undergrowth share geometry instead of creating a mesh per leaf', () => {
  const environment = new EnvironmentManager(new THREE.Scene());
  environment.buildLevelEnvironment(LEVELS_DATA[0]);
  const canopy = environment.root.getObjectByName('detail-individual-leaf-canopies');
  const fern = environment.root.getObjectByName('detail-ferns');
  assert.ok(canopy.isInstancedMesh && canopy.count >= 40);
  assert.ok(canopy.geometry.userData.leafCount >= 300, 'a shared crown must contain many individually modeled small leaves');
  assert.ok(fern.isInstancedMesh && fern.count >= 200);
  assert.ok(canopy.material.alphaTest > 0, 'leaf silhouettes should be cut out, not solid blobs');
  const pixels = canopy.material.map.image.data;
  let transparent = 0, opaque = 0;
  for (let offset = 3; offset < pixels.length; offset += 4) {
    if (pixels[offset] < 32) transparent++;
    if (pixels[offset] > 220) opaque++;
  }
  assert.ok(transparent > 0 && opaque > 0, 'leaf albedo must include a usable alpha silhouette');
  assert.ok(canopy.geometry.attributes.color, 'foliage supports subtle per-leaf variation');
  const matrices = new Float32Array(canopy.instanceMatrix.array);
  environment.buildLevelEnvironment(LEVELS_DATA[0]);
  assert.deepEqual(environment.root.getObjectByName('detail-individual-leaf-canopies').instanceMatrix.array, matrices);
  environment.clearEnvironment();
});

test('skyline window instances stay attached to their actual building facades', () => {
  const environment = new EnvironmentManager(new THREE.Scene());
  environment.buildLevelEnvironment(LEVELS_DATA.find(level => level.environmentType === 'rooftop'));
  const windows = environment.root.getObjectByName('detail-distant-city-windows');
  assert.ok(windows.isInstancedMesh && windows.count > 400);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3();
  for (let i = 0; i < windows.count; i++) {
    windows.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
    assert.ok(environment.skylineBuildings.some(building => {
      const dx = Math.abs(position.x - building.x), dz = Math.abs(position.z - building.z);
      const onFacade = building.side % 2 ? Math.abs(dx - 5.06) < 0.001 && dz <= 4 : Math.abs(dz - 6.06) < 0.001 && dx <= 4;
      return onFacade && position.y >= -8.001 && position.y <= building.height - 9;
    }), `floating window ${i}`);
  }
  environment.clearEnvironment();
});


test('roads, annuli, landing cap and terrain share isotropic five-metre texture density', () => {
  const environment = new EnvironmentManager(new THREE.Scene());
  environment.buildLevelEnvironment(LEVELS_DATA[0]);
  const surfaces = [];
  environment.root.traverse(object => {
    if (object.isMesh && object.geometry.userData.worldGroundTileSize) surfaces.push(object);
  });
  assert.ok(surfaces.some(surface => surface.name.includes('route-ns')));
  assert.ok(surfaces.some(surface => surface.name.includes('route-ew')));
  assert.ok(surfaces.some(surface => surface.name.includes('landing-cap')));
  assert.ok(surfaces.some(surface => surface.name.includes('ring')));
  for (const mesh of surfaces) {
    const positions = mesh.geometry.attributes.position;
    const uv = mesh.geometry.attributes.uv;
    const repeat = mesh.material.map.repeat;
    for (let i = 1; i < positions.count; i++) {
      const dx = positions.getX(i) - positions.getX(0);
      const dz = positions.getZ(i) - positions.getZ(0);
      const metres = Math.hypot(dx, dz);
      if (metres < 0.001) continue;
      const tiles = Math.hypot((uv.getX(i) - uv.getX(0)) * repeat.x, (uv.getY(i) - uv.getY(0)) * repeat.y);
      assert.ok(Math.abs(tiles / metres - 0.2) < 0.00001, `${mesh.name} stretches or changes texture scale`);
    }
  }
  const ns = environment.root.getObjectByName('detail-world-tiled-route-ns');
  const ew = environment.root.getObjectByName('detail-world-tiled-route-ew');
  const cap = environment.root.getObjectByName('detail-world-tiled-landing-cap');
  assert.equal(ns.material.map, ew.material.map, 'per-axis routes share their texture');
  assert.equal(cap.material.map.repeat.x, 1, 'fabricated pad uses the same metre UV scale without a special texture clone');
  environment.clearEnvironment();
});


test('botanical models have attached small blades, curved stems, and smooth sculpted stones', () => {
  const environment = new EnvironmentManager(new THREE.Scene());
  environment.buildLevelEnvironment(LEVELS_DATA[0]);
  const canopy = environment.root.getObjectByName('detail-individual-leaf-canopies');
  const geometry = canopy.geometry, position = geometry.attributes.position;
  const verticesPerLeaf = position.count / geometry.userData.leafCount;
  assert.ok(Number.isInteger(verticesPerLeaf));
  geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox.max.y - geometry.boundingBox.min.y > 7, 'leaves must occupy multiple branch tiers, not a flat star');
  let leafArea = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let triangle = 0; triangle < geometry.index.count; triangle += 3) {
    a.fromBufferAttribute(position, geometry.index.getX(triangle));
    b.fromBufferAttribute(position, geometry.index.getX(triangle + 1));
    c.fromBufferAttribute(position, geometry.index.getX(triangle + 2));
    leafArea += b.sub(a).cross(c.sub(a)).length() * 0.5;
  }
  assert.ok(leafArea > 80, 'a 12m tree must retain enough projected leaf mass to avoid a bare-antenna silhouette');

  for (let leaf = 0; leaf < geometry.userData.leafCount; leaf++) {
    const box = new THREE.Box3();
    for (let vertex = 0; vertex < verticesPerLeaf; vertex++) box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, leaf * verticesPerLeaf + vertex));
    assert.ok(box.getSize(new THREE.Vector3()).length() < 1, 'a canopy leaf must not become a giant triangular card');
  }
  const wood = environment.root.getObjectByName('detail-tree-trunks').geometry;
  wood.computeBoundingBox();
  assert.ok(wood.boundingBox.getSize(new THREE.Vector3()).x > 5, 'modeled lateral branches should extend from the trunk');
  const fern = environment.root.getObjectByName('detail-ferns').geometry;
  fern.computeBoundingBox();
  assert.ok(fern.userData.leafCount >= 40 && fern.boundingBox.max.y > 0.5, 'fern fronds need paired leaflets and raised rachises');
  const rock = environment.root.getObjectByName('detail-eroded-boulder').geometry;
  assert.ok(rock.index && rock.index.count > rock.attributes.position.count * 3, 'rock vertices must share continuous surface normals');
  environment.clearEnvironment();
});

test('forest trails blend their irregular edges and the fabricated pad has a single visible cap', () => {
  const environment = new EnvironmentManager(new THREE.Scene());
  environment.buildLevelEnvironment(LEVELS_DATA[0]);
  const route = environment.root.getObjectByName('detail-world-tiled-route-ns');
  const positions = route.geometry.attributes.position, colors = route.geometry.attributes.color;
  const firstX = positions.getX(0);
  let widthChanges = false;
  for (let i = 5; i < positions.count; i += 5) if (Math.abs(positions.getX(i) - firstX) > 0.05) widthChanges = true;
  assert.ok(widthChanges && colors, 'forest routes should have worn silhouettes and a terrain-colored edge');
  for (let i = 0; i < route.geometry.attributes.normal.count; i++) assert.ok(route.geometry.attributes.normal.getY(i) > 0.99, 'trails must face the camera above the ground');
  assert.equal(environment.root.getObjectByName('detail-landing-pad-support').geometry.parameters.openEnded, true);
  assert.ok(environment.root.getObjectByName('detail-landing-fasteners').isInstancedMesh);
  assert.ok(environment.root.getObjectByName('battlefield-walls'), 'segmented visible boundaries must leave real corridor openings');
  environment.clearEnvironment();
});


test('beveled temple obelisks expose their outside surfaces with front-face culling', () => {
  const geometry = erodedObeliskGeometry();
  const positions = geometry.attributes.position, normals = geometry.attributes.normal;
  for (let i = 0; i < positions.count; i++) {
    if (Math.hypot(positions.getX(i), positions.getZ(i)) > 0.01) assert.ok(positions.getX(i) * normals.getX(i) + positions.getZ(i) * normals.getZ(i) > 0, 'inverted obelisk would disappear from outside');
    else assert.ok(Math.abs(normals.getY(i)) > 0.99, 'solid stone needs visible, correctly oriented end caps');
  }
  geometry.dispose();
});

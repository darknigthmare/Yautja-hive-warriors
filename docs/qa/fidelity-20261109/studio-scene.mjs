// Read-only QA fixture, served by the virtual Vite plugin. Not imported by the game.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHonorGuardModel, createMarineModel, createSyntheticModel, createDropPodModel } from '/js/graphics/SupportModels.js';
import { createSurfaceMaterial, getSurfaceStats } from '/js/graphics/SurfaceLibrary.js';

const width = 1280, height = 960;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(width, height);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector('#viewport').append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x303840);
const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(room, .045); scene.environment = environment.texture;
room.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xcad7df, 0x3a332c, .7));
const key = new THREE.DirectionalLight(0xffeee0, 3); key.position.set(5, 9, 7);
key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 9, bottom: -3, near: .1, far: 30 });
key.shadow.bias = -.00015; key.shadow.normalBias = .025; scene.add(key);
const fill = new THREE.DirectionalLight(0xc2d6ee, .65); fill.position.set(-5, 4, 1); scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x434950, roughness: .9 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -.015; ground.receiveShadow = true; scene.add(ground);
const camera = new THREE.OrthographicCamera(-3, 3, 4.25, -.25, .05, 80);
const cache = new Map(); let current = null;
const roles = ['marine', 'smartgunner', 'flametrooper', 'medic', 'commtech', 'sniper', 'sadar', 'exosuit'];
const materialTypes = ['armor', 'metal', 'skin', 'humanSkin', 'fabric', 'leather', 'bark', 'chitin', 'stone', 'soil', 'bone', 'net'];

function asset(kind) {
  if (cache.has(kind)) return cache.get(kind);
  let model;
  if (kind === 'honor-guard') model = { group: createHonorGuardModel(0) };
  else if (kind === 'honor-guard-alt') model = { group: createHonorGuardModel(1) };
  else if (kind === 'synthetic') model = { group: createSyntheticModel() };
  else if (kind.startsWith('marine:')) model = { group: createMarineModel(kind.slice(7)) };
  else if (kind === 'capsule') model = createDropPodModel();
  else if (kind.startsWith('material:')) {
    const group = new THREE.Group(), type = kind.slice(9);
    const material = createSurfaceMaterial(type, { color: 0xaaaaaa, repeat: [1, 1] });
    const geometry = type === 'net' ? new THREE.PlaneGeometry(1.8, 1.8) : new THREE.SphereGeometry(.9, 48, 32);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.y = 1; mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh); model = { group };
  } else throw new Error('Unknown studio asset: ' + kind);
  cache.set(kind, model); return model;
}
function show(kind, opening = 0) {
  if (current) scene.remove(current.group);
  current = asset(kind); current.updateOpening?.(opening); scene.add(current.group);
  current.group.updateMatrixWorld(true); return current.group;
}
function measure(group) {
  let triangles = 0, vertices = 0, meshes = 0, meshInstances = 0, malformed = 0, uniqueGeometryBytes = 0;
  const geometries = new Set(), materials = new Set(), buffers = new Set();
  group.traverse(object => {
    if (!object.isMesh) return; meshes++;
    const geometry = object.geometry, p = geometry.getAttribute('position'), instances = object.isInstancedMesh ? object.count : 1;
    meshInstances += instances; triangles += (geometry.index?.count ?? p.count) / 3 * instances; vertices += p.count * instances;
    if (!geometries.has(geometry)) {
      for (const attribute of Object.values(geometry.attributes)) buffers.add(attribute.array.buffer);
      if (geometry.index) buffers.add(geometry.index.array.buffer);
      geometries.add(geometry);
    }
    for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m);
    for (const name of ['position', 'normal', 'uv']) {
      const attribute = geometry.getAttribute(name);
      if (!attribute) { malformed++; continue; }
      for (const value of attribute.array) if (!Number.isFinite(value)) { malformed++; break; }
    }
  });
  const bounds = new THREE.Box3().setFromObject(group);
  uniqueGeometryBytes = [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);
  return { triangles, vertices, meshes, meshInstances, uniqueGeometryBytes, geometries: geometries.size, materials: materials.size, malformed,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(new THREE.Vector3()).toArray() },
    anatomy: group.userData.anatomy ?? null, weaponKind: group.userData.weaponKind ?? null,
    visualSource: group.userData.visualSource ?? null };
}
function framing(kind, view, aspect = width / height) {
  const capsule = kind === 'capsule', surface = kind.startsWith('material:');
  const vertical = capsule ? 8 : surface ? 2.8 : 4.8, focusY = capsule ? 3.4 : surface ? 1 : 1.95;
  camera.left = -vertical * aspect / 2; camera.right = vertical * aspect / 2;
  camera.top = vertical / 2; camera.bottom = -vertical / 2;
  camera.position.set(view === 'front' ? 0 : 7, focusY + (view === 'front' ? 0 : 1.2), 10);
  camera.lookAt(0, focusY, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}
function frameReport() {
  return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), left: camera.left,
    right: camera.right, top: camera.top, bottom: camera.bottom, near: camera.near, far: camera.far,
    exposure: renderer.toneMappingExposure, toneMapping: renderer.toneMapping, outputColorSpace: renderer.outputColorSpace };
}
function caption(text) { document.querySelector('#caption').textContent = text; document.querySelector('#cells').replaceChildren(); }
function cellLabel(text, column, row, columns, rows) {
  const label = document.createElement('span'); label.textContent = text;
  label.style.cssText = `left:${column * 100 / columns}%;top:${row * 100 / rows}%;width:${100 / columns}%`;
  document.querySelector('#cells').append(label);
}
function render(kind, view = 'quarter', opening = 0) {
  renderer.setScissorTest(false); renderer.setViewport(0, 0, width, height);
  const group = show(kind, opening); framing(kind, view); caption(`${kind} · ${view}${kind === 'capsule' ? ' · opening ' + opening : ''}`);
  renderer.info.reset(); renderer.render(scene, camera);
  return { kind, view, opening, model: measure(group), framing: frameReport(), render: { ...renderer.info.render }, surfaces: getSurfaceStats() };
}
function sheet(kinds, columns, rows, title) {
  caption(title); const output = []; renderer.setScissorTest(true);
  const cellWidth = width / columns, cellHeight = height / rows;
  for (const [index, kind] of kinds.entries()) {
    const column = index % columns, row = Math.floor(index / columns);
    renderer.setViewport(column * cellWidth, height - (row + 1) * cellHeight, cellWidth, cellHeight);
    renderer.setScissor(column * cellWidth, height - (row + 1) * cellHeight, cellWidth, cellHeight);
    const group = show(kind); framing(kind, 'quarter', cellWidth / cellHeight);
    renderer.info.reset(); renderer.render(scene, camera); cellLabel(kind.replace('marine:', '').replace('material:', ''), column, row, columns, rows);
    output.push({ kind, model: measure(group), framing: frameReport(), render: { ...renderer.info.render } });
  }
  renderer.setScissorTest(false); renderer.setViewport(0, 0, width, height);
  return { title, columns, rows, assets: output, surfaces: getSurfaceStats() };
}
window.__fidelityStudio = {
  ready: true, viewport: { width, height }, renderer: renderer.getContext().getParameter(renderer.getContext().VERSION),
  render, roleSheet: () => sheet(roles.map(role => 'marine:' + role), 4, 2, 'Eight preserved human equipment roles'),
  surfaceSheet: () => sheet(materialTypes.map(type => 'material:' + type), 4, 3, 'Shared surface library under identical neutral light'),
  optionalWood: () => {
    try { asset('material:wood'); return { available: true, comparison: 'New surface only; baseline has no wood material.', ...render('material:wood', 'quarter') }; }
    catch (error) { if (error.message === 'Unknown surface: wood') return { available: false, comparison: 'No baseline wood material; no substitute or before/after claim.' }; throw error; }
  },
  technicalFrame: { engine: THREE.REVISION, pixelRatio: 1, lights: { hemisphere: .7, key: 3, fill: .65 },
    colorManagement: 'sRGB output / ACESFilmic / exposure1.12', shaders: 'actual model materials',
    cache: 'Each studio fixture retained once until page closes; this is not a gameplay memory benchmark.' }
};
render('honor-guard', 'quarter');

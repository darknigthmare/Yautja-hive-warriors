/* Opaque eye backings authored from the inspected mask, never from cache edits. */
import * as THREE from 'three';

const fail = message => { throw new Error(`Biomask eye filters: ${message}`); };
const finiteFloat = value => Number.isFinite(value) && Number.isFinite(Math.fround(value));
let sharedGrid = null;

function gridTexture() {
  if (sharedGrid) return sharedGrid;
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const wire = x % 8 === 0 || y % 8 === 0, at = (y * size + x) * 4;
    data.set(wire ? [40, 45, 48, 255] : [13, 16, 18, 255], at);
  }
  sharedGrid = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  sharedGrid.name = 'shared-opaque-biomask-grid';
  sharedGrid.colorSpace = THREE.SRGBColorSpace;
  sharedGrid.wrapS = sharedGrid.wrapT = THREE.RepeatWrapping;
  sharedGrid.repeat.set(4, 2);
  sharedGrid.magFilter = THREE.LinearFilter;
  sharedGrid.minFilter = THREE.LinearMipmapLinearFilter;
  sharedGrid.generateMipmaps = true; sharedGrid.needsUpdate = true;
  return sharedGrid;
}

/**
 * Optional, measured config in mask glTF scene coordinates, before normalization.
 * Returns an independent deep copy; invalid calibrated geometry is rejected.
 */
export function parseBiomaskEyeFiltersCalibration(config) {
  if (!config || config.calibrated !== true) return null;
  if (config.coordinateSpace !== undefined && config.coordinateSpace !== 'gltf-scene') fail('coordinateSpace must be gltf-scene');
  if (!Array.isArray(config.filters) || config.filters.length !== 2) fail('exactly two measured filters are required');
  const filters = config.filters.map((filter, index) => {
    if (!Array.isArray(filter?.vertices) || filter.vertices.length < 3 || filter.vertices.length > 4096) fail(`invalid vertices for filter ${index}`);
    const vertices = filter.vertices.map(point => {
      if (!Array.isArray(point) || point.length !== 3 || !point.every(finiteFloat)) fail(`non-finite vertex for filter ${index}`);
      return [...point];
    });
    const indices = filter.indices;
    if (!Array.isArray(indices) || !indices.length || indices.length % 3 || indices.length > 24576 ||
      indices.some(value => !Number.isInteger(value) || value < 0 || value >= vertices.length)) fail(`invalid triangle indices for filter ${index}`);
    for (let at = 0; at < indices.length; at += 3) {
      const [a, b, c] = indices.slice(at, at + 3).map(value => new THREE.Vector3(...vertices[value]));
      if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-16) fail(`degenerate triangle for filter ${index}`);
    }
    let uvs;
    if (filter.uvs !== undefined) {
      if (!Array.isArray(filter.uvs) || filter.uvs.length !== vertices.length) fail(`invalid UV count for filter ${index}`);
      uvs = filter.uvs.map(point => {
        if (!Array.isArray(point) || point.length !== 2 || !point.every(finiteFloat)) fail(`invalid UV for filter ${index}`);
        return [...point];
      });
    } else {
      const xs = vertices.map(point => point[0]), ys = vertices.map(point => point[1]);
      const minX = Math.min(...xs), minY = Math.min(...ys), width = Math.max(...xs) - minX, height = Math.max(...ys) - minY;
      if (width <= 0 || height <= 0) fail(`filter ${index} needs measured UVs`);
      uvs = vertices.map(point => [(point[0] - minX) / width, (point[1] - minY) / height]);
    }
    const name = typeof filter.name === 'string' ? filter.name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) : `eye-${index}`;
    return { name, vertices, indices: [...indices], uvs };
  });
  return { calibrated: true, coordinateSpace: 'gltf-scene', filters };
}

/**
 * Attach two private geometries/materials behind the cloned mask shell. The
 * 64 KiB grid source is a module-level shared texture, intentionally retained
 * like the asset library's textures. dispose() releases only private resources,
 * so character adapters that clone geometry/materials keep a valid texture.
 */
export function addBiomaskEyeFilters(maskCloneRoot, calibration) {
  const measured = parseBiomaskEyeFiltersCalibration(calibration);
  if (!measured) return null;
  if (!maskCloneRoot?.isObject3D) fail('a cloned mask scene is required');
  const root = new THREE.Group(); root.name = 'biomask-eye-filters';
  const resources = new Set(), texture = gridTexture();
  for (const filter of measured.filters) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(filter.vertices.flat(), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(filter.uvs.flat(), 2));
    geometry.setIndex(filter.indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({ name: 'biomask-opaque-eye-filter', color: 0xffffff,
      map: texture, metalness: 0.12, roughness: 0.64, side: THREE.DoubleSide,
      transparent: false, opacity: 1, alphaTest: 0, depthWrite: true });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `biomask-${filter.name}`;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.biomaskEyeFilter = true;
    root.add(mesh); resources.add(geometry); resources.add(material);
  }
  maskCloneRoot.add(root);
  let disposed = false;
  return { root, resources, sharedResources: new Set([texture]), calibration: measured,
    dispose() {
      if (disposed) return;
      disposed = true; root.removeFromParent(); resources.forEach(resource => resource.dispose());
    } };
}

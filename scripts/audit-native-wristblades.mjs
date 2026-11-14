/** Read-only native topology audit. No Meshy calls or source-GLB writes.
 * node --max-old-space-size=2048 scripts/audit-native-wristblades.mjs /tmp/wristblade-audit
 * The broad City cut is deliberately diagnostic: it is not an approved blade selection. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { loadSkinnedGlb } from '../tests/helpers/load-skinned-glb.mjs';

const output = resolve(process.argv[2] || '/tmp/yautja-native-wristblades');
await mkdir(output, { recursive: true });
const weld = geometry => {
  const position = geometry.attributes.position, keys = new Map(), representatives = [], parents = [], vertices = [];
  for (let vertex = 0; vertex < position.count; vertex++) {
    const point = [position.getX(vertex), position.getY(vertex), position.getZ(vertex)];
    const key = point.map(value => Math.round(value / 1e-6)).join(',');
    if (!keys.has(key)) { keys.set(key, representatives.length); parents.push(representatives.length); representatives.push(point); }
    vertices.push(keys.get(key));
  }
  const root = value => {
    while (parents[value] !== value) { parents[value] = parents[parents[value]]; value = parents[value]; }
    return value;
  };
  const faces = [];
  for (let at = 0; at < geometry.index.count; at += 3) {
    const face = [0, 1, 2].map(corner => vertices[geometry.index.getX(at + corner)]); faces.push(face);
    const [a, b, c] = face.map(root); parents[b] = a; parents[c] = a;
  }
  const components = new Map();
  for (const face of faces) { const id = root(face[0]); components.set(id, (components.get(id) || 0) + 1); }
  return { faces, representatives, components: [...components.values()].sort((a, b) => b - a) };
};
const ranges = indices => {
  const result = [];
  for (const face of indices) {
    const previous = result[result.length - 1];
    if (previous && previous[0] + previous[1] === face) previous[1]++;
    else result.push([face, 1]);
  }
  return result;
};
const audit = async (file, nodeName) => {
  const bytes = await readFile(file), gltf = await loadSkinnedGlb(file), mesh = gltf.scene.getObjectByName(nodeName);
  if (!mesh?.isSkinnedMesh) throw Error(`Missing measured mesh ${nodeName}`);
  const topology = weld(mesh.geometry);
  return { mesh, gltf, topology, summary: { source: file.pathname.split('/').pop(), sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    node: nodeName, vertices: mesh.geometry.attributes.position.count, triangles: mesh.geometry.index.count / 3,
    weldTolerance: 1e-6, connectedComponents: topology.components.length, largestComponentsTriangles: topology.components.slice(0, 8) } };
};
const city = await audit(new URL('../public/models/city-hunter-body-corrected.glb', import.meta.url), 'model_part1');
const jungle = await audit(new URL('../public/models/jungle-hunter-rigged.glb', import.meta.url), 'char1');
const { faces, representatives } = city.topology;
const selected = faces.map(face => {
  const points = face.map(vertex => representatives[vertex]);
  return points.reduce((sum, point) => sum + .435 * point[1] + .9 * point[2], 0) / 3 > 1.01
    && points.reduce((sum, point) => sum + point[1], 0) / 3 < 1.4;
});
const edgeFaces = new Map();
faces.forEach((face, index) => {
  for (let at = 0; at < 3; at++) {
    const edge = [face[at], face[(at + 1) % 3]].sort((a, b) => a - b), key = edge.join(',');
    if (!edgeFaces.has(key)) edgeFaces.set(key, { edge, faces: [] });
    edgeFaces.get(key).faces.push(index);
  }
});
const cutEdges = [...edgeFaces.values()].filter(edge => edge.faces.some(face => selected[face]) && edge.faces.some(face => !selected[face]));
const cutVertices = [...new Set(cutEdges.flatMap(edge => edge.edge))];
const housing = city.gltf.scene.getObjectByName('model_part2'); housing.geometry.computeBoundingBox();
const bounds = housing.geometry.boundingBox;
const pilot = { status: 'rejected-diagnostic-cut', productionEnabled: false, sourceSha256: city.summary.sourceSha256,
  sourceNode: city.summary.node, interpretation: 'broad planar outlet test; not a semantic identification of complete blades',
  selection: { centroidPlane: [0, .435, .9, -1.01], centroidYMaximum: 1.4 },
  selectedTriangles: selected.filter(Boolean).length, retainedTriangles: selected.filter(value => !value).length,
  inducedCutEdges: cutEdges.length, inducedCutVertices: cutVertices.length,
  cutVerticesBelowKnownHousing: cutVertices.filter(vertex => representatives[vertex][1] < bounds.min.y).length,
  cutVerticesBeyondKnownHousingZ: cutVertices.filter(vertex => representatives[vertex][2] > bounds.max.z).length,
  selectedFaceRanges: ranges(selected.flatMap((value, face) => value ? [face] : [])),
  rejection: 'Cut intersects an exposed wrist boundary; complete blade roots, retained hand skin and covering housing have not been certified. Do not animate/retract this candidate.' };
await writeFile(resolve(output, 'native-wristblade-topology.json'), JSON.stringify({ city: city.summary, jungle: jungle.summary }, null, 2) + '\n');
await writeFile(resolve(output, 'city-outlet-cut-pilot.json'), JSON.stringify(pilot, null, 2) + '\n');
console.log(JSON.stringify({ output, city: city.summary, jungle: jungle.summary, pilot: { status: pilot.status,
  selectedTriangles: pilot.selectedTriangles, inducedCutEdges: pilot.inducedCutEdges, cutVerticesBelowKnownHousing: pilot.cutVerticesBelowKnownHousing,
  cutVerticesBeyondKnownHousingZ: pilot.cutVerticesBeyondKnownHousingZ } }, null, 2));

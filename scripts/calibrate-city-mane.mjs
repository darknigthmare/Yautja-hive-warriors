/* CPU-only reproducible measurement of ten free distal City Hunter strands.
 * This follows actual welded triangle connectivity below explicitly reviewed
 * attachment heights. It never divides the welded side bundles by angle. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { loadSkinnedGlb } from '../tests/helpers/load-skinned-glb.mjs';
import { geometryAttributeHash } from '../js/graphics/CreatureSkinCorrections.js';

const source = new URL('../public/models/city-hunter-body-corrected.glb', import.meta.url);
const output = new URL('../js/graphics/CityHunterManeCalibration.js', import.meta.url);
const sourceSha256 = createHash('sha256').update(await readFile(source)).digest('hex');
if (sourceSha256 !== '0e297a50400f885f06595f2fb59c85aed5118517a03c140f0f3aefa5288b564b') throw new Error('Measured City source changed');
const gltf = await loadSkinnedGlb(source), mesh = gltf.scene.getObjectByName('model_part17');
const geometry = mesh.geometry, position = geometry.attributes.position, triangles = geometry.index.array;
const vertex = new THREE.Vector3(), points = [], rawToWelded = new Uint32Array(position.count), keys = new Map();
for (let i = 0; i < position.count; i++) {
  vertex.fromBufferAttribute(position, i);
  const key = vertex.toArray().map(value => Math.round(value * 1e6)).join(':');
  let welded = keys.get(key);
  if (welded === undefined) { welded = points.length; keys.set(key, welded); points.push(vertex.toArray()); }
  rawToWelded[i] = welded;
}

// Each projection-reviewed tip has an individual elongated free
// component. The larger fused side groups are deliberately absent.
const reviewed = [
  { id: 'left-outer-tip', tip: [-0.28388, 1.92753, -0.06498], upperY: 2.012 },
  { id: 'left-side-tip', tip: [-0.26389, 1.97292, -0.07476], upperY: 2.076 },
  { id: 'left-front-tip', tip: [-0.23314, 1.98788, -0.00069], upperY: 2.094 },
  { id: 'left-back-long', tip: [-0.20860, 1.92827, -0.17919], upperY: 2.130 },
  { id: 'left-back-short', tip: [-0.17630, 2.00556, -0.16599], upperY: 2.124 },
  { id: 'back-left', tip: [-0.06124, 1.99149, -0.19279], upperY: 2.148 },
  { id: 'back-center', tip: [-0.02798, 1.96145, -0.23299], upperY: 2.148 },
  { id: 'back-right', tip: [0.07642, 1.98532, -0.19025], upperY: 2.156 },
  { id: 'right-back-long', tip: [0.15062, 1.92543, -0.18496], upperY: 2.152 },
  { id: 'right-side-tip', tip: [0.22884, 1.95698, -0.04042], upperY: 2.096 }
];
const selected = new Set(), strands = [], report = [];
for (const [strandIndex, measurement] of reviewed.entries()) {
  const parents = Uint32Array.from(points, (_, i) => i);
  const find = i => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parents[b] = a; };
  for (let i = 0; i < triangles.length; i += 3) {
    const a = rawToWelded[triangles[i]], b = rawToWelded[triangles[i + 1]], c = rawToWelded[triangles[i + 2]];
    if (points[a][1] < measurement.upperY && points[b][1] < measurement.upperY) join(a, b);
    if (points[b][1] < measurement.upperY && points[c][1] < measurement.upperY) join(b, c);
    if (points[c][1] < measurement.upperY && points[a][1] < measurement.upperY) join(c, a);
  }
  let tipIndex = -1, nearest = Infinity;
  points.forEach((point, i) => { const d = point.reduce((sum, value, axis) => sum + (value - measurement.tip[axis]) ** 2, 0); if (d < nearest) { nearest = d; tipIndex = i; } });
  if (nearest > 1e-8) throw new Error(`Measured tip changed: ${measurement.id}`);
  const component = find(tipIndex), members = [];
  points.forEach((point, i) => { if (point[1] < measurement.upperY && find(i) === component) members.push(i); });
  if (members.length < 65 || members.length > 500) throw new Error(`Unreviewed component: ${measurement.id}`);
  const membership = new Set(members), minY = Math.min(...members.map(i => points[i][1])), maxY = Math.max(...members.map(i => points[i][1]));
  const height = maxY - minY;
  if (height < 0.08 || height > 0.25) throw new Error(`Unreviewed component height: ${measurement.id}`);
  const curve = [];
  for (let i = 0; i < 4; i++) {
    const y = maxY - height * i / 3;
    const band = members.filter(index => Math.abs(points[index][1] - y) <= height * 0.085);
    if (band.length < 2) throw new Error(`Insufficient measured curve: ${measurement.id}`);
    const center = [0, 0, 0];
    for (const index of band) for (let axis = 0; axis < 3; axis++) center[axis] += points[index][axis] / band.length;
    center[1] = y; curve.push(center.map(value => Number(value.toFixed(7))));
  }
  const vertices = [];
  for (let i = 0; i < rawToWelded.length; i++) if (membership.has(rawToWelded[i])) {
    if (selected.has(i)) throw new Error('Measured strands overlap'); selected.add(i); vertices.push(i);
  }
  // Verify a stationary collar next to every edge leading out of the region.
  // A cap on the first 22% of the measured height leaves a real fixed section,
  // then smoothstep fades over the next 24%. Equal positions receive equal data.
  const data = Buffer.alloc(vertices.length * 7); let anchored = 0, weighted = 0;
  for (let at = 0; at < vertices.length; at++) {
    const index = vertices[at], t = THREE.MathUtils.clamp((maxY - position.getY(index)) / height, 0, 1);
    const ramp = THREE.MathUtils.clamp((t - 0.22) / 0.24, 0, 1), fade = Math.round(ramp * ramp * (3 - 2 * ramp) * 255);
    data.writeUInt32LE(index, at * 7); data.writeUInt16LE(Math.round(t * 65535), at * 7 + 4); data[at * 7 + 6] = fade;
    if (fade) weighted++; else anchored++;
  }
  const fades = new Map(vertices.map((index, at) => [rawToWelded[index], data[at * 7 + 6]]));
  for (let i = 0; i < triangles.length; i += 3) for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
    const aa = rawToWelded[triangles[i + a]], bb = rawToWelded[triangles[i + b]];
    if (membership.has(aa) && !membership.has(bb) && fades.get(aa) !== 0) throw new Error(`Moving boundary: ${measurement.id}`);
  }
  strands.push({ id: measurement.id, curve, vertices: { encoding: 'base64-u32u16u8le', count: vertices.length,
    hash: geometryAttributeHash(new THREE.BufferAttribute(new Uint8Array(data), 1)), data: data.toString('base64') },
    stiffness: 48 + strandIndex % 4 * 3, damping: 7, gravityScale: 0.18, maxAngle: 0.24 });
  report.push({ id: measurement.id, upperY: measurement.upperY, weldedVertices: members.length, selectedVertices: vertices.length, anchored, weighted, freeHeight: Number(height.toFixed(6)) });
}
const config = { id: 'city-hunter-measured-free-mane-v1', calibrated: true, sourceSha256, meshName: 'model_part17', parentBone: 'Head',
  vertexCount: position.count, indexCount: geometry.index.count,
  positionHash: geometryAttributeHash(position), indexHash: geometryAttributeHash(geometry.index),
  skinIndexHash: geometryAttributeHash(geometry.attributes.skinIndex), skinWeightHash: geometryAttributeHash(geometry.attributes.skinWeight), strands };
if (process.argv.includes('--write')) {
  const json = JSON.stringify(config, null, 2).replace(/"data": "([A-Za-z0-9+/=]+)"/g, (_, data) => `"data":\n${data.match(/.{1,112}/g).map((line, i, all) => `        '${line}'${i === all.length - 1 ? '' : ' +'}`).join('\n')}`);
  await writeFile(output, `/* Generated by scripts/calibrate-city-mane.mjs --write.\n * Ten reviewed free distal components only; welded side bundles remain intact.\n * Source surfaces and original bind pose are never changed. */\nexport const CITY_HUNTER_MANE_RIG = ${json};\n`);
}
console.log(JSON.stringify({ sourceSha256, mesh: mesh.name, sourceVertices: position.count, weldedVertices: points.length,
  selectedVertices: selected.size, newChains: strands.length, newBones: strands.length * 4, strands: report }, null, 2));

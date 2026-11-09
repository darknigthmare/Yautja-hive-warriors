// Node-only source/pixel probe. Does not create a WebGL context or measure GPU time.
// Run from the repository root: node docs/qa/fidelity-20261109/materials/measure-surfaces.mjs [output.json]
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import * as THREE from 'three';
import { createSurfaceMaterial, getSurfaceStats } from '../../../../js/graphics/SurfaceLibrary.js';

const types = ['soil', 'stone', 'metal', 'armor', 'bark', 'chitin', 'skin', 'humanSkin', 'fabric', 'leather', 'bone', 'leaf', 'net', 'wood'];
const round = n => Math.round(n * 1e5) / 1e5;
function channelStats(texture, channel = 0) {
  const { data, width, height } = texture.image;
  const histogram = new Uint32Array(256);
  let sum = 0, sumSquares = 0, dx = 0, dy = 0, seamX = 0, seamY = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = data[(y * width + x) * 4 + channel];
    histogram[value]++;
    sum += value; sumSquares += value * value;
    if (x) dx += Math.abs(value - data[(y * width + x - 1) * 4 + channel]);
    else seamX += Math.abs(value - data[(y * width + width - 1) * 4 + channel]);
    if (y) dy += Math.abs(value - data[((y - 1) * width + x) * 4 + channel]);
    else seamY += Math.abs(value - data[((height - 1) * width + x) * 4 + channel]);
  }
  const values = [...histogram.keys()].filter(i => histogram[i]);
  const count = width * height, mean = sum / count;
  return {
    min: values[0], max: values.at(-1), distinctValues: values.length,
    mean: round(mean), standardDeviation: round(Math.sqrt(Math.max(0, sumSquares / count - mean * mean))),
    adjacentMeanDifference: [round(dx / (height * (width - 1))), round(dy / (width * (height - 1)))],
    seamMeanDifference: [round(seamX / height), round(seamY / width)]
  };
}
function normalStats(texture) {
  const data = texture.image.data;
  const angles = [];
  let minLength = Infinity, maxLength = 0;
  // A fixed grid across every source; angle is the encoded map before normalScale.
  for (let i = 0; i < data.length; i += 4 * 17) {
    const x = data[i] / 127.5 - 1, y = data[i + 1] / 127.5 - 1, z = data[i + 2] / 127.5 - 1;
    const length = Math.hypot(x, y, z);
    minLength = Math.min(minLength, length); maxLength = Math.max(maxLength, length);
    angles.push(Math.acos(Math.min(1, z / length)) * 180 / Math.PI);
  }
  angles.sort((a, b) => a - b);
  return { samples: angles.length, lengthRange: [round(minLength), round(maxLength)], tiltDegreesMean: round(angles.reduce((a, b) => a + b, 0) / angles.length), tiltDegreesP95: round(angles[Math.floor(angles.length * 0.95)]) };
}
const start = performance.now();
const materials = types.map(type => {
  const before = performance.now();
  try {
    const material = createSurfaceMaterial(type);
    return { type, material, generationMs: round(performance.now() - before) };
  } catch (error) {
    if (!error.message.startsWith('Unknown surface:')) throw error;
    return null;
  }
}).filter(Boolean);
const generationTotalMs = round(performance.now() - start);
const pixels = Object.fromEntries(materials.map(({ type, material, generationMs }) => [type, {
  width: material.map.image.width, height: material.map.image.height, generationMs,
  albedoRed: channelStats(material.map), roughnessGreen: channelStats(material.roughnessMap, 1), normals: normalStats(material.normalMap),
  normalScale: material.normalScale.toArray(), materialRoughness: material.roughness, materialMetalness: material.metalness,
  colorSpace: { albedo: material.map.colorSpace, normal: material.normalMap.colorSpace, roughness: material.roughnessMap.colorSpace },
  wrapping: material.map.wrapS, mipmaps: material.map.generateMipmaps
}]));
const repeatViews = materials.flatMap(({ type }) => [createSurfaceMaterial(type, { repeat: [1, 1] }), createSurfaceMaterial(type, { repeat: [2, 3] }), createSurfaceMaterial(type, { repeat: [7, 2] })]);
const textures = repeatViews.flatMap(material => [material.map, material.normalMap, material.roughnessMap]);
const uniqueViews = new Set(textures), uniqueSources = new Set(textures.map(texture => texture.source));
const exactMipBytes = texture => {
  let bytes = 0;
  for (let size = texture.image.width; size >= 1; size = Math.floor(size / 2)) bytes += size * size * 4;
  return bytes;
};
const report = {
  timestamp: new Date().toISOString(), node: process.version, threeRevision: THREE.REVISION,
  surfaceLibrarySha256: createHash('sha256').update(await readFile(new URL('../../../../js/graphics/SurfaceLibrary.js', import.meta.url))).digest('hex'),
  scope: 'Node RGBA sources and repeat views only; no browser, renderer, draw calls, GPU time or hardware memory measured.',
  generationTotalMs, cache: getSurfaceStats(), repeatProbe: {
    repeatPairs: [[1, 1], [2, 3], [7, 2]], materialCount: repeatViews.length, textureViews: uniqueViews.size, uniqueThreeSources: uniqueSources.size,
    fullRgbaMipChainBytesPerUniqueSource: [...uniqueSources].reduce((n, source) => n + exactMipBytes(textures.find(texture => texture.source === source)), 0),
    note: 'Mip chain number is an uncompressed RGBA allocation estimate, not a measured GPU allocation. Three r160 caches native textures by Source identity and sampler properties.'
  }, pixels
};
for (const { material } of materials) material.dispose();
for (const material of repeatViews) material.dispose();
const json = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv[2]) await writeFile(process.argv[2], json);
else process.stdout.write(json);

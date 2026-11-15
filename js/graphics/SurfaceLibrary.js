/* Tileable PBR surfaces, generated once and shared for the lifetime of the game.
 * All maps work in Node and the browser; no canvas, CDN or runtime download.
 */
import * as THREE from 'three';

const SURFACES = {
  soil: { size: 1024, color: 0x766b54, roughness: 0.98, metalness: 0, relief: 2.6 },
  stone: { size: 1024, color: 0x8c9094, roughness: 0.88, metalness: 0.02, relief: 2.8 },
  metal: { size: 1024, color: 0x8e9ba5, roughness: 0.62, metalness: 0.8, relief: 0.7 },
  armor: { size: 2048, color: 0x929b98, roughness: 0.6, metalness: 0.68, relief: 0.65 },
  bark: { size: 1024, color: 0x756556, roughness: 1, metalness: 0, relief: 3.1 },
  chitin: { size: 2048, color: 0x35404c, roughness: 0.5, metalness: 0.24, relief: 0.85 },
  skin: { size: 2048, color: 0xb19b6d, roughness: 0.8, metalness: 0.02, relief: 0.75 },
  humanSkin: { size: 1024, color: 0xd8b59b, roughness: 0.78, metalness: 0, relief: 0.6 },
  fabric: { size: 512, color: 0x657166, roughness: 1, metalness: 0, relief: 1.2 },
  leather: { size: 512, color: 0x6e5746, roughness: 0.86, metalness: 0.02, relief: 1.2 },
  bone: { size: 512, color: 0xc8bd98, roughness: 0.76, metalness: 0, relief: 0.75 },
  leaf: { size: 512, color: 0x729359, roughness: 0.86, metalness: 0, relief: 1.3 },
  net: { size: 256, color: 0x4c4740, roughness: 0.9, metalness: 0.05, relief: 1 }
};
const sources = new Map();
const views = new Map();
let anisotropy = 1;
const TAU = Math.PI * 2;
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const fract = n => n - Math.floor(n);
const smooth = n => n * n * (3 - 2 * n);
function hash(x, y, seed) {
  let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(u, v, cells, seed) {
  const x = u * cells, y = v * cells;
  const ix = Math.floor(x), iy = Math.floor(y);
  const tx = smooth(fract(x)), ty = smooth(fract(y));
  const a = hash(ix % cells, iy % cells, seed);
  const b = hash((ix + 1) % cells, iy % cells, seed);
  const c = hash(ix % cells, (iy + 1) % cells, seed);
  const d = hash((ix + 1) % cells, (iy + 1) % cells, seed);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}
function fbm(u, v, seed) {
  return noise(u, v, 4, seed) * 0.42 + noise(u, v, 12, seed + 1) * 0.28
    + noise(u, v, 36, seed + 2) * 0.19 + noise(u, v, 108, seed + 3) * 0.11;
}

function buildSource(type) {
  const definition = SURFACES[type];
  const size = definition.size;
  const count = size * size;
  const heights = new Float32Array(count);
  const albedo = new Uint8Array(count * 4);
  const rough = new Uint8Array(count * 4);
  const normal = new Uint8Array(count * 4);
  const seed = [...type].reduce((n, char) => n * 31 + char.charCodeAt(0), 7) | 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, pixel = y * size + x, at = pixel * 4;
    const broad = fbm(u, v, seed);
    const grain = hash(x, y, seed + 93);
    let height = broad, shade = 0.7 + broad * 0.27, surfaceRoughness = 0.8, alpha = 1;
    let red = 1, green = 1, blue = 1;
    if (type === 'soil') {
      const gravel = Math.max(0, noise(u, v, 82, seed + 7) - 0.54) * 2;
      height = broad * 0.56 + gravel * 0.4 + grain * 0.04;
      shade = 0.42 + broad * 0.45 + gravel * 0.2;
      surfaceRoughness = 0.72 + broad * 0.28;
    } else if (type === 'stone') {
      const veins = Math.pow(1 - Math.abs(Math.sin(TAU * (u * 5 + v * 3 + broad * 0.7))), 14);
      height = broad * 0.7 - veins * 0.15 + grain * 0.06;
      shade = 0.52 + broad * 0.38 - veins * 0.23;
      surfaceRoughness = 0.78 + broad * 0.22;
    } else if (type === 'bark') {
      const ridges = Math.pow(0.5 + Math.sin(TAU * (u * 28 + noise(u, v, 8, seed) * 0.9)) * 0.5, 2);
      height = ridges * 0.55 + broad * 0.38 + grain * 0.07;
      shade = 0.36 + ridges * 0.32 + broad * 0.3;
      surfaceRoughness = 0.8 + broad * 0.2;
    } else if (type === 'metal' || type === 'armor') {
      const brush = noise(u, v, 256, seed + 4);
      const scratch = Math.pow(Math.max(0, Math.sin(TAU * (u * 137 + v * 3 + broad * 0.14))), 55) * smooth(clamp((noise(u, v, 24, seed + 8) - 0.48) * 7));
      const pits = Math.pow(noise(u, v, 180, seed + 12), 12);
      const corrosion = smooth(clamp((broad - 0.58) * 4));
      height = 0.5 + (brush - 0.5) * 0.035 - scratch * 0.045 - pits * 0.09;
      shade = 0.77 + broad * 0.2 + scratch * 0.05 - corrosion * 0.12 - pits * 0.06;
      surfaceRoughness = 0.66 + broad * 0.27 + scratch * 0.06 + corrosion * 0.15;
      red = 1 + corrosion * 0.035; blue = 1 - corrosion * 0.07;
    } else if (type === 'chitin') {
      const striae = Math.pow(0.5 + Math.sin(TAU * (u * 96 + Math.sin(v * TAU * 7) * 0.11 + broad * 0.5)) * 0.5, 18);
      const pores = Math.pow(noise(u, v, 180, seed + 10), 10);
      const wet = smooth(clamp((noise(u, v, 11, seed + 30) - 0.58) * 5));
      height = 0.5 + broad * 0.07 + striae * 0.04 - pores * 0.07 + grain * 0.012;
      shade = 0.72 + broad * 0.2 + striae * 0.045 - pores * 0.08;
      surfaceRoughness = 0.8 + broad * 0.18 - wet * 0.16;
      red = 0.96 + broad * 0.04; blue = 1.01;
    } else if (type === 'skin' || type === 'humanSkin' || type === 'leather') {
      const pores = Math.pow(noise(u, v, type === 'humanSkin' ? 192 : 128, seed + 13), 10);
      const grainFine = noise(u, v, 256, seed + 17);
      const folds = Math.pow(1 - Math.abs(Math.sin(TAU * (v * 31 + noise(u, v, 12, seed + 9) * 0.45))), 18);
      const pigment = noise(u + broad * 0.012, v, 96, seed + 30);
      const spot = type === 'skin' ? smooth(clamp((pigment - 0.59) * 7)) : 0;
      height = 0.5 + broad * 0.07 - pores * 0.075 + grainFine * 0.025 - folds * 0.026;
      shade = type === 'humanSkin' ? 0.88 + broad * 0.1 - pores * 0.035 : 0.82 + broad * 0.14 - spot * 0.11 - pores * 0.05;
      surfaceRoughness = 0.83 + broad * 0.15 - pores * 0.05;
      if (type === 'skin') { red = 1.01; green = 0.99; blue = 0.94 - spot * 0.05; }
      if (type === 'humanSkin') {
        const blood = noise(u, v, 9, seed + 42);
        red = 1.02 + blood * 0.018; green = 0.985; blue = 0.97 + (1 - blood) * 0.015;
      }
    } else if (type === 'fabric' || type === 'net') {
      const weave = Math.sin(u * TAU * 192) * Math.sin(v * TAU * 192);
      height = 0.5 + weave * 0.06 + broad * 0.06;
      shade = 0.78 + weave * 0.028 + broad * 0.1;
      if (type === 'net') {
        const diamond = Math.min(Math.abs(Math.sin(TAU * (u * 8 + v * 8))), Math.abs(Math.sin(TAU * (u * 8 - v * 8))));
        alpha = diamond < 0.2 ? 1 : 0;
      }
      surfaceRoughness = 0.88;
    } else if (type === 'bone') {
      const pores = Math.pow(noise(u, v, 100, seed), 4);
      height = 0.5 + broad * 0.1 - pores * 0.14;
      shade = 0.77 + broad * 0.18 - pores * 0.2;
      surfaceRoughness = 0.68 + broad * 0.27;
    } else if (type === 'leaf') {
      const width = Math.pow(Math.sin(v * Math.PI), 0.7) * 0.47;
      alpha = Math.abs(u - 0.5) < width ? 1 : 0;
      const midrib = Math.exp(-Math.abs(u - 0.5) * 150);
      const veins = Math.pow(Math.max(0, Math.cos(TAU * (v * 12 + Math.abs(u - 0.5) * 7))), 24);
      height = broad * 0.15 + midrib * 0.17 + veins * 0.05;
      shade = 0.48 + broad * 0.3 + midrib * 0.18 + veins * 0.14;
      surfaceRoughness = 0.7 + broad * 0.25;
    }
    heights[pixel] = height;
    albedo[at] = Math.round(clamp(shade * red) * 255);
    albedo[at + 1] = Math.round(clamp(shade * green) * 255);
    albedo[at + 2] = Math.round(clamp(shade * blue) * 255);
    albedo[at + 3] = alpha * 255;
    const r = Math.round(clamp(surfaceRoughness) * 255);
    rough[at] = r; rough[at + 1] = r; rough[at + 2] = r; rough[at + 3] = 255;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = (y * size + x) * 4;
    const dx = (heights[y * size + (x + 1) % size] - heights[y * size + (x + size - 1) % size]) * definition.relief;
    const dy = (heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x]) * definition.relief;
    const length = Math.hypot(dx, dy, 1);
    normal[at] = Math.round((0.5 - dx / length * 0.5) * 255);
    normal[at + 1] = Math.round((0.5 - dy / length * 0.5) * 255);
    normal[at + 2] = Math.round((0.5 + 1 / length * 0.5) * 255);
    normal[at + 3] = 255;
  }
  return { size, albedo, rough, normal };
}

function getMaps(type, repeat) {
  const key = `${type}:${repeat[0]}:${repeat[1]}`;
  if (views.has(key)) return views.get(key);
  if (!sources.has(type)) sources.set(type, buildSource(type));
  const source = sources.get(type);
  const result = {};
  for (const [channel, data] of [['map', source.albedo], ['normalMap', source.normal], ['roughnessMap', source.rough]]) {
    const texture = new THREE.DataTexture(data, source.size, source.size, THREE.RGBAFormat);
    texture.name = `${type}-${channel}`;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = anisotropy;
    texture.colorSpace = channel === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.needsUpdate = true;
    result[channel] = texture;
  }
  views.set(key, result);
  return result;
}

export function createSurfaceMaterial(type, options = {}) {
  if (!SURFACES[type]) throw new Error(`Unknown surface: ${type}`);
  const { repeat = [1, 1], ...parameters } = options;
  const tiles = typeof repeat === 'number' ? [repeat, repeat] : repeat;
  if (tiles.length !== 2 || !tiles.every(n => Number.isFinite(n) && n > 0)) throw new Error('Surface repeat must contain two positive numbers.');
  const definition = SURFACES[type];
  const maps = getMaps(type, tiles);
  const cutout = type === 'leaf' || type === 'net';
  const normalStrength = { skin: 0.28, humanSkin: 0.18, chitin: 0.32, armor: 0.3, metal: 0.28, bone: 0.35, leather: 0.4 }[type] ?? 0.7;
  const reflectionStrength = { skin: 0.32, humanSkin: 0.28, chitin: 0.6, armor: 0.8, metal: 0.9, bone: 0.4, leather: 0.35 }[type] ?? 0.6;
  const material = new THREE.MeshStandardMaterial({
    color: definition.color, roughness: definition.roughness, metalness: definition.metalness,
    ...maps, normalScale: new THREE.Vector2(normalStrength, normalStrength), envMapIntensity: reflectionStrength,
    ...(cutout ? { alphaTest: 0.45, side: THREE.DoubleSide } : {}), ...parameters
  });
  material.name = `${type}-pbr`;
  material.userData.surfaceType = type;
  return material;
}

export function setTextureAnisotropy(max) {
  anisotropy = Math.max(1, Math.min(8, Math.floor(Number(max) || 1)));
  for (const maps of views.values()) for (const texture of Object.values(maps)) {
    if (texture.anisotropy !== anisotropy) { texture.anisotropy = anisotropy; texture.needsUpdate = true; }
  }
}

export function getSurfaceStats() {
  return {
    types: [...sources.keys()], textureViews: views.size * 3,
    sourceBytes: [...sources.values()].reduce((total, s) => total + s.albedo.byteLength + s.normal.byteLength + s.rough.byteLength, 0),
    resolutions: Object.fromEntries([...sources].map(([type, s]) => [type, s.size])), anisotropy
  };
}

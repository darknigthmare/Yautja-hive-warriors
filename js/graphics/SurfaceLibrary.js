/* Tileable PBR surfaces, generated once and shared for the lifetime of the game.
 * All maps work in Node and the browser; no canvas, CDN or runtime download.
 */
import * as THREE from 'three';

const SURFACES = {
  soil: { size: 1024, color: 0x766b54, roughness: 0.98, metalness: 0, relief: 1.3 },
  stone: { size: 1024, color: 0x8c9094, roughness: 0.88, metalness: 0.02, relief: 1.4 },
  metal: { size: 1024, color: 0x8e9ba5, roughness: 0.62, metalness: 0.8, relief: 2.4 },
  armor: { size: 2048, color: 0x929b98, roughness: 0.6, metalness: 0.68, relief: 3.2 },
  bark: { size: 1024, color: 0x756556, roughness: 1, metalness: 0, relief: 1.1 },
  wood: { size: 512, color: 0xa99372, roughness: 0.92, metalness: 0, relief: 0.7 },
  chitin: { size: 2048, color: 0x35404c, roughness: 0.58, metalness: 0.03, relief: 4 },
  skin: { size: 2048, color: 0xb19b6d, roughness: 0.8, metalness: 0.02, relief: 5 },
  humanSkin: { size: 1024, color: 0xd8b59b, roughness: 0.78, metalness: 0, relief: 6 },
  fabric: { size: 512, color: 0x657166, roughness: 1, metalness: 0, relief: 1.2 },
  leather: { size: 512, color: 0x6e5746, roughness: 0.86, metalness: 0.02, relief: 1.2 },
  bone: { size: 512, color: 0xc8bd98, roughness: 0.76, metalness: 0, relief: 0.75 },
  leaf: { size: 512, color: 0x729359, roughness: 0.86, metalness: 0, relief: 1.3 },
  net: { size: 256, color: 0x4c4740, roughness: 0.9, metalness: 0.05, relief: 1 }
};
const sources = new Map();
const views = new Map();
let anisotropy = 1;
// Coatings are material properties, not new images. The model must place exposed
// edge trim itself: a repeating UV map cannot identify a mesh's worn edges.
const FINISHES = {
  painted: { metalness: 0.08, roughness: 0.82, envMapIntensity: 0.45 },
  bare: { metalness: 0.88, roughness: 0.52, envMapIntensity: 0.72 },
  matte: { metalness: 0.12, roughness: 0.91, envMapIntensity: 0.35 }
};
const TAU = Math.PI * 2;
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const fract = n => n - Math.floor(n);
const smooth = n => n * n * (3 - 2 * n);
function hash(x, y, seed) {
  let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(u, v, cells, seed, cellsY = cells) {
  const x = u * cells, y = v * cellsY;
  const ix = Math.floor(x), iy = Math.floor(y);
  const tx = smooth(fract(x)), ty = smooth(fract(y));
  // Domain warps can cross zero. Positive modulo preserves periodicity there.
  const x0 = (ix % cells + cells) % cells, x1 = (x0 + 1) % cells;
  const y0 = (iy % cellsY + cellsY) % cellsY, y1 = (y0 + 1) % cellsY;
  const a = hash(x0, y0, seed), b = hash(x1, y0, seed);
  const c = hash(x0, y1, seed), d = hash(x1, y1, seed);
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
  // Relief uses a 512-texel reference tile. Without this factor, increasing a
  // map's resolution flattens its finite differences and loses pores in RGB8.
  const normalRelief = definition.relief * size / 512;
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
      const strata = noise(u + (broad - 0.5) * 0.03, v, 20, seed + 15, 48);
      const fractures = smooth(clamp((0.24 - strata) * 7));
      const mineral = noise(u, v, 128, seed + 16);
      height = broad * 0.62 + mineral * 0.11 - fractures * 0.08 + grain * 0.035;
      shade = 0.6 + broad * 0.3 + (mineral - 0.5) * 0.08 - fractures * 0.09;
      surfaceRoughness = 0.84 + broad * 0.15 - mineral * 0.045;
    } else if (type === 'bark') {
      const fibres = noise(u + (noise(u, v, 8, seed) - 0.5) * 0.04, v, 52, seed + 2, 5);
      const plates = noise(u, v, 14, seed + 7, 3);
      const fissures = smooth(clamp((0.36 - fibres) * 5));
      height = 0.5 + (fibres - 0.5) * 0.24 + (plates - 0.5) * 0.14 - fissures * 0.09 + (grain - 0.5) * 0.035;
      shade = 0.69 + broad * 0.16 + fibres * 0.12 - fissures * 0.09;
      surfaceRoughness = 0.88 + noise(u, v, 160, seed + 17) * 0.1;
    } else if (type === 'wood') {
      // Sawn timber: the long grain runs along V. Separate from rough tree bark.
      const growth = noise(u + (noise(u, v, 7, seed) - 0.5) * 0.018, v, 112, seed + 2, 4);
      const fibres = noise(u, v, 224, seed + 8, 9);
      const saw = noise(u, v, 160, seed + 9, 84);
      height = 0.5 + (growth - 0.5) * 0.035 + (fibres - 0.5) * 0.012 + (saw - 0.5) * 0.006;
      shade = 0.83 + broad * 0.105 + (growth - 0.5) * 0.075 + (fibres - 0.5) * 0.03;
      surfaceRoughness = 0.88 + saw * 0.1 - growth * 0.025;
      green = 0.99; blue = 0.97;
    } else if (type === 'metal' || type === 'armor') {
      const brush = noise(u, v, 256, seed + 4, type === 'armor' ? 80 : 24);
      const scoring = noise(u, v, 128, seed + 8, 8);
      const scratch = smooth(clamp((0.28 - scoring) * 8)) * smooth(clamp((noise(u, v, 24, seed + 18) - 0.45) * 4));
      const pits = Math.pow(noise(u, v, 180, seed + 12), 10);
      const hammer = type === 'armor' ? noise(u, v, 72, seed + 19) : 0.5;
      const corrosion = smooth(clamp((broad - 0.58) * 4));
      height = 0.5 + (brush - 0.5) * 0.025 + (hammer - 0.5) * 0.045 - scratch * 0.025 - pits * 0.045;
      shade = 0.82 + broad * 0.14 + brush * 0.025 + (hammer - 0.5) * 0.035 - scratch * 0.035 - corrosion * 0.06 - pits * 0.045;
      surfaceRoughness = 0.68 + broad * 0.2 + (brush - 0.5) * 0.08 + scratch * 0.09 + corrosion * 0.12;
      red = 1 + corrosion * 0.025; blue = 1 - corrosion * 0.05;
    } else if (type === 'chitin') {
      const fibres = noise(u + (broad - 0.5) * 0.02, v, 156, seed + 9, 18);
      const pores = Math.pow(noise(u, v, 180, seed + 10), 10);
      const wet = smooth(clamp((noise(u, v, 11, seed + 30) - 0.54) * 5));
      const grooves = smooth(clamp((0.37 - fibres) * 5));
      height = 0.5 + (fibres - 0.5) * 0.035 + broad * 0.018 - pores * 0.027 - grooves * 0.022;
      shade = 0.8 + broad * 0.11 + (fibres - 0.5) * 0.025 - grooves * 0.035 - pores * 0.04;
      surfaceRoughness = 0.84 + broad * 0.12 - wet * 0.25 + grooves * 0.04;
      red = 0.98; blue = 1.01;
    } else if (type === 'humanSkin') {
      // Facial pores do not share the leather folds used by straps and rubber.
      const pores = Math.pow(noise(u, v, 192, seed + 13), 8);
      const grainFine = noise(u, v, 256, seed + 17);
      const blood = noise(u, v, 9, seed + 42);
      height = 0.5 + broad * 0.015 + (grainFine - 0.5) * 0.012 - pores * 0.022;
      shade = 0.875 + broad * 0.095 - pores * 0.018 + blood * 0.015;
      surfaceRoughness = 0.84 + broad * 0.1 - pores * 0.025 + (grainFine - 0.5) * 0.015;
      red = 1.015 + blood * 0.02; green = 0.987; blue = 0.97 + (1 - blood) * 0.015;
    } else if (type === 'skin') {
      const pores = Math.pow(noise(u, v, 128, seed + 13), 8);
      const grainFine = noise(u, v, 256, seed + 17);
      const creases = smooth(clamp((0.35 - noise(u, v, 46, seed + 9, 12)) * 5));
      const pigment = noise(u + broad * 0.012, v, 96, seed + 30);
      const spot = smooth(clamp((pigment - 0.59) * 7));
      height = 0.5 + broad * 0.03 - pores * 0.038 + grainFine * 0.014 - creases * 0.018;
      shade = 0.82 + broad * 0.14 - spot * 0.11 - pores * 0.04;
      surfaceRoughness = 0.83 + broad * 0.15 - pores * 0.035;
      red = 1.01; green = 0.99; blue = 0.94 - spot * 0.05;
    } else if (type === 'leather') {
      const pebble = noise(u, v, 68, seed + 13);
      const pores = Math.pow(noise(u, v, 166, seed + 17), 6);
      const creases = Math.pow(1 - Math.abs(pebble - 0.5) * 2, 8);
      height = 0.5 + (pebble - 0.5) * 0.045 - creases * 0.022 - pores * 0.018;
      shade = 0.79 + broad * 0.16 + (pebble - 0.5) * 0.04 - creases * 0.018;
      surfaceRoughness = 0.79 + broad * 0.16 + creases * 0.035 - pores * 0.035;
    } else if (type === 'fabric' || type === 'net') {
      // Four pixels per fabric thread pair at 512²; mips can filter the weave.
      const threads = type === 'fabric' ? 128 : 64;
      const warp = Math.pow(0.5 + Math.cos(u * TAU * threads) * 0.5, 2);
      const weft = Math.pow(0.5 + Math.cos(v * TAU * threads) * 0.5, 2);
      const crossing = Math.cos(u * TAU * threads / 2) * Math.cos(v * TAU * threads / 2);
      const yarn = noise(u, v, 192, seed + 20);
      height = 0.5 + (warp + weft) * 0.018 + crossing * (warp - weft) * 0.01 + (yarn - 0.5) * 0.008;
      shade = 0.86 + broad * 0.085 + (warp + weft - 1) * 0.025 + (yarn - 0.5) * 0.02;
      if (type === 'net') {
        const diamond = Math.min(Math.abs(Math.sin(TAU * (u * 8 + v * 8))), Math.abs(Math.sin(TAU * (u * 8 - v * 8))));
        alpha = diamond < 0.2 ? 1 : 0;
      }
      surfaceRoughness = 0.88 + broad * 0.08 - (warp + weft) * 0.015 + (yarn - 0.5) * 0.025;
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
    const dx = (heights[y * size + (x + 1) % size] - heights[y * size + (x + size - 1) % size]) * normalRelief;
    const dy = (heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x]) * normalRelief;
    const length = Math.hypot(dx, dy, 1);
    normal[at] = Math.round((0.5 - dx / length * 0.5) * 255);
    normal[at + 1] = Math.round((0.5 - dy / length * 0.5) * 255);
    normal[at + 2] = Math.round((0.5 + 1 / length * 0.5) * 255);
    normal[at + 3] = 255;
  }
  return { size, albedo, rough, normal, textureSources: {} };
}

function getMaps(type, repeat) {
  const key = `${type}:${repeat[0]}:${repeat[1]}`;
  if (views.has(key)) return views.get(key);
  if (!sources.has(type)) sources.set(type, buildSource(type));
  const source = sources.get(type);
  const result = {};
  for (const [channel, data] of [['map', source.albedo], ['normalMap', source.normal], ['roughnessMap', source.rough]]) {
    const texture = new THREE.DataTexture(data, source.size, source.size, THREE.RGBAFormat);
    // Repeat is a per-view UV transform, not a sampler property in Three r160.
    // Sharing Source, rather than only its Uint8Array, also permits WebGL to
    // reuse the native texture for repeat views with the same sampling settings.
    if (source.textureSources[channel]) texture.source = source.textureSources[channel];
    else source.textureSources[channel] = texture.source;
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
  if (!Object.hasOwn(SURFACES, type)) throw new Error(`Unknown surface: ${type}`);
  const { repeat = [1, 1], finish, ...parameters } = options;
  const tiles = typeof repeat === 'number' ? [repeat, repeat] : repeat;
  if ((!Array.isArray(tiles) && !ArrayBuffer.isView(tiles)) || tiles.length !== 2 || !tiles.every(n => Number.isFinite(n) && n > 0)) throw new Error('Surface repeat must contain two positive numbers.');
  if (finish !== undefined && (!Object.hasOwn(FINISHES, finish) || (type !== 'armor' && type !== 'metal'))) throw new Error(`Unsupported ${type} finish: ${finish}`);
  const definition = SURFACES[type];
  const maps = getMaps(type, tiles);
  const cutout = type === 'leaf' || type === 'net';
  const normalStrength = { skin: 0.28, humanSkin: 0.18, chitin: 0.32, armor: 0.3, metal: 0.28, wood: 0.28, fabric: 0.52, bone: 0.35, leather: 0.4 }[type] ?? 0.7;
  const reflectionStrength = { skin: 0.32, humanSkin: 0.28, chitin: 0.48, armor: 0.8, metal: 0.9, wood: 0.3, bone: 0.4, leather: 0.35 }[type] ?? 0.6;
  const material = new THREE.MeshStandardMaterial({
    color: definition.color, roughness: definition.roughness, metalness: definition.metalness,
    ...maps, normalScale: new THREE.Vector2(normalStrength, normalStrength), envMapIntensity: reflectionStrength,
    ...(cutout ? { alphaTest: 0.45, side: THREE.DoubleSide } : {}), ...(finish ? FINISHES[finish] : {}), ...parameters
  });
  material.name = `${type}-pbr`;
  material.userData.surfaceType = type;
  if (finish) material.userData.surfaceFinish = finish;
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
    types: [...sources.keys()], textureViews: views.size * 3, sharedImageSources: sources.size * 3,
    sourceBytes: [...sources.values()].reduce((total, s) => total + s.albedo.byteLength + s.normal.byteLength + s.rough.byteLength, 0),
    resolutions: Object.fromEntries([...sources].map(([type, s]) => [type, s.size])), anisotropy
  };
}

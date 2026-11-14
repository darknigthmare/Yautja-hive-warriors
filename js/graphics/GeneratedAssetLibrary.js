import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GENERATED_ASSETS } from './GeneratedAssetManifest.js';

// The template and its textures belong to this cache. Actors clone their bones
// and private materials; SceneResources must retain the template resources.
export function collectGeneratedResources(gltf, retained = new Set()) {
  gltf.scene.traverse(node => {
    if (node.geometry) retained.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material) continue;
      retained.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) retained.add(value);
    }
  });
  return retained;
}

export function createGeneratedAssetLibrary(manifest, loader = new GLTFLoader()) {
  const pending = new Map();
  const isLocalModel = url => typeof url === 'string' && /^\/models\/[a-zA-Z0-9_./-]+\.glb$/.test(url) && !url.includes('..');
  const getGeneratedAssetEntry = key => {
    const entry = Object.hasOwn(manifest, key) ? manifest[key] : null;
    if (!entry || entry.status !== 'verified') return null;
    // All shipping models use same-origin paths. Service URLs expire and may
    // expose a signature; a live Meshy response is never a runtime manifest.
    if (!isLocalModel(entry.url)) return null;
    if (entry.animationUrls !== undefined && (!entry.animationUrls || typeof entry.animationUrls !== 'object' ||
      Array.isArray(entry.animationUrls) || Object.entries(entry.animationUrls).some(([name, url]) =>
        !/^[a-zA-Z0-9_-]+$/.test(name) || !isLocalModel(url)))) return null;
    return entry;
  };
  const loadGeneratedAsset = key => {
    const entry = getGeneratedAssetEntry(key);
    if (!entry) return Promise.reject(new Error(`No verified generated asset: ${key}`));
    if (!pending.has(key)) {
      const base = import.meta.env?.BASE_URL ?? '/';
      const url = base.replace(/\/$/, '') + entry.url;
      const request = Promise.resolve().then(() => loader.loadAsync(url)).then(async gltf => {
        if (!gltf?.scene?.isObject3D) throw new Error(`Invalid generated scene: ${key}`);
        if (entry.animationUrls && Object.keys(entry.animationUrls).length) {
          const additional = await Promise.all(Object.entries(entry.animationUrls).map(async ([name, path]) => {
            const source = await loader.loadAsync(base.replace(/\/$/, '') + path);
            const clip = source?.animations?.[0];
            if (!clip?.clone || !clip.tracks?.length || !Number.isFinite(clip.duration) || clip.duration <= 0) {
              throw new Error(`Missing generated animation: ${key}/${name}`);
            }
            const copy = clip.clone(); copy.name = name;
            return copy;
          }));
          // Loader templates and their named source clips remain untouched.
          return { ...gltf, animations: [...(gltf.animations ?? []), ...additional] };
        }
        return gltf;
      }).catch(error => {
        // A failed request must not poison the cache for the rest of a session.
        pending.delete(key);
        throw error;
      });
      pending.set(key, request);
    }
    return pending.get(key);
  };
  return { getGeneratedAssetEntry, loadGeneratedAsset };
}

const library = createGeneratedAssetLibrary(GENERATED_ASSETS);
export const getGeneratedAssetEntry = library.getGeneratedAssetEntry;
export const loadGeneratedAsset = library.loadGeneratedAsset;

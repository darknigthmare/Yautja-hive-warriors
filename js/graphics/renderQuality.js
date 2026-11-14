// Rendering budgets never change model topology or gameplay simulation.
export const RENDER_QUALITY_PRESETS = Object.freeze({
  low: Object.freeze({ label: 'Performance', maxPixelRatio: 1.25, shadowSize: 1024, postprocessing: false, ambientOcclusion: false, bloomStrength: 0, anisotropy: 2 }),
  balanced: Object.freeze({ label: 'Équilibré', maxPixelRatio: 1.5, shadowSize: 1536, postprocessing: true, ambientOcclusion: false, bloomStrength: 0.16, anisotropy: 4 }),
  high: Object.freeze({ label: 'Élevé', maxPixelRatio: 1.75, shadowSize: 2048, postprocessing: true, ambientOcclusion: true, bloomStrength: 0.22, anisotropy: 8 })
});

export function normalizeRenderQuality(value) {
  return Object.hasOwn(RENDER_QUALITY_PRESETS, value) ? value : 'balanced';
}

export function isSoftwareGraphicsRenderer(rendererName = '') {
  return /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(rendererName);
}

export function getRenderQualityProfile(requested, {
  softwareRenderer = false, compact = false, webgl2 = true,
  maxTextureSize = 4096, floatTargets = true, allowSoftwareEffects = false
} = {}) {
  const quality = normalizeRenderQuality(requested);
  const limited = (softwareRenderer && !allowSoftwareEffects) || !webgl2 || !floatTargets || maxTextureSize < 2048;
  const effectiveQuality = limited ? 'low' : quality;
  const preset = RENDER_QUALITY_PRESETS[effectiveQuality];
  return {
    ...preset, quality, effectiveQuality, limited,
    maxPixelRatio: compact ? Math.min(1.25, preset.maxPixelRatio) : preset.maxPixelRatio,
    // Software rasterizers pay a large cost for shadow fill as geometry grows.
    // Keep the detailed models/textures, and reduce only the automatic effects.
    shadowSize: Math.max(1, Math.min(preset.shadowSize, maxTextureSize,
      softwareRenderer && !allowSoftwareEffects ? 512 : Infinity))
  };
}

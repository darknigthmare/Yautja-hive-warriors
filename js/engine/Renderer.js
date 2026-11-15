/* Linear HDR lighting, bounded post processing and independent co-op viewports. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { getRenderQualityProfile, normalizeRenderQuality, isSoftwareGraphicsRenderer } from '../graphics/renderQuality.js';
import { setTextureAnisotropy } from '../graphics/SurfaceLibrary.js';
import { updateCreatureDetail } from '../graphics/CreatureModels.js';
import { FrameTelemetry } from './FrameTelemetry.js';

const PALETTES = {
  rain_forest: { horizon: 0x68776f, zenith: 0x253c43, key: 0xf1e8d6, ground: 0x313e2e, accent: 0xa8bec5, clouds: 0.74, stars: 0, exposure: 1.16 },
  jungle: { horizon: 0x9fae81, zenith: 0x294953, key: 0xffe0ad, ground: 0x39442b, accent: 0x91e2bc, clouds: 0.48, stars: 0, exposure: 1.02 },
  hive_world: { horizon: 0x56415d, zenith: 0x140f25, key: 0xd1bfe5, ground: 0x30253b, accent: 0x9be9c5, clouds: 0.86, stars: 0.18, exposure: 1.16 },
  pyramid: { horizon: 0x688397, zenith: 0x18314b, key: 0xdce9ff, ground: 0x303c4b, accent: 0xffb769, clouds: 0.62, stars: 0, exposure: 1.08 },
  la_rooftops: { horizon: 0x7c5975, zenith: 0x101d3a, key: 0xd2dcff, ground: 0x303341, accent: 0xffb15d, clouds: 0.70, stars: 0.30, exposure: 1.13 },
  romulus_station: { horizon: 0x32455d, zenith: 0x030919, key: 0xbddeef, ground: 0x24323e, accent: 0x83e5ef, clouds: 0, stars: 1, exposure: 1.20 },
  space_station: { horizon: 0x172a3b, zenith: 0x020914, key: 0xb3d4ea, ground: 0x1b2634, accent: 0xe2a96b, clouds: 0, stars: 1, exposure: 1.12 },
  temple: { horizon: 0x676960, zenith: 0x182b3e, key: 0xc7d9e1, ground: 0x333a2b, accent: 0x7fb8bc, clouds: .56, stars: .45, exposure: 1.12 },
  stargazer: { horizon: 0x9c906d, zenith: 0x3b6272, key: 0xffe0b3, ground: 0x49432c, accent: 0xd2ad68, clouds: .44, stars: 0, exposure: 1.10 },
  comanche_territory: { horizon: 0xa9af8b, zenith: 0x557b82, key: 0xffe5bc, ground: 0x42442a, accent: 0x9db6a7, clouds: .46, stars: 0, exposure: 1.10 },
  killer_of_killers: { horizon: 0x2f4c5c, zenith: 0x061329, key: 0xb4d5e6, ground: 0x25323b, accent: 0x7bbac1, clouds: .3, stars: .8, exposure: 1.15 }
};

export class EngineRenderer {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x162832);
    this.scene.fog = new THREE.FogExp2(0x243d43, 0.011);
    this.camera = new THREE.PerspectiveCamera(56, 1, 0.15, 600);
    this.camera.position.set(0, 12, 18);
    this.camera.lookAt(0, 1.5, 0);
    this.cameraP2 = this.camera.clone();
    this._soloDetailCameras = [this.camera];
    this._coopDetailCameras = [this.camera, this.cameraP2];
    this.isSplitScreen = false;
    this.needsRender = true;
    this._onVisualReady = () => this.requestRender();
    this.scene.addEventListener('visual-ready', this._onVisualReady);
    this.contextLost = false;
    this.composer = null;
    this.passes = [];
    this._focus = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._lightOffset = new THREE.Vector3(-22, 38, 19);
    this._rimOffset = new THREE.Vector3(15, 16, -28);
    this._lastRenderTime = 0;
    this._skyTime = 0;
    this.lightningFlashTimer = 0;
    this.flashDuration = .35;
    this.baseAmbientIntensity = .85;
    this.baseDirIntensity = 3.4;
    this.currentSkyColor = 0xe2eadb;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.domElement.setAttribute('aria-label', 'Vue 3D du champ de bataille');
    this.container.appendChild(this.renderer.domElement);
    const gl = this.renderer.getContext();
    const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
    this.graphicsRendererName = rendererInfo ? gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL) : '';
    this.softwareRenderer = isSoftwareGraphicsRenderer(this.graphicsRendererName);
    this.frameTelemetry = new FrameTelemetry({ softwareRenderer: this.softwareRenderer });

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environmentTarget = pmrem.fromScene(room, 0.045);
    this.scene.environment = this.environmentTarget.texture;
    room.dispose();
    pmrem.dispose();

    // Directional contrast reveals carved normals and layered armor surfaces.
    this.ambientLight = new THREE.HemisphereLight(0xc0dfe4, 0x313e2e, 0.85);
    this.scene.add(this.ambientLight);
    this.dirLight = new THREE.DirectionalLight(0xe2eadb, 3.4);
    this.dirLight.position.copy(this._lightOffset);
    this.dirLight.castShadow = true;
    Object.assign(this.dirLight.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 110 });
    this.dirLight.shadow.bias = -0.00018;
    this.dirLight.shadow.normalBias = 0.022;
    this.dirLight.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.dirLight, this.dirLight.target);
    this.rimLight = new THREE.DirectionalLight(0xa8bec5, 0.65);
    this.scene.add(this.rimLight, this.rimLight.target);
    this.createSky();

    this._onResize = () => this.onWindowResize();
    window.addEventListener('resize', this._onResize);
    this._onContextLost = event => {
      event.preventDefault(); this.contextLost = true;
      this.container.setAttribute('data-render-status', 'context-lost');
    };
    this._onContextRestored = () => {
      this.contextLost = false; this.container.removeAttribute('data-render-status');
      this.setQuality(this.quality, { persist: false });
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this._onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this._onContextRestored);
    let storedQuality = 'balanced';
    try { storedQuality = localStorage.getItem('yautja_graphics_quality') || 'balanced'; } catch { /* Optional persistence. */ }
    this.setQuality(storedQuality, { persist: false });
  }

  createSky() {
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        horizon: { value: new THREE.Color(0x47656a) }, zenith: { value: new THREE.Color(0x0c202d) },
        glow: { value: new THREE.Color(0xa2d6d5) }, cloudCover: { value: 0.74 }, stars: { value: 0 }, time: { value: 0 }
      },
      vertexShader: `varying vec3 vDirection;
        void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 horizon; uniform vec3 zenith; uniform vec3 glow;
        uniform float cloudCover; uniform float stars; uniform float time; varying vec3 vDirection;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y);
        }
        float cloudNoise(vec2 p) { return noise(p)*0.57 + noise(p*2.07)*0.28 + noise(p*4.13)*0.15; }
        void main() {
          vec3 direction = normalize(vDirection);
          float height = smoothstep(-0.08, 0.82, direction.y);
          vec3 color = mix(horizon, zenith, height);
          vec3 sunDir = normalize(vec3(-0.45, 0.30, -0.75));
          float alignment = max(dot(direction, sunDir), 0.0);
          color += glow * pow(alignment, 18.0) * 0.13;
          vec2 cloudUV = direction.xz / max(0.25, direction.y + 0.45) * 3.0 + vec2(time * 0.006, time * 0.002);
          float clouds = smoothstep(0.40, 0.79, cloudNoise(cloudUV)) * cloudCover;
          clouds *= smoothstep(-0.07, 0.20, direction.y);
          vec3 cloudColor = mix(horizon*1.12, glow*0.75, pow(alignment, 5.0));
          color = mix(color, cloudColor, clouds * 0.55);
          vec2 starUV = vec2(atan(direction.x, direction.z), asin(clamp(direction.y, -1.0, 1.0))) * vec2(220.0, 150.0);
          vec2 cell = floor(starUV); vec2 point = fract(starUV) - 0.5;
          float sparkle = step(0.992, hash(cell)) * (1.0-smoothstep(0.025, 0.11, length(point)));
          color += vec3(0.70,0.80,1.0) * sparkle * stars * smoothstep(0.08,0.6,direction.y) * (1.0-clouds);
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 20), this.skyMaterial);
    this.sky.renderOrder = -100;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  setQuality(value, { persist = true, allowSoftwareEffects = false } = {}) {
    this.quality = normalizeRenderQuality(value);
    this.qualityProfile = getRenderQualityProfile(this.quality, {
      softwareRenderer: this.softwareRenderer,
      compact: Math.min(window.innerWidth, window.innerHeight) < 700,
      webgl2: this.renderer.capabilities.isWebGL2,
      floatTargets: this.renderer.extensions.has('EXT_color_buffer_float'),
      maxTextureSize: this.renderer.capabilities.maxTextureSize,
      allowSoftwareEffects
    });
    this.maxPixelRatio = this.qualityProfile.maxPixelRatio;
    this.scene.userData.graphicsQuality = this.qualityProfile.effectiveQuality;
    this.container.setAttribute('data-graphics-quality', this.qualityProfile.effectiveQuality);
    this.dirLight.shadow.mapSize.set(this.qualityProfile.shadowSize, this.qualityProfile.shadowSize);
    // Changing mapSize must invalidate a previously allocated shadow render target.
    if (this.dirLight.shadow.map) { this.dirLight.shadow.map.dispose(); this.dirLight.shadow.map = null; }
    this.renderer.shadowMap.needsUpdate = true;
    setTextureAnisotropy(Math.min(this.renderer.capabilities.getMaxAnisotropy(), this.qualityProfile.anisotropy));
    if (persist) { try { localStorage.setItem('yautja_graphics_quality', this.quality); } catch { /* Optional persistence. */ } }
    this.rebuildPostprocessing();
    this.onWindowResize();
    document.dispatchEvent(new CustomEvent('graphics-quality-change', { detail: this.getQualityInfo() }));
    return this.getQualityInfo();
  }

  getQuality() { return this.quality; }

  getFrameStats() { return this.frameTelemetry?.snapshot() ?? { samples: 0, gpuTimeAvailable: false }; }

  requestRender() { this.needsRender = true; }

  getQualityInfo() {
    return {
      requested: this.quality, effective: this.qualityProfile.effectiveQuality,
      softwareRenderer: this.softwareRenderer,
      postprocessing: Boolean(this.composer) && !this.isSplitScreen,
      ambientOcclusion: Boolean(this.ssaoPass) && !this.isSplitScreen,
      shadowSize: this.qualityProfile.shadowSize, maxPixelRatio: this.maxPixelRatio,
      splitScreen: this.isSplitScreen
    };
  }

  disposePostprocessing() {
    // Three r160 SSAOPass does not dispose its noise and SSAO material itself.
    this.ssaoPass?.ssaoMaterial.dispose(); this.ssaoPass?.noiseTexture.dispose();
    this.passes.forEach(pass => { pass.materialHighPassFilter?.dispose(); pass.dispose?.(); });
    this.composer?.dispose();
    this.passes = []; this.composer = null; this.ssaoPass = null; this.fxaaPass = null;
  }

  rebuildPostprocessing() {
    this.disposePostprocessing();
    if (!this.qualityProfile.postprocessing || this.isSplitScreen) return;
    this.composer = new EffectComposer(this.renderer);
    this.passes.push(new RenderPass(this.scene, this.camera));
    if (this.qualityProfile.ambientOcclusion) {
      this.ssaoPass = new SSAOPass(this.scene, this.camera, 1, 1, 16);
      this.ssaoPass.kernelRadius = 2.6;
      this.ssaoPass.minDistance = 0.001;
      this.ssaoPass.maxDistance = 0.065;
      // Keep contact shading gentle; do not turn black armor into a silhouette.
      this.ssaoPass.ssaoMaterial.fragmentShader = this.ssaoPass.ssaoMaterial.fragmentShader.replace('1.0 - occlusion', '1.0 - occlusion * 0.42');
      const overrideVisibility = this.ssaoPass.overrideVisibility.bind(this.ssaoPass);
      this.ssaoPass.overrideVisibility = () => { overrideVisibility(); this.sky.visible = false; };
      this.passes.push(this.ssaoPass);
    }
    this.passes.push(new UnrealBloomPass(new THREE.Vector2(1, 1), this.qualityProfile.bloomStrength, 0.28, 1.15));
    this.passes.push(new OutputPass());
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.passes.push(this.fxaaPass);
    this.passes.forEach(pass => this.composer.addPass(pass));
  }

  setSplitScreen(enable) {
    const changed = this.isSplitScreen !== Boolean(enable);
    this.isSplitScreen = Boolean(enable);
    if (changed) this.rebuildPostprocessing();
    this.onWindowResize();
    if (changed) document.dispatchEvent(new CustomEvent('graphics-quality-change', { detail: this.getQualityInfo() }));
  }

  updateLevelEnvironment(levelConfig = {}) {
    const palette = PALETTES[levelConfig.theme] || PALETTES.rain_forest;
    const horizon = new THREE.Color(levelConfig.fogColor ?? palette.horizon);
    horizon.lerp(new THREE.Color(palette.horizon), 0.56);
    this.scene.fog.color.copy(horizon);
    this.scene.fog.density = Number.isFinite(levelConfig.fogDensity) ? levelConfig.fogDensity * 0.84 : 0.010;
    this.scene.background.copy(horizon);
    this.skyMaterial.uniforms.horizon.value.copy(horizon);
    this.skyMaterial.uniforms.zenith.value.set(palette.zenith);
    this.skyMaterial.uniforms.glow.value.set(levelConfig.accentColor ?? palette.accent);
    this.skyMaterial.uniforms.cloudCover.value = palette.clouds;
    this.skyMaterial.uniforms.stars.value = palette.stars;
    this.ambientLight.color.set(levelConfig.ambientColor ?? 0xc0dfe4).lerp(new THREE.Color(0xd9dce0), 0.48);
    this.ambientLight.groundColor.set(palette.ground);
    this.dirLight.color.set(levelConfig.keyLightColor ?? palette.key).lerp(new THREE.Color(palette.key), 0.65);
    this.rimLight.color.set(levelConfig.accentColor ?? palette.accent).lerp(new THREE.Color(0xc3c9ce), 0.65);
    this.renderer.toneMappingExposure = palette.exposure;
    this.currentSkyColor = this.dirLight.color.getHex();
    this.baseAmbientIntensity = this.ambientLight.intensity;
    this.baseDirIntensity = this.dirLight.intensity;
    this._lightingRest = { ambient: this.ambientLight.color.getHex(), key: this.dirLight.color.getHex(), exposure: palette.exposure };
    this.requestRender();
  }

  onWindowResize() {
    this.requestRender();
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.width = width; this.height = height;
    this.camera.aspect = (this.isSplitScreen ? Math.floor(width / 2) : width) / height;
    this.cameraP2.aspect = (width - Math.floor(width / 2)) / height;
    this.camera.updateProjectionMatrix(); this.cameraP2.updateProjectionMatrix();
    const compactLimit = Math.min(width, height) < 700 ? 1.25 : this.maxPixelRatio;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio, compactLimit);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setPixelRatio(pixelRatio); this.composer.setSize(width, height);
      this.fxaaPass.uniforms.resolution.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
    }
  }

  render() {
    if (this.contextLost) return;
    this.needsRender = false;
    const now = performance.now();
    const info = this.renderer.info;
    const previousAutoReset = info.autoReset;
    info.reset(); info.autoReset = false;
    try {
    const step = this._lastRenderTime ? Math.min(0.1, Math.max(0, (now - this._lastRenderTime) / 1000)) : 0;
    this._lastRenderTime = now;
    if (!document.body?.classList.contains('reduced-motion')) this._skyTime += step;
    this.skyMaterial.uniforms.time.value = this._skyTime;
    this.camera.getWorldDirection(this._direction);
    const distance = this._direction.y < -0.05 ? Math.min(50, -this.camera.position.y / this._direction.y) : 12;
    this._focus.copy(this.camera.position).addScaledVector(this._direction, distance);
    this._focus.y = 0;
    this.dirLight.target.position.copy(this._focus);
    this.dirLight.position.copy(this._focus).add(this._lightOffset);
    this.rimLight.target.position.copy(this._focus);
    this.rimLight.position.copy(this._focus).add(this._rimOffset);
    this.sky.position.copy(this.camera.position);
    // Select geometry before shadow and color passes; co-op keeps the detail
    // required by the nearer of the two independent cameras.
    updateCreatureDetail(this.scene, this.isSplitScreen ? this._coopDetailCameras : this._soloDetailCameras);
    const width = this.width, height = this.height;
    this.renderer.setRenderTarget(null);
    this.renderer.setScissorTest(false); this.renderer.setViewport(0, 0, width, height);
    if (this.composer && !this.isSplitScreen) { this.composer.render(step); return; }
    this.renderer.clear();
    if (this.isSplitScreen) {
      const leftWidth = Math.floor(width / 2);
      this.renderer.setScissorTest(true);
      this.renderer.setViewport(0, 0, leftWidth, height); this.renderer.setScissor(0, 0, leftWidth, height);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setViewport(leftWidth, 0, width - leftWidth, height); this.renderer.setScissor(leftWidth, 0, width - leftWidth, height);
      this.renderer.render(this.scene, this.cameraP2);
      this.renderer.setScissorTest(false); this.renderer.setViewport(0, 0, width, height);
    } else this.renderer.render(this.scene, this.camera);
    } finally {
      this.frameTelemetry?.record({ startedAt: now, endedAt: performance.now(), render: info.render, memory: info.memory,
        views: this.isSplitScreen ? 2 : 1, postprocessing: Boolean(this.composer) && !this.isSplitScreen });
      info.autoReset = previousAutoReset;
    }
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.scene.removeEventListener('visual-ready', this._onVisualReady);
    this.renderer.domElement.removeEventListener('webglcontextlost', this._onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this._onContextRestored);
    this.disposePostprocessing();
    this.environmentTarget.dispose(); this.sky.geometry.dispose(); this.skyMaterial.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }

  triggerLightningFlash(color = 0xd8ecff, intensity = 4.8) {
    if (globalThis.document?.body?.classList.contains('reduced-flashes')) return;
    this.lightningFlashTimer = this.flashDuration;
    this.ambientLight.color.setHex(color);
    this.dirLight.color.setHex(color);
    this.ambientLight.intensity = this.baseAmbientIntensity + intensity * 0.7;
    this.dirLight.intensity = this.baseDirIntensity + intensity;
  }

  setVisionMode(mode) {
    this._visionMode = mode;
    if (mode === 'thermal') {
      this.ambientLight.color.setHex(0x1a2b4c);
      this.dirLight.color.setHex(0xff7700);
      this.renderer.toneMappingExposure = 1.35;
    } else if (mode === 'tech') {
      this.ambientLight.color.setHex(0x0e2f3d);
      this.dirLight.color.setHex(0x00d2ff);
      this.renderer.toneMappingExposure = 1.2;
    } else if (mode === 'neuro') {
      this.ambientLight.color.setHex(0x193315);
      this.dirLight.color.setHex(0x84cc16);
      this.renderer.toneMappingExposure = 1.25;
    } else {
      this.ambientLight.color.setHex(this._lightingRest?.ambient ?? 0xc0dfe4);
      this.dirLight.color.setHex(this.currentSkyColor);
      this.renderer.toneMappingExposure = this._lightingRest?.exposure ?? 1.12;
    }
    this.requestRender();
  }

  update(delta) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    if (this.lightningFlashTimer > 0) {
      this.lightningFlashTimer -= delta;
      const t = Math.max(0, this.lightningFlashTimer / this.flashDuration);
      this.ambientLight.intensity = THREE.MathUtils.lerp(this.baseAmbientIntensity, this.baseAmbientIntensity + 3.0, t);
      this.dirLight.intensity = THREE.MathUtils.lerp(this.baseDirIntensity, this.baseDirIntensity + 4.5, t);

      if (this.lightningFlashTimer <= 0) {
        this.setVisionMode(this._visionMode);
      }
      this.requestRender();
    }
  }
}

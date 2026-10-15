/* Three.js Scene, Camera, Lighting & Renderer Setup (Split-Screen Co-Op Enabled) */

import * as THREE from 'three';

export class EngineRenderer {
  constructor(container) {
    this.container = container;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07090e);
    this.scene.fog = new THREE.FogExp2(0x0a1c30, 0.015);

    // Camera Player 1
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 12, 18);

    // Camera Player 2 (Co-Op)
    this.cameraP2 = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.cameraP2.position.set(0, 12, 18);

    this.isSplitScreen = false;

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);

    // Lighting
    this.baseAmbientIntensity = 1.2;
    this.baseDirIntensity = 2.0;
    this.lightningFlashTimer = 0;
    this.flashDuration = 0.35;

    this.ambientLight = new THREE.AmbientLight(0x223344, this.baseAmbientIntensity);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xaaccff, this.baseDirIntensity);
    this.dirLight.position.set(30, 50, 20);
    this.scene.add(this.dirLight);

    this.currentSkyColor = 0xaaccff;
    this.currentFogColor = 0x0a1c30;
    this.currentFogDensity = 0.015;

    window.addEventListener('resize', () => this.onWindowResize());
  }

  setSplitScreen(enable) {
    this.isSplitScreen = enable;
    this.onWindowResize();
  }

  updateLevelEnvironment(levelConfig) {
    this.currentSkyColor = levelConfig.skyColor;
    this.currentFogColor = levelConfig.fogColor;
    this.currentFogDensity = levelConfig.fogDensity !== undefined ? levelConfig.fogDensity : 0.015;

    this.scene.background = new THREE.Color(levelConfig.skyColor);
    this.scene.fog = new THREE.FogExp2(this.currentFogColor, this.currentFogDensity);
    this.dirLight.color.setHex(levelConfig.skyColor);
  }

  triggerLightningFlash(color = 0xd8ecff, intensity = 4.8) {
    this.lightningFlashTimer = this.flashDuration;
    this.ambientLight.color.setHex(color);
    this.dirLight.color.setHex(color);
    this.ambientLight.intensity = this.baseAmbientIntensity + intensity * 0.7;
    this.dirLight.intensity = this.baseDirIntensity + intensity;
  }

  setVisionMode(mode) {
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
      this.ambientLight.color.setHex(0x223344);
      this.dirLight.color.setHex(this.currentSkyColor);
      this.renderer.toneMappingExposure = 1.1;
    }
  }

  update(delta) {
    if (this.lightningFlashTimer > 0) {
      this.lightningFlashTimer -= delta;
      const t = Math.max(0, this.lightningFlashTimer / this.flashDuration);
      this.ambientLight.intensity = THREE.MathUtils.lerp(this.baseAmbientIntensity, this.baseAmbientIntensity + 3.0, t);
      this.dirLight.intensity = THREE.MathUtils.lerp(this.baseDirIntensity, this.baseDirIntensity + 4.5, t);

      if (this.lightningFlashTimer <= 0) {
        this.dirLight.color.setHex(this.currentSkyColor);
        this.ambientLight.color.setHex(0x223344);
      }
    }
  }

  onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (this.isSplitScreen) {
      this.camera.aspect = (w / 2) / h;
      this.cameraP2.aspect = (w / 2) / h;
      this.camera.updateProjectionMatrix();
      this.cameraP2.updateProjectionMatrix();
    } else {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    this.renderer.setSize(w, h);
  }

  render() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (this.isSplitScreen) {
      // Left Viewport (Player 1)
      this.renderer.setViewport(0, 0, w / 2, h);
      this.renderer.setScissor(0, 0, w / 2, h);
      this.renderer.setScissorTest(true);
      this.renderer.render(this.scene, this.camera);

      // Right Viewport (Player 2)
      this.renderer.setViewport(w / 2, 0, w / 2, h);
      this.renderer.setScissor(w / 2, 0, w / 2, h);
      this.renderer.setScissorTest(true);
      this.renderer.render(this.scene, this.cameraP2);

      this.renderer.setScissorTest(false);
    } else {
      this.renderer.setViewport(0, 0, w, h);
      this.renderer.render(this.scene, this.camera);
    }
  }
}

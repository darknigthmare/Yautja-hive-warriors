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
    this.ambientLight = new THREE.AmbientLight(0x223344, 1.2);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xaaccff, 2.0);
    this.dirLight.position.set(30, 50, 20);
    this.scene.add(this.dirLight);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  setSplitScreen(enable) {
    this.isSplitScreen = enable;
    this.onWindowResize();
  }

  updateLevelEnvironment(levelConfig) {
    this.scene.background = new THREE.Color(levelConfig.skyColor);
    this.scene.fog = new THREE.FogExp2(levelConfig.fogColor, levelConfig.fogDensity);
    this.dirLight.color.setHex(levelConfig.skyColor);
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

/* 3D Cinematic Photo Mode & Free Orbit Camera System */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class PhotoMode {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.isActive = false;
    this.isSaving = false;

    this.hud = document.getElementById('photo-mode-hud');
    this.origCamPos = new THREE.Vector3();
    this.origCamQuat = new THREE.Quaternion();

    const canvas = this.renderer.renderer.domElement;
    this._canvas = canvas;
    this._canvasTouchAction = canvas.style.touchAction;
    this._canvasCursor = canvas.style.cursor;
    // OrbitControls performs an initial lookAt: do not change the gameplay camera
    // when merely constructing a disabled photo controller.
    const initialPosition = camera.position.clone();
    const initialQuaternion = camera.quaternion.clone();
    this.controls = new OrbitControls(camera, canvas);
    this.controls.enabled = false;
    this.controls.enableDamping = false;
    this.controls.autoRotate = false;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 45;
    this.controls.minPolarAngle = 0.04;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.7;
    this.controls.screenSpacePanning = false;
    this.controls.maxTargetRadius = 12;
    camera.position.copy(initialPosition);
    camera.quaternion.copy(initialQuaternion);
    canvas.style.touchAction = this._canvasTouchAction;
    this._onCameraChange = () => {
      if (this.isActive) this.renderer.requestRender?.();
    };
    this._onOrbitStart = () => { if (this.isActive) canvas.style.cursor = 'grabbing'; };
    this._onOrbitEnd = () => { if (this.isActive) canvas.style.cursor = 'grab'; };
    this.controls.addEventListener('change', this._onCameraChange);
    this.controls.addEventListener('start', this._onOrbitStart);
    this.controls.addEventListener('end', this._onOrbitEnd);
  }

  toggle(playerPos) {
    this.isActive = !this.isActive;

    if (this.isActive) {
      this.origCamPos.copy(this.camera.position);
      this.origCamQuat.copy(this.camera.quaternion);
      if (window.game?.ui) window.game.ui.showScreen(this.hud);
      else if (this.hud) this.hud.classList.remove('hidden');

      // Freeze combat, then frame the hunter's torso and allow deliberate orbit,
      // zoom and ground-plane pan. No damping means no idle GPU animation loop.
      this.camera.position.set(playerPos.x, playerPos.y + 3, playerPos.z + 8);
      this.controls.target.set(playerPos.x, playerPos.y + 2.2, playerPos.z);
      this.controls.cursor.copy(this.controls.target);
      this.controls.enabled = true;
      this._canvas.style.touchAction = 'none';
      this._canvas.style.cursor = 'grab';
      this.controls.update();
    } else {
      this.controls.enabled = false;
      this._canvas.style.touchAction = this._canvasTouchAction;
      this._canvas.style.cursor = this._canvasCursor;
      if (window.game?.ui) window.game.ui.showScreen(window.game.ui.inGameHud);
      else if (this.hud) this.hud.classList.add('hidden');
      this.camera.position.copy(this.origCamPos);
      this.camera.quaternion.copy(this.origCamQuat);
    }

    this.renderer.requestRender?.();

    return this.isActive;
  }

  async takeSnapshot() {
    if (!this.isActive || this.isSaving) return false;
    this.isSaving = true;
    const button = document.getElementById('btn-snap-photo');
    const label = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'EXPORT PNG EN COURS…';
    }
    let url;
    try {
      if (this.renderer.contextLost) throw new Error('WebGL context is unavailable');
      // Capture immediately after rendering, before WebGL clears its drawing buffer.
      // Blob encoding avoids a large synchronous base64 string on detailed scenes.
      this.renderer.render();
      const blob = await new Promise(resolve => {
        this.renderer.renderer.domElement.toBlob(resolve, 'image/png');
      });
      if (!blob) throw new Error('PNG encoding failed');
      url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'Yautja_Trophy_Shot.png';
      link.href = url;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); }
      return true;
    } catch (error) {
      console.warn('Photo export failed:', error);
      window.game?.ui?.showAnnouncement('Capture impossible. Réessayez.');
      return false;
    } finally {
      // Keep the URL alive long enough for the browser to start the download.
      if (url) setTimeout(() => URL.revokeObjectURL(url), 10000);
      this.isSaving = false;
      if (button) {
        button.disabled = false;
        button.textContent = label;
      }
    }
  }

  dispose() {
    this.controls.enabled = false;
    this.controls.removeEventListener('change', this._onCameraChange);
    this.controls.removeEventListener('start', this._onOrbitStart);
    this.controls.removeEventListener('end', this._onOrbitEnd);
    this.controls.dispose();
    this._canvas.style.touchAction = this._canvasTouchAction;
    this._canvas.style.cursor = this._canvasCursor;
  }
}

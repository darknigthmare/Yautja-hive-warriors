/* 3D Cinematic Photo Mode & Free Orbit Camera System */

import * as THREE from 'three';

export class PhotoMode {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.isActive = false;

    this.hud = document.getElementById('photo-mode-hud');
    this.origCamPos = new THREE.Vector3();
  }

  toggle(playerPos) {
    this.isActive = !this.isActive;

    if (this.isActive) {
      this.origCamPos.copy(this.camera.position);
      if (this.hud) this.hud.classList.remove('hidden');

      // Free orbit position in front of action
      this.camera.position.set(playerPos.x, playerPos.y + 3, playerPos.z + 8);
      this.camera.lookAt(playerPos);
    } else {
      if (this.hud) this.hud.classList.add('hidden');
      this.camera.position.copy(this.origCamPos);
    }

    return this.isActive;
  }

  takeSnapshot() {
    const dataURL = this.renderer.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'Yautja_Trophy_Shot.png';
    link.href = dataURL;
    link.click();
  }
}

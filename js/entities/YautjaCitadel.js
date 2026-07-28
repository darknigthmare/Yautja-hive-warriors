/* 3D Yautja Mothership Citadel Room Generator */

import * as THREE from 'three';

export class YautjaCitadel {
  constructor(scene) {
    this.scene = scene;
    this.citadelGroup = new THREE.Group();
    this.scene.add(this.citadelGroup);
    this.citadelGroup.visible = false;
  }

  buildCitadelRoom(skullCount = 0) {
    // Clear old room
    while (this.citadelGroup.children.length > 0) {
      this.citadelGroup.remove(this.citadelGroup.children[0]);
    }

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.8, roughness: 0.2 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, metalness: 0.9, roughness: 0.1 });
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x3a4556, metalness: 0.85, roughness: 0.3 });
    const skullMat = new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.4 });

    // Floor
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 1, 16), floorMat);
    floor.position.y = -0.5;
    this.citadelGroup.add(floor);

    // Glowing Neon Ring
    const ringGeo = new THREE.RingGeometry(18, 18.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.citadelGroup.add(ring);

    // Pillars
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 12, 8), wallMat);
      pillar.position.set(Math.cos(angle) * 16, 6, Math.sin(angle) * 16);
      this.citadelGroup.add(pillar);
    }

    // Trophy Pedestals with Skulls
    const displayCount = Math.min(12, Math.max(4, skullCount));
    for (let i = 0; i < displayCount; i++) {
      const angle = (i / displayCount) * Math.PI * 2;
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.8, 8), pedestalMat);
      pedestal.position.set(Math.cos(angle) * 12, 0.9, Math.sin(angle) * 12);
      this.citadelGroup.add(pedestal);

      // Skull mesh on pedestal
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), skullMat);
      skull.position.set(Math.cos(angle) * 12, 2.1, Math.sin(angle) * 12);
      this.citadelGroup.add(skull);
    }
  }

  show() {
    this.citadelGroup.visible = true;
  }

  hide() {
    this.citadelGroup.visible = false;
  }
}

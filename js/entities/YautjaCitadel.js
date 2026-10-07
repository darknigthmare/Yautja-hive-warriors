/* 3D Yautja Mothership Citadel Room 2.0 - Engineer Skull & Holographic Codex Terminal */

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

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.85, roughness: 0.2 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, metalness: 0.9, roughness: 0.1 });
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x3a4556, metalness: 0.85, roughness: 0.3 });
    const skullMat = new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.4 });
    const engineerMat = new THREE.MeshStandardMaterial({ color: 0xc8d1dc, roughness: 0.25, metalness: 0.2 }); // Pale statue flesh
    const queenCrownMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, metalness: 0.9, roughness: 0.2 });

    // Floor
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 1, 16), floorMat);
    floor.position.y = -0.5;
    this.citadelGroup.add(floor);

    // Glowing Neon Holographic Rings
    const ringGeo = new THREE.RingGeometry(21, 21.6, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.citadelGroup.add(ring);

    // Pillars with Yautja Glyphs
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 14, 8), wallMat);
      pillar.position.set(Math.cos(angle) * 19, 7, Math.sin(angle) * 19);
      this.citadelGroup.add(pillar);
    }

    // 1. CENTERPIECE 1: PROMETHEUS / SPACE JOCKEY ENGINEER SKULL (LV-223)
    const engPedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 2.4, 8), pedestalMat);
    engPedestal.position.set(0, 1.2, -8);
    this.citadelGroup.add(engPedestal);

    const engineerSkull = this.createEngineerSkull(engineerMat);
    engineerSkull.position.set(0, 3.2, -8);
    engineerSkull.scale.set(1.6, 1.6, 1.6);
    this.citadelGroup.add(engineerSkull);

    // 2. CENTERPIECE 2: XENOMORPH QUEEN CROWN TROPHY
    const queenPedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 2.4, 8), pedestalMat);
    queenPedestal.position.set(-8, 1.2, 0);
    this.citadelGroup.add(queenPedestal);

    const queenCrown = this.createQueenCrownMesh(queenCrownMat);
    queenCrown.position.set(-8, 3.2, 0);
    this.citadelGroup.add(queenCrown);

    // 3. CENTRAL HOLOGRAPHIC CODEX TERMINAL
    const terminalBase = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 1.6, 8), pedestalMat);
    terminalBase.position.set(0, 0.8, 0);
    this.citadelGroup.add(terminalBase);

    const holoPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 2.0, 16),
      new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.35, wireframe: true })
    );
    holoPillar.position.set(0, 2.4, 0);
    this.citadelGroup.add(holoPillar);

    // Standard Prey Skulls on Outer Pedestals
    const displayCount = Math.min(12, Math.max(4, skullCount));
    for (let i = 0; i < displayCount; i++) {
      const angle = (i / displayCount) * Math.PI * 2;
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.8, 8), pedestalMat);
      pedestal.position.set(Math.cos(angle) * 14, 0.9, Math.sin(angle) * 14);
      this.citadelGroup.add(pedestal);

      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), skullMat);
      skull.position.set(Math.cos(angle) * 14, 2.1, Math.sin(angle) * 14);
      this.citadelGroup.add(skull);
    }
  }

  createEngineerSkull(mat) {
    const group = new THREE.Group();
    // Broad, aristocratic humanoid cranium (Prometheus Engineer)
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 12), mat);
    cranium.scale.set(0.9, 1.2, 1.0);
    group.add(cranium);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.6), mat);
    jaw.position.set(0, -0.45, 0.15);
    group.add(jaw);

    return group;
  }

  createQueenCrownMesh(mat) {
    const group = new THREE.Group();
    // Massive flared chitinous crest
    const crest = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.8, 5), mat);
    crest.rotation.x = Math.PI / 2.5;
    group.add(crest);
    return group;
  }

  show() {
    this.citadelGroup.visible = true;
  }

  hide() {
    this.citadelGroup.visible = false;
  }
}

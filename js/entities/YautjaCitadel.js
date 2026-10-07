/* 3D Yautja Mothership Citadel Room 3.0 - Laser Trophy Cleaning & Polishing Station */

import * as THREE from 'three';

export class YautjaCitadel {
  constructor(scene) {
    this.scene = scene;
    this.citadelGroup = new THREE.Group();
    this.scene.add(this.citadelGroup);
    this.citadelGroup.visible = false;
  }

  buildCitadelRoom(skullCount = 0) {
    while (this.citadelGroup.children.length > 0) {
      this.citadelGroup.remove(this.citadelGroup.children[0]);
    }

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.85, roughness: 0.2 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, metalness: 0.9, roughness: 0.1 });
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x3a4556, metalness: 0.85, roughness: 0.3 });
    const skullMat = new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.4 });
    const engineerMat = new THREE.MeshStandardMaterial({ color: 0xc8d1dc, roughness: 0.25, metalness: 0.2 });
    const queenCrownMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, metalness: 0.9, roughness: 0.2 });
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.8 });

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

    // 3. CENTERPIECE 3: LASER TROPHY CLEANING & POLISHING STATION (Predator 2 Lore)
    const stationPedestal = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 3.2), pedestalMat);
    stationPedestal.position.set(8, 0.8, 0);
    this.citadelGroup.add(stationPedestal);

    // Polishing Beam Arm
    const stationArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6), wallMat);
    stationArm.position.set(8, 2.3, 0);
    stationArm.rotation.z = Math.PI / 4;
    this.citadelGroup.add(stationArm);

    // Sizzling Blue Laser Beam Polishing an Elite Skull
    const laserBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), laserMat);
    laserBeam.position.set(8.4, 2.0, 0);
    this.citadelGroup.add(laserBeam);

    const polishedSkull = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), skullMat);
    polishedSkull.position.set(8.4, 1.9, 0);
    this.citadelGroup.add(polishedSkull);

    // 4. CENTERPIECE 4: TYRANNOSAURUS REX PREHISTORIC SKULL (Predator 2 Lore 1990)
    const trexPedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 2.2, 8), pedestalMat);
    trexPedestal.position.set(0, 1.1, 8);
    this.citadelGroup.add(trexPedestal);

    const trexSkull = this.createTRexSkull(skullMat);
    trexSkull.position.set(0, 3.2, 8);
    trexSkull.scale.set(1.8, 1.8, 1.8);
    this.citadelGroup.add(trexSkull);

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

  createTRexSkull(mat) {
    const group = new THREE.Group();

    // Massive elongated carnivore cranium
    const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 2.4), mat);
    cranium.position.set(0, 0.3, 0.4);
    group.add(cranium);

    // Upper Snout & Eye Sockets
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.6, 6), mat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.1, 1.8);
    group.add(snout);

    // Lower Mandible Jaw with Teeth
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 2.0), mat);
    jaw.position.set(0, -0.4, 0.8);
    jaw.rotation.x = 0.15; // Slightly open menacing roar
    group.add(jaw);

    // Serrated Fangs
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    for (let t = -3; t <= 3; t++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 4), toothMat);
      tooth.rotation.x = Math.PI;
      tooth.position.set(0.3 * (t % 2 === 0 ? 1 : -1), 0.05, 0.6 + Math.abs(t) * 0.3);
      group.add(tooth);
    }

    return group;
  }

  createEngineerSkull(mat) {
    const group = new THREE.Group();
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

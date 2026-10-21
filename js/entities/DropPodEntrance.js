/* Yautja Orbital Insertion Drop Pod (Cinematic Mission Entrance - AvP Lore) */

import * as THREE from 'three';

export class DropPodEntrance {
  constructor(scene, audioEngine, particles) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.particles = particles;
    this.podMesh = null;
    this.doorMesh = null;
    this.isLanding = false;
    this.velocityY = 0;
  }

  triggerDrop(targetPos, onLandedCallback) {
    if (this.podMesh) {
      this.scene.remove(this.podMesh);
    }

    const podGroup = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.95,
      roughness: 0.15
    });
    const burnMat = new THREE.MeshStandardMaterial({
      color: 0x374151,
      roughness: 0.8
    });

    // Conical reentry heat shield base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 1.2, 8), burnMat);
    base.position.y = 0.6;
    podGroup.add(base);

    // Main pod fuselage
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.4, 4.2, 8), metalMat);
    body.position.y = 3.3;
    podGroup.add(body);

    // Conical cap with thrusters
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.0, 8), metalMat);
    cap.position.y = 6.4;
    podGroup.add(cap);

    // 4 Directional Retro-Braking Thrusters (Hydraulic Stabilization)
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    for (let t = 0; t < 4; t++) {
      const angle = (t / 4) * Math.PI * 2;
      const retro = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 0.6, 6), metalMat);
      retro.position.set(Math.cos(angle) * 1.7, 4.8, Math.sin(angle) * 1.7);
      retro.rotation.z = Math.cos(angle) * 0.4;
      retro.rotation.x = Math.sin(angle) * 0.4;
      podGroup.add(retro);

      const retroGlow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), thrusterMat);
      retroGlow.position.set(Math.cos(angle) * 1.9, 4.6, Math.sin(angle) * 1.9);
      podGroup.add(retroGlow);
    }

    // Glowing Yautja Clan Mark Glyph on Hatch
    const glyphMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    const glyph1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.05), glyphMat);
    glyph1.position.set(0, 3.4, 0.2);
    const glyph2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.05), glyphMat);
    glyph2.position.set(0, 3.4, 0.2);

    // Blowout Hatch Door
    this.doorMesh = new THREE.Group();
    const doorPlate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 0.3), metalMat);
    this.doorMesh.add(doorPlate);
    this.doorMesh.add(glyph1);
    this.doorMesh.add(glyph2);
    this.doorMesh.position.set(0, 3.0, 1.8);
    podGroup.add(this.doorMesh);

    // Initial sky position: 60m up
    podGroup.position.set(targetPos.x, 60, targetPos.z);
    this.scene.add(podGroup);
    this.podMesh = podGroup;

    this.isLanding = true;
    this.velocityY = -80; // Terminal velocity drop!

    // Descent animation
    const startTime = performance.now();
    const animateDrop = () => {
      if (!this.isLanding || !this.podMesh) return;

      this.podMesh.position.y += this.velocityY * 0.016;

      // Trail sparks & smoke during re-entry descent
      if (this.particles) {
        this.particles.emitSparks(this.podMesh.position, 4);
      }

      if (this.podMesh.position.y <= 0) {
        this.podMesh.position.y = 0;
        this.isLanding = false;

        // Massive seismic impact!
        if (this.audioEngine && this.audioEngine.playDropPodImpact) {
          this.audioEngine.playDropPodImpact();
        }

        // Blow off the hatch door with hydraulic blast
        if (this.doorMesh) {
          this.doorMesh.position.z += 4.5;
          this.doorMesh.position.y -= 1.2;
          this.doorMesh.rotation.x = Math.PI / 2;
        }

        if (onLandedCallback) onLandedCallback();
        return;
      }

      requestAnimationFrame(animateDrop);
    };

    requestAnimationFrame(animateDrop);
  }

  clear() {
    if (this.podMesh) {
      this.scene.remove(this.podMesh);
      this.podMesh = null;
    }
  }
}

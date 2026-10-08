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

    // Blowout Hatch Door
    this.doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 0.3), metalMat);
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

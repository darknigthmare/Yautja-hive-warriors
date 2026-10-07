/* UD-4L Cheyenne Dropship Air Support (Aliens 1986 Lore) */

import * as THREE from 'three';

export class CheyenneDropship {
  constructor(scene, audioEngine, particles) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.particles = particles;
    this.shipMesh = null;
    this.isFlying = false;
    this.flightProgress = 0;
  }

  triggerAirstrike(playerPos, horde) {
    if (this.isFlying) return;

    if (this.shipMesh) {
      this.scene.remove(this.shipMesh);
    }

    const shipGroup = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Military olive/grey USCM hull
      metalness: 0.8,
      roughness: 0.3
    });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });

    // Fuselage
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.5, 12), hullMat);
    body.position.y = 1.2;
    shipGroup.add(body);

    // Angular Cockpit Canopy
    const cockpit = new THREE.Mesh(new THREE.ConeGeometry(2.0, 4.0, 4), glassMat);
    cockpit.rotation.x = Math.PI / 2;
    cockpit.position.set(0, 1.4, 7.5);
    shipGroup.add(cockpit);

    // Twin Wing Rocket Pods
    const leftPod = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 4.0), hullMat);
    leftPod.position.set(-4.0, 1.2, 0);
    shipGroup.add(leftPod);

    const rightPod = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 4.0), hullMat);
    rightPod.position.set(4.0, 1.2, 0);
    shipGroup.add(rightPod);

    // Twin Rear Jet Thrusters
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 1.5, 8), thrusterMat);
    t1.rotation.x = Math.PI / 2;
    t1.position.set(-1.8, 1.5, -6.5);
    shipGroup.add(t1);

    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 1.5, 8), thrusterMat);
    t2.rotation.x = Math.PI / 2;
    t2.position.set(1.8, 1.5, -6.5);
    shipGroup.add(t2);

    // Start 100m behind and 18m altitude
    shipGroup.position.set(playerPos.x - 30, 22, playerPos.z - 90);
    this.scene.add(shipGroup);
    this.shipMesh = shipGroup;

    this.isFlying = true;
    this.flightProgress = 0;

    if (this.audioEngine && this.audioEngine.playDropshipFlyby) {
      this.audioEngine.playDropshipFlyby();
    }

    // Rocket barrage halfway through flyby
    setTimeout(() => {
      if (horde) {
        horde.checkMeleeHits({
          origin: playerPos,
          radius: 25,
          damage: 550,
          type: 'heavy'
        });
      }
    }, 1200);
  }

  update(delta) {
    if (!this.isFlying || !this.shipMesh) return;

    // Fast flyby at 65 m/s
    this.shipMesh.position.z += 65 * delta;
    this.flightProgress += delta;

    if (this.flightProgress >= 4.0) {
      this.scene.remove(this.shipMesh);
      this.shipMesh = null;
      this.isFlying = false;
    }
  }

  clear() {
    if (this.shipMesh) {
      this.scene.remove(this.shipMesh);
      this.shipMesh = null;
      this.isFlying = false;
    }
  }
}

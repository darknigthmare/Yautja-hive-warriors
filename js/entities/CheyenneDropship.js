/* UD-4L Cheyenne Dropship Air Support & Napalm Bombing Run (Aliens 1986 Lore) */

import * as THREE from 'three';

export class CheyenneDropship {
  constructor(scene, audioEngine, particles) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.particles = particles;
    this.shipMesh = null;
    this.isFlying = false;
    this.flightProgress = 0;
    this.napalmPools = [];
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

    // 25mm Nose Gatling Autocannon Turret (Under-cockpit)
    const turretMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95 });
    const noseGun = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 6), turretMat);
    noseGun.rotation.x = Math.PI / 2;
    noseGun.position.set(0, 0.4, 8.2);
    shipGroup.add(noseGun);

    // Twin Wing Rocket Pods with Missile Tubes
    const leftPod = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 4.0), hullMat);
    leftPod.position.set(-4.0, 1.2, 0);
    shipGroup.add(leftPod);

    const rightPod = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 4.0), hullMat);
    rightPod.position.set(4.0, 1.2, 0);
    shipGroup.add(rightPod);

    // Twin Canting Vertical Tail Fins / Stabilizers
    [-2.2, 2.2].forEach(side => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 2.4), hullMat);
      fin.position.set(side, 3.2, -5.5);
      fin.rotation.z = side > 0 ? -0.2 : 0.2;
      shipGroup.add(fin);
    });

    // Twin Rear Jet Thrusters
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 1.5, 8), thrusterMat);
    t1.rotation.x = Math.PI / 2;
    t1.position.set(-1.8, 1.5, -6.5);
    shipGroup.add(t1);

    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 1.5, 8), thrusterMat);
    t2.rotation.x = Math.PI / 2;
    t2.position.set(1.8, 1.5, -6.5);
    shipGroup.add(t2);

    // Start 100m behind and 22m altitude
    shipGroup.position.set(playerPos.x - 20, 22, playerPos.z - 90);
    this.scene.add(shipGroup);
    this.shipMesh = shipGroup;

    this.isFlying = true;
    this.flightProgress = 0;

    if (this.audioEngine && this.audioEngine.playDropshipFlyby) {
      this.audioEngine.playDropshipFlyby();
    }

    // 1. Initial 70mm Rocket barrage halfway through flyby
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

    // 2. Napalm Carpet Bombing Run: 4 Incendiary Canisters dropped sequentially
    for (let b = 0; b < 4; b++) {
      setTimeout(() => {
        const dropX = playerPos.x + (b - 1.5) * 8.0;
        const dropZ = playerPos.z + (b - 1.5) * 10.0;
        this.spawnNapalmInferno(new THREE.Vector3(dropX, 0.05, dropZ), horde);
      }, 700 + b * 450);
    }
  }

  spawnNapalmInferno(pos, horde) {
    if (this.audioEngine && this.audioEngine.playNapalmBarrage) {
      this.audioEngine.playNapalmBarrage();
    }

    // Fiery pool mesh
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff3700,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const poolGeo = new THREE.CircleGeometry(3.8, 16);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMesh = new THREE.Mesh(poolGeo, flameMat);
    poolMesh.position.copy(pos);
    this.scene.add(poolMesh);

    // Vertical flickering flame pillar
    const flameCoreGeo = new THREE.CylinderGeometry(0.5, 2.8, 2.5, 8);
    const flameCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });
    const coreMesh = new THREE.Mesh(flameCoreGeo, flameCoreMat);
    coreMesh.position.set(pos.x, 1.25, pos.z);
    this.scene.add(coreMesh);

    if (this.particles) {
      this.particles.emitSparks(pos, 15);
    }

    this.napalmPools.push({
      poolMesh,
      coreMesh,
      pos: pos.clone(),
      life: 7.5,
      damage: 70
    });

    // Immediate blast damage
    if (horde) {
      horde.checkMeleeHits({
        origin: pos,
        radius: 4.5,
        damage: 180,
        type: 'heavy'
      });
    }
  }

  update(delta, horde = null) {
    // 1. Dropship Flight Trajectory
    if (this.isFlying && this.shipMesh) {
      this.shipMesh.position.z += 65 * delta;
      this.flightProgress += delta;

      if (this.flightProgress >= 4.0) {
        this.scene.remove(this.shipMesh);
        this.shipMesh = null;
        this.isFlying = false;
      }
    }

    // 2. Active Napalm Burning Hazards Update
    for (let i = this.napalmPools.length - 1; i >= 0; i--) {
      const p = this.napalmPools[i];
      p.life -= delta;

      // Flame flicker animation
      p.poolMesh.material.opacity = 0.65 + Math.sin(Date.now() * 0.015) * 0.2;
      p.coreMesh.scale.set(
        1.0 + Math.sin(Date.now() * 0.02) * 0.15,
        1.0 + Math.cos(Date.now() * 0.02) * 0.2,
        1.0 + Math.sin(Date.now() * 0.02) * 0.15
      );

      // Continuous burn damage to any Xenomorphs walking into fire
      if (horde) {
        horde.checkMeleeHits({
          origin: p.pos,
          radius: 3.8,
          damage: p.damage * delta,
          type: 'light'
        });
      }

      if (p.life <= 0) {
        this.scene.remove(p.poolMesh);
        this.scene.remove(p.coreMesh);
        this.napalmPools.splice(i, 1);
      }
    }
  }

  clear() {
    if (this.shipMesh) {
      this.scene.remove(this.shipMesh);
      this.shipMesh = null;
      this.isFlying = false;
    }
    this.napalmPools.forEach(p => {
      this.scene.remove(p.poolMesh);
      this.scene.remove(p.coreMesh);
    });
    this.napalmPools = [];
  }
}

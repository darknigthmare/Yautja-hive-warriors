/* USCM M577 Armored Personnel Carrier (Aliens 1986 Lore) */

import * as THREE from 'three';

export class APCVehicle {
  constructor(scene, audioEngine, particles) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.particles = particles;
    this.mesh = null;
    this.turretMesh = null;
    this.isActive = false;
    this.fireCooldown = 0;
    this.targetPos = new THREE.Vector3();
    this.hp = 2500;
    this.maxHp = 2500;
  }

  spawn(pos) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
    }

    const group = new THREE.Group();

    // Military USCM armor material
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x3b4738, // Olive-drab USCM armor
      metalness: 0.85,
      roughness: 0.35
    });

    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.2,
      roughness: 0.8
    });

    // 1. Sloped Main Chassis (Length: 9m, Width: 4.2m, Height: 2.2m)
    const hullGeo = new THREE.BoxGeometry(4.2, 2.0, 9.0);
    const hull = new THREE.Mesh(hullGeo, armorMat);
    hull.position.y = 1.8;
    group.add(hull);

    // Front sloped glacis plate
    const frontGlacis = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.0, 4), armorMat);
    frontGlacis.rotation.x = Math.PI / 2;
    frontGlacis.position.set(0, 1.6, 5.2);
    group.add(frontGlacis);

    // 2. Eight Massive All-Terrain Wheels (4 on left, 4 on right)
    const wheelGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.7, 12);
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelPositions = [-3.0, -1.0, 1.0, 3.0];
    wheelPositions.forEach(zOffset => {
      // Left wheel
      const wl = new THREE.Mesh(wheelGeo, wheelMat);
      wl.position.set(-2.3, 0.85, zOffset);
      group.add(wl);

      // Right wheel
      const wr = new THREE.Mesh(wheelGeo, wheelMat);
      wr.position.set(2.3, 0.85, zOffset);
      group.add(wr);
    });

    // 3. Pivoting Roof-Mounted Dual 20mm Autocannon Turret
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 3.0, -1.5);

    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 8), armorMat);
    turretGroup.add(turretBase);

    // Twin barrels
    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6);
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95 });

    const barrel1 = new THREE.Mesh(barrelGeo, barrelMat);
    barrel1.position.set(-0.35, 0.25, 1.4);
    turretGroup.add(barrel1);

    const barrel2 = new THREE.Mesh(barrelGeo, barrelMat);
    barrel2.position.set(0.35, 0.25, 1.4);
    turretGroup.add(barrel2);

    group.add(turretGroup);
    this.turretMesh = turretGroup;

    // Headlights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), lightMat);
    hl1.position.set(-1.4, 2.0, 4.6);
    group.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), lightMat);
    hl2.position.set(1.4, 2.0, 4.6);
    group.add(hl2);

    group.position.copy(pos);
    this.scene.add(group);
    this.mesh = group;
    this.isActive = true;
    this.hp = this.maxHp;
  }

  update(delta, horde) {
    if (!this.isActive || !this.mesh) return;

    this.fireCooldown -= delta;

    // Track nearest Xenomorph within 30 meters
    let nearestTarget = null;
    let nearestDist = 30.0;

    if (horde && horde.aliens) {
      horde.aliens.forEach(a => {
        const d = this.mesh.position.distanceTo(a.mesh.position);
        if (d < nearestDist) {
          nearestDist = d;
          nearestTarget = a;
        }
      });
    }

    if (nearestTarget && this.turretMesh) {
      const aimDir = nearestTarget.mesh.position.clone().sub(this.mesh.position);
      aimDir.y = 0;
      aimDir.normalize();
      this.turretMesh.rotation.y = Math.atan2(aimDir.x, aimDir.z) - this.mesh.rotation.y;

      // Fire twin 20mm autocannon bursts
      if (this.fireCooldown <= 0) {
        this.fireCooldown = 1.1;
        if (this.audioEngine && this.audioEngine.playAPCTurretBurst) {
          this.audioEngine.playAPCTurretBurst();
        }

        // Heavy suppressive fire damage
        if (horde) {
          const hits = horde.checkMeleeHits({
            origin: nearestTarget.mesh.position,
            radius: 3.5,
            damage: 240,
            type: 'heavy'
          });

          if (this.particles) {
            this.particles.emitSparks(nearestTarget.mesh.position, 12);
          }
        }
      }
    }
  }

  clear() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
      this.turretMesh = null;
      this.isActive = false;
    }
  }
}

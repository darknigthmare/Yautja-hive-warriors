/* USCM M577 Armored Personnel Carrier (Aliens 1986 Lore) */

import * as THREE from 'three';

export class APCVehicle {
  constructor(scene, audioEngine, particles) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.particles = particles;
    this.mesh = null;
    this.turretMesh = null;
    this.flashMesh1 = null;
    this.flashMesh2 = null;
    this.flashTimer = 0;
    this.beaconMesh = null;
    this.tracers = [];
    this.isActive = false;
    this.fireCooldown = 0;
    this.targetPos = new THREE.Vector3();
    this.hp = 2500;
    this.maxHp = 2500;
  }

  spawn(pos) {
    if (this.mesh) {
      this.clear();
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

    // 3. Pivoting Roof-Mounted Dual 20mm Autocannon Turret (Boyars Twin Cannon)
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

    // Dual Muzzle Flashes
    const flashGeo = new THREE.ConeGeometry(0.18, 0.6, 6);
    flashGeo.rotateX(-Math.PI / 2);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0.95 });

    this.flashMesh1 = new THREE.Mesh(flashGeo, flashMat);
    this.flashMesh1.position.set(-0.35, 0.25, 3.1);
    this.flashMesh1.visible = false;
    turretGroup.add(this.flashMesh1);

    this.flashMesh2 = new THREE.Mesh(flashGeo, flashMat);
    this.flashMesh2.position.set(0.35, 0.25, 3.1);
    this.flashMesh2.visible = false;
    turretGroup.add(this.flashMesh2);

    group.add(turretGroup);
    this.turretMesh = turretGroup;

    // Roof Rotating Amber Warning Beacon (Aliens 1986 Lore)
    const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.2, 8), armorMat);
    beaconBase.position.set(0, 2.9, 2.2);
    group.add(beaconBase);

    const beaconLightGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff9100, transparent: true, opacity: 0.85 });
    this.beaconMesh = new THREE.Mesh(beaconLightGeo, beaconMat);
    this.beaconMesh.position.set(0, 3.1, 2.2);
    group.add(this.beaconMesh);

    // Headlights & High-Intensity Forward Spotlights (Aliens 1986 LV-426 atmosphere)
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), lightMat);
    hl1.position.set(-1.4, 2.0, 4.6);
    group.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), lightMat);
    hl2.position.set(1.4, 2.0, 4.6);
    group.add(hl2);

    // USCM Stenciled Insignia Plate on Flank (Military identification)
    const decalMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const plateL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 1.8), decalMat);
    plateL.position.set(-2.12, 2.2, 0);
    group.add(plateL);
    const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 1.8), decalMat);
    plateR.position.set(2.12, 2.2, 0);
    group.add(plateR);

    group.position.copy(pos);
    this.scene.add(group);
    this.mesh = group;
    this.isActive = true;
    this.hp = this.maxHp;
  }

  update(delta, horde, bosses = null) {
    if (!this.isActive || !this.mesh) return;

    this.fireCooldown -= delta;

    // 1. Rotating Warning Beacon Animation
    if (this.beaconMesh) {
      this.beaconMesh.rotation.y += 9.0 * delta;
      this.beaconMesh.material.opacity = 0.55 + Math.sin(Date.now() * 0.012) * 0.4;
    }

    // 2. Muzzle Flash Decay
    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        if (this.flashMesh1) this.flashMesh1.visible = false;
        if (this.flashMesh2) this.flashMesh2.visible = false;
      }
    }

    // 3. 20mm High-Velocity Tracer Physics
    for (let t = this.tracers.length - 1; t >= 0; t--) {
      const tr = this.tracers[t];
      tr.life -= delta;
      tr.mesh.position.addScaledVector(tr.dir, tr.speed * delta);
      if (tr.life <= 0 || tr.mesh.position.distanceTo(tr.target) <= 1.5) {
        if (this.particles) {
          this.particles.emitSparks(tr.mesh.position, 6);
        }
        this.scene.remove(tr.mesh);
        this.tracers.splice(t, 1);
      }
    }

    // 4. Strategic Priority Targeting System:
    // Priority: Boss > Praetorian/Crusher/Officer > Standard Xenomorph (Max 36m)
    let bestTarget = null;
    let isBossTarget = false;

    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
      const bossDist = this.mesh.position.distanceTo(bosses.activeBoss.mesh.position);
      if (bossDist <= 38.0) {
        bestTarget = bosses.activeBoss;
        isBossTarget = true;
      }
    }

    if (!bestTarget && horde && horde.aliens) {
      let nearestDist = 34.0;
      // First pass: scan for elite officers / praetorians / crushers
      for (const a of horde.aliens) {
        if (a.isOfficer || a.type === 'praetorian' || a.type === 'crusher') {
          const d = this.mesh.position.distanceTo(a.mesh.position);
          if (d < nearestDist) {
            nearestDist = d;
            bestTarget = a;
          }
        }
      }

      // Second pass: if no officer in range, pick closest regular alien
      if (!bestTarget) {
        for (const a of horde.aliens) {
          const d = this.mesh.position.distanceTo(a.mesh.position);
          if (d < nearestDist) {
            nearestDist = d;
            bestTarget = a;
          }
        }
      }
    }

    if (bestTarget && this.turretMesh) {
      const targetPos = bestTarget.mesh.position;
      const aimDir = targetPos.clone().sub(this.mesh.position);
      aimDir.y = 0;
      aimDir.normalize();
      this.turretMesh.rotation.y = Math.atan2(aimDir.x, aimDir.z) - this.mesh.rotation.y;

      // Fire twin 20mm Boyars autocannon burst
      if (this.fireCooldown <= 0) {
        this.fireCooldown = 0.95; // High rate of fire
        this.flashTimer = 0.12;
        if (this.flashMesh1) this.flashMesh1.visible = true;
        if (this.flashMesh2) this.flashMesh2.visible = true;

        if (this.audioEngine && this.audioEngine.playAPCTurretBurst) {
          this.audioEngine.playAPCTurretBurst();
        }

        // Spawn visual 20mm tracer projectile
        const barrelWorldPos = this.turretMesh.position.clone().add(this.mesh.position);
        barrelWorldPos.y += 0.25;
        this.spawnTracer(barrelWorldPos, targetPos);

        // Heavy suppressive kinetic damage
        if (isBossTarget && bosses) {
          bosses.takeDamage(260);
          if (this.particles) this.particles.emitSparks(targetPos, 10);
        } else if (horde) {
          horde.checkMeleeHits({
            origin: targetPos,
            radius: 3.8,
            damage: 260,
            type: 'heavy'
          });

          if (this.particles) {
            this.particles.emitSparks(targetPos, 14);
          }
        }
      }
    }
  }

  spawnTracer(startPos, targetPos) {
    const tracerGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 4);
    tracerGeo.rotateX(Math.PI / 2);
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xfff066 });
    const tracerMesh = new THREE.Mesh(tracerGeo, tracerMat);

    tracerMesh.position.copy(startPos);
    tracerMesh.lookAt(targetPos);
    this.scene.add(tracerMesh);

    const dir = targetPos.clone().sub(startPos).normalize();
    this.tracers.push({
      mesh: tracerMesh,
      dir,
      target: targetPos.clone(),
      speed: 75.0,
      life: 0.6
    });
  }

  clear() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
      this.turretMesh = null;
      this.flashMesh1 = null;
      this.flashMesh2 = null;
      this.beaconMesh = null;
      this.isActive = false;
    }
    this.tracers.forEach(t => {
      this.scene.remove(t.mesh);
    });
    this.tracers = [];
  }
}

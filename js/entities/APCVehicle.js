/* USCM M577 Armored Personnel Carrier (Aliens 1986 Lore) */

import * as THREE from 'three';
import { createAPCModel } from '../graphics/SupportModels.js';
import { disposeObject } from '../engine/SceneResources.js';

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
    this.model = null;
    this.deployment = 0;
    this.recoil = 0;
    this.weaponFlash = 0;
  }

  spawn(pos) {
    if (this.mesh) {
      disposeObject(this.mesh);
    }

    const model = createAPCModel();
    const { group, turret } = model;
    this.model = model;
    this.turretMesh = turret;

    group.position.copy(pos);
    this.scene.add(group);
    this.mesh = group;
    this.isActive = true;
    this.hp = this.maxHp;
    this.fireCooldown = 0;
    this.deployment = 0;
    this.recoil = 0;
    this.weaponFlash = 0;
    model.setTurretDeployment(0);
  }

  update(delta, horde) {
    if (!this.isActive || !this.mesh || !Number.isFinite(delta) || delta <= 0) return;

    this.fireCooldown = Math.max(0, this.fireCooldown - delta);
    this.deployment = Math.min(1, this.deployment + delta / 0.95);
    this.model?.setTurretDeployment(this.deployment * this.deployment * (3 - 2 * this.deployment));
    this.recoil *= Math.exp(-15 * delta);
    this.weaponFlash *= Math.exp(-24 * delta);
    if (this.model) {
      this.model.barrels.position.z = -this.recoil * 0.15;
      this.model.flareMaterial.opacity = this.weaponFlash * 0.85;
      this.model.muzzleFlash.visible = this.weaponFlash > 0.02;
    }

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
      this.mesh.updateMatrixWorld(true);
      const turretOrigin = this.turretMesh.getWorldPosition(new THREE.Vector3());
      const aimDir = nearestTarget.mesh.position.clone().sub(turretOrigin);
      aimDir.y = 0;
      aimDir.normalize();
      this.turretMesh.rotation.y = Math.atan2(aimDir.x, aimDir.z) - this.mesh.rotation.y;
      if (this.model?.frontTurret) {
        const frontOrigin = this.model.frontTurret.getWorldPosition(new THREE.Vector3());
        const direction = nearestTarget.mesh.position.clone().sub(frontOrigin);
        let angle = Math.atan2(direction.x, direction.z) - this.mesh.rotation.y;
        angle = Math.atan2(Math.sin(angle), Math.cos(angle));
        this.model.frontTurret.rotation.y = THREE.MathUtils.clamp(angle, -0.55, 0.55);
      }

      // Fire twin 20mm autocannon bursts
      if (this.fireCooldown <= 0 && this.deployment >= 1) {
        this.fireCooldown = 1.1;
        this.recoil = 1;
        this.weaponFlash = 1;
        if (this.model) {
          this.model.barrels.position.z = -0.15;
          this.model.flareMaterial.opacity = 0.85;
          this.model.muzzleFlash.visible = true;
          this.mesh.updateMatrixWorld(true);
          for (const muzzle of this.model.muzzleSockets) this.particles?.emitSparks?.(muzzle.getWorldPosition(new THREE.Vector3()), 2);
        }
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

  /** Circle against the real carrier footprint, in vehicle space. Wheel
   * shoulders extend beyond the narrower door section; roof-height jumps do
   * not collide with an invisible full-height box around the whole vehicle. */
  resolveMovement(position, radius = 0.75) {
    if (!this.isActive || !this.mesh || !position?.isVector3 || !Number.isFinite(radius) || radius < 0) return position;
    const dxWorld = position.x - this.mesh.position.x, dzWorld = position.z - this.mesh.position.z;
    if (dxWorld * dxWorld + dzWorld * dzWorld > (6 + radius) ** 2) return position;
    const local = position.clone().sub(this.mesh.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.mesh.rotation.y);
    const boxes = [];
    if (local.y < 2.48) {
      boxes.push({ x: 0, z: 0.08, width: 2.09, depth: 4.84 });
      for (const z of [-3.23, 2.68]) boxes.push({ x: 0, z, width: 2.52, depth: 1.06 });
    }
    if (local.y >= 2.48 && local.y < 3.80 && this.model) boxes.push({ x: 0, z: this.model.turret.position.z, width: 1.05, depth: 1.08 });
    for (let iteration = 0; iteration < 2; iteration++) for (const box of boxes) {
      const x = local.x - box.x, z = local.z - box.z;
      if (Math.abs(x) >= box.width + radius || Math.abs(z) >= box.depth + radius) continue;
      const px = THREE.MathUtils.clamp(x, -box.width, box.width), pz = THREE.MathUtils.clamp(z, -box.depth, box.depth);
      const dx = x - px, dz = z - pz, distance = Math.hypot(dx, dz);
      if (distance > 1e-9) {
        if (distance >= radius) continue;
        const gain = (radius - distance) / distance;
        local.x += dx * gain; local.z += dz * gain;
      } else {
        const moveX = box.width + radius - Math.abs(x), moveZ = box.depth + radius - Math.abs(z);
        if (moveX < moveZ) local.x = box.x + (x < 0 ? -1 : 1) * (box.width + radius);
        else local.z = box.z + (z < 0 ? -1 : 1) * (box.depth + radius);
      }
    }
    position.copy(local.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y).add(this.mesh.position));
    return position;
  }

  clear() {
    if (this.mesh) {
      disposeObject(this.mesh);
      this.mesh = null;
      this.turretMesh = null;
      this.isActive = false;
    }
    this.model = null;
    this.deployment = 0;
    this.recoil = 0;
    this.weaponFlash = 0;
    this.fireCooldown = 0;
  }
}

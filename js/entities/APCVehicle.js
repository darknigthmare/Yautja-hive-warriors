/* USCM M577 Armored Personnel Carrier (Aliens 1986 Lore) */

import * as THREE from 'three';
import { createAPCModel } from '../graphics/SupportModels.js';
import { APC_DEPLOYMENT_SECONDS, APC_NAVIGATION } from '../graphics/APCModel.js';
import { disposeObject } from '../engine/SceneResources.js';

// Circle against the horizontal projection of an actor-height clipped part.
function resolveCirclePolygon(point, radius, polygon) {
  let inside = true, closest = null, distanceSq = Infinity, normal = null;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x, dz = b.z - a.z, lengthSq = dx * dx + dz * dz;
    if (lengthSq < 1e-14) continue;
    if (dx * (point.z - a.z) - dz * (point.x - a.x) < -1e-9) inside = false;
    const t = THREE.MathUtils.clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq, 0, 1);
    const contact = { x: a.x + t * dx, z: a.z + t * dz };
    const d = (point.x - contact.x) ** 2 + (point.z - contact.z) ** 2;
    if (d < distanceSq) {
      closest = contact; distanceSq = d;
      const length = Math.sqrt(lengthSq); normal = { x: dz / length, z: -dx / length };
    }
  }
  if (!closest) return;
  const distance = Math.sqrt(distanceSq);
  if (!inside && distance >= radius) return;
  if (distance < 1e-9) { point.x += normal.x * radius; point.z += normal.z * radius; return; }
  const gain = inside ? (distance + radius) / distance : (radius - distance) / distance;
  point.x += (inside ? closest.x - point.x : point.x - closest.x) * gain;
  point.z += (inside ? closest.z - point.z : point.z - closest.z) * gain;
}

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
    this.navigationRadius = APC_NAVIGATION.radius;
  }

  getNavigationCollider() {
    if (!this.isActive || !this.mesh) return null;
    const center = new THREE.Vector3(0, 0, APC_NAVIGATION.centerZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y).add(this.mesh.position);
    return { x: center.x, z: center.z, halfWidth: APC_NAVIGATION.halfWidth, halfDepth: APC_NAVIGATION.halfDepth,
      height: APC_NAVIGATION.height, rotation: this.mesh.rotation.y, owner: 'apc',
      resolveMovement: (position, radius, height) => this.resolveMovement(position, radius, height) };
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
    this.deployment = Math.min(1, this.deployment + delta / APC_DEPLOYMENT_SECONDS);
    this.model?.setTurretDeployment(this.deployment * this.deployment * (3 - 2 * this.deployment));
    this.recoil *= Math.exp(-15 * delta);
    this.weaponFlash *= Math.exp(-24 * delta);
    if (this.model) {
      this.model.barrels.position.z = -this.recoil * 0.15;
      this.model.flareMaterial.opacity = this.weaponFlash * 0.85;
      this.model.muzzleFlash.visible = this.weaponFlash > 0.02;
    }

    // A close target below the gun's depression stop must not prevent fire
    // at the next reachable enemy. Select using the same physical aim check
    // that will drive the housing and the muzzle effects for this shot.
    let nearestTarget = null;
    const candidates = [];

    if (horde && horde.aliens) {
      horde.aliens.forEach(a => {
        if (!a?.mesh?.position || a.hp <= 0) return;
        const d = this.mesh.position.distanceTo(a.mesh.position);
        if (d < 30) candidates.push({ alien: a, distance: d });
      });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    for (const { alien } of candidates) {
      this.targetPos.copy(alien.mesh.position);
      this.targetPos.y += alien.type === 'facehugger' ? 0.2 : 1.25;
      if (this.model?.setTurretAim(this.targetPos)) { nearestTarget = alien; break; }
    }
    if (!nearestTarget && candidates.length) {
      const nearest = candidates[0].alien;
      this.targetPos.copy(nearest.mesh.position);
      this.targetPos.y += nearest.type === 'facehugger' ? 0.2 : 1.25;
      this.model?.setTurretAim(this.targetPos);
    }

    if (nearestTarget && this.turretMesh) {

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
          horde.checkMeleeHits({
            origin: nearestTarget.mesh.position,
            radius: 3.5,
            damage: 240,
            type: 'heavy'
          });

          this.particles?.emitSparks?.(nearestTarget.mesh.position, 12);
        }
      }
    }
  }

  /** Circle against the real carrier footprint, in vehicle space. Wheel
   * shoulders extend beyond the narrower door section; roof-height jumps do
   * not collide with an invisible full-height box around the whole vehicle. */
  resolveMovement(position, radius = 0.75, actorHeight = 3.8) {
    if (!this.isActive || !this.mesh || !position?.isVector3 || !Number.isFinite(radius) || radius < 0 || !Number.isFinite(actorHeight) || actorHeight < 0) return position;
    const dxWorld = position.x - this.mesh.position.x, dzWorld = position.z - this.mesh.position.z;
    if (dxWorld * dxWorld + dzWorld * dzWorld > (this.navigationRadius + radius) ** 2) return position;
    const local = position.clone().sub(this.mesh.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.mesh.rotation.y);
    const boxes = [];
    if (local.y < 2.48) {
      boxes.push({ x: 0, z: 0.08, width: 2.09, depth: 4.84 });
      for (const z of [-3.23, 2.68]) boxes.push({ x: 0, z, width: 2.52, depth: 1.06 });
    }
    const movingSections = this.model?.getTurretCollisionPolygons(local.y, local.y + actorHeight) ?? [];
    for (let iteration = 0; iteration < 2; iteration++) {
      for (const box of boxes) {
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
      for (const polygon of movingSections) resolveCirclePolygon(local, radius, polygon);
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

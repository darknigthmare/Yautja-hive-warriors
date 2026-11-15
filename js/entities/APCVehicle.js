/* USCM M577 Armored Personnel Carrier (Aliens 1986 Lore) */

import * as THREE from 'three';
import { createAPCModel } from '../graphics/SupportModels.js';
import { APC_DEPLOYMENT_SECONDS, APC_NAVIGATION } from '../graphics/APCModel.js';
import { disposeObject } from '../engine/SceneResources.js';
import { traceCombatSegment } from '../engine/CombatGeometry.js';

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
    this.tracers = [];
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
      traceSegment: (from, to, options) => this.traceSegment(from, to, options),
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

  traceSegment(from, to) {
    if (!this.isActive || !this.mesh) return null;
    const start = from?.isVector3 ? from : new THREE.Vector3(...from), end = to?.isVector3 ? to : new THREE.Vector3(...to);
    const nav = this.getNavigationCollider(); delete nav.traceSegment; delete nav.resolveMovement;
    nav.height = 6;
    if (!traceCombatSegment(start, end, [nav])) return null;
    const direction = end.clone().sub(start), length = direction.length(); if (length < 1e-9) return null;
    this.mesh.updateWorldMatrix(true, true);
    const ray = new THREE.Raycaster(start, direction.divideScalar(length), 0, length);
    const hit = ray.intersectObject(this.mesh, true).find(entry => entry.object.visible && entry.object.material?.depthWrite !== false);
    return hit ? { point: hit.point, normal: hit.face?.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize() ?? new THREE.Vector3(), distance: hit.distance, t: hit.distance / length } : null;
  }

  update(delta, horde, bosses = null) {
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

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i]; tracer.life -= delta;
      const distance = tracer.mesh.position.distanceTo(tracer.target), step = Math.min(distance, tracer.speed * delta);
      tracer.mesh.position.addScaledVector(tracer.dir, step);
      if (tracer.life <= 0 || distance <= step + .05) { disposeObject(tracer.mesh); this.tracers.splice(i, 1); }
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
    const boss = bosses?.activeBoss;
    if (boss?.mesh && boss.hp > 0 && this.mesh.position.distanceTo(boss.mesh.position) < 38) candidates.push({ alien: boss, distance: this.mesh.position.distanceTo(boss.mesh.position), boss: true });
    const priority = candidate => candidate.boss ? 2 : candidate.alien.isOfficer || ['praetorian', 'crusher'].includes(candidate.alien.type) ? 1 : 0;
    candidates.sort((a, b) => priority(b) - priority(a) || a.distance - b.distance);
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
          for (const muzzle of this.model.muzzleSockets) this.spawnTracer(muzzle.getWorldPosition(new THREE.Vector3()), this.targetPos);
          for (const muzzle of this.model.muzzleSockets) this.particles?.emitSparks?.(muzzle.getWorldPosition(new THREE.Vector3()), 2);
        }
        if (this.audioEngine && this.audioEngine.playAPCTurretBurst) {
          this.audioEngine.playAPCTurretBurst();
        }

        // Heavy suppressive fire damage
        if (nearestTarget === bosses?.activeBoss) {
          bosses.takeDamage(240);
        } else if (horde) {
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
    for (const tracer of this.tracers) disposeObject(tracer.mesh);
    this.tracers = [];
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
}

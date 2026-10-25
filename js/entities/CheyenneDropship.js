/* UD-4L Cheyenne Dropship Air Support & Napalm Bombing Run (Aliens 1986 Lore) */

import * as THREE from 'three';
import { createDropshipModel } from '../graphics/SupportModels.js';
import { disposeObject } from '../engine/SceneResources.js';

export class CheyenneDropship {
  constructor(scene, audioEngine, particles) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.particles = particles;
    this.shipMesh = null;
    this.isFlying = false;
    this.flightProgress = 0;
    this.napalmPools = [];
    this.pendingStrikes = [];
  }

  triggerAirstrike(playerPos, horde) {
    if (this.isFlying) return;

    if (this.shipMesh) {
      disposeObject(this.shipMesh);
    }

    const shipGroup = createDropshipModel();

    // Start 100m behind and 22m altitude
    shipGroup.position.set(playerPos.x - 20, 22, playerPos.z - 90);
    this.scene.add(shipGroup);
    this.shipMesh = shipGroup;

    this.isFlying = true;
    this.flightProgress = 0;

    if (this.audioEngine && this.audioEngine.playDropshipFlyby) {
      this.audioEngine.playDropshipFlyby();
    }

    // Snapshot the target; queued strikes advance with the game, not wall-clock timers.
    this.pendingStrikes.push({ time: 1.2, kind: 'rocket', pos: playerPos.clone(), horde });
    for (let b = 0; b < 4; b++) {
      this.pendingStrikes.push({ time: 0.7 + b * 0.45, kind: 'napalm',
        pos: new THREE.Vector3(playerPos.x + (b - 1.5) * 8, 0.05, playerPos.z + (b - 1.5) * 10), horde });
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
    for (let i = this.pendingStrikes.length - 1; i >= 0; i--) {
      const strike = this.pendingStrikes[i];
      strike.time -= delta;
      if (strike.time > 0) continue;
      this.pendingStrikes.splice(i, 1);
      const targets = horde || strike.horde;
      if (strike.kind === 'napalm') this.spawnNapalmInferno(strike.pos, targets);
      else targets?.checkMeleeHits({ origin: strike.pos, radius: 25, damage: 550, type: 'heavy' });
    }
    // 1. Dropship Flight Trajectory
    if (this.isFlying && this.shipMesh) {
      this.shipMesh.position.z += 65 * delta;
      this.flightProgress += delta;

      if (this.flightProgress >= 4.0) {
        disposeObject(this.shipMesh);
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
        disposeObject(p.poolMesh);
        disposeObject(p.coreMesh);
        this.napalmPools.splice(i, 1);
      }
    }
  }

  clear() {
    this.pendingStrikes = [];
    this.isFlying = false;
    this.flightProgress = 0;
    if (this.shipMesh) {
      disposeObject(this.shipMesh);
      this.shipMesh = null;
      this.isFlying = false;
    }
    this.napalmPools.forEach(p => {
      disposeObject(p.poolMesh);
      disposeObject(p.coreMesh);
    });
    this.napalmPools = [];
  }
}

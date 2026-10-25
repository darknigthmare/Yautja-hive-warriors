/* Allied Yautja Honor Guard AI Squad Manager */

import * as THREE from 'three';
import { createHonorGuardModel } from '../graphics/SupportModels.js';
import { disposeObject } from '../engine/SceneResources.js';

export class YautjaAlliesManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.allies = [];
  }

  spawnSquad(playerPos, count = 3) {
    this.clearSquad();
    for (let i = 0; i < count; i++) {
      const group = createHonorGuardModel(i);
      const offset = new THREE.Vector3((i - 1) * 4.5, 0, (Math.random() - 0.5) * 4);
      group.position.copy(playerPos).add(offset);
      this.scene.add(group);
      this.allies.push({ mesh: group, hp: 950, maxHp: 950, moveSpeed: 14.5,
        damage: 110, radius: 1.3, attackTimer: 0, plasmaCooldown: 2.5 + Math.random() * 2.0 });
    }
  }

  clearSquad() {
    this.allies.forEach(a => disposeObject(a.mesh));
    this.allies = [];
  }

  update(delta, playerPos, horde) {
    for (let i = this.allies.length - 1; i >= 0; i--) {
      const ally = this.allies[i];
      const allyPos = ally.mesh.position;

      // Find nearest Xenomorph
      let nearestXeno = null;
      let minDistance = 25;

      horde.aliens.forEach(xeno => {
        const dist = allyPos.distanceTo(xeno.mesh.position);
        if (dist < minDistance) {
          minDistance = dist;
          nearestXeno = xeno;
        }
      });

      if (nearestXeno) {
        const dir = nearestXeno.mesh.position.clone().sub(allyPos);
        dir.y = 0;
        const dist = dir.length();

        // Shoulder Plasma Caster Fire (medium range 6m - 20m)
        ally.plasmaCooldown -= delta;
        if (ally.plasmaCooldown <= 0 && dist >= 6.0 && dist <= 22.0) {
          ally.plasmaCooldown = 4.0;
          this.audioEngine.playPlasmaShot();
          nearestXeno.hp -= 160;
          if (Math.random() < 0.3) this.audioEngine.playYautjaClick();
        }

        if (dist > 2.2) {
          dir.normalize();
          allyPos.addScaledVector(dir, ally.moveSpeed * delta);
          ally.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        } else {
          // Melee attack nearest xeno with wristblades
          ally.attackTimer -= delta;
          if (ally.attackTimer <= 0) {
            ally.attackTimer = 0.85;
            nearestXeno.hp -= ally.damage;
            this.audioEngine.playSlash();
            if (Math.random() < 0.25) this.audioEngine.playYautjaRoar();
          }
        }
      } else {
        // Follow Player Formation
        const dir = playerPos.clone().sub(allyPos);
        dir.y = 0;
        if (dir.length() > 6.0) {
          dir.normalize();
          allyPos.addScaledVector(dir, ally.moveSpeed * delta);
          ally.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
      }
    }
  }
}

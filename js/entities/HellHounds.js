/* Yautja Spiked Hell-Hounds (Hunting Beasts - Predators 2010 Lore) */

import * as THREE from 'three';
import { createHoundModel } from '../graphics/SupportModels.js';
import { createSurfaceMaterial } from '../graphics/SurfaceLibrary.js';
import { disposeObject } from '../engine/SceneResources.js';

export class HellHoundsManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.hounds = [];
    this.isActive = false;

    this.skinMat = createSurfaceMaterial('leather', {
      color: 0x4a3a2a, // Leathery reptilian hide
      roughness: 0.6,
      metalness: 0.2
    });
    this.spikeMat = createSurfaceMaterial('chitin', {
      color: 0x221810, // Dark chitinous quills
      roughness: 0.3,
      metalness: 0.8
    });
  }

  summonPack(playerPos, count = 2) {
    this.dismissPack();

    for (let i = 0; i < count; i++) {
      const mesh = this.createHellHoundMesh();
      const offset = (i === 0 ? -3.5 : 3.5);
      mesh.position.set(playerPos.x + offset, 0, playerPos.z + 2.5);
      this.scene.add(mesh);

      this.hounds.push({
        mesh,
        hp: 600,
        maxHp: 600,
        speed: 19,
        damage: 45,
        attackCooldown: 0
      });
    }

    this.isActive = true;
    this.audioEngine.playYautjaRoar();
  }

  createHellHoundMesh() {
    return createHoundModel(this.skinMat, this.spikeMat);
  }

  update(delta, player, horde) {
    if (!this.isActive || this.hounds.length === 0) return;

    this.hounds.forEach((hound, idx) => {
      if (hound.pounceLife > 0) {
        hound.pounceLife -= delta;
        if (hound.pounceLife <= 0) hound.mesh.position.y = 0;
      }
      // Find nearest Xenomorph to attack
      let target = null;
      let nearestDist = Infinity;

      horde.aliens.forEach(a => {
        const d = hound.mesh.position.distanceTo(a.mesh.position);
        if (d < nearestDist) {
          nearestDist = d;
          target = a;
        }
      });

      if (target) {
        const dir = target.mesh.position.clone().sub(hound.mesh.position);
        dir.y = 0;
        if (dir.length() > 1.8) {
          dir.normalize();
          hound.mesh.position.addScaledVector(dir, hound.speed * delta);
          hound.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        } else {
          // Bite & maul attack with pounce arc!
          if (hound.attackCooldown <= 0) {
            hound.attackCooldown = 0.85;
            this.audioEngine.playSlash();
            if (this.audioEngine.playHoundSnarl) {
              this.audioEngine.playHoundSnarl();
            }
            hound.mesh.position.y = 1.2; // Quick pounce leap
            hound.pounceLife = 0.18;

            target.hp -= hound.damage * 1.5;
            if (target.hp <= 0) {
              // Target slain by hound
              const hit = { pos: target.mesh.position.clone(), damage: hound.damage, killed: true };
              horde.checkMeleeHits({ origin: target.mesh.position, radius: 0.1, damage: 1 });
            }
          }
        }
      } else {
        // Return to player side
        const returnPos = player.position.clone().add(new THREE.Vector3(idx === 0 ? -3 : 3, 0, 2));
        const dir = returnPos.sub(hound.mesh.position);
        dir.y = 0;
        if (dir.length() > 1.0) {
          dir.normalize();
          hound.mesh.position.addScaledVector(dir, (hound.speed * 0.7) * delta);
          hound.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
      }

      if (hound.attackCooldown > 0) {
        hound.attackCooldown -= delta;
      }
    });
  }

  dismissPack() {
    this.hounds.forEach(h => disposeObject(h.mesh, new Set([this.skinMat, this.spikeMat])));
    this.hounds = [];
    this.isActive = false;
  }
}

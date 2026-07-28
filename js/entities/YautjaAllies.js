/* Allied Yautja Honor Guard AI Squad Manager */

import * as THREE from 'three';

export class YautjaAlliesManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.allies = [];
  }

  spawnSquad(playerPos, count = 3) {
    this.clearSquad();

    const allyMat = new THREE.MeshStandardMaterial({ color: 0x5a6370, roughness: 0.5, metalness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8a795d, roughness: 0.6 });

    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();

      // Torso
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.5, 2.0, 8), skinMat);
      torso.position.y = 2.0;
      group.add(torso);

      // Mask
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), allyMat);
      head.position.set(0, 3.4, 0.1);
      group.add(head);

      // Wristblade Arm
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 1.4, 6), skinMat);
      arm.position.set(1.1, 2.0, 0);
      group.add(arm);

      const offset = new THREE.Vector3((i - 1) * 4, 0, (Math.random() - 0.5) * 4);
      group.position.copy(playerPos).add(offset);
      this.scene.add(group);

      this.allies.push({
        mesh: group,
        hp: 800,
        maxHp: 800,
        moveSpeed: 14,
        damage: 80,
        radius: 1.2,
        attackTimer: 0
      });
    }
  }

  clearSquad() {
    this.allies.forEach(a => this.scene.remove(a.mesh));
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
        // Chase & Attack Xenomorph
        const dir = nearestXeno.mesh.position.clone().sub(allyPos);
        dir.y = 0;
        if (dir.length() > 2.0) {
          dir.normalize();
          allyPos.addScaledVector(dir, ally.moveSpeed * delta);
          ally.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        } else {
          // Melee attack nearest xeno
          ally.attackTimer -= delta;
          if (ally.attackTimer <= 0) {
            ally.attackTimer = 1.0;
            nearestXeno.hp -= ally.damage;
            this.audioEngine.playSlash();
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

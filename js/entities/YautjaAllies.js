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

    const armorMat = new THREE.MeshStandardMaterial({ color: 0x3d4450, roughness: 0.35, metalness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8a795d, roughness: 0.65 });
    const dreadMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1, metalness: 0.95 });
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });

    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();

      // Torso & Mesh Armor Cuirass
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.5, 2.0, 8), skinMat);
      torso.position.y = 2.0;
      group.add(torso);

      const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.8), armorMat);
      chestPlate.position.set(0, 2.3, 0.1);
      group.add(chestPlate);

      // Bio-Mask Helmet with visor slit
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), armorMat);
      head.position.set(0, 3.4, 0.1);
      group.add(head);

      // Crown of 8 Flexible Dreadlocks / Quills
      for (let d = 0; d < 8; d++) {
        const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.03, 1.3, 5), dreadMat);
        const dAngle = (d / 8) * Math.PI + Math.PI / 2;
        dread.position.set(Math.cos(dAngle) * 0.45, 3.1, Math.sin(dAngle) * 0.45 - 0.2);
        dread.rotation.x = 0.5;
        dread.rotation.z = Math.cos(dAngle) * 0.3;
        group.add(dread);
      }

      // Left Shoulder Mounted Plasma Caster Cannon
      const casterBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.3), armorMat);
      casterBase.position.set(-0.85, 3.0, -0.2);
      group.add(casterBase);
      const casterBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6), armorMat);
      casterBarrel.rotation.x = Math.PI / 2;
      casterBarrel.position.set(-0.85, 3.15, 0.1);
      group.add(casterBarrel);

      // Right Arm with Dual Extensible Wristblades
      const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 1.4, 6), skinMat);
      rArm.position.set(1.1, 2.0, 0);
      group.add(rArm);

      const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), armorMat);
      gauntlet.position.set(1.1, 1.4, 0.1);
      group.add(gauntlet);

      // 2 Serrated Steel Wristblades
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 1.2), bladeMat);
      b1.position.set(1.03, 1.38, 0.65);
      group.add(b1);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 1.2), bladeMat);
      b2.position.set(1.17, 1.38, 0.65);
      group.add(b2);

      const offset = new THREE.Vector3((i - 1) * 4.5, 0, (Math.random() - 0.5) * 4);
      group.position.copy(playerPos).add(offset);
      this.scene.add(group);

      this.allies.push({
        mesh: group,
        hp: 950,
        maxHp: 950,
        moveSpeed: 14.5,
        damage: 110,
        radius: 1.3,
        attackTimer: 0,
        plasmaCooldown: 2.5 + Math.random() * 2.0
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

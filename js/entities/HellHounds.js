/* Yautja Spiked Hell-Hounds (Hunting Beasts - Predators 2010 Lore) */

import * as THREE from 'three';

export class HellHoundsManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.hounds = [];
    this.isActive = false;

    this.skinMat = new THREE.MeshStandardMaterial({
      color: 0x4a3a2a, // Leathery reptilian hide
      roughness: 0.6,
      metalness: 0.2
    });
    this.spikeMat = new THREE.MeshStandardMaterial({
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
    const group = new THREE.Group();

    // Quadrupedal muscular torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 2.4), this.skinMat);
    torso.position.y = 1.0;
    group.add(torso);

    // Ferocious armored canine skull
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 1.2), this.skinMat);
    head.position.set(0, 1.3, 1.4);
    group.add(head);

    // Protruding dorsal spikes & horns (Predators 2010 hallmark)
    for (let i = -3; i <= 3; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.9, 5), this.spikeMat);
      spike.position.set(0, 1.7, i * 0.3);
      spike.rotation.x = -Math.PI / 4;
      group.add(spike);

      // Flank quills
      const leftQuill = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7, 5), this.spikeMat);
      leftQuill.position.set(-0.6, 1.4, i * 0.3);
      leftQuill.rotation.z = Math.PI / 3;
      group.add(leftQuill);

      const rightQuill = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7, 5), this.spikeMat);
      rightQuill.position.set(0.6, 1.4, i * 0.3);
      rightQuill.rotation.z = -Math.PI / 3;
      group.add(rightQuill);
    }

    // 4 Muscular limbs
    const legGeo = new THREE.CylinderGeometry(0.18, 0.12, 1.0, 6);
    const fl = new THREE.Mesh(legGeo, this.skinMat);
    fl.position.set(-0.5, 0.5, 0.8);
    group.add(fl);

    const fr = new THREE.Mesh(legGeo, this.skinMat);
    fr.position.set(0.5, 0.5, 0.8);
    group.add(fr);

    const bl = new THREE.Mesh(legGeo, this.skinMat);
    bl.position.set(-0.5, 0.5, -0.8);
    group.add(bl);

    const br = new THREE.Mesh(legGeo, this.skinMat);
    br.position.set(0.5, 0.5, -0.8);
    group.add(br);

    return group;
  }

  update(delta, player, horde) {
    if (!this.isActive || this.hounds.length === 0) return;

    this.hounds.forEach((hound, idx) => {
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
            setTimeout(() => { if (hound.mesh) hound.mesh.position.y = 0; }, 180);

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
    this.hounds.forEach(h => this.scene.remove(h.mesh));
    this.hounds = [];
    this.isActive = false;
  }
}

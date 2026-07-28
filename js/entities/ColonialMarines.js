/* Colonial Marines USCM Faction Engine (3-Way Battle Warfare) */

import * as THREE from 'three';

export class ColonialMarinesManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.marines = [];
  }

  spawnSquad(playerPos, count = 4) {
    this.clearSquad();

    for (let i = 0; i < count; i++) {
      const isSmartgunner = i % 2 === 0;
      const marineMesh = this.createMarineMesh(isSmartgunner);

      const angle = (i / count) * Math.PI * 2;
      marineMesh.position.set(
        playerPos.x + Math.cos(angle) * 15,
        0,
        playerPos.z + Math.sin(angle) * 15
      );

      this.scene.add(marineMesh);
      this.marines.push({
        mesh: marineMesh,
        type: isSmartgunner ? 'smartgunner' : 'flametrooper',
        hp: 150,
        maxHp: 150,
        damage: isSmartgunner ? 20 : 35,
        speed: 8
      });
    }
  }

  createMarineMesh(isSmartgunner) {
    const group = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x3d4a36, roughness: 0.6, metalness: 0.3 }); // USCM Camo Olive
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.5, 1.8, 8), armorMat);
    torso.position.y = 1.8;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), skinMat);
    head.position.set(0, 3.0, 0);
    group.add(head);

    // USCM Helmet
    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.4, 8), armorMat);
    helmet.position.set(0, 3.2, 0);
    group.add(helmet);

    // Weapon (Smartgun or Pulse Rifle)
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 1.4), gunMat);
    gun.position.set(0.6, 2.0, 0.6);
    group.add(gun);

    return group;
  }

  update(delta, player, horde) {
    this.marines.forEach((m, idx) => {
      // 3-Way Target Priority: Target nearest Xenomorph first, then Player!
      let targetPos = null;
      let nearestDist = Infinity;

      // Check nearest alien
      horde.aliens.forEach(a => {
        const d = m.mesh.position.distanceTo(a.mesh.position);
        if (d < nearestDist) {
          nearestDist = d;
          targetPos = a.mesh.position;
        }
      });

      // If no aliens nearby, target player
      if (!targetPos) {
        targetPos = player.position;
        nearestDist = m.mesh.position.distanceTo(player.position);
      }

      if (targetPos) {
        const dir = targetPos.clone().sub(m.mesh.position);
        dir.y = 0;
        if (dir.length() > 6) {
          dir.normalize();
          m.mesh.position.addScaledVector(dir, m.speed * delta);
          m.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        } else {
          // Fire Pulse Rifle / Smartgun!
          if (Math.random() < 0.05) {
            this.audioEngine.playPlasmaShot();
            if (targetPos === player.position) {
              player.takeDamage(m.damage * 0.1);
            }
          }
        }
      }
    });
  }

  clearSquad() {
    this.marines.forEach(m => this.scene.remove(m.mesh));
    this.marines = [];
  }
}

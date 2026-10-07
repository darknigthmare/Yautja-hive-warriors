/* Colonial Marines USCM Faction Engine (3-Way Battle Warfare) */

import * as THREE from 'three';

export class ColonialMarinesManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.marines = [];
    this.sentryGun = null;
  }

  spawnSquad(playerPos, count = 4) {
    this.clearSquad();
    this.spawnSentryGun(playerPos.clone().add(new THREE.Vector3(8, 0, 8)));

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
            this.audioEngine.playPulseRifleBurst ? this.audioEngine.playPulseRifleBurst() : this.audioEngine.playPlasmaShot();
            if (targetPos === player.position) {
              player.takeDamage(m.damage * 0.1);
            }
          }

          // USCM M40 25mm Grenade Launcher Secondary Fire
          if (!m.grenadeCooldown) m.grenadeCooldown = 5.0;
          m.grenadeCooldown -= delta;
          if (m.grenadeCooldown <= 0) {
            m.grenadeCooldown = 6.0 + Math.random() * 3.0;
            this.audioEngine.playM40GrenadeBlast();

            // Explosive AOE at target position
            const grenadeAOE = { origin: targetPos, radius: 6.5, damage: 160 };
            horde.checkMeleeHits(grenadeAOE);
            if (targetPos === player.position) {
              player.takeDamage(45);
            }
          }
        }
      }
    });

    // Update USCM UA 571-C Sentry Gun Autonomous Target Scanning & Firing
    if (this.sentryGun && this.sentryGun.ammo > 0) {
      let nearestTarget = null;
      let nearestDist = Infinity;

      horde.aliens.forEach(a => {
        const d = this.sentryGun.mesh.position.distanceTo(a.mesh.position);
        if (d < nearestDist && d <= this.sentryGun.range) {
          nearestDist = d;
          nearestTarget = a;
        }
      });

      if (nearestTarget) {
        const dir = nearestTarget.mesh.position.clone().sub(this.sentryGun.mesh.position);
        dir.y = 0;
        this.sentryGun.mesh.rotation.y = Math.atan2(dir.x, dir.z);

        this.sentryGun.fireCooldown -= delta;
        if (this.sentryGun.fireCooldown <= 0) {
          this.sentryGun.fireCooldown = 0.35; // 4-shot burst every 0.35s
          this.sentryGun.ammo -= 4;
          this.audioEngine.playSentryGunBurst();

          // Sentry bullets deal rapid kinetic damage to target
          nearestTarget.hp -= this.sentryGun.damage * 4;
        }
      }
    }
  }

  spawnSentryGun(pos) {
    if (this.sentryGun) {
      this.scene.remove(this.sentryGun.mesh);
    }
    const mesh = this.createSentryGunMesh();
    mesh.position.copy(pos);
    this.scene.add(mesh);

    this.sentryGun = {
      mesh,
      ammo: 500,
      fireCooldown: 0,
      range: 26,
      damage: 18
    };
  }

  createSentryGunMesh() {
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });

    // Tripod Base
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 6), metalMat);
      const angle = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(angle) * 0.5, 0.6, Math.sin(angle) * 0.5);
      leg.rotation.z = Math.cos(angle) * 0.35;
      leg.rotation.x = Math.sin(angle) * 0.35;
      group.add(leg);
    }

    // Central Swivel Mount
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.6, 8), darkMat);
    mount.position.y = 1.2;
    group.add(mount);

    // Twin Rotating Machine Gun Receiver
    const gunBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.2), darkMat);
    gunBox.position.set(0, 1.5, 0);
    group.add(gunBox);

    // Dual Barrels
    for (let b = -1; b <= 1; b += 2) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), metalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(b * 0.15, 1.5, 0.9);
      group.add(barrel);
    }

    // Ammo Drum Magazine
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.35, 12), metalMat);
    drum.position.set(0, 1.2, -0.4);
    group.add(drum);

    return group;
  }

  clearSquad() {
    this.marines.forEach(m => this.scene.remove(m.mesh));
    this.marines = [];
    if (this.sentryGun) {
      this.scene.remove(this.sentryGun.mesh);
      this.sentryGun = null;
    }
  }
}

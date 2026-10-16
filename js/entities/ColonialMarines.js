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

    // Weapon (M56 Smartgun or M240 Incinerator Flamethrower - Aliens 1986 Canon 1:1)
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 1.4), gunMat);
    gun.position.set(0.6, 2.0, 0.6);
    group.add(gun);
    group.userData.gun = gun;

    if (!isSmartgunner) {
      // M240 Flamethrower Pressurized Fuel Canister (Under-barrel)
      const canisterMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 });
      const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), canisterMat);
      canister.rotation.x = Math.PI / 2;
      canister.position.set(0.6, 1.8, 0.5);
      group.add(canister);

      // Pilot Flame Igniter Tip
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
      const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), flameMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(0.6, 2.0, 1.4);
      group.add(nozzle);

      // 3D Animated M240 Napalm Flame Jet Stream (Cone projecting forward)
      const jetGeo = new THREE.ConeGeometry(0.9, 4.8, 8);
      jetGeo.rotateX(-Math.PI / 2);
      const jetMat = new THREE.MeshBasicMaterial({
        color: 0xff3700,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const flameJet = new THREE.Mesh(jetGeo, jetMat);
      flameJet.position.set(0.6, 2.0, 3.8);
      flameJet.visible = false;
      group.add(flameJet);
      group.userData.flameJet = flameJet;
    } else {
      // M56 Smartgun Steadicam Articulated Arm & Headset Sight
      const steadyArmMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), steadyArmMat);
      arm.position.set(0.35, 1.6, 0.2);
      arm.rotation.z = Math.PI / 4;
      group.add(arm);

      // Eye-mounted Targeting Headset
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.15), eyeMat);
      sight.position.set(0.2, 3.1, 0.35);
      group.add(sight);

      // Real-Time M56 Smartgun Tactical Red Laser Sight Beam
      const laserGeo = new THREE.CylinderGeometry(0.018, 0.018, 8.0, 4);
      laserGeo.rotateX(Math.PI / 2);
      const laserMat = new THREE.MeshBasicMaterial({
        color: 0xff0033,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const laserBeam = new THREE.Mesh(laserGeo, laserMat);
      laserBeam.position.set(0.6, 2.0, 5.0);
      laserBeam.visible = false;
      group.add(laserBeam);
      group.userData.laserBeam = laserBeam;
    }

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

      const flameJet = m.mesh.userData.flameJet;
      const laserBeam = m.mesh.userData.laserBeam;

      if (targetPos) {
        const dir = targetPos.clone().sub(m.mesh.position);
        dir.y = 0;
        const currentDist = dir.length();

        if (currentDist > 6) {
          dir.normalize();
          m.mesh.position.addScaledVector(dir, m.speed * delta);
          m.mesh.rotation.y = Math.atan2(dir.x, dir.z);

          if (flameJet) flameJet.visible = false;
          if (laserBeam) laserBeam.visible = false;
        } else {
          m.mesh.rotation.y = Math.atan2(dir.x, dir.z);

          // Fire M56 Smartgun or M240 Incinerator Flamethrower!
          if (m.type === 'flametrooper') {
            if (flameJet) {
              flameJet.visible = true;
              flameJet.scale.set(
                0.85 + Math.random() * 0.35,
                0.85 + Math.random() * 0.35,
                0.9 + Math.random() * 0.25
              );
              flameJet.material.opacity = 0.6 + Math.random() * 0.35;
            }

            if (Math.random() < 0.16) {
              if (this.audioEngine.playFlamethrowerBurn) {
                this.audioEngine.playFlamethrowerBurn();
              } else {
                this.audioEngine.playAcidSizzle();
              }
              if (targetPos === player.position) {
                player.takeDamage(m.damage * 0.15);
              } else {
                // Persistent burn AOE covering xenos
                horde.aliens.forEach(a => {
                  if (a.mesh.position.distanceTo(targetPos) <= 4.0) {
                    a.hp -= m.damage * 1.2;
                  }
                });
              }
            }
          } else {
            // M56 Smartgun tracking fire with red laser targeting (Vasquez / Drake - Aliens 1986 Canon)
            if (laserBeam) {
              laserBeam.visible = true;
              laserBeam.material.opacity = 0.75 + Math.random() * 0.25;
            }

            // Steadicam weapon recoil kickback animation
            if (m.mesh.userData.gun) {
              m.mesh.userData.gun.position.z = 0.6 - (Math.random() * 0.08);
            }

            if (Math.random() < 0.22) {
              if (this.audioEngine.playSmartgunBurst) {
                this.audioEngine.playSmartgunBurst();
              } else if (this.audioEngine.playPulseRifleBurst) {
                this.audioEngine.playPulseRifleBurst();
              }

              // Occasional tactical callout (Vasquez / Drake 1:1 Lore)
              if (!m.voiceTimer) m.voiceTimer = 0;
              m.voiceTimer += delta;
              if (m.voiceTimer > 8.0) {
                m.voiceTimer = 0;
                const shouts = ["LET'S ROCK !!", "EAT THIS !", "FIRE IN THE HOLE !", "HOLD THE PERIMETER !"];
                const shout = shouts[Math.floor(Math.random() * shouts.length)];
                if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
                  window.gameInstance.ui.showAnnouncement(`🔊 USCM SMARTGUNNER : "${shout}"`);
                }
              }

              if (targetPos === player.position) {
                player.takeDamage(m.damage * 0.12);
              } else {
                // Deal kinetic damage to the targeted Xenomorph
                horde.aliens.forEach(a => {
                  if (a.mesh.position.distanceTo(targetPos) <= 2.8) {
                    a.hp -= m.damage * 1.15;
                  }
                });
              }
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
      } else {
        if (flameJet) flameJet.visible = false;
        if (laserBeam) laserBeam.visible = false;
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

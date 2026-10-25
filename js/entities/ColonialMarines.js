/* Colonial Marines USCM support against the hive. */

import * as THREE from 'three';
import { createMarineModel, addSentryMechanicalDetails } from '../graphics/SupportModels.js';
import { disposeObject } from '../engine/SceneResources.js';
import { selectHostileTarget, requestHostileAttack, syncHostileWarning, releaseHostileAttack } from '../engine/HostilePressure.js';

export class ColonialMarinesManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.marines = [];
    this.sentryGun = null;
    this.hostileToPlayers = false; // USCM support fights the hive, then holds cover.
  }

  spawnSquad(playerPos, count = 4) {
    this.clearSquad();
    this.spawnSentryGun(playerPos.clone().add(new THREE.Vector3(8, 0, 8)));

    for (let i = 0; i < count; i++) {
      const isSmartgunner = i % 2 === 0;
      const marineMesh = this.createMarineMesh(isSmartgunner);

      const angle = (i / count) * Math.PI * 2;
      marineMesh.position.set(
        playerPos.x + Math.cos(angle) * 24,
        0,
        playerPos.z + Math.sin(angle) * 24
      );

      this.scene.add(marineMesh);
      this.marines.push({
        mesh: marineMesh,
        type: isSmartgunner ? 'smartgunner' : 'flametrooper',
        hp: 150,
        maxHp: 150,
        damage: isSmartgunner ? 20 : 35,
        speed: 8,
        shootCooldown: 1.4 + i * 0.3,
        grenadeCooldown: 7 + i * 0.6
      });
    }
  }

  createMarineMesh(isSmartgunner) {
    return createMarineModel(isSmartgunner);
  }

  update(delta, player, horde) {
    this.marines.forEach(m => {
      if (m.hp <= 0) { releaseHostileAttack(this, m); return; }
      const targetPlayer = selectHostileTarget(this, m.mesh.position, player);
      let targetPos = null, nearestDist = Infinity;
      for (const alien of horde.aliens) {
        if (alien.hp <= 0) continue;
        const distance = m.mesh.position.distanceTo(alien.mesh.position);
        if (distance < nearestDist) { nearestDist = distance; targetPos = alien.mesh.position; }
      }
      const targetsPlayer = !targetPos;
      if (targetsPlayer) {
        if (!this.hostileToPlayers) { releaseHostileAttack(this, m); m.pressureAction = null; return; }
        if (!targetPlayer || targetPlayer.hp <= 0) { releaseHostileAttack(this, m); return; }
        targetPos = targetPlayer.position;
      } else if (m.pressureAction) {
        releaseHostileAttack(this, m); m.pressureAction = null;
      }
      m.shootCooldown = Math.max(0, (m.shootCooldown ?? 1.4) - delta);
      m.grenadeCooldown = Math.max(0, (m.grenadeCooldown ?? 7) - delta);
      const dir = targetPos.clone().sub(m.mesh.position); dir.y = 0;
      const distance = dir.length();
      m.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      const stopDistance = targetsPlayer ? 10 : 6;
      if (distance > stopDistance) {
        m.mesh.position.addScaledVector(dir.normalize(), Math.min(m.speed * delta, distance - stopDistance));
      }
      if (distance > (targetsPlayer ? 18 : 9)) {
        if (m.pressureAction) { releaseHostileAttack(this, m); m.pressureAction = null; }
        return;
      }
      if (!m.pressureAction) {
        if (m.grenadeCooldown <= 0) m.pressureAction = 'grenade';
        else if (m.shootCooldown <= 0) m.pressureAction = 'shot';
      }
      if (m.pressureAction) {
        const grenade = m.pressureAction === 'grenade';
        const ready = !targetsPlayer || requestHostileAttack(this, m, targetPlayer, delta, {
          kind: 'ranged', windup: grenade ? 1.15 : 0.8, recovery: grenade ? 2.5 : 1.5, duration: 0.3
        });
        if (ready) {
          if (grenade) {
            m.grenadeCooldown = 8.5;
            this.audioEngine.playM40GrenadeBlast();
            horde.checkMeleeHits({ origin: targetPos, radius: 6.5, damage: 160 });
            if (targetsPlayer) targetPlayer.takeDamage(30);
          } else {
            m.shootCooldown = m.type === 'flametrooper' ? 1.65 : 1.45;
            if (m.type === 'flametrooper') (this.audioEngine.playFlamethrowerBurn ?? this.audioEngine.playAcidSizzle)?.call(this.audioEngine);
            else (this.audioEngine.playPulseRifleBurst ?? this.audioEngine.playPlasmaShot)?.call(this.audioEngine);
            if (targetsPlayer) targetPlayer.takeDamage(m.type === 'flametrooper' ? 12 : 9);
            else for (const alien of horde.aliens) {
              if (alien.mesh.position.distanceTo(targetPos) <= (m.type === 'flametrooper' ? 4 : 2.5)) alien.hp -= m.type === 'flametrooper' ? m.damage * 1.2 : m.damage;
            }
          }
          m.pressureAction = null;
        }
      }
      syncHostileWarning(this, m);
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
      disposeObject(this.sentryGun.mesh);
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

    const details = new THREE.Group();
    details.position.y = 1.5;
    addSentryMechanicalDetails(details);
    group.add(details);
    return group;
  }

  clearSquad() {
    this.marines.forEach(m => { releaseHostileAttack(this, m); disposeObject(m.mesh); });
    this.marines = [];
    if (this.sentryGun) {
      disposeObject(this.sentryGun.mesh);
      this.sentryGun = null;
    }
  }
}

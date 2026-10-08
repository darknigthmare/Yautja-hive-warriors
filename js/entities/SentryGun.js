/* UA 571-C Automated Remote Sentry Gun - Aliens 1986 Special Edition Canon 1:1 */

import * as THREE from 'three';

export class SentryGun {
  constructor(scene, audioEngine, particles = null) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.particles = particles;
    this.sentries = [];
  }

  setParticles(particles) {
    this.particles = particles;
  }

  deploySentry(pos, facingDir = null) {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Tripod Base
    const tripodMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2
    });

    // 3 Tripod Legs
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 6), tripodMat);
      const angle = (i / 3) * Math.PI * 2;
      leg.position.set(Math.sin(angle) * 0.45, 0.5, Math.cos(angle) * 0.45);
      leg.rotation.z = Math.sin(angle) * 0.4;
      leg.rotation.x = Math.cos(angle) * 0.4;
      group.add(leg);
    }

    // Central Stem Column
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 8), tripodMat);
    stem.position.y = 0.55;
    group.add(stem);

    // Motorized Traverse Swivel Head (rotates to track targets)
    const swivel = new THREE.Group();
    swivel.position.y = 1.0;
    group.add(swivel);

    // Receiver Housing
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.3
    });
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.7), bodyMat);
    receiver.position.set(0, 0, 0);
    swivel.add(receiver);

    // Twin 10mm Barrels
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.1
    });
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8), barrelMat);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.1, 0, 0.6);
    swivel.add(barrelL);

    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8), barrelMat);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.1, 0, 0.6);
    swivel.add(barrelR);

    // Top Ammo Drum / Hopper
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.35, 12), tripodMat);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, 0.25, -0.05);
    swivel.add(drum);

    // Motion Sensor Optics with glowing red tracking dot
    const sensorGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const sensorMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const sensor = new THREE.Mesh(sensorGeo, sensorMat);
    sensor.position.set(0, 0.16, 0.38);
    swivel.add(sensor);

    // Digital LED Ammo Readout Display Box on the back
    const screenGeo = new THREE.BoxGeometry(0.24, 0.14, 0.04);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0.12, -0.37);
    swivel.add(screen);

    // Muzzle flash point light
    const flashLight = new THREE.PointLight(0xffaa22, 0, 6);
    flashLight.position.set(0, 0, 1.1);
    swivel.add(flashLight);

    if (facingDir) {
      group.rotation.y = Math.atan2(facingDir.x, facingDir.z);
    }

    this.scene.add(group);

    const sentry = {
      group,
      swivel,
      screen,
      flashLight,
      ammo: 500,
      maxAmmo: 500,
      fireCooldown: 0,
      burstTimer: 0,
      isFiringBurst: false,
      burstCount: 0,
      range: 28.0,
      target: null,
      isEmptyAnnounced: false
    };

    this.sentries.push(sentry);
    return sentry;
  }

  update(delta, horde) {
    if (!horde || !horde.aliens) return;

    for (let s = this.sentries.length - 1; s >= 0; s--) {
      const sentry = this.sentries[s];

      if (sentry.fireCooldown > 0) {
        sentry.fireCooldown -= delta;
      }

      // Update Screen Display Color according to remaining ammo
      if (sentry.ammo <= 0) {
        sentry.screen.material.color.setHex(0x222222);
        if (!sentry.isEmptyAnnounced) {
          sentry.isEmptyAnnounced = true;
          this.audioEngine.playSentryGunEmpty();
        }
        continue;
      } else if (sentry.ammo < 80) {
        // Red flashing when critical
        const isBlink = Math.sin(Date.now() * 0.02) > 0;
        sentry.screen.material.color.setHex(isBlink ? 0xff0000 : 0x440000);
      } else if (sentry.ammo < 250) {
        sentry.screen.material.color.setHex(0xffaa00);
      } else {
        sentry.screen.material.color.setHex(0x00ff66);
      }

      // Find closest alive Xenomorph in range
      let closestAlien = null;
      let closestDist = sentry.range;

      for (let i = 0; i < horde.aliens.length; i++) {
        const a = horde.aliens[i];
        if (!a || !a.mesh || a.hp <= 0) continue;
        const d = sentry.group.position.distanceTo(a.mesh.position);
        if (d < closestDist) {
          closestDist = d;
          closestAlien = a;
        }
      }

      sentry.target = closestAlien;

      if (closestAlien) {
        // Compute world direction from sentry to alien
        const targetWorldPos = closestAlien.mesh.position.clone();
        targetWorldPos.y = sentry.group.position.y + 0.8;
        const dir = targetWorldPos.sub(sentry.group.position);

        // Rotate swivel towards target
        const targetAngle = Math.atan2(dir.x, dir.z) - sentry.group.rotation.y;
        let diff = targetAngle - sentry.swivel.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        sentry.swivel.rotation.y += diff * 8.0 * delta;

        // Check if on target and ready to burst
        if (Math.abs(diff) < 0.35 && sentry.fireCooldown <= 0) {
          this.fireBurst(sentry, closestAlien, horde);
        }
      }

      // Dim muzzle flash light
      if (sentry.flashLight.intensity > 0) {
        sentry.flashLight.intensity = Math.max(0, sentry.flashLight.intensity - delta * 30);
      }
    }
  }

  fireBurst(sentry, target, horde) {
    sentry.fireCooldown = 0.45; // Interval between 5-round bursts
    const roundsToFire = Math.min(5, sentry.ammo);
    sentry.ammo -= roundsToFire;

    this.audioEngine.playSentryGunBurst();
    sentry.flashLight.intensity = 4.5;

    // Deal damage to target and small splash
    if (target && target.mesh) {
      const damageTotal = roundsToFire * 42; // Up to 210 burst damage!
      target.hp -= damageTotal;

      if (this.particles) {
        this.particles.emitSparks(target.mesh.position, 12);
      }

      // Check kill
      if (target.hp <= 0) {
        const idx = horde.aliens.indexOf(target);
        if (idx !== -1) {
          if (horde.goreEngine) {
            horde.goreEngine.spawnDismemberment(target.mesh.position, 'heavy');
          }
          horde.spawnAcidPool(target.mesh.position);
          this.scene.remove(target.mesh);
          horde.aliens.splice(idx, 1);
          horde.deadCount++;
        }
      }
    }
  }

  clear() {
    this.sentries.forEach(s => {
      this.scene.remove(s.group);
    });
    this.sentries = [];
  }
}

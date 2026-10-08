/* Yautja Mothership Orbital Plasma Strike Engine */

import * as THREE from 'three';

export class OrbitalStrikeManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.activeBeam = null;
    this.cooldown = 0;
    this.maxCooldown = 30; // 30s cooldown
  }

  triggerStrike(targetPos, horde, bossManager, particleSystem) {
    if (this.cooldown > 0) return false;
    this.cooldown = this.maxCooldown;

    // Create 3D Colossal Orbital Laser Beam Group (Inner Core + Outer Radiant Plasma Cylinder)
    const beamGroup = new THREE.Group();
    beamGroup.position.set(targetPos.x, 0, targetPos.z);

    const outerGeo = new THREE.CylinderGeometry(8.5, 8.5, 120, 16);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.65
    });
    const outerBeam = new THREE.Mesh(outerGeo, outerMat);
    outerBeam.position.y = 60;
    beamGroup.add(outerBeam);

    // Blinding white-hot core
    const coreGeo = new THREE.CylinderGeometry(3.5, 3.5, 120, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    });
    const coreBeam = new THREE.Mesh(coreGeo, coreMat);
    coreBeam.position.y = 60;
    beamGroup.add(coreBeam);

    // Ground ground-zero expanding plasma shockwave disk
    const ringGeo = new THREE.RingGeometry(2, 28, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.2;
    beamGroup.add(ringMesh);

    this.scene.add(beamGroup);

    this.activeBeam = {
      mesh: beamGroup,
      outerMat: outerMat,
      coreMat: coreMat,
      ringMesh: ringMesh,
      life: 2.2,
      pos: targetPos.clone()
    };

    this.audioEngine.playMusouBlast();

    // Damage all Xenomorphs & Bosses in 30m radius
    const strikeAttack = {
      origin: targetPos,
      radius: 30,
      damage: 2500
    };

    const hits = horde.checkMeleeHits(strikeAttack);
    hits.forEach(h => {
      if (h.pos) {
        particleSystem.emitSparks(h.pos, 15);
        particleSystem.spawnDamagePopup(h.pos, h.damage, true);
      }
    });

    if (bossManager.activeBoss) {
      bossManager.takeDamage(2000);
    }

    return true;
  }

  update(delta) {
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - delta);
    }

    if (this.activeBeam) {
      this.activeBeam.life -= delta;
      if (this.activeBeam.life <= 0) {
        this.scene.remove(this.activeBeam.mesh);
        this.activeBeam = null;
      } else {
        const opacity = Math.max(0, this.activeBeam.life / 2.2);
        if (this.activeBeam.outerMat) this.activeBeam.outerMat.opacity = opacity * 0.65;
        if (this.activeBeam.coreMat) this.activeBeam.coreMat.opacity = opacity * 0.95;
        if (this.activeBeam.ringMesh) {
          const progress = 1.0 - (this.activeBeam.life / 2.2);
          this.activeBeam.ringMesh.scale.setScalar(1.0 + progress * 0.8);
          this.activeBeam.ringMesh.material.opacity = (1.0 - progress) * 0.9;
        }
      }
    }
  }
}

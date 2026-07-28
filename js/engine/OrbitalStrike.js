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

    // Create 3D Colossal Orbital Laser Beam (20m radius, 100m height)
    const beamGeo = new THREE.CylinderGeometry(8, 8, 120, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.85
    });

    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(targetPos.x, 60, targetPos.z);
    this.scene.add(beam);

    this.activeBeam = {
      mesh: beam,
      life: 2.0,
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
        const opacity = this.activeBeam.life / 2.0;
        this.activeBeam.mesh.material.opacity = opacity;
      }
    }
  }
}

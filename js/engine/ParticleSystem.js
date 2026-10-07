/* 3D Particle Emitter System (Blood, Acid, Plasma Sparks & Damage Popups) */

import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.popups = [];

    // Shared Particle Geometries & Materials
    this.bloodGeo = new THREE.SphereGeometry(0.12, 4, 4);

    this.acidMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    // Luminescent neon phosphorescent bio-fluid with high emission
    this.yautjaBloodMat = new THREE.MeshBasicMaterial({ color: 0x1aff00 });
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  }

  emitBlood(pos, count = 12, isAcid = true) {
    const mat = isAcid ? this.acidMat : this.yautjaBloodMat;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.bloodGeo, mat);
      mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8 + 1.2,
        (Math.random() - 0.5) * 0.8
      ));
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        Math.random() * 8 + 3,
        (Math.random() - 0.5) * 12
      );

      this.particles.push({
        mesh: mesh,
        velocity: vel,
        life: 0.6,
        maxLife: 0.6
      });
    }
  }

  emitYautjaPhosphorBlood(pos, count = 15) {
    for (let i = 0; i < count; i++) {
      const dropGeo = new THREE.SphereGeometry(0.14, 5, 5);
      const mesh = new THREE.Mesh(dropGeo, this.yautjaBloodMat);
      mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        1.5 + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      ));
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        Math.random() * 6 + 2,
        (Math.random() - 0.5) * 14
      );

      this.particles.push({
        mesh: mesh,
        velocity: vel,
        life: 0.8,
        maxLife: 0.8,
        isYautjaGlow: true
      });
    }

    // Leave a persistent glowing green bio-splatter stain on the terrain
    const stainGeo = new THREE.CircleGeometry(0.4 + Math.random() * 0.3, 8);
    stainGeo.rotateX(-Math.PI / 2);
    const stainMat = new THREE.MeshBasicMaterial({
      color: 0x22ff00,
      transparent: true,
      opacity: 0.85
    });
    const stain = new THREE.Mesh(stainGeo, stainMat);
    stain.position.set(pos.x + (Math.random() - 0.5) * 0.8, 0.03, pos.z + (Math.random() - 0.5) * 0.8);
    this.scene.add(stain);

    setTimeout(() => {
      let op = 0.85;
      const fade = setInterval(() => {
        op -= 0.05;
        if (op <= 0) {
          clearInterval(fade);
          this.scene.remove(stain);
        } else {
          stain.material.opacity = op;
        }
      }, 100);
    }, 8000);
  }

  emitSparks(pos, count = 10) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.bloodGeo, this.sparkMat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        Math.random() * 10 + 2,
        (Math.random() - 0.5) * 16
      );

      this.particles.push({
        mesh: mesh,
        velocity: vel,
        life: 0.4,
        maxLife: 0.4
      });
    }
  }

  spawnDamagePopup(pos, damageAmount, isCrit = false) {
    const div = document.createElement('div');
    div.className = `damage-popup ${isCrit ? 'crit' : ''}`;
    div.innerText = Math.ceil(damageAmount);

    document.getElementById('ui-layer').appendChild(div);

    this.popups.push({
      element: div,
      pos: pos.clone(),
      life: 0.85,
      maxLife: 0.85
    });
  }

  update(delta, camera) {
    // Update 3D Physics Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      // Apply Gravity
      p.velocity.y -= 25 * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);
      const scale = p.life / p.maxLife;
      p.mesh.scale.set(scale, scale, scale);
    }

    // Update Floating Damage Popups (Project 3D position to 2D Screen Screen coordinates)
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.life -= delta;

      if (pop.life <= 0) {
        pop.element.remove();
        this.popups.splice(i, 1);
        continue;
      }

      pop.pos.y += 2.0 * delta; // Float upwards

      // Screen projection
      const screenVector = pop.pos.clone().project(camera);
      const x = (screenVector.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-(screenVector.y * 0.5) + 0.5) * window.innerHeight;

      pop.element.style.left = `${x}px`;
      pop.element.style.top = `${y}px`;
      pop.element.style.opacity = (pop.life / pop.maxLife).toString();
    }
  }
}

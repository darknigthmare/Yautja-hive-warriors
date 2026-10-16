/* Weyland-Yutani Combat Synthetics (Androids with Milky White Blood & Bisection AI) */

import * as THREE from 'three';

export class SyntheticsManager {
  constructor(scene, audioEngine, particles) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.particles = particles;
    this.androids = [];
    this.severedProps = [];
    this.bloodPools = [];

    this.armorMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // White clean Weyland-Yutani synthetic casing
      metalness: 0.85,
      roughness: 0.2
    });
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.5,
      roughness: 0.5
    });
    this.whiteBloodMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    });
  }

  spawnSquad(pos, count = 3) {
    this.clearSquad();

    for (let i = 0; i < count; i++) {
      const isWorkingJoe = i % 2 === 1; // Alternate Weyland-Yutani Combat Synth and Seegson Working Joe
      const mesh = this.createSyntheticMesh(isWorkingJoe);
      const angle = (i / count) * Math.PI * 2;
      mesh.position.set(pos.x + Math.cos(angle) * 16, 0, pos.z + Math.sin(angle) * 16);
      this.scene.add(mesh);

      this.androids.push({
        mesh,
        type: isWorkingJoe ? 'working_joe' : 'weyland_combat',
        hp: isWorkingJoe ? 340 : 280,
        maxHp: isWorkingJoe ? 340 : 280,
        speed: isWorkingJoe ? 7.5 : 9,
        damage: isWorkingJoe ? 34 : 22,
        shootCooldown: 0,
        isBisected: false,
        crawlLife: 0,
        voiceCooldown: 0
      });
    }
  }

  /* Chantier 7: Seegson Working Joe & Weyland Combat Synthetic (Alien: Isolation / Aliens Canon) */
  createSyntheticMesh(isWorkingJoe = false) {
    const group = new THREE.Group();

    const suitMat = isWorkingJoe 
      ? new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 }) // Seegson Dark Overalls
      : this.armorMat;
    const skinMat = isWorkingJoe
      ? new THREE.MeshStandardMaterial({ color: 0xddd6fe, roughness: 0.6 }) // Rubberized synthetic pale skin
      : this.armorMat;

    // Torso with corporate logo casing
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.5), suitMat);
    torso.name = 'torso';
    torso.position.y = 1.8;
    group.add(torso);

    if (!isWorkingJoe) {
      // Weyland-Yutani Yellow Winged Corporate Logo (Aliens 1986 Canon 1:1)
      const logoMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });
      const wyLogo = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.04), logoMat);
      wyLogo.position.set(0, 2.05, 0.28);
      group.add(wyLogo);
    } else {
      // Seegson Blue triangular insignia (Alien: Isolation Canon)
      const seegsonMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const patch = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.22, 3), seegsonMat);
      patch.position.set(0.25, 2.1, 0.28);
      group.add(patch);
    }

    // Synthetic android head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), skinMat);
    head.name = 'head';
    head.position.set(0, 2.8, 0);
    group.add(head);

    if (isWorkingJoe) {
      // Round glowing amber eyes (Alien: Isolation Canon)
      [-0.12, 0.12].forEach(ox => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
        eye.position.set(ox, 2.85, 0.32);
        group.add(eye);
      });
    } else {
      // Glowing optic eye visor
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.08, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x00d2ff })
      );
      visor.name = 'visor';
      visor.position.set(0, 2.8, 0.32);
      group.add(visor);
    }

    // Limbs sub-group
    const legsGroup = new THREE.Group();
    legsGroup.name = 'legs';
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 1.3, 6);
    const leftLeg = new THREE.Mesh(legGeo, suitMat);
    leftLeg.position.set(-0.3, 0.8, 0);
    legsGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, suitMat);
    rightLeg.position.set(0.3, 0.8, 0);
    legsGroup.add(rightLeg);
    group.add(legsGroup);

    // Weapon (Pulse Gun for Weyland-Yutani / Heavy Hydraulic Pliers Baton for Working Joe)
    if (isWorkingJoe) {
      const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 }));
      baton.rotation.x = Math.PI / 4;
      baton.position.set(0.6, 1.8, 0.4);
      group.add(baton);
    } else {
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.6), this.bodyMat);
      gun.name = 'gun';
      gun.position.set(0.6, 1.8, 0.4);
      group.add(gun);
    }

    return group;
  }

  emitWhiteSyntheticBlood(pos) {
    if (this.audioEngine && this.audioEngine.playSyntheticMilkySpurt) {
      this.audioEngine.playSyntheticMilkySpurt();
    }

    for (let i = 0; i < 10; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), this.whiteBloodMat);
      drop.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.4 + 0.3,
        (Math.random() - 0.5) * 0.6
      ));
      this.scene.add(drop);
      setTimeout(() => this.scene.remove(drop), 1200);
    }

    // Milky white coolant puddle on the floor (Bishop Aliens 1986 Canon 1:1)
    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(0.7 + Math.random() * 0.5, 8),
      this.whiteBloodMat
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(pos.x + (Math.random() - 0.5) * 0.8, 0.03, pos.z + (Math.random() - 0.5) * 0.8);
    this.scene.add(puddle);
    setTimeout(() => this.scene.remove(puddle), 9000);
  }

  bisectSynthetic(syn) {
    syn.isBisected = true;
    syn.speed = 2.8; // Slow crawl
    syn.hp = 110;
    syn.crawlLife = 8.0;

    this.audioEngine.playSyntheticShortCircuit();

    // 1. Detach legs and lay them tumbled on the arena floor
    const legs = syn.mesh.getObjectByName('legs');
    if (legs) {
      syn.mesh.remove(legs);
      const severedGroup = new THREE.Group();
      severedGroup.position.copy(syn.mesh.position);
      severedGroup.rotation.y = syn.mesh.rotation.y;
      severedGroup.rotation.z = Math.PI / 2; // Flattened on deck
      severedGroup.position.y = 0.2;
      severedGroup.add(legs);
      this.scene.add(severedGroup);
      this.severedProps.push(severedGroup);
    }

    // 2. Adjust torso down to floor crawl posture (Alien 1979 / Aliens 1986 Lore)
    const torso = syn.mesh.getObjectByName('torso');
    if (torso) {
      torso.position.y = 0.35;
      torso.rotation.x = Math.PI * 0.3;
    }
    const head = syn.mesh.getObjectByName('head');
    if (head) {
      head.position.set(0, 0.65, 0.4);
      head.rotation.x = 0.2;
    }
    const visor = syn.mesh.getObjectByName('visor');
    if (visor) {
      visor.position.set(0, 0.65, 0.72);
      visor.rotation.x = 0.2;
    }
    const gun = syn.mesh.getObjectByName('gun');
    if (gun) {
      gun.position.set(0.5, 0.3, 0.65);
    }

    // 3. Hanging hydraulic cables and severed power cords
    const wireGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.5, 4);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    for (let w = 0; w < 3; w++) {
      const wire = new THREE.Mesh(wireGeo, wireMat);
      wire.position.set((w - 1) * 0.15, 0.05, -0.2);
      wire.rotation.x = Math.PI / 3;
      syn.mesh.add(wire);
    }

    // 4. White milky fluid pool decal
    const poolGeo = new THREE.CircleGeometry(1.6, 16);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const poolMesh = new THREE.Mesh(poolGeo, poolMat);
    poolMesh.position.set(syn.mesh.position.x, 0.02, syn.mesh.position.z);
    this.scene.add(poolMesh);
    this.bloodPools.push(poolMesh);

    this.emitWhiteSyntheticBlood(syn.mesh.position);
  }

  update(delta, player, horde) {
    for (let i = this.androids.length - 1; i >= 0; i--) {
      const syn = this.androids[i];

      // Bisected Crawling State update
      if (syn.isBisected) {
        syn.crawlLife -= delta;
        // Crawling heave animation
        syn.mesh.position.y = 0.15 + Math.abs(Math.sin(Date.now() * 0.007)) * 0.06;

        if (Math.random() < 0.04) {
          this.emitWhiteSyntheticBlood(syn.mesh.position);
        }

        if (syn.crawlLife <= 0 || syn.hp <= 0) {
          // Android finally deactivates
          this.audioEngine.playSyntheticShortCircuit();
          this.scene.remove(syn.mesh);
          this.androids.splice(i, 1);
          continue;
        }
      }

      // EMP Overcharge Stun Check
      if (syn.isEMPStunned) {
        syn.empStunTimer -= delta;
        syn.mesh.rotation.z = Math.sin(Date.now() * 0.05) * 0.15; // Jittering malfunction glitch
        if (syn.empStunTimer <= 0) {
          syn.isEMPStunned = false;
          syn.mesh.rotation.z = 0;
        }
        continue; // Fully disabled while rebooting circuits
      }

      // Target nearest Xenomorph first, or Yautja if close
      let targetPos = null;
      let isXeno = false;

      if (horde.aliens.length > 0) {
        let nearestDist = Infinity;
        horde.aliens.forEach(a => {
          const d = syn.mesh.position.distanceTo(a.mesh.position);
          if (d < nearestDist) {
            nearestDist = d;
            targetPos = a.mesh.position;
            isXeno = true;
          }
        });
      }

      if (!targetPos) {
        targetPos = player.position;
      }

      const dir = targetPos.clone().sub(syn.mesh.position);
      dir.y = 0;
      const dist = dir.length();

      const isJoe = syn.type === 'working_joe';
      const stopDist = syn.isBisected ? 6.0 : (isJoe ? 2.2 : 10.0);

      if (dist > stopDist) {
        dir.normalize();
        syn.mesh.position.addScaledVector(dir, syn.speed * delta);
        syn.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        syn.mesh.rotation.y = Math.atan2(dir.x, dir.z);

        if (isJoe && !syn.isBisected) {
          // Seegson Working Joe Relentless Melee & Industrial Grapple (Alien: Isolation Canon)
          syn.shootCooldown -= delta;
          if (syn.shootCooldown <= 0) {
            syn.shootCooldown = 1.35;
            if (isXeno) {
              horde.checkMeleeHits({ origin: targetPos, radius: 2.2, damage: syn.damage * 1.5 });
              if (this.audioEngine.playSlash) this.audioEngine.playSlash();
            } else {
              player.takeDamage(syn.damage, false, syn);
              if (this.audioEngine.playWorkingJoeVoice) this.audioEngine.playWorkingJoeVoice();

              syn.voiceTimer = (syn.voiceTimer || 0) + 1;
              if (syn.voiceTimer % 3 === 1) {
                const quotes = [
                  "What are you doing?",
                  "Tut tut, you shouldn't be here.",
                  "Let's resolve this calmly.",
                  "You are becoming an inconvenience.",
                  "Always run, never walk."
                ];
                const quote = quotes[Math.floor(Math.random() * quotes.length)];
                if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
                  window.gameInstance.ui.showAnnouncement(`🔊 SEEGSON WORKING JOE : "${quote}"`);
                }
              }
            }
          }
        } else {
          // Shoot pulse weapon
          syn.shootCooldown -= delta;
          if (syn.shootCooldown <= 0) {
            syn.shootCooldown = syn.isBisected ? 2.2 : 1.2;
            this.audioEngine.playPulseRifleBurst();
            if (isXeno) {
              horde.checkMeleeHits({ origin: targetPos, radius: 1.5, damage: syn.damage });
            } else {
              player.takeDamage(syn.damage * 0.4, false, syn);
            }
          }
        }
      }
    }
  }

  checkHits(attack) {
    const hits = [];
    for (let i = this.androids.length - 1; i >= 0; i--) {
      const syn = this.androids[i];
      if (syn.mesh.position.distanceTo(attack.origin) <= attack.radius) {
        syn.hp -= attack.damage;
        this.emitWhiteSyntheticBlood(syn.mesh.position);

        if (attack.type === 'emp' || attack.type === 'plasma' || attack.damage >= 180) {
          syn.isEMPStunned = true;
          syn.empStunTimer = 3.5;
          if (this.particles) this.particles.emitSparks(syn.mesh.position, 14);
        }

        if (syn.hp <= 0) {
          if (!syn.isBisected) {
            // Cut in half! Enter crawling torso state!
            this.bisectSynthetic(syn);
            hits.push({ pos: syn.mesh.position.clone(), damage: attack.damage, killed: false, bisected: true });
          } else {
            // Terminated bisected android
            this.audioEngine.playSyntheticShortCircuit();
            this.scene.remove(syn.mesh);
            this.androids.splice(i, 1);
            hits.push({ pos: syn.mesh.position.clone(), damage: attack.damage, killed: true });
          }
        } else {
          hits.push({ pos: syn.mesh.position.clone(), damage: attack.damage, killed: false });
        }
      }
    }
    return hits;
  }

  clearSquad() {
    this.androids.forEach(s => this.scene.remove(s.mesh));
    this.androids = [];
    this.severedProps.forEach(p => this.scene.remove(p));
    this.severedProps = [];
    this.bloodPools.forEach(b => this.scene.remove(b));
    this.bloodPools = [];
  }
}

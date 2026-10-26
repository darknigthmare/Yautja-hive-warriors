/* Dynamic Environmental Weather & Explosive Hazards Manager */

import * as THREE from 'three';

export class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.pipes = [];
    this.steamVents = [];
    this.weatherType = 'none';
    this.weatherParticles = null;
    this.particlePositions = null;
    this.particleVelocities = null;
    this.particleCount = 0;
    this.lightningTimer = 4.0;
    this.timeAccumulator = 0;

    this.pipeMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.8 });
  }

  setWeather(type) {
    if (this.weatherParticles) {
      this.scene.remove(this.weatherParticles);
      if (this.weatherParticles.geometry) this.weatherParticles.geometry.dispose();
      if (this.weatherParticles.material) this.weatherParticles.material.dispose();
      this.weatherParticles = null;
    }

    this.weatherType = type;
    this.lightningTimer = 5.0 + Math.random() * 5.0;

    if (type === 'rain' || type === 'storm') {
      this.initRain(type === 'storm');
    } else if (type === 'zero_g_cryo') {
      this.initZeroGCryo();
    } else if (type === 'toxic_spores') {
      this.initToxicSpores();
    } else if (type === 'humid_mist') {
      this.initHumidMist();
    } else if (type === 'autumn_gale') {
      this.initAutumnGale();
    }
  }

  initRain(isStorm = false) {
    this.particleCount = isStorm ? 1600 : 1000;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = [];

    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 35;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      this.particleVelocities.push({
        y: -(isStorm ? 62 : 48) - Math.random() * 12,
        x: isStorm ? -6.0 : 0
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particlePositions = positions;

    const mat = new THREE.PointsMaterial({
      color: isStorm ? 0x93c5fd : 0x60a5fa,
      size: 0.28,
      transparent: true,
      opacity: isStorm ? 0.75 : 0.6,
      blending: THREE.AdditiveBlending
    });

    this.weatherParticles = new THREE.Points(geo, mat);
    this.scene.add(this.weatherParticles);
  }

  initZeroGCryo() {
    this.particleCount = 600;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = [];

    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 70;
      positions[i * 3 + 1] = 0.5 + Math.random() * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 70;

      this.particleVelocities.push({
        vy: (Math.random() - 0.5) * 0.8,
        vx: (Math.random() - 0.5) * 0.6,
        vz: (Math.random() - 0.5) * 0.6,
        freq: 0.5 + Math.random() * 1.5
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particlePositions = positions;

    const mat = new THREE.PointsMaterial({
      color: 0x99f6e4,
      size: 0.4,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    this.weatherParticles = new THREE.Points(geo, mat);
    this.scene.add(this.weatherParticles);
  }

  initToxicSpores() {
    this.particleCount = 750;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = [];

    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 75;
      positions[i * 3 + 1] = 0.2 + Math.random() * 22;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 75;

      this.particleVelocities.push({
        vy: 0.8 + Math.random() * 1.4,
        drift: (Math.random() - 0.5) * 1.8
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particlePositions = positions;

    const mat = new THREE.PointsMaterial({
      color: 0xa3e635,
      size: 0.35,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    this.weatherParticles = new THREE.Points(geo, mat);
    this.scene.add(this.weatherParticles);
  }

  initHumidMist() {
    this.particleCount = 450;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = [];

    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = 0.3 + Math.random() * 4.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      this.particleVelocities.push({
        vx: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.4
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particlePositions = positions;

    const mat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 0.7,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });

    this.weatherParticles = new THREE.Points(geo, mat);
    this.scene.add(this.weatherParticles);
  }

  initAutumnGale() {
    this.particleCount = 850;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = [];

    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 25;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      this.particleVelocities.push({
        vy: -3.5 - Math.random() * 4.5,
        vx: 8.5 + Math.random() * 5.0,
        vz: (Math.random() - 0.5) * 4.0,
        swayFreq: 1.5 + Math.random() * 2.5
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particlePositions = positions;

    const mat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.55,
      transparent: true,
      opacity: 0.85
    });

    this.weatherParticles = new THREE.Points(geo, mat);
    this.scene.add(this.weatherParticles);
  }

  update(delta, playerPos, renderer, audioEngine, horde) {
    this.timeAccumulator += delta;

    if (this.weatherParticles && this.particlePositions) {
      const pos = this.particlePositions;
      const center = playerPos || new THREE.Vector3(0, 0, 0);

    if (this.weatherType === 'rain' || this.weatherType === 'storm') {
      const isStorm = this.weatherType === 'storm';

      // Lightning Thunderstorm loop
      if (isStorm) {
        this.lightningTimer -= delta;
        if (this.lightningTimer <= 0) {
          this.lightningTimer = 6.0 + Math.random() * 8.0;
          if (renderer && renderer.triggerLightningFlash) {
            renderer.triggerLightningFlash(0xd8ecff, 4.8);
          }
          if (audioEngine && audioEngine.playThunderClap) {
            audioEngine.playThunderClap();
          }
        }
      }

      for (let i = 0; i < this.particleCount; i++) {
        const vel = this.particleVelocities[i];
        pos[i * 3 + 1] += vel.y * delta;
        pos[i * 3] += vel.x * delta;

        if (pos[i * 3 + 1] <= 0) {
          pos[i * 3 + 1] = 32 + Math.random() * 5;
          pos[i * 3] = center.x + (Math.random() - 0.5) * 80;
          pos[i * 3 + 2] = center.z + (Math.random() - 0.5) * 80;
        }
      }
    } else if (this.weatherType === 'zero_g_cryo') {
      for (let i = 0; i < this.particleCount; i++) {
        const vel = this.particleVelocities[i];
        pos[i * 3] += Math.sin(this.timeAccumulator * vel.freq + i) * 0.8 * delta;
        pos[i * 3 + 1] += vel.vy * delta;
        pos[i * 3 + 2] += Math.cos(this.timeAccumulator * vel.freq + i) * 0.8 * delta;

        if (pos[i * 3 + 1] < 0.2) pos[i * 3 + 1] = 20;
        if (pos[i * 3 + 1] > 22) pos[i * 3 + 1] = 0.5;
      }
    } else if (this.weatherType === 'toxic_spores') {
      for (let i = 0; i < this.particleCount; i++) {
        const vel = this.particleVelocities[i];
        pos[i * 3 + 1] += vel.vy * delta;
        pos[i * 3] += Math.sin(this.timeAccumulator * 1.5 + i) * vel.drift * delta;
        pos[i * 3 + 2] += Math.cos(this.timeAccumulator * 1.5 + i) * vel.drift * delta;

        if (pos[i * 3 + 1] > 24) {
          pos[i * 3 + 1] = 0.2;
          pos[i * 3] = center.x + (Math.random() - 0.5) * 75;
          pos[i * 3 + 2] = center.z + (Math.random() - 0.5) * 75;
        }
      }
    } else if (this.weatherType === 'humid_mist') {
      for (let i = 0; i < this.particleCount; i++) {
        const vel = this.particleVelocities[i];
        pos[i * 3] += vel.vx * delta;
        pos[i * 3 + 2] += vel.vz * delta;

        // Wrap around player radius
        if (Math.abs(pos[i * 3] - center.x) > 42) pos[i * 3] = center.x - Math.sign(pos[i * 3] - center.x) * 40;
        if (Math.abs(pos[i * 3 + 2] - center.z) > 42) pos[i * 3 + 2] = center.z - Math.sign(pos[i * 3 + 2] - center.z) * 40;
      }
    }

    else if (this.weatherType === 'autumn_gale') {
      for (let i = 0; i < this.particleCount; i++) {
        const vel = this.particleVelocities[i];
        pos[i * 3 + 1] += vel.vy * delta;
        pos[i * 3] += (vel.vx + Math.sin(this.timeAccumulator * vel.swayFreq + i) * 3.0) * delta;
        pos[i * 3 + 2] += (vel.vz + Math.cos(this.timeAccumulator * vel.swayFreq + i) * 2.0) * delta;

        if (pos[i * 3 + 1] <= 0.1) {
          pos[i * 3 + 1] = 22 + Math.random() * 4;
          pos[i * 3] = center.x - 40 + (Math.random() - 0.5) * 20;
          pos[i * 3 + 2] = center.z + (Math.random() - 0.5) * 75;
        }
      }
    }

    if (this.weatherParticles && this.weatherParticles.geometry) {
      this.weatherParticles.geometry.attributes.position.needsUpdate = true;
    }
  }

    // Chantier 2: Update Geothermal High-Pressure Steam Geysers
    for (let i = 0; i < this.steamVents.length; i++) {
      const v = this.steamVents[i];
      if (!v.isErupting) {
        v.cycleTimer -= delta;
        if (v.cycleTimer <= 0) {
          v.isErupting = true;
          v.eruptDuration = 2.4;
          v.cycleTimer = 5.0 + Math.random() * 4.5;
          if (audioEngine && audioEngine.playSteamVentHiss) {
            audioEngine.playSteamVentHiss();
          }
        }
      } else {
        v.eruptDuration -= delta;
        const progress = v.eruptDuration / 2.4;
        v.steamMesh.material.opacity = Math.sin((1.0 - progress) * Math.PI) * 0.75;
        const puff = 1.0 + Math.sin(progress * 16) * 0.15;
        v.steamMesh.scale.set(puff, 1.0 + (1.0 - progress) * 0.35, puff);

        // Scald & Launch Xenomorphs
        if (horde && horde.aliens) {
          horde.aliens.forEach(a => {
            if (a.hp > 0 && a.mesh.position.distanceTo(v.pos) <= 2.5) {
              a.hp -= 95 * delta;
              if (a.type === 'facehugger') a.hp = 0;
              if (!a.isAirborne && Math.random() < 0.25) {
                a.isAirborne = true;
                a.airborneVelY = 14.0;
              }
            }
          });
        }

        if (v.eruptDuration <= 0) {
          v.isErupting = false;
          v.steamMesh.material.opacity = 0;
        }
      }
    }
  }

  clear() {
    if (this.weatherParticles) {
      this.scene.remove(this.weatherParticles);
      if (this.weatherParticles.geometry) this.weatherParticles.geometry.dispose();
      if (this.weatherParticles.material) this.weatherParticles.material.dispose();
      this.weatherParticles = null;
    }
    this.pipes.forEach(p => this.scene.remove(p.mesh));
    this.pipes = [];
    this.steamVents.forEach(v => this.scene.remove(v.group));
    this.steamVents = [];
  }

  /* Chantier 2: Geothermal High-Pressure Steam Geysers & Thermal Vents */
  spawnSteamVents(count = 5) {
    this.steamVents.forEach(v => this.scene.remove(v.group));
    this.steamVents = [];

    const ventMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 });
    const grateMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true });
    const steamMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0, side: THREE.DoubleSide });

    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const radius = 16 + Math.random() * 22;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      group.position.set(x, 0.05, z);

      // Scorched metal circular collar
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.2, 12), ventMat);
      group.add(rim);

      // Glowing heat grate
      const grate = new THREE.Mesh(new THREE.CircleGeometry(1.4, 8), grateMat);
      grate.rotation.x = -Math.PI / 2;
      grate.position.y = 0.11;
      group.add(grate);

      // High-pressure steam plume cone
      const plume = new THREE.Mesh(new THREE.ConeGeometry(1.6, 8.5, 12, 1, true), steamMat.clone());
      plume.position.y = 4.25;
      group.add(plume);

      this.scene.add(group);
      this.steamVents.push({
        group: group,
        steamMesh: plume,
        pos: new THREE.Vector3(x, 0, z),
        cycleTimer: 1.5 + Math.random() * 5.0,
        isErupting: false,
        eruptDuration: 0
      });
    }
  }

  spawnGasPipes(count = 6) {
    this.pipes.forEach(p => this.scene.remove(p.mesh));
    this.pipes = [];

    const methaneMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.3 }); // Red Methane
    const cryoMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.15 }); // Cyan Cryo Nitrogen
    const flangeMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
    const frostMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });

    for (let i = 0; i < count; i++) {
      const isCryo = i % 2 === 0;
      const group = new THREE.Group();

      const geo = new THREE.CylinderGeometry(0.5, 0.5, 6, 8);
      const mainPipe = new THREE.Mesh(geo, isCryo ? cryoMat : methaneMat);
      group.add(mainPipe);

      // Flange rings at top, center and bottom
      [-2.6, 0, 2.6].forEach(y => {
        const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.25, 8), flangeMat);
        flange.position.y = y;
        group.add(flange);
      });

      // Hazard warning bands (Frost white for cryo, black for methane)
      [-1.3, 1.3].forEach(y => {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.35, 8), isCryo ? frostMat : new THREE.MeshBasicMaterial({ color: 0x111111 }));
        band.position.y = y;
        group.add(band);
      });

      group.position.set((Math.random() - 0.5) * 60, 3, (Math.random() - 0.5) * 60);
      this.scene.add(group);

      this.pipes.push({
        mesh: group,
        type: isCryo ? 'cryo' : 'methane',
        hp: 50,
        pos: group.position.clone()
      });
    }
  }

  checkExplosions(attackPos, radius, horde, particleSystem) {
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const pipe = this.pipes[i];
      if (attackPos.distanceTo(pipe.pos) < radius) {
        if (pipe.type === 'cryo') {
          // Sub-Zero Liquid Nitrogen Blast (Alien: Romulus 2024 / Alien 3 Canon)
          if (this.audioEngine && this.audioEngine.playCryoVentHiss) {
            this.audioEngine.playCryoVentHiss();
          }

          particleSystem.emitSparks(pipe.pos, 35);

          // Expanding Frost Vapor Sphere
          const cryoCloudGeo = new THREE.SphereGeometry(2.5, 12, 12);
          const cryoCloudMat = new THREE.MeshBasicMaterial({
            color: 0x93c5fd,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
          });
          const cryoCloud = new THREE.Mesh(cryoCloudGeo, cryoCloudMat);
          cryoCloud.position.copy(pipe.pos);
          this.scene.add(cryoCloud);

          let scale = 1.0;
          const cryoAnim = setInterval(() => {
            scale += 0.9;
            cryoCloud.scale.set(scale, scale, scale);
            cryoCloud.material.opacity -= 0.1;
            if (cryoCloud.material.opacity <= 0) {
              clearInterval(cryoAnim);
              this.scene.remove(cryoCloud);
            }
          }, 35);

          this.scene.remove(pipe.mesh);
          this.pipes.splice(i, 1);

          // Flash-Freeze all Xenomorphs in 9.5m radius
          if (horde && horde.aliens) {
            horde.aliens.forEach(a => {
              if (a.mesh.position.distanceTo(pipe.pos) <= 9.5) {
                a.isFlashFrozen = true;
                a.frozenTimer = 6.0;
                a.mesh.traverse(child => {
                  if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                    child.material.color.setHex(0xa5f3fc); // Frosted ice statue
                    child.material.roughness = 0.1;
                  }
                });
              }
            });
          }
        } else {
          // Methane Fireball Explosion
          particleSystem.emitSparks(pipe.pos, 45);

          // Visual expanding orange-red fireball
          const fireballGeo = new THREE.SphereGeometry(2.0, 10, 10);
          const fireballMat = new THREE.MeshBasicMaterial({
            color: 0xff3300,
            transparent: true,
            opacity: 0.85
          });
          const fireball = new THREE.Mesh(fireballGeo, fireballMat);
          fireball.position.copy(pipe.pos);
          this.scene.add(fireball);

          let scale = 1.0;
          const fireAnim = setInterval(() => {
            scale += 0.8;
            fireball.scale.set(scale, scale, scale);
            fireball.material.opacity -= 0.12;
            if (fireball.material.opacity <= 0) {
              clearInterval(fireAnim);
              this.scene.remove(fireball);
            }
          }, 30);

          this.scene.remove(pipe.mesh);
          this.pipes.splice(i, 1);

          // Wipe nearby Xenomorphs in 15m radius
          const expAttack = { origin: pipe.pos, radius: 15, damage: 850 };
          horde.checkMeleeHits(expAttack);
        }
      }
    }
  }

  clear() {
    if (this.weatherParticles) {
      this.scene.remove(this.weatherParticles);
      if (this.weatherParticles.geometry) this.weatherParticles.geometry.dispose();
      if (this.weatherParticles.material) this.weatherParticles.material.dispose();
      this.weatherParticles = null;
    }
    this.pipes.forEach(p => this.scene.remove(p.mesh));
    this.pipes = [];
  }
}

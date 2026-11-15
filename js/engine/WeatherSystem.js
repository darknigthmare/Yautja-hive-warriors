/* Lightweight biome weather and time-stepped environmental explosions. */

import * as THREE from 'three';
import { disposeObject } from './SceneResources.js';
import { createSurfaceMaterial } from '../graphics/SurfaceLibrary.js';

const RAIN_THEMES = new Set(['rain', 'rain_forest', 'la_rooftops', 'storm']);

export class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.pipes = [];
    this.steamVents = [];
    this.weatherParticles = null;
    this.particlePositions = null;
    this.particleVelocities = null;
    this.particleCount = 0;
    this.lightningTimer = 5;
    this.timeAccumulator = 0;
    this.effects = [];
    this.weatherType = 'none';
    this.weather = null;
    this.ripples = null;
    this.quality = 'balanced';
    this.elapsed = 0;
    this.focus = new THREE.Vector3();
    this.pipeMat = createSurfaceMaterial('metal', { color: 0xa68a4c, metalness: 0.65, roughness: 0.4, repeat: [2, 3] });
    this.bandMat = createSurfaceMaterial('metal', { color: 0x17222a, roughness: 0.8 });
    this.flangeMat = createSurfaceMaterial('metal', { color: 0x758393, metalness: 0.8, roughness: 0.35 });
    this.pipeGeo = new THREE.LatheGeometry([
      new THREE.Vector2(0.43, -3), new THREE.Vector2(0.49, -2.96), new THREE.Vector2(0.5, -2.90),
      new THREE.Vector2(0.5, 2.90), new THREE.Vector2(0.49, 2.96), new THREE.Vector2(0.43, 3)
    ], 24);
    this.flangeGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.25, 24);
    this.bandGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.35, 20);
    this.valveGeo = new THREE.TorusGeometry(0.37, 0.065, 8, 20);
    this.fireballGeo = new THREE.SphereGeometry(1, 20, 14);
    const data = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const i = (y * 32 + x) * 4;
      const distance = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      data[i + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - distance), 1.8));
    }
    this.particleSprite = new THREE.DataTexture(data, 32, 32);
    this.particleSprite.needsUpdate = true;
    this.particleSprite.minFilter = THREE.LinearFilter;
    this.particleSprite.magFilter = THREE.LinearFilter;
    this._rippleMatrix = new THREE.Object3D();
    this._rippleColor = new THREE.Color();
  }

  setWeather(type = 'none') {
    this._clearMediaWeather();
    const media = { zero_g_cryo: 'initZeroGCryo', toxic_spores: 'initToxicSpores', humid_mist: 'initHumidMist', autumn_gale: 'initAutumnGale', morning_haze: 'initMorningHaze', prey_mist: 'initMorningHaze', stasis_aurora: 'initStasisAurora', cosmic_nebula: 'initStasisAurora' };
    if (media[type]) {
      this._setBaseWeather('none'); this.weatherType = type;
      this[media[type]]();
      if (this.weatherParticles?.material) { this.weatherParticles.material.depthWrite = false; this.weatherParticles.frustumCulled = false; }
      return;
    }
    this._setBaseWeather(type);
  }

  _setBaseWeather(type = 'none') {
    this.weatherType = type;
    this.quality = this.scene.userData.graphicsQuality || 'balanced';
    if (this.weather) {
      if (this.ripples) {
        this.ripples.geometry.dispose(); this.ripples.material.dispose(); this.ripples.dispose();
        this.ripples = null;
      }
      this.scene.remove(this.weather);
      this.weather.geometry.dispose();
      this.weather.material.dispose();
      this.weather = null;
    }
    if (type === 'none') return;
    const rain = RAIN_THEMES.has(type);
    const density = this.quality === 'high' ? 1.5 : this.quality === 'low' ? 0.5 : 1;
    const count = Math.round((rain ? 540 : (type === 'hive_world' ? 220 : 150)) * density);
    const positions = new Float32Array(count * (rain ? 6 : 3));
    for (let i = 0; i < count; i++) {
      const index = i * (rain ? 6 : 3);
      positions[index] = (Math.random() - 0.5) * 140;
      positions[index + 1] = Math.random() * 28;
      positions[index + 2] = (Math.random() - 0.5) * 140;
      if (rain) {
        positions[index + 3] = positions[index] + 0.16;
        positions[index + 4] = positions[index + 1] - 1.2;
        positions[index + 5] = positions[index + 2];
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (rain) {
      const material = new THREE.LineBasicMaterial({ color: 0xa7d6de, transparent: true, opacity: 0.22, depthWrite: false, fog: true });
      this.weather = new THREE.LineSegments(geometry, material);
    } else {
      const material = new THREE.PointsMaterial({ color: type === 'hive_world' ? 0xb1e3a5 : 0xd5d5bc, map: this.particleSprite, size: type === 'pyramid' ? 0.12 : 0.15, transparent: true, opacity: 0.55, depthWrite: false, fog: true });
      this.weather = new THREE.Points(geometry, material);
    }
    this.weather.frustumCulled = false;
    this.weather.position.copy(this.focus);
    this.scene.add(this.weather);
    if (rain && this.quality !== 'low') {
      const ring = new THREE.RingGeometry(0.16, 0.19, 18);
      ring.rotateX(-Math.PI / 2);
      this.ripples = new THREE.InstancedMesh(ring, new THREE.MeshBasicMaterial({ color: 0x86b8be, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }), this.quality === 'high' ? 96 : 48);
      this.ripples.frustumCulled = false;
      this.weather.add(this.ripples);
      this.updateRipples();
    }
  }

  updateRipples() {
    if (!this.ripples) return;
    for (let i = 0; i < this.ripples.count; i++) {
      const phase = (this.elapsed * 1.5 + i * 0.6180339) % 1;
      const x = Math.sin(i * 127.1) * 63;
      const z = Math.cos(i * 311.7) * 63;
      this._rippleMatrix.position.set(x, 0.06, z);
      this._rippleMatrix.scale.setScalar(0.3 + phase * 3.0);
      this._rippleMatrix.updateMatrix();
      this.ripples.setMatrixAt(i, this._rippleMatrix.matrix);
      this._rippleColor.setScalar((1 - phase) * (1 - phase));
      this.ripples.setColorAt(i, this._rippleColor);
    }
    this.ripples.instanceMatrix.needsUpdate = true;
    this.ripples.instanceColor.needsUpdate = true;
  }

  setFocus(position) {
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return;
    this.focus.set(position.x, 0, position.z);
    this.weather?.position.copy(this.focus);
  }

  spawnGasPipes(count = 6, center = null) {
    this.clearPipes();
    // Stay clear of the deployment area and preserve lanes through the arena.
    const pipeCount = Math.min(12, Math.max(0, Math.floor(count)));
    for (let i = 0; i < pipeCount; i++) {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(this.pipeGeo, this.pipeMat));
      [-2.6, 0, 2.6].forEach(y => {
        const flange = new THREE.Mesh(this.flangeGeo, this.flangeMat);
        flange.position.y = y;
        group.add(flange);
      });
      [-1.3, 1.3].forEach(y => {
        const band = new THREE.Mesh(this.bandGeo, this.bandMat);
        band.position.y = y;
        group.add(band);
      });
      const valve = new THREE.Mesh(this.valveGeo, this.flangeMat);
      valve.position.set(0, 0.7, 0.64);
      group.add(valve);
      const angle = (i + 0.35) / Math.max(1, pipeCount) * Math.PI * 2;
      const radius = 27 + (i % 3) * 6;
      group.position.set((center?.x ?? 0) + Math.sin(angle) * radius, 3, (center?.z ?? 0) + Math.cos(angle) * radius);
      group.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
      this.scene.add(group);
      this.pipes.push({ mesh: group, hp: 50, pos: group.position.clone() });
    }
  }

  checkExplosions(attackPos, radius, horde, particleSystem) {
    if (!attackPos) return;
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const pipe = this.pipes[i];
      if (attackPos.distanceTo(pipe.pos) >= radius) continue;
      particleSystem?.emitSparks(pipe.pos, 45);
      const fireball = new THREE.Mesh(this.fireballGeo, new THREE.MeshBasicMaterial({ color: 0xff6b24, transparent: true, opacity: 0.85, depthWrite: false }));
      fireball.position.copy(pipe.pos);
      this.scene.add(fireball);
      this.effects.push({ mesh: fireball, elapsed: 0 });
      this.scene.remove(pipe.mesh);
      this.pipes.splice(i, 1);
      horde?.checkMeleeHits({ origin: pipe.pos, radius: 15, damage: 850 });
    }
  }

  _updateBase(delta) {
    const step = Math.min(0.1, Math.max(0, delta));
    this.elapsed += step;
    if (this.quality !== (this.scene.userData.graphicsQuality || 'balanced')) this.setWeather(this.weatherType);
    if (this.weather) {
      const rain = RAIN_THEMES.has(this.weatherType);
      const attribute = this.weather.geometry.attributes.position;
      const positions = attribute.array;
      const stride = rain ? 6 : 3;
      for (let i = 0; i < positions.length; i += stride) {
        positions[i + 1] -= step * (rain ? 23 : 0.45);
        if (rain) {
          positions[i] -= step * 3;
          if (positions[i] < -70) positions[i] = 70;
          if (positions[i + 1] < 0) positions[i + 1] = 28;
          positions[i + 3] = positions[i] + 0.16;
          positions[i + 4] = positions[i + 1] - 1.2;
        } else {
          positions[i] += Math.sin(this.elapsed * 0.6 + i) * step * 0.15;
          if (positions[i + 1] < 0.3) positions[i + 1] = 18;
        }
      }
      attribute.needsUpdate = true;
    }
    this.updateRipples();
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.elapsed += step;
      effect.mesh.scale.setScalar(2 + effect.elapsed * 22);
      effect.mesh.material.opacity = Math.max(0, 0.85 * (1 - effect.elapsed / 0.4));
      if (effect.elapsed >= 0.4) {
        this.scene.remove(effect.mesh);
        effect.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  clearPipes() {
    this.pipes.forEach(pipe => this.scene.remove(pipe.mesh));
    this.pipes = [];
  }

  _clearBase() {
    this.clearPipes();
    this.effects.forEach(effect => {
      this.scene.remove(effect.mesh);
      effect.mesh.material.dispose();
    });
    this.effects = [];
    this.setWeather('none');
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

  initMorningHaze() {
    this.particleCount = 750;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = [];

    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = 0.5 + Math.random() * 14;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      this.particleVelocities.push({
        vy: (Math.random() - 0.5) * 0.4,
        vx: 1.5 + Math.random() * 2.5,
        vz: (Math.random() - 0.5) * 1.5,
        swayFreq: 0.8 + Math.random() * 1.5
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particlePositions = positions;

    const mat = new THREE.PointsMaterial({
      color: 0xd4d4d8,
      size: 0.85,
      transparent: true,
      opacity: 0.45
    });

    this.weatherParticles = new THREE.Points(geo, mat);
    this.scene.add(this.weatherParticles);
  }

  initStasisAurora() {
    this.particleCount = 850;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = [];

    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = 0.5 + Math.random() * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;

      this.particleVelocities.push({
        vy: (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 0.8,
        vz: (Math.random() - 0.5) * 0.8,
        swayFreq: 0.5 + Math.random() * 1.2
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particlePositions = positions;

    const mat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.95,
      transparent: true,
      opacity: 0.55
    });

    this.weatherParticles = new THREE.Points(geo, mat);
    this.scene.add(this.weatherParticles);
  }

  spawnSteamVents(count = 5) {
    count = Math.min(12, Math.max(0, Math.floor(Number(count) || 0)));
    const oldVents = new THREE.Group(); this.steamVents.forEach(v => oldVents.add(v.group)); disposeObject(oldVents);
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

  _updateMediaWeather(delta, playerPos, renderer, audioEngine, horde) {
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
    } else if (this.weatherType === 'morning_haze' || this.weatherType === 'prey_mist') {
      for (let i = 0; i < this.particleCount; i++) {
        const vel = this.particleVelocities[i];
        pos[i * 3 + 1] += vel.vy * delta;
        pos[i * 3] += (vel.vx + Math.sin(this.timeAccumulator * vel.swayFreq + i) * 1.2) * delta;
        pos[i * 3 + 2] += (vel.vz + Math.cos(this.timeAccumulator * vel.swayFreq + i) * 0.8) * delta;

        if (pos[i * 3 + 1] < 0.2) pos[i * 3 + 1] = 12.0;
        if (pos[i * 3 + 1] > 14.0) pos[i * 3 + 1] = 0.5;

        if (Math.abs(pos[i * 3] - center.x) > 42) pos[i * 3] = center.x - Math.sign(pos[i * 3] - center.x) * 40;
        if (Math.abs(pos[i * 3 + 2] - center.z) > 42) pos[i * 3 + 2] = center.z - Math.sign(pos[i * 3 + 2] - center.z) * 40;
      }
    } else if (this.weatherType === 'stasis_aurora' || this.weatherType === 'cosmic_nebula') {
      for (let i = 0; i < this.particleCount; i++) {
        const vel = this.particleVelocities[i];
        pos[i * 3 + 1] += Math.sin(this.timeAccumulator * 0.8 + i) * 0.4 * delta;
        pos[i * 3] += (vel.vx + Math.sin(this.timeAccumulator * vel.swayFreq + i) * 0.6) * delta;
        pos[i * 3 + 2] += (vel.vz + Math.cos(this.timeAccumulator * vel.swayFreq + i) * 0.6) * delta;

        if (pos[i * 3 + 1] < 0.2) pos[i * 3 + 1] = 16.0;
        if (pos[i * 3 + 1] > 18.0) pos[i * 3 + 1] = 0.5;

        if (Math.abs(pos[i * 3] - center.x) > 45) pos[i * 3] = center.x - Math.sign(pos[i * 3] - center.x) * 43;
        if (Math.abs(pos[i * 3 + 2] - center.z) > 45) pos[i * 3 + 2] = center.z - Math.sign(pos[i * 3 + 2] - center.z) * 43;
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
              if (!a.isAirborne && Math.random() < 1 - Math.exp(-17.26 * delta)) {
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

  _clearMediaWeather() {
    if (this.weatherParticles) disposeObject(this.weatherParticles);
    this.weatherParticles = null; this.particlePositions = null; this.particleVelocities = null; this.particleCount = 0;
  }
  update(delta, playerPos = this.focus, renderer = null, audioEngine = null, horde = null) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    if (this.quality !== (this.scene.userData.graphicsQuality || 'balanced')) this.setWeather(this.weatherType);
    if (this.weatherParticles) {
      this._updateMediaWeather(delta, playerPos, renderer, audioEngine, horde);
      // Particle weather and transient pipe effects share the same paused clock.
      const source = this.weatherType; this.weatherType = 'none'; this._updateBase(delta); this.weatherType = source;
    } else {
      this._updateBase(delta); this._updateMediaWeather(delta, playerPos, renderer, audioEngine, horde);
      if (this.weatherType === 'storm') {
        this.lightningTimer -= delta;
        if (this.lightningTimer <= 0) { this.lightningTimer = 7; renderer?.triggerLightningFlash?.(); audioEngine?.playThunderClap?.(); }
      }
    }
  }
  clear() {
    this._clearBase(); this._clearMediaWeather();
    const group = new THREE.Group(); for (const vent of this.steamVents) group.add(vent.group);
    disposeObject(group); this.steamVents = [];
  }

}

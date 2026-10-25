/* Lightweight biome weather and time-stepped environmental explosions. */

import * as THREE from 'three';
import { createSurfaceMaterial } from '../graphics/SurfaceLibrary.js';

const RAIN_THEMES = new Set(['rain', 'rain_forest', 'la_rooftops']);

export class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.pipes = [];
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

  update(delta) {
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

  clear() {
    this.clearPipes();
    this.effects.forEach(effect => {
      this.scene.remove(effect.mesh);
      effect.mesh.material.dispose();
    });
    this.effects = [];
    this.setWeather('none');
  }
}

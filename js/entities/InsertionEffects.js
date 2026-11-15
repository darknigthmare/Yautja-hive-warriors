/* Insertion effects (author request of 15 Nov 2026): atmospheric entry, impact, opening and the
 * hunter's cloaked exit. Visual and sound only: nothing here changes a position, a timer, a
 * health value or a collision. Every object is owned here and disposed with the insertion.
 * - entry: an incandescent trail (the orange re-entry streak of the Requiem scout-ship frame),
 *   the hull glowing hot, and a sonic boom;
 * - impact: a scorched crater, an expanding shockwave ring, a dust burst coloured by the
 *   biome (snow, mud, concrete, sparks...), flying debris and a camera shake;
 * - opening: staged lock clunks, blinking red indicators and steam venting from the seams;
 * - exit: the beam variant's blue flash, and a crackle when the hunter decloaks. */
import * as THREE from 'three';
import { disposeObject } from '../engine/SceneResources.js';

export const IMPACT_DUST = Object.freeze({
  snow: 0xe9f0f6, jungle: 0x6e5c40, plains: 0x8a7656, rain: 0x4d4a3a, city: 0x7a7e84,
  station: 0xffb060, hive: 0x47613f, arena: 0x8f7d62, ship: 0x6a6a6a
});

const glowTexture = (() => {
  let texture = null;
  return () => {
    if (texture || !globalThis.document?.createElement) return texture;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const g = canvas.getContext?.('2d'); if (!g) return null;
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.4, 'rgba(255,255,255,.5)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient; g.fillRect(0, 0, 64, 64);
    return (texture = new THREE.CanvasTexture(canvas));
  };
})();

const scorchTexture = (() => {
  let texture = null;
  return () => {
    if (texture || !globalThis.document?.createElement) return texture;
    // RingGeometry UVs map the ring's square bounds: radial fall-off from the inner edge.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const g = canvas.getContext?.('2d'); if (!g) return null;
    const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, '#fff'); gradient.addColorStop(.5, '#ddd'); gradient.addColorStop(.75, '#777'); gradient.addColorStop(1, '#000');
    g.fillStyle = gradient; g.fillRect(0, 0, 128, 128);
    return (texture = new THREE.CanvasTexture(canvas));
  };
})();

export class InsertionEffects {
  constructor(scene, audio = null, { onShake = null, reducedFlashes = () => false } = {}) {
    this.scene = scene; this.audio = audio; this.onShake = onShake; this.reducedFlashes = reducedFlashes;
    this.root = null; this.records = new Map(); this.bursts = [];
  }

  begin() { this.clear(); this.root = new THREE.Group(); this.root.name = 'insertion-effects'; this.scene.add(this.root); }

  /** Called once per vehicle at the start of the drop. */
  attach(record, { entry = 'pod', biome = 'plains' } = {}) {
    if (!this.root) this.begin();
    const state = { entry, biome, heat: [], indicators: [], steam: null, trail: null, locks: 0, cooled: 0 };
    record.group.traverse(node => {
      for (const material of node.isMesh ? (Array.isArray(node.material) ? node.material : [node.material]) : []) {
        if (/armor/.test(material.name) && !state.heat.includes(material)) state.heat.push(material);
        if (/indicator/.test(material.name) && !state.indicators.includes(material)) state.indicators.push(material);
      }
    });
    for (const material of state.heat) { material.emissive?.set?.(0xc0300a); material.emissiveIntensity = 0; }
    if (entry !== 'beam') {
      // Two nested cones above the falling vehicle: a white-hot core in an orange sheath.
      const trail = new THREE.Group(); trail.name = 'entry-trail';
      for (const [radius, length, color, opacity] of [[.95, 46, 0xff6a1a, .22], [.32, 38, 0xffc890, .4]]) {
        const cone = new THREE.ConeGeometry(radius, length, 20, 1, true); cone.translate(0, length / 2, 0);
        trail.add(new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
      }
      this.root.add(trail); state.trail = trail;
    }
    this.records.set(record, state);
    if (record === [...this.records.keys()][0]) this._sound(entry === 'beam' ? 'beam' : 'boom');
  }

  /** Per frame, with the vehicle's phase and the sequence clock. */
  update(record, { phase, fall = 1, opening = 0, delta = 0, sinceImpact = 0 }) {
    const state = this.records.get(record); if (!state) return;
    if (state.trail) {
      const falling = phase === 'descending';
      state.trail.visible = falling;
      if (falling) {
        const top = record.group.position.clone(); top.y += record.model.entry === 'scout' ? 8.6 + 1.2 : 6.8;
        state.trail.position.copy(top); state.trail.scale.set(1, .3 + (1 - fall) * .9, 1);
        state.trail.children.forEach((cone, i) => { cone.material.opacity = (i ? .4 : .22) * (.4 + (1 - fall) * .6); });
      }
    }
    // The hull glows during the descent, then cools in a few seconds.
    // A dull red heat on the dark hull, strongest high up, gone a second after touchdown.
    const heat = phase === 'descending' ? .08 + (1 - fall) * .3 : Math.max(0, 1 - sinceImpact / 1.2) * .12;
    for (const material of state.heat) material.emissiveIntensity = (this.reducedFlashes() ? .4 : 1) * heat * (state.entry === 'beam' ? 0 : 1);
    if (record.model.setPower) record.model.setPower(phase === 'descending' ? .35 + fall * .65 : phase === 'complete' ? 0 : 1);
    if (phase === 'opening') {
      // Three locks release one after another, with a blinking red indicator.
      const stage = Math.min(3, Math.floor(opening * 4.2));
      while (state.locks < stage) { state.locks++; this._sound('lock'); }
      const blink = Math.sin(performance.now() / 70) > 0 ? 1.2 : .25;
      for (const material of state.indicators) material.emissiveIntensity = blink;
      if (!state.steam && state.entry === 'pod') state.steam = this._steam(record);
    } else for (const material of state.indicators) if (phase !== 'descending') material.emissiveIntensity = .5;
    if (state.steam) this._updatePoints(state.steam, delta, record);
  }

  /** Touchdown: crater, shockwave, dust, debris and a shake. The beam flashes instead. */
  impact(record) {
    const state = this.records.get(record); if (!state || state.impacted) return; state.impacted = true;
    const at = record.targetPosition.clone(), color = IMPACT_DUST[state.biome] ?? IMPACT_DUST.plains;
    if (state.entry === 'pod') {
      // A scorched ring around the pod: darkest just outside the hull, fading by 4.6 m.
      const crater = new THREE.Mesh(new THREE.RingGeometry(1.6, 4.6, 48), new THREE.MeshBasicMaterial({ color: 0x0d0b09, alphaMap: scorchTexture(), transparent: true, opacity: .85, depthWrite: false }));
      crater.rotation.x = -Math.PI / 2; crater.position.copy(at).add(new THREE.Vector3(0, .12, 0)); crater.renderOrder = 2; crater.name = 'impact-crater'; this.root.add(crater);
    }
    if (state.entry !== 'scout') {
      const wave = new THREE.Mesh(new THREE.RingGeometry(.92, 1.08, 64), new THREE.MeshBasicMaterial({ color: state.entry === 'beam' ? 0x8fdcff : 0xffd2a0, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      wave.rotation.x = -Math.PI / 2; wave.position.copy(at).add(new THREE.Vector3(0, .25, 0)); wave.renderOrder = 3; wave.name = 'impact-shockwave'; this.root.add(wave);
      this.bursts.push({ kind: 'wave', mesh: wave, life: 0, max: .9 });
    }
    this.bursts.push({ kind: 'points', ...this._dust(at, color, state.entry === 'scout' ? 120 : 220, state.entry === 'scout' ? 9 : 14), life: 0, max: 2.4 });
    if (state.entry === 'pod') this.bursts.push({ kind: 'debris', ...this._debris(at, color), life: 0, max: 2 });
    this._sound(state.entry === 'beam' ? 'flash' : 'impact');
    this.onShake?.(state.entry === 'pod' ? 1.1 : .5, state.entry === 'pod' ? .55 : .35);
  }

  /** A short blue-white crackle where the hunter drops the cloak. */
  decloak(position) {
    if (!this.root) return;
    this.bursts.push({ kind: 'points', ...this._dust(position.clone().add(new THREE.Vector3(0, 1.6, 0)), 0x9fe8ff, 70, 3, { gravity: 0, size: .12, additive: true }), life: 0, max: .7 });
    this._sound('decloak');
  }

  tick(delta) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i]; burst.life += delta; const t = burst.life / burst.max;
      if (burst.kind === 'wave') { burst.mesh.scale.setScalar(1 + t * 9); burst.mesh.material.opacity = .8 * (1 - t); }
      else if (burst.kind === 'points') { this._updatePoints(burst, delta); burst.points.material.opacity = burst.opacity * (1 - t); }
      else if (burst.kind === 'debris') {
        const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
        burst.items.forEach((item, index) => {
          item.velocity.y -= 18 * delta; item.position.addScaledVector(item.velocity, delta);
          if (item.position.y < burst.ground) { item.position.y = burst.ground; item.velocity.multiplyScalar(.3); }
          rotation.setFromEuler(new THREE.Euler(item.spin * burst.life, item.spin * .7 * burst.life, 0));
          burst.mesh.setMatrixAt(index, matrix.compose(item.position, rotation, new THREE.Vector3().setScalar(item.size)));
        });
        burst.mesh.instanceMatrix.needsUpdate = true;
      }
      if (t >= 1) { const mesh = burst.mesh ?? burst.points; if (burst.kind !== 'debris') { this.root?.remove(mesh); disposeObject(mesh); } this.bursts.splice(i, 1); }
    }
  }

  _dust(at, color, count, speed, { gravity = 6, size = .45, additive = false } = {}) {
    const positions = new Float32Array(count * 3), velocities = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, out = speed * (.4 + Math.random() * .6);
      positions.set([at.x, at.y + .3, at.z], i * 3);
      velocities.push(new THREE.Vector3(Math.cos(angle) * out, 1 + Math.random() * speed * .35, Math.sin(angle) * out));
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, map: glowTexture(), transparent: true, opacity: .85, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    points.frustumCulled = false; points.name = 'insertion-particles'; this.root.add(points);
    return { points, velocities, gravity, drag: .9, opacity: .85 };
  }

  _debris(at, color) {
    const count = 10, mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color, roughness: .9 }), count);
    mesh.name = 'impact-debris'; mesh.frustumCulled = false; this.root.add(mesh);
    const items = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      return { position: at.clone().add(new THREE.Vector3(0, .5, 0)), velocity: new THREE.Vector3(Math.cos(angle) * (4 + Math.random() * 5), 5 + Math.random() * 6, Math.sin(angle) * (4 + Math.random() * 5)), size: .12 + Math.random() * .22, spin: 4 + Math.random() * 8 };
    });
    return { mesh, items, ground: at.y + .1 };
  }

  _steam(record) {
    // Steam escapes along the front seam of the hatch, rising and spreading.
    const at = record.group.position.clone().add(new THREE.Vector3(0, 0, 1.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), record.heading ?? 0));
    const count = 90, positions = new Float32Array(count * 3), velocities = [];
    for (let i = 0; i < count; i++) {
      positions.set([at.x + (Math.random() - .5) * .3, at.y + Math.random() * 4.6, at.z], i * 3);
      velocities.push(new THREE.Vector3((Math.random() - .5) * 1.5, .8 + Math.random() * 1.4, .6 + Math.random() * 1.2));
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xe8eef2, size: .7, map: glowTexture(), transparent: true, opacity: .42, depthWrite: false }));
    points.frustumCulled = false; points.name = 'opening-steam'; this.root.add(points);
    return { points, velocities, gravity: -.4, drag: .97, opacity: .42, origin: at, respawn: true };
  }

  _updatePoints(state, delta) {
    const array = state.points.geometry.attributes.position.array;
    state.velocities.forEach((velocity, i) => {
      velocity.y -= state.gravity * delta; velocity.multiplyScalar(Math.pow(state.drag, delta * 60));
      array[i * 3] += velocity.x * delta; array[i * 3 + 1] += velocity.y * delta; array[i * 3 + 2] += velocity.z * delta;
      if (state.respawn && array[i * 3 + 1] > state.origin.y + 8) { array[i * 3] = state.origin.x; array[i * 3 + 1] = state.origin.y + Math.random() * 4.6; array[i * 3 + 2] = state.origin.z; velocity.set((Math.random() - .5) * 1.5, .8 + Math.random() * 1.4, .6 + Math.random() * 1.2); }
    });
    state.points.geometry.attributes.position.needsUpdate = true;
  }

  /** Original synthesized sounds; the existing impact and hiss sounds still play too. */
  _sound(kind) {
    const ctx = this.audio?.ctx, out = this.audio?.masterGain; if (!ctx || !out) return;
    const now = ctx.currentTime, gain = ctx.createGain(); gain.connect(out);
    const noise = (duration, type, frequency, level, at = now) => {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
      source.buffer = buffer; filter.type = type; filter.frequency.value = frequency;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + .01); g.gain.exponentialRampToValueAtTime(.0001, at + duration);
      source.connect(filter); filter.connect(g); g.connect(out); source.start(at);
    };
    const tone = (from, to, duration, level, type = 'sine', at = now) => {
      const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = type;
      osc.frequency.setValueAtTime(from, at); osc.frequency.exponentialRampToValueAtTime(to, at + duration);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + .02); g.gain.exponentialRampToValueAtTime(.0001, at + duration);
      osc.connect(g); g.connect(out); osc.start(at); osc.stop(at + duration + .05);
    };
    if (kind === 'boom') { tone(70, 24, 1.4, .45); noise(1.2, 'lowpass', 260, .35); noise(.9, 'bandpass', 900, .08, now + .05); }
    else if (kind === 'impact') { tone(55, 22, .9, .5); noise(.8, 'lowpass', 500, .4); }
    else if (kind === 'lock') { noise(.08, 'bandpass', 2200, .25); tone(320, 180, .12, .18, 'square'); }
    else if (kind === 'beam') { tone(140, 220, 2.4, .12, 'sawtooth'); tone(880, 1320, 2.4, .04); }
    else if (kind === 'flash') { tone(1600, 300, .6, .12); noise(.5, 'highpass', 3000, .15); }
    else if (kind === 'decloak') { for (let i = 0; i < 5; i++) noise(.05, 'bandpass', 3000 + i * 400, .12, now + i * .04); }
  }

  clear() {
    for (const state of this.records.values()) for (const material of state.heat) material.emissiveIntensity = 0;
    this.records.clear(); this.bursts = [];
    if (this.root) { this.scene.remove(this.root); disposeObject(this.root); }
    this.root = null;
  }
}

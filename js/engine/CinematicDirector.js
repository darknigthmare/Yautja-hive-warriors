/* Cinematics (spec 003, US3): letterbox, a scripted camera, typed comms with Yautja clicks and
 * radio static, title cards. Always skippable: hold Space, Enter or a gamepad button for half a
 * second, or click "Passer". A cinematic never touches simulation state: the game holds its
 * update loop and only the camera and the overlay change. */
import * as THREE from 'three';

const GLYPHS = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ';
export const SKIP_HOLD_SECONDS = .5;

/** Characters revealed after `elapsed` seconds of a typed line (fast enough to read, slow enough to feel). */
export function typedLength(text, elapsed, charsPerSecond = 38) { return Math.max(0, Math.min(text.length, Math.floor(elapsed * charsPerSecond))); }

export class CinematicDirector {
  constructor({ root = document.getElementById('cinematic-layer'), audio = null } = {}) {
    this.root = root; this.audio = audio; this.active = null; this.hold = 0;
    this.keys = new Set();
    addEventListener('keydown', event => { if (!this.active) return; if (['Space', 'Enter', 'NumpadEnter'].includes(event.code)) { this.keys.add(event.code); event.preventDefault(); event.stopPropagation(); } }, true);
    addEventListener('keyup', event => this.keys.delete(event.code), true);
    this.root?.querySelector('.cinematic-skip')?.addEventListener('click', () => this.skip());
  }

  get isActive() { return Boolean(this.active); }

  /** Plays one sequence: { duration, camera(t, camera, progress), comms: [{ speaker, side, text, at }], title, subtitle, tone }. */
  play(sequence, camera) {
    this.stop(false);
    return new Promise(resolve => {
      this.active = { ...sequence, camera, elapsed: 0, resolve, shown: -1 };
      this.hold = 0;
      if (!this.root) return;
      this.root.hidden = false; this.root.dataset.tone = sequence.tone ?? 'neutral';
      this.root.classList.toggle('with-letterbox', sequence.letterbox !== false);
      this.root.querySelector('.cinematic-title').textContent = sequence.title ?? '';
      this.root.querySelector('.cinematic-subtitle').textContent = sequence.subtitle ?? '';
      this.root.querySelector('.cinematic-card').hidden = !sequence.title;
      this.root.querySelector('.cinematic-comms').hidden = true;
      requestAnimationFrame(() => this.root.classList.add('playing'));
    });
  }

  skip() { if (this.active) this.stop(true); }

  stop(skipped = false) {
    const active = this.active; if (!active) return;
    this.active = null; this.keys.clear();
    if (this.root) { this.root.classList.remove('playing'); setTimeout(() => { if (!this.active) this.root.hidden = true; }, 350); }
    active.resolve({ skipped });
  }

  update(delta) {
    const active = this.active; if (!active) return;
    // Real time, not the game's 0.1 s step cap: a cinematic lasts as long on a slow machine.
    const now = performance.now(); if (active.lastNow !== undefined) delta = Math.min(1, (now - active.lastNow) / 1000); active.lastNow = now;
    active.elapsed += delta;
    const progress = Math.min(1, active.elapsed / Math.max(.01, active.duration));
    if (active.camera && active.cameraPath) active.cameraPath(active.elapsed, active.camera, progress);
    // Comms: the current line is the last one whose start time has passed.
    const comms = active.comms ?? [];
    let index = -1; for (let i = 0; i < comms.length; i++) if (active.elapsed >= comms[i].at) index = i;
    if (index >= 0 && this.root) {
      const line = comms[index], panel = this.root.querySelector('.cinematic-comms');
      if (index !== active.shown) {
        active.shown = index; panel.hidden = false; panel.dataset.side = line.side ?? 'clan';
        panel.querySelector('.comms-speaker').textContent = line.speaker;
        this._commsSound(line.side);
      }
      const typed = typedLength(line.text, active.elapsed - line.at);
      panel.querySelector('.comms-text').textContent = line.text.slice(0, typed);
      panel.querySelector('.comms-glyphs').textContent = typed < line.text.length ? Array.from({ length: 6 }, (_, i) => GLYPHS[(typed + i * 5) % GLYPHS.length]).join('') : '';
    }
    // Hold to skip.
    const pad = [...(navigator.getGamepads?.() ?? [])].some(gamepad => gamepad?.buttons?.[0]?.pressed || gamepad?.buttons?.[9]?.pressed);
    this.hold = this.keys.size || pad ? this.hold + delta : 0;
    const bar = this.root?.querySelector('.cinematic-skip-progress'); if (bar) bar.style.width = `${Math.min(1, this.hold / SKIP_HOLD_SECONDS) * 100}%`;
    if (this.hold >= SKIP_HOLD_SECONDS) return this.stop(true);
    if (active.elapsed >= active.duration) this.stop(false);
  }

  /** Clicks from the clan, static for an intercepted human radio. Original synthesis. */
  _commsSound(side) {
    const ctx = this.audio?.ctx, out = this.audio?.masterGain; if (!ctx || !out) return;
    const now = ctx.currentTime, length = ctx.sampleRate * .25, buffer = ctx.createBuffer(1, length, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const burst = (at, frequency, q, level, duration) => {
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = q;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level, at + .005); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      source.connect(filter); filter.connect(gain); gain.connect(out); source.start(at, 0, duration + .02);
    };
    burst(now, side === 'intercept' ? 1800 : 1200, .6, .05, .22);
    if (side !== 'intercept') for (let i = 0; i < 4; i++) burst(now + .12 + i * .06 + (i > 1 ? .08 : 0), 2100 + i * 140, 10, .14, .035);
  }
}

/** Camera paths. Each returns a function (elapsed, camera, progress) that moves the camera only. */
export const CameraPaths = {
  /** Flies over the given ground points in order, then settles above the first. */
  flyover(points, { height = 70, lead = 26 } = {}) {
    const route = points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    if (!route.length) return () => {};
    const ordered = [...route, route[0]];
    const curve = ordered.length > 2 ? new THREE.CatmullRomCurve3(ordered, false, 'centripetal') : null;
    const target = new THREE.Vector3(), position = new THREE.Vector3();
    return (elapsed, camera, progress) => {
      const eased = progress < .5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
      if (curve) curve.getPointAt(Math.min(.999, eased), target); else target.copy(route[0]);
      position.copy(target).add(new THREE.Vector3(0, height * (1 - .35 * Math.sin(progress * Math.PI)), lead));
      camera.position.lerp(position, .12); camera.lookAt(target);
    };
  },
  /** A slow orbit around a point: victory. */
  orbit(center, { radius = 8, height = 2.6, sweep = Math.PI * .7, start = 0 } = {}) {
    const look = center.clone().add(new THREE.Vector3(0, 1.8, 0));
    return (elapsed, camera, progress) => {
      const angle = start + sweep * progress, r = radius * (1 - .15 * progress);
      camera.position.set(center.x + Math.sin(angle) * r, center.y + height + progress * .8, center.z + Math.cos(angle) * r);
      camera.lookAt(look);
    };
  },
  /** The camera rises above a fallen hunter: defeat. */
  rise(center, { from = 3, to = 22 } = {}) {
    return (elapsed, camera, progress) => {
      const eased = 1 - (1 - progress) ** 3;
      camera.position.set(center.x + 1.5 * (1 - eased), center.y + from + (to - from) * eased, center.z + 4 * (1 - eased) + .01);
      camera.lookAt(center);
    };
  }
};

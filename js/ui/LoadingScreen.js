/* Loading screen (spec 003, US2). It covers the mission while its world is built, its models load
 * and its shaders compile behind it. Progress is real: model requests settled since the screen
 * opened, plus a few rendered frames for shader warm-up. Mission time stays frozen meanwhile (the
 * game holds its update loop). A minimum display time applies only to full cinematics, never
 * under automation. */
import { loadingCard } from '../data/LoadingLore.js';
import { readCinematicsMode } from './BootSequence.js';

export const LOADING_LIMITS = Object.freeze({ maxSeconds: 14, warmFrames: 8, minFullSeconds: 1.6 });

/** Progress from 0 to 1: model loads weigh 85 %, shader warm-up frames the rest. */
export function loadingProgress({ requested = 0, settled = 0 } = {}, baseline = { requested: 0, settled: 0 }, frames = 0) {
  const total = Math.max(0, requested - baseline.requested), done = Math.max(0, settled - baseline.settled);
  const models = total ? Math.min(1, done / total) : 1;
  return Math.min(1, models * .85 + Math.min(1, frames / LOADING_LIMITS.warmFrames) * .15);
}

export class LoadingScreen {
  constructor({ root = document.getElementById('loading-screen'), progressSource = () => ({ requested: 0, settled: 0 }), storage = globalThis.localStorage,
    automated = globalThis.navigator?.webdriver === true, forced = /[?&]intro=1\b/.test(globalThis.location?.search ?? '') } = {}) {
    // Browser automation steps the simulation itself: it waits for assets only when asked (?intro=1).
    this.root = root; this.progressSource = progressSource; this.storage = storage; this.automated = automated && !forced;
    this.visible = false; this.frames = 0;
  }

  /** Shows the screen for a world. Returns false when no screen exists in the page. */
  begin({ levelId, levelName = '', shipHub = false } = {}) {
    if (!this.root) return false;
    if (this.visible) return true;
    const { lore, tip } = loadingCard(levelId, { shipHub });
    this.root.querySelector('.loading-world').textContent = shipHub ? 'LA LAME PATIENTE' : levelName;
    this.root.querySelector('.loading-tag').textContent = lore?.tag ?? '';
    this.root.querySelector('.loading-lore').replaceChildren(...(lore?.lines ?? []).map(line => { const p = document.createElement('p'); p.textContent = line; return p; }));
    this.root.querySelector('.loading-tip').textContent = tip;
    this.setProgress(0, 'Préparation du terrain');
    this.baseline = this.progressSource(); this.frames = 0; this.startedAt = performance.now(); this.visible = true;
    this.root.hidden = false; this.root.classList.remove('leaving');
    return true;
  }

  setProgress(value, label) {
    const bar = this.root?.querySelector('.loading-bar span'); if (bar) bar.style.width = `${Math.round(value * 100)}%`;
    const text = this.root?.querySelector('.loading-status'); if (text && label) text.textContent = `${label} · ${Math.round(value * 100)} %`;
    this.root?.querySelector('.loading-bar')?.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  }

  /** Resolves when models are loaded and shaders warmed (or after the safety limit). */
  waitUntilReady() {
    return new Promise(resolve => {
      const minimum = this.automated ? 0 : readCinematicsMode(this.storage) === 'full' ? LOADING_LIMITS.minFullSeconds : 0;
      const tick = () => {
        if (!this.visible) return resolve(false);
        if (this.automated) return resolve(true);
        this.frames++;
        const value = loadingProgress(this.progressSource(), this.baseline, this.frames);
        const seconds = (performance.now() - this.startedAt) / 1000;
        this.setProgress(value, value < .85 ? 'Réveil des chasseurs' : value < 1 ? 'Compilation des ombres' : 'Prêt');
        if ((value >= 1 && seconds >= minimum) || seconds >= LOADING_LIMITS.maxSeconds) return resolve(true);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  end() {
    if (!this.root || !this.visible) return;
    this.visible = false; this.root.classList.add('leaving');
    setTimeout(() => { if (!this.visible) { this.root.hidden = true; this.root.classList.remove('leaving'); } }, 500);
  }
}

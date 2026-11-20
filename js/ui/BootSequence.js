/* Startup (spec 003, US1): a Yautja glyph countdown, the fan-project credit and notice, then the
 * title screen. Any key, click or gamepad button skips ahead; on the title it enters the menu and
 * unlocks audio. "Cinématiques" setting: full, short (title only) or off (straight to the menu).
 * Under browser automation the sequence is skipped unless the page URL carries ?intro=1. */

export const CINEMATICS_KEY = 'yautja_cinematics';
export const CINEMATICS_MODES = Object.freeze(['full', 'short', 'off']);
export const BOOT_TIMING = Object.freeze({ glyphs: 2.2, credit: 2.9 });

export function readCinematicsMode(storage = globalThis.localStorage) {
  try { const value = storage?.getItem(CINEMATICS_KEY); return CINEMATICS_MODES.includes(value) ? value : 'full'; } catch { return 'full'; }
}

/** The stages to play: automation skips everything unless explicitly asked for. */
export function bootStages(mode, { automated = false, forced = false } = {}) {
  if (automated && !forced) return [];
  if (mode === 'off') return [];
  if (mode === 'short') return ['title'];
  return ['glyphs', 'credit', 'title'];
}

const GLYPHS = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ';

export class BootSequence {
  constructor({ root = document.getElementById('boot-sequence'), onEnter = () => {}, onTitle = () => {}, storage = globalThis.localStorage, location = globalThis.location, navigator = globalThis.navigator } = {}) {
    this.root = root; this.onEnter = onEnter; this.onTitle = onTitle;
    const forced = /[?&]intro=1\b/.test(location?.search ?? '');
    this.stages = bootStages(readCinematicsMode(storage), { automated: navigator?.webdriver === true, forced });
    this.stage = null; this.timers = []; this.done = false;
    this._onInput = event => this._advance(event);
  }

  /** Returns a promise that resolves once the player is on the main menu. */
  start() {
    this.finished = new Promise(resolve => { this._resolve = resolve; });
    if (!this.root || !this.stages.length) { this._finish(false); return this.finished; }
    this.root.hidden = false; document.body.classList.add('boot-active');
    addEventListener('keydown', this._onInput, true); this.root.addEventListener('pointerdown', this._onInput);
    this._pollGamepad();
    this._go(0);
    return this.finished;
  }

  _go(index) {
    for (const timer of this.timers) clearTimeout(timer); this.timers = [];
    this.index = index; this.stage = this.stages[index];
    for (const element of this.root.querySelectorAll('.boot-stage')) element.classList.toggle('active', element.dataset.stage === this.stage);
    this.root.dataset.stage = this.stage;
    if (this.stage === 'glyphs') this._countdown();
    if (this.stage === 'title') { this.onTitle(); this.root.querySelector('.boot-press')?.focus?.({ preventScroll: true }); return; }
    this.timers.push(setTimeout(() => this._go(index + 1), BOOT_TIMING[this.stage] * 1000));
  }

  _countdown() {
    const target = this.root.querySelector('.boot-countdown'); if (!target) return;
    let tick = 0;
    const step = () => {
      if (this.stage !== 'glyphs') return;
      target.textContent = Array.from({ length: 3 }, (_, i) => GLYPHS[(tick * 5 + i * 3) % GLYPHS.length]).join(' ');
      target.style.setProperty('--boot-progress', String(Math.min(1, tick / 7)));
      tick++; this.timers.push(setTimeout(step, 280));
    };
    step();
  }

  _advance(event) {
    if (this.done || event?.repeat) return;
    if (event?.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(event.key)) return;
    event?.preventDefault?.(); event?.stopPropagation?.();
    if (this.stage !== 'title') this._go(this.stages.indexOf('title'));
    else this._finish(true);
  }

  _pollGamepad() {
    let held = true;
    const poll = () => {
      if (this.done) return;
      const pressed = [...(navigator.getGamepads?.() ?? [])].some(pad => pad?.buttons?.some(button => button.pressed));
      if (pressed && !held) this._advance(null);
      held = pressed; requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  }

  _finish(interacted) {
    if (this.done) return; this.done = true;
    for (const timer of this.timers) clearTimeout(timer);
    removeEventListener('keydown', this._onInput, true); this.root?.removeEventListener('pointerdown', this._onInput);
    if (this.root && !this.root.hidden) {
      this.root.classList.add('leaving');
      setTimeout(() => { this.root.hidden = true; this.root.classList.remove('leaving'); document.body.classList.remove('boot-active'); }, 450);
    } else document.body.classList.remove('boot-active');
    this.onEnter({ interacted });
    this._resolve?.();
  }
}

/* W3C standard-gamepad input. Snapshots are injectable; no hardware or browser
 * is required by the state machine. DOM focus is a separate optional adapter. */
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const finite = value => Number.isFinite(value) ? value : 0;
const noop = () => {};

export const GAMEPAD_BUTTONS = Object.freeze({
  0: 'jump', 1: 'dodge', 2: 'light', 3: 'heavy', 4: 'radial', 5: 'interact',
  6: 'guard', 7: 'ranged', 8: 'map', 9: 'pause', 10: 'sprint', 11: 'lock',
  12: 'vision', 13: 'heal', 14: 'cloak', 15: 'musou'
});
const HELD_ACTIONS = new Set(['guard', 'ranged', 'sprint']);
const MENU_BUTTONS = { 0: 'confirm', 1: 'back', 4: 'tabPrevious', 5: 'tabNext', 8: 'back', 9: 'pause' };
export const GAMEPAD_HINTS = Object.freeze({
  gameplay: Object.freeze(['LS : déplacement · RS : caméra', 'X : attaque · Y : charge', 'A : saut · B : esquive', 'LT : garde · RT : tir', 'LB : armes · RB : interaction', '← : camouflage · → : surcharge', '↑ : vision · ↓ : soins', 'View : carte · Start : pause']),
  menu: Object.freeze(['LS / croix : navigation', 'A : confirmer · B : retour', 'LB / RB : panneaux']),
  radial: Object.freeze(['LS / croix : arme', 'A : équiper · B : fermer', 'LB / RB : précédent / suivant'])
});

export function gamepadStick(x, y, deadzone = .18) {
  x = clamp(finite(x), -1, 1); y = clamp(finite(y), -1, 1);
  const length = Math.hypot(x, y), threshold = clamp(finite(deadzone), 0, .95);
  if (length <= threshold) return { x: 0, y: 0, magnitude: 0 };
  const magnitude = (Math.min(1, length) - threshold) / (1 - threshold);
  return { x: x / length * magnitude, y: y / length * magnitude, magnitude };
}

function buttonDown(button, wasDown = false) {
  if (typeof button === 'number') return finite(button) >= (wasDown ? .4 : .55);
  return button?.pressed === true || finite(button?.value) >= (wasDown ? .4 : .55);
}
function directionOf(x, y) {
  if (Math.max(Math.abs(x), Math.abs(y)) < .5) return null;
  return Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'down' : 'up');
}

export class GamepadControls {
  constructor({ getGamepads = () => globalThis.navigator?.getGamepads?.() ?? [],
    onMove = noop, onLook = noop, onAction = noop, onNavigate = noop,
    onRadial = noop, onConnection = noop, onInputMode = noop,
    deadzone = .18, repeatDelay = .34, repeatInterval = .12, acceptUnmapped = false } = {}) {
    Object.assign(this, { getGamepads, onMove, onLook, onAction, onNavigate, onRadial,
      onConnection, onInputMode, acceptUnmapped });
    this.deadzone = clamp(finite(deadzone), 0, .95);
    this.repeatDelay = Math.max(.15, finite(repeatDelay));
    this.repeatInterval = Math.max(.05, finite(repeatInterval));
    this.players = [null, null]; this.time = 0; this.disposed = false;
  }

  _release(player, reason) {
    for (const action of player.held) this.onAction(player.playerIndex, action, { phase: 'released', value: 0, reason });
    player.held.clear(); this.onMove(player.playerIndex, { x: 0, y: 0, magnitude: 0 });
    this.onLook(player.playerIndex, { x: 0, y: 0, magnitude: 0 }, 0);
  }

  reset(reason = 'reset') {
    for (const player of this.players) if (player) {
      this._release(player, reason); player.context = null; player.navigation = null;
      player.needsBaseline = true;
    }
  }

  update(delta, { context = 'gameplay', playerCount = 1, enabled = true } = {}) {
    if (this.disposed) return;
    delta = clamp(finite(delta), 0, .25); this.time += delta;
    let snapshots;
    try { snapshots = Array.from(this.getGamepads() ?? []); } catch { snapshots = []; }
    const pads = new Map();
    snapshots.forEach((pad, index) => {
      if (!pad || pad.connected === false) return;
      const id = Number.isInteger(pad.index) ? pad.index : index;
      if (pad.mapping !== 'standard' && !this.acceptUnmapped) return;
      pads.set(id, pad);
    });
    const count = playerCount === 2 ? 2 : 1;
    const used = new Set();
    for (let index = 0; index < 2; index++) {
      const player = this.players[index];
      if (player && (index >= count || !pads.has(player.padIndex) || String(pads.get(player.padIndex).id ?? '') !== player.padId)) {
        this._release(player, 'disconnected'); this.onConnection(index, { connected: false, padIndex: player.padIndex });
        this.players[index] = null;
      } else if (player) used.add(player.padIndex);
    }
    for (let index = 0; index < count; index++) {
      if (!this.players[index]) {
        const entry = [...pads.entries()].find(([padIndex]) => !used.has(padIndex));
        if (!entry) continue;
        const [padIndex, pad] = entry; used.add(padIndex);
        this.players[index] = { playerIndex: index, padIndex, padId: String(pad.id ?? ''), previous: [], suppressed: new Set(), held: new Set(), context: null, navigation: null, repeatAt: 0, needsBaseline: true, navigationArmed: false };
        this.onConnection(index, { connected: true, padIndex, id: String(pad.id ?? ''), mapping: pad.mapping, standard: pad.mapping === 'standard' });
      }
      this._sample(this.players[index], pads.get(this.players[index].padIndex), delta, enabled ? context : 'disabled');
    }
  }

  _sample(player, pad, delta, context) {
    if (!['gameplay', 'menu', 'radial', 'paused'].includes(context)) context = 'disabled';
    const axes = pad.axes ?? [], move = gamepadStick(axes[0], -finite(axes[1]), this.deadzone);
    const look = gamepadStick(axes[2], -finite(axes[3]), this.deadzone);
    const down = Array.from({ length: 16 }, (_, index) => buttonDown(pad.buttons?.[index], player.previous[index]));
    const contextChanged = player.context !== context || player.needsBaseline;
    if (contextChanged) {
      this._release(player, 'context'); player.context = context; player.previous = down;
      player.suppressed = new Set(down.map((value, index) => value ? index : -1).filter(index => index >= 0));
      player.navigation = null; player.navigationArmed = move.magnitude < .5;
      player.needsBaseline = false;
    }
    for (const index of player.suppressed) if (!down[index]) player.suppressed.delete(index);
    const pressed = index => down[index] && !player.previous[index];
    const released = index => !down[index] && player.previous[index];
    if (context === 'disabled') { player.previous = down; return; }
    const gameplay = context === 'gameplay';
    // Start wins over every simultaneous combat input. Returning from a menu
    // requires fresh button fronts, even when a trigger remains held.
    if (pressed(9)) {
      this._release(player, 'pause'); player.previous = down; player.needsBaseline = true;
      this.onInputMode('gamepad'); this.onAction(player.playerIndex, 'pause', { phase: 'pressed', value: 1 }); return;
    }
    if (!gameplay && (pressed(1) || pressed(8))) {
      this._release(player, 'back'); player.previous = down; player.needsBaseline = true;
      this.onInputMode('gamepad'); this.onAction(player.playerIndex, 'back', { phase: 'pressed', value: 1 }); return;
    }
    this.onMove(player.playerIndex, gameplay ? move : { x: 0, y: 0, magnitude: 0 });
    this.onLook(player.playerIndex, gameplay ? look : { x: 0, y: 0, magnitude: 0 }, gameplay ? delta : 0);
    if (move.magnitude > .15 || look.magnitude > .15) this.onInputMode('gamepad');
    const actions = gameplay ? GAMEPAD_BUTTONS : MENU_BUTTONS;
    // Opening a modal must not also perform an attack from this sample.
    if (gameplay && (pressed(4) || pressed(8))) {
      const action = pressed(8) ? 'map' : 'radial'; this._release(player, action);
      this.onAction(player.playerIndex, action, { phase: 'pressed', value: 1 });
      player.previous = down; player.needsBaseline = true; this.onInputMode('gamepad'); return;
    }
    for (const [button, action] of Object.entries(actions)) {
      const index = Number(button);
      if (pressed(index)) {
        this.onInputMode('gamepad');
        if (gameplay && HELD_ACTIONS.has(action)) player.held.add(action);
        this.onAction(player.playerIndex, action, { phase: 'pressed', value: clamp(finite(pad.buttons?.[index]?.value) || 1, 0, 1) });
      } else if (gameplay && released(index) && player.held.delete(action)) {
        this.onAction(player.playerIndex, action, { phase: 'released', value: 0 });
      }
    }
    if (!gameplay) {
      if (move.magnitude < .3) player.navigationArmed = true;
      const fresh = index => down[index] && !player.suppressed.has(index);
      const dpadX = Number(fresh(15)) - Number(fresh(14)), dpadY = Number(fresh(12)) - Number(fresh(13));
      const direction = directionOf(dpadX || (player.navigationArmed ? move.x : 0), dpadY || (player.navigationArmed ? move.y : 0));
      if (!direction) player.navigation = null;
      else if (direction !== player.navigation || this.time >= player.repeatAt) {
        this.onNavigate(player.playerIndex, direction);
        player.repeatAt = this.time + (direction === player.navigation ? this.repeatInterval : this.repeatDelay);
        player.navigation = direction;
      }
      if (context === 'radial' && move.magnitude >= .5) this.onRadial(player.playerIndex, { ...move, angle: Math.atan2(move.x, move.y) });
    }
    player.previous = down;
  }

  getState() { return this.players.map(player => player ? { playerIndex: player.playerIndex, padIndex: player.padIndex, id: player.padId, context: player.context, held: [...player.held] } : null); }
  dispose() { if (this.disposed) return; this.reset('dispose'); this.players = [null, null]; this.disposed = true; }
}

const FOCUSABLE = 'button, a[href], input, select, textarea, summary, [role="button"], [tabindex]';
const editable = element => element?.matches?.('input, textarea, [contenteditable="true"]');
export class MenuFocusController {
  constructor({ getRoot = () => null, document = globalThis.document, onBack = null, onPanelCycle = null, onInputMode = noop } = {}) {
    Object.assign(this, { getRoot, document, onBack, onPanelCycle, onInputMode });
    this.focused = null; this.editing = null; this.selectCursors = new WeakMap(); this.disposed = false;
  }
  _root() { return this.disposed ? null : this.getRoot?.(); }
  _visible(element) {
    if (!element || element.disabled || element.getAttribute?.('aria-disabled') === 'true' || element.tabIndex < 0) return false;
    if (element.closest?.('[hidden], [inert], .hidden, [aria-hidden="true"]')) return false;
    const style = this.document?.defaultView?.getComputedStyle?.(element);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    if (element.getClientRects && element.getClientRects().length === 0) return false;
    return true;
  }
  _controls() { return [...(this._root()?.querySelectorAll?.(FOCUSABLE) ?? [])].filter(element => this._visible(element)); }
  _focus(element) {
    if (!element) return false;
    this.focused?.removeAttribute?.('data-gamepad-focus'); this.focused = element;
    element.setAttribute?.('data-gamepad-focus', 'true'); element.focus?.({ preventScroll: true });
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); this.onInputMode('gamepad'); return true;
  }
  _active(controls) { return controls.includes(this.document?.activeElement) ? this.document.activeElement : controls.includes(this.focused) ? this.focused : null; }
  _change(select) {
    const EventClass = this.document?.defaultView?.Event ?? globalThis.Event;
    if (EventClass) select.dispatchEvent?.(new EventClass('change', { bubbles: true }));
  }
  _option(select, delta) {
    const options = [...(select.options ?? [])], available = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
    if (!available.length) return false;
    const cursor = this.selectCursors.get(select) ?? Math.max(0, select.selectedIndex ?? 0);
    const position = Math.max(0, available.indexOf(cursor)), next = available[clamp(position + delta, 0, available.length - 1)];
    this.selectCursors.set(select, next);
    if (!select.multiple) { select.selectedIndex = next; this._change(select); }
    options.forEach((option, index) => { option.toggleAttribute?.('data-gamepad-option', index === next); });
    options[next]?.scrollIntoView?.({ block: 'nearest' }); return true;
  }
  navigate(direction) {
    if (!['up', 'down', 'left', 'right'].includes(direction)) return false;
    const controls = this._controls(); if (!controls.length) return false;
    const active = this._active(controls);
    if (!active) return this._focus(controls[0]);
    if (active.tagName === 'SELECT' && (this.editing === active || ['left', 'right'].includes(direction))) {
      if (active.multiple) this.editing = active;
      return this._option(active, ['up', 'left'].includes(direction) ? -1 : 1);
    }
    const origin = active.getBoundingClientRect?.(), axis = ['left', 'right'].includes(direction) ? 'x' : 'y';
    const sign = ['left', 'up'].includes(direction) ? -1 : 1;
    let target = null, best = Infinity;
    if (origin) for (const element of controls) {
      if (element === active) continue;
      const rect = element.getBoundingClientRect?.(); if (!rect) continue;
      const x = rect.left + rect.width / 2 - origin.left - origin.width / 2;
      const y = rect.top + rect.height / 2 - origin.top - origin.height / 2;
      const forward = (axis === 'x' ? x : y) * sign, lateral = Math.abs(axis === 'x' ? y : x);
      if (forward <= .5) continue;
      const score = forward + lateral * 2 + lateral * lateral / Math.max(1, forward);
      if (score < best) { best = score; target = element; }
    }
    if (!target) target = controls[(controls.indexOf(active) + sign + controls.length) % controls.length];
    this.editing = null; return this._focus(target);
  }
  confirm() {
    const controls = this._controls(); if (!controls.length) return false;
    const active = this._active(controls) ?? controls[0]; this._focus(active);
    if (active.tagName === 'SELECT') {
      if (active.multiple) {
        this.editing = active;
        const cursor = this.selectCursors.get(active) ?? Math.max(0, active.selectedIndex ?? 0), option = active.options?.[cursor];
        if (option && !option.disabled) { option.selected = !option.selected; this.selectCursors.set(active, cursor); this._change(active); }
      } else this.editing = this.editing === active ? null : active;
      return true;
    }
    if (editable(active)) return false;
    active.click?.(); return true;
  }
  back() {
    if (this.editing) { this.editing = null; return true; }
    return this.onBack?.() === true;
  }
  cyclePanel(delta) {
    delta = delta < 0 ? -1 : 1; this.editing = null;
    if (this.onPanelCycle?.(delta) === true) return true;
    const root = this._root(), tabs = [...(root?.querySelectorAll?.('[role="tab"], [data-panel-target], [data-gamepad-panel-tab]') ?? [])].filter(tab => this._visible(tab));
    if (!tabs.length) return this.navigate(delta < 0 ? 'left' : 'right');
    const active = tabs.find(tab => tab.getAttribute?.('aria-selected') === 'true') ?? this.document?.activeElement;
    const current = tabs.indexOf(active), target = tabs[(current + delta + tabs.length) % tabs.length];
    this._focus(target); target.click?.(); return true;
  }
  handleKeyDown(event) {
    if (!this._root() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return false;
    const active = this.document?.activeElement;
    const key = event.key ?? '', direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[key];
    if (key !== 'Tab' && (editable(active) || active?.tagName === 'SELECT')) return false;
    let handled = false;
    if (key === 'Tab') {
      const controls = this._controls();
      if (controls.length) {
        const current = controls.indexOf(this._active(controls)), step = event.shiftKey ? -1 : 1;
        const index = current < 0 ? (step < 0 ? controls.length - 1 : 0) : (current + step + controls.length) % controls.length;
        handled = this._focus(controls[index]);
      }
    } else if (direction) handled = this.navigate(direction);
    else if (key === 'Enter' || key === ' ') handled = event.repeat ? true : this.confirm();
    else if (key === 'Escape') handled = this.back();
    else if (key === 'PageUp' || key === 'PageDown') handled = this.cyclePanel(key === 'PageUp' ? -1 : 1);
    if (handled) { event.preventDefault?.(); event.stopPropagation?.(); this.onInputMode('keyboard'); }
    return handled;
  }
  reset() { this.focused?.removeAttribute?.('data-gamepad-focus'); this.focused = null; this.editing = null; }
  dispose() { this.reset(); this.disposed = true; }
}

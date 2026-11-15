/* Local presentation preferences. These symbols and palettes describe gameplay
 * relationships; they are not claims about film costume or screen accuracy. */
export const ACCESSIBILITY_STORAGE_KEY = 'yautja_accessibility_v1';
export const ACCESSIBILITY_DEFAULTS = Object.freeze({ version: 1, palette: 'default', symbols: true, reducedFlashes: false });
const ROLES = Object.freeze({
  player: { color: '#e4ffae', accessible: '#F0E442', shape: 'circle', glyph: 'P', label: 'Joueur' },
  ally: { color: '#99ecc1', accessible: '#009E73', shape: 'diamond', glyph: 'A', label: 'Allié' },
  hostile: { color: '#ef9b8c', accessible: '#D55E00', shape: 'triangle', glyph: 'E', label: 'Hostile' },
  neutral: { color: '#c6a2d7', accessible: '#56B4E9', shape: 'square', glyph: 'N', label: 'Neutre' },
  objective: { color: '#ffdb8a', accessible: '#E69F00', shape: 'star', glyph: 'O', label: 'Objectif' },
  danger: { color: '#ff7777', accessible: '#CC79A7', shape: 'cross', glyph: '!', label: 'Danger' }
});
const noop = () => {};
function normalize(value, previous = ACCESSIBILITY_DEFAULTS) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { version: 1, palette: ['default', 'accessible'].includes(input.palette) ? input.palette : previous.palette,
    symbols: typeof input.symbols === 'boolean' ? input.symbols : previous.symbols,
    reducedFlashes: typeof input.reducedFlashes === 'boolean' ? input.reducedFlashes : previous.reducedFlashes };
}

export class AccessibilityPreferences {
  constructor({ storage = undefined, document = globalThis.document, onChange = noop } = {}) {
    this.document = document; this.listeners = new Set([onChange]); this.disposed = false; this.lastPersistenceSucceeded = null;
    try { this.storage = storage === undefined ? globalThis.localStorage : storage; } catch { this.storage = null; }
    this.preferences = { ...ACCESSIBILITY_DEFAULTS };
    try {
      const saved = JSON.parse(this.storage?.getItem(ACCESSIBILITY_STORAGE_KEY) ?? 'null');
      if (saved?.version === 1) this.preferences = normalize(saved);
    } catch { /* Invalid/private storage keeps the usable defaults. */ }
    this.apply();
  }
  get() { return { ...this.preferences }; }
  set(patch) {
    if (this.disposed) return this.get();
    const next = normalize(patch, this.preferences), changed = Object.keys(next).some(key => next[key] !== this.preferences[key]);
    if (!changed) return this.get();
    this.preferences = next;
    try {
      if (!this.storage?.setItem) this.lastPersistenceSucceeded = false;
      else { this.storage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(next)); this.lastPersistenceSucceeded = true; }
    } catch { this.lastPersistenceSucceeded = false; }
    this.apply();
    for (const listener of this.listeners) { try { listener(this.get()); } catch { /* A detached panel cannot break the game or other subscribers. */ } }
    return this.get();
  }
  subscribe(listener) { if (typeof listener !== 'function' || this.disposed) return noop; this.listeners.add(listener); return () => this.listeners.delete(listener); }
  apply() {
    if (this.disposed) return false;
    const body = this.document?.body, prefs = this.preferences;
    if (!body) return false;
    body.classList?.toggle('reduced-flashes', prefs.reducedFlashes);
    body.classList?.toggle('accessible-colors', prefs.palette === 'accessible');
    body.classList?.toggle('marker-symbols', prefs.symbols);
    for (const [role, appearance] of Object.entries(ROLES)) body.style?.setProperty(`--marker-${role}`, prefs.palette === 'accessible' ? appearance.accessible : appearance.color);
    return true;
  }
  dispose() { this.listeners.clear(); this.disposed = true; }
}

function camp(factionId) {
  const id = String(factionId ?? '').toLowerCase();
  if (/hive|xeno|alien/.test(id)) return { color: '#D55E00', glyph: 'X' };
  if (/synthetic|synth|android/.test(id)) return { color: '#CC79A7', glyph: 'S' };
  if (/human|uscm|marine|weyland/.test(id)) return { color: '#56B4E9', glyph: 'H' };
  if (/yautja|clan|hunter|predator/.test(id)) return { color: '#009E73', glyph: 'Y' };
  return null;
}

export function markerAppearance({ role = 'neutral', factionId = '', label = '' } = {}, preferences = ACCESSIBILITY_DEFAULTS) {
  const descriptor = ROLES[role] ?? ROLES.neutral, family = camp(factionId), accessible = preferences?.palette === 'accessible';
  const color = accessible ? ((role === 'ally' || role === 'hostile' || role === 'neutral') && family ? family.color : descriptor.accessible) : descriptor.color;
  const glyph = ['player', 'objective', 'danger'].includes(role) ? descriptor.glyph : family?.glyph ?? descriptor.glyph;
  return { role: ROLES[role] ? role : 'neutral', color, shape: descriptor.shape,
    glyph: preferences?.symbols === false ? '' : glyph, symbols: preferences?.symbols !== false,
    accessibleLabel: [descriptor.label, String(label || factionId || '')].filter(Boolean).join(' · ') };
}

export function drawAccessibleMarker(ctx, { x, y, size = 6, filled = true, ...marker } = {}, preferences = ACCESSIBILITY_DEFAULTS) {
  if (!ctx || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  size = Math.min(28, Math.max(3, Number.isFinite(size) ? size : 6));
  const appearance = markerAppearance(marker, preferences);
  ctx.save(); ctx.beginPath();
  const polygon = points => { points.forEach(([px, py], index) => index ? ctx.lineTo(x + px * size, y + py * size) : ctx.moveTo(x + px * size, y + py * size)); ctx.closePath(); };
  switch (appearance.shape) {
    case 'diamond': polygon([[0, -1.2], [1.2, 0], [0, 1.2], [-1.2, 0]]); break;
    case 'triangle': polygon([[0, -1.2], [1.15, 1], [-1.15, 1]]); break;
    case 'square': ctx.rect(x - size, y - size, size * 2, size * 2); break;
    case 'star': polygon(Array.from({ length: 10 }, (_, index) => { const angle = index * Math.PI / 5 - Math.PI / 2, radius = index % 2 ? .5 : 1.3; return [Math.cos(angle) * radius, Math.sin(angle) * radius]; })); break;
    case 'cross': polygon([[-1, -.5], [-.5, -1], [0, -.5], [.5, -1], [1, -.5], [.5, 0], [1, .5], [.5, 1], [0, .5], [-.5, 1], [-1, .5], [-.5, 0]]); break;
    default: ctx.arc(x, y, size, 0, Math.PI * 2);
  }
  ctx.strokeStyle = '#071018'; ctx.lineWidth = 4; ctx.stroke();
  if (filled) { ctx.fillStyle = appearance.color; ctx.fill(); }
  ctx.strokeStyle = filled ? '#f8fafc' : appearance.color; ctx.lineWidth = filled ? 1.25 : 2; ctx.stroke();
  if (appearance.glyph) {
    ctx.font = `bold ${Math.max(10, Math.round(size * 1.35))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#071018'; ctx.strokeText(appearance.glyph, x, y + .5);
    ctx.fillStyle = '#ffffff'; ctx.fillText(appearance.glyph, x, y + .5);
  }
  ctx.restore(); return appearance;
}

export function reducedFlashPolicy(preferences = ACCESSIBILITY_DEFAULTS) {
  return preferences?.reducedFlashes ? { screenFlashOpacity: .08, lightningIntensity: 0, pulse: false, cameraShakeScale: .25 }
    : { screenFlashOpacity: 1, lightningIntensity: 1, pulse: true, cameraShakeScale: 1 };
}

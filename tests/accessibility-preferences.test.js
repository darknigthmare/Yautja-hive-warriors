import test from 'node:test';
import assert from 'node:assert/strict';
import { AccessibilityPreferences, ACCESSIBILITY_STORAGE_KEY, ACCESSIBILITY_DEFAULTS, markerAppearance, drawAccessibleMarker, reducedFlashPolicy } from '../js/ui/AccessibilityPreferences.js';

function fixture(saved = null) {
  const classes = new Set(), styles = new Map(), values = new Map(saved === null ? [] : [[ACCESSIBILITY_STORAGE_KEY, saved]]);
  const document = { body: { classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name) }, style: { setProperty: (name, value) => styles.set(name, value) } } };
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  return { document, storage, classes, styles, values };
}

test('versioned preferences persist real booleans and palette changes, and apply independent body hooks', () => {
  const f = fixture(), preferences = new AccessibilityPreferences(f);
  assert.deepEqual(preferences.get(), ACCESSIBILITY_DEFAULTS); assert.ok(f.classes.has('marker-symbols'));
  preferences.set({ palette: 'accessible', reducedFlashes: true, symbols: false });
  assert.ok(f.classes.has('reduced-flashes') && f.classes.has('accessible-colors')); assert.equal(f.classes.has('marker-symbols'), false);
  assert.equal(f.styles.get('--marker-hostile'), '#D55E00'); assert.equal(preferences.lastPersistenceSucceeded, true);
  const restored = new AccessibilityPreferences(f); assert.deepEqual(restored.get(), preferences.get());
  preferences.set({ reducedFlashes: false }); assert.equal(f.classes.has('reduced-flashes'), false);
  assert.equal(preferences.get().palette, 'accessible'); preferences.dispose(); restored.dispose();
});

test('private, absent, corrupt and future storage never prevents settings from operating', () => {
  for (const saved of ['broken-json', '[]', '{"version":50,"palette":"accessible"}', '{"version":1,"palette":"other","symbols":"false","reducedFlashes":7}']) {
    const f = fixture(saved), preferences = new AccessibilityPreferences(f);
    assert.deepEqual(preferences.get(), ACCESSIBILITY_DEFAULTS); preferences.dispose();
  }
  const denied = { getItem() { throw new Error('private'); }, setItem() { throw new Error('quota'); } };
  const preferences = new AccessibilityPreferences({ storage: denied });
  assert.doesNotThrow(() => preferences.set({ reducedFlashes: true })); assert.equal(preferences.get().reducedFlashes, true);
  assert.equal(preferences.lastPersistenceSucceeded, false); preferences.dispose();
  const absent = new AccessibilityPreferences({ storage: null }); absent.set({ symbols: false }); assert.equal(absent.lastPersistenceSucceeded, false); absent.dispose();
});

test('subscribers receive copies, can detach and cannot break other preference listeners', () => {
  const preferences = new AccessibilityPreferences({ storage: null, onChange: () => { throw new Error('closed panel'); } }); let changes = 0;
  const unsubscribe = preferences.subscribe(snapshot => { changes++; snapshot.palette = 'tampered'; });
  preferences.set({ palette: 'accessible' }); assert.equal(changes, 1); assert.equal(preferences.get().palette, 'accessible');
  preferences.set({ palette: 'accessible' }); assert.equal(changes, 1); unsubscribe(); preferences.set({ symbols: false }); assert.equal(changes, 1);
  const old = preferences.get(); preferences.dispose(); preferences.set({ symbols: true }); assert.deepEqual(preferences.get(), old);
});

test('relationship shapes and meaningful glyphs distinguish markers even after every tint is converted to monochrome', () => {
  const roles = ['player', 'ally', 'hostile', 'neutral', 'objective', 'danger'], styles = roles.map(role => markerAppearance({ role }, { palette: 'accessible', symbols: true }));
  assert.equal(new Set(styles.map(style => style.shape)).size, roles.length);
  assert.equal(new Set(styles.map(style => style.glyph)).size, roles.length);
  for (const style of styles) { assert.match(style.color, /^#[\dA-Fa-f]{6}$/); assert.ok(style.accessibleLabel.length > 0); }
  assert.equal(markerAppearance({ role: 'danger' }, { symbols: false }).glyph, '');
  assert.equal(markerAppearance({ role: 'unknown' }).role, 'neutral');
});

test('camp families retain letters and different accessible tints independently of relationship shapes', () => {
  const prefs = { palette: 'accessible', symbols: true }, ids = ['hive_alpha', 'human_uscm', 'yautja_clan', 'synthetic_workers'];
  const styles = ids.map(factionId => markerAppearance({ role: 'hostile', factionId, label: factionId }, prefs));
  assert.equal(new Set(styles.map(style => style.color)).size, ids.length); assert.equal(new Set(styles.map(style => style.glyph)).size, ids.length);
  assert.ok(styles.every(style => style.shape === 'triangle' && style.accessibleLabel.includes('Hostile')));
  assert.equal(markerAppearance({ role: 'ally', factionId: ids[0] }, prefs).shape, 'diamond');
});

test('canvas markers draw distinct paths, outlines and text without assuming color alone', () => {
  const calls = [], ctx = new Proxy({}, { get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])) });
  for (const role of ['player', 'ally', 'hostile', 'neutral', 'objective', 'danger']) {
    calls.length = 0; const appearance = drawAccessibleMarker(ctx, { x: 20, y: 30, size: 8, role }, { palette: 'accessible', symbols: true });
    assert.equal(appearance.role, role); assert.ok(calls.some(([name]) => name === 'stroke')); assert.ok(calls.some(([name]) => name === 'fillText'));
    assert.equal(calls[0][0], 'save'); assert.equal(calls.at(-1)[0], 'restore');
  }
  calls.length = 0; drawAccessibleMarker(ctx, { x: 0, y: 0, filled: false }, { symbols: false });
  assert.equal(calls.some(([name]) => name === 'fillText'), false); assert.equal(calls.some(([name]) => name === 'fill'), false);
  assert.equal(drawAccessibleMarker(ctx, { x: NaN, y: 0 }), false);
});

test('reduced flashes suppresses lightning and pulsing while leaving warning symbols available', () => {
  const reduced = reducedFlashPolicy({ reducedFlashes: true }); assert.equal(reduced.lightningIntensity, 0); assert.equal(reduced.pulse, false);
  assert.ok(reduced.screenFlashOpacity <= .1 && reduced.cameraShakeScale <= .25);
  assert.ok(markerAppearance({ role: 'danger' }, { reducedFlashes: true }).glyph.length > 0);
  assert.equal(reducedFlashPolicy({ reducedFlashes: false }).lightningIntensity, 1);
});

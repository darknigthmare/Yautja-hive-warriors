import test from 'node:test';
import assert from 'node:assert/strict';
import { UIManager } from '../js/ui/UIManager.js';
import { OperationPanel } from '../js/ui/OperationPanel.js';
import { operationMapFrontEntries, renderOperationFrontLegend, drawOperationFrontLabel } from '../js/ui/OperationMapLabels.js';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

function element(tag = '') {
  const attrs = {}, events = {};
  return { tag, attrs, events, dataset: {}, style: {}, children: [], className: '', textContent: '',
    classList: {
      contains(name) { return this.owner.className.split(/\s+/).includes(name); },
      toggle(name, value) {
        const classes = new Set(this.owner.className.split(/\s+/).filter(Boolean));
        if (value ?? !classes.has(name)) classes.add(name); else classes.delete(name);
        this.owner.className = [...classes].join(' ');
      }
    },
    setAttribute(key, value) { attrs[key] = value; },
    get innerHTML() { return this._html ?? ''; },
    set innerHTML(value) { this._html = value; this.children = []; },
    addEventListener(key, callback) { events[key] = callback; },
    append(...nodes) { this.children.push(...nodes); },
    appendChild(node) { this.children.push(node); },
    before(node) { this.beforeNode = node; },
    replaceChildren(...nodes) { this.children = nodes; this.replacements = (this.replacements ?? 0) + 1; }
  };
}
function node(tag) { const result = element(tag); result.classList.owner = result; return result; }
function withDocument(document, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  try { return run(); } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document;
  }
}
function canvasContext() {
  const texts = [];
  const ctx = new Proxy({ texts, measureText: text => ({ width: text.length * 6 }),
    fillText(text, x, y) { texts.push({ text, x, y, font: this.font }); }
  }, { get(object, key) { return object[key] ?? (() => {}); } });
  return ctx;
}

test('programmatic terrain selection updates the same cards as a real level click', () => {
  const grid = node('div'), ui = Object.create(UIManager.prototype);
  ui.levelSelectMenu = { querySelectorAll: () => grid.children };
  ui.selectedLevel = LEVELS_DATA[0];
  withDocument({ getElementById: () => grid, createElement: node }, () => {
    ui.initLevelSelect();
    const prime = LEVELS_DATA.find(level => level.id === 'xenomorph_prime');
    ui.selectedLevel = prime;
    assert.equal(ui.selectedLevel, prime);
    for (const card of grid.children) {
      const expected = card.dataset.levelId === prime.id;
      assert.equal(card.classList.contains('selected'), expected);
      assert.equal(card.attrs['aria-pressed'], String(expected));
    }
    const previousCard = grid.children.find(card => card.dataset.levelId === LEVELS_DATA[0].id);
    previousCard.events.click();
    assert.equal(ui.selectedLevel, LEVELS_DATA[0]);
    assert.deepEqual(grid.children.filter(card => card.classList.contains('selected')).map(card => card.dataset.levelId), [LEVELS_DATA[0].id]);
  });
});

test('cards rebuilt after checkpoint selection preserve the selected terrain rather than the first row', () => {
  const grid = node('div'), ui = Object.create(UIManager.prototype);
  ui.selectedLevel = LEVELS_DATA.find(level => level.id === 'xenomorph_prime');
  ui.levelSelectMenu = { querySelectorAll: () => grid.children };
  withDocument({ getElementById: () => grid, createElement: node }, () => {
    ui.initLevelSelect();
    assert.deepEqual(grid.children.filter(card => card.attrs['aria-pressed'] === 'true').map(card => card.dataset.levelId), ['xenomorph_prime']);
  });
});

test('an authored operation prevents a contradictory terrain click and immediately releases cards for a free terrain mode', () => {
  const grid = node('div'), ui = Object.create(UIManager.prototype), prime = LEVELS_DATA.find(level => level.id === 'xenomorph_prime');
  ui.levelSelectMenu = { querySelectorAll: () => grid.children, querySelector: () => grid };
  ui.selectedLevel = LEVELS_DATA[0];
  withDocument({ getElementById: () => grid, createElement: node }, () => {
    ui.initLevelSelect(); ui.setOperationLevel(prime);
    assert.equal(ui.selectedLevel, prime);
    assert.ok(grid.children.every(card => card.disabled));
    assert.match(ui.operationLevelNotice.textContent, /Terrain de cette opération.*Trois fronts.*Chasse/);
    assert.ok(ui.operationLevelNotice.textContent.includes(prime.name));
    const other = grid.children.find(card => card.dataset.levelId === LEVELS_DATA[0].id);
    other.events.click();
    assert.equal(ui.selectedLevel, prime, 'even an explicit handler call cannot override the authored terrain');
    ui.initLevelSelect();
    assert.ok(grid.children.every(card => card.disabled), 'rebuilding the cards keeps an authored operation locked');
    assert.deepEqual(grid.children.filter(card => card.attrs['aria-pressed'] === 'true').map(card => card.dataset.levelId), [prime.id]);
    // Restoration is programmatic and remains independent of the card lock.
    ui.selectedLevel = LEVELS_DATA[1]; assert.equal(ui.selectedLevel, LEVELS_DATA[1]);
    ui.setOperationLevel(prime);
    ui.setOperationLevel(null);
    assert.ok(grid.children.every(card => !card.disabled));
    assert.equal(ui.operationLevelNotice.classList.contains('hidden'), true);
    grid.children.find(card => card.dataset.levelId === LEVELS_DATA[0].id).events.click();
    assert.equal(ui.selectedLevel, LEVELS_DATA[0]);
  });
});

test('LV-742 map keys and source descriptions stay identical for standard and enhanced variants', () => {
  const scenes = ['none', 'carrier-ravager', 'carrier-ravager-enhanced'].map(extinctionVariant => createOperationScene({ operationId: 'AFF-27', extinctionVariant }));
  const snapshots = scenes.map(scene => structuredClone(scene.config));
  const entries = scenes.map(scene => operationMapFrontEntries(scene.config.fronts));
  assert.deepEqual(entries[0].map(({ id, key, label }) => ({ id, key, label })), entries[1].map(({ id, key, label }) => ({ id, key, label })));
  assert.deepEqual(entries[1].map(({ id, key, label }) => ({ id, key, label })), entries[2].map(({ id, key, label }) => ({ id, key, label })));
  assert.deepEqual(entries[0].map(entry => entry.mapLabel), ['1', '2', '3', '4']);
  assert.ok(entries[0].every(entry => entry.label.length > 100 && entry.title.length < entry.label.length));
  scenes.forEach((scene, index) => assert.deepEqual(scene.config, snapshots[index], 'formatting never mutates the signed configuration'));
});

test('compact map labels retain unknown control and leave concise maps readable by name', () => {
  const source = [{ id: 'a', label: 'Un très long descriptif de front : instruction source conservée', intelState: 'unknown' }, { id: 'b', label: 'Départ' }];
  const entries = operationMapFrontEntries(source);
  assert.equal(entries[0].mapLabel, '1 ?'); assert.equal(entries[0].label, source[0].label);
  assert.equal(entries[1].mapLabel, '2');
  assert.equal(operationMapFrontEntries([{ id: 'a', label: 'Objectif', intelState: 'unknown' }])[0].mapLabel, 'Objectif ?');
});

test('real LV-742 minimap draws bounded keys without painting its long source paragraphs over the map', () => {
  const { config, layout } = createOperationScene({ operationId: 'AFF-27', extinctionVariant: 'carrier-ravager-enhanced' });
  const sim = new BattleSimulation(config);
  try {
    const ctx = canvasContext(), state = sim.getHUDState();
    const ui = { minimapCtx: ctx, minimapCanvas: { width: 224, height: 224 }, _operationHUD: { state, layout, players: [], objectives: null } };
    UIManager.prototype.renderOperationMap.call(ui);
    for (const entry of operationMapFrontEntries(state.fronts)) assert.ok(ctx.texts.some(row => row.text === entry.mapLabel));
    assert.equal(ctx.texts.some(row => state.fronts.some(front => row.text.includes(front.label))), false);
    for (const row of ctx.texts.filter(row => /^[1-4]( \?)?$/.test(row.text))) {
      assert.ok(row.x >= row.text.length * 3 && row.x <= 224 - row.text.length * 3);
      assert.ok(row.y >= 12 && row.y <= 221);
    }
    assert.equal(sim.assertConservation(), true);
  } finally { sim.dispose(); }
});

test('briefing legends retain every full front description and expose unknown control without hidden troop counts', () => {
  const entries = operationMapFrontEntries([{ id: 'a', label: 'Col du convoi : détourner les renforts par le passage sûr.', intelState: 'unknown' }]);
  withDocument({ createElement: node }, () => {
    const list = node('ol');
    renderOperationFrontLegend(list, entries, { full: true });
    const item = list.children[0];
    assert.equal(item.dataset.frontId, 'a');
    assert.equal(item.children[0].textContent, '1');
    assert.equal(item.children[1].textContent, entries[0].label + ' ?');
    assert.equal(item.attrs['aria-label'], `1 — ${entries[0].label} · contrôle inconnu`);
    assert.equal(item.title, entries[0].label);
    renderOperationFrontLegend(list, entries, { full: true });
    assert.equal(list.replacements, 1, 'unchanged HUD snapshots do not recreate the legend');
    renderOperationFrontLegend(list, [{ ...entries[0], unknown: false }], { full: true });
    assert.equal(list.replacements, 2); assert.doesNotMatch(list.children[0].attrs['aria-label'], /inconnu/);
  });
});

test('canvas label strokes and text remain inside the image even at a boundary front', () => {
  const ctx = canvasContext(), entry = operationMapFrontEntries([{ id: 'a', label: 'Front très long : description conservée dans sa légende' }])[0];
  for (const [x, y] of [[0, 0], [224, 224]]) drawOperationFrontLabel(ctx, entry, x, y, 224, 224, 11);
  assert.deepEqual(ctx.texts.map(({ text, x, y }) => ({ text, x, y })), [{ text: '1', x: 6, y: 14 }, { text: '1', x: 218, y: 213 }]);
});

test('the actual Musou panel uses stable map keys for priority-sorted fronts without deleting source labels', () => {
  const { config } = createOperationScene({ operationId: 'AFF-27' }), sim = new BattleSimulation(config);
  try {
    const state = sim.getHUDState(), nodes = new Map();
    for (const key of ['title', 'musou', 'counts', 'fronts', 'alert', 'rescue', 'tasks', 'report-age', 'group', 'front', 'apc-board', 'apc-exit', 'apc-drive', 'apc-stop']) nodes.set(`[data-${key}]`, node());
    const root = { classList: { toggle() {} }, querySelector: key => nodes.get(key) };
    withDocument({ createElement: node }, () => {
      OperationPanel.prototype.update.call({ root, options() {} }, state, null, []);
      const text = nodes.get('[data-musou]').textContent;
      for (const entry of operationMapFrontEntries(state.fronts)) if (text.includes(entry.title)) assert.ok(text.includes(`${entry.key} · ${entry.title}`));
      assert.equal(state.fronts.some(front => text.includes(front.label)), false);
      assert.ok(state.fronts.every(front => nodes.get('[data-fronts]').textContent.includes(front.label)), 'the optional detailed report still retains each full name');
    });
  } finally { sim.dispose(); }
});

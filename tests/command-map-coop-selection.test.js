import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandMap } from '../js/ui/CommandMap.js';

// A select keeps its selected value when that option becomes disabled.
// Exercise the production update across mission changes, without a canvas renderer.
function select(values, selected = values[0], multiple = false) {
  return {
    multiple,
    options: values.map(value => ({ value, textContent: value, selected: Array.isArray(selected) ? selected.includes(value) : selected === value, disabled: false })),
    get value() { return this.selectedOptions[0]?.value ?? ''; },
    set value(value) { for (const option of this.options) option.selected = option.value === value; },
    get selectedOptions() { return this.options.filter(option => option.selected); },
    replaceChildren(...options) { this.options = options; },
    querySelector(selector) { const value = selector.match(/option\[value="([^"]+)"\]/)?.[1]; return this.options.find(option => option.value === value) ?? null; },
  };
}
function withMap(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const nodes = new Map([
    ['[data-issuer]', select(['player1', 'player2'])],
    ['[data-player-target]', select(['player1', 'player2'])],
    ['[data-groups]', select(['ally-a', 'ally-b'], ['ally-a', 'ally-b'], true)],
    ['[data-front]', select(['front-a', 'front-b'], 'front-b')],
    ['[data-companion]', select(['support-a'], 'support-a')],
    ['[data-enemy-target]', select(['enemy-a'], 'enemy-a')],
    ['[data-mission-status]', { textContent: '' }],
  ]);
  const root = { querySelector(selector) {
    if (nodes.has(selector)) return nodes.get(selector);
    const parent = selector.match(/^(\[data-[^\]]+\]) (option.*)$/);
    if (parent) return nodes.get(parent[1]).querySelector(parent[2]);
    throw new Error('Unexpected DOM lookup: ' + selector);
  } };
  const map = Object.create(CommandMap.prototype);
  Object.assign(map, { root, draw() {}, report() {}, updateJournal() {}, zoom: 2, pan: [12, -8] });
  const state = {
    label: 'Opération coop', playerFaction: 'clan',
    groups: [{ id: 'ally-a', label: 'Capitaine', factionId: 'clan', alive: 4 }, { id: 'ally-b', label: 'Appui', factionId: 'clan', alive: 3 }],
    fronts: [{ id: 'front-a', label: 'Départ' }, { id: 'front-b', label: 'Objectif' }],
  };
  const extras = { units: [{ id: 'support-a', label: 'Médicomp' }], hostileGroups: [{ id: 'enemy-a', label: 'Groupe adverse' }] };
  const update = coOp => map.update(state, {}, coOp ? [{ id: 'player1', hp: 100 }, { id: 'player2', hp: 100 }] : [{ id: 'player1', hp: 100 }], coOp, extras);
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ value: '', textContent: '', selected: false }) } });
    return run({ map, nodes, update });
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document;
  }
}

test('returning from co-op to solo resets the command issuer to the player who exists', () => withMap(({ nodes, update }) => {
  update(true);
  const issuer = nodes.get('[data-issuer]'); issuer.value = 'player2';
  update(false);
  assert.equal(issuer.value, 'player1');
  assert.equal(issuer.querySelector('option[value="player2"]').disabled, true);
  assert.equal(issuer.selectedOptions.some(option => option.disabled), false);
}));

test('returning from co-op to solo resets the healing recipient to the living mission slot', () => withMap(({ nodes, update }) => {
  update(true);
  const target = nodes.get('[data-player-target]'); target.value = 'player2';
  update(false);
  assert.equal(target.value, 'player1');
  assert.equal(target.querySelector('option[value="player2"]').disabled, true);
  assert.equal(target.selectedOptions.some(option => option.disabled), false);
}));

test('co-op refresh preserves player-two choices and the selected groups, destination and view', () => withMap(({ map, nodes, update }) => {
  update(true);
  nodes.get('[data-issuer]').value = 'player2'; nodes.get('[data-player-target]').value = 'player2';
  update(true);
  for (const selector of ['[data-issuer]', '[data-player-target]']) {
    assert.equal(nodes.get(selector).value, 'player2');
    assert.equal(nodes.get(selector).querySelector('option[value="player2"]').disabled, false);
  }
  assert.deepEqual(nodes.get('[data-groups]').selectedOptions.map(option => option.value), ['ally-a', 'ally-b']);
  assert.equal(nodes.get('[data-front]').value, 'front-b');
  assert.equal(nodes.get('[data-companion]').value, 'support-a');
  assert.equal(nodes.get('[data-enemy-target]').value, 'enemy-a');
  assert.equal(map.zoom, 2); assert.deepEqual(map.pan, [12, -8]);
}));

test('solo-to-co-op enables the second slot without silently retargeting player-one actions', () => withMap(({ nodes, update }) => {
  update(false); update(true);
  for (const selector of ['[data-issuer]', '[data-player-target]']) {
    assert.equal(nodes.get(selector).value, 'player1');
    assert.equal(nodes.get(selector).querySelector('option[value="player2"]').disabled, false);
  }
}));

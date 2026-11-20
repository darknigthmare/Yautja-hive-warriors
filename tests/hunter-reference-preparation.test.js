import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Optional exact-source replay. This never substitutes a mock for the resolver.
const root = process.env.YHW_FIDELITY_SOURCE
  ? pathToFileURL(path.resolve(process.env.YHW_FIDELITY_SOURCE) + path.sep)
  : new URL('../', import.meta.url);
const arsenal = await import(new URL('js/data/hunterArsenal.js', root));
const { CHARACTERS_DATA, ULTIMATE_YAUTJA_ARMORY } = await import(new URL('js/data/charactersData.js', root));
const expected = JSON.parse(await readFile(new URL('./fixtures/hunter-reference-expectations.json', import.meta.url)));
const { resolveHunterLoadout, HUNTER_ARSENAL_PROFILES, HUNTER_WEAPON_PROFILES } = arsenal;

for (const row of expected) {
  test(`${row.id}: reference defaults retain the original runtime equipment`, () => {
    const result = resolveHunterLoadout(row.id, { fidelityMode: 'faithful' });
    assert.equal(result.primary, row.primary);
    assert.equal(result.secondary, row.secondary);
    assert.equal(result.ranged, row.ranged);
    assert.deepEqual(result.gadgets, row.gadgets);
    assert.equal(result.referenceKnown, true);
  });
  test(`${row.id}: character card names the resolved reference kit, not another hunter's equipment`, () => {
    const character = CHARACTERS_DATA.find(item => item.id === row.id);
    assert.equal(character.weapons.primary, row.labels.primary);
    assert.equal(character.weapons.secondary, row.labels.secondary);
    assert.equal(character.weapons.special, row.labels.special);
    assert.equal(character.weapons.gadgets, row.labels.gadgets);
    assert.match(character.weapons.uniqueAbility, /adaptation de gameplay/);
    assert.equal(character.reference.fidelity1to1Verified, false);
  });
  test(`${row.id}: every proposed UI slot is accepted unchanged by the runtime resolver`, () => {
    const choices = arsenal.getHunterLoadoutOptions(row.id, 'faithful');
    for (const id of Object.keys(HUNTER_WEAPON_PROFILES)) {
      const permitted = HUNTER_ARSENAL_PROFILES[row.id].weapons.includes(id);
      assert.equal(choices.weapons.includes(id), permitted, id);
      if (permitted) for (const slot of ['primary', 'secondary']) {
        assert.equal(resolveHunterLoadout(row.id, { fidelityMode: 'faithful', [slot]: id })[slot], id);
      }
    }
    for (const id of choices.gadgets) assert.deepEqual(resolveHunterLoadout(row.id, { fidelityMode: 'faithful', gadgets: [id] }).gadgets, [id]);
    assert.deepEqual(choices.defaults, resolveHunterLoadout(row.id, { fidelityMode: 'faithful' }));
  });
  test(`${row.id}: health, speed, damage, palette and character order are unchanged`, () => {
    const character = CHARACTERS_DATA.find(item => item.id === row.id);
    assert.deepEqual(character.stats, row.stats);
    assert.deepEqual(character.colors, row.colors);
    assert.equal(CHARACTERS_DATA[row.index].id, row.id);
  });
}

test('unknown and prototype-property character ids cannot masquerade as a reference kit', () => {
  for (const id of ['missing', '__proto__', 'constructor', 'toString', 'hasOwnProperty', null, undefined, {}, ['city_hunter']]) {
    const result = resolveHunterLoadout(id, { fidelityMode: 'faithful', primary: 'katana', secondary: 'smart_disc', gadgets: ['nuke'] });
    assert.deepEqual(result, { fidelityMode: 'faithful', primary: 'wristblades', secondary: 'wristblades', gadgets: [], ranged: null, referenceKnown: false });
  }
});

test('invalid weapon values are rejected without coercing executable object keys', () => {
  const poison = { toString() { throw new Error('must not coerce an equipment object'); } };
  for (const id of [poison, {}, [], ['katana'], '__proto__', 'constructor', null, 3, Symbol('katana')]) {
    const result = resolveHunterLoadout('samurai_predator', { fidelityMode: 'faithful', primary: id, secondary: id });
    assert.equal(result.primary, 'katana'); assert.equal(result.secondary, 'smart_disc');
  }
});

test('null and array configurations cannot inject a faithful kit', () => {
  const array = []; array.fidelityMode = 'faithful';
  for (const config of [null, undefined, 3, 'faithful', array]) {
    assert.equal(resolveHunterLoadout('jungle_hunter', config).fidelityMode, 'adapted');
  }
});

test('adapted mode preserves all implemented slot choices and the six existing gadgets', () => {
  for (const id of Object.keys(HUNTER_WEAPON_PROFILES)) {
    const result = resolveHunterLoadout('jungle_hunter', { primary: id, secondary: id });
    assert.equal(result.primary, id); assert.equal(result.secondary, id); assert.equal(result.ranged, 'plasma_caster');
  }
  assert.deepEqual(arsenal.getHunterLoadoutOptions('jungle_hunter').weapons, Object.keys(HUNTER_WEAPON_PROFILES));
  assert.deepEqual(arsenal.getHunterLoadoutOptions('jungle_hunter').gadgets, [...arsenal.ADAPTED_GADGETS]);
});

test('gadgets remain optional, unique, permitted and capped at two without mutating input', () => {
  const gadgets = ['medicomp', 'medicomp', 'missing', 'acid_solvent', 'mines'];
  const before = [...gadgets];
  assert.deepEqual(resolveHunterLoadout('wolf_predator', { fidelityMode: 'faithful', gadgets }).gadgets, ['medicomp', 'acid_solvent']);
  assert.deepEqual(gadgets, before);
  assert.deepEqual(resolveHunterLoadout('feral_predator', { fidelityMode: 'faithful', gadgets: [] }).gadgets, []);
  assert.deepEqual(resolveHunterLoadout('jungle_hunter', { fidelityMode: 'faithful', gadgets: ['mines', 'bear_trap'] }).gadgets, []);
});

test('returned options, cards and defaults never expose mutable registry arrays', () => {
  for (const row of expected) {
    const before = JSON.stringify(HUNTER_ARSENAL_PROFILES[row.id]);
    const options = arsenal.getHunterLoadoutOptions(row.id, 'faithful');
    const card = arsenal.getHunterReferenceCard(row.id);
    options.weapons.push('forged'); options.gadgets.length = 0; options.sourceUrls.length = 0;
    options.defaults.gadgets.push('forged'); card.sourceUrls.length = 0; card.weapons.primary = 'forged';
    assert.equal(JSON.stringify(HUNTER_ARSENAL_PROFILES[row.id]), before);
    assert.ok(arsenal.getHunterReferenceCard(row.id).sourceUrls.length > 0);
    assert.equal(Object.isFrozen(HUNTER_ARSENAL_PROFILES[row.id].defaults.gadgets), true);
  }
});

test('all reference equipment has an explicit label and source scope without certifying a model', () => {
  for (const [id, ref] of Object.entries(HUNTER_ARSENAL_PROFILES)) {
    const card = arsenal.getHunterReferenceCard(id);
    assert.match(card.referenceScope, /not an exhaustive scene inventory/);
    assert.ok(card.sourceUrls.every(url => new URL(url).protocol === 'https:'));
    for (const equipment of [...ref.weapons, ...ref.gadgets]) {
      assert.notEqual(arsenal.hunterEquipmentLabel(equipment), 'Équipement non référencé', `${id}/${equipment}`);
    }
    assert.equal(arsenal.getHunterLoadoutOptions(id, 'faithful').fidelity1to1Verified, false);
  }
  assert.equal(arsenal.getHunterReferenceCard('__proto__'), null);
  assert.equal(arsenal.hunterEquipmentLabel('constructor'), 'Équipement non référencé');
});

test('cross-media armory ids are retained while the Feral launcher and Wolf whip lose misleading display names', () => {
  assert.equal(ULTIMATE_YAUTJA_ARMORY.length, 36);
  assert.equal(new Set(ULTIMATE_YAUTJA_ARMORY.map(item => item.id)).size, 36);
  assert.equal(ULTIMATE_YAUTJA_ARMORY.find(item => item.id === 'crossbow').name, 'Feral Guided Bolt Launcher');
  assert.equal(ULTIMATE_YAUTJA_ARMORY.find(item => item.id === 'plasma_whip').name, 'Wolf Segmented Whip');
});

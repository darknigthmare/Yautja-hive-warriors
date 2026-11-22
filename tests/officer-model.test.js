import test from 'node:test';
import assert from 'node:assert/strict';
import { usesOfficerModel } from '../js/entities/ColonialMarines.js';
import { getGeneratedAssetEntry } from '../js/graphics/GeneratedAssetLibrary.js';

// AUD-031: generic and USCM officers wear the officer model; named or corporate leaders keep theirs.
test('only generic or USCM officers wear the officer model', () => {
  assert.equal(usesOfficerModel({ officer: true }, { id: 'original_human_officer' }), true);
  assert.equal(usesOfficerModel({ officer: true }, { id: 'x', name: 'Section leader' }), true);
  assert.equal(usesOfficerModel({ officer: true }, { id: 'source_a', name: 'Infantry', affiliation: 'uscm' }), true);
  assert.equal(usesOfficerModel({ officer: true }, { id: 'boss', name: 'Mara Voss, responsable du transfert industriel' }), false);
  assert.equal(usesOfficerModel({ officer: true }, { id: 'source_b', name: 'Infantry', affiliation: 'weyland_yutani' }), false);
  assert.equal(usesOfficerModel({ officer: false }, { id: 'original_human_officer' }), false);
  assert.equal(usesOfficerModel({ officer: true }, null), false);
  assert.ok(getGeneratedAssetEntry('uscm_officer'), 'the officer model is a verified local asset');
});

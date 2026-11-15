import test from 'node:test';
import assert from 'node:assert/strict';
import { nextBackdrop, parseMenuImages, BACKDROP_WORLDS } from '../js/graphics/MenuBackdrop.js';
import { layerMix, parseMusicManifest, MUSIC_CUES } from '../js/engine/MusicDirector.js';
import { bootStages } from '../js/ui/BootSequence.js';
import { ambientBiomeFor, AMBIENT_BEDS } from '../js/engine/AmbientSoundscape.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

/* Spec 003: rotation of menu backdrops, author slots for music and images, startup stages. */
test('each arrival on the menu shows the next style; worlds and hunters advance only on their own turn', () => {
  let state = null; const seen = [];
  for (let i = 0; i < 9; i++) { state = nextBackdrop(state, { hunters: 7 }); seen.push(state.style === 'world' ? `world:${BACKDROP_WORLDS[state.world]}` : state.style === 'hunter' ? `hunter:${state.hunter}` : state.style); }
  assert.deepEqual(seen, ['hunter:0', 'world:jungle', 'glyphs', 'hunter:1', 'world:pyramid', 'glyphs', 'hunter:2', 'world:rooftops', 'glyphs']);
  assert.equal(nextBackdrop({ styleIndex: 2 }, { imagesAvailable: true }).style, 'images', 'the author images join the rotation once listed');
  assert.equal(nextBackdrop('{broken').style, 'hunter', 'a damaged record starts over');
});

test('author slots accept only safe local file names and known cues, layers and biomes', () => {
  assert.deepEqual(parseMenuImages({ images: [{ file: 'key-art.webp', credit: 'Darknigthmare' }, { file: '../secret.png' }, { file: 'https://x/y.jpg' }] }), [{ file: 'key-art.webp', credit: 'Darknigthmare' }]);
  const manifest = parseMusicManifest({ tracks: { menu: { file: 'menu-theme.ogg', loopStart: 4.2, loopEnd: 96 }, combat: { layers: { calm: 'c1.ogg', combat: 'c3.mp3', bogus: 'x.ogg' } }, intro: { file: 'x.ogg' }, boss: { file: '../boss.ogg' } } });
  assert.deepEqual(manifest.tracks, { menu: { file: 'menu-theme.ogg', loopStart: 4.2, loopEnd: 96 }, combat: { layers: { calm: 'c1.ogg', combat: 'c3.mp3' } } });
  for (const level of LEVELS_DATA) assert.ok(Object.hasOwn(AMBIENT_BEDS, ambientBiomeFor(level.id)), level.id);
  for (const cue of ['title', 'menu', 'loading', 'briefing', 'explore', 'combat', 'boss', 'victory', 'defeat', 'hub']) assert.ok(MUSIC_CUES[cue], cue);
});

test('danger brings the tension then the combat layer in, never silencing the bed', () => {
  assert.deepEqual(layerMix(0), { calm: 1, tension: .25, combat: 0 });
  const high = layerMix(1); assert.ok(high.calm > .5 && high.tension === 1 && high.combat === 1);
  assert.ok(layerMix(.3).combat === 0 && layerMix(.6).combat > 0);
});

test('startup stages follow the Cinématiques setting and automation skips them unless asked', () => {
  assert.deepEqual(bootStages('full'), ['glyphs', 'credit', 'title']);
  assert.deepEqual(bootStages('short'), ['title']);
  assert.deepEqual(bootStages('off'), []);
  assert.deepEqual(bootStages('full', { automated: true }), []);
  assert.deepEqual(bootStages('full', { automated: true, forced: true }), ['glyphs', 'credit', 'title']);
});

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

test('every world has a loading card and progress counts only the models requested since the screen opened', async () => {
  const { loadingCard, LOADING_TIPS } = await import('../js/data/LoadingLore.js');
  const { loadingProgress } = await import('../js/ui/LoadingScreen.js');
  for (const level of LEVELS_DATA) { const card = loadingCard(level.id, { seed: 3 }); assert.ok(card.lore?.lines.length >= 2 && card.lore.tag, level.id); assert.ok(LOADING_TIPS.includes(card.tip)); }
  assert.match(loadingCard('val_verde_jungle', { shipHub: true }).lore.tag, /LAME PATIENTE/);
  const baseline = { requested: 4, settled: 4 };
  assert.equal(loadingProgress({ requested: 4, settled: 4 }, baseline, 0), .85, 'models cached by the menu count as loaded');
  assert.equal(loadingProgress({ requested: 8, settled: 6 }, baseline, 8), .5 * .85 + .15);
  assert.equal(loadingProgress({ requested: 8, settled: 8 }, baseline, 30), 1);
});

test('intel speaks per mode from the mission data and never announces what is absent', async () => {
  const { buildMissionIntel, BOSS_LABELS } = await import('../js/data/MissionIntel.js');
  const { ascensionWorld } = await import('../js/data/AscensionWorlds.js');
  const { BOSS_REGISTRY } = await import('../js/data/BossRegistry.js');
  const level = LEVELS_DATA.find(item => item.id === 'val_verde_jungle');
  const layout = { sectors: Array.from({ length: 6 }, (_, index) => ({ center: [index * 170, 0], objective: { label: index ? 'Autre' : 'Éliminez 12 ennemis pour ouvrir le passage' } })) };
  const hunt = buildMissionIntel({ mode: 'hunt', level, layout, bossType: 'jungle_hunter_boss' });
  assert.ok(hunt.lines.every(line => line.speaker === 'ANCIEN DU CLAN'));
  assert.match(hunt.lines.map(line => line.text).join(' '), /6 secteurs.*éliminez 12 ennemis.*le Chasseur de la jungle/s);
  assert.equal(hunt.focus.length, 6);
  assert.ok(!buildMissionIntel({ mode: 'hunt', level, layout }).lines.some(line => /dernier secteur attend/.test(line.text)), 'no boss line without a prepared boss');
  const ascension = buildMissionIntel({ mode: 'ascension', level, layout, ascensionWorld: ascensionWorld('vara_kesh') });
  assert.deepEqual([...new Set(ascension.lines.map(line => line.speaker))], ['KAEDH', 'SAAR']);
  const fronts = buildMissionIntel({ mode: 'fronts', level, layout, playerFaction: 'clan', factions: [{ id: 'clan', species: 'yautja' }, { id: 'uscm', species: 'human', label: 'USCM' }, { id: 'hive', species: 'xenomorph' }] });
  assert.equal(fronts.lines[0].speaker, 'RADIO · USCM'); assert.equal(fronts.lines[0].side, 'intercept'); assert.equal(fronts.lines.at(-1).speaker, 'ANCIEN DU CLAN');
  const hiveOnly = buildMissionIntel({ mode: 'fronts', level, layout, playerFaction: 'clan', factions: [{ id: 'clan', species: 'yautja' }, { id: 'hive', species: 'xenomorph' }] });
  assert.ok(hiveOnly.lines.every(line => line.side !== 'intercept'), 'no human radio is invented when no human faction is present');
  assert.equal(buildMissionIntel({ mode: 'ascension_hub', level }), null);
  for (const id of Object.keys(BOSS_LABELS)) assert.ok(BOSS_REGISTRY[id], `${id} is a registered boss`);
});

test('typed comms reveal at a readable pace', async () => {
  const { typedLength } = await import('../js/engine/CinematicDirector.js');
  assert.equal(typedLength('abcdef', 0), 0); assert.equal(typedLength('abcdef', .1), 3); assert.equal(typedLength('abcdef', 10), 6);
});

test('ambient life is decoration only, follows the biome and lifts its flock when fighting comes close', async () => {
  const THREE = await import('three');
  const { AmbientLife, AMBIENT_LIFE, flockResponse } = await import('../js/graphics/AmbientLife.js');
  const scene = new THREE.Scene(), life = new AmbientLife(scene);
  const layout = { sectors: [{ bounds: { minX: -66, maxX: 66, minZ: -66, maxZ: 66 } }] };
  for (const biome of Object.keys(AMBIENT_LIFE)) { life.start(biome, { layout }); life.update(1 / 30, new THREE.Vector3(), .5); }
  life.start('jungle', { layout });
  const root = scene.getObjectByName('ambient-life');
  assert.equal(root.userData.decorationOnly, true);
  let meshes = 0; root.traverse(node => { if (node.isMesh || node.isPoints) meshes++; });
  assert.ok(meshes <= 3, 'a few draw calls');
  const height = () => { const m = new THREE.Matrix4(); scene.getObjectByName('ambient-birds').getMatrixAt(0, m); return new THREE.Vector3().setFromMatrixPosition(m).y; };
  for (let i = 0; i < 30; i++) life.update(1 / 30, new THREE.Vector3(), 0);
  const calm = height();
  for (let i = 0; i < 120; i++) life.update(1 / 30, new THREE.Vector3(), 1);
  assert.ok(height() > calm + 10, 'the flock climbs away from a fight');
  assert.deepEqual(flockResponse(0), { lift: 0, spread: 1 });
  life.clear(); assert.equal(scene.getObjectByName('ambient-life'), undefined, 'cleared with the mission');
});

test('each world has its own musical variation and every voice belongs to a layer', async () => {
  const { WORLD_VARIATIONS, MUSIC_CUES } = await import('../js/engine/MusicDirector.js');
  for (const level of LEVELS_DATA) assert.ok(WORLD_VARIATIONS[level.id], level.id);
  const signatures = new Set(Object.values(WORLD_VARIATIONS).map(v => `${v.transpose}/${v.accents.join(',')}`));
  assert.equal(signatures.size, Object.keys(WORLD_VARIATIONS).length, 'no two worlds share a variation');
  for (const cue of Object.values(MUSIC_CUES)) for (const voice of cue.voices) assert.ok(['pad', 'horn', 'choir', 'arp', 'clicks', 'pulse', 'metal', 'drums', 'bass', 'snare', 'brass'].includes(voice), voice);
});

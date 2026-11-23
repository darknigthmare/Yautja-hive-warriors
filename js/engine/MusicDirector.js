/* Music for every moment of the game (spec 003, FR-003). Each named cue is an original procedural
 * score in the spirit of the films' scores (military snare, low brass ostinatos, tribal drums,
 * tense strings, the hunter's clicks), as the author asked on 16 Nov 2026, without reproducing
 * any film melody or theme: the melodies, rhythms and harmonies here are original.
 * Each named cue is an original procedural
 * score built from WebAudio voices, organized in three layers (calm, tension, combat) mixed by
 * danger. A file listed in public/audio/music/manifest.json replaces the procedural cue of the
 * same name, whole or per layer, so the author's own tracks drop in without code. */

export const MUSIC_LAYERS = Object.freeze(['calm', 'tension', 'combat']);

const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10], AEOLIAN = [0, 2, 3, 5, 7, 8, 10], HIJAZ = [0, 1, 4, 5, 7, 8, 10];

/** Tempo in BPM, root as a MIDI note, a scale, a four-bar chord walk (scale degrees), and which voices play. */
export const MUSIC_CUES = Object.freeze({
  title:    { tempo: 64,  root: 38, scale: PHRYGIAN, chords: [0, 0, 5, 1], voices: ['pad', 'horn', 'clicks', 'choir', 'metal'], loop: true, intensity: .25 },
  menu:     { tempo: 72,  root: 40, scale: AEOLIAN,  chords: [0, 5, 3, 4], voices: ['pad', 'arp', 'clicks', 'pulse'], loop: true, intensity: .3 },
  loading:  { tempo: 80,  root: 40, scale: PHRYGIAN, chords: [0, 1, 0, 6], voices: ['pad', 'pulse', 'clicks'], loop: true, intensity: .4 },
  briefing: { tempo: 76,  root: 37, scale: HIJAZ,    chords: [0, 1, 4, 0], voices: ['pad', 'pulse', 'clicks', 'arp'], loop: true, intensity: .45 },
  hub:      { tempo: 60,  root: 36, scale: AEOLIAN,  chords: [0, 3, 5, 4], voices: ['pad', 'horn'], loop: true, intensity: .15 },
  explore:  { tempo: 84,  root: 38, scale: PHRYGIAN, chords: [0, 0, 1, 0], voices: ['pad', 'pulse', 'clicks', 'drums', 'bass', 'metal', 'snare'], loop: true, intensity: .35 },
  combat:   { tempo: 116, root: 38, scale: PHRYGIAN, chords: [0, 1, 0, 6], voices: ['pad', 'clicks', 'drums', 'bass', 'arp', 'snare', 'brass'], loop: true, intensity: .85 },
  boss:     { tempo: 124, root: 36, scale: HIJAZ,    chords: [0, 1, 4, 1], voices: ['pad', 'horn', 'drums', 'bass', 'clicks', 'snare', 'brass', 'choir', 'metal'], loop: true, intensity: 1 },
  victory:  { tempo: 92,  root: 43, scale: AEOLIAN,  chords: [0, 5, 6, 0], voices: ['pad', 'horn', 'drums', 'brass', 'snare', 'choir'], loop: false, bars: 4, intensity: .7 },
  defeat:   { tempo: 54,  root: 35, scale: PHRYGIAN, chords: [0, 6, 5, 1], voices: ['pad', 'horn'], loop: false, bars: 4, intensity: .2 }
});

/** Which layer each voice belongs to: the calm bed, the tension pulse, the combat drive. */
const VOICE_LAYER = { pad: 'calm', horn: 'calm', choir: 'calm', arp: 'tension', clicks: 'tension', pulse: 'tension', metal: 'tension', drums: 'combat', bass: 'combat', snare: 'combat', brass: 'combat' };

/** Per-world variation: a transposition and a rhythmic accent set, so each map has its own colour. */
export const WORLD_VARIATIONS = Object.freeze({
  val_verde_jungle: { transpose: 0, accents: [0, 3, 6, 10, 12] }, gunnison_forest: { transpose: -2, accents: [0, 4, 7, 10, 14] },
  antarctic_pyramid: { transpose: -3, accents: [0, 6, 8, 11] }, la_rooftops: { transpose: 2, accents: [0, 2, 6, 9, 12, 14] },
  xenomorph_prime: { transpose: -5, accents: [0, 3, 7, 11, 13] }, romulus_station: { transpose: 1, accents: [0, 5, 8, 12] },
  charon_rogue_base: { transpose: -1, accents: [0, 3, 8, 11, 14] }, game_preserve_planet: { transpose: 3, accents: [0, 3, 6, 9, 12] },
  stargazer_facility: { transpose: -4, accents: [0, 4, 6, 10, 12] }, prey_comanche_territory: { transpose: 5, accents: [0, 6, 9, 12] },
  killer_of_killers_arena: { transpose: -6, accents: [0, 2, 5, 8, 11, 14] },
  lv223_engineer_structures: { transpose: -7, accents: [0, 5, 7, 12] },
  hadleys_hope_colony: { transpose: -2, accents: [0, 3, 7, 10, 13] }, fiorina_161_foundry: { transpose: -8, accents: [0, 4, 8, 11] }
});
const DEFAULT_VARIATION = Object.freeze({ transpose: 0, accents: [0, 3, 6, 10, 12] });

/** Layer gains for a danger level from 0 to 1: the bed always sounds, tension then combat enter. */
export function layerMix(intensity) {
  const value = Math.max(0, Math.min(1, Number(intensity) || 0));
  return { calm: 1 - value * .35, tension: Math.min(1, .25 + value * 1.5), combat: Math.max(0, Math.min(1, (value - .35) * 2)) };
}

/** Validates the author's music manifest. Unknown cues, layers and unsafe names are dropped. */
export function parseMusicManifest(input) {
  const tracks = {};
  const safe = name => typeof name === 'string' && /^[a-zA-Z0-9_-]+\.(ogg|mp3|m4a|wav|webm)$/.test(name);
  for (const [cue, entry] of Object.entries(input?.tracks ?? {})) {
    if (!Object.hasOwn(MUSIC_CUES, cue) || !entry || typeof entry !== 'object') continue;
    const item = {};
    if (safe(entry.file)) item.file = entry.file;
    const layers = Object.fromEntries(Object.entries(entry.layers ?? {}).filter(([layer, file]) => MUSIC_LAYERS.includes(layer) && safe(file)));
    if (Object.keys(layers).length) item.layers = layers;
    if (Number.isFinite(entry.loopStart) && entry.loopStart >= 0) item.loopStart = entry.loopStart;
    if (Number.isFinite(entry.loopEnd) && entry.loopEnd > (item.loopStart ?? 0)) item.loopEnd = entry.loopEnd;
    if (item.file || item.layers) tracks[cue] = item;
  }
  return { version: 1, tracks };
}

const midiHz = note => 440 * 2 ** ((note - 69) / 12);

export class MusicDirector {
  constructor(audio, { fetchImpl = globalThis.fetch?.bind(globalThis), base = '/audio/music/', storage = globalThis.localStorage } = {}) {
    this.audio = audio; this.fetch = fetchImpl; this.base = base; this.storage = storage;
    this.cue = null; this.current = null; this.intensity = 0; this.manifest = { version: 1, tracks: {} };
    this.buffers = new Map(); this.timer = null;
    this.volume = .6;
    try { const saved = Number(storage?.getItem('yautja_music_volume')); if (storage?.getItem('yautja_music_volume') !== null && Number.isFinite(saved)) this.volume = Math.max(0, Math.min(1, saved)); } catch {}
    this.manifestReady = this._loadManifest();
  }

  async _loadManifest() {
    if (!this.fetch) return this.manifest;
    try {
      const response = await this.fetch(`${this.base}manifest.json`, { cache: 'no-cache' });
      if (response.ok) this.manifest = parseMusicManifest(await response.json());
    } catch {}
    return this.manifest;
  }

  get ctx() { return this.audio?.ctx ?? null; }

  _bus() {
    if (!this.ctx || !this.audio.masterGain) return null;
    if (!this.musicBus || this.musicBus.context !== this.ctx) {
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.volume; this.musicBus.connect(this.audio.masterGain);
      const length = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0); for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.musicBus;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    try { this.storage?.setItem('yautja_music_volume', String(this.volume)); } catch {}
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(this.volume, this.ctx.currentTime, .05);
    return this.volume;
  }

  /** Selects the current world's variation; it applies from the next cue that starts. */
  setWorld(levelId) { this.variation = WORLD_VARIATIONS[levelId] ?? DEFAULT_VARIATION; return this.variation; }

  /** Crossfades to a cue. The same cue already playing is left alone. */
  play(cue, { fade = 1.6 } = {}) {
    if (!Object.hasOwn(MUSIC_CUES, cue)) return false;
    if (this.cue === cue && this.current) return true;
    this.cue = cue;
    const bus = this._bus();
    if (!bus) return false; // The cue starts at the next play() once the audio context exists.
    const previous = this.current;
    const now = this.ctx.currentTime, out = this.ctx.createGain();
    out.gain.setValueAtTime(0, now); out.gain.linearRampToValueAtTime(1, now + fade); out.connect(bus);
    const layers = Object.fromEntries(MUSIC_LAYERS.map(layer => { const gain = this.ctx.createGain(); gain.connect(out); return [layer, gain]; }));
    const base = MUSIC_CUES[cue], variation = ['explore', 'combat', 'boss'].includes(cue) ? (this.variation ?? DEFAULT_VARIATION) : DEFAULT_VARIATION;
    this.current = { cue, out, layers, sources: [], startedAt: now, nextStep: now + .05, step: 0, procedural: true, definition: { ...base, root: base.root + variation.transpose, accents: variation.accents } };
    this._applyMix(0);
    if (previous) this._release(previous, fade);
    this._startFiles(this.current);
    this._ensureTimer();
    return true;
  }

  stop({ fade = 1.2 } = {}) {
    if (this.current) this._release(this.current, fade);
    this.current = null; this.cue = null;
  }

  _release(track, fade) {
    const now = this.ctx.currentTime;
    track.released = true;
    track.out.gain.cancelScheduledValues(now); track.out.gain.setValueAtTime(track.out.gain.value, now); track.out.gain.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => { for (const source of track.sources) { try { source.stop(); } catch {} } try { track.out.disconnect(); } catch {} }, (fade + .2) * 1000);
  }

  /** Danger from 0 to 1. Tension then combat layers fade in; abrupt changes are smoothed. */
  setIntensity(value) {
    this.intensity = Math.max(0, Math.min(1, Number(value) || 0));
    this._applyMix(.8);
  }

  _applyMix(smoothing) {
    if (!this.current || !this.ctx) return;
    const base = this.current.definition.intensity, mix = layerMix(Math.max(base * .6, this.intensity));
    for (const layer of MUSIC_LAYERS) this.current.layers[layer].gain.setTargetAtTime(mix[layer], this.ctx.currentTime, Math.max(.01, smoothing));
  }

  async _buffer(file) {
    if (!this.buffers.has(file)) this.buffers.set(file, (async () => {
      const response = await this.fetch(`${this.base}${file}`);
      if (!response.ok) throw new Error(`missing ${file}`);
      return this.ctx.decodeAudioData(await response.arrayBuffer());
    })().catch(error => { this.buffers.delete(file); throw error; }));
    return this.buffers.get(file);
  }

  /** The author's file replaces the procedural cue once decoded; until then the score keeps playing. */
  async _startFiles(track) {
    await this.manifestReady;
    const entry = this.manifest.tracks[track.cue];
    if (!entry || !this.fetch || track.released) return;
    const wanted = entry.layers ? Object.entries(entry.layers) : [['calm', entry.file]];
    try {
      const buffers = await Promise.all(wanted.map(([, file]) => this._buffer(file)));
      if (track.released || this.current !== track) return;
      const at = this.ctx.currentTime + .05;
      wanted.forEach(([layer], index) => {
        const source = this.ctx.createBufferSource(); source.buffer = buffers[index];
        source.loop = track.definition.loop; if (entry.loopStart !== undefined) source.loopStart = entry.loopStart; if (entry.loopEnd !== undefined) source.loopEnd = entry.loopEnd;
        // A single full mix plays at full level whatever the danger; stems follow the layer mix.
        const target = entry.layers ? track.layers[layer] : track.out;
        source.connect(target); source.start(at); track.sources.push(source);
      });
      track.procedural = false;
    } catch { /* A missing or undecodable file leaves the procedural score in place. */ }
  }

  _ensureTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => this._schedule(), 60);
  }

  /** Lookahead scheduler: sixteenth notes are queued up to 0.25 s ahead on the audio clock. */
  _schedule() {
    const track = this.current;
    if (!track || !this.ctx) return;
    if (!track.procedural) return;
    const definition = track.definition, sixteenth = 60 / definition.tempo / 4;
    const totalSteps = definition.loop ? Infinity : (definition.bars ?? 4) * 16;
    while (track.nextStep < this.ctx.currentTime + .25 && track.step < totalSteps) {
      this._step(track, track.step, track.nextStep, sixteenth);
      track.step++; track.nextStep += sixteenth;
    }
  }

  _step(track, step, at, sixteenth) {
    const d = track.definition, bar = Math.floor(step / 16) % d.chords.length, beat = step % 16;
    const degree = d.chords[bar], note = offset => d.root + d.scale[(degree + offset) % d.scale.length] + 12 * Math.floor((degree + offset) / d.scale.length);
    const voices = new Set(d.voices), layer = voice => track.layers[VOICE_LAYER[voice]];
    if (voices.has('pad') && beat === 0) this._pad(layer('pad'), [note(0) + 12, note(2) + 12, note(4) + 12], at, sixteenth * 16);
    if (voices.has('horn') && beat === 0 && bar % 2 === 0) this._horn(layer('horn'), note(0), at, sixteenth * (d.loop ? 12 : 16));
    if (voices.has('arp') && beat % 2 === 0) this._pluck(layer('arp'), note([0, 2, 4, 7, 4, 2, 1, 2][beat / 2]) + 24, at);
    if (voices.has('clicks') && [0, 3, 6, 10, 11].includes(beat) && (step >> 4) % 2 === (beat > 8 ? 1 : 0)) this._click(layer('clicks'), at, beat === 10 ? 2600 : 1900);
    if (voices.has('pulse') && (beat === 0 || beat === 3)) this._thump(layer('pulse'), 52, at, .5);
    if (voices.has('drums') && [0, 6, 8, 11, 14].includes(beat)) this._thump(layer('drums'), beat === 0 || beat === 8 ? 72 : 96, at, beat === 0 ? 1 : .65, true);
    if (voices.has('bass') && beat % 2 === 0) this._bass(layer('bass'), note(beat === 6 || beat === 14 ? 1 : 0), at, sixteenth * 1.6);
    // Military snare: accents on the world's pattern, a short roll closing every second bar.
    if (voices.has('snare') && (d.accents.includes(beat) || (bar % 2 === 1 && beat >= 13))) this._snare(layer('snare'), at, beat >= 13 ? .55 : .9);
    // Low brass ostinato stabs on the same accents, a fifth above on the last one.
    if (voices.has('brass') && d.accents.includes(beat)) this._brass(layer('brass'), note(beat === d.accents.at(-1) ? 4 : 0), at, sixteenth * 2.2);
    if (voices.has('choir') && beat === 0 && bar % 2 === 1) this._choir(layer('choir'), [note(0) + 12, note(4) + 12], at, sixteenth * 30);
    if (voices.has('metal') && beat === 8 && (step >> 4) % 2 === 0) this._metal(layer('metal'), at);
  }

  _env(gain, at, peak, attack, release) {
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(peak, at + attack); gain.gain.exponentialRampToValueAtTime(.0001, at + attack + release);
  }

  _pad(target, notes, at, length) {
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(420, at); filter.frequency.linearRampToValueAtTime(900, at + length / 2); filter.frequency.linearRampToValueAtTime(380, at + length);
    const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.045, at + length * .35); gain.gain.linearRampToValueAtTime(0, at + length * 1.05);
    filter.connect(gain); gain.connect(target);
    for (const [index, midi] of notes.entries()) for (const detune of [-7, 7]) {
      const osc = this.ctx.createOscillator(); osc.type = index ? 'sawtooth' : 'triangle'; osc.frequency.value = midiHz(midi); osc.detune.value = detune;
      osc.connect(filter); osc.start(at); osc.stop(at + length * 1.1);
    }
  }

  _horn(target, midi, at, length) {
    const osc = this.ctx.createOscillator(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(midiHz(midi) * .985, at); osc.frequency.linearRampToValueAtTime(midiHz(midi), at + .25);
    filter.type = 'lowpass'; filter.Q.value = 4; filter.frequency.setValueAtTime(180, at); filter.frequency.linearRampToValueAtTime(1100, at + .5); filter.frequency.linearRampToValueAtTime(260, at + length);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.09, at + .4); gain.gain.linearRampToValueAtTime(0, at + length);
    osc.connect(filter); filter.connect(gain); gain.connect(target); osc.start(at); osc.stop(at + length + .1);
  }

  _pluck(target, midi, at) {
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(), filter = this.ctx.createBiquadFilter();
    osc.type = 'square'; osc.frequency.value = midiHz(midi); filter.type = 'lowpass'; filter.frequency.setValueAtTime(2400, at); filter.frequency.exponentialRampToValueAtTime(300, at + .25);
    this._env(gain, at, .028, .005, .3); osc.connect(filter); filter.connect(gain); gain.connect(target); osc.start(at); osc.stop(at + .4);
  }

  /** The hunter's clicking, as filtered noise bursts: an original motif, not a recorded sound. */
  _click(target, at, frequency) {
    for (let i = 0; i < 3; i++) {
      const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
      source.buffer = this.noise; filter.type = 'bandpass'; filter.frequency.value = frequency * (1 + i * .08); filter.Q.value = 9;
      const t = at + i * .045; this._env(gain, t, .16, .002, .03);
      source.connect(filter); filter.connect(gain); gain.connect(target); source.start(t, Math.random() * .5, .06);
    }
  }

  _thump(target, frequency, at, level, withNoise = false) {
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(frequency, at); osc.frequency.exponentialRampToValueAtTime(frequency * .45, at + .3);
    this._env(gain, at, .32 * level, .004, .45); osc.connect(gain); gain.connect(target); osc.start(at); osc.stop(at + .55);
    if (!withNoise) return;
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), noiseGain = this.ctx.createGain();
    source.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = 900; this._env(noiseGain, at, .12 * level, .002, .12);
    source.connect(filter); filter.connect(noiseGain); noiseGain.connect(target); source.start(at, Math.random() * .5, .2);
  }

  _bass(target, midi, at, length) {
    const osc = this.ctx.createOscillator(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = midiHz(midi - 12); filter.type = 'lowpass'; filter.frequency.setValueAtTime(600, at); filter.frequency.exponentialRampToValueAtTime(140, at + length);
    this._env(gain, at, .07, .01, length); osc.connect(filter); filter.connect(gain); gain.connect(target); osc.start(at); osc.stop(at + length + .05);
  }

  _snare(target, at, level) {
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
    source.buffer = this.noise; filter.type = 'highpass'; filter.frequency.value = 1800; this._env(gain, at, .14 * level, .002, .12);
    source.connect(filter); filter.connect(gain); gain.connect(target); source.start(at, Math.random() * .5, .15);
    const body = this.ctx.createOscillator(), bodyGain = this.ctx.createGain(); body.type = 'triangle'; body.frequency.setValueAtTime(220, at); body.frequency.exponentialRampToValueAtTime(140, at + .05);
    this._env(bodyGain, at, .08 * level, .002, .07); body.connect(bodyGain); bodyGain.connect(target); body.start(at); body.stop(at + .1);
  }

  _brass(target, midi, at, length) {
    const filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
    filter.type = 'lowpass'; filter.Q.value = 2; filter.frequency.setValueAtTime(300, at); filter.frequency.linearRampToValueAtTime(1400, at + .06); filter.frequency.exponentialRampToValueAtTime(400, at + length);
    this._env(gain, at, .075, .02, length); filter.connect(gain); gain.connect(target);
    for (const detune of [-9, 9]) { const osc = this.ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = midiHz(midi - 12); osc.detune.value = detune; osc.connect(filter); osc.start(at); osc.stop(at + length + .05); }
  }

  /** A wordless "ah": two formant bands over detuned saws. */
  _choir(target, notes, at, length) {
    const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.05, at + length * .3); gain.gain.linearRampToValueAtTime(0, at + length); gain.connect(target);
    for (const formant of [730, 1090]) {
      const band = this.ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = formant; band.Q.value = 6; band.connect(gain);
      for (const midi of notes) for (const detune of [-12, 0, 12]) { const osc = this.ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = midiHz(midi); osc.detune.value = detune; osc.connect(band); osc.start(at); osc.stop(at + length + .1); }
    }
  }

  /** An anvil-like metal hit: inharmonic partials ringing out. */
  _metal(target, at) {
    for (const [ratio, level] of [[1, .05], [2.76, .03], [5.4, .02], [8.93, .012]]) {
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(); osc.type = 'sine'; osc.frequency.value = 420 * ratio;
      this._env(gain, at, level, .002, 1.4 / ratio ** .3); osc.connect(gain); gain.connect(target); osc.start(at); osc.stop(at + 1.6);
    }
  }

  dispose() { this.stop({ fade: .2 }); if (this.timer) clearInterval(this.timer); this.timer = null; }
}

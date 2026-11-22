/* Ambient sound per biome (spec 003, FR-004): procedural beds of wind, rain, insects, machine hum
 * and creaks, with sparse one-shot events. A file named in public/audio/ambient/manifest.json
 * replaces the procedural bed of that biome. Original synthesis; no recorded film sound. */

/** Each level biome maps to a bed: continuous layers plus random events per minute. */
export const AMBIENT_BEDS = Object.freeze({
  jungle:   { wind: .25, rain: 0,   hum: 0,   insects: .8, events: { bird: 6, branch: 3 } },
  rain:     { wind: .35, rain: .8,  hum: 0,   insects: .2, events: { thunder: 1.5, branch: 2 } },
  snow:     { wind: .9,  rain: 0,   hum: .1,  insects: 0,  events: { creak: 2 } },
  city:     { wind: .3,  rain: .7,  hum: .35, insects: 0,  events: { siren: 1, thunder: 1 } },
  station:  { wind: 0,   rain: 0,   hum: .8,  insects: 0,  events: { creak: 4, vent: 5 } },
  hive:     { wind: .15, rain: 0,   hum: .3,  insects: .3, events: { drip: 8, hiss: 2 } },
  plains:   { wind: .5,  rain: 0,   hum: 0,   insects: .5, events: { bird: 4 } },
  arena:    { wind: .2,  rain: 0,   hum: .45, insects: 0,  events: { creak: 2, vent: 2 } },
  ship:     { wind: 0,   rain: 0,   hum: .7,  insects: 0,  events: { vent: 3, creak: 2 } }
});

const LEVEL_BIOME = {
  gunnison_forest: 'rain', xenomorph_prime: 'hive', antarctic_pyramid: 'snow', la_rooftops: 'city', val_verde_jungle: 'jungle',
  romulus_station: 'station', charon_rogue_base: 'station', game_preserve_planet: 'jungle', stargazer_facility: 'plains',
  prey_comanche_territory: 'plains', killer_of_killers_arena: 'arena', lv223_engineer_structures: 'arena'
};

export const ambientBiomeFor = levelId => LEVEL_BIOME[levelId] ?? 'plains';

export class AmbientSoundscape {
  constructor(audio, { fetchImpl = globalThis.fetch?.bind(globalThis), base = '/audio/ambient/' } = {}) {
    this.audio = audio; this.fetch = fetchImpl; this.base = base; this.biome = null; this.current = null; this.timer = null;
    this.manifest = {};
    this.manifestReady = (async () => {
      try {
        const response = await this.fetch?.(`${base}manifest.json`, { cache: 'no-cache' });
        const data = response?.ok ? await response.json() : {};
        for (const [biome, file] of Object.entries(data?.beds ?? {})) if (Object.hasOwn(AMBIENT_BEDS, biome) && /^[a-zA-Z0-9_-]+\.(ogg|mp3|m4a|wav|webm)$/.test(file)) this.manifest[biome] = file;
      } catch {}
    })();
  }

  get ctx() { return this.audio?.ctx ?? null; }

  start(biome, { fade = 2.5 } = {}) {
    if (!Object.hasOwn(AMBIENT_BEDS, biome)) biome = 'plains';
    if (this.biome === biome && this.current) return true;
    this.stop({ fade: 1 });
    this.biome = biome;
    const ctx = this.ctx;
    if (!ctx || !this.audio.masterGain) return false;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = this.noise.getChannelData(0); let brown = 0;
      for (let i = 0; i < data.length; i++) { brown = (brown + .02 * (Math.random() * 2 - 1)) / 1.02; data[i] = brown * 3.5; }
    }
    const out = ctx.createGain(); out.gain.setValueAtTime(0, ctx.currentTime); out.gain.linearRampToValueAtTime(.55, ctx.currentTime + fade); out.connect(this.audio.masterGain);
    const track = this.current = { biome, out, nodes: [] }, bed = AMBIENT_BEDS[biome];
    const loopNoise = (type, frequency, q, level, lfo = 0) => {
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = this.noise; source.loop = true; filter.type = type; filter.frequency.value = frequency; filter.Q.value = q; gain.gain.value = level;
      source.connect(filter); filter.connect(gain); gain.connect(out); source.start(ctx.currentTime, Math.random() * 1.5);
      track.nodes.push(source);
      if (lfo) { const osc = ctx.createOscillator(), depth = ctx.createGain(); osc.frequency.value = lfo; depth.gain.value = frequency * .6; osc.connect(depth); depth.connect(filter.frequency); osc.start(); track.nodes.push(osc); }
    };
    if (bed.wind) loopNoise('bandpass', 380, .7, bed.wind * .5, .07);
    if (bed.rain) { loopNoise('highpass', 2600, .4, bed.rain * .22); loopNoise('bandpass', 900, .5, bed.rain * .12); }
    if (bed.hum) for (const [frequency, level] of [[55, .05], [110, .025], [165, .012]]) {
      const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = frequency; gain.gain.value = level * bed.hum * 2;
      osc.connect(gain); gain.connect(out); osc.start(); track.nodes.push(osc);
    }
    if (bed.insects) {
      const osc = ctx.createOscillator(), am = ctx.createOscillator(), depth = ctx.createGain(), gain = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = 4300; am.frequency.value = 23; depth.gain.value = .5; gain.gain.value = .0;
      const level = ctx.createGain(); level.gain.value = bed.insects * .012;
      am.connect(depth); depth.connect(gain.gain); osc.connect(gain); gain.connect(level); level.connect(out); osc.start(); am.start(); track.nodes.push(osc, am);
    }
    this._startFile(track);
    this.timer = setInterval(() => this._events(track), 1000);
    return true;
  }

  async _startFile(track) {
    await this.manifestReady;
    const file = this.manifest[track.biome];
    if (!file || this.current !== track) return;
    try {
      const response = await this.fetch(`${this.base}${file}`);
      const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
      if (this.current !== track) return;
      for (const node of track.nodes) { try { node.stop(); } catch {} }
      track.nodes = [];
      const source = this.ctx.createBufferSource(); source.buffer = buffer; source.loop = true; source.connect(track.out); source.start(); track.nodes.push(source);
      track.file = true;
    } catch {}
  }

  _events(track) {
    if (this.current !== track || track.file || !this.ctx) return;
    for (const [kind, perMinute] of Object.entries(AMBIENT_BEDS[track.biome].events)) if (Math.random() < perMinute / 60) this._event(kind, track.out);
  }

  _event(kind, out) {
    const ctx = this.ctx, at = ctx.currentTime + .05, gain = ctx.createGain(); gain.connect(out);
    const tone = (type, from, to, length, level) => {
      const osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(from, at); osc.frequency.exponentialRampToValueAtTime(to, at + length);
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level, at + .02); gain.gain.exponentialRampToValueAtTime(.0001, at + length);
      osc.connect(gain); osc.start(at); osc.stop(at + length + .05);
    };
    const burst = (type, frequency, length, level) => {
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(); source.buffer = this.noise; filter.type = type; filter.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level, at + length * .1); gain.gain.exponentialRampToValueAtTime(.0001, at + length);
      source.connect(filter); filter.connect(gain); source.start(at, Math.random(), length + .1);
    };
    const pan = ctx.createStereoPanner?.(); if (pan) { pan.pan.value = Math.random() * 1.6 - .8; gain.disconnect(); gain.connect(pan); pan.connect(out); }
    if (kind === 'bird') tone('sine', 2200 + Math.random() * 1500, 1400, .35, .03);
    else if (kind === 'thunder') burst('lowpass', 160, 3.5, .5);
    else if (kind === 'branch') burst('bandpass', 1800, .12, .1);
    else if (kind === 'creak') tone('sawtooth', 90 + Math.random() * 60, 70, 1.4, .025);
    else if (kind === 'vent') burst('bandpass', 600, 2.2, .08);
    else if (kind === 'siren') tone('sine', 700, 520, 2.8, .012);
    else if (kind === 'drip') tone('sine', 1300 + Math.random() * 500, 600, .18, .04);
    else if (kind === 'hiss') burst('highpass', 3000, 1.4, .05);
  }

  stop({ fade = 1.5 } = {}) {
    if (this.timer) clearInterval(this.timer); this.timer = null;
    const track = this.current; this.current = null; this.biome = null;
    if (!track || !this.ctx) return;
    const now = this.ctx.currentTime; track.out.gain.cancelScheduledValues(now); track.out.gain.setValueAtTime(track.out.gain.value, now); track.out.gain.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => { for (const node of track.nodes) { try { node.stop(); } catch {} } try { track.out.disconnect(); } catch {} }, (fade + .2) * 1000);
  }
}

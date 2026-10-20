/* Web Audio API Sound Synthesizer Engine 6.0 - Transcendent Lore Audio */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterCompressor = null;
    this.bgOsc = null;
    this.thermalOsc = null;
    this.thermalGain = null;
    this.isMuted = false;
    this.lastHitmarkerTime = 0;
    this.lastFootstepTime = 0;
    this.reverbConvolver = null;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    // QA Audit #3 Fix: Master DynamicsCompressorNode to prevent digital clipping during 60+ Xenomorph Musou battles
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
    this.masterCompressor.knee.setValueAtTime(18, this.ctx.currentTime);
    this.masterCompressor.ratio.setValueAtTime(8, this.ctx.currentTime);
    this.masterCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.masterCompressor.release.setValueAtTime(0.15, this.ctx.currentTime);
    this.masterCompressor.connect(this.ctx.destination);

    // QA Audit #3 (Karim): Procedural Industrial Reverb Convolver Node
    try {
      const rate = this.ctx.sampleRate;
      const length = rate * 1.8;
      const impulse = this.ctx.createBuffer(2, length, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);
      for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / (rate * 0.45));
        left[i] = (Math.random() * 2 - 1) * decay;
        right[i] = (Math.random() * 2 - 1) * decay;
      }
      this.reverbConvolver = this.ctx.createConvolver();
      this.reverbConvolver.buffer = impulse;
      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      this.reverbConvolver.connect(this.reverbGain);
      this.reverbGain.connect(this.masterCompressor);
    } catch (e) {
      this.reverbConvolver = null;
    }
  }

  // Dynamic surface footsteps (Metal catwalk, Water basin, Rock/Ash)
  playFootstepSurface(surface = 'metal') {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastFootstepTime < 0.28) return;
    this.lastFootstepTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (surface === 'water') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180 + Math.random() * 60, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    } else if (surface === 'grid') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 + Math.random() * 80, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120 + Math.random() * 30, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.09);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
    }

    osc.connect(gain);
    gain.connect(this.getOut());
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Lucas QA Audit #4: Tactical Hunter Shadow Dash Whoosh
  playHunterShadowDash() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.26);
    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.26);
    osc.connect(gain);
    gain.connect(this.getOut());
    osc.start(now);
    osc.stop(now + 0.26);
  }

  getOut() {
    return this.masterCompressor || (this.ctx ? this.ctx.destination : null);
  }

  playDropPodImpact() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 1.2);

    gain.gain.setValueAtTime(0.9, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 1.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
  }

  playDropshipFlyby() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Twin jet turbine engine roar
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(480, now + 1.5);
    osc.frequency.linearRampToValueAtTime(120, now + 3.0);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 3.0);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 3.0);
  }

  playLaserScalpel() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(3600, now);
    osc.frequency.linearRampToValueAtTime(1800, now + 0.5);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  playWarhorn() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(95, now);
    osc1.frequency.linearRampToValueAtTime(115, now + 1.2);
    osc1.frequency.linearRampToValueAtTime(80, now + 2.5);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(142, now);
    osc2.frequency.linearRampToValueAtTime(172, now + 1.2);
    osc2.frequency.linearRampToValueAtTime(120, now + 2.5);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 2.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.5);
    osc2.stop(now + 2.5);
  }

  playShieldBlock() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playDiscWhistle() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.linearRampToValueAtTime(3200, now + 0.2);
    osc.frequency.linearRampToValueAtTime(1800, now + 0.4);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  playVoiceMimicry() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.8, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.2;
    }
    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1200;
    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(this.ctx.destination);
    whiteNoise.start(now);

    const formants = [450, 700, 350, 220];
    formants.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.18);
      osc.frequency.linearRampToValueAtTime(f * 0.85, now + idx * 0.18 + 0.15);

      gain.gain.setValueAtTime(0.3, now + idx * 0.18);
      gain.gain.linearRampToValueAtTime(0.01, now + idx * 0.18 + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.18);
      osc.stop(now + idx * 0.18 + 0.15);
    });
  }

  playFlechetteDart() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  playMedicompCauterize() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(2500 + Math.random() * 800, now + i * 0.1);
      osc.frequency.linearRampToValueAtTime(800, now + i * 0.1 + 0.25);

      gain.gain.setValueAtTime(0.25, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.01, now + i * 0.1 + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.25);
    }
  }

  playClanMarkSizzle() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3200, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.6);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  startThermalHum() {
    if (!this.ctx || this.thermalOsc) return;
    this.thermalOsc = this.ctx.createOscillator();
    this.thermalGain = this.ctx.createGain();

    this.thermalOsc.type = 'sawtooth';
    this.thermalOsc.frequency.setValueAtTime(110, this.ctx.currentTime);

    this.thermalGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    this.thermalOsc.connect(this.thermalGain);
    this.thermalGain.connect(this.ctx.destination);

    this.thermalOsc.start();
  }

  stopThermalHum() {
    if (this.thermalOsc) {
      this.thermalOsc.stop();
      this.thermalOsc = null;
      this.thermalGain = null;
    }
  }

  playVisionSwitch(modeIndex = 0) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const freqs = [600, 1200, 1800, 900];
    const freq = freqs[modeIndex % freqs.length];

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.08);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playPredatorLaughCountdown() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const tones = [380, 360, 340, 320, 300, 280, 260, 240, 220, 200, 180, 160];
    tones.forEach((freq, idx) => {
      const t = now + idx * 0.15;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.8, t + 0.1);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  playSpineRip() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 5; i++) {
      const t = now + i * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450 - i * 50, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.09);

      gain.gain.setValueAtTime(0.6, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.1);
    }
  }

  playPounceImpact() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  playYautjaClick() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(3200 + Math.random() * 800, now + i * 0.04);
      osc.frequency.exponentialRampToValueAtTime(800, now + i * 0.04 + 0.02);

      gain.gain.setValueAtTime(0.3, now + i * 0.04);
      gain.gain.linearRampToValueAtTime(0.01, now + i * 0.04 + 0.02);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.02);
    }
  }

  playYautjaRoar() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(50, now + 1.1);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 1.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.1);

    this.playYautjaClick();
  }

  playPulseRifleBurst() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(750, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.06);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  playSlash() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playPlasmaShot() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.25);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playXenoHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.4);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  playAcidSizzle() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3000, now);
    osc.frequency.linearRampToValueAtTime(1500, now + 0.3);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playSkullSnap() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  playWeaponSwap() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playMusouBlast() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 1.2);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 1.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
  }

  playAnnouncerTone() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(880, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  startBackgroundMusic() {
    if (!this.ctx || this.bgOsc) return;
    this.bgOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    this.bgOsc.type = 'triangle';
    this.bgOsc.frequency.setValueAtTime(55, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    this.bgOsc.connect(gain);
    gain.connect(this.ctx.destination);

    this.bgOsc.start();
  }

  stopBackgroundMusic() {
    if (this.bgOsc) {
      this.bgOsc.stop();
      this.bgOsc = null;
    }
  }

  playGauntletEMP() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High electrical crackle + booming electromagnetic pulse wave
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3200, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.6);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);

    // Secondary sub-bass discharge rumble
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(110, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.8);
    subGain.gain.setValueAtTime(0.8, now);
    subGain.gain.linearRampToValueAtTime(0.01, now + 0.8);
    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.8);
  }

  playMotionTrackerPing(distance = 15) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Authentic USCM M314 sonar ping: higher pitch & sharper blip as targets close in
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const normalizedDist = Math.max(0.1, Math.min(1.0, distance / 25.0));
    const freq = 1200 + (1.0 - normalizedDist) * 900; // 1200Hz to 2100Hz

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.8, now + 0.08);

    const volume = 0.25 + (1.0 - normalizedDist) * 0.25;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  playQueenTailWhip() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.4);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playQueenAcidSpit() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(850, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.35);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  playSmartDiscHum() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.linearRampToValueAtTime(2800, now + 0.25);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.5);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  playM40GrenadeBlast() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.7);

    gain.gain.setValueAtTime(0.9, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.7);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  playNetgunLaunch() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // High pneumatic hiss + metallic spread snap
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);

    gain.gain.setValueAtTime(0.75, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playNetWireTighten() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Slicing high-pitched tension scrape
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2600, now);
    osc.frequency.linearRampToValueAtTime(3800, now + 0.2);
    osc.frequency.linearRampToValueAtTime(1400, now + 0.4);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playSentryGunBurst() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    // Rapid staccato heavy caliber gunfire
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const shotTime = now + i * 0.07;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420, shotTime);
      osc.frequency.exponentialRampToValueAtTime(70, shotTime + 0.05);

      gain.gain.setValueAtTime(0.5, shotTime);
      gain.gain.linearRampToValueAtTime(0.01, shotTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(shotTime);
      osc.stop(shotTime + 0.05);
    }
  }

  playOmniPlasmaStorm() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Massive electrical crackle cascade
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(1800, now);
    osc1.frequency.exponentialRampToValueAtTime(120, now + 1.5);
    gain1.gain.setValueAtTime(0.8, now);
    gain1.gain.linearRampToValueAtTime(0.01, now + 1.5);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 1.5);

    // Deep sub-bass thunder detonator
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(85, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + 1.8);
    subGain.gain.setValueAtTime(0.95, now);
    subGain.gain.linearRampToValueAtTime(0.01, now + 1.8);
    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + 1.8);
  }

  playCombiStickThrow() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High velocity aerodynamic metallic spear whistling whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.35);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  playCombiStickImpale() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 1. Visceral flesh crunch
    const impactOsc = this.ctx.createOscillator();
    const impactGain = this.ctx.createGain();
    impactOsc.type = 'sawtooth';
    impactOsc.frequency.setValueAtTime(360, now);
    impactOsc.frequency.exponentialRampToValueAtTime(45, now + 0.25);
    impactGain.gain.setValueAtTime(0.9, now);
    impactGain.gain.linearRampToValueAtTime(0.01, now + 0.25);
    impactOsc.connect(impactGain);
    impactGain.connect(this.ctx.destination);
    impactOsc.start(now);
    impactOsc.stop(now + 0.25);

    // 2. Resonant vibrating steel blade ring
    const ringOsc = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(1450, now);
    ringOsc.frequency.exponentialRampToValueAtTime(820, now + 0.65);
    ringGain.gain.setValueAtTime(0.65, now);
    ringGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
    ringOsc.connect(ringGain);
    ringGain.connect(this.ctx.destination);
    ringOsc.start(now);
    ringOsc.stop(now + 0.65);
  }

  playTargetLockPing() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Iconic 1987 Bio-Mask Tri-Laser Lock 3-chirp staccato chime
    const freqs = [2400, 2850, 3400];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.055;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.08, t + 0.04);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.04);
    });
  }

  playPredalienRegurgitate() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Guttural visceral retch & embryonic discharge
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(180, now);
    osc1.frequency.linearRampToValueAtTime(65, now + 0.6);
    gain1.gain.setValueAtTime(0.85, now);
    gain1.gain.linearRampToValueAtTime(0.01, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Wet bubbling sound
    const bubble = this.ctx.createOscillator();
    const bubbleGain = this.ctx.createGain();
    bubble.type = 'sine';
    bubble.frequency.setValueAtTime(320, now);
    bubble.frequency.exponentialRampToValueAtTime(110, now + 0.5);
    bubbleGain.gain.setValueAtTime(0.6, now);
    bubbleGain.gain.linearRampToValueAtTime(0.01, now + 0.5);
    bubble.connect(bubbleGain);
    bubbleGain.connect(this.ctx.destination);
    bubble.start(now);
    bubble.stop(now + 0.5);
  }

  playSyntheticShortCircuit() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Electrical stutter and servo glitch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.setValueAtTime(1400, now + 0.08);
    osc.frequency.setValueAtTime(320, now + 0.16);
    osc.frequency.setValueAtTime(950, now + 0.24);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  playShurikenOpen() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Razor-sharp mechanical blade snap-open
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(3200, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playShurikenSlice() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High velocity aerodynamic razor-blade ring
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(750, now + 0.28);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  playPowerGloveSlam() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 1. Hydraulic release punch
    const hyd = this.ctx.createOscillator();
    const hydGain = this.ctx.createGain();
    hyd.type = 'square';
    hyd.frequency.setValueAtTime(880, now);
    hyd.frequency.exponentialRampToValueAtTime(120, now + 0.3);
    hydGain.gain.setValueAtTime(0.8, now);
    hydGain.gain.linearRampToValueAtTime(0.01, now + 0.3);
    hyd.connect(hydGain);
    hydGain.connect(this.ctx.destination);
    hyd.start(now);
    hyd.stop(now + 0.3);

    // 2. Earth-shattering tectonic sub-bass detonation
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(70, now);
    sub.frequency.exponentialRampToValueAtTime(18, now + 1.2);
    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.linearRampToValueAtTime(0.01, now + 1.2);
    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + 1.2);
  }

  playNapalmBarrage() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Roaring chemical blast
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 1.5);
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 1.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 1.5);
  }

  playSpineWhipCrack() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 1. Supersonic whip tip crack
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(4500, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.08);

    gain1.gain.setValueAtTime(0.85, now);
    gain1.gain.linearRampToValueAtTime(0.01, now + 0.08);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.08);

    // 2. Segmented bone vertebrae swish
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(1100, now + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(220, now + 0.25);

    gain2.gain.setValueAtTime(0.55, now + 0.02);
    gain2.gain.linearRampToValueAtTime(0.01, now + 0.25);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.02);
    osc2.stop(now + 0.25);
  }

  playBoilerDetonation() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Pressurized acid pustule bursting
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.8);

    gain.gain.setValueAtTime(0.9, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.8);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);

    // High frequency sizzle
    const sizzle = this.ctx.createOscillator();
    const sizzleGain = this.ctx.createGain();
    sizzle.type = 'square';
    sizzle.frequency.setValueAtTime(2200, now);
    sizzle.frequency.linearRampToValueAtTime(600, now + 0.7);

    sizzleGain.gain.setValueAtTime(0.5, now);
    sizzleGain.gain.linearRampToValueAtTime(0.01, now + 0.7);

    sizzle.connect(sizzleGain);
    sizzleGain.connect(this.ctx.destination);
    sizzle.start(now);
    sizzle.stop(now + 0.7);
  }

  playEmbryoHeartbeat() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Double biological thud (Lub-Dub)
    [0, 0.18].forEach(offset => {
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(65, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.14);

      gain.gain.setValueAtTime(0.95, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  }

  playCryoVentHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High pressure freezing cryo gas discharge
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3200, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 1.2);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 1.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 1.2);
  }

  playEngineerFluteHorn() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 1. Eerie primordial flute resonance (Prometheus 2012)
    const flute = this.ctx.createOscillator();
    const fluteGain = this.ctx.createGain();
    flute.type = 'sine';
    flute.frequency.setValueAtTime(587.33, now); // D5
    flute.frequency.linearRampToValueAtTime(523.25, now + 0.8); // C5
    flute.frequency.linearRampToValueAtTime(440.00, now + 1.6); // A4
    fluteGain.gain.setValueAtTime(0.5, now);
    fluteGain.gain.linearRampToValueAtTime(0.01, now + 2.2);
    flute.connect(fluteGain);
    fluteGain.connect(this.ctx.destination);
    flute.start(now);
    flute.stop(now + 2.2);

    // 2. Monolithic cosmic horn drone
    const drone = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(85, now);
    drone.frequency.exponentialRampToValueAtTime(42, now + 2.2);
    droneGain.gain.setValueAtTime(0.7, now);
    droneGain.gain.linearRampToValueAtTime(0.01, now + 2.2);
    drone.connect(droneGain);
    droneGain.connect(this.ctx.destination);
    drone.start(now);
    drone.stop(now + 2.2);
  }

  playAPCTurretBurst() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Twin 20mm autocannon bursts (4 heavy impacts)
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const shotTime = now + i * 0.08;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340, shotTime);
      osc.frequency.exponentialRampToValueAtTime(55, shotTime + 0.06);

      gain.gain.setValueAtTime(0.6, shotTime);
      gain.gain.linearRampToValueAtTime(0.01, shotTime + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(shotTime);
      osc.stop(shotTime + 0.06);
    }
  }

  playPlasmaScytheSwing() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.35);

    gain.gain.setValueAtTime(0.75, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  playFlechetteVolleyLaunch() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 3 rapid pneumatic spring twangs & whistling darts (Prey 2022 Feral Predator)
    for (let i = 0; i < 3; i++) {
      const launchTime = now + i * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 + i * 200, launchTime);
      osc.frequency.exponentialRampToValueAtTime(180, launchTime + 0.12);

      gain.gain.setValueAtTime(0.6, launchTime);
      gain.gain.linearRampToValueAtTime(0.01, launchTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(launchTime);
      osc.stop(launchTime + 0.12);
    }
  }

  playFlechetteImpale() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Heavy bone piercing thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playSentryGunBurst() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // UA 571-C iconic rapid 10mm caseless burst (Aliens 1986 canon)
    for (let i = 0; i < 5; i++) {
      const shotTime = now + i * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(450, shotTime);
      osc.frequency.exponentialRampToValueAtTime(60, shotTime + 0.04);

      gain.gain.setValueAtTime(0.45, shotTime);
      gain.gain.linearRampToValueAtTime(0.01, shotTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(shotTime);
      osc.stop(shotTime + 0.04);
    }
  }

  playSentryGunEmpty() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Metallic dry-fire solenoid click
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.03);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  playNeomorphScreech() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Feral bloodburster high-pitched shriek (Alien: Covenant 2017)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.linearRampToValueAtTime(1600, now + 0.2);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.65);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.65);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  playFalconDroneLaunch() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Biomechanical bird launch: turbine spool & metallic eagle chime (Predators 2010)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.linearRampToValueAtTime(1400, now + 0.35);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.8);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.8);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);
  }

  playFalconDiveScreech() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High velocity aerodynamic dive screech & twin micro-plasma discharge
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.4);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playBoneScytheCleave() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Colossal bone scythe cleave (Alpha Predator Kaail)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.45);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  playOffspringShriek() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // The Offspring uncanny mutant cry (Alien: Romulus 2024)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.linearRampToValueAtTime(1900, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.7);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.7);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  playRomulusSmartAimPing() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // F44AA Pulse Rifle Weyland-Yutani Auto-Aim lock chime
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1760, now + 0.05);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playCompoundBowFire() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Yautja high-tension compound bowstring snap & supersonic plasma whistle
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.22);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  playArrowPinImpact() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playHoloDecoyDeploy() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Optical hologram projection hum & frequency resonance
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.3);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  playHoloDecoyDetonate() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

    gain.gain.setValueAtTime(0.75, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  playPraetomorphHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // David's Praetomorph aggressive metallic predatory screech (Alien: Covenant)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.linearRampToValueAtTime(1400, now + 0.2);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.6);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  playAcidGlobuleHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Alien: Romulus Zero-G Acid Globule popping & sizzling
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.35);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.setValueAtTime(5, now);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  playVisorAcidBurn() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Molecular caustic sizzle eating through the Bio-Mask alloy
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'square';
    osc1.frequency.setValueAtTime(2800, now);
    osc1.frequency.linearRampToValueAtTime(1900, now + 0.8);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(450, now);
    osc2.frequency.linearRampToValueAtTime(900, now + 0.8);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.8);
    osc2.stop(now + 0.8);
  }

  playNeomorphShriek() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Alien: Covenant Neomorph blood-curdling albino throat screech
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.linearRampToValueAtTime(2600, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.55);

    gain.gain.setValueAtTime(0.75, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.55);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
  }

  playNeomorphScreech() {
    this.playNeomorphShriek();
  }

  playBillyLaugh() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Authentic 1987 Billy's sardonic recorded mimicry laugh played before detonation
    const notes = [440, 392, 440, 349, 392, 330, 293];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.18;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.linearRampToValueAtTime(freq * 0.85, t + 0.15);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  playPlasmaGlaiveSpin() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Dual-Bladed Plasma Glaive / Naginata High-Frequency Cyclone Whirl
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(420, now);
    osc1.frequency.linearRampToValueAtTime(780, now + 0.3);
    osc1.frequency.linearRampToValueAtTime(510, now + 0.6);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(840, now);
    osc2.frequency.linearRampToValueAtTime(1560, now + 0.3);
    osc2.frequency.linearRampToValueAtTime(1020, now + 0.6);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.65);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.65);
    osc2.stop(now + 0.65);
  }

  playPlasmaGlaiveStrike() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(960, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playBerserkerRoar() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Primal Yautja Ogyr Berserker War Cry stimulated by Royal Jelly
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(75, now);
    osc1.frequency.linearRampToValueAtTime(160, now + 0.5);
    osc1.frequency.linearRampToValueAtTime(60, now + 1.4);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(110, now);
    osc2.frequency.linearRampToValueAtTime(240, now + 0.5);
    osc2.frequency.linearRampToValueAtTime(90, now + 1.4);

    gain.gain.setValueAtTime(0.9, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 1.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.4);
    osc2.stop(now + 1.4);
  }

  playBerserkerHeartbeat() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Deep organic twin-pulse heartbeat thump
    [0, 0.14].forEach(offset => {
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(58, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 0.12);

      gain.gain.setValueAtTime(0.7, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  playTrophyClaim() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Ceremonial Yautja Honor Trophy Claim gong
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(165, now + 1.8);

    gain.gain.setValueAtTime(0.75, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 1.8);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.8);
  }

  playSmartDiscRicochet() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High-pitched metallic gyroscope zing & sonic redirection (Predator 2 1990)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.linearRampToValueAtTime(3200, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playCloakFlicker() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Electrical camouflage short-circuit buzzing crackle (Predator 1987)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(450, now + 0.1);
    osc.frequency.setValueAtTime(80, now + 0.18);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  playRedSwarmHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Mutated Red Xenomorph guttural feral screech (Aliens: Genocide 1991)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.linearRampToValueAtTime(1100, now + 0.2);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.6);

    gain.gain.setValueAtTime(0.75, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  playLauncherWhoosh() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Musou Aerial Launcher sharp rising blade whoosh (C2 / C5)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(1450, now + 0.25);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.28);
  }

  playC6CataclysmBoom() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // C6 Ultimate Ground Slam Earthquake Cataclysm Shockwave
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(120, now);
    osc1.frequency.exponentialRampToValueAtTime(20, now + 0.7);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(80, now);
    osc2.frequency.exponentialRampToValueAtTime(15, now + 0.9);

    gain.gain.setValueAtTime(0.95, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.9);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.9);
    osc2.stop(now + 0.9);
  }

  playMusouKOCallout() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Dynasty Warriors iconic triumphant brass fanfare chord (50/100/250/500/1000 KOs)
    const freqs = [330, 440, 554, 659];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 1.05, t + 0.4);

      gain.gain.setValueAtTime(0.6, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  playOfficerDefeatedGong() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Musou Gate Captain / Hive Officer Defeated ceremonial gong
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 1.6);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 1.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.6);
  }

  playMoraleShiftPing() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Tactical Battlefield Morale swing ping
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.2);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playDropPodImpact() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Seismic kinetic detonation of orbital insertion capsule
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.85);

    gain.gain.setValueAtTime(0.95, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.85);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.85);

    // Hydraulic decompression hiss of explosive blowout hatch
    const hissOsc = this.ctx.createOscillator();
    const hissGain = this.ctx.createGain();
    hissOsc.type = 'square';
    hissOsc.frequency.setValueAtTime(800, now + 0.15);
    hissOsc.frequency.exponentialRampToValueAtTime(120, now + 0.65);

    hissGain.gain.setValueAtTime(0.5, now + 0.15);
    hissGain.gain.linearRampToValueAtTime(0.01, now + 0.65);

    hissOsc.connect(hissGain);
    hissGain.connect(this.ctx.destination);
    hissOsc.start(now + 0.15);
    hissOsc.stop(now + 0.65);
  }

  playFlamethrowerBurn() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Pressurized burning roar of M240 Incinerator napalm stream
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.18);
    osc.frequency.linearRampToValueAtTime(70, now + 0.35);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  playHoundSnarl() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Guttural predatory snarl of Yautja hunting hound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.12);
    osc.frequency.linearRampToValueAtTime(60, now + 0.28);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  playAcidMortarWhistle() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High-pitched ballistic mortar whistle
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1350, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.65);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  playThunderClap() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Sharp lightning crack noise burst
    const crackOsc = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(800, now);
    crackOsc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

    crackGain.gain.setValueAtTime(0.8, now);
    crackGain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    crackOsc.connect(crackGain);
    crackGain.connect(this.ctx.destination);
    crackOsc.start(now);
    crackOsc.stop(now + 0.15);

    // Deep subterranean resonant thunder rumble
    const boomOsc = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(55, now + 0.05);
    boomOsc.frequency.exponentialRampToValueAtTime(22, now + 1.8);

    boomGain.gain.setValueAtTime(0.85, now + 0.05);
    boomGain.gain.linearRampToValueAtTime(0.01, now + 1.8);

    boomOsc.connect(boomGain);
    boomGain.connect(this.ctx.destination);
    boomOsc.start(now + 0.05);
    boomOsc.stop(now + 1.8);
  }

  playPyramidStoneShift() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Massive subterranean megalith stone friction grinding (AvP 2004)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(52, now);
    osc1.frequency.linearRampToValueAtTime(65, now + 1.2);
    osc1.frequency.linearRampToValueAtTime(45, now + 2.5);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(58, now);
    osc2.frequency.linearRampToValueAtTime(72, now + 1.2);
    osc2.frequency.linearRampToValueAtTime(48, now + 2.5);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 2.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.5);
    osc2.stop(now + 2.5);
  }

  playQueenTailSkewer() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High velocity aerodynamic whip snap + flesh impalement thump
    const whipOsc = this.ctx.createOscillator();
    const whipGain = this.ctx.createGain();
    whipOsc.type = 'triangle';
    whipOsc.frequency.setValueAtTime(950, now);
    whipOsc.frequency.exponentialRampToValueAtTime(140, now + 0.22);

    whipGain.gain.setValueAtTime(0.85, now);
    whipGain.gain.linearRampToValueAtTime(0.01, now + 0.22);

    whipOsc.connect(whipGain);
    whipGain.connect(this.ctx.destination);
    whipOsc.start(now);
    whipOsc.stop(now + 0.22);

    const thumpOsc = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();
    thumpOsc.type = 'sawtooth';
    thumpOsc.frequency.setValueAtTime(180, now + 0.05);
    thumpOsc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

    thumpGain.gain.setValueAtTime(0.9, now + 0.05);
    thumpGain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    thumpOsc.connect(thumpGain);
    thumpGain.connect(this.ctx.destination);
    thumpOsc.start(now + 0.05);
    thumpOsc.stop(now + 0.35);
  }

  playFeralShieldDeploy() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Metallic expansion slide + energy lock snap (Prey 2022)
    const slideOsc = this.ctx.createOscillator();
    const slideGain = this.ctx.createGain();
    slideOsc.type = 'sawtooth';
    slideOsc.frequency.setValueAtTime(320, now);
    slideOsc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);

    slideGain.gain.setValueAtTime(0.55, now);
    slideGain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    slideOsc.connect(slideGain);
    slideGain.connect(this.ctx.destination);
    slideOsc.start(now);
    slideOsc.stop(now + 0.15);

    const lockOsc = this.ctx.createOscillator();
    const lockGain = this.ctx.createGain();
    lockOsc.type = 'triangle';
    lockOsc.frequency.setValueAtTime(1600, now + 0.1);
    lockOsc.frequency.exponentialRampToValueAtTime(400, now + 0.28);

    lockGain.gain.setValueAtTime(0.7, now + 0.1);
    lockGain.gain.linearRampToValueAtTime(0.01, now + 0.28);

    lockOsc.connect(lockGain);
    lockGain.connect(this.ctx.destination);
    lockOsc.start(now + 0.1);
    lockOsc.stop(now + 0.28);
  }

  playSmartDiscRotor() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High frequency spinning gyroscopic mono-blade Doppler rotor hum (Predator 2 1990)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.linearRampToValueAtTime(1650, now + 0.1);
    osc.frequency.linearRampToValueAtTime(1300, now + 0.22);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  playSyntheticMilkySpurt() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Pressurized hydraulic coolant burst (Bishop Aliens 1986)
    const spurtOsc = this.ctx.createOscillator();
    const spurtGain = this.ctx.createGain();
    spurtOsc.type = 'sawtooth';
    spurtOsc.frequency.setValueAtTime(450, now);
    spurtOsc.frequency.exponentialRampToValueAtTime(95, now + 0.2);

    spurtGain.gain.setValueAtTime(0.45, now);
    spurtGain.gain.linearRampToValueAtTime(0.01, now + 0.2);

    spurtOsc.connect(spurtGain);
    spurtGain.connect(this.ctx.destination);
    spurtOsc.start(now);
    spurtOsc.stop(now + 0.2);
  }

  playFacehuggerLatch() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Wet organic choke screech & muscular tail tightening
    const screechOsc = this.ctx.createOscillator();
    const screechGain = this.ctx.createGain();
    screechOsc.type = 'sawtooth';
    screechOsc.frequency.setValueAtTime(1250, now);
    screechOsc.frequency.linearRampToValueAtTime(750, now + 0.25);

    screechGain.gain.setValueAtTime(0.65, now);
    screechGain.gain.linearRampToValueAtTime(0.01, now + 0.3);

    screechOsc.connect(screechGain);
    screechGain.connect(this.ctx.destination);
    screechOsc.start(now);
    screechOsc.stop(now + 0.3);

    const chokeOsc = this.ctx.createOscillator();
    const chokeGain = this.ctx.createGain();
    chokeOsc.type = 'triangle';
    chokeOsc.frequency.setValueAtTime(120, now + 0.1);
    chokeOsc.frequency.exponentialRampToValueAtTime(45, now + 0.45);

    chokeGain.gain.setValueAtTime(0.6, now + 0.1);
    chokeGain.gain.linearRampToValueAtTime(0.01, now + 0.45);

    chokeOsc.connect(chokeGain);
    chokeGain.connect(this.ctx.destination);
    chokeOsc.start(now + 0.1);
    chokeOsc.stop(now + 0.45);
  }

  playEggPetalPeel() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Organic leathery membrane peeling slurp + escaping spore hiss
    const peelOsc = this.ctx.createOscillator();
    const peelGain = this.ctx.createGain();
    peelOsc.type = 'sawtooth';
    peelOsc.frequency.setValueAtTime(320, now);
    peelOsc.frequency.linearRampToValueAtTime(140, now + 0.35);

    peelGain.gain.setValueAtTime(0.5, now);
    peelGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    peelOsc.connect(peelGain);
    peelGain.connect(this.ctx.destination);
    peelOsc.start(now);
    peelOsc.stop(now + 0.35);

    // Spore gas release
    const hissOsc = this.ctx.createOscillator();
    const hissGain = this.ctx.createGain();
    hissOsc.type = 'square';
    hissOsc.frequency.setValueAtTime(3400, now + 0.1);
    hissOsc.frequency.linearRampToValueAtTime(1800, now + 0.5);

    hissGain.gain.setValueAtTime(0.3, now + 0.1);
    hissGain.gain.linearRampToValueAtTime(0.01, now + 0.5);

    hissOsc.connect(hissGain);
    hissGain.connect(this.ctx.destination);
    hissOsc.start(now + 0.1);
    hissOsc.stop(now + 0.5);
  }

  playCryoShatter() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High crystalline glass impact crack followed by deep fracturing resonant rumble
    const crackOsc = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(4500, now);
    crackOsc.frequency.exponentialRampToValueAtTime(800, now + 0.12);

    crackGain.gain.setValueAtTime(0.9, now);
    crackGain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    crackOsc.connect(crackGain);
    crackGain.connect(this.ctx.destination);
    crackOsc.start(now);
    crackOsc.stop(now + 0.15);

    const shatterOsc = this.ctx.createOscillator();
    const shatterGain = this.ctx.createGain();
    shatterOsc.type = 'triangle';
    shatterOsc.frequency.setValueAtTime(180, now + 0.05);
    shatterOsc.frequency.exponentialRampToValueAtTime(40, now + 0.4);

    shatterGain.gain.setValueAtTime(0.7, now + 0.05);
    shatterGain.gain.linearRampToValueAtTime(0.01, now + 0.4);

    shatterOsc.connect(shatterGain);
    shatterGain.connect(this.ctx.destination);
    shatterOsc.start(now + 0.05);
    shatterOsc.stop(now + 0.4);
  }

  playPlasmaChargeUp() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Rising capacitor charge whine from 400Hz to 2800Hz
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(2900, now + 0.65);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.55);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.65);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  playSmartgunBurst() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Heavy mechanical servo whirr + double caseless 10mm explosive thump
    const servoOsc = this.ctx.createOscillator();
    const servoGain = this.ctx.createGain();
    servoOsc.type = 'sawtooth';
    servoOsc.frequency.setValueAtTime(750, now);
    servoOsc.frequency.linearRampToValueAtTime(1200, now + 0.08);

    servoGain.gain.setValueAtTime(0.25, now);
    servoGain.gain.linearRampToValueAtTime(0.01, now + 0.08);

    servoOsc.connect(servoGain);
    servoGain.connect(this.ctx.destination);
    servoOsc.start(now);
    servoOsc.stop(now + 0.08);

    const shotOsc = this.ctx.createOscillator();
    const shotGain = this.ctx.createGain();
    shotOsc.type = 'triangle';
    shotOsc.frequency.setValueAtTime(280, now + 0.02);
    shotOsc.frequency.exponentialRampToValueAtTime(60, now + 0.16);

    shotGain.gain.setValueAtTime(0.85, now + 0.02);
    shotGain.gain.linearRampToValueAtTime(0.01, now + 0.16);

    shotOsc.connect(shotGain);
    shotGain.connect(this.ctx.destination);
    shotOsc.start(now + 0.02);
    shotOsc.stop(now + 0.16);
  }

  playChestbursterScurry() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High infant shriek + skittering claws
    const shriekOsc = this.ctx.createOscillator();
    const shriekGain = this.ctx.createGain();
    shriekOsc.type = 'sawtooth';
    shriekOsc.frequency.setValueAtTime(1800, now);
    shriekOsc.frequency.linearRampToValueAtTime(2800, now + 0.15);
    shriekOsc.frequency.exponentialRampToValueAtTime(600, now + 0.3);

    shriekGain.gain.setValueAtTime(0.6, now);
    shriekGain.gain.linearRampToValueAtTime(0.01, now + 0.3);

    shriekOsc.connect(shriekGain);
    shriekGain.connect(this.ctx.destination);
    shriekOsc.start(now);
    shriekOsc.stop(now + 0.3);
  }

  playSpitterAcidMortar() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Rising wet phlegm lob sound + descending ballistic whistle
    const lobOsc = this.ctx.createOscillator();
    const lobGain = this.ctx.createGain();
    lobOsc.type = 'triangle';
    lobOsc.frequency.setValueAtTime(160, now);
    lobOsc.frequency.linearRampToValueAtTime(450, now + 0.18);

    lobGain.gain.setValueAtTime(0.7, now);
    lobGain.gain.linearRampToValueAtTime(0.01, now + 0.2);

    lobOsc.connect(lobGain);
    lobGain.connect(this.ctx.destination);
    lobOsc.start(now);
    lobOsc.stop(now + 0.2);

    const whistleOsc = this.ctx.createOscillator();
    const whistleGain = this.ctx.createGain();
    whistleOsc.type = 'sine';
    whistleOsc.frequency.setValueAtTime(950, now + 0.1);
    whistleOsc.frequency.exponentialRampToValueAtTime(350, now + 0.45);

    whistleGain.gain.setValueAtTime(0.4, now + 0.1);
    whistleGain.gain.linearRampToValueAtTime(0.01, now + 0.45);

    whistleOsc.connect(whistleGain);
    whistleGain.connect(this.ctx.destination);
    whistleOsc.start(now + 0.1);
    whistleOsc.stop(now + 0.45);
  }

  /* Chantier 7: Web Audio Synthesizers for v39.0 Expansion */

  // 1. Iaijutsu Ultrasonic Steel Slice (Predators Hanzo / Yautja Dah'dt'de ceremonial katana)
  playIaijutsuSlice() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High unsheathing scrape
    const scrapeOsc = this.ctx.createOscillator();
    const scrapeGain = this.ctx.createGain();
    scrapeOsc.type = 'sawtooth';
    scrapeOsc.frequency.setValueAtTime(3200, now);
    scrapeOsc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
    scrapeGain.gain.setValueAtTime(0.5, now);
    scrapeGain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
    scrapeOsc.connect(scrapeGain);
    scrapeGain.connect(this.ctx.destination);
    scrapeOsc.start(now);
    scrapeOsc.stop(now + 0.09);

    // Resonant singing steel blade tone
    const singOsc = this.ctx.createOscillator();
    const singGain = this.ctx.createGain();
    singOsc.type = 'sine';
    singOsc.frequency.setValueAtTime(880, now + 0.02);
    singOsc.frequency.exponentialRampToValueAtTime(440, now + 0.55);
    singGain.gain.setValueAtTime(0.65, now + 0.02);
    singGain.gain.exponentialRampToValueAtTime(0.005, now + 0.55);
    singOsc.connect(singGain);
    singGain.connect(this.ctx.destination);
    singOsc.start(now + 0.02);
    singOsc.stop(now + 0.55);
  }

  // 2. High-Pressure Geothermal Steam Geyser Vent
  playSteamVentHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const bufSize = Math.floor(this.ctx.sampleRate * 0.45);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.setValueAtTime(3.0, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  // 3. USCM Radio Chirp & Phosphorus Flare Pop
  playRadioDistressBeacon() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Squelch pop
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(1400, now);
    popOsc.frequency.exponentialRampToValueAtTime(240, now + 0.06);
    popGain.gain.setValueAtTime(0.7, now);
    popGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    popOsc.connect(popGain);
    popGain.connect(this.ctx.destination);
    popOsc.start(now);
    popOsc.stop(now + 0.06);

    // High radio beacon two-tone chirp
    [0.08, 0.16].forEach((delay, idx) => {
      const chirp = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      chirp.type = 'square';
      chirp.frequency.setValueAtTime(idx === 0 ? 1760 : 2349, now + delay);
      cGain.gain.setValueAtTime(0.25, now + delay);
      cGain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.06);
      chirp.connect(cGain);
      cGain.connect(this.ctx.destination);
      chirp.start(now + delay);
      chirp.stop(now + delay + 0.06);
    });
  }

  // 4. Yautja Anti-Gravity Field Pulsing Hum
  playAntiGravHum() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(160, now + 0.25);
    osc.frequency.linearRampToValueAtTime(80, now + 0.6);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  // 5. Molecular Acid Sizzling into Metallic Decking
  playAcidFloorHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const bufSize = Math.floor(this.ctx.sampleRate * 0.35);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (i % 8 === 0 ? 1.0 : 0.3);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3200, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  // 6. Boss Phase Shift / Enrage Cavernous Roar
  playBossPhaseRoar() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.8);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.95);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.95);
  }

  // 7. Perfect Parry Shield Clang & Kinetic Deflection (Prey 2022 / Concrete Jungle Canon)
  playParryClang() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High metal impact snap
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'square';
    snapOsc.frequency.setValueAtTime(2800, now);
    snapOsc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
    snapGain.gain.setValueAtTime(0.8, now);
    snapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    snapOsc.connect(snapGain);
    snapGain.connect(this.ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.06);

    // Resonant ringing brass/bone shield chime
    const ringOsc = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ringOsc.type = 'triangle';
    ringOsc.frequency.setValueAtTime(1320, now);
    ringOsc.frequency.exponentialRampToValueAtTime(660, now + 0.65);
    ringGain.gain.setValueAtTime(0.7, now);
    ringGain.gain.exponentialRampToValueAtTime(0.005, now + 0.65);
    ringOsc.connect(ringGain);
    ringGain.connect(this.ctx.destination);
    ringOsc.start(now);
    ringOsc.stop(now + 0.65);
  }

  // 8. High-Voltage Industrial Electrical Arc & Transformer Shockwave
  playElectricalArc() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Modulated plasma buzz
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(420, now + 0.15);
    osc.frequency.linearRampToValueAtTime(80, now + 0.4);

    gain.gain.setValueAtTime(0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);

    // High crackle noise burst
    const bufSize = Math.floor(this.ctx.sampleRate * 0.3);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (Math.random() < 0.2 ? 1.0 : 0.15);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.6, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(now);
  }

  // 9. USCM M290 Supply Cache Pneumatic Decompression
  playSupplyCacheOpen() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Pneumatic gas hiss
    const bufSize = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);

    // Heavy hydraulic latch click
    const click = this.ctx.createOscillator();
    const cGain = this.ctx.createGain();
    click.type = 'sine';
    click.frequency.setValueAtTime(320, now + 0.15);
    click.frequency.exponentialRampToValueAtTime(70, now + 0.28);
    cGain.gain.setValueAtTime(0.7, now + 0.15);
    cGain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
    click.connect(cGain);
    cGain.connect(this.ctx.destination);
    click.start(now + 0.15);
    click.stop(now + 0.28);
  }

  // 10. Heavy Hydraulic Blast Door Steel Grinding
  playHydraulicDoorGrind() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.4);
    osc.frequency.linearRampToValueAtTime(65, now + 0.8);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.85);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.85);
  }

  // 11. Seegson Working Joe Synthesizer Chime
  playWorkingJoeVoice() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    [440, 554, 659].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);
      gain.gain.setValueAtTime(0.25, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.18);
    });
  }

  // 12. Muffled Visceral Stealth Assassination (Predator 1987 / Prey 2022)
  playStealthAssassination() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Suppressed blade impale
    const bladeOsc = this.ctx.createOscillator();
    const bladeGain = this.ctx.createGain();
    bladeOsc.type = 'triangle';
    bladeOsc.frequency.setValueAtTime(320, now);
    bladeOsc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
    bladeGain.gain.setValueAtTime(0.85, now);
    bladeGain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    bladeOsc.connect(bladeGain);
    bladeGain.connect(this.ctx.destination);
    bladeOsc.start(now);
    bladeOsc.stop(now + 0.22);

    // Visceral crunch / tear
    const bufSize = Math.floor(this.ctx.sampleRate * 0.25);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.7, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(now);
  }

  // 13. Chestburster Embryo Incubation Warning EKG Beep
  playChestbursterIncubationBeep(tempo = 1.0) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.setValueAtTime(1320, now + 0.04);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // 14. Industrial Cargo Crane Cable Snap & Impact Crash
  playCargoCraneCableSnap() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Cable snap whiplash
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'sawtooth';
    snapOsc.frequency.setValueAtTime(1800, now);
    snapOsc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    snapGain.gain.setValueAtTime(0.9, now);
    snapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    snapOsc.connect(snapGain);
    snapGain.connect(this.ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.14);

    // Heavy 5-ton container ground smash
    const smashOsc = this.ctx.createOscillator();
    const smashGain = this.ctx.createGain();
    smashOsc.type = 'square';
    smashOsc.frequency.setValueAtTime(90, now + 0.08);
    smashOsc.frequency.exponentialRampToValueAtTime(25, now + 0.85);
    smashGain.gain.setValueAtTime(0.95, now + 0.08);
    smashGain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
    smashOsc.connect(smashGain);
    smashGain.connect(this.ctx.destination);
    smashOsc.start(now + 0.08);
    smashOsc.stop(now + 0.9);
  }

  // 15. Space Jockey Derelict Biomechanical Cosmic Drone
  playDerelictHum() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(55, now);
    osc1.frequency.linearRampToValueAtTime(65, now + 1.2);
    osc1.frequency.linearRampToValueAtTime(50, now + 2.4);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(110.5, now);
    osc2.frequency.linearRampToValueAtTime(112, now + 2.4);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 2.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.5);
    osc2.stop(now + 2.5);
  }

  // 16. Caustic Acid Trench Boiling & Effervescent Fume Bubble
  playAcidTrenchBubble() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    for (let b = 0; b < 3; b++) {
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(260 + Math.random() * 200, now + b * 0.08);
      bOsc.frequency.exponentialRampToValueAtTime(600 + Math.random() * 300, now + b * 0.08 + 0.06);
      bGain.gain.setValueAtTime(0.35, now + b * 0.08);
      bGain.gain.exponentialRampToValueAtTime(0.01, now + b * 0.08 + 0.07);
      bOsc.connect(bGain);
      bGain.connect(this.ctx.destination);
      bOsc.start(now + b * 0.08);
      bOsc.stop(now + b * 0.08 + 0.07);
    }
  }

  // === v42.0 PROCEDURAL AUDIO SYNTHESIZERS ===

  // 17. Emergency Atmospheric Decompression Airlock Vacuum Roar (Alien 1979 / Aliens 1986)
  playDecompressionWhoosh() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Buffer-based white noise wind generator with sweeping low-pass filter
    const bufferSize = this.ctx.sampleRate * 2.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 1.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.linearRampToValueAtTime(0.7, now + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 2.0);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 2.0);

    // Deep sub-bass vortex rumble
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(80, now);
    sub.frequency.exponentialRampToValueAtTime(25, now + 1.8);

    subGain.gain.setValueAtTime(0.65, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + 1.8);
  }

  // 18. Trax-Net Micro-Beacon Tracking Chirp (AVP 2 / Concrete Jungle)
  playTraxNetBeep() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.linearRampToValueAtTime(3200, now + 0.05);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // 19. Catwalk Structural Concrete & Steel Shear Pillar Collapse (Aliens 1986 / AvP 2004)
  playPillarCollapse() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Screeching metallic shear
    const screech = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    screech.type = 'sawtooth';
    screech.frequency.setValueAtTime(850, now);
    screech.frequency.exponentialRampToValueAtTime(110, now + 0.6);

    sGain.gain.setValueAtTime(0.75, now);
    sGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
    screech.connect(sGain);
    sGain.connect(this.ctx.destination);
    screech.start(now);
    screech.stop(now + 0.65);

    // Deep seismic impact crash
    const crash = this.ctx.createOscillator();
    const cGain = this.ctx.createGain();
    crash.type = 'triangle';
    crash.frequency.setValueAtTime(140, now + 0.1);
    crash.frequency.exponentialRampToValueAtTime(28, now + 1.2);

    cGain.gain.setValueAtTime(0.9, now + 0.1);
    cGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
    crash.connect(cGain);
    cGain.connect(this.ctx.destination);
    crash.start(now + 0.1);
    crash.stop(now + 1.2);
  }

  // 20. Plasma Glaive High-Speed Rotary Energy Whirl (Aliens: Fireteam Elite / Xenogenesis)
  playPlasmaGlaiveWhirl() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(180, now);
    osc1.frequency.linearRampToValueAtTime(360, now + 0.15);
    osc1.frequency.linearRampToValueAtTime(180, now + 0.3);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(360, now);
    osc2.frequency.linearRampToValueAtTime(720, now + 0.15);
    osc2.frequency.linearRampToValueAtTime(360, now + 0.3);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  }

  // 21. High-Pressure Steam Conduit Rupture & Scalding Spray Hiss (Alien 3 / Aliens 1986)
  playSteamJetHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3400, now);
    filter.Q.setValueAtTime(3.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.8);
  }

  /* =========================================================================
     v43.0 APEX SYNTHESIZERS (Aliens 1986 / Predator 2 / Prey / AvP Canon)
     ========================================================================= */

  // 22. Queen Ovipositor Peristaltic Contraction & Egg-Laying Squelch (Aliens 1986)
  playOvipositorPump() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.2);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.6);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.linearRampToValueAtTime(550, now + 0.2);
    filter.frequency.linearRampToValueAtTime(180, now + 0.6);

    gain.gain.setValueAtTime(0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.65);
  }

  // 23. Queen Ovipositor Rupture & Visceral Acidic Detonation (Aliens 1986)
  playOvipositorRupture() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Heavy biological explosion noise
    const bufferSize = this.ctx.sampleRate * 1.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 1.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.95, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

    // Tearing screech
    const screech = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    screech.type = 'sawtooth';
    screech.frequency.setValueAtTime(800, now);
    screech.frequency.linearRampToValueAtTime(280, now + 0.5);
    sGain.gain.setValueAtTime(0.5, now);
    sGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    screech.connect(sGain);
    sGain.connect(this.ctx.destination);
    screech.start(now);
    screech.stop(now + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 1.2);
  }

  // 24. Atmospheric Condenser Ion Storm Surge & Lightning Rod Strike (Alien 3 / Fiorina 161)
  playIonStormCharge() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Rising high-voltage ionization frequency sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(3600, now + 0.8);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.8, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 1.2);

    // Crackling thunderclap discharge
    setTimeout(() => {
      if (!this.ctx || this.isMuted) return;
      const cNow = this.ctx.currentTime;
      const tOsc = this.ctx.createOscillator();
      const tGain = this.ctx.createGain();
      tOsc.type = 'sawtooth';
      tOsc.frequency.setValueAtTime(80, cNow);
      tOsc.frequency.exponentialRampToValueAtTime(25, cNow + 0.9);
      tGain.gain.setValueAtTime(1.0, cNow);
      tGain.gain.exponentialRampToValueAtTime(0.01, cNow + 0.9);
      tOsc.connect(tGain);
      tGain.connect(this.ctx.destination);
      tOsc.start(cNow);
      tOsc.stop(cNow + 0.9);
    }, 750);
  }

  // 25. Smart-Disc Telemetric Remote Hover Whine (Predator 2 / AVP 2010)
  playSmartDiscHoverHum() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1150, now);
    osc.frequency.linearRampToValueAtTime(1600, now + 0.2);
    osc.frequency.linearRampToValueAtTime(1150, now + 0.4);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  // 26. Liquid Nitrogen Flash Freeze Deluge & Crystalline Crackle (Alien: Resurrection 1997)
  playLiquidNitrogenBlast() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.9;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2400, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

    // High crystalline tinkle
    const chime = this.ctx.createOscillator();
    const cGain = this.ctx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(4200, now);
    chime.frequency.exponentialRampToValueAtTime(1800, now + 0.4);
    cGain.gain.setValueAtTime(0.45, now);
    cGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    chime.connect(cGain);
    cGain.connect(this.ctx.destination);
    chime.start(now);
    chime.stop(now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.9);
  }

  // 27. Bio-Resin Webbing Stretch & Adhesive Tear (Aliens 1986)
  playWebbingSquish() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.25);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  /* =========================================================================
     v44.0 APEX SYNTHESIZERS (Marvel Comics Alien 2021-2024 / Aliens 1986)
     ========================================================================= */

  // 28. Marvel Alpha Xenomorph Subsonic Command Roar (Marvel Alien: Bloodlines)
  playAlphaCommandRoar() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(95, now);
    osc1.frequency.linearRampToValueAtTime(160, now + 0.3);
    osc1.frequency.exponentialRampToValueAtTime(40, now + 1.2);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(45, now);
    osc2.frequency.linearRampToValueAtTime(80, now + 0.3);
    osc2.frequency.exponentialRampToValueAtTime(28, now + 1.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.linearRampToValueAtTime(850, now + 0.3);
    filter.frequency.exponentialRampToValueAtTime(150, now + 1.2);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.25);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.25);
    osc2.stop(now + 1.25);
  }

  // 29. Mosquito / Midge Micro-Xenomorph Swarm Buzz (Marvel Alien: Icarus)
  playMicroSwarmBuzz() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.linearRampToValueAtTime(3200, now + 0.15);
    osc.frequency.linearRampToValueAtTime(1900, now + 0.35);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // 30. Sub-Zero Cryo-Xenomorph Frost Breath Exhalation (Marvel Alien: Thaw)
  playCryoFrostBreath() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.75;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(4.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.75);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.75);
  }

  // 31. Steel Team Cybernetic Xenomorph Targeting Chirp & Static (Marvel Alien: Steel Team)
  playCyberXenoStatic() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.setValueAtTime(1600, now + 0.06);
    osc.frequency.setValueAtTime(780, now + 0.12);
    osc.frequency.setValueAtTime(2200, now + 0.18);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // 32. P-5000 Caterpillar Power Loader Dual Hydraulic Clamp Crush (Aliens 1986)
  playPowerLoaderClamp() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Heavy hydraulic hiss
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.5);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);

    // Steel clamp impact clang
    setTimeout(() => {
      if (!this.ctx || this.isMuted) return;
      const cNow = this.ctx.currentTime;
      const cOsc = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      cOsc.type = 'triangle';
      cOsc.frequency.setValueAtTime(420, cNow);
      cOsc.frequency.exponentialRampToValueAtTime(80, cNow + 0.35);
      cGain.gain.setValueAtTime(0.9, cNow);
      cGain.gain.exponentialRampToValueAtTime(0.01, cNow + 0.35);
      cOsc.connect(cGain);
      cGain.connect(this.ctx.destination);
      cOsc.start(cNow);
      cOsc.stop(cNow + 0.35);
    }, 180);
  }

  // 33. Yautja Incinerator Plasma Flamer Stream (Dark Horse / Marvel Predator)
  playPlasmaFlamerStream() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.45;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(850, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.45);
  }

  // 34. Predalien Praetorian Belly Vomit Regurgitation (AVP: Requiem 2007)
  playPredalienBellyVomit() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Visceral guttural throat heave
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.85);

    oscGain.gain.setValueAtTime(0.7, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.85);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.85);

    // Pressurized acidic bile spray
    const bufferSize = this.ctx.sampleRate * 0.75;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.Q.setValueAtTime(2.5, now);

    const sprayGain = this.ctx.createGain();
    sprayGain.gain.setValueAtTime(0.01, now);
    sprayGain.gain.linearRampToValueAtTime(0.65, now + 0.15);
    sprayGain.gain.exponentialRampToValueAtTime(0.01, now + 0.75);

    noise.connect(filter);
    filter.connect(sprayGain);
    sprayGain.connect(this.ctx.destination);

    noise.start(now + 0.1);
    noise.stop(now + 0.85);
  }

  // 35. USCM M577 APC 20mm Boyars Rapid Auto-Cannon (Aliens 1986)
  playAPCAutocannon() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Heavy mechanical breach punch
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

    oscGain.gain.setValueAtTime(0.85, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);

    // High-explosive muzzle blast
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(350, now);

    const blastGain = this.ctx.createGain();
    blastGain.gain.setValueAtTime(0.7, now);
    blastGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    noise.connect(filter);
    filter.connect(blastGain);
    blastGain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.1);

    // High metallic chamber ping
    const pingOsc = this.ctx.createOscillator();
    const pingGain = this.ctx.createGain();
    pingOsc.type = 'triangle';
    pingOsc.frequency.setValueAtTime(1400, now + 0.02);
    pingOsc.frequency.exponentialRampToValueAtTime(800, now + 0.16);

    pingGain.gain.setValueAtTime(0.3, now + 0.02);
    pingGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    pingOsc.connect(pingGain);
    pingGain.connect(this.ctx.destination);
    pingOsc.start(now + 0.02);
    pingOsc.stop(now + 0.16);
  }

  // 36. Colony Reactor Meltdown Klaxon Alarm (Aliens 1986 Hadley's Hope)
  playReactorAlarm() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';

    // Two-tone rising and falling industrial emergency klaxon
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(780, now + 0.28);
    osc.frequency.setValueAtTime(780, now + 0.38);
    osc.frequency.linearRampToValueAtTime(360, now + 0.65);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.55, now + 0.05);
    gain.gain.setValueAtTime(0.55, now + 0.45);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.65);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.65);
  }

  // 37. Royal Winged Facehugger Shriek & Wing Swoop (Alien 3 / Isolation Lore)
  playRoyalFacehuggerShriek() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Piercing chitinous cry
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';

    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.linearRampToValueAtTime(3200, now + 0.18);
    osc.frequency.linearRampToValueAtTime(1400, now + 0.55);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);

    // Leathery wing membrane flutter
    const flutterOsc = this.ctx.createOscillator();
    const flutterGain = this.ctx.createGain();
    flutterOsc.type = 'sine';
    flutterOsc.frequency.setValueAtTime(28, now);

    flutterGain.gain.setValueAtTime(0.4, now);
    flutterGain.gain.linearRampToValueAtTime(0.01, now + 0.5);

    flutterOsc.connect(flutterGain);
    flutterGain.connect(this.ctx.destination);
    flutterOsc.start(now);
    flutterOsc.stop(now + 0.5);
  }

  // 38. Yautja Plasma Pistol 3-Round Ionized Burst (AVP: Requiem 2007 Wolf)
  playPlasmaPistolBurst() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.085;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1600, t);
      osc.frequency.exponentialRampToValueAtTime(260, t + 0.075);

      gain.gain.setValueAtTime(0.48, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.075);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(950, t);
      filter.Q.setValueAtTime(2.0, t);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  // 39. High-Voltage Electric Floor Grid Arc Hum & 15kV Discharge
  playElectricFloorHum() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 50Hz AC Substation Hum
    const humOsc = this.ctx.createOscillator();
    const humGain = this.ctx.createGain();
    humOsc.type = 'triangle';
    humOsc.frequency.setValueAtTime(60, now);

    humGain.gain.setValueAtTime(0.65, now);
    humGain.gain.linearRampToValueAtTime(0.01, now + 0.8);

    humOsc.connect(humGain);
    humGain.connect(this.ctx.destination);
    humOsc.start(now);
    humOsc.stop(now + 0.8);

    // 15 kV High-voltage crackling snaps
    const bufferSize = this.ctx.sampleRate * 0.7;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() > 0.82 ? (Math.random() * 2 - 1) : 0;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2800, now);

    const sparkGain = this.ctx.createGain();
    sparkGain.gain.setValueAtTime(0.5, now);
    sparkGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

    noise.connect(filter);
    filter.connect(sparkGain);
    sparkGain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.7);
  }

  // 40. Yautja Ki'cte Gauntlet Grapple (Concrete Jungle / Prey 2022)
  playGauntletGrapple() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Armored gauntlet choke lock
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);

    // Chitin crush crack
    const pingOsc = this.ctx.createOscillator();
    const pingGain = this.ctx.createGain();
    pingOsc.type = 'sawtooth';
    pingOsc.frequency.setValueAtTime(680, now + 0.04);
    pingOsc.frequency.exponentialRampToValueAtTime(120, now + 0.18);

    pingGain.gain.setValueAtTime(0.55, now + 0.04);
    pingGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    pingOsc.connect(pingGain);
    pingGain.connect(this.ctx.destination);
    pingOsc.start(now + 0.04);
    pingOsc.stop(now + 0.18);
  }

  // 41. Yautja Seismic Slam & Floor Shockwave Impact
  playHeavySlamImpact() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Sub-bass crater detonation
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(90, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.5);

    subGain.gain.setValueAtTime(0.95, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.5);

    // Concrete shattering debris noise
    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);

    const shatterGain = this.ctx.createGain();
    shatterGain.gain.setValueAtTime(0.7, now);
    shatterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    noise.connect(filter);
    filter.connect(shatterGain);
    shatterGain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.35);
  }

  // 42. USCM M56 Smartgun 1200 RPM Sustained Fire (Aliens 1986 Vasquez/Drake)
  playSmartgunSustainedFire() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High cyclic mechanical piston strike (10x28mm caseless)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.05);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);

    // Muzzle blast noise burst
    const bufferSize = this.ctx.sampleRate * 0.045;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(1.8, now);

    const blastGain = this.ctx.createGain();
    blastGain.gain.setValueAtTime(0.65, now);
    blastGain.gain.exponentialRampToValueAtTime(0.01, now + 0.045);

    noise.connect(filter);
    filter.connect(blastGain);
    blastGain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.045);
  }

  // 43. Derelict Ship Blue Laser Mist Disruption (Alien 1979 Kane's Descent)
  playLaserMistDisruption() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.linearRampToValueAtTime(3600, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.45);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(6.0, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  // 44. Weyland-Yutani Combat Synthetic Milky White Blood Spurt (Alien 1979 / Isolation)
  playSyntheticMilkSpurt() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Pressurized hydraulic glycol hiss
    const bufferSize = this.ctx.sampleRate * 0.45;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(850, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.45);

    // Synthetic servo short-circuit sizzle
    const sizzleOsc = this.ctx.createOscillator();
    const sizzleGain = this.ctx.createGain();
    sizzleOsc.type = 'sawtooth';
    sizzleOsc.frequency.setValueAtTime(480, now + 0.05);
    sizzleOsc.frequency.linearRampToValueAtTime(120, now + 0.35);

    sizzleGain.gain.setValueAtTime(0.35, now + 0.05);
    sizzleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    sizzleOsc.connect(sizzleGain);
    sizzleGain.connect(this.ctx.destination);
    sizzleOsc.start(now + 0.05);
    sizzleOsc.stop(now + 0.35);
  }

  // 45. Yautja Cyber-Hunt Bionic Exosuit Deploy & Forcefield Hum (Concrete Jungle / The Predator)
  playCyberExosuitDeploy() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High torque hydraulic servo spin up
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(540, now + 0.4);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.65);

    // Resonant electromagnetic forcefield pulse
    const shieldOsc = this.ctx.createOscillator();
    const shieldGain = this.ctx.createGain();
    shieldOsc.type = 'sine';
    shieldOsc.frequency.setValueAtTime(180, now + 0.15);
    shieldOsc.frequency.linearRampToValueAtTime(80, now + 0.7);

    shieldGain.gain.setValueAtTime(0.5, now + 0.15);
    shieldGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

    shieldOsc.connect(shieldGain);
    shieldGain.connect(this.ctx.destination);
    shieldOsc.start(now + 0.15);
    shieldOsc.stop(now + 0.7);
  }

  // 46. Yautja Neurotoxin Gas Canister Spray (Predator 2 / Hunting Grounds)
  playNeurotoxinHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.65;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.Q.setValueAtTime(3.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.55, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.65);
  }

  // 47. Colonial JP-4 Fuel Line Rupture Spray (Aliens 1986 Hadley's Hope)
  playFuelLeakSpray() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(550, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.5);
  }

  // 48. Chameleon Stalker Optical Cloak & Silent Hiss (Aliens: Rogue)
  playStalkerChameleonHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.35);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(600, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  // 49. Exosuit Jet Leap Ground Slam Shockwave
  playGroundSlamImpact() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Detonating sub-bass floor slam
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(110, now);
    subOsc.frequency.exponentialRampToValueAtTime(18, now + 0.6);

    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.6);

    // Compressed air shockwave blast
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.4);
  }

  // 50. Giant Trilobite Cephalopod Tentacle Constriction & Visceral Squeeze (Prometheus 2012)
  playTrilobiteTentacleConstrict() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Muscular deep flesh contraction (65Hz -> 145Hz -> 38Hz)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.linearRampToValueAtTime(145, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.65);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, now);
    filter.Q.setValueAtTime(4.0, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.65);

    // Wet suction release
    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const nFilter = this.ctx.createBiquadFilter();
    nFilter.type = 'lowpass';
    nFilter.frequency.setValueAtTime(650, now + 0.1);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.45, now + 0.1);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(now + 0.1);
    noise.stop(now + 0.45);
  }

  // 51. The Deacon Titan Pointed Head Snap & Decoupled Pharyngeal Jaw (Prometheus 2012)
  playDeaconJawHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Pointed skull jaw snap
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(880, now);
    snapOsc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

    snapGain.gain.setValueAtTime(0.85, now);
    snapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    snapOsc.connect(snapGain);
    snapGain.connect(this.ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.12);

    // High frequency ancient primordial hiss
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2600, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.55);

    gain.gain.setValueAtTime(0.5, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(5.0, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now + 0.05);
    osc.stop(now + 0.55);
  }

  // 52. Ancient Yautja Plasma Scythe Resonant Cleave (AvP Extinction 2003)
  playPlasmaScytheCleave() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Resonant ion plasma blade hum
    const humOsc = this.ctx.createOscillator();
    const humGain = this.ctx.createGain();
    humOsc.type = 'sawtooth';
    humOsc.frequency.setValueAtTime(140, now);
    humOsc.frequency.linearRampToValueAtTime(520, now + 0.18);
    humOsc.frequency.exponentialRampToValueAtTime(95, now + 0.45);

    humGain.gain.setValueAtTime(0.8, now);
    humGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    const humFilter = this.ctx.createBiquadFilter();
    humFilter.type = 'bandpass';
    humFilter.frequency.setValueAtTime(480, now);
    humFilter.Q.setValueAtTime(3.5, now);

    humOsc.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(this.ctx.destination);
    humOsc.start(now);
    humOsc.stop(now + 0.45);

    // High energy arc sweep crackle
    const sweepOsc = this.ctx.createOscillator();
    const sweepGain = this.ctx.createGain();
    sweepOsc.type = 'sine';
    sweepOsc.frequency.setValueAtTime(1800, now);
    sweepOsc.frequency.exponentialRampToValueAtTime(350, now + 0.35);

    sweepGain.gain.setValueAtTime(0.55, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    sweepOsc.connect(sweepGain);
    sweepGain.connect(this.ctx.destination);
    sweepOsc.start(now);
    sweepOsc.stop(now + 0.35);
  }

  // 53. USCM M41A Underbarrel 30mm HEDP Grenade Launch & Detonation (Aliens 1986 Hicks)
  playM41AGrenadeLaunch() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Distinct heavy pneumatic "thunk" (140Hz -> 32Hz)
    const thunkOsc = this.ctx.createOscillator();
    const thunkGain = this.ctx.createGain();
    thunkOsc.type = 'sine';
    thunkOsc.frequency.setValueAtTime(145, now);
    thunkOsc.frequency.exponentialRampToValueAtTime(32, now + 0.18);

    thunkGain.gain.setValueAtTime(0.9, now);
    thunkGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    thunkOsc.connect(thunkGain);
    thunkGain.connect(this.ctx.destination);
    thunkOsc.start(now);
    thunkOsc.stop(now + 0.18);

    // Whistling aerodynamic arc
    const whistleOsc = this.ctx.createOscillator();
    const whistleGain = this.ctx.createGain();
    whistleOsc.type = 'triangle';
    whistleOsc.frequency.setValueAtTime(920, now + 0.05);
    whistleOsc.frequency.exponentialRampToValueAtTime(380, now + 0.35);

    whistleGain.gain.setValueAtTime(0.35, now + 0.05);
    whistleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    whistleOsc.connect(whistleGain);
    whistleGain.connect(this.ctx.destination);
    whistleOsc.start(now + 0.05);
    whistleOsc.stop(now + 0.35);
  }

  // 54. Atmospheric Condenser Cryo-Vent Flush Valve (Alien 3 / Fiorina 161)
  playCryoVentFlush() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.65;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + 0.65);
    filter.Q.setValueAtTime(2.2, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.85, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.65);
  }

  // 55. Manta Swarmer Flying Xenomorph Supersonic Dive Screech (Kenner / Marvel 2023)
  playMantaDiveScreech() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3200, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.45);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  // 56. Engineer Black Mutagen Ceramic Urn Shatter & Sizzle (Prometheus 2012)
  playEngineerUrnDetonation() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Ceramic impact crack
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1250, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);

    // Chemical black goo bubbling & sizzling hiss
    const bufferSize = this.ctx.sampleRate * 0.55;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1850, now);
    filter.Q.setValueAtTime(4.0, now);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.6, now + 0.05);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(now + 0.05);
    noise.stop(now + 0.55);
  }

  // 57. The Deacon Primordial Spine Extraction Gong (Prometheus / Lore)
  playDeaconSpineRip() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Sub-harmonic resonant gong (78Hz fundamental)
    const fundamental = this.ctx.createOscillator();
    const fGain = this.ctx.createGain();
    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(78, now);
    fundamental.frequency.exponentialRampToValueAtTime(26, now + 1.2);

    fGain.gain.setValueAtTime(0.95, now);
    fGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

    fundamental.connect(fGain);
    fGain.connect(this.ctx.destination);
    fundamental.start(now);
    fundamental.stop(now + 1.2);

    // Visceral bone cracking layer
    const crackOsc = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(540, now);
    crackOsc.frequency.exponentialRampToValueAtTime(90, now + 0.25);

    crackGain.gain.setValueAtTime(0.7, now);
    crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    crackOsc.connect(crackGain);
    crackGain.connect(this.ctx.destination);
    crackOsc.start(now);
    crackOsc.stop(now + 0.25);
  }

  /* === v48.0 10-CHANTIER EXPANSION: 8 NEW PROCEDURAL SYNTHESIZERS (METHODS 58-65) === */

  // 58. Yautja Scout Ship Stratospheric Thermal Beam Strike (AVP 2004 / Concrete Jungle)
  playScoutShipOrbitalBeam() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Descending stratospheric ion lock-on whine (920Hz -> 62Hz)
    const lockOsc = this.ctx.createOscillator();
    const lockGain = this.ctx.createGain();
    lockOsc.type = 'sawtooth';
    lockOsc.frequency.setValueAtTime(920, now);
    lockOsc.frequency.exponentialRampToValueAtTime(62, now + 0.85);

    lockGain.gain.setValueAtTime(0.75, now);
    lockGain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

    lockOsc.connect(lockGain);
    lockGain.connect(this.ctx.destination);
    lockOsc.start(now);
    lockOsc.stop(now + 0.9);

    // Sustained deep sub-bass thermal plasma roar
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(54, now + 0.15);
    subOsc.frequency.linearRampToValueAtTime(38, now + 1.4);

    subGain.gain.setValueAtTime(0.9, now + 0.15);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 1.4);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now + 0.15);
    subOsc.stop(now + 1.4);
  }

  // 59. USCM M77 Gauss / Railgun Hypersonic Mach 7 Discharge (Aliens: Colonial Marines / Dark Horse)
  playM77GaussRailgunFire() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Magnetic capacitor discharge snap (3100Hz -> 120Hz)
    const railOsc = this.ctx.createOscillator();
    const railGain = this.ctx.createGain();
    railOsc.type = 'square';
    railOsc.frequency.setValueAtTime(3100, now);
    railOsc.frequency.exponentialRampToValueAtTime(120, now + 0.28);

    railGain.gain.setValueAtTime(0.85, now);
    railGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    railOsc.connect(railGain);
    railGain.connect(this.ctx.destination);
    railOsc.start(now);
    railOsc.stop(now + 0.3);

    // Hypersonic air-splitting boom
    const boomOsc = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boomOsc.type = 'sawtooth';
    boomOsc.frequency.setValueAtTime(220, now + 0.02);
    boomOsc.frequency.exponentialRampToValueAtTime(28, now + 0.45);

    boomGain.gain.setValueAtTime(0.9, now + 0.02);
    boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    boomOsc.connect(boomGain);
    boomGain.connect(this.ctx.destination);
    boomOsc.start(now + 0.02);
    boomOsc.stop(now + 0.45);
  }

  // 60. Fiorina 161 Molten Lead Foundry Pour & Steam Sizzle (Alien 3 1992)
  playMoltenLeadPour() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Heavy liquid metal torrent rumble (92Hz)
    const pourOsc = this.ctx.createOscillator();
    const pourGain = this.ctx.createGain();
    pourOsc.type = 'triangle';
    pourOsc.frequency.setValueAtTime(92, now);
    pourOsc.frequency.linearRampToValueAtTime(64, now + 1.1);

    pourGain.gain.setValueAtTime(0.8, now);
    pourGain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);

    pourOsc.connect(pourGain);
    pourGain.connect(this.ctx.destination);
    pourOsc.start(now);
    pourOsc.stop(now + 1.1);

    // Incandescent 1200C steam hiss
    const bufferSize = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1950, now);
    filter.Q.setValueAtTime(2.5, now);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.65, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.8);
  }

  // 61. Reprogrammed Weyland-Yutani Combat Synthetic "Bishop Protocol" Telemetry Beep (Aliens 1986)
  playAndroidAllyVoiceBeep() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const freqs = [1240, 1620, 2080];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.07);

      gain.gain.setValueAtTime(0.45, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.07 + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.06);
    });
  }

  // 62. The King Alien / Rogue Titan Abyssal Dominance Roar (Aliens: Rogue / Kenner Canon)
  playRogueKingRoar() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Abyssal guttural sub-bass roar (58Hz -> 34Hz)
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(58, now);
    bassOsc.frequency.linearRampToValueAtTime(84, now + 0.35);
    bassOsc.frequency.exponentialRampToValueAtTime(34, now + 1.1);

    bassGain.gain.setValueAtTime(0.9, now);
    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);

    bassOsc.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bassOsc.start(now);
    bassOsc.stop(now + 1.1);

    // Metallic royal screech harmonic
    const screechOsc = this.ctx.createOscillator();
    const screechGain = this.ctx.createGain();
    screechOsc.type = 'square';
    screechOsc.frequency.setValueAtTime(480, now + 0.1);
    screechOsc.frequency.linearRampToValueAtTime(920, now + 0.45);
    screechOsc.frequency.exponentialRampToValueAtTime(190, now + 0.95);

    screechGain.gain.setValueAtTime(0.55, now + 0.1);
    screechGain.gain.exponentialRampToValueAtTime(0.01, now + 0.95);

    screechOsc.connect(screechGain);
    screechGain.connect(this.ctx.destination);
    screechOsc.start(now + 0.1);
    screechOsc.stop(now + 0.95);
  }

  // 63. Yautja Legendary Bio-Mask Pneumatic Lock & Optical Calibration Click
  playBioMaskSwitchClick() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Pneumatic seal lock click
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(420, now);
    clickOsc.frequency.exponentialRampToValueAtTime(1480, now + 0.14);

    clickGain.gain.setValueAtTime(0.65, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    clickOsc.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.16);
  }

  // 64. LV-426 Pyroclastic Volcanic Ash Storm Thunder & Static Discharge
  playVolcanicAshThunder() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const rumble = this.ctx.createOscillator();
    const rGain = this.ctx.createGain();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(72, now);
    rumble.frequency.exponentialRampToValueAtTime(24, now + 1.2);

    rGain.gain.setValueAtTime(0.75, now);
    rGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

    rumble.connect(rGain);
    rGain.connect(this.ctx.destination);
    rumble.start(now);
    rumble.stop(now + 1.2);
  }

  // 65. Cinematic Bullet-Time Trophy Execution Time-Dilation Whoosh
  playExecutionBulletTimeWhoosh() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const whoosh = this.ctx.createOscillator();
    const wGain = this.ctx.createGain();
    whoosh.type = 'sine';
    whoosh.frequency.setValueAtTime(340, now);
    whoosh.frequency.exponentialRampToValueAtTime(38, now + 0.75);

    wGain.gain.setValueAtTime(0.85, now);
    wGain.gain.exponentialRampToValueAtTime(0.01, now + 0.75);

    whoosh.connect(wGain);
    wGain.connect(this.getOut());
    whoosh.start(now);
    whoosh.stop(now + 0.75);
  }

  /* ============================================================================
   * v49.0 — 8 NEW PROCEDURAL SYNTHESIZERS (METHODS 66 TO 73) + QA #3 SFX FIXES
   * ============================================================================ */

  // QA #3 Fix: Diegetic Yautja Bio-Mask Hitmarker Chime + Low-Health Medical Alert
  playDiegeticHitmarker(isCritical = false) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHitmarkerTime < 0.045) return; // Anti-spam throttle
    this.lastHitmarkerTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isCritical ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isCritical ? 1850 : 1280, now);
    osc.frequency.exponentialRampToValueAtTime(isCritical ? 620 : 480, now + 0.055);

    gain.gain.setValueAtTime(isCritical ? 0.35 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.055);

    osc.connect(gain);
    gain.connect(this.getOut());
    osc.start(now);
    osc.stop(now + 0.055);
  }

  playCriticalLowHealthBeep() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    [0, 0.14].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 0 ? 960 : 720, now + offset);

      gain.gain.setValueAtTime(0.18, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.09);

      osc.connect(gain);
      gain.connect(this.getOut());
      osc.start(now + offset);
      osc.stop(now + offset + 0.09);
    });
  }

  // 66. Yautja Heavy Gravity Maul Earthshaker Slam (Predator: Concrete Jungle / AVP)
  playMaulGravitySlam() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(165, now);
    sub.frequency.exponentialRampToValueAtTime(22, now + 0.65);

    sGain.gain.setValueAtTime(0.9, now);
    sGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    sub.connect(sGain);
    sGain.connect(this.getOut());
    sub.start(now);
    sub.stop(now + 0.65);

    const metallic = this.ctx.createOscillator();
    const mGain = this.ctx.createGain();
    metallic.type = 'square';
    metallic.frequency.setValueAtTime(520, now);
    metallic.frequency.exponentialRampToValueAtTime(95, now + 0.32);

    mGain.gain.setValueAtTime(0.45, now);
    mGain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);

    metallic.connect(mGain);
    mGain.connect(this.getOut());
    metallic.start(now);
    metallic.stop(now + 0.32);
  }

  // 67. Xenomorph Raven Obsidian Carapace Shriek & Wing Buffet (Aliens: Colonial Marines / Fireteam Elite)
  playRavenXenoShriek() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const shriek = this.ctx.createOscillator();
    const shGain = this.ctx.createGain();
    shriek.type = 'sawtooth';
    shriek.frequency.setValueAtTime(680, now);
    shriek.frequency.linearRampToValueAtTime(1520, now + 0.22);
    shriek.frequency.exponentialRampToValueAtTime(290, now + 0.72);

    shGain.gain.setValueAtTime(0.65, now);
    shGain.gain.exponentialRampToValueAtTime(0.01, now + 0.72);

    shriek.connect(shGain);
    shGain.connect(this.getOut());
    shriek.start(now);
    shriek.stop(now + 0.72);
  }

  // 68. USCM M579 "Aguilar" Guided SAM Missile Launch Whoosh (Aliens / Fireteam Elite)
  playUSCMMissileLaunch() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const rocket = this.ctx.createOscillator();
    const rGain = this.ctx.createGain();
    rocket.type = 'sawtooth';
    rocket.frequency.setValueAtTime(280, now);
    rocket.frequency.exponentialRampToValueAtTime(880, now + 0.25);
    rocket.frequency.exponentialRampToValueAtTime(190, now + 0.6);

    rGain.gain.setValueAtTime(0.55, now);
    rGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    rocket.connect(rGain);
    rGain.connect(this.getOut());
    rocket.start(now);
    rocket.stop(now + 0.6);
  }

  // 69. USM Auriga Flooded Basin 50,000V Hydro-Electric Shock Discharge (Alien: Resurrection 1997)
  playAurigaHydroElectroShock() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 4; i++) {
      const arc = this.ctx.createOscillator();
      const aGain = this.ctx.createGain();
      arc.type = 'square';
      arc.frequency.setValueAtTime(140 + i * 210, now + i * 0.08);
      arc.frequency.exponentialRampToValueAtTime(65, now + i * 0.08 + 0.25);

      aGain.gain.setValueAtTime(0.45, now + i * 0.08);
      aGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.25);

      arc.connect(aGain);
      aGain.connect(this.getOut());
      arc.start(now + i * 0.08);
      arc.stop(now + i * 0.08 + 0.25);
    }
  }

  // 70. Tracker Predator Biomechanical Sonic Trap Resonance & Implosion (Predators 2010)
  playSonicTrapImplosion() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const pulse = this.ctx.createOscillator();
    const pGain = this.ctx.createGain();
    pulse.type = 'sine';
    pulse.frequency.setValueAtTime(520, now);
    pulse.frequency.exponentialRampToValueAtTime(28, now + 0.68);

    pGain.gain.setValueAtTime(0.85, now);
    pGain.gain.exponentialRampToValueAtTime(0.01, now + 0.68);

    pulse.connect(pGain);
    pGain.connect(this.getOut());
    pulse.start(now);
    pulse.stop(now + 0.68);
  }

  // 71. Ancient Predalien Elder Sarcophagus Awakening Roar (AVP 2: Primal Hunt 2002)
  playAncientPredalienAwaken() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const growl = this.ctx.createOscillator();
    const gGain = this.ctx.createGain();
    growl.type = 'sawtooth';
    growl.frequency.setValueAtTime(115, now);
    growl.frequency.linearRampToValueAtTime(240, now + 0.35);
    growl.frequency.exponentialRampToValueAtTime(36, now + 1.15);

    gGain.gain.setValueAtTime(0.82, now);
    gGain.gain.exponentialRampToValueAtTime(0.01, now + 1.15);

    growl.connect(gGain);
    gGain.connect(this.getOut());
    growl.start(now);
    growl.stop(now + 1.15);
  }

  // 72. Seegson High-Voltage Industrial Bolt Gun Capacitor & Tungsten Spike (Alien: Isolation 2014)
  playSeegsonBoltGunFire() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Capacitor whine + heavy pneumatic tungsten punch
    const cap = this.ctx.createOscillator();
    const cGain = this.ctx.createGain();
    cap.type = 'triangle';
    cap.frequency.setValueAtTime(420, now);
    cap.frequency.exponentialRampToValueAtTime(1950, now + 0.14);
    cap.frequency.exponentialRampToValueAtTime(85, now + 0.38);

    cGain.gain.setValueAtTime(0.75, now);
    cGain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

    cap.connect(cGain);
    cGain.connect(this.getOut());
    cap.start(now);
    cap.stop(now + 0.38);
  }

  // 73. Shrine of the Ancients Sacrificial Altar Choir & Brass Gong (AVP: Extinction)
  playAncientShrineBlessing() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    [110, 164.8, 220, 329.6].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + 1.4);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.4);

      osc.connect(gain);
      gain.connect(this.getOut());
      osc.start(now);
      osc.stop(now + 1.4);
    });
  }

  /* === V50.0 PROCEDURAL SOUND SYNTHESIZERS (Chantier 8 - Methods 74 to 81) === */

  // 74. Yautja Stealth Dropship Swoop & Tactical Plasma Carpet-Bombing (AVP 2004 / Predators 2010)
  playYautjaDropshipSwoop() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Heavy anti-gravity turbine whoosh
    const turbine = this.ctx.createOscillator();
    const tGain = this.ctx.createGain();
    turbine.type = 'sawtooth';
    turbine.frequency.setValueAtTime(65, now);
    turbine.frequency.exponentialRampToValueAtTime(380, now + 0.6);
    turbine.frequency.exponentialRampToValueAtTime(45, now + 2.2);

    tGain.gain.setValueAtTime(0.01, now);
    tGain.gain.linearRampToValueAtTime(0.7, now + 0.6);
    tGain.gain.exponentialRampToValueAtTime(0.01, now + 2.2);

    turbine.connect(tGain);
    tGain.connect(this.getOut());
    turbine.start(now);
    turbine.stop(now + 2.2);

    // Carpet cluster bomblets falling & detonating
    for (let i = 0; i < 6; i++) {
      const bTime = now + 0.4 + i * 0.18;
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = 'triangle';
      bOsc.frequency.setValueAtTime(480, bTime);
      bOsc.frequency.exponentialRampToValueAtTime(35, bTime + 0.35);

      bGain.gain.setValueAtTime(0.55, bTime);
      bGain.gain.exponentialRampToValueAtTime(0.01, bTime + 0.35);

      bOsc.connect(bGain);
      bGain.connect(this.getOut());
      bOsc.start(bTime);
      bOsc.stop(bTime + 0.35);
    }
  }

  // 75. Weyland-Yutani 155mm Coastal Defense Rail-Cannon Seismic Boom (Fireteam Elite)
  playWY155mmRailCannonFire() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High-voltage capacitor charging pitch
    const coil = this.ctx.createOscillator();
    const coilGain = this.ctx.createGain();
    coil.type = 'sine';
    coil.frequency.setValueAtTime(220, now);
    coil.frequency.exponentialRampToValueAtTime(2400, now + 0.3);
    coilGain.gain.setValueAtTime(0.4, now);
    coilGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    coil.connect(coilGain);
    coilGain.connect(this.getOut());
    coil.start(now);
    coil.stop(now + 0.3);

    // Massive 155mm concussive artillery detonation
    const blastTime = now + 0.28;
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'sawtooth';
    boom.frequency.setValueAtTime(140, blastTime);
    boom.frequency.exponentialRampToValueAtTime(22, blastTime + 1.6);

    boomGain.gain.setValueAtTime(0.95, blastTime);
    boomGain.gain.exponentialRampToValueAtTime(0.01, blastTime + 1.6);

    boom.connect(boomGain);
    boomGain.connect(this.getOut());
    boom.start(blastTime);
    boom.stop(blastTime + 1.6);
  }

  // 76. Royal Facehugger Struggle & Wristblade Decapitation Counter (Alien 3 / AVP)
  playRoyalFacehuggerDecapitation() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Visceral biological hiss
    const hiss = this.ctx.createOscillator();
    const hGain = this.ctx.createGain();
    hiss.type = 'sawtooth';
    hiss.frequency.setValueAtTime(1200, now);
    hiss.frequency.linearRampToValueAtTime(350, now + 0.45);
    hGain.gain.setValueAtTime(0.65, now);
    hGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    hiss.connect(hGain);
    hGain.connect(this.getOut());
    hiss.start(now);
    hiss.stop(now + 0.45);

    // Razor blade metal severing & chitin crunch
    const blade = this.ctx.createOscillator();
    const bGain = this.ctx.createGain();
    blade.type = 'triangle';
    blade.frequency.setValueAtTime(880, now + 0.12);
    blade.frequency.exponentialRampToValueAtTime(120, now + 0.38);
    bGain.gain.setValueAtTime(0.8, now + 0.12);
    bGain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
    blade.connect(bGain);
    bGain.connect(this.getOut());
    blade.start(now + 0.12);
    blade.stop(now + 0.38);
  }

  // 77. Weyland-Yutani Cryo-Stasis Pod Shatter & Liquid Nitrogen Flush (Alien: Resurrection)
  playCryoStasisPodShatter() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Pressurized glass explosion
    const glass = this.ctx.createOscillator();
    const gGain = this.ctx.createGain();
    glass.type = 'sawtooth';
    glass.frequency.setValueAtTime(1800, now);
    glass.frequency.exponentialRampToValueAtTime(140, now + 0.28);
    gGain.gain.setValueAtTime(0.7, now);
    gGain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
    glass.connect(gGain);
    gGain.connect(this.getOut());
    glass.start(now);
    glass.stop(now + 0.28);

    // Liquid nitrogen cryo-flush hiss
    const flush = this.ctx.createOscillator();
    const fGain = this.ctx.createGain();
    flush.type = 'sine';
    flush.frequency.setValueAtTime(820, now + 0.1);
    flush.frequency.linearRampToValueAtTime(260, now + 0.9);
    fGain.gain.setValueAtTime(0.45, now + 0.1);
    fGain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
    flush.connect(fGain);
    fGain.connect(this.getOut());
    flush.start(now + 0.1);
    flush.stop(now + 0.9);
  }

  // 78. Gestating Alpha Hive Matriarch Ovipositor Dynamic Egg Laying Squish (Aliens 1986)
  playMatriarchEggLayingSquish() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const squish = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    squish.type = 'triangle';
    squish.frequency.setValueAtTime(95, now);
    squish.frequency.exponentialRampToValueAtTime(240, now + 0.18);
    squish.frequency.exponentialRampToValueAtTime(60, now + 0.42);

    sGain.gain.setValueAtTime(0.65, now);
    sGain.gain.exponentialRampToValueAtTime(0.01, now + 0.42);

    squish.connect(sGain);
    sGain.connect(this.getOut());
    squish.start(now);
    squish.stop(now + 0.42);
  }

  // 79. Dual Plasma Casters Concentrated Overcharge Beam (AVP-R Wolf Predator)
  playDualPlasmaOverchargeBeam() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Twin harmonic plasma oscillators phase-locked
    [320, 640].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 1.65, now + 1.2);
      osc.frequency.exponentialRampToValueAtTime(80, now + 2.5);

      gain.gain.setValueAtTime(0.55, now);
      gain.gain.linearRampToValueAtTime(0.85, now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);

      osc.connect(gain);
      gain.connect(this.getOut());
      osc.start(now);
      osc.stop(now + 2.5);
    });
  }

  // 80. Dynamic Chitin Carapace Surgical Dismemberment Fracture (Predator 1987 / Concrete Jungle)
  playChitinDismembermentSnap() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const snap = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(950, now);
    snap.frequency.exponentialRampToValueAtTime(75, now + 0.22);
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    snap.connect(gain);
    gain.connect(this.getOut());
    snap.start(now);
    snap.stop(now + 0.22);
  }

  // 81. Sacred Blood Ritual Chant & Mothership Orbit Extraction Fanfare (AVP 2004 / 1987)
  playClanBloodRitualChant() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Guttural Yautja throat drone & ancient bronze bell chords
    [55, 110, 164.8, 246.9, 329.6].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 1.03, now + 3.2);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.32, now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 3.2);

      osc.connect(gain);
      gain.connect(this.getOut());
      osc.start(now);
      osc.stop(now + 3.2);
    });
  }

  // 82. USCM M577 APC 20mm Boyars Heavy Autocannon Cyclic Percussion (Aliens 1986)
  playM577APCTurretFire() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Dual 20mm rotary explosive chamber punch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.getOut());
    osc.start(now);
    osc.stop(now + 0.12);

    // Muzzle blast noise crack
    const bufSize = Math.floor(this.ctx.sampleRate * 0.08);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.25));

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const nFilter = this.ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.setValueAtTime(1100, now);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.7, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.getOut());
    noise.start(now);
    noise.stop(now + 0.08);
  }

  // 83. Engineer Gravitational Resonance Staff Distortion & Singularity Blast (Prometheus / Fire & Stone)
  playEngineerGravityStaffBlast() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Sub-bass gravimetric vacuum distortion (220Hz -> 28Hz)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.95);

    gain.gain.setValueAtTime(0.95, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.95);

    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(360, now);
    f.frequency.exponentialRampToValueAtTime(60, now + 0.95);

    osc.connect(f);
    f.connect(gain);
    gain.connect(this.getOut());
    osc.start(now);
    osc.stop(now + 0.95);

    // High harmonic sonic shock
    const shock = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    shock.type = 'sawtooth';
    shock.frequency.setValueAtTime(840, now);
    shock.frequency.linearRampToValueAtTime(180, now + 0.35);
    sGain.gain.setValueAtTime(0.4, now);
    sGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    shock.connect(sGain);
    sGain.connect(this.getOut());
    shock.start(now);
    shock.stop(now + 0.35);
  }

  // 84. Primordial Mala'kak Engineer Titan Awakening Roar (Prometheus 2012)
  playEngineerAwakeningRoar() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    [92, 138].forEach((baseFreq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.4, now + 0.4);
      osc.frequency.exponentialRampToValueAtTime(45, now + 1.8);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.75 : 0.5, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(420, now);
      f.Q.setValueAtTime(3.0, now);

      osc.connect(f);
      f.connect(gain);
      gain.connect(this.getOut());
      osc.start(now);
      osc.stop(now + 1.8);
    });
  }

  // 85. Yautja Vocal Mimicry Decoy & Distorted Radio Playback (Predator 1987 "Anytime...")
  playYautjaMimicryPlayback() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 1. Radio static preamble
    const bufSize = Math.floor(this.ctx.sampleRate * 0.15);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.35;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const nFilter = this.ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.setValueAtTime(2400, now);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.35, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.getOut());
    noise.start(now);
    noise.stop(now + 0.15);

    // 2. Synthetic pitch-shifted vocal formants ("Over here... Anytime...")
    [480, 620, 390].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const startT = now + 0.08 + idx * 0.28;
      osc.frequency.setValueAtTime(freq, startT);
      osc.frequency.linearRampToValueAtTime(freq * 0.85, startT + 0.24);

      gain.gain.setValueAtTime(0.01, startT);
      gain.gain.linearRampToValueAtTime(0.45, startT + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, startT + 0.24);

      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(freq * 1.5, startT);
      f.Q.setValueAtTime(5.0, startT);

      osc.connect(f);
      f.connect(gain);
      gain.connect(this.getOut());
      osc.start(startT);
      osc.stop(startT + 0.24);
    });
  }

  // 86. Yautja Clan Weapon Forge Sacred Anvil Clang (Predator: Concrete Jungle)
  playClanForgeHammerClang() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Quad metallic ring harmonics (Dlex titanium hammer strike)
    [520, 1040, 2080, 4160].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.98, now + 1.2);

      const amp = 0.55 / (idx + 1);
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 1.2);

      osc.connect(gain);
      gain.connect(this.getOut());
      osc.start(now);
      osc.stop(now + 1.2);
    });
  }

  // 87. Serrated Gyroscopic Smart-Disc High-Speed Razor Hum (Predator 2 / AVP 2004)
  playSerratedSmartDiscBuzz() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.linearRampToValueAtTime(2200, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.85);

    // LFO for gyroscopic spinning blades
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(32, now);
    lfoGain.gain.setValueAtTime(250, now);
    lfo.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + 0.85);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.85);

    osc.connect(gain);
    gain.connect(this.getOut());
    osc.start(now);
    osc.stop(now + 0.85);
  }

  // 88. Pressurized Boiling Acid Geyser Vent Sizzle & Steam Burst (Alien 3 / AVP Extinction)
  playAcidTrenchSteamHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const bufSize = Math.floor(this.ctx.sampleRate * 0.65);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.setValueAtTime(1600, now);
    f.frequency.linearRampToValueAtTime(3400, now + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.65, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    noise.connect(f);
    f.connect(gain);
    gain.connect(this.getOut());
    noise.start(now);
    noise.stop(now + 0.65);
  }

  // 89. Engineer Biomechanical Obsidian Carapace Shatter (Prometheus)
  playEngineerBioArmorShatter() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High crystalline crack
    const snap = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(2600, now);
    snap.frequency.exponentialRampToValueAtTime(140, now + 0.3);
    sGain.gain.setValueAtTime(0.85, now);
    sGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    snap.connect(sGain);
    sGain.connect(this.getOut());
    snap.start(now);
    snap.stop(now + 0.3);

    // Sub-bass heavy armor fracture
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.55);
    subGain.gain.setValueAtTime(0.9, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

    sub.connect(subGain);
    subGain.connect(this.getOut());
    sub.start(now);
    sub.stop(now + 0.55);
  }

  // 90. Bio-Mask Multispectral Vision Mode Electronic Switch (Predator 1987 / AVP 2010)
  playBioMaskVisionCycle() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.16);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(900, now);
    f.Q.setValueAtTime(4.0, now);

    osc.connect(f);
    f.connect(gain);
    gain.connect(this.getOut());
    osc.start(now);
    osc.stop(now + 0.16);

    // Subtle calibration hum
    const hum = this.ctx.createOscillator();
    const hGain = this.ctx.createGain();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(180, now + 0.05);
    hum.frequency.linearRampToValueAtTime(320, now + 0.22);
    hGain.gain.setValueAtTime(0.01, now + 0.05);
    hGain.gain.linearRampToValueAtTime(0.3, now + 0.12);
    hGain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    hum.connect(hGain);
    hGain.connect(this.getOut());
    hum.start(now + 0.05);
    hum.stop(now + 0.22);
  }

  // 91. Rogue King Xenomorph Prime Earthquake Roar (Aliens: Rogue / Charon Project Lore)
  playRogueKingEarthquakeRoar() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Sub-bass tectonic rumble (42Hz)
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(58, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 2.2);

    subGain.gain.setValueAtTime(0.95, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 2.2);

    sub.connect(subGain);
    subGain.connect(this.getOut());
    sub.start(now);
    sub.stop(now + 2.2);

    // Guttural primordial roar (dual detuned saw)
    [84, 126].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 1.5, now + 0.6);
      osc.frequency.exponentialRampToValueAtTime(36, now + 2.0);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.8 : 0.55, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 2.0);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(340, now);
      filter.Q.setValueAtTime(2.5, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.getOut());
      osc.start(now);
      osc.stop(now + 2.0);
    });
  }

  // 92. Rogue King Battering Ram Carapace Impact (Aliens: Rogue)
  playRogueKingBatteringRam() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.35);

    gain.gain.setValueAtTime(0.95, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.getOut());
    osc.start(now);
    osc.stop(now + 0.35);

    // Debris burst noise
    const bufSize = Math.floor(this.ctx.sampleRate * 0.25);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const nFilter = this.ctx.createBiquadFilter();
    nFilter.type = 'lowpass';
    nFilter.frequency.setValueAtTime(650, now);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.85, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.getOut());
    noise.start(now);
    noise.stop(now + 0.25);
  }

  // 93. Mothership Planetary Orbital Barrage Thunder (Predator: Dark Ages / AVP 2004)
  playPlanetaryOrbitalBarrage() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    [110, 220, 440].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      osc.frequency.exponentialRampToValueAtTime(30, now + 2.5);

      gain.gain.setValueAtTime(0.7 / (idx + 1), now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 2.5);

      osc.connect(gain);
      gain.connect(this.getOut());
      osc.start(now + idx * 0.1);
      osc.stop(now + 2.5);
    });
  }

  // 94. Yautja Orbital Drop Pod Hypersonic Atmospheric Entry & Impact (Predators 2010)
  playDropPodAtmosphericEntry() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Hypersonic descent whine
    const whine = this.ctx.createOscillator();
    const wGain = this.ctx.createGain();
    whine.type = 'sawtooth';
    whine.frequency.setValueAtTime(2800, now);
    whine.frequency.exponentialRampToValueAtTime(140, now + 0.85);

    wGain.gain.setValueAtTime(0.05, now);
    wGain.gain.linearRampToValueAtTime(0.75, now + 0.7);
    wGain.gain.exponentialRampToValueAtTime(0.01, now + 0.85);

    whine.connect(wGain);
    wGain.connect(this.getOut());
    whine.start(now);
    whine.stop(now + 0.85);

    // Ground impact detonation
    const impact = this.ctx.createOscillator();
    const iGain = this.ctx.createGain();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(180, now + 0.78);
    impact.frequency.exponentialRampToValueAtTime(25, now + 1.6);
    iGain.gain.setValueAtTime(0.95, now + 0.78);
    iGain.gain.exponentialRampToValueAtTime(0.01, now + 1.6);

    impact.connect(iGain);
    iGain.connect(this.getOut());
    impact.start(now + 0.78);
    impact.stop(now + 1.6);
  }

  // 95. Heavy Dual Plasma Burner Thermal Sizzle & Carapace Melting
  playHeavyPlasmaBurnSizzle() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.linearRampToValueAtTime(1100, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.45);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    osc.connect(gain);
    gain.connect(this.getOut());
    osc.start(now);
    osc.stop(now + 0.45);
  }

  // 96. Combi-Stick Pole Vault Leap & Kinetic Spring Pop (Predator 2 / Hunting Grounds)
  playPredatorCombistickVault() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Metallic spring tension pop
    const pop = this.ctx.createOscillator();
    const pGain = this.ctx.createGain();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(240, now);
    pop.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    pop.frequency.exponentialRampToValueAtTime(120, now + 0.28);

    pGain.gain.setValueAtTime(0.75, now);
    pGain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    pop.connect(pGain);
    pGain.connect(this.getOut());
    pop.start(now);
    pop.stop(now + 0.28);
  }

  // 97. Alien Queen & Rogue King Pheromone Frenzy Screech (Aliens: Rogue)
  playAlienQueenPheromoneFrenzy() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2600, now);
    osc.frequency.linearRampToValueAtTime(3400, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.9);

    // Vibrato modulation
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(18, now);
    lfoGain.gain.setValueAtTime(250, now);
    lfo.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + 0.9);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

    osc.connect(gain);
    gain.connect(this.getOut());
    osc.start(now);
    osc.stop(now + 0.9);
  }
}






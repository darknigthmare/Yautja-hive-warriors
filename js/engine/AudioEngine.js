/* Web Audio API Sound Synthesizer Engine 6.0 - Transcendent Lore Audio */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.bgOsc = null;
    this.thermalOsc = null;
    this.thermalGain = null;
    this.isMuted = false;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
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
}

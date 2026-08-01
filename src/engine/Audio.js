// Web Audio API Sound Synthesizer Engine for OpenEra
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Gunshot Synthesis
  playGunshot(weapon = 'assault') {
    if (!this.initialized || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    
    // Noise buffer for snap/bang
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    const noiseGain = this.ctx.createGain();

    // Bass punch oscillator
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    if (weapon === 'sniper') {
      // Deep powerful boom
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(1200, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.3);

      noiseGain.gain.setValueAtTime(1.0, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

      oscGain.gain.setValueAtTime(0.9, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    } else if (weapon === 'shotgun') {
      // Heavy multi-burst
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1800, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(300, now + 0.25);

      noiseGain.gain.setValueAtTime(0.9, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.type = 'square';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

      oscGain.gain.setValueAtTime(0.7, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    } else if (weapon === 'pistol') {
      // Sharp pop
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(800, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.15);

      noiseGain.gain.setValueAtTime(0.6, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);

      oscGain.gain.setValueAtTime(0.4, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    } else {
      // Assault Rifle (Default)
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(2200, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(300, now + 0.18);

      noiseGain.gain.setValueAtTime(0.85, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);

      oscGain.gain.setValueAtTime(0.6, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    }

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.35);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Hit Marker Chime
  playHitmarker(isHeadshot = false, isKill = false) {
    if (!this.initialized || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';

    if (isKill) {
      // Victory double ping
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.setValueAtTime(1800, now + 0.08);
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    } else if (isHeadshot) {
      // High pitch headshot ping
      osc.frequency.setValueAtTime(2400, now);
      gain.gain.setValueAtTime(0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    } else {
      // Normal body hit marker
      osc.frequency.setValueAtTime(950, now);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Reload Mechanical Clicks
  playReload() {
    if (!this.initialized || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    
    // First click (mag out)
    this.playClick(now, 800, 0.05);
    // Second click (mag in)
    this.playClick(now + 0.4, 1200, 0.06);
    // Bolt rack
    this.playClick(now + 0.8, 1600, 0.08);
  }

  playClick(time, freq, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(200, time + duration);

    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  // Footsteps
  playFootstep() {
    if (!this.initialized || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Jump Whoosh
  playJump() {
    if (!this.initialized || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.18);
  }
}

export const soundEngine = new SoundEngine();

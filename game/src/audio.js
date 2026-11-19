// Sunset Bay — all sound is synthesized with WebAudio. No audio files ship
// with the game: gunshots are filtered noise, the siren is two detuned
// oscillators, the engine is a sawtooth whose pitch follows speed, and the
// music is a small synthwave loop (pad chords + bass + hats) scheduled ahead.
// The context is created on the first user gesture, per browser rules.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicOn = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    // Engine hum: a low sawtooth through a low-pass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    // Police siren: two alternating tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  setEngine(speed01, driving) {
    if (!this.ctx) return;
    const target = driving ? 0.05 + speed01 * 0.09 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, this.ctx.currentTime, 0.08);
  }

  setSiren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.2);
    if (on) {
      const t = this.ctx.currentTime;
      this.sirenOsc.frequency.cancelScheduledValues(t);
      for (let i = 0; i < 8; i++) {
        this.sirenOsc.frequency.setValueAtTime(i % 2 === 0 ? 700 : 950, t + i * 0.35);
      }
    }
  }

  blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, vol, filterFreq = 1800) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  gunshot() { this.noiseBurst(0.14, 0.5, 1400); this.blip(160, 0.08, 'square', 0.18); }
  punch() { this.noiseBurst(0.08, 0.3, 500); }
  crash() { this.noiseBurst(0.3, 0.45, 300); }
  pickup() { this.blip(660, 0.09); setTimeout(() => this.blip(990, 0.12), 70); }
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.25), i * 110));
  }
  wantedUp() { this.blip(220, 0.25, 'sawtooth', 0.2); setTimeout(() => this.blip(180, 0.3, 'sawtooth', 0.2), 160); }
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'triangle', 0.25), i * 180)); }
  doorSlam() { this.noiseBurst(0.1, 0.35, 220); }

  // Synthwave loop: Am – F – C – G pad roots with a driving bass line and
  // hats. Scheduled one 8th-note step at a time from a timer.
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const roots = [110, 87.31, 130.81, 98]; // A2 F2 C3 G2
    const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const step = this.musicStep++;
      const bar = Math.floor(step / 8) % 4;
      const t = this.ctx.currentTime;
      if (step % 8 === 0) {
        chords[bar].forEach((f) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          g.gain.setValueAtTime(0.05, t);
          g.gain.linearRampToValueAtTime(0.001, t + 1.9);
          o.connect(g); g.connect(this.musicGain);
          o.start(t); o.stop(t + 2);
        });
      }
      if (step % 2 === 0) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = roots[bar] * (step % 8 === 6 ? 1.5 : 1);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(g); g.connect(this.musicGain);
        o.start(t); o.stop(t + 0.25);
      }
      if (step % 2 === 1) this.hat(t);
    }, 230);
  }

  hat(t) {
    const len = Math.floor(this.ctx.sampleRate * 0.04);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.value = 0.06;
    s.connect(f); f.connect(g); g.connect(this.musicGain);
    s.start(t);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
  }
}

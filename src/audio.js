// All sound is synthesised with the Web Audio API — no files, works offline.
// SFX for every action + a soft ambient music loop. Browsers block audio until a
// user gesture, so call resume() from the first click.
let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let muted = false;
let lastHit = 0;
let musicTimer = null;

function ensure() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
  return ctx;
}

export function resume() {
  ensure();
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.9;
}
export function isMuted() { return muted; }

// --- tiny synth helpers ---
function tone({ freq = 440, type = 'sine', dur = 0.12, gain = 0.3, glideTo = null, attack = 0.002, dest = sfxGain }) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(dest || sfxGain);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function noiseBurst({ dur = 0.05, gain = 0.3, freq = 2000, q = 1 }) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(bp); bp.connect(g); g.connect(sfxGain);
  src.start(t);
}

// --- game SFX ---
export function ballHit(speed) {
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  if (now - lastHit < 0.012) return; // throttle bursts
  lastHit = now;
  const v = Math.min(1, speed / 30);
  tone({ freq: 520 + v * 700, type: 'sine', dur: 0.07, gain: 0.05 + v * 0.28 });
  noiseBurst({ dur: 0.03, gain: 0.04 + v * 0.18, freq: 2600, q: 0.8 });
}

export function railHit(speed) {
  if (!ctx || muted) return;
  const v = Math.min(1, speed / 30);
  tone({ freq: 150 + v * 120, type: 'triangle', dur: 0.1, gain: 0.05 + v * 0.18 });
}

export function pocket() {
  if (!ctx || muted) return;
  tone({ freq: 420, type: 'sine', dur: 0.18, gain: 0.3, glideTo: 150 });
  noiseBurst({ dur: 0.12, gain: 0.12, freq: 500, q: 0.5 });
}

export function cueStrike() {
  if (!ctx || muted) return;
  tone({ freq: 900, type: 'square', dur: 0.05, gain: 0.18, glideTo: 500 });
  noiseBurst({ dur: 0.04, gain: 0.12, freq: 3500, q: 1 });
}

export function uiClick() { if (ctx && !muted) tone({ freq: 660, type: 'triangle', dur: 0.07, gain: 0.16, glideTo: 880 }); }
export function uiHover() { if (ctx && !muted) tone({ freq: 520, type: 'sine', dur: 0.04, gain: 0.06 }); }

export function notify() {
  if (!ctx || muted) return;
  tone({ freq: 880, type: 'sine', dur: 0.14, gain: 0.22 });
  setTimeout(() => tone({ freq: 1320, type: 'sine', dur: 0.18, gain: 0.22 }), 110);
}

export function turnChime() {
  if (!ctx || muted) return;
  [523, 659, 784].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'sine', dur: 0.25, gain: 0.18 }), i * 90));
}

export function win() {
  if (!ctx || muted) return;
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.3, gain: 0.2 }), i * 120));
}
export function lose() {
  if (!ctx || muted) return;
  [440, 392, 330, 262].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'sine', dur: 0.35, gain: 0.2 }), i * 150));
}

// --- ambient music: a slow chord pad cycling through a gentle progression ---
const PROG = [
  [196.0, 246.94, 293.66], // G
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [196.0, 261.63, 311.13], // Cmaj-ish
];
let chordIdx = 0;

function playChord() {
  if (!ctx) return;
  const chord = PROG[chordIdx % PROG.length];
  chordIdx++;
  const t = ctx.currentTime;
  for (const f of chord) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    osc.type = 'sawtooth'; osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.10, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
    osc.connect(lp); lp.connect(g); g.connect(musicGain);
    osc.start(t); osc.stop(t + 4);
  }
}

export function startMusic() {
  ensure();
  if (musicTimer) return;
  musicGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2);
  playChord();
  musicTimer = setInterval(playChord, 3500);
}
export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (musicGain && ctx) musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
}

// Sound, synthesized live with Web Audio — no audio files. A chop is a
// filtered noise burst, the sizzle is looped noise through a bandpass, the
// bell is two detuned sines, the train whistle is a pair of sines sliding
// up. Nothing here is needed to play: the game is fully visual.

let ctx = null;
let muted = false;
let sizzleNodes = null;

export function setMuted(value) {
  muted = value;
  if (muted) stopSizzle();
}

export function isMuted() {
  return muted;
}

function audio() {
  if (ctx === null) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Call once on the first user gesture so later sounds are allowed. */
export function unlockAudio() {
  audio();
}

function tone(freq, dur, type, gain, when = 0, slideTo = null) {
  const ac = audio();
  if (!ac || muted) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur, filterFreq, gain) {
  const ac = audio();
  if (!ac || muted) return;
  const t0 = ac.currentTime;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
}

export function playChop() {
  noiseBurst(0.09, 1800, 0.5);
  tone(220, 0.06, 'triangle', 0.15);
}

export function playPickup() {
  tone(520, 0.08, 'sine', 0.2);
}

export function playPlace() {
  tone(340, 0.09, 'sine', 0.2);
  tone(510, 0.07, 'sine', 0.12, 0.05);
}

export function playServe() {
  tone(880, 0.12, 'sine', 0.25);
  tone(1320, 0.18, 'sine', 0.22, 0.09);
}

export function playCoin() {
  tone(1245, 0.1, 'square', 0.08);
  tone(1865, 0.16, 'square', 0.08, 0.07);
}

export function playWhistle() {
  tone(740, 0.5, 'sine', 0.16, 0, 880);
  tone(1108, 0.5, 'sine', 0.1, 0, 1318);
}

export function playMissed() {
  tone(220, 0.3, 'sawtooth', 0.12, 0, 140);
}

export function playError() {
  tone(160, 0.15, 'square', 0.1);
}

export function playTick() {
  tone(980, 0.05, 'sine', 0.12);
}

export function playReady() {
  tone(660, 0.1, 'sine', 0.2);
  tone(990, 0.14, 'sine', 0.18, 0.08);
}

/** Start the pan sizzle while any pot cooks; call every frame, it no-ops. */
export function updateSizzle(anyCooking) {
  const ac = audio();
  if (!ac || muted || !anyCooking) {
    if (!anyCooking) stopSizzle();
    return;
  }
  if (sizzleNodes) return;
  const len = ac.sampleRate;
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 4000;
  const g = ac.createGain();
  g.gain.value = 0.05;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start();
  sizzleNodes = { src, g };
}

export function stopSizzle() {
  if (!sizzleNodes) return;
  try {
    sizzleNodes.src.stop();
  } catch (_) {
    // Already stopped.
  }
  sizzleNodes = null;
}

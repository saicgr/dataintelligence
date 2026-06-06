/**
 * Generates the 6 Duolingo-style sound effects as small mono 16-bit WAV files.
 * Pure Node (no deps): run `node scripts/gen-sfx.mjs` to (re)create assets/sfx/*.wav.
 * Royalty-free — these are synthesized sine/triangle tones with simple envelopes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sfx');

const clamp = (x) => Math.max(-1, Math.min(1, x));
const wave = {
  sine: (p) => Math.sin(2 * Math.PI * p),
  tri: (p) => 2 * Math.abs(2 * (p - Math.floor(p + 0.5))) - 1,
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
};

/** Render a list of notes (sequential) into a Float array. note: {f, dur, type?, vol?, glideTo?} */
function render(notes) {
  const out = [];
  for (const n of notes) {
    const len = Math.floor(n.dur * SR);
    const type = n.type ?? 'sine';
    const vol = n.vol ?? 0.6;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const prog = i / len;
      // attack 8ms, exponential decay to the tail
      const attack = Math.min(1, t / 0.008);
      const decay = Math.pow(1 - prog, n.decay ?? 1.6);
      const env = attack * decay;
      const f = n.glideTo ? n.f + (n.glideTo - n.f) * prog : n.f;
      // phase accumulation for glides
      out.push(clamp(wave[type]((f * t)) * env * vol));
    }
  }
  return out;
}

/** Mix several note-lists so they overlap (for chords/whoosh+chime). */
function mix(...lists) {
  const len = Math.max(...lists.map((l) => l.length));
  const out = new Array(len).fill(0);
  for (const l of lists) for (let i = 0; i < l.length; i++) out[i] += l[i];
  return out.map((x) => clamp(x / Math.max(1, lists.length * 0.8)));
}

function toWav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(clamp(samples[i]) * 32767), 44 + i * 2);
  return buf;
}

const N = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, A5: 880, A4: 440, E4: 329.63 };

const SFX = {
  // bright two-note "ding" up
  correct: render([
    { f: N.E5, dur: 0.09, type: 'sine', vol: 0.55 },
    { f: N.C6, dur: 0.18, type: 'sine', vol: 0.6, decay: 2.2 },
  ]),
  // soft low descending "thunk" (not harsh)
  wrong: render([
    { f: 233.08, dur: 0.16, type: 'tri', vol: 0.5, glideTo: 174.61, decay: 2 },
  ]),
  // rising arpeggio on session complete
  complete: render([
    { f: N.C5, dur: 0.09, vol: 0.5 },
    { f: N.E5, dur: 0.09, vol: 0.52 },
    { f: N.G5, dur: 0.1, vol: 0.55 },
    { f: N.C6, dur: 0.26, vol: 0.6, decay: 2.4 },
  ]),
  // warm whoosh + chime for streak increment
  streak: mix(
    render([{ f: 300, dur: 0.22, type: 'tri', vol: 0.32, glideTo: 1200, decay: 1.2 }]),
    render([{ f: 0, dur: 0.12, vol: 0 }, { f: N.A5, dur: 0.28, type: 'sine', vol: 0.5, decay: 2.4 }]),
  ),
  // fuller fanfare on level-up
  levelup: mix(
    render([
      { f: N.C5, dur: 0.1, vol: 0.45 },
      { f: N.G5, dur: 0.1, vol: 0.48 },
      { f: N.C6, dur: 0.45, vol: 0.55, decay: 2.6 },
    ]),
    render([
      { f: N.E5, dur: 0.1, vol: 0.3 },
      { f: N.C6, dur: 0.1, vol: 0.32 },
      { f: N.E5 * 2, dur: 0.45, vol: 0.3, decay: 2.6 },
    ]),
  ),
  // very short soft tap
  tap: render([{ f: 1000, dur: 0.03, type: 'sine', vol: 0.3, decay: 3 }]),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(SFX)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, toWav(samples));
  console.log(`wrote ${file} (${(samples.length / SR).toFixed(2)}s)`);
}
console.log('done — 6 SFX written to assets/sfx/');

#!/usr/bin/env bun
/**
 * Generate the ComposeAgents soundtrack into public/sfx/.
 *
 * A real music bed in the product-launch style of ElevenLabs' videos:
 * minimal electronic, warm chords, soft deep kick, sub bass, composed and
 * synthesized from scratch with no dependencies. Everything is sine-based;
 * there are no noise sources anywhere in the signal path.
 *
 *   music.wav - 22.5 s in D minor at 96 BPM. Nine 2.5 s bars:
 *               Dm9 x2, Bbmaj7 x2, Fmaj7 x2, Cadd9 x2, Dm9 held.
 *               Per bar: a soft pad chord, a sub bass root, a quiet
 *               plucked eighth-note arpeggio, a deep kick on beats 1 and
 *               3, and a sidechain dip after each kick for groove.
 *   thump.wav - a soft sub impact for scene cuts (120 -> 45 Hz drop)
 *   blip.wav  - a clean D3 pluck; the rule counter plays it per increment
 *               at rising D-minor-pentatonic playback rates
 *   tick.wav  - a tiny soft key tick, one per typed CTA character
 *
 * Run: bun scripts/make-sfx.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(import.meta.dirname, "..", "public", "sfx");

const TWO_PI = 2 * Math.PI;

// Note frequencies (Hz).
const D2 = 73.42;
const F2 = 87.31;
const C2 = 65.41;
const BB1 = 58.27;
const D3 = 146.83;
const F3 = 174.61;
const G3 = 196;
const A3 = 220;
const BB2 = 116.54;
const C3 = 130.81;
const E3 = 164.81;
const C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;
const A4 = 440;

const BPM = 96;
// One beat is 0.625 s; one bar is 2.5 s.
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;

interface Bar {
  chord: number[];
  bass: number;
  arp: number[];
}

// The last bar holds home with no arpeggio.
const BARS: Bar[] = [
  { arp: [D4, A3, C4, E4], bass: D2, chord: [D3, F3, A3, C4, E4] },
  { arp: [D4, A3, C4, E4], bass: D2, chord: [D3, F3, A3, C4, E4] },
  { arp: [BB2 * 2, F3, A3, D4], bass: BB1, chord: [BB2, D3, F3, A3] },
  { arp: [BB2 * 2, F3, A3, D4], bass: BB1, chord: [BB2, D3, F3, A3] },
  { arp: [F3 * 2, C4, E4, A4], bass: F2, chord: [F3, A3, C4, E4] },
  { arp: [F3 * 2, C4, E4, A4], bass: F2, chord: [F3, A3, C4, E4] },
  { arp: [C4, G3, D4, E4], bass: C2, chord: [C3, E3, G3, D4] },
  { arp: [C4, G3, D4, E4], bass: C2, chord: [C3, E3, G3, D4] },
  { arp: [], bass: D2, chord: [D3, F3, A3, C4, E4] },
];

const writeWav = (
  name: string,
  samples: Float64Array,
  rate: number,
  peakTarget: number
): void => {
  let peak = 0;
  for (const s of samples) {
    peak = Math.max(peak, Math.abs(s));
  }
  const scale = (peakTarget / (peak || 1)) * 32_767;
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + samples.length * 2, 4);
  data.write("WAVE", 8);
  data.write("fmt ", 12);
  // PCM header: chunk size 16, format 1, mono, 16-bit.
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples.length * 2, 40);
  for (const [i, s] of samples.entries()) {
    data.writeInt16LE(Math.round(s * scale), 44 + i * 2);
  }
  writeFileSync(path.join(OUT_DIR, name), data);
  console.log(`${name}: ${(samples.length / rate).toFixed(1)} s`);
};

// One pad voice: detuned pair plus a soft low harmonic.
const warmVoice = (freq: number, t: number): number =>
  Math.sin(TWO_PI * freq * t) +
  Math.sin(TWO_PI * freq * 1.0018 * t) +
  0.25 * Math.sin(TWO_PI * freq * 2 * t);

const music = (rate = 22_050): Float64Array => {
  const n = Math.floor(rate * BAR * BARS.length);
  const out = new Float64Array(n);
  const eighth = BEAT / 2;

  for (const [barIndex, { chord, bass, arp }] of BARS.entries()) {
    const barStart = barIndex * BAR;
    const i0 = Math.floor(barStart * rate);
    const i1 = Math.min(n, Math.floor((barStart + BAR) * rate));
    const lastBar = barIndex === BARS.length - 1;
    for (let i = i0; i < i1; i += 1) {
      const t = i / rate - barStart;

      // Sidechain: duck after the kicks on beats 1 and 3.
      const sinceKick = t < 2 * BEAT ? t : t - 2 * BEAT;
      const duck = 1 - 0.4 * Math.exp(-sinceKick / 0.16);

      // Pad: soft attack, held across the bar, released at its end.
      const edge = lastBar
        ? Math.min(1, t / 0.09)
        : Math.min(1, t / 0.09, (BAR - t) / 0.12);
      let pad = 0;
      for (const f of chord) {
        pad += warmVoice(f, i / rate);
      }
      out[i] += pad * 0.055 * edge * duck;

      // Sub bass: root with a soft octave touch on beat 4.
      let sub = Math.sin(TWO_PI * bass * (i / rate));
      if (t > 3 * BEAT && t < 3.5 * BEAT) {
        sub += 0.4 * Math.sin(TWO_PI * bass * 2 * (i / rate));
      }
      out[i] += sub * 0.3 * edge * duck;

      // Kick: beats 1 and 3, a small sine drop, quiet and round.
      for (const kickT of [0, 2 * BEAT]) {
        const dt = t - kickT;
        if (dt >= 0 && dt < 0.22) {
          const freq = 100 * Math.exp(-dt * 22) + 42;
          out[i] += Math.sin(TWO_PI * freq * dt) * Math.exp(-dt * 17) * 0.5;
        }
      }

      // Arpeggio: quiet eighth-note plucks over the chord tones.
      if (arp.length > 0) {
        const step = Math.floor(t / eighth);
        const dt = t - step * eighth;
        if (dt < 0.24) {
          const note = arp[step % arp.length];
          const pluck =
            Math.sin(TWO_PI * note * dt) +
            0.2 * Math.sin(TWO_PI * note * 2 * dt);
          out[i] += pluck * Math.exp(-dt * 16) * 0.075 * duck;
        }
      }
    }
  }

  // Gentle tail fade baked in; the composition fades the rest.
  const fadeN = Math.floor(rate * 1.5);
  for (let i = 0; i < fadeN; i += 1) {
    out[n - 1 - i] *= i / fadeN;
  }
  for (let i = 0; i < n; i += 1) {
    out[i] = Math.tanh(out[i] * 1.1);
  }
  return out;
};

const thump = (rate = 44_100): Float64Array => {
  const n = Math.floor(rate * 0.4);
  const out = new Float64Array(n);
  let phase = 0;
  let knockPhase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    const freq = 120 * Math.exp(-t * 14) + 45;
    phase += (TWO_PI * freq) / rate;
    const body = Math.sin(phase) * Math.exp(-t * 11);
    knockPhase += (TWO_PI * 205) / rate;
    const knock = Math.sin(knockPhase) * Math.exp(-t * 55) * 0.22;
    const attack = Math.min(1, i / (rate * 0.01));
    out[i] = Math.tanh((body + knock) * 1.3) * attack;
  }
  return out;
};

const blip = (rate = 44_100): Float64Array => {
  const n = Math.floor(rate * 0.22);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    const s = Math.sin(TWO_PI * D3 * t) + 0.3 * Math.sin(TWO_PI * D3 * 2 * t);
    const env = Math.min(1, i / (rate * 0.004)) * Math.exp(-t * 22);
    out[i] = s * env;
  }
  return out;
};

const tick = (rate = 44_100): Float64Array => {
  const n = Math.floor(rate * 0.035);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    const s = Math.sin(TWO_PI * 950 * t) + 0.3 * Math.sin(TWO_PI * 1900 * t);
    const env = Math.min(1, i / (rate * 0.0015)) * Math.exp(-t * 220);
    out[i] = s * env;
  }
  return out;
};

mkdirSync(OUT_DIR, { recursive: true });
writeWav("music.wav", music(), 22_050, 0.55);
writeWav("thump.wav", thump(), 44_100, 0.6);
writeWav("blip.wav", blip(), 44_100, 0.45);
writeWav("tick.wav", tick(), 44_100, 0.25);

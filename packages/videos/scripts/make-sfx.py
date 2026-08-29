#!/usr/bin/env python3
"""Generate the ComposeAgents soundtrack into public/sfx/.

A real music bed in the product-launch style of ElevenLabs' videos —
minimal electronic, warm chords, soft deep kick, sub bass — composed and
synthesized from scratch, stdlib only (wave + math). Everything is
sine-based: no noise sources anywhere in the signal path.

  music.wav - 22.5 s in D minor at 96 BPM. Nine 2.5 s bars:
              Dm9 x2, Bbmaj7 x2, Fmaj7 x2, Cadd9 x2, Dm9 held.
              Per bar: a soft pad chord, a sub bass root, a quiet
              plucked eighth-note arpeggio, a deep kick on beats 1 and
              3, and a sidechain dip after each kick for groove.
  thump.wav - a soft sub impact for scene cuts (120 -> 45 Hz drop)
  blip.wav  - a clean D3 pluck; the rule counter plays it per increment
              at rising D-minor-pentatonic playback rates
  tick.wav  - a tiny soft key tick, one per typed CTA character
"""

import math
import os
import struct
import wave

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "sfx")

# Note frequencies (Hz).
D2, F2, A2, C2 = 73.42, 87.31, 110.0, 65.41
BB1 = 58.27
D3, F3, G3, A3, BB2, C3, E3 = 146.83, 174.61, 196.0, 220.0, 116.54, 130.81, 164.81
C4, D4, E4, A4 = 261.63, 293.66, 329.63, 440.0

BPM = 96.0
BEAT = 60.0 / BPM  # 0.625 s
BAR = 4.0 * BEAT  # 2.5 s

# (pad chord, bass root, arp notes) per bar; the last bar holds home.
BARS = [
    ([D3, F3, A3, C4, E4], D2, [D4, A3, C4, E4]),
    ([D3, F3, A3, C4, E4], D2, [D4, A3, C4, E4]),
    ([BB2, D3, F3, A3], BB1, [BB2 * 2, F3, A3, D4]),
    ([BB2, D3, F3, A3], BB1, [BB2 * 2, F3, A3, D4]),
    ([F3, A3, C4, E4], F2, [F3 * 2, C4, E4, A4]),
    ([F3, A3, C4, E4], F2, [F3 * 2, C4, E4, A4]),
    ([C3, E3, G3, D4], C2, [C4, G3, D4, E4]),
    ([C3, E3, G3, D4], C2, [C4, G3, D4, E4]),
    ([D3, F3, A3, C4, E4], D2, []),
]


def write_wav(name: str, samples: list[float], rate: int, peak_target: float) -> None:
    path = os.path.join(OUT_DIR, name)
    peak = max(abs(s) for s in samples) or 1.0
    scale = peak_target / peak * 32767
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(rate)
        f.writeframes(b"".join(struct.pack("<h", int(s * scale)) for s in samples))
    print(f"{name}: {len(samples) / rate:.1f} s")


def warm_voice(freq: float, t: float) -> float:
    """One pad voice: detuned pair plus soft low harmonics."""
    s = math.sin(2.0 * math.pi * freq * t)
    s += math.sin(2.0 * math.pi * freq * 1.0018 * t)
    s += 0.25 * math.sin(2.0 * math.pi * freq * 2.0 * t)
    return s


def music(rate: int = 22050) -> list[float]:
    n = int(rate * BAR * len(BARS))
    out = [0.0] * n
    eighth = BEAT / 2.0

    for bar_index, (chord, bass, arp) in enumerate(BARS):
        bar_start = bar_index * BAR
        i0 = int(bar_start * rate)
        i1 = min(n, int((bar_start + BAR) * rate))
        last_bar = bar_index == len(BARS) - 1
        for i in range(i0, i1):
            t = i / rate - bar_start

            # Sidechain: duck after the kicks on beats 1 and 3.
            since_kick = t if t < 2.0 * BEAT else t - 2.0 * BEAT
            duck = 1.0 - 0.4 * math.exp(-since_kick / 0.16)

            # Pad: soft attack, held across the bar, released at its end.
            edge = min(1.0, t / 0.09, (BAR - t) / 0.12) if not last_bar else min(1.0, t / 0.09)
            pad = sum(warm_voice(f, i / rate) for f in chord)
            out[i] += pad * 0.055 * edge * duck

            # Sub bass: root with a soft octave touch on beat 4.
            sub = math.sin(2.0 * math.pi * bass * (i / rate))
            if 3.0 * BEAT < t < 3.5 * BEAT:
                sub += 0.4 * math.sin(2.0 * math.pi * bass * 2.0 * (i / rate))
            out[i] += sub * 0.3 * edge * duck

            # Kick: beats 1 and 3, a small sine drop, quiet and round.
            for kick_t in (0.0, 2.0 * BEAT):
                dt = t - kick_t
                if 0.0 <= dt < 0.22:
                    freq = 100.0 * math.exp(-dt * 22.0) + 42.0
                    out[i] += math.sin(2.0 * math.pi * freq * dt) * math.exp(-dt * 17.0) * 0.5

            # Arpeggio: quiet eighth-note plucks over the chord tones.
            if arp:
                step = int(t / eighth)
                dt = t - step * eighth
                if dt < 0.24:
                    note = arp[step % len(arp)]
                    pluck = math.sin(2.0 * math.pi * note * dt)
                    pluck += 0.2 * math.sin(2.0 * math.pi * note * 2.0 * dt)
                    out[i] += pluck * math.exp(-dt * 16.0) * 0.075 * duck

    # Gentle tail fade baked in; the composition fades the rest.
    fade_n = int(rate * 1.5)
    for i in range(fade_n):
        out[n - 1 - i] *= i / fade_n
    return [math.tanh(s * 1.1) for s in out]


def thump(rate: int = 44100) -> list[float]:
    duration = 0.4
    n = int(rate * duration)
    samples = []
    phase = 0.0
    knock_phase = 0.0
    for i in range(n):
        t = i / rate
        freq = 120.0 * math.exp(-t * 14.0) + 45.0
        phase += 2.0 * math.pi * freq / rate
        body = math.sin(phase) * math.exp(-t * 11.0)
        knock_phase += 2.0 * math.pi * 205.0 / rate
        knock = math.sin(knock_phase) * math.exp(-t * 55.0) * 0.22
        attack = min(1.0, i / (rate * 0.01))
        samples.append(math.tanh((body + knock) * 1.3) * attack)
    return samples


def blip(rate: int = 44100) -> list[float]:
    duration = 0.22
    n = int(rate * duration)
    base = D3
    samples = []
    for i in range(n):
        t = i / rate
        s = math.sin(2.0 * math.pi * base * t)
        s += 0.3 * math.sin(2.0 * math.pi * base * 2.0 * t)
        env = min(1.0, i / (rate * 0.004)) * math.exp(-t * 22.0)
        samples.append(s * env)
    return samples


def tick(rate: int = 44100) -> list[float]:
    duration = 0.035
    n = int(rate * duration)
    samples = []
    for i in range(n):
        t = i / rate
        s = math.sin(2.0 * math.pi * 950.0 * t)
        s += 0.3 * math.sin(2.0 * math.pi * 1900.0 * t)
        env = min(1.0, i / (rate * 0.0015)) * math.exp(-t * 220.0)
        samples.append(s * env)
    return samples


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    write_wav("music.wav", music(), rate=22050, peak_target=0.55)
    write_wav("thump.wav", thump(), rate=44100, peak_target=0.6)
    write_wav("blip.wav", blip(), rate=44100, peak_target=0.45)
    write_wav("tick.wav", tick(), rate=44100, peak_target=0.25)

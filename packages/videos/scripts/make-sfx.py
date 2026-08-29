#!/usr/bin/env python3
"""Generate the ComposeAgents sound design into public/sfx/.

Two sounds only, modeled on the warm, bass-forward ambient language of
elevenlabs.io (measured from their site bed: energy centered 90-600 Hz,
rolling off hard above 2 kHz). Everything is synthesized from scratch,
stdlib only (wave + math):

  thump.wav - a soft sub impact (120 -> 45 Hz pitch drop, ~10 ms attack,
              ~300 ms decay) with a quiet 200 Hz knock so it still reads
              on phone speakers; one per scene cut
  bed.wav   - a 24 s dark drone on D2: a detuned pair, a low fifth,
              octave and a faint ninth, two slow swell LFOs, no noise;
              sits under the whole video, faded in and out by Remotion
  blip.wav  - a clean bass pluck; the rule counter plays it once per
              increment at rising pentatonic playback rates
"""

import math
import os
import random
import struct
import wave

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "sfx")


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
        # A quiet upper knock so the hit registers on speakers with no sub.
        knock_phase += 2.0 * math.pi * 205.0 / rate
        knock = math.sin(knock_phase) * math.exp(-t * 55.0) * 0.22
        attack = min(1.0, i / (rate * 0.01))
        samples.append(math.tanh((body + knock) * 1.3) * attack)
    return samples


def bed(rate: int = 22050) -> list[float]:
    duration = 24.0
    n = int(rate * duration)
    root = 73.42  # D2
    samples = []
    for i in range(n):
        t = i / rate
        swell = 0.8 + 0.2 * math.sin(2.0 * math.pi * 0.06 * t)
        drift = 0.92 + 0.08 * math.sin(2.0 * math.pi * 0.021 * t + 1.7)
        s = math.sin(2.0 * math.pi * root * t)
        s += math.sin(2.0 * math.pi * root * 1.0025 * t)
        s += 0.35 * math.sin(2.0 * math.pi * root * 1.5 * t)
        s += 0.18 * math.sin(2.0 * math.pi * root * 2.0 * t)
        s += 0.08 * math.sin(2.0 * math.pi * root * 2.25 * t)
        samples.append(s * swell * drift)
    return samples


def blip(rate: int = 44100) -> list[float]:
    duration = 0.22
    n = int(rate * duration)
    base = 110.0
    samples = []
    for i in range(n):
        t = i / rate
        s = math.sin(2.0 * math.pi * base * t)
        s += 0.3 * math.sin(2.0 * math.pi * base * 2.0 * t)
        env = min(1.0, i / (rate * 0.004)) * math.exp(-t * 22.0)
        samples.append(s * env)
    return samples


if __name__ == "__main__":
    random.seed(50)
    os.makedirs(OUT_DIR, exist_ok=True)
    write_wav("thump.wav", thump(), rate=44100, peak_target=0.6)
    write_wav("bed.wav", bed(), rate=22050, peak_target=0.3)
    write_wav("blip.wav", blip(), rate=44100, peak_target=0.45)

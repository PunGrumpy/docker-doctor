#!/usr/bin/env python3
"""Generate the ComposeAgents sound design into public/sfx/.

Two sounds only, modeled on the warm, bass-forward ambient language of
elevenlabs.io (measured from their site bed: energy centered 90-600 Hz,
rolling off hard above 2 kHz). Everything is synthesized from scratch,
stdlib only (wave + math):

  thump.wav - a soft sub impact (120 -> 45 Hz pitch drop, ~10 ms attack,
              ~300 ms decay) with a quiet 200 Hz knock so it still reads
              on phone speakers; one per scene cut
  bed.wav   - a 24 s dark drone on D2: a detuned pair, a low fifth and
              octave, low-passed air, two slow swell LFOs; sits under the
              whole video at low volume, faded in and out by Remotion
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
    noise_lp = 0.0
    noise_a = 1.0 - math.exp(-2.0 * math.pi * 400.0 / rate)
    for i in range(n):
        t = i / rate
        swell = 0.75 + 0.25 * math.sin(2.0 * math.pi * 0.07 * t)
        drift = 0.9 + 0.1 * math.sin(2.0 * math.pi * 0.023 * t + 1.7)
        s = math.sin(2.0 * math.pi * root * t)
        s += math.sin(2.0 * math.pi * root * 1.003 * t)
        s += 0.4 * math.sin(2.0 * math.pi * root * 1.5 * t)
        s += 0.2 * math.sin(2.0 * math.pi * root * 2.0 * t)
        noise_lp += noise_a * ((random.random() * 2.0 - 1.0) - noise_lp)
        s += noise_lp * 0.5
        samples.append(math.tanh(s * swell * drift * 0.7))
    return samples


if __name__ == "__main__":
    random.seed(50)
    os.makedirs(OUT_DIR, exist_ok=True)
    write_wav("thump.wav", thump(), rate=44100, peak_target=0.6)
    write_wav("bed.wav", bed(), rate=22050, peak_target=0.3)

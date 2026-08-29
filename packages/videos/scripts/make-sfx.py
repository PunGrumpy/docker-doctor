#!/usr/bin/env python3
"""Generate the ComposeAgents sound effects into public/sfx/.

Three synthesized sounds, stdlib only (wave + math), 44.1 kHz 16-bit mono:
  thud.wav  - low sine burst with a pitch drop and a click transient,
              played on every type slam and scene cut
  tick.wav  - short filtered-noise click, one per typewriter character
  tone.wav  - low two-partial tone with a slow decay, closes the outro
"""

import math
import os
import random
import struct
import wave

RATE = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "sfx")


def write_wav(name: str, samples: list[float]) -> None:
    path = os.path.join(OUT_DIR, name)
    peak = max(abs(s) for s in samples) or 1.0
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        frames = b"".join(
            struct.pack("<h", int(s / peak * 32000)) for s in samples
        )
        f.writeframes(frames)
    print(f"{name}: {len(samples) / RATE * 1000:.0f} ms")


def thud() -> list[float]:
    duration = 0.16
    n = int(RATE * duration)
    samples = []
    phase = 0.0
    for i in range(n):
        t = i / RATE
        freq = 95.0 * math.exp(-t * 9.0) + 42.0
        phase += 2.0 * math.pi * freq / RATE
        body = math.sin(phase) * math.exp(-t * 26.0)
        click = (random.random() * 2.0 - 1.0) * math.exp(-t * 900.0) * 0.35
        samples.append(body + click)
    return samples


def tick() -> list[float]:
    duration = 0.03
    n = int(RATE * duration)
    samples = []
    prev = 0.0
    for i in range(n):
        t = i / RATE
        noise = random.random() * 2.0 - 1.0
        # One-pole low-pass keeps the click soft instead of hissy.
        prev = prev + 0.35 * (noise - prev)
        ping = math.sin(2.0 * math.pi * 1900.0 * t) * 0.4
        samples.append((prev + ping) * math.exp(-t * 300.0))
    return samples


def tone() -> list[float]:
    duration = 1.1
    n = int(RATE * duration)
    attack = int(RATE * 0.02)
    samples = []
    for i in range(n):
        t = i / RATE
        env = min(1.0, i / attack) * math.exp(-t * 3.2)
        s = math.sin(2.0 * math.pi * 110.0 * t)
        s += 0.5 * math.sin(2.0 * math.pi * 220.0 * t)
        s += 0.15 * math.sin(2.0 * math.pi * 330.0 * t)
        samples.append(s * env)
    return samples


if __name__ == "__main__":
    random.seed(50)
    os.makedirs(OUT_DIR, exist_ok=True)
    write_wav("thud.wav", thud())
    write_wav("tick.wav", tick())
    write_wav("tone.wav", tone())

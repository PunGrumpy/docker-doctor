#!/usr/bin/env python3
"""Generate the ComposeAgents sound effects into public/sfx/.

Modeled on the arcade-button foley basement.studio uses on their site
(measured from their assets: ~90 ms, soft ~8 ms attack, ~45 ms decay,
dominant resonance ~2.6 kHz with air up to ~11 kHz, moderate level).
Everything here is synthesized from scratch — noise through resonant
bandpass filters, like the body modes of a plastic button — so nothing
is sampled from anyone's assets.

Three sounds, stdlib only (wave + math), 44.1 kHz 16-bit mono:
  clack.wav - bright mechanical press with a small low body,
              played on every type slam and scene cut
  tick.wav  - lighter, shorter release click, one per typed character
  tone.wav  - warm detuned low tone, closes the outro
"""

import math
import os
import random
import struct
import wave

RATE = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "sfx")


def write_wav(name: str, samples: list[float], peak_target: float) -> None:
    path = os.path.join(OUT_DIR, name)
    peak = max(abs(s) for s in samples) or 1.0
    scale = peak_target / peak * 32767
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(b"".join(struct.pack("<h", int(s * scale)) for s in samples))
    print(f"{name}: {len(samples) / RATE * 1000:.0f} ms")


def resonator(noise: list[float], freq: float, q: float) -> list[float]:
    """Two-pole resonant bandpass — one ringing body mode of a button."""
    w = 2.0 * math.pi * freq / RATE
    r = math.exp(-w / (2.0 * q))
    a1 = -2.0 * r * math.cos(w)
    a2 = r * r
    y1 = y2 = 0.0
    out = []
    for x in noise:
        y = x - a1 * y1 - a2 * y2
        out.append(y)
        y2, y1 = y1, y
    return out


def envelope(n: int, attack_s: float, decay_rate: float) -> list[float]:
    attack_n = max(1, int(RATE * attack_s))
    return [
        min(1.0, i / attack_n) * math.exp(-i / RATE * decay_rate)
        for i in range(n)
    ]


def soft_clip(samples: list[float], drive: float = 1.4) -> list[float]:
    return [math.tanh(s * drive) for s in samples]


def highpass(samples: list[float], freq: float) -> list[float]:
    """One-pole high-pass — the all-pole resonators have no zeros, so
    low-frequency strike energy leaks through and needs cutting."""
    a = math.exp(-2.0 * math.pi * freq / RATE)
    y = 0.0
    prev = 0.0
    out = []
    for x in samples:
        y = a * (y + x - prev)
        prev = x
        out.append(y)
    return out


def lowpass(samples: list[float], freq: float) -> list[float]:
    """One-pole low-pass to tame broadband hiss above the body modes."""
    a = 1.0 - math.exp(-2.0 * math.pi * freq / RATE)
    y = 0.0
    out = []
    for x in samples:
        y += a * (x - y)
        out.append(y)
    return out


def click(
    duration: float,
    modes: list[tuple[float, float, float]],
    attack_s: float,
    decay_rate: float,
    body: float = 0.0,
    hp_freq: float = 500.0,
) -> list[float]:
    """A short noise strike rings parallel body-mode resonators.

    The excitation lasts only a few milliseconds — a button is struck
    once and rings; continuous noise would read as hiss. Measured against
    the reference: one sharp mode carries the sound, the rest sit 20 dB
    down, and everything above 8 kHz rolls off steeply.
    """
    n = int(RATE * duration)
    strike_n = int(RATE * 0.006)
    noise = [
        (random.random() * 2.0 - 1.0) * math.exp(-i / RATE * 500.0)
        if i < strike_n
        else 0.0
        for i in range(n)
    ]
    out = [0.0] * n
    for freq, q, gain in modes:
        for i, y in enumerate(resonator(noise, freq, q)):
            out[i] += y * gain
    out = highpass(lowpass(lowpass(out, 5500.0), 5500.0), hp_freq)
    env = envelope(n, attack_s, decay_rate)
    out = [s * e for s, e in zip(out, env)]
    if body > 0.0:
        phase = 0.0
        for i in range(n):
            t = i / RATE
            freq = 150.0 * math.exp(-t * 18.0) + 105.0
            phase += 2.0 * math.pi * freq / RATE
            out[i] += math.sin(phase) * math.exp(-t * 40.0) * body
    return soft_clip(out)


def clack() -> list[float]:
    # Press: dominant ~2.6 kHz mode, secondary modes for snap and air,
    # small 100-150 Hz body so the slam lands with a little weight.
    return click(
        duration=0.1,
        modes=[(2600.0, 40.0, 1.0), (4100.0, 25.0, 0.15), (1250.0, 18.0, 0.2)],
        attack_s=0.005,
        decay_rate=55.0,
        body=0.6,
    )


def tick() -> list[float]:
    # Release: lighter and higher, no body, gone in ~40 ms.
    return click(
        duration=0.05,
        modes=[(3300.0, 30.0, 1.0), (5200.0, 15.0, 0.1)],
        attack_s=0.002,
        decay_rate=85.0,
        hp_freq=1500.0,
    )


def tone() -> list[float]:
    # Warm low close: a detuned pair beating slowly plus a quiet octave,
    # soft attack, long release. C3 with 4 cents of spread.
    duration = 1.8
    n = int(RATE * duration)
    base = 130.81
    detune = base * 1.0023
    samples = []
    for i in range(n):
        t = i / RATE
        vib = 1.0 + 0.002 * math.sin(2.0 * math.pi * 4.5 * t)
        s = math.sin(2.0 * math.pi * base * vib * t)
        s += math.sin(2.0 * math.pi * detune * t)
        s += 0.35 * math.sin(2.0 * math.pi * base * 2.0 * t)
        env = min(1.0, i / (RATE * 0.03)) * math.exp(-t * 2.1)
        samples.append(s * env)
    return soft_clip(samples, drive=0.8)


if __name__ == "__main__":
    random.seed(50)
    os.makedirs(OUT_DIR, exist_ok=True)
    write_wav("clack.wav", clack(), peak_target=0.5)
    write_wav("tick.wav", tick(), peak_target=0.3)
    write_wav("tone.wav", tone(), peak_target=0.4)

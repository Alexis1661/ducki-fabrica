"""Instrumentos y efectos sintetizados de la fábrica de videos (sin samples ni derechos
de terceros). Copiados de music/make_v0110.py y music/make_todo.py para poder usarlos
desde scripts/fabrica/audio.py sin correr esos scripts.
"""
import wave

import numpy as np
from scipy import signal

SR = 44100
rng = np.random.default_rng(23)


def reseed(seed):
    global rng
    rng = np.random.default_rng(seed)


class Track:
    """Stereo bus of `dur` seconds; add() mixes a mono buffer at a time with pan and gain."""

    def __init__(self, dur):
        self.dur = dur
        self.n = int(SR * (dur + 1))
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)

    def add(self, buf, start, pan=0.0, gain=1.0):
        i = int(start * SR)
        if i < 0 or i >= self.n:
            return
        buf = buf[: self.n - i] * gain
        self.L[i:i + len(buf)] += buf * np.sqrt((1 - pan) / 2) * 1.414
        self.R[i:i + len(buf)] += buf * np.sqrt((1 + pan) / 2) * 1.414

    def write(self, path, peak, fade=1.5):
        mix = np.stack([self.L, self.R], axis=1)[: int(SR * self.dur)]
        n = len(mix)
        mix *= np.clip((self.dur - np.arange(n) / SR) / fade, 0, 1)[:, None]
        mix = np.tanh(mix * 1.1)
        mix /= max(1e-9, np.max(np.abs(mix))) / peak
        with wave.open(path, 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((mix * 32767).astype('<i2').tobytes())


def tvec(d):
    return np.arange(int(SR * d)) / SR


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return signal.lfilter(b, a, x)


# --- instruments -------------------------------------------------------------------

def kick():
    t = tvec(0.35)
    f = 50 + 110 * np.exp(-t * 38)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    click = bp(rng.standard_normal(len(t)), 2000, 6000) * np.exp(-t * 300) * 0.25
    return np.tanh((body + click) * 1.6)


def clap():
    t = tvec(0.25)
    n = rng.standard_normal(len(t))
    env = np.zeros(len(t))
    for k, d in enumerate((0.0, 0.011, 0.022)):
        i = int(d * SR)
        env[i:] += np.exp(-(t[: len(t) - i]) * (90 if k < 2 else 22)) * (0.8 if k < 2 else 1.0)
    return bp(n, 900, 2600) * env * 0.9


def hat(open_=False):
    t = tvec(0.18 if open_ else 0.05)
    return hp(rng.standard_normal(len(t)), 7500) * np.exp(-t * (18 if open_ else 90)) * 0.5


def shaker():
    t = tvec(0.07)
    env = np.sin(np.pi * np.minimum(1, t / 0.07)) ** 2
    return bp(rng.standard_normal(len(t)), 5000, 11000) * env * 0.3


def rim():
    t = tvec(0.06)
    return (np.sin(2 * np.pi * 1700 * t) + bp(rng.standard_normal(len(t)), 1500, 4000) * 0.6) * np.exp(-t * 120) * 0.6


def sub(note, d):
    t = tvec(d)
    f = midi(note)
    env = np.minimum(1, t / 0.01) * np.exp(-t * 3) * np.minimum(1, (d - t) / 0.03)
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return x * env * 0.8


def synth_bass(note, d):
    t = tvec(d)
    f = midi(note)
    x = lp(2 * ((t * f) % 1) - 1, 700)
    env = np.minimum(1, t / 0.005) * np.exp(-t * 4) * np.minimum(1, (d - t) / 0.02)
    return x * env * 0.6


def pad(notes, d, bright=1400):
    t = tvec(d)
    x = np.zeros(len(t))
    for n in notes:
        for det in (-0.12, 0.12):
            x += np.sin(2 * np.pi * midi(n + det) * t)
    x = lp(x / (len(notes) * 2), bright)
    env = np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.4)
    return x * env * 0.5


def marimba(note, d=0.5):
    t = tvec(d)
    f = midi(note)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 30)
    return x * np.exp(-t * 9) * 0.6


def glass(note, d=1.2):
    t = tvec(d)
    f = midi(note)
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * k) for r, a, k in ((1, 1, 3), (2.76, 0.4, 6), (5.4, 0.2, 10)))
    return x * 0.5


def bubble(lo=500, hi=1500, d=0.07):
    t = tvec(d)
    f = lo * (hi / lo) ** (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) * 0.7


def swish(d=0.3, lo=500, hi=6000, up=True):
    t = tvec(d)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    seg = 256
    for i in range(0, len(t), seg):
        k = i / len(t)
        fc = lo * (hi / lo) ** (k if up else 1 - k)
        out[i:i + seg] = bp(n[i:i + seg], max(80, fc * 0.6), min(SR / 2 - 200, fc * 1.4))
    env = np.sin(np.pi * np.minimum(1, t / d)) ** 1.5
    return out * env * 0.8


def tick():
    t = tvec(0.03)
    return (np.sin(2 * np.pi * 3200 * t) + 0.5 * bp(rng.standard_normal(len(t)), 3000, 8000)) * np.exp(-t * 220) * 0.7


def boom():
    t = tvec(1.4)
    f = 32 + 90 * np.exp(-t * 7)
    low = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.5)
    crack = lp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 18) * 0.7
    return np.tanh((low * 1.4 + crack) * 1.3)


def thud():
    t = tvec(0.25)
    f = 70 + 120 * np.exp(-t * 40)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14) + lp(rng.standard_normal(len(t)), 1200) * np.exp(-t * 40) * 0.5) * 0.9


def riser(d):
    t = tvec(d)
    n = hp(rng.standard_normal(len(t)), 1500)
    f = 300 * (8 ** (t / d))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3
    return (n * 0.5 + tone) * (t / d) ** 2


def pop_fx():
    t = tvec(0.08)
    f = 900 * np.exp(-t * 20) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 40) * 0.8


def putt():
    t = tvec(0.12)
    return (np.sin(2 * np.pi * 1200 * t) * 0.6 + bp(rng.standard_normal(len(t)), 2000, 6000) * 0.4) * np.exp(-t * 60)


def engine(d):
    t = tvec(d)
    f = 90 + 60 * (t / d)
    x = 2 * ((np.cumsum(f) / SR) % 1) - 1
    return lp(x, 900) * np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.1) * 0.5


def shot():
    t = tvec(0.3)
    return np.tanh((lp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 25) + np.sin(2 * np.pi * 70 * t) * np.exp(-t * 15)) * 1.5) * 0.7




# --- paper sounds ------------------------------------------------------------------------

def rip(d=0.45):
    """Paper tearing: crackling grains of filtered noise."""
    t = tvec(d)
    n = bp(rng.standard_normal(len(t)), 700, 7000)
    g = np.repeat(rng.random(len(t) // 120 + 1) ** 3, 120)[: len(t)]
    env = np.minimum(1, t / 0.02) * np.minimum(1, (d - t) / 0.08)
    return n * g * env * 1.6


def slide(d=0.22):
    """A sheet sliding over the desk."""
    t = tvec(d)
    n = bp(rng.standard_normal(len(t)), 1200, 6000)
    env = np.sin(np.pi * t / d) ** 2
    return n * env * 0.7


def tape(d=0.18):
    t = tvec(d)
    n = bp(rng.standard_normal(len(t)), 2500, 9000)
    g = np.repeat(rng.random(len(t) // 60 + 1) ** 2, 60)[: len(t)]
    return n * g * np.exp(-t * 10) * 1.2


def stamp():
    t = tvec(0.3)
    f = 90 + 140 * np.exp(-t * 50)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18)
    crack = bp(rng.standard_normal(len(t)), 1500, 5000) * np.exp(-t * 70) * 0.6
    return np.tanh((body + crack) * 1.4) * 0.9


def scribble(d=0.35):
    """Marker on paper."""
    t = tvec(d)
    n = bp(rng.standard_normal(len(t)), 1800, 5500)
    am = 0.35 + 0.65 * np.abs(np.sin(2 * np.pi * 7.5 * t))
    return n * am * np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.05) * 0.45


def crackle(d):
    """Vinyl dust under the music."""
    out = np.zeros(int(SR * d))
    for _ in range(int(d * 14)):
        i = rng.integers(0, len(out) - 200)
        out[i:i + 60] += hp(rng.standard_normal(60), 2000) * np.exp(-np.arange(60) / 12) * rng.random()
    return out * 0.5



# --- amapiano -------------------------------------------------------------------------

def logdrum(note, d=0.42):
    """The amapiano log drum: a pitch-dropping, saturated low tone."""
    t = tvec(d)
    f0 = midi(note)
    f = f0 * (1 + 1.2 * np.exp(-t * 40))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.35 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    x = np.tanh(x * 2.2) * np.exp(-t * 6.5)
    knock = bp(rng.standard_normal(len(t)), 400, 1600) * np.exp(-t * 90) * 0.25
    return lp(x + knock, 900) * 0.8


def rhodes(notes, d):
    """Electric piano chord: soft sine body, a bell on the attack, slow tremolo."""
    t = tvec(d)
    x = np.zeros(len(t))
    for n in notes:
        f = midi(n)
        x += np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) * np.exp(-t * 3)
        x += 0.18 * np.sin(2 * np.pi * 7 * f * t) * np.exp(-t * 28)
    trem = 1 + 0.18 * np.sin(2 * np.pi * 4.2 * t)
    env = np.minimum(1, t / 0.01) * np.exp(-t * 1.1) * np.minimum(1, (d - t) / 0.08)
    return lp(x / len(notes), 2600) * trem * env * 0.55


def stab(notes):
    t = tvec(0.28)
    x = sum(np.sin(2 * np.pi * midi(n + 12) * t) + 0.3 * np.sin(2 * np.pi * 3 * midi(n + 12) * t) for n in notes) / len(notes)
    return lp(x, 3500) * np.exp(-t * 14) * 0.5



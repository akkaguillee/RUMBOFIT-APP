"""
Small synthesis kit for the RUMBO promos (numpy/scipy only): filters, oscillators,
reverb, panning and the drum and sound-design voices. Used by build_cinematic.py;
build_audio.py (the 40 s cut) keeps its own copy so its output stays as it was.
Everything is 48 kHz; mono signals are 1-D arrays, stereo ones (n, 2).
"""

import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(84)


def seed(n):
    global rng
    rng = np.random.default_rng(n)


# ── DSP ──────────────────────────────────────────────────────────────────
def hz(name):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    return 440.0 * 2 ** ((names[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)


def sos(kind, f, order=2):
    if kind == 'band':
        return signal.butter(order, [f[0], min(f[1], SR * 0.45)], 'band', fs=SR, output='sos')
    return signal.butter(order, min(f, SR * 0.45), kind, fs=SR, output='sos')


def lp(x, f, order=2):
    return signal.sosfilt(sos('low', f, order), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(sos('high', f, order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(sos('band', (lo, hi), order), x, axis=0)


def peaking(x, f0, gain_db, q=1.0):
    a = 10 ** (gain_db / 40)
    w = 2 * np.pi * f0 / SR
    alpha = np.sin(w) / (2 * q)
    b = np.array([1 + alpha * a, -2 * np.cos(w), 1 - alpha * a])
    den = np.array([1 + alpha / a, -2 * np.cos(w), 1 - alpha / a])
    return signal.lfilter(b / den[0], den / den[0], x, axis=0)


def sweep(x, f0, f1, kind='low', block=480):
    """Time-varying filter: cutoff glides exponentially from f0 to f1 over x."""
    out = np.zeros_like(x)
    zi = None
    nb = int(np.ceil(len(x) / block))
    for i in range(nb):
        c = f0 * (f1 / f0) ** (i / max(1, nb - 1))
        s = sos(kind, c)
        if zi is None:
            zi = np.zeros((s.shape[0], 2) + x.shape[1:])
        seg = x[i * block:(i + 1) * block]
        out[i * block:i * block + len(seg)], zi = signal.sosfilt(s, seg, zi=zi, axis=0)
    return out


def env(n, a=0.005, d=0.1, s=0.7, r=0.15):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    sus = max(0, n - a_n - d_n - r_n)
    e = np.concatenate([np.linspace(0, 1, a_n, endpoint=False), np.linspace(1, s, d_n, endpoint=False), np.full(sus, s), np.linspace(s, 0, r_n)])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def saw(f, n, ph=0.0):
    """Saw with PolyBLEP anti-aliasing."""
    t = (np.arange(n) * f / SR + ph) % 1.0
    dt = f / SR
    y = 2 * t - 1
    m1 = t < dt
    tt = t[m1] / dt
    y[m1] -= tt + tt - tt * tt - 1
    m2 = t > 1 - dt
    tt = (t[m2] - 1) / dt
    y[m2] -= tt * tt + tt + tt + 1
    return y


def sine(f, n, ph=0.0):
    return np.sin(2 * np.pi * (np.arange(n) * f / SR + ph))


def make_ir(seconds, decay, seed_, bright=6500):
    r = np.random.default_rng(seed_)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    e = np.exp(-decay * t) * (1 - np.exp(-t * 400))
    x = lp(np.stack([r.standard_normal(n) * e, r.standard_normal(n) * e], 1), bright)
    return x / np.sqrt((x ** 2).sum() / 2)


HALL = make_ir(3.2, 1.9, 1)
ROOM = make_ir(0.6, 7.0, 2)


def verb(x, impulse, wet):
    w = np.stack([signal.fftconvolve(x[:, c], impulse[:, c])[: len(x)] for c in range(2)], 1)
    return x + w * wet


def st(x, pan=0.0, width=0):
    lg, rg = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
    r = np.roll(x, width) if width else x
    return np.stack([x * lg, r * rg], 1)


def add(buf, x, at, gain=1.0, pan=0.0):
    i = int(round(at * SR))
    if i >= len(buf):
        return
    if x.ndim == 1:
        x = st(x, pan)
    if i < 0:
        x, i = x[-i:], 0
    n = min(len(x), len(buf) - i)
    buf[i:i + n] += x[:n] * gain


def curve(n, points):
    """Piecewise-linear automation over n samples from (seconds, value) points."""
    t, v = zip(*points)
    return np.interp(np.arange(n) / SR, t, v)


# ── Instruments ──────────────────────────────────────────────────────────
def keys(f, dur=1.2, bright=1.0):
    """Piano-like tone: decaying, slightly inharmonic partials with a soft hammer."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = sum((0.6 ** k) * bright ** k * np.sin(2 * np.pi * f * (k + 1) * (1 + 0.0004 * k * k) * t) * np.exp(-t * (2.2 + k * 1.3)) for k in range(6))
    y = y + lp(rng.standard_normal(n), 2500) * np.exp(-t * 90) * 0.05
    return y * (1 - np.exp(-t * 300))


def pluck(f, dur=0.25, cutoff=3000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = saw(f, n, rng.random()) * 0.6 + np.sign(np.sin(2 * np.pi * f * t)) * 0.25
    return lp(x, cutoff) * np.exp(-t * 14) * (1 - np.exp(-t * 600))


def kick(punch=1.0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 50 + 115 * np.exp(-t * 30)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t * 220) * 0.25 * punch
    return np.tanh((body + click) * 1.7) * 0.85


def clap():
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 900, 6000)
    e = sum(np.where(t >= o, np.exp(-(t - o) * 60), 0) for o in (0, 0.009, 0.019)) + 0.5 * np.exp(-t * 14)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4
    return (noise * e * 0.55 + body) * 0.8


def snare():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * (230 + 60 * np.exp(-t * 40)) * t) * np.exp(-t * 28)
    noise = bp(rng.standard_normal(n), 1500, 9000) * np.exp(-t * 22)
    return (tone * 0.5 + noise * 0.6) * 0.8


def hat(open_=False):
    n = int((0.25 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 8000) * np.exp(-t * (14 if open_ else 80)) * 0.3


def shaker():
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 5000, 12000) * np.sin(np.pi * t / 0.08) ** 2 * 0.25


def tom(f=90):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-t * 18))) / SR) * np.exp(-t * 4.5)
    skin = lp(rng.standard_normal(n), 1800) * np.exp(-t * 30) * 0.3
    return np.tanh((body + skin) * 1.4) * 0.8


def cymbal(length=2.5):
    n = int(length * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 5000) * np.exp(-t * 1.8) * (1 - np.exp(-t * 200))
    return st(x, 0, 90) * 0.35


# ── Sound design ─────────────────────────────────────────────────────────
def fx_whoosh(length=0.6, lo=250, hi=7000):
    n = int(length * SR)
    x = rng.standard_normal(n)
    x = sweep(x, lo, hi, 'low') * 0.8 + sweep(x, hi * 0.85, lo * 2.4, 'high') * 0.25
    e = np.sin(np.linspace(0, np.pi, n)) ** 2.4
    p = np.linspace(-0.7, 0.7, n)
    return np.stack([x * e * np.cos((p + 1) * np.pi / 4), x * e * np.sin((p + 1) * np.pi / 4)], 1) * 1.2


def fx_impact(length=2.0, f0=38):
    n = int(length * SR)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * (f0 + 95 * np.exp(-t * 11)) * t) * np.exp(-t * 2.2)
    crack = lp(rng.standard_normal(n), 4000) * np.exp(-t * 22) * 0.6
    tail = lp(rng.standard_normal(n), 1200) * np.exp(-t * 3) * 0.12
    return verb(st(np.tanh((sub + crack + tail) * 1.3)), HALL, 0.35)


def fx_heart(strong=True):
    """One heartbeat thump: a short, round sub with a soft skin."""
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (44 + 36 * np.exp(-t * 26)) * t) * np.exp(-t * (9 if strong else 12))
    skin = lp(rng.standard_normal(n), 300) * np.exp(-t * 45) * 0.25
    return (body + skin) * (1.0 if strong else 0.65)


def fx_pop():
    n = int(0.14 * SR)
    t = np.arange(n) / SR
    f = 1000 * np.exp(-t * 20) + 420
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32) * 0.6


def fx_tick(f=3100):
    n = int(0.025 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.68 * t)) * np.exp(-t * 300) * 0.25


def fx_bell(nm, dur=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(nm) if isinstance(nm, str) else nm
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * np.exp(-t * 6)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 4) * 0.3


def fx_ignite():
    n = int(1.3 * SR)
    t = np.arange(n) / SR
    x = sweep(rng.standard_normal(n), 180, 4000, 'low') * np.exp(-t * 2.8) * (1 - np.exp(-t * 30))
    crackle = np.zeros(n)
    for _ in range(60):
        i = int(rng.random() * n * 0.9)
        k = min(30, n - i)
        crackle[i:i + k] += rng.standard_normal(k) * rng.random()
    boom = np.sin(2 * np.pi * (60 + 60 * np.exp(-t * 12)) * t) * np.exp(-t * 5) * 0.6
    return (x * 0.8 + hp(crackle, 2500) * 0.25 + boom) * 0.8


def fx_boop():
    out = np.zeros(int(0.34 * SR))
    for f0, f1, at in ((540, 780, 0.0), (780, 1080, 0.12)):
        n = int(0.15 * SR)
        t = np.arange(n) / SR
        f = f0 + (f1 - f0) * (1 - np.exp(-t * 30))
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.minimum(1, t / 0.15)) ** 1.5
        i = int(at * SR)
        out[i:i + n] += x[: len(out) - i] * 0.45
    return out


def fx_shimmer(notes=('E6', 'A6', 'C7', 'E7', 'A7'), gap=0.05, dur=1.8):
    out = np.zeros((int(dur * SR), 2))
    for i, nm in enumerate(notes):
        add(out, fx_bell(nm, 1.2) * 0.5, i * gap, 1.0, -0.6 + 1.2 * i / max(1, len(notes) - 1))
    return verb(out, HALL, 0.4)


def fx_click():
    n = int(0.02 * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 3000) * np.exp(-t * 400) * 0.5


def fx_check():
    out = np.zeros(int(0.3 * SR))
    for f, at in ((880, 0.0), (1320, 0.07)):
        n = int(0.18 * SR)
        t = np.arange(n) / SR
        i = int(at * SR)
        out[i:i + n] += (np.sin(2 * np.pi * f * t) * np.exp(-t * 18))[: len(out) - i] * 0.35
    return out


def fx_thud():
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * (70 + 90 * np.exp(-t * 25)) * t) * np.exp(-t * 12) + lp(rng.standard_normal(n), 900) * np.exp(-t * 40) * 0.3) * 0.7


def fx_bubble(f0=500, f1=1400):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = f0 + (f1 - f0) * t / 0.12
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.12) * 0.25


def fx_riser(length, lo=400, hi=9000):
    n = int(length * SR)
    x = sweep(rng.standard_normal(n), lo, hi, 'low') * np.linspace(0, 1, n) ** 2
    return st(x, 0, 150) * 0.6


def fx_reverse(length=1.2):
    """Reverse cymbal: bright noise that swells and stops dead on the hit."""
    n = int(length * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 3500) * np.exp((t - length) * 4.5) * (1 - np.exp(-(length - t) * 400))
    return st(x, 0, 120) * 0.5


def fx_glow(f=880, length=1.6):
    """A light switching on: a soft sine swell with a slow shimmer."""
    n = int(length * SR)
    t = np.arange(n) / SR
    e = np.sin(np.pi * np.minimum(1, t / length)) ** 2
    x = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 1.5 * t + 0.3) + 0.25 * np.sin(2 * np.pi * f * 2.003 * t)) * e
    return verb(st(x * (1 + 0.15 * np.sin(2 * np.pi * 5 * t)) * 0.18, 0, 200), HALL, 0.5)


def fx_swell(length=1.4, lo=200, hi=2400):
    """Tonal air rising: filtered noise that opens up, for objects coming forward."""
    n = int(length * SR)
    x = sweep(rng.standard_normal(n), lo, hi, 'low')
    e = np.sin(np.linspace(0, np.pi / 2, n)) ** 2 * np.minimum(1, (n - np.arange(n)) / (0.12 * SR))
    return st(x * e, 0, 160) * 0.5

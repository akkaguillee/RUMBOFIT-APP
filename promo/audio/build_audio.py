"""
RUMBO promo audio (40 s): original music, sound design and the Spanish voice-over.

Everything is generated here, so every sound is ours to use:
- music and effects are synthesised with numpy/scipy (120 BPM, A minor / C major);
- the voice is Kokoro-82M (Apache-2.0), Spanish male voice "em_alex", run locally
  with sherpa-onnx — dry, no reverb, only EQ here and gentle compression in the mix.
Timings come from src/timeline.json (scenes, sound cues) and src/voice.json (lines).
Outputs 48 kHz stereo stems in audio/stems/; audio/mux.sh mixes them with FFmpeg.
"""

import json
import os
import tarfile
import urllib.request

import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TL = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))
VOICE = json.load(open(os.path.join(ROOT, 'src', 'voice.json')))
SR = 48000
FPS = TL['fps']
BEAT = 60 / TL['bpm']
BAR = 4 * BEAT
LENGTH = TL['frames'] / FPS + 0.8
N = int(LENGTH * SR)
STEMS = os.path.join(HERE, 'stems')
os.makedirs(STEMS, exist_ok=True)
rng = np.random.default_rng(40)


# ── DSP helpers ──────────────────────────────────────────────────────────
def tf(frame):
    return frame / FPS


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
    out = np.zeros_like(x)
    zi = None
    nb = int(np.ceil(len(x) / block))
    for i in range(nb):
        c = f0 * (f1 / f0) ** (i / max(1, nb - 1))
        s = sos(kind, c)
        if zi is None:
            zi = np.zeros((s.shape[0], 2))
        seg = x[i * block:(i + 1) * block]
        out[i * block:i * block + len(seg)], zi = signal.sosfilt(s, seg, zi=zi)
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


def make_ir(seconds, decay, seed, bright=6500):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    e = np.exp(-decay * t) * (1 - np.exp(-t * 400))
    x = lp(np.stack([r.standard_normal(n) * e, r.standard_normal(n) * e], 1), bright)
    return x / np.sqrt((x ** 2).sum() / 2)


HALL = make_ir(2.4, 2.4, 1)
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


# ── Arrangement (seconds) ────────────────────────────────────────────────
DROP = 6.0             # music downbeat; the logo impact SFX lands on the word "rumbo"
BREAK = (29.5, 35.0)   # Rumbi: drums drop out, playful keys
FINAL = 35.0           # end card
CHORDS = [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4']]
ROOTS = ['A1', 'F1', 'C2', 'G1']


def chord(t):
    return int(t // BAR) % 4


music = np.zeros((N, 2))

# Pad (wide, warm) across the film
for b in range(int(np.ceil(LENGTH / BAR))):
    t0 = b * BAR
    n = int((BAR + 0.6) * SR)
    x = np.zeros(n)
    notes = CHORDS[b % 4] + [CHORDS[b % 4][0][:-1] + str(int(CHORDS[b % 4][0][-1]) + 1)]
    for nm in notes:
        for d in (-0.005, 0.0, 0.006):
            x += saw(hz(nm) * (1 + d), n, rng.random())
    x = lp(x / 12 * env(n, 0.45, 0.3, 0.85, 0.55), 1400 if t0 < DROP else 1900)
    g = 0.16 if t0 < DROP else (0.2 if BREAK[0] <= t0 < BREAK[1] else 0.11)
    if t0 >= FINAL:
        g = 0.2
    add(music, np.stack([x, np.roll(x, 300)], 1), t0, g)


def keys(f, dur=1.2):
    """Piano-like tone: decaying, slightly inharmonic partials with a soft hammer."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = sum((0.6 ** k) * np.sin(2 * np.pi * f * (k + 1) * (1 + 0.0004 * k * k) * t) * np.exp(-t * (2.2 + k * 1.3)) for k in range(6))
    y = y + lp(rng.standard_normal(n), 2500) * np.exp(-t * 90) * 0.05
    return y * (1 - np.exp(-t * 300))


MOTIF = ['E5', 'A4', 'C5', 'E5', 'D5', 'C5', 'G4', 'C5']
for i in range(16):  # intro motif
    t = i * BEAT / 2
    if t >= DROP - 0.5:
        break
    add(music, keys(hz(MOTIF[i % 8])), t, 0.11 if t < 4 else 0.08, -0.2 + 0.4 * (i % 2))
for i in range(22):  # Rumbi section: playful, an octave up
    t = BREAK[0] + i * BEAT / 2
    if t >= BREAK[1] - 0.25:
        break
    add(music, keys(hz(MOTIF[i % 8]) * 2, 0.9), t, 0.075, -0.3 + 0.6 * (i % 2))

# Heartbeat sub in the intro
for i in range(10):
    t = i * BEAT
    if t > 4.5:
        break
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    add(music, np.sin(2 * np.pi * (52 + 30 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9), t, 0.22 if i % 2 == 0 else 0.12)

# Risers into the drop and into the end card
for start, end in ((4.0, DROP), (BREAK[1] - 2.0, FINAL)):
    n = int((end - start) * SR)
    x = sweep(rng.standard_normal(n), 300, 8000, 'low') * np.linspace(0, 1, n) ** 2.2
    add(music, st(x, 0, 120), start, 0.09)


def kick():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 48 + 120 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t * 220) * 0.3
    return np.tanh((body + click) * 1.8) * 0.85


def clap():
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 900, 6000)
    e = sum(np.where(t >= o, np.exp(-(t - o) * 60), 0) for o in (0, 0.009, 0.019)) + 0.5 * np.exp(-t * 14)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4
    return (noise * e * 0.55 + body) * 0.8


def hat(open_=False):
    n = int((0.25 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 8000) * np.exp(-t * (14 if open_ else 80)) * 0.3


K, CL, HC, HO = kick(), clap(), hat(), hat(True)
kicks = []
for b in range(int(LENGTH / BEAT)):
    t = b * BEAT
    groove = DROP <= t < BREAK[0] or FINAL <= t < 38.0
    if groove:
        add(music, K, t, 0.9)
        kicks.append(t)
        swing = 0.012 if b % 2 else 0.0
        add(music, HC, t + BEAT / 2 + swing, 0.32, 0.25)
        if 19.5 <= t < BREAK[0]:  # training + streak: 16ths
            add(music, HC, t + BEAT / 4, 0.12, -0.25)
            add(music, HC, t + 3 * BEAT / 4, 0.12, -0.25)
    elif BREAK[0] + 2 <= t < BREAK[1] and b % 4 == 0:
        add(music, K, t, 0.45)
        kicks.append(t)
    if (DROP + 2 <= t < BREAK[0] or FINAL <= t < 38.0) and b % 2 == 1:
        add(music, CL, t, 0.4)
    if 24.5 <= t < BREAK[0] and b % 4 == 3:
        add(music, HO, t + BEAT / 2, 0.22, 0.4)
for i in range(16):  # snare roll into the end card
    add(music, CL, FINAL - 1.0 + i * BEAT / 8, 0.06 + 0.02 * i)

# Bass: syncopated 8ths, sidechained below
PAT = [1, 0, 0.6, 1, 0, 0.6, 1, 0.6]
for k in range(int(LENGTH / (BEAT / 2))):
    t = k * BEAT / 2
    if not (DROP <= t < BREAK[0] or FINAL <= t < 38.0):
        continue
    v = PAT[k % 8]
    if not v:
        continue
    f = hz(ROOTS[chord(t)]) * (2 if k % 8 in (3, 7) else 1)
    n = int(BEAT / 2 * 0.95 * SR)
    x = sine(f, n) * 0.9 + lp(saw(f, n), 600) * 0.5
    add(music, x * env(n, 0.003, 0.08, 0.75, 0.04), t, 0.32 * v)

# Chord stabs on the off-beat 8ths during the groove
for k in range(int(LENGTH / (BEAT / 2))):
    t = k * BEAT / 2
    if not (DROP <= t < BREAK[0]) or k % 2 == 0:
        continue
    n = int(0.22 * SR)
    x = np.zeros(n)
    for nm in CHORDS[chord(t)]:
        x += saw(hz(nm) * 2, n, rng.random())
    x = lp(x / 3, 3200) * np.exp(-np.arange(n) / SR * 16)
    add(music, np.stack([x, np.roll(x, 200)], 1), t, 0.07)

# Arp (16ths) from habits to streak, brighter in the streak
ARP = [0, 1, 2, 1, 2, 0, 2, 1]
for k in range(int(LENGTH / (BEAT / 4))):
    t = k * BEAT / 4
    if not (14.0 <= t < BREAK[0]):
        continue
    f = hz(CHORDS[chord(t)][ARP[k % 8]]) * 4
    n = int(0.18 * SR)
    tt = np.arange(n) / SR
    x = (np.sign(np.sin(2 * np.pi * f * tt)) * 0.3 + np.sin(2 * np.pi * f * tt)) * np.exp(-tt * 26)
    add(music, lp(x, 4200 if t >= 24.5 else 2800), t, 0.06, -0.4 if k % 2 else 0.4)

# Lead melody in the streak section (rising, uplifting)
LEAD = [('E5', 0, 1), ('G5', 1, 1), ('A5', 2, 2), ('C6', 4, 2), ('B5', 6, 1), ('A5', 7, 1), ('G5', 8, 2)]
for nm, beat, length in LEAD:
    t = 24.5 + beat * BEAT
    n = int(length * BEAT * SR)
    tt = np.arange(n) / SR
    x = lp(saw(hz(nm), n) * 0.5 + sine(hz(nm), n), 3000) * env(n, 0.02, 0.1, 0.8, 0.12)
    x = x * (1 + 0.05 * np.sin(2 * np.pi * 5.2 * tt) * np.clip(tt * 3, 0, 1))
    add(music, np.stack([x, np.roll(x, 400)], 1), t, 0.06)

# End card: impact boom + bell chords, gentle resolve
n = int(2.4 * SR)
tt = np.arange(n) / SR
add(music, np.sin(2 * np.pi * (42 + 70 * np.exp(-tt * 8)) * tt) * np.exp(-tt * 1.8), FINAL, 0.55)
for i, nm in enumerate(['A4', 'C5', 'E5', 'A5', 'C6']):
    add(music, keys(hz(nm), 3.5), FINAL + 0.12 * i, 0.06, -0.4 + 0.2 * i)
for i, nm in enumerate(['C5', 'E5', 'G5', 'C6']):
    add(music, keys(hz(nm), 3.0), 38.0 + 0.1 * i, 0.07, -0.3 + 0.2 * i)

# Sidechain pump from the kicks
pump = np.ones(N)
for kt in kicks:
    i = int(kt * SR)
    n = int(0.3 * SR)
    c = 1 - 0.42 * np.exp(-np.arange(n) / SR * 13)
    pump[i:i + n] = np.minimum(pump[i:i + n], c[: len(pump[i:i + n])])
music *= pump[:, None]
music = verb(music, HALL, 0.12)
music = hp(lp(music, 13000, 1), 28, 2)
fade = int(39.3 * SR)
music[fade:] *= np.linspace(1, 0, N - fade)[:, None] ** 1.6


# ── Sound design ─────────────────────────────────────────────────────────
def fx_whoosh(length=0.6):
    n = int(length * SR)
    x = rng.standard_normal(n)
    x = sweep(x, 250, 7000, 'low') * 0.8 + sweep(x, 6000, 600, 'high') * 0.25
    e = np.sin(np.linspace(0, np.pi, n)) ** 2.4
    p = np.linspace(-0.7, 0.7, n)
    return np.stack([x * e * np.cos((p + 1) * np.pi / 4), x * e * np.sin((p + 1) * np.pi / 4)], 1) * 1.2


def fx_impact():
    n = int(2.0 * SR)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * (38 + 95 * np.exp(-t * 11)) * t) * np.exp(-t * 2.2)
    crack = lp(rng.standard_normal(n), 4000) * np.exp(-t * 22) * 0.6
    tail = lp(rng.standard_normal(n), 1200) * np.exp(-t * 3) * 0.12
    return verb(st(np.tanh((sub + crack + tail) * 1.3)), HALL, 0.35)


def fx_pop():
    n = int(0.14 * SR)
    t = np.arange(n) / SR
    f = 1000 * np.exp(-t * 20) + 420
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32) * 0.6


def fx_tick():
    n = int(0.025 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 3100 * t) + 0.5 * np.sin(2 * np.pi * 5200 * t)) * np.exp(-t * 300) * 0.25


SCALE = ['A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7']


def fx_bell(nm, dur=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(nm)
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


def fx_shimmer():
    out = np.zeros((int(1.8 * SR), 2))
    for i, nm in enumerate(['E6', 'A6', 'C7', 'E7', 'A7']):
        add(out, fx_bell(nm, 1.2) * 0.5, i * 0.05, 1.0, -0.6 + 0.3 * i)
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


def fx_bubble():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 500 + 900 * t / 0.12
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.12) * 0.25


def fx_riser(length):
    n = int(length * SR)
    x = sweep(rng.standard_normal(n), 400, 9000, 'low') * np.linspace(0, 1, n) ** 2
    return st(x, 0, 150) * 0.6


sfx = np.zeros((N, 2))
GAIN = {'whoosh': 0.45, 'impact': 0.7, 'pop': 0.45, 'tick': 0.45, 'chime': 0.5, 'ignite': 0.55, 'boop': 0.45, 'shimmer': 0.6, 'click': 0.4, 'check': 0.5, 'thud': 0.5, 'bubble': 0.4, 'riser': 0.35}
for ev in TL.get('sfx', []):
    kind = ev['type']
    count, every = ev.get('count', 1), ev.get('every', 0)
    for k in range(count):
        t = tf(ev['at'] + k * every)
        g = GAIN.get(kind, 0.4) * ev.get('gain', 1.0)
        pan = ev.get('pan', 0.0)
        if kind == 'whoosh':
            add(sfx, fx_whoosh(), t - 0.3, g)
        elif kind == 'impact':
            add(sfx, fx_impact(), t, g)
        elif kind == 'pop':
            add(sfx, fx_pop(), t, g, pan)
        elif kind == 'tick':
            add(sfx, fx_tick(), t, g, pan)
        elif kind == 'chime':
            add(sfx, fx_bell(SCALE[k % len(SCALE)]), t, g, -0.5 + k / max(1, count - 1))
        elif kind == 'ignite':
            add(sfx, fx_ignite(), t, g)
        elif kind == 'boop':
            add(sfx, fx_boop(), t, g, pan)
        elif kind == 'shimmer':
            add(sfx, fx_shimmer(), t, g)
        elif kind == 'click':
            add(sfx, fx_click(), t, g, pan)
        elif kind == 'check':
            add(sfx, fx_check(), t, g, pan)
        elif kind == 'thud':
            add(sfx, fx_thud(), t, g)
        elif kind == 'bubble':
            add(sfx, fx_bubble(), t, g, pan)
        elif kind == 'riser':
            add(sfx, fx_riser(ev.get('length', 1.0)), t, g)
sfx = verb(sfx, ROOM, 0.08)

# ── Voice: Kokoro em_alex, dry ───────────────────────────────────────────
CACHE = os.path.join(HERE, '.cache')
KDIR = os.path.join(CACHE, 'kokoro-multi-lang-v1_0')
if not os.path.isdir(KDIR):
    os.makedirs(CACHE, exist_ok=True)
    tar = os.path.join(CACHE, 'kokoro.tar.bz2')
    urllib.request.urlretrieve('https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2', tar)
    with tarfile.open(tar) as t:
        t.extractall(CACHE)

import sherpa_onnx  # noqa: E402

tts = sherpa_onnx.OfflineTts(
    sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=os.path.join(KDIR, 'model.onnx'),
                voices=os.path.join(KDIR, 'voices.bin'),
                tokens=os.path.join(KDIR, 'tokens.txt'),
                data_dir=os.path.join(KDIR, 'espeak-ng-data'),
                dict_dir=os.path.join(KDIR, 'dict'),
                lexicon=os.path.join(KDIR, 'lexicon-us-en.txt'),
                lang='es',
            ),
            num_threads=4,
        ),
    )
)
SPEAKER = 29  # em_alex

voice = np.zeros(N)
for line in VOICE:
    # 'speak' / 'speakAt' override the on-screen text when a wording reads better aloud.
    a = tts.generate(line.get('speak', line['text']), sid=SPEAKER, speed=1.05)
    x = signal.resample_poly(np.asarray(a.samples, dtype=np.float64), 2, 1)  # 24 kHz → 48 kHz
    e = np.abs(x)
    idx = np.where(e > 0.01 * e.max())[0]
    x = x[max(0, idx[0] - 400): idx[-1] + 2400]
    # Clean broadcast EQ: rumble cut, less mud, presence and a little air. No reverb.
    x = hp(x, 80, 2)
    x = peaking(x, 280, -2.0, 0.9)
    x = peaking(x, 3500, 2.0, 1.0)
    x = peaking(x, 9000, 1.5, 0.8)
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.11
    f = int(0.006 * SR)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    i = int(tf(line.get('speakAt', line['at'])) * SR)
    n = min(len(x), N - i)
    voice[i:i + n] += x[:n]
    print('voice', line['id'], 'at', round(tf(line['at']), 2), 's', 'len', round(len(x) / SR, 2), 's')


def write(name, x, peak=0.89):
    m = np.max(np.abs(x)) or 1
    sf.write(os.path.join(STEMS, name), (x / m * peak).astype(np.float32), SR, subtype='FLOAT')


write('music.wav', music)
write('sfx.wav', sfx, 0.85)
write('voice.wav', np.stack([voice, voice], 1), 0.9)
print('stems written to', STEMS)

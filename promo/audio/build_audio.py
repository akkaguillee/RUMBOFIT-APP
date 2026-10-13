"""
RUMBO promo audio: original music, sound effects and the Spanish (Spain) voice-over.

Everything is generated here, so every sound is ours to use:
- music and effects are synthesised with numpy/scipy (120 BPM, A minor);
- the voice is Piper "es_ES-davefx-medium" (dataset licence CC0) run locally with sherpa-onnx.
Timings come from src/timeline.json, the same file the Remotion scenes use.
Outputs 48 kHz stereo stems in audio/stems/; audio/mux.sh mixes them with FFmpeg.
"""

import json
import os
import subprocess
import tarfile
import urllib.request

import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TL = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))
SR = 48000
FPS = TL['fps']
BPM = TL['bpm']
BEAT = 60 / BPM
LENGTH = TL['frames'] / FPS + 0.6  # small tail, trimmed by the mux
N = int(LENGTH * SR)
STEMS = os.path.join(HERE, 'stems')
os.makedirs(STEMS, exist_ok=True)
rng = np.random.default_rng(2026)


def t_of(frame):
    return frame / FPS


def note(name):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[n] + 12 * (octave + 1) - 69) / 12)


def env_adsr(n, a=0.005, d=0.1, s=0.6, r=0.2, sr=SR):
    a_n, d_n, r_n = int(a * sr), int(d * sr), int(r * sr)
    sus = max(0, n - a_n - d_n - r_n)
    e = np.concatenate([np.linspace(0, 1, a_n, endpoint=False), np.linspace(1, s, d_n, endpoint=False), np.full(sus, s), np.linspace(s, 0, r_n)])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def saw(freq, n, detune=0.0, phase=0.0):
    t = np.arange(n) / SR
    f = freq * (1 + detune)
    x = (t * f + phase) % 1.0
    return 2 * x - 1


def lowpass(x, cutoff, order=2):
    sos = signal.butter(order, min(cutoff, SR * 0.45), 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def highpass(x, cutoff, order=2):
    sos = signal.butter(order, cutoff, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def sweep_filter(x, start, end, kind='low', block=512):
    """Time-varying filter: cutoff moves exponentially from start to end (Hz)."""
    out = np.zeros_like(x)
    zi = None
    nb = int(np.ceil(len(x) / block))
    for i in range(nb):
        c = start * (end / start) ** (i / max(1, nb - 1))
        sos = signal.butter(2, min(c, SR * 0.45), kind, fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        seg = x[i * block:(i + 1) * block]
        out[i * block:i * block + len(seg)], zi = signal.sosfilt(sos, seg, zi=zi)
    return out


def reverb_ir(seconds=1.8, decay=3.2, seed=1):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    e = np.exp(-decay * t)
    left = r.standard_normal(n) * e
    right = r.standard_normal(n) * e
    left, right = lowpass(left, 7000), lowpass(right, 7000)
    ir = np.stack([left, right], 1)
    return ir / np.sqrt((ir ** 2).sum())


IR = reverb_ir()
IR_SHORT = reverb_ir(0.7, 6.0, seed=3)


def reverb(x, ir=IR, wet=0.25):
    """x: (n, 2). Returns x with convolution reverb (same length)."""
    wet_sig = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + wet_sig * wet * 3.0


def place(buf, x, at_s, gain=1.0, pan=0.0):
    """Mix mono or stereo x into buf at time at_s with constant-power pan."""
    i = int(at_s * SR)
    if i >= len(buf):
        return
    if x.ndim == 1:
        lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * lg * 1.414, x * rg * 1.414], 1)
    n = min(len(x), len(buf) - i)
    buf[i:i + n] += x[:n] * gain


def stereo(x):
    return np.stack([x, x], 1)


# ── Music ────────────────────────────────────────────────────────────────
music = np.zeros((N, 2))
CHORDS = [  # one chord per bar (2 s): Am – F – C – G
    ['A2', 'C4', 'E4', 'A4'],
    ['F2', 'C4', 'F4', 'A4'],
    ['C3', 'E4', 'G4', 'C5'],
    ['G2', 'D4', 'G4', 'B4'],
]
BAR = 4 * BEAT
n_bars = int(np.ceil(LENGTH / BAR))


def chord_at(bar):
    return CHORDS[bar % 4]


# Pad: detuned saws, filter opening through the intro, sustained to the end.
for bar in range(n_bars):
    start = bar * BAR
    n = int(BAR * SR) + int(0.4 * SR)
    sig = np.zeros(n)
    for nm in chord_at(bar)[1:]:
        f = note(nm)
        for d in (-0.006, 0.0, 0.007):
            sig += saw(f, n, d, phase=rng.random())
    sig /= 9
    e = env_adsr(n, a=0.35, d=0.4, s=0.85, r=0.4)
    cutoff = 900 if bar >= 2 else 450 + 300 * bar
    if bar >= 8:  # ending: warmer and open
        cutoff = 1500
    sig = lowpass(sig * e, cutoff)
    gain = 0.20 if bar < 2 else 0.14
    if 6 <= bar < 8:
        gain = 0.17  # Rumbi section: pad carries the harmony
    place(music, np.stack([sig, np.roll(sig, 240)], 1), start, gain)

# Sub pulse in the intro (quarters, low)
for k in range(6):
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = note('A1')
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 7)
    place(music, x, k * BEAT, 0.18 + 0.05 * k)

# Riser into the drop (1.6 → 3.0 s) and reverse cymbal
n = int(1.4 * SR)
noise = rng.standard_normal(n)
riser = sweep_filter(noise, 400, 9000, 'low') * np.linspace(0, 1, n) ** 2
place(music, riser, 1.6, 0.16, 0.0)
rev = highpass(rng.standard_normal(int(0.9 * SR)), 5000) * np.linspace(0, 1, int(0.9 * SR)) ** 3
place(music, rev, 3.0 - 0.9, 0.14)

# Drums
def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 6.5)
    click = highpass(rng.standard_normal(n), 3000) * np.exp(-t * 180) * 0.25
    return np.tanh((body + click) * 1.6) * 0.9


def clap():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    x = bandpass(rng.standard_normal(n), 900, 5200)
    e = np.zeros(n)
    for off in (0, 0.011, 0.022):
        e += np.where(t >= off, np.exp(-(t - off) * 55), 0)
    e += np.exp(-t * 16) * 0.4
    return x * e * 0.6


def hat(open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    x = highpass(rng.standard_normal(n), 7500)
    return x * np.exp(-t * (18 if open_ else 70)) * 0.35


K, C, H, HO = kick(), clap(), hat(), hat(True)
kick_times = []


def in_range(t, a, b):
    return a <= t < b


total_beats = int(LENGTH / BEAT)
for b in range(total_beats):
    t = b * BEAT
    # Kick: drop at 3.0 s; breath (half-time) 13–15 s; back for the build; final hit at 17 s then outro.
    if in_range(t, 3.0, 13.0) or in_range(t, 15.0, 17.0):
        place(music, K, t, 0.95)
        kick_times.append(t)
    elif in_range(t, 13.0, 15.0) and (b % 2 == 0):
        place(music, K, t, 0.7)
        kick_times.append(t)
    elif abs(t - 17.0) < 1e-6:
        place(music, K, t, 1.0)
        kick_times.append(t)
    # Claps on 2 and 4 from 5.5 s
    if in_range(t, 5.5, 17.0) and b % 2 == 1:
        place(music, C, t, 0.42, 0.05)
    # Hats on the off-beats
    if in_range(t, 3.0, 17.0):
        place(music, H, t + BEAT / 2, 0.3, 0.3)
        if in_range(t, 5.5, 13.0):
            place(music, H, t + BEAT / 4, 0.12, -0.3)
            place(music, H, t + 3 * BEAT / 4, 0.12, -0.3)
    if in_range(t, 9.0, 13.0) and b % 4 == 3:
        place(music, HO, t + BEAT / 2, 0.35, 0.4)

# Snare-roll build 16.0 → 17.0
for i in range(16):
    t = 16.0 + i * BEAT / 8
    place(music, C, t, 0.12 + 0.03 * i, 0.0)

# Bass: root in 8ths with sidechain pumping, 3.0–17.0
roots = {0: 'A1', 1: 'F1', 2: 'C2', 3: 'G1'}
for b8 in range(int(LENGTH / (BEAT / 2))):
    t = b8 * BEAT / 2
    if not in_range(t, 3.0, 17.0):
        continue
    bar = int(t // BAR)
    f = note(roots[bar % 4])
    if b8 % 2 == 1:
        f *= 2  # octave bounce on the off-beat
    n = int(BEAT / 2 * SR)
    x = (saw(f, n) * 0.6 + np.sin(2 * np.pi * f * np.arange(n) / SR) * 0.8) * env_adsr(n, 0.004, 0.08, 0.7, 0.05)
    x = lowpass(x, 700)
    place(music, x, t, 0.36)

# Pluck arpeggio (16ths) over the chords 5.5–17.0, brighter during the streak
pattern = [0, 1, 2, 3, 2, 1, 2, 3]
for s16 in range(int(LENGTH / (BEAT / 4))):
    t = s16 * BEAT / 4
    if not in_range(t, 5.5, 17.0):
        continue
    bar = int(t // BAR)
    tones = chord_at(bar)[1:] + [chord_at(bar)[1][:-1] + str(int(chord_at(bar)[1][-1]) + 1)]
    nm = tones[pattern[s16 % 8] % len(tones)]
    f = note(nm) * 2
    n = int(0.22 * SR)
    tt = np.arange(n) / SR
    x = (np.sign(np.sin(2 * np.pi * f * tt)) * 0.35 + np.sin(2 * np.pi * f * tt)) * np.exp(-tt * 22)
    bright = 3200 if in_range(t, 10.0, 13.0) else 2200
    x = lowpass(x, bright)
    pan = 0.35 if s16 % 2 else -0.35
    place(music, x, t, 0.11 if not in_range(t, 13.0, 15.0) else 0.08, pan)

# Final impact and ending chord at 17.0 (stab + bell melody)
n = int(1.8 * SR)
tt = np.arange(n) / SR
boom = np.sin(2 * np.pi * (44 + 70 * np.exp(-tt * 9)) * tt) * np.exp(-tt * 2.2)
place(music, boom, 17.0, 0.7)
for i, nm in enumerate(['A4', 'C5', 'E5', 'A5']):
    n = int(2.6 * SR)
    tt = np.arange(n) / SR
    f = note(nm)
    bell = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 3)) * np.exp(-tt * 1.4)
    place(music, bell, 17.0 + i * BEAT / 2, 0.07, -0.3 + 0.2 * i)

# Sidechain pump on the music (except drums would also duck; fine for an energetic feel)
pump = np.ones(N)
for kt in kick_times:
    i = int(kt * SR)
    n = int(0.28 * SR)
    curve = 1 - 0.38 * np.exp(-np.arange(n) / SR * 14)
    pump[i:i + n] = np.minimum(pump[i:i + n], curve[: len(pump[i:i + n])])
music *= pump[:, None]
music = reverb(music, IR, 0.16)
# Gentle top-end roll-off so the mix stays smooth on phone speakers
music = np.stack([lowpass(music[:, c], 11000, 1) for c in range(2)], 1)
# Fade out the tail
fade_from = int(19.2 * SR)
music[fade_from:] *= np.linspace(1, 0, N - fade_from)[:, None] ** 1.5

# ── Sound effects ────────────────────────────────────────────────────────
sfx = np.zeros((N, 2))


def whoosh():
    n = int(0.55 * SR)
    x = rng.standard_normal(n)
    x = sweep_filter(x, 300, 6000, 'low') - sweep_filter(x, 120, 1200, 'low') * 0.5
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    pan_l = np.linspace(-0.8, 0.8, n)
    l = x * e * np.cos((pan_l + 1) * np.pi / 4)
    r = x * e * np.sin((pan_l + 1) * np.pi / 4)
    return np.stack([l, r], 1) * 0.9


def impact():
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * (40 + 90 * np.exp(-t * 10)) * t) * np.exp(-t * 2.6)
    crack = lowpass(rng.standard_normal(n), 3500) * np.exp(-t * 18) * 0.5
    return reverb(stereo(np.tanh((sub + crack) * 1.4)), IR, 0.3)


def pop():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 950 * np.exp(-t * 18) + 380
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 34)
    return x * 0.6


def tick():
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 260) * 0.35


SCALE = ['A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7']


def chime(k):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    f = note(SCALE[k % len(SCALE)])
    x = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 6)) * np.exp(-t * 4.5)
    return x * 0.28


def ignite():
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    x = sweep_filter(rng.standard_normal(n), 200, 3500, 'low') * (np.exp(-t * 3.5) * (1 - np.exp(-t * 40)))
    crackle = np.zeros(n)
    for _ in range(40):
        i = int(rng.random() * n * 0.8)
        crackle[i:i + 40] += rng.standard_normal(min(40, n - i)) * rng.random() * 0.8
    return (x * 0.8 + highpass(crackle, 2500) * 0.3) * 0.8


def boop():
    out = np.zeros(int(0.32 * SR))
    for k, (f0, f1, at) in enumerate([(520, 760, 0.0), (760, 1040, 0.11)]):
        n = int(0.16 * SR)
        t = np.arange(n) / SR
        f = f0 + (f1 - f0) * (1 - np.exp(-t * 30))
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.minimum(1, t / 0.16)) ** 1.5
        i = int(at * SR)
        out[i:i + n] += x[: len(out) - i] * 0.5
    return out


def shimmer():
    out = np.zeros((int(1.6 * SR), 2))
    for i, nm in enumerate(['E6', 'A6', 'C7', 'E7', 'A7']):
        n = int(1.2 * SR)
        t = np.arange(n) / SR
        f = note(nm)
        x = np.sin(2 * np.pi * f * t) * np.exp(-t * 5) * 0.14
        place(out, x, i * 0.045, 1.0, -0.6 + 0.3 * i)
    return reverb(out, IR, 0.45)


for ev in TL['sfx']:
    at = t_of(ev['at'])
    kind = ev['type']
    if kind == 'whoosh':
        place(sfx, whoosh(), at, 0.5)
    elif kind == 'impact':
        place(sfx, impact(), at, 0.65)
    elif kind == 'pop':
        place(sfx, pop(), at, 0.55, 0.1)
    elif kind == 'tick':
        for k in range(ev['count']):
            place(sfx, tick(), t_of(ev['at'] + k * ev['every']), 0.55, 0.15)
    elif kind == 'chime':
        for k in range(ev['count']):
            place(sfx, chime(k), t_of(ev['at'] + k * ev['every']), 0.6, -0.5 + k / 6)
    elif kind == 'ignite':
        place(sfx, ignite(), at, 0.55)
    elif kind == 'boop':
        place(sfx, boop(), at, 0.5, 0.0)
    elif kind == 'shimmer':
        place(sfx, shimmer(), at, 0.8)
sfx = reverb(sfx, IR_SHORT, 0.12)

# ── Voice (Piper es_ES davefx, CC0) ─────────────────────────────────────
CACHE = os.path.join(HERE, '.cache')
MODEL_DIR = os.path.join(CACHE, 'vits-piper-es_ES-davefx-medium')
if not os.path.isdir(MODEL_DIR):
    os.makedirs(CACHE, exist_ok=True)
    url = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_ES-davefx-medium.tar.bz2'
    tar_path = os.path.join(CACHE, 'voice.tar.bz2')
    urllib.request.urlretrieve(url, tar_path)
    with tarfile.open(tar_path) as tf:
        tf.extractall(CACHE)

import sherpa_onnx  # noqa: E402

tts = sherpa_onnx.OfflineTts(
    sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=os.path.join(MODEL_DIR, 'es_ES-davefx-medium.onnx'),
                tokens=os.path.join(MODEL_DIR, 'tokens.txt'),
                data_dir=os.path.join(MODEL_DIR, 'espeak-ng-data'),
                noise_scale=0.45,
                noise_scale_w=0.55,
                length_scale=1.0,
            ),
            num_threads=4,
        ),
        max_num_sentences=1,
    )
)

voice = np.zeros(N)
report = []
for line in TL['voice']:
    a = tts.generate(line['text'], sid=0, speed=1.04)
    x = np.asarray(a.samples, dtype=np.float64)
    x = signal.resample_poly(x, 320, 147)  # 22.05 kHz → 48 kHz
    # Trim silence at both ends
    env = np.abs(x)
    idx = np.where(env > 0.02 * env.max())[0]
    x = x[max(0, idx[0] - 240): idx[-1] + 2400]
    x = highpass(x, 85)
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.12  # level-match lines
    fade = int(0.008 * SR)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    i = int(t_of(line['at']) * SR)
    n = min(len(x), N - i)
    voice[i:i + n] += x[:n]
    report.append((line['id'], round(line['at'] / FPS, 2), round(len(x) / SR, 2)))

voice_st = stereo(voice)
voice_st = reverb(voice_st, IR_SHORT, 0.06)


def write(name, x, peak=0.89):
    m = np.max(np.abs(x)) or 1
    sf.write(os.path.join(STEMS, name), (x / m * peak).astype(np.float32), SR, subtype='FLOAT')


write('music.wav', music)
write('sfx.wav', sfx, 0.8)
write('voice.wav', voice_st, 0.9)
for r in report:
    print('voice', r)
print('stems written to', STEMS)

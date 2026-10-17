"""
RUMBO · «Cada pequeño paso cuenta» (1:44.5): original score, sound design and voice.

- Score, synthesised here (audio/synth.py): 100 BPM, D major, warm and calm.
  At this tempo the bar lines fall on «RUMBO» (96.0 s) and «Empieza hoy»
  (100.8 s). Air and a lone piano for the hook, a soft pulse when the phone
  appears, a gentle groove from «evolución» to «a tu estilo», drums out for
  privacy, then a lift into the logo and a resolved last chord.
- Sound design: short and delicate, on the beats of the picture
  (src/pasos/beats.json): the light, the path, ticks as each weigh-in lights
  up, the completed set, the water, the colour and theme changes, the save.
- Voice: the picked ElevenLabs takes in audio/voice-pasos/l1…l9.wav (already
  trimmed; their word timings drive the picture), placed at the frames of
  src/pasos/timeline.json, dry.

Writes 48 kHz stems to audio/stems-pasos/ (music, sfx, voice) and the clean,
timeline-aligned narration to out/pasos/; audio/mux.sh mixes and encodes
(npm run mux:pasos).
"""

import json
import os

import numpy as np
import soundfile as sf

import synth
from synth import (
    HALL, ROOM, SR, add, clap, curve, env, fx_bell, fx_boop, fx_bubble, fx_check, fx_click, fx_glow, fx_pop,
    fx_riser, fx_shimmer, fx_swell, fx_tick, fx_whoosh, hat, hp, hz, keys, kick, lp, peaking, pluck, saw, shaker,
    sine, verb,
)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'src', 'pasos')
TL = json.load(open(os.path.join(SRC, 'timeline.json')))
VOICE = json.load(open(os.path.join(SRC, 'voice.json')))
B = json.load(open(os.path.join(SRC, 'beats.json')))
FPS = TL['fps']
FRAMES = TL['frames']
END = FRAMES / FPS
LENGTH = END + 1.0
N = int(LENGTH * SR)
BEAT = 0.6
BAR = 4 * BEAT
STEMS = os.path.join(HERE, 'stems-pasos')
OUT = os.path.join(ROOT, 'out', 'pasos')
os.makedirs(STEMS, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
synth.seed(105)


def fs(frame):
    return frame / FPS


def ws(line, i):
    words = next(v for v in VOICE if v['id'] == line)['words']
    return fs(words[min(i, len(words) - 1)]['f'])


def bar(n):
    return n * BAR


# Sections on bar lines (scene cuts are at 9, 20, 35, 50, 64, 77, 89 s).
APP, EVOL, TRAIN, HABITS, STYLE, PRIV, CLOSE, LOGO, CTA = (bar(n) for n in (4, 8, 15, 21, 27, 32, 37, 40, 42))

# ── Harmony ──────────────────────────────────────────────────────────────
CHORDS = {  # pad voicing (low → high), bass root
    'D': (['D3', 'A3', 'F#4', 'E5'], 'D2'),
    'A/C#': (['C#3', 'A3', 'E4', 'B4'], 'C#2'),
    'Bm': (['B2', 'F#3', 'D4', 'A4'], 'B1'),
    'G': (['G2', 'D3', 'B3', 'F#4'], 'G1'),
    'Em7': (['E3', 'B3', 'D4', 'G4'], 'E2'),
    'A': (['A2', 'E3', 'C#4', 'B4'], 'A1'),
    'Asus': (['A2', 'E3', 'D4', 'B4'], 'A1'),
    'D/F#': (['F#3', 'A3', 'D4', 'E5'], 'F#1'),
}
BARS = [
    'D', 'D', 'Bm', 'G',                                  # hook
    'D', 'A/C#', 'Bm', 'G',                               # a companion
    'D', 'A/C#', 'Bm', 'G', 'Em7', 'A', 'Asus',           # evolution
    'G', 'D/F#', 'Em7', 'D', 'G', 'A',                    # training
    'D', 'A/C#', 'Bm', 'G', 'Em7', 'A',                   # habits
    'G', 'A', 'D', 'Bm', 'A',                             # style
    'Bm', 'G', 'D', 'A', 'Asus',                          # privacy
    'G', 'A', 'Asus',                                     # the close builds
    'D', 'G',                                             # logo, tagline
    'D',                                                  # «Empieza hoy», rings out
]


def chord_at(t):
    return CHORDS[BARS[min(len(BARS) - 1, max(0, int(t // BAR)))]]


def notes(t):
    return sorted(chord_at(t)[0], key=hz)


def grid(t0, t1, step):
    return [t0 + k * step for k in range(int(round((t1 - t0) / step)))]


tonal = np.zeros((N, 2))   # pumped by the kick
drums = np.zeros((N, 2))
wash = np.zeros((N, 2))    # air and risers, never pumped
kicks = []

# Pad: soft detuned saws, low-passed; it opens with the story and breathes for privacy.
CUT = [(0, 600), (APP, 1100), (EVOL, 1500), (TRAIN, 1900), (HABITS, 1800), (STYLE, 2200), (PRIV, 1200), (CLOSE, 1500), (LOGO, 2400), (END, 2000)]
for b, name in enumerate(BARS):
    t0 = bar(b)
    if t0 >= END:
        break
    length = BAR if b < len(BARS) - 1 else END - t0 + 1.0
    n = int((length + 0.9) * SR)
    x = np.zeros(n)
    voicing = CHORDS[name][0]
    for nm in voicing:
        for d in (-0.005, 0.0, 0.0055):
            x += saw(hz(nm) * (1 + d), n, synth.rng.random())
    attack = 2.4 if b == 0 else 0.6
    x = lp(x / 14 * env(n, attack, 0.3, 0.85, 0.9), float(np.interp(t0, *zip(*CUT))))
    add(tonal, np.stack([x, np.roll(x, 380)], 1), t0, 1.0)
tonal *= curve(N, [(0, 0), (0.4, 0), (5, 0.8), (APP, 1.1), (EVOL, 1.0), (PRIV, 0.9), (CLOSE, 1.0), (END, 1.0), (LENGTH, 1.0)])[:, None] * 0.15

# Air: a soft noise bed (the «ambient» of the hook) that thins out as the music arrives.
air = lp(hp(synth.rng.standard_normal(N), 300), 3800) * 0.05
air *= curve(N, [(0, 0), (0.6, 0.8), (6, 1.0), (APP, 0.5), (EVOL, 0.15), (PRIV, 0.3), (CLOSE, 0.1), (LENGTH, 0.05)])
add(wash, np.stack([air, np.roll(air, 2200)], 1), 0, 1.0)

# Hook: a low drone under the first light.
n = int((APP + 0.5) * SR)
t = np.arange(n) / SR
drone = (sine(hz('D2'), n) + 0.3 * sine(hz('A2'), n)) * np.minimum(1, t / 4.0) * np.minimum(1, (n - np.arange(n)) / (0.5 * SR))
add(tonal, drone, 0, 0.05)


def piano(t0, t1, step, pattern, gain, octave=1, dur=1.4, bright=1.0):
    for k, tt in enumerate(grid(t0, t1, step)):
        nm = notes(tt)[pattern[k % len(pattern)]]
        add(tonal, keys(hz(nm) * 2 ** octave, dur, bright), tt, gain, -0.25 if k % 2 else 0.25)


# Piano: a few notes for the hook, flowing eighths from the phone on, sparse for privacy.
for tt, nm in ((2.2, 'A5'), (3.6, 'F#5'), (4.8, 'D5'), (6.0, 'B4'), (7.2, 'D5'), (8.4, 'E5')):
    add(tonal, keys(hz(nm), 2.2), tt, 0.075, 0.2)
piano(APP, EVOL, BEAT / 2, [0, 1, 2, 3, 2, 1, 3, 2], 0.075)
piano(EVOL, TRAIN, BEAT / 2, [0, 2, 1, 3, 2, 1, 3, 2], 0.04)
piano(HABITS, STYLE, BEAT, [0, 2, 3, 1], 0.05)
piano(PRIV, CLOSE, BEAT, [0, 2, 1, 3], 0.07, dur=1.8)
piano(CLOSE, LOGO, BEAT / 2, [0, 1, 2, 3, 2, 1, 2, 3], 0.045)
for i, nm in enumerate(['D4', 'A4', 'D5', 'F#5', 'A5', 'E6']):  # «Empieza hoy»: the last chord, rolled
    add(tonal, keys(hz(nm), 4.0), CTA + 0.08 * i, 0.07, -0.4 + 0.16 * i)

# The phone: a muted pulse on the root.
for k, tt in enumerate(grid(APP, EVOL, BEAT / 2)):
    f = hz(chord_at(tt)[1]) * 2
    n = int(0.2 * SR)
    x = lp(saw(f, n) * 0.6 + sine(f, n), 300 + 600 * (tt - APP) / (EVOL - APP)) * env(n, 0.003, 0.06, 0.5, 0.05)
    add(tonal, x, tt, 0.13 * (1.0 if k % 2 == 0 else 0.6))


def bass(t0, t1, pattern, gain, step=BEAT / 2):
    for k, tt in enumerate(grid(t0, t1, step)):
        v = pattern[k % len(pattern)]
        if not v:
            continue
        j = 1
        while j < len(pattern) and not pattern[(k + j) % len(pattern)]:
            j += 1
        n = int(min(j * step, t1 - tt) * 0.92 * SR)
        f = hz(chord_at(tt)[1])
        x = sine(f, n) * 0.7 + lp(saw(f, n), 500) * 0.35
        add(tonal, x * env(n, 0.005, 0.1, 0.8, 0.06), tt, gain * v)


bass(EVOL, TRAIN, [1, 0, 0, 0.6, 0, 0, 0.8, 0], 0.22)
bass(TRAIN, HABITS, [1, 0, 0.6, 0, 1, 0, 0.6, 0.5], 0.24)
bass(HABITS, STYLE, [1, 0, 0, 0.6, 0, 0, 0.8, 0], 0.22)
bass(STYLE, PRIV, [1, 0, 0.6, 0.8, 0, 0.6, 1, 0], 0.22)
bass(PRIV, CLOSE, [1, 0, 0, 0, 0, 0, 0, 0], 0.16, step=BEAT)
bass(CLOSE + BAR, LOGO, [1, 0, 0.6, 0, 1, 0, 0.6, 0.5], 0.22)
bass(LOGO, CTA, [1, 0, 0, 0.6, 0, 0, 0.8, 0], 0.24)
n = int(3.8 * SR)
add(tonal, sine(hz('D2'), n) * env(n, 0.01, 0.6, 0.7, 2.4), CTA, 0.24)


def arp(t0, t1, step, octave, gain, cutoff, pattern=(0, 1, 2, 3, 2, 1, 2, 3), dur=0.22):
    for k, tt in enumerate(grid(t0, t1, step)):
        nm = notes(tt)[pattern[k % len(pattern)]]
        c = cutoff(tt) if callable(cutoff) else cutoff
        add(tonal, pluck(hz(nm) * 2 ** octave, dur, c), tt, gain, 0.4 if k % 2 else -0.4)


arp(TRAIN, HABITS, BEAT / 4, 1, 0.045, 2600)
arp(STYLE, PRIV, BEAT / 2, 2, 0.05, 5000, pattern=(0, 2, 1, 3, 2, 0, 3, 1), dur=0.3)
arp(CLOSE, LOGO, BEAT / 4, 1, 0.05, lambda tt: 1400 * (4800 / 1400) ** ((tt - CLOSE) / (LOGO - CLOSE)))
arp(LOGO, CTA, BEAT / 4, 1, 0.035, 3000)

# A short, singing line over «a tu estilo».
for beat, nm, length in ((0, 'F#5', 1), (1, 'A5', 1), (2, 'B5', 2), (4, 'A5', 1), (5, 'F#5', 1), (6, 'E5', 2), (8, 'D5', 1), (9, 'E5', 1), (10, 'F#5', 2), (12, 'E5', 3)):
    n = int(length * BEAT * SR)
    tt = np.arange(n) / SR
    x = lp(saw(hz(nm), n) * 0.35 + sine(hz(nm), n), 2400) * env(n, 0.03, 0.1, 0.8, 0.2)
    x = x * (1 + 0.04 * np.sin(2 * np.pi * 5.0 * tt) * np.clip(tt * 3, 0, 1))
    add(tonal, np.stack([x, np.roll(x, 420)], 1), STYLE + bar(2) + beat * BEAT, 0.03)

# ── Drums: soft, never in the way of the voice ───────────────────────────
KICK, CLAP, HC, SHK = kick(0.5), clap(), hat(), shaker()


def k(tt, g=0.7):
    add(drums, KICK, tt, g * 0.42)
    kicks.append((tt, g))


for b, tt in enumerate(grid(EVOL, TRAIN, BEAT)):     # evolution: one and three, shaker
    if b % 2 == 0:
        k(tt, 0.6)
    add(drums, SHK, tt + BEAT / 2, 0.08, 0.3)
for b, tt in enumerate(grid(TRAIN, HABITS, BEAT)):   # training: four on the floor, claps on two and four
    k(tt, 0.7)
    if b % 4 in (1, 3):
        add(drums, CLAP, tt, 0.22)
    add(drums, HC, tt + BEAT / 2, 0.1, 0.25)
for b, tt in enumerate(grid(HABITS, STYLE, BEAT)):   # habits: lighter
    if b % 2 == 0:
        k(tt, 0.6)
    if b % 4 == 2:
        add(drums, CLAP, tt, 0.16)
    for s in (0, BEAT / 4, BEAT / 2, 3 * BEAT / 4):
        add(drums, SHK, tt + s, 0.07 if s else 0.1, 0.3)
for b, tt in enumerate(grid(STYLE, PRIV - BEAT, BEAT)):  # style: bouncy
    k(tt, 0.62)
    if b % 4 in (1, 3):
        add(drums, CLAP, tt, 0.2)
    add(drums, SHK, tt + BEAT / 2, 0.1, 0.3)
for b, tt in enumerate(grid(CLOSE + BAR, LOGO, BEAT)):  # the close builds back
    k(tt, 0.55 + 0.2 * (tt - CLOSE) / (LOGO - CLOSE))
    if tt >= CLOSE + bar(2):
        add(drums, HC, tt + BEAT / 2, 0.1, 0.25)
for b, tt in enumerate(grid(LOGO, CTA, BEAT)):       # logo and tagline
    k(tt, 0.7)
    if b % 4 in (1, 3):
        add(drums, CLAP, tt, 0.18)
    add(drums, HC, tt + BEAT / 2, 0.09, 0.25)
k(CTA, 0.6)

# Risers into the bigger moments.
for start, end, g in ((APP - 1.6, APP, 0.05), (TRAIN - 1.6, TRAIN, 0.05), (LOGO - 2.4, LOGO, 0.08), (CTA - 1.2, CTA, 0.05)):
    add(wash, fx_riser(end - start, 400, 7000), start, g)

pump = np.ones(N)
for kt, g in kicks:
    i = int(kt * SR)
    n = int(0.3 * SR)
    c = 1 - 0.3 * g * np.exp(-np.arange(n) / SR * 12)
    pump[i:i + n] = np.minimum(pump[i:i + n], c[: len(pump[i:i + n])])
music = verb(tonal * pump[:, None], HALL, 0.2) + verb(drums, ROOM, 0.12) + verb(wash, HALL, 0.25)
music = hp(lp(music, 13000, 1), 32, 2)
music *= curve(N, [(0, 1), (END - 1.2, 1), (END, 0), (LENGTH, 0)])[:, None]

# ── Sound design ─────────────────────────────────────────────────────────
sfx = np.zeros((N, 2))


def whoosh(tt, g, length=0.6, lo=300, hi=6000):
    add(sfx, fx_whoosh(length, lo, hi), tt - length / 2, g)


def at(key, offset=0):
    v = B[key]
    return fs((v[0] if isinstance(v, list) else v) + offset)


# Hook: Rumbi's eyes switch on, the light, the path, the logo.
add(sfx, fx_boop(), fs(B['wake'] + 1), 0.16)
add(sfx, fx_glow(hz('A5'), 1.8), at('light'), 0.32)
add(sfx, fx_swell(fs(B['trail'][1] - B['trail'][0]), 220, 2600), at('trail'), 0.12)
add(sfx, fx_shimmer(('D6', 'F#6', 'A6', 'D7')), at('logo'), 0.24)
add(sfx, fx_bell('A5', 1.4), at('logo', 4), 0.14)
add(sfx, fx_bubble(500, 1200), ws('l1', 15), 0.18)  # Rumbi's happy hop

# The phone takes shape.
add(sfx, fx_swell(1.4, 180, 2200), at('outline'), 0.14)
add(sfx, fx_pop(), at('phoneIn', 10), 0.16)
for key in ('scroll1', 'scroll2'):
    whoosh(at(key, 4), 0.06, 0.8, 400, 4000)

# Evolution: page, the chart drawing, a tick for each weigh-in, the lifted cards.
add(sfx, fx_tick(2600), at('toProgress'), 0.12)
add(sfx, fx_swell(fs(B['chartDraw'][1] - B['chartDraw'][0]), 300, 3200), at('chartDraw'), 0.1)
for i in range(17):
    add(sfx, fx_tick(2300 + 80 * i), at('chartDraw') + fs(B['chartDraw'][1] - B['chartDraw'][0]) * (i / 16) ** 0.9, 0.07, -0.6 + 1.2 * i / 16)
for key in ('imc', 'kcal'):
    whoosh(at(key), 0.1, 0.5, 500, 7000)
    add(sfx, fx_pop(), at(key, 4), 0.14)
whoosh(at('zoomChart'), 0.07, 0.8, 200, 3000)
span = B['markers'][1] - B['markers'][0] - 14
for i in range(17):
    add(sfx, fx_tick(2600 + 60 * i), fs(B['markers'][0] + i * span / 17), 0.05, -0.5 + i / 16)

# Training: the card, the session, the completed set (a small achievement), marks, history.
whoosh(at('cardIn'), 0.12, 0.6, 400, 7000)
add(sfx, fx_tick(2400), at('toSession'), 0.12)
add(sfx, fx_click(), at('setDone', -1), 0.2)
add(sfx, fx_check(), at('setDone', 1), 0.24)
add(sfx, fx_shimmer(('A6', 'C#7', 'E7', 'A7'), 0.04, 1.4), at('setDone', 3), 0.16)
add(sfx, fx_bubble(560, 1300), at('setDone', 9), 0.14)
for key in ('records', 'stats'):
    whoosh(at(key), 0.1, 0.5, 500, 7000)
    add(sfx, fx_pop(), at(key, 4), 0.12)
whoosh(at('history', 12), 0.07, 1.2, 300, 3000)
add(sfx, fx_shimmer(('D6', 'F#6', 'A6', 'D7')), at('proud'), 0.2)

# Habits: glasses and steps pop in, fly into the cards, «+ 250», the streak, the calendar.
whoosh(at('toHoy'), 0.08, 0.6, 300, 5000)
for i in range(3):
    add(sfx, fx_bubble(460 + 80 * i, 1100 + 120 * i), at('icons', 5 * i), 0.12, 0.3)
for i in range(2):
    add(sfx, fx_tick(1800 + 300 * i), ws('l5', 3) + fs(6 * i), 0.1, 0.4)
whoosh(at('iconsWater', 4), 0.08, 0.5, 600, 7000)
whoosh(at('iconsSteps', 4), 0.07, 0.5, 600, 7000)
add(sfx, fx_click(), at('water', -2), 0.2)
add(sfx, fx_bubble(420, 1500), at('water'), 0.24)
add(sfx, fx_bell('F#6', 1.0), at('water', 4), 0.12)
whoosh(at('streak'), 0.1, 0.5, 500, 7000)
add(sfx, fx_shimmer(('D6', 'A6', 'D7')), ws('l5', 14), 0.16)
whoosh(at('calendar'), 0.08, 0.7, 250, 3500)

# Style: the accent sheet, cyan, the sheet goes, light theme, the other colours, violet again.
add(sfx, fx_click(), at('sheetUp', -2), 0.2)
add(sfx, fx_swell(0.5, 300, 3000), at('sheetUp'), 0.1)
add(sfx, fx_pop(), at('cyan', -2), 0.16)
add(sfx, fx_glow(hz('E6'), 1.0), at('cyan'), 0.18)
whoosh(at('sheetDown', 6), 0.07, 0.5, 300, 4000)
add(sfx, fx_click(), at('light', -2), 0.2)
add(sfx, fx_glow(hz('A6'), 1.2), at('light'), 0.16)
for i in range(3):
    whoosh(at('fan', 8 * i + 6), 0.06, 0.5, 500, 6000)
add(sfx, fx_click(), at('backViolet', -2), 0.16)

# Privacy: the records float in and settle; a calm, warm glow when they are saved.
for i in range(4):
    add(sfx, fx_bubble(400 + 70 * i, 1000 + 110 * i), at('chipsIn', 8 * i + 4), 0.1, -0.5 + 0.33 * i)
for i in range(4):
    add(sfx, fx_tick(2000 + 150 * i), at('chipsHome', 5 * i + 22), 0.08)
add(sfx, fx_glow(hz('D5'), 2.2), at('saved'), 0.2)
add(sfx, fx_bell('A5', 1.8), at('saved', 2), 0.1)
whoosh(at('phoneOut', 8), 0.08, 0.8, 200, 3000)

# Close: three cards, the path, the logo, the tagline and the button.
for key in ('cardA', 'cardB', 'cardC'):
    whoosh(at(key), 0.08, 0.5, 500, 7000)
    add(sfx, fx_pop(), at(key, 4), 0.12)
add(sfx, fx_shimmer(('D6', 'F#6', 'A6')), ws('l8', 7), 0.16)
add(sfx, fx_swell(fs(B['closeTrail'][1] - B['closeTrail'][0]), 220, 2800), at('closeTrail'), 0.12)
add(sfx, fx_shimmer(('D6', 'F#6', 'A6', 'D7', 'F#7')), LOGO, 0.26)
add(sfx, fx_bell('D6', 1.8), LOGO + 0.02, 0.14)
whoosh(at('tagline'), 0.05, 0.9, 1200, 9000)
add(sfx, fx_pop(), at('cta', -1), 0.16)
add(sfx, fx_bell('A5', 2.4), CTA, 0.12)
sfx = verb(sfx, ROOM, 0.1)
sfx *= curve(N, [(0, 1), (END - 1.0, 1), (END, 0), (LENGTH, 0)])[:, None]

# ── Voice: the ElevenLabs takes, dry, exactly as timed ───────────────────
voice = np.zeros(N)
for line in VOICE:
    x, sr = sf.read(os.path.join(HERE, 'voice-pasos', f"{line['id']}.wav"))
    assert sr == SR
    x = np.asarray(x, dtype=np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x = hp(x, 70, 2)
    x = peaking(x, 3200, 1.2, 1.0)
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.11
    i = int(fs(line['at']) * SR)
    n = min(len(x), N - i)
    voice[i:i + n] += x[:n]
    print('voice', line['id'], 'at', round(fs(line['at']), 2), 's', 'len', round(len(x) / SR, 2), 's')


def write(path, x, peak=0.89, subtype='FLOAT'):
    m = np.max(np.abs(x)) or 1
    sf.write(path, (x / m * peak).astype(np.float32), SR, subtype=subtype)


write(os.path.join(STEMS, 'music.wav'), music)
write(os.path.join(STEMS, 'sfx.wav'), sfx, 0.85)
write(os.path.join(STEMS, 'voice.wav'), np.stack([voice, voice], 1), 0.9)
# The clean narration on the video's timeline, for re-editing or other mixes.
write(os.path.join(OUT, 'RUMBO-cada-paso-cuenta-voz-elevenlabs.wav'), voice[: int(END * SR)], 0.89, 'PCM_24')
print('stems written to', STEMS)

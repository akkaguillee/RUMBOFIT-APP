"""
RUMBO · cinematic cut (84 s): original score, sound design and voice placement.

- Score, synthesised here (audio/synth.py), 120 BPM, A minor resolving to C
  major. It follows the picture: a heartbeat and a lone piano for the hook, a
  pulse when the phone appears, a half-time groove for «evolución», full
  energy for «todo tu esfuerzo cuenta», bright plucks for «a tu estilo», drums
  out for privacy, then a build that drops on the end card and a final sting.
- Sound design: heartbeats, whooshes on every camera move, UI ticks, pops and
  chimes on the real screens, impacts on the big moments.
- Voice: the ElevenLabs takes in audio/voice-cine/<id>.wav, placed at the
  frames in src/cine/voice.json (same trim as audio/align_voice.py), dry.

Cue times come from the voice words (ws('c7', 6) = 7th word of line c7) and
the scene frames in src/cine/, so picture, sound and voice share one clock.
Writes 48 kHz stems to audio/stems-cine/; audio/mux.sh mixes and encodes them
(npm run mux:cine).
"""

import json
import os

import numpy as np
import soundfile as sf

import synth
from synth import (
    HALL, ROOM, SR, add, clap, curve, cymbal, env, fx_bell, fx_boop, fx_bubble, fx_check, fx_click, fx_glow, fx_heart,
    fx_ignite, fx_impact, fx_pop, fx_reverse, fx_riser, fx_shimmer, fx_swell, fx_thud, fx_tick, fx_whoosh, hat, hp, hz,
    keys, kick, lp, peaking, pluck, saw, shaker, sine, snare, tom, verb,
)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VOICE = json.load(open(os.path.join(ROOT, 'src', 'cine', 'voice.json')))
FPS = 30
FRAMES = 2520
LENGTH = FRAMES / FPS + 1.0
N = int(LENGTH * SR)
BEAT = 0.5
STEMS = os.path.join(HERE, 'stems-cine')
os.makedirs(STEMS, exist_ok=True)
synth.seed(84)


def fs(frame):
    return frame / FPS


def ws(line, i):
    """Seconds where word i of voice line `line` starts."""
    words = next(v for v in VOICE if v['id'] == line)['words']
    return fs(words[min(i, len(words) - 1)]['f'])


# Scenes (src/cine/timing.ts) and the moments the picture hangs on.
REVEAL, EVOL, EFFORT, STYLE, PRIV, FINALE = 9.0, 18.0, 31.5, 42.0, 50.0, 60.0
BRAND = ws('c4', 3)                 # logo on «Rumbo»
END = ws('c12', 0)                  # end card
STING = ws('c13', 13) + fs(14)      # final ring on the end card
PUSH = ws('c11', 0) - fs(12)        # phone push-in before the end card

# ── Harmony ──────────────────────────────────────────────────────────────
CHORDS = {  # pad voicing, bass root
    'Am': (['A3', 'C4', 'E4', 'B4'], 'A1'),
    'Am7': (['G3', 'C4', 'E4', 'A4'], 'A1'),
    'F': (['F3', 'A3', 'C4', 'E4'], 'F1'),
    'C': (['G3', 'C4', 'E4', 'D5'], 'C2'),
    'G': (['G3', 'B3', 'D4', 'A4'], 'G1'),
    'G/B': (['G3', 'B3', 'D4', 'A4'], 'B1'),
    'Gsus': (['G3', 'C4', 'D4', 'A4'], 'G1'),
    'Dm': (['F3', 'A3', 'D4', 'E4'], 'D2'),
}
PROG = [
    (0, 'Am'), (4, 'F'), (8, 'Gsus'),                                       # hook
    (9, 'C'), (11, 'G/B'), (13, 'Am'), (15, 'F'), (17, 'Gsus'),            # reveal
    (18, 'Am'), (20, 'F'), (22, 'C'), (24, 'G'), (26, 'Am'), (28, 'F'), (30, 'G'),  # evolution
    (31.5, 'F'), (33.5, 'G'), (35.5, 'Am'), (37.5, 'C'), (39.5, 'F'), (41.5, 'G'),  # effort
    (42, 'C'), (44, 'G'), (46, 'Am'), (48, 'F'),                            # style
    (50, 'F'), (52, 'Am7'), (54, 'Dm'), (56, 'F'), (58, 'Gsus'),           # privacy
    (60, 'Am'), (62, 'F'), (64, 'C'), (66, 'G'), (68, 'Am'), (70, 'F'), (72, 'G'),  # build
    (END, 'C'), (END + 2, 'G'), (END + 4, 'Am'), (END + 6, 'F'), (END + 8, 'C'),    # end card
    (LENGTH + 1, None),
]


def chord_at(t):
    name = next(c for s, c in reversed(PROG) if s <= t + 1e-6)
    return CHORDS[name]


def notes(t):
    return sorted(chord_at(t)[0], key=hz)


def grid(t0, t1, step):
    return [t0 + k * step for k in range(int(round((t1 - t0) / step)))]


tonal = np.zeros((N, 2))   # pumped by the kick
drums = np.zeros((N, 2))
wash = np.zeros((N, 2))    # risers, never pumped
kicks = []

# Pad: wide detuned saws, opened up as the film gains energy.
CUT = [(0, 650), (8.5, 1000), (9, 1400), (18, 1700), (31.5, 2400), (42, 2900), (49, 1500), (50, 1150), (60, 1250), (70, 2600), (END, 2700), (LENGTH, 2400)]
pad = np.zeros((N, 2))
for (t0, name), (t1, _) in zip(PROG, PROG[1:]):
    if name is None:
        continue
    t1 = min(t1, LENGTH)
    s0 = 1.0 if t0 == 0 else t0  # the first chord breathes in after the first heartbeat
    n = int((t1 - s0 + 0.9) * SR)
    x = np.zeros(n)
    voicing = CHORDS[name][0]
    for nm in voicing + [voicing[-1][:-1] + str(int(voicing[-1][-1]) + 1)]:
        for d in (-0.006, 0.0, 0.0065):
            x += saw(hz(nm) * (1 + d), n, synth.rng.random())
    attack = 2.6 if t0 == 0 else (0.25 if EVOL <= t0 < PRIV or t0 >= END else 0.5)
    x = lp(x / 15 * env(n, attack, 0.3, 0.85, 0.8), float(np.interp(t0, *zip(*CUT))))
    add(pad, np.stack([x, np.roll(x, 340)], 1), s0, 1.0)
pad *= curve(N, [(0, 0), (1.0, 0), (4, 0.75), (9, 1.0), (17.5, 1.0), (18, 1.5), (31.5, 1.6), (42, 1.6), (49, 1.6), (50, 1.15), (60, 1.05), (66, 1.4), (END, 1.7), (LENGTH, 1.7)])[:, None]
tonal += pad * 0.16


# Strings: the two top notes an octave up, slow bow, for privacy and the close.
def string(f, n):
    t = np.arange(n) / SR
    ph = np.cumsum(f * (1 + 0.003 * np.sin(2 * np.pi * 5.1 * t + synth.rng.random() * 6))) / SR
    return sum(np.sin(2 * np.pi * k * ph) / k for k in range(1, 7))


for (t0, name), (t1, _) in zip(PROG, PROG[1:]):
    if name is None or t0 < PRIV - 0.01:
        continue
    t1 = min(t1, LENGTH)
    n = int((t1 - t0 + 1.0) * SR)
    x = sum(string(hz(nm) * 2, n) for nm in CHORDS[name][0][-2:])
    x = lp(x * env(n, 0.9, 0.2, 0.9, 1.0), 2600) * 0.05
    add(tonal, np.stack([x, np.roll(x, 520)], 1), t0, float(np.interp(t0, [PRIV, 59, FINALE, 68, END], [0.7, 1.0, 0.8, 1.0, 1.2])))

# Hook: a low drone that breathes in under the heartbeat.
n = int((REVEAL - 1.0) * SR)
t = np.arange(n) / SR
drone = (sine(hz('A1'), n) + 0.35 * sine(hz('A2'), n) + 0.12 * sine(hz('E3'), n)) * (t / t[-1]) ** 1.5
drone *= np.minimum(1, (n - np.arange(n)) / (0.08 * SR))
add(tonal, drone, 1.0, 0.12)


# Piano: chord tones in a gentle pattern.
def piano(t0, t1, step, pattern, gain, octave=1, dur=1.3, bright=1.0):
    for k, t in enumerate(grid(t0, t1, step)):
        nm = notes(t)[pattern[k % len(pattern)]]
        add(tonal, keys(hz(nm) * 2 ** octave, dur, bright), t, gain, -0.25 if k % 2 else 0.25)


piano(3.0, REVEAL, 0.5, [0, 2, 3, 1], 0.085)
piano(REVEAL, EVOL, 0.25, [0, 1, 2, 3, 2, 1], 0.055, dur=1.0)
piano(PRIV, FINALE, 0.5, [0, 2, 1, 3], 0.08, dur=1.6)
piano(FINALE, 64, 0.5, [0, 2, 3, 1], 0.075)
piano(64, 72, 0.25, [0, 1, 2, 3, 2, 1, 3, 2], 0.045, dur=0.9)
piano(END, END + 8, 0.5, [0, 2, 3, 2], 0.04, bright=1.15)
for i, nm in enumerate(['C4', 'G4', 'C5', 'E5', 'G5', 'C6']):  # the last chord, rolled
    add(tonal, keys(hz(nm), 3.4), END + 8 + 0.09 * i, 0.07, -0.4 + 0.16 * i)

# Reveal: a muted pulse on the root that opens up.
for k, t in enumerate(grid(REVEAL, EVOL, 0.25)):
    f = hz(chord_at(t)[1]) * 2
    n = int(0.22 * SR)
    x = lp(saw(f, n) * 0.7 + sine(f, n), 250 + 900 * (t - REVEAL) / (EVOL - REVEAL)) * env(n, 0.003, 0.06, 0.5, 0.05)
    add(tonal, x, t, (0.1 + 0.06 * (t - REVEAL) / 9) * (1.0 if k % 2 == 0 else 0.7))


# Bass: sine sub plus a filtered saw, rhythm per section.
def bass(t0, t1, pattern, gain, octave_on=(), step=0.25):
    for k, t in enumerate(grid(t0, t1, step)):
        v = pattern[k % len(pattern)]
        if not v:
            continue
        j = 1
        while j < len(pattern) and not pattern[(k + j) % len(pattern)]:
            j += 1
        n = int(min(j * step, t1 - t) * 0.92 * SR)
        f = hz(chord_at(t)[1]) * (2 if k % len(pattern) in octave_on else 1)
        x = sine(f, n) * 0.6 + lp(saw(f, n), 700) * 0.5
        add(tonal, x * env(n, 0.004, 0.08, 0.8, 0.05), t, gain * v * 0.6)


bass(EVOL, EFFORT, [1, 0, 0, 0.7, 0, 0, 0.8, 0], 0.3)
bass(EFFORT, STYLE - 0.5, [0.8, 1, 0.6, 1, 0.8, 1, 0.6, 1], 0.3, octave_on=(3, 7))
bass(STYLE, 49.0, [1, 0, 0.7, 1, 0, 0.7, 1, 0.5], 0.28, octave_on=(3, 7))
bass(PRIV, FINALE, [1, 0, 0, 0, 0, 0, 0, 0], 0.22, step=0.5)
bass(62, 66, [1, 0, 0, 0, 0, 0, 0, 0], 0.26, step=0.25)
bass(66, 72, [0.8, 1, 0.6, 1, 0.8, 1, 0.6, 1], 0.3, octave_on=(3, 7))
bass(END, END + 8, [1, 0, 0, 0.7, 0, 0, 0.8, 0], 0.3)
n = int(3.6 * SR)
add(tonal, sine(hz('C2'), n) * env(n, 0.01, 0.5, 0.7, 2.2), END + 8, 0.26)


# Arps and plucks.
def arp(t0, t1, step, octave, gain, cutoff, pattern=(0, 1, 2, 3, 2, 1, 2, 3), dur=0.2):
    for k, t in enumerate(grid(t0, t1, step)):
        nm = notes(t)[pattern[k % len(pattern)]]
        c = cutoff(t) if callable(cutoff) else cutoff
        add(tonal, pluck(hz(nm) * 2 ** octave, dur, c), t, gain, 0.4 if k % 2 else -0.4)


arp(22, EFFORT, 0.125, 1, 0.065, 2200)
arp(EFFORT, STYLE - 0.5, 0.125, 1, 0.07, 3800, pattern=(0, 1, 2, 3, 1, 2, 3, 2))
arp(STYLE, 49.0, 0.25, 2, 0.055, 5200, pattern=(0, 2, 1, 3, 2, 0, 3, 1), dur=0.3)
arp(64, 72, 0.125, 1, 0.065, lambda t: 1500 * (5200 / 1500) ** ((t - 64) / 8))
arp(END, END + 8, 0.125, 1, 0.045, 2800)

# Lead: a rising line through «todo tu esfuerzo cuenta», singing in the pause before «a tu estilo».
LEAD = [(4, 'D5', 1), (5, 'E5', 1), (6, 'G5', 2), (8, 'A5', 1.5), (9.5, 'G5', 0.5), (10, 'E5', 2),
        (12, 'G5', 1), (13, 'C6', 1), (14, 'D6', 1), (15, 'E6', 1), (16, 'C6', 1.5), (17.5, 'A5', 0.5),
        (18, 'C6', 1), (19, 'D6', 0.5), (19.5, 'E6', 0.5), (20, 'D6', 1), (21, 'E6', 3)]
for beat, nm, length in LEAD:
    n = int(length * BEAT * SR)
    tt = np.arange(n) / SR
    x = lp(saw(hz(nm), n) * 0.45 + sine(hz(nm), n), 2600) * env(n, 0.02, 0.1, 0.8, 0.15)
    x = x * (1 + 0.05 * np.sin(2 * np.pi * 5.2 * tt) * np.clip(tt * 3, 0, 1))
    add(tonal, np.stack([x, np.roll(x, 420)], 1), EFFORT + beat * BEAT, 0.036 if beat < 18 else 0.05)

# ── Drums ────────────────────────────────────────────────────────────────
KICK, CLAP, SNARE, HC, HO, SHK, CYM = kick(), clap(), snare(), hat(), hat(True), shaker(), cymbal()
TOM_LO, TOM_HI = tom(72), tom(108)


def k(t, g=0.9):
    add(drums, KICK, t, g * 0.5)
    kicks.append((t, g))


# Evolution: half-time groove.
for b, t in enumerate(grid(EVOL, EFFORT, BEAT)):
    p = b % 4
    if p == 0:
        k(t)
    if p == 1:
        k(t + 0.25, 0.6)
    if p == 2 and t < 30.5:
        add(drums, CLAP, t, 0.42)
    add(drums, HC, t + 0.25, 0.2, 0.25)
    if t >= 24:
        add(drums, HC, t, 0.1, -0.25)
for i, t in enumerate(grid(30.5, EFFORT, 0.125)):
    add(drums, SNARE, t, 0.08 + 0.03 * i)
add(drums, TOM_LO, 31.25, 0.35)

# Effort: four on the floor, full energy.
add(drums, CYM, EFFORT, 0.9)
for b, t in enumerate(grid(EFFORT, 41.5, BEAT)):
    p = b % 4
    k(t, 0.95)
    if p in (1, 3) and t < 40.5:
        add(drums, CLAP, t, 0.45)
    add(drums, HO, t + 0.25, 0.17, 0.35)
    for s in (0.125, 0.375):
        add(drums, HC, t + s, 0.1, -0.3)
for i, t in enumerate(grid(40.5, 41.5, 0.125)):
    add(drums, SNARE, t, 0.1 + 0.035 * i)
for i, t in enumerate(grid(41.5, STYLE, 0.125)):
    add(drums, TOM_HI if i < 2 else TOM_LO, t, 0.3)

# Style: lighter and bouncy, shaker instead of hats; out before privacy.
add(drums, CYM, STYLE, 0.6)
for b, t in enumerate(grid(STYLE, 49.0, BEAT)):
    k(t, 0.75)
    if b % 4 in (1, 3):
        add(drums, CLAP, t, 0.36)
    for s in (0, 0.125, 0.25, 0.375):
        add(drums, SHK, t + s, 0.14 if s == 0.25 else 0.08, 0.3)
k(49.0, 0.8)

# Build: half-time, then four on the floor, then a snare roll into the end card.
for b, t in enumerate(grid(62, 66, BEAT)):
    p = b % 4
    if p == 0:
        k(t, 0.7)
    if p == 1:
        k(t + 0.25, 0.45)
    if t >= 64:
        add(drums, HC, t + 0.25, 0.16, 0.25)
        if p == 2:
            add(drums, CLAP, t, 0.36)
for b, t in enumerate(grid(66, 71.5, BEAT)):
    k(t, 0.85)
    if b % 4 in (1, 3) and t < 70:
        add(drums, CLAP, t, 0.42)
    add(drums, HO, t + 0.25, 0.14, 0.35)
    add(drums, HC, t + 0.125, 0.08, -0.3)
    add(drums, HC, t + 0.375, 0.08, -0.3)
roll = grid(70, 71, 0.25) + grid(71, 71.75, 0.125) + grid(71.75, 72.15, 0.0625)
for i, t in enumerate(roll):
    add(drums, SNARE, t, 0.1 + 0.3 * i / len(roll))

# End card: steady and lighter under the voice; stops for the last chord.
add(drums, CYM, END, 1.0)
for b, t in enumerate(grid(END, END + 8, BEAT)):
    k(t, 0.8)
    if b % 4 in (1, 3):
        add(drums, CLAP, t, 0.34)
    add(drums, HC, t + 0.25, 0.15, 0.25)
add(drums, CYM, END + 8, 0.55)

# Risers into the cuts.
for start, end, g in ((7.4, REVEAL, 0.1), (16.9, EVOL, 0.06), (29.5, EFFORT, 0.1), (40.9, STYLE, 0.07), (68.4, END - 0.2, 0.13)):
    add(wash, fx_riser(end - start), start, g)

# Sidechain pump from the kicks, then space.
pump = np.ones(N)
for kt, g in kicks:
    i = int(kt * SR)
    n = int(0.3 * SR)
    c = 1 - 0.42 * (g / 0.9) * np.exp(-np.arange(n) / SR * 13)
    pump[i:i + n] = np.minimum(pump[i:i + n], c[: len(pump[i:i + n])])
music = verb(tonal * pump[:, None], HALL, 0.16) + verb(drums, ROOM, 0.12) + verb(wash, HALL, 0.2)
music = hp(lp(music, 14000, 1), 30, 2)
# Breath before the end card, and the tail.
music *= curve(N, [(0, 1), (END - 0.25, 1), (END - 0.12, 0.08), (END - 0.01, 0.08), (END, 1), (82.8, 1), (FRAMES / FPS, 0), (LENGTH, 0)])[:, None]

# ── Sound design ─────────────────────────────────────────────────────────
sfx = np.zeros((N, 2))


def whoosh(t, g, length=0.6, lo=250, hi=7000, rev=False):
    x = fx_whoosh(length, lo, hi)
    add(sfx, x[:, ::-1] if rev else x, t - length / 2, g)


def reverse_into(t, g, length=1.2):
    add(sfx, fx_reverse(length), t - length, g)


# Hook: heartbeat (frames 0/9, 38/47, 76/85), the light, Rumbi, the words, the measuring rule.
# Sounded one frame late: a thump on the very first sample is distorted by AAC encoders.
for b in (1, 39, 77):
    add(sfx, fx_heart(True), fs(b), 0.9)
    add(sfx, fx_heart(False), fs(b + 9), 0.9)
add(sfx, fx_glow(hz('A5'), 1.8), fs(10), 0.5)
add(sfx, fx_shimmer(('A5', 'C6', 'E6', 'A6'), 0.06), fs(46), 0.32)
add(sfx, fx_boop(), fs(52), 0.22)
for f in (70, 92, 114):
    add(sfx, fx_thud(), fs(f), 0.22)
    whoosh(fs(f) + 0.1, 0.1, 0.35, 400, 5000)
rule = ws('c2', 9)  # «motivación»
for i in range(14):
    add(sfx, fx_tick(2400 + 130 * i), rule + fs(2 * i), 0.22, -0.6 + 1.2 * i / 13)
add(sfx, fx_check(), rule + fs(28), 0.35)
add(sfx, fx_click(), fs(236), 0.28)
reverse_into(REVEAL, 0.5)
add(sfx, fx_impact(), REVEAL, 0.75)
whoosh(REVEAL, 0.4)

# Reveal: the phone rises, Rumbi points, the brand lands.
add(sfx, fx_swell(1.2, 150, 1800), REVEAL + 0.1, 0.32)
for line in (0, 4, 8):  # the three lines of c3
    add(sfx, fx_tick(2600), ws('c3', line), 0.18)
add(sfx, fx_click(), fs(270 + 150), 0.3)
whoosh(fs(270 + 162), 0.2, 0.5, 600, 8000)
add(sfx, fx_bell('E6'), fs(270 + 172), 0.28)
reverse_into(BRAND - fs(4), 0.35, 1.0)
add(sfx, fx_impact(), BRAND - fs(4), 0.8)
add(sfx, fx_shimmer(), BRAND - fs(4), 0.45)
whoosh(EVOL, 0.38)

# Evolution: phone and chart card, the log entries, the scroll, the goals.
add(sfx, fx_swell(1.0, 200, 2000), EVOL, 0.2)
whoosh(EVOL + fs(22), 0.18, rev=True)
for i in range(4):
    add(sfx, fx_bubble(560 + 90 * i, 1300 + 120 * i), EVOL + fs(54 + 12 * i), 0.5, -0.4)
whoosh(EVOL + fs(148), 0.14, 0.8, 200, 3000)
add(sfx, fx_boop(), ws('c6', 2), 0.26)
for word in (3, 6):  # «perder grasa», «ganar masa muscular»
    add(sfx, fx_pop(), ws('c6', word), 0.32, 0.3)
    add(sfx, fx_check(), ws('c6', word) + fs(10), 0.26, 0.3)
reverse_into(EFFORT, 0.45)
add(sfx, fx_impact(), EFFORT, 0.7)
whoosh(EFFORT, 0.4)

# Effort: the camera travels from piece to piece (right to left), the streak ignites.
for word in (0, 2, 3, 4, 6, 10, 16):
    whoosh(ws('c7', word), 0.24, 0.5, 300, 6000, rev=True)
    add(sfx, fx_pop(), ws('c7', word) + fs(4), 0.16)
add(sfx, fx_ignite(), ws('c7', 6) + fs(2), 0.5)
for t in (ws('c7', 6) + fs(4), ws('c7', 19) + fs(6)):
    add(sfx, fx_click(), t, 0.25)
reverse_into(STYLE, 0.3, 0.9)
whoosh(STYLE, 0.4)

# Style: Rumbi's taps, the light theme, every accent, back to dark.
for f in (70, 112, 212):
    add(sfx, fx_click(), STYLE + fs(f), 0.35, -0.2)
whoosh(STYLE + fs(80), 0.2, 0.5, 800, 12000)
add(sfx, fx_shimmer(('C7', 'E7', 'G7', 'C8')), STYLE + fs(72), 0.3)
for i, (f, nm) in enumerate(zip((116, 132, 148, 164, 180, 196), ('C6', 'D6', 'E6', 'G6', 'A6', 'C7'))):
    add(sfx, fx_bell(nm, 0.9), STYLE + fs(f), 0.3, -0.5 + 0.2 * i)
    whoosh(STYLE + fs(f + 6), 0.06, 0.3, 1500, 9000)
whoosh(STYLE + fs(222), 0.22, 0.5, 150, 2500)
add(sfx, fx_thud(), STYLE + fs(214), 0.35)

# Privacy: the data orbit and settle inside, the ring closes, the real card.
for i in range(6):
    add(sfx, fx_bubble(420 + 70 * i, 1000 + 110 * i), PRIV + fs(6 + 5 * i), 0.3, -0.6 + 0.24 * i)
IN, CLOSE = ws('c9', 5), ws('c9', 8)
whoosh(CLOSE - fs(17), 0.14, 0.6, 500, 6000)
reverse_into(IN + fs(43), 0.25, 1.4)
add(sfx, fx_thud(), IN + fs(43), 0.2)
add(sfx, fx_bell('A5', 2.0), IN + fs(43), 0.2)
add(sfx, fx_shimmer(('A5', 'C6', 'E6', 'A6', 'C7', 'E7'), 0.28, 3.4), CLOSE - fs(10), 0.3)
add(sfx, fx_glow(hz('A4'), 2.0), CLOSE - fs(10), 0.4)
card = ws('c9', 12) - fs(4)
add(sfx, fx_swell(0.9, 200, 2500), card - 0.2, 0.25)
add(sfx, fx_pop(), card + fs(9), 0.18)
add(sfx, fx_boop(), card + fs(2), 0.22)
add(sfx, fx_click(), ws('c9', 21), 0.25)
whoosh(FINALE, 0.35)

# Finale: the checkpoints along the route, the push-in, the end card, the button, the sting.
for i, (word, nm) in enumerate(zip((6, 11, 15, 22), ('A5', 'C6', 'E6', 'A6'))):
    add(sfx, fx_bell(nm, 1.4), ws('c10', word), 0.3 + 0.03 * i, -0.3 + 0.2 * i)
add(sfx, fx_check(), ws('c10', 22) + fs(4), 0.3)
whoosh(PUSH + 0.4, 0.34, 1.0, 120, 3000)
add(sfx, fx_swell(1.2, 150, 2200), PUSH, 0.2)
reverse_into(END, 0.55, 1.6)
add(sfx, fx_impact(2.4), END, 0.9)
add(sfx, fx_shimmer(('C6', 'E6', 'G6', 'C7', 'E7')), END, 0.45)
add(sfx, fx_click(), END + fs(4), 0.25)
add(sfx, fx_glow(hz('C5'), 2.2), END + fs(6), 0.3)
url = ws('c13', 3) - fs(4)
whoosh(url + 0.2, 0.1, 0.4, 1000, 8000)
add(sfx, fx_tick(3000), url, 0.15)
button = ws('c13', 9) - fs(6)
add(sfx, fx_pop(), button, 0.35)
add(sfx, fx_click(), button + fs(3), 0.2)
add(sfx, fx_impact(2.6, 34), STING, 0.7)
add(sfx, fx_shimmer(('C5', 'G5', 'C6', 'E6', 'G6', 'C7'), 0.04, 3.0), STING, 0.55)
sfx = verb(sfx, ROOM, 0.08)
sfx *= curve(N, [(0, 1), (82.8, 1), (FRAMES / FPS, 0), (LENGTH, 0)])[:, None]

# ── Voice: ElevenLabs takes, dry ─────────────────────────────────────────
voice = np.zeros(N)
for line in VOICE:
    x, _sr = sf.read(os.path.join(HERE, 'voice-cine', f"{line['id']}.wav"))
    x = np.asarray(x, dtype=np.float64)
    e = np.abs(x)
    idx = np.where(e > 0.01 * e.max())[0]
    x = x[max(0, idx[0] - 400): idx[-1] + 2400]
    x = hp(x, 80, 2)
    x = peaking(x, 3500, 1.0, 1.0)
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.11
    i = int(fs(line['at']) * SR)
    n = min(len(x), N - i)
    voice[i:i + n] += x[:n]
    print('voice', line['id'], 'at', round(fs(line['at']), 2), 's', 'len', round(len(x) / SR, 2), 's')


def write(name, x, peak=0.89):
    m = np.max(np.abs(x)) or 1
    sf.write(os.path.join(STEMS, name), (x / m * peak).astype(np.float32), SR, subtype='FLOAT')


write('music.wav', music)
write('sfx.wav', sfx, 0.85)
write('voice.wav', np.stack([voice, voice], 1), 0.9)
print('stems written to', STEMS)

"""
RUMBO · «Cada pequeño paso cuenta» (1:04): original score, sound design and voice.

- Score, synthesised here (audio/synth.py): 120 BPM, so a beat is exactly 15
  frames and a bar 2 s; B minor / D major, Bm – G – D – A. An anthem built
  for energy: a pulsing intro that builds under the hook, a drop on the phone
  (8 s), a driving groove under the narration, the full chorus with the lead
  hook while the screens speak for themselves (habits, style), a breakdown
  for privacy, a build, and the final drop on «¡RUMBO!» (56 s).
- Sound design on the beats of the picture (src/pasos/beats.json): hits under
  the big words, whooshes on the whips, ticks as weigh-ins light up, the set,
  the water, each colour, the impacts on the drops.
- Voice: the picked ElevenLabs takes in audio/voice-energia/ (already trimmed;
  their word timings drive the picture), placed at the frames of
  src/pasos/timeline.json, dry.

Writes 48 kHz stems to audio/stems-pasos/ (music, sfx, voice) and the clean,
timeline-aligned narration to out/pasos/; audio/mux.sh mixes and encodes
(npm run mux:pasos).
"""

import json
import os

import numpy as np
import soundfile as sf
from scipy.ndimage import maximum_filter1d

import synth
from synth import (
    HALL, ROOM, SR, add, clap, curve, cymbal, env, fx_bell, fx_boop, fx_bubble, fx_check, fx_click, fx_glow, fx_ignite,
    fx_impact, fx_pop, fx_reverse, fx_riser, fx_shimmer, fx_swell, fx_thud, fx_tick, fx_whoosh, hat, hp, hz, kick, lp,
    peaking, pluck, saw, snare, sine, st, sweep, tom, verb,
)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'src', 'pasos')
TL = json.load(open(os.path.join(SRC, 'timeline.json')))
VOICE = json.load(open(os.path.join(SRC, 'voice.json')))
B = json.load(open(os.path.join(SRC, 'beats.json')))
FPS = TL['fps']
END = TL['frames'] / FPS
LENGTH = END + 1.0
N = int(LENGTH * SR)
BEAT = 60 / TL['bpm']
BAR = 4 * BEAT
STEMS = os.path.join(HERE, 'stems-pasos')
OUT = os.path.join(ROOT, 'out', 'pasos')
os.makedirs(STEMS, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
synth.seed(120)
rng = np.random.default_rng(120)


def fs(frame):
    return frame / FPS


def bar(n):
    return n * BAR


def grid(t0, t1, step):
    return [t0 + k * step for k in range(int(round((t1 - t0) / step)))]


# Sections, in bars (scene cuts sit on bar lines: see src/pasos/timeline.json).
DROP1, EVOL, TRAIN, CHORUS, STYLE, BREAK, BUILD, DROP2, LAST = (bar(n) for n in (4, 8, 12, 16, 20, 23, 26, 28, 31))

# ── Harmony ──────────────────────────────────────────────────────────────
CHORDS = {  # voicing (low → high), bass root
    'Bm': (['B3', 'D4', 'F#4', 'B4'], 'B1'),
    'G': (['G3', 'B3', 'D4', 'G4'], 'G1'),
    'D': (['A3', 'D4', 'F#4', 'A4'], 'D2'),
    'A': (['A3', 'C#4', 'E4', 'A4'], 'A1'),
    'Em': (['G3', 'B3', 'E4', 'G4'], 'E2'),
}
LOOP = ['Bm', 'G', 'D', 'A']


def chord(t):
    b = int(t // BAR)
    if b >= 31:
        return CHORDS['D']
    return CHORDS[LOOP[b % 4]]


tonal = np.zeros((N, 2))    # pumped by the kick
drums = np.zeros((N, 2))
wash = np.zeros((N, 2))     # risers and air, never pumped
kicks = []


def supersaw(f, n, voices=7, spread=0.011):
    out = np.zeros((n, 2))
    for v in range(voices):
        d = (v - (voices - 1) / 2) / ((voices - 1) / 2) * spread
        x = saw(f * (1 + d), n, rng.random())
        pan = (v / (voices - 1)) * 2 - 1
        out[:, 0] += x * np.cos((pan * 0.8 + 1) * np.pi / 4)
        out[:, 1] += x * np.sin((pan * 0.8 + 1) * np.pi / 4)
    return out / voices


# Chords: wide supersaws. Filter and level follow the song; they pump with the kick.
CUT = [(0, 350), (bar(2), 900), (DROP1 - 0.01, 2200), (DROP1, 2600), (EVOL, 2400), (TRAIN, 2800), (CHORUS, 5200), (BREAK, 2000), (BUILD, 1800),
       (DROP2 - 0.01, 6000), (DROP2, 5600), (LAST, 4200), (END, 2400)]
LEVEL = [(0, 0.55), (DROP1, 0.75), (EVOL, 0.7), (TRAIN, 0.75), (CHORUS, 1.0), (BREAK, 0.95), (BUILD, 0.9), (DROP2, 1.0), (LENGTH, 1.0)]
for b in range(32):
    t0 = bar(b)
    length = BAR if b < 31 else END - t0 + 1.0
    n = int((length + 0.3) * SR)
    x = np.zeros((n, 2))
    for nm in chord(t0)[0]:
        x += supersaw(hz(nm), n)
    cut = float(np.interp(t0 + 0.2, *zip(*CUT)))
    x = sweep(x, cut * 0.8, cut * 1.15) if b in (2, 3, 26, 27) else lp(x, cut)
    attack = 1.6 if b == 0 else 0.01
    x *= env(n, attack, 0.2, 0.85, 0.3)[:, None]
    add(tonal, x * float(np.interp(t0, *zip(*LEVEL))), t0, 0.11)

# Bass: off-beat in the intro, galloping eighths under the narration, rolling sixteenths in the chorus.
def bass_note(f, length, cutoff=900):
    n = int(length * SR)
    x = sine(f, n) * 0.8 + lp(saw(f, n, rng.random()) + saw(f * 1.005, n, rng.random()), cutoff) * 0.35
    return x * env(n, 0.004, 0.08, 0.75, 0.04)


def bassline(t0, t1, step, pattern, gain, cutoff=900, octave=0):
    for k, tt in enumerate(grid(t0, t1, step)):
        v = pattern[k % len(pattern)]
        if v:
            f = hz(chord(tt)[1]) * 2 ** octave * (2 if v == 2 else 1)
            add(tonal, bass_note(f, step * 0.9, cutoff), tt, gain)


bassline(bar(2), DROP1 - BEAT / 2, BEAT / 2, [0, 1], 0.2, 500)
bassline(DROP1, CHORUS, BEAT / 2, [1, 1, 1, 2, 1, 1, 2, 1], 0.2, 800)
bassline(CHORUS, BREAK, BEAT / 4, [1, 0, 1, 1, 2, 0, 1, 1], 0.2, 1100)
bassline(BREAK, BUILD, BEAT / 2, [1, 0, 1, 1], 0.12, 450)
bassline(BUILD, DROP2 - BEAT / 2, BEAT / 2, [1, 1], 0.17, 600)
bassline(DROP2, LAST, BEAT / 4, [1, 0, 1, 1, 2, 0, 1, 1], 0.21, 1200)
for t0, t1 in ((DROP1, CHORUS), (CHORUS, BREAK), (DROP2, LAST)):  # sub on every beat
    for tt in grid(t0, t1, BEAT):
        n = int(BEAT * 0.95 * SR)
        add(tonal, sine(hz(chord(tt)[1]), n) * env(n, 0.005, 0.1, 0.8, 0.05), tt, 0.16)
n = int(3.2 * SR)
add(tonal, sine(hz('D2'), n) * env(n, 0.005, 0.5, 0.8, 2.0), LAST, 0.28)

# Arp: sixteenth plucks under the narration, opening as the sections go.
def arp(t0, t1, gain, cutoff, octave=1, pattern=(0, 1, 2, 3, 2, 1, 3, 2)):
    for k, tt in enumerate(grid(t0, t1, BEAT / 4)):
        nm = chord(tt)[0][pattern[k % len(pattern)]]
        c = cutoff(tt) if callable(cutoff) else cutoff
        add(tonal, pluck(hz(nm) * 2 ** octave, 0.18, c), tt, gain, 0.45 if k % 2 else -0.45)


arp(bar(1), DROP1, 0.05, lambda tt: 700 + 2600 * (tt - bar(1)) / (DROP1 - bar(1)))
arp(DROP1, CHORUS, 0.045, 3200)
arp(CHORUS, BREAK, 0.04, 5000, 2)
arp(BREAK, BUILD, 0.065, 2600)
arp(BUILD, DROP2, 0.05, lambda tt: 1500 + 5000 * (tt - BUILD) / (DROP2 - BUILD))
arp(DROP2, LAST, 0.035, 5000, 2)

# Lead: the hook of the anthem, only where nobody speaks (habits, style) and on the last chorus.
MELODY = [  # (beat in the 4-bar loop, note, beats)
    (0, 'F#5', 0.5), (0.5, 'F#5', 0.5), (1, 'E5', 0.5), (1.5, 'F#5', 0.5), (2, 'D5', 1), (3, 'B4', 1),
    (4, 'D5', 0.5), (4.5, 'E5', 0.5), (5, 'F#5', 0.5), (5.5, 'A5', 0.5), (6, 'B5', 1), (7, 'A5', 1),
    (8, 'F#5', 0.5), (8.5, 'F#5', 0.5), (9, 'E5', 0.5), (9.5, 'F#5', 0.5), (10, 'A5', 1), (11, 'F#5', 1),
    (12, 'E5', 0.5), (12.5, 'F#5', 0.5), (13, 'E5', 0.5), (13.5, 'C#5', 0.5), (14, 'A4', 2),
]
lead = np.zeros((N, 2))


def lead_line(t0, t1, gain):
    for loop in grid(t0, t1, bar(4)):
        for beat, nm, length in MELODY:
            tt = loop + beat * BEAT
            if tt >= t1:
                break
            n = int(length * BEAT * 0.95 * SR)
            x = supersaw(hz(nm), n, 5, 0.008) + st(np.sign(sine(hz(nm) / 2, n)) * 0.2)
            t = np.arange(n) / SR
            x *= (1 + 0.03 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t * 4, 0, 1))[:, None]
            add(lead, lp(x, 5200) * env(n, 0.01, 0.12, 0.8, 0.08)[:, None], tt, gain)


lead_line(CHORUS, BREAK, 0.16)
lead_line(DROP2 + bar(2), LAST, 0.14)  # after «¡Empieza hoy!»
# Eighth-note ping-pong delay (dotted) and a wide hall.
delay = int(BEAT * 0.75 * SR)
echo = np.zeros_like(lead)
echo[delay:, 0] = lead[:-delay, 1] * 0.35
echo[2 * delay:, 1] = lead[:-2 * delay, 0] * 0.25
tonal += lead + lp(echo, 4000)

# ── Drums ────────────────────────────────────────────────────────────────
KICK, CLAP, SNARE, HC, HO = kick(1.2), clap(), snare(), hat(), hat(True)


def k(tt, g=1.0):
    add(drums, KICK, tt, 0.55 * g)
    kicks.append((tt, g))


def groove(t0, t1, kick_g=1.0, clap_g=0.32, hats=True, open_hats=True, sixteenths=False):
    for b, tt in enumerate(grid(t0, t1, BEAT)):
        k(tt, kick_g)
        if b % 4 in (1, 3):
            add(drums, CLAP, tt, clap_g)
            add(drums, SNARE, tt, clap_g * 0.5)
        if open_hats:
            add(drums, HO, tt + BEAT / 2, 0.16, 0.2)
        if hats:
            for s in ((0.25, 0.75) if sixteenths else ()):
                add(drums, HC, tt + s * BEAT, 0.12, -0.3)


# Intro: a heartbeat, then the floor, filtered, and a snare roll into the drop.
for tt in grid(0, bar(2), BEAT * 2):
    k(tt + 0.0, 0.55)
for tt in grid(bar(2), DROP1 - BEAT / 2, BEAT):
    k(tt, 0.75)
roll = [bar(3) + i * BEAT / 2 for i in range(4)] + [bar(3) + 2 * BEAT + i * BEAT / 4 for i in range(6)]
for i, tt in enumerate(roll):
    add(drums, SNARE, tt, 0.12 + 0.2 * i / len(roll))
groove(DROP1, EVOL, sixteenths=True)
groove(EVOL, TRAIN, sixteenths=True)
groove(TRAIN, CHORUS, sixteenths=True)
groove(CHORUS, BREAK, kick_g=1.1, clap_g=0.38, sixteenths=True)
# Fills into the sections.
for t1 in (EVOL, TRAIN, CHORUS, STYLE):
    for i, f in enumerate((140, 120, 100, 85)):
        add(drums, st(tom(f), (-0.5 + i / 3)), t1 - BEAT + i * BEAT / 4, 0.25)
# Breakdown: a soft kick on one, then the build doubles up to the drop.
for tt in grid(BREAK, BUILD, BAR):
    k(tt, 0.5)
for i, tt in enumerate(grid(BUILD, DROP2 - BEAT / 2, BEAT)):
    k(tt, 0.7 + 0.3 * i / 7)
build_roll = grid(BUILD, BUILD + BAR, BEAT / 2) + grid(BUILD + BAR, DROP2 - BEAT, BEAT / 4) + grid(DROP2 - BEAT, DROP2 - BEAT / 8, BEAT / 8)
for i, tt in enumerate(build_roll):
    add(drums, SNARE, tt, 0.08 + 0.26 * i / len(build_roll))
groove(DROP2, LAST, kick_g=1.1, clap_g=0.38, sixteenths=True)
k(LAST, 1.2)
# Crashes on the section downbeats.
for tt, g in ((DROP1, 0.5), (EVOL, 0.3), (TRAIN, 0.3), (CHORUS, 0.45), (STYLE, 0.3), (DROP2, 0.55), (LAST, 0.5)):
    add(drums, cymbal(2.6), tt, g)

# Risers and reverse cymbals into the drops; a sweep down after them.
for start, end, g in ((bar(2), DROP1, 0.1), (TRAIN - BAR, TRAIN, 0.05), (CHORUS - BAR, CHORUS, 0.06), (BUILD, DROP2, 0.12)):
    add(wash, fx_riser(end - start, 300, 9000), start, g)
for tt in (DROP1, CHORUS, DROP2):
    add(wash, fx_reverse(1.0), tt - 1.0, 0.5)
    add(wash, st(sweep(rng.standard_normal(int(1.6 * SR)), 9000, 300) * np.linspace(1, 0, int(1.6 * SR)) ** 2) * 0.3, tt, 0.25)

# Silence the music for the last eighth before each drop: the hit lands in the gap.
gate = np.ones(N)
for tt in (DROP1, DROP2):
    i0, i1 = int((tt - BEAT / 2) * SR), int(tt * SR)
    gate[i0:i1] = np.linspace(1, 0.05, i1 - i0) ** 0.3
    gate[i1 - 200:i1] = np.linspace(0.05, 1, 200)

pump = np.ones(N)
for kt, g in kicks:
    i = int(kt * SR)
    n = int(0.42 * SR)
    c = 1 - min(0.62, 0.55 * g) * np.exp(-np.arange(n) / SR * 9)
    pump[i:i + n] = np.minimum(pump[i:i + n], c[: len(pump[i:i + n])])
# The last drop leaves room for «¡RUMBO! Cada pequeño paso cuenta. ¡Empieza hoy!».
close_room = curve(N, [(0, 1), (DROP2 + 0.15, 1), (DROP2 + 0.4, 0.6), (DROP2 + 3.9, 0.6), (DROP2 + 4.5, 1), (LENGTH, 1)])[:, None]
tonal *= close_room
drums *= 0.4 + 0.6 * close_room
music = (verb(tonal * pump[:, None], HALL, 0.16) + verb(drums, ROOM, 0.08)) * gate[:, None] + verb(wash, HALL, 0.2)
music = hp(lp(music, 15000, 1), 28, 2)
music = np.tanh(music / np.max(np.abs(music)) * 1.4)  # glue: a little saturation on the peaks
music *= curve(N, [(0, 0), (0.05, 1), (END - 0.3, 1), (END + 0.6, 0), (LENGTH, 0)])[:, None]

# ── Sound design ─────────────────────────────────────────────────────────
sfx = np.zeros((N, 2))


def at(key, i=None, offset=0):
    v = B[key]
    if isinstance(v, list):
        v = v[0 if i is None else i]
    return fs(v + offset)


def whoosh(tt, g, length=0.5, lo=300, hi=7000):
    add(sfx, fx_whoosh(length, lo, hi), tt - length * 0.6, g)


def hit(tt, g=0.3, f=60):
    """A short, round punch under a big word: low thud and a snap of noise."""
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    snap = hp(rng.standard_normal(n), 2000) * np.exp(-t * 90) * 0.3
    body = np.sin(2 * np.pi * (f + 80 * np.exp(-t * 30)) * t) * np.exp(-t * 14)
    add(sfx, st(np.tanh((body + snap) * 1.5)), tt, g)


# Hook.
add(sfx, fx_boop(), at('wake'), 0.2)
for i in range(len(B['slam'])):
    hit(at('slam', i), 0.16)
whoosh(at('slam', 4, 2), 0.14, 0.35, 900, 9000)       # the strike through «cambiarlo todo»
add(sfx, fx_bubble(500, 1300), at('step'), 0.2)
whoosh(at('dash', 0, 10), 0.22, 0.8, 200, 8000)
for key in ('camino', 'rumbo'):
    hit(at(key), 0.3, 50)
add(sfx, fx_impact(2.6, 34), at('drop1') - 0.04, 0.3)

# App.
for key in ('regis', 'observa', 'sigue'):
    hit(at(key), 0.3)
    whoosh(at(key), 0.07, 0.3, 1500, 9000)
whoosh(at('whip1', 0, 12), 0.22, 0.6, 250, 8000)

# Evolution.
add(sfx, fx_swell(fs(B['chart'][1] - B['chart'][0]), 300, 4000), at('chart'), 0.12)
for key in ('imc', 'kcal'):
    whoosh(at(key), 0.14, 0.4, 500, 8000)
    add(sfx, fx_pop(), at(key, offset=3), 0.16)
span = B['markers'][1] - B['markers'][0]
for i in range(17):
    add(sfx, fx_tick(2200 + 110 * i), fs(B['markers'][0] + i * span / 17), 0.09, -0.6 + 1.2 * i / 16)
add(sfx, fx_shimmer(('B5', 'D6', 'F#6', 'B6')), at('markers', 1), 0.16)
whoosh(at('whip2', 0, 12), 0.22, 0.6, 250, 8000)

# Training.
add(sfx, fx_tick(2500), at('session'), 0.14)
add(sfx, fx_click(), at('setDone', offset=-1), 0.24)
add(sfx, fx_check(), at('setDone', offset=1), 0.3)
add(sfx, fx_shimmer(('A6', 'C#7', 'E7', 'A7'), 0.03, 1.2), at('setDone', offset=2), 0.2)
hit(at('rutinas'), 0.18)
hit(at('marcas'), 0.24)
whoosh(at('marcas'), 0.14, 0.4, 500, 8000)
whoosh(at('history', 0, 6), 0.1, 0.9, 300, 5000)
add(sfx, fx_pop(), at('stats', offset=3), 0.14)
add(sfx, fx_shimmer(('D6', 'F#6', 'A6', 'D7')), at('proud'), 0.22)
whoosh(at('wipe', 0, 14), 0.26, 0.7, 200, 9000)

# Habits.
for key in ('agua', 'pasos', 'racha', 'constancia'):
    hit(at(key), 0.32, 52)
add(sfx, fx_click(), at('tap250', offset=-2), 0.24)
for i in range(3):
    add(sfx, fx_bubble(420 + 140 * i, 1300 + 200 * i), at('tap250', offset=i * 2), 0.2, -0.3 + 0.3 * i)
add(sfx, fx_bell('F#6', 0.9), at('tap250', offset=4), 0.12)
for i in range(8):
    add(sfx, fx_tick(1500 + 120 * (i % 2)), at('pasos', offset=4 + i * 3.75), 0.1, -0.5 if i % 2 else 0.5)
add(sfx, fx_ignite(), at('racha'), 0.3)
whoosh(at('constancia', offset=2), 0.14, 0.6, 250, 5000)

# Style: a pop that climbs with each colour, the theme switch, the fan.
hit(at('estilo'), 0.3, 52)
for i in range(5):
    add(sfx, fx_pop(), at('colours', i), 0.18)
    add(sfx, fx_glow(hz(['B5', 'D6', 'E6', 'F#6', 'A6'][i]), 0.7), at('colours', i), 0.2)
add(sfx, fx_click(), at('light', offset=-2), 0.24)
add(sfx, fx_glow(hz('B6'), 1.0), at('light'), 0.24)
for i in range(3):
    whoosh(at('fan', 0, 4 + i * 4), 0.12, 0.35, 600, 9000)
add(sfx, fx_click(), at('dark', offset=-2), 0.2)

# Privacy: the records float in and settle; a warm glow when they are saved.
for i in range(4):
    add(sfx, fx_bubble(400 + 70 * i, 1000 + 110 * i), at('privacy', offset=6 + 8 * i), 0.12, -0.5 + 0.33 * i)
for i in range(4):
    add(sfx, fx_tick(2000 + 150 * i), at('chipsHome', 0, 5 * i + 20), 0.1)
add(sfx, fx_glow(hz('D5'), 2.0), at('saved'), 0.22)

# Build and final drop.
for key in ('entrena', 'registra', 'celebra'):
    hit(at(key), 0.3, 55)
add(sfx, fx_impact(2.2, 32), at('drop2') - 0.06, 0.22)
add(sfx, fx_shimmer(('D6', 'F#6', 'A6', 'D7', 'F#7')), at('drop2', offset=2), 0.16)
whoosh(at('tagline'), 0.06, 0.8, 1200, 9000)
add(sfx, fx_pop(), at('cta', offset=-1), 0.2)
add(sfx, fx_bell('A5', 2.0), at('cta'), 0.1)

# ── Voice: the ElevenLabs takes, dry, exactly as timed ───────────────────
voice = np.zeros(N)
for line in VOICE:
    x, sr = sf.read(os.path.join(HERE, 'voice-energia', f"{line['id']}.wav"))
    assert sr == SR
    x = np.asarray(x, dtype=np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x = hp(x, 80, 2)
    x = peaking(x, 3200, 1.5, 1.0)
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.11
    i = int(fs(line['at']) * SR)
    n = min(len(x), N - i)
    voice[i:i + n] += x[:n]
    print('voice', line['id'], 'at', round(fs(line['at']), 2), 's', 'len', round(len(x) / SR, 2), 's')


# Effects step back while the narration speaks (the music already ducks under it in audio/mux.sh).
level = np.sqrt(np.convolve(voice ** 2, np.ones(int(0.03 * SR)) / int(0.03 * SR), 'same'))
hold = maximum_filter1d(np.clip(level / 0.04, 0, 1), size=int(0.25 * SR), origin=-int(0.125 * SR) + 1)
hold = np.convolve(hold, np.ones(int(0.02 * SR)) / int(0.02 * SR), 'same')
sfx *= (1 - 0.55 * hold)[:, None]
sfx = verb(sfx, ROOM, 0.1)
sfx *= curve(N, [(0, 1), (END - 0.3, 1), (END + 0.6, 0), (LENGTH, 0)])[:, None]


def write(path, x, peak=0.89, subtype='FLOAT'):
    m = np.max(np.abs(x)) or 1
    sf.write(path, (x / m * peak).astype(np.float32), SR, subtype=subtype)


write(os.path.join(STEMS, 'music.wav'), music)
write(os.path.join(STEMS, 'sfx.wav'), sfx, 0.85)
write(os.path.join(STEMS, 'voice.wav'), np.stack([voice, voice], 1), 0.9)
# The clean narration on the video's timeline, for re-editing or other mixes.
write(os.path.join(OUT, 'RUMBO-cada-paso-cuenta-voz-elevenlabs.wav'), voice[: int(END * SR)], 0.89, 'PCM_24')
print('stems written to', STEMS)

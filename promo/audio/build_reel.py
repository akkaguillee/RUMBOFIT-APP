"""
RUMBO · reel «Cada pequeño paso cuenta» (1:46.5, 9:16 master and 4:5): the
single clock for picture and sound, the original score, sound design and the
voice placement.

  python3 audio/build_reel.py        # → src/reel/{voice,cues,subs}.json, stems, SRT

- Voice: the take of each line r1…r8, from audio/voice-reel/elevenlabs/<id>.(wav|mp3)
  when it exists (the final ElevenLabs voice), else audio/voice-reel/guia/<id>.wav
  (provisional local guide, see audio/reel_guide_voice.py). Word starts come from
  the take itself (pauses matched to punctuation, syllables in between, as in
  audio/align_voice.py), so a new take re-times subtitles, cues and effects.
- Cues: every moment the picture hangs on (screen changes, taps, titles) is a
  frame in src/reel/cues.json, derived from the scene grid and the voice words.
  The Remotion scenes read it, and the effects below are placed on it.
- Score (synthesised with audio/synth.py, original, so free to use): energetic
  electronic pop at 128 BPM in D major. A filtered intro that opens up over four
  bars, a drop with impact when the phone slams in, four-on-the-floor with
  claps, offbeat bass and supersaw stabs under the voice, a lead over the
  drops, two bars of air for privacy, a snare roll into the light and the big
  drop on the logo. Risers, reversed cymbals and impacts sit on every
  cinematic transition (the fx.* cues). Scene cuts sit on bar lines.
- Stems (48 kHz) go to audio/stems-reel/; audio/mux_reel.sh mixes and encodes.
"""

import json
import os
import re
import subprocess

import numpy as np
import soundfile as sf
from scipy import signal

import synth
from synth import (
    HALL, ROOM, SR, add, clap, env, fx_bell, fx_boop, fx_bubble, fx_check, fx_click, fx_glow, fx_pop, fx_shimmer,
    fx_swell, fx_tick, fx_whoosh, hat, hp, hz, keys, kick, lp, peaking, pluck, saw, shaker, sine, verb,
)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REEL = os.path.join(ROOT, 'src', 'reel')
VOICE_DIR = os.path.join(HERE, 'voice-reel')
STEMS = os.path.join(HERE, 'stems-reel')
OUT = os.path.join(ROOT, 'out', 'reel')
os.makedirs(STEMS, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
synth.seed(2026)

FPS = 30
BPM = 128
BEAT = 60 / BPM
BAR = 4 * BEAT                       # 1.875 s
LENGTH = 49 * BAR                    # 91.875 s of picture
FRAMES = int(LENGTH * FPS)           # 2756
N = int((LENGTH + 0.5) * SR)

# Scene grid in bars: every cut on a bar line of the 128 BPM score.
SCENE_BARS = [('hook', 0), ('reveal', 4), ('evolution', 9), ('training', 15), ('habits', 21), ('style', 28), ('privacy', 35), ('finale', 40)]
SCENE_S = {name: bar * BAR for name, bar in SCENE_BARS}
SCENES = {}
for (name, bar), nxt in zip(SCENE_BARS, SCENE_BARS[1:] + [('end', None)]):
    end = FRAMES if nxt[1] is None else int(round(nxt[1] * BAR * FPS))
    SCENES[name] = [int(round(bar * BAR * FPS)), end]

# Where each narration line starts (s): right after each scene's downbeat.
VOICE_AT = {'r1': 1.2, 'r2': 8.1, 'r3': 17.3, 'r4': 28.6, 'r5': 39.8, 'r6': 53.0, 'r7': 66.0, 'r8': 77.0}

SCRIPT = json.load(open(os.path.join(REEL, 'script.json'), encoding='utf-8'))['lines']

# Subtitle phrases (short, in reading order). {…} marks the few key terms shown in the accent tint.
SUBS = {
    'r1': ['No hace falta cambiarlo todo', 'de un día para otro.', 'Basta con dar el {siguiente paso}.'],
    'r2': ['RUMBO te ayuda a {registrar} lo que haces', 'y a ver cómo avanza tu proceso,', 'a tu manera.'],
    'r3': ['Anota tu evolución y consulta', 'tus datos de {peso, IMC y calorías}', 'en un mismo lugar.', 'Cada registro cuenta', 'una parte de tu historia.'],
    'r4': ['Guarda tus {entrenamientos},', 'tus {rutinas} y tus {marcas}.', 'Así puedes volver a ellos', 'y reconocer todo el trabajo', 'que ya has hecho.'],
    'r5': ['Registra también tus hábitos diarios,', 'como el {agua} y los {pasos}.', 'Celebra los pequeños avances', 'y construye {constancia}', 'sin exigirte perfección.'],
    'r6': ['Y adapta la experiencia a ti:', 'cambia los {colores}', 'y elige el {tema} que prefieras.'],
    'r7': ['Y tu privacidad importa:', 'tus registros se guardan', 'en {tu propio dispositivo}.'],
    'r8': ['Entrena, registra tu progreso', 'y celebra cada paso.', 'RUMBO.', 'Cada pequeño paso cuenta.', '{Empieza hoy}.'],
}


# ── Voice: takes and word timing ─────────────────────────────────────────
def decode(path):
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).astype(np.float64)


def take(line_id):
    for folder, label in (('elevenlabs', 'elevenlabs'), ('local', 'local')):
        for ext in ('wav', 'mp3'):
            p = os.path.join(VOICE_DIR, folder, f'{line_id}.{ext}')
            if os.path.exists(p):
                x = decode(p)
                e = np.abs(x)
                idx = np.where(e > 0.01 * e.max())[0]
                return x[max(0, idx[0] - 400): idx[-1] + 2400], label
    raise SystemExit(f'No take for {line_id}: run audio/reel_local_voice.py or add audio/voice-reel/elevenlabs/{line_id}.wav')


def syllables(word):
    w = re.sub(r'[^a-záéíóúüñ]', '', word.lower())
    return max(1, len(re.findall(r'[aeiouáéíóúü]+', w)))


def segments(x):
    hop = SR // 100
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1))
    on = rms > 0.06 * rms.max()
    segs, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        if not v and start is not None:
            segs.append([start, i])
            start = None
    if start is not None:
        segs.append([start, n])
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < 9:  # gaps under 90 ms are inside a phrase
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return [(a / 100, b / 100) for a, b in merged if b - a >= 5]


def word_starts(text, segs):
    words = text.split(' ')
    phrases, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r'[,.;:!?]$', w):
            phrases.append(cur)
            cur = []
    if cur:
        phrases.append(cur)
    weight = lambda ws: sum(syllables(w) + 0.3 for w in ws)  # noqa: E731
    end = segs[-1][1]
    gaps = [(segs[i][1], segs[i + 1][0]) for i in range(len(segs) - 1) if segs[i + 1][0] - segs[i][1] >= 0.12]
    spans, pos = [], segs[0][0]
    for k in range(len(phrases) - 1):
        rest = sum(weight(p) for p in phrases[k:])
        expected = pos + weight(phrases[k]) / rest * (end - pos)
        match = next((g for g in gaps if g[0] > pos and expected - 0.6 <= (g[0] + g[1]) / 2 <= expected + 1.0), None)
        if match:
            spans.append((pos, match[0]))
            pos = match[1]
        else:
            spans.append((pos, expected))
            pos = expected
    spans.append((pos, end))
    starts = []
    for p, (a, b) in zip(phrases, spans):
        acc, total = 0.0, weight(p)
        for w in p:
            starts.append(a + acc / total * (b - a))
            acc += syllables(w) + 0.3
    return starts, end


voice = np.zeros(N)
LINES = []
sources = set()
for line in SCRIPT:
    x, label = take(line['id'])
    sources.add(label)
    spoken = line.get('speak', line['text'])
    starts, end = word_starts(spoken, segments(x))
    shown = line['text'].split(' ')
    assert len(shown) == len(starts), (line['id'], len(shown), len(starts))
    at = VOICE_AT[line['id']]
    LINES.append({
        'id': line['id'],
        'text': line['text'],
        'at': int(round(at * FPS)),
        'end': int(round((at + end) * FPS)),
        'words': [{'w': w, 'f': int(round((at + s) * FPS))} for w, s in zip(shown, starts)],
    })
    # A broadcast chain so the voice sits in front of a loud track: rumble out,
    # warmth, presence and air, a fast compressor and a touch of saturation.
    y = hp(x, 95, 2)
    y = peaking(y, 220, 1.5, 0.8)
    y = peaking(y, 3200, 3.0, 1.0)
    y = peaking(y, 9500, 2.0, 0.8)
    y = y / (np.abs(y).max() + 1e-9)
    env_ = np.sqrt(signal.lfilter([0.002], [1, -0.998], y ** 2) + 1e-12)
    gain = np.minimum(1, (0.25 / np.maximum(env_, 1e-6)) ** 0.6)
    y = np.tanh(y * gain * 1.6) / np.tanh(1.6)
    y = y / (np.sqrt(np.mean(y ** 2)) + 1e-9) * 0.12
    i = int(at * SR)
    voice[i:i + len(y)] += y[: N - i]
    print(line['id'], label, f'{at:.1f}–{at + end:.1f} s')

VOICE_SOURCE = 'elevenlabs' if sources == {'elevenlabs'} else ('local' if sources == {'local'} else 'mixta')
json.dump({'source': VOICE_SOURCE, 'lines': LINES}, open(os.path.join(REEL, 'voice.json'), 'w'), ensure_ascii=False, indent=1)


def line_of(lid):
    return next(v for v in LINES if v['id'] == lid)


def W(lid, which, nth=0):
    """Frame where a word of a line starts: by index, or by its (accent-insensitive) beginning."""
    words = line_of(lid)['words']
    if isinstance(which, int):
        return words[min(which, len(words) - 1)]['f']
    norm = lambda s: re.sub(r'[^a-zñ]', '', s.lower().translate(str.maketrans('áéíóúü', 'aeiouu')))  # noqa: E731
    hits = [w['f'] for w in words if norm(w['w']).startswith(norm(which))]
    return hits[min(nth, len(hits) - 1)]


def END(lid):
    return line_of(lid)['end']


# ── Cues (absolute frames) ───────────────────────────────────────────────
S = {k: v[0] for k, v in SCENES.items()}
BEAT_F = BEAT * FPS                  # 14.06 frames
BAR_F = BAR * FPS                    # 56.25 frames


def on_beat(f):
    """Snap a frame to the nearest beat of the score."""
    return int(round(round(f / BEAT_F) * BEAT_F))


C = {}
# Hook: Rumbi wakes on the first hit, lights a dot, the dot walks a path; logo and title.
C['hook.look'] = 8
C['hook.spark'] = 18
C['hook.dot'] = 28
C['hook.path'] = W('r1', 0)
C['hook.pathEnd'] = END('r1') + 10
C['hook.logo'] = 40
C['hook.title'] = W('r1', 'Basta') - 2
# Reveal: the phone slams in on the drop; welcome screen, then home.
C['reveal.phone'] = S['reveal']
C['reveal.screen'] = S['reveal'] + 6
C['reveal.tap'] = W('r2', 'registrar') - 8
C['reveal.hl1'] = W('r2', 'registrar') + 4
C['reveal.hl2'] = max(W('r2', 'ver'), C['reveal.hl1'] + 20)
C['reveal.title'] = END('r2') + 4
# Evolution: real chart, IMC, calories, a real record, then a burst of screens on the beat.
C['evo.tab'] = S['evolution'] + 2
C['evo.scroll'] = max(W('r3', 'evolucion') - 4, C['evo.tab'] + 12)
C['evo.draw'] = C['evo.scroll'] + 14
C['evo.imc'] = max(W('r3', 'IMC') - 3, C['evo.draw'] + 28)
C['evo.cal'] = max(W('r3', 'calorias') - 3, C['evo.imc'] + 14)
C['evo.back'] = max(W('r3', 'Cada') - 8, C['evo.cal'] + 16)
C['evo.tip'] = C['evo.back'] + 12
C['evo.list'] = max(END('r3') + 4, C['evo.tip'] + 24)
C['evo.title'] = C['evo.list'] + 4
C['evo.burst'] = on_beat(max(C['evo.title'] + 44, S['training'] - 4 * BEAT_F - 16))
# Training: a session card slides in, then history, routines, records and a completed set.
C['train.card'] = S['training']
C['train.hist'] = max(W('r4', 'entrenamientos') - 6, C['train.card'] + 16)
C['train.rut'] = max(W('r4', 'rutinas') - 4, C['train.hist'] + 14)
C['train.marcas'] = max(W('r4', 'marcas') - 4, C['train.rut'] + 14)
C['train.ses'] = max(W('r4', 'volver') - 4, C['train.marcas'] + 18)
C['train.check'] = max(W('r4', 'trabajo') - 2, C['train.ses'] + 16)
C['train.check2'] = C['train.check'] + 16
C['train.title'] = max(END('r4') + 6, C['train.check2'] + 10)
C['train.burst'] = on_beat(max(C['train.title'] + 40, S['habits'] - 4 * BEAT_F - 10))
# Habits: water and steps become real cards; a real milestone, the streak, the calendar.
C['hab.icons'] = S['habits']
C['hab.cards'] = S['habits'] + 14
C['hab.agua'] = max(W('r5', 'habitos') - 4, C['hab.cards'] + 18)
C['hab.aguaTap'] = max(W('r5', 'agua') - 6, C['hab.agua'] + 12)
C['hab.pasos'] = max(W('r5', 'pasos') - 6, C['hab.aguaTap'] + 20)
C['hab.pasosTap'] = C['hab.pasos'] + 10
C['hab.hito'] = max(W('r5', 'Celebra') - 2, C['hab.pasosTap'] + 24)
C['hab.racha'] = max(W('r5', 'constancia') - 8, C['hab.hito'] + 28)
C['hab.flame'] = C['hab.racha'] + 22
C['hab.cal'] = max(W('r5', 'sin') - 4, C['hab.flame'] + 14)
C['hab.legend'] = max(W('r5', 'perfeccion'), C['hab.cal'] + 12)
C['hab.title'] = max(END('r5') + 6, C['hab.legend'] + 14)
C['hab.burst'] = on_beat(max(C['hab.title'] + 44, S['style'] - 4 * BEAT_F - 12))
# Style: the real colour control, six phones in the six colours, the real light/dark switch, split screen.
C['sty.accentTap'] = max(W('r6', 'adapta') - 2, S['style'] + 8)
C['sty.sheet'] = C['sty.accentTap'] + 4
C['sty.fan'] = max(W('r6', 'colores') - 4, C['sty.sheet'] + 14)
C['sty.fanEnd'] = C['sty.fan'] + 42
C['sty.theme'] = max(W('r6', 'tema') - 6, C['sty.fanEnd'] + 2)
C['sty.split'] = on_beat(C['sty.theme'] + 30)
C['sty.splitEnd'] = on_beat(C['sty.split'] + 2 * BAR_F)
C['sty.light'] = [C['sty.splitEnd'] + 4, int(C['sty.splitEnd'] + 4 + BEAT_F), int(C['sty.splitEnd'] + 4 + 2 * BEAT_F)]  # cian, fucsia, violeta (light)
C['sty.title'] = max(END('r6') + 6, C['sty.split'] - 8)
C['sty.dark'] = S['privacy'] - 22
# Privacy: the scope in words; the build into the finale is a montage of the records that stay on the device.
C['priv.in'] = S['privacy']
C['priv.halo'] = S['privacy'] + 36
C['priv.title'] = END('r7') + 4
C['priv.build'] = on_beat(max(END('r7') + 2, S['finale'] - 3 * BAR_F))
# Finale: the light redraws the logo; Rumbi beside RUMBO; call to action and confetti.
C['fin.out'] = S['finale']
C['fin.lines'] = S['finale'] + 12
C['fin.runner'] = S['finale'] + 28
C['fin.fill'] = S['finale'] + int(BAR_F)
C['fin.word'] = max(W('r8', 8) - 4, C['fin.fill'] + 8)
C['fin.slogan'] = max(W('r8', 9), C['fin.word'] + 16)
C['fin.cta'] = max(W('r8', 13) - 2, C['fin.slogan'] + 16)
assert C['fin.cta'] <= FRAMES - 90, 'the call to action must stay on screen for at least 3 s'

# Cinematic beats shared by picture and sound.
C['fx.braam'] = 0
C['fx.drop1'] = S['reveal']                      # the phone slams in
C['fx.dive'] = S['evolution'] - 12               # the camera dives into the screen…
C['fx.surface'] = S['evolution']                 # …and surfaces in Progreso
C['fx.whip'] = S['training'] - 6                 # whip pan out and back in
C['fx.punchOut'] = S['habits']                   # zoom punch out
C['fx.flip'] = S['style'] - 8                    # the phone flips to the style scene
C['fx.calm'] = S['privacy']                      # a short breakdown
C['fx.build'] = C['priv.build']                  # snare roll, riser and montage into the finale
C['fx.dive2'] = S['finale'] - 10                 # into the light
C['fx.flash'] = S['finale']                      # flash
C['fx.drop2'] = C['fin.fill']                    # the logo lands: the big drop
C['fx.punches'] = sorted({C['evo.draw'], C['evo.tip'], C['train.check'], C['hab.aguaTap'] + 4, C['hab.hito'], C['hab.flame'], C['sty.fan'], C['sty.theme'] + 4, C['sty.split'], C['fin.word'], C['fin.cta']})
C['fx.speed'] = sorted({S['evolution'] - 4, S['training'], S['habits'], S['style'], C['sty.split'], S['privacy'], C['evo.burst'], C['train.burst'], C['hab.burst']})
# The camera pulses with the kick where the score drives.
PULSE = [[S['reveal'], S['privacy']], [C['fx.drop2'], FRAMES - 30]]

# Keywords that slam onto the screen as the voice says them.
KEYWORDS = [
    (W('r3', 'peso'), 'PESO'),
    (W('r3', 'IMC'), 'IMC'),
    (W('r3', 'calorias'), 'CALORÍAS'),
    (W('r4', 'rutinas'), 'RUTINAS'),
    (W('r4', 'marcas'), 'MARCAS'),
    (W('r5', 'agua'), 'AGUA'),
    (W('r5', 'pasos'), 'PASOS'),
    (W('r5', 'constancia'), 'CONSTANCIA'),
    (W('r6', 'colores'), 'COLORES'),
    (W('r6', 'tema'), 'TEMA'),
    (W('r7', 'privacidad'), 'PRIVACIDAD'),
    (W('r8', 0), 'ENTRENA'),
    (W('r8', 1), 'REGISTRA'),
    (W('r8', 5), 'CELEBRA'),
]

json.dump({'fps': FPS, 'frames': FRAMES, 'bpm': BPM, 'scenes': SCENES, 'cues': C, 'pulse': PULSE, 'keywords': [{'at': a, 'text': t} for a, t in KEYWORDS], 'voice': VOICE_SOURCE}, open(os.path.join(REEL, 'cues.json'), 'w'), ensure_ascii=False, indent=1)

# ── Subtitles ────────────────────────────────────────────────────────────
subs = []
for line in LINES:
    phrases = SUBS[line['id']]
    plain = ' '.join(p.replace('{', '').replace('}', '') for p in phrases)
    assert plain == line['text'], (line['id'], plain, line['text'])
    k = 0
    starts = []
    for p in phrases:
        starts.append(k)
        k += len(p.split(' '))
    for j, (p, s0) in enumerate(zip(phrases, starts)):
        a = line['words'][s0]['f'] - 2
        b = line['words'][starts[j + 1]]['f'] - 2 if j + 1 < len(phrases) else line['end'] + 10
        subs.append({'from': a, 'to': b, 'text': p})
json.dump(subs, open(os.path.join(REEL, 'subs.json'), 'w'), ensure_ascii=False, indent=1)


def srt_time(frame):
    ms = int(round(frame / FPS * 1000))
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


with open(os.path.join(OUT, 'RUMBO-reel.srt'), 'w', encoding='utf-8') as f:
    for i, s in enumerate(subs, 1):
        f.write(f"{i}\n{srt_time(s['from'])} --> {srt_time(s['to'])}\n{s['text'].replace('{', '').replace('}', '')}\n\n")
print('cues, subtitles and SRT written')


# ── Score: energetic, 128 BPM, D major ───────────────────────────────────
def fs(frame):
    return frame / FPS


def T(name):
    return fs(C[name])


CHORDS = {  # voicing, bass root
    'D': (['F#3', 'A3', 'D4', 'F#4'], 'D2'),
    'A': (['E3', 'A3', 'C#4', 'E4'], 'A1'),
    'Bm': (['F#3', 'B3', 'D4', 'F#4'], 'B1'),
    'G': (['G3', 'B3', 'D4', 'G4'], 'G1'),
}
LOOP = ['D', 'A', 'Bm', 'G']
LIFT = ['G', 'D', 'A', 'Bm']
BARS = (
    LOOP                                   # hook (4)
    + LOOP + ['D']                         # reveal (5)
    + LOOP + ['D', 'A']                    # evolution (6)
    + LOOP + ['D', 'A']                    # training (6)
    + LIFT + ['G', 'D', 'A']               # habits (7)
    + LOOP + ['D', 'A', 'G']               # style (7)
    + ['Bm', 'G', 'D', 'A', 'A']           # privacy (5): breakdown, then the build
    + LOOP + LOOP + ['D']                  # finale (9)
)
n_bars = len(BARS)
assert n_bars == 49


def chord(bar):
    return CHORDS[BARS[min(bar, n_bars - 1)]]


def section(t):
    name = 'hook'
    for k, s0 in sorted(SCENE_S.items(), key=lambda kv: kv[1]):
        if t + 1e-6 >= s0:
            name = k
    return name


def up(nm, octaves=1):
    return nm[:-1] + str(int(nm[-1]) + octaves)


FLASH, DROP2, CTA, BUILD = T('fx.flash'), T('fx.drop2'), T('fin.cta'), T('fx.build')
BREAK0, END_T = SCENE_S['privacy'], n_bars * BAR
DRIVE = [(SCENE_S['reveal'], SCENE_S['privacy']), (FLASH, (n_bars - 1) * BAR)]


def driving(t):
    return any(a - 1e-6 <= t < b for a, b in DRIVE)


tonal = np.zeros((N, 2))   # chords, bass, leads: pumped by the kick
drums = np.zeros((N, 2))
wash = np.zeros((N, 2))    # risers, impacts: never pumped
kicks = []


def supersaw(names, dur, cutoff, attack=0.004, release=0.12):
    n = int(dur * SR)
    x = np.zeros(n)
    for nm in names:
        for d in (-0.011, -0.005, 0.0, 0.005, 0.011):
            x += saw(hz(nm) * (1 + d), n, synth.rng.random())
    return lp(x / (6 * len(names)), cutoff) * env(n, attack, 0.08, 0.6, release)


def bass_note(f, dur):
    n = int(dur * SR)
    x = sine(f, n) * 0.9 + lp(saw(f, n), 900) * 0.35 + lp(saw(f * 2, n), 600) * 0.1
    return np.tanh(x * 1.4) * env(n, 0.004, 0.06, 0.8, 0.05)


def lead(f, dur, cutoff=5200):
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.15)
    ph = np.cumsum(f * vib) / SR
    x = 2 * (ph % 1) - 1 + 0.5 * (2 * ((ph * 1.006) % 1) - 1)
    return lp(x, cutoff) * env(n, 0.008, 0.1, 0.7, 0.18) * 0.5


def kick_at(t, g=0.62, cut=None):
    k = kick(1.0)
    if cut:
        k = lp(k, cut)
    add(drums, k, t, g)
    kicks.append(t)


# Intro: a filtered arpeggio that opens up over four bars, a kick that grows, a snare build.
for b in range(4):
    t0 = b * BAR
    tones = sorted(chord(b)[0], key=hz)
    for s16 in range(16):
        t = t0 + s16 * BEAT / 4
        cut = 600 * (14 ** ((t / (4 * BAR)) ** 1.3))
        add(tonal, pluck(hz(up(tones[s16 % 4])), 0.22, cut), t, 0.15, -0.4 if s16 % 2 else 0.4)
    if b >= 1:
        for q in range(4):
            kick_at(t0 + q * BEAT, 0.45 + 0.08 * b, cut=250 + 900 * (b - 1))
    add(tonal, supersaw(chord(b)[0], BAR + 0.2, 500 + 700 * b, 0.6, 0.6), t0, 0.32)
t = 3 * BAR
while t < 4 * BAR - 0.13:
    p = (t - 3 * BAR) / BAR
    add(drums, synth.snare(), t, 0.1 + 0.3 * p, 0)
    t += BEAT / (2 if p < 0.5 else 4)

# Driving sections: four-on-the-floor, claps, hats, offbeat bass, supersaw stabs.
STAB = [0, 0.75, 1.5, 2.5, 3.0]  # beats: a 3-3-2 push
for b in range(4, n_bars):
    t0 = b * BAR
    sec = section(t0)
    if not driving(t0):
        continue
    c_ = chord(b)
    for q in range(4):
        kick_at(t0 + q * BEAT)
        if q in (1, 3):
            add(drums, clap(), t0 + q * BEAT, 0.3, -0.05)
            add(drums, synth.snare(), t0 + q * BEAT, 0.16, 0.05)
        add(drums, hat(open_=True), t0 + q * BEAT + BEAT / 2, 0.2, 0.25)
    if sec in ('training', 'habits', 'finale'):
        for s16 in range(16):
            add(drums, hat(), t0 + s16 * BEAT / 4, 0.12 if s16 % 2 else 0.06, -0.3)
    if sec in ('evolution', 'habits'):
        for s16 in range(16):
            add(drums, shaker(), t0 + s16 * BEAT / 4, 0.07, 0.35)
    root = hz(c_[1])
    for q in range(4):  # offbeat bass, an octave jump on the last one
        add(tonal, bass_note(root * (2 if q == 3 else 1), BEAT / 2 * 0.9), t0 + q * BEAT + BEAT / 2, 0.44)
    cut = {'reveal': 3800, 'evolution': 4200, 'training': 4600, 'habits': 5600, 'style': 5000, 'finale': 6200}.get(sec, 4200)
    for st in STAB:
        add(tonal, supersaw(c_[0] + [up(c_[0][-1])], BEAT * 0.55, cut), t0 + st * BEAT, 0.34, 0)
    add(tonal, supersaw(c_[0], BAR, 1400, 0.05, 0.4), t0, 0.16)
    # A crash on each phrase start and a fill on its last beat.
    phrase = (b - SCENE_BARS[[s for s, _ in SCENE_BARS].index(sec)][1]) % 4
    if phrase == 0:
        add(wash, synth.cymbal(2.2), t0, 0.32)
    if phrase == 3:
        for k in range(4):
            add(drums, synth.snare(), t0 + 3 * BEAT + k * BEAT / 4, 0.22 + 0.06 * k, 0)

# Lead melody over the drops (reveal, habits, the finale).
MELODY = [('F#5', 0, 0.5), ('A5', 0.5, 0.5), ('B5', 1, 1), ('A5', 2, 0.5), ('F#5', 2.5, 0.5), ('E5', 3, 1),
          ('F#5', 4, 0.5), ('A5', 4.5, 0.5), ('D6', 5, 1), ('C#6', 6, 0.5), ('B5', 6.5, 0.5), ('A5', 7, 1)]
for start_bar, reps in ((SCENE_BARS[1][1] + 2, 1), (SCENE_BARS[4][1], 2), (int(round(FLASH / BAR)) + 1, 2)):
    for r_ in range(reps):
        base = (start_bar + 2 * r_) * BAR
        for nm, beat, ln in MELODY:
            add(tonal, lead(hz(nm), ln * BEAT * 0.95), base + beat * BEAT, 0.16, 0.1)
            add(tonal, lead(hz(nm) * 2, ln * BEAT * 0.95, 7000), base + beat * BEAT, 0.05, -0.2)

# Style: bright plucks bouncing between the speakers.
for b in range(n_bars):
    t0 = b * BAR
    if section(t0) != 'style':
        continue
    tones = [up(x) for x in sorted(chord(b)[0], key=hz)]
    for k in range(8):
        add(tonal, pluck(hz(tones[(k * 3) % 4]) * (2 if k in (3, 7) else 1), 0.28, 5200), t0 + k * BEAT / 2, 0.15, (-0.5 if k % 2 else 0.5))

# Privacy: two bars of air (pad and piano under the voice), then the build.
for b in range(n_bars):
    t0 = b * BAR
    if section(t0) != 'privacy':
        continue
    add(tonal, supersaw(chord(b)[0], BAR + 0.6, 1100, 0.3, 0.6), t0, 0.3)
    for k, nm in enumerate(sorted(chord(b)[0], key=hz)):
        add(tonal, keys(hz(up(nm)), 2.2, 1.0), t0 + k * BEAT * 0.5, 0.18, 0.1)
t = BUILD
while t < FLASH - 0.13:
    p = (t - BUILD) / (FLASH - BUILD)
    step = BEAT / (2 if p < 0.33 else 4 if p < 0.75 else 8)
    add(drums, synth.snare(), t, 0.1 + 0.32 * p ** 1.3, 0)
    t += step
t = BUILD
while t < FLASH - 0.13:
    p = (t - BUILD) / (FLASH - BUILD)
    kick_at(t, 0.35 + 0.25 * p, cut=300 + 4000 * p)
    t += BEAT if p < 0.66 else BEAT / 2

# Impacts, risers and reversed cymbals on the cinematic beats; a final chord to close.
DROP1, SURFACE, WHIP, PUNCH, FLIP = T('fx.drop1'), T('fx.surface'), T('fx.whip'), T('fx.punchOut'), T('fx.flip')
add(wash, synth.fx_impact(2.0, 40), 0.0, 0.7)
for at_, big in ((DROP1, True), (SURFACE, False), (WHIP + 0.2, False), (PUNCH, False), (FLIP + fs(8), False), (FLASH, True), (DROP2, True)):
    add(wash, synth.fx_impact(2.2 if big else 1.4, 36 if big else 44), at_, 0.85 if big else 0.5)
    add(wash, synth.fx_reverse(1.2 if big else 0.8), at_ - (1.2 if big else 0.8), 0.55 if big else 0.35)
    add(wash, synth.cymbal(2.6 if big else 1.8), at_, 0.5 if big else 0.32)
for a, b_ in ((2 * BAR, DROP1), (SURFACE - 1.4, SURFACE), (WHIP - 1.1, WHIP + 0.2), (PUNCH - 1.2, PUNCH), (FLIP - 1.0, FLIP + fs(8)), (BUILD, FLASH)):
    add(wash, synth.fx_riser(b_ - a, 300, 9500), a, 0.5)
LAST = (n_bars - 1) * BAR
add(tonal, supersaw(CHORDS['D'][0] + ['D5', 'F#5'], 2.6, 6000, 0.004, 1.8), LAST, 0.5)
add(wash, synth.fx_impact(2.6, 34), LAST, 0.7)
add(wash, synth.cymbal(3.0), LAST, 0.5)
add(wash, synth.fx_shimmer(('D6', 'F#6', 'A6', 'D7', 'F#7', 'A7'), 0.05, 2.6), CTA, 0.3)

# A breath of silence before each drop.
gate = np.ones(N)
for at_ in (DROP1, FLASH):
    i0, i1 = int((at_ - 0.12) * SR), int(at_ * SR)
    gate[i0:i1] = np.linspace(1, 0, max(1, i1 - i0)) ** 3
tonal *= gate[:, None]
drums *= gate[:, None]

# Sidechain pumping: the whole tonal bed ducks with each kick.
duck = np.ones(N)
for t in kicks:
    i = int(t * SR)
    n = int(0.3 * SR)
    shape = 1 - 0.55 * np.exp(-np.arange(n) / (0.07 * SR))
    if i < N:
        duck[i:i + n] = np.minimum(duck[i:i + n], shape[: max(0, min(n, N - i))])
tonal *= duck[:, None]
music = verb(tonal, HALL, 0.16) + verb(drums, ROOM, 0.1) + wash * 0.8
fade = np.ones(N)
fade[int((LENGTH - 0.6) * SR):] = np.linspace(1, 0, N - int((LENGTH - 0.6) * SR))
music *= fade[:, None]

# ── Sound design (picture events) ────────────────────────────────────────
sfx = np.zeros((N, 2))


def at(key, offset=0):
    return fs(C[key] + offset)


add(sfx, fx_glow(1320, 1.0), at('hook.spark'), 0.5)
add(sfx, fx_bell('A6', 1.0), at('hook.dot'), 0.25)
for k in range(8):
    t = fs(C['hook.path']) + (fs(C['hook.pathEnd']) - fs(C['hook.path'])) * (k + 0.5) / 8
    add(sfx, fx_tick(2400 + 120 * (k % 3)), t, 0.4, -0.6 + 1.2 * k / 7)
add(sfx, fx_glow(660, 1.4), at('hook.logo'), 0.55)
add(sfx, fx_whoosh(0.4, 300, 7000), at('hook.title', -6), 0.3)
add(sfx, synth.fx_thud(), at('hook.title'), 0.45)

# Transitions follow the camera; speed lines swish.
for key, ln, g in (('fx.drop1', 0.6, 0.5), ('fx.dive', 0.45, 0.55), ('fx.surface', 0.4, 0.35), ('fx.whip', 0.4, 0.6), ('fx.punchOut', 0.5, 0.45), ('fx.flip', 0.45, 0.5), ('fx.dive2', 0.4, 0.5)):
    add(sfx, fx_whoosh(ln, 220, 8500), at(key, -int(ln * FPS * 0.6)), g)
add(sfx, fx_whoosh(0.4, 260, 8500), at('fx.whip', 6), 0.5)
for f in C['fx.speed']:
    add(sfx, fx_whoosh(0.3, 800, 10000), fs(f) - 0.05, 0.3)
for f in C['fx.punches']:
    add(sfx, synth.fx_thud(), fs(f), 0.45)

# Keywords and titles slam in.
for a, _ in KEYWORDS:
    add(sfx, synth.fx_thud(), fs(a), 0.4)
    add(sfx, fx_whoosh(0.25, 500, 9000), fs(a) - 0.1, 0.2)
for key, off in (('reveal.title', 0), ('reveal.title', 16), ('evo.title', 0), ('train.title', 0), ('hab.title', 0), ('sty.title', 0), ('priv.title', 0)):
    add(sfx, fx_whoosh(0.3, 400, 8000), at(key, off - 5), 0.22)
    add(sfx, synth.fx_thud(), at(key, off), 0.3)

# Interface: taps, pages, values.
add(sfx, fx_click(), at('reveal.tap'), 0.5)
add(sfx, fx_pop(), at('reveal.tap', 2), 0.25)
add(sfx, fx_click(), at('evo.tab'), 0.45)
add(sfx, fx_swell(1.0, 300, 3200), at('evo.draw'), 0.3)
add(sfx, fx_tick(2600), at('evo.imc'), 0.45)
add(sfx, fx_tick(2900), at('evo.cal'), 0.45)
add(sfx, fx_click(), at('evo.tip'), 0.5)
add(sfx, fx_pop(), at('evo.tip', 3), 0.25)
for burst in ('evo.burst', 'train.burst', 'hab.burst'):
    for k in range(4):
        add(sfx, fx_tick(2600 + 200 * k), fs(C[burst] + k * BEAT_F), 0.35)
add(sfx, fx_whoosh(0.6, 250, 7000), at('train.card', -2), 0.3)
add(sfx, fx_tick(2600), at('train.rut'), 0.45)
add(sfx, fx_tick(2900), at('train.marcas'), 0.45)
add(sfx, fx_click(), at('train.check'), 0.55)
add(sfx, fx_check(), at('train.check', 1), 0.6)
add(sfx, fx_shimmer(('E6', 'A6', 'C#7', 'E7'), 0.045, 1.4), at('train.check', 3), 0.38)
add(sfx, fx_click(), at('train.check2'), 0.45)
add(sfx, fx_check(), at('train.check2', 1), 0.4)
add(sfx, fx_pop(), at('hab.icons'), 0.3)
add(sfx, fx_pop(), at('hab.icons', 5), 0.25)
add(sfx, fx_whoosh(0.4, 300, 5000), at('hab.cards'), 0.25)
add(sfx, fx_click(), at('hab.aguaTap'), 0.5)
for k in range(5):
    add(sfx, fx_bubble(420 + 90 * k, 1100 + 120 * k), fs(C['hab.aguaTap'] + 3 + 3 * k), 0.45, -0.3 + 0.15 * k)
add(sfx, fx_click(), at('hab.pasosTap'), 0.5)
for k in range(8):
    add(sfx, fx_tick(2200 + 140 * k), fs(C['hab.pasosTap'] + 2 + 2 * k), 0.3)
add(sfx, fx_shimmer(('D6', 'F#6', 'A6', 'D7', 'F#7'), 0.05, 1.6), at('hab.hito'), 0.42)
add(sfx, fx_boop(), at('hab.racha', 8), 0.3)
add(sfx, fx_glow(990, 0.9), at('hab.flame'), 0.5)
add(sfx, fx_whoosh(0.4, 300, 3500), at('hab.cal', -6), 0.2)
add(sfx, fx_click(), at('sty.accentTap'), 0.5)
add(sfx, fx_whoosh(0.3, 500, 5000), at('sty.sheet'), 0.15)
for k in range(6):
    add(sfx, fx_pop(), fs(C['sty.fan'] + 3 * k), 0.22, -0.6 + 0.24 * k)
add(sfx, fx_whoosh(0.4, 300, 8000), at('sty.fanEnd', -8), 0.3)
add(sfx, fx_click(), at('sty.theme'), 0.5)
add(sfx, fx_swell(0.8, 400, 4000), at('sty.theme', 1), 0.3)
add(sfx, fx_glow(1100, 0.9), at('sty.theme', 4), 0.35)
add(sfx, fx_whoosh(0.35, 400, 9000), at('sty.split', -4), 0.35)
for k, f in enumerate(C['sty.light']):
    add(sfx, fx_tick(2700 + 200 * k), fs(f), 0.36)
add(sfx, fx_click(), at('sty.dark'), 0.4)
add(sfx, fx_glow(587, 1.8), at('priv.halo'), 0.4)
for k in range(12):
    add(sfx, fx_tick(2400 + 90 * k), fs(C['priv.build'] + k * BEAT_F / 2), 0.18 + 0.02 * k)
for k in range(3):
    add(sfx, fx_tick(2600 + 200 * k), fs(C['fin.lines'] + 5 * k), 0.35)
add(sfx, fx_swell(1.0, 250, 3000), at('fin.runner'), 0.3)
add(sfx, fx_glow(440, 2.0), at('fin.fill'), 0.55)
add(sfx, fx_shimmer(('A6', 'D7', 'F#7', 'A7'), 0.05, 1.8), at('fin.word'), 0.35)
add(sfx, fx_whoosh(0.4, 400, 5000), at('fin.slogan', -4), 0.15)
add(sfx, fx_pop(), at('fin.cta'), 0.35)
for k in range(10):
    add(sfx, fx_pop(), fs(C['fin.cta'] + 2 + 2 * k), 0.12, -0.8 + 0.18 * k)


def write(name, x):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    sf.write(os.path.join(STEMS, name), x[: int((LENGTH + 0.5) * SR)].astype(np.float32), SR, subtype='FLOAT')


write('music.wav', music * 0.55)
write('sfx.wav', sfx)
write('voice.wav', voice)
print(f'stems written to {STEMS} (voice: {VOICE_SOURCE})')

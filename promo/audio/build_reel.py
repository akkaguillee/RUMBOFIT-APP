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
- Score (synthesised with audio/synth.py, original, so free to use): a hybrid
  cinematic trailer at 100 BPM in D major. A braam, a heartbeat and an emotional
  piano motif for the hook; a drop with impact and sub when the phone slams in;
  string ostinato, toms and taiko driving evolution and training; a euphoric
  lift for habits, bright plucks for «a tu estilo»; a breakdown for privacy
  where the motif returns; a snare roll into the light, and the big drop on the
  logo. Risers, reversed cymbals and impacts sit on every cinematic transition
  (the fx.* cues), and a breath of silence before each drop. Scene cuts sit on
  bar lines.
- Stems (48 kHz) go to audio/stems-reel/; audio/mux_reel.sh mixes and encodes.
"""

import json
import os
import re
import subprocess

import numpy as np
import soundfile as sf

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
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT                       # 2.4 s
LENGTH = 106.5                       # seconds of picture
FRAMES = int(round(LENGTH * FPS))    # 3195
N = int((LENGTH + 0.5) * SR)

# Scene grid in bars (cuts on bar lines, close to the brief's 0:09 / 0:21 / 0:36 / 0:51 / 1:05 / 1:19 / 1:33 / 1:45).
SCENE_BARS = [('hook', 0), ('reveal', 4), ('evolution', 9), ('training', 15), ('habits', 21), ('style', 27), ('privacy', 33), ('finale', 39)]
SCENE_S = {name: bar * BAR for name, bar in SCENE_BARS}
SCENES = {}
for (name, bar), nxt in zip(SCENE_BARS, SCENE_BARS[1:] + [('end', None)]):
    end = FRAMES if nxt[1] is None else int(round(nxt[1] * BAR * FPS))
    SCENES[name] = [int(round(bar * BAR * FPS)), end]

# Where each narration line starts (s). The blocks leave air after every line.
VOICE_AT = {'r1': 1.8, 'r2': 10.6, 'r3': 22.4, 'r4': 36.8, 'r5': 51.2, 'r6': 65.6, 'r7': 80.4, 'r8': 94.4}

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
    for folder, label in (('elevenlabs', 'elevenlabs'), ('guia', 'guia')):
        for ext in ('wav', 'mp3'):
            p = os.path.join(VOICE_DIR, folder, f'{line_id}.{ext}')
            if os.path.exists(p):
                x = decode(p)
                e = np.abs(x)
                idx = np.where(e > 0.01 * e.max())[0]
                return x[max(0, idx[0] - 400): idx[-1] + 2400], label
    raise SystemExit(f'No take for {line_id}: run audio/reel_guide_voice.py or add audio/voice-reel/elevenlabs/{line_id}.wav')


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
    # Same dry chain for every take: rumble out, a little presence, matched level.
    y = hp(x, 80, 2)
    y = peaking(y, 3500, 1.0, 1.0)
    y = y / (np.sqrt(np.mean(y ** 2)) + 1e-9) * 0.11
    i = int(at * SR)
    voice[i:i + len(y)] += y[: N - i]
    print(line['id'], label, f'{at:.1f}–{at + end:.1f} s')

VOICE_SOURCE = 'elevenlabs' if sources == {'elevenlabs'} else ('guia' if sources == {'guia'} else 'mixta')
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
C = {}
# Hook: Rumbi wakes, lights a dot, the dot walks a path; logo and title.
C['hook.look'] = 16
C['hook.spark'] = 34
C['hook.dot'] = 46
C['hook.path'] = W('r1', 0)
C['hook.pathEnd'] = END('r1') + 30
C['hook.logo'] = 70
C['hook.title'] = END('r1') + 8
# Reveal: the path becomes the phone's edge; welcome screen, then home.
C['reveal.phone'] = S['reveal']
C['reveal.screen'] = S['reveal'] + 20
C['reveal.tap'] = W('r2', 'registrar') - 8
C['reveal.hl1'] = W('r2', 'registrar') + 4
C['reveal.hl2'] = max(W('r2', 'ver'), C['reveal.hl1'] + 24)
C['reveal.title'] = END('r2') + 10
# Evolution: real chart, IMC, calories, a real record.
C['evo.tab'] = S['evolution'] + 2
C['evo.scroll'] = max(W('r3', 'evolucion') - 4, C['evo.tab'] + 14)
C['evo.draw'] = C['evo.scroll'] + 16
C['evo.imc'] = max(W('r3', 'IMC') - 3, C['evo.draw'] + 34)
C['evo.cal'] = max(W('r3', 'calorias') - 3, C['evo.imc'] + 18)
C['evo.back'] = max(W('r3', 'Cada') - 8, C['evo.cal'] + 20)
C['evo.tip'] = C['evo.back'] + 14
C['evo.list'] = max(END('r3') + 6, C['evo.tip'] + 30)
C['evo.title'] = C['evo.list'] + 6
# Training: a session card slides in, then history, routines, records and a completed set.
C['train.card'] = S['training']
C['train.hist'] = max(W('r4', 'entrenamientos') - 6, C['train.card'] + 20)
C['train.rut'] = max(W('r4', 'rutinas') - 4, C['train.hist'] + 18)
C['train.marcas'] = max(W('r4', 'marcas') - 4, C['train.rut'] + 18)
C['train.ses'] = max(W('r4', 'volver') - 4, C['train.marcas'] + 24)
C['train.check'] = max(W('r4', 'trabajo') - 2, C['train.ses'] + 20)
C['train.check2'] = C['train.check'] + 22
C['train.title'] = max(END('r4') + 10, C['train.check2'] + 14)
# Habits: water and steps become real cards; a real milestone, the streak, the calendar.
C['hab.icons'] = S['habits']
C['hab.cards'] = S['habits'] + 16
C['hab.agua'] = max(W('r5', 'habitos') - 4, C['hab.cards'] + 22)
C['hab.aguaTap'] = max(W('r5', 'agua') - 6, C['hab.agua'] + 14)
C['hab.pasos'] = max(W('r5', 'pasos') - 6, C['hab.aguaTap'] + 24)
C['hab.pasosTap'] = C['hab.pasos'] + 12
C['hab.hito'] = max(W('r5', 'Celebra') - 2, C['hab.pasosTap'] + 28)
C['hab.racha'] = max(W('r5', 'constancia') - 8, C['hab.hito'] + 36)
C['hab.flame'] = C['hab.racha'] + 26
C['hab.cal'] = max(W('r5', 'sin') - 4, C['hab.flame'] + 18)
C['hab.legend'] = max(W('r5', 'perfeccion'), C['hab.cal'] + 14)
C['hab.title'] = max(END('r5') + 8, C['hab.legend'] + 16)
# Style: the real color control and the real light/dark switch.
C['sty.accentTap'] = max(W('r6', 'colores') - 14, S['style'] + 20)
C['sty.sheet'] = C['sty.accentTap'] + 4
C['sty.pick'] = C['sty.sheet'] + 20
C['sty.accents'] = [C['sty.pick'] + 8 + 18 * k for k in range(5)]  # cian, fucsia, naranja, volt, rojo (on the beat)
C['sty.violet'] = C['sty.accents'][-1] + 18
C['sty.theme'] = max(W('r6', 'tema') - 6, C['sty.violet'] + 14)
C['sty.light'] = [C['sty.theme'] + 36, C['sty.theme'] + 54, C['sty.theme'] + 72]  # cian, fucsia, violeta (light)
C['sty.title'] = max(END('r6') + 8, C['sty.theme'] + 28)
C['sty.dark'] = S['privacy'] - 30
# Privacy: a calm scene; records settle into the phone.
C['priv.in'] = S['privacy']
C['priv.halo'] = S['privacy'] + 70
C['priv.title'] = END('r7') + 6
# Finale: the light redraws the logo; Rumbi beside RUMBO; call to action.
C['fin.out'] = S['finale']
C['fin.lines'] = S['finale'] + 18
C['fin.runner'] = S['finale'] + 40
C['fin.fill'] = S['finale'] + 78
C['fin.word'] = max(W('r8', 8) - 4, C['fin.fill'] + 8)
C['fin.slogan'] = max(W('r8', 9), C['fin.word'] + 18)
C['fin.cta'] = max(W('r8', 13) - 2, C['fin.slogan'] + 20)
assert C['fin.cta'] <= FRAMES - 60, 'the call to action must stay on screen for at least 2 s'

# Cinematic beats shared by picture and sound: drops, dives, whips, flips, punches.
C['fx.braam'] = 6
C['fx.drop1'] = S['reveal']                      # the phone slams in; letterbox opens
C['fx.dive'] = S['evolution'] - 14               # the camera dives into the screen…
C['fx.surface'] = S['evolution']                 # …and surfaces in Progreso
C['fx.whip'] = S['training'] - 6                 # whip pan out and back in
C['fx.punchOut'] = S['habits']                   # zoom punch out
C['fx.flip'] = S['style'] - 8                    # the phone flips to the style scene
C['fx.calm'] = S['privacy']                      # the music breaks down
C['fx.build'] = S['finale'] - 108                # snare roll and riser into the finale
C['fx.dive2'] = S['finale'] - 12                 # into the light
C['fx.flash'] = S['finale']                      # white-violet flash
C['fx.drop2'] = C['fin.fill']                    # the logo lands: the big drop
C['fx.punches'] = sorted({C['evo.draw'], C['evo.tip'], C['train.check'], C['hab.aguaTap'] + 4, C['hab.hito'], C['hab.flame'], C['sty.theme'] + 4, C['fin.word'], C['fin.cta']})

json.dump({'fps': FPS, 'frames': FRAMES, 'bpm': BPM, 'scenes': SCENES, 'cues': C, 'voice': VOICE_SOURCE}, open(os.path.join(REEL, 'cues.json'), 'w'), indent=1)

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


# ── Score: hybrid cinematic trailer, 100 BPM, D major ────────────────────
def fs(frame):
    return frame / FPS


def T(name):
    return fs(C[name])


CHORDS = {  # pad voicing, bass root
    'D': (['F#3', 'A3', 'D4', 'E4'], 'D2'),
    'D/F#': (['F#3', 'A3', 'D4', 'E4'], 'F#1'),
    'A/C#': (['E3', 'A3', 'C#4', 'E4'], 'C#2'),
    'A': (['E3', 'A3', 'C#4', 'E4'], 'A1'),
    'Asus': (['E3', 'A3', 'D4', 'E4'], 'A1'),
    'Bm': (['F#3', 'B3', 'D4', 'F#4'], 'B1'),
    'Bm7': (['F#3', 'A3', 'D4', 'E4'], 'B1'),
    'G': (['G3', 'B3', 'D4', 'F#4'], 'G1'),
    'Em7': (['G3', 'B3', 'D4', 'E4'], 'E2'),
}
BARS = (
    ['G', 'D/F#', 'Em7', 'Asus']                       # hook
    + ['D', 'A/C#', 'Bm7', 'G', 'Asus']                # reveal
    + ['D', 'A/C#', 'Bm', 'G', 'Em7', 'Asus']          # evolution
    + ['G', 'D', 'A', 'Bm', 'G', 'A']                  # training
    + ['Bm', 'G', 'D', 'A', 'Em7', 'Asus']             # habits
    + ['D', 'A/C#', 'Bm', 'G', 'D', 'Asus']            # style
    + ['G', 'D/F#', 'Em7', 'D/F#', 'G', 'Asus']        # privacy
    + ['D', 'A/C#', 'Bm', 'G', 'D', 'D']               # finale (the last D rings out)
)
n_bars = len(BARS)


def chord(bar):
    return CHORDS[BARS[min(bar, n_bars - 1)]]


def section(t):
    name = 'hook'
    for k, s0 in sorted(SCENE_S.items(), key=lambda kv: kv[1]):
        if t + 1e-6 >= s0:
            name = k
    return name


def upper(b):
    return [nm[:-1] + str(int(nm[-1]) + 1) for nm in sorted(chord(b)[0], key=hz)]


DROP1, SURFACE, WHIP, PUNCH, FLIP, CALM, BUILD, FLASH, DROP2, CTA = (
    T('fx.drop1'), T('fx.surface'), T('fx.whip'), T('fx.punchOut'), T('fx.flip'), T('fx.calm'), T('fx.build'), T('fx.flash'), T('fx.drop2'), T('fin.cta'))
# The finale's groove runs from the logo drop to the call to action.
GROOVE_END = CTA

tonal = np.zeros((N, 2))   # chords, keys, strings, bass: breathe with the kick
drums = np.zeros((N, 2))
wash = np.zeros((N, 2))    # braams, risers, impacts: never pumped
kicks = []


def braam(dur=3.2, root='D1', bright=2200):
    """The big cinematic horn: a stack of detuned saws whose filter opens and closes."""
    n = int(dur * SR)
    x = np.zeros(n)
    for nm, g in ((root, 1.0), (root[:-1] + str(int(root[-1]) + 1), 0.8), ('A' + str(int(root[-1]) + 1), 0.5)):
        for d in (-0.008, -0.003, 0.0, 0.004, 0.009):
            x += saw(hz(nm) * (1 + d), n, synth.rng.random()) * g
    x = np.tanh(x / 4)
    y = synth.sweep(x, 160, bright, 'low')
    e = env(n, 0.04, 0.5, 0.75, 1.6)
    return verb(synth.st(y * e * 0.5, 0, 220), HALL, 0.45)


def hit_chord(name='D', dur=2.8):
    """A short orchestral stab of the chord with a long tail."""
    n = int(dur * SR)
    x = np.zeros(n)
    for nm in chord_names(name):
        for d in (-0.006, 0.0, 0.006):
            x += saw(hz(nm) * (1 + d), n, synth.rng.random())
    x = lp(x / 10, 4200) * env(n, 0.006, 0.35, 0.3, 1.8)
    return verb(synth.st(x, 0, 160), HALL, 0.5)


def chord_names(name):
    v = CHORDS[name][0]
    return v + [nm[:-1] + str(int(nm[-1]) + 1) for nm in v] + [CHORDS[name][1][:-1] + '2']


def sub_drop(dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 30 + 55 * np.exp(-t * 2.5)
    return synth.st(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) * 0.9)


def taiko():
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(62 * (1 + 0.5 * np.exp(-t * 20))) / SR) * np.exp(-t * 3.2)
    skin = lp(synth.rng.standard_normal(n), 1200) * np.exp(-t * 25) * 0.35
    return verb(synth.st(np.tanh((body + skin) * 1.6) * 0.8), HALL, 0.25)


def spiccato(f, dur=0.16):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = saw(f, n, synth.rng.random()) * 0.7 + saw(f * 1.003, n, synth.rng.random()) * 0.5
    return lp(x, 2600) * np.exp(-t * 16) * (1 - np.exp(-t * 300))


# Pad: wide detuned saws; the filter opens as the story gains energy.
CUT = {'hook': 700, 'reveal': 1700, 'evolution': 2000, 'training': 2300, 'habits': 2700, 'style': 2600, 'privacy': 1100, 'finale': 2400}
LEVEL = {'hook': 0.8, 'reveal': 0.75, 'evolution': 0.7, 'training': 0.65, 'habits': 0.8, 'style': 0.6, 'privacy': 0.95, 'finale': 0.9}
for b in range(n_bars):
    t0 = b * BAR
    sec = section(t0)
    last = b == n_bars - 1
    n = int((BAR + (3.8 if last else 0.9)) * SR)
    voicing = chord(b)[0]
    x = np.zeros(n)
    for nm in voicing + [voicing[-1][:-1] + str(int(voicing[-1][-1]) + 1)]:
        for d in (-0.005, 0.0, 0.0055):
            x += saw(hz(nm) * (1 + d), n, synth.rng.random())
    x = lp(x / 16 * env(n, 1.8 if b == 0 else 0.5, 0.4, 0.85, 3.6 if last else 0.9), CUT[sec]) * LEVEL[sec]
    add(tonal, x, t0 - (0.0 if b == 0 else 0.15), 0.8, -0.25)
    add(tonal, np.roll(x, 300), t0 - (0.0 if b == 0 else 0.15), 0.8, 0.25)

# Piano: an emotional motif in the hook and again in privacy; flowing eighths in between.
MOTIF = [  # (bar offset, beat, note, length)
    (0, 0, 'D5', 1.4), (0, 1.5, 'B4', 0.8), (0, 2, 'D5', 0.8), (0, 3, 'E5', 1.2),
    (1, 0, 'F#5', 1.6), (1, 1.5, 'E5', 0.8), (1, 2, 'D5', 0.8), (1, 3, 'A4', 1.2),
    (2, 0, 'B4', 1.4), (2, 1.5, 'D5', 0.8), (2, 2, 'E5', 0.8), (2, 3, 'G5', 1.4),
    (3, 0, 'F#5', 2.2), (3, 2.5, 'E5', 1.6),
]
for start in (0.0, CALM):
    for bar, beat, nm, ln in MOTIF:
        if start == 0.0 and bar == 0 and beat == 0:
            continue
        add(tonal, keys(hz(nm), ln + 1.4, 1.0), start + bar * BAR + beat * BEAT, 0.3, 0.1)
    if start == CALM:  # second half of the breakdown: the motif an octave down, softer
        for bar, beat, nm, ln in MOTIF:
            add(tonal, keys(hz(nm) / 2, ln + 1.6, 0.8), start + (bar + 4) * BAR + beat * BEAT, 0.2, -0.1)
PATTERN = [0, 2, 1, 3, 2, 1, 3, 2]
for b in range(n_bars):
    t0 = b * BAR
    sec = section(t0)
    if sec in ('hook', 'privacy') or (sec == 'finale' and t0 < DROP2 - 0.1) or t0 >= GROOVE_END:
        continue
    tones = upper(b)
    for k in range(8):
        add(tonal, keys(hz(tones[PATTERN[k]]), 1.3, 0.9), t0 + k * BEAT / 2, 0.17 if k % 2 == 0 else 0.11, 0.15)

# Strings: a driving spiccato ostinato in sixteenths while the story moves.
for b in range(n_bars):
    t0 = b * BAR
    sec = section(t0)
    if sec in ('hook', 'privacy', 'style') or (sec == 'finale' and t0 < DROP2 - 0.1) or t0 >= GROOVE_END:
        continue
    root = hz(chord(b)[1]) * (4 if hz(chord(b)[1]) < 60 else 2)
    fifth = root * 1.5
    seq = [root, fifth, root * 2, fifth]
    for s16 in range(16):
        add(tonal, spiccato(seq[s16 % 4]), t0 + s16 * BEAT / 4, 0.085 if s16 % 4 == 0 else 0.06, -0.5 if s16 % 2 else 0.5)

# Bass: round and low, out for the hook and the breakdown.
for b in range(n_bars):
    t0 = b * BAR
    sec = section(t0)
    if sec in ('hook', 'privacy') or (sec == 'finale' and t0 < DROP2 - 0.1) or t0 >= GROOVE_END:
        continue
    root = hz(chord(b)[1])
    for at_, ln in ((0, 1.1), (1.5 * BEAT, 0.5), (2 * BEAT, 1.1), (3.5 * BEAT, 0.35)):
        n = int(ln * SR)
        x = (sine(root, n) * 0.8 + lp(saw(root, n), 420) * 0.3) * env(n, 0.01, 0.2, 0.7, 0.12)
        add(tonal, x, t0 + at_, 0.36)

# Plucks: bright and playful for «a tu estilo».
for b in range(n_bars):
    t0 = b * BAR
    if section(t0) != 'style':
        continue
    tones = upper(b)
    for k in range(8):
        f = hz(tones[(k * 3) % len(tones)]) * (2 if k in (3, 7) else 1)
        add(tonal, pluck(f, 0.3, 4200), t0 + k * BEAT / 2, 0.17, (-0.4 if k % 2 else 0.4))

# Drums: the pulse grows section by section, drops out for privacy, returns bigger.
def kick_at(t, g=0.55):
    add(drums, kick(0.8), t, g)
    kicks.append(t)


for b in range(n_bars):
    t0 = b * BAR
    sec = section(t0)
    if sec in ('hook', 'privacy'):
        continue
    if sec == 'finale' and (t0 < DROP2 - 0.1 or t0 >= GROOVE_END):
        continue
    last_of_phrase = (b - SCENE_BARS[[s for s, _ in SCENE_BARS].index(sec)][1]) % 4 == 3
    for q in range(4):
        t = t0 + q * BEAT
        if sec == 'style':
            kick_at(t, 0.5)
        elif q in (0, 2):
            kick_at(t, 0.58)
        if sec == 'training' and q == 1:
            kick_at(t + BEAT / 2, 0.42)
        if q in (1, 3):
            add(drums, synth.snare(), t, 0.3 if sec in ('training', 'finale') else 0.22, 0.05)
            add(drums, clap(), t, 0.14, -0.05)
        if sec in ('training', 'finale') and q in (0, 2):
            add(drums, taiko(), t, 0.5)
    if sec in ('reveal', 'evolution', 'habits'):
        for e in range(8):
            add(drums, hat(open_=(sec == 'habits' and e % 2 == 1)), t0 + e * BEAT / 2, 0.16 if e % 2 else 0.1, 0.3)
    if sec in ('training', 'finale', 'style'):
        for s16 in range(16):
            add(drums, hat(), t0 + s16 * BEAT / 4, 0.13 if s16 % 2 else 0.07, -0.3)
    if sec in ('evolution', 'habits'):
        for e in range(16):
            add(drums, shaker(), t0 + e * BEAT / 4, 0.08, 0.35)
    if last_of_phrase and sec != 'style':  # tom fill into the next phrase
        for k, f in enumerate((140, 120, 100, 85, 72, 62)):
            add(drums, synth.tom(f), t0 + 2 * BEAT + k * BEAT / 3, 0.38, -0.6 + 0.24 * k)

# The build into the finale: a snare roll that tightens, toms and kicks underneath.
t = BUILD
while t < FLASH - 0.14:
    p = (t - BUILD) / (FLASH - BUILD)
    step = BEAT / (2 if p < 0.35 else 4 if p < 0.7 else 8)
    add(drums, synth.snare(), t, 0.08 + 0.3 * p ** 1.5, 0.0)
    t += step
for k in range(8):
    add(drums, taiko(), BUILD + k * BEAT, 0.25 + 0.05 * k)
    kicks.append(BUILD + k * BEAT)

# Heartbeat under the hook and the breakdown.
for t0 in [0.6 + k * 1.2 for k in range(7)] + [CALM + 0.6 + k * 1.2 for k in range(8)]:
    add(wash, synth.fx_heart(True), t0, 0.32)
    add(wash, synth.fx_heart(False), t0 + 0.32, 0.24)

# Braams, impacts, sub drops, risers and reversed cymbals on the cinematic beats.
add(wash, braam(3.6, 'D1', 1500), T('fx.braam'), 0.7)
for at_, big in ((DROP1, True), (SURFACE, False), (WHIP + 0.2, False), (PUNCH, False), (FLIP + fs(8), False), (FLASH, True), (DROP2, True)):
    add(wash, synth.fx_impact(2.4 if big else 1.6, 34 if big else 42), at_, 0.9 if big else 0.55)
    add(wash, synth.fx_reverse(1.4 if big else 1.0), at_ - (1.4 if big else 1.0), 0.6 if big else 0.4)
    add(wash, synth.cymbal(3.0 if big else 2.0), at_, 0.55 if big else 0.35)
for at_ in (DROP1, DROP2):
    add(wash, braam(3.2, 'D1', 2600), at_, 0.75)
    add(wash, sub_drop(1.8), at_, 0.9)
    add(tonal, hit_chord('D', 3.0), at_, 0.5)
add(wash, synth.fx_impact(3.0, 30), CALM, 0.35)
for a, b_ in ((5.6, DROP1), (SURFACE - 1.9, SURFACE), (WHIP - 1.4, WHIP + 0.2), (PUNCH - 1.6, PUNCH), (FLIP - 1.2, FLIP + fs(8)), (BUILD, FLASH), (FLASH + 0.3, DROP2)):
    add(wash, synth.fx_riser(b_ - a, 300, 9000), a, 0.5)
# Final sting on the call to action, then the last chord rings out.
add(tonal, hit_chord('D', 4.5), CTA, 0.42)
add(wash, synth.fx_shimmer(('D6', 'F#6', 'A6', 'D7', 'F#7', 'A7'), 0.06, 3.0), CTA, 0.3)
add(wash, synth.fx_impact(3.0, 36), CTA, 0.45)

# Tension: a breath of silence right before each drop.
gate = np.ones(N)
for at_ in (DROP1, FLASH, DROP2):
    i0, i1 = int((at_ - 0.16) * SR), int(at_ * SR)
    gate[i0:i1] = np.linspace(1, 0, max(1, i1 - i0)) ** 3
tonal *= gate[:, None]
drums *= gate[:, None]

# Sidechain: the tonal bed breathes with the kick.
duck = np.ones(N)
for t in kicks:
    i = int(t * SR)
    n = int(0.32 * SR)
    shape = 1 - 0.32 * np.exp(-np.arange(n) / (0.09 * SR))
    if i < N:
        duck[i:i + n] = np.minimum(duck[i:i + n], shape[: max(0, min(n, N - i))])
tonal *= duck[:, None]
music = verb(tonal, HALL, 0.24) + verb(drums, ROOM, 0.14) + wash * 0.8
music *= np.minimum(1, np.arange(N) / (0.05 * SR))[:, None]

# ── Sound design (picture events) ────────────────────────────────────────
sfx = np.zeros((N, 2))


def at(key, offset=0):
    return fs(C[key] + offset)


# Opening: the spark, the dot, the little steps, the logo, the title slam.
add(sfx, fx_glow(1320, 1.2), at('hook.spark'), 0.5)
add(sfx, fx_bell('A6', 1.2), at('hook.dot'), 0.22)
steps_n = 9
for k in range(steps_n):
    t = fs(C['hook.path']) + (fs(C['hook.pathEnd']) - fs(C['hook.path'])) * (k + 0.5) / steps_n
    add(sfx, fx_tick(2400 + 120 * (k % 3)), t, 0.4, -0.6 + 1.2 * k / (steps_n - 1))
add(sfx, fx_glow(660, 1.6), at('hook.logo'), 0.6)
add(sfx, fx_whoosh(0.5, 300, 6000), at('hook.title', -8), 0.3)
add(sfx, synth.fx_thud(), at('hook.title'), 0.5)
add(sfx, fx_whoosh(0.4, 300, 6000), at('hook.title', 0), 0.2)

# Transitions: whooshes that follow the camera.
for key, ln, g in (('fx.drop1', 0.7, 0.5), ('fx.dive', 0.6, 0.55), ('fx.surface', 0.5, 0.35), ('fx.whip', 0.45, 0.6), ('fx.punchOut', 0.6, 0.45), ('fx.flip', 0.55, 0.5), ('fx.dive2', 0.5, 0.5)):
    add(sfx, fx_whoosh(ln, 220, 8000), at(key, -int(ln * FPS * 0.6)), g)
add(sfx, fx_whoosh(0.45, 260, 8000), at('fx.whip', 6), 0.5)
for f in C['fx.punches']:
    add(sfx, synth.fx_thud(), fs(f), 0.45)
    add(sfx, fx_whoosh(0.3, 400, 7000), fs(f) - 0.12, 0.18)

# Titles slam in.
for key, off in (('reveal.title', 0), ('reveal.title', 32), ('evo.title', 0), ('train.title', 0), ('hab.title', 0), ('sty.title', 0), ('priv.title', 0)):
    add(sfx, fx_whoosh(0.35, 400, 7000), at(key, off - 6), 0.22)
    add(sfx, synth.fx_thud(), at(key, off), 0.3)

# Interface: taps, pages, values.
add(sfx, fx_click(), at('reveal.tap'), 0.5)
add(sfx, fx_pop(), at('reveal.tap', 2), 0.25)
add(sfx, fx_click(), at('evo.tab'), 0.45)
add(sfx, fx_swell(1.2, 300, 3200), at('evo.draw'), 0.3)
add(sfx, fx_tick(2600), at('evo.imc'), 0.45)
add(sfx, fx_tick(2900), at('evo.cal'), 0.45)
add(sfx, fx_click(), at('evo.tip'), 0.5)
add(sfx, fx_pop(), at('evo.tip', 3), 0.25)
for k in range(5):
    add(sfx, fx_tick(3000 + 80 * k), fs(C['evo.list'] + 14 + 9 * k), 0.22)
add(sfx, fx_whoosh(0.7, 250, 6000), at('train.card', -2), 0.3)
add(sfx, synth.fx_thud(), at('train.card', 22), 0.35)
add(sfx, fx_tick(2600), at('train.rut'), 0.45)
add(sfx, fx_tick(2900), at('train.marcas'), 0.45)
add(sfx, fx_click(), at('train.check'), 0.55)
add(sfx, fx_check(), at('train.check', 1), 0.6)
add(sfx, fx_shimmer(('E6', 'A6', 'C#7', 'E7'), 0.045, 1.6), at('train.check', 3), 0.38)
add(sfx, fx_click(), at('train.check2'), 0.45)
add(sfx, fx_check(), at('train.check2', 1), 0.4)
add(sfx, fx_pop(), at('hab.icons'), 0.3)
add(sfx, fx_pop(), at('hab.icons', 5), 0.25)
add(sfx, fx_whoosh(0.5, 300, 5000), at('hab.cards'), 0.25)
add(sfx, fx_click(), at('hab.aguaTap'), 0.5)
for k in range(5):
    add(sfx, fx_bubble(420 + 90 * k, 1100 + 120 * k), fs(C['hab.aguaTap'] + 3 + 3 * k), 0.45, -0.3 + 0.15 * k)
add(sfx, fx_click(), at('hab.pasosTap'), 0.5)
for k in range(8):
    add(sfx, fx_tick(2200 + 140 * k), fs(C['hab.pasosTap'] + 2 + 2 * k), 0.3)
add(sfx, fx_shimmer(('D6', 'F#6', 'A6', 'D7', 'F#7'), 0.05, 1.8), at('hab.hito'), 0.42)
add(sfx, fx_boop(), at('hab.racha', 10), 0.3)
add(sfx, fx_glow(990, 1.0), at('hab.flame'), 0.5)
add(sfx, fx_whoosh(0.5, 300, 3500), at('hab.cal', -6), 0.2)
add(sfx, fx_click(), at('sty.accentTap'), 0.5)
add(sfx, fx_whoosh(0.35, 500, 5000), at('sty.sheet'), 0.15)
add(sfx, fx_click(), at('sty.pick'), 0.5)
for k, f in enumerate(C['sty.accents'] + [C['sty.violet']]):
    add(sfx, fx_tick(2400 + 220 * k), fs(f), 0.42, -0.5 + 0.2 * k)
    add(sfx, fx_whoosh(0.25, 600, 8000), fs(f) - 0.08, 0.12)
add(sfx, fx_click(), at('sty.theme'), 0.5)
add(sfx, fx_swell(0.9, 400, 4000), at('sty.theme', 1), 0.3)
add(sfx, fx_glow(1100, 1.0), at('sty.theme', 4), 0.35)
for k, f in enumerate(C['sty.light']):
    add(sfx, fx_tick(2700 + 200 * k), fs(f), 0.36)
add(sfx, fx_click(), at('sty.dark'), 0.4)
PENTA = ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7']
for k in range(12):
    add(sfx, fx_bell(PENTA[k % len(PENTA)], 1.4), fs(C['priv.in'] + 14 + 5 * k), 0.09, -0.6 + 0.11 * k)
add(sfx, fx_glow(587, 2.2), at('priv.halo'), 0.45)
for k in range(3):
    add(sfx, fx_tick(2600 + 200 * k), fs(C['fin.lines'] + 6 * k), 0.35)
add(sfx, fx_swell(1.3, 250, 3000), at('fin.runner'), 0.3)
add(sfx, fx_glow(440, 2.4), at('fin.fill'), 0.6)
add(sfx, fx_shimmer(('A6', 'D7', 'F#7', 'A7'), 0.05, 2.0), at('fin.word'), 0.35)
add(sfx, fx_whoosh(0.5, 400, 5000), at('fin.slogan', -4), 0.15)
add(sfx, fx_pop(), at('fin.cta'), 0.35)
add(sfx, fx_glow(880, 1.6), at('fin.cta', 2), 0.35)

def write(name, x):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    sf.write(os.path.join(STEMS, name), x[: int((LENGTH + 0.5) * SR)].astype(np.float32), SR, subtype='FLOAT')


write('music.wav', music * 0.55)
write('sfx.wav', sfx)
write('voice.wav', voice)
print(f'stems written to {STEMS} (voice: {VOICE_SOURCE})')

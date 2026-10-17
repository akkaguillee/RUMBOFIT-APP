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
- Score (synthesised with audio/synth.py, original, so free to use): 100 BPM in
  D major, warm and hopeful. Felt piano and a soft pad for the hook, a gentle
  pulse when the phone appears, a light groove for evolution and training, a
  lift for habits, bright plucks for «a tu estilo», drums out for privacy, then
  the pulse returns and resolves on the logo. Scene cuts sit on bar lines.
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


# ── Score ────────────────────────────────────────────────────────────────
def fs(frame):
    return frame / FPS


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


def chord(bar):
    return CHORDS[BARS[min(bar, len(BARS) - 1)]]


def section(t):
    name = 'hook'
    for k, s in sorted(SCENE_S.items(), key=lambda kv: kv[1]):
        if t + 1e-6 >= s:
            name = k
    return name


tonal = np.zeros((N, 2))
drums = np.zeros((N, 2))
kicks = []
n_bars = len(BARS)
END_T = n_bars * BAR

# Pad: wide detuned saws; the filter opens as the story gains energy.
CUT = {'hook': 900, 'reveal': 1300, 'evolution': 1600, 'training': 1900, 'habits': 2200, 'style': 2600, 'privacy': 1200, 'finale': 2000}
LEVEL = {'hook': 0.75, 'reveal': 0.8, 'evolution': 0.75, 'training': 0.7, 'habits': 0.8, 'style': 0.65, 'privacy': 0.9, 'finale': 0.85}
for b in range(n_bars):
    t0 = b * BAR
    sec = section(t0)
    last = b == n_bars - 1
    dur = BAR + (3.5 if last else 0.9)
    n = int(dur * SR)
    voicing = chord(b)[0]
    x = np.zeros(n)
    for nm in voicing + [voicing[-1][:-1] + str(int(voicing[-1][-1]) + 1)]:
        for d in (-0.005, 0.0, 0.0055):
            x += saw(hz(nm) * (1 + d), n, synth.rng.random())
    attack = 1.8 if b == 0 else 0.6
    x = lp(x / 16 * env(n, attack, 0.4, 0.85, 0.9 if not last else 3.4), CUT[sec]) * LEVEL[sec]
    add(tonal, x, t0 - (0.0 if b == 0 else 0.15), 0.8, -0.25)
    add(tonal, np.roll(x, 300), t0 - (0.0 if b == 0 else 0.15), 0.8, 0.25)

# Felt piano: sparse in the hook and privacy, flowing eighths elsewhere.
PATTERN = [0, 2, 1, 3, 2, 1, 3, 2]  # indexes into the upper chord tones


def piano_tones(b):
    v = sorted(chord(b)[0], key=hz)
    return [nm[:-1] + str(int(nm[-1]) + 1) for nm in v]


for b in range(n_bars):
    t0 = b * BAR
    sec = section(t0)
    tones = piano_tones(b)
    if sec in ('hook', 'privacy'):
        hits = [(0, tones[0], 0.32), (2 * BEAT, tones[2], 0.22), (3 * BEAT, tones[3], 0.18)]
        if sec == 'hook' and b == 0:
            hits = [(0.4, tones[1], 0.22), (2 * BEAT, tones[2], 0.2)]
    elif sec == 'finale' and b >= n_bars - 2:
        hits = [(0, tones[0], 0.3), (BEAT, tones[2], 0.2)] if b == n_bars - 2 else [(0, tones[0], 0.32), (0.04, tones[2], 0.24), (0.08, tones[3], 0.2)]
    else:
        hits = [(k * BEAT / 2, tones[PATTERN[k]], 0.2 if k % 2 == 0 else 0.13) for k in range(8)]
    for at, nm, g in hits:
        x = keys(hz(nm), 2.6 if sec in ('hook', 'privacy', 'finale') else 1.5, 0.9)
        add(tonal, x, t0 + at, g, 0.15)

# A short motif on top at the openings of evolution, habits and the finale.
MOTIF = [('F#5', 0), ('E5', 1), ('D5', 1.5), ('A5', 3)]
for start in (SCENE_S['evolution'], SCENE_S['habits'], SCENE_S['finale']):
    for nm, beat in MOTIF:
        add(tonal, keys(hz(nm), 2.2, 1.1), start + beat * BEAT, 0.22, -0.1)

# Bass: from evolution on (out for privacy), round and low.
for b in range(n_bars):
    t0 = b * BAR
    sec = section(t0)
    if sec in ('hook', 'reveal', 'privacy') or b == n_bars - 1:
        continue
    root = hz(chord(b)[1])
    for at, ln in ((0, 1.1), (1.5 * BEAT, 0.5), (2 * BEAT, 1.1), (3.5 * BEAT, 0.35)):
        n = int(ln * SR)
        x = (sine(root, n) * 0.8 + lp(saw(root, n), 400) * 0.25) * env(n, 0.01, 0.2, 0.7, 0.12)
        add(tonal, x, t0 + at, 0.34)

# Plucks: bright and playful for «a tu estilo», softer in habits.
for b in range(n_bars):
    t0 = b * BAR
    sec = section(t0)
    if sec not in ('style', 'habits'):
        continue
    tones = piano_tones(b)
    for k in range(8):
        if sec == 'habits' and k % 2:
            continue
        nm = tones[(k * 3) % len(tones)]
        f = hz(nm) * (2 if k in (3, 7) else 1)
        add(tonal, pluck(f, 0.3, 3800 if sec == 'style' else 2600), t0 + k * BEAT / 2, 0.16 if sec == 'style' else 0.11, (-0.4 if k % 2 else 0.4))

# Drums: a soft pulse that grows and steps back.
for b in range(n_bars):
    t0 = b * BAR
    sec = section(t0)
    if sec in ('hook', 'privacy') or b >= n_bars - 2:
        continue
    for q in range(4):
        t = t0 + q * BEAT
        if q in (0, 2):
            add(drums, kick(0.6), t, 0.42 if sec == 'reveal' else 0.5)
            kicks.append(t)
        if sec not in ('reveal',) and q in (1, 3):
            add(drums, clap(), t, 0.11, 0.1)
    if sec != 'reveal':
        for e in range(8):
            add(drums, shaker(), t0 + e * BEAT / 2, 0.16 if e % 2 else 0.1, 0.3)
    if sec in ('training', 'style'):
        for s16 in range(16):
            if s16 % 2:
                add(drums, hat(), t0 + s16 * BEAT / 4, 0.12, -0.3)
# The finale's pulse stops two bars before the end; the logo lands on the last chord.

# Sidechain: the tonal bed breathes with the kick.
duck = np.ones(N)
for t in kicks:
    i = int(t * SR)
    n = int(0.32 * SR)
    shape = 1 - 0.28 * np.exp(-np.arange(n) / (0.09 * SR))
    duck[i:i + n] = np.minimum(duck[i:i + n], shape[: max(0, min(n, N - i))])
tonal *= duck[:, None]
music = verb(tonal, HALL, 0.22) + verb(drums, ROOM, 0.12)
fade_in = np.minimum(1, np.arange(N) / (1.2 * SR))
music *= fade_in[:, None]

# ── Sound design ─────────────────────────────────────────────────────────
sfx = np.zeros((N, 2))


def at(key, offset=0):
    return fs(C[key] + offset)


add(sfx, fx_glow(1320, 1.2), at('hook.spark'), 0.5)
add(sfx, fx_bell('A6', 1.2), at('hook.dot'), 0.18)
steps_n = 9
for k in range(steps_n):  # the little steps of the path
    t = fs(C['hook.path']) + (fs(C['hook.pathEnd']) - fs(C['hook.path'])) * (k + 0.5) / steps_n
    add(sfx, fx_tick(2400 + 120 * (k % 3)), t, 0.35, -0.6 + 1.2 * k / (steps_n - 1))
add(sfx, fx_swell(2.0, 200, 1800), at('hook.path'), 0.18)
add(sfx, fx_glow(660, 1.6), at('hook.logo'), 0.55)
add(sfx, fx_whoosh(0.5, 300, 5000), at('hook.title', -6), 0.12)

add(sfx, fx_swell(1.0, 250, 2600), at('reveal.phone'), 0.3)
add(sfx, fx_click(), at('reveal.tap'), 0.5)
add(sfx, fx_pop(), at('reveal.tap', 2), 0.25)
for k in range(3):
    add(sfx, fx_tick(2800 + 300 * k), fs(C['reveal.title'] + 16 * k), 0.4)

add(sfx, fx_click(), at('evo.tab'), 0.45)
add(sfx, fx_whoosh(0.45, 400, 4500), at('evo.scroll'), 0.1)
add(sfx, fx_swell(1.5, 300, 3000), at('evo.draw'), 0.22)
add(sfx, fx_tick(2600), at('evo.imc'), 0.4)
add(sfx, fx_tick(2900), at('evo.cal'), 0.4)
add(sfx, fx_tick(2600), at('evo.back'), 0.3)
add(sfx, fx_click(), at('evo.tip'), 0.45)
add(sfx, fx_pop(), at('evo.tip', 3), 0.22)
for k in range(6):
    add(sfx, fx_tick(3000), fs(C['evo.list'] + 8 + 5 * k), 0.16)

add(sfx, fx_whoosh(0.7, 250, 6000), at('train.card', -4), 0.2)
add(sfx, fx_swell(0.8, 300, 2400), at('train.hist', -8), 0.2)
add(sfx, fx_tick(2600), at('train.rut'), 0.4)
add(sfx, fx_tick(2900), at('train.marcas'), 0.4)
add(sfx, fx_tick(2600), at('train.ses'), 0.35)
add(sfx, fx_click(), at('train.check'), 0.5)
add(sfx, fx_check(), at('train.check', 1), 0.55)
add(sfx, fx_shimmer(('E6', 'A6', 'C#7', 'E7'), 0.045, 1.6), at('train.check', 3), 0.32)
add(sfx, fx_boop(), at('train.check', 8), 0.22)
add(sfx, fx_click(), at('train.check2'), 0.4)
add(sfx, fx_check(), at('train.check2', 1), 0.35)

add(sfx, fx_pop(), at('hab.icons'), 0.25)
add(sfx, fx_pop(), at('hab.icons', 5), 0.2)
add(sfx, fx_swell(0.7, 300, 2400), at('hab.cards'), 0.2)
add(sfx, fx_click(), at('hab.aguaTap'), 0.45)
for k in range(5):
    add(sfx, fx_bubble(420 + 90 * k, 1100 + 120 * k), fs(C['hab.aguaTap'] + 3 + 3 * k), 0.4, -0.3 + 0.15 * k)
add(sfx, fx_click(), at('hab.pasosTap'), 0.45)
for k in range(6):
    add(sfx, fx_tick(2200 + 160 * k), fs(C['hab.pasosTap'] + 2 + 3 * k), 0.28)
add(sfx, fx_shimmer(('D6', 'F#6', 'A6', 'D7', 'F#7'), 0.05, 1.8), at('hab.hito'), 0.36)
add(sfx, fx_bell('D6', 1.4), at('hab.hito'), 0.2)
add(sfx, fx_boop(), at('hab.racha', 10), 0.25)
add(sfx, fx_glow(990, 1.0), at('hab.flame'), 0.45)
add(sfx, fx_whoosh(0.5, 300, 3500), at('hab.cal', -6), 0.12)

add(sfx, fx_click(), at('sty.accentTap'), 0.45)
add(sfx, fx_whoosh(0.35, 500, 5000), at('sty.sheet'), 0.1)
add(sfx, fx_click(), at('sty.pick'), 0.45)
for k, f in enumerate(C['sty.accents'] + [C['sty.violet']]):
    add(sfx, fx_tick(2400 + 220 * k), fs(f), 0.38, -0.5 + 0.2 * k)
add(sfx, fx_click(), at('sty.theme'), 0.45)
add(sfx, fx_swell(0.9, 400, 4000), at('sty.theme', 1), 0.25)
add(sfx, fx_glow(1100, 1.0), at('sty.theme', 4), 0.3)
for k, f in enumerate(C['sty.light']):
    add(sfx, fx_tick(2700 + 200 * k), fs(f), 0.32)
add(sfx, fx_whoosh(0.5, 300, 5000), at('sty.title', -6), 0.1)
add(sfx, fx_click(), at('sty.dark'), 0.35)

PENTA = ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7']
for k in range(8):
    add(sfx, fx_bell(PENTA[k % len(PENTA)], 1.2), fs(C['priv.in'] + 20 + 7 * k), 0.08, -0.6 + 0.17 * k)
add(sfx, fx_glow(587, 2.0), at('priv.halo'), 0.4)

add(sfx, fx_whoosh(0.6, 300, 5000), at('fin.out'), 0.14)
for k in range(3):
    add(sfx, fx_tick(2600 + 200 * k), fs(C['fin.lines'] + 6 * k), 0.3)
add(sfx, fx_swell(1.3, 250, 3000), at('fin.runner'), 0.25)
add(sfx, fx_glow(440, 2.2), at('fin.fill'), 0.6)
add(sfx, fx_shimmer(('A6', 'D7', 'F#7', 'A7'), 0.05, 2.0), at('fin.word'), 0.3)
add(sfx, fx_whoosh(0.5, 400, 5000), at('fin.slogan', -4), 0.08)
add(sfx, fx_pop(), at('fin.cta'), 0.3)
add(sfx, fx_glow(880, 1.4), at('fin.cta', 2), 0.3)


def write(name, x):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    sf.write(os.path.join(STEMS, name), x[: int((LENGTH + 0.5) * SR)].astype(np.float32), SR, subtype='FLOAT')


write('music.wav', music * 0.9)
write('sfx.wav', sfx)
write('voice.wav', voice)
print(f'stems written to {STEMS} (voice: {VOICE_SOURCE})')

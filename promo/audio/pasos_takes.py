"""Analyses the ElevenLabs takes of «Cada pequeño paso cuenta» and helps pick one per line.

    python3 audio/pasos_takes.py analyse     # metrics per take + takes-all.wav for transcription
    python3 audio/pasos_takes.py pick l1=ID l2=ID …   # writes voice-pasos/l1.wav … (trimmed, 48 kHz)
    python3 audio/pasos_takes.py timeline   # word frames (src/pasos/voice.json), subtitles (captions.json + SRT)

Metrics: speech length without the leading/trailing silence, syllables per second
(from the script text), pitch spread in semitones (a rough measure of how
expressive the read is) and the longest inner pause.
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent
TAKES = ROOT / 'voice-pasos' / 'takes'
OUT = ROOT / 'voice-pasos'
SR = 48000

LINES = {
    'l1': 'No hace falta cambiarlo todo de un día para otro. Basta con dar el siguiente paso.',
    'l2': 'RUMBO te ayuda a registrar lo que haces y a ver cómo avanza tu proceso, a tu manera.',
    'l3': 'Anota tu evolución y consulta tus datos de peso, IMC y calorías en un mismo lugar. Cada registro cuenta una parte de tu historia.',
    'l4': 'Guarda tus entrenamientos, tus rutinas y tus marcas. Así puedes volver a ellos y reconocer todo el trabajo que ya has hecho.',
    'l5': 'Registra también tus hábitos diarios, como el agua y los pasos. Celebra los pequeños avances y construye constancia sin exigirte perfección.',
    'l6': 'Y adapta la experiencia a ti: cambia los colores y elige el tema que prefieras.',
    'l7': 'Y tu privacidad importa: lo que registras se guarda en tu propio dispositivo.',
    'l8': 'Entrena, registra tu progreso y celebra cada paso.',
    'l9': 'RUMBO. Cada pequeño paso cuenta. Empieza hoy.',
}


def syllables(text: str) -> int:
    """Rough Spanish syllable count: vowel groups (IMC is read as three letters)."""
    t = text.lower().replace('imc', 'i e me ce')
    vowels = set('aeiouáéíóúü')
    count, prev = 0, False
    for ch in t:
        v = ch in vowels
        if v and not prev:
            count += 1
        prev = v
    return count


def load(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def envelope(x: np.ndarray, win: float = 0.02) -> np.ndarray:
    n = int(SR * win)
    frames = len(x) // n
    return np.sqrt(np.mean(x[: frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)


def trim(x: np.ndarray, pad: float = 0.06) -> tuple[np.ndarray, list[tuple[float, float]]]:
    """Cuts leading/trailing silence; returns the speech and its inner pauses (s)."""
    env = envelope(x)
    db = 20 * np.log10(env)
    thr = max(db.max() - 38, -60)
    voiced = db > thr
    idx = np.flatnonzero(voiced)
    a, b = idx[0], idx[-1] + 1
    pauses, start = [], None
    for i in range(a, b):
        if not voiced[i] and start is None:
            start = i
        elif voiced[i] and start is not None:
            if (i - start) * 0.02 >= 0.18:
                pauses.append(((start - a) * 0.02, (i - a) * 0.02))
            start = None
    s = max(0, int((a * 0.02 - pad) * SR))
    e = min(len(x), int((b * 0.02 + pad) * SR))
    y = x[s:e].copy()
    fade = int(0.012 * SR)
    y[:fade] *= np.linspace(0, 1, fade)
    y[-fade:] *= np.linspace(1, 0, fade)
    return y, pauses


def pitch_spread(x: np.ndarray) -> float:
    """Std of F0 in semitones over voiced frames (autocorrelation tracker, 75–400 Hz)."""
    hop, win = int(0.01 * SR), int(0.04 * SR)
    f0 = []
    for i in range(0, len(x) - win, hop):
        fr = x[i : i + win] * np.hanning(win)
        if np.sqrt(np.mean(fr**2)) < 0.02:
            continue
        ac = np.correlate(fr, fr, 'full')[win - 1 :]
        lo, hi = SR // 400, SR // 75
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.45 * ac[0]:
            f0.append(SR / k)
    if len(f0) < 10:
        return 0.0
    st = 12 * np.log2(np.array(f0) / np.median(f0))
    st = st[np.abs(st) < 12]
    return float(np.std(st))


def analyse() -> None:
    rows, chunks, offsets, t = [], [], [], 0.0
    gap = np.zeros(int(1.2 * SR), dtype=np.float32)
    for path in sorted(TAKES.glob('l*.mp3')):
        line = path.stem.split('-')[0]
        y, pauses = trim(load(path))
        dur = len(y) / SR
        speech = dur - sum(b - a for a, b in pauses)
        rows.append({
            'take': path.stem,
            'dur': round(dur, 2),
            'syl_s': round(syllables(LINES[line]) / speech, 2),
            'pitch_st': round(pitch_spread(y), 2),
            'max_pause': round(max([b - a for a, b in pauses], default=0), 2),
            'pauses': len(pauses),
        })
        offsets.append({'take': path.stem, 'start': round(t, 3), 'end': round(t + dur, 3)})
        chunks += [y, gap]
        t += dur + len(gap) / SR
    sf.write(OUT / 'takes-all.wav', np.concatenate(chunks), SR, subtype='PCM_16')
    (OUT / 'takes-all.json').write_text(json.dumps(offsets, indent=1))
    for r in rows:
        print(f"{r['take']:28} {r['dur']:6.2f}s  {r['syl_s']:5.2f} syl/s  pitch ±{r['pitch_st']:4.2f} st  pauses {r['pauses']} (max {r['max_pause']:.2f}s)")


def pick(choices: dict[str, str]) -> None:
    for line, take in choices.items():
        y, _ = trim(load(TAKES / f'{line}-{take}.mp3'))
        sf.write(OUT / f'{line}.wav', y, SR, subtype='PCM_24')
        print(line, take, f'{len(y) / SR:.2f}s')
    (OUT / 'takes.json').write_text(json.dumps(choices, indent=1))


# Subtitle cues, split by hand into short phrases. «*» marks the key terms the
# video highlights. Each cue must match the next words of its line exactly.
CUES = {
    'l1': ['No hace falta cambiarlo todo', 'de un día para otro.', 'Basta con dar el *siguiente *paso.'],
    'l2': ['*RUMBO te ayuda a registrar lo que haces', 'y a ver cómo avanza tu proceso,', '*a *tu *manera.'],
    'l3': ['Anota tu *evolución', 'y consulta tus datos de *peso, *IMC *y *calorías', 'en un mismo lugar.', 'Cada registro cuenta', 'una parte de tu historia.'],
    'l4': ['Guarda tus entrenamientos,', 'tus *rutinas y tus *marcas.', 'Así puedes volver a ellos', 'y reconocer todo el trabajo', 'que ya has hecho.'],
    'l5': ['Registra también tus hábitos diarios,', 'como el *agua y los *pasos.', 'Celebra los pequeños avances', 'y construye *constancia', 'sin exigirte perfección.'],
    'l6': ['Y adapta la experiencia a ti:', 'cambia los *colores', 'y elige el *tema que prefieras.'],
    'l7': ['Y tu privacidad importa:', 'lo que registras se guarda', 'en *tu *propio *dispositivo.'],
    'l8': ['Entrena, registra tu progreso', 'y celebra *cada *paso.'],
    'l9': ['*RUMBO.', 'Cada pequeño paso cuenta.', 'Empieza hoy.'],
}


def norm(w: str) -> str:
    return ''.join(c for c in w.lower() if c.isalnum())


def take_words(line: str, take: str) -> list[dict]:
    """Scribe word timings of a picked take, relative to its trimmed start (s)."""
    words = json.loads((OUT / 'takes-all.words.json').read_text())['words']
    offs = json.loads((OUT / 'takes-all.json').read_text())
    o = next(x for x in offs if x['take'] == f'{line}-{take}')
    ws = [w for w in words if w['type'] == 'word' and o['start'] - 0.05 <= w['start'] <= o['end'] + 0.05]
    return [{'w': w['text'], 's': w['start'] - o['start'], 'e': w['end'] - o['start']} for w in ws]


def srt_time(frame: int, fps: int) -> str:
    ms = round(frame / fps * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


def beats(voice: list[dict]) -> dict:
    """Moments shared by picture and sound (absolute frames), most of them tied to a word."""
    lines = {v['id']: v['words'] for v in voice}

    def W(line: str, i: int) -> int:
        return lines[line][i]['f']

    return {
        'wake': 18, 'light': 66, 'trail': [96, 222], 'logo': 222, 'outline': [256, 302], 'phoneIn': [290, 318],
        'scroll1': [W('l2', 8), W('l2', 14) + 4], 'scroll2': [W('l2', 15) - 6, W('l2', 17) + 22],
        'toProgress': [604, 622], 'chartDraw': [W('l3', 4), W('l3', 9) + 6], 'imc': W('l3', 9), 'kcal': W('l3', 11),
        'zoomChart': [W('l3', 16) - 8, W('l3', 16) + 12], 'markers': [W('l3', 17), W('l3', 23) + 10],
        'toTemplates': [1052, 1068], 'cardIn': [1058, 1084], 'toSession': [1090, 1104], 'setDone': W('l4', 5) - 6,
        'records': W('l4', 7), 'history': [W('l4', 8), W('l4', 18)], 'stats': W('l4', 14), 'proud': W('l4', 21),
        'toHoy': [1502, 1520], 'icons': W('l5', 0), 'iconsWater': W('l5', 7), 'iconsSteps': W('l5', 10),
        'water': W('l5', 11) - 14, 'streak': W('l5', 11), 'calendar': W('l5', 16),
        'toStyle': [1924, 1940], 'sheetUp': W('l6', 6) - 22, 'cyan': W('l6', 8) - 2, 'sheetDown': W('l6', 9) - 2,
        'light': W('l6', 12) + 2, 'fan': [2140, 2250], 'backViolet': 2258,
        'chipsIn': [2362, 2400], 'chipsHome': [W('l7', 6), W('l7', 8) + 6], 'saved': W('l7', 8) + 8, 'phoneOut': [2658, 2696],
        'cardA': W('l8', 0), 'cardB': W('l8', 1), 'cardC': W('l8', 5), 'closeTrail': [2846, 2874], 'logoEnd': 2860,
        'tagline': W('l9', 1), 'cta': W('l9', 5),
    }


def timeline() -> None:
    src = ROOT.parent / 'src' / 'pasos'
    tl = json.loads((src / 'timeline.json').read_text())
    fps = tl['fps']
    picks = json.loads((OUT / 'takes.json').read_text())
    voice, cues = [], []
    for line, at in tl['voice'].items():
        words = take_words(line, picks[line])
        script = LINES[line].split()
        assert [norm(w['w']) for w in words] == [norm(w) for w in script], (line, [w['w'] for w in words])
        dur = round(len(sf.read(OUT / f'{line}.wav')[0]) / SR * fps)
        frames = [{'w': script[i], 'f': at + round(w['s'] * fps), 'e': at + round(w['e'] * fps)} for i, w in enumerate(words)]
        voice.append({'id': line, 'at': at, 'dur': dur, 'text': LINES[line], 'words': frames})
        i = 0
        for cue in CUES[line]:
            toks = cue.split()
            n = len(toks)
            assert [norm(t) for t in toks] == [norm(w) for w in script[i : i + n]], (line, cue)
            key = [k for k, t in enumerate(toks) if t.startswith('*')]
            text = ' '.join(t.lstrip('*') for t in toks)
            cues.append({'line': line, 'text': text, 'key': key, 'start': frames[i]['f'] - 3, 'end': frames[i + n - 1]['e'], 'words': [frames[i + k]['f'] for k in range(n)]})
            i += n
        assert i == len(script), line
    # Each cue stays until the next one starts (short gaps closed), or 0.6 s after its last word.
    for a, b in zip(cues, cues[1:]):
        a['end'] = b['start'] if b['start'] - a['end'] < 24 else a['end'] + 18
    cues[-1]['end'] += 18
    (src / 'voice.json').write_text(json.dumps(voice, ensure_ascii=False, indent=1))
    (src / 'beats.json').write_text(json.dumps(beats(voice), indent=1))
    (src / 'captions.json').write_text(json.dumps(cues, ensure_ascii=False, indent=1))
    srt = []
    for n, c in enumerate(cues, 1):
        srt.append(f"{n}\n{srt_time(c['start'], fps)} --> {srt_time(c['end'], fps)}\n{c['text']}\n")
    out = ROOT.parent / 'out' / 'pasos'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'RUMBO-cada-paso-cuenta.es.srt').write_text('\n'.join(srt), encoding='utf-8')
    print(f'{len(voice)} lines, {len(cues)} cues; last word at {voice[-1]["words"][-1]["e"] / fps:.2f}s of {tl["frames"] / fps:.2f}s')


if __name__ == '__main__':
    if sys.argv[1:2] == ['analyse']:
        analyse()
    elif sys.argv[1:2] == ['timeline']:
        timeline()
    elif sys.argv[1:2] == ['pick']:
        pick(dict(a.split('=', 1) for a in sys.argv[2:]))
    else:
        print(__doc__)

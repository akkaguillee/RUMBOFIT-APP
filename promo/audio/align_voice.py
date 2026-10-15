"""
Places ElevenLabs takes (exported from the ElevenLabs flow as MP3) as the voice
of the promo and re-times the on-screen words to them.

  python3 audio/align_voice.py v1=path/to/v1.mp3 v2=... ...

For every line it writes audio/voice/<id>.wav (48 kHz mono, used by
build_audio.py) and rewrites the word frames in src/voice.json. Word starts
come from the take itself: voiced segments (10 ms RMS) give the pauses, which
are matched to the punctuation of the line; inside each phrase the words are
spread by syllable count. Accurate to a few frames, enough for kinetic type.
"""

import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VOICE_JSON = os.path.join(ROOT, 'src', 'voice.json')
OUT = os.path.join(HERE, 'voice')
SR = 48000
FPS = 30


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
    # Pauses long enough to be punctuation.
    gaps = [(segs[i][1], segs[i + 1][0]) for i in range(len(segs) - 1) if segs[i + 1][0] - segs[i][1] >= 0.12]
    spans, pos = [], segs[0][0]
    for k in range(len(phrases) - 1):
        rest = sum(weight(p) for p in phrases[k:])
        expected = pos + weight(phrases[k]) / rest * (end - pos)
        match = next((g for g in gaps if g[0] > pos and expected - 0.6 <= (g[0] + g[1]) / 2 <= expected + 1.0), None)
        if match:
            spans.append((pos, match[0]))
            pos = match[1]
        else:  # no audible pause: split where the syllables say
            spans.append((pos, expected))
            pos = expected
    spans.append((pos, end))
    starts = []
    for p, (a, b) in zip(phrases, spans):
        acc, total = 0.0, weight(p)
        for w in p:
            starts.append(a + acc / total * (b - a))
            acc += syllables(w) + 0.3
    return starts


takes = dict(arg.split('=', 1) for arg in sys.argv[1:])
lines = json.load(open(VOICE_JSON))
before = [w['f'] for line in lines for w in line['words']]
os.makedirs(OUT, exist_ok=True)
for line in lines:
    src = takes.get(line['id'])
    if not src:
        continue
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(pcm, dtype=np.float32).astype(np.float64)
    sf.write(os.path.join(OUT, f"{line['id']}.wav"), x, SR, subtype='PCM_16')
    # build_audio.py starts the line 400 samples before the first sample above 1 % of the peak.
    e = np.abs(x)
    t0 = max(0, np.where(e > 0.01 * e.max())[0][0] - 400) / SR
    spoken = line.get('speak', line['text'])
    segs = segments(x)
    starts = word_starts(spoken, segs)
    at = line.get('speakAt', line['at'])
    shown = line['words']
    offset = len(shown) - len(starts)  # a shown word that is not spoken comes first
    for k, w in enumerate(shown):
        j = k - offset
        if 0 <= j < len(starts):
            w['f'] = int(round(at + (starts[j] - t0) * FPS))
    line['dur'] = round(segs[-1][1] - t0, 2)
    line['voice'] = 'elevenlabs'
    print(line['id'], 'segs', [(round(a, 2), round(b, 2)) for a, b in segs], '\n   ', ' '.join(f"{w['w']}@{w['f']}" for w in shown))
json.dump(lines, open(VOICE_JSON, 'w'), ensure_ascii=False, indent=1)
print('voice.json updated')

# Sound effects placed on a word (within 3 frames) move with it.
TIMELINE = os.path.join(ROOT, 'src', 'timeline.json')
after = [w['f'] for line in lines for w in line['words']]
pairs = list(zip(before, after))
tl = json.load(open(TIMELINE))
for key in ('sfx', 'sfx_lead'):
    for cue in tl.get(key, []):
        old, new = min(pairs, key=lambda q: abs(q[0] - cue['at']))
        if abs(old - cue['at']) <= 3 and new != old:
            cue['at'] += new - old
with open(TIMELINE, 'w') as f:
    json.dump(tl, f, ensure_ascii=False, indent=2)
    f.write('\n')
print('timeline.json effects re-synced')

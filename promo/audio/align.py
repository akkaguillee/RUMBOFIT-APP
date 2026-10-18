"""Local forced alignment: word timings of a known script in a recorded take.

The script is synthesised with eSpeak NG (Spanish), which reports where each
word starts in its own audio; dynamic time warping over MFCCs then maps those
positions onto the take. It is the approach of aeneas, and it needs no
speech-recognition model: only the `espeakng-loader` wheel (library and data).

    from align import align
    words = align(samples_48k, 'Cada pequeño paso cuenta.')   # [{'w', 's', 'e'}] in seconds
"""

import ctypes
import re

import numpy as np
from scipy import signal
from scipy.fft import dct

SR = 16000
HOP = 160  # 10 ms
WIN = 400  # 25 ms
# Mean offset against Scribe word starts on the earlier narration (the warp lands a little early).
LAG = 0.055

# Words eSpeak would read differently from the narrator (it spells acronyms in capitals).
SAY = {'imc': 'i eme ce', 'rumbo': 'rumbo'}


class _Event(ctypes.Structure):
    _fields_ = [
        ('type', ctypes.c_int),
        ('unique_identifier', ctypes.c_uint),
        ('text_position', ctypes.c_int),
        ('length', ctypes.c_int),
        ('audio_position', ctypes.c_int),
        ('sample', ctypes.c_int),
        ('user_data', ctypes.c_void_p),
        ('id', ctypes.c_char * 8),
    ]


_CALLBACK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.POINTER(_Event))
_lib = None
_rate = 0
_buf: list[np.ndarray] = []
_events: list[tuple[int, int]] = []


def _on_audio(wav, n, events):
    if n > 0:
        _buf.append(np.ctypeslib.as_array(wav, shape=(n,)).astype(np.float32) / 32768)
    i = 0
    while events[i].type != 0:
        if events[i].type == 1:  # word
            _events.append((events[i].text_position, events[i].audio_position))
        i += 1
    return 0


_keep = _CALLBACK(_on_audio)


def _espeak():
    global _lib, _rate
    if _lib is None:
        import espeakng_loader
        from pathlib import Path

        _lib = ctypes.CDLL(espeakng_loader.get_library_path())
        root = str(Path(espeakng_loader.get_data_path()).parent).encode()
        _rate = _lib.espeak_Initialize(2, 0, root, 0)  # synchronous, callback
        _lib.espeak_SetSynthCallback(_keep)
        _lib.espeak_SetVoiceByName(b'es')
        _lib.espeak_SetParameter(1, 210, 0)  # words per minute, close to the narration
    return _lib


def synth(text: str) -> tuple[np.ndarray, list[int]]:
    """Speech for `text` (16 kHz) and the sample where each of its words starts."""
    words = text.split()
    spoken, owner = [], []
    for i, w in enumerate(words):
        key = re.sub(r'[^\wáéíóúüñ]', '', w.lower())
        tail = re.sub(r'^.*?([.,:;!?¡¿]*)$', r'\1', w)
        parts = SAY.get(key, key).split()
        parts[-1] += tail
        for part in parts:
            spoken.append(part)
            owner.append(i)
    line = ' '.join(spoken).encode()
    starts = [0]
    for p in spoken[:-1]:
        starts.append(starts[-1] + len(p.encode()) + 1)
    lib = _espeak()
    _buf.clear()
    _events.clear()
    lib.espeak_Synth(line, len(line) + 1, 0, 0, 0, 1, None, None)
    lib.espeak_Synchronize()
    audio = np.concatenate(_buf) if _buf else np.zeros(1, np.float32)
    # Word events carry the character position (1-based) of the word they start.
    by_char = {}
    for pos, sample in _events:
        by_char.setdefault(pos - 1, sample)
    first = [None] * len(words)
    for k, c in enumerate(starts):
        s = by_char.get(c)
        if s is None:
            near = [v for p, v in by_char.items() if abs(p - c) <= 2]
            s = near[0] if near else None
        if s is not None and first[owner[k]] is None:
            first[owner[k]] = s
    for i in range(len(first)):
        if first[i] is None:
            first[i] = first[i - 1] if i else 0
    return signal.resample_poly(audio, SR, _rate).astype(np.float32), [int(ms * SR / 1000) for ms in first]


def _mel_bank(n_fft=512, n_mels=26):
    mel = lambda f: 2595 * np.log10(1 + f / 700)
    inv = lambda m: 700 * (10 ** (m / 2595) - 1)
    pts = inv(np.linspace(mel(80), mel(7600), n_mels + 2))
    bins = np.floor((n_fft + 1) * pts / SR).astype(int)
    fb = np.zeros((n_mels, n_fft // 2 + 1))
    for m in range(1, n_mels + 1):
        a, b, c = bins[m - 1], bins[m], bins[m + 1]
        fb[m - 1, a:b] = (np.arange(a, b) - a) / max(1, b - a)
        fb[m - 1, b:c] = (c - np.arange(b, c)) / max(1, c - b)
    return fb


_FB = _mel_bank()


def mfcc(x: np.ndarray) -> np.ndarray:
    x = np.append(x[0], x[1:] - 0.97 * x[:-1])
    n = 1 + max(0, (len(x) - WIN) // HOP)
    idx = np.arange(WIN)[None, :] + HOP * np.arange(n)[:, None]
    frames = x[idx] * np.hamming(WIN)
    power = np.abs(np.fft.rfft(frames, 512)) ** 2 / 512
    cep = dct(np.log(power @ _FB.T + 1e-10), type=2, axis=1, norm='ortho')[:, 1:13]
    energy = np.log(frames.var(1) + 1e-9)[:, None]
    feats = np.hstack([cep, 2.0 * energy])
    feats = np.hstack([feats, np.gradient(feats, axis=0)])
    feats -= feats.mean(0)
    return feats / (feats.std(0) + 1e-6)


def dtw(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Warping path (pairs of frame indices) between two feature sequences."""
    cost = np.sqrt(((a[:, None, :] - b[None, :, :]) ** 2).sum(-1))
    n, m = cost.shape
    # Sakoe-Chiba band around the diagonal: the two readings run at similar overall pace.
    ii, jj = np.meshgrid(np.arange(n) / n, np.arange(m) / m, indexing='ij')
    cost[np.abs(ii - jj) > 0.18] = 1e6
    acc = np.full((n + 1, m + 1), np.inf)
    acc[0, 0] = 0
    for i in range(1, n + 1):
        row, prev = acc[i], acc[i - 1]
        diag = np.minimum(prev[:-1], prev[1:])  # (i-1, j-1) and (i-1, j)
        row[1:] = cost[i - 1] + diag
        for j in range(1, m + 1):  # (i, j-1)
            v = cost[i - 1, j - 1] + row[j - 1]
            if v < row[j]:
                row[j] = v
    i, j, path = n, m, []
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        k = np.argmin([acc[i - 1, j - 1], acc[i - 1, j], acc[i, j - 1]])
        i, j = (i - 1, j - 1) if k == 0 else (i - 1, j) if k == 1 else (i, j - 1)
    return np.array(path[::-1])


def _levels(x: np.ndarray) -> np.ndarray:
    n = len(x) // HOP
    return 10 * np.log10(np.array([np.mean(x[i * HOP:(i + 1) * HOP] ** 2) for i in range(n)]) + 1e-12)


def _warp(real: np.ndarray, words: list[str], voiced: np.ndarray) -> list[int]:
    """Start frame of each word in `real` (16 kHz), by warping eSpeak's reading onto it."""
    ref, starts = synth(' '.join(words))
    # eSpeak marks a word after a pause at the start of the pause: move it to the voice.
    ref_level = _levels(ref)
    ref_voiced = ref_level > ref_level.max() - 35
    for k, s in enumerate(starts):
        f = s // HOP
        limit = starts[k + 1] // HOP if k + 1 < len(starts) else len(ref_voiced)
        while f < min(limit, len(ref_voiced)) - 1 and not ref_voiced[f]:
            f += 1
        starts[k] = f * HOP
    path = dtw(mfcc(ref), mfcc(real))
    to_real = {}
    for r, t in path:
        to_real.setdefault(r, t)
    last = max(to_real)
    frames = [to_real[min(last, s // HOP)] for s in starts]
    frames = list(np.maximum.accumulate(frames))
    n = len(voiced)
    for k in range(len(frames)):  # a word starts where the voice is
        nxt = frames[k + 1] if k + 1 < len(frames) else n
        f = frames[k]
        while f < min(nxt, n) - 1 and not voiced[f]:
            f += 1
        frames[k] = f
    return frames


def align(take_48k: np.ndarray, text: str) -> list[dict]:
    """Word start/end (s) of `text` in a trimmed take at 48 kHz.

    Two passes: a warp of the whole line, then every real pause (>= 150 ms) is
    pinned to the word boundary nearest to it and the stretches between pauses
    are warped again on their own, so a pause the synthetic reading lacks
    cannot drag the words around it.
    """
    real = signal.resample_poly(take_48k.astype(np.float32), 1, 3)
    level = _levels(real)
    voiced = level > level.max() - 32
    n = len(voiced)
    words = text.split()
    frames = _warp(real, words, voiced)
    pauses, start = [], None
    for i, v in enumerate(voiced):
        if not v and start is None:
            start = i
        elif v and start is not None:
            if i - start >= 15 and start > 3:
                pauses.append((start, i))
            start = None
    anchors = {}
    def gap(k, a, b):  # frames between the predicted boundary and the pause; punctuation invites a pause
        return max(a - frames[k], frames[k] - b, 0) - (40 if re.search(r'[.,:;!?]$', words[k - 1]) else 0)

    # Pauses keep their order: pick increasing boundaries for them (or none) at the least total gap.
    skip = 60
    best = {(-1, 0): (0, [])}  # (last pause index, last boundary) -> (cost, pairs)
    for i, (a, b) in enumerate(pauses):
        nxt = {}
        for (_, kb), (c, pairs) in best.items():
            options = [(c + skip, pairs, kb)]
            options += [(c + gap(k, a, b), pairs + [(k, i)], k) for k in range(kb + 1, len(words))]
            for cost, prs, k in options:
                if (i, k) not in nxt or cost < nxt[(i, k)][0]:
                    nxt[(i, k)] = (cost, prs)
        best = nxt
    if pauses:
        for k, i in min(best.values(), key=lambda v: v[0])[1]:
            anchors[k] = pauses[i]
    cuts = sorted(anchors)
    bounds = [0] + cuts + [len(words)]
    for i0, i1 in zip(bounds, bounds[1:]):
        f0 = anchors[i0][1] if i0 in anchors else 0
        f1 = anchors[i1][0] if i1 in anchors else n
        if i1 - i0 == 1:
            sub = [0]
        else:
            sub = _warp(real[f0 * HOP:f1 * HOP], words[i0:i1], voiced[f0:f1])
        frames[i0:i1] = [f0 + f for f in sub]
    out = []
    for k, w in enumerate(words):
        e = frames[k + 1] if k + 1 < len(words) else n
        while e - 1 > frames[k] + 3 and not voiced[e - 1]:
            e -= 1
        out.append({'w': w, 's': round(frames[k] * HOP / SR + LAG, 3), 'e': round(e * HOP / SR + LAG, 3)})
    return out

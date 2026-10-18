"""Narration for the reel, synthesised locally (Kokoro-82M, Apache-2.0, voice
ef_dora, Spanish, run with sherpa-onnx) at an energetic pace.

The brief asked for ElevenLabs, whose account refused the generation (free
tier disabled); this local voice stands in. ElevenLabs takes saved as
audio/voice-reel/elevenlabs/r1…r8 take precedence in build_reel.py.
"""
import json
import os

import numpy as np
import soundfile as sf
from scipy import signal

import sherpa_onnx

HERE = os.path.dirname(os.path.abspath(__file__))
KDIR = os.path.join(HERE, '.cache', 'kokoro-multi-lang-v1_0')
OUT = os.path.join(HERE, 'voice-reel', 'local')
LINES = json.load(open(os.path.join(HERE, '..', 'src', 'reel', 'script.json'), encoding='utf-8'))['lines']

tts = sherpa_onnx.OfflineTts(
    sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=os.path.join(KDIR, 'model.onnx'),
                voices=os.path.join(KDIR, 'voices.bin'),
                tokens=os.path.join(KDIR, 'tokens.txt'),
                data_dir=os.path.join(KDIR, 'espeak-ng-data'),
                dict_dir=os.path.join(KDIR, 'dict'),
                lexicon=os.path.join(KDIR, 'lexicon-us-en.txt'),
                lang='es',
            ),
            num_threads=4,
        ),
    )
)
SPEAKER = int(os.environ.get('SPEAKER', '28'))  # ef_dora

os.makedirs(OUT, exist_ok=True)
for line in LINES:
    a = tts.generate(line.get('speak', line['text']), sid=SPEAKER, speed=float(os.environ.get('SPEED', '1.16')))
    x = signal.resample_poly(np.asarray(a.samples, dtype=np.float64), 2, 1)  # 24 kHz → 48 kHz
    e = np.abs(x)
    idx = np.where(e > 0.01 * e.max())[0]
    x = x[max(0, idx[0] - 400): idx[-1] + 2400]
    sf.write(os.path.join(OUT, f"{line['id']}.wav"), x.astype(np.float32), 48000)
    print(line['id'], round(len(x) / 48000, 2), 's')

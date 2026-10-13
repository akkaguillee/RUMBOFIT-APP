"""
Voice-over with ElevenLabs (eleven_multilingual_v2), Spanish from Spain.

The API key is read from the ELEVENLABS_API_KEY environment variable and is
never written to disk or to the repository. For every line in src/voice.json
it requests speech *with timestamps*, saves the audio to audio/voice/<id>.wav
and rewrites the word timings in src/voice.json from the real character
alignment, so the kinetic type stays in sync with the new delivery.

Usage:
  ELEVENLABS_API_KEY=… python3 audio/elevenlabs_voice.py            # pick a Castilian voice automatically
  ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=<id> python3 audio/elevenlabs_voice.py
"""

import base64
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VOICE_JSON = os.path.join(ROOT, 'src', 'voice.json')
OUT = os.path.join(HERE, 'voice')
API = 'https://api.elevenlabs.io'
KEY = os.environ.get('ELEVENLABS_API_KEY')
FPS = 30
MODEL = 'eleven_multilingual_v2'
SETTINGS = {'stability': 0.42, 'similarity_boost': 0.82, 'style': 0.38, 'use_speaker_boost': True, 'speed': 1.0}

if not KEY:
    sys.exit('Set ELEVENLABS_API_KEY in the environment.')


def call(method, path, body=None):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'xi-api-key': KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def pick_voice():
    """A male Castilian narrator from the voice library, added to the account if needed."""
    if os.environ.get('ELEVENLABS_VOICE_ID'):
        return os.environ['ELEVENLABS_VOICE_ID']
    mine = call('GET', '/v1/voices')['voices']
    for v in mine:
        labels = {k: str(x).lower() for k, x in (v.get('labels') or {}).items()}
        if 'spain' in labels.get('accent', '') or 'peninsular' in labels.get('accent', '') or 'castilian' in labels.get('accent', ''):
            return v['voice_id']
    for query in ('accent=peninsular', 'accent=castilian', 'accent=spain'):
        q = f'/v1/shared-voices?page_size=20&language=es&gender=male&{query}&sort=usage_character_count_7d'
        found = call('GET', q).get('voices', [])
        for v in found:
            if v.get('use_case') in ('narrative_story', 'advertisement', 'informative_educational', 'conversational', None):
                call('POST', f"/v1/voices/add/{v['public_owner_id']}/{v['voice_id']}", {'new_name': f"RUMBO · {v['name']}"})
                return v['voice_id']
    # Fallback: a premade multilingual voice (speaks Spanish with eleven_multilingual_v2).
    return mine[0]['voice_id']


def words_from_alignment(text, al):
    """Start time (s) of every space-separated word from the character alignment."""
    chars, starts = al['characters'], al['character_start_times_seconds']
    words, i = [], 0
    for w in text.split(' '):
        while i < len(chars) and chars[i] == ' ':
            i += 1
        words.append(starts[min(i, len(starts) - 1)])
        i += len(w)
    return words


os.makedirs(OUT, exist_ok=True)
voice_id = pick_voice()
print('voice', voice_id)
lines = json.load(open(VOICE_JSON))
for line in lines:
    spoken = line.get('speak', line['text'])
    res = call(
        'POST',
        f'/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_192',
        {'text': spoken, 'model_id': MODEL, 'language_code': 'es', 'voice_settings': SETTINGS},
    )
    mp3 = os.path.join(OUT, f"{line['id']}.mp3")
    with open(mp3, 'wb') as f:
        f.write(base64.b64decode(res['audio_base64']))
    wav = os.path.join(OUT, f"{line['id']}.wav")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-ar', '48000', '-ac', '1', wav], check=True)
    al = res.get('normalized_alignment') or res['alignment']
    starts = words_from_alignment(spoken, al)
    start_at = line.get('speakAt', line['at'])
    # Map the spoken words back onto the on-screen words (same words, maybe extra punctuation).
    shown = [w['w'] for w in line['words']]
    spoken_words = spoken.split(' ')
    offset = len(shown) - len(spoken_words)  # e.g. a silent "Rumbo." cue that isn't spoken
    for k, w in enumerate(line['words']):
        j = k - offset
        if 0 <= j < len(starts):
            w['f'] = int(round(start_at + starts[j] * FPS))
    line['dur'] = round(al['character_end_times_seconds'][-1], 2)
    line['voice'] = 'elevenlabs'
    print(line['id'], 'at', start_at, 'dur', line['dur'], ' '.join(f"{w['w']}@{w['f']}" for w in line['words']))
json.dump(lines, open(VOICE_JSON, 'w'), ensure_ascii=False, indent=1)
print('voice.json updated')

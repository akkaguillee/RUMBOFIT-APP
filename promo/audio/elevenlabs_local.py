"""
Genera la locución del anuncio de RUMBO con ElevenLabs EN TU ORDENADOR.

1. Crea un archivo .env junto a este script con:
     ELEVENLABS_API_KEY=tu_clave
     # opcional: ELEVENLABS_VOICE_ID=id_de_una_voz_concreta
2. pip install python-dotenv
3. python elevenlabs_local.py
4. Sube aquí la carpeta «rumbo_voz» comprimida (o los 16 archivos que contiene).

Crea, para cada frase, el audio (MP3) y sus tiempos por letra (JSON), que se
usan para sincronizar la tipografía del vídeo. La clave solo se lee del .env.
"""

import base64
import json
import os
import sys
import urllib.request

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

KEY = os.environ.get('ELEVENLABS_API_KEY')
if not KEY:
    sys.exit('Falta ELEVENLABS_API_KEY en el archivo .env')

API = 'https://api.elevenlabs.io'
MODEL = 'eleven_multilingual_v2'
SETTINGS = {'stability': 0.42, 'similarity_boost': 0.82, 'style': 0.38, 'use_speaker_boost': True, 'speed': 1.0}
LINES = [
    ('v1', 'Empezar es fácil. Lo difícil es mantenerlo.'),
    ('v2', 'Por eso existe rumbo.'),
    ('v3', 'Tu peso, tu tendencia y tu objetivo, claros de un vistazo.'),
    ('v4', 'Agua y pasos, día a día, sin complicaciones.'),
    ('v5', 'Registra cada serie y supera tus marcas.'),
    ('v6', 'Cada día suma. Enciende tu racha y desbloquea hitos.'),
    ('v7', 'Y Rumbi, tu compañero, te da un consejo pensado para ti cada día.'),
    ('v8', 'Ahora es el momento de encontrar el tuyo.'),
]


def call(method, path, body=None):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'xi-api-key': KEY, 'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def pick_voice():
    """Voz masculina con acento de España: de tu cuenta o de la biblioteca de ElevenLabs."""
    if os.environ.get('ELEVENLABS_VOICE_ID'):
        return os.environ['ELEVENLABS_VOICE_ID'], 'ELEVENLABS_VOICE_ID'
    for v in call('GET', '/v1/voices')['voices']:
        accent = str((v.get('labels') or {}).get('accent', '')).lower()
        if any(a in accent for a in ('spain', 'peninsular', 'castilian', 'españa')):
            return v['voice_id'], v['name']
    for query in ('accent=peninsular', 'accent=castilian', 'accent=spain'):
        for v in call('GET', f'/v1/shared-voices?page_size=20&language=es&gender=male&{query}').get('voices', []):
            call('POST', f"/v1/voices/add/{v['public_owner_id']}/{v['voice_id']}", {'new_name': f"RUMBO · {v['name']}"})
            return v['voice_id'], v['name']
    v = call('GET', '/v1/voices')['voices'][0]
    return v['voice_id'], v['name']


voice_id, name = pick_voice()
print('Voz:', name, voice_id)
os.makedirs('rumbo_voz', exist_ok=True)
for key, text in LINES:
    res = call(
        'POST',
        f'/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_192',
        {'text': text, 'model_id': MODEL, 'language_code': 'es', 'voice_settings': SETTINGS},
    )
    with open(os.path.join('rumbo_voz', f'{key}.mp3'), 'wb') as f:
        f.write(base64.b64decode(res['audio_base64']))
    with open(os.path.join('rumbo_voz', f'{key}.json'), 'w', encoding='utf-8') as f:
        json.dump({'text': text, 'voice': name, 'alignment': res.get('normalized_alignment') or res['alignment']}, f, ensure_ascii=False)
    print('OK', key, text)
print('Listo: sube la carpeta rumbo_voz')

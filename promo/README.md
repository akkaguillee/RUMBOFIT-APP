# RUMBO · vídeos promocionales (9:16)

Dos piezas: el anuncio cinematográfico de 84 s (más abajo) y el anuncio de 40 s para Reels, TikTok y Shorts.

## Anuncio de 40 s

Resultado: `out/RUMBO-promo-9x16.mp4` (H.264 1080 × 1920, 30 fps, AAC 48 kHz, −14 LUFS).

- `src/` — escenas en Remotion + React. Rumbi es la mascota oficial: usa el mismo motor de animación de la app (`src/features/mascot/rig.ts`), simulado fotograma a fotograma. Logotipo, llama de racha e interfaz salen del código y de capturas reales de la app (`public/ui`). El cierre muestra la app real en un teléfono (`Phone` en `src/ui.tsx`, captura `dash-top`).
- `src/timeline.json` — tiempos compartidos por imagen y sonido (escenas, cortes, efectos). `src/voice.json` — frases de la locución y el fotograma en que aparece cada palabra.
- **Locución:** ElevenLabs (modelo `eleven_v4`, voz «Bobby Your Commercial Voice», español de España), generada desde el conector de ElevenLabs y guardada en `audio/voice/v1…v8.wav`. `audio/align_voice.py` coloca cada toma y vuelve a calcular los tiempos de las palabras a partir del propio audio (pausas + sílabas), y desplaza los efectos que acompañan a una palabra. Si falta una toma, `build_audio.py` usa la voz local (Kokoro, sherpa-onnx).
- `audio/build_audio.py` — música original y efectos sintetizados (numpy/scipy) y mezcla de la voz.
- `audio/mux.sh` — mezcla final con FFmpeg (música atenuada bajo la voz, normalización en dos pasadas) y codificación.
- `audio/elevenlabs_voice.py` / `audio/elevenlabs_local.py` — alternativas para generar la voz con la API de ElevenLabs (clave en `ELEVENLABS_API_KEY` o `.env`, nunca en el repositorio).

```bash
npm install
pip install sherpa-onnx soundfile scipy numpy
# opcional, tomas nuevas: python3 audio/align_voice.py v1=toma1.mp3 v2=toma2.mp3 …
npm run build   # audio → render (Remotion) → mezcla y codificación (FFmpeg)
```

## Anuncio cinematográfico (84 s)

Resultado: `out/RUMBO-cinematico-9x16.mp4` (H.264 1080 × 1920, 30 fps, AAC 48 kHz, −14 LUFS). Composición `RumboCinematic` en Remotion.

- `src/cine/timing.ts` — escenas: gancho 0–9 s, presentación 9–18 s, evolución 18–31,5 s, todo tu esfuerzo cuenta 31,5–42 s, a tu estilo 42–50 s, privacidad 50–60 s, cierre 60–84 s (pantalla final desde 72,4 s).
- `src/cine/voice.json` — las 13 frases de la locución con el fotograma de cada palabra; imagen y sonido se sincronizan con estos tiempos.
- `src/cine/scenes/*.tsx` — una escena por bloque del guion; `src/cine/kit.tsx` — paleta negro/blanco/rojo, teléfono 3D, recortes de pantallas reales, titulares en Krophed.
- `public/app/*.png` — capturas reales de la app (390 × 797 pt a 3×) con datos de ejemplo cargados en la base de datos local del navegador; la pieza lo indica en pantalla. El tema claro y los acentos de «A tu estilo» son los de la app.
- **Locución:** ElevenLabs (modelo `eleven_v4`, voz «Bruno», español de España), generada con el conector de ElevenLabs y guardada en `audio/voice-cine/c1…c13.wav`. Para sustituir tomas: `python3 audio/align_voice.py --voice src/cine/voice.json --out audio/voice-cine --no-sfx c1=toma.mp3 …` (recalcula los tiempos de las palabras).
- `audio/build_cinematic.py` — música original (120 BPM, la menor → do mayor) y diseño sonoro sintetizados con `audio/synth.py`, y colocación de la voz. Los efectos se anclan a las palabras y a los fotogramas de las escenas.
- La afirmación de privacidad («Tus datos se quedan en tu dispositivo…») está comprobada: la app guarda todo en IndexedDB y no hace peticiones con datos (sin `fetch`/XHR/`sendBeacon`/WebSocket en `src/`; auditoría de red de la build de producción: solo descargas de recursos del propio dominio).

```bash
npm install
pip install soundfile scipy numpy
npm run build:cine   # audio → render (Remotion, ~35 min) → mezcla y codificación (FFmpeg)
```

En un contenedor sin Chrome propio, añade al render `--browser-executable=<ruta a chrome-headless-shell> --gl=swangle`.

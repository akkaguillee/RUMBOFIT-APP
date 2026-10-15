# RUMBO · vídeo promocional (9:16)

Anuncio de 40 s para Reels, TikTok y Shorts. Resultado: `out/RUMBO-promo-9x16.mp4` (H.264 1080 × 1920, 30 fps, AAC 48 kHz, −14 LUFS).

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

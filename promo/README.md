# RUMBO · vídeo promocional (9:16)

Anuncio de ~20 s para Reels, TikTok y Shorts. Resultado: `out/RUMBO-promo-9x16.mp4` (H.264 1080 × 1920, 30 fps, AAC 48 kHz, −14 LUFS).

- `src/` — escenas en Remotion + React. Rumbi es la mascota oficial: usa el mismo motor de animación de la app (`src/features/mascot/rig.ts`), simulado fotograma a fotograma. Logotipo, llama de racha e interfaz salen del código y de capturas reales de la app (`public/ui`).
- `src/timeline.json` — tiempos compartidos por imagen y sonido (escenas, voz, efectos).
- `audio/build_audio.py` — música original y efectos sintetizados (numpy/scipy) y voz en español de España con Piper «es_ES-davefx-medium» (licencia CC0) ejecutado en local con sherpa-onnx.
- `audio/mux.sh` — mezcla final con FFmpeg (música atenuada bajo la voz, normalización en dos pasadas) y codificación.

```bash
npm install
pip install sherpa-onnx soundfile scipy numpy
npm run build   # audio → render (Remotion) → mezcla y codificación (FFmpeg)
```

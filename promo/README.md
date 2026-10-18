# RUMBO · vídeos promocionales (9:16)

Tres piezas: el reel «Cada pequeño paso cuenta» (1:46,5, 9:16 y 4:5, más abajo), el anuncio cinematográfico de 84 s y el anuncio de 40 s para Reels, TikTok y Shorts.

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
- La afirmación de privacidad («Tus datos se quedan en tu dispositivo…») se comprobó cuando se hizo esta pieza: entonces la app no hacía ninguna petición con datos. **Ya no vale tal cual**: el escáner de alimentos, añadido después, envía la foto, el nombre del alimento o el código de barras cuando se usa. Antes de volver a publicar este corte, cambia esa frase por el alcance que se comprueba hoy (ver el reel, más abajo).

```bash
npm install
pip install soundfile scipy numpy
npm run build:cine   # audio → render (Remotion, ~35 min) → mezcla y codificación (FFmpeg)
```

En un contenedor sin Chrome propio, añade al render `--browser-executable=<ruta a chrome-headless-shell> --gl=swangle`.

## Reel «Cada pequeño paso cuenta» (1:46,5)

Resultado en `out/reel/`: `RUMBO-reel-9x16.mp4` (1080 × 1920) y `RUMBO-reel-4x5.mp4` (1080 × 1350, reencuadrado), H.264 + AAC 48 kHz, 30 fps, −14 LUFS; `RUMBO-reel.srt`; `NOTAS.md` (qué se ha comprobado y qué se ha dejado fuera); `audio/` (locución y música + efectos por separado). Composiciones `RumboReel` y `RumboReel45` en Remotion.

- **Un solo reloj:** `audio/build_reel.py` coloca las tomas de voz, calcula cuándo empieza cada palabra y escribe `src/reel/cues.json` (escenas y momentos de cada pantalla, toque y título), `voice.json`, `subs.json` y el SRT. Las escenas leen esos fotogramas y los efectos de sonido se colocan sobre ellos, así que una toma nueva vuelve a sincronizarlo todo. Escenas en compases de 2,4 s (100 BPM): 0 · 9,6 · 21,6 · 36 · 50,4 · 64,8 · 79,2 · 93,6 s.
- **Pantallas reales:** `capture/*.spec.ts` (Playwright contra la app en local) crea un perfil de ejemplo claramente ficticio («Alex», objetivo «Mejorar mi constancia») con registros de ejemplo escritos con los repositorios de la propia app y captura cada pantalla a 3× (`public/reel`), los dos temas y los seis colores de interfaz. `capture/reel-anim.spec.ts` graba animaciones reales fotograma a fotograma con el reloj de la página en pausa (el contador de pasos, el agua, la serie completada); `capture/reel-chart.spec.ts` captura la gráfica sin sus trazos para dibujar la línea sobre ella como la anima la app. `capture/convert.py` pasa las capturas a JPEG 2×. Todos los datos que se ven son ficticios.
- **Rumbi** se dibuja con el motor de la app (`src/features/mascot/rig.ts`) durante toda la pieza (`src/reel/film.tsx`, `RumbiActor`), con el color de acento y el sombreado del tema claro que usa la app.
- **Imagen:** `src/reel/film.tsx` (teléfono continuo con sus pantallas, transiciones de la app, toques, encuadres y el giro del teléfono), `src/reel/scenes.tsx` (camino de luz, logotipo real, títulos en Krophed, Inter y 212 Baby Girl que entran de golpe con brillo, tarjetas, partículas, cierre), `src/reel/cinema.tsx` (cámara sobre toda la imagen: golpe de zoom en la caída, inmersión en la pantalla, barrido con desenfoque direccional, acercamientos en cada momento clave, temblor en los impactos; destellos, flares anamórficos, ondas, fugas de luz, rayos, partículas desenfocadas, bandas de cine, etalonaje y grano), `src/reel/kit.tsx` (piezas comunes, subtítulos). Textos dentro de las zonas seguras de Reels y TikTok (y 220–1436, x 90–940 en 9:16).
- **Música y efectos:** originales, sintetizados con `audio/synth.py` (libres de derechos): tráiler cinematográfico híbrido a 100 BPM en re mayor. Braam, latido y un motivo de piano emotivo al principio; caída con impacto y sub cuando aparece el teléfono; ostinato de cuerdas, toms y taiko; subida eufórica en hábitos; ruptura emotiva en privacidad (vuelve el motivo); redoble hacia la luz y la gran caída sobre el logotipo. Subidas, platos invertidos e impactos en cada transición (cues `fx.*`), y un respiro de silencio antes de cada caída.
- **Locución:** el guion exacto está en `src/reel/script.json`. La voz elegida en ElevenLabs es «Sofia - Captivating Narration» (español de España, `eleven_v4`), pero la cuenta rechazó la generación tras las dos primeras frases («Free Tier access has been disabled»). Mientras tanto, `audio/reel_guide_voice.py` genera una voz guía local (Kokoro, voz ef_dora) solo para juzgar ritmo y sincronía: el máster no la lleva. Para terminar: guarda las tomas finales como `audio/voice-reel/elevenlabs/r1.mp3 … r8.mp3` y ejecuta `npm run build:reel` (el máster pasa a llevar la voz y el corte provisional deja de generarse).

```bash
npm install
pip install soundfile scipy numpy sherpa-onnx
npm run build:reel   # audio y tiempos → render 9:16 y 4:5 (Remotion) → mezcla y codificación (FFmpeg)
```

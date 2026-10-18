# RUMBO · vídeos promocionales (9:16)

Tres piezas: el reel «Cada pequeño paso cuenta» (1:31,9, 9:16 y 4:5, más abajo), el anuncio cinematográfico de 84 s y el anuncio de 40 s para Reels, TikTok y Shorts.

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

## Reel «Cada pequeño paso cuenta» (1:31,9)

Resultado en `out/reel/`: `RUMBO-reel-9x16.mp4` (1080 × 1920) y `RUMBO-reel-4x5.mp4` (1080 × 1350, reencuadrado), H.264 + AAC 48 kHz, 30 fps, −14 LUFS, con locución, música, efectos y subtítulos; `RUMBO-reel.srt`; `LOCUCION.txt`; `NOTAS.md` (qué se ha comprobado y qué se ha dejado fuera); `audio/` (locución limpia y música + efectos por separado). Composiciones `RumboReel` y `RumboReel45` en Remotion.

- **Un solo reloj:** `audio/build_reel.py` coloca las tomas de voz, calcula cuándo empieza cada palabra y escribe `src/reel/cues.json` (escenas, momentos de cada pantalla, toque y título, palabras clave, ventanas de pulso), `voice.json`, `subs.json` y el SRT. Las escenas leen esos fotogramas y los efectos se colocan sobre ellos, así que una toma nueva vuelve a sincronizarlo todo. Todos los cortes caen en compás (128 BPM, compases de 1,875 s).
- **Pantallas reales:** `capture/*.spec.ts` (Playwright contra la app en local) crea un perfil ficticio («Alex», objetivo «Mejorar mi constancia») con registros de ejemplo escritos con los repositorios de la propia app y captura cada pantalla a 3× (`public/reel`), los dos temas y los seis colores de interfaz. `capture/reel-anim.spec.ts` graba animaciones reales fotograma a fotograma con el reloj de la página en pausa (contador de pasos, agua, serie completada); `capture/reel-chart.spec.ts` captura la gráfica sin trazos para dibujar la línea como la anima la app. `capture/convert.py` pasa las capturas a JPEG 2×. Todos los datos que se ven son ficticios.
- **Rumbi** se dibuja con el motor de la app (`src/features/mascot/rig.ts`) durante toda la pieza y bota al ritmo del bombo.
- **Imagen:** `src/reel/film.tsx` (teléfono continuo, transiciones de la app, toques, encuadres, montajes al compás, el giro del teléfono), `src/reel/scenes.tsx` (camino de luz, logotipo real, títulos, palabras clave que entran con la voz, abanico de seis teléfonos con los seis colores, pantalla partida claro/oscuro, confeti), `src/reel/cinema.tsx` (cámara que pulsa con el bombo, golpes de zoom, inmersión en la pantalla, barrido, temblor; destellos, flares, ondas, líneas de velocidad del logotipo, fugas de luz, rayos, bandas de cine, etalonaje y grano), `src/reel/kit.tsx` (piezas comunes, subtítulos). Textos dentro de las zonas seguras de Reels y TikTok (y 220–1436, x 90–940 en 9:16).
- **Música y efectos:** originales, sintetizados con `audio/synth.py` (libres de derechos): pop electrónico enérgico a 128 BPM en re mayor, intro filtrada que se abre, caída cuando aparece el teléfono, bombo a negras con bajo a contratiempo y acordes de supersaw, melodía en las caídas, respiro en privacidad, redoble hacia la luz y la gran caída sobre el logotipo.
- **Locución:** el guion exacto está en `src/reel/script.json`. La voz pedida (ElevenLabs, «Sofia - Captivating Narration») no se pudo generar: la cuenta rechazó la generación tras dos frases («Free Tier access has been disabled»). El máster lleva una voz sintética local (Kokoro-82M, voz ef_dora, licencia Apache-2.0) generada con `audio/reel_local_voice.py` y tratada como locución de radio (EQ, compresión). Para usar ElevenLabs: guarda las tomas como `audio/voice-reel/elevenlabs/r1.mp3 … r8.mp3` y ejecuta `npm run build:reel`.

```bash
npm install
pip install soundfile scipy numpy sherpa-onnx
npm run build:reel   # audio y tiempos → render 9:16 y 4:5 (Remotion) → mezcla y codificación (FFmpeg)
```

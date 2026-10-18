# RUMBO · Reel «Cada pequeño paso cuenta» — notas de entrega (versión enérgica)

## Archivos

| Archivo | Qué es |
| --- | --- |
| `RUMBO-reel-9x16.mp4` | Máster vertical 1080 × 1920, 30 fps, H.264 + AAC 48 kHz, −14 LUFS, 1:31,9. Versión enérgica: locución, música a 128 BPM, cortes al compás, palabras clave, efectos y subtítulos incrustados. |
| `RUMBO-reel-4x5.mp4` | Adaptación 1080 × 1350 reencuadrada (mismas escenas, maquetación propia). |
| `RUMBO-reel.srt` | Subtítulos en español, sincronizados con la locución. |
| `LOCUCION.txt` | Texto final de la locución con la entrada de cada frase. |
| `audio/locucion-local.wav` | La locución limpia, colocada en su tiempo (mono, 48 kHz). |
| `audio/musica-y-efectos.wav` | Música y efectos sin voz, para remezclar con otra locución. |
| `audio/elevenlabs-tomas/` | Las tomas que ElevenLabs llegó a generar (frase 1, tres tomas; frase 2, una toma). |
| Fuente editable | `promo/src/reel/` (Remotion), `promo/audio/build_reel.py` y `mux_reel.sh` (audio), `promo/capture/` (capturas de la app). Ver `promo/README.md`. |

## Locución

- Guion: exactamente el del encargo (`promo/src/reel/script.json`).
- Voz pedida: ElevenLabs. Elegida «Sofia - Captivating Narration» (mujer joven adulta, español de España), modelo `eleven_v4`. La cuenta conectada rechazó la generación después de las dos primeras frases («Unusual activity has been detected on your account, so Free Tier access has been disabled… Please upgrade to a paid subscription»); no se reintentó.
- **El máster lleva una voz sintética local**, no la de ElevenLabs: Kokoro-82M (voz ef_dora, español, licencia Apache-2.0), a ritmo enérgico y tratada como locución de radio. Suena más artificial que una voz de ElevenLabs.
- Para sustituirla: genera las 8 frases con ElevenLabs, guárdalas como `promo/audio/voice-reel/elevenlabs/r1.mp3 … r8.mp3` y ejecuta `npm run build:reel` en `promo/`. Subtítulos, cortes y efectos se recalculan a partir de las nuevas tomas.

## Afirmaciones comprobadas

- **Mascota:** Rumbi existe en la app (asistente flotante y tarjeta «Tu consejo de hoy»). En el vídeo se dibuja con el motor de animación de la propia app (`src/features/mascot/rig.ts`) y sus expresiones reales; mantiene silueta, colores y personalidad.
- **Logotipo, colores y tipografía:** trazados reales del logotipo (`src/brand/logoPaths.ts`); violeta `#8b5cf6` y su gama, lavanda `#c4b5fd`; Krophed (títulos de la app), Inter (interfaz) y 212 Baby Girl (frases manuscritas de la app). El lema del cierre usa el mismo tratamiento que la pantalla de inicio de la app.
- **Pantallas:** todas son capturas de la app actual con datos ficticios («Alex»), sin ningún dato personal real. A petición del cliente, el vídeo no lleva el rótulo «Datos de ejemplo». Las animaciones del contador de pasos, el agua y la serie completada están grabadas de la app fotograma a fotograma. La línea de la gráfica se dibuja de izquierda a derecha sobre la propia gráfica sin trazos, como la anima la app al cargarse.
- **Peso, IMC y calorías:** pantallas reales de Progreso (Evolución, IMC, Calorías, Registros) y el detalle de un registro tras tocar la gráfica. La evolución de ejemplo sube y baja («Estable»); no se presenta como un cambio físico.
- **Entrenamiento:** Historial, Plantillas (rutinas), Marcas personales y una sesión con una serie completada con un toque real.
- **Hábitos:** agua y pasos reales; el hito «Mes de Progreso Personal» y la racha de 17 días aparecieron en la app con los datos de ejemplo; el calendario muestra su propio texto «Un día sin registros no es un día fallido».
- **Personalización:** el botón «Color de la interfaz» abre la hoja real con los 6 colores (Violeta Rumbo, Rojo intenso, Naranja brasa, Lima volt, Cian glaciar, Fucsia neón); el cambio claro/oscuro se hace con el botón real y su transición circular. Rumbi cambia de color con la interfaz, como en la app.
- **Privacidad:** comprobado en el código que los registros se guardan en el propio dispositivo (IndexedDB) y que la app no envía datos a ningún servidor, salvo el escáner de alimentos cuando se usa (envía la foto, el nombre del alimento o el código de barras para analizarlo y no lo guarda). Por eso el vídeo dice solo **«Tus registros se guardan en tu propio dispositivo»**. Los textos de privacidad de la app se corrigieron para decir lo mismo (commit «Say exactly what leaves the device in the privacy notes»).

## Lo que se ha dejado fuera

- «Tus datos se guardan solo en este dispositivo y no se envían a ningún servidor»: no es cierto de extremo a extremo por el escáner de alimentos.
- La URL `myrumbo.netlify.app`: no consta en el proyecto (la app está publicada en `rumbofit.netlify.app`). Se puede añadir al cierre si se quiere llevar tráfico a una de las dos.
- Cualquier resultado, garantía, evaluación médica, transformación física o mención a la tecnología («web app» incluida).
- Escudos, candados o sellos que sugieran cifrado o certificaciones.

## Limitaciones reales

- La locución es sintética local; la de ElevenLabs no se pudo generar (ver arriba).
- La barra de estado del teléfono (9:41, cobertura, batería) es un marco genérico de iPhone; la app se capturó en un navegador móvil.
- En las capturas a página completa, las barras superior e inferior de la app vienen de capturas en reposo; al desplazarse, su fondo translúcido no refleja exactamente el contenido que pasa por debajo.

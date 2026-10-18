# RUMBO · «Cada pequeño paso cuenta» — nota de producción

Anuncio vertical para Reels y TikTok (1:04) con adaptación 4:5 para el feed, en 2K a 60 fps y en 1080p a 30 fps. Es la versión enérgica: voz con entusiasmo, música original a 120 BPM, cortes y texto cinético sobre el ritmo. Los 60 fps son movimiento real: toda la animación se calcula en tiempo, no se duplican fotogramas. Todo sale del código del proyecto: interfaz capturada de la app real, Rumbi movido por el motor de animación de la propia app y afirmaciones comprobadas en el código.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `RUMBO-cada-paso-cuenta-9x16-2k60.mp4` | Máster 2K: 1440 × 2560 a 60 fps, H.264 (High 5.1) + AAC 48 kHz, −14 LUFS, subtítulos incrustados. En el repositorio va una copia de menos de 100 MB (GitHub no admite archivos mayores), codificada en dos pasadas desde el render de alta calidad; la de más tasa, `…-2k60-master.mp4`, queda fuera del repositorio y se rehace con `npm run mux:pasos` |
| `RUMBO-cada-paso-cuenta-9x16.mp4` | La misma pieza a 1080 × 1920 y 30 fps (de la misma renderización, un fotograma de cada dos) |
| `RUMBO-cada-paso-cuenta-4x5.mp4` | Adaptación 4:5 con encuadre propio (no es un recorte): 1080 × 1350 a 30 fps, renderizada directamente a ese tamaño (composición `RumboPasos45x30`). La versión 2K a 60 fps sale con `npm run render:pasos45 && npm run mux:pasos45` |
| `RUMBO-cada-paso-cuenta-voz-elevenlabs.wav` | Narración limpia de ElevenLabs, sin música ni efectos, alineada con el vídeo (48 kHz, 24 bits) |
| `RUMBO-cada-paso-cuenta.es.srt` | Subtítulos en español de toda la narración (25 frases cortas) |
| `../../audio/voice-energia/l1…l9.wav` | Las tomas elegidas, recortadas; `takes/` guarda todas las tomas generadas |
| `../../src/pasos/` | Proyecto editable (Remotion + React): escenas, Rumbi, tiempos, subtítulos |

## Estructura (120 BPM: un compás son 2 s)

| Tiempo | Bloque | Voz |
| --- | --- | --- |
| 0:00–0:08 | Gancho: Rumbi despierta, las palabras golpean al ritmo, un trazo de luz, «TU CAMINO. TU RUMBO.» y subida | «No hace falta cambiarlo todo de un día para otro. Basta con dar el siguiente paso.» |
| 0:08–0:16 | Drop: el móvil cae con la Inicio real; «REGISTRA. OBSERVA. SIGUE ADELANTE.» con cortes a pantallas reales | «RUMBO te ayuda a registrar lo que haces y a ver cómo avanza tu proceso, a tu manera.» |
| 0:16–0:24 | Evolución: la gráfica real se dibuja, salen las tarjetas de IMC y calorías, cada pesaje se ilumina | «Anota tu evolución y consulta tus datos de peso, IMC y calorías en un mismo lugar. Cada registro cuenta una parte de tu historia.» |
| 0:24–0:32 | Entrenamiento: plantillas, Rumbi completa la serie 1 (confeti), marcas personales, historial y estadísticas | «Guarda tus entrenamientos, tus rutinas y tus marcas. Así puedes volver a ellos y reconocer todo el trabajo que ya has hecho.» |
| 0:32–0:40 | Hábitos: «AGUA» (Rumbi pulsa «+ 250»), «PASOS», «RACHA» (22 días), «LA CONSTANCIA TAMBIÉN SUMA.» y el calendario | — (texto en pantalla y música) |
| 0:40–0:46 | Estilo: «A TU ESTILO.», cinco colores reales de la interfaz al ritmo, tema claro y vuelta al oscuro | — |
| 0:46–0:52 | Privacidad: «Tus registros se guardan en este dispositivo.» y la nota del escáner | — |
| 0:52–0:56 | Subida: «ENTRENA. REGISTRA. CELEBRA.» sobre un montaje de pantallas reales | — |
| 0:56–1:04 | Drop final: logotipo, «Cada pequeño paso cuenta» y «Empieza hoy» | «RUMBO. Cada pequeño paso cuenta. Empieza hoy.» |

Los bloques sin voz se quedaron así porque la cuenta de ElevenLabs agotó su cuota a mitad de la generación; con esa opción, la pieza es más corta y rápida (1:04 en lugar de la horquilla de 1:30–2:00 del brief original). Si se recarga la cuenta, se pueden generar las cuatro frases que faltan con la misma voz y alargar la pieza.

## Afirmaciones verificadas en el código

- **Mascota:** Rumbi existe en la app (`src/features/mascot/`): una esfera perlada con ojos en forma de píldora, brillo del color de acento y animación propia (`rig.ts`). El vídeo usa el mismo SVG y el mismo motor; sus caras, miradas, pulsaciones y saltos salen del rig. El «baile» con el ritmo es un pequeño rebote y aplastamiento añadido por encima, sin cambiar su forma. Rumbi no tiene brazos: en lugar de «señalar», mira, salta y pulsa.
- **Peso, IMC y calorías:** pestañas «Evolución», «Registros», «IMC» y «Calorías» de Progreso (`src/features/progress/`). La tarjeta de IMC incluye en la app el aviso «El IMC es orientativo y no es un diagnóstico».
- **Entrenamiento:** plan, plantillas (rutinas), series por ejercicio, historial, estadísticas y «Marcas personales» (`src/features/training/`). La serie que se completa en el vídeo se completó de verdad pulsando «Completar serie 1» en la app.
- **Hábitos:** agua y pasos (`src/features/habits/`), racha y calendario (`src/features/streak/`, `src/features/calendar/`). El paso de 1 L a 1,25 L se hizo pulsando el botón real «+ 250» de Inicio; «+ 250 ml» rotula esa misma acción. «22 días de racha» lo calcula la app con los registros de demostración.
- **Personalización:** el botón de tema claro/oscuro (`src/ui/ThemeToggle.tsx`) y el selector «Color de la interfaz» (`src/ui/AccentPicker.tsx`), con seis colores; el vídeo enseña cinco (violeta, naranja, fucsia, lima y cian, capturados en la app). En la app el cambio es una revelación circular de 620 ms; en el vídeo los cambios de color, al ritmo, van más rápidos (unos 270 ms) con la misma forma de revelación. El brillo de Rumbi sigue el color de acento, como en la app.
- **Privacidad (alcance real):** todo lo que se registra (perfil, pesos, agua, pasos, entrenamientos, comidas, notas) se guarda en IndexedDB del propio navegador (`src/db/db.ts`, `src/db/backend.ts`), sin cuentas ni servidor de datos. Durante la captura se registraron todas las peticiones de red (onboarding, registros, tema y color, entrenamiento): 1880 peticiones, todas GET de recursos del propio origen, ninguna con cuerpo de datos (registro completo en `red-captura.json`).

## Afirmaciones omitidas o ajustadas

- **«…y no se envían a ningún servidor»: no se usa.** El escáner de comidas, que es opcional, sí se conecta: las fotos se reducen en el móvil y se envían a las funciones de RUMBO en Netlify, que las analizan con la IA de Anthropic; las búsquedas de alimentos van a USDA a través de esas funciones, y los códigos de barras se consultan en Open Food Facts (`src/features/food/api.ts`, `netlify/functions/`). Por eso el rótulo dice «Tus registros se guardan en este dispositivo» y una nota visible añade «El escáner de comidas, opcional, se conecta a internet para identificar alimentos». El plano de bienvenida, que muestra la frase completa, no aparece en el vídeo.
- **Datos:** todos son de demostración (usuario ficticio «Alex»); el vídeo no lleva rótulo que lo indique. Se eligieron valores con el IMC en el intervalo de referencia para no enseñar etiquetas que puedan culpabilizar. No hay comparaciones de antes y después ni promesas de resultados.
- **Hitos:** solo se muestra la racha, que la app calcula con esos registros.
- **Tecnología:** la pieza no dice «web app» ni habla de la tecnología.
- **Cierre:** logo, lema y «Empieza hoy», sin dirección web.

## Voz, música y sonido

- **Voz:** ElevenLabs, modelo `eleven_v4`, voz «Cristina» (femenina, español de España, voz publicitaria), con la dirección `[excited]` y signos de exclamación. Frente a la lectura anterior, el tono varía el doble o el triple (±3–4 semitonos frente a ±1,3) y el ritmo es un 25–35 % más rápido. Las tomas se colocan sin acelerar ni estirar.
- **Tiempos de palabra:** sin créditos para Scribe, se calcularon en local con `audio/align.py` (eSpeak NG + DTW sobre MFCC, con anclaje en las pausas). Probado contra Scribe en la narración anterior (155 palabras): mediana de error 25 ms, percentil 90 de 75 ms. Las tomas nuevas no se transcribieron, así que conviene escucharlas una vez antes de publicar.
- **Música:** original, sintetizada en el proyecto (`audio/build_pasos.py`, `audio/synth.py`): 120 BPM, si menor / re mayor (Bm – G – D – A), supersierras con bombeo de sidechain, bajo galopante, batería, subidas y dos drops. No usa grabaciones de terceros.
- **Efectos:** golpes bajo las palabras grandes, barridos en las transiciones, ticks al iluminarse cada pesaje, la serie completada, el agua, cada color e impactos en los drops (`src/pasos/beats.json`). Bajan solos cuando habla la voz; la música se atenúa con sidechain. Normalizado a −14 LUFS; pico real de −1,2 dBFS tras codificar en AAC a 320 kbit/s (`audio/mux.sh`).
- **Destellos:** solo dos, suaves, en los drops; los cortes rápidos de la subida usan pantallas oscuras para no producir parpadeos de luminancia.

## Otras notas

- **Texto de la app:** la bienvenida (`OnboardingPage.tsx`) y Perfil (`ProfilePage.tsx`) dicen «no se envían a ningún servidor», lo que no es exacto si se usa el escáner. Conviene ajustar ese texto en la app.

## Cómo rehacerlo

```bash
cd promo && npm install && pip install numpy scipy soundfile espeakng-loader
# (opcional) capturas nuevas: en la raíz, npm run build && npx vite preview --port 4173; luego npm run capture:pasos
npm run build:pasos      # tiempos y subtítulos → audio → render 9:16 → mezcla → render 4:5 → mezcla
npm run stills -- RumboPasos out/stills 240 660 1290 1700   # fotogramas sueltos para revisar
```

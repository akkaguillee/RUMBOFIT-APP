# RUMBO · «Cada pequeño paso cuenta» — nota de producción

Anuncio vertical para Reels y TikTok (1:44,5) con adaptación 4:5 para el feed, en 2K a 60 fps y en 1080p a 30 fps. Los 60 fps son movimiento real: toda la animación se calcula en tiempo, no se duplican fotogramas. Todo sale del código del proyecto: interfaz capturada de la app real, Rumbi movido por el motor de animación de la propia app y afirmaciones comprobadas en el código.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `RUMBO-cada-paso-cuenta-9x16-2k60.mp4` | Máster 2K: 1440 × 2560 a 60 fps, H.264 (High 5.1) + AAC 48 kHz, −14 LUFS, subtítulos incrustados. En el repositorio va una copia de unos 94 MB (GitHub no admite archivos de más de 100 MB), codificada en dos pasadas desde el render de alta calidad; la copia de más tasa, `…-2k60-master.mp4`, queda fuera del repositorio y se rehace con `npm run mux:pasos` |
| `RUMBO-cada-paso-cuenta-9x16.mp4` | La misma pieza a 1080 × 1920 y 30 fps (de la misma renderización, un fotograma de cada dos) |
| `RUMBO-cada-paso-cuenta-4x5-2k60.mp4` | Adaptación 4:5 con encuadre propio (no es un recorte): 1440 × 1800 a 60 fps (con el mismo límite de tamaño que el 9:16) |
| `RUMBO-cada-paso-cuenta-4x5.mp4` | La adaptación 4:5 a 1080 × 1350 y 30 fps |
| `RUMBO-cada-paso-cuenta-voz-elevenlabs.wav` | Narración limpia de ElevenLabs, sin música ni efectos, alineada con el vídeo (48 kHz, 24 bits) |
| `RUMBO-cada-paso-cuenta.es.srt` | Subtítulos en español (32 frases cortas, tiempos sacados de la propia voz) |
| `../../audio/voice-pasos/l1…l9.wav` | Las nueve tomas elegidas, recortadas; `takes/` guarda todas las tomas generadas |
| `../../src/pasos/` | Proyecto editable (Remotion + React): escenas, Rumbi, tiempos, subtítulos |

## Afirmaciones verificadas en el código

- **Mascota:** Rumbi existe en la app (`src/features/mascot/`): una esfera perlada con ojos en forma de píldora, brillo del color de acento y animación propia (`rig.ts`). El vídeo usa el mismo SVG y el mismo motor, así que no hay ninguna mascota inventada. La app además lo muestra en «Tu consejo de hoy» (se ve en el plano de Inicio). Rumbi no tiene brazos: en lugar de «señalar», mira, se inclina y salta.
- **Peso, IMC y calorías:** pestañas «Evolución», «Registros», «IMC» y «Calorías» de Progreso (`src/features/progress/`). La tarjeta de IMC incluye en la app el aviso «El IMC es orientativo y no es un diagnóstico».
- **Entrenamiento:** plan, plantillas (rutinas), series por ejercicio, historial y «Marcas personales» (`src/features/training/`). La serie que se completa en el vídeo se completó de verdad pulsando el botón «Completar serie 1» de la app.
- **Hábitos:** agua y pasos (`src/features/habits/`), con racha y calendario (`src/features/streak/`, `src/features/calendar/`). El paso de 1 L a 1,25 L se hizo pulsando el botón real «+ 250» de Inicio.
- **Personalización:** el botón de tema claro/oscuro (`src/ui/ThemeToggle.tsx`) y el selector «Color de la interfaz» con seis colores (`src/ui/AccentPicker.tsx`). Ambos cambian la interfaz con una revelación circular de 620 ms que el vídeo reproduce con la misma curva. El brillo de Rumbi sigue el color de acento, como en la app.
- **Privacidad (alcance real):** todo lo que se registra (perfil, pesos, agua, pasos, entrenamientos, comidas, notas) se guarda en IndexedDB del propio navegador (`src/db/db.ts`, `src/db/backend.ts`), sin cuentas ni servidor de datos. Durante la captura se registraron todas las peticiones de red (onboarding, registros, tema y color, entrenamiento): 1880 peticiones, todas GET de recursos del propio origen, ninguna con cuerpo de datos (registro completo en `red-captura.json`).

## Afirmaciones omitidas o ajustadas

- **«…y no se envían a ningún servidor»: no se usa.** El escáner de comidas, que es opcional, sí se conecta: las fotos se reducen en el móvil y se envían a las funciones de RUMBO en Netlify, que las analizan con la IA de Anthropic; las búsquedas de alimentos van a USDA a través de esas funciones, y los códigos de barras se consultan en Open Food Facts (`src/features/food/api.ts`, `netlify/functions/`). Por eso:
  - la voz dice «Y tu privacidad importa: lo que registras se guarda en tu propio dispositivo»;
  - el rótulo dice «Tus registros se guardan en este dispositivo»;
  - una nota visible añade «El escáner de comidas, opcional, se conecta a internet para identificar alimentos».
  - El plano de bienvenida, que muestra la frase completa, no aparece en el vídeo.
- **Datos:** todos son de demostración (usuario ficticio «Alex»), y la pieza lo indica en pantalla con «Datos de demostración». Se eligieron valores con el IMC en el intervalo de referencia para no enseñar etiquetas que puedan culpabilizar. No hay comparaciones de antes y después ni promesas de resultados.
- **Hitos:** solo se muestra la racha («22 días de racha»), que la app calcula con esos registros.
- **Tecnología:** la pieza no dice «web app» ni habla de la tecnología.

## Voz, música y sonido

- **Voz:** ElevenLabs, modelo `eleven_v4`, voz «Marina» (femenina, español peninsular, unos 30 años), etiqueta `[warmly]`. Se generaron nueve frases con 2–4 tomas cada una (flujo «RUMBO · Cada pequeño paso cuenta (narración)» en ElevenLabs) y se transcribieron todas con Scribe. Las 28 coinciden palabra por palabra con el guion, incluido «IMC». Las tomas elegidas se colocan sin acelerar ni estirar.
- **Música:** original, sintetizada en el proyecto (`audio/build_pasos.py`, `audio/synth.py`): 100 BPM, re mayor, cálida y con pulso suave. No usa grabaciones de terceros.
- **Efectos:** breves y discretos, sobre los momentos de la imagen (`src/pasos/beats.json`). La mezcla atenúa la música bajo la voz con sidechain y normaliza a −14 LUFS y −1 dBTP (`audio/mux.sh`).

## Pendiente de confirmar

- **URL del cierre:** el vídeo muestra `myrumbo.netlify.app`, la dirección del brief. El código del proyecto menciona `rumbofit.netlify.app` (`netlify/lib/off.ts`, `netlify/tests/food.test.ts`). Desde este entorno no se pudo abrir ninguna de las dos. Para cambiarla, edita `url` en `src/Root.tsx` y vuelve a renderizar; con `url: ''` el cierre queda sin dirección.
- **Texto de la app:** la bienvenida (`OnboardingPage.tsx`) y Perfil (`ProfilePage.tsx`) dicen «no se envían a ningún servidor», lo que no es exacto si se usa el escáner. Conviene ajustar ese texto en la app.

## Cómo rehacerlo

```bash
cd promo && npm install && pip install numpy scipy soundfile
# (opcional) capturas nuevas: en la raíz, npm run build && npx vite preview --port 4173; luego npm run capture:pasos
npm run build:pasos      # tiempos y subtítulos → audio → render 9:16 → mezcla → render 4:5 → mezcla
npm run stills -- RumboPasos out/stills 400 1178 2104   # fotogramas sueltos para revisar
```

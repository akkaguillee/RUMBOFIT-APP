# RUMBO

Aplicación web para mejorar hábitos, registrar la evolución física y organizar el entrenamiento, con una experiencia visual inspirada en Liquid Glass. Funciona en móvil, tablet y escritorio, en modo oscuro (predeterminado) y claro.

> RUMBO es una herramienta de seguimiento personal, no un dispositivo médico. Las estimaciones de calorías, IMC o distancia son orientativas.

## Puesta en marcha

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev        # entorno de desarrollo en http://localhost:5173
npm run build      # build de producción en dist/
npm run preview    # sirve el build en http://localhost:4173
```

### Versión en un solo archivo HTML

```bash
npm run build:html # genera dist-html/rumbo.html
```

`rumbo.html` lo incluye todo (código, estilos, fuente Inter, logotipo e iconos) y funciona al abrirlo directamente desde el disco, sin servidor ni conexión a internet. Usa rutas con `#` (por ejemplo `rumbo.html#/progresos`) y guarda los datos en el navegador como la versión normal. Si el navegador no permite guardar datos (ventanas privadas o visores de archivos), la app sigue funcionando en un **modo temporal** claramente avisado, en el que nada se conserva al cerrar.

Comprobaciones:

```bash
npm run typecheck  # TypeScript estricto
npm run lint       # ESLint (incluye las reglas de React Hooks)
npm test           # pruebas unitarias e integración (Vitest + IndexedDB simulada)
npm run test:e2e   # genera rumbo.html y ejecuta las pruebas end-to-end en móvil y escritorio (Playwright)
```

## Qué incluye

| Módulo | Funcionalidad |
| --- | --- |
| Bienvenida | Animación del logotipo en blanco con estilo *motion graphics*: líneas de velocidad, trazado del corredor, onda expansiva, letras con *tracking*, destello de luz y apertura de telón. Completa la primera vez, breve después, desactivable y con botón «Saltar». Respeta `prefers-reduced-motion`. |
| Onboarding | Portada con el logotipo centrado en un medallón de cristal y resumen de funciones; después, configuración progresiva en 10 pasos. Solo el nombre y el objetivo son obligatorios. Explica por qué se pide cada dato y no permite objetivos por debajo de un IMC de 18,5. |
| Inicio | «Rumbo meter» (inicio → objetivo), peso actual, perdido/ganado, variación de 7 días, agua, pasos, entreno del día, semana con racha, próximo hito y consejos descartables. |
| Progresos | **Evolución** con gráfica interactiva (rangos 7D–Todo, tendencia diferenciada, objetivo, tooltip con el registro exacto, navegación con teclado, vista de tabla), **Registros** (editar/eliminar con confirmación), **IMC** y **Calorías** (Mifflin-St Jeor, metabolismo basal vs. gasto total, objetivos conservadores, macros configurables y restricciones para menores y situaciones especiales). |
| Calendario | Indicadores por tipo de registro, objetivos cumplidos, notas e hitos; detalle del día para consultar y añadir datos atrasados; resumen semanal. Un día sin datos nunca se marca como fallido. |
| Hábitos | Agua (recipiente animado, cantidades rápidas, registro por hora con «Deshacer», gráfica semanal, objetivo editable) y pasos (pista de atletismo animada con el corredor avanzando según tus pasos, sumas rápidas de +500 a +5.000, lo que falta para el objetivo en pasos, minutos y distancia, tiempo activo, distancia y energía estimadas, anillos de los últimos 7 días, rachas, gráfica e historial). |
| Entrenamiento | Plan semanal editable (con sugerencia opcional), catálogo de 86 ejercicios + personalizados, sesiones con cronómetro y descanso basados en la hora real, series independientes (peso/reps, reps, tiempo, distancia), «Usar última vez», reordenar series y ejercicios, resumen con marcas personales, historial, plantillas, sesiones pasadas y estadísticas (frecuencia, volumen, grupos musculares, evolución de carga, récords registrados vs. 1RM estimado). |
| Hitos | 85 hitos en 13 categorías y 5 rarezas, calculados a partir de los registros. Celebración animada al desbloquear, historial y «próximo objetivo». |
| Perfil | Datos personales, objetivo (con historial de etapas), hábitos, tema, color de la interfaz, efectos, animación de bienvenida, exportar/importar copia de seguridad (validada fila a fila) y borrado total de datos. |
| ¿Quién soy? | Texto oficial íntegro, fotografía original del creador (`src/assets/creator/guille.jpg`, recortada para el marco circular, convertida a sRGB y sin metadatos) con borde blanco, y enlaces a Instagram, TikTok y YouTube. |

## Arquitectura

```
src/
  app/          Shell, rutas (carga diferida), tema, splash
  brand/        Logotipo vectorizado a partir de los archivos originales
  db/           Dexie (IndexedDB): esquema versionado, repositorios, hooks reactivos, sincronización de hitos
  domain/       Lógica pura y testeada: fechas locales, unidades, salud, peso, hábitos, entrenamiento, hitos
  features/     Pantallas por módulo
  styles/       Tokens de diseño, material Liquid Glass, componentes y layout
  ui/           Componentes reutilizables (GlassCard, Button, Field, Sheet, Segmented, ProgressRing…)
e2e/            Pruebas Playwright
```

- **Stack:** React 19, TypeScript estricto, Vite, React Router, Motion, Dexie, d3-shape (curvas), Lucide.
- **Una sola fuente de verdad:** todas las pantallas leen de IndexedDB mediante consultas reactivas, así que registrar un peso actualiza a la vez el inicio, la gráfica, el calendario y los hitos.
- **Fechas:** los registros se guardan por día natural local (`YYYY-MM-DD`), nunca convertidos a UTC, para que nada salte de día.
- **Temporizadores:** el cronómetro y el descanso se calculan con marcas de tiempo, por lo que siguen siendo correctos aunque se cierre la app.
- **Hitos:** se recalculan tras cada cambio. Cada hito se desbloquea una sola vez y solo se retira si se eliminan o corrigen los registros que lo justificaban. Los objetivos de agua y pasos se guardan por día, de modo que cambiar el objetivo no reescribe el pasado.

## Diseño

- Tokens en `src/styles/tokens.css` (colores de marca, espaciado de 4 pt, radios, desenfoques, duraciones). Cada tema define sus propios roles; el modo claro usa granate en títulos e identidad.
- Material Liquid Glass en `src/styles/glass.css`: desenfoque real del fondo, relleno translúcido, borde luminoso degradado, reflejo especular que sigue al cursor y barrido de brillo en las superficies principales. En dispositivos de poca potencia (o con «Efectos ligeros») se sustituye el desenfoque por superficies sólidas.
- El cambio de tema usa la View Transitions API con un revelado circular desde el botón; sin soporte, transición de color suave. El tema se aplica antes del primer pintado para evitar destellos.
- **Color de la interfaz:** seis paletas de acento (RUMBO rojo, Ignición naranja, Volt lima, Glaciar cian, Ultra violeta y Neón fucsia), desde el botón de la barra superior o Perfil → Apariencia. Cada paleta define una pequeña rampa en `tokens.css` de la que ambos temas derivan sus colores; los colores de estado (verde, amarillo, rojo) no cambian. Se guarda en el dispositivo y se aplica antes del primer pintado.
- **Fondo interactivo:** auroras de color en movimiento y una cuadrícula de puntos (canvas) que reacciona al dedo o al cursor como una lente líquida, con onda expansiva al tocar. Visto a través del cristal se percibe como refracción. Solo se anima mientras hay movimiento y se desactiva con «Efectos ligeros» o `prefers-reduced-motion`.
- **Liquid Glass en todo:** además de tarjetas, barras y hojas, cada control (pestañas, chips, campos, botones, avisos) se dibuja como una pequeña lente con borde luminoso; los que están sobre el fondo también lo desenfocan.
- Colores de datos validados para daltonismo (peso en tinta neutra, agua azul, pasos ámbar, entrenos con forma de anillo); los estados verde/amarillo/rojo siempre van acompañados de icono y texto.

## Privacidad y datos

Los datos se guardan únicamente en el navegador del dispositivo (IndexedDB). No hay servidor, cuentas ni claves en el cliente. Desde **Perfil → Datos y privacidad** se puede exportar una copia en JSON, restaurarla o borrar todos los datos. Las copias se validan fila a fila antes de restaurarse, y si una sección fallara al mostrarse aparece un aviso con «Reintentar» (y, si falla toda la app, la opción de descargar una copia de los datos) en lugar de una pantalla en blanco.

## Publicar en Netlify u otro hosting

`npm run build` genera `dist/`. Incluye `public/_redirects` (`/* /index.html 200`) para que las rutas como `/habitos` funcionen al recargar o al abrir un enlace directo en Netlify; en otros servicios hay que configurar la misma regla de *fallback* a `index.html`.

## Pendiente / dependencias externas

- **Sincronización entre dispositivos:** requiere un backend con autenticación (por ejemplo, Supabase con políticas RLS por usuario). El esquema de Dexie está versionado y el formato de exportación sirve de base para migrar.
- **Apple Salud / Health Connect / relojes:** no disponibles en web; los pasos se registran manualmente.
- **Notificaciones (recordatorios de agua):** no implementadas; requieren service worker y permiso explícito.

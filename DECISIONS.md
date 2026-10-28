# DECISIONS — Gaffer

Registro de decisiones: qué se eligió, qué se descartó y por qué.

## Memo (2026-10-28)

**Situación.** Repo `Eduardo0719382/Gaffer` vacío y público. Referencia: Sidus Link Diagram Master
(plano de planta con paredes, luces, haces de color, etiquetas, capas, deshacer/rehacer).

**Complicación.** Diagram Master está atado a una marca, no calcula carga eléctrica ni genera
gear list. Necesitamos Windows + Android (y mac/Linux) desde un solo código, que se instale y se
actualice desde GitHub, sin tienda, para usuarios con poca experiencia en computación.

**Pregunta.** ¿Qué stack y qué alcance para la v1?

**Respuesta.** Núcleo web (TypeScript + React + Konva) empaquetado con Electron (escritorio)
y Capacitor (Android). GitHub Actions compila todo al crear un tag `vX.Y.Z` y publica un
GitHub Release; la app consulta ese Release para actualizarse.

## D1 — Stack: núcleo web + Electron + Capacitor
- **Elegido:** React 18 + Konva (canvas 2D) + Zustand (estado) + Vite. Escritorio con Electron +
  electron-builder + electron-updater. Android con Capacitor 7.
- **Por qué:**
  - Un solo código de UI y canvas.
  - El canvas se puede probar en un navegador en cada paso, así que hay verificación real.
  - electron-updater es el auto-update de escritorio más probado con GitHub Releases.
  - Capacitor es el contenedor Android más maduro para apps web (archivos, compartir).
- **Descartados:**
  - *Flutter*: buen canvas, pero el auto-update de Windows es a mano. Además no hay SDK
    instalado y no podría verificar la UI en el navegador con la misma fidelidad.
  - *Tauri 2*: instalador más chico, pero Android en Tauri es más joven, hace falta Rust
    (no instalado) y aquí no se pueden hacer builds locales de escritorio.
  - *Godot*: 2D táctil excelente, pero formularios, PDF y UI tipo herramienta son débiles.
  - *PWA pura*: se pidió APK e instalador. Queda como opción futura (GitHub Pages) casi gratis.
- **Costo aceptado:** el instalador de Electron pesa ~90 MB.

## D2 — Actualización desde GitHub
- **Escritorio (Windows/Linux):** electron-updater lee `latest.yml` del último Release, descarga
  en segundo plano y muestra "Reiniciar para actualizar".
- **macOS:** el auto-update requiere firma de Apple (pago). La app avisa que hay versión
  nueva y abre la página de descarga.
- **Android:** la app consulta la API de GitHub (`releases/latest`), compara versiones y, si hay
  una más nueva, abre la descarga del APK; Android la instala encima.
  - Requisito: **siempre la misma llave de firma.**
  - La llave se generó fuera del repo y vive en GitHub Secrets.
  - Si faltan los secrets, CI no publica APK. Esto evita que se publique un APK con una llave
    distinta que rompería las actualizaciones.
- **Descartados:**
  - Instalar el APK desde dentro de la app con plugin nativo propio: no se puede probar aquí
    sin dispositivo; queda para después.
  - Play Store: requiere cuenta de pago y revisión.
- **versionCode** de Android = `mayor*10000 + menor*100 + parche`, derivado del tag.

## D3 — Modelo de datos y archivo
- **Proyecto** = `{ schema, id, name, scenes[], settings }`.
- **Escena** = `{ id, name, objects[], notes }`.
- **Objeto** = `{ id, kind, x, y, rotation, layer, label, ... }`; las luces llevan su ficha
  de equipo *copiada*.
- Las posiciones se guardan en **metros**, no en píxeles, así que haces y distancias
  tienen sentido real.
- **Copiar la ficha** en cada luz hace que un archivo abra igual en otro equipo aunque esa
  persona no tenga el equipo personalizado en su librería.
- **Archivo** `.gaffer` = JSON con `schema` numérico, para poder migrar versiones viejas.
- **Almacenamiento:** IndexedDB con autoguardado, más una lista "Mis proyectos" al abrir.
  Para compartir, se exporta/importa el `.gaffer`.
- **Descartados:**
  - Base de datos en la nube con cuentas: complejidad y costo; offline primero.
  - Guardar solo como archivo suelto: para un usuario con poca experiencia es más difícil
    que la lista de proyectos.

## D4 — Canvas
- Konva: arrastrar, rotar, tocar e imagen exportable a alta resolución.
- **Gestos:**
  - Arrastrar el fondo = mover el plano; rueda o pellizco = zoom.
  - Tocar un objeto = seleccionarlo; manija = rotar.
- **Snap:** a cuadrícula de 0.25 m y a giros de 15°; se puede apagar.
- **Deshacer/rehacer:** por instantáneas de escena (máx. 100).
- **Capas fijas tipo set:** Escenografía, Utilería, Cámara/Talento, Luces, Haces, Etiquetas.
  Cada una se puede ocultar o bloquear.
- **Descartado:** capas libres creadas por el usuario. Son más versátiles, pero confunden en
  set; quedan para una versión futura.

## D5 — Haces y fotometría
- **Haz:** cono 2D con ángulo y largo (m). El color sale del CCT o del gel, o se elige
  libremente.
- **Lux estimado:** `lux ≈ (lux a 1 m de la ficha) × intensidad% / d²` (ley del inverso del
  cuadrado), en el punto final del haz.
- Las fichas son **aproximadas y editables**; está señalado en la UI.
- **Descartado:** curvas fotométricas reales (IES): hace falta la data de cada fabricante.

## D6 — Carga eléctrica
- **Fórmula:** A = W / V por circuito.
- **Alertas:** al 80 % del breaker (regla de carga continua) y al 100 %.
- **Valores por defecto:** 120 V, breaker de 20 A; los dos se cambian en ajustes del proyecto.
- Se usa el consumo nominal de la ficha; opcionalmente se escala por la intensidad (aplica a
  LED).

## D7 — Marcas
- Los nombres de modelos aparecen solo como texto descriptivo.
- Íconos genéricos dibujados por nosotros (COB, fresnel, panel, tubo, HMI, práctico).
- Ningún asset de Sidus/Aputure ni de otra marca.

## D8 — Descubrimientos durante la construcción
- **Build local en Windows:** electron-builder falla en dos casos:
  - Al extraer `winCodeSign` sin permiso de symlinks (falta Modo desarrollador).
  - Con rutas de más de 260 caracteres (NSIS).
  - Arreglo local: `subst X: <carpeta>` + `-c.win.signAndEditExecutable=false`.
    En CI (windows-latest) no hace falta.
- **Konva mide un `Wedge` como el círculo completo.** Para encuadrar y exportar se calculan
  los límites a mano: objetos, abanico del haz y etiquetas.
- **Etiquetas:** 0.2 m, pero nunca menos de 11 px en pantalla. Si no, no se leen al alejar.
- **PDF:** el diagrama va en JPEG. En PNG un proyecto de 1 escena pesaba 17 MB; con JPEG,
  5 escenas pesan 1.5 MB.
- **Exportación:** las esperas de dibujo usan setTimeout como respaldo de
  requestAnimationFrame, que se detiene si la ventana está oculta.

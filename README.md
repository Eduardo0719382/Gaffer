# Gaffer — diagramas de iluminación

App para dibujar el plano de planta de iluminación (lighting plot) de cada escena:
paredes, luces con su haz y color, grip, cámara y actores, con etiquetas.
Calcula la carga eléctrica por circuito y arma la lista de equipo sola.
Funciona sin internet, en PC y en Android.

---

## Instalar

Todo se descarga de la página de versiones:
**https://github.com/Eduardo0719382/Gaffer/releases/latest**

### En la PC (Windows)
1. Descarga `Gaffer-Setup-X.Y.Z.exe`.
2. Ábrelo. Si Windows muestra "Windows protegió su PC", toca **Más información → Ejecutar de todas formas**.
   Ese aviso sale porque la app no tiene un certificado pagado; es normal.
3. Gaffer se instala solo y deja un acceso directo en el escritorio.

### En el celular o tablet (Android)
1. Desde el celular, abre el enlace de arriba y descarga `Gaffer-X.Y.Z.apk`.
2. Abre el archivo descargado. La primera vez Android pide permiso para
   "instalar apps de origen desconocido". Dale permiso a tu navegador o a Archivos.
3. Toca **Instalar**.

### Mac / Linux
- **Mac:** descarga el `.dmg`. Como no está firmado por Apple, la primera vez haz
  clic derecho sobre la app → **Abrir**.
- **Linux:** descarga el `.AppImage`, dale permiso de ejecución y ábrelo.

## Actualizar

No tienes que hacer nada especial.
- **PC (Windows/Linux):** al abrir Gaffer, la versión nueva se descarga sola.
  Arriba aparece **"Reiniciar y actualizar"**. Tócalo y listo.
- **Android:** al abrir Gaffer aparece **"Hay una versión nueva"**.
  1. Toca **Descargar actualización**.
  2. Abre el archivo descargado.
  3. Toca **Actualizar**.

  Tus proyectos se conservan.
- **Mac:** aparece el aviso con un botón que te lleva a la descarga.

## Uso rápido

1. **Crea un proyecto.** Puedes empezar vacío o desde una plantilla: entrevista, mesa, interior día, auto de noche.
2. **Agrega cosas:**
   - En PC, toca o arrastra desde la lista de la izquierda.
   - En celular, usa **＋ Agregar**.
   - Las cosas nuevas aparecen al centro de la pantalla.
3. **Mueve** arrastrando. **Gira** con la manija redonda o con ⟲ ⟳ (15° por toque).
4. **Paredes:** toca **▭ Pared** y arrastra. Las esquinas se pegan solas.
5. **Datos de cada luz:** tócala y abre **Propiedades** (en celular, **Datos**). Ahí cambias:
   - CCT, intensidad, gel y difusión
   - color del haz, ángulo y alcance
   - circuito y notas
6. **Escenas:** cada pestaña de arriba es una escena. Con **＋ Escena** agregas otra.
   En **Escena → Ver todas las escenas** las ves juntas.
7. **Capas:** oculta o bloquea escenografía, haces, etiquetas, etc.
8. **Equipo:** la gear list se arma sola por escena o para todo el proyecto.
   Con **Copiar/compartir** la mandas por WhatsApp.
9. **Carga:** amperes por circuito. Avisa arriba del 80 % y si hay sobrecarga.
   El voltaje y los breakers se cambian ahí mismo.
10. **Exportar:**
    - Imagen PNG de la escena.
    - PDF de todo el proyecto: diagramas, tabla de luces, gear list y carga.
    - Archivo `.gaffer` para pasarle el proyecto a otro gaffer.

Todo se guarda solo mientras trabajas. En PC: Ctrl+Z deshacer, Ctrl+Y rehacer,
Supr borrar, R girar, Ctrl+D duplicar.

> Los consumos, ángulos y lux de la librería son **aproximados**. Revisa la ficha
> de tu equipo y corrígelos en la luz o crea tu propio equipo en **Crear equipo personalizado**.

### Pasar proyectos entre equipos
- **Enviar:** Exportar → **Archivo .gaffer** y lo mandas por WhatsApp, correo o Drive.
- **Recibir:** en Gaffer, **Abrir archivo .gaffer**. En PC también puedes hacer doble clic en el archivo.
- Ojo: si desinstalas la app en Android se borran los proyectos de ese teléfono.
  Exporta tus `.gaffer` antes de desinstalar.

---

## Para quien mantiene el código

| Qué | Cómo |
|---|---|
| Probar en el navegador | `npm install` y luego `npm run dev` |
| App de escritorio local | `npm run build` y luego `npm run electron` |
| Instalador Windows local | `npm run dist:win` → carpeta `release/` |
| Publicar versión nueva | Subir un tag: `git tag v0.2.0` y luego `git push origin v0.2.0` |

Al subir el tag, GitHub Actions (`.github/workflows/release.yml`):
1. Compila Windows, macOS, Linux y Android.
2. Crea el Release.
3. Las apps instaladas ven la versión nueva y se actualizan.

**Firma de Android.** El APK se firma con una llave que **no está en el repo**. Vive en
GitHub Secrets con estos nombres:
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Si faltan, el Release sale sin APK. Esto es a propósito: un APK firmado con otra llave
rompería las actualizaciones. Guarda una copia de la llave fuera de la PC.

Decisiones técnicas en [DECISIONS.md](DECISIONS.md); tareas en [KANBAN.md](KANBAN.md).

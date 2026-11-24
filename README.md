# Test CAP · Mercancías y Viajeros

App para practicar el examen del **CAP** (Certificado de Aptitud Profesional) con el banco oficial
de preguntas del Ministerio de Transportes. Se instala en **Android, iPhone y ordenador** como
aplicación web (PWA), sin tiendas, y funciona sin conexión.

## Cuentas y roles

- Registro libre con correo y contraseña, confirmación por correo y recuperación de contraseña.
- **Usuario**: hace tests; sus resultados se guardan en su historial (también sin conexión: se envían después).
- **Administrador**: resumen de uso, gestión de usuarios (buscar, hacer/quitar admin, desactivar,
  enviar recuperación, eliminar, invitar), últimos resultados y publicación del banco.
- Servidor: Supabase (proyecto `Test-CAP`). Esquema y reglas de acceso en `supabase/migrations/`,
  función de administración en `supabase/functions/admin-usuarios/`.

## Qué hace

- Elegir **Mercancías** o **Viajeros**.
- **Simulacro de examen**: 100 preguntas al azar de las secciones 1ª + 2ª (mercancías) o 1ª + 3ª (viajeros), con tiempo.
- **Examen de ampliación**: 25 preguntas solo de la sección específica.
- **Practicar por temas**: eliges los objetivos (incluida la formación complementaria) y ves la solución al momento.
- **Repasar falladas**: las preguntas que fallaste la última vez.
- Puntuación configurable (acierto, fallo, en blanco, % para aprobar), revisión con la norma de cada pregunta,
  y el test en curso se guarda si cierras la app.

## Cómo se actualiza el banco

1. El Ministerio publica el banco como un ZIP de archivos `.txt` (uno por objetivo).
2. Se sube el ZIP nuevo a la carpeta `fuentes/` del repositorio (se puede hacer desde la web de GitHub).
3. La acción `Actualizar banco de preguntas` regenera `data/banco-cap.json`. Si alguna pregunta no
   se lee bien (sin 4 opciones o sin respuesta válida), **falla y no publica nada**.
4. Las apps instaladas detectan la versión nueva al abrirse, o con el botón **🔄 Actualizar**,
   y muestran qué cambió (preguntas nuevas, eliminadas, respuestas cambiadas).

También se puede cargar el ZIP directamente en la app con **📦 Importar ZIP oficial**.

## Estructura

| Archivo | Para qué |
|---|---|
| `index.html`, `app.js`, `styles.css` | La app |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalación y uso sin conexión |
| `data/banco-cap.json`, `data/version.json` | Banco generado (no editar a mano) |
| `fuentes/*.zip` | ZIP oficial de `.txt` |
| `scripts/parse_txt.py`, `scripts/build_banco.py` | Lector de los `.txt` y generador del banco |

## Desarrollo

```bash
python scripts/build_banco.py      # regenera data/ desde el ZIP más reciente de fuentes/
python -m http.server 8000         # abre http://localhost:8000
```

Las preguntas son del Ministerio de Transportes y Movilidad Sostenible, que advierte que tienen
efectos informativos y pueden revisarse en cualquier momento.

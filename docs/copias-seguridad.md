# Copias de seguridad

El plan gratuito de Supabase **no guarda copias que puedas restaurar**. Esta copia la hace GitHub:
workflow `.github/workflows/copia-seguridad.yml`, todos los domingos y cuando lo lances a mano.

## Qué guarda

Un archivo `copia-AAAAMMDD-HHMM.tar.gz.gpg`, **cifrado con AES-256**, con:

| Archivo | Contenido |
|---|---|
| `estructura.sql` | Tablas, funciones y políticas de `public` y `privado` (referencia) |
| `datos.sql` | Perfiles, resultados e historial del banco |
| `cuentas.sql` | Cuentas de acceso: correos, contraseñas **cifradas** y verificación en dos pasos |
| `LEEME.txt` | Fecha y tamaño |

Se guarda 90 días en **Actions → Copia de seguridad → (ejecución) → Artifacts**.
El repositorio es público: cualquiera con cuenta de GitHub puede descargar el archivo, pero
**sin la frase no se puede abrir**. Por eso la frase es lo que hay que proteger.

El banco de preguntas no hace falta copiarlo: está en el repositorio (`data/` y `fuentes/`).

## Puesta en marcha (una vez)

Dos secretos en GitHub: **repositorio → Settings → Secrets and variables → Actions → New repository secret**.

1. **`SUPABASE_DB_URL`**
   - Supabase → botón **Connect** (arriba) → pestaña de cadena de conexión → **Session pooler**.
   - Copia la que empieza por `postgresql://postgres.bzalfptgfqsoalqgsklr:[YOUR-PASSWORD]@...:5432/postgres`.
   - Cambia `[YOUR-PASSWORD]` por la contraseña de la base de datos (sin corchetes).
   - ¿No la sabes? Supabase → Project Settings → Database → **Reset database password**.
     Cambiarla **no afecta a la app** (la app no la usa). Elige una solo con letras y números:
     los símbolos (`@ : / ? #`) rompen la dirección.
   - Usa *Session pooler*, no *Direct connection*: la directa no funciona desde GitHub (IPv6).
2. **`BACKUP_PASSPHRASE`**: una frase larga (mínimo 20 caracteres), p. ej. cinco palabras al azar.
   **Apúntala fuera del móvil** (papel o gestor de contraseñas). Si la pierdes, las copias no sirven.

Después: **Actions → Copia de seguridad → Run workflow**. Debe acabar en verde y dejar un artefacto.
Si alguna semana falla, GitHub te manda un correo.

## Restaurar (si se pierde la base)

Necesitas un ordenador (o Termux) con `gpg` y `psql` 17.

1. Descarga el artefacto, descomprime el `.zip` que da GitHub y descifra:
   ```sh
   gpg -d copia-AAAAMMDD-HHMM.tar.gz.gpg | tar -xzf -
   ```
2. En el proyecto de Supabase (el mismo o uno nuevo), aplica en orden las migraciones
   `supabase/migrations/001…` a `007…` (sin los `_down`). Eso recrea tablas, funciones,
   políticas y los disparadores sobre las cuentas.
3. Carga los datos **con los disparadores apagados** (si no, cada cuenta crearía un perfil
   duplicado y fallaría la carga):
   ```sh
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
     -c "SET session_replication_role = replica;" -f cuentas.sql -f datos.sql
   ```
4. Si es un proyecto nuevo: cambia `SUPABASE_URL` y la clave pública en `app.js` e `index.html`,
   vuelve a desplegar las funciones de `supabase/functions/` y sus secretos, y repite los ajustes
   de Auth (SMTP de Gmail, plantillas, direcciones de redirección).

**Prueba la restauración al menos una vez** en un proyecto de prueba: una copia que nunca se ha
restaurado no está demostrado que sirva.

## Límites

- Se pierde como mucho una semana de datos (resultados de tests y cuentas nuevas).
- Las sesiones abiertas no se copian: tras restaurar, todos vuelven a iniciar sesión.
- Si necesitas más (copia diaria, restaurar a un minuto concreto): plan Pro de Supabase.

# Spec 007 · Límite de dispositivos por usuario

Estado: **aprobada e implementada (27-11-2026)**

## 1. Objetivo

- Que una cuenta (sobre todo una de pago) no se pueda compartir entre muchas personas.
- Cada usuario normal puede tener la sesión abierta en **1 solo dispositivo**. Los administradores, sin límite.
- **Entra el último**: al iniciar sesión en un dispositivo nuevo se cierra la sesión del anterior. El anterior queda
  **bloqueado** (sale a la pantalla de acceso con el aviso) hasta que vuelva a iniciar sesión allí, lo que a su vez
  cierra la del otro. Nunca hay dos a la vez y nadie se queda fuera si pierde el móvil.
- El admin ve en qué dispositivo tiene la sesión cada usuario y puede cerrarla.
- **No es** un bloqueo por hardware: "dispositivo" = sesión iniciada (la web y el APK del mismo móvil cuentan como 2: con el límite de 1, abrir una cierra la otra).

## 2. Datos afectados

| Dato | Dónde | Quién escribe | Quién lee |
|---|---|---|---|
| Sesiones | `auth.sessions` (de Supabase Auth) | Supabase Auth al iniciar o cerrar sesión; el trigger nuevo; las funciones de cierre | solo mediante funciones: el admin todas, el usuario las suyas |
| Límite | constante en `privado.max_dispositivos()` (1) | migración | trigger |

Sin tablas nuevas.

## 3. Cambios de esquema (migración 010, con su `_down`)

- Trigger `after insert on auth.sessions`: si el usuario no es admin, **borra todas sus demás sesiones** (se queda solo
  la nueva). Decisión del titular (27-11-2026): 1 dispositivo, entra el último.
- `public.mi_sesion_vigente()`: ¿sigue existiendo la sesión de este token? (la usa la app para salir si la han cerrado).
- `public.dispositivos_de(uid)` y `public.cerrar_dispositivos_de(uid)`: solo admin con aal2.
- Las tres son `security definer` (leen `auth`), con `search_path = ''`, comprobación de `auth.uid()` / `es_admin()`
  dentro y `execute` revocado a `anon`.

## 4. Permisos

- Nadie lee `auth.sessions` directamente. La IP no se muestra (solo el navegador y las fechas).
- Un usuario solo ve y cierra sus sesiones. Solo un admin con verificación en dos pasos ve y cierra las de otros.

## 5. Casos límite

- Dispositivo expulsado: su token de acceso sigue valiendo hasta 1 h. La app ya comprueba la cuenta cada 2 min; se
  añade la comprobación de que **su sesión sigue existiendo** (`session_id` del token) y, si no, sale con el aviso
  "Has iniciado sesión en otro dispositivo".
- "Cerrar sesión" hoy cierra **todas** las sesiones del usuario (es el modo por defecto de Supabase). Pasa a cerrar solo
  la de ese dispositivo.
- Sin conexión: el dispositivo expulsado sigue con lo guardado hasta que vuelve a conectarse (aceptable).
- Admin que se quita a sí mismo el rol: a partir de ahí cuenta el límite.

## 6. Criterios de aceptación

1. Usuario normal con sesión en el dispositivo A inicia sesión en B → A sale en ≤ 2 min con el aviso "Has iniciado
   sesión en otro dispositivo" y queda en la pantalla de acceso. Si vuelve a entrar en A, es B quien sale.
2. Admin: sin límite.
3. El admin ve en Usuarios el dispositivo (navegador y última actividad) de cada usuario y puede cerrar su sesión.
4. "Cerrar sesión" en un móvil no cierra los demás.
5. Pruebas SQL (S48+): trigger, que un usuario no ve ni cierra sesiones ajenas, que sin aal2 no se usan las funciones de admin.

## 7. Fuera de alcance

Huella de hardware, límite distinto por usuario (se puede añadir después con una columna en `perfiles`).

## 8. Decisiones (27-11-2026)

1. Límite: **1 dispositivo** por usuario normal.
2. **Entra el último**: el dispositivo anterior queda bloqueado (fuera de la sesión) hasta que vuelva a iniciar sesión,
   y entonces es el otro el que sale.

# Spec 007 · Límite de dispositivos por usuario

Estado: **borrador, pendiente de aprobación**

## 1. Objetivo

- Que una cuenta (sobre todo una de pago) no se pueda compartir entre muchas personas.
- Cada usuario normal puede tener la sesión abierta en **2 dispositivos** a la vez. Los administradores, sin límite.
- El admin ve los dispositivos de cada usuario y puede cerrar uno o todos. El usuario ve los suyos y puede cerrar los que no use.
- **No es** un bloqueo por hardware: "dispositivo" = sesión iniciada (la web y el APK del mismo móvil cuentan como 2).

## 2. Datos afectados

| Dato | Dónde | Quién escribe | Quién lee |
|---|---|---|---|
| Sesiones | `auth.sessions` (de Supabase Auth) | Supabase Auth al iniciar o cerrar sesión; el trigger nuevo; las funciones de cierre | solo mediante funciones: el admin todas, el usuario las suyas |
| Límite | constante en `privado.max_dispositivos()` (2) | migración | trigger |

Sin tablas nuevas.

## 3. Cambios de esquema (migración 010, con su `_down`)

- Trigger `after insert on auth.sessions`: si el usuario no es admin y tiene más de 2 sesiones, **borra las más antiguas**
  (por última actividad) hasta quedarse en 2. Se elige "cierra el más antiguo" frente a "bloquea el nuevo" para que
  nadie se quede fuera si pierde el móvil: el dispositivo nuevo siempre entra.
- `public.mis_dispositivos()`: sesiones del usuario (id, creada, última actividad, navegador resumido, ¿es esta?).
- `public.cerrar_dispositivo(id)`: el usuario cierra una de las suyas (no la actual).
- `public.dispositivos_de(uid)` y `public.cerrar_dispositivos_de(uid, id null = todas)`: solo admin con aal2.
- Las cuatro son `security definer` (leen `auth`), con `search_path = ''`, comprobación de `auth.uid()` / `es_admin()`
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

1. Usuario normal inicia sesión en un 3.er dispositivo → el más antiguo sale en ≤ 2 min con el aviso; los otros 2 siguen.
2. Admin: sin límite.
3. Mi cuenta muestra mis dispositivos y puedo cerrar otro; el admin ve y cierra los de cualquiera desde Usuarios.
4. "Cerrar sesión" en un móvil no cierra los demás.
5. Pruebas SQL (S48+): trigger, que un usuario no ve ni cierra sesiones ajenas, que sin aal2 no se usan las funciones de admin.

## 7. Fuera de alcance

Huella de hardware, límite distinto por usuario (se puede añadir después con una columna en `perfiles`).

## 8. Preguntas abiertas

1. ¿2 dispositivos te parece bien, o prefieres 1 o 3?
2. ¿"Cierra el más antiguo" (recomendado) o "bloquea el nuevo hasta que cierres otro"?

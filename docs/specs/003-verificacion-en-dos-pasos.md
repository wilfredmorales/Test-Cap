# Spec 003 · Verificación en dos pasos (auditoría H2)

Estado: **implementada (fases A y B, 25-11-2026)** · solo administradores · botón para quitarla a otro usuario

## Objetivo

Que robar la contraseña de un administrador no baste para usar el panel de administración.
Verificación con app de autenticación (TOTP: Google Authenticator, Microsoft Authenticator, Aegis…).

**No es**: obligar a los usuarios normales (la pueden activar si quieren); SMS.

## Fases (el orden evita dejar al admin fuera)

- **A · App** (sin cambios de permisos):
  - Mi cuenta → activar/desactivar la verificación. Como el móvil no puede escanear su propia
    pantalla, se ofrece abrir la app de autenticación con un enlace y la clave para copiarla.
  - Al iniciar sesión (o al abrir la app con sesión guardada), si la cuenta tiene verificación,
    se pide el código de 6 dígitos antes de entrar.
  - El panel de administración avisa si la sesión no está verificada.
- **B · Servidor** (solo cuando el admin confirma que la tiene activa y funciona):
  - `privado.es_admin()` exige `aal2` en el JWT (migración 006).
  - Las Edge Functions `admin-usuarios` y `publicar-banco` rechazan sesiones `aal1`.
  - La app bloquea el panel con un mensaje que lleva a Mi cuenta.

## Casos límite

- Factor a medio activar (se cerró la app): se borra antes de empezar otro.
- Código caducado o erróneo: mensaje claro; se puede reintentar.
- Móvil perdido: la cuenta sigue funcionando para hacer tests; el panel no. Recuperación:
  otro admin, o borrar el factor desde Supabase (`auth.mfa_factors`). Guardar la clave al activarla.
- Desactivar la verificación exige una sesión ya verificada (lo impone Supabase).

## Criterios de aceptación

1. Activar: enlace/clave → código → "Verificación activada"; `auth.mfa_factors` tiene 1 factor `verified`.
2. Cerrar sesión y entrar: pide el código; sin él no se entra.
3. Fase B: con sesión `aal1`, `estadisticas_admin()` falla y las funciones devuelven 403;
   con `aal2`, todo funciona. Batería `seguridad_rls.sql` adaptada y en verde.

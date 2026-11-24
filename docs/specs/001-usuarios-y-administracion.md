# Spec 001 · Usuarios, roles y administración

Estado: **aprobada · hitos 1 y 2 implementados (diseño, cuentas, roles, panel de administración, historial)**

## 1. Objetivo

- Cada persona entra con su cuenta (correo + contraseña) y puede recuperar la contraseña.
- Dos roles:
  - **Usuario**: hace tests y ve su historial.
  - **Administrador**: además gestiona usuarios y publica nuevas versiones del banco de preguntas.
- El banco se actualiza desde la propia app (el administrador sube el ZIP oficial) y llega a todos los
  dispositivos sin pasar por GitHub.
- Rediseño visual con aspecto profesional.

**No es**: un sistema de pagos, ni ocultar las preguntas (el banco es público del Ministerio).
Las cuentas sirven para controlar quién usa la app y guardar su progreso.

## Riesgo principal

Hoy la app es estática. **Usuario/clave y roles no se pueden hacer de forma segura sin servidor**:
cualquier control hecho solo en el móvil se salta. Propuesta: **Supabase** (autenticación, base de
datos y almacenamiento). Tu organización ya tiene 2 proyectos (Caja_Carlos, Finanzas_Wilfred);
el plan gratuito permite 2 proyectos activos, así que un proyecto nuevo exige pausar uno o pasar a
plan de pago. **No mezclar** esta app con los proyectos de finanzas: compartirían usuarios y datos.

## 2. Datos afectados

| Tabla / recurso | Contenido | Lee | Escribe |
|---|---|---|---|
| `auth.users` (Supabase) | correo, contraseña cifrada | Supabase | Supabase / función admin |
| `perfiles` | id, nombre, rol, activo, creado | el propio usuario; admin todos | usuario: solo su nombre; admin: rol y activo |
| `banco_versiones` | versión, fecha fuente, total, ruta del archivo, activa, subida por, fecha | usuarios autenticados | admin |
| Storage `banco/` | `banco-<version>.json` | usuarios autenticados | admin |
| `resultados` | usuario, tipo (mercancías/viajeros), modo, nº preguntas, correctas, falladas, en blanco, puntos, %, aprobado, fecha | el propio usuario; admin todos | el propio usuario (solo insertar) |

## 3. Cambios de esquema

- Migración `001_usuarios.sql`: tablas `perfiles`, `banco_versiones`, `resultados`, trigger que crea
  el perfil al registrarse (rol `usuario`), bucket `banco`.
- Reversión: `001_usuarios_down.sql` que borra tablas, trigger y bucket.
- Primer administrador: tu cuenta, asignada con una migración aparte (`002_primer_admin.sql`).

## 4. Permisos (RLS)

- `perfiles`: SELECT propio o si eres admin. UPDATE de `nombre` solo el propio; `rol` y `activo` solo
  admin (un trigger impide que un usuario cambie su propio rol).
- `banco_versiones`: SELECT autenticados; INSERT/UPDATE solo admin.
- `resultados`: INSERT/SELECT propios; SELECT de todos solo admin. Nadie edita ni borra resultados.
- Storage `banco`: lectura autenticados, escritura admin.
- Crear, desactivar o borrar cuentas usa la clave de servicio → **función de servidor** (Edge Function
  `admin-usuarios`) que comprueba que quien llama es admin. La clave de servicio nunca va en la app.
- Usuario desactivado: no puede entrar (bloqueo en Supabase Auth) aunque tenga la app instalada.

## 5. Casos límite

- Sin conexión: con sesión ya iniciada, los tests funcionan con el banco guardado; los resultados se
  guardan en cola y se envían al volver la conexión. Primer inicio de sesión: necesita conexión.
- Correo ya registrado → mensaje claro, sin revelar si la cuenta existe en la recuperación.
- ZIP mal leído (pregunta sin 4 opciones o sin respuesta) → no se publica; se muestra el motivo.
- El admin publica una versión errónea → puede reactivar la anterior.
- Último administrador intenta quitarse el rol o desactivarse → se impide.
- Correos de recuperación: el envío por defecto de Supabase tiene un límite muy bajo por hora; para
  uso real hace falta configurar un SMTP propio.

## 6. Criterios de aceptación

1. Registro, inicio de sesión, cierre de sesión y recuperación por correo funcionan en navegador y APK.
2. Un usuario normal no ve el panel de administración ni puede llamar a sus funciones (probado con
   llamadas directas a la API con su sesión: deben fallar).
3. El admin puede: listar usuarios, buscar, cambiar rol, desactivar/activar, enviar recuperación,
   crear usuario por invitación.
4. El admin sube el ZIP; la app valida las 8.655 preguntas, publica la versión y otro dispositivo la
   recibe con "Actualizar" mostrando el resumen de cambios.
5. El admin reactiva una versión anterior y los dispositivos vuelven a ella.
6. Cada test terminado aparece en el historial del usuario y en las estadísticas del admin.
7. `get_advisors` de Supabase sin avisos de seguridad tras la migración.
8. Diseño revisado en móvil y escritorio, modo claro y oscuro, sin desbordes.

## 7. Hitos (cada uno se entrega probado)

1. Rediseño profesional (sin cambios de datos).
2. Proyecto Supabase + migración + registro / inicio de sesión / recuperación.
3. Panel de administración de usuarios.
4. Banco de preguntas en Supabase con versiones y publicación desde la app.
5. Historial de resultados y estadísticas.

Fuera de alcance: pagos, grupos/academias, app nativa de iPhone, notificaciones push.

## 8. Decisiones (respuestas de la persona)

- Registro libre para cualquiera. Inicio de sesión con correo.
- Miles de usuarios a la vez: tiene que aguantar carga.
- Se planteó guardar las cuentas solo en el dispositivo: **descartado**, ver abajo.

### Por qué no cuentas guardadas solo en el dispositivo

- El administrador no podría ver ni gestionar usuarios de otros móviles.
- La recuperación por correo necesita un servidor que envíe el correo.
- La cuenta no existiría en otro dispositivo ni sobreviviría a borrar la app.
- La contraseña y el rol se podrían cambiar editando el almacenamiento del móvil.

### Ajustes por la escala (miles de usuarios)

- El banco (3,7 MB; 0,7 MB comprimido) se sirve desde GitHub Pages (CDN), no desde Supabase, para no
  gastar el tráfico de Supabase: 5.000 descargas serían unos 3,4 GB.
- Supabase solo para cuentas, perfiles, versiones del banco (metadatos) y resultados.
- Registro libre a esta escala exige: confirmación de correo, CAPTCHA (Turnstile o hCaptcha)
  contra registros automáticos, límites de intentos y SMTP propio (Brevo, Resend o similar).
- Plan Supabase **Pro** recomendado: el gratuito pausa el proyecto tras una semana sin actividad y no
  tiene copias de seguridad diarias.
- Publicar banco desde la app: el ZIP validado se sube al repositorio (Edge Function con token de
  GitHub) y GitHub Pages lo sirve; queda un registro de cada versión en `banco_versiones`.

## 9. Preguntas abiertas

1. ¿Plan Supabase Pro (unos 25 $/mes) para un proyecto nuevo `Test-CAP`?
2. ¿Qué servicio de correo usamos (hace falta una cuenta y un dominio para el remitente)?

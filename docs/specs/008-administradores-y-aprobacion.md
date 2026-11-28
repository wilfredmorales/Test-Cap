# Spec 008 · Administradores con equipo propio y aprobación de altas

Estado: **borrador, pendiente de aprobación**

## 1. Objetivo

- **Principal** (testcap.app.sup@gmail.com y wilfredmoralesrivas@gmail.com): lo ve todo, crea y quita administradores,
  aprueba o rechaza altas, publica el banco. Ve los totales de usuarios por administrador.
- **Administrador**: ve su cuenta y **solo los usuarios que él invitó**; los invita, les da o quita acceso, los desactiva
  y les cierra la sesión. Máximo **10 altas pendientes** de aprobar a la vez.
- **Altas**: el usuario nuevo usa la app desde el primer momento, pero queda **pendiente**. El principal lo **aprueba**,
  lo **suspende** (no entra hasta que se reactive) o lo **da de baja** (se elimina la cuenta).
- **Aviso**: bandeja "Altas pendientes (N)" en el panel del principal. Sin correo por ahora.
- Registro: **las dos vías**. Invitación (pertenece al admin que invita) y registro libre desde la app (sin admin: lo
  gestiona el principal, también pendiente).
- **No es**: mensajería entre administradores. La comunicación queda en dos notas por alta (la del admin al invitar y
  la del principal al revisar).

## 2. Datos afectados

| Dato | Dónde | Escribe | Lee |
|---|---|---|---|
| Rol `principal` | `perfiles.rol` (valor nuevo) | solo SQL / migración | — |
| Quién invitó | `perfiles.invitado_por` | función `admin-usuarios` al invitar | principal; ese admin |
| Aprobación | `perfiles.aprobacion` (`pendiente`/`aprobado`/`rechazado`), `revisado_por`, `revisado_en`, `nota_alta`, `nota_revision` | trigger de alta; principal | principal; admin que invitó (solo lectura) |
| Usuarios, resultados, accesos, sesiones | tablas actuales | igual que hoy, pero el admin solo sobre los suyos | principal todo; admin lo suyo |

## 3. Cambios de esquema (migración 011, con `_down`)

- `rol_usuario` + valor `principal`. `privado.es_principal()` (aal2). `privado.es_admin()` incluye al principal.
- `privado.administra(uid)`: principal, o admin y `perfiles.invitado_por = auth.uid()`.
- Columnas nuevas en `perfiles` (arriba). Altas nuevas → `pendiente`; las que crea el principal → `aprobado`.
- Datos existentes: testcap.app.sup y wilfredmoralesrivas → `principal`; katty… → `admin`; ethan… → del principal,
  `aprobado`. Todas las cuentas actuales quedan `aprobado`.
- "Siempre un admin" pasa a "siempre un **principal** activo".

## 4. Permisos (RLS y funciones)

- `perfiles`, `resultados`, `compras`, `dispositivos_de`, `cerrar_dispositivos_de`, `estadisticas_admin`: el admin
  solo ve y toca filas de usuarios que `administra()`; el principal, todas.
- `admin-usuarios`: cada acción comprueba `administra(objetivo)`. Cambiar roles, aprobar, suspender y dar de baja de
  cualquier usuario: **solo principal**. Invitar: comprueba el tope de 10 pendientes del admin.
- Publicar o restaurar el banco: solo principal.
- Nadie puede ponerse ni quitarse el rol `principal` desde la app.

## 5. Casos límite

- Admin que pierde el rol: sus usuarios pasan al principal (no se quedan sin gestor).
- Usuario invitado por un admin que luego es eliminado: `invitado_por` pasa a nulo (del principal).
- Rechazar: suspensión (cuenta desactivada y expulsada en ≤ 2 min, reactivable) o baja (borrado definitivo).
- Tope: el 11.º intento de invitar con 10 pendientes da error claro; las invitaciones del principal no cuentan.
- Un admin no puede ver ni adivinar usuarios ajenos (la búsqueda solo devuelve los suyos).

## 6. Criterios de aceptación

1. Admin A ve solo a sus invitados; admin B no ve los de A (prueba SQL y en la app).
2. El principal ve "Altas pendientes (N)" con correo, ID, quién invitó, fecha y nota; aprueba, suspende o da de baja.
3. Suspendido: sale de la app y no entra; reactivado: vuelve a entrar.
4. El panel del principal muestra por cada admin: usuarios totales, pendientes y conectados ahora (actividad < 15 min).
5. Tope de 10 pendientes por admin.
6. Pruebas SQL (S58+) para cada permiso; las 58 actuales siguen pasando.

## 7. Fuera de alcance

Aviso por correo (se puede añadir después con una contraseña de aplicación de Gmail), mensajería, varios niveles de admin.

## 8. Preguntas abiertas

1. ¿katty… debe ser administradora secundaria o usuaria normal?
2. ¿Un administrador secundario puede **eliminar** a sus usuarios, o solo desactivarlos (y eliminar queda para el principal)?

# Spec 008 · Administradores con equipo propio, altas solo por invitación

Estado: **ajustada por el titular (28-11-2026), pendiente de aprobación final**

## 1. Objetivo

- **Principal** (testcap.app.sup@gmail.com y wilfredmoralesrivas@gmail.com): lo ve todo, crea y quita administradores,
  revisa todas las altas (las deja, las suspende o las da de baja) y publica el banco. Ve por cada administrador:
  usuarios totales, en prueba, con acceso y conectados ahora. **Verificación en dos pasos obligatoria.**
- **Administrador secundario**: ve su cuenta y **solo los usuarios que él invitó**. Los invita (máximo **10 en prueba**
  a la vez), les **da acceso completo** (eso es aprobarlos), se lo quita, los desactiva y les cierra la sesión.
  **No puede eliminar** cuentas. **Sin verificación en dos pasos** (decisión del titular).
- **Altas solo por invitación** (de un secundario o de un principal). Se quita "Crear cuenta" de la app y se cierra
  el registro en Supabase.
- **Ciclo del usuario**: invitado → **versión de prueba** (231 preguntas) → su administrador le **da acceso** →
  uso completo. En paralelo, el principal ve cada alta en su bandeja y puede **suspenderla** (no entra hasta que se
  reactive) o **darla de baja** (se elimina) si no se la han comunicado.
- **No es**: mensajería. La comunicación queda en dos notas por alta (la del admin al invitar, la del principal al revisar).

## 2. Datos afectados

| Dato | Dónde | Escribe | Lee |
|---|---|---|---|
| Rol `principal` | `perfiles.rol` (valor nuevo) | solo SQL / migración | — |
| Quién invitó | `perfiles.invitado_por` | función `admin-usuarios` al invitar | principal; ese admin |
| Revisión del principal | `perfiles.revision` (`pendiente`/`revisada`), `revisado_por`, `revisado_en`, `nota_alta`, `nota_revision` | alta: función; revisión: principal | principal; admin que invitó (lectura) |
| Accesos (compras) | tabla actual | admin solo para sus usuarios; principal para todos | igual |

## 3. Cambios de esquema (migración 011, con `_down`)

- `rol_usuario` + valor `principal`. `privado.es_principal()` exige aal2. `privado.es_admin()` pasa a ser
  "admin secundario activo (sin exigir aal2) o principal con aal2".
- `privado.administra(uid)`: principal, o admin con `perfiles.invitado_por = auth.uid()`.
- Columnas nuevas en `perfiles` (arriba).
- Datos actuales: testcap.app.sup y wilfredmoralesrivas → `principal`; katty… y ethan… → `usuario`, gestionados por
  el principal, `revisada`.
- "Siempre un admin" pasa a "siempre un **principal** activo".

## 4. Permisos

- `perfiles`, `resultados`, `compras`, `dispositivos_de`, `cerrar_dispositivos_de`, `estadisticas_admin`: el admin solo
  ve y toca usuarios que `administra()`; el principal, todos.
- `admin-usuarios`: cada acción comprueba `administra(objetivo)`. Solo principal: cambiar roles, eliminar, revisar,
  suspender cualquier cuenta, quitar la verificación en dos pasos. Invitar: comprueba el tope de 10 en prueba.
- Publicar o restaurar el banco: solo principal.
- Supabase Auth: **"Allow new users to sign up" desactivado** (las invitaciones siguen funcionando).

## 5. Casos límite

- Admin que pierde el rol o se elimina: sus usuarios pasan al principal.
- Suspender = desactivar + expulsar en ≤ 2 min; reactivable. Dar de baja = borrado definitivo (solo principal).
- Tope: con 10 invitados sin acceso, el admin no puede invitar más hasta dar acceso o desactivar alguno.
- Un admin no puede ver ni buscar usuarios ajenos.
- Riesgo aceptado: sin verificación en dos pasos, quien robe la contraseña de un admin secundario controla a **sus**
  usuarios (no a los demás ni el banco).

## 6. Criterios de aceptación

1. Admin A ve solo a sus invitados; B no ve los de A; ninguno ve el panel del principal (pruebas SQL y en la app).
2. Invitado nuevo entra en versión de prueba; su admin le da acceso → banco completo.
3. El principal ve "Altas nuevas (N)" con correo, ID, quién invitó, fecha y nota; marca revisada, suspende o da de baja.
4. Panel del principal: por admin, usuarios totales, en prueba, con acceso y conectados ahora (actividad < 15 min).
5. Sin "Crear cuenta" en la app y registro cerrado en Supabase; la invitación funciona.
6. Pruebas SQL (S58+) para cada permiso; las 58 actuales siguen pasando.

## 7. Fuera de alcance

Aviso por correo, mensajería, más niveles de administración.

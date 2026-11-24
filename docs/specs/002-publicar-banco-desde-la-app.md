# Spec 002 · Publicar el banco desde la app (etapa 4 de la spec 001)

Estado: **implementada · falta el token de GitHub**

## Objetivo

El administrador sube el ZIP oficial desde el panel; la app lo valida, muestra qué cambia y, al
confirmar, lo publica para todos. Se puede volver a una versión anterior.

**No es**: editar preguntas a mano.

## Diseño

- El banco sigue sirviéndose desde GitHub Pages (gratis, CDN). Supabase no sirve el banco (tráfico).
- Función `publicar-banco` (solo admin activo):
  - `publicar`: recibe el ZIP validado y hace **un solo commit** en `fuentes/` con el ZIP y
    `fuentes/ACTIVO.txt` (nombre del ZIP activo). Registra la versión en `banco_versiones`.
  - `activar`: vuelve a una versión anterior cambiando solo `ACTIVO.txt`.
  - `comprobar`: mira `data/version.json` publicado; marca la versión como `publicada` cuando
    coincide, o `fallida` si pasan 15 minutos.
- La tarea `Actualizar banco de preguntas` regenera `data/` con el ZIP de `ACTIVO.txt`, **vuelve a
  validar** (falla si alguna pregunta está mal) y publica la web.
- Acceso a GitHub: token de acceso personal *fine-grained*, solo para este repositorio, permiso
  *Contents: read and write*. Se guarda como secreto `GITHUB_TOKEN_BANCO` en Supabase; la app
  nunca lo ve.

## Datos

`banco_versiones`: id, version, archivo, fecha_fuente, total, cambios (jsonb), estado
(`publicando` | `publicada` | `fallida`), mensaje, publicada_por, creado, actualizado.
- Lectura: solo admin (RLS). Escritura: solo la función (clave de servicio).
- Reversión: `drop table banco_versiones`.

## Protecciones

1. Validación doble: en la app antes de subir y en la tarea de GitHub antes de publicar.
2. Cambios grandes (más del 10 % de preguntas eliminadas o con respuesta cambiada) piden una
   segunda confirmación escribiendo PUBLICAR.
3. No se publica una versión idéntica a la activa.
4. Tamaño máximo del ZIP: 5 MB.
5. Una sola publicación a la vez (si hay una `publicando` reciente, se rechaza otra).

## Criterios de aceptación

1. Un usuario normal no puede llamar a la función ni leer `banco_versiones` (probado).
2. Validar un ZIP muestra total y cambios sin alterar el banco del dispositivo.
3. Publicar crea un commit con el ZIP y `ACTIVO.txt`; en minutos la versión pasa a `publicada` y otro
   dispositivo la recibe con "Actualizar".
4. "Volver a esta versión" restaura una anterior por el mismo camino.
5. Un ZIP con errores no llega a publicarse.

## Pendiente de la persona

Crear el token de GitHub y guardarlo en Supabase (instrucciones en la entrega).

# Pruebas de seguridad manuales (Auth, Edge Functions, API)

Hazlas con cuentas de prueba, nunca con datos reales. Variables:

```bash
URL=https://bzalfptgfqsoalqgsklr.supabase.co
ANON=<clave anon del proyecto>          # pública, está en app.js
# Token de un usuario normal de prueba (iniciar sesión por la API):
TOKEN_A=$(curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" \
  -H 'Content-Type: application/json' -d '{"email":"usuario-a@test.local","password":"<clave>"}' | jq -r .access_token)
```

| ID | Prueba | Comando | Resultado esperado |
|---|---|---|---|
| E01 | Función de usuarios sin sesión | `curl -s -X POST $URL/functions/v1/admin-usuarios -H "apikey: $ANON" -d '{}'` | 401 |
| E02 | Función de usuarios con usuario normal | `curl -s -X POST $URL/functions/v1/admin-usuarios -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_A" -d '{"accion":"rol","id":"<uuid-A>","rol":"admin"}'` | 403 "Solo administradores" |
| E03 | Publicar banco con usuario normal | igual con `publicar-banco` y `{"accion":"publicar"}` | 403 |
| E04 | Publicar con ZIP falso (admin) | `{"accion":"publicar","zip":"QUFB","version":"aaaaaaaaaaaa","total":200}` | 400 "El archivo no es un ZIP" |
| E05 | Volver a versión inexistente (admin) | `{"accion":"activar","id":999999}` | 400 |
| E06 | Método no permitido | `curl -s -X GET $URL/functions/v1/admin-usuarios -H "Authorization: Bearer $TOKEN_A"` | 405 |
| A01 | Leer perfiles ajenos por la API | `curl -s "$URL/rest/v1/perfiles?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_A"` | Solo 1 fila (la propia) |
| A02 | Hacerse admin por la API | `curl -s -X PATCH "$URL/rest/v1/perfiles?id=eq.<uuid-A>" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' -d '{"rol":"admin"}'` | Error "Solo un administrador…" |
| A03 | Anónimo lee resultados | `curl -s "$URL/rest/v1/resultados?select=*" -H "apikey: $ANON"` | 401/permiso denegado |
| A04 | Insertar resultado con fecha falsa | POST a `resultados` con `"creado":"2020-01-01"` | Tras parche 01: permiso denegado |
| U01 | Enumeración en recuperación | Pedir recuperación de un correo que existe y de otro que no | Mismo mensaje en la app |
| U02 | Registro con correo ya registrado | `POST /auth/v1/signup` con un correo existente | Respuesta sin sesión e igual que un alta nueva |
| U03 | Enlace de recuperación reutilizado | Abrir dos veces el mismo enlace | La segunda vez: "enlace caducado o ya usado" |
| U04 | Contraseña débil por API | `POST /auth/v1/signup` con `"password":"123456"` | Tras H6: rechazada |
| U05 | Cuenta desactivada | Desactivar desde el panel e intentar entrar | "Cuenta desactivada"; el token renovado falla |
| U06 | CAPTCHA | `POST /auth/v1/signup` sin `captcha_token` | Tras H3: 400 |
| U07 | Cerrar sesión | Cerrar sesión y reutilizar el refresh token antiguo | 400/401 |

Base de datos: `supabase/tests/seguridad_rls.sql` (automática, se deshace sola).

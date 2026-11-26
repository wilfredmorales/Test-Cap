# Auditoría de seguridad · Test CAP · 25-11-2026

Alcance: app web/PWA y APK (`index.html`, `app.js`, `sw.js`), Supabase `Test-CAP`
(Auth, PostgreSQL, Storage, Edge Functions `admin-usuarios` y `publicar-banco`), repositorio
`wilfredmorales/Test-Cap` (Actions, Pages) y token de GitHub usado para publicar el banco.

Método: inventario SQL de solo lectura, 30 pruebas RLS con usuarios sintéticos dentro de
transacciones que se deshacen, revisión de código y de historial git (31 commits), prueba de
navegador con CSP. No se modificó producción.

Leyenda de evidencia: **[V]** verificado · **[P]** inferencia probable · **[E]** especulación.

## 1. Resumen ejecutivo

No hay vulnerabilidades críticas. Las reglas de acceso de la base de datos resisten todos los
ataques probados (27 de 30 pruebas; las 3 que fallan son H5 y H7). Los riesgos principales están
**fuera de la base de datos**: la cadena de compilación y las cuentas de administrador sin MFA.

| ID | Sev. | Componente | Ataque | Impacto | Estado | Corrección |
|---|---|---|---|---|---|---|
| H1 | **Alta** | Actions `apk-android.yml` | Dependencia npm/pip comprometida ejecuta código con permiso de escritura | Código malicioso servido a todos los usuarios (robo de sesiones, incluida la del admin) | **Corregido 25-11** | Workflow nuevo (2 jobs) |
| H2 | **Alta** | Auth / rol admin | Phishing o reutilización de contraseña del admin | Control total: usuarios, correos, banco con respuestas falsas | **Corregido 25-11** (fase B) | Migración 006 + funciones + app |
| H3 | Media | Auth (registro y recuperación abiertos) | Altas y peticiones de correo masivas | Agotar el cupo de correos: nadie confirma ni recupera; cuentas basura | Abierto | CAPTCHA + SMTP propio + límites |
| H4 | Media | APK | APK de depuración con firma distinta en cada compilación | Sesión extraíble con acceso físico/USB; no se puede verificar autenticidad ni actualizar | **Corregido 25-11** (firma `CN=Test CAP`, SHA-256 `b39e23ef…2a39`) | Secretos ANDROID_* |
| H5 | Media | PostgreSQL (permisos por defecto) | Crear una tabla nueva sin RLS | La tabla queda legible y escribible por cualquiera con la clave pública | **Corregido 25-11** | Migración 005 |
| H6 | Media | Auth (contraseñas) | Registro directo por API saltando la validación de la app; contraseñas filtradas | Contraseñas débiles o ya filtradas | Abierto | Configuración de Auth |
| H7 | Baja | Tabla `resultados` | Insertar resultados propios inventados (nota, fecha) | Historial y estadísticas del admin manipulables | **Mitigado 25-11** (fecha, rangos, 300/día) | Migración 005 |
| H8 | Baja | Frontend | Sin CSP; sesión en `localStorage` | Si aparece un XSS, robo de la sesión | **Corregido 25-11** | CSP en `index.html` |
| H9 | Baja | Edge Functions | Provocar errores 500 | Mensajes internos devueltos al cliente (solo admins) | **Corregido 25-11** | `errorInterno()` en ambas funciones |
| H10 | Info | Auth (ajustes no visibles) | Cambio de contraseña con sesión robada | Persistencia tras robo de sesión | Sin verificar | Checklist §5 |

No aplica: OAuth/inicio de sesión con GitHub y webhooks (no existen) [V]; Storage (sin buckets) [V];
GraphQL (extensión no instalada) [V]; CSRF (autenticación por cabecera Bearer, sin cookies) [V].

## 2. Reconocimiento

- **Stack** [V]: HTML/JS sin framework, `supabase-js` 2.45.4 y JSZip 3.10.1 incluidos en `vendor/`;
  Supabase (eu-west-1); GitHub Pages (modo rama); Capacitor 6.1.2 para Android; 2 Edge Functions.
- **Roles y capacidades** [V]:
  - *Sin cuenta*: ve la pantalla de acceso, el banco público (`data/*.json`) y el APK. Puede
    registrarse, iniciar sesión, pedir recuperación y reenvío de confirmación.
  - *Usuario*: lee su perfil, edita su nombre, inserta y lee sus resultados.
  - *Admin*: lee todos los perfiles (incluidos correos) y resultados; mediante funciones:
    rol, activar/desactivar (con bloqueo en Auth), eliminar, invitar, publicar o restaurar banco.
- **Datos sensibles**: correos y nombres (PII), resultados, `GITHUB_TOKEN_BANCO` (secreto en Supabase).
- **Secretos** [V]: en 31 commits solo aparece la clave `anon` (rol `anon`, pública por diseño).
  Ninguna `service_role`, token de GitHub, `.env`, clave privada ni keystore. Sin correo ni UUID
  del administrador en el repositorio.
- **Cabeceras**: GitHub Pages sirve HTTPS; no permite CSP ni `frame-ancestors` por cabecera [P].

## 3. Base de datos (inventario y pruebas)

| Tabla | RLS | Grants anon | Grants authenticated | Políticas |
|---|---|---|---|---|
| `perfiles` | Sí | ninguno | SELECT; UPDATE(nombre, rol, activo, ultimo_acceso) | ver/editar: propio o admin (+ trigger que impide cambiar rol/activo sin ser admin y dejar 0 admins) |
| `resultados` | Sí | ninguno | SELECT, INSERT (todas las columnas) | ver: propio o admin; crear: `user_id = auth.uid()` y perfil activo |
| `banco_versiones` | Sí | ninguno | SELECT | ver: solo admin; escritura solo con `service_role` |

Funciones [V]: `privado.es_admin` (DEFINER, `search_path=''`, esquema no expuesto por la API);
`privado.crear_perfil` y `privado.sincronizar_email` (DEFINER, solo como trigger);
`privado.proteger_perfil` (INVOKER); `public.estadisticas_admin` (INVOKER, falla si no es admin).
Las políticas usan `auth.uid()`; ninguna confía en `user_metadata` ni en datos del cliente.

Resultado de `supabase/tests/seguridad_rls.sql` [V]: **27 PASA, 3 FALLA** (S20, S21 → H7; S30 → H5).
Con el parche 01 aplicado dentro de la transacción: **31 PASA, 0 FALLA**, incluido el insert
normal de la app (compatibilidad).

Pruebas destacadas superadas: metadatos `{"rol":"admin"}` al registrarse no dan rol (S01);
anónimo no lee ni escribe nada (S02–S06); usuario no ve ni toca filas ajenas (S07–S16),
no se hace admin (S11), no cambia su id ni su email (S12–S13), no inserta como otro (S14),
no llama a RPC de admin (S17); desactivado no guarda ni se reactiva (S22–S23); admin no borra
perfiles ni altera resultados por API (S25–S26); no se puede quedar el sistema sin admin (S27–S28).

## 4. Hallazgos en detalle

### H1 · Alta · Cadena de suministro en la compilación del APK con permiso de escritura
- **Dónde**: `.github/workflows/apk-android.yml` (permiso `contents: write` para todo el job).
- **Evidencia** [V]: el job ejecuta `npm install` sin `package-lock.json` y con scripts de instalación
  activos, más `pip install pillow` y Gradle, con el `GITHUB_TOKEN` de escritura guardado en
  `.git/config` por `actions/checkout`.
- **Ataque**: 1) una dependencia transitiva de Capacitor publica una versión maliciosa (ocurre en npm);
  2) su `postinstall` se ejecuta en el job; 3) usa el token para hacer push de un `app.js` modificado;
  4) GitHub Pages lo publica; 5) roba la sesión de cada usuario que abra la app, incluido el admin.
- **Probabilidad** [P]: baja. **Impacto**: total.
- **Corrección**: parche `04_apk_android.yml` (compilar sin permiso de escritura, `npm ci
  --ignore-scripts` con lockfile, `persist-credentials: false`, guardar el APK en un job aparte sin
  código de terceros). Fijar las acciones por SHA es una mejora adicional.
- **Test**: en el job `compilar`, `git push` debe fallar con 403; `npm ci` debe fallar si falta el lockfile.

### H2 · Alta · Administradores sin verificación en dos pasos
- **Evidencia** [V]: `auth.mfa_factors` = 0; ni la app ni las funciones comprueban `aal2`.
- **Ataque**: phishing o contraseña reutilizada del admin → acceso al panel → exportar correos de todos,
  desactivar o eliminar cuentas, publicar un banco con respuestas cambiadas (la confirmación
  "PUBLICAR" no frena a un atacante).
- **Corrección**: 1) pantalla en "Mi cuenta" para activar TOTP (`sb.auth.mfa.enroll/challenge/verify`);
  2) pedir el código al entrar si hay factor; 3) parche `02_mfa_administradores.sql` y comprobación de
  `aal` en ambas Edge Functions. **Orden obligatorio**, o el admin pierde el panel.
- **Test**: con sesión `aal1`, `estadisticas_admin()` y las funciones devuelven error; con `aal2`, funcionan.

### H3 · Media · Registro y recuperación abiertos sin protección anti-abuso
- **Evidencia**: registro libre [V]; sin CAPTCHA en la app [V]; SMTP propio no configurado [P, por lo
  hablado]. El correo integrado de Supabase tiene un límite bajo por hora para todo el proyecto [P].
- **Ataque**: un script llama a `/auth/v1/signup` o `/recover` con miles de correos → se agota el cupo →
  los usuarios reales no reciben confirmación ni recuperación; se envía spam desde tu dominio de envío.
- **Corrección**: Supabase → Authentication → Attack Protection: CAPTCHA (Cloudflare Turnstile) y
  añadir el widget a registro, inicio de sesión y recuperación; SMTP propio (Brevo/Resend) con dominio;
  revisar Rate Limits. El trigger de 300 resultados/día del parche 01 limita el abuso de la tabla.
- **Test**: llamada directa a `/auth/v1/signup` sin `captcha_token` → 400.

### H4 · Media · APK de depuración y sin firma estable
- **Evidencia** [V]: se compila con `assembleDebug`. Gradle genera una clave de depuración nueva en
  cada ejecución de CI [P], y las compilaciones debug son `debuggable` [V].
- **Impacto**: con acceso físico y depuración USB se puede leer el almacenamiento de la app (sesión);
  cada APK nuevo tiene otra firma, así que no se instala encima del anterior y nadie puede comprobar
  que un APK es tuyo.
- **Corrección**: crear una clave de publicación una vez (`keytool`), guardarla en secretos de GitHub y
  compilar `assembleRelease` firmado (parche 04).
- **Test**: `apksigner verify --print-certs` muestra siempre el mismo certificado; `aapt dump badging`
  no muestra `application-debuggable`.

### H5 · Media · Permisos por defecto abiertos en `public`
- **Evidencia** [V]: `pg_default_acl` concede `arwdDxtm` a `anon` y `authenticated` sobre tablas nuevas
  (prueba S30 falla).
- **Ataque**: una migración futura crea una tabla y olvida activar RLS → cualquiera con la clave pública
  la lee y escribe por `/rest/v1/`.
- **Corrección**: parche 01 (revocar permisos por defecto; cada tabla concede los suyos). Pasar
  `get_advisors` tras cada migración.

### H6 · Media · Contraseñas: validación solo en la app y sin protección de filtradas
- **Evidencia**: el asesor de Supabase marca *Leaked Password Protection Disabled* [V]; la regla de 8
  caracteres con letras y números solo está en `app.js` [V]; el mínimo del servidor sigue en el valor
  por defecto (6) [P].
- **Ataque**: registro directo por API con `123456` o con una contraseña de una filtración conocida.
- **Corrección**: Authentication → Providers → Email: longitud mínima 8 y requisitos de caracteres;
  activar *Prevent use of leaked passwords* (puede requerir plan Pro [P]).

### H7 · Baja · Resultados falsificables por su propio dueño
- **Evidencia** [V]: S20 y S21; el usuario puede fijar `creado` y valores fuera de rango.
- **Impacto**: solo su historial y las estadísticas globales del admin; no afecta a otros usuarios.
- **Corrección**: parche 01 (sin permiso sobre `creado`, rangos, límite diario). Verificado: 31/31.

### H8 · Baja · Sin política de seguridad de contenidos
- **Evidencia** [V]: no hay CSP; la sesión de Supabase vive en `localStorage`. No se encontró XSS: todo el
  contenido se pinta con `textContent`; `innerHTML` solo recibe SVG fijos del propio código.
- **Corrección**: parche 03 (CSP en `<meta>`), probado con el recorrido completo de la app: 0 errores.

### H9 · Baja · Errores internos devueltos por las funciones
- **Evidencia** [V]: `respuesta(500, { error: e.message })` en ambas funciones; solo alcanzable por admins.
- **Corrección**: parche 05 (mensaje genérico con referencia; detalle solo en los registros).

### H10 · Info · Ajustes de Auth que no puedo leer desde aquí
No hay herramienta para leer la configuración de Auth. **Verificado**: la confirmación de correo está
activa (registros del 24-11: `email_not_confirmed`) y el redirect usado fue el de GitHub Pages.
**Por comprobar**: lista de Redirect URLs sin comodines, *Secure email change*, *Secure password change*
(pedir sesión reciente), caducidad de OTP/enlaces (≤ 1 h), límites de intentos.

## 5. Checklist de despliegue seguro

- [x] Parche 01 aplicado como migración 005 (25-11-2026): `supabase/tests/seguridad_rls.sql` → 31 PASA, 0 FALLA.
- [ ] `get_advisors` (security) sin avisos tras cada migración.
- [x] MFA activado por el admin y fase B aplicada (25-11-2026): `es_admin()` y las dos funciones exigen `aal2`; batería 33 PASA, 0 FALLA.
- [x] Workflow del APK sustituido (25-11-2026): compilación sin escritura, `npm ci --ignore-scripts` con lockfile.
- [x] Clave de firma de publicación en los secretos ANDROID_* (H4): APK 1.1.0 firmado el 25-11-2026.
- [x] Capacitor 6.1.2 → **6.2.4** (26-11): corrige GHSA-rvm3-566m-v7fv (crítica, dentro del APK: un enlace
  a `/_capacitor_http_interceptor_` cargaba contenido remoto con el origen de la app). En Test CAP no hay
  enlaces que escriban los usuarios, así que el riesgo real era bajo, pero el arreglo es directo.
- [x] Capacitor 6.2.4 → **8.6.3** (26-11): `npm audit` sin vulnerabilidades. Node 22 y Java 21 en el workflow.
  Android 15+ dibuja la app bajo las barras del sistema: el CSS ya usaba `env(safe-area-inset-*)` y
  `SystemBars.style = DARK` deja los iconos claros sobre la cabecera azul. El workflow genera también el
  **AAB** para Play Store y numera `versionCode` (ejecución + 100).
- [ ] CAPTCHA (Turnstile) en registro, inicio de sesión y recuperación.
- [ ] SMTP propio con dominio verificado (SPF, DKIM, DMARC).
- [ ] Auth: contraseña mínima 8, contraseñas filtradas bloqueadas, Secure email/password change activos.
- [ ] Redirect URLs exactas: solo `https://wilfredmorales.github.io/Test-Cap/`.
- [x] CSP en `index.html` (25-11-2026), probada con registro, tests, verificación en dos pasos y publicación del banco: 0 bloqueos.
- [ ] Token `GITHUB_TOKEN_BANCO`: fine-grained, solo `Test-CAP`, solo *Contents: read and write*,
      con fecha de caducidad anotada.
- [ ] RGPD: aviso de privacidad y forma de borrar la propia cuenta (hoy solo puede hacerlo el admin).
- [ ] Copias de seguridad: el plan gratuito no las hace a diario.

## 6. Secretos a rotar

**Ninguno.** No se ha encontrado ningún secreto expuesto [V]. Procedimientos para cuando haga falta:
- `GITHUB_TOKEN_BANCO`: crear el nuevo en GitHub → sustituir el valor en Supabase → Edge Functions →
  Secrets → publicar o restaurar una versión de prueba → revocar el antiguo.
- Clave `anon`: es pública por diseño; solo se rotaría si cambian los JWT del proyecto (Settings → API).
- Clave `service_role`: nunca ha salido de Supabase; si se sospechara, rotarla en Settings → API
  (las Edge Functions la reciben automáticamente) y revisar los registros de Auth y de la API.

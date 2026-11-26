# Spec 005 · Captcha anti-bots (Cloudflare Turnstile)

Estado: **implementada (26-11-2026)**. Activación en Supabase: pendiente.

## Objetivo

Que un bot no pueda crear cuentas en masa ni probar contraseñas, ni agotar el cupo de correos
(30 por hora con Gmail), lo que dejaría sin confirmación a los usuarios reales.

## Diseño

- `pedirCaptcha()` (app.js) abre una ventana con Turnstile y devuelve un token de un solo uso.
  El script se carga solo cuando hace falta. Primero se hizo con hCaptcha (26-11); se cambió a
  Turnstile a petición del titular antes de activarlo en Supabase.
- Se pide en: iniciar sesión, reenviar la confirmación, crear cuenta, recuperar contraseña,
  "Enviar recuperación" del panel y "Eliminar mi cuenta".
- `mi-cuenta` reenvía el token a su comprobación de contraseña (Supabase también la exige).
- APK: el proveedor de captcha valida el nombre del sitio y no acepta `localhost`, así que el APK usa el nombre interno
  `apk.wilfredmorales.github.io` (`capacitor.config.json` → `server.hostname`). GitHub Pages no sirve
  ese subdominio, así que no choca con la web. Efecto: al instalar este APK hay que volver a
  iniciar sesión una vez.
- CSP: `challenges.cloudflare.com` en script, frame y connect.
- Política de privacidad: Cloudflare (Turnstile) como encargado.

## Orden de activación (si se invierte, nadie puede entrar)

1. Publicar la web y el APK con este cambio.
2. Supabase → Authentication → Attack Protection → Turnstile + Secret Key.
3. Si algo falla: desactivar ese interruptor (la app sigue funcionando sin captcha en el servidor).

## Criterios de aceptación

1. Cancelar el captcha no envía nada al servidor.
2. Registro, acceso, recuperación y baja envían el token (verificado con Playwright y un Turnstile simulado).
3. Con el captcha activado en Supabase, la web y el APK pueden iniciar sesión.

# Plantillas de correo en español

Dónde: **Supabase → Authentication → Emails → Templates**. Para cada plantilla:
1. Copia el **Asunto** en *Subject*.
2. Copia el bloque de código en *Message body* (borra antes lo que haya).
3. **Save**.

Reglas para no romperlas:
- No cambies nada entre `{{` y `}}`: es lo que Supabase sustituye por el enlace o el código.
- Sin imágenes ni enlaces de seguimiento: Gmail los marca como spam más a menudo.
- Después de guardar, prueba cada una (registro, recuperar contraseña, invitar) y mira que llegue
  a la bandeja de entrada y no a spam.

---

## 1. Confirm sign up (confirmar registro)

**Asunto:** `Confirma tu cuenta de Test CAP`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a2233">
  <h2 style="color:#0f2347">Bienvenido a Test CAP</h2>
  <p>Hola:</p>
  <p>Has creado una cuenta en Test CAP con el correo <strong>{{ .Email }}</strong>.
     Para activarla, pulsa el botón:</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#0f2347;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Confirmar mi cuenta</a>
  </p>
  <p style="font-size:13px;color:#5b6475">Si el botón no funciona, copia este enlace en el navegador:<br>{{ .ConfirmationURL }}</p>
  <p style="font-size:13px;color:#5b6475">Si no has sido tú, ignora este correo: sin confirmar, la cuenta no se activa.</p>
  <p style="font-size:12px;color:#8a93a3">Test CAP · testcap.app.sup@gmail.com</p>
</div>
```

## 2. Invite user (invitación)

**Asunto:** `Te han invitado a Test CAP`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a2233">
  <h2 style="color:#0f2347">Tienes una invitación a Test CAP</h2>
  <p>Hola:</p>
  <p>Te han invitado a Test CAP, la app para preparar el examen CAP de mercancías y viajeros.
     Pulsa el botón y <strong>crea tu contraseña</strong> para empezar:</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#0f2347;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Aceptar la invitación</a>
  </p>
  <p style="font-size:13px;color:#5b6475">El enlace sirve una sola vez y caduca. Si caduca, pide otra invitación.<br>
     Si el botón no funciona, copia este enlace en el navegador:<br>{{ .ConfirmationURL }}</p>
  <p style="font-size:13px;color:#5b6475">Si no esperabas esta invitación, ignora este correo.</p>
  <p style="font-size:12px;color:#8a93a3">Test CAP · testcap.app.sup@gmail.com</p>
</div>
```

## 3. Reset password (recuperar contraseña)

**Asunto:** `Cambia tu contraseña de Test CAP`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a2233">
  <h2 style="color:#0f2347">Cambio de contraseña</h2>
  <p>Hola:</p>
  <p>Hemos recibido una petición para cambiar la contraseña de la cuenta <strong>{{ .Email }}</strong>.
     Pulsa el botón para elegir una nueva:</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#0f2347;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Cambiar mi contraseña</a>
  </p>
  <p style="font-size:13px;color:#5b6475">El enlace sirve una sola vez y caduca.<br>
     Si el botón no funciona, copia este enlace en el navegador:<br>{{ .ConfirmationURL }}</p>
  <p style="font-size:13px;color:#5b6475"><strong>Si no lo has pedido tú, ignora este correo</strong>: tu contraseña no cambia.</p>
  <p style="font-size:12px;color:#8a93a3">Test CAP · testcap.app.sup@gmail.com</p>
</div>
```

## 4. Change email address (cambio de correo)

La app no permite cambiar el correo hoy, pero conviene tenerla traducida.

**Asunto:** `Confirma tu nuevo correo en Test CAP`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a2233">
  <h2 style="color:#0f2347">Confirma tu nuevo correo</h2>
  <p>Hola:</p>
  <p>Has pedido cambiar el correo de tu cuenta de Test CAP de <strong>{{ .Email }}</strong> a
     <strong>{{ .NewEmail }}</strong>. Pulsa el botón para confirmarlo:</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#0f2347;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Confirmar el cambio</a>
  </p>
  <p style="font-size:13px;color:#5b6475">Si no lo has pedido tú, ignora este correo y cambia tu contraseña.</p>
  <p style="font-size:12px;color:#8a93a3">Test CAP · testcap.app.sup@gmail.com</p>
</div>
```

## 5. Reauthentication (código de verificación)

**Asunto:** `Tu código de Test CAP`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a2233">
  <h2 style="color:#0f2347">Código de verificación</h2>
  <p>Tu código es:</p>
  <p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#0f2347">{{ .Token }}</p>
  <p style="font-size:13px;color:#5b6475">Si no lo has pedido tú, ignora este correo.</p>
  <p style="font-size:12px;color:#8a93a3">Test CAP · testcap.app.sup@gmail.com</p>
</div>
```

La plantilla **Magic link** no se usa (la app no tiene acceso sin contraseña); puedes dejarla como está.

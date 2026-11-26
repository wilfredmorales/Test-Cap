# Spec 004 · Enlaces sin correo, política de privacidad y baja de la cuenta

Estado: **implementada (26-11-2026)**

## Objetivo

1. Que el administrador pueda dar acceso a alguien aunque el servidor no pueda enviar correos
   (límite por hora o correo que no llega): **copiar un enlace** y mandarlo por otro canal.
2. Cumplir el RGPD y los requisitos de Play Store: **política de privacidad** publicada y enlazada,
   y **"Eliminar mi cuenta"** desde la propia app.

## Diseño

- `admin-usuarios`, acción `enlace` (solo admin con sesión verificada, como el resto):
  - correo sin cuenta → enlace de **invitación** (al abrirlo, crea su contraseña);
  - correo con cuenta → enlace de **cambio de contraseña**.
  - Se genera con `auth.admin.generateLink`: **no envía correo** y no gasta el cupo.
  - El enlace da acceso a la cuenta: la app avisa de mandarlo solo por un canal privado.
- Nueva función `mi-cuenta`, acción `eliminar` (cualquier usuario con sesión):
  - exige **la contraseña actual** (se comprueba en el servidor) y escribir ELIMINAR;
  - no deja eliminarse al **último administrador activo**;
  - borra la cuenta: perfil y resultados se borran en cascada; las versiones del banco que
    publicó quedan sin autor.
- `privacidad.html`: página estática (web y APK), enlazada desde registro, acceso y Mi cuenta.
  El registro exige aceptarla.

## Criterios de aceptación

1. Admin: "Copiar enlace" con un correo nuevo crea la invitación sin correo; con uno existente da
   un enlace de cambio de contraseña. Un usuario normal recibe 403.
2. Usuario: con contraseña errónea no se borra nada; con la buena se borra y la app vuelve al
   acceso. El último admin no puede borrarse.
3. La política se abre desde las tres pantallas y en el APK.

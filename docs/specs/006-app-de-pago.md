# Spec 006 · App de pago (pago único por periodo)

Estado: **aprobada (27-11-2026)** · Fase A (acceso por el admin, sin cobro) implementada · Fase B (Lemon Squeezy) pendiente del alta fiscal

## 1. Objetivo

- Quien paga tiene acceso completo durante un periodo (p. ej. 6 meses). Quien no paga puede probar con una muestra.
- El cobro lo hace Lemon Squeezy, que actúa como vendedor ante el cliente y cobra y paga el IVA.
- **No es** un bloqueo perfecto: el Ministerio publica el ZIP gratis y el historial público de GitHub ya contiene el
  banco. Lo que se vende es la app. El objetivo es que la app completa no se pueda usar gratis.

## 2. Datos afectados

| Dato | Dónde | Quién escribe | Quién lee |
|---|---|---|---|
| Compras | tabla nueva `compras` | solo la función `pago-webhook` (service_role) y el admin | el propio usuario (las suyas), admin |
| Banco completo | tabla nueva `banco_datos` (jsonb, una fila por versión) | admin con aal2 desde la app | quien tiene acceso vigente, admin |
| Muestra gratuita | columna `muestra` en `banco_datos` | admin | todos los usuarios con sesión |
| `data/` y `fuentes/` | repositorio público | se **dejan de actualizar** y se borran | — |

El flujo de publicación del banco deja de pasar por GitHub: el admin sube el ZIP en la app, la app lo convierte
(ya sabe hacerlo) y guarda banco + muestra en `banco_datos`. Desaparecen `publicar-banco`, el token de GitHub
y el workflow `actualizar-banco`.

## 3. Cambios de esquema (migración 009, con su `_down`)

- `compras(id, user_id → auth.users on delete cascade, pedido text unique, estado ('pagada'|'reembolsada'),
  hasta timestamptz, importe_cent int, moneda, creado)`. `pedido` único: un webhook repetido no duplica.
- `banco_datos(version pk, total, fecha_fuente, datos jsonb, muestra jsonb, activo bool, creado, publicado_por)`.
  Solo una fila activa (índice único parcial).
- `privado.tiene_acceso(uid)`: admin activo, o compra `pagada` con `hasta > now()`.
- Función RPC `public.mi_acceso()` (invoker): devuelve `{hasta, activo}` del usuario.

## 4. Permisos (RLS)

- `compras`: select propio; insert/update/delete solo service_role y admin (para regalar acceso a mano).
- `banco_datos.datos`: select si `tiene_acceso(auth.uid())`. `muestra`: select para `authenticated` mediante una
  vista `security_invoker` o RPC que solo devuelve `muestra`. Insert/update solo admin aal2.
- `pago-webhook`: sin JWT (lo llama Lemon Squeezy); **verifica la firma HMAC** con `LEMON_WEBHOOK_SECRET`
  y rechaza todo lo demás. El `user_id` llega en `custom_data`; se comprueba que existe.

## 5. Casos límite

- Webhook repetido o fuera de orden → `pedido` único; reembolso posterior pone `estado = reembolsada`.
- Segunda compra con acceso vigente → `hasta` se suma desde el `hasta` actual, no desde hoy.
- Pago hecho con un correo distinto al de la cuenta → vale, se enlaza por `user_id`, no por correo.
- Sin conexión → el banco guardado en el móvil sigue funcionando hasta la fecha `hasta` guardada; al
  reconectar se comprueba de nuevo.
- Acceso caducado → vuelve a la muestra; el historial y los resultados se conservan.
- Cuenta eliminada → sus compras se borran en cascada (Lemon Squeezy conserva la factura).
- Muestra: unas 200 preguntas repartidas por secciones, suficiente para un simulacro corto y práctica.

## 6. Criterios de aceptación

1. Usuario sin compra: la app usa la muestra y muestra "Desbloquear"; `select datos from banco_datos` devuelve 0 filas.
2. Webhook con firma válida → compra creada y acceso inmediato al recargar. Firma inválida → 401 y nada cambia.
3. Webhook repetido → una sola compra. Reembolso → acceso retirado.
4. Admin puede dar y quitar acceso a mano desde Usuarios.
5. Pruebas SQL nuevas en `seguridad_rls.sql` (S36+) para todo lo anterior; tests de la función con firmas reales de ejemplo.
6. Compra real de prueba en modo test de Lemon Squeezy, de principio a fin.

## 7. Fuera de alcance

Cupones, suscripciones, facturas propias, Play Store (exigiría Google Play Billing). Siguiente hito: condiciones de
venta y política de privacidad actualizadas, antes de activar el modo real.

## 8. Decisiones (27-11-2026)

1. **12 € por 6 meses**, pago único.
2. **Desistimiento**: no se puede acortar a 3 días (el mínimo legal son 14). Antes de pagar, dos casillas
   obligatorias: condiciones de compra y "pido acceder ya y acepto perder el derecho de desistimiento" (art. 103.m
   TRLGDCU). La fecha de esa aceptación viaja en `custom_data` al pedido; en la fase B se guarda en `compras`
   (columna nueva) y se confirma en el recibo de Lemon Squeezy.
3. **Aviso legal del Ministerio** (leído el 27-11): permite la reutilización comercial. Condiciones que se cumplen:
   citar "Origen de los datos: Ministerio de Transportes y Movilidad Sostenible", mostrar la fecha de la última
   actualización, no desnaturalizar la información y no insinuar que el Ministerio participa o patrocina.
4. **Alta fiscal** pendiente: hasta entonces `PAGOS_ACTIVOS = false` y el acceso lo da el admin.
5. Los administradores tienen acceso completo sin pagar.

## 9. Proveedor de pago (27-11-2026)

Lemon Squeezy ya no admite registros nuevos y cierra el 31-03-2027 (dato del titular). La fase B se diseña sin atarse
a un proveedor: la función del webhook verifica la firma del proveedor elegido y crea la compra con `pedido`,
`hasta = now() + 6 meses` y la fecha de renuncia al desistimiento. Candidatos, a decidir en febrero de 2027 con el
alta hecha: Paddle (vendedor registrado, gestiona el IVA), Stripe (más barato, el IVA/OSS lo gestiona el titular).

// Acciones de administración que necesitan la clave de servicio.
// Solo las puede ejecutar un administrador activo (se comprueba en cada llamada).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function respuesta(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

/** Error inesperado: el detalle va a los registros de Supabase; al cliente, solo una referencia (auditoría H9). */
function errorInterno(e: unknown) {
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`[${ref}]`, e);
  return respuesta(500, { error: `Error interno (ref. ${ref}). Inténtalo de nuevo.` });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return respuesta(405, { error: "Método no permitido" });

  const servicio = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quien, error: errUser } = await servicio.auth.getUser(jwt);
  if (errUser || !quien?.user) return respuesta(401, { error: "Sesión no válida" });
  const yo = quien.user.id;

  const { data: perfil } = await servicio.from("perfiles").select("rol, activo").eq("id", yo).single();
  if (!perfil || perfil.rol !== "admin" || !perfil.activo) return respuesta(403, { error: "Solo administradores" });

  // Fase B (spec 003): el panel exige sesión verificada en dos pasos. El JWT ya lo validó getUser().
  const aal = (() => {
    try {
      const b64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))).aal;
    } catch { return null; }
  })();
  if (aal !== "aal2") return respuesta(403, { error: "El panel de administración exige la verificación en dos pasos" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respuesta(400, { error: "Petición no válida" }); }
  const id = String(body.id ?? "");

  try {
    switch (body.accion) {
      case "activo": {
        if (!UUID.test(id)) return respuesta(400, { error: "Usuario no válido" });
        const activo = body.activo === true;
        if (id === yo && !activo) return respuesta(400, { error: "No puedes desactivar tu propia cuenta" });
        const { error } = await servicio.from("perfiles").update({ activo }).eq("id", id);
        if (error) return respuesta(400, { error: error.message });
        // Bloquea también el inicio de sesión (y renovar la sesión) en Supabase Auth.
        const { error: e2 } = await servicio.auth.admin.updateUserById(id, { ban_duration: activo ? "none" : "876000h" });
        if (e2) return errorInterno(e2);
        return respuesta(200, { ok: true });
      }
      case "rol": {
        if (!UUID.test(id)) return respuesta(400, { error: "Usuario no válido" });
        const rol = body.rol === "admin" ? "admin" : "usuario";
        if (rol === "usuario") {
          // Nadie se quita su propio rol (evita quedarse fuera por error) y nunca quedan cero administradores.
          if (id === yo) return respuesta(400, { error: "No puedes quitarte tu propio rol de administrador. Pídeselo a otro administrador." });
          const { count } = await servicio.from("perfiles").select("id", { count: "exact", head: true })
            .eq("rol", "admin").eq("activo", true).neq("id", id);
          if (!count) return respuesta(400, { error: "Debe quedar al menos un administrador activo." });
        }
        const { error } = await servicio.from("perfiles").update({ rol }).eq("id", id);
        if (error) return respuesta(400, { error: error.message });
        return respuesta(200, { ok: true });
      }
      case "eliminar": {
        if (!UUID.test(id)) return respuesta(400, { error: "Usuario no válido" });
        if (id === yo) return respuesta(400, { error: "No puedes eliminar tu propia cuenta" });
        const { data: objetivo } = await servicio.from("perfiles").select("rol").eq("id", id).single();
        if (objetivo?.rol === "admin") return respuesta(400, { error: "Quita primero el rol de administrador" });
        const { error } = await servicio.auth.admin.deleteUser(id);
        if (error) return errorInterno(error);
        return respuesta(200, { ok: true });
      }
      case "quitar_mfa": {
        // Para quien pierde el móvil con la verificación en dos pasos activada.
        if (!UUID.test(id)) return respuesta(400, { error: "Usuario no válido" });
        if (id === yo) return respuesta(400, { error: "No puedes quitar tu propia verificación desde aquí; hazlo en Mi cuenta" });
        const { data: lista, error: e1 } = await servicio.auth.admin.mfa.listFactors({ userId: id });
        if (e1) return errorInterno(e1);
        const factores = lista?.factors ?? [];
        if (!factores.length) return respuesta(400, { error: "Este usuario no tiene la verificación en dos pasos activada" });
        for (const f of factores) {
          const { error: e2 } = await servicio.auth.admin.mfa.deleteFactor({ userId: id, id: f.id });
          if (e2) return errorInterno(e2);
        }
        return respuesta(200, { ok: true, quitados: factores.length });
      }
      case "enlace": {
        // Enlace de acceso SIN enviar correo (spec 004): invitación si el correo no tiene cuenta,
        // cambio de contraseña si ya la tiene. El admin lo manda por un canal privado.
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respuesta(400, { error: "Correo no válido" });
        const nombre = String(body.nombre ?? "").slice(0, 80);
        const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;
        // Comparación exacta (Supabase guarda los correos en minúsculas); ilike trataría % y _ como comodines.
        const { data: existe } = await servicio.from("perfiles").select("id").eq("email", email).maybeSingle();
        const tipo = existe ? "recovery" : "invite";
        const { data, error } = tipo === "invite"
          ? await servicio.auth.admin.generateLink({ type: "invite", email, options: { data: { nombre }, redirectTo } })
          : await servicio.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
        if (error) return respuesta(400, { error: error.message });
        const enlace = data?.properties?.action_link;
        if (!enlace) return errorInterno(new Error("generateLink sin action_link"));
        return respuesta(200, { ok: true, tipo, enlace });
      }
      case "invitar": {
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respuesta(400, { error: "Correo no válido" });
        const nombre = String(body.nombre ?? "").slice(0, 80);
        const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;
        const { error } = await servicio.auth.admin.inviteUserByEmail(email, { data: { nombre }, redirectTo });
        if (error) return respuesta(400, { error: error.message });
        return respuesta(200, { ok: true });
      }
      default:
        return respuesta(400, { error: "Acción desconocida" });
    }
  } catch (e) {
    return errorInterno(e);
  }
});

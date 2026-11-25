// Acciones del propio usuario sobre su cuenta (spec 004). Hoy: eliminarla.
// Exige sesión válida y la contraseña actual, que se comprueba aquí, en el servidor.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respuesta = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function errorInterno(e: unknown) {
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`[${ref}]`, e);
  return respuesta(500, { error: `Error interno (ref. ${ref}). Inténtalo de nuevo.` });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return respuesta(405, { error: "Método no permitido" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const servicio = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quien, error: errUser } = await servicio.auth.getUser(jwt);
  if (errUser || !quien?.user?.email) return respuesta(401, { error: "Sesión no válida" });
  const yo = quien.user;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respuesta(400, { error: "Petición no válida" }); }

  try {
    if (body.accion !== "eliminar") return respuesta(400, { error: "Acción desconocida" });
    if (body.confirmacion !== "ELIMINAR") return respuesta(400, { error: "Escribe ELIMINAR para confirmar" });
    const password = String(body.password ?? "");
    if (!password) return respuesta(400, { error: "Escribe tu contraseña" });

    // Comprobar la contraseña con un cliente público aparte (no toca la sesión del usuario).
    const publico = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: errPass } = await publico.auth.signInWithPassword({ email: yo.email!, password });
    if (errPass) return respuesta(400, { error: "La contraseña no es correcta" });

    // No dejar el sistema sin administrador.
    const { data: perfil } = await servicio.from("perfiles").select("rol, activo").eq("id", yo.id).single();
    if (perfil?.rol === "admin" && perfil.activo) {
      const { count } = await servicio.from("perfiles").select("id", { count: "exact", head: true })
        .eq("rol", "admin").eq("activo", true).neq("id", yo.id);
      if (!count) return respuesta(400, { error: "Eres el único administrador: nombra a otro antes de eliminar tu cuenta" });
    }

    // Borra la cuenta; perfil y resultados se borran en cascada.
    const { error } = await servicio.auth.admin.deleteUser(yo.id);
    if (error) return errorInterno(error);
    return respuesta(200, { ok: true });
  } catch (e) {
    return errorInterno(e);
  }
});

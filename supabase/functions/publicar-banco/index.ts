// Publicar el banco de preguntas desde la app (spec 002). Solo administradores activos.
// Acciones: publicar (sube el ZIP y lo marca activo), activar (vuelve a una versión),
// comprobar (mira si la web ya sirve la versión y actualiza su estado).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const OWNER = "wilfredmorales";
const REPO = "Test-Cap";
const BRANCH = "claude/testcat-repo-review-540xv2";
const VERSION_PUBLICADA = "https://wilfredmorales.github.io/Test-Cap/data/version.json";
const MAX_ZIP_BASE64 = 7_000_000; // ~5 MB de ZIP
const MINUTOS_LIMITE = 15;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respuesta = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

class ErrorUsuario extends Error {}

function github(token: string) {
  return async (ruta: string, init: RequestInit = {}) => {
    const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${ruta}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "test-cap-publicar-banco",
        "Content-Type": "application/json",
      },
    });
    const texto = await r.text();
    if (!r.ok) {
      const e = new Error(`GitHub ${r.status}: ${texto.slice(0, 200)}`) as Error & { status?: number };
      e.status = r.status;
      throw e;
    }
    return texto ? JSON.parse(texto) : {};
  };
}

/** Un solo commit con varios archivos. Reintenta si la rama avanzó mientras tanto. */
async function commit(gh: ReturnType<typeof github>, archivos: { path: string; base64?: string; texto?: string }[], mensaje: string) {
  for (let intento = 0; intento < 3; intento++) {
    const ref = await gh(`/git/ref/heads/${BRANCH}`);
    const base = ref.object.sha;
    const baseCommit = await gh(`/git/commits/${base}`);
    const entradas = [];
    for (const a of archivos) {
      if (a.base64 !== undefined) {
        const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: a.base64, encoding: "base64" }) });
        entradas.push({ path: a.path, mode: "100644", type: "blob", sha: blob.sha });
      } else {
        entradas.push({ path: a.path, mode: "100644", type: "blob", content: a.texto });
      }
    }
    const arbol = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: entradas }) });
    const nuevo = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message: mensaje, tree: arbol.sha, parents: [base] }) });
    try {
      await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: nuevo.sha, force: false }) });
      return nuevo.sha as string;
    } catch (e) {
      if ((e as { status?: number }).status !== 422 || intento === 2) throw e;
    }
  }
  throw new Error("No se pudo crear el commit");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return respuesta(405, { error: "Método no permitido" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quien, error: errUser } = await db.auth.getUser(jwt);
  if (errUser || !quien?.user) return respuesta(401, { error: "Sesión no válida" });
  const yo = quien.user.id;
  const { data: perfil } = await db.from("perfiles").select("rol, activo").eq("id", yo).single();
  if (!perfil || perfil.rol !== "admin" || !perfil.activo) return respuesta(403, { error: "Solo administradores" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respuesta(400, { error: "Petición no válida" }); }

  try {
    if (body.accion === "comprobar") {
      const { data: pendientes } = await db.from("banco_versiones").select("id, version, creado").eq("estado", "publicando");
      if (!pendientes?.length) return respuesta(200, { ok: true, pendientes: 0 });
      let servida: string | null = null;
      try {
        const r = await fetch(`${VERSION_PUBLICADA}?t=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
        if (r.ok) servida = (await r.json()).version ?? null;
      } catch { /* la web no responde: se reintenta en la próxima comprobación */ }
      const ahora = Date.now();
      for (const p of pendientes) {
        if (servida === p.version) {
          await db.from("banco_versiones").update({ estado: "publicada", mensaje: "Publicada en la web", actualizado: new Date().toISOString() }).eq("id", p.id);
        } else if (ahora - new Date(p.creado).getTime() > MINUTOS_LIMITE * 60_000) {
          await db.from("banco_versiones").update({
            estado: "fallida", actualizado: new Date().toISOString(),
            mensaje: "La web no sirvió esta versión en 15 minutos. Revisa la tarea «Actualizar banco de preguntas» en GitHub.",
          }).eq("id", p.id);
        }
      }
      return respuesta(200, { ok: true, servida });
    }

    const token = Deno.env.get("GITHUB_TOKEN_BANCO");
    if (!token) throw new ErrorUsuario("Falta configurar el token de GitHub (GITHUB_TOKEN_BANCO) en Supabase.");
    const gh = github(token);

    const { data: enCurso } = await db.from("banco_versiones").select("id")
      .eq("estado", "publicando").gt("creado", new Date(Date.now() - MINUTOS_LIMITE * 60_000).toISOString()).limit(1);
    if (enCurso?.length) throw new ErrorUsuario("Ya hay una publicación en curso. Espera a que termine.");

    const { data: activa } = await db.from("banco_versiones").select("version, archivo")
      .eq("estado", "publicada").order("creado", { ascending: false }).limit(1).maybeSingle();

    if (body.accion === "publicar") {
      const zip = String(body.zip ?? "");
      const version = String(body.version ?? "");
      const total = Number(body.total);
      const fecha = typeof body.fechaFuente === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.fechaFuente) ? body.fechaFuente : null;
      if (!/^[0-9a-f]{12}$/.test(version)) throw new ErrorUsuario("Versión no válida");
      if (!Number.isInteger(total) || total < 100) throw new ErrorUsuario("Total de preguntas no válido");
      if (!zip.startsWith("UEsDB")) throw new ErrorUsuario("El archivo no es un ZIP");
      if (zip.length > MAX_ZIP_BASE64) throw new ErrorUsuario("El ZIP es demasiado grande (máximo 5 MB)");
      if (activa?.version === version) throw new ErrorUsuario("Esta versión ya es la publicada.");

      const archivo = `banco-${fecha ?? "sin-fecha"}-${version}.zip`;
      const sha = await commit(gh, [
        { path: `fuentes/${archivo}`, base64: zip },
        { path: "fuentes/ACTIVO.txt", texto: archivo + "\n" },
      ], `Publicar banco ${version} (${total} preguntas) desde la app`);
      const cambios = typeof body.cambios === "object" && body.cambios ? body.cambios : {};
      const { data: fila, error } = await db.from("banco_versiones").insert({
        version, archivo, fecha_fuente: fecha, total, cambios, estado: "publicando",
        mensaje: `Commit ${sha.slice(0, 7)}`, publicada_por: yo,
      }).select("id").single();
      if (error) throw error;
      return respuesta(200, { ok: true, id: fila.id, archivo, commit: sha });
    }

    if (body.accion === "activar") {
      const id = Number(body.id);
      const { data: v } = await db.from("banco_versiones").select("*").eq("id", id).maybeSingle();
      if (!v || v.estado !== "publicada") throw new ErrorUsuario("Solo se puede volver a una versión que se publicó bien.");
      if (activa?.version === v.version) throw new ErrorUsuario("Esa versión ya es la activa.");
      const sha = await commit(gh, [{ path: "fuentes/ACTIVO.txt", texto: v.archivo + "\n" }],
        `Volver al banco ${v.version} desde la app`);
      const { data: fila, error } = await db.from("banco_versiones").insert({
        version: v.version, archivo: v.archivo, fecha_fuente: v.fecha_fuente, total: v.total,
        cambios: { restaurada_desde: v.id }, estado: "publicando",
        mensaje: `Restaurada desde la versión #${v.id} · commit ${sha.slice(0, 7)}`, publicada_por: yo,
      }).select("id").single();
      if (error) throw error;
      return respuesta(200, { ok: true, id: fila.id, commit: sha });
    }

    return respuesta(400, { error: "Acción desconocida" });
  } catch (e) {
    if (e instanceof ErrorUsuario) return respuesta(400, { error: e.message });
    console.error(e);
    return respuesta(500, { error: (e as Error).message });
  }
});

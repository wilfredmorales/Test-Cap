// Retirada (spec 006): el banco ya no se publica en GitHub, sino en Supabase con public.publicar_banco.
// Se deja una respuesta fija para que ninguna app antigua pueda volver a escribir en el repositorio.
Deno.serve(() =>
  new Response(JSON.stringify({ error: "Función retirada: actualiza la app para publicar el banco." }), {
    status: 410,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
);

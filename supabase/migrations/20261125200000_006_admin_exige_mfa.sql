-- 006 · Fase B de la spec 003 (auditoría H2): ser administrador exige sesión verificada (aal2).
-- Afecta a todo lo que usa privado.es_admin(): ver todos los perfiles y resultados,
-- cambiar rol/activo, historial del banco y estadisticas_admin().
create or replace function privado.es_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'admin' and activo
  )
  and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

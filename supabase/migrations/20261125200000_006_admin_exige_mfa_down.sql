-- Reversión de 006: vuelve a aceptar administradores sin sesión verificada.
create or replace function privado.es_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'admin' and activo
  );
$$;

-- Reversión de 011. Las cuentas principales vuelven a ser administradores normales con aal2
-- (las políticas y funciones vuelven a "cualquier admin"). Ejecutar entero.
drop function if exists public.revisar_alta(uuid, text);
drop function if exists public.resumen_admins();
create or replace function privado.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()) and rol = 'admin' and activo)
     and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;
drop policy perfiles_ver on public.perfiles;
create policy perfiles_ver on public.perfiles for select to authenticated using (id = (select auth.uid()) or (select privado.es_admin()));
drop policy perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles for update to authenticated
  using (id = (select auth.uid()) or (select privado.es_admin())) with check (id = (select auth.uid()) or (select privado.es_admin()));
drop policy resultados_ver on public.resultados;
create policy resultados_ver on public.resultados for select to authenticated using (user_id = (select auth.uid()) or (select privado.es_admin()));
drop policy compras_ver on public.compras;
create policy compras_ver on public.compras for select to authenticated using (user_id = (select auth.uid()) or (select privado.es_admin()));
drop policy compras_dar on public.compras;
create policy compras_dar on public.compras for insert to authenticated
  with check ((select privado.es_admin()) and origen = 'admin' and creado_por = (select auth.uid()));
drop policy compras_quitar on public.compras;
create policy compras_quitar on public.compras for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
-- Banco: volver a ejecutar las políticas de 009 (sección "banco") y la función de publicar de 009.
-- proteger_perfil y siempre_un_admin: volver a ejecutar las versiones de 003 y 008.
drop function if exists privado.administra(uuid);
drop function if exists privado.es_principal();
alter table public.perfiles drop constraint if exists principal_es_admin,
  drop column if exists nota_revision, drop column if exists nota_alta, drop column if exists revisado_en,
  drop column if exists revisado_por, drop column if exists revision, drop column if exists invitado_por,
  drop column if exists principal;

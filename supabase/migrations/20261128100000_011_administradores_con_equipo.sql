-- 011 · Administradores con equipo propio (spec 008).
-- - Principal = rol 'admin' + principal = true (exige aal2). Compatible con la app anterior: sigue siendo 'admin'.
-- - Administrador secundario = rol 'admin', principal = false (sin aal2). Solo gestiona a quienes invitó.
-- - Altas: invitado_por (quién invitó) y revisión del principal (pendiente/revisada) con notas.

-- ===== columnas =====
alter table public.perfiles
  add column principal     boolean not null default false,
  add column invitado_por  uuid references public.perfiles (id) on delete set null,
  add column revision      text not null default 'revisada' check (revision in ('pendiente', 'revisada')),
  add column revisado_por  uuid references public.perfiles (id) on delete set null,
  add column revisado_en   timestamptz,
  add column nota_alta     text check (nota_alta is null or char_length(nota_alta) <= 300),
  add column nota_revision text check (nota_revision is null or char_length(nota_revision) <= 300),
  add constraint principal_es_admin check (not principal or rol = 'admin');
create index perfiles_invitado_por_idx on public.perfiles (invitado_por);
create index perfiles_revision_idx on public.perfiles (revision) where revision = 'pendiente';
grant select (principal, invitado_por, revision, revisado_por, revisado_en, nota_alta, nota_revision)
  on public.perfiles to authenticated;

-- ===== funciones de rol =====
create or replace function privado.es_principal()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'admin' and principal and activo
  ) and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

-- Administrador: secundario activo (sin aal2) o principal (con aal2).
create or replace function privado.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'admin' and activo and not principal
  ) or privado.es_principal();
$$;

-- ¿El usuario de la sesión gestiona a "uid"? Principal: a todos. Secundario: a quienes invitó.
create or replace function privado.administra(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.es_principal() or (
    privado.es_admin() and exists (
      select 1 from public.perfiles u where u.id = uid and u.invitado_por = (select auth.uid())));
$$;

revoke all on function privado.es_principal(), privado.administra(uuid) from public, anon;
grant execute on function privado.es_principal(), privado.administra(uuid) to authenticated, service_role;

-- ===== políticas =====
drop policy perfiles_ver on public.perfiles;
create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select privado.administra(id)));
drop policy perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles for update to authenticated
  using (id = (select auth.uid()) or (select privado.administra(id)))
  with check (id = (select auth.uid()) or (select privado.administra(id)));

drop policy resultados_ver on public.resultados;
create policy resultados_ver on public.resultados for select to authenticated
  using (user_id = (select auth.uid()) or (select privado.administra(user_id)));

drop policy compras_ver on public.compras;
create policy compras_ver on public.compras for select to authenticated
  using (user_id = (select auth.uid()) or (select privado.administra(user_id)));
drop policy compras_dar on public.compras;
create policy compras_dar on public.compras for insert to authenticated
  with check ((select privado.administra(user_id)) and origen = 'admin' and creado_por = (select auth.uid()));
drop policy compras_quitar on public.compras;
create policy compras_quitar on public.compras for update to authenticated
  using ((select privado.administra(user_id))) with check ((select privado.administra(user_id)));

-- Banco e historial: solo principal.
drop policy banco_completo_admin_ins on public.banco_completo;
create policy banco_completo_admin_ins on public.banco_completo for insert to authenticated
  with check ((select privado.es_principal()));
drop policy banco_completo_admin_upd on public.banco_completo;
create policy banco_completo_admin_upd on public.banco_completo for update to authenticated
  using ((select privado.es_principal())) with check ((select privado.es_principal()));
drop policy banco_muestra_admin_ins on public.banco_muestra;
create policy banco_muestra_admin_ins on public.banco_muestra for insert to authenticated
  with check ((select privado.es_principal()));
drop policy banco_muestra_admin_upd on public.banco_muestra;
create policy banco_muestra_admin_upd on public.banco_muestra for update to authenticated
  using ((select privado.es_principal())) with check ((select privado.es_principal()));
drop policy banco_versiones_ver on public.banco_versiones;
create policy banco_versiones_ver on public.banco_versiones for select to authenticated
  using ((select privado.es_principal()));
drop policy banco_versiones_admin_ins on public.banco_versiones;
create policy banco_versiones_admin_ins on public.banco_versiones for insert to authenticated
  with check ((select privado.es_principal()));

-- publicar_banco / activar_banco: solo principal (se rehacen con la comprobación nueva).
do $$
declare f text;
begin
  for f in select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('publicar_banco', 'activar_banco') loop
    execute replace(f, 'if not (select privado.es_admin()) then raise exception ''Solo administradores''',
                       'if not (select privado.es_principal()) then raise exception ''Solo el administrador principal''');
  end loop;
end $$;

-- ===== protección del perfil =====
create or replace function privado.proteger_perfil()
returns trigger language plpgsql set search_path = '' as $$
declare
  es_sistema boolean := current_user in ('postgres', 'supabase_admin', 'service_role');
begin
  if new.id <> old.id or new.email <> old.email or new.creado <> old.creado then
    if not es_sistema then raise exception 'No se puede cambiar ese dato'; end if;
  end if;
  if new.principal is distinct from old.principal and not es_sistema then
    raise exception 'El rol de administrador principal solo se cambia desde Supabase';
  end if;
  if new.rol <> old.rol and not es_sistema and not privado.es_principal() then
    raise exception 'Solo el administrador principal puede cambiar roles';
  end if;
  if new.activo <> old.activo and not es_sistema and not privado.administra(old.id) then
    raise exception 'No puedes cambiar el estado de esta cuenta';
  end if;
  if (new.invitado_por is distinct from old.invitado_por
      or new.revision is distinct from old.revision or new.revisado_por is distinct from old.revisado_por
      or new.revisado_en is distinct from old.revisado_en or new.nota_revision is distinct from old.nota_revision
      or new.nota_alta is distinct from old.nota_alta)
     and not es_sistema and not privado.es_principal() then
    raise exception 'Solo el administrador principal puede cambiar esos datos';
  end if;
  -- Siempre queda al menos un principal activo.
  if old.principal and old.activo and (not new.principal or not new.activo or new.rol <> 'admin') then
    if not exists (select 1 from public.perfiles where principal and activo and rol = 'admin' and id <> old.id) then
      raise exception 'Debe quedar al menos un administrador principal activo';
    end if;
  end if;
  -- Admin que pierde el rol: sus usuarios pasan a quien hace el cambio (un principal) o quedan sin gestor.
  if old.rol = 'admin' and new.rol <> 'admin' then
    update public.perfiles set invitado_por = case when es_sistema then null else (select auth.uid()) end
    where invitado_por = old.id;
  end if;
  return new;
end;
$$;

create or replace function privado.siempre_un_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.principal and old.activo
     and not exists (select 1 from public.perfiles p where p.principal and p.activo and p.id <> old.id) then
    raise exception 'Debe quedar al menos un administrador principal activo' using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

-- ===== sesiones (spec 007) y resumen, con el nuevo alcance =====
create or replace function public.dispositivos_de(p_usuarios uuid[])
returns table (user_id uuid, sesion uuid, creada timestamptz, ultima_actividad timestamptz, navegador text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select privado.es_admin()) then raise exception 'Solo administradores'; end if;
  return query
    select s.user_id, s.id, s.created_at,
           coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at),
           left(coalesce(s.user_agent, ''), 300)
    from auth.sessions s
    where s.user_id = any (p_usuarios) and coalesce(s.not_after, 'infinity') > now()
      and privado.administra(s.user_id)
    order by 4 desc;
end;
$$;

create or replace function public.cerrar_dispositivos_de(p_usuario uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not (select privado.administra(p_usuario)) then raise exception 'No gestionas a ese usuario'; end if;
  if p_usuario = (select auth.uid()) then raise exception 'No puedes cerrar tu propia sesión desde aquí'; end if;
  delete from auth.sessions where user_id = p_usuario;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Panel del principal: por cada administrador, sus usuarios.
create or replace function public.resumen_admins()
returns table (admin_id uuid, email text, nombre text, principal boolean, activo boolean,
               usuarios int, en_prueba int, con_acceso int, desactivados int, sin_revisar int, conectados int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select privado.es_principal()) then raise exception 'Solo el administrador principal'; end if;
  return query
    select a.id, a.email, a.nombre, a.principal, a.activo,
      count(u.id)::int,
      count(u.id) filter (where u.activo and not exists (
        select 1 from public.compras c where c.user_id = u.id and c.estado = 'activa'
          and (c.hasta is null or c.hasta > now())))::int,
      count(u.id) filter (where u.activo and exists (
        select 1 from public.compras c where c.user_id = u.id and c.estado = 'activa'
          and (c.hasta is null or c.hasta > now())))::int,
      count(u.id) filter (where not u.activo)::int,
      count(u.id) filter (where u.revision = 'pendiente')::int,
      count(u.id) filter (where exists (
        select 1 from auth.sessions s where s.user_id = u.id
          and coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) > now() - interval '15 minutes'))::int
    from public.perfiles a
    left join public.perfiles u on u.invitado_por = a.id and u.rol = 'usuario'
    where a.rol = 'admin'
    group by a.id
    order by a.principal desc, a.email;
end;
$$;
revoke all on function public.resumen_admins() from public, anon;
grant execute on function public.resumen_admins() to authenticated;

-- Revisión de un alta por el principal.
create or replace function public.revisar_alta(p_usuario uuid, p_nota text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select privado.es_principal()) then raise exception 'Solo el administrador principal'; end if;
  update public.perfiles
     set revision = 'revisada', revisado_por = (select auth.uid()), revisado_en = now(),
         nota_revision = nullif(left(coalesce(p_nota, ''), 300), '')
   where id = p_usuario;
end;
$$;
revoke all on function public.revisar_alta(uuid, text) from public, anon;
grant execute on function public.revisar_alta(uuid, text) to authenticated;

-- ===== datos actuales (por identificador de cuenta) =====
-- Principales: las dos cuentas del titular. El resto de administradores pasa a usuario.
update public.perfiles set principal = true
 where id in ('3e0154a5-731c-407d-9f44-381546c97056', 'f11a5cde-ba3f-4aa3-b6ae-204def69449e') and rol = 'admin';
update public.perfiles set rol = 'usuario' where rol = 'admin' and not principal;

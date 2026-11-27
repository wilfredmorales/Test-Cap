-- 010 · Límite de dispositivos (spec 007): 1 sesión por usuario normal; entra el último.
-- Al crearse una sesión nueva (inicio de sesión, enlace de recuperación...) se borran las demás sesiones del usuario.
-- Borrar la sesión borra en cascada sus refresh tokens: el otro dispositivo ya no puede renovar y la app lo saca
-- (comprueba public.mi_sesion_vigente() cada 2 minutos). Los administradores no tienen límite.

create or replace function privado.max_dispositivos()
returns int language sql immutable set search_path = '' as $$ select 1 $$;

create or replace function privado.limitar_sesiones()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.perfiles p where p.id = new.user_id and p.rol = 'admin') then
    return new;
  end if;
  delete from auth.sessions s
  where s.user_id = new.user_id and s.id <> new.id
    and s.id not in (
      select o.id from auth.sessions o
      where o.user_id = new.user_id and o.id <> new.id
      order by coalesce(o.refreshed_at::timestamptz, o.updated_at, o.created_at) desc
      limit greatest(privado.max_dispositivos() - 1, 0));
  return new;
end;
$$;
revoke all on function privado.limitar_sesiones() from public, anon, authenticated;

create trigger limitar_sesiones
  after insert on auth.sessions
  for each row execute function privado.limitar_sesiones();

-- ¿Sigue existiendo la sesión de este token? (si no, la app sale con el aviso).
create or replace function public.mi_sesion_vigente()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s
    where s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
      and s.user_id = (select auth.uid()));
$$;
revoke all on function public.mi_sesion_vigente() from public, anon;
grant execute on function public.mi_sesion_vigente() to authenticated;

-- Admin (aal2): sesiones abiertas de una lista de usuarios. Sin IP: solo navegador y fechas.
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
    order by 4 desc;
end;
$$;
revoke all on function public.dispositivos_de(uuid[]) from public, anon;
grant execute on function public.dispositivos_de(uuid[]) to authenticated;

-- Admin (aal2): cerrar todas las sesiones de un usuario (no la propia).
create or replace function public.cerrar_dispositivos_de(p_usuario uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not (select privado.es_admin()) then raise exception 'Solo administradores'; end if;
  if p_usuario = (select auth.uid()) then raise exception 'No puedes cerrar tu propia sesión desde aquí'; end if;
  delete from auth.sessions where user_id = p_usuario;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.cerrar_dispositivos_de(uuid) from public, anon;
grant execute on function public.cerrar_dispositivos_de(uuid) to authenticated;

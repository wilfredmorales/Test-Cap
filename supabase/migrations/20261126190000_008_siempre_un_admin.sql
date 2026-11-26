-- 008 · Nunca se borra al último administrador activo.
-- Los cambios de rol/estado ya los protege privado.proteger_perfil (001/003), también para
-- service_role. Faltaba el borrado: eliminar la cuenta del último admin (desde el panel de
-- Supabase o por SQL) borra su perfil en cascada y dejaba la app sin administrador.
create or replace function privado.siempre_un_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.rol = 'admin' and old.activo
     and (tg_op = 'DELETE' or new.rol <> 'admin' or not new.activo)
     and not exists (
       select 1 from public.perfiles p
       where p.rol = 'admin' and p.activo and p.id <> old.id
     ) then
    raise exception 'Debe quedar al menos un administrador activo'
      using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function privado.siempre_un_admin() from public, anon, authenticated;

create trigger siempre_un_admin
  before delete on public.perfiles
  for each row execute function privado.siempre_un_admin();

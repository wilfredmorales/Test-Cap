-- 001 · Usuarios, roles y resultados (spec docs/specs/001-usuarios-y-administracion.md)

create schema if not exists privado;
revoke all on schema privado from public;

create type public.rol_usuario as enum ('usuario', 'admin');

-- Perfil de cada cuenta (se crea solo al registrarse)
create table public.perfiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  nombre        text not null default '' check (char_length(nombre) <= 80),
  rol           public.rol_usuario not null default 'usuario',
  activo        boolean not null default true,
  creado        timestamptz not null default now(),
  ultimo_acceso timestamptz
);
create index perfiles_email_idx on public.perfiles (lower(email));

-- Resultado de cada test terminado
create table public.resultados (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  tipo          text not null check (tipo in ('mercancias', 'viajeros')),
  modo          text not null check (modo in ('examen', 'ampliacion', 'temas', 'falladas')),
  preguntas     int not null check (preguntas between 1 and 1000),
  correctas     int not null check (correctas >= 0),
  falladas      int not null check (falladas >= 0),
  blanco        int not null check (blanco >= 0),
  puntos        numeric(8, 2) not null,
  porcentaje    numeric(6, 2) not null,
  aprobado      boolean not null,
  duracion_seg  int check (duracion_seg >= 0),
  version_banco text check (char_length(version_banco) <= 40),
  id_cliente    uuid not null,                      -- evita duplicados al reenviar sin conexión
  creado        timestamptz not null default now(),
  check (correctas + falladas + blanco = preguntas),
  unique (user_id, id_cliente)
);
create index resultados_user_creado_idx on public.resultados (user_id, creado desc);
create index resultados_creado_idx on public.resultados (creado desc);

-- ¿Quien llama es administrador activo?
create function privado.es_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'admin' and activo
  );
$$;
revoke all on function privado.es_admin() from public;
grant usage on schema privado to authenticated;
grant execute on function privado.es_admin() to authenticated;

-- Crear el perfil al registrarse
create function privado.crear_perfil() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email, left(coalesce(new.raw_user_meta_data ->> 'nombre', ''), 80));
  return new;
end;
$$;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function privado.crear_perfil();

-- Mantener el email del perfil igual al de la cuenta
create function privado.sincronizar_email() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.perfiles set email = new.email where id = new.id;
  return new;
end;
$$;
create trigger al_cambiar_email after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function privado.sincronizar_email();

-- Un usuario solo cambia su nombre; rol y activo solo un admin; nunca dejar el sistema sin admin
create function privado.proteger_perfil() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  es_sistema boolean := current_user in ('postgres', 'supabase_admin', 'service_role');
begin
  if new.id <> old.id or new.email <> old.email or new.creado <> old.creado then
    if not es_sistema then raise exception 'No se puede cambiar ese dato'; end if;
  end if;
  if (new.rol <> old.rol or new.activo <> old.activo) and not es_sistema and not privado.es_admin() then
    raise exception 'Solo un administrador puede cambiar el rol o el estado';
  end if;
  if old.rol = 'admin' and old.activo and (new.rol <> 'admin' or not new.activo) then
    if not exists (select 1 from public.perfiles where rol = 'admin' and activo and id <> old.id) then
      raise exception 'Debe quedar al menos un administrador activo';
    end if;
  end if;
  return new;
end;
$$;
create trigger proteger_perfil before update on public.perfiles
  for each row execute function privado.proteger_perfil();

-- Permisos: nada para anónimos; columnas concretas para usuarios
alter table public.perfiles enable row level security;
alter table public.resultados enable row level security;

revoke all on public.perfiles, public.resultados from anon, authenticated;
grant select on public.perfiles to authenticated;
grant update (nombre, rol, activo, ultimo_acceso) on public.perfiles to authenticated;
grant select, insert on public.resultados to authenticated;

create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select privado.es_admin()));
create policy perfiles_editar on public.perfiles for update to authenticated
  using (id = (select auth.uid()) or (select privado.es_admin()))
  with check (id = (select auth.uid()) or (select privado.es_admin()));

create policy resultados_ver on public.resultados for select to authenticated
  using (user_id = (select auth.uid()) or (select privado.es_admin()));
create policy resultados_crear on public.resultados for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.activo)
  );

-- Estadísticas para el panel de administración (solo admin)
create function public.estadisticas_admin() returns json
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not privado.es_admin() then raise exception 'Solo administradores'; end if;
  return json_build_object(
    'usuarios',        (select count(*) from public.perfiles),
    'usuarios_activos',(select count(*) from public.perfiles where activo),
    'admins',          (select count(*) from public.perfiles where rol = 'admin'),
    'nuevos_7d',       (select count(*) from public.perfiles where creado > now() - interval '7 days'),
    'tests_total',     (select count(*) from public.resultados),
    'tests_7d',        (select count(*) from public.resultados where creado > now() - interval '7 days'),
    'aprobados_pct',   (select round(100.0 * avg(case when aprobado then 1 else 0 end), 1)
                          from public.resultados where modo = 'examen'),
    'activos_7d',      (select count(distinct user_id) from public.resultados where creado > now() - interval '7 days')
  );
end;
$$;
revoke all on function public.estadisticas_admin() from public, anon;
grant execute on function public.estadisticas_admin() to authenticated;

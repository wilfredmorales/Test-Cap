-- 009 · App de pago, fase A (spec 006): acceso por periodo y banco de preguntas privado.
-- - compras: quién tiene acceso completo y hasta cuándo (origen 'admin' ahora; 'pago' con Lemon Squeezy después).
-- - banco_completo: solo lo leen quienes tienen acceso. banco_muestra: lo lee cualquier usuario con sesión.
-- - publicar_banco / activar_banco: el admin publica desde la app (sustituye al circuito de GitHub).

-- ===== compras =====
create table public.compras (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  origen       text not null check (origen in ('admin', 'pago')),
  pedido       text unique check (pedido is null or char_length(pedido) between 1 and 100),
  estado       text not null default 'activa' check (estado in ('activa', 'reembolsada', 'revocada')),
  desde        timestamptz not null default now(),
  hasta        timestamptz,                                   -- null = sin caducidad (solo origen admin)
  importe_cent int check (importe_cent is null or importe_cent >= 0),
  moneda       text check (moneda is null or moneda ~ '^[A-Z]{3}$'),
  nota         text check (nota is null or char_length(nota) <= 200),
  creado_por   uuid references public.perfiles (id) on delete set null,
  creado       timestamptz not null default now(),
  check (hasta is null or hasta > desde),
  check (origen = 'admin' or (pedido is not null and hasta is not null))
);
create index compras_usuario_idx on public.compras (user_id, estado);

alter table public.compras enable row level security;
revoke all on public.compras from anon, authenticated;
grant select on public.compras to authenticated;
grant insert (user_id, origen, hasta, nota, creado_por) on public.compras to authenticated;
grant update (estado) on public.compras to authenticated;

create policy compras_ver on public.compras for select to authenticated
  using (user_id = (select auth.uid()) or (select privado.es_admin()));
-- El admin solo crea accesos manuales; los pagos los crea la función del webhook (service_role).
create policy compras_dar on public.compras for insert to authenticated
  with check ((select privado.es_admin()) and origen = 'admin' and creado_por = (select auth.uid()));
create policy compras_quitar on public.compras for update to authenticated
  using ((select privado.es_admin())) with check ((select privado.es_admin()));

-- ¿El usuario de la sesión tiene acceso completo? Admin activo o una compra activa vigente.
create or replace function privado.tiene_acceso()
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo
      and (p.rol = 'admin' or exists (
        select 1 from public.compras c
        where c.user_id = p.id and c.estado = 'activa'
          and c.desde <= now() and (c.hasta is null or c.hasta > now())))
  );
$$;
revoke all on function privado.tiene_acceso() from public, anon;
grant execute on function privado.tiene_acceso() to authenticated, service_role;

-- Estado de acceso del usuario de la sesión, para la app.
create or replace function public.mi_acceso()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'completo', privado.tiene_acceso(),
    'hasta', (select case when bool_or(c.hasta is null) then null else max(c.hasta) end
              from public.compras c
              where c.user_id = (select auth.uid()) and c.estado = 'activa'
                and c.desde <= now() and (c.hasta is null or c.hasta > now())),
    'sin_caducidad', exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'admin')
      or exists (select 1 from public.compras c where c.user_id = (select auth.uid())
                 and c.estado = 'activa' and c.hasta is null)
  );
$$;
revoke all on function public.mi_acceso() from public, anon;
grant execute on function public.mi_acceso() to authenticated;

-- ===== banco =====
create table public.banco_completo (
  version       text primary key check (version ~ '^[0-9a-z-]{4,40}$'),
  datos         jsonb not null,
  activo        boolean not null default false,
  publicado_por uuid references public.perfiles (id) on delete set null,
  creado        timestamptz not null default now()
);
create unique index banco_completo_un_activo on public.banco_completo (activo) where activo;

create table public.banco_muestra (
  version text primary key references public.banco_completo (version) on delete cascade,
  datos   jsonb not null,
  activo  boolean not null default false
);
create unique index banco_muestra_un_activo on public.banco_muestra (activo) where activo;

alter table public.banco_completo enable row level security;
alter table public.banco_muestra enable row level security;
revoke all on public.banco_completo, public.banco_muestra from anon, authenticated;
grant select on public.banco_completo, public.banco_muestra to authenticated;
grant insert, update on public.banco_completo, public.banco_muestra to authenticated;

create policy banco_completo_ver on public.banco_completo for select to authenticated
  using ((select privado.tiene_acceso()));
create policy banco_completo_admin_ins on public.banco_completo for insert to authenticated
  with check ((select privado.es_admin()));
create policy banco_completo_admin_upd on public.banco_completo for update to authenticated
  using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy banco_muestra_ver on public.banco_muestra for select to authenticated using (true);
create policy banco_muestra_admin_ins on public.banco_muestra for insert to authenticated
  with check ((select privado.es_admin()));
create policy banco_muestra_admin_upd on public.banco_muestra for update to authenticated
  using ((select privado.es_admin())) with check ((select privado.es_admin()));

-- El historial de versiones ahora lo escribe la app del admin.
create policy banco_versiones_admin_ins on public.banco_versiones for insert to authenticated
  with check ((select privado.es_admin()));
grant insert (version, archivo, fecha_fuente, total, cambios, estado, mensaje, publicada_por)
  on public.banco_versiones to authenticated;

-- Muestra gratuita: ~2,5 % de cada objetivo (mínimo 2), elegidas de forma fija por hash del código.
create or replace function privado.generar_muestra(banco jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  with obj as (
    select o, (o ->> 'id') id, greatest(2, ceil((o ->> 'n')::numeric * 0.025))::int k
    from jsonb_array_elements(banco -> 'objetivos') o
  ), q as (
    select p, row_number() over (partition by p ->> 'o' order by md5(p ->> 'c')) rn
    from jsonb_array_elements(banco -> 'preguntas') p
  ), elegidas as (
    select q.p from q join obj on obj.id = q.p ->> 'o' where q.rn <= obj.k
  )
  select banco
    || jsonb_build_object(
      'version', (banco ->> 'version') || '-m',
      'muestra', true,
      'totalCompleto', jsonb_array_length(banco -> 'preguntas'),
      'total', (select count(*) from elegidas),
      'preguntas', coalesce((select jsonb_agg(p order by p ->> 'c') from elegidas), '[]'::jsonb),
      'objetivos', (select jsonb_agg(o || jsonb_build_object('n',
                      (select count(*) from elegidas e where e.p ->> 'o' = obj.id)) order by ord)
                    from jsonb_array_elements(banco -> 'objetivos') with ordinality t(o, ord)
                    join obj using (o)));
$$;

-- Publicar una versión nueva (o reactivar una existente si se vuelve a subir la misma).
create or replace function public.publicar_banco(p_banco jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v text := p_banco ->> 'version';
  n int := coalesce(jsonb_array_length(p_banco -> 'preguntas'), 0);
  archivo text := regexp_replace(coalesce(p_banco ->> 'fuente', 'banco.zip'), '[^A-Za-z0-9._-]', '_', 'g');
begin
  if not (select privado.es_admin()) then raise exception 'Solo administradores'; end if;
  if v is null or v !~ '^[0-9a-f]{12}$' then raise exception 'Versión no válida'; end if;
  if n < 100 or (p_banco ->> 'total')::int <> n then raise exception 'Banco incompleto'; end if;
  if archivo !~ '\.zip$' then archivo := archivo || '.zip'; end if;

  update public.banco_completo set activo = false where activo;
  update public.banco_muestra set activo = false where activo;
  insert into public.banco_completo (version, datos, activo, publicado_por)
    values (v, p_banco, true, (select auth.uid()))
    on conflict (version) do update set activo = true;
  insert into public.banco_muestra (version, datos, activo)
    values (v, privado.generar_muestra(p_banco), true)
    on conflict (version) do update set activo = true, datos = excluded.datos;
  insert into public.banco_versiones (version, archivo, fecha_fuente, total, cambios, estado, mensaje, publicada_por)
    values (v, archivo, nullif(p_banco ->> 'fechaFuente', '')::date, n, '{}'::jsonb, 'publicada',
            'Publicada desde la app', (select auth.uid()));
  return jsonb_build_object('version', v, 'total', n,
    'muestra', (select jsonb_array_length(datos -> 'preguntas') from public.banco_muestra where version = v));
end;
$$;
revoke all on function public.publicar_banco(jsonb) from public, anon;
grant execute on function public.publicar_banco(jsonb) to authenticated;

-- Volver a una versión ya publicada.
create or replace function public.activar_banco(p_version text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not (select privado.es_admin()) then raise exception 'Solo administradores'; end if;
  if not exists (select 1 from public.banco_completo where version = p_version) then
    raise exception 'Esa versión no está guardada';
  end if;
  update public.banco_completo set activo = false where activo;
  update public.banco_muestra set activo = false where activo;
  update public.banco_completo set activo = true where version = p_version;
  update public.banco_muestra set activo = true where version = p_version;
  insert into public.banco_versiones (version, archivo, fecha_fuente, total, estado, mensaje, publicada_por)
    select version, 'restaurada.zip', nullif(datos ->> 'fechaFuente', '')::date,
           jsonb_array_length(datos -> 'preguntas'), 'publicada', 'Restaurada desde la app', (select auth.uid())
    from public.banco_completo where version = p_version;
end;
$$;
revoke all on function public.activar_banco(text) from public, anon;
grant execute on function public.activar_banco(text) to authenticated;

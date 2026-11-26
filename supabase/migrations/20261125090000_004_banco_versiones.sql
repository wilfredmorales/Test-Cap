-- 004 · Registro de versiones del banco publicadas desde la app (spec 002)
create table public.banco_versiones (
  id            bigint generated always as identity primary key,
  version       text not null check (char_length(version) between 4 and 40),
  archivo       text not null check (archivo ~ '^[A-Za-z0-9._-]+\.zip$'),
  fecha_fuente  date,
  total         int not null check (total > 0),
  cambios       jsonb not null default '{}'::jsonb,
  estado        text not null default 'publicando' check (estado in ('publicando', 'publicada', 'fallida')),
  mensaje       text,
  publicada_por uuid references public.perfiles (id) on delete set null,
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);
create index banco_versiones_creado_idx on public.banco_versiones (creado desc);

alter table public.banco_versiones enable row level security;
revoke all on public.banco_versiones from anon, authenticated;
grant select on public.banco_versiones to authenticated;

-- Solo administradores leen el historial; solo la función (clave de servicio) escribe.
create policy banco_versiones_ver on public.banco_versiones for select to authenticated
  using ((select privado.es_admin()));

-- Versión inicial, la que ya está publicada.
insert into public.banco_versiones (version, archivo, fecha_fuente, total, estado, mensaje)
values ('584b27e6e98f', 'CAP-preguntas_txt-marzo26.zip', '2026-03-04', 8655, 'publicada', 'Versión inicial');

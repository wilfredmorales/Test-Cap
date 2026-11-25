-- Parche H5 + H7 (+ índice). PROPUESTO, NO APLICADO.
-- Aplicar como migración 005. Verificación: supabase/tests/seguridad_rls.sql debe dar 30 PASA, 0 FALLA.

-- H5 · Tablas, secuencias y funciones nuevas en "public" ya no quedan abiertas a anon/authenticated.
--      Cada tabla nueva tendrá que conceder sus permisos explícitamente (y activar RLS).
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- H7 · Integridad de resultados: el cliente ya no fija la fecha ni el usuario; límites de rango.
revoke insert on public.resultados from authenticated;
grant insert (tipo, modo, preguntas, correctas, falladas, blanco, puntos, porcentaje, aprobado,
              duracion_seg, version_banco, id_cliente) on public.resultados to authenticated;
alter table public.resultados
  add constraint resultados_porcentaje_rango check (porcentaje between -1000 and 1000),
  add constraint resultados_puntos_rango     check (abs(puntos) <= 10000),
  add constraint resultados_duracion_max     check (duracion_seg is null or duracion_seg <= 86400);

-- H3/H7 · Límite anti-abuso: máximo 300 resultados por usuario y día.
create function privado.limitar_resultados() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.resultados
      where user_id = new.user_id and creado > now() - interval '1 day') >= 300 then
    raise exception 'Límite diario de resultados alcanzado' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function privado.limitar_resultados() from public, anon, authenticated;
create trigger limitar_resultados before insert on public.resultados
  for each row execute function privado.limitar_resultados();

-- Rendimiento (aviso del asesor de Supabase)
create index if not exists banco_versiones_publicada_por_idx on public.banco_versiones (publicada_por);

-- Reversión:
--   drop trigger limitar_resultados on public.resultados; drop function privado.limitar_resultados();
--   alter table public.resultados drop constraint resultados_porcentaje_rango,
--     drop constraint resultados_puntos_rango, drop constraint resultados_duracion_max;
--   grant insert on public.resultados to authenticated;
--   alter default privileges for role postgres in schema public grant all on tables to anon, authenticated; (no recomendado)

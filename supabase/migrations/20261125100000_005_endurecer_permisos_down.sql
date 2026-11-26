-- Reversión de 005
drop trigger if exists limitar_resultados on public.resultados;
drop function if exists privado.limitar_resultados();
alter table public.resultados drop constraint if exists resultados_porcentaje_rango,
  drop constraint if exists resultados_puntos_rango, drop constraint if exists resultados_duracion_max;
grant insert on public.resultados to authenticated;
drop index if exists public.banco_versiones_publicada_por_idx;
-- Los permisos por defecto no se reabren a propósito (dejarlos cerrados es lo seguro).

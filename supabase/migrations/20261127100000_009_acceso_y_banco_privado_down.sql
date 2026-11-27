-- Reversión de 009
drop function if exists public.activar_banco(text);
drop function if exists public.publicar_banco(jsonb);
drop function if exists privado.generar_muestra(jsonb);
revoke insert on public.banco_versiones from authenticated;
drop policy if exists banco_versiones_admin_ins on public.banco_versiones;
drop table if exists public.banco_muestra;
drop table if exists public.banco_completo;
drop function if exists public.mi_acceso();
drop function if exists privado.tiene_acceso();
drop table if exists public.compras;

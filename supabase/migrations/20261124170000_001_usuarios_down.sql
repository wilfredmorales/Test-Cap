-- Reversión de 001 (borra perfiles y resultados)
drop function if exists public.estadisticas_admin();
drop trigger if exists al_crear_usuario on auth.users;
drop trigger if exists al_cambiar_email on auth.users;
drop table if exists public.resultados;
drop table if exists public.perfiles;
drop type if exists public.rol_usuario;
drop schema if exists privado cascade;

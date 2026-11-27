-- Reversión de 010
drop trigger if exists limitar_sesiones on auth.sessions;
drop function if exists privado.limitar_sesiones();
drop function if exists privado.max_dispositivos();
drop function if exists public.cerrar_dispositivos_de(uuid);
drop function if exists public.dispositivos_de(uuid[]);
drop function if exists public.mi_sesion_vigente();

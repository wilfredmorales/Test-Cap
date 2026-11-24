-- 003 · La protección del perfil debe ejecutarse con los permisos de quien llama:
-- con SECURITY DEFINER, current_user era siempre el dueño y cualquiera podía cambiarse el rol.
alter function privado.proteger_perfil() security invoker;
grant execute on function privado.proteger_perfil() to authenticated;

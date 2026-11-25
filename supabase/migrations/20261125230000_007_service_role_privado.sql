-- 007 · Las Edge Functions (service_role) no podían actualizar perfiles: el trigger
-- privado.proteger_perfil (SECURITY INVOKER desde la 003) usa el esquema "privado",
-- al que service_role no tenía acceso. Síntoma: "Desactivar", "Hacer admin" y "Quitar admin"
-- fallaban con 403 desde el panel.
grant usage on schema privado to service_role;
grant execute on function privado.es_admin() to service_role;

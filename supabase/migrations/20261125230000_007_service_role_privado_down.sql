-- Reversión de 007
revoke execute on function privado.es_admin() from service_role;
revoke usage on schema privado from service_role;

-- Parche H2 · Exigir MFA (TOTP) a los administradores. PROPUESTO, NO APLICADO.
-- ORDEN OBLIGATORIO: 1) la app permite activar MFA, 2) cada admin activa su TOTP,
-- 3) se aplica este SQL y el cambio en las Edge Functions. Si se aplica antes, los admins
-- pierden el acceso al panel (no a su cuenta) hasta activar MFA.

create or replace function privado.es_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'admin' and activo
  )
  and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

-- Edge Functions (admin-usuarios y publicar-banco), tras comprobar el perfil:
--   const aal = JSON.parse(atob(jwt.split('.')[1])).aal;   // el JWT ya fue validado por getUser()
--   if (aal !== 'aal2') return respuesta(403, { error: 'Activa la verificación en dos pasos' });

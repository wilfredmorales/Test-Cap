-- 002 · estadisticas_admin usa los permisos de quien llama (RLS ya limita a admin)
alter function public.estadisticas_admin() security invoker;

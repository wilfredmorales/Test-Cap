-- Batería de pruebas de seguridad (RLS, permisos, RPC) — Test CAP
-- Uso: ejecutar entero en el editor SQL de Supabase (o con execute_sql).
-- No deja datos: siempre termina con una excepción que deshace la transacción.
-- La última línea del error dice "RESUMEN: N PASA, M FALLA" seguido del detalle.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  rb bigint; n int; ok int := 0; ko int := 0; det text := '';
begin
  -- Preparación (como sistema). Para probar "último admin", el resto de admins pasan a usuario
  -- dentro de esta transacción, que se deshace al final.
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (a,   'usuario-a@test.local', '{"nombre":"A","rol":"admin","is_admin":true}', 'authenticated', 'authenticated'),
    (b,   'usuario-b@test.local', '{"nombre":"B"}', 'authenticated', 'authenticated'),
    (adm, 'admin@test.local',     '{"nombre":"Adm"}', 'authenticated', 'authenticated');
  update public.perfiles set rol = 'admin' where id = adm;
  update public.perfiles set rol = 'usuario' where rol = 'admin' and id <> adm;
  insert into public.resultados (user_id, tipo, modo, preguntas, correctas, falladas, blanco, puntos, porcentaje, aprobado, id_cliente)
    values (b, 'viajeros', 'examen', 10, 5, 5, 0, 2.5, 25, false, gen_random_uuid()) returning id into rb;

  -- S01: los metadatos del registro no conceden rol
  select count(*) into n from public.perfiles where id = a and rol = 'usuario';
  if n = 1 then ok := ok + 1; else ko := ko + 1; det := det || ' [FALLA S01 metadata concede rol]'; end if;

  -- ===== Anónimo =====
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin perform 1 from public.perfiles limit 1; ko := ko + 1; det := det || ' [FALLA S02 anon lee perfiles]'; exception when insufficient_privilege then ok := ok + 1; end;
  begin perform 1 from public.resultados limit 1; ko := ko + 1; det := det || ' [FALLA S03 anon lee resultados]'; exception when insufficient_privilege then ok := ok + 1; end;
  begin perform 1 from public.banco_versiones limit 1; ko := ko + 1; det := det || ' [FALLA S04 anon lee versiones]'; exception when insufficient_privilege then ok := ok + 1; end;
  begin insert into public.resultados (user_id, tipo, modo, preguntas, correctas, falladas, blanco, puntos, porcentaje, aprobado, id_cliente)
          values (b, 'viajeros', 'examen', 1, 1, 0, 0, 1, 100, true, gen_random_uuid());
        ko := ko + 1; det := det || ' [FALLA S05 anon inserta]'; exception when insufficient_privilege then ok := ok + 1; end;
  begin perform public.estadisticas_admin(); ko := ko + 1; det := det || ' [FALLA S06 anon RPC]'; exception when others then ok := ok + 1; end;
  reset role;

  -- ===== Usuario A (con metadata manipulada que dice ser admin) =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated',
    'user_metadata', json_build_object('rol', 'admin', 'is_admin', true))::text, true);
  set local role authenticated;
  select count(*) into n from public.perfiles;            if n = 1 then ok := ok + 1; else ko := ko + 1; det := det || ' [FALLA S07 A ve ' || n || ' perfiles]'; end if;
  select count(*) into n from public.resultados where user_id = b; if n = 0 then ok := ok + 1; else ko := ko + 1; det := det || ' [FALLA S08 A ve resultados de B]'; end if;
  select count(*) into n from public.banco_versiones;     if n = 0 then ok := ok + 1; else ko := ko + 1; det := det || ' [FALLA S09 A ve versiones]'; end if;
  update public.perfiles set nombre = 'x' where id = b; get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else ko := ko + 1; det := det || ' [FALLA S10 A edita perfil de B]'; end if;
  begin update public.perfiles set rol = 'admin' where id = a; ko := ko + 1; det := det || ' [FALLA S11 A se hace admin]'; exception when others then ok := ok + 1; end;
  begin update public.perfiles set id = b where id = a; ko := ko + 1; det := det || ' [FALLA S12 A cambia su id]'; exception when others then ok := ok + 1; end;
  begin update public.perfiles set email = 'robo@x.com' where id = a; ko := ko + 1; det := det || ' [FALLA S13 A cambia email]'; exception when others then ok := ok + 1; end;
  begin insert into public.resultados (user_id, tipo, modo, preguntas, correctas, falladas, blanco, puntos, porcentaje, aprobado, id_cliente)
          values (b, 'mercancias', 'examen', 1, 1, 0, 0, 1, 100, true, gen_random_uuid());
        ko := ko + 1; det := det || ' [FALLA S14 A inserta como B]'; exception when others then ok := ok + 1; end;
  begin update public.resultados set aprobado = true where id = rb; ko := ko + 1; det := det || ' [FALLA S15 A modifica resultados]'; exception when insufficient_privilege then ok := ok + 1; end;
  begin delete from public.resultados where id = rb; ko := ko + 1; det := det || ' [FALLA S16 A borra resultados]'; exception when insufficient_privilege then ok := ok + 1; end;
  begin perform public.estadisticas_admin(); ko := ko + 1; det := det || ' [FALLA S17 A RPC admin]'; exception when others then ok := ok + 1; end;
  begin insert into public.banco_versiones (version, archivo, total) values ('aaaaaaaaaaaa', 'x.zip', 200); ko := ko + 1; det := det || ' [FALLA S18 A inserta versiones]'; exception when insufficient_privilege then ok := ok + 1; end;
  begin perform privado.crear_perfil(); ko := ko + 1; det := det || ' [FALLA S19 A llama trigger]'; exception when others then ok := ok + 1; end;
  -- S20 (integridad, parche H7): resultado con fecha falsa debe rechazarse
  begin insert into public.resultados (tipo, modo, preguntas, correctas, falladas, blanco, puntos, porcentaje, aprobado, id_cliente, creado)
          values ('mercancias', 'examen', 100, 100, 0, 0, 100, 100, true, gen_random_uuid(), '2020-01-01');
        ko := ko + 1; det := det || ' [FALLA S20 A fija la fecha de su resultado (H7)]'; exception when others then ok := ok + 1; end;
  -- S21 (integridad, parche H7): porcentaje fuera de rango debe rechazarse
  begin insert into public.resultados (tipo, modo, preguntas, correctas, falladas, blanco, puntos, porcentaje, aprobado, id_cliente)
          values ('mercancias', 'examen', 100, 100, 0, 0, 100, 9999, true, gen_random_uuid());
        ko := ko + 1; det := det || ' [FALLA S21 porcentaje 9999 aceptado (H7)]'; exception when others then ok := ok + 1; end;
  -- S21b (compatibilidad): el insert que hace la app debe seguir funcionando
  begin insert into public.resultados (tipo, modo, preguntas, correctas, falladas, blanco, puntos, porcentaje, aprobado, duracion_seg, version_banco, id_cliente)
          values ('mercancias', 'examen', 100, 70, 20, 10, 60, 60, true, 3600, '584b27e6e98f', gen_random_uuid());
        ok := ok + 1; exception when others then ko := ko + 1; det := det || ' [FALLA S21b insert normal de la app: ' || sqlerrm || ']'; end;
  reset role;

  -- ===== Usuario B desactivado =====
  update public.perfiles set activo = false where id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin insert into public.resultados (tipo, modo, preguntas, correctas, falladas, blanco, puntos, porcentaje, aprobado, id_cliente)
          values ('viajeros', 'examen', 1, 1, 0, 0, 1, 100, true, gen_random_uuid());
        ko := ko + 1; det := det || ' [FALLA S22 desactivado guarda]'; exception when others then ok := ok + 1; end;
  begin update public.perfiles set activo = true where id = b; ko := ko + 1; det := det || ' [FALLA S23 desactivado se reactiva]'; exception when others then ok := ok + 1; end;
  reset role;

  -- ===== Administrador =====
  -- S31-S32 (spec 003, fase B): un admin SIN verificación en dos pasos (aal1) no es admin
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role authenticated;
  select count(*) into n from public.perfiles where id in (a, b, adm);
  if n = 1 then ok := ok + 1; else ko := ko + 1; det := det || ' [FALLA S31 admin aal1 ve ' || n || ' perfiles]'; end if;
  begin perform public.estadisticas_admin(); ko := ko + 1; det := det || ' [FALLA S32 admin aal1 usa RPC admin]'; exception when others then ok := ok + 1; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  set local role authenticated;
  select count(*) into n from public.perfiles where id in (a, b, adm); if n = 3 then ok := ok + 1; else ko := ko + 1; det := det || ' [FALLA S24 admin no ve perfiles]'; end if;
  begin delete from public.perfiles where id = b; ko := ko + 1; det := det || ' [FALLA S25 admin borra perfil por API]'; exception when insufficient_privilege then ok := ok + 1; end;
  begin update public.resultados set aprobado = true where id = rb; ko := ko + 1; det := det || ' [FALLA S26 admin modifica resultados]'; exception when insufficient_privilege then ok := ok + 1; end;
  begin update public.perfiles set rol = 'usuario' where id = adm; ko := ko + 1; det := det || ' [FALLA S27 último admin se degrada]'; exception when others then ok := ok + 1; end;
  begin update public.perfiles set activo = false where id = adm; ko := ko + 1; det := det || ' [FALLA S28 último admin se desactiva]'; exception when others then ok := ok + 1; end;
  update public.perfiles set rol = 'admin' where id = a; get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else ko := ko + 1; det := det || ' [FALLA S29 admin no puede promover]'; end if;
  reset role;

  -- ===== Permisos por defecto (parche H5): una tabla nueva no debe quedar abierta =====
  create table public._prueba_permisos_por_defecto (x int);
  if has_table_privilege('anon', 'public._prueba_permisos_por_defecto', 'select') then
    ko := ko + 1; det := det || ' [FALLA S30 tabla nueva accesible a anon (H5)]';
  else ok := ok + 1; end if;

  raise exception 'RESUMEN: % PASA, % FALLA.%', ok, ko, coalesce(nullif(det, ''), ' Todo correcto.');
end $$;

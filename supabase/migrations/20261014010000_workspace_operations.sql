-- Transacciones de inventario, horarios y despacho. Aplicar después de 002.
-- Las escrituras pasan por RPC y vuelven a validar el rol dentro de PostgreSQL.

ALTER TABLE public.despachos
  ADD COLUMN IF NOT EXISTS solicitud_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_despachos_solicitud_id
  ON public.despachos (solicitud_id)
  WHERE solicitud_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_dispensing_appointments()
RETURNS TABLE (
  id UUID, paciente_id UUID, medico_id UUID, fecha DATE, hora TIME,
  estado TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'farmaceutico' THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT c.id,c.paciente_id,c.medico_id,c.fecha,c.hora,c.estado,c.created_at,c.updated_at
  FROM public.citas c
  WHERE c.estado IN ('confirmada','completada')
    AND NOT EXISTS (SELECT 1 FROM public.despachos d WHERE d.cita_id=c.id AND d.estado='entregado')
  ORDER BY c.fecha DESC,c.hora DESC
  LIMIT 500;
END $$;

CREATE OR REPLACE FUNCTION public.get_dispensing_people(p_ids UUID[])
RETURNS TABLE (id UUID,nombre TEXT,apellido TEXT,rol TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'farmaceutico' THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT p.id,p.nombre,p.apellido,p.rol
  FROM public.profiles p
  WHERE p.activo AND p.rol='paciente' AND p_ids IS NOT NULL AND p.id=ANY(p_ids)
    AND (
      EXISTS (
        SELECT 1 FROM public.citas c
        WHERE c.paciente_id=p.id AND c.estado IN ('confirmada','completada')
          AND NOT EXISTS (SELECT 1 FROM public.despachos d WHERE d.cita_id=c.id AND d.estado='entregado')
      )
      OR EXISTS (
        SELECT 1 FROM public.despachos d
        WHERE d.paciente_id=p.id AND d.farmaceutico_id=auth.uid()
      )
    );
END $$;

CREATE OR REPLACE FUNCTION public.create_medication(
  p_nombre TEXT, p_codigo TEXT, p_descripcion TEXT, p_unidad_medida TEXT,
  p_stock_minimo INTEGER, p_numero_lote TEXT, p_fecha_vencimiento DATE,
  p_cantidad INTEGER
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_med UUID; v_lote UUID; v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
  IF COALESCE(public.current_app_role(), '') NOT IN ('admin', 'farmaceutico') THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_cantidad <= 0 OR p_stock_minimo < 0 OR p_fecha_vencimiento < v_now::DATE THEN
    RAISE EXCEPTION 'Datos de inventario inválidos' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.medicamentos(nombre,codigo,descripcion,unidad_medida,stock_minimo)
  VALUES (pg_catalog.btrim(p_nombre),pg_catalog.btrim(p_codigo),NULLIF(pg_catalog.btrim(p_descripcion),''),pg_catalog.btrim(p_unidad_medida),p_stock_minimo)
  RETURNING id INTO v_med;
  INSERT INTO public.lotes(medicamento_id,numero_lote,fecha_vencimiento,cantidad)
  VALUES(v_med,pg_catalog.btrim(p_numero_lote),p_fecha_vencimiento,p_cantidad)
  RETURNING id INTO v_lote;
  INSERT INTO public.inventory_movements(medicamento_id,lote_id,tipo,cantidad_delta,motivo,usuario_id)
  VALUES(v_med,v_lote,'entrada',p_cantidad,'Existencia inicial',auth.uid());
  INSERT INTO public.auditoria(usuario_id,accion,tabla_afectada,registro_id,datos_nuevos,created_at)
  VALUES(auth.uid(),'Medicamento creado','medicamentos',v_med,pg_catalog.jsonb_build_object('codigo',p_codigo,'lote_id',v_lote,'cantidad',p_cantidad),v_now);
  RETURN v_med;
END $$;

CREATE OR REPLACE FUNCTION public.add_stock(
  p_medicamento_id UUID, p_numero_lote TEXT, p_fecha_vencimiento DATE,
  p_cantidad INTEGER
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_lote UUID; v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
  IF COALESCE(public.current_app_role(), '') NOT IN ('admin','farmaceutico') THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF p_cantidad <= 0 OR p_fecha_vencimiento < v_now::DATE THEN RAISE EXCEPTION 'Datos de inventario inválidos' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.medicamentos WHERE id=p_medicamento_id AND activo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Medicamento no disponible' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.lotes(medicamento_id,numero_lote,fecha_vencimiento,cantidad)
  VALUES(p_medicamento_id,pg_catalog.btrim(p_numero_lote),p_fecha_vencimiento,p_cantidad)
  RETURNING id INTO v_lote;
  INSERT INTO public.inventory_movements(medicamento_id,lote_id,tipo,cantidad_delta,motivo,usuario_id)
  VALUES(p_medicamento_id,v_lote,'entrada',p_cantidad,'Ingreso de inventario',auth.uid());
  INSERT INTO public.auditoria(usuario_id,accion,tabla_afectada,registro_id,datos_nuevos,created_at)
  VALUES(auth.uid(),'Ingreso de inventario','lotes',v_lote,pg_catalog.jsonb_build_object('medicamento_id',p_medicamento_id,'cantidad',p_cantidad),v_now);
  RETURN v_lote;
END $$;

CREATE OR REPLACE FUNCTION public.update_medication(
  p_id UUID,p_nombre TEXT,p_codigo TEXT,p_descripcion TEXT,
  p_unidad_medida TEXT,p_stock_minimo INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_before JSONB;
BEGIN
  IF COALESCE(public.current_app_role(), '') NOT IN ('admin','farmaceutico') THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT pg_catalog.to_jsonb(m) INTO v_before FROM public.medicamentos m WHERE m.id=p_id AND m.activo FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'Medicamento no disponible' USING ERRCODE='P0002'; END IF;
  IF p_stock_minimo < 0 THEN RAISE EXCEPTION 'Stock mínimo inválido' USING ERRCODE='22023'; END IF;
  UPDATE public.medicamentos SET nombre=pg_catalog.btrim(p_nombre),codigo=pg_catalog.btrim(p_codigo),descripcion=NULLIF(pg_catalog.btrim(p_descripcion),''),unidad_medida=pg_catalog.btrim(p_unidad_medida),stock_minimo=p_stock_minimo WHERE id=p_id;
  INSERT INTO public.auditoria(usuario_id,accion,tabla_afectada,registro_id,datos_anteriores,datos_nuevos)
  VALUES(auth.uid(),'Medicamento actualizado','medicamentos',p_id,v_before,(SELECT pg_catalog.to_jsonb(m) FROM public.medicamentos m WHERE m.id=p_id));
  RETURN TRUE;
END $$;

CREATE OR REPLACE FUNCTION public.archive_medication(p_id UUID,p_motivo TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_before JSONB;
BEGIN
  IF COALESCE(public.current_app_role(), '') NOT IN ('admin','farmaceutico') THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT pg_catalog.to_jsonb(m) INTO v_before FROM public.medicamentos m WHERE m.id=p_id AND m.activo FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'Medicamento no disponible' USING ERRCODE='P0002'; END IF;
  IF EXISTS(SELECT 1 FROM public.lotes WHERE medicamento_id=p_id AND cantidad>0) THEN RAISE EXCEPTION 'El medicamento conserva existencias' USING ERRCODE='P0001'; END IF;
  UPDATE public.medicamentos SET activo=FALSE WHERE id=p_id;
  INSERT INTO public.auditoria(usuario_id,accion,tabla_afectada,registro_id,datos_anteriores,datos_nuevos)
  VALUES(auth.uid(),'Medicamento archivado','medicamentos',p_id,v_before,pg_catalog.jsonb_build_object('activo',FALSE,'motivo',p_motivo));
  RETURN TRUE;
END $$;

CREATE OR REPLACE FUNCTION public.update_batch(
  p_id UUID,p_numero_lote TEXT,p_fecha_vencimiento DATE,p_cantidad INTEGER,p_motivo TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_lote public.lotes%ROWTYPE; v_delta INTEGER;
BEGIN
  IF COALESCE(public.current_app_role(), '') NOT IN ('admin','farmaceutico') THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT l.* INTO v_lote FROM public.lotes l JOIN public.medicamentos m ON m.id=l.medicamento_id WHERE l.id=p_id AND m.activo FOR UPDATE OF l;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote no disponible' USING ERRCODE='P0002'; END IF;
  IF p_cantidad<0 OR p_fecha_vencimiento<pg_catalog.now()::DATE OR pg_catalog.btrim(p_motivo)='' THEN RAISE EXCEPTION 'Ajuste inválido' USING ERRCODE='22023'; END IF;
  v_delta := p_cantidad-v_lote.cantidad;
  UPDATE public.lotes SET numero_lote=pg_catalog.btrim(p_numero_lote),fecha_vencimiento=p_fecha_vencimiento,cantidad=p_cantidad WHERE id=p_id;
  IF v_delta<>0 THEN
    INSERT INTO public.inventory_movements(medicamento_id,lote_id,tipo,cantidad_delta,motivo,usuario_id)
    VALUES(v_lote.medicamento_id,p_id,'ajuste',v_delta,pg_catalog.btrim(p_motivo),auth.uid());
  END IF;
  INSERT INTO public.auditoria(usuario_id,accion,tabla_afectada,registro_id,datos_anteriores,datos_nuevos)
  VALUES(auth.uid(),'Lote ajustado','lotes',p_id,pg_catalog.to_jsonb(v_lote),pg_catalog.jsonb_build_object('cantidad',p_cantidad,'delta',v_delta,'motivo',p_motivo));
  RETURN TRUE;
END $$;

CREATE OR REPLACE FUNCTION public.save_schedule(
  p_id UUID,p_medico_id UUID,p_fecha DATE,p_desde TIME,p_hasta TIME
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id UUID := COALESCE(p_id,gen_random_uuid()); v_old public.horarios%ROWTYPE;
BEGIN
  IF COALESCE(public.current_app_role(), '') NOT IN ('admin','medico') THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF public.current_app_role()='medico' AND auth.uid()<>p_medico_id THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF p_desde>=p_hasta OR (p_fecha+p_desde)::TIMESTAMP <= (pg_catalog.now() AT TIME ZONE 'America/Bogota') OR EXTRACT(MINUTE FROM p_desde) NOT IN (0,30) OR EXTRACT(MINUTE FROM p_hasta) NOT IN (0,30) THEN RAISE EXCEPTION 'Rango de horario inválido' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_medico_id AND rol='medico' AND activo) THEN RAISE EXCEPTION 'Médico no disponible' USING ERRCODE='P0002'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_medico_id::TEXT,0));
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.horarios WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR v_old.medico_id<>p_medico_id OR v_old.estado<>'activo' THEN RAISE EXCEPTION 'Horario no disponible' USING ERRCODE='P0002'; END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM public.horarios h WHERE h.id<>v_id AND h.medico_id=p_medico_id AND h.fecha=p_fecha AND h.estado='activo' AND h.desde<p_hasta AND h.hasta>p_desde) THEN RAISE EXCEPTION 'El horario se cruza con otro' USING ERRCODE='23505'; END IF;
  IF p_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.citas c WHERE c.medico_id=p_medico_id AND c.estado IN ('pendiente','confirmada') AND c.fecha=v_old.fecha AND c.hora>=v_old.desde AND c.hora<v_old.hasta AND (c.fecha<>p_fecha OR c.hora<p_desde OR c.hora>=p_hasta)) THEN RAISE EXCEPTION 'El horario tiene citas activas' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.horarios(id,medico_id,fecha,desde,hasta,estado) VALUES(v_id,p_medico_id,p_fecha,p_desde,p_hasta,'activo')
  ON CONFLICT(id) DO UPDATE SET fecha=EXCLUDED.fecha,desde=EXCLUDED.desde,hasta=EXCLUDED.hasta;
  INSERT INTO public.auditoria(usuario_id,accion,tabla_afectada,registro_id,datos_nuevos)
  VALUES(auth.uid(),'Horario guardado','horarios',v_id,pg_catalog.jsonb_build_object('fecha',p_fecha,'desde',p_desde,'hasta',p_hasta));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_schedule(p_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_h public.horarios%ROWTYPE;
BEGIN
  IF COALESCE(public.current_app_role(), '') NOT IN ('admin','medico') THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_h FROM public.horarios WHERE id=p_id;
  IF NOT FOUND OR v_h.estado<>'activo' THEN RAISE EXCEPTION 'Horario no disponible' USING ERRCODE='P0002'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_h.medico_id::TEXT,0));
  SELECT * INTO v_h FROM public.horarios WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_h.estado<>'activo' THEN RAISE EXCEPTION 'Horario no disponible' USING ERRCODE='P0002'; END IF;
  IF public.current_app_role()='medico' AND v_h.medico_id<>auth.uid() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.citas WHERE medico_id=v_h.medico_id AND fecha=v_h.fecha AND hora>=v_h.desde AND hora<v_h.hasta AND estado IN ('pendiente','confirmada')) THEN RAISE EXCEPTION 'El horario tiene citas activas' USING ERRCODE='P0001'; END IF;
  UPDATE public.horarios SET estado='cancelado' WHERE id=p_id;
  INSERT INTO public.auditoria(usuario_id,accion,tabla_afectada,registro_id,datos_anteriores,datos_nuevos)
  VALUES(auth.uid(),'Horario cancelado','horarios',p_id,pg_catalog.to_jsonb(v_h),pg_catalog.jsonb_build_object('estado','cancelado'));
  RETURN TRUE;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_active_appointment_schedule()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.estado IN ('pendiente','confirmada') THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.medico_id::TEXT,0));
    IF NOT EXISTS (
      SELECT 1 FROM public.horarios h
      WHERE h.medico_id=NEW.medico_id AND h.fecha=NEW.fecha AND h.estado='activo'
        AND h.desde<=NEW.hora AND NEW.hora<h.hasta
    ) THEN
      RAISE EXCEPTION 'El cupo no está publicado' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS citas_require_active_schedule ON public.citas;
CREATE TRIGGER citas_require_active_schedule
  BEFORE INSERT OR UPDATE OF medico_id,fecha,hora,estado ON public.citas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_appointment_schedule();

CREATE OR REPLACE FUNCTION public.create_dispatch(p_cita_id UUID,p_solicitud_id UUID,p_items JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_dispatch UUID; v_cita public.citas%ROWTYPE; v_item JSONB; v_lote public.lotes%ROWTYPE; v_med UUID; v_qty INTEGER; v_total INTEGER:=0;
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'farmaceutico' THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_solicitud_id::TEXT,0));
  SELECT id INTO v_dispatch FROM public.despachos WHERE solicitud_id=p_solicitud_id;
  IF FOUND THEN RETURN v_dispatch; END IF;
  IF pg_catalog.jsonb_typeof(p_items)<>'array' OR pg_catalog.jsonb_array_length(p_items)=0 OR pg_catalog.jsonb_array_length(p_items)>30 THEN RAISE EXCEPTION 'Detalle inválido' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_cita FROM public.citas WHERE id=p_cita_id FOR UPDATE;
  IF NOT FOUND OR v_cita.estado NOT IN ('confirmada','completada') THEN RAISE EXCEPTION 'Cita no disponible para despacho' USING ERRCODE='P0002'; END IF;
  IF EXISTS(SELECT 1 FROM public.despachos WHERE cita_id=p_cita_id AND estado='entregado') THEN RAISE EXCEPTION 'La cita ya tiene un despacho entregado' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.despachos(cita_id,paciente_id,farmaceutico_id,estado,solicitud_id)
  VALUES(p_cita_id,v_cita.paciente_id,auth.uid(),'entregado',p_solicitud_id) RETURNING id INTO v_dispatch;
  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_items) ORDER BY value->>'lote_id' LOOP
    SELECT medicamento_id INTO v_med FROM public.lotes WHERE id=(v_item->>'lote_id')::UUID;
    IF v_med IS NULL THEN RAISE EXCEPTION 'Lote no disponible' USING ERRCODE='P0002'; END IF;
    v_qty := (v_item->>'cantidad')::INTEGER;
    IF v_qty<=0 THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='22023'; END IF;
    v_total:=v_total+v_qty;
    IF v_total>100000 THEN RAISE EXCEPTION 'Cantidad total inválida' USING ERRCODE='22023'; END IF;
    SELECT l.* INTO v_lote FROM public.lotes l JOIN public.medicamentos m ON m.id=l.medicamento_id WHERE l.id=(v_item->>'lote_id')::UUID AND l.medicamento_id=v_med AND m.activo AND l.fecha_vencimiento>=pg_catalog.now()::DATE FOR UPDATE OF l;
    IF NOT FOUND OR v_lote.cantidad<v_qty THEN RAISE EXCEPTION 'Lote vencido o con existencias insuficientes' USING ERRCODE='P0001'; END IF;
    UPDATE public.lotes SET cantidad=cantidad-v_qty WHERE id=v_lote.id;
    INSERT INTO public.despacho_items(despacho_id,medicamento_id,lote_id,cantidad) VALUES(v_dispatch,v_med,v_lote.id,v_qty);
    INSERT INTO public.inventory_movements(medicamento_id,lote_id,tipo,cantidad_delta,motivo,referencia_id,usuario_id)
    VALUES(v_med,v_lote.id,'salida',-v_qty,'Despacho de cita',v_dispatch,auth.uid());
  END LOOP;
  INSERT INTO public.auditoria(usuario_id,accion,tabla_afectada,registro_id,datos_nuevos)
  VALUES(auth.uid(),'Despacho entregado','despachos',v_dispatch,pg_catalog.jsonb_build_object('cita_id',p_cita_id,'solicitud_id',p_solicitud_id,'items',p_items));
  RETURN v_dispatch;
END $$;

CREATE OR REPLACE FUNCTION public.update_own_profile(p_nombre TEXT,p_apellido TEXT,p_telefono TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_before JSONB;
BEGIN
  SELECT pg_catalog.jsonb_build_object('nombre',p.nombre,'apellido',p.apellido,'telefono',p.telefono)
  INTO v_before FROM public.profiles p WHERE p.id=auth.uid() AND p.activo FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'Perfil no disponible' USING ERRCODE='P0002'; END IF;
  UPDATE public.profiles SET nombre=pg_catalog.btrim(p_nombre),apellido=pg_catalog.btrim(p_apellido),telefono=NULLIF(pg_catalog.btrim(p_telefono),'') WHERE id=auth.uid();
  INSERT INTO public.auditoria(usuario_id,accion,tabla_afectada,registro_id,datos_anteriores,datos_nuevos)
  VALUES(auth.uid(),'Perfil actualizado','profiles',auth.uid(),v_before,pg_catalog.jsonb_build_object('nombre',p_nombre,'apellido',p_apellido,'telefono',p_telefono));
  RETURN TRUE;
END $$;

CREATE OR REPLACE FUNCTION public.update_user_admin(p_id UUID,p_rol TEXT,p_activo BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_before JSONB;
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF p_id=auth.uid() AND (p_rol<>'admin' OR NOT p_activo) THEN RAISE EXCEPTION 'No puedes retirar tu propio acceso de administrador' USING ERRCODE='22023'; END IF;
  SELECT pg_catalog.jsonb_build_object('nombre',p.nombre,'apellido',p.apellido,'rol',p.rol,'activo',p.activo)
  INTO v_before FROM public.profiles p WHERE p.id=p_id FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'Usuario no disponible' USING ERRCODE='P0002'; END IF;
  UPDATE public.profiles SET rol=p_rol,activo=p_activo WHERE id=p_id;
  INSERT INTO public.auditoria(usuario_id,accion,tabla_afectada,registro_id,datos_anteriores,datos_nuevos)
  VALUES(auth.uid(),'Usuario actualizado','profiles',p_id,v_before,pg_catalog.jsonb_build_object('rol',p_rol,'activo',p_activo));
  RETURN TRUE;
END $$;

-- Solo el servidor puede ejecutar este RPC después de validar a un administrador
-- y crear la identidad mediante Supabase Auth Admin API.
CREATE OR REPLACE FUNCTION public.create_profile_admin(
  p_actor_id UUID,p_user_id UUID,p_email TEXT,p_nombre TEXT,p_apellido TEXT,
  p_telefono TEXT,p_documento TEXT,p_rol TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor_id AND rol='admin' AND activo) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.profiles(id,email,nombre,apellido,telefono,documento_identidad,rol,activo)
  VALUES(p_user_id,pg_catalog.lower(pg_catalog.btrim(p_email)),pg_catalog.btrim(p_nombre),pg_catalog.btrim(p_apellido),NULLIF(pg_catalog.btrim(p_telefono),''),pg_catalog.btrim(p_documento),p_rol,TRUE);
  INSERT INTO public.auditoria(usuario_id,accion,tabla_afectada,registro_id,datos_nuevos)
  VALUES(p_actor_id,'Usuario creado','profiles',p_user_id,pg_catalog.jsonb_build_object('rol',p_rol));
  RETURN TRUE;
END $$;

REVOKE ALL ON FUNCTION public.create_medication(TEXT,TEXT,TEXT,TEXT,INTEGER,TEXT,DATE,INTEGER) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.add_stock(UUID,TEXT,DATE,INTEGER) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_medication(UUID,TEXT,TEXT,TEXT,TEXT,INTEGER) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.archive_medication(UUID,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_batch(UUID,TEXT,DATE,INTEGER,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_schedule(UUID,UUID,DATE,TIME,TIME) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.cancel_schedule(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_dispatch(UUID,UUID,JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_own_profile(TEXT,TEXT,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_user_admin(UUID,TEXT,BOOLEAN) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_profile_admin(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.enforce_active_appointment_schedule() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_dispensing_appointments() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_dispensing_people(UUID[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_medication(TEXT,TEXT,TEXT,TEXT,INTEGER,TEXT,DATE,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_stock(UUID,TEXT,DATE,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_medication(UUID,TEXT,TEXT,TEXT,TEXT,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_medication(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_batch(UUID,TEXT,DATE,INTEGER,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_schedule(UUID,UUID,DATE,TIME,TIME) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_schedule(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_dispatch(UUID,UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_profile(TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_admin(UUID,TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_admin(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_dispensing_appointments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dispensing_people(UUID[]) TO authenticated;

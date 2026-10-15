-- API prerequisites: role helpers, scoped reads, availability, and domain tables.
-- Apply after 001_initial_schema.sql. This migration is safe to re-run in a
-- development project, but it does not replace a review of existing data.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.medicamentos
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lotes_id_medicamento
  ON public.lotes (id, medicamento_id);

ALTER TABLE public.lotes
  DROP CONSTRAINT IF EXISTS lotes_cantidad_no_negativa;
ALTER TABLE public.lotes
  ADD CONSTRAINT lotes_cantidad_no_negativa
  CHECK (cantidad >= 0) NOT VALID;
ALTER TABLE public.lotes
  VALIDATE CONSTRAINT lotes_cantidad_no_negativa;

ALTER TABLE public.medicamentos
  DROP CONSTRAINT IF EXISTS medicamentos_stock_minimo_no_negativo;
ALTER TABLE public.medicamentos
  ADD CONSTRAINT medicamentos_stock_minimo_no_negativo
  CHECK (stock_minimo >= 0) NOT VALID;
ALTER TABLE public.medicamentos
  VALIDATE CONSTRAINT medicamentos_stock_minimo_no_negativo;

CREATE TABLE IF NOT EXISTS public.horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id UUID NOT NULL REFERENCES public.profiles(id),
  fecha DATE NOT NULL,
  desde TIME NOT NULL,
  hasta TIME NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT horarios_rango_valido CHECK (desde < hasta),
  CONSTRAINT horarios_franjas_validas CHECK (
    EXTRACT(MINUTE FROM desde) IN (0, 30)
    AND EXTRACT(SECOND FROM desde) = 0
    AND EXTRACT(MINUTE FROM hasta) IN (0, 30)
    AND EXTRACT(SECOND FROM hasta) = 0
  )
);

CREATE INDEX IF NOT EXISTS idx_horarios_medico_fecha_estado
  ON public.horarios (medico_id, fecha, estado);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id UUID NOT NULL REFERENCES public.medicamentos(id),
  lote_id UUID REFERENCES public.lotes(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad_delta INTEGER NOT NULL CHECK (cantidad_delta <> 0),
  motivo TEXT NOT NULL,
  referencia_id UUID,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_movements_lote_medicamento_fk
    FOREIGN KEY (lote_id, medicamento_id)
    REFERENCES public.lotes (id, medicamento_id),
  CONSTRAINT inventory_movements_tipo_delta CHECK (
    (tipo = 'entrada' AND cantidad_delta > 0) OR
    (tipo = 'salida' AND cantidad_delta < 0) OR
    tipo = 'ajuste'
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_medicamento_fecha
  ON public.inventory_movements (medicamento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_lote_fecha
  ON public.inventory_movements (lote_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_usuario_fecha
  ON public.inventory_movements (usuario_id, created_at DESC);

ALTER TABLE public.despacho_items
  DROP CONSTRAINT IF EXISTS despacho_items_lote_medicamento_fk;
ALTER TABLE public.despacho_items
  ADD CONSTRAINT despacho_items_lote_medicamento_fk
  FOREIGN KEY (lote_id, medicamento_id)
  REFERENCES public.lotes (id, medicamento_id) NOT VALID;
ALTER TABLE public.despacho_items
  VALIDATE CONSTRAINT despacho_items_lote_medicamento_fk;

CREATE UNIQUE INDEX IF NOT EXISTS idx_citas_slot_activo
  ON public.citas (medico_id, fecha, hora)
  WHERE estado IN ('pendiente', 'confirmada');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_horarios_updated_at ON public.horarios;
CREATE TRIGGER update_horarios_updated_at
  BEFORE UPDATE ON public.horarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.reject_inventory_movement_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Los movimientos de inventario son inmutables'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS inventory_movements_immutable
  ON public.inventory_movements;
CREATE TRIGGER inventory_movements_immutable
  BEFORE UPDATE OR DELETE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.reject_inventory_movement_mutation();

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.rol
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
    AND p.activo = TRUE
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.*
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_admin_profiles()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.*
  FROM public.profiles AS p
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_people(
  p_ids UUID[],
  p_include_doctor_directory BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (id UUID, nombre TEXT, apellido TEXT, rol TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT := public.current_app_role();
BEGIN
  IF auth.uid() IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.nombre, p.apellido, p.rol
  FROM public.profiles AS p
  WHERE p.activo = TRUE
    AND (
      v_role = 'admin'
      OR p.id = auth.uid()
      OR (
        p_include_doctor_directory
        AND v_role = 'paciente'
        AND p.rol = 'medico'
      )
      OR (
        p_ids IS NOT NULL
        AND p.id = ANY(p_ids)
        AND (
          EXISTS (
            SELECT 1
            FROM public.citas AS c
            WHERE (c.paciente_id = auth.uid() AND c.medico_id = p.id)
               OR (c.medico_id = auth.uid() AND c.paciente_id = p.id)
          )
          OR EXISTS (
            SELECT 1
            FROM public.despachos AS d
            WHERE (d.farmaceutico_id = auth.uid() AND d.paciente_id = p.id)
               OR (d.paciente_id = auth.uid() AND d.farmaceutico_id = p.id)
          )
        )
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_profiles() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_workspace_people(UUID[], BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_people(UUID[], BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_medico_id UUID,
  p_fecha DATE,
  p_excluir_cita_id UUID DEFAULT NULL
)
RETURNS TABLE (hora TIME)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT := public.current_app_role();
BEGIN
  IF auth.uid() IS NULL
     OR v_role IS NULL
     OR v_role NOT IN ('admin', 'medico', 'paciente') THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_fecha IS NULL OR p_medico_id IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'medico' AND p_medico_id <> auth.uid() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_fecha < (pg_catalog.now() AT TIME ZONE 'America/Bogota')::DATE THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = p_medico_id
      AND p.rol = 'medico'
      AND p.activo = TRUE
  ) THEN
    RETURN;
  END IF;

  IF p_excluir_cita_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.citas AS c
    WHERE c.id = p_excluir_cita_id
      AND c.medico_id = p_medico_id
      AND (
        v_role = 'admin' OR
        (v_role = 'paciente' AND c.paciente_id = auth.uid()) OR
        (v_role = 'medico' AND c.medico_id = auth.uid())
      )
  ) THEN
    RAISE EXCEPTION 'Cita no disponible' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT DISTINCT generated.slot_at::TIME
  FROM public.horarios AS h
  CROSS JOIN LATERAL pg_catalog.generate_series(
    (p_fecha + h.desde)::TIMESTAMP,
    (p_fecha + h.hasta - INTERVAL '30 minutes')::TIMESTAMP,
    INTERVAL '30 minutes'
  ) AS generated(slot_at)
  WHERE h.medico_id = p_medico_id
    AND h.fecha = p_fecha
    AND h.estado = 'activo'
    AND generated.slot_at > (pg_catalog.now() AT TIME ZONE 'America/Bogota')
    AND NOT EXISTS (
      SELECT 1
      FROM public.citas AS c
      WHERE c.medico_id = p_medico_id
        AND c.fecha = p_fecha
        AND c.hora = generated.slot_at::TIME
        AND c.estado IN ('pendiente', 'confirmada')
        AND c.id IS DISTINCT FROM p_excluir_cita_id
    )
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_slots(UUID, DATE, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_available_slots(UUID, DATE, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, DATE, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_paciente_id UUID,
  p_medico_id UUID,
  p_fecha DATE,
  p_hora TIME,
  p_motivo TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT := public.current_app_role();
  v_paciente_id UUID;
  v_cita_id UUID;
  v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
  IF auth.uid() IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'paciente' THEN
    v_paciente_id := auth.uid();
    IF p_paciente_id IS DISTINCT FROM v_paciente_id THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
    END IF;
  ELSIF v_role = 'admin' THEN
    v_paciente_id := p_paciente_id;
  ELSE
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_fecha IS NULL OR p_hora IS NULL
     OR p_motivo IS NULL
     OR pg_catalog.length(pg_catalog.btrim(p_motivo)) = 0
     OR pg_catalog.length(p_motivo) > 500
     OR EXTRACT(MINUTE FROM p_hora) NOT IN (0, 30)
     OR EXTRACT(SECOND FROM p_hora) <> 0 THEN
    RAISE EXCEPTION 'Datos de cita inválidos' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = v_paciente_id AND p.rol = 'paciente' AND p.activo = TRUE
  ) OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = p_medico_id AND p.rol = 'medico' AND p.activo = TRUE
  ) THEN
    RAISE EXCEPTION 'Paciente o profesional no disponible' USING ERRCODE = '22023';
  END IF;

  IF (p_fecha + p_hora)::TIMESTAMP <=
     (pg_catalog.now() AT TIME ZONE 'America/Bogota') THEN
    RAISE EXCEPTION 'La fecha debe ser futura' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.horarios AS h
    WHERE h.medico_id = p_medico_id
      AND h.fecha = p_fecha
      AND h.estado = 'activo'
      AND h.desde <= p_hora
      AND p_hora < h.hasta
  ) THEN
    RAISE EXCEPTION 'El cupo no está publicado' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.citas (
    paciente_id, medico_id, fecha, hora, motivo, estado
  ) VALUES (
    v_paciente_id, p_medico_id, p_fecha, p_hora,
    pg_catalog.btrim(p_motivo), 'pendiente'
  )
  RETURNING id INTO v_cita_id;

  INSERT INTO public.auditoria (
    usuario_id, accion, tabla_afectada, registro_id,
    datos_nuevos, created_at
  ) VALUES (
    auth.uid(), 'Cita agendada', 'citas', v_cita_id,
    pg_catalog.jsonb_build_object(
      'paciente_id', v_paciente_id,
      'medico_id', p_medico_id,
      'fecha', p_fecha,
      'hora', p_hora,
      'estado', 'pendiente'
    ),
    v_now
  );

  RETURN v_cita_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_appointment(
  p_cita_id UUID,
  p_new_estado TEXT DEFAULT NULL,
  p_new_fecha DATE DEFAULT NULL,
  p_new_hora TIME DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT := public.current_app_role();
  v_cita public.citas%ROWTYPE;
  v_estado TEXT;
  v_fecha DATE;
  v_hora TIME;
  v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
  IF auth.uid() IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_cita_id IS NULL THEN
    RAISE EXCEPTION 'Identificador inválido' USING ERRCODE = '22023';
  END IF;

  SELECT c.* INTO v_cita
  FROM public.citas AS c
  WHERE c.id = p_cita_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cita no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    v_role = 'admin'
    OR (v_role = 'medico' AND v_cita.medico_id = auth.uid())
    OR (v_role = 'paciente' AND v_cita.paciente_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF v_cita.estado IN ('cancelada', 'completada') THEN
    RAISE EXCEPTION 'La cita está cerrada' USING ERRCODE = 'P0001';
  END IF;

  IF p_new_estado IS NULL AND p_new_fecha IS NULL AND p_new_hora IS NULL THEN
    RAISE EXCEPTION 'No hay cambios para guardar' USING ERRCODE = '22023';
  END IF;

  IF p_new_estado IS NOT NULL AND (p_new_fecha IS NOT NULL OR p_new_hora IS NOT NULL) THEN
    RAISE EXCEPTION 'Separa el cambio de estado del cambio de horario' USING ERRCODE = '22023';
  END IF;

  IF p_new_estado IS NOT NULL THEN
    IF p_new_estado NOT IN ('pendiente', 'confirmada', 'cancelada', 'completada') THEN
      RAISE EXCEPTION 'Estado inválido' USING ERRCODE = '22023';
    END IF;
    IF v_role = 'paciente' AND p_new_estado <> 'cancelada' THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
    END IF;
    IF p_new_estado = 'completada'
       AND (v_cita.fecha + v_cita.hora)::TIMESTAMP >
           (pg_catalog.now() AT TIME ZONE 'America/Bogota') THEN
      RAISE EXCEPTION 'No se puede completar una cita futura' USING ERRCODE = '22023';
    END IF;
    v_estado := p_new_estado;
  ELSE
    v_estado := v_cita.estado;
  END IF;

  v_fecha := v_cita.fecha;
  v_hora := v_cita.hora;
  IF p_new_fecha IS NOT NULL OR p_new_hora IS NOT NULL THEN
    IF p_new_fecha IS NULL OR p_new_hora IS NULL
       OR EXTRACT(MINUTE FROM p_new_hora) NOT IN (0, 30)
       OR EXTRACT(SECOND FROM p_new_hora) <> 0 THEN
      RAISE EXCEPTION 'Fecha y hora inválidas' USING ERRCODE = '22023';
    END IF;
    IF (p_new_fecha + p_new_hora)::TIMESTAMP <=
       (pg_catalog.now() AT TIME ZONE 'America/Bogota') THEN
      RAISE EXCEPTION 'La fecha debe ser futura' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.horarios AS h
      WHERE h.medico_id = v_cita.medico_id
        AND h.fecha = p_new_fecha
        AND h.estado = 'activo'
        AND h.desde <= p_new_hora
        AND p_new_hora < h.hasta
    ) THEN
      RAISE EXCEPTION 'El cupo no está publicado' USING ERRCODE = 'P0001';
    END IF;
    v_fecha := p_new_fecha;
    v_hora := p_new_hora;
    v_estado := 'pendiente';
  END IF;

  UPDATE public.citas AS c
  SET fecha = v_fecha,
      hora = v_hora,
      estado = v_estado,
      updated_at = v_now
  WHERE c.id = p_cita_id;

  INSERT INTO public.auditoria (
    usuario_id, accion, tabla_afectada, registro_id,
    datos_anteriores, datos_nuevos, created_at
  ) VALUES (
    auth.uid(), 'Cita actualizada', 'citas', p_cita_id,
    pg_catalog.jsonb_build_object(
      'fecha', v_cita.fecha,
      'hora', v_cita.hora,
      'estado', v_cita.estado
    ),
    pg_catalog.jsonb_build_object(
      'fecha', v_fecha,
      'hora', v_hora,
      'estado', v_estado
    ),
    v_now
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_appointment(UUID, UUID, DATE, TIME, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_appointment(UUID, TEXT, DATE, TIME) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_appointment(UUID, UUID, DATE, TIME, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_appointment(UUID, TEXT, DATE, TIME) TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despachos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despacho_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS profiles_read_scoped ON public.profiles;
CREATE POLICY profiles_read_scoped
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.current_app_role() = 'admin'
    OR (
      public.current_app_role() = 'paciente'
      AND rol = 'medico'
      AND activo = TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM public.citas AS c
      WHERE (c.paciente_id = auth.uid() AND c.medico_id = profiles.id)
         OR (c.medico_id = auth.uid() AND c.paciente_id = profiles.id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.despachos AS d
      WHERE d.farmaceutico_id = auth.uid()
        AND d.paciente_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view medicamentos" ON public.medicamentos;
DROP POLICY IF EXISTS "Admins and farmaceuticos can insert medicamentos" ON public.medicamentos;
DROP POLICY IF EXISTS "Admins and farmaceuticos can update medicamentos" ON public.medicamentos;
DROP POLICY IF EXISTS medicamentos_read_staff ON public.medicamentos;
CREATE POLICY medicamentos_read_staff
  ON public.medicamentos FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('admin', 'medico', 'farmaceutico'));

DROP POLICY IF EXISTS "Authenticated users can view lotes" ON public.lotes;
DROP POLICY IF EXISTS "Admins and farmaceuticos can insert lotes" ON public.lotes;
DROP POLICY IF EXISTS "Admins and farmaceuticos can update lotes" ON public.lotes;
DROP POLICY IF EXISTS lotes_read_staff ON public.lotes;
CREATE POLICY lotes_read_staff
  ON public.lotes FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('admin', 'medico', 'farmaceutico'));

DROP POLICY IF EXISTS "Pacientes can view own citas" ON public.citas;
DROP POLICY IF EXISTS "Medicos can view assigned citas" ON public.citas;
DROP POLICY IF EXISTS "Admins can view all citas" ON public.citas;
DROP POLICY IF EXISTS "Pacientes can create citas" ON public.citas;
DROP POLICY IF EXISTS "Medicos and admins can update citas" ON public.citas;
DROP POLICY IF EXISTS citas_read_scoped ON public.citas;
CREATE POLICY citas_read_scoped
  ON public.citas FOR SELECT TO authenticated
  USING (
    paciente_id = auth.uid()
    OR medico_id = auth.uid()
    OR public.current_app_role() = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated users can view despachos" ON public.despachos;
DROP POLICY IF EXISTS "Farmaceuticos can insert despachos" ON public.despachos;
DROP POLICY IF EXISTS "Farmaceuticos can update despachos" ON public.despachos;
DROP POLICY IF EXISTS despachos_read_scoped ON public.despachos;
CREATE POLICY despachos_read_scoped
  ON public.despachos FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'admin'
    OR paciente_id = auth.uid()
    OR farmaceutico_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.citas AS c
      WHERE c.id = despachos.cita_id
        AND c.medico_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view despacho_items" ON public.despacho_items;
DROP POLICY IF EXISTS "Farmaceuticos can insert despacho_items" ON public.despacho_items;
DROP POLICY IF EXISTS despacho_items_read_scoped ON public.despacho_items;
CREATE POLICY despacho_items_read_scoped
  ON public.despacho_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.despachos AS d
      WHERE d.id = despacho_items.despacho_id
    )
  );

DROP POLICY IF EXISTS "Admins can view auditoria" ON public.auditoria;
DROP POLICY IF EXISTS auditoria_read_admin ON public.auditoria;
CREATE POLICY auditoria_read_admin
  ON public.auditoria FOR SELECT TO authenticated
  USING (public.current_app_role() = 'admin');

DROP POLICY IF EXISTS horarios_read_scoped ON public.horarios;
CREATE POLICY horarios_read_scoped
  ON public.horarios FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'admin'
    OR (public.current_app_role() = 'medico' AND medico_id = auth.uid())
    OR (
      public.current_app_role() = 'paciente'
      AND EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = horarios.medico_id
          AND p.rol = 'medico'
          AND p.activo = TRUE
      )
    )
  );

DROP POLICY IF EXISTS inventory_movements_read_staff ON public.inventory_movements;
CREATE POLICY inventory_movements_read_staff
  ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('admin', 'medico', 'farmaceutico'));

-- Writes must go through validated server operations or narrowly scoped RPCs.
REVOKE INSERT, UPDATE, DELETE ON
  public.profiles,
  public.medicamentos,
  public.lotes,
  public.citas,
  public.despachos,
  public.despacho_items,
  public.auditoria,
  public.horarios,
  public.inventory_movements
FROM anon, authenticated;

GRANT SELECT ON
  public.medicamentos,
  public.lotes,
  public.citas,
  public.despachos,
  public.despacho_items,
  public.auditoria,
  public.horarios,
  public.inventory_movements
TO authenticated;

-- Profile lists expose only directory fields. Personal and administrator views
-- use the guarded functions above so contact and identity fields stay scoped.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, nombre, apellido, rol, activo)
  ON public.profiles TO authenticated;

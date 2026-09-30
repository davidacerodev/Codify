-- ============================================================
-- Migración inicial: Esquema de base de datos
-- Sistema de Información Web - Enfermería Unitrópico
-- ============================================================

-- --- Tabla: profiles ---
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'medico', 'farmaceutico', 'paciente')),
  telefono TEXT,
  documento_identidad TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --- Tabla: medicamentos ---
CREATE TABLE IF NOT EXISTS medicamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  codigo TEXT NOT NULL UNIQUE,
  unidad_medida TEXT NOT NULL,
  stock_minimo INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --- Tabla: lotes ---
CREATE TABLE IF NOT EXISTS lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id UUID NOT NULL REFERENCES medicamentos(id) ON DELETE CASCADE,
  numero_lote TEXT NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 0,
  precio_compra DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(medicamento_id, numero_lote)
);

-- --- Tabla: citas ---
CREATE TABLE IF NOT EXISTS citas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES profiles(id),
  medico_id UUID NOT NULL REFERENCES profiles(id),
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  motivo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'completada')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --- Tabla: despachos ---
CREATE TABLE IF NOT EXISTS despachos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cita_id UUID NOT NULL REFERENCES citas(id),
  paciente_id UUID NOT NULL REFERENCES profiles(id),
  farmaceutico_id UUID NOT NULL REFERENCES profiles(id),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'entregado', 'cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --- Tabla: despacho_items ---
CREATE TABLE IF NOT EXISTS despacho_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id UUID NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  medicamento_id UUID NOT NULL REFERENCES medicamentos(id),
  lote_id UUID NOT NULL REFERENCES lotes(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --- Tabla: auditoria ---
CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES profiles(id),
  accion TEXT NOT NULL,
  tabla_afectada TEXT NOT NULL,
  registro_id UUID NOT NULL,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --- Índices ---
CREATE INDEX IF NOT EXISTS idx_citas_paciente ON citas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_citas_medico ON citas(medico_id);
CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas(fecha);
CREATE INDEX IF NOT EXISTS idx_lotes_medicamento ON lotes(medicamento_id);
CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON lotes(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_despachos_cita ON despachos(cita_id);
CREATE INDEX IF NOT EXISTS idx_despacho_items_despacho ON despacho_items(despacho_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(created_at);

-- --- Función para actualizar updated_at ---
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --- Triggers para updated_at ---
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medicamentos_updated_at
  BEFORE UPDATE ON medicamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lotes_updated_at
  BEFORE UPDATE ON lotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_citas_updated_at
  BEFORE UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_despachos_updated_at
  BEFORE UPDATE ON despachos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE despachos ENABLE ROW LEVEL SECURITY;
ALTER TABLE despacho_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- --- Políticas para profiles ---
-- Los usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Los administradores pueden ver todos los perfiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- --- Políticas para medicamentos ---
-- Todos los usuarios autenticados pueden ver medicamentos
CREATE POLICY "Authenticated users can view medicamentos"
  ON medicamentos FOR SELECT
  USING (auth.role() = 'authenticated');

-- Solo administradores y farmacéuticos pueden crear/actualizar medicamentos
CREATE POLICY "Admins and farmaceuticos can insert medicamentos"
  ON medicamentos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'farmaceutico')
    )
  );

CREATE POLICY "Admins and farmaceuticos can update medicamentos"
  ON medicamentos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'farmaceutico')
    )
  );

-- --- Políticas para lotes ---
CREATE POLICY "Authenticated users can view lotes"
  ON lotes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and farmaceuticos can insert lotes"
  ON lotes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'farmaceutico')
    )
  );

CREATE POLICY "Admins and farmaceuticos can update lotes"
  ON lotes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'farmaceutico')
    )
  );

-- --- Políticas para citas ---
-- Los pacientes pueden ver sus propias citas
CREATE POLICY "Pacientes can view own citas"
  ON citas FOR SELECT
  USING (paciente_id = auth.uid());

-- Los médicos pueden ver sus citas asignadas
CREATE POLICY "Medicos can view assigned citas"
  ON citas FOR SELECT
  USING (medico_id = auth.uid());

-- Los administradores pueden ver todas las citas
CREATE POLICY "Admins can view all citas"
  ON citas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Los pacientes pueden crear citas
CREATE POLICY "Pacientes can create citas"
  ON citas FOR INSERT
  WITH CHECK (paciente_id = auth.uid());

-- Los médicos y administradores pueden actualizar citas
CREATE POLICY "Medicos and admins can update citas"
  ON citas FOR UPDATE
  USING (
    medico_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- --- Políticas para despachos ---
CREATE POLICY "Authenticated users can view despachos"
  ON despachos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Farmaceuticos can insert despachos"
  ON despachos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'farmaceutico'
    )
  );

CREATE POLICY "Farmaceuticos can update despachos"
  ON despachos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'farmaceutico'
    )
  );

-- --- Políticas para despacho_items ---
CREATE POLICY "Authenticated users can view despacho_items"
  ON despacho_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Farmaceuticos can insert despacho_items"
  ON despacho_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'farmaceutico'
    )
  );

-- --- Políticas para auditoria ---
-- Solo administradores pueden ver la auditoría
CREATE POLICY "Admins can view auditoria"
  ON auditoria FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'
    )
  );

// ============================================================
// Tipos del sistema de Enfermería Unitrópico
// ============================================================

// --- Roles del sistema ---
export type Role = "admin" | "medico" | "farmaceutico" | "paciente";

// --- Perfil de usuario ---
export interface Profile {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Role;
  telefono?: string;
  documento_identidad: string;
  created_at: string;
  updated_at: string;
}

// --- Citas ---
export interface Cita {
  id: string;
  paciente_id: string;
  medico_id: string;
  fecha: string;
  hora: string;
  motivo: string;
  estado: "pendiente" | "confirmada" | "cancelada" | "completada";
  notas?: string;
  created_at: string;
  updated_at: string;
}

// --- Medicamentos ---
export interface Medicamento {
  id: string;
  nombre: string;
  descripcion?: string;
  codigo: string;
  unidad_medida: string;
  stock_minimo: number;
  created_at: string;
  updated_at: string;
}

// --- Lotes de medicamentos ---
export interface Lote {
  id: string;
  medicamento_id: string;
  numero_lote: string;
  fecha_vencimiento: string;
  cantidad: number;
  precio_compra?: number;
  created_at: string;
  updated_at: string;
}

// --- Despacho de medicamentos ---
export interface Despacho {
  id: string;
  cita_id: string;
  paciente_id: string;
  farmaceutico_id: string;
  fecha: string;
  estado: "pendiente" | "entregado" | "cancelado";
  created_at: string;
  updated_at: string;
}

// --- Items de despacho ---
export interface DespachoItem {
  id: string;
  despacho_id: string;
  medicamento_id: string;
  lote_id: string;
  cantidad: number;
  created_at: string;
}

// --- Auditoría / Registros ---
export interface Auditoria {
  id: string;
  usuario_id: string;
  accion: string;
  tabla_afectada: string;
  registro_id: string;
  datos_anteriores?: Record<string, unknown>;
  datos_nuevos?: Record<string, unknown>;
  created_at: string;
}

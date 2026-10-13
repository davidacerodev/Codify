/** Datos y operaciones ficticios para probar las pantallas. Las restricciones aquí simulan reglas; no son una barrera de seguridad para datos reales. */
import { ensureDemoSchedules, freeSlots } from "./corrections";
import type { Profile, Role, Workspace } from "@/types";
import { today } from "@/lib/app-config";
import { validateCommand, type Command } from "./schemas";

export const DEMO_STORAGE = "codify.demo.data.v1";
export const DEMO_SESSION = "codify.demo.session.v1";
const uid = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const demoIds: Record<Role, string> = {
  admin: uid(1),
  medico: uid(2),
  farmaceutico: uid(3),
  paciente: uid(4),
};
const timestamp = () => new Date().toISOString();
const day = (offset: number) => {
  const d = new Date(today() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

// Crea usuarios y registros de ejemplo con fechas relativas al día de la demostración.
export function seedDemo(): Workspace {
  const now = timestamp();
  const profiles: Profile[] = [
    { id: uid(1), nombre: "Laura", apellido: "Martínez", rol: "admin" },
    { id: uid(2), nombre: "Andrés", apellido: "Castro", rol: "medico" },
    { id: uid(3), nombre: "Valentina", apellido: "Rojas", rol: "farmaceutico" },
    { id: uid(4), nombre: "Camila", apellido: "Torres", rol: "paciente" },
    { id: uid(5), nombre: "Daniel", apellido: "Pérez", rol: "paciente" },
  ].map((p, i) => ({
    ...p,
    rol: p.rol as Role,
    email: `demo${i + 1}@example.com`,
    documento_identidad: `DEMO-00${i + 1}`,
    telefono: "",
    activo: true,
    created_at: now,
    updated_at: now,
  }));
  return {
    profile: profiles[0],
    profiles,
    people: profiles,
    citas: [
      {
        id: uid(10),
        paciente_id: uid(4),
        medico_id: uid(2),
        fecha: day(1),
        hora: "09:00",
        motivo: "Atención de enfermería (ejemplo)",
        estado: "confirmada",
        created_at: now,
        updated_at: now,
      },
      {
        id: uid(11),
        paciente_id: uid(5),
        medico_id: uid(2),
        fecha: day(0),
        hora: "10:30",
        motivo: "Control general (ejemplo)",
        estado: "pendiente",
        created_at: now,
        updated_at: now,
      },
      {
        id: uid(12),
        paciente_id: uid(4),
        medico_id: uid(2),
        fecha: day(-1),
        hora: "08:30",
        motivo: "Atención finalizada (ejemplo)",
        estado: "completada",
        created_at: now,
        updated_at: now,
      },
    ],
    medicamentos: [
      {
        id: uid(20),
        nombre: "Acetaminofén",
        codigo: "MED-001",
        unidad_medida: "Tableta 500 mg",
        stock_minimo: 20,
        descripcion: "Registro de demostración",
        created_at: now,
        updated_at: now,
      },
      {
        id: uid(21),
        nombre: "Solución salina",
        codigo: "MED-002",
        unidad_medida: "Frasco 100 ml",
        stock_minimo: 10,
        descripcion: "Registro de demostración",
        created_at: now,
        updated_at: now,
      },
      {
        id: uid(22),
        nombre: "Sales de rehidratación",
        codigo: "MED-003",
        unidad_medida: "Sobre",
        stock_minimo: 15,
        descripcion: "Registro de demostración",
        created_at: now,
        updated_at: now,
      },
      {
        id: uid(23),
        nombre: "Alcohol antiséptico",
        codigo: "INS-001",
        unidad_medida: "Frasco 120 ml",
        stock_minimo: 8,
        descripcion: "Registro de demostración",
        created_at: now,
        updated_at: now,
      },
    ],
    lotes: [
      {
        id: uid(30),
        medicamento_id: uid(20),
        numero_lote: "DEMO-A01",
        fecha_vencimiento: day(180),
        cantidad: 120,
        created_at: now,
        updated_at: now,
      },
      {
        id: uid(31),
        medicamento_id: uid(21),
        numero_lote: "DEMO-S01",
        fecha_vencimiento: day(20),
        cantidad: 5,
        created_at: now,
        updated_at: now,
      },
      {
        id: uid(32),
        medicamento_id: uid(22),
        numero_lote: "DEMO-R01",
        fecha_vencimiento: day(120),
        cantidad: 0,
        created_at: now,
        updated_at: now,
      },
      {
        id: uid(33),
        medicamento_id: uid(23),
        numero_lote: "DEMO-I01",
        fecha_vencimiento: day(250),
        cantidad: 24,
        created_at: now,
        updated_at: now,
      },
    ],
    despachos: [],
    items: [],
    auditoria: [
      {
        id: uid(40),
        usuario_id: uid(1),
        accion: "Datos de demostración cargados",
        tabla_afectada: "sistema",
        registro_id: uid(1),
        created_at: now,
      },
    ],
  };
}

// Filtra la vista de demostración. En modo real, la autorización la aplica PostgreSQL.
export function demoView(all: Workspace, id: string): Workspace {
  const profile = all.profiles.find((p) => p.id === id && p.activo);
  if (!profile)
    throw new Error(
      "Esta cuenta está inactiva. Inicia sesión con otra cuenta de demostración.",
    );
  const citas = all.citas.filter(
    (c) =>
      profile.rol === "admin" ||
      profile.rol === "farmaceutico" ||
      (profile.rol === "paciente" ? c.paciente_id === id : c.medico_id === id),
  );
  const despachos = all.despachos.filter(
    (d) =>
      profile.rol === "admin" ||
      profile.rol === "farmaceutico" ||
      profile.rol === "medico" ||
      citas.some((c) => c.id === d.cita_id),
  );
  return {
    ...all,
    profile,
    citas,
    despachos,
    items: all.items.filter((i) =>
      despachos.some((d) => d.id === i.despacho_id),
    ),
    profiles: profile.rol === "admin" ? all.profiles : [profile],
    people: all.profiles
      .filter((p) => p.activo)
      .map(({ id, nombre, apellido, rol }) => ({ id, nombre, apellido, rol })),
    medicamentos: profile.rol === "paciente" ? [] : all.medicamentos,
    lotes: profile.rol === "paciente" ? [] : all.lotes,
    auditoria: profile.rol === "admin" ? all.auditoria : [],
    inventoryHistory:
      profile.rol === "paciente"
        ? []
        : all.auditoria.filter((a) =>
            ["medicamentos", "lotes", "despachos"].includes(a.tabla_afectada),
          ),
  };
}

// Trabaja sobre una copia: si una validación falla, no se persiste una operación parcial.
export function applyDemo(
  all: Workspace,
  actorId: string,
  input: Command,
): Workspace {
  const cmd = validateCommand(input);
  const data: Workspace = JSON.parse(JSON.stringify(ensureDemoSchedules(all)));
  const actor = data.profiles.find((p) => p.id === actorId && p.activo);
  if (!actor) throw new Error("La sesión no está activa.");
  const allow = (...roles: Role[]) => {
    if (!roles.includes(actor.rol))
      throw new Error("No tienes permiso para esta operación.");
  };
  const now = timestamp();
  const id = crypto.randomUUID();
  let record = id,
    table = "sistema",
    action = "";
  const addBatch = (
    medicamento_id: string,
    value: { numero_lote: string; fecha_vencimiento: string; cantidad: number },
  ) => {
    if (value.fecha_vencimiento < today())
      throw new Error("No se pueden ingresar lotes vencidos.");
    if (
      data.lotes.some(
        (l) =>
          l.medicamento_id === medicamento_id &&
          l.numero_lote.toLowerCase() === value.numero_lote.toLowerCase(),
      )
    )
      throw new Error(
        "Ese número de lote ya existe para el medicamento. Usa un lote nuevo.",
      );
    data.lotes.push({
      id: crypto.randomUUID(),
      medicamento_id,
      ...value,
      created_at: now,
      updated_at: now,
    });
  };
  switch (cmd.type) {
    // Valida paciente, profesional y cupo publicado antes de crear la solicitud.
    case "appointment.create": {
      allow("admin", "paciente");
      if (actor.rol === "paciente" && cmd.paciente_id !== actorId)
        throw new Error("Solo puedes agendar tus propias citas.");
      if (
        !data.profiles.some(
          (p) => p.id === cmd.paciente_id && p.rol === "paciente" && p.activo,
        ) ||
        !data.profiles.some(
          (p) => p.id === cmd.medico_id && p.rol === "medico" && p.activo,
        )
      )
        throw new Error("Selecciona un paciente y un profesional activos.");
      if (
        data.citas.some(
          (c) =>
            c.medico_id === cmd.medico_id &&
            c.fecha === cmd.fecha &&
            c.hora.slice(0, 5) === cmd.hora &&
            c.estado !== "cancelada",
        )
      )
        throw new Error("Ese horario ya está ocupado. Selecciona otro.");
      if (!freeSlots(data, cmd.medico_id, cmd.fecha).includes(cmd.hora))
        throw new Error("Ese cupo no está disponible en la agenda publicada.");
      const { type: _type, ...fields } = cmd;
      data.citas.push({
        ...fields,
        id,
        estado: "pendiente",
        created_at: now,
        updated_at: now,
      });
      table = "citas";
      action = "Cita agendada";
      break;
    }
    // Conserva la propiedad de la cita y bloquea cambios en citas ya cerradas.
    case "appointment.update": {
      const cita = data.citas.find((c) => c.id === cmd.id);
      if (
        !cita ||
        !(
          actor.rol === "admin" ||
          (actor.rol === "paciente" && cita.paciente_id === actorId) ||
          (actor.rol === "medico" && cita.medico_id === actorId)
        )
      )
        throw new Error("No puedes modificar esta cita.");
      if (["cancelada", "completada"].includes(cita.estado))
        throw new Error("Esta cita ya está cerrada.");
      if (actor.rol === "paciente" && cmd.estado && cmd.estado !== "cancelada")
        throw new Error("El personal de salud administra ese estado.");
      if (cmd.fecha || cmd.hora) {
        if (
          !cmd.fecha ||
          !cmd.hora ||
          !freeSlots(data, cita.medico_id, cmd.fecha, cita.id).includes(
            cmd.hora,
          )
        )
          throw new Error("Selecciona un cupo libre en la agenda publicada.");
        if (
          data.citas.some(
            (c) =>
              c.id !== cita.id &&
              c.medico_id === cita.medico_id &&
              c.fecha === cmd.fecha &&
              c.hora.slice(0, 5) === cmd.hora &&
              c.estado !== "cancelada",
          )
        )
          throw new Error("Ese horario ya está ocupado.");
        cita.fecha = cmd.fecha;
        cita.hora = cmd.hora;
        cita.estado = "pendiente";
      }
      if (cmd.estado) cita.estado = cmd.estado;
      cita.updated_at = now;
      record = cita.id;
      table = "citas";
      action = "Cita actualizada";
      break;
    }
    // Registra la referencia y su primer lote en la misma actualización local.
    case "medication.create": {
      allow("admin", "medico", "farmaceutico");
      if (
        data.medicamentos.some(
          (m) => m.codigo.toLowerCase() === cmd.codigo.toLowerCase(),
        )
      )
        throw new Error("Ya existe un medicamento con ese código.");
      data.medicamentos.push({
        id,
        nombre: cmd.nombre,
        codigo: cmd.codigo,
        descripcion: cmd.descripcion,
        unidad_medida: cmd.unidad_medida,
        stock_minimo: cmd.stock_minimo,
        created_at: now,
        updated_at: now,
      });
      addBatch(id, {
        numero_lote: cmd.numero_lote,
        fecha_vencimiento: cmd.fecha_vencimiento,
        cantidad: cmd.cantidad,
      });
      table = "medicamentos";
      action = "Medicamento y lote registrados";
      break;
    }
    // Cada entrada crea un lote nuevo; los ajustes de lotes existentes usan otro comando.
    case "stock.add": {
      allow("admin", "medico", "farmaceutico");
      if (
        !data.medicamentos.some(
          (m) => m.id === cmd.medicamento_id && m.activo !== false,
        )
      )
        throw new Error("Medicamento no encontrado.");
      addBatch(cmd.medicamento_id, {
        numero_lote: cmd.numero_lote,
        fecha_vencimiento: cmd.fecha_vencimiento,
        cantidad: cmd.cantidad,
      });
      record = cmd.medicamento_id;
      table = "lotes";
      action = "Entrada de inventario registrada";
      break;
    }
    // Revisa todos los productos antes de confirmar y evita descontar dos veces una solicitud.
    case "dispatch.create": {
      allow("admin", "farmaceutico");
      if (data.despachos.some((d) => d.id === cmd.solicitud_id)) return data;
      const cita = data.citas.find(
        (c) =>
          c.id === cmd.cita_id &&
          ["confirmada", "completada"].includes(c.estado),
      );
      if (!cita)
        throw new Error("Selecciona una cita confirmada o completada.");
      if (new Set(cmd.items.map((i) => i.lote_id)).size !== cmd.items.length)
        throw new Error("No repitas un lote en la entrega.");
      for (const item of cmd.items) {
        const lote = data.lotes.find((l) => l.id === item.lote_id);
        if (
          !lote ||
          data.medicamentos.find((m) => m.id === lote.medicamento_id)
            ?.activo === false ||
          lote.fecha_vencimiento < today() ||
          lote.cantidad < item.cantidad
        )
          throw new Error(
            "Stock insuficiente o lote vencido. Revisa la entrega.",
          );
        lote.cantidad -= item.cantidad;
        lote.updated_at = now;
        data.items.push({
          id: crypto.randomUUID(),
          despacho_id: cmd.solicitud_id,
          lote_id: lote.id,
          medicamento_id: lote.medicamento_id,
          cantidad: item.cantidad,
          created_at: now,
        });
      }
      data.despachos.unshift({
        id: cmd.solicitud_id,
        cita_id: cita.id,
        paciente_id: cita.paciente_id,
        farmaceutico_id: actorId,
        fecha: now,
        estado: "entregado",
        created_at: now,
        updated_at: now,
      });
      record = cmd.solicitud_id;
      table = "despachos";
      action = "Medicamentos entregados";
      break;
    }
    // Limita la edición personal a nombre, apellido y teléfono.
    case "profile.update": {
      Object.assign(actor, {
        nombre: cmd.nombre,
        apellido: cmd.apellido,
        telefono: cmd.telefono,
        updated_at: now,
      });
      record = actor.id;
      table = "profiles";
      action = "Perfil actualizado";
      break;
    }
    // Crea un perfil ficticio. La contraseña de prueba no se guarda en localStorage.
    case "user.create": {
      allow("admin");
      if (
        data.profiles.some(
          (p) =>
            p.email.toLowerCase() === cmd.email.toLowerCase() ||
            p.documento_identidad === cmd.documento_identidad,
        )
      )
        throw new Error("El correo o documento ya está registrado.");
      const { type: _type, password: _password, ...fields } = cmd;
      data.profiles.push({
        ...fields,
        id,
        activo: true,
        created_at: now,
        updated_at: now,
      });
      table = "profiles";
      action = "Usuario creado";
      break;
    }
    // Permite administrar otras cuentas sin que el administrador se desactive a sí mismo.
    case "user.update": {
      allow("admin");
      if (cmd.id === actorId)
        throw new Error("No puedes cambiar tu propio rol o estado.");
      const user = data.profiles.find((p) => p.id === cmd.id);
      if (!user) throw new Error("Usuario no encontrado.");
      Object.assign(user, {
        rol: cmd.rol,
        activo: cmd.activo,
        updated_at: now,
      });
      record = user.id;
      table = "profiles";
      action = "Rol o estado de usuario actualizado";
      break;
    }
  }
  // Mantiene un evento por operación para que los historiales expliquen los cambios.
  data.auditoria.unshift({
    id: crypto.randomUUID(),
    usuario_id: actorId,
    accion: action,
    tabla_afectada: table,
    registro_id: record,
    created_at: now,
    datos_nuevos:
      cmd.type === "medication.create"
        ? { ...cmd, medicamento_id: record }
        : cmd.type === "stock.add"
          ? {
              ...cmd,
              nombre: data.medicamentos.find((m) => m.id === cmd.medicamento_id)
                ?.nombre,
            }
          : undefined,
  });
  data.people = data.profiles.map(({ id, nombre, apellido, rol }) => ({
    id,
    nombre,
    apellido,
    rol,
  }));
  return data;
}

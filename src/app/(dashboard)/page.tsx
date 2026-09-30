import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Bienvenido/a
        </h2>
        <p className="text-gray-600">
          {profile?.nombre} {profile?.apellido}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Rol: <span className="font-medium capitalize">{profile?.rol}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-900 mb-2">Citas</h3>
          <p className="text-sm text-gray-600">
            Gestión y agendamiento de citas médicas
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-900 mb-2">Inventario</h3>
          <p className="text-sm text-gray-600">
            Control de medicamentos, lotes y existencias
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-900 mb-2">Despacho</h3>
          <p className="text-sm text-gray-600">
            Dispensación de medicamentos a pacientes
          </p>
        </div>
      </div>
    </div>
  );
}

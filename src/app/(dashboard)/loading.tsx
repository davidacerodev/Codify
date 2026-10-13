/** Estado de carga de las rutas del panel. Ofrece una señal visual mientras se prepara la siguiente pantalla. */
export default function Loading() {
  return (
    <div className="page-skeleton" aria-label="Cargando pantalla" role="status">
      <div />
      <div />
      <div />
    </div>
  );
}

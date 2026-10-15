# Registro de decisiones

Mantener decisiones que afecten arquitectura, alcance, datos, seguridad o diseño. Formato: fecha, decisión, contexto/evidencia, alternativas consideradas, impacto y estado (propuesta/aceptada/reemplazada).

## 2026-10-02 — La matriz de avance es provisional

- **Estado:** propuesta inicial.
- **Contexto:** el MD de investigación mencionado por el usuario no está disponible todavía; el anteproyecto indica que los requisitos detallados siguen pendientes.
- **Decisión:** publicar una línea base con estados observables y marcarla explícitamente provisional; recalcular al recibir el MD y validar con Enfermería.
- **Impacto:** el porcentaje inicial no debe usarse como medición contractual o de esfuerzo.

## 2026-10-02 — Separar documentación de continuidad del producto

- **Estado:** aceptada.
- **Contexto:** hacen falta seguimiento humano y handoff entre agentes.
- **Decisión:** mantener `PLAN_TRABAJO/` para fases/avance y `brain/` para contexto, instrucciones, decisiones y bitácora.
- **Impacto:** toda sesión que modifique el proyecto actualiza ambos cuando corresponda.

## 2026-10-14 — Mantener las mutaciones de dominio en RPC transaccionales

- **Estado:** aceptada para el primer corte técnico; reglas de proceso pendientes de validar con Enfermería.
- **Contexto:** el cliente web requiere modificar citas, agenda, inventario, despacho, perfil y usuarios; PostgreSQL es la autoridad de permisos y saldos.
- **Decisión:** mantener Route Handlers del mismo origen como capa HTTP, validar entrada en servidor y delegar escrituras críticas a funciones PostgreSQL con `SECURITY DEFINER`, `search_path` fijo, control explícito de rol, auditoría y permisos de ejecución mínimos. El cliente `service_role` queda aislado en módulo server-only y se usa solo para crear identidad Auth en un alta administrativa.
- **Impacto:** la UI no puede completar operaciones reales hasta aplicar y probar las migraciones contra el Supabase de desarrollo. No se monta el socket Docker ni se necesita ejecutar Node/npm fuera de Docker.

## 2026-10-14 — Versionar migraciones con formato Supabase CLI

- **Estado:** aceptada.
- **Contexto:** los nombres previos `001_...` y `002_...` no seguían el formato timestamp de Supabase CLI; además se incorporó una migración de operaciones.
- **Decisión:** usar versiones `20261002000000`, `20261014000000` y `20261014010000`, conservar el orden lógico y revisar `migration list --linked` antes de aplicar.
- **Impacto:** renombrar no registra versiones ejecutadas manualmente. Si la base ya recibió SQL desde Dashboard, reconciliar su estado antes de `db push`; nunca ejecutar `db reset --linked`.

## 2026-10-14 — Separar el informe de Gattopico del producto Unitrópico

- **Estado:** aceptada según la evidencia documental actual.
- **Contexto:** `DOCS CODIFY/Matriz_Seguimiento_Codify_Documento_Corporativo.pdf` (pp. 1, 3, 5–14) evalúa un “Simulador de Destinos Ganaderos” de escritorio en Python/Tkinter para Gattopico. El repositorio, README, wireframes y anteproyecto de `ENTREGA 1` describen el sistema web de Enfermería Unitrópico.
- **Decisión:** conservar el PDF como informe de evaluación de otro producto. No añadir OSRM, scraping de precios, simulación de rentabilidad ni mapa ganadero a este sistema. Traducir únicamente recomendaciones transversales —validación, modularidad, resiliencia de integraciones, responsive y accesibilidad— en criterios verificables cuando correspondan.
- **Impacto:** el plan de APIs y la migración actual siguen alineados con citas, perfiles, medicamentos, inventario y despacho. Si la identidad del producto objetivo cambia, detener nuevas decisiones funcionales y reconciliar el alcance primero.

## 2026-10-14 — Validar las operaciones remotas con datos sintéticos

- **Estado:** pendiente de ejecución.
- **Contexto:** las tres migraciones ya constan en el historial remoto y catálogo, RLS y RPC se verificaron por metadatos. La ruta anónima responde 401, resultado esperado.
- **Decisión:** no considerar la API terminada hasta crear el primer perfil administrador por un canal controlado, probar cada rol, denegaciones, concurrencia e idempotencia con registros sintéticos.
- **Impacto:** la aplicación no debe usarse con datos reales hasta registrar evidencia de las pruebas y resolver los requisitos funcionales pendientes con Enfermería.

## 2026-10-15 — Cancelación y retiro, sin borrado físico

- **Estado:** decisión del usuario.
- **Contexto:** el MVP pide CRUD de cuatro recursos y el dominio contiene citas, movimientos, despachos y auditoría relacionados.
- **Decisión:** no borrar datos operativos ni identidades. Cancelar citas/agendas, desactivar cuentas y retirar medicamentos del catálogo conservando relaciones, movimientos y auditoría. El retiro de medicamento exige saldo cero. Si falla el alta de perfil tras crear Auth, bloquear y conservar la identidad huérfana en vez de borrarla.
- **Impacto:** la guía, API y UI usan lenguaje de cancelación/retiro/desactivación. Explicar al profesor que `DELETE` físico contradice la política de trazabilidad y acordar cómo se evalúa la baja sin destruir datos.

## 2026-10-15 — Pruebas API aisladas en Supabase local

- **Estado:** verificado.
- **Contexto:** hacía falta probar operaciones autenticadas sin insertar fixtures en el proyecto remoto ni en perfiles institucionales.
- **Decisión:** ejecutar Playwright/API con perfiles y datos ficticios, resetear Supabase local después y registrar el resultado sin guardar credenciales.
- **Impacto:** CRUD, autorización, validación, concurrencia e idempotencia se verifican localmente. El reset local confirmó la retirada de los datos sintéticos; no se ejecutó `db reset --linked`.

## 2026-10-15 — No se borran registros operativos

- **Estado:** decisión del usuario.
- **Contexto:** la plataforma es institucional; se exige trazabilidad y transparencia.
- **Decisión:** no borrar físicamente datos ni identidades. Las citas y agendas se cancelan, las cuentas se desactivan, los medicamentos se retiran del catálogo y los movimientos/auditoría se conservan. Si falla el alta de perfil después de crear la identidad Auth, bloquear la identidad huérfana y conservarla en vez de borrarla.
- **Impacto:** la guía y las pantallas deben usar lenguaje de cancelación/retiro/desactivación. Cualquier tensión con la rúbrica CRUD se explica al docente; no se implementa un borrado físico sin política institucional.

## 2026-10-15 — Separar cápsulas de exposición

- **Estado:** fuera de alcance de la plataforma.
- **Contexto:** las cápsulas de los grupos 1 y 4 son una actividad de exposición independiente.
- **Decisión:** no asociar sus temas a la arquitectura, plan técnico ni documentación de la aplicación.
- **Impacto:** se retiró el borrador de cápsulas creado como parte del plan de plataforma.

## 2026-10-15 — Mantener plan y guía técnica fuera de este checkout

- **Estado:** decisión del usuario.
- **Contexto:** el usuario retiró `PLAN_TRABAJO/` y `docs/` del proyecto y conserva esos archivos en otra ubicación para controlar qué se publica en GitHub.
- **Decisión:** no recrear ni versionar esas carpetas sin una solicitud explícita. Mantener en `brain/` solo el contexto técnico y las instrucciones de continuidad del código.
- **Impacto:** las referencias anteriores a esas rutas en bitácoras son históricas. La guía de endpoints externa debe actualizarse después del despliegue de Vercel.

## 2026-10-15 — Auditoría de dependencias de desarrollo

- **Estado:** riesgo conocido pendiente de parche upstream.
- **Contexto:** `npm audit` reporta cinco incidencias altas relacionadas con `braces` bajo `eslint-config-next`; `npm audit --omit=dev` reporta cero vulnerabilidades. El advisory consultado indica que no hay versión corregida publicada.
- **Decisión:** no aplicar `npm audit fix --force`, que degrada `eslint-config-next` de versión principal. Mantener el lockfile y volver a auditar cuando exista una versión corregida o cambie la cadena afectada.
- **Impacto:** el árbol de desarrollo sigue mostrando alerta; las dependencias de runtime auditadas no tienen hallazgos. La evidencia se registra en la bitácora de 2026-10-15.

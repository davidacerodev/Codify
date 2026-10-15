# Arquitectura y flujos de referencia

## Capas actuales

```text
src/app             Rutas, layouts y composición de páginas (App Router)
src/features        Contratos de autenticación y dominio de workspace
src/components/ui   Primitivas visuales reutilizables
src/lib/supabase    Clientes browser/server, proxy de sesión y cliente admin server-only
src/lib/api         Sesión, parseo HTTP y respuesta común de Route Handlers
src/types           Tipos manuales del dominio compartidos por UI y handlers
supabase/migrations Esquema y políticas versionadas
```

La aplicación usa Route Handlers de Next.js con Supabase/PostgreSQL y RLS. El contrato Zod se vuelve a validar en servidor; las funciones SQL implementan escrituras de negocio. El modelo sigue sujeto a revisión con requisitos institucionales.

## Flujo general deseado

```text
Solicitud → validar sesión → identificar rol → cargar recurso bajo identidad
          → autorizar acción sobre ese recurso → validar reglas de negocio
          → persistir operación consistente → registrar evento → responder mínimo
```

Middleware facilita el control de sesión/navegación. La autorización por recurso pertenece a la operación del servidor y a las políticas de base de datos; la UI solo presenta opciones adecuadas.

## Flujo de acceso a recurso

1. Recibir identificador y acción solicitada.
2. Validar usuario autenticado mediante Supabase Auth.
3. Cargar el recurso bajo credenciales sujetas a RLS.
4. Evaluar rol y relación del usuario con el recurso según matriz aprobada.
5. Denegar sin devolver contenido si no corresponde.
6. Ejecutar validación de dominio y escritura segura si está autorizado.
7. Registrar la operación con datos mínimos.
8. Devolver únicamente campos necesarios para la pantalla.

## Flujo de despacho deseado

```text
Usuario autorizado
  → solicita despacho e ítems
  → valida relación con cita/paciente según requisito
  → bloquea o actualiza de forma atómica las cantidades elegibles
  → verifica lote vigente y cantidad suficiente
  → guarda despacho e ítems y movimiento de salida
  → registra responsable y resultado
  → confirma; ante fallo, no deja una salida parcial
```

El flujo está implementado como RPC transaccional en `20261014010000_workspace_operations.sql`: bloquea la cita y lotes, valida existencia/vencimiento, guarda cabecera e ítems, descuenta stock, registra movimiento y auditoría, y atiende reintentos por `solicitud_id`. Las 11 pruebas API/RPC locales pasaron, incluida reversión ante falta de stock e idempotencia. Enfermería debe confirmar si se permite una entrega por cita y bajo qué estados.

## Permisos

El anteproyecto enumera admin, médico, farmacéutico y paciente como roles iniciales, pero sus permisos concretos quedan pendientes del levantamiento. No derivar una matriz completa solo de los nombres. Mantener una matriz rol × acción × recurso en el plan de requisitos y enlazar cada regla con políticas RLS y validaciones del servidor.

# Contexto del sistema

## Producto

Codify es un sistema web académico para el área de Enfermería de Unitrópico. La propuesta entregada contempla citas, inventario, despacho, autenticación, roles y trazabilidad. La ruta académica elegida es G — Seguridad web; la ruta B de respaldo es Contenerización y DevOps.

El problema de seguridad declarado por el equipo es evitar que un usuario obtenga información de un paciente ajeno al manipular identificadores de URL o solicitudes. El anteproyecto señala explícitamente que el levantamiento detallado de requisitos y la validación están pendientes. No asumir procesos institucionales que no hayan sido confirmados.

## Estado técnico observado — actualización al 2026-10-15

- Next.js 16.4.1, React 19.3, TypeScript, Tailwind CSS 4 y Supabase (`@supabase/ssr`). Node 22 es el runtime del proyecto.
- App Router dividido en grupos `(auth)` y `(dashboard)`; el merge `686b9c0` incorpora las pantallas principales y su navegación, además de estados de carga/error y formularios de negocio.
- La UI ofrece modo demo con datos sintéticos en `localStorage` y un modo real que espera endpoints HTTP.
- `src/lib/api-client.ts`, `src/features/auth/client.ts` y `src/features/workspace/frontend-api.ts` conectan la UI con Route Handlers del mismo origen.
- La API expone handlers de autenticación, lectura de Workspace, disponibilidad y mutaciones de citas, perfil, usuarios, agenda, inventario y despacho. Las mutaciones de dominio usan RPC de PostgreSQL con autorización y validación transaccional.
- `src/features/workspace/schemas.ts` define ocho comandos y `corrections.ts` cinco comandos adicionales; el servidor vuelve a validar con Zod y la base de datos vuelve a validar roles e invariantes críticos.
- `Workspace` incluye horarios e historial de inventario; las migraciones de dominio modelan `horarios` y `inventory_movements` además de las entidades base.
- La demo simula reglas de rol, agenda, stock y auditoría en navegador; no es modelo de seguridad ni operación transaccional real.
- La migración inicial crea perfiles, citas, medicamentos, lotes, despachos, ítems y auditoría. Las migraciones de dominio agregan horarios, movimientos de inventario, políticas RLS revisadas y RPC transaccionales.
- En 2026-10-15 se aplicó una cuarta migración en Supabase para bloquear borrados físicos en datos operativos y cascadas Auth. La CLI confirma las cuatro versiones. Integración local valida sesión/rol, cancelación, retiro, concurrencia, RPC y que `service_role` no borre citas ni identidades Auth; no se escribieron datos de negocio en el proyecto remoto.
- El perfil inicial admin está creado y auditado. La sesión del administrador cargó `/usuarios` y mostró cuatro roles activos: admin, médico, auxiliar de enfermería (clave interna `farmaceutico`) y paciente.
- Las sesiones médica, auxiliar y paciente probaron rutas permitidas y bloqueadas. Médico: permite `/dashboard`, `/citas`, `/horarios`, `/inventario`; bloquea `/usuarios`, `/despacho`, `/citas/nueva`. Auxiliar: permite `/dashboard`, `/horarios`, `/inventario`, `/despacho`; bloquea `/usuarios`, `/citas`. Paciente: permite `/dashboard`, `/citas`, `/citas/nueva`, `/horarios`; bloquea `/usuarios`, `/inventario`, `/despacho`. Pantallas vacías sin escritura. Esto no cubre llamadas API/RPC directas ni políticas RLS mediante identificadores ajenos.
- Docker Compose ejecuta la aplicación y ofrece Supabase CLI 2.121.0 mediante un perfil aparte. Supabase y Vercel son servicios externos. `.env.docker` entrega la clave de servicio únicamente al servidor; `.env.supabase` mantiene token CLI y contraseña DB, ambos ignorados por Git.
- Las migraciones timestamp están en `supabase/migrations/`: esquema inicial, seguridad/dominio y operaciones transaccionales; ya constan aplicadas en el remoto.
- API de inventario y despacho están implementadas en handlers/RPC. La última comprobación pasó TypeScript y ESLint (siete advertencias de hooks), 10 pruebas de seguridad HTTP, 17 recorridos de UI y 11 pruebas API/RPC locales, incluidas autorización, concurrencia, idempotencia y rechazo de borrado físico.
- `docker compose up -d` levantó `web` como contenedor saludable; `/login` respondió HTTP 200 por localhost y por la IP LAN del host (`192.168.1.5`). El puerto se publica en `0.0.0.0:3000` y `[::]:3000`; firewall y alcance desde otros dispositivos dependen de la red local.
- La compilación optimizada con `docker build --target builder -t codify-verification:local .` pasó. La imagen temporal de verificación se eliminó después.
- `npm audit --omit=dev` reporta cero vulnerabilidades. El árbol completo mantiene cinco alertas altas asociadas a `braces` en la cadena de ESLint; el advisory consultado no ofrece versión corregida. No se aplicó `npm audit fix --force` porque degradaría Next ESLint config.
- `PLAN_TRABAJO/` y `docs/` se retiraron del checkout por decisión del usuario; sus copias se conservan fuera del proyecto y no deben recrearse ni añadirse a Git sin solicitud explícita.
- Wireframes originales están superados en parte por la UI incorporada en el commit de frontend; revisar ambos cuando se cierre el contrato.
- El PDF corporativo agregado en `DOCS CODIFY/` es una revisión de otro proyecto (Gattopico, Simulador de Destinos Ganaderos), no especificación funcional de Enfermería. No trasladar sus criterios de producto al sistema de Enfermería sin cotejarlos con la documentación académica externa del usuario.

## Límites conocidos

El anteproyecto excluye diagnóstico automatizado, telemedicina, facturación, EPS, finanzas, interoperabilidad real con SISPRO/IHCE/IPS, prescripción electrónica oficial, hospitalización completa y app móvil nativa. El alcance exacto se debe revisar contra la investigación MD y requisitos confirmados.

## Riesgo central

RLS y autorización por objeto necesitan revisión cuidadosa antes de manejar datos reales. La migración actual no demuestra el flujo transaccional de despacho ni la escritura de auditoría. Usar exclusivamente datos sintéticos durante desarrollo y validación académica.

# Sistema de Información Web - Enfermería Unitrópico

> La aplicación, sus Route Handlers y las migraciones están implementados. El candidato se verifica en Docker con pruebas de interfaz, seguridad e integración sobre Supabase local. Las reglas institucionales pendientes deben acordarse antes de operar con datos reales.

## Descripción

Sistema web para la gestión integral de los servicios de salud de la Enfermería de la Universidad Internacional del Trópico Americano (Unitrópico). La plataforma centraliza el agendamiento de citas, el control de existencias de medicamentos y su dispensación, bajo un esquema de acceso por roles que garantiza que cada usuario solo vea la información que le corresponde.

## Módulos

| Módulo | Descripción | Estado |
|---|---|---|
| Gestión de citas | Solicitud, agenda, consulta, reprogramación y cancelación. | Route Handlers y RPC probadas con fixtures locales |
| Inventario de medicamentos | Catálogo, lotes, vencimientos, existencias y movimientos. | RPC transaccionales; el retiro conserva historial |
| Despacho de medicamentos | Salida de insumos con descuento de stock. | RPC transaccional e idempotente, probada con casos de falta de stock |
| Usuarios y roles | Administración de cuentas y perfiles. | Alta y desactivación probadas; las cuentas no se eliminan físicamente |
| Autenticación | Inicio/cierre de sesión y recuperación de contraseña. | Handlers protegidos; la entrega de correo debe verificarse en el proveedor remoto |
| Registros y trazabilidad | Historial de movimientos y acciones. | Pruebas locales de conservación y rechazo de borrado físico |

## Arquitectura

El sistema se construye como una aplicación **fullstack monolítica modular** sobre Next.js (App Router). Tanto la interfaz de usuario como la lógica de servidor viven en el mismo repositorio y se despliegan en una sola plataforma, lo que evita mantener infraestructura separada para frontend y backend.

- **Capa de presentación:** componentes de React renderizados desde el App Router (Server Components y Client Components según la necesidad de interactividad).
- **Capa de servidor:** Route Handlers de Next.js para autenticación, lecturas y comandos del workspace. Validan sesión/origen/esquema; las escrituras delegan reglas críticas y transacciones a RPC protegidas en PostgreSQL.
- **Capa de persistencia (BaaS):** base de datos relacional PostgreSQL gestionada en Supabase, junto con autenticación y almacenamiento de archivos. Las reglas de acceso se aplican directamente en la base de datos mediante *Row Level Security* (RLS).
- **Control de navegación:** `src/proxy.ts` mantiene la sesión y protege páginas; la autorización por rol/recurso se valida en cada operación del servidor y en RLS.

### Estructura del proyecto

Se sigue una organización por características de negocio (*feature-based*) combinada con las convenciones de Next.js:

```text
Codify/
├── src/
│   ├── app/                      # App Router: rutas y agrupaciones por layout
│   │   ├── (auth)/               # Autenticación (login, logout)
│   │   │   ├── layout.tsx        # Layout para páginas de autenticación
│   │   │   └── login/page.tsx    # Página de inicio de sesión
│   │   ├── (dashboard)/          # Panel protegido para personal médico y administrativo
│   │   │   ├── layout.tsx        # Layout con navegación y protección de rutas
│   │   │   ├── page.tsx          # Página principal del dashboard
│   │   │   ├── citas/page.tsx    # Gestión y calendario de citas
│   │   │   ├── inventario/page.tsx # Control de existencias y kardex
│   │   │   └── despacho/page.tsx # Dispensación de medicamentos
│   │   ├── auth/logout/route.ts  # Endpoint de cierre de sesión
│   │   ├── api/                   # Route Handlers de autenticación y workspace
│   │   ├── globals.css           # Estilos globales con Tailwind
│   │   ├── layout.tsx            # Layout raíz
│   │   └── page.tsx              # Página de entrada (redirect al dashboard)
│   ├── components/ui/            # Componentes UI base (Shadcn UI)
│   │   ├── button.tsx            # Botón con variantes
│   │   ├── card.tsx              # Tarjetas con header, content y footer
│   │   ├── input.tsx             # Campo de entrada estilizado
│   │   └── label.tsx             # Etiqueta accesible
│   ├── features/                 # Lógica aislada por módulo de negocio
│   │   ├── auth/                 # Sesiones y perfiles
│   │   ├── citas/                # Actions, componentes y schemas de agendamiento
│   │   ├── inventario/           # Actions, tablas y validaciones de medicamentos
│   │   └── despacho/             # Actions y procesos de salida de insumos
│   ├── lib/                      # Utilidades y clientes
│   │   ├── supabase/             # Clientes de Supabase
│   │   │   ├── client.ts         # Cliente para el navegador
│   │   │   ├── server.ts         # Cliente para Server Components/Actions
│   │   │   └── middleware.ts     # Cliente para continuidad de sesión
│   │   └── utils.ts              # Funciones utilitarias (cn)
│   ├── types/                    # Definiciones de TypeScript
│   │   └── index.ts              # Tipos del sistema
│   └── proxy.ts                  # Continuidad de sesión y navegación protegida
├── supabase/
│   └── migrations/               # Migraciones SQL (aplicar en orden)
│       ├── 20261002000000_initial_schema.sql
│       ├── 20261014000000_api_security_and_domain.sql
│       ├── 20261014010000_workspace_operations.sql
│       └── 20261015000000_preserve_operational_records.sql
├── public/                       # Archivos estáticos
├── .dockerignore
├── .env.example                  # Plantilla de variables de entorno
├── .env.docker.example           # Plantilla pública para Docker Compose
├── eslint.config.mjs
├── .gitignore
├── Dockerfile                    # Imagen de la aplicación Next.js
├── docker-compose.yml            # Orquestación del entorno de desarrollo
├── next.config.mjs
├── next-env.d.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── tailwind.config.mjs
└── tsconfig.json
```

## Tecnologías

**Frontend:** React 19, Next.js 16 (App Router), TypeScript, Tailwind CSS 4, componentes UI propios/Radix y Zod para validación de formularios.

**Backend:** Next.js Route Handlers, Server Components y middleware para continuidad de sesión y protección de páginas.

**Base de datos y servicios:** PostgreSQL, Supabase Auth (`@supabase/ssr`) y Supabase Storage, con políticas de Row Level Security.

**Contenedores:** Docker y Docker Compose para levantar un entorno de desarrollo idéntico en todas las máquinas del equipo.

**Infraestructura:** Vercel para despliegue desde GitHub; Docker Compose para desarrollo local.

## Instalación

### Requisitos previos

- Docker Desktop (o Docker Engine con el plugin Compose)
- Una cuenta de Supabase con un proyecto creado
- Git

### Levantar el proyecto con Docker

```bash
# 1. Clonar el repositorio
git clone https://github.com/davidacerodev/Codify.git
cd Codify

# 2. Crear la configuración segura que consume el contenedor
cp .env.docker.example .env.docker
# Editar .env.docker con la URL y la clave pública anon de Supabase

# 3. Construir, si hace falta, y levantar la aplicación en segundo plano
docker compose up -d
```

La aplicación queda disponible en `http://localhost:3000`. Para ejecutarla solo se necesita Docker; Node.js y npm se instalan y ejecutan dentro del contenedor. En el primer uso, crea `.env.docker` desde la plantilla y configura la URL y la clave pública de Supabase. No se suben secretos al repositorio. Supabase es un servicio externo y debe estar accesible desde el contenedor. Compose publica el puerto en las interfaces IPv4 e IPv6 del equipo. Desde otro dispositivo de la misma red, abre `http://<IP-del-equipo>:3000`; el firewall debe permitir esa conexión. Este contenedor es de desarrollo, no debe exponerse directamente a Internet.

Comandos útiles durante el desarrollo:

```bash
docker compose up -d           # Levantar en segundo plano; construye la imagen si no existe
docker compose up -d --build   # Reconstruir después de cambiar Dockerfile o dependencias
docker compose logs -f web     # Ver los logs de la aplicación
docker compose exec web sh     # Abrir una terminal dentro del contenedor
docker compose down            # Detener y eliminar los contenedores
```

El `docker-compose.yml` monta el código como volumen, de modo que los cambios se reflejan en caliente. Al arrancar, el contenedor compara `package.json` y `package-lock.json` con las dependencias instaladas; ejecuta `npm ci` dentro de Docker cuando detecta cambios. `.next` y `node_modules` usan volúmenes del contenedor para evitar mezclar artefactos de Windows con los de Linux. El `Dockerfile` mantiene etapas separadas para desarrollo y producción.

La configuración de Docker se guarda en `.env.docker`, archivo ignorado por Git. Incluye URL y clave anon, y puede incluir `SUPABASE_SERVICE_ROLE_KEY` para las operaciones administrativas del servidor. Esa clave solo se lee en handlers de servidor y nunca debe llevar el prefijo `NEXT_PUBLIC_`. El contenedor monta este archivo como `.env.local` para Next.js.

### Aplicar migraciones de la base de datos

Las migraciones se encuentran en `supabase/migrations/` y deben aplicarse en orden. Los nombres usan versiones timestamp que Supabase CLI reconoce. El proyecto nuevo requiere las cuatro migraciones, en secuencia.

Antes de aplicar migraciones sobre el proyecto existente, consulta el historial remoto y prepara un respaldo. No apliques el esquema inicial a ciegas: sus políticas y triggers no son completamente repetibles. La migración `20261014000000` añade perfiles activos, horarios, movimientos inmutables, RLS y RPCs de disponibilidad y citas. La `20261014010000` implementa RPCs con controles de rol para perfil, usuarios, inventario, agenda y despacho; el despacho valida existencias, bloquea lotes, registra movimientos y auditoría, y acepta una clave idempotente.

La CLI se ejecuta dentro de Docker mediante el perfil `supabase`. Configura `.env.supabase` desde `.env.supabase.example` con token de acceso, contraseña de la base y referencia de proyecto. Luego ejecuta `docker compose --profile supabase run --rm supabase-cli link --project-ref <referencia>` y revisa el historial con `docker compose --profile supabase run --rm supabase-cli migration list --linked`. Primero realiza `db push --dry-run`; aplica solo después de confirmar que el historial coincide y que se está usando el proyecto de desarrollo correcto. No uses `db reset --linked`. La migración `20261015000000` bloquea el borrado físico de registros operativos; usa cancelación, desactivación o retiro del catálogo según el recurso.

El código de API cubre autenticación, lecturas bajo RLS y operaciones de citas, perfil, usuarios, horarios, inventario y despacho. Estas operaciones dependen de las migraciones aplicadas y de perfiles activos en Auth. La administración de usuarios requiere `SUPABASE_SERVICE_ROLE_KEY` disponible solo en el servidor. El código y la compilación no prueban el estado remoto: consulta y aplica las migraciones con las credenciales indicadas antes de habilitar datos reales.

### Scripts disponibles

| Comando | Descripción |
|---|---|
| `docker compose up -d` | Levanta la aplicación; construye la imagen si no está disponible. |
| `docker compose up -d --build` | Reconstruye la imagen tras cambios de Docker o dependencias. |
| `docker compose exec web npm run typecheck` | Comprueba los tipos dentro del contenedor. |
| `docker compose exec web npm run lint` | Ejecuta ESLint dentro del contenedor. |
| `docker compose logs -f web` | Sigue los logs de Next.js. |

## Variables de entorno

Para Docker, las variables se definen en `.env.docker`, generado desde `.env.docker.example`; el archivo local no debe subirse al repositorio. `.env.local` se reserva para herramientas que se ejecuten fuera de Docker o para configuraciones locales del framework.

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase. Se expone al navegador. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave pública (anon) de Supabase. Opera siempre bajo las políticas RLS. |
| `NEXT_PUBLIC_SITE_URL` | URL base de la aplicación, usada en los enlaces de correo de autenticación. |
| `NEXT_PUBLIC_DEMO_MODE` | Activa explícitamente los datos ficticios (`true`) o el backend real (`false`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial privilegiada solo de servidor; se usa para alta administrativa de usuarios. No exponer en el navegador ni registrar su valor. |

## Seguridad

- **Autenticación:** los handlers iniciales usan Supabase Auth y `@supabase/ssr`. Configura y verifica URLs de recuperación y cookies antes de habilitar producción.
- **Autorización por roles (RBAC):** la UI orienta la navegación, pero cada operación debe validar rol y relación con el recurso en el servidor; middleware por sí solo no concede permisos.
- **Control de acceso en la base de datos:** las migraciones `20261014000000` y `20261014010000` limitan las lecturas por rol y revocan escrituras directas. Aplicarlas y validar RLS por rol en desarrollo antes de usar datos reales.
- **Validación de datos:** los handlers validan entradas con Zod y PostgreSQL vuelve a comprobar permisos y reglas críticas en RPCs.
- **Reglas de negocio en el servidor:** despacho, existencias, ajustes y auditoría se confirman en operaciones transaccionales. La demo local usa almacenamiento del navegador y no protege datos de producción.
- **Manejo de secretos:** las credenciales viven en variables de entorno y en las configuraciones del proveedor de hosting, nunca en el código fuente.

## Pruebas

Las pruebas se ejecutan en contenedores Docker y usan cuentas y registros sintéticos:

| Comando | Cobertura |
|---|---|
| `docker compose exec web npm run check` | TypeScript y ESLint. Termina sin errores; actualmente reporta siete advertencias de hooks React. |
| `docker compose exec web npm run test:api:security` | 10 comprobaciones de autenticación, origen, validación y errores seguros. |
| `docker compose --profile test run --rm ui-test` | 17 recorridos de interfaz, incluido acceso por rol y vista móvil. |
| `docker compose --profile api-test run --rm api-test` | 11 pruebas API/RPC contra Supabase local; el runner restablece la base local al terminar. |
| `docker build --target builder -t codify-verification:local .` | Compilación optimizada de producción. |

La última verificación del candidato pasó esos cuatro grupos y la compilación de producción. `npm audit --omit=dev` no reporta vulnerabilidades; el árbol de desarrollo aún reporta una alerta alta de `braces` en la cadena de ESLint y el advisory consultado no publica una versión corregida. No resuelvas con `npm audit fix --force`, que propone degradar `eslint-config-next`.

## Equipo

Desarrollado por **Codify**.

## Licencia

Ver el archivo [LICENSE](./LICENSE).

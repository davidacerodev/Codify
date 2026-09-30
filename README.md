# Sistema de Información Web - Enfermería Unitrópico

> Proyecto en fase inicial de desarrollo. La estructura, los módulos y la documentación pueden cambiar durante los próximos sprints.

## Descripción

Sistema web para la gestión integral de los servicios de salud de la Enfermería de la Universidad Internacional del Trópico Americano (Unitrópico). La plataforma centraliza el agendamiento de citas, el control de existencias de medicamentos y su dispensación, bajo un esquema de acceso por roles que garantiza que cada usuario solo vea la información que le corresponde.

## Módulos

| Módulo | Descripción | Estado |
|---|---|---|
| Gestión de citas | Solicitud, agendamiento y calendario de atención. | En desarrollo |
| Inventario de medicamentos | Registro de medicamentos, lotes, fechas de vencimiento y existencias. | En desarrollo |
| Despacho de medicamentos | Salida de insumos con descuento automático de stock. | Planeado |
| Usuarios y roles | Administración de cuentas y asignación de perfiles. | En desarrollo |
| Autenticación | Inicio de sesión, cierre de sesión y recuperación de contraseña. | En desarrollo |
| Registros y trazabilidad | Historial de movimientos y acciones realizadas en el sistema. | Planeado |

## Arquitectura

El sistema se construye como una aplicación **fullstack monolítica modular** sobre Next.js (App Router). Tanto la interfaz de usuario como la lógica de servidor viven en el mismo repositorio y se despliegan en una sola plataforma, lo que evita mantener infraestructura separada para frontend y backend.

- **Capa de presentación:** componentes de React renderizados desde el App Router (Server Components y Client Components según la necesidad de interactividad).
- **Capa de servidor:** Server Actions para las operaciones de escritura (crear cita, registrar entrada de inventario, despachar medicamento) y API Routes solo cuando se requiera exponer endpoints REST.
- **Capa de persistencia (BaaS):** base de datos relacional PostgreSQL gestionada en Supabase, junto con autenticación y almacenamiento de archivos. Las reglas de acceso se aplican directamente en la base de datos mediante *Row Level Security* (RLS).
- **Control de navegación:** un `middleware.ts` global valida la sesión y el rol antes de permitir el acceso a las rutas protegidas.

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
│   │   │   └── middleware.ts     # Cliente para middleware
│   │   └── utils.ts              # Funciones utilitarias (cn)
│   ├── types/                    # Definiciones de TypeScript
│   │   └── index.ts              # Tipos del sistema
│   └── middleware.ts             # Control global de sesiones y roles
├── supabase/
│   └── migrations/               # Migraciones SQL
│       └── 001_initial_schema.sql # Esquema inicial con RLS
├── public/                       # Archivos estáticos
├── .dockerignore
├── .env.example                  # Plantilla de variables de entorno
├── .eslintrc.json
├── .gitignore
├── Dockerfile                    # Imagen de la aplicación Next.js
├── docker-compose.yml            # Orquestación del entorno de desarrollo
├── next.config.mjs
├── next-env.d.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

## Tecnologías

**Frontend:** React, Next.js (App Router), TypeScript, Tailwind CSS, Shadcn UI, React Hook Form y Zod para validación de formularios.

**Backend:** Next.js (Server Actions, Server Components, API Routes) y middleware para protección de rutas.

**Base de datos y servicios:** PostgreSQL, Supabase Auth (`@supabase/ssr`) y Supabase Storage, con políticas de Row Level Security.

**Contenedores:** Docker y Docker Compose para levantar un entorno de desarrollo idéntico en todas las máquinas del equipo.

**Infraestructura:** despliegue en Vercel o Netlify (nivel gratuito), con integración continua desde GitHub y certificado SSL automático.

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

# 2. Configurar las variables de entorno
cp .env.example .env.local
# Editar .env.local con las credenciales del proyecto de Supabase

# 3. Construir y levantar los servicios
docker compose up --build
```

Comandos útiles durante el desarrollo:

```bash
docker compose up -d           # Levantar en segundo plano
docker compose logs -f web     # Ver los logs de la aplicación
docker compose exec web sh     # Abrir una terminal dentro del contenedor
docker compose down            # Detener y eliminar los contenedores
```

El `docker-compose.yml` monta el código como volumen, de modo que los cambios se reflejan en caliente sin reconstruir la imagen. El `Dockerfile` usa una construcción multi-etapa: una etapa de desarrollo con todas las dependencias y una etapa de producción con la salida `standalone` de Next.js.

### Aplicar migraciones de la base de datos

1. Ir a Supabase Dashboard → SQL Editor
2. Crear una nueva query
3. Copiar el contenido de `supabase/migrations/001_initial_schema.sql`
4. Ejecutar la query

### Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Compilación para producción. |
| `npm run start` | Ejecuta la compilación de producción. |
| `npm run lint` | Análisis estático del código. |

## Variables de entorno

Las variables se definen en el archivo `.env.local`, que **no debe subirse al repositorio**. El archivo `.env.example` sirve como plantilla.

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase. Se expone al navegador. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave pública (anon) de Supabase. Opera siempre bajo las políticas RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave de servicio con privilegios elevados. **Solo en el servidor**; nunca debe llevar el prefijo `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | URL base de la aplicación, usada en los enlaces de correo de autenticación. |

## Seguridad

- **Autenticación:** gestionada con Supabase Auth. La sesión se transporta en cookies `httpOnly` mediante `@supabase/ssr`, de modo que el token no queda accesible desde JavaScript en el cliente.
- **Autorización por roles (RBAC):** cada usuario tiene un perfil con un rol asociado (administrador, médico, farmacéutico o paciente). El `middleware.ts` intercepta la navegación y redirige a quien no tenga permiso sobre la ruta solicitada.
- **Control de acceso en la base de datos:** las políticas de Row Level Security son la última línea de defensa. Aunque una consulta llegue directamente a PostgreSQL, un usuario solo puede leer o modificar las filas que le corresponden según su rol y su identificador. La validación en la interfaz nunca se asume suficiente.
- **Validación de datos:** toda entrada se valida con esquemas de Zod tanto en el cliente como dentro de los Server Actions, antes de tocar la base de datos.
- **Reglas de negocio en el servidor:** operaciones sensibles como la dispensación de medicamentos se ejecutan en transacciones que bloquean la salida si el stock es insuficiente o el lote está vencido.
- **Manejo de secretos:** las credenciales viven en variables de entorno y en las configuraciones del proveedor de hosting, nunca en el código fuente.

## Pruebas

La estrategia de pruebas se irá construyendo a medida que avancen los módulos. El plan contempla:

- **Pruebas unitarias** sobre los esquemas de validación y las funciones de cálculo de inventario.
- **Pruebas de integración** sobre los Server Actions de agendamiento y despacho.
- **Pruebas funcionales** guiadas por casos de uso, verificando los flujos completos de cada módulo.
- **Pruebas de control de acceso**, comprobando que un usuario no pueda acceder a rutas ni registros de otro rol.

> Aún no se han ejecutado pruebas formales. Esta sección se actualizará con las herramientas seleccionadas y los resultados obtenidos.

## Equipo

Desarrollado por **Codify**.

## Licencia

Ver el archivo [LICENSE](./LICENSE).

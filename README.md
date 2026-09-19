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
mi-sistema-salud/
├── src/
│   ├── app/                      # App Router: rutas y agrupaciones por layout
│   │   ├── (auth)/               # Autenticación (login, recuperación de contraseña)
│   │   ├── (dashboard)/          # Panel protegido para personal médico y administrativo
│   │   │   ├── citas/            # Gestión y calendario de citas
│   │   │   ├── inventario/       # Control de existencias y kardex
│   │   │   └── despacho/         # Dispensación de medicamentos
│   │   └── api/                  # Endpoints REST opcionales
│   ├── features/                 # Lógica aislada por módulo de negocio
│   │   ├── auth/                 # Sesiones y perfiles
│   │   ├── citas/                # Actions, componentes y schemas de agendamiento
│   │   ├── inventario/           # Actions, tablas y validaciones de medicamentos
│   │   └── despacho/             # Actions y procesos de salida de insumos
│   ├── components/               # UI base (Shadcn UI) y componentes compartidos
│   ├── lib/                      # Clientes de Supabase (client, server, middleware)
│   ├── types/                    # Definiciones de TypeScript
│   └── middleware.ts             # Control global de sesiones y roles
├── supabase/                     # Migraciones SQL y esquemas de base de datos
├── Dockerfile                    # Imagen de la aplicación Next.js
├── docker-compose.yml            # Orquestación del entorno de desarrollo
├── .dockerignore
└── .env.local
```

## Tecnologías

**Frontend:** React, Next.js (App Router), TypeScript, Tailwind CSS, Shadcn UI, React Hook Form y Zod para validación de formularios.

**Backend:** Next.js (Server Actions, Server Components, API Routes) y middleware para protección de rutas.

**Base de datos y servicios:** PostgreSQL, Supabase Auth (`@supabase/ssr`) y Supabase Storage, con políticas de Row Level Security.

**Contenedores:** Docker y Docker Compose para levantar un entorno de desarrollo idéntico en todas las máquinas del equipo y para ejecutar la instancia local de Supabase.

**Infraestructura:** despliegue en Vercel o Netlify (nivel gratuito), con integración continua desde GitHub y certificado SSL automático.

## Instalación

### Requisitos previos

- Docker Desktop (o Docker Engine con el plugin Compose)
- Node.js 18.17 o superior y npm, si se prefiere trabajar sin contenedor
- Una cuenta de Supabase con un proyecto creado
- Git

Hay dos formas de levantar el proyecto: con Docker (recomendada, porque todo el equipo trabaja sobre el mismo entorno) o directamente con Node.js en la máquina.

### Opción A: con Docker

```bash
# 1. Clonar el repositorio
git clone https://github.com/<organizacion>/mi-sistema-salud.git
cd mi-sistema-salud

# 2. Configurar las variables de entorno
cp .env.example .env.local

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

### Opción B: instalación local con Node.js

```bash
# 1. Clonar el repositorio
git clone https://github.com/<organizacion>/mi-sistema-salud.git
cd mi-sistema-salud

# 2. Instalar dependencias
npm install

# 3. Configurar las variables de entorno
cp .env.example .env.local
# Editar .env.local con las credenciales del proyecto de Supabase

# 4. Aplicar las migraciones de la base de datos
npx supabase link --project-ref <project-ref>
npx supabase db push

# 5. Levantar el servidor de desarrollo
npm run dev
```

En cualquiera de las dos opciones, la aplicación queda disponible en `http://localhost:3000`.

> La CLI de Supabase también trabaja sobre Docker. Si se quiere una base de datos local en lugar del proyecto en la nube, `npx supabase start` levanta PostgreSQL, Auth y Storage en contenedores y entrega las credenciales locales para el `.env.local`.

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

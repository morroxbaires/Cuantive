# CUANTIVE — Arquitectura del Sistema
## Plataforma SaaS de Control de Flotas Empresariales

> **Versión:** 1.0  
> **Mercado objetivo:** Uruguay  
> **Idioma:** Español  
> **Modelo:** Multi-Tenant SaaS  

---

## ÍNDICE

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Estructura de Carpetas Completa](#2-estructura-de-carpetas-completa)
3. [Arquitectura Backend](#3-arquitectura-backend)
4. [Arquitectura Frontend](#4-arquitectura-frontend)
5. [Flujo de Autenticación](#5-flujo-de-autenticación)
6. [Modelo Multi-Tenant](#6-modelo-multi-tenant)
7. [Sistema de Roles y Permisos](#7-sistema-de-roles-y-permisos)
8. [Arquitectura de Seguridad](#8-arquitectura-de-seguridad)
9. [Dashboard y Módulos del Sistema](#9-dashboard-y-módulos-del-sistema)
10. [Modelo de Base de Datos](#10-modelo-de-base-de-datos)

---

## 1. VISIÓN GENERAL DEL SISTEMA

### Descripción
Cuantive es una plataforma SaaS multi-tenant que permite a empresas uruguayas gestionar su flota de vehículos de manera centralizada, controlando combustible, mantenimientos, conductores y alertas operativas.

### Stack Tecnológico

| Capa            | Tecnología                        |
|-----------------|-----------------------------------|
| Frontend        | Next.js 14 + TailwindCSS + Chart.js |
| Backend API     | Node.js + Express.js              |
| ORM             | Prisma ORM                        |
| Base de Datos   | MySQL                             |
| Autenticación   | JWT (Access + Refresh Tokens)     |
| Almacenamiento  | Sistema de archivos / S3-compatible|

### Diagrama de Alto Nivel

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  NEXT.JS 14 FRONTEND                        │
│         (SSR + CSR — Panel único, multi-rol)                │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / REST API
┌──────────────────────────▼──────────────────────────────────┐
│               EXPRESS.JS API SERVER                         │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│    │  Auth    │  │ Empresa  │  │Vehículos │  │Conductor │  │
│    │ Router   │  │ Router   │  │  Router  │  │  Router  │  │
│    └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│    │Combustib.│  │Mantenim. │  │  Alertas │  │Configurac│  │
│    │  Router  │  │  Router  │  │  Router  │  │  Router  │  │
│    └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                         │                                   │
│              ┌──────────▼──────────┐                        │
│              │    PRISMA ORM       │                        │
│              └──────────┬──────────┘                        │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                     MySQL DATABASE                          │
│   (Aislamiento por tenant_id en todas las tablas)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. ESTRUCTURA DE CARPETAS COMPLETA

```
cuantive/
│
├── frontend/                          # Aplicación Next.js 14
│   ├── public/
│   │   ├── logos/                     # Logos de empresas (uploads)
│   │   └── assets/                    # Assets estáticos globales
│   │
│   ├── src/
│   │   ├── app/                       # App Router de Next.js 14
│   │   │   ├── (auth)/                # Grupo: páginas públicas
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   │
│   │   │   ├── (dashboard)/           # Grupo: páginas protegidas
│   │   │   │   ├── layout.tsx         # Layout con sidebar + navbar
│   │   │   │   │
│   │   │   │   ├── superroot/         # Rutas exclusivas superroot
│   │   │   │   │   ├── page.tsx       # Dashboard superroot
│   │   │   │   │   ├── empresas/
│   │   │   │   │   │   ├── page.tsx   # Listado de empresas
│   │   │   │   │   │   ├── nueva/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       └── page.tsx
│   │   │   │   │   └── administradores/
│   │   │   │   │       └── page.tsx
│   │   │   │   │
│   │   │   │   └── empresa/           # Rutas del admin de empresa
│   │   │   │       ├── page.tsx       # Dashboard empresa
│   │   │   │       ├── vehiculos/
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   ├── nuevo/
│   │   │   │       │   │   └── page.tsx
│   │   │   │       │   └── [id]/
│   │   │   │       │       └── page.tsx
│   │   │   │       ├── conductores/
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   ├── nuevo/
│   │   │   │       │   │   └── page.tsx
│   │   │   │       │   └── [id]/
│   │   │   │       │       └── page.tsx
│   │   │   │       ├── combustible/
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   └── nueva-carga/
│   │   │   │       │       └── page.tsx
│   │   │   │       ├── mantenimientos/
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   └── nuevo/
│   │   │   │       │       └── page.tsx
│   │   │   │       ├── alertas/
│   │   │   │       │   └── page.tsx
│   │   │   │       └── configuracion/
│   │   │   │           └── page.tsx
│   │   │   │
│   │   │   ├── api/                   # API Routes de Next.js (proxies)
│   │   │   │   └── [...proxy]/
│   │   │   │       └── route.ts
│   │   │   │
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx             # Root layout
│   │   │   └── not-found.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                    # Componentes base reutilizables
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Table.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Alert.tsx
│   │   │   │   └── Spinner.tsx
│   │   │   │
│   │   │   ├── layout/                # Componentes de estructura
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── Breadcrumb.tsx
│   │   │   │
│   │   │   ├── charts/                # Gráficos con Chart.js
│   │   │   │   ├── ConsumoChart.tsx
│   │   │   │   ├── MantenimientoChart.tsx
│   │   │   │   ├── FlotaResumenChart.tsx
│   │   │   │   └── AlertasChart.tsx
│   │   │   │
│   │   │   ├── vehiculos/
│   │   │   │   ├── VehiculoCard.tsx
│   │   │   │   ├── VehiculoForm.tsx
│   │   │   │   └── VehiculoTable.tsx
│   │   │   │
│   │   │   ├── conductores/
│   │   │   │   ├── ConductorCard.tsx
│   │   │   │   ├── ConductorForm.tsx
│   │   │   │   └── ConductorTable.tsx
│   │   │   │
│   │   │   ├── combustible/
│   │   │   │   ├── CargaCombustibleForm.tsx
│   │   │   │   └── CombustibleTable.tsx
│   │   │   │
│   │   │   ├── mantenimientos/
│   │   │   │   ├── MantenimientoForm.tsx
│   │   │   │   └── MantenimientoTable.tsx
│   │   │   │
│   │   │   └── alertas/
│   │   │       ├── AlertaItem.tsx
│   │   │       └── AlertaPanel.tsx
│   │   │
│   │   ├── hooks/                     # Custom React Hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useVehiculos.ts
│   │   │   ├── useConductores.ts
│   │   │   ├── useCombustible.ts
│   │   │   ├── useMantenimientos.ts
│   │   │   └── useAlertas.ts
│   │   │
│   │   ├── lib/                       # Utilidades y configuraciones
│   │   │   ├── api.ts                 # Cliente HTTP centralizado
│   │   │   ├── auth.ts                # Helpers de autenticación
│   │   │   ├── constants.ts           # Constantes globales
│   │   │   └── utils.ts               # Funciones utilitarias
│   │   │
│   │   ├── context/                   # React Context
│   │   │   ├── AuthContext.tsx
│   │   │   └── TenantContext.tsx
│   │   │
│   │   └── types/                     # Tipos TypeScript
│   │       ├── auth.types.ts
│   │       ├── empresa.types.ts
│   │       ├── vehiculo.types.ts
│   │       ├── conductor.types.ts
│   │       ├── combustible.types.ts
│   │       ├── mantenimiento.types.ts
│   │       └── alerta.types.ts
│   │
│   ├── middleware.ts                  # Middleware Next.js (protección rutas)
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                           # API Express.js
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts            # Configuración Prisma
│   │   │   ├── jwt.ts                 # Configuración JWT
│   │   │   ├── cors.ts                # Configuración CORS
│   │   │   └── env.ts                 # Variables de entorno
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts     # Verificación JWT
│   │   │   ├── tenant.middleware.ts   # Inyección tenant_id
│   │   │   ├── role.middleware.ts     # Control de roles
│   │   │   ├── error.middleware.ts    # Manejo global de errores
│   │   │   ├── logger.middleware.ts   # Logging de peticiones
│   │   │   └── upload.middleware.ts   # Manejo de archivos (logos)
│   │   │
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.router.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── auth.validation.ts
│   │   │   │
│   │   │   ├── superroot/
│   │   │   │   ├── superroot.router.ts
│   │   │   │   ├── superroot.controller.ts
│   │   │   │   └── superroot.service.ts
│   │   │   │
│   │   │   ├── empresas/
│   │   │   │   ├── empresa.router.ts
│   │   │   │   ├── empresa.controller.ts
│   │   │   │   ├── empresa.service.ts
│   │   │   │   └── empresa.validation.ts
│   │   │   │
│   │   │   ├── vehiculos/
│   │   │   │   ├── vehiculo.router.ts
│   │   │   │   ├── vehiculo.controller.ts
│   │   │   │   ├── vehiculo.service.ts
│   │   │   │   └── vehiculo.validation.ts
│   │   │   │
│   │   │   ├── conductores/
│   │   │   │   ├── conductor.router.ts
│   │   │   │   ├── conductor.controller.ts
│   │   │   │   ├── conductor.service.ts
│   │   │   │   └── conductor.validation.ts
│   │   │   │
│   │   │   ├── combustible/
│   │   │   │   ├── combustible.router.ts
│   │   │   │   ├── combustible.controller.ts
│   │   │   │   ├── combustible.service.ts
│   │   │   │   └── combustible.validation.ts
│   │   │   │
│   │   │   ├── mantenimientos/
│   │   │   │   ├── mantenimiento.router.ts
│   │   │   │   ├── mantenimiento.controller.ts
│   │   │   │   ├── mantenimiento.service.ts
│   │   │   │   └── mantenimiento.validation.ts
│   │   │   │
│   │   │   ├── alertas/
│   │   │   │   ├── alerta.router.ts
│   │   │   │   ├── alerta.controller.ts
│   │   │   │   ├── alerta.service.ts
│   │   │   │   └── alerta.validation.ts
│   │   │   │
│   │   │   └── configuracion/
│   │   │       ├── configuracion.router.ts
│   │   │       ├── configuracion.controller.ts
│   │   │       └── configuracion.service.ts
│   │   │
│   │   ├── utils/
│   │   │   ├── response.ts            # Formato estándar de respuestas
│   │   │   ├── pagination.ts          # Paginación reutilizable
│   │   │   ├── validators.ts          # Validaciones comunes
│   │   │   └── logger.ts              # Sistema de logging
│   │   │
│   │   └── app.ts                     # Punto de entrada Express
│   │
│   ├── prisma/
│   │   ├── schema.prisma              # Esquema completo de BD
│   │   ├── seed.ts                    # Datos iniciales (superroot)
│   │   └── migrations/                # Historial de migraciones
│   │
│   ├── uploads/                       # Logos de empresas
│   ├── logs/                          # Archivos de log
│   ├── .env                           # Variables de entorno
│   ├── tsconfig.json
│   └── package.json
│
├── docker-compose.yml                 # Orquestación local
├── .gitignore
└── README.md
```

---

## 3. ARQUITECTURA BACKEND

### Patrón Arquitectural: Módulos por Dominio (DDD Simplificado)

Cada módulo de negocio es completamente independiente y sigue la misma estructura de capas:

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────┐
│              MIDDLEWARE PIPELINE                │
│  Logger → Auth JWT → Tenant Inject → Role Guard │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│                  ROUTER                         │
│  Define rutas y aplica validaciones de entrada  │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│                CONTROLLER                       │
│  Recibe req/res, llama al servicio, responde     │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│                  SERVICE                        │
│  Lógica de negocio pura, siempre filtra por      │
│  tenant_id — NUNCA accede a BD directamente      │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│               PRISMA ORM                        │
│  Queries tipadas, transacciones, relaciones      │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
              MySQL Database
```

### Endpoints API — Resumen por Módulo

#### `/api/auth`
| Método | Ruta             | Descripción                        |
|--------|------------------|------------------------------------|
| POST   | `/login`         | Login universal (todos los roles)  |
| POST   | `/refresh`       | Renovar access token               |
| POST   | `/logout`        | Invalidar refresh token            |
| GET    | `/me`            | Datos del usuario autenticado      |

#### `/api/superroot/empresas`
| Método | Ruta             | Descripción                        |
|--------|------------------|------------------------------------|
| GET    | `/`              | Listar todas las empresas          |
| POST   | `/`              | Crear empresa nueva                |
| GET    | `/:id`           | Ver detalle de empresa             |
| PUT    | `/:id`           | Editar empresa                     |
| PATCH  | `/:id/estado`    | Activar / desactivar empresa       |
| POST   | `/:id/logo`      | Subir logo de empresa              |
| POST   | `/:id/admin`     | Crear administrador de empresa     |

#### `/api/vehiculos` (con tenant automático)
| Método | Ruta             | Descripción                        |
|--------|------------------|------------------------------------|
| GET    | `/`              | Listar vehículos del tenant        |
| POST   | `/`              | Agregar vehículo                   |
| GET    | `/:id`           | Detalle de vehículo                |
| PUT    | `/:id`           | Editar vehículo                    |
| DELETE | `/:id`           | Dar de baja vehículo               |

#### `/api/combustible`
| Método | Ruta             | Descripción                        |
|--------|------------------|------------------------------------|
| GET    | `/`              | Historial de cargas                |
| POST   | `/`              | Registrar nueva carga              |
| GET    | `/estadisticas`  | Consumo por vehículo/período       |
| GET    | `/vehiculo/:id`  | Cargas de un vehículo              |

#### `/api/mantenimientos`
| Método | Ruta             | Descripción                        |
|--------|------------------|------------------------------------|
| GET    | `/`              | Listar mantenimientos              |
| POST   | `/`              | Registrar mantenimiento            |
| PUT    | `/:id`           | Actualizar mantenimiento           |
| GET    | `/proximos`      | Próximos mantenimientos            |

#### `/api/alertas`
| Método | Ruta             | Descripción                        |
|--------|------------------|------------------------------------|
| GET    | `/`              | Alertas activas del tenant         |
| PATCH  | `/:id/leida`     | Marcar alerta como leída           |
| DELETE | `/:id`           | Eliminar alerta                    |

#### `/api/conductores`
| Método | Ruta             | Descripción                        |
|--------|------------------|------------------------------------|
| GET    | `/`              | Listar conductores                 |
| POST   | `/`              | Agregar conductor                  |
| GET    | `/:id`           | Detalle conductor                  |
| PUT    | `/:id`           | Editar conductor                   |
| DELETE | `/:id`           | Dar de baja conductor              |

#### `/api/configuracion`
| Método | Ruta             | Descripción                        |
|--------|------------------|------------------------------------|
| GET    | `/combustible`   | Obtener config combustible         |
| PUT    | `/combustible`   | Actualizar umbrales/alertas        |

---

## 4. ARQUITECTURA FRONTEND

### Estrategia de Renderizado

| Tipo de Página              | Estrategia    | Razón                              |
|-----------------------------|---------------|------------------------------------|
| Login                       | SSR           | SEO + seguridad                    |
| Dashboard principal         | CSR           | Datos en tiempo real               |
| Listados (vehículos, etc.)  | CSR + SWR     | Caché y revalidación               |
| Detalle de vehículo/conductor| CSR          | Interactividad                     |
| Reportes / estadísticas     | CSR           | Chart.js dinámico                  |

### Sistema de Rutas y Protección

```
/ (raíz)
│
├── /login                    → Pública — redirige si ya hay sesión
│
├── /superroot/               → Solo ROL: SUPERROOT
│   ├── /dashboard
│   ├── /empresas
│   ├── /empresas/nueva
│   ├── /empresas/[id]
│   └── /administradores
│
└── /empresa/                 → Solo ROL: ADMIN_EMPRESA
    ├── /dashboard
    ├── /vehiculos
    ├── /vehiculos/nuevo
    ├── /vehiculos/[id]
    ├── /conductores
    ├── /conductores/nuevo
    ├── /conductores/[id]
    ├── /combustible
    ├── /combustible/nueva-carga
    ├── /mantenimientos
    ├── /mantenimientos/nuevo
    ├── /alertas
    └── /configuracion
```

### Middleware de Protección (Next.js Middleware)

```
Toda petición a rutas protegidas pasa por middleware.ts:

1. Verificar si existe token en cookie/localStorage
2. Decodificar payload del JWT (sin verificar firma — solo extraer rol)
3. Si el token no existe → redirigir a /login
4. Si el rol no coincide con la ruta → redirigir a /sin-permisos
5. Si el token expiró → intentar refresh automático
6. Permitir acceso
```

### Gestión de Estado

| Estado               | Solución             | Justificación                    |
|----------------------|----------------------|----------------------------------|
| Autenticación global | React Context        | Disponible en toda la app        |
| Datos del tenant     | React Context        | Logo, nombre empresa             |
| Datos remotos        | Custom Hooks + Fetch | Simplicidad, sin Redux overhead  |
| Formularios          | React Hook Form      | Validación robusta               |
| Notificaciones       | Context + Toast      | Alertas del sistema              |

---

## 5. FLUJO DE AUTENTICACIÓN

### Sistema de Tokens: Access Token + Refresh Token

```
┌──────────┐    POST /api/auth/login       ┌──────────────┐
│  Usuario │ ─────────────────────────────► │   Backend    │
│          │    { email, password }         │              │
│          │                               │  1. Validar  │
│          │                               │  2. Generar  │
│          │    ◄─────────────────────────── │   tokens    │
│          │    {                           │              │
│          │      accessToken,  (15 min)   └──────────────┘
│          │      refreshToken  (7 días)
│          │    }
│          │
│          │    Guarda refreshToken en HttpOnly Cookie
│          │    Guarda accessToken en memoria (contexto)
│          │
│          │    ── Petición normal ──────────────────────►
│          │    Authorization: Bearer {accessToken}
│          │
│          │    ── Token expirado ──────────────────────►
│          │    POST /api/auth/refresh
│          │    Cookie: refreshToken
│          │    ◄────────────────────────────────────────
│          │    { nuevoAccessToken }
└──────────┘
```

### Payload del JWT

```json
{
  "sub": "uuid-del-usuario",
  "email": "admin@empresa.com",
  "rol": "ADMIN_EMPRESA",
  "tenantId": "uuid-de-la-empresa",
  "empresaNombre": "Transportes Del Norte S.A.",
  "iat": 1710000000,
  "exp": 1710000900
}
```

### Estados de Autenticación

| Estado         | Descripción                                        |
|----------------|----------------------------------------------------|
| `AUTENTICADO`  | Token válido, sesión activa                        |
| `RENOVANDO`    | Access expirado, refresh en curso                  |
| `NO_AUTENTICADO` | Sin token o refresh falló                        |
| `BLOQUEADO`    | Empresa desactivada por superroot                  |

---

## 6. MODELO MULTI-TENANT

### Estrategia: Base de datos compartida, datos aislados por `tenant_id`

Se utiliza el enfoque **Shared Database + Discriminator Column** por su simplicidad de mantenimiento y costo operativo adecuado para el mercado uruguayo.

```
┌─────────────────────────────────────────────────┐
│              BASE DE DATOS ÚNICA                │
│                                                 │
│  ┌─────────────┐  ┌─────────────┐               │
│  │  Empresa A  │  │  Empresa B  │               │
│  │ tenant_id=1 │  │ tenant_id=2 │               │
│  └─────────────┘  └─────────────┘               │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │           TABLA: vehiculos              │   │
│  ├─────────┬─────────────┬─────────────────┤   │
│  │ id      │ tenant_id   │ otros campos... │   │
│  ├─────────┼─────────────┼─────────────────┤   │
│  │  uuid1  │      1      │ Camión A        │   │
│  │  uuid2  │      1      │ Furgón B        │   │
│  │  uuid3  │      2      │ Auto C          │   │  ← Empresa B NO ve esto
│  └─────────┴─────────────┴─────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Regla de Oro del Multi-Tenant

> **Toda consulta a la base de datos en el backend DEBE incluir `WHERE tenant_id = :tenantId`**  
> El `tenantId` se extrae del JWT en el middleware y se inyecta automáticamente en `req.tenantId`.

### Middleware Tenant (Flujo)

```
JWT Decodificado
      │
      ▼
┌─────────────────────────────────┐
│       tenant.middleware.ts      │
│                                 │
│  1. Extrae tenantId del JWT     │
│  2. Verifica empresa activa     │
│  3. Inyecta req.tenantId        │
│  4. Inyecta req.empresaData     │
└─────────────────────────────────┘
      │
      ▼
  Service Layer
  (siempre filtra por tenantId)
```

---

## 7. SISTEMA DE ROLES Y PERMISOS

### Jerarquía de Roles

```
                  ┌─────────────┐
                  │  SUPERROOT  │  ← Admin global del sistema
                  └──────┬──────┘
                         │ Puede crear y gestionar
           ┌─────────────┴─────────────┐
           │                           │
    ┌──────▼──────┐             ┌──────▼──────┐
    │  EMPRESA A  │             │  EMPRESA B  │
    └──────┬──────┘             └──────┬──────┘
           │                           │
    ┌──────▼──────┐             ┌──────▼──────┐
    │ADMIN_EMPRESA│             │ADMIN_EMPRESA│
    └─────────────┘             └─────────────┘
```

### Matriz de Permisos

| Acción                          | SUPERROOT | ADMIN_EMPRESA |
|---------------------------------|:---------:|:-------------:|
| Crear empresa                   |     ✅    |       ❌      |
| Editar empresa                  |     ✅    |       ❌      |
| Activar/desactivar empresa      |     ✅    |       ❌      |
| Asignar logo empresa            |     ✅    |       ❌      |
| Crear admin de empresa          |     ✅    |       ❌      |
| Ver todas las empresas          |     ✅    |       ❌      |
| Gestionar vehículos             |     ❌    |       ✅      |
| Gestionar conductores           |     ❌    |       ✅      |
| Registrar cargas combustible    |     ❌    |       ✅      |
| Registrar mantenimientos        |     ❌    |       ✅      |
| Ver alertas propias             |     ❌    |       ✅      |
| Configurar umbrales combustible |     ❌    |       ✅      |
| Ver estadísticas de su flota    |     ❌    |       ✅      |

### Implementación del Control de Acceso

```
Flujo de una petición protegida:

Request → auth.middleware (verifica JWT válido)
        → tenant.middleware (extrae tenantId)
        → role.middleware (verifica rol requerido)
        → Controller → Service (filtra por tenantId)
```

El `role.middleware` recibe una lista de roles permitidos por ruta y rechaza con `403 Forbidden` si el rol del JWT no está incluido.

---

## 8. ARQUITECTURA DE SEGURIDAD

### Capas de Seguridad

```
┌─────────────────────────────────────────────────────────┐
│  CAPA 1 — TRANSPORTE                                    │
│  HTTPS obligatorio en producción                        │
│  Certificados TLS/SSL                                   │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  CAPA 2 — AUTENTICACIÓN                                 │
│  JWT con expiración corta (15 min)                      │
│  Refresh Token en HttpOnly Cookie (no accesible por JS) │
│  Bcrypt para hashing de contraseñas (salt rounds: 12)   │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  CAPA 3 — AUTORIZACIÓN                                  │
│  Control de roles por middleware                        │
│  Aislamiento total por tenant_id                        │
│  Validación de que el recurso pertenece al tenant       │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  CAPA 4 — VALIDACIÓN DE ENTRADA                         │
│  Validación con Zod en cada endpoint                    │
│  Sanitización de inputs                                 │
│  Prevención de SQL Injection (Prisma ORM parametrizado) │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  CAPA 5 — PROTECCIÓN DE API                             │
│  Rate Limiting por IP y por usuario                     │
│  Helmet.js (headers de seguridad HTTP)                  │
│  CORS restringido a dominios permitidos                 │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  CAPA 6 — ESTADO DE EMPRESA                             │
│  Si empresa.activa = false → bloquear todas las         │
│  peticiones del tenant aunque el JWT sea válido         │
└─────────────────────────────────────────────────────────┘
```

### Headers de Seguridad (Helmet.js)

| Header                       | Valor configurado                    |
|------------------------------|--------------------------------------|
| `X-Content-Type-Options`     | `nosniff`                            |
| `X-Frame-Options`            | `DENY`                               |
| `Strict-Transport-Security`  | `max-age=31536000; includeSubDomains`|
| `X-XSS-Protection`           | `1; mode=block`                      |
| `Content-Security-Policy`    | Configurado por entorno              |

### Protección de Datos Multi-Tenant

Ante cualquier petición de recursos (vehículo, conductor, etc.), el service ejecuta la verificación en dos pasos:

1. Buscar el recurso por `id` **y** `tenant_id` simultáneamente.
2. Si no existe (o pertenece a otro tenant) → responder `404 Not Found` (nunca `403`, para no revelar existencia de datos de otros tenants).

---

## 9. DASHBOARD Y MÓDULOS DEL SISTEMA

### Dashboard Superroot

Información global del sistema. No tiene acceso a datos operativos de ninguna empresa.

```
┌─────────────────────────────────────────────────────────┐
│  DASHBOARD SUPERROOT                                    │
├──────────────┬──────────────┬──────────────┬───────────┤
│ Total        │ Empresas     │ Empresas     │ Registros │
│ Empresas     │ Activas      │ Inactivas    │ Hoy       │
│    [N]       │    [N]       │    [N]       │   [N]     │
├──────────────┴──────────────┴──────────────┴───────────┤
│                                                         │
│  LISTADO DE EMPRESAS                                    │
│  ┌────────────────────────────────────────────────┐    │
│  │ Logo │ Nombre │ Admin │ Estado │ Vehículos │ ⚙ │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  [+ Nueva Empresa]                                      │
└─────────────────────────────────────────────────────────┘
```

### Dashboard Admin de Empresa

Vista operativa completa de su flota. Todos los datos filtrados por su `tenant_id`.

```
┌─────────────────────────────────────────────────────────┐
│  [Logo Empresa]  DASHBOARD — {Nombre Empresa}           │
├───────────┬───────────┬───────────┬────────────────────┤
│ Vehículos │Conductores│ Alertas   │ Costo Combustible  │
│ Activos   │ Activos   │ Pendientes│ Mes Actual         │
│   [N]     │   [N]     │   [N] 🔴  │  UYU [N]           │
├───────────┴───────────┴───────────┴────────────────────┤
│                                                         │
│  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │ CONSUMO MENSUAL     │  │ MANTENIMIENTOS PRÓXIMOS │  │
│  │ [Chart.js - Barras] │  │ [Chart.js - Timeline]   │  │
│  └─────────────────────┘  └─────────────────────────┘  │
│                                                         │
│  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │ TOP 5 VEHÍCULOS     │  │ ALERTAS RECIENTES       │  │
│  │ [Chart.js - Donut]  │  │ [Lista con badges]      │  │
│  └─────────────────────┘  └─────────────────────────┘  │
│                                                         │
│  ÚLTIMAS CARGAS DE COMBUSTIBLE                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Fecha │ Vehículo │ Conductor │ Litros │ Costo  │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Módulos Operativos — Descripción

#### Vehículos
Registro completo del parque automotor. Campos clave: matrícula uruguaya, marca, modelo, año, tipo (camión, furgón, automóvil, etc.), odómetro actual, estado (activo/inactivo/en mantenimiento), conductor asignado.

#### Conductores
Gestión del personal habilitado para conducir. Campos: cédula de identidad, nombre, categoría de libreta (A, B, C, D), fecha vencimiento libreta, teléfono, estado. Sistema de alertas por vencimiento de libreta.

#### Cargas de Combustible
Registro de cada carga con: vehículo, conductor, fecha/hora, estación, litros cargados, precio por litro, total en pesos uruguayos (UYU), odómetro al momento de la carga. Cálculo automático de consumo (km/litro). Configuración de alertas por consumo excesivo.

#### Mantenimientos
Historial de mantenimientos correctivos y preventivos. Campos: vehículo, tipo (preventivo/correctivo), descripción, fecha realización, próxima fecha/km, costo en UYU, taller. Generación automática de alertas cuando se aproxima el próximo servicio.

#### Alertas
Sistema automático de notificaciones que genera alertas para:
- Vencimiento de libreta de conducir del conductor
- Próximo mantenimiento por fecha o por kilometraje
- Consumo de combustible superior al umbral configurado
- Vehículo sin carga de combustible por más de X días
- Documentación vehicular próxima a vencer

#### Configuración de Combustible
Permite a cada empresa configurar: tipo de combustible preferido por vehículo (gasoil, súper 95, súper 98), umbral de alerta de consumo excesivo (litros/100km), frecuencia esperada de carga.

---

## 10. MODELO DE BASE DE DATOS

### Entidades Principales y Relaciones

```
┌──────────────┐         ┌──────────────────────────────────────┐
│   usuarios   │         │              empresas                │
├──────────────┤         ├──────────────────────────────────────┤
│ id (PK)      │◄────────│ id (PK)                              │
│ empresa_id   │         │ nombre                               │
│ nombre       │         │ rut               (RUT Uruguay)      │
│ email        │         │ telefono                             │
│ password     │         │ direccion                            │
│ rol          │         │ logo_url                             │
│ activo       │         │ activo                               │
│ created_at   │         │ created_at                           │
└──────────────┘         └──────────────────────────────────────┘
                                      │
                    ┌─────────────────┼──────────────────┐
                    │                 │                  │
         ┌──────────▼───┐   ┌─────────▼──────┐  ┌───────▼──────────┐
         │  vehiculos   │   │  conductores   │  │  config_combust. │
         ├──────────────┤   ├────────────────┤  ├──────────────────┤
         │ id           │   │ id             │  │ id               │
         │ empresa_id   │   │ empresa_id     │  │ empresa_id       │
         │ matricula    │   │ cedula         │  │ tipo_combustible  │
         │ marca        │   │ nombre         │  │ umbral_litros    │
         │ modelo       │   │ apellido       │  │ alerta_activa    │
         │ anio         │   │ categoria_lib. │  └──────────────────┘
         │ tipo         │   │ venc_libreta   │
         │ odometro     │   │ telefono       │
         │ combustible  │   │ activo         │
         │ activo       │   └───────┬────────┘
         └──────┬───────┘          │
                │                  │
     ┌──────────┼──────────────────┘
     │          │
┌────▼─────┐  ┌─▼─────────────────┐  ┌──────────────────────┐
│cargas    │  │  mantenimientos   │  │      alertas         │
│combustib.│  ├───────────────────┤  ├──────────────────────┤
├──────────┤  │ id                │  │ id                   │
│ id       │  │ empresa_id        │  │ empresa_id           │
│empresa_id│  │ vehiculo_id       │  │ vehiculo_id (null ok)│
│vehiculo_i│  │ tipo              │  │ conductor_id(null ok)│
│conductor_│  │ descripcion       │  │ tipo_alerta          │
│fecha     │  │ fecha_realizado   │  │ mensaje              │
│litros    │  │ prox_fecha        │  │ leida                │
│precio_l. │  │ prox_km           │  │ created_at           │
│total_uyu │  │ costo_uyu         │  └──────────────────────┘
│odometro  │  │ taller            │
│km_litro  │  │ created_at        │
└──────────┘  └───────────────────┘
```

### Convenciones de la Base de Datos

| Convención             | Regla aplicada                                    |
|------------------------|---------------------------------------------------|
| IDs                    | UUID v4 (no secuenciales — dificulta enumeración) |
| Fechas                 | DATETIME con timezone UTC                         |
| Moneda                 | DECIMAL(10,2) en pesos uruguayos (UYU)            |
| Soft deletes           | Campo `activo BOOLEAN DEFAULT true`               |
| Auditoría              | `created_at`, `updated_at` en todas las tablas    |
| tenant_id              | `empresa_id` presente en TODAS las tablas         |
| Índices                | `empresa_id` indexado en todas las tablas         |

---

## RESUMEN EJECUTIVO

| Aspecto                | Decisión                              | Razón                                    |
|------------------------|---------------------------------------|------------------------------------------|
| Multi-tenancy          | Shared DB + tenant_id                 | Costo operativo bajo, simplicidad        |
| Autenticación          | JWT Access + Refresh en HttpOnly Cookie | Seguridad + UX fluida                  |
| Aislamiento de datos   | Middleware automático de tenant       | Imposible olvidar filtrar por empresa    |
| Roles                  | 2 roles: SUPERROOT + ADMIN_EMPRESA    | Simple, claro, escalable                 |
| Moneda                 | UYU (pesos uruguayos)                 | Mercado local Uruguay                    |
| Documentos             | RUT + Cédula de Identidad Uruguay     | Normativa local                          |
| Alertas                | Generadas automáticamente por reglas  | Reducir trabajo manual del admin         |
| Logo empresa           | Upload + almacenamiento local/S3      | Identidad visual por tenant              |
```

---

*Cuantive — Arquitectura v1.0 — Sistema SaaS de Control de Flotas para Uruguay*

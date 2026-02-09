# 🏥 Sistema de Gestión Hospitalaria

**Proyecto Final - Bases de Datos**  
Instituto Politécnico Nacional - Escuela Superior de Cómputo  
Periodo: 26-2

---

## 📋 Descripción del Proyecto

Sistema completo de gestión hospitalaria que maneja:
- 🏥 Citas médicas con validación de reglas de negocio
- 💊 Farmacia e inventario de medicamentos
- 📝 Recetas médicas digitales
- 💰 Sistema de pagos y políticas de cancelación
- 📊 Bitácoras de auditoría
- 👥 Gestión de pacientes, doctores y recepcionistas

---

## 🏗️ Arquitectura del Proyecto

```
proyecto-hospital/
│
├── 📂 backend/                    # API REST (Node.js + Express)
│   ├── config/                    # Configuración de BD
│   ├── database/                  # Scripts SQL
│   ├── middleware/                # Autenticación y validaciones
│   ├── routes/                    # Endpoints de la API
│   └── server.js                  # Servidor principal
│
├── 📂 frontend/                   # Interfaz de Usuario
│   ├── css/                       # Estilos
│   ├── js/                        # Lógica del cliente
│   │   ├── api.js                 # Cliente API (NUEVO)
│   │   ├── auth-integrated.js     # Auth con backend (NUEVO)
│   │   └── ...
│   ├── *.html                     # Páginas
│   └── README.md
│
├── 📄 INSTALACION.md              # Guía de instalación
├── 📄 INICIO_RAPIDO.md            # Inicio rápido
└── 📄 README.md                   # Este archivo
```

---

## ✨ Características Principales

### ✅ Backend (API REST)
- **Node.js + Express**: Framework robusto y escalable
- **SQL Server**: Base de datos relacional completa
- **JWT**: Autenticación segura con tokens
- **30+ Endpoints**: CRUD completo para todas las entidades
- **Validaciones**: Express-validator para datos de entrada
- **Triggers**: Lógica automática en base de datos
- **Procedimientos Almacenados**: Operaciones complejas optimizadas

### ✅ Frontend (Interfaz Web)
- **HTML5 + CSS3**: Diseño moderno y responsivo
- **JavaScript Vanilla**: Sin dependencias externas
- **SPA**: Navegación fluida sin recargas
- **Dashboards**: Tres interfaces según rol de usuario
- **Validaciones**: Cliente y servidor
- **API Client**: Comunicación asíncrona con backend

### ✅ Base de Datos
- **18 Tablas**: Estructura normalizada
- **5 Procedimientos**: Lógica de negocio encapsulada
- **4 Triggers**: Automatización de procesos
- **2 Bitácoras**: Auditoría completa
- **Índices**: Optimización de consultas

---

## 🚀 Inicio Rápido

### Prerequisitos

- ✅ Node.js v16+ ([Descargar](https://nodejs.org/))
- ✅ SQL Server 2019+ ([Descargar Express](https://www.microsoft.com/es-mx/sql-server/sql-server-downloads))
- ✅ Git (opcional)

### Instalación en 3 Pasos

#### 1️⃣ Configurar Base de Datos (5 min)

```bash
# Abrir SQL Server Management Studio o Azure Data Studio
# Ejecutar en orden:
1. backend/database/01_create_database.sql
2. backend/database/02_triggers_procedures.sql
3. backend/database/03_test_data.sql
```

#### 2️⃣ Iniciar Backend (2 min)

```bash
cd backend
npm install
cp .env.example .env

# Editar .env con tus credenciales de SQL Server
# Iniciar servidor
npm run dev

# Deberías ver: 🚀 Servidor ejecutándose en http://localhost:3000
```

#### 3️⃣ Iniciar Frontend (1 min)

```bash
cd frontend

# Opción A: Live Server (VSCode)
# Clic derecho en index.html > "Open with Live Server"

# Opción B: Python
python -m http.server 5500

# Opción C: Node
npx http-server -p 5500
```

### 🎉 ¡Listo!

- **Frontend**: http://localhost:5500
- **Backend**: http://localhost:3000
- **API Health**: http://localhost:3000/health

---

## 🧪 Probar el Sistema

### Credenciales de Prueba

**Password para todas las cuentas:** `hospital123`

| Rol | Email |
|-----|-------|
| 👤 **Paciente** | paciente1@email.com |
| 👨‍⚕️ **Doctor** | dr.garcia@hospital.com |
| 📋 **Recepcionista** | recep.gonzalez@hospital.com |

### Flujo de Prueba

1. **Login como Paciente**
   - Agendar una cita
   - Ver especialidades
   - Ver comprobante de pago
   - Cancelar cita

2. **Login como Doctor**
   - Ver citas del día
   - Consultar pacientes
   - Crear receta médica
   - Ver historial médico

3. **Login como Recepcionista**
   - Ver dashboard con estadísticas
   - Gestionar citas
   - Realizar ventas de farmacia
   - Consultar bitácoras

---

## 📊 Endpoints de la API

### Autenticación
```
POST   /api/auth/login          # Iniciar sesión
POST   /api/auth/register       # Registrar paciente
GET    /api/auth/verify         # Verificar token
```

### Citas
```
GET    /api/citas                          # Obtener citas
POST   /api/citas/agendar                  # Agendar cita
POST   /api/citas/cancelar/:folio          # Cancelar cita
POST   /api/citas/pagar                    # Confirmar pago
GET    /api/citas/horarios-disponibles/:id # Horarios disponibles
```

### Especialidades
```
GET    /api/especialidades              # Listar todas
GET    /api/especialidades/:id          # Ver detalles
GET    /api/especialidades/:id/doctores # Doctores por especialidad
```

### Pacientes
```
GET    /api/pacientes                 # Listar (recepcionista)
GET    /api/pacientes/perfil          # Ver perfil
GET    /api/pacientes/historial-medico # Ver historial
PUT    /api/pacientes/perfil          # Actualizar perfil
```

### Doctores
```
GET    /api/doctores                     # Listar todos
GET    /api/doctores/perfil              # Ver perfil
GET    /api/doctores/pacientes           # Mis pacientes
GET    /api/doctores/pacientes/:id/historial # Historial de paciente
POST   /api/doctores/recetas             # Crear receta
```

### Farmacia
```
GET    /api/farmacia/medicamentos       # Inventario
GET    /api/farmacia/servicios          # Servicios disponibles
POST   /api/farmacia/ventas             # Realizar venta
GET    /api/farmacia/ventas             # Historial de ventas
```

Ver documentación completa: `backend/README.md`

---

## 📁 Estructura de Archivos

### Backend

```
backend/
├── config/
│   └── database.js              # Conexión SQL Server
├── database/
│   ├── 01_create_database.sql   # Estructura de BD
│   ├── 02_triggers_procedures.sql # Lógica de negocio
│   └── 03_test_data.sql         # Datos de prueba
├── middleware/
│   └── auth.js                  # JWT y permisos
├── routes/
│   ├── auth.js                  # Autenticación
│   ├── cita.js                  # Gestión de citas
│   ├── doctor.js                # Módulo doctor
│   ├── especialidad.js          # Especialidades
│   ├── farmacia.js              # Farmacia y ventas
│   ├── paciente.js              # Módulo paciente
│   └── recepcionista.js         # Módulo recepcionista
├── .env.example                 # Variables de entorno
├── .gitignore
├── package.json
├── README.md
└── server.js                    # Servidor principal
```

### Frontend

```
frontend/
├── css/
│   ├── auth.css                 # Estilos login/registro
│   ├── dashboard.css            # Estilos dashboards
│   └── home.css                 # Estilos página principal
├── js/
│   ├── api.js                   # 🆕 Cliente API completo
│   ├── auth.js                  # Auth original (offline)
│   ├── auth-integrated.js       # 🆕 Auth con backend
│   ├── dashboard-paciente.js    # Lógica dashboard paciente
│   ├── dashboard-doctor.js      # Lógica dashboard doctor
│   ├── dashboard-recepcionista.js # Lógica dashboard recepcionista
│   └── home.js                  # Lógica home
├── dashboard-paciente.html
├── dashboard-doctor.html
├── dashboard-recepcionista.html
├── index.html
├── login.html
├── register.html
└── README.md
```

---

## 🔧 Tecnologías Utilizadas

### Backend
- **Node.js** v16+
- **Express** 4.18
- **mssql** 10.0 (Driver SQL Server)
- **jsonwebtoken** 9.0 (Autenticación)
- **bcryptjs** 2.4 (Encriptación)
- **express-validator** 7.0 (Validaciones)
- **dotenv** 16.3 (Variables de entorno)
- **cors** 2.8 (Cross-Origin)
- **morgan** 1.10 (Logging)

### Frontend
- **HTML5**
- **CSS3** (Grid, Flexbox, Animations)
- **JavaScript ES6+**
- **Fetch API** (Peticiones HTTP)

### Base de Datos
- **Microsoft SQL Server** 2019+
- **T-SQL** (Triggers, Procedimientos)

---

## ✅ Cumplimiento de Requisitos

| Requisito | Estado |
|-----------|--------|
| Microsoft SQL Server | ✅ Implementado |
| Módulo de login | ✅ JWT + 3 roles |
| 3 perfiles mínimos | ✅ Paciente, Doctor, Recepcionista |
| 11 entidades mínimas | ✅ 18 tablas |
| 10 especialidades | ✅ Implementado |
| 4 doctores/especialidad | ✅ Estructura lista |
| Citas prepago (8hrs) | ✅ Con trigger automático |
| Agendamiento 48hrs-3 meses | ✅ Validado en SP |
| Política de cancelación | ✅ Automática (100%/50%/0%) |
| Bitácoras | ✅ 2 tablas (estatus + historial) |
| Farmacia/Servicios | ✅ Inventario + ventas |
| Recetas médicas | ✅ Completo |
| Historial médico | ✅ Por paciente |

---

## 📚 Documentación Adicional

- 📖 [Instalación Detallada](INSTALACION.md)
- ⚡ [Inicio Rápido](INICIO_RAPIDO.md)
- 🔗 [Integración Frontend-Backend](backend/INTEGRACION_FRONTEND.md)
- 📊 [Resumen Ejecutivo](backend/RESUMEN_EJECUTIVO.md)
- 🔧 [Documentación Backend](backend/README.md)

---

## 🐛 Solución de Problemas

### Backend no inicia
```bash
# Verificar que SQL Server esté corriendo
# Windows: SQL Server Configuration Manager
# Verificar que las credenciales en .env sean correctas
```

### Error de CORS
```bash
# Verificar FRONTEND_URL en backend/.env
# Debe coincidir con la URL del frontend (ej: http://localhost:5500)
```

### Token expirado
```bash
# Los tokens expiran en 24 horas
# Hacer logout y volver a iniciar sesión
```

### Puerto en uso
```bash
# Backend (puerto 3000)
PORT=3001 npm run dev

# Frontend (puerto 5500)
python -m http.server 8000
```

---

## 👥 Roles y Permisos

### 👤 Paciente
- ✅ Auto-registro
- ✅ Ver/editar perfil
- ✅ Agendar citas
- ✅ Cancelar citas (con política)
- ✅ Ver historial de citas
- ✅ Ver historial médico
- ❌ No puede crear recetas
- ❌ No puede acceder a bitácoras

### 👨‍⚕️ Doctor
- ✅ Ver perfil (limitado)
- ✅ Ver citas asignadas
- ✅ Ver pacientes
- ✅ Consultar historial médico
- ✅ Crear recetas
- ✅ Cancelar citas (con aprobación)
- ❌ No puede editar datos sensibles
- ❌ No puede crear otros doctores

### 📋 Recepcionista
- ✅ Dashboard completo
- ✅ Gestionar pacientes
- ✅ Gestionar doctores
- ✅ Gestionar citas
- ✅ Farmacia y ventas
- ✅ Consultar bitácoras
- ❌ No puede ver recetas médicas
- ❌ No puede ver historiales médicos

---

## 🚀 Próximas Mejoras (Opcionales)

- [ ] Notificaciones por email
- [ ] Recordatorios de citas
- [ ] Generación de PDFs
- [ ] Reportes y gráficas
- [ ] Panel de administrador
- [ ] App móvil
- [ ] Videoconsultas

---

## 📄 Licencia

Proyecto académico - IPN ESCOM  
Bases de Datos - Periodo 26-2

---

## 🙋 Soporte

Para dudas o problemas:
1. Revisar la documentación en `/docs`
2. Verificar logs del servidor
3. Consultar ejemplos en `/backend/README.md`

---

## ⭐ Estado del Proyecto

**✅ COMPLETO Y FUNCIONAL**

- ✅ Backend implementado al 100%
- ✅ Frontend implementado al 100%
- ✅ Base de datos completa
- ✅ Integración lista
- ✅ Documentación completa
- ✅ Datos de prueba incluidos
- ✅ Listo para entrega

---

**Desarrollado con ❤️ para el curso de Bases de Datos - IPN ESCOM**

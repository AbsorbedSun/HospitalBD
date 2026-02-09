# 🏥 Sistema de Gestión Hospitalaria - Backend

API REST para el Sistema de Gestión de Citas Médicas, Farmacia y Servicios Hospitalarios.

## 📋 Características

- ✅ Autenticación JWT
- ✅ Gestión de Citas Médicas
- ✅ Sistema de Pagos y Cancelaciones
- ✅ Farmacia e Inventario
- ✅ Recetas Médicas
- ✅ Bitácoras de Auditoría
- ✅ Roles: Paciente, Doctor, Recepcionista
- ✅ Base de Datos SQL Server

## 🚀 Instalación

### Prerrequisitos

- Node.js v16 o superior
- Microsoft SQL Server 2019 o superior
- npm o yarn

### 1. Clonar e Instalar Dependencias

```bash
# Instalar dependencias
npm install
```

### 2. Configurar Variables de Entorno

Crear archivo `.env` basado en `.env.example`:

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```env
PORT=3000
NODE_ENV=development

# SQL Server
DB_SERVER=localhost
DB_DATABASE=HospitalDB
DB_USER=sa
DB_PASSWORD=TuPasswordSegura123!
DB_PORT=1433
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# JWT
JWT_SECRET=tu_secreto_super_seguro_cambiame_en_produccion
JWT_EXPIRES_IN=24h

# CORS
FRONTEND_URL=http://localhost:5500
```

### 3. Crear Base de Datos

Ejecutar los scripts SQL en orden:

```bash
# En SQL Server Management Studio o Azure Data Studio:

1. 01_create_database.sql      # Crea la base de datos y tablas
2. 02_triggers_procedures.sql  # Crea triggers y procedimientos
3. 03_test_data.sql            # Inserta datos de prueba
```

O usar línea de comandos:

```bash
sqlcmd -S localhost -U sa -P TuPassword -i database/01_create_database.sql
sqlcmd -S localhost -U sa -P TuPassword -i database/02_triggers_procedures.sql
sqlcmd -S localhost -U sa -P TuPassword -i database/03_test_data.sql
```

### 4. Iniciar el Servidor

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

El servidor estará en: `http://localhost:3000`

## 📚 Endpoints de la API

### Autenticación

```
POST   /api/auth/login       - Iniciar sesión
POST   /api/auth/register    - Registrar paciente
GET    /api/auth/verify      - Verificar token
```

### Citas

```
GET    /api/citas                          - Obtener citas
POST   /api/citas/agendar                  - Agendar nueva cita
POST   /api/citas/cancelar/:folio_cita     - Cancelar cita
POST   /api/citas/pagar                    - Confirmar pago
GET    /api/citas/horarios-disponibles/:id_doctor - Horarios disponibles
```

### Especialidades

```
GET    /api/especialidades              - Listar especialidades
GET    /api/especialidades/:id          - Detalle de especialidad
GET    /api/especialidades/:id/doctores - Doctores por especialidad
```

### Pacientes

```
GET    /api/pacientes                - Listar pacientes (recepcionista)
GET    /api/pacientes/perfil         - Perfil del paciente
GET    /api/pacientes/historial-medico - Historial médico
PUT    /api/pacientes/perfil         - Actualizar perfil
```

### Doctores

```
GET    /api/doctores                    - Listar doctores
GET    /api/doctores/perfil             - Perfil del doctor
GET    /api/doctores/horarios           - Horarios del doctor
GET    /api/doctores/pacientes          - Pacientes del doctor
GET    /api/doctores/pacientes/:id/historial - Historial de paciente
POST   /api/doctores/recetas            - Crear receta médica
```

### Recepcionista

```
GET    /api/recepcionistas/dashboard        - Dashboard con estadísticas
GET    /api/recepcionistas/bitacora/estatus - Bitácora de estatus
GET    /api/recepcionistas/bitacora/historial - Bitácora de historial
```

### Farmacia

```
GET    /api/farmacia/medicamentos       - Listar medicamentos
GET    /api/farmacia/servicios          - Listar servicios
POST   /api/farmacia/ventas             - Realizar venta
GET    /api/farmacia/ventas             - Historial de ventas
GET    /api/farmacia/ventas/:id         - Detalle de venta
```

## 🔐 Autenticación

Todas las rutas protegidas requieren un token JWT en el header:

```
Authorization: Bearer <token>
```

### Credenciales de Prueba

**Password para todas las cuentas:** `hospital123`

- **Paciente:** `paciente1@email.com`
- **Doctor:** `dr.garcia@hospital.com`
- **Recepcionista:** `recep.gonzalez@hospital.com`

## 📝 Ejemplo de Uso

### 1. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "paciente1@email.com",
    "password": "hospital123",
    "userType": "paciente"
  }'
```

### 2. Agendar Cita

```bash
curl -X POST http://localhost:3000/api/citas/agendar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tu-token>" \
  -d '{
    "id_doctor": 1,
    "fecha_cita": "2026-02-15",
    "hora_cita": "10:00"
  }'
```

## 🗂️ Estructura del Proyecto

```
hospital-backend/
├── config/
│   └── database.js          # Configuración de SQL Server
├── database/
│   ├── 01_create_database.sql
│   ├── 02_triggers_procedures.sql
│   └── 03_test_data.sql
├── middleware/
│   └── auth.js              # Middleware de autenticación
├── routes/
│   ├── auth.js              # Rutas de autenticación
│   ├── cita.js              # Rutas de citas
│   ├── doctor.js            # Rutas de doctores
│   ├── especialidad.js      # Rutas de especialidades
│   ├── farmacia.js          # Rutas de farmacia
│   ├── paciente.js          # Rutas de pacientes
│   └── recepcionista.js     # Rutas de recepcionista
├── .env.example             # Ejemplo de variables de entorno
├── .gitignore
├── package.json
├── README.md
└── server.js                # Servidor principal
```

## ⚙️ Reglas de Negocio Implementadas

### Citas

- ✅ Agendamiento mínimo 48 horas de anticipación
- ✅ Agendamiento máximo 3 meses
- ✅ No se pueden agendar citas si el doctor está ocupado
- ✅ No se puede tener cita pendiente con el mismo doctor
- ✅ Validación de horario laboral del doctor
- ✅ Tiempo límite de pago: 8 horas

### Cancelaciones

- ✅ 48+ horas: 100% de reembolso
- ✅ 24-48 horas: 50% de reembolso
- ✅ <24 horas: 0% de reembolso
- ✅ Cancelación por doctor: 100% de reembolso

### Estatus de Citas

1. `agendada_pendiente_pago`
2. `pagada_pendiente_atender`
3. `cancelada_falta_pago`
4. `cancelada_paciente`
5. `cancelada_doctor`
6. `atendida`
7. `no_acudio`

## 🛠️ Tecnologías

- **Node.js** - Runtime
- **Express** - Framework web
- **mssql** - Driver SQL Server
- **bcryptjs** - Encriptación de contraseñas
- **jsonwebtoken** - Autenticación JWT
- **express-validator** - Validación de datos
- **dotenv** - Variables de entorno
- **morgan** - Logging HTTP

## 📊 Base de Datos

### Tablas Principales

- Usuario
- Paciente
- Empleado
- Doctor
- Recepcionista
- Cita
- Pago
- Especialidad
- Consultorio
- Medicamento
- Servicio
- Receta
- Venta
- BitacoraEstatusCita
- BitacoraHistorialCitas

### Procedimientos Almacenados

- `sp_AgendarCita`
- `sp_CancelarCita`
- `sp_ConfirmarPago`
- `sp_ObtenerHorariosDisponibles`
- `sp_CrearReceta`

## 🔧 Troubleshooting

### Error de conexión a SQL Server

1. Verificar que SQL Server esté corriendo
2. Verificar credenciales en `.env`
3. Verificar que el puerto 1433 esté abierto
4. Verificar configuración de `trustServerCertificate`

### Token expirado

Los tokens JWT expiran en 24 horas. Volver a hacer login.

### Errores de CORS

Asegurarse de que `FRONTEND_URL` en `.env` coincida con la URL del frontend.

## 📄 Licencia

Este proyecto es para uso educativo - IPN ESCOM.

## 👥 Equipo

- Desarrollado para el curso de Bases de Datos
- Instituto Politécnico Nacional
- Escuela Superior de Cómputo
- Periodo: 26-2

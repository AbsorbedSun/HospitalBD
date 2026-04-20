# 🏥 MediConnect – Sistema de Gestión Hospitalaria

**IPN · ESCOM · Bases de Datos · Periodo 26-2 · Equipo 4 · Grupo 3CM3**

Sistema web para la gestión hospitalaria con frontend en HTML/CSS/JavaScript, backend en Python/Flask y base de datos en Microsoft SQL Server.

---

## Descripción general

El proyecto administra el flujo principal de un hospital: autenticación de usuarios, registro de pacientes, agendado y cancelación de citas con política de reembolso, asignación de doctores por especialidad, generación de recetas, gestión de farmacia y servicios, bitácoras de auditoría y aprobación de cancelaciones por recepcionista.

Trabaja con tres perfiles activos: **Paciente**, **Doctor** y **Recepcionista / Admin**.

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, JavaScript vanilla |
| Backend | Python 3, Flask |
| Base de datos | Microsoft SQL Server 2019+ |
| Autenticación | JWT (`flask-jwt-extended`) |
| Cifrado de contraseñas | bcrypt |

---

## Estructura del proyecto

```
HospitalBD_v2/
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard-paciente.html
│   ├── dashboard-doctor.html
│   ├── dashboard-recepcionista.html
│   ├── css/
│   │   ├── home.css
│   │   ├── auth.css
│   │   └── dashboard.css
│   └── js/
│       ├── api.js                    ← Cliente HTTP hacia Flask (puerto 5000)
│       ├── auth.js                   ← Login y registro (integrado con backend)
│       ├── home.js                   ← Efectos página de inicio
│       ├── dashboard-paciente.js     ← Navegación SPA del paciente
│       ├── dashboard-doctor.js       ← Navegación SPA del doctor
│       └── dashboard-recepcionista.js
│
└── backend/
    ├── app.py                        ← Punto de entrada
    ├── config.py
    ├── requirements.txt
    ├── .env.example
    ├── database/
    │   ├── connection.py
    │   ├── schema.sql                ← Ejecutar PRIMERO en SSMS
    │   └── seed.sql                  ← Ejecutar SEGUNDO en SSMS
    ├── routes/
    │   ├── auth.py
    │   ├── pacientes.py
    │   ├── doctores.py
    │   ├── citas.py
    │   ├── recepcionistas.py
    │   ├── especialidades.py
    │   └── farmacia.py
    └── utils/
        ├── helpers.py
        └── decorators.py
```

---

## Instalación y ejecución

### Paso 1 — Base de datos
1. Abrir SQL Server Management Studio (SSMS).
2. Ejecutar `backend/database/schema.sql`.
3. Ejecutar `backend/database/seed.sql`.

### Paso 2 — Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # Editar con credenciales SQL Server
python app.py               # Servidor en http://localhost:5000
```

### Paso 3 — Frontend
Abrir `frontend/login.html` directamente en el navegador o servir la carpeta con un servidor local:
```bash
python -m http.server 8080  # desde la carpeta frontend/
```

---

## Credenciales de prueba

| Rol | Email | Contraseña |
|---|---|---|
| Recepcionista | recepcion@hospital.com | Hospital123! |
| Doctor | dr.garcia@hospital.com | Hospital123! |
| Paciente | paciente@test.com | Hospital123! |

---

## Esquema de base de datos

El esquema contiene 21 tablas. Las correcciones aplicadas respecto al MER original fueron:

| Problema original | Corrección aplicada |
|---|---|
| Referencia circular Paciente ↔ HistorialMedico | Eliminada FK en Paciente; solo Historial → Paciente |
| Referencia circular Cita ↔ Pago | Cita sin FK a Pago; `Pago.Folio_Cita` nullable |
| EstatusCita sin normalizar | Tabla catálogo `EstatusCita` con clave y descripción |
| Sin flujo de cancelación por doctor | Nueva tabla `SolicitudCancelacion` |
| Bitácoras sin control de permisos | RBAC en backend; BD sin triggers de borrado |

Tablas presentes: `TipoUsuario`, `EstatusCita`, `Horario`, `Especialidad`, `Usuario`, `Empleado`, `Recepcionista`, `Doctor`, `Consultorio`, `Paciente`, `Historial_medico`, `Cita`, `Pago`, `SolicitudCancelacion`, `Receta`, `Farmacia`, `Servicio`, `Venta`, `Detalle_Venta`, `Bitacora_EstatusCita`, `Bitacora_HistorialCitas`.

---

## Estado actual de implementación

### Backend — implementado

**Autenticación** (`/api/auth`)
- `POST /login` — Login con JWT y bcrypt.
- `POST /register` — Registro de pacientes.
- `GET /verify` — Verificación de token.

**Especialidades** (`/api/especialidades`)
- CRUD completo: listar, obtener por id, obtener doctores de una especialidad, crear, actualizar.

**Pacientes** (`/api/pacientes`)
- Perfil propio: consulta y actualización.
- Historial médico propio.
- Listar todos (recepcionista/admin).
- Obtener paciente por id (doctor/recepcionista/admin).
- Historial por doctor: consulta y actualización.

**Doctores** (`/api/doctores`)
- Perfil propio.
- Listar todos y obtener por id.
- Lista de pacientes atendidos.
- Crear receta y listar recetas propias.
- Solicitar cancelación de cita.
- Consultar horarios disponibles por rango de fechas.
- Crear nuevo doctor (recepcionista/admin).

**Citas** (`/api/citas`)
- Listar citas (filtradas por rol).
- Agendar con validaciones de disponibilidad y horario laboral.
- Confirmar pago (ventana de 8 horas).
- Cancelar (paciente, doctor o vencimiento de pago) con política de reembolso.
- Marcar como atendida o no acudió.
- Verificar y cancelar citas vencidas por falta de pago.
- Registro automático en bitácora al cambiar de estatus.

**Recepcionistas** (`/api/recepcionistas`)
- Dashboard general (resumen de citas, pacientes, doctores).
- Bitácora de estatus de cita.
- Bitácora de historial médico-paciente.
- Listar, aprobar y rechazar solicitudes de cancelación de doctores.
- Alta de nuevos recepcionistas.

**Farmacia** (`/api/farmacia`)
- Medicamentos: listar, obtener por id, crear, actualizar.
- Servicios: listar, crear, actualizar.
- Ventas: listar, ver detalle, registrar nueva venta.

---

### Frontend — implementado

- **Página de inicio** (`index.html`): efectos visuales con `home.js`.
- **Login y registro** (`login.html`, `register.html`): completamente integrados con el backend a través de `api.js` y `auth.js`, incluyendo redirección por rol.
- **`api.js`**: cliente HTTP completo con funciones definidas para todos los módulos (auth, especialidades, citas, pacientes, doctores, recepcionistas, farmacia y utilidades de formato).
- **Dashboards** — los tres dashboards tienen estructura SPA con navegación entre secciones:
  - Paciente: datos personales, citas agendadas, agendar cita, historial médico.
  - Doctor: datos del doctor, citas, pacientes, recetas.
  - Recepcionista: dashboard general, citas, pacientes, doctores, farmacia, bitácora.

---

## Pendientes y limitaciones conocidas

### Frontend
- Los dashboards tienen navegación funcional pero **no cargan datos reales del backend**. `api.js` tiene todas las funciones definidas, pero los archivos `dashboard-*.js` aún no las invocan; las vistas se renderizan desde templates HTML sin fetch real.
- Falta integrar formularios de alta y edición con llamadas a la API y manejo de respuestas.
- No existe vista de consultorios (la tabla sí existe en la BD).
- No existe vista de cobros o tickets.
- Los dashboards de doctor y recepcionista son mayormente estáticos.

### Backend
- No hay módulo de **consultorios** (la tabla `Consultorio` existe en la BD pero no hay endpoints ni CRUD).
- La gestión de recepcionistas solo cuenta con alta (`POST`); falta la actualización y baja.
- El flujo de **tickets y cobros** puede ampliarse para cubrir mejor la venta combinada de servicios y medicamentos.
- Los perfiles **Cajero** y **Farmacéutico** no están implementados como roles separados.
- No hay reportes, impresión de comprobantes ni exportaciones.

---

## Notas de implementación

- Las contraseñas se almacenan cifradas con bcrypt.
- El acceso a endpoints está controlado por rol mediante decoradores JWT en el backend.
- Un paciente puede comprar servicios o medicamentos sin necesidad de tener cita activa.
- Las citas se cancelan con registro automático en bitácora.
- La BD está orientada exclusivamente a SQL Server (no compatible con SQLite o PostgreSQL sin ajustes).

---

## Equipo

| Nombre | Boleta |
|---|---|
| García Ambrosio Aldo | 2025630171 |
| Hernández Rodríguez José Eduardo | 2025630494 |
| Hernández Zetina Jared | 2025630682 |
| Tinoco Celestino Sunduri Bilgai | 2023301870 |

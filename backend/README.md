# 🏥 Backend – Sistema de Gestión Hospitalaria
**Flask + Python + Microsoft SQL Server**

---

## Requisitos previos

| Herramienta | Versión mínima |
|-------------|---------------|
| Python      | 3.10+         |
| SQL Server  | 2019+         |
| ODBC Driver | 17 for SQL Server |

---

## Instalación

### 1. Instalar dependencias Python
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
```
Edita `.env` con tus datos de SQL Server:
```env
DB_SERVER=localhost
DB_DATABASE=HospitalDB
DB_USER=sa
DB_PASSWORD=TuPasswordSegura123!
DB_PORT=1433
JWT_SECRET_KEY=genera_una_clave_segura_aqui
```

### 3. Crear la base de datos
Ejecuta los scripts SQL en SQL Server Management Studio (SSMS) **en este orden**:
```
1. database/schema.sql   ← Crea la BD, tablas, catálogos
2. database/seed.sql     ← Inserta datos de prueba
```

### 4. Arrancar el servidor
```bash
python app.py
```
El servidor queda en **http://localhost:5000**

---

## Credenciales de prueba
| Rol           | Email                      | Contraseña    |
|---------------|----------------------------|---------------|
| Recepcionista | recepcion@hospital.com     | Hospital123!  |
| Doctor        | dr.garcia@hospital.com     | Hospital123!  |
| Paciente      | paciente@test.com          | Hospital123!  |

---

## Endpoints principales

### Autenticación
| Método | Ruta                  | Descripción              | Rol requerido |
|--------|-----------------------|--------------------------|---------------|
| POST   | `/api/auth/login`     | Iniciar sesión           | Público       |
| POST   | `/api/auth/register`  | Registrar paciente nuevo | Público       |
| GET    | `/api/auth/verify`    | Verificar token JWT      | Autenticado   |

### Especialidades
| Método | Ruta                              | Descripción                     |
|--------|-----------------------------------|---------------------------------|
| GET    | `/api/especialidades`             | Listar todas                    |
| GET    | `/api/especialidades/<id>/doctores` | Doctores por especialidad     |
| POST   | `/api/especialidades`             | Crear (recepcionista)          |

### Citas
| Método | Ruta                        | Descripción                       |
|--------|-----------------------------|-----------------------------------|
| GET    | `/api/citas`                | Listar (filtrado por rol)         |
| POST   | `/api/citas/agendar`        | Agendar nueva cita                |
| POST   | `/api/citas/pagar`          | Confirmar pago (8h límite)        |
| POST   | `/api/citas/cancelar/<id>`  | Cancelar con política             |
| PUT    | `/api/citas/<id>/atender`   | Marcar atendida (doctor)         |
| PUT    | `/api/citas/<id>/no-acudio` | Marcar no acudió                 |
| POST   | `/api/citas/verificar-vencidas` | Cancelar sin pago vencido    |

### Pacientes
| Método | Ruta                              | Descripción                    |
|--------|-----------------------------------|--------------------------------|
| GET    | `/api/pacientes/perfil`           | Mi perfil                      |
| PUT    | `/api/pacientes/perfil`           | Actualizar datos no sensibles  |
| GET    | `/api/pacientes/historial-medico` | Mi historial                   |
| GET    | `/api/pacientes`                  | Listar (recepcionista)        |
| GET    | `/api/pacientes/<id>/historial`   | Historial por ID (doctor)     |
| PUT    | `/api/pacientes/<id>/historial`   | Actualizar historial (doctor) |

### Doctores
| Método | Ruta                                  | Descripción                      |
|--------|---------------------------------------|----------------------------------|
| GET    | `/api/doctores/perfil`               | Mi perfil                        |
| GET    | `/api/doctores`                      | Listar doctores                  |
| GET    | `/api/doctores/pacientes`            | Mis pacientes                    |
| POST   | `/api/doctores/recetas`              | Crear receta                     |
| GET    | `/api/doctores/recetas`              | Listar mis recetas               |
| POST   | `/api/doctores/solicitar-cancelacion`| Solicitar cancelación            |
| GET    | `/api/doctores/<id>/horarios-disponibles` | Slots disponibles           |
| POST   | `/api/doctores`                      | Crear doctor (recepcionista)    |

### Recepcionista
| Método | Ruta                                          | Descripción              |
|--------|-----------------------------------------------|--------------------------|
| GET    | `/api/recepcionistas/dashboard`               | Estadísticas generales   |
| GET    | `/api/recepcionistas/bitacora/estatus`        | Bitácora estatus citas   |
| GET    | `/api/recepcionistas/bitacora/historial`      | Bitácora historial       |
| GET    | `/api/recepcionistas/solicitudes-cancelacion` | Solicitudes pendientes   |
| POST   | `/api/recepcionistas/solicitudes-cancelacion/<id>/aprobar` | Aprobar |
| POST   | `/api/recepcionistas/solicitudes-cancelacion/<id>/rechazar` | Rechazar |
| POST   | `/api/recepcionistas`                         | Crear recepcionista      |

### Farmacia
| Método | Ruta                          | Descripción              |
|--------|-------------------------------|--------------------------|
| GET    | `/api/farmacia/medicamentos`  | Listar medicamentos      |
| POST   | `/api/farmacia/medicamentos`  | Agregar medicamento      |
| PUT    | `/api/farmacia/medicamentos/<id>` | Actualizar/stock     |
| GET    | `/api/farmacia/servicios`     | Listar servicios         |
| POST   | `/api/farmacia/servicios`     | Agregar servicio         |
| POST   | `/api/farmacia/ventas`        | Realizar venta           |
| GET    | `/api/farmacia/ventas`        | Historial de ventas      |
| GET    | `/api/farmacia/ventas/<id>`   | Detalle de una venta     |

---

## Reglas de negocio implementadas
- ✅ Citas prepago con ventana de **8 horas** para pagar
- ✅ Agendado mínimo **48h**, máximo **3 meses** de anticipación
- ✅ Sin traslape de citas por doctor (índice único en BD)
- ✅ Sin cita pendiente duplicada paciente-doctor
- ✅ Validación de horario laboral del doctor
- ✅ Política de cancelación (100% / 50% / 0%)
- ✅ Cancelación por doctor → aprobación de recepcionista → 100% reembolso
- ✅ Bitácoras de solo inserción/consulta
- ✅ Ventas de farmacia y servicios sin necesidad de ser paciente
- ✅ Contraseñas cifradas con bcrypt
- ✅ JWT con expiración de 8 horas
- ✅ Control de acceso por rol (RBAC)
- ✅ Doctor no puede editar sus datos sensibles
- ✅ Recepcionista NO puede ver recetas ni historial médico

---

## Estructura de carpetas
```
backend/
├── app.py              # Punto de entrada Flask
├── config.py           # Configuración central
├── requirements.txt    # Dependencias Python
├── .env.example        # Plantilla de variables de entorno
├── database/
│   ├── connection.py   # Pool de conexión pyodbc
│   ├── schema.sql      # DDL completo (tablas, catálogos)
│   └── seed.sql        # Datos de prueba
├── routes/
│   ├── auth.py         # Login, registro
│   ├── especialidades.py
│   ├── pacientes.py
│   ├── doctores.py
│   ├── citas.py        # Lógica principal de negocio
│   ├── recepcionistas.py
│   └── farmacia.py
└── utils/
    ├── decorators.py   # @requiere_auth, @requiere_rol
    └── helpers.py      # Política cancelación, validaciones
```

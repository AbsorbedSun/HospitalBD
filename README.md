# 🏥 MediConnect – Sistema de Gestión Hospitalaria

**IPN · ESCOM · Bases de Datos · Periodo 26-2 · Equipo 4 · Grupo 3CM3**

---

## Índice

1. [Estado del proyecto](#estado-del-proyecto)
2. [Arquitectura](#arquitectura)
3. [Guía de inicio rápido](#guía-de-inicio-rápido)
4. [Endpoints de la API](#endpoints-de-la-api)
5. [Credenciales de prueba](#credenciales-de-prueba)
6. [Reglas de negocio implementadas](#reglas-de-negocio-implementadas)
7. [Pendientes](#pendientes)
8. [Solución de problemas comunes](#solución-de-problemas-comunes)
9. [Tecnologías](#tecnologías)
10. [Equipo](#equipo)

---

## Estado del proyecto

### ✅ Funcionalidades completas

#### Módulo de autenticación

| RF     | Descripción                   | Backend                      | Frontend           |
| ------ | ----------------------------- | ---------------------------- | ------------------ |
| RF-001 | Login con redirección por rol | ✅ `POST /api/auth/login`    | ✅ `login.html`    |
| RF-002 | Auto-registro de pacientes    | ✅ `POST /api/auth/register` | ✅ `register.html` |

#### Perfil Paciente

| RF     | Descripción                            | Backend                                  | Frontend                     |
| ------ | -------------------------------------- | ---------------------------------------- | ---------------------------- |
| RF-003 | Agendar nueva cita (flujo 4 pasos)     | ✅ `POST /api/citas/agendar`             | ✅ `dashboard-paciente.html` |
| RF-004 | Visualizar citas con filtros           | ✅ `GET /api/citas`                      | ✅                           |
| RF-005 | Cancelar cita (política de devolución) | ✅ `POST /api/citas/cancelar/<folio>`    | ✅                           |
| RF-006 | Visualizar datos personales            | ✅ `GET /api/pacientes/perfil`           | ✅                           |
| —      | Historial médico (lectura)             | ✅ `GET /api/pacientes/historial-medico` | ✅                           |

#### Perfil Doctor

| RF     | Descripción                   | Backend                                       | Frontend                   |
| ------ | ----------------------------- | --------------------------------------------- | -------------------------- |
| RF-007 | Visualizar datos del doctor   | ✅ `GET /api/doctores/perfil`                 | ✅ `dashboard-doctor.html` |
| RF-008 | Visualizar citas asignadas    | ✅ `GET /api/citas`                           | ✅                         |
| RF-009 | Crear recetas médicas         | ✅ `POST /api/doctores/recetas`               | ✅                         |
| RF-010 | Consultar datos del paciente  | ✅ `GET /api/doctores/pacientes`              | ✅                         |
| RF-012 | Solicitar cancelación de cita | ✅ `POST /api/doctores/solicitar-cancelacion` | ✅                         |

#### Perfil Recepcionista

| RF     | Descripción                      | Backend                                      | Frontend                          |
| ------ | -------------------------------- | -------------------------------------------- | --------------------------------- |
| RF-016 | Dar de alta doctores             | ✅ `POST /api/doctores`                      | ✅ `dashboard-recepcionista.html` |
| RF-017 | Consultar pacientes              | ✅ `GET /api/pacientes`                      | ✅                                |
| RF-019 | Gestión completa de citas        | ✅                                           | ✅                                |
| RF-020 | Gestión de servicios extras      | ✅ `GET/POST/PUT /api/farmacia/servicios`    | ✅                                |
| RF-021 | Gestión de farmacia/medicamentos | ✅ `GET/POST/PUT /api/farmacia/medicamentos` | ✅                                |
| RF-022 | Cobro y registro de ventas       | ✅ `POST /api/farmacia/ventas`               | ✅                                |
| RF-023 | Restricciones de acceso por rol  | ✅ Decoradores JWT                           | ✅                                |

#### Sistema de bitácoras

| RF     | Descripción                        | Backend                                         | Frontend |
| ------ | ---------------------------------- | ----------------------------------------------- | -------- |
| RF-024 | Bitácora de estatus de citas       | ✅ `GET /api/recepcionistas/bitacora/estatus`   | ✅       |
| RF-025 | Bitácora historial médico-paciente | ✅ `GET /api/recepcionistas/bitacora/historial` | ✅       |

#### Sistema de pagos y reembolsos

| RF     | Descripción                            | Backend                                 | Frontend                 |
| ------ | -------------------------------------- | --------------------------------------- | ------------------------ |
| RF-026 | Generación de línea de pago (8 hrs)    | ✅ Al agendar cita                      | ✅ Comprobante con folio |
| RF-027 | Confirmar / vencer pagos               | ✅ `POST /api/citas/pagar` + trigger BD | ✅                       |
| RF-028 | Reembolsos por política de cancelación | ✅ Cálculo automático en cancelar       | ✅                       |

#### Base de datos

| Componente                                                   | Estado                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| 21 tablas en 3NF                                             | ✅ `schema.sql`                                                    |
| Datos de prueba (10 especialidades, 40+ doctores, pacientes) | ✅ `seed.sql`                                                      |
| `Bitacora_EstatusCita`                                       | ✅ Solo inserción/consulta                                         |
| `Bitacora_HistorialCitas`                                    | ✅ Solo inserción/consulta                                         |
| Trigger: cancelación automática por falta de pago (8 hrs)    | ✅                                                                 |
| Tabla `SolicitudCancelacion`                                 | ✅                                                                 |
| Aprobación de cancelaciones por recepcionista                | ✅ `POST /api/recepcionistas/solicitudes-cancelacion/<id>/aprobar` |

---

### ⚠️ Funcionalidades parciales

| RF     | Descripción                      | Qué falta                                                                                                                   |
| ------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| RF-011 | Historial médico por doctor      | Backend `GET/PUT /api/pacientes/<id>/historial` implementado; **falta UI en dashboard del doctor** para editar el historial |
| RF-015 | Gestión de recepcionistas (CRUD) | `POST /api/recepcionistas` implementado (crear); **faltan** endpoints de lectura y actualización, y la vista en el frontend |
| RF-018 | Gestión de especialidades        | `GET/POST/PUT /api/especialidades` implementado; **falta** vista en el dashboard de la recepcionista                        |
| RF-022 | Tickets de cobro imprimibles     | Las ventas se registran correctamente; **falta** generar un ticket imprimible/exportable en PDF desde el frontend           |

---

### ❌ Funcionalidades pendientes

| RF     | Descripción                                            | Notas                                                                                                  |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| RF-015 | CRUD completo de recepcionistas                        | Requiere `GET /api/recepcionistas` y `PUT /api/recepcionistas/<id>`                                    |
| RF-011 | Edición de historial médico desde dashboard doctor     | El endpoint existe; conectar desde `dashboard-doctor.js`                                               |
| —      | Vista de especialidades (recepcionista)                | Crear sección en `dashboard-recepcionista.js` que consuma `/api/especialidades`                        |
| —      | Ticket de cobro en PDF                                 | Integrar librería (ej. jsPDF) al procesar una venta en frontend                                        |
| —      | Marcar cita como "Atendida" / "No acudió" desde doctor | Endpoints `PUT /api/citas/<folio>/atender` y `/no-acudio` existen; **falta botón en la UI del doctor** |
| —      | Índices de rendimiento en BD                           | Agregar `CREATE INDEX` sobre `Cita.Fecha_Cita`, `Cita.Id_Doctor`, `Pago.Estado` (RNF-013)              |
| —      | Recuperación real de contraseña                        | `POST /api/auth/reset-password` existe pero no envía correo; requiere integración SMTP                 |

---

## Arquitectura

```
MediConnect/
├── backend/
│   ├── app.py                  # Punto de entrada Flask
│   ├── config.py               # Variables de entorno
│   ├── requirements.txt
│   ├── .env                    # ← NO subir a git
│   ├── database/
│   │   ├── connection.py       # Pool de conexiones pyodbc
│   │   ├── schema.sql          # DDL: tablas, constraints, trigger
│   │   └── seed.sql            # Datos de prueba
│   ├── routes/
│   │   ├── auth.py             # Login, registro, verificar token
│   │   ├── citas.py            # Agendar, pagar, cancelar, atender
│   │   ├── doctores.py         # Perfil, recetas, solicitar cancelación
│   │   ├── especialidades.py   # Catálogo de especialidades
│   │   ├── farmacia.py         # Medicamentos, servicios, ventas
│   │   ├── pacientes.py        # Perfil, historial médico
│   │   └── recepcionistas.py   # Dashboard, bitácoras, solicitudes
│   └── utils/
│       ├── decorators.py       # @requiere_auth, @requiere_rol
│       └── helpers.py          # Política de cancelación, validaciones
└── frontend/
    ├── index.html              # Landing page pública
    ├── login.html
    ├── register.html
    ├── dashboard-paciente.html
    ├── dashboard-doctor.html
    ├── dashboard-recepcionista.html
    ├── css/
    │   ├── auth.css
    │   ├── dashboard.css
    │   └── home.css
    └── js/
        ├── api.js              # Wrapper fetch con JWT automático
        ├── auth.js             # Login y registro
        ├── home.js
        ├── dashboard-paciente.js
        ├── dashboard-doctor.js
        └── dashboard-recepcionista.js
```

---

## Guía de inicio rápido

### Requisitos previos

- **SQL Server 2019+** corriendo localmente
- **Python 3.10+**
- **ODBC Driver 17 o 18 para SQL Server** ([descargar aquí](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server))

### Paso 1 – Base de datos

Abrir **SQL Server Management Studio (SSMS)** y ejecutar en orden:

```sql
-- 1. Crea HospitalDB, tablas, catálogos y triggers
backend/database/schema.sql

-- 2. Inserta datos de prueba (especialidades, doctores, usuarios)
backend/database/seed.sql
```

### Paso 2 – Backend Flask

```bash
cd backend

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
# Copiar el archivo de ejemplo y editarlo
cp .env.example .env
```

Editar `.env` con los datos de tu instancia de SQL Server:

```ini
DB_SERVER=localhost\SQLEXPRESS   # o solo "localhost" si es instancia default
DB_DATABASE=HospitalDB
DB_USER=sa                        # o tu usuario de SQL Server
DB_PASSWORD=TuContraseña
JWT_SECRET_KEY=cambia_esto_en_produccion
DEBUG=True
PORT=5000
```

Arrancar el servidor:

```bash
python app.py
```

Verificar que funciona:

```
http://127.0.0.1:5000/api/health
```

Respuesta esperada: `{"status": "ok", "base_datos": "conectada"}`

### Paso 3 – Frontend

```bash
cd frontend
python -m http.server 8080 --bind 127.0.0.1
```

Abrir en el navegador: **http://127.0.0.1:8080**

> ⚠️ **IMPORTANTE**: Usar siempre `127.0.0.1` (no `localhost`) tanto para
> el frontend como para el backend. Si se usa `localhost` en uno y
> `127.0.0.1` en el otro se producirán errores de CORS.

> 💡 **Alternativa con VS Code**: La extensión Live Server también funciona
> en el puerto 5500 (`http://127.0.0.1:5500`), que ya está permitido en la
> configuración CORS del backend.

---

## Endpoints de la API

Todos los endpoints (excepto `/api/auth/login`, `/api/auth/register` y `/api/health`) requieren el header:

```
Authorization: Bearer <token_jwt>
```

### Autenticación

| Método | Endpoint                   | Acceso      | Descripción              |
| ------ | -------------------------- | ----------- | ------------------------ |
| POST   | `/api/auth/login`          | Público     | Iniciar sesión           |
| POST   | `/api/auth/register`       | Público     | Registro de paciente     |
| GET    | `/api/auth/verify`         | Autenticado | Verificar token activo   |
| POST   | `/api/auth/reset-password` | Autenticado | Cambiar contraseña       |
| GET    | `/api/health`              | Público     | Health check del backend |

### Citas

| Método | Endpoint                        | Acceso                   | Descripción                         |
| ------ | ------------------------------- | ------------------------ | ----------------------------------- |
| GET    | `/api/citas`                    | Todos                    | Listar citas (filtradas por rol)    |
| POST   | `/api/citas/agendar`            | Paciente                 | Agendar nueva cita                  |
| POST   | `/api/citas/pagar`              | Paciente                 | Confirmar pago de cita              |
| POST   | `/api/citas/cancelar/<folio>`   | Paciente / Recepcionista | Cancelar cita                       |
| PUT    | `/api/citas/<folio>/atender`    | Recepcionista            | Marcar cita como atendida           |
| PUT    | `/api/citas/<folio>/no-acudio`  | Recepcionista            | Marcar paciente como ausente        |
| POST   | `/api/citas/verificar-vencidas` | Interno                  | Verificar y cancelar pagos vencidos |

### Doctores

| Método | Endpoint                                  | Acceso        | Descripción                   |
| ------ | ----------------------------------------- | ------------- | ----------------------------- |
| GET    | `/api/doctores/perfil`                    | Doctor        | Perfil propio del doctor      |
| GET    | `/api/doctores`                           | Recepcionista | Listar todos los doctores     |
| GET    | `/api/doctores/<id>`                      | Autenticado   | Detalle de un doctor          |
| POST   | `/api/doctores`                           | Recepcionista | Dar de alta un doctor         |
| GET    | `/api/doctores/pacientes`                 | Doctor        | Pacientes atendidos           |
| POST   | `/api/doctores/recetas`                   | Doctor        | Crear receta médica           |
| GET    | `/api/doctores/recetas`                   | Doctor        | Ver recetas emitidas          |
| POST   | `/api/doctores/solicitar-cancelacion`     | Doctor        | Solicitar cancelación de cita |
| GET    | `/api/doctores/<id>/horarios-disponibles` | Paciente      | Horarios libres de un doctor  |

### Pacientes

| Método | Endpoint                          | Acceso                 | Descripción                       |
| ------ | --------------------------------- | ---------------------- | --------------------------------- |
| GET    | `/api/pacientes/perfil`           | Paciente               | Datos personales propios          |
| PUT    | `/api/pacientes/perfil`           | Paciente               | Actualizar datos personales       |
| GET    | `/api/pacientes/historial-medico` | Paciente               | Ver historial médico propio       |
| GET    | `/api/pacientes`                  | Recepcionista / Doctor | Listar pacientes                  |
| GET    | `/api/pacientes/<id>`             | Recepcionista / Doctor | Detalle de un paciente            |
| GET    | `/api/pacientes/<id>/historial`   | Doctor                 | Historial del paciente            |
| PUT    | `/api/pacientes/<id>/historial`   | Doctor                 | Actualizar historial del paciente |

### Especialidades

| Método | Endpoint                            | Acceso        | Descripción                     |
| ------ | ----------------------------------- | ------------- | ------------------------------- |
| GET    | `/api/especialidades`               | Autenticado   | Listar especialidades y precios |
| GET    | `/api/especialidades/<id>`          | Autenticado   | Detalle de una especialidad     |
| GET    | `/api/especialidades/<id>/doctores` | Autenticado   | Doctores de una especialidad    |
| POST   | `/api/especialidades`               | Recepcionista | Crear especialidad              |
| PUT    | `/api/especialidades/<id>`          | Recepcionista | Actualizar especialidad         |

### Farmacia, Servicios y Ventas

| Método | Endpoint                          | Acceso        | Descripción                               |
| ------ | --------------------------------- | ------------- | ----------------------------------------- |
| GET    | `/api/farmacia/medicamentos`      | Autenticado   | Inventario de medicamentos                |
| GET    | `/api/farmacia/medicamentos/<id>` | Autenticado   | Detalle de medicamento                    |
| POST   | `/api/farmacia/medicamentos`      | Recepcionista | Agregar medicamento                       |
| PUT    | `/api/farmacia/medicamentos/<id>` | Recepcionista | Actualizar medicamento / stock            |
| GET    | `/api/farmacia/servicios`         | Autenticado   | Listar servicios extras                   |
| POST   | `/api/farmacia/servicios`         | Recepcionista | Crear servicio                            |
| PUT    | `/api/farmacia/servicios/<id>`    | Recepcionista | Actualizar servicio                       |
| GET    | `/api/farmacia/ventas`            | Recepcionista | Historial de ventas                       |
| GET    | `/api/farmacia/ventas/<id>`       | Recepcionista | Detalle de una venta                      |
| POST   | `/api/farmacia/ventas`            | Recepcionista | Registrar venta de servicios/medicamentos |

### Recepcionista / Administración

| Método | Endpoint                                                    | Acceso        | Descripción                               |
| ------ | ----------------------------------------------------------- | ------------- | ----------------------------------------- |
| GET    | `/api/recepcionistas/dashboard`                             | Recepcionista | Estadísticas generales                    |
| POST   | `/api/recepcionistas`                                       | Recepcionista | Dar de alta recepcionista                 |
| GET    | `/api/recepcionistas/bitacora/estatus`                      | Recepcionista | Bitácora de cambios de estatus            |
| GET    | `/api/recepcionistas/bitacora/historial`                    | Recepcionista | Bitácora historial citas                  |
| GET    | `/api/recepcionistas/solicitudes-cancelacion`               | Recepcionista | Solicitudes de cancelación pendientes     |
| POST   | `/api/recepcionistas/solicitudes-cancelacion/<id>/aprobar`  | Recepcionista | Aprobar cancelación solicitada por doctor |
| POST   | `/api/recepcionistas/solicitudes-cancelacion/<id>/rechazar` | Recepcionista | Rechazar solicitud de cancelación         |

---

## Credenciales de prueba

| Rol           | Email                  | Contraseña   |
| ------------- | ---------------------- | ------------ |
| Recepcionista | recepcion@hospital.com | Hospital123! |
| Doctor        | dr.garcia@hospital.com | Hospital123! |
| Paciente      | paciente@test.com      | Hospital123! |

---

## Reglas de negocio implementadas

### Agendado de citas (RF-003)

- Mínimo **48 horas** de anticipación
- Máximo **3 meses** en adelante
- No se permiten citas para el mismo día
- Se valida que el doctor no tenga otra cita en el mismo horario
- Se valida que el paciente no tenga ya una cita pendiente con ese doctor
- Se valida que el horario esté dentro de la jornada laboral del doctor

### Política de cancelación (RF-005 / RF-028)

| Tiempo antes de la cita | Quién cancela              | Devolución |
| ----------------------- | -------------------------- | ---------- |
| 48 hrs o más            | Paciente                   | 100%       |
| Entre 24 y 48 hrs       | Paciente                   | 50%        |
| Menos de 24 hrs         | Paciente                   | 0%         |
| Cualquier momento       | Doctor (vía recepcionista) | 100%       |

### Pagos (RF-026 / RF-027)

- Al agendar se genera un comprobante con **8 horas** para pagar
- Un trigger en la base de datos cancela automáticamente las citas con pago vencido
- También puede verificarse manualmente vía `POST /api/citas/verificar-vencidas`

### Bitácoras (RF-024 / RF-025)

- Todo cambio de estatus de cita queda registrado en `Bitacora_EstatusCita`
- Toda interacción médico-paciente queda en `Bitacora_HistorialCitas`
- Ambas tablas son de solo inserción y consulta (sin UPDATE ni DELETE)

### Control de acceso (RNF-001 / RF-023)

- Autenticación mediante **JWT** con expiración configurable
- Decoradores `@requiere_auth` y `@requiere_rol` en cada endpoint
- La recepcionista **no puede** leer recetas ni historiales médicos
- El doctor **no puede** editar sus propios datos sensibles (cédula, especialidad)

---

## Pendientes

### Backend

- [ ] `GET /api/recepcionistas` — listar todas las recepcionistas
- [ ] `PUT /api/recepcionistas/<id>` — actualizar datos de recepcionista
- [ ] Índices de rendimiento en SQL Server:
  ```sql
  CREATE INDEX IX_Cita_Fecha    ON Cita(Fecha_Cita);
  CREATE INDEX IX_Cita_Doctor   ON Cita(Id_Doctor);
  CREATE INDEX IX_Pago_Estado   ON Pago(Estado);
  CREATE INDEX IX_Cita_Paciente ON Cita(Id_Paciente);
  ```
- [ ] Integración SMTP para recuperación real de contraseña
- [ ] Endpoint `DELETE` de especialidades con validación de doctores asignados

### Frontend

- [ ] **Dashboard Doctor** — sección de edición de historial médico del paciente (el endpoint `PUT /api/pacientes/<id>/historial` ya existe)
- [ ] **Dashboard Doctor** — botones "Atendida" y "No acudió" por cita en la tabla de citas
- [ ] **Dashboard Recepcionista** — sección de gestión de especialidades (crear / editar)
- [ ] **Dashboard Recepcionista** — sección de gestión de recepcionistas (CRUD)
- [ ] **Ticket imprimible** — al registrar una venta, generar un ticket en PDF o vista de impresión con `window.print()`

### Base de datos

- [ ] Agregar los índices de rendimiento mencionados arriba (RNF-013)
- [ ] Revisar trigger de cancelación automática para que se ejecute por job programado o vía `verificar-vencidas`

---

## Solución de problemas comunes

### "No se pudo conectar con el servidor"

- Verificar que `python app.py` esté corriendo
- Abrir `http://127.0.0.1:5000/api/health` en el navegador
- Revisar que `.env` tenga las credenciales correctas de SQL Server

### "Error de base de datos"

- Verificar que SQL Server esté corriendo
- Confirmar que se ejecutaron `schema.sql` **antes** que `seed.sql`
- Revisar `DB_SERVER`, `DB_USER`, `DB_PASSWORD` en `.env`
- Formato de `DB_SERVER` para instancia nombrada: `NOMBRE_PC\SQLEXPRESS`

### El login no responde / error 401

- Asegurarse de abrir el frontend desde `http://127.0.0.1:8080` (no desde `file://`)
- El backend debe estar en `http://127.0.0.1:5000`
- Abrir la consola del navegador (F12 → Console) para ver el error exacto
- Verificar que `seed.sql` se ejecutó correctamente (las contraseñas están hasheadas con bcrypt)

### Error CORS

- Usar `127.0.0.1` en ambos lados, nunca mezclar con `localhost`
- Si usas Live Server de VS Code, el puerto 5500 ya está permitido en la configuración CORS

### ODBC Driver no encontrado

```bash
# Windows: descargar de Microsoft
# https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server

# Verificar drivers instalados (Windows):
# Ejecutar en Python:
import pyodbc; print(pyodbc.drivers())
```

### Citas no se cancelan automáticamente al vencer las 8 horas

El trigger de cancelación automática en SQL Server se ejecuta al hacer consultas sobre la tabla. Si no hay actividad, llamar manualmente al endpoint:

```bash
curl -X POST http://127.0.0.1:5000/api/citas/verificar-vencidas \
     -H "Authorization: Bearer <token>"
```

---

## Tecnologías

| Capa                   | Tecnología                                         |
| ---------------------- | -------------------------------------------------- |
| Frontend               | HTML5 · CSS3 · JavaScript vanilla                  |
| Backend                | Python 3 · Flask · flask-jwt-extended · flask-cors |
| Base de datos          | Microsoft SQL Server 2019+                         |
| Autenticación          | JWT (tokens con expiración)                        |
| Cifrado de contraseñas | bcrypt                                             |
| Driver de BD           | pyodbc + ODBC Driver 17/18                         |

---

**Profesora:** M. en A.P. Maria del Rosario Galeana Chavez  
**Materia:** Bases de Datos · Grupo 3CM3 · Periodo 26-2

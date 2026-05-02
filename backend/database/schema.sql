-- ============================================================
-- SISTEMA DE GESTIÓN HOSPITALARIA - HospitalDB
-- Esquema corregido a partir del MER del equipo 4 (3CM3)
-- IPN - ESCOM - Bases de Datos Periodo 26-2
--
-- Correcciones al MER original:
--   1. Eliminada referencia circular Paciente ↔ Historial_medico
--      (Paciente ya no tiene FK a Historial; la relación va
--       de Historial → Paciente)
--   2. Eliminada referencia circular Cita ↔ Pago
--      (Pago tiene Folio_Cita nullable; Cita NO tiene Id_Pago)
--   3. EstatusCita como tabla catálogo
--   4. Tabla SolicitudCancelacion para flujo Doctor → Recepcionista
--   5. Bitácoras con permisos solo INSERT/SELECT (vía vista + trigger)
-- ============================================================

USE master;
GO

IF DB_ID('HospitalDB') IS NOT NULL
BEGIN
    ALTER DATABASE HospitalDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE HospitalDB;
END
GO

CREATE DATABASE HospitalDB
    COLLATE Latin1_General_CI_AI;
GO

USE HospitalDB;
GO

-- ============================================================
-- CATÁLOGOS BASE
-- ============================================================

CREATE TABLE TipoUsuario (
    Id_TipoUsuario   INT           IDENTITY(1,1) PRIMARY KEY,
    Descripcion      VARCHAR(100)  NOT NULL
);

CREATE TABLE EstatusCita (
    Id_EstatusCita   INT           IDENTITY(1,1) PRIMARY KEY,
    Clave            VARCHAR(50)   NOT NULL UNIQUE,  -- slug interno
    Descripcion      VARCHAR(100)  NOT NULL
);

CREATE TABLE Horario (
    Id_Horario   INT          IDENTITY(1,1) PRIMARY KEY,
    Turno        VARCHAR(20)  NOT NULL,   -- Matutino, Vespertino, Nocturno
    Hora_inic    TIME         NOT NULL,
    Hora_final   TIME         NOT NULL
);

CREATE TABLE Especialidad (
    Id_Especialidad   INT             IDENTITY(1,1) PRIMARY KEY,
    Especialidad      NVARCHAR(100)   NOT NULL,
    Precio            DECIMAL(10,2)   NOT NULL
);

-- ============================================================
-- USUARIOS (tabla base para todos los perfiles)
-- ============================================================

CREATE TABLE Usuario (
    Id_Usuario       INT            IDENTITY(1,1) PRIMARY KEY,
    Id_TipoUsuario   INT            NOT NULL REFERENCES TipoUsuario(Id_TipoUsuario),
    Nombre           NVARCHAR(50)   NOT NULL,
    Ap_Paterno       NVARCHAR(50)   NOT NULL,
    Ap_Materno       NVARCHAR(50)   NULL,
    CURP             CHAR(18)       NOT NULL UNIQUE,
    Email            VARCHAR(100)   NOT NULL UNIQUE,
    Fecha_Nac        DATE           NOT NULL,
    Contrasena       VARCHAR(255)   NOT NULL,   -- bcrypt hash
    Telefono         VARCHAR(15)    NULL,
    Calle            VARCHAR(100)   NULL,
    Numero           VARCHAR(10)    NULL,
    Colonia          VARCHAR(100)   NULL,
    Direccion        VARCHAR(255)   NULL
    -- Edad se calcula: DATEDIFF(year, Fecha_Nac, GETDATE())
);

-- ============================================================
-- EMPLEADOS (subtipo de Usuario)
-- ============================================================

CREATE TABLE Empleado (
    Id_Empleado        INT            IDENTITY(1,1) PRIMARY KEY,
    Id_Usuario         INT            NOT NULL UNIQUE REFERENCES Usuario(Id_Usuario),
    Id_Horario         INT            NOT NULL REFERENCES Horario(Id_Horario),
    RFC                CHAR(13)       NOT NULL UNIQUE,
    Sueldo             DECIMAL(10,2)  NOT NULL,
    DiasVacacion       INT            NOT NULL DEFAULT 0,
    Estatus_empleado   VARCHAR(20)    NOT NULL DEFAULT 'Activo'
        CHECK (Estatus_empleado IN ('Activo','Inactivo','Suspendido'))
);

CREATE TABLE Recepcionista (
    Id_Recepcionista   INT   IDENTITY(1,1) PRIMARY KEY,
    Id_Usuario         INT   NOT NULL UNIQUE REFERENCES Usuario(Id_Usuario)
    -- Hereda datos de Usuario y Empleado
);

CREATE TABLE Doctor (
    Id_Doctor         INT           IDENTITY(1,1) PRIMARY KEY,
    Id_Usuario        INT           NOT NULL UNIQUE REFERENCES Usuario(Id_Usuario),
    Id_Especialidad   INT           NOT NULL REFERENCES Especialidad(Id_Especialidad),
    Id_Horario        INT           NOT NULL REFERENCES Horario(Id_Horario),
    Cedula_prof       VARCHAR(20)   NOT NULL UNIQUE
);

-- ============================================================
-- CONSULTORIOS
-- ============================================================

CREATE TABLE Consultorio (
    Id_Consultorio    INT            IDENTITY(1,1) PRIMARY KEY,
    Id_Especialidad   INT            NOT NULL REFERENCES Especialidad(Id_Especialidad),
    Nombre            VARCHAR(50)    NULL,
    Piso              INT            NOT NULL,
    Telefono          VARCHAR(15)    NULL,
    EquipoM           VARCHAR(255)   NULL
);

-- ============================================================
-- PACIENTES (subtipo de Usuario)
-- ============================================================

CREATE TABLE Paciente (
    Id_Paciente   INT   IDENTITY(1,1) PRIMARY KEY,
    Id_Usuario    INT   NOT NULL UNIQUE REFERENCES Usuario(Id_Usuario)
    -- HistorialMed se referencia desde Historial_medico
);

CREATE TABLE Historial_medico (
    Id_HistorialMed   INT            IDENTITY(1,1) PRIMARY KEY,
    Id_Paciente       INT            NOT NULL UNIQUE REFERENCES Paciente(Id_Paciente),
    Tipo_sangre       CHAR(5)        NOT NULL,
    Estatura          DECIMAL(5,2)   NOT NULL,
    Peso              DECIMAL(5,2)   NOT NULL,
    Alergias          VARCHAR(500)   NULL,
    Padecimientos     VARCHAR(500)   NULL
);

-- ============================================================
-- CITAS
-- ============================================================

CREATE TABLE Cita (
    Folio_Cita       INT     IDENTITY(1,1) PRIMARY KEY,
    Id_Doctor        INT     NOT NULL REFERENCES Doctor(Id_Doctor),
    Id_Paciente      INT     NOT NULL REFERENCES Paciente(Id_Paciente),
    Id_Consultorio   INT     NULL REFERENCES Consultorio(Id_Consultorio),
    Id_EstatusCita   INT     NOT NULL REFERENCES EstatusCita(Id_EstatusCita),
    Fecha_Cita       DATE    NOT NULL,
    Hora_Cita        TIME    NOT NULL,
    Solicitud_Cita   DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT CK_Cita_FechaMinima CHECK (
        CAST(Fecha_Cita AS DATETIME) >= DATEADD(hour, 48, Solicitud_Cita)
    ),
    CONSTRAINT CK_Cita_FechaMaxima CHECK (
        CAST(Fecha_Cita AS DATETIME) <= DATEADD(month, 3, Solicitud_Cita)
    )
);
GO

CREATE UNIQUE INDEX UX_Cita_Doctor_FechaHora
    ON Cita(Id_Doctor, Fecha_Cita, Hora_Cita)
    WHERE Id_EstatusCita IN (1, 2);
GO

-- ============================================================
-- PAGOS
-- ============================================================

CREATE TABLE Pago (
    Id_Pago        INT            IDENTITY(1,1) PRIMARY KEY,
    Folio_Cita     INT            NULL REFERENCES Cita(Folio_Cita),  -- NULL si es venta de mostrador
    MetodoPago     VARCHAR(50)    NOT NULL
        CHECK (MetodoPago IN ('Efectivo','Tarjeta','Transferencia')),
    Monto          DECIMAL(10,2)  NOT NULL,
    FechaPago      DATETIME       NOT NULL DEFAULT GETDATE(),
    Estado         VARCHAR(20)    NOT NULL DEFAULT 'Pendiente'
        CHECK (Estado IN ('Pendiente','Pagado','Cancelado')),
    MontoDevuelto  DECIMAL(10,2)  NOT NULL DEFAULT 0.00
);

-- ============================================================
-- SOLICITUDES DE CANCELACIÓN (doctor pide, recepcionista aprueba)
-- ============================================================

CREATE TABLE SolicitudCancelacion (
    Id_Solicitud         INT           IDENTITY(1,1) PRIMARY KEY,
    Folio_Cita           INT           NOT NULL REFERENCES Cita(Folio_Cita),
    Id_Doctor            INT           NOT NULL REFERENCES Doctor(Id_Doctor),
    Id_Recepcionista     INT           NULL REFERENCES Recepcionista(Id_Recepcionista),
    Motivo               VARCHAR(500)  NOT NULL,
    Estatus              VARCHAR(20)   NOT NULL DEFAULT 'Pendiente'
        CHECK (Estatus IN ('Pendiente','Aprobada','Rechazada')),
    Fecha_Solicitud      DATETIME      NOT NULL DEFAULT GETDATE(),
    Fecha_Resolucion     DATETIME      NULL
);

-- ============================================================
-- RECETAS
-- ============================================================

CREATE TABLE Receta (
    Id_Receta      INT            IDENTITY(1,1) PRIMARY KEY,
    Folio_Cita     INT            NOT NULL REFERENCES Cita(Folio_Cita),
    Medicamento    VARCHAR(500)   NOT NULL,
    Tratamiento    VARCHAR(500)   NOT NULL,
    Observaciones  VARCHAR(500)   NULL,
    FechaEmision   DATE           NOT NULL DEFAULT CAST(GETDATE() AS DATE)
);

-- ============================================================
-- FARMACIA / SERVICIOS
-- ============================================================

CREATE TABLE Farmacia (
    Id_Farmacia   INT             IDENTITY(1,1) PRIMARY KEY,
    Nombre        NVARCHAR(100)   NOT NULL,
    Descripcion   VARCHAR(255)    NULL,
    Precio        DECIMAL(10,2)   NOT NULL,
    Unidad        VARCHAR(50)     NOT NULL,   -- Caja, Frasco, Tableta, ml…
    Stock         INT             NOT NULL DEFAULT 0
        CHECK (Stock >= 0)
);

CREATE TABLE Servicio (
    Id_Servicio   INT             IDENTITY(1,1) PRIMARY KEY,
    Nombre        NVARCHAR(100)   NOT NULL,
    Precio        DECIMAL(10,2)   NOT NULL,
    Descripcion   VARCHAR(255)    NULL
);

-- ============================================================
-- VENTAS (farmacia / servicios de mostrador)
-- ============================================================

CREATE TABLE Venta (
    Id_Venta          INT            IDENTITY(1,1) PRIMARY KEY,
    Id_Recepcionista  INT            NOT NULL REFERENCES Recepcionista(Id_Recepcionista),
    Total             DECIMAL(10,2)  NOT NULL,
    Fecha             DATETIME       NOT NULL DEFAULT GETDATE(),
    Tipo_Venta        VARCHAR(20)    NOT NULL
        CHECK (Tipo_Venta IN ('Servicio','Farmacia','Mixta'))
);

CREATE TABLE Detalle_Venta (
    Id_Detalle    INT             IDENTITY(1,1) PRIMARY KEY,
    Id_Venta      INT             NOT NULL REFERENCES Venta(Id_Venta),
    Id_Servicio   INT             NULL REFERENCES Servicio(Id_Servicio),
    Id_Farmacia   INT             NULL REFERENCES Farmacia(Id_Farmacia),
    Cantidad      INT             NOT NULL CHECK (Cantidad > 0),
    Subtotal      DECIMAL(10,2)   NOT NULL,
    -- Al menos uno de los dos debe estar presente
    CONSTRAINT CK_Detalle_TipoItem CHECK (
        (Id_Servicio IS NOT NULL AND Id_Farmacia IS NULL) OR
        (Id_Servicio IS NULL AND Id_Farmacia IS NOT NULL)
    )
);

-- ============================================================
-- BITÁCORAS (solo INSERT y SELECT - restringir UPDATE/DELETE vía permisos)
-- ============================================================

CREATE TABLE Bitacora_EstatusCita (
    Id_Registro    INT             IDENTITY(1,1) PRIMARY KEY,
    Folio_Cita     INT             NOT NULL,
    Fecha_Mov      DATETIME        NOT NULL DEFAULT GETDATE(),
    Estatus_Cita   VARCHAR(50)     NOT NULL,   -- clave del estatus
    Fecha_Cita     DATE            NOT NULL,
    Id_Especialidad INT            NOT NULL,
    Costo          DECIMAL(10,2)   NOT NULL,
    Politica_Cancela VARCHAR(50)   NULL,        -- '100%','50%','0%' o NULL
    Monto_Devuelto DECIMAL(10,2)   NOT NULL DEFAULT 0.00
);

CREATE TABLE Bitacora_HistorialCitas (
    Id_Historial   INT             IDENTITY(1,1) PRIMARY KEY,
    Usuario        VARCHAR(100)    NOT NULL,   -- email o nombre del actor
    Rol_Usuario    VARCHAR(50)     NOT NULL,   -- Paciente/Doctor/Recepcionista
    Folio_Cita     INT             NOT NULL,
    Fecha_Cita     DATE            NOT NULL,
    Hora_Cita      TIME            NOT NULL,
    Id_Paciente    INT             NOT NULL,
    Folio_Receta   INT             NULL,
    Id_Doctor      INT             NOT NULL,
    Estatus_Consulta VARCHAR(50)   NOT NULL,
    Especialidad   NVARCHAR(100)   NOT NULL,
    Id_Consultorio INT             NULL,
    Fecha_Registro DATETIME        NOT NULL DEFAULT GETDATE()
);

-- ============================================================
-- TRIGGER: cancelar citas sin pago después de 8 horas
-- (Se ejecuta en lecturas; en producción usar SQL Agent Job)
-- ============================================================

-- ============================================================
-- ÍNDICES de performance
-- ============================================================
CREATE INDEX IX_Cita_Paciente   ON Cita(Id_Paciente);
CREATE INDEX IX_Cita_Fecha      ON Cita(Fecha_Cita);
CREATE INDEX IX_Pago_Cita       ON Pago(Folio_Cita);
CREATE INDEX IX_Receta_Cita     ON Receta(Folio_Cita);
CREATE INDEX IX_Usuario_Email   ON Usuario(Email);

-- ============================================================
-- DATOS CATÁLOGO: TipoUsuario
-- ============================================================
INSERT INTO TipoUsuario (Descripcion) VALUES
    ('Paciente'),
    ('Doctor'),
    ('Recepcionista'),
    ('Administrador');

-- ============================================================
-- DATOS CATÁLOGO: EstatusCita
-- ============================================================
INSERT INTO EstatusCita (Clave, Descripcion) VALUES
    ('agendada_pendiente_pago',    'Agendada - Pendiente de Pago'),
    ('pagada_pendiente_atender',   'Pagada - Pendiente por Atender'),
    ('cancelada_falta_pago',       'Cancelada - Falta de Pago'),
    ('cancelada_paciente',         'Cancelada - Por el Paciente'),
    ('cancelada_doctor',           'Cancelada - Por el Doctor'),
    ('atendida',                   'Atendida'),
    ('no_acudio',                  'No Acudió');

-- ============================================================
-- DATOS CATÁLOGO: Horarios
-- ============================================================
INSERT INTO Horario (Turno, Hora_inic, Hora_final) VALUES
    ('Matutino',   '07:00', '15:00'),
    ('Vespertino', '15:00', '22:00'),
    ('Nocturno',   '22:00', '07:00');

-- ============================================================
-- DATOS CATÁLOGO: Especialidades (mínimo 10)
-- ============================================================
INSERT INTO Especialidad (Especialidad, Precio) VALUES
    ('Cardiología',      800.00),
    ('Dermatología',     600.00),
    ('Ginecología',      700.00),
    ('Medicina General', 400.00),
    ('Nefrología',       750.00),
    ('Nutriología',      500.00),
    ('Oftalmología',     650.00),
    ('Oncología',        900.00),
    ('Ortopedia',        800.00),
    ('Pediatría',        550.00);

-- ============================================================
-- DATOS CATÁLOGO: Servicios extra
-- ============================================================
INSERT INTO Servicio (Nombre, Precio, Descripcion) VALUES
    ('Inyección',           80.00,  'Aplicación de inyección intramuscular o intravenosa'),
    ('Vacuna',             200.00,  'Aplicación de vacuna'),
    ('Curación',           150.00,  'Limpieza y curación de herida'),
    ('Estudio de sangre',  350.00,  'Análisis clínico de muestra de sangre'),
    ('Electrocardiograma', 450.00,  'Registro de actividad eléctrica del corazón');

-- ============================================================
-- CONSULTORIOS (2 por especialidad como ejemplo)
-- ============================================================
INSERT INTO Consultorio (Id_Especialidad, Nombre, Piso, Telefono, EquipoM) VALUES
    (1, 'Consultorio Cardiología 1',      2, '5555-0101', 'ECG, Desfibrilador'),
    (1, 'Consultorio Cardiología 2',      2, '5555-0102', 'ECG, Monitor cardiaco'),
    (2, 'Consultorio Dermatología 1',     3, '5555-0201', 'Dermatoscopio, Lámpara Wood'),
    (2, 'Consultorio Dermatología 2',     3, '5555-0202', 'Dermatoscopio'),
    (3, 'Consultorio Ginecología 1',      4, '5555-0301', 'Ultrasonido, Mesa ginecológica'),
    (3, 'Consultorio Ginecología 2',      4, '5555-0302', 'Mesa ginecológica'),
    (4, 'Consultorio Medicina General 1', 1, '5555-0401', 'Báscula, Tensiómetro'),
    (4, 'Consultorio Medicina General 2', 1, '5555-0402', 'Báscula, Tensiómetro'),
    (5, 'Consultorio Nefrología 1',       2, '5555-0501', 'Equipo de hemodiálisis'),
    (5, 'Consultorio Nefrología 2',       2, '5555-0502', 'Monitor renal'),
    (6, 'Consultorio Nutriología 1',      3, '5555-0601', 'Báscula, Plicómetro, Bioimpedancia'),
    (6, 'Consultorio Nutriología 2',      3, '5555-0602', 'Báscula'),
    (7, 'Consultorio Oftalmología 1',     4, '5555-0701', 'Optómetro, Lámpara de hendidura'),
    (7, 'Consultorio Oftalmología 2',     4, '5555-0702', 'Tonómetro'),
    (8, 'Consultorio Oncología 1',        5, '5555-0801', 'Equipo de diagnóstico por imagen'),
    (8, 'Consultorio Oncología 2',        5, '5555-0802', 'Monitor oncológico'),
    (9, 'Consultorio Ortopedia 1',        1, '5555-0901', 'Rayos X, Mesa ortopédica'),
    (9, 'Consultorio Ortopedia 2',        1, '5555-0902', 'Rayos X'),
    (10,'Consultorio Pediatría 1',        2, '5555-1001', 'Báscula pediátrica, Otoscopio'),
    (10,'Consultorio Pediatría 2',        2, '5555-1002', 'Báscula pediátrica');

GO
PRINT 'Schema HospitalDB creado exitosamente.';

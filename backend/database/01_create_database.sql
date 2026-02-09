-- =============================================
-- SISTEMA DE GESTIÓN HOSPITALARIA
-- Base de Datos: HospitalDB
-- Motor: Microsoft SQL Server
-- =============================================

-- Crear la base de datos si no existe
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'HospitalDB')
BEGIN
    CREATE DATABASE HospitalDB;
END
GO

USE HospitalDB;
GO

-- =============================================
-- ELIMINAR TABLAS SI EXISTEN (para recrear)
-- =============================================
IF OBJECT_ID('dbo.BitacoraHistorialCitas', 'U') IS NOT NULL DROP TABLE dbo.BitacoraHistorialCitas;
IF OBJECT_ID('dbo.BitacoraEstatusCita', 'U') IS NOT NULL DROP TABLE dbo.BitacoraEstatusCita;
IF OBJECT_ID('dbo.DetalleVenta', 'U') IS NOT NULL DROP TABLE dbo.DetalleVenta;
IF OBJECT_ID('dbo.Venta', 'U') IS NOT NULL DROP TABLE dbo.Venta;
IF OBJECT_ID('dbo.RecetaMedicamento', 'U') IS NOT NULL DROP TABLE dbo.RecetaMedicamento;
IF OBJECT_ID('dbo.Receta', 'U') IS NOT NULL DROP TABLE dbo.Receta;
IF OBJECT_ID('dbo.Cita', 'U') IS NOT NULL DROP TABLE dbo.Cita;
IF OBJECT_ID('dbo.Pago', 'U') IS NOT NULL DROP TABLE dbo.Pago;
IF OBJECT_ID('dbo.HistorialMedico', 'U') IS NOT NULL DROP TABLE dbo.HistorialMedico;
IF OBJECT_ID('dbo.Paciente', 'U') IS NOT NULL DROP TABLE dbo.Paciente;
IF OBJECT_ID('dbo.HorarioDoctor', 'U') IS NOT NULL DROP TABLE dbo.HorarioDoctor;
IF OBJECT_ID('dbo.Doctor', 'U') IS NOT NULL DROP TABLE dbo.Doctor;
IF OBJECT_ID('dbo.Recepcionista', 'U') IS NOT NULL DROP TABLE dbo.Recepcionista;
IF OBJECT_ID('dbo.Empleado', 'U') IS NOT NULL DROP TABLE dbo.Empleado;
IF OBJECT_ID('dbo.Consultorio', 'U') IS NOT NULL DROP TABLE dbo.Consultorio;
IF OBJECT_ID('dbo.Especialidad', 'U') IS NOT NULL DROP TABLE dbo.Especialidad;
IF OBJECT_ID('dbo.Medicamento', 'U') IS NOT NULL DROP TABLE dbo.Medicamento;
IF OBJECT_ID('dbo.Servicio', 'U') IS NOT NULL DROP TABLE dbo.Servicio;
IF OBJECT_ID('dbo.Usuario', 'U') IS NOT NULL DROP TABLE dbo.Usuario;
GO

-- =============================================
-- TABLAS CATÁLOGO
-- =============================================

-- Tabla de Usuarios (Login)
CREATE TABLE Usuario (
    id_usuario INT IDENTITY(1,1) PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    tipo_usuario VARCHAR(20) NOT NULL CHECK (tipo_usuario IN ('paciente', 'doctor', 'recepcionista')),
    activo BIT DEFAULT 1,
    fecha_creacion DATETIME DEFAULT GETDATE(),
    ultimo_acceso DATETIME
);

-- Tabla de Especialidades
CREATE TABLE Especialidad (
    id_especialidad INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(200),
    costo_consulta DECIMAL(10,2) NOT NULL,
    activa BIT DEFAULT 1
);

-- Tabla de Consultorios
CREATE TABLE Consultorio (
    id_consultorio INT IDENTITY(1,1) PRIMARY KEY,
    numero_consultorio VARCHAR(10) NOT NULL UNIQUE,
    piso INT,
    edificio VARCHAR(20),
    activo BIT DEFAULT 1
);

-- Tabla de Medicamentos
CREATE TABLE Medicamento (
    id_medicamento INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(200),
    precio_unitario DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    stock_minimo INT DEFAULT 10,
    fecha_vencimiento DATE,
    activo BIT DEFAULT 1
);

-- Tabla de Servicios
CREATE TABLE Servicio (
    id_servicio INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(200),
    precio DECIMAL(10,2) NOT NULL,
    activo BIT DEFAULT 1
);

-- =============================================
-- TABLAS DE EMPLEADOS
-- =============================================

-- Tabla de Empleados (Base)
CREATE TABLE Empleado (
    id_empleado INT IDENTITY(1,1) PRIMARY KEY,
    numero_empleado VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    apellido_paterno VARCHAR(50) NOT NULL,
    apellido_materno VARCHAR(50),
    curp VARCHAR(18) UNIQUE NOT NULL,
    rfc VARCHAR(13),
    fecha_nacimiento DATE,
    telefono VARCHAR(15),
    email VARCHAR(100),
    direccion VARCHAR(200),
    fecha_contratacion DATE DEFAULT GETDATE(),
    activo BIT DEFAULT 1,
    id_usuario INT,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario)
);

-- Tabla de Doctores
CREATE TABLE Doctor (
    id_doctor INT IDENTITY(1,1) PRIMARY KEY,
    id_empleado INT NOT NULL UNIQUE,
    cedula_profesional VARCHAR(20) UNIQUE NOT NULL,
    id_especialidad INT NOT NULL,
    id_consultorio INT,
    FOREIGN KEY (id_empleado) REFERENCES Empleado(id_empleado),
    FOREIGN KEY (id_especialidad) REFERENCES Especialidad(id_especialidad),
    FOREIGN KEY (id_consultorio) REFERENCES Consultorio(id_consultorio)
);

-- Tabla de Horarios de Doctores
CREATE TABLE HorarioDoctor (
    id_horario INT IDENTITY(1,1) PRIMARY KEY,
    id_doctor INT NOT NULL,
    dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7), -- 1=Lunes, 7=Domingo
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    activo BIT DEFAULT 1,
    FOREIGN KEY (id_doctor) REFERENCES Doctor(id_doctor)
);

-- Tabla de Recepcionistas
CREATE TABLE Recepcionista (
    id_recepcionista INT IDENTITY(1,1) PRIMARY KEY,
    id_empleado INT NOT NULL UNIQUE,
    turno VARCHAR(20) CHECK (turno IN ('matutino', 'vespertino', 'nocturno')),
    FOREIGN KEY (id_empleado) REFERENCES Empleado(id_empleado)
);

-- =============================================
-- TABLAS DE PACIENTES
-- =============================================

-- Tabla de Pacientes
CREATE TABLE Paciente (
    id_paciente INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    apellido_paterno VARCHAR(50) NOT NULL,
    apellido_materno VARCHAR(50),
    fecha_nacimiento DATE NOT NULL,
    edad AS (DATEDIFF(YEAR, fecha_nacimiento, GETDATE())),
    sexo CHAR(1) CHECK (sexo IN ('M', 'F')),
    curp VARCHAR(18) UNIQUE,
    telefono VARCHAR(15) NOT NULL,
    email VARCHAR(100),
    direccion VARCHAR(200),
    fecha_registro DATETIME DEFAULT GETDATE(),
    activo BIT DEFAULT 1,
    id_usuario INT,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario)
);

-- Tabla de Historial Médico
CREATE TABLE HistorialMedico (
    id_historial INT IDENTITY(1,1) PRIMARY KEY,
    id_paciente INT NOT NULL,
    tipo_sangre VARCHAR(5),
    alergias VARCHAR(500),
    padecimientos_previos VARCHAR(500),
    peso DECIMAL(5,2),
    estatura DECIMAL(5,2),
    fecha_actualizacion DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (id_paciente) REFERENCES Paciente(id_paciente)
);

-- =============================================
-- TABLAS DE CITAS Y PAGOS
-- =============================================

-- Tabla de Pagos
CREATE TABLE Pago (
    id_pago INT IDENTITY(1,1) PRIMARY KEY,
    folio_pago VARCHAR(50) UNIQUE NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    fecha_pago DATETIME,
    metodo_pago VARCHAR(20) CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
    estatus VARCHAR(20) DEFAULT 'pendiente' CHECK (estatus IN ('pendiente', 'pagado', 'reembolsado')),
    monto_reembolsado DECIMAL(10,2) DEFAULT 0
);

-- Tabla de Citas
CREATE TABLE Cita (
    id_cita INT IDENTITY(1,1) PRIMARY KEY,
    folio_cita VARCHAR(50) UNIQUE NOT NULL,
    id_paciente INT NOT NULL,
    id_doctor INT NOT NULL,
    id_consultorio INT NOT NULL,
    fecha_cita DATE NOT NULL,
    hora_cita TIME NOT NULL,
    fecha_agendada DATETIME DEFAULT GETDATE(),
    estatus VARCHAR(50) DEFAULT 'agendada_pendiente_pago' CHECK (
        estatus IN (
            'agendada_pendiente_pago',
            'pagada_pendiente_atender',
            'cancelada_falta_pago',
            'cancelada_paciente',
            'cancelada_doctor',
            'atendida',
            'no_acudio'
        )
    ),
    id_pago INT,
    motivo_cancelacion VARCHAR(200),
    fecha_cancelacion DATETIME,
    limite_pago DATETIME, -- 8 horas después de agendar
    FOREIGN KEY (id_paciente) REFERENCES Paciente(id_paciente),
    FOREIGN KEY (id_doctor) REFERENCES Doctor(id_doctor),
    FOREIGN KEY (id_consultorio) REFERENCES Consultorio(id_consultorio),
    FOREIGN KEY (id_pago) REFERENCES Pago(id_pago)
);

-- =============================================
-- TABLAS DE RECETAS
-- =============================================

-- Tabla de Recetas
CREATE TABLE Receta (
    id_receta INT IDENTITY(1,1) PRIMARY KEY,
    folio_receta VARCHAR(50) UNIQUE NOT NULL,
    id_cita INT NOT NULL,
    id_doctor INT NOT NULL,
    id_paciente INT NOT NULL,
    fecha_emision DATETIME DEFAULT GETDATE(),
    diagnostico VARCHAR(500),
    tratamiento VARCHAR(500),
    observaciones VARCHAR(500),
    FOREIGN KEY (id_cita) REFERENCES Cita(id_cita),
    FOREIGN KEY (id_doctor) REFERENCES Doctor(id_doctor),
    FOREIGN KEY (id_paciente) REFERENCES Paciente(id_paciente)
);

-- Tabla de Medicamentos en Receta
CREATE TABLE RecetaMedicamento (
    id_receta_medicamento INT IDENTITY(1,1) PRIMARY KEY,
    id_receta INT NOT NULL,
    id_medicamento INT NOT NULL,
    cantidad INT NOT NULL,
    indicaciones VARCHAR(200),
    FOREIGN KEY (id_receta) REFERENCES Receta(id_receta),
    FOREIGN KEY (id_medicamento) REFERENCES Medicamento(id_medicamento)
);

-- =============================================
-- TABLAS DE VENTAS (FARMACIA)
-- =============================================

-- Tabla de Ventas
CREATE TABLE Venta (
    id_venta INT IDENTITY(1,1) PRIMARY KEY,
    folio_venta VARCHAR(50) UNIQUE NOT NULL,
    fecha_venta DATETIME DEFAULT GETDATE(),
    total DECIMAL(10,2) NOT NULL,
    metodo_pago VARCHAR(20) CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
    id_recepcionista INT, -- Quien realizó la venta
    nombre_cliente VARCHAR(100), -- No necesita ser paciente
    FOREIGN KEY (id_recepcionista) REFERENCES Recepcionista(id_recepcionista)
);

-- Tabla de Detalle de Venta
CREATE TABLE DetalleVenta (
    id_detalle_venta INT IDENTITY(1,1) PRIMARY KEY,
    id_venta INT NOT NULL,
    tipo_producto VARCHAR(20) CHECK (tipo_producto IN ('medicamento', 'servicio')),
    id_medicamento INT,
    id_servicio INT,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_venta) REFERENCES Venta(id_venta),
    FOREIGN KEY (id_medicamento) REFERENCES Medicamento(id_medicamento),
    FOREIGN KEY (id_servicio) REFERENCES Servicio(id_servicio)
);

-- =============================================
-- TABLAS DE BITÁCORA
-- =============================================

-- Bitácora de Estatus de Cita
CREATE TABLE BitacoraEstatusCita (
    id_bitacora_estatus INT IDENTITY(1,1) PRIMARY KEY,
    folio_cita VARCHAR(50) NOT NULL,
    fecha_movimiento DATETIME DEFAULT GETDATE(),
    estatus_cita VARCHAR(50) NOT NULL,
    fecha_cita DATE,
    id_especialidad INT,
    costo DECIMAL(10,2),
    politica_cancelacion VARCHAR(20),
    monto_devuelto DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (id_especialidad) REFERENCES Especialidad(id_especialidad)
);

-- Bitácora de Historial de Citas Médico-Paciente
CREATE TABLE BitacoraHistorialCitas (
    id_historial_bitacora INT IDENTITY(1,1) PRIMARY KEY,
    usuario VARCHAR(100) NOT NULL, -- Email del usuario que hace el movimiento
    tipo_usuario VARCHAR(20), -- paciente, doctor, recepcionista
    ip_maquina VARCHAR(50),
    folio_cita VARCHAR(50),
    fecha_cita DATE,
    hora_cita TIME,
    id_paciente INT,
    folio_receta VARCHAR(50),
    id_doctor INT,
    estatus_consulta VARCHAR(20) CHECK (estatus_consulta IN ('atendida', 'no_asistio')),
    especialidad VARCHAR(50),
    consultorio VARCHAR(10),
    fecha_registro DATETIME DEFAULT GETDATE()
);

GO

-- =============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =============================================

CREATE INDEX idx_cita_paciente ON Cita(id_paciente);
CREATE INDEX idx_cita_doctor ON Cita(id_doctor);
CREATE INDEX idx_cita_fecha ON Cita(fecha_cita);
CREATE INDEX idx_cita_estatus ON Cita(estatus);
CREATE INDEX idx_usuario_email ON Usuario(email);
CREATE INDEX idx_paciente_email ON Paciente(email);
CREATE INDEX idx_empleado_email ON Empleado(email);

GO

PRINT 'Base de datos HospitalDB creada exitosamente con todas las tablas.';
GO

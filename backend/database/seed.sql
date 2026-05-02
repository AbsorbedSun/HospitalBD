-- ============================================================
-- DATOS DE PRUEBA - HospitalDB
-- Ejecutar DESPUÉS de schema.sql
-- Contraseñas de ejemplo: todas usan "Hospital123!"
--
-- CORRECCIÓN (2025-04): El hash anterior era inválido y causaba
-- que doctores/recepcionistas no pudieran iniciar sesión.
-- Hash actualizado y verificado con bcrypt.checkpw().
--
-- Si ya tienes usuarios en BD con el hash antiguo, usa:
--   POST /api/auth/reset-password
--   Body: { "email": "...", "nueva_password": "Hospital123!" }
-- ============================================================

USE HospitalDB;
GO

-- ============================================================
-- RECEPCIONISTA ADMIN (para poder dar de alta doctores)
-- Password: Hospital123!
-- ============================================================
INSERT INTO Usuario (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno, CURP, Email,
                     Fecha_Nac, Contrasena, Telefono, Calle, Numero, Colonia)
VALUES (3, 'Ana', 'Rodríguez', 'López',
        'ROLA900101MDFDRN01',
        'recepcion@hospital.com',
        '1990-01-15',
        '$2b$12$4y1WblU1O4CfmdWm7t0m..aFYDqVec7Fm0WZtdBSvvtIApRmMSA46',  -- Hospital123!
        '5555-0001', 'Av. Principal', '100', 'Centro');

INSERT INTO Empleado (Id_Usuario, Id_Horario, RFC, Sueldo, DiasVacacion, Estatus_empleado)
VALUES (SCOPE_IDENTITY(), 1, 'ROLA900101AB1', 15000.00, 15, 'Activo');

INSERT INTO Recepcionista (Id_Usuario)
SELECT Id_Usuario FROM Usuario WHERE Email = 'recepcion@hospital.com';

-- ============================================================
-- DOCTORES (al menos 4 por especialidad)
-- ============================================================

-- Helper: inserta un doctor
-- Cardiología (Id_Especialidad = 1)
INSERT INTO Usuario (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno, CURP, Email, Fecha_Nac, Contrasena, Telefono)
VALUES (2,'Carlos','García','Martínez','GAMC750312HDFRRR01','dr.garcia@hospital.com','1975-03-12',
        '$2b$12$4y1WblU1O4CfmdWm7t0m..aFYDqVec7Fm0WZtdBSvvtIApRmMSA46','5555-1001');
INSERT INTO Empleado (Id_Usuario, Id_Horario, RFC, Sueldo, DiasVacacion, Estatus_empleado)
VALUES (SCOPE_IDENTITY(), 1, 'GAMC750312CD1', 35000.00, 20, 'Activo');
INSERT INTO Doctor (Id_Usuario, Id_Especialidad, Id_Horario, Cedula_prof)
SELECT Id_Usuario, 1, 1, 'CED-CARD-001' FROM Usuario WHERE Email='dr.garcia@hospital.com';

INSERT INTO Usuario (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno, CURP, Email, Fecha_Nac, Contrasena, Telefono)
VALUES (2,'María','López','Sánchez','LOSM800520MDFPRR01','dr.lopez@hospital.com','1980-05-20',
        '$2b$12$4y1WblU1O4CfmdWm7t0m..aFYDqVec7Fm0WZtdBSvvtIApRmMSA46','5555-1002');
INSERT INTO Empleado (Id_Usuario, Id_Horario, RFC, Sueldo, DiasVacacion, Estatus_empleado)
VALUES (SCOPE_IDENTITY(), 2, 'LOSM800520EF2', 34000.00, 20, 'Activo');
INSERT INTO Doctor (Id_Usuario, Id_Especialidad, Id_Horario, Cedula_prof)
SELECT Id_Usuario, 1, 2, 'CED-CARD-002' FROM Usuario WHERE Email='dr.lopez@hospital.com';

INSERT INTO Usuario (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno, CURP, Email, Fecha_Nac, Contrasena, Telefono)
VALUES (2,'Roberto','Hernández','Cruz','HECR850710HDFRRR01','dr.hernandez@hospital.com','1985-07-10',
        '$2b$12$4y1WblU1O4CfmdWm7t0m..aFYDqVec7Fm0WZtdBSvvtIApRmMSA46','5555-1003');
INSERT INTO Empleado (Id_Usuario, Id_Horario, RFC, Sueldo, DiasVacacion, Estatus_empleado)
VALUES (SCOPE_IDENTITY(), 1, 'HECR850710GH3', 33000.00, 20, 'Activo');
INSERT INTO Doctor (Id_Usuario, Id_Especialidad, Id_Horario, Cedula_prof)
SELECT Id_Usuario, 1, 1, 'CED-CARD-003' FROM Usuario WHERE Email='dr.hernandez@hospital.com';

INSERT INTO Usuario (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno, CURP, Email, Fecha_Nac, Contrasena, Telefono)
VALUES (2,'Patricia','Ramírez','Flores','RAFP790915MDFMRR01','dr.ramirez@hospital.com','1979-09-15',
        '$2b$12$4y1WblU1O4CfmdWm7t0m..aFYDqVec7Fm0WZtdBSvvtIApRmMSA46','5555-1004');
INSERT INTO Empleado (Id_Usuario, Id_Horario, RFC, Sueldo, DiasVacacion, Estatus_empleado)
VALUES (SCOPE_IDENTITY(), 2, 'RAFP790915IJ4', 36000.00, 20, 'Activo');
INSERT INTO Doctor (Id_Usuario, Id_Especialidad, Id_Horario, Cedula_prof)
SELECT Id_Usuario, 1, 2, 'CED-CARD-004' FROM Usuario WHERE Email='dr.ramirez@hospital.com';

-- Medicina General (Id_Especialidad = 4)
INSERT INTO Usuario (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno, CURP, Email, Fecha_Nac, Contrasena, Telefono)
VALUES (2,'Jorge','Torres','Pérez','TOPJ820305HDFRRR01','dr.torres@hospital.com','1982-03-05',
        '$2b$12$4y1WblU1O4CfmdWm7t0m..aFYDqVec7Fm0WZtdBSvvtIApRmMSA46','5555-1005');
INSERT INTO Empleado (Id_Usuario, Id_Horario, RFC, Sueldo, DiasVacacion, Estatus_empleado)
VALUES (SCOPE_IDENTITY(), 1, 'TOPJ820305KL5', 28000.00, 20, 'Activo');
INSERT INTO Doctor (Id_Usuario, Id_Especialidad, Id_Horario, Cedula_prof)
SELECT Id_Usuario, 4, 1, 'CED-MG-001' FROM Usuario WHERE Email='dr.torres@hospital.com';

INSERT INTO Usuario (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno, CURP, Email, Fecha_Nac, Contrasena, Telefono)
VALUES (2,'Laura','Martínez','Díaz','MADL900218MDFRRR01','dr.martinez@hospital.com','1990-02-18',
        '$2b$12$4y1WblU1O4CfmdWm7t0m..aFYDqVec7Fm0WZtdBSvvtIApRmMSA46','5555-1006');
INSERT INTO Empleado (Id_Usuario, Id_Horario, RFC, Sueldo, DiasVacacion, Estatus_empleado)
VALUES (SCOPE_IDENTITY(), 2, 'MADL900218MN6', 27000.00, 20, 'Activo');
INSERT INTO Doctor (Id_Usuario, Id_Especialidad, Id_Horario, Cedula_prof)
SELECT Id_Usuario, 4, 2, 'CED-MG-002' FROM Usuario WHERE Email='dr.martinez@hospital.com';

INSERT INTO Usuario (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno, CURP, Email, Fecha_Nac, Contrasena, Telefono)
VALUES (2,'Alejandro','Sánchez','Ruiz','SARA880712HDFRRR01','dr.sanchez@hospital.com','1988-07-12',
        '$2b$12$4y1WblU1O4CfmdWm7t0m..aFYDqVec7Fm0WZtdBSvvtIApRmMSA46','5555-1007');
INSERT INTO Empleado (Id_Usuario, Id_Horario, RFC, Sueldo, DiasVacacion, Estatus_empleado)
VALUES (SCOPE_IDENTITY(), 1, 'SARA880712OP7', 28000.00, 20, 'Activo');
INSERT INTO Doctor (Id_Usuario, Id_Especialidad, Id_Horario, Cedula_prof)
SELECT Id_Usuario, 4, 1, 'CED-MG-003' FROM Usuario WHERE Email='dr.sanchez@hospital.com';

INSERT INTO Usuario (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno, CURP, Email, Fecha_Nac, Contrasena, Telefono)
VALUES (2,'Carmen','Flores','Vega','FOVC870425MDFRRR01','dr.flores@hospital.com','1987-04-25',
        '$2b$12$4y1WblU1O4CfmdWm7t0m..aFYDqVec7Fm0WZtdBSvvtIApRmMSA46','5555-1008');
INSERT INTO Empleado (Id_Usuario, Id_Horario, RFC, Sueldo, DiasVacacion, Estatus_empleado)
VALUES (SCOPE_IDENTITY(), 2, 'FOVC870425QR8', 29000.00, 20, 'Activo');
INSERT INTO Doctor (Id_Usuario, Id_Especialidad, Id_Horario, Cedula_prof)
SELECT Id_Usuario, 4, 2, 'CED-MG-004' FROM Usuario WHERE Email='dr.flores@hospital.com';

-- ============================================================
-- PACIENTE DE PRUEBA
-- ============================================================
INSERT INTO Usuario (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno, CURP, Email, Fecha_Nac, Contrasena, Telefono, Calle, Numero, Colonia)
VALUES (1,'Juan','Pérez','González','PEGJ950830HDFRRR01','paciente@test.com','1995-08-30',
        '$2b$12$4y1WblU1O4CfmdWm7t0m..aFYDqVec7Fm0WZtdBSvvtIApRmMSA46',
        '5555-2001','Calle Reforma','250','Juárez');

INSERT INTO Paciente (Id_Usuario)
SELECT Id_Usuario FROM Usuario WHERE Email='paciente@test.com';

INSERT INTO Historial_medico (Id_Paciente, Tipo_sangre, Estatura, Peso, Alergias, Padecimientos)
SELECT Id_Paciente, 'O+', 1.75, 72.00, 'Penicilina', 'Ninguno'
FROM Paciente p JOIN Usuario u ON p.Id_Usuario = u.Id_Usuario
WHERE u.Email = 'paciente@test.com';

-- ============================================================
-- FARMACIA - Medicamentos de ejemplo
-- ============================================================
INSERT INTO Farmacia (Nombre, Descripcion, Precio, Unidad, Stock) VALUES
    ('Paracetamol 500mg',  'Analgésico y antipirético',                 35.00, 'Caja x 10', 200),
    ('Ibuprofeno 400mg',   'Antiinflamatorio no esteroideo',             45.00, 'Caja x 20', 150),
    ('Amoxicilina 500mg',  'Antibiótico de amplio espectro',             85.00, 'Caja x 12', 100),
    ('Omeprazol 20mg',     'Inhibidor de bomba de protones',             60.00, 'Caja x 14', 180),
    ('Metformina 850mg',   'Antidiabético oral',                         40.00, 'Caja x 30', 120),
    ('Loratadina 10mg',    'Antihistamínico',                            50.00, 'Caja x 10',  90),
    ('Atorvastatina 20mg', 'Reductor de colesterol',                     95.00, 'Caja x 30',  80),
    ('Salbutamol',         'Broncodilatador en spray',                  120.00, 'Frasco',      60),
    ('Diclofenaco 75mg',   'Antiinflamatorio y analgésico inyectable',  25.00, 'Ampolleta',  200),
    ('Suero fisiológico',  'Solución isotónica 0.9% NaCl',              30.00, 'Frasco 500ml',300);

GO
PRINT 'Datos de prueba insertados correctamente.';
PRINT 'Credenciales de acceso:';
PRINT '  Recepcionista: recepcion@hospital.com / Hospital123!';
PRINT '  Doctor:        dr.garcia@hospital.com  / Hospital123!';
PRINT '  Paciente:      paciente@test.com        / Hospital123!';

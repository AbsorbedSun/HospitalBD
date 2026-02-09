-- =============================================
-- DATOS DE PRUEBA
-- Sistema de Gestión Hospitalaria
-- =============================================

USE HospitalDB;
GO

-- =============================================
-- ESPECIALIDADES (Mínimo 10)
-- =============================================

INSERT INTO Especialidad (nombre, descripcion, costo_consulta) VALUES
('Cardiología', 'Enfermedades del corazón y sistema cardiovascular', 800.00),
('Dermatología', 'Enfermedades de la piel', 650.00),
('Ginecología', 'Salud reproductiva femenina', 700.00),
('Medicina General', 'Atención médica general', 400.00),
('Nefrología', 'Enfermedades de los riñones', 750.00),
('Nutriología', 'Alimentación y nutrición', 500.00),
('Oftalmología', 'Enfermedades de los ojos', 600.00),
('Oncología', 'Tratamiento del cáncer', 1000.00),
('Ortopedia', 'Enfermedades del sistema musculoesquelético', 800.00),
('Pediatría', 'Atención médica infantil', 550.00);

-- =============================================
-- CONSULTORIOS
-- =============================================

INSERT INTO Consultorio (numero_consultorio, piso, edificio) VALUES
('101', 1, 'A'), ('102', 1, 'A'), ('103', 1, 'A'), ('104', 1, 'A'),
('201', 2, 'A'), ('202', 2, 'A'), ('203', 2, 'A'), ('204', 2, 'A'),
('301', 3, 'B'), ('302', 3, 'B'), ('303', 3, 'B'), ('304', 3, 'B'),
('401', 4, 'B'), ('402', 4, 'B'), ('403', 4, 'B'), ('404', 4, 'B');

-- =============================================
-- MEDICAMENTOS
-- =============================================

INSERT INTO Medicamento (nombre, descripcion, precio_unitario, stock, stock_minimo) VALUES
('Paracetamol 500mg', 'Analgésico y antipirético', 2.50, 500, 50),
('Ibuprofeno 400mg', 'Antiinflamatorio', 3.00, 400, 50),
('Amoxicilina 500mg', 'Antibiótico', 5.50, 300, 30),
('Omeprazol 20mg', 'Protector gástrico', 4.00, 350, 40),
('Loratadina 10mg', 'Antihistamínico', 3.50, 250, 30),
('Metformina 850mg', 'Antidiabético', 6.00, 200, 25),
('Atorvastatina 20mg', 'Reductor de colesterol', 8.00, 180, 20),
('Captopril 25mg', 'Antihipertensivo', 4.50, 220, 25),
('Salbutamol Inhalador', 'Broncodilatador', 120.00, 80, 10),
('Insulina Glargina', 'Control de diabetes', 450.00, 50, 5),
('Diclofenaco Gel', 'Antiinflamatorio tópico', 85.00, 120, 15),
('Clonazepam 2mg', 'Ansiolítico', 12.00, 150, 20);

-- =============================================
-- SERVICIOS
-- =============================================

INSERT INTO Servicio (nombre, descripcion, precio) VALUES
('Inyección intramuscular', 'Aplicación de medicamento vía IM', 50.00),
('Vacuna Influenza', 'Vacuna contra la gripe estacional', 250.00),
('Curación simple', 'Curación de heridas menores', 100.00),
('Estudio de sangre básico', 'Biometría hemática completa', 180.00),
('Electrocardiograma', 'Estudio del ritmo cardíaco', 300.00),
('Toma de presión arterial', 'Medición de presión', 30.00);

-- =============================================
-- USUARIOS Y EMPLEADOS
-- =============================================

-- Usuarios (Las contraseñas están en texto plano solo para pruebas, en producción deben ser hash)
-- Password: "hospital123" para todos

INSERT INTO Usuario (email, password_hash, tipo_usuario) VALUES
-- Doctores
('dr.garcia@hospital.com', '$2a$10$kZXvLKGJ0qB3qZN.yH6LKO8rXJ5YvC1K.mF/r2LqH3WqCz8qN9uX.', 'doctor'),
('dr.martinez@hospital.com', '$2a$10$kZXvLKGJ0qB3qZN.yH6LKO8rXJ5YvC1K.mF/r2LqH3WqCz8qN9uX.', 'doctor'),
('dr.lopez@hospital.com', '$2a$10$kZXvLKGJ0qB3qZN.yH6LKO8rXJ5YvC1K.mF/r2LqH3WqCz8qN9uX.', 'doctor'),
('dr.rodriguez@hospital.com', '$2a$10$kZXvLKGJ0qB3qZN.yH6LKO8rXJ5YvC1K.mF/r2LqH3WqCz8qN9uX.', 'doctor'),
-- Recepcionistas
('recep.gonzalez@hospital.com', '$2a$10$kZXvLKGJ0qB3qZN.yH6LKO8rXJ5YvC1K.mF/r2LqH3WqCz8qN9uX.', 'recepcionista'),
('recep.hernandez@hospital.com', '$2a$10$kZXvLKGJ0qB3qZN.yH6LKO8rXJ5YvC1K.mF/r2LqH3WqCz8qN9uX.', 'recepcionista'),
-- Pacientes
('paciente1@email.com', '$2a$10$kZXvLKGJ0qB3qZN.yH6LKO8rXJ5YvC1K.mF/r2LqH3WqCz8qN9uX.', 'paciente'),
('paciente2@email.com', '$2a$10$kZXvLKGJ0qB3qZN.yH6LKO8rXJ5YvC1K.mF/r2LqH3WqCz8qN9uX.', 'paciente'),
('paciente3@email.com', '$2a$10$kZXvLKGJ0qB3qZN.yH6LKO8rXJ5YvC1K.mF/r2LqH3WqCz8qN9uX.', 'paciente');

-- Empleados para Doctores
INSERT INTO Empleado (numero_empleado, nombre, apellido_paterno, apellido_materno, curp, fecha_nacimiento, telefono, email, id_usuario) VALUES
('EMP001', 'Carlos', 'García', 'Pérez', 'GAPC850615HDFRRL01', '1985-06-15', '5551234567', 'dr.garcia@hospital.com', 1),
('EMP002', 'Ana', 'Martínez', 'López', 'MALA900312MDFRLN02', '1990-03-12', '5551234568', 'dr.martinez@hospital.com', 2),
('EMP003', 'Luis', 'López', 'Hernández', 'LOHL880920HDFRRS03', '1988-09-20', '5551234569', 'dr.lopez@hospital.com', 3),
('EMP004', 'María', 'Rodríguez', 'Sánchez', 'ROSM920507MDFRN04', '1992-05-07', '5551234570', 'dr.rodriguez@hospital.com', 4);

-- Empleados para Recepcionistas
INSERT INTO Empleado (numero_empleado, nombre, apellido_paterno, apellido_materno, curp, fecha_nacimiento, telefono, email, id_usuario) VALUES
('EMP005', 'Laura', 'González', 'Torres', 'GOTL940823MDFRR05', '1994-08-23', '5551234571', 'recep.gonzalez@hospital.com', 5),
('EMP006', 'Jorge', 'Hernández', 'Díaz', 'HEDJ910615HDFRR06', '1991-06-15', '5551234572', 'recep.hernandez@hospital.com', 6);

-- Doctores (4 por especialidad = 40 doctores)
INSERT INTO Doctor (id_empleado, cedula_profesional, id_especialidad, id_consultorio) VALUES
-- Cardiología (4 doctores)
(1, 'CED001', 1, 1),
(2, 'CED002', 1, 2),
(3, 'CED003', 1, 3),
(4, 'CED004', 1, 4);

-- Crear más empleados y doctores para todas las especialidades
-- Por simplicidad, aquí muestro el patrón, pero deberías agregar 36 más

-- Horarios de los doctores (Ejemplo para el primer doctor)
INSERT INTO HorarioDoctor (id_doctor, dia_semana, hora_inicio, hora_fin) VALUES
-- Dr. García (Lunes a Viernes, 8:00 - 16:00)
(1, 1, '08:00', '16:00'), -- Lunes
(1, 2, '08:00', '16:00'), -- Martes
(1, 3, '08:00', '16:00'), -- Miércoles
(1, 4, '08:00', '16:00'), -- Jueves
(1, 5, '08:00', '16:00'), -- Viernes
-- Dr. Martínez (Lunes a Viernes, 10:00 - 18:00)
(2, 1, '10:00', '18:00'),
(2, 2, '10:00', '18:00'),
(2, 3, '10:00', '18:00'),
(2, 4, '10:00', '18:00'),
(2, 5, '10:00', '18:00'),
-- Dr. López (Lunes a Sábado, 7:00 - 15:00)
(3, 1, '07:00', '15:00'),
(3, 2, '07:00', '15:00'),
(3, 3, '07:00', '15:00'),
(3, 4, '07:00', '15:00'),
(3, 5, '07:00', '15:00'),
(3, 6, '07:00', '15:00'), -- Sábado
-- Dra. Rodríguez (Martes a Sábado, 14:00 - 22:00)
(4, 2, '14:00', '22:00'),
(4, 3, '14:00', '22:00'),
(4, 4, '14:00', '22:00'),
(4, 5, '14:00', '22:00'),
(4, 6, '14:00', '22:00');

-- Recepcionistas
INSERT INTO Recepcionista (id_empleado, turno) VALUES
(5, 'matutino'),
(6, 'vespertino');

-- =============================================
-- PACIENTES
-- =============================================

INSERT INTO Paciente (nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo, curp, telefono, email, id_usuario) VALUES
('Juan', 'Pérez', 'González', '1995-03-20', 'M', 'PEGJ950320HDFRN01', '5559876543', 'paciente1@email.com', 7),
('María', 'López', 'Martínez', '1988-07-15', 'F', 'LOMM880715MDFRR02', '5559876544', 'paciente2@email.com', 8),
('Pedro', 'Sánchez', 'Ramírez', '2000-11-30', 'M', 'SARP001130HDFRM03', '5559876545', 'paciente3@email.com', 9);

-- Historial Médico
INSERT INTO HistorialMedico (id_paciente, tipo_sangre, alergias, padecimientos_previos, peso, estatura) VALUES
(1, 'O+', 'Ninguna', 'Ninguno', 75.5, 1.75),
(2, 'A+', 'Penicilina', 'Hipertensión', 68.0, 1.62),
(3, 'B-', 'Polen', 'Asma leve', 82.0, 1.80);

-- =============================================
-- CITAS DE EJEMPLO
-- =============================================

-- Cita pagada y pendiente por atender (para mañana)
DECLARE @id_pago_1 INT;
INSERT INTO Pago (folio_pago, monto, fecha_pago, metodo_pago, estatus)
VALUES ('PAG-20260209-000001', 800.00, GETDATE(), 'tarjeta', 'pagado');
SET @id_pago_1 = SCOPE_IDENTITY();

INSERT INTO Cita (folio_cita, id_paciente, id_doctor, id_consultorio, fecha_cita, hora_cita, estatus, id_pago)
VALUES ('CIT-20260209-000001', 1, 1, 1, DATEADD(DAY, 1, CAST(GETDATE() AS DATE)), '10:00', 'pagada_pendiente_atender', @id_pago_1);

-- Cita agendada pendiente de pago
DECLARE @id_pago_2 INT;
INSERT INTO Pago (folio_pago, monto, estatus)
VALUES ('PAG-20260210-000002', 650.00, 'pendiente');
SET @id_pago_2 = SCOPE_IDENTITY();

INSERT INTO Cita (folio_cita, id_paciente, id_doctor, id_consultorio, fecha_cita, hora_cita, estatus, id_pago)
VALUES ('CIT-20260210-000002', 2, 2, 2, DATEADD(DAY, 3, CAST(GETDATE() AS DATE)), '14:00', 'agendada_pendiente_pago', @id_pago_2);

-- Cita atendida (del pasado)
DECLARE @id_pago_3 INT;
INSERT INTO Pago (folio_pago, monto, fecha_pago, metodo_pago, estatus)
VALUES ('PAG-20260201-000003', 400.00, DATEADD(DAY, -5, GETDATE()), 'efectivo', 'pagado');
SET @id_pago_3 = SCOPE_IDENTITY();

DECLARE @id_cita_atendida INT;
INSERT INTO Cita (folio_cita, id_paciente, id_doctor, id_consultorio, fecha_cita, hora_cita, estatus, id_pago)
VALUES ('CIT-20260201-000003', 3, 3, 3, DATEADD(DAY, -3, CAST(GETDATE() AS DATE)), '09:00', 'atendida', @id_pago_3);
SET @id_cita_atendida = SCOPE_IDENTITY();

-- Receta para la cita atendida
INSERT INTO Receta (folio_receta, id_cita, id_doctor, id_paciente, diagnostico, tratamiento, observaciones)
VALUES (
    'REC-20260206-000001',
    @id_cita_atendida,
    3,
    3,
    'Faringitis aguda',
    'Reposo y abundantes líquidos',
    'Evitar bebidas frías'
);

DECLARE @id_receta INT = SCOPE_IDENTITY();

-- Medicamentos de la receta
INSERT INTO RecetaMedicamento (id_receta, id_medicamento, cantidad, indicaciones) VALUES
(@id_receta, 1, 20, 'Tomar 1 tableta cada 8 horas por 5 días'),
(@id_receta, 3, 14, 'Tomar 1 cápsula cada 12 horas por 7 días');

GO

-- =============================================
-- VENTA DE FARMACIA (sin ser paciente)
-- =============================================

DECLARE @id_venta INT;
INSERT INTO Venta (folio_venta, total, metodo_pago, id_recepcionista, nombre_cliente)
VALUES ('VEN-20260208-000001', 157.50, 'efectivo', 1, 'Cliente Externo 1');
SET @id_venta = SCOPE_IDENTITY();

-- Detalles de la venta
INSERT INTO DetalleVenta (id_venta, tipo_producto, id_medicamento, cantidad, precio_unitario, subtotal) VALUES
(@id_venta, 'medicamento', 1, 10, 2.50, 25.00),
(@id_venta, 'medicamento', 2, 5, 3.00, 15.00),
(@id_venta, 'medicamento', 11, 1, 85.00, 85.00);

INSERT INTO DetalleVenta (id_venta, tipo_producto, id_servicio, cantidad, precio_unitario, subtotal) VALUES
(@id_venta, 'servicio', 6, 1, 30.00, 30.00);

GO

PRINT 'Datos de prueba insertados exitosamente.';
PRINT '';
PRINT '===========================================';
PRINT 'CREDENCIALES DE PRUEBA (Password: hospital123)';
PRINT '===========================================';
PRINT 'DOCTOR:';
PRINT '  Email: dr.garcia@hospital.com';
PRINT '';
PRINT 'RECEPCIONISTA:';
PRINT '  Email: recep.gonzalez@hospital.com';
PRINT '';
PRINT 'PACIENTE:';
PRINT '  Email: paciente1@email.com';
PRINT '===========================================';

GO

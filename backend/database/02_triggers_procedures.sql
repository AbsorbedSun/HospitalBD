-- =============================================
-- TRIGGERS Y PROCEDIMIENTOS ALMACENADOS
-- Sistema de Gestión Hospitalaria
-- =============================================

USE HospitalDB;
GO

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger: Actualizar límite de pago al crear una cita
CREATE OR ALTER TRIGGER trg_SetLimitePago
ON Cita
AFTER INSERT
AS
BEGIN
    UPDATE Cita
    SET limite_pago = DATEADD(HOUR, 8, fecha_agendada)
    WHERE id_cita IN (SELECT id_cita FROM inserted);
END;
GO

-- Trigger: Registrar cambios de estatus en bitácora
CREATE OR ALTER TRIGGER trg_BitacoraEstatusCita
ON Cita
AFTER UPDATE
AS
BEGIN
    IF UPDATE(estatus)
    BEGIN
        INSERT INTO BitacoraEstatusCita (
            folio_cita, fecha_movimiento, estatus_cita, fecha_cita,
            id_especialidad, costo, politica_cancelacion, monto_devuelto
        )
        SELECT 
            i.folio_cita,
            GETDATE(),
            i.estatus,
            i.fecha_cita,
            d.id_especialidad,
            e.costo_consulta,
            CASE 
                WHEN DATEDIFF(HOUR, GETDATE(), i.fecha_cita) >= 48 THEN '100%'
                WHEN DATEDIFF(HOUR, GETDATE(), i.fecha_cita) >= 24 THEN '50%'
                ELSE '0%'
            END,
            CASE 
                WHEN i.estatus LIKE 'cancelada%' THEN
                    CASE 
                        WHEN DATEDIFF(HOUR, GETDATE(), i.fecha_cita) >= 48 THEN p.monto
                        WHEN DATEDIFF(HOUR, GETDATE(), i.fecha_cita) >= 24 THEN p.monto * 0.5
                        ELSE 0
                    END
                ELSE 0
            END
        FROM inserted i
        INNER JOIN Doctor d ON i.id_doctor = d.id_doctor
        INNER JOIN Especialidad e ON d.id_especialidad = e.id_especialidad
        LEFT JOIN Pago p ON i.id_pago = p.id_pago;
    END
END;
GO

-- Trigger: Cancelar cita por falta de pago
CREATE OR ALTER TRIGGER trg_CancelarCitaFaltaPago
ON Cita
AFTER INSERT, UPDATE
AS
BEGIN
    UPDATE Cita
    SET estatus = 'cancelada_falta_pago'
    WHERE estatus = 'agendada_pendiente_pago'
    AND GETDATE() > limite_pago
    AND id_pago IS NULL;
END;
GO

-- Trigger: Actualizar stock de medicamentos en ventas
CREATE OR ALTER TRIGGER trg_ActualizarStockMedicamento
ON DetalleVenta
AFTER INSERT
AS
BEGIN
    UPDATE m
    SET m.stock = m.stock - i.cantidad
    FROM Medicamento m
    INNER JOIN inserted i ON m.id_medicamento = i.id_medicamento
    WHERE i.tipo_producto = 'medicamento';
END;
GO

-- =============================================
-- PROCEDIMIENTOS ALMACENADOS
-- =============================================

-- SP: Agendar una nueva cita
CREATE OR ALTER PROCEDURE sp_AgendarCita
    @id_paciente INT,
    @id_doctor INT,
    @fecha_cita DATE,
    @hora_cita TIME,
    @resultado INT OUTPUT,
    @mensaje VARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @id_consultorio INT;
    DECLARE @id_especialidad INT;
    DECLARE @folio_cita VARCHAR(50);
    DECLARE @folio_pago VARCHAR(50);
    DECLARE @costo DECIMAL(10,2);
    DECLARE @id_pago INT;
    DECLARE @id_cita INT;
    DECLARE @dia_semana INT;
    
    -- Validaciones
    
    -- 1. Validar que la cita sea mínimo 48 horas y máximo 3 meses
    IF DATEDIFF(HOUR, GETDATE(), CAST(@fecha_cita AS DATETIME) + CAST(@hora_cita AS DATETIME)) < 48
    BEGIN
        SET @resultado = 0;
        SET @mensaje = 'La cita debe agendarse con mínimo 48 horas de anticipación';
        RETURN;
    END
    
    IF DATEDIFF(MONTH, GETDATE(), @fecha_cita) > 3
    BEGIN
        SET @resultado = 0;
        SET @mensaje = 'No se pueden agendar citas con más de 3 meses de anticipación';
        RETURN;
    END
    
    -- 2. Validar que no sea fecha pasada
    IF @fecha_cita < CAST(GETDATE() AS DATE)
    BEGIN
        SET @resultado = 0;
        SET @mensaje = 'No se pueden agendar citas con fecha pasada';
        RETURN;
    END
    
    -- 3. Obtener consultorio y especialidad del doctor
    SELECT @id_consultorio = id_consultorio, @id_especialidad = id_especialidad
    FROM Doctor
    WHERE id_doctor = @id_doctor;
    
    IF @id_consultorio IS NULL
    BEGIN
        SET @resultado = 0;
        SET @mensaje = 'El doctor no tiene consultorio asignado';
        RETURN;
    END
    
    -- 4. Validar horario laboral del doctor
    SET @dia_semana = DATEPART(WEEKDAY, @fecha_cita);
    
    IF NOT EXISTS (
        SELECT 1 FROM HorarioDoctor
        WHERE id_doctor = @id_doctor
        AND dia_semana = @dia_semana
        AND @hora_cita BETWEEN hora_inicio AND hora_fin
        AND activo = 1
    )
    BEGIN
        SET @resultado = 0;
        SET @mensaje = 'El horario seleccionado está fuera del horario laboral del doctor';
        RETURN;
    END
    
    -- 5. Validar que el doctor no tenga otra cita en ese horario
    IF EXISTS (
        SELECT 1 FROM Cita
        WHERE id_doctor = @id_doctor
        AND fecha_cita = @fecha_cita
        AND hora_cita = @hora_cita
        AND estatus NOT IN ('cancelada_falta_pago', 'cancelada_paciente', 'cancelada_doctor')
    )
    BEGIN
        SET @resultado = 0;
        SET @mensaje = 'El doctor ya tiene una cita agendada en ese horario';
        RETURN;
    END
    
    -- 6. Validar que el paciente no tenga cita pendiente con el mismo doctor
    IF EXISTS (
        SELECT 1 FROM Cita
        WHERE id_paciente = @id_paciente
        AND id_doctor = @id_doctor
        AND estatus IN ('agendada_pendiente_pago', 'pagada_pendiente_atender')
    )
    BEGIN
        SET @resultado = 0;
        SET @mensaje = 'Ya tienes una cita pendiente con este doctor. Cancélala para agendar una nueva.';
        RETURN;
    END
    
    -- Generar folios únicos
    SET @folio_cita = 'CIT-' + FORMAT(GETDATE(), 'yyyyMMdd') + '-' + RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS VARCHAR), 6);
    SET @folio_pago = 'PAG-' + FORMAT(GETDATE(), 'yyyyMMdd') + '-' + RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS VARCHAR), 6);
    
    -- Obtener costo de la especialidad
    SELECT @costo = costo_consulta
    FROM Especialidad
    WHERE id_especialidad = @id_especialidad;
    
    -- Crear el pago
    INSERT INTO Pago (folio_pago, monto, estatus)
    VALUES (@folio_pago, @costo, 'pendiente');
    
    SET @id_pago = SCOPE_IDENTITY();
    
    -- Crear la cita
    INSERT INTO Cita (
        folio_cita, id_paciente, id_doctor, id_consultorio,
        fecha_cita, hora_cita, estatus, id_pago
    )
    VALUES (
        @folio_cita, @id_paciente, @id_doctor, @id_consultorio,
        @fecha_cita, @hora_cita, 'agendada_pendiente_pago', @id_pago
    );
    
    SET @id_cita = SCOPE_IDENTITY();
    
    SET @resultado = @id_cita;
    SET @mensaje = 'Cita agendada exitosamente. Folio: ' + @folio_cita + ' | Línea de pago: ' + @folio_pago;
END;
GO

-- SP: Cancelar cita con política de cancelación
CREATE OR ALTER PROCEDURE sp_CancelarCita
    @folio_cita VARCHAR(50),
    @motivo_cancelacion VARCHAR(200),
    @tipo_cancelacion VARCHAR(20), -- 'paciente' o 'doctor'
    @resultado INT OUTPUT,
    @mensaje VARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @id_cita INT;
    DECLARE @id_pago INT;
    DECLARE @fecha_cita DATETIME;
    DECLARE @estatus VARCHAR(50);
    DECLARE @monto DECIMAL(10,2);
    DECLARE @monto_devolver DECIMAL(10,2);
    DECLARE @horas_anticipacion INT;
    
    -- Obtener información de la cita
    SELECT 
        @id_cita = id_cita,
        @id_pago = id_pago,
        @fecha_cita = CAST(fecha_cita AS DATETIME) + CAST(hora_cita AS DATETIME),
        @estatus = estatus
    FROM Cita
    WHERE folio_cita = @folio_cita;
    
    IF @id_cita IS NULL
    BEGIN
        SET @resultado = 0;
        SET @mensaje = 'Cita no encontrada';
        RETURN;
    END
    
    -- Validar que la cita pueda ser cancelada
    IF @estatus IN ('atendida', 'cancelada_falta_pago', 'cancelada_paciente', 'cancelada_doctor')
    BEGIN
        SET @resultado = 0;
        SET @mensaje = 'Esta cita no puede ser cancelada';
        RETURN;
    END
    
    -- Calcular horas de anticipación
    SET @horas_anticipacion = DATEDIFF(HOUR, GETDATE(), @fecha_cita);
    
    -- Aplicar política de cancelación
    IF @tipo_cancelacion = 'doctor'
    BEGIN
        -- Doctor cancela: reembolso 100%
        SET @monto_devolver = @monto;
        UPDATE Cita
        SET estatus = 'cancelada_doctor',
            motivo_cancelacion = @motivo_cancelacion,
            fecha_cancelacion = GETDATE()
        WHERE id_cita = @id_cita;
    END
    ELSE -- cancelación por paciente
    BEGIN
        IF @horas_anticipacion >= 48
            SET @monto_devolver = @monto; -- 100%
        ELSE IF @horas_anticipacion >= 24
            SET @monto_devolver = @monto * 0.5; -- 50%
        ELSE
            SET @monto_devolver = 0; -- 0%
            
        UPDATE Cita
        SET estatus = 'cancelada_paciente',
            motivo_cancelacion = @motivo_cancelacion,
            fecha_cancelacion = GETDATE()
        WHERE id_cita = @id_cita;
    END
    
    -- Actualizar pago si existe
    IF @id_pago IS NOT NULL
    BEGIN
        SELECT @monto = monto FROM Pago WHERE id_pago = @id_pago;
        
        UPDATE Pago
        SET estatus = 'reembolsado',
            monto_reembolsado = @monto_devolver
        WHERE id_pago = @id_pago;
    END
    
    SET @resultado = 1;
    SET @mensaje = 'Cita cancelada. Monto a reembolsar: $' + CAST(@monto_devolver AS VARCHAR);
END;
GO

-- SP: Confirmar pago de cita
CREATE OR ALTER PROCEDURE sp_ConfirmarPago
    @folio_pago VARCHAR(50),
    @metodo_pago VARCHAR(20),
    @resultado INT OUTPUT,
    @mensaje VARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @id_pago INT;
    DECLARE @id_cita INT;
    
    SELECT @id_pago = id_pago
    FROM Pago
    WHERE folio_pago = @folio_pago;
    
    IF @id_pago IS NULL
    BEGIN
        SET @resultado = 0;
        SET @mensaje = 'Folio de pago no encontrado';
        RETURN;
    END
    
    -- Actualizar pago
    UPDATE Pago
    SET fecha_pago = GETDATE(),
        metodo_pago = @metodo_pago,
        estatus = 'pagado'
    WHERE id_pago = @id_pago;
    
    -- Actualizar cita
    UPDATE Cita
    SET estatus = 'pagada_pendiente_atender'
    WHERE id_pago = @id_pago;
    
    SET @resultado = 1;
    SET @mensaje = 'Pago confirmado exitosamente';
END;
GO

-- SP: Obtener citas disponibles de un doctor
CREATE OR ALTER PROCEDURE sp_ObtenerHorariosDisponibles
    @id_doctor INT,
    @fecha_inicio DATE,
    @fecha_fin DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Obtener horarios laborales del doctor
    SELECT 
        dia_semana,
        hora_inicio,
        hora_fin
    FROM HorarioDoctor
    WHERE id_doctor = @id_doctor
    AND activo = 1;
    
    -- Obtener citas ya agendadas
    SELECT 
        fecha_cita,
        hora_cita
    FROM Cita
    WHERE id_doctor = @id_doctor
    AND fecha_cita BETWEEN @fecha_inicio AND @fecha_fin
    AND estatus NOT IN ('cancelada_falta_pago', 'cancelada_paciente', 'cancelada_doctor');
END;
GO

-- SP: Crear receta médica
CREATE OR ALTER PROCEDURE sp_CrearReceta
    @id_cita INT,
    @diagnostico VARCHAR(500),
    @tratamiento VARCHAR(500),
    @observaciones VARCHAR(500),
    @medicamentos NVARCHAR(MAX), -- JSON con medicamentos
    @resultado INT OUTPUT,
    @mensaje VARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @folio_receta VARCHAR(50);
    DECLARE @id_receta INT;
    DECLARE @id_doctor INT;
    DECLARE @id_paciente INT;
    
    -- Obtener datos de la cita
    SELECT @id_doctor = id_doctor, @id_paciente = id_paciente
    FROM Cita
    WHERE id_cita = @id_cita;
    
    -- Generar folio
    SET @folio_receta = 'REC-' + FORMAT(GETDATE(), 'yyyyMMdd') + '-' + RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS VARCHAR), 6);
    
    -- Crear receta
    INSERT INTO Receta (folio_receta, id_cita, id_doctor, id_paciente, diagnostico, tratamiento, observaciones)
    VALUES (@folio_receta, @id_cita, @id_doctor, @id_paciente, @diagnostico, @tratamiento, @observaciones);
    
    SET @id_receta = SCOPE_IDENTITY();
    
    -- Actualizar cita a atendida
    UPDATE Cita
    SET estatus = 'atendida'
    WHERE id_cita = @id_cita;
    
    SET @resultado = @id_receta;
    SET @mensaje = 'Receta creada exitosamente. Folio: ' + @folio_receta;
END;
GO

PRINT 'Triggers y procedimientos almacenados creados exitosamente.';
GO

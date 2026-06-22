-- ============================================================
-- STORED PROCEDURES — HospitalDB
--
-- Archivo consolidado. Contiene el Stored Procedure que vivía
-- mezclado dentro de triggers_y_procedure.sql, separado aquí
-- para que cada archivo tenga una sola responsabilidad
-- (triggers.sql vs procedures.sql).
--
-- Ejecutar DESPUÉS de schema.sql y seed.sql.
-- ============================================================

USE HospitalDB;
GO

-- ============================================================
-- SP_RegistrarPagoCita
-- Registra el pago de una cita.
--
-- Actualiza el registro de Pago que ya existe en estado
-- 'Pendiente' (creado al agendar la cita) a 'Pagado'.
-- Si no existe ningún pago pendiente para esa cita, lo crea.
-- ============================================================
CREATE OR ALTER PROCEDURE SP_RegistrarPagoCita
    @Folio_Cita     INT,
    @MetodoPago     VARCHAR(50),
    @Monto          DECIMAL(10,2)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM Cita WHERE Folio_Cita = @Folio_Cita)
    BEGIN
        RAISERROR('La cita especificada no existe.', 16, 1);
        RETURN;
    END

    IF EXISTS (
        SELECT 1 FROM Pago
        WHERE Folio_Cita = @Folio_Cita AND Estado = 'Pagado'
    )
    BEGIN
        RAISERROR('Esta cita ya tiene un pago registrado.', 16, 1);
        RETURN;
    END

    IF EXISTS (
        SELECT 1 FROM Pago
        WHERE Folio_Cita = @Folio_Cita AND Estado = 'Pendiente'
    )
    BEGIN
        -- Ya existe un pago pendiente (creado al agendar) → lo actualizamos
        UPDATE Pago
        SET MetodoPago = @MetodoPago,
            Monto       = @Monto,
            Estado      = 'Pagado',
            FechaPago   = GETDATE()
        WHERE Folio_Cita = @Folio_Cita AND Estado = 'Pendiente';
    END
    ELSE
    BEGIN
        -- No existía ningún pago previo → se crea uno nuevo
        INSERT INTO Pago (Folio_Cita, MetodoPago, Monto, Estado)
        VALUES (@Folio_Cita, @MetodoPago, @Monto, 'Pagado');
    END

    PRINT 'Pago registrado exitosamente.';
END;
GO

PRINT 'Stored Procedure SP_RegistrarPagoCita creado exitosamente.';
GO

-- ============================================================
-- SP_CancelarCitaPaciente
-- Cancela una cita por solicitud del propio paciente.
--
-- Valida:
--   - Que la cita exista y pertenezca al paciente indicado.
--   - Que el estatus actual permita la cancelación.
--
-- Ejecuta en una sola transacción:
--   1. Actualiza Cita → estatus 'cancelada_paciente'.
--   2. Marca el Pago como 'Cancelado' con el monto de devolución
--      calculado por FN_MontoDevolucion (política: >= 48 h → 100%,
--      >= 24 h → 50%, < 24 h → 0%).
--   3. Inserta en Bitacora_EstatusCita con la etiqueta de política
--      y el monto devuelto correctos.
--      (TRG_Cita_Update ya no escribe en bitácora para evitar
--      registros duplicados — ver triggers.sql para el detalle.)
--
-- Uso desde Python:
--   cursor.execute(
--       "EXEC SP_CancelarCitaPaciente @Folio_Cita = ?, @Id_Paciente = ?",
--       (folio_cita, id_paciente)
--   )
-- ============================================================
CREATE OR ALTER PROCEDURE SP_CancelarCitaPaciente
    @Folio_Cita  INT,
    @Id_Paciente INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Id_EstatusCita_Cancelada INT;
    DECLARE @MontoDevolucion          DECIMAL(10,2);
    DECLARE @EstClaveActual           VARCHAR(50);
    DECLARE @PoliticaLabel            VARCHAR(10);
    DECLARE @HorasAntes               INT;
    DECLARE @FechaCita                DATE;
    DECLARE @HoraCita                 TIME;
    DECLARE @Id_Especialidad          INT;
    DECLARE @Costo                    DECIMAL(10,2);

    -- 1. Validar que la cita existe y pertenece al paciente
    IF NOT EXISTS (
        SELECT 1 FROM Cita
        WHERE Folio_Cita = @Folio_Cita AND Id_Paciente = @Id_Paciente
    )
    BEGIN
        RAISERROR('Cita no encontrada o no pertenece al paciente.', 16, 1);
        RETURN;
    END

    -- 2. Obtener datos de la cita y la especialidad
    SELECT @EstClaveActual  = EC.Clave,
           @FechaCita       = C.Fecha_Cita,
           @HoraCita        = C.Hora_Cita,
           @Id_Especialidad = D.Id_Especialidad,
           @Costo           = E.Precio
    FROM   Cita C
    JOIN   EstatusCita  EC ON EC.Id_EstatusCita = C.Id_EstatusCita
    JOIN   Doctor       D  ON D.Id_Doctor        = C.Id_Doctor
    JOIN   Especialidad E  ON E.Id_Especialidad  = D.Id_Especialidad
    WHERE  C.Folio_Cita = @Folio_Cita;

    -- 3. Validar que el estatus permite cancelar
    IF @EstClaveActual NOT IN ('agendada_pendiente_pago', 'pagada_pendiente_atender')
    BEGIN
        RAISERROR('Esta cita no puede cancelarse en su estado actual.', 16, 1);
        RETURN;
    END

    -- 4. Calcular monto de devolución usando la función existente del hospital
    SET @MontoDevolucion = dbo.FN_MontoDevolucion(@Folio_Cita, GETDATE());

    -- 5. Determinar etiqueta de política según horas de anticipación
    SET @HorasAntes = DATEDIFF(
        hour,
        GETDATE(),
        CAST(@FechaCita AS DATETIME) + CAST(@HoraCita AS DATETIME)
    );
    SET @PoliticaLabel = CASE
        WHEN @HorasAntes >= 48 THEN '100%'
        WHEN @HorasAntes >= 24 THEN '50%'
        ELSE                        '0%'
    END;

    -- 6. Obtener el Id del nuevo estatus
    SELECT @Id_EstatusCita_Cancelada = Id_EstatusCita
    FROM   EstatusCita
    WHERE  Clave = 'cancelada_paciente';

    BEGIN TRY
        BEGIN TRANSACTION;

            -- Cancelar la cita
            -- (TRG_Cita_Update se dispara pero ya no escribe en Bitacora_EstatusCita)
            UPDATE Cita
            SET    Id_EstatusCita = @Id_EstatusCita_Cancelada
            WHERE  Folio_Cita = @Folio_Cita;

            -- Registrar devolución en el pago (solo si estaba Pagado)
            UPDATE Pago
            SET    Estado        = 'Cancelado',
                   MontoDevuelto = @MontoDevolucion
            WHERE  Folio_Cita = @Folio_Cita
              AND  Estado     = 'Pagado';

            -- Insertar en bitácora con política y monto correctos
            INSERT INTO Bitacora_EstatusCita
                (Folio_Cita, Estatus_Cita, Fecha_Cita, Id_Especialidad,
                 Costo, Politica_Cancela, Monto_Devuelto)
            VALUES
                (@Folio_Cita, 'cancelada_paciente', @FechaCita, @Id_Especialidad,
                 @Costo, @PoliticaLabel, @MontoDevolucion);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH

    PRINT 'Cita cancelada exitosamente.';
END;
GO

PRINT 'Stored Procedure SP_CancelarCitaPaciente creado exitosamente.';
GO

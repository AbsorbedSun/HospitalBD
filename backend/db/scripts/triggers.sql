-- ============================================================
-- TRIGGERS — HospitalDB
--
-- Archivo consolidado. Reemplaza a los siguientes archivos
-- (su contenido fue fusionado aquí, en un único lugar):
--   - trigger_.sql
--   - trigger_solicitud_cancelacion.sql
--   - triggers_y_procedure.sql   (solo la parte de triggers;
--     el Stored Procedure que contenía se movió a procedures.sql)
--
-- Ejecutar DESPUÉS de schema.sql y seed.sql (las tablas y los
-- catálogos deben existir antes de crear los triggers).
-- ============================================================

USE HospitalDB;
GO

-- ============================================================
-- TRIGGER 1 (INSERT) — TRG_Cita_Insert
-- Se agenda una cita nueva.
-- Registra el alta en Bitacora_HistorialCitas.
-- ============================================================
CREATE OR ALTER TRIGGER TRG_Cita_Insert
ON Cita
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Bitacora_HistorialCitas (
        Usuario, Rol_Usuario, Folio_Cita, Fecha_Cita, Hora_Cita,
        Id_Paciente, Folio_Receta, Id_Doctor, Estatus_Consulta,
        Especialidad, Id_Consultorio
    )
    SELECT
        CONCAT(U.Nombre, ' ', U.Ap_Paterno, ' ', ISNULL(U.Ap_Materno, '')) AS Usuario,
        'Paciente' AS Rol_Usuario,
        I.Folio_Cita,
        I.Fecha_Cita,
        I.Hora_Cita,
        I.Id_Paciente,
        NULL AS Folio_Receta,
        I.Id_Doctor,
        EC.Descripcion AS Estatus_Consulta,
        ESP.Especialidad,
        I.Id_Consultorio
    FROM inserted I
    INNER JOIN Paciente P       ON P.Id_Paciente = I.Id_Paciente
    INNER JOIN Usuario U        ON U.Id_Usuario = P.Id_Usuario
    INNER JOIN Doctor D         ON D.Id_Doctor = I.Id_Doctor
    INNER JOIN Especialidad ESP ON ESP.Id_Especialidad = D.Id_Especialidad
    INNER JOIN EstatusCita EC   ON EC.Id_EstatusCita = I.Id_EstatusCita;
END;
GO

PRINT 'Trigger TRG_Cita_Insert creado exitosamente.';
GO

-- ============================================================
-- TRIGGER 2 (UPDATE) — TRG_Cita_Update
-- Se dispara al cambiar cualquier campo de la tabla Cita.
--
-- NOTA DE DISEÑO: La inserción en Bitacora_EstatusCita se realiza
-- de forma EXPLÍCITA en cada llamador (Python _cambiar_estatus,
-- confirmar_pago, SP_CancelarCitaPaciente y el trigger
-- TRG_SolicitudCancelacion_Aprobada) para poder incluir los
-- campos Politica_Cancela y Monto_Devuelto con valores correctos.
-- Si el trigger también insertara, se generarían registros duplicados
-- (uno con NULL/0 del trigger + uno completo del llamador).
-- Este trigger se conserva como punto de extensión futura.
-- ============================================================
CREATE OR ALTER TRIGGER TRG_Cita_Update
ON Cita
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    -- Extensión futura: agregar aquí validaciones o efectos secundarios
    -- que no requieran escribir en Bitacora_EstatusCita.
END;
GO

PRINT 'Trigger TRG_Cita_Update creado exitosamente.';
GO

-- ============================================================
-- TRIGGER 3 (DELETE) — TRG_Cita_Delete
-- Se elimina una cita.
-- Registra la baja en Bitacora_HistorialCitas con estatus "Eliminada".
-- ============================================================
CREATE OR ALTER TRIGGER TRG_Cita_Delete
ON Cita
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Bitacora_HistorialCitas (
        Usuario, Rol_Usuario, Folio_Cita, Fecha_Cita, Hora_Cita,
        Id_Paciente, Folio_Receta, Id_Doctor, Estatus_Consulta,
        Especialidad, Id_Consultorio
    )
    SELECT
        CONCAT(U.Nombre, ' ', U.Ap_Paterno, ' ', ISNULL(U.Ap_Materno, '')) AS Usuario,
        'Paciente' AS Rol_Usuario,
        D.Folio_Cita,
        D.Fecha_Cita,
        D.Hora_Cita,
        D.Id_Paciente,
        NULL AS Folio_Receta,
        D.Id_Doctor,
        'Eliminada' AS Estatus_Consulta,
        ESP.Especialidad,
        D.Id_Consultorio
    FROM deleted D
    INNER JOIN Paciente P        ON P.Id_Paciente = D.Id_Paciente
    INNER JOIN Usuario U         ON U.Id_Usuario = P.Id_Usuario
    INNER JOIN Doctor DOC        ON DOC.Id_Doctor = D.Id_Doctor
    INNER JOIN Especialidad ESP  ON ESP.Id_Especialidad = DOC.Id_Especialidad;
END;
GO

PRINT 'Trigger TRG_Cita_Delete creado exitosamente.';
GO

-- ============================================================
-- TRIGGER 4 (UPDATE) — TRG_SolicitudCancelacion_Aprobada
--
-- Se dispara cuando la Recepcionista aprueba una solicitud de
-- cancelación creada por el Doctor (cambia Estatus de
-- 'Pendiente' a 'Aprobada' en SolicitudCancelacion).
--
-- Qué hace automáticamente:
--   1. Cambia el estatus de la Cita a 'cancelada_doctor'
--   2. Marca el Pago como 'Cancelado' con reembolso del 100%
--      (el paciente no tiene culpa, fue decisión del doctor)
--   3. Registra el movimiento en Bitacora_EstatusCita
--
-- NOTA: usa una tabla temporal (#Aprobadas) en lugar de un CURSOR
-- porque es más simple de leer y suficiente para este caso, ya
-- que normalmente se aprueba una solicitud a la vez desde la página.
--
-- NOTA DE INTEGRACIÓN: el endpoint Flask
-- POST /api/recepcionistas/solicitudes-cancelacion/<id>/aprobar
-- solo necesita hacer el UPDATE de SolicitudCancelacion.Estatus;
-- este trigger se encarga del resto en cascada.
-- ============================================================
CREATE OR ALTER TRIGGER TRG_SolicitudCancelacion_Aprobada
ON SolicitudCancelacion
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Solo actuar si el campo Estatus cambió
    IF NOT UPDATE(Estatus) RETURN;

    -- Identificar las solicitudes que ACABAN de quedar en 'Aprobada'
    -- (antes eran otra cosa, ahora son 'Aprobada')
    SELECT
        I.Folio_Cita,
        D.Id_Especialidad,
        ESP.Precio
    INTO #Aprobadas
    FROM inserted I
    INNER JOIN deleted DEL      ON DEL.Id_Solicitud = I.Id_Solicitud
    INNER JOIN Doctor D         ON D.Id_Doctor = I.Id_Doctor
    INNER JOIN Especialidad ESP ON ESP.Id_Especialidad = D.Id_Especialidad
    WHERE I.Estatus = 'Aprobada' AND DEL.Estatus <> 'Aprobada';

    IF NOT EXISTS (SELECT 1 FROM #Aprobadas)
    BEGIN
        DROP TABLE #Aprobadas;
        RETURN;
    END

    -- 1. Cancelar las citas correspondientes
    UPDATE C
    SET C.Id_EstatusCita = (SELECT Id_EstatusCita FROM EstatusCita WHERE Clave = 'cancelada_doctor')
    FROM Cita C
    INNER JOIN #Aprobadas A ON A.Folio_Cita = C.Folio_Cita;

    -- 2. Marcar los pagos como cancelados con reembolso del 100%
    UPDATE P
    SET P.Estado = 'Cancelado',
        P.MontoDevuelto = P.Monto
    FROM Pago P
    INNER JOIN #Aprobadas A ON A.Folio_Cita = P.Folio_Cita
    WHERE P.Estado = 'Pagado';

    -- 3. Registrar en la bitácora de estatus
    INSERT INTO Bitacora_EstatusCita (
        Folio_Cita, Estatus_Cita, Fecha_Cita, Id_Especialidad,
        Costo, Politica_Cancela, Monto_Devuelto
    )
    SELECT
        C.Folio_Cita, 'cancelada_doctor', C.Fecha_Cita, A.Id_Especialidad,
        A.Precio, '100% (cancelación por doctor)', A.Precio
    FROM Cita C
    INNER JOIN #Aprobadas A ON A.Folio_Cita = C.Folio_Cita;

    DROP TABLE #Aprobadas;
END;
GO

PRINT 'Trigger TRG_SolicitudCancelacion_Aprobada creado exitosamente.';
GO

-- ============================================================
-- TRIGGER 5 (INSERT) — TR_DetalleVenta_DescontarStock
-- Al vender un medicamento, descuenta automáticamente el Stock
-- en Medicamentos. Valida que haya stock suficiente antes.
-- ============================================================
CREATE OR ALTER TRIGGER dbo.TR_DetalleVenta_DescontarStock
ON Detalle_Venta
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM inserted WHERE Id_Medicamento IS NOT NULL)
        RETURN;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN Medicamentos m ON m.Id_Medicamento = i.Id_Medicamento
        WHERE i.Id_Medicamento IS NOT NULL
          AND m.Stock < i.Cantidad
    )
    BEGIN
        RAISERROR('Stock insuficiente para uno o más medicamentos vendidos.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    UPDATE m
    SET m.Stock = m.Stock - i.Cantidad
    FROM Medicamentos m
    JOIN inserted i ON m.Id_Medicamento = i.Id_Medicamento
    WHERE i.Id_Medicamento IS NOT NULL;
END;
GO

PRINT 'Trigger TR_DetalleVenta_DescontarStock creado exitosamente.';
GO

-- ============================================================
-- TRIGGER 6 (DELETE) — TR_DetalleSolicitudCompra_RestaurarSubtotal
-- Al borrar una línea de Detalle_SolicitudCompra, recalcula
-- el Total de la SolicitudCompra restando ese subtotal.
-- ============================================================
CREATE OR ALTER TRIGGER dbo.TR_DetalleSolicitudCompra_RestaurarSubtotal
ON Detalle_SolicitudCompra
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE sc
    SET sc.Total = sc.Total - de.SubtotalSum
    FROM SolicitudCompra sc
    JOIN (
        SELECT Id_Solicitud, SUM(Subtotal) AS SubtotalSum
        FROM deleted
        GROUP BY Id_Solicitud
    ) de ON de.Id_Solicitud = sc.Id_Solicitud;
END;
GO

PRINT 'Trigger TR_DetalleSolicitudCompra_RestaurarSubtotal creado exitosamente.';
GO

PRINT '======================================================';
PRINT ' Los 6 triggers de HospitalDB se crearon exitosamente.';
PRINT '======================================================';
GO

-- ============================================================
-- GUÍA DE PRUEBAS MANUALES (referencia, no se ejecuta)
-- Se conservan aquí a modo de documentación los pasos de
-- verificación que existían sueltos en los 3 archivos originales.
-- ============================================================

-- ── Prueba TR_DetalleVenta_DescontarStock ──────────────────
-- 1. Anota el stock actual:
--    SELECT Id_Medicamento, Nombre, Stock FROM Medicamentos WHERE Nombre = 'Ibuprofeno 400mg';
-- 2. Realiza una venta desde el sistema (módulo de Farmacia).
-- 3. Verifica que el stock bajó:
--    SELECT Id_Medicamento, Nombre, Stock FROM Medicamentos WHERE Id_Medicamento = <id>;

-- ── Prueba TR_DetalleSolicitudCompra_RestaurarSubtotal ─────
-- 1. Crea una solicitud de compra con al menos 2 artículos.
-- 2. Anota el Id_Solicitud y Total iniciales:
--    SELECT * FROM SolicitudCompra ORDER BY Id_Solicitud DESC;
--    SELECT * FROM Detalle_SolicitudCompra;
-- 3. Borra una línea del detalle (usa un Id_Detalle real de tu BD):
--    DELETE FROM Detalle_SolicitudCompra WHERE Id_Detalle = <id>;
-- 4. Verifica que el total se recalculó solo:
--    SELECT Id_Solicitud, Total FROM SolicitudCompra WHERE Id_Solicitud = <id>;

-- ── Prueba TRG_SolicitudCancelacion_Aprobada ───────────────
-- 1. El doctor crea una solicitud de cancelación (Estatus queda 'Pendiente' por default):
--    INSERT INTO SolicitudCancelacion (Folio_Cita, Id_Doctor, Motivo)
--    VALUES (3, 8, 'Emergencia médica, no podré atender la cita');
-- 2. La recepcionista aprueba (esto DISPARA el trigger automáticamente):
--    UPDATE SolicitudCancelacion
--    SET Estatus = 'Aprobada', Id_Recepcionista = 1, Fecha_Resolucion = GETDATE()
--    WHERE Id_Solicitud = 1;
-- 3. Verifica que la cita se canceló y el pago se reembolsó:
--    SELECT * FROM Cita WHERE Folio_Cita = 3;
--    SELECT * FROM Pago WHERE Folio_Cita = 3;
--    SELECT * FROM Bitacora_EstatusCita WHERE Folio_Cita = 3 ORDER BY Id_Registro DESC;

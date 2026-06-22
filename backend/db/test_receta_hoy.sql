-- ============================================================
-- SCRIPT DE PRUEBA: Cita para HOY → probar emisión de receta
-- Corregido: Solicitud_Cita se pone 3 días atrás para
-- cumplir CK_Cita_FechaMinima (Fecha_Cita >= Solicitud + 48h)
-- ============================================================
USE HospitalDB;
GO

-- ── PASO 1: Ver IDs disponibles ──────────────────────────────
SELECT TOP 5
    d.Id_Doctor,
    u.Nombre + ' ' + u.Ap_Paterno AS Doctor,
    e.Especialidad
FROM Doctor d
JOIN Usuario      u  ON d.Id_Usuario     = u.Id_Usuario
JOIN Especialidad e  ON d.Id_Especialidad = e.Id_Especialidad
JOIN Empleado     em ON em.Id_Usuario    = u.Id_Usuario
WHERE em.Estatus_empleado = 'Activo';

SELECT TOP 5
    p.Id_Paciente,
    u.Nombre + ' ' + u.Ap_Paterno AS Paciente
FROM Paciente p
JOIN Usuario u ON p.Id_Usuario = u.Id_Usuario;

SELECT TOP 3 Id_Consultorio, Nombre FROM Consultorio;
GO

-- ── PASO 2: Insertar la cita de prueba ───────────────────────
-- Cambia los 3 valores según lo que veas arriba
DECLARE @IdDoctor      INT = 1;   -- <-- Id_Doctor real
DECLARE @IdPaciente    INT = 2;   -- <-- Id_Paciente real
DECLARE @IdConsultorio INT = 1;   -- <-- Id_Consultorio real

DECLARE @IdEstatus INT;
SELECT @IdEstatus = Id_EstatusCita
FROM EstatusCita
WHERE Clave = 'pagada_pendiente_atender';

INSERT INTO Cita
    (Id_Doctor, Id_Paciente, Id_Consultorio, Id_EstatusCita,
     Fecha_Cita, Hora_Cita,
     Solicitud_Cita)   -- ← 3 días atrás para pasar el CHECK de 48h
VALUES
    (@IdDoctor, @IdPaciente, @IdConsultorio, @IdEstatus,
     CAST(GETDATE() AS DATE),
     CAST(DATEADD(hour, 1, GETDATE()) AS TIME),
     DATEADD(day, -3, GETDATE()));  -- simulamos que se agendó hace 3 días

DECLARE @FolioCita INT = SCOPE_IDENTITY();

-- Insertar el pago correspondiente
INSERT INTO Pago (Folio_Cita, MetodoPago, Monto, Estado, FechaPago)
SELECT @FolioCita, 'Efectivo', e.Precio, 'Pagado', GETDATE()
FROM Doctor d
JOIN Especialidad e ON d.Id_Especialidad = e.Id_Especialidad
WHERE d.Id_Doctor = @IdDoctor;

SELECT
    @FolioCita              AS FolioCitaCreado,
    CAST(GETDATE() AS DATE) AS FechaHoy,
    'pagada_pendiente_atender' AS Estatus,
    'Lista para emitir receta desde el dashboard' AS Resultado;
GO

-- ── LIMPIEZA (ejecutar después de la prueba) ─────────────────
-- Descomenta y pon el FolioCitaCreado que te devolvió arriba
/*
DECLARE @FolioABorrar INT = 0;  -- <-- pon el folio aquí
DELETE FROM Receta_Medicamento WHERE Id_Receta IN (SELECT Id_Receta FROM Receta WHERE Folio_Cita = @FolioABorrar);
DELETE FROM Receta              WHERE Folio_Cita = @FolioABorrar;
DELETE FROM Pago                WHERE Folio_Cita = @FolioABorrar;
DELETE FROM Bitacora_HistorialCitas  WHERE Folio_Cita = @FolioABorrar;
DELETE FROM Bitacora_EstatusCita     WHERE Folio_Cita = @FolioABorrar;
DELETE FROM Cita                WHERE Folio_Cita = @FolioABorrar;
*/
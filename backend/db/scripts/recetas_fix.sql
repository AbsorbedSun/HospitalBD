-- ============================================================
-- MIGRACIÓN: Corrección del módulo de Recetas
-- Ejecutar en SQL Server Management Studio sobre HospitalDB
-- ============================================================
USE HospitalDB;
GO

-- ── 1. Agregar columnas faltantes en la tabla Receta ────────────
ALTER TABLE Receta ADD Diagnostico VARCHAR(500) NULL;
GO

ALTER TABLE Receta ADD Duracion VARCHAR(100) NULL;
GO

-- ── 2. Tabla para medicamentos individuales por receta ──────────
--    La rúbrica exige "un registro por cada medicamento"
CREATE TABLE Receta_Medicamento (
    Id_RecetaMed   INT            IDENTITY(1,1) PRIMARY KEY,
    Id_Receta      INT            NOT NULL REFERENCES Receta(Id_Receta) ON DELETE CASCADE,
    Nombre         NVARCHAR(200)  NOT NULL,
    Dosis          VARCHAR(100)   NULL,   -- Ej: "500mg", "1 tableta"
    Frecuencia     VARCHAR(100)   NULL    -- Ej: "cada 8 horas", "una vez al día"
);
GO

-- ── 3. Actualizar VW_HistorialPaciente para incluir nuevos campos ─
CREATE OR ALTER VIEW dbo.VW_HistorialPaciente AS
SELECT
    pa.Id_Paciente,
    pa.Id_Usuario,
    up.Nombre           AS NombrePaciente,
    up.Ap_Paterno       AS ApPaternoPaciente,
    up.Ap_Materno       AS ApMaternoPaciente,
    up.Email            AS EmailPaciente,
    dbo.FN_CalcularEdad(up.Fecha_Nac) AS Edad,
    hm.Id_HistorialMed,
    hm.Tipo_sangre,
    hm.Estatura,
    hm.Peso,
    hm.Alergias,
    hm.Padecimientos,
    c.Folio_Cita,
    c.Fecha_Cita,
    c.Hora_Cita,
    ec.Clave            AS EstatusCita,
    ec.Descripcion      AS DescripcionEstatus,
    d.Id_Doctor,
    ud.Nombre           AS NombreDoctor,
    ud.Ap_Paterno       AS ApPaternoDoctor,
    d.Cedula_prof,
    e.Especialidad,
    -- Receta (ahora incluye Diagnostico y Duracion)
    r.Id_Receta,
    r.Diagnostico,
    r.Medicamento,      -- resumen legacy
    r.Tratamiento,
    r.Duracion,
    r.Observaciones,
    r.FechaEmision
FROM Paciente pa
JOIN Usuario up ON pa.Id_Usuario = up.Id_Usuario
LEFT JOIN Historial_medico hm ON hm.Id_Paciente   = pa.Id_Paciente
LEFT JOIN Cita             c  ON c.Id_Paciente     = pa.Id_Paciente
LEFT JOIN EstatusCita      ec ON c.Id_EstatusCita  = ec.Id_EstatusCita
LEFT JOIN Doctor           d  ON c.Id_Doctor       = d.Id_Doctor
LEFT JOIN Usuario          ud ON d.Id_Usuario      = ud.Id_Usuario
LEFT JOIN Especialidad     e  ON d.Id_Especialidad = e.Id_Especialidad
LEFT JOIN Receta           r  ON r.Folio_Cita      = c.Folio_Cita;
GO

PRINT 'Migración de recetas aplicada correctamente.';
GO

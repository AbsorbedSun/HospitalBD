/* ============================================================
   RUBRO RÚBRICA: "Mostrar todas las recetas emitidas por el Médico"
   Pasando su nombre completo o cédula, mostrar:
     - Num receta
     - Fecha
     - Nombre paciente
     - Nombre Médico
     - Diagnóstico   (*ver nota abajo, columna no existe en Receta)
     - Medicamentos
     - Tratamiento
     - Observaciones

   NOTA SOBRE "Diagnóstico":
   La tabla Receta no tiene esta columna en el schema actual.
   Se deja explícitamente como NULL AS Diagnostico en cada consulta
   para respetar el formato exacto pedido por la rúbrica, dejando
   claro que el campo fue identificado pero no implementado
   (Opción B: documentar la limitación en vez de alterar el schema).

   Ejecutar DESPUÉS de schema.sql, seed.sql y views_and_functions.sql.
   ============================================================ */

USE HospitalDB;
GO


/* ============================================================
   CONSULTA 1 — Pasando el NOMBRE COMPLETO del médico (búsqueda parcial)
   ============================================================ */
SELECT
    r.Id_Receta                                                          AS NumReceta,
    r.FechaEmision                                                       AS Fecha,
    CONCAT(up.Nombre, ' ', up.Ap_Paterno, ' ', ISNULL(up.Ap_Materno, ''))  AS NombrePaciente,
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno, ' ', ISNULL(ud.Ap_Materno, ''))  AS NombreMedico,
    NULL                                                                  AS Diagnostico,
    r.Medicamento,
    r.Tratamiento,
    r.Observaciones
FROM Receta r
JOIN Cita c        ON r.Folio_Cita  = c.Folio_Cita
JOIN Doctor d      ON c.Id_Doctor   = d.Id_Doctor
JOIN Usuario ud    ON d.Id_Usuario  = ud.Id_Usuario
JOIN Paciente p    ON c.Id_Paciente = p.Id_Paciente
JOIN Usuario up    ON p.Id_Usuario  = up.Id_Usuario
WHERE CONCAT(ud.Nombre, ' ', ud.Ap_Paterno, ' ', ISNULL(ud.Ap_Materno, '')) LIKE '%García%'
ORDER BY r.FechaEmision DESC;
GO


/* ============================================================
   CONSULTA 2 — Pasando la CÉDULA PROFESIONAL (más preciso)
   ============================================================ */
SELECT
    r.Id_Receta                                                          AS NumReceta,
    r.FechaEmision                                                       AS Fecha,
    CONCAT(up.Nombre, ' ', up.Ap_Paterno, ' ', ISNULL(up.Ap_Materno, ''))  AS NombrePaciente,
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno, ' ', ISNULL(ud.Ap_Materno, ''))  AS NombreMedico,
    NULL                                                                  AS Diagnostico,
    r.Medicamento,
    r.Tratamiento,
    r.Observaciones
FROM Receta r
JOIN Cita c        ON r.Folio_Cita  = c.Folio_Cita
JOIN Doctor d      ON c.Id_Doctor   = d.Id_Doctor
JOIN Usuario ud    ON d.Id_Usuario  = ud.Id_Usuario
JOIN Paciente p    ON c.Id_Paciente = p.Id_Paciente
JOIN Usuario up    ON p.Id_Usuario  = up.Id_Usuario
WHERE d.Cedula_prof = 'CED-CARD-001'
ORDER BY r.FechaEmision DESC;
GO


/* ============================================================
   STORED PROCEDURE — SP_RecetasPorMedico
   Encapsula la consulta para poder pasar el parámetro de
   búsqueda (nombre o cédula) en vivo durante la demo.
   ============================================================ */
CREATE OR ALTER PROCEDURE SP_RecetasPorMedico
    @Busqueda VARCHAR(100)   -- nombre completo (parcial) o cédula profesional
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.Id_Receta                                                          AS NumReceta,
        r.FechaEmision                                                       AS Fecha,
        CONCAT(up.Nombre, ' ', up.Ap_Paterno, ' ', ISNULL(up.Ap_Materno, ''))  AS NombrePaciente,
        CONCAT(ud.Nombre, ' ', ud.Ap_Paterno, ' ', ISNULL(ud.Ap_Materno, ''))  AS NombreMedico,
        NULL                                                                  AS Diagnostico,
        r.Medicamento,
        r.Tratamiento,
        r.Observaciones
    FROM Receta r
    JOIN Cita c        ON r.Folio_Cita  = c.Folio_Cita
    JOIN Doctor d      ON c.Id_Doctor   = d.Id_Doctor
    JOIN Usuario ud    ON d.Id_Usuario  = ud.Id_Usuario
    JOIN Paciente p    ON c.Id_Paciente = p.Id_Paciente
    JOIN Usuario up    ON p.Id_Usuario  = up.Id_Usuario
    WHERE d.Cedula_prof = @Busqueda
       OR CONCAT(ud.Nombre, ' ', ud.Ap_Paterno, ' ', ISNULL(ud.Ap_Materno, '')) LIKE '%' + @Busqueda + '%'
    ORDER BY r.FechaEmision DESC;
END;
GO

PRINT 'Stored Procedure SP_RecetasPorMedico creado exitosamente.';
GO

-- Ejemplos de uso:
-- EXEC SP_RecetasPorMedico @Busqueda = 'García';
-- EXEC SP_RecetasPorMedico @Busqueda = 'CED-CARD-001';


/* ============================================================
   CONSULTAS EXTRA (no pedidas explícitamente por la rúbrica,
   pero útiles para demostrar dominio del modelo de datos)
   ============================================================ */

-- EXTRA 1 — Conteo de recetas por médico (quién receta más)
SELECT
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno) AS Medico,
    COUNT(r.Id_Receta)                    AS TotalRecetas
FROM Receta r
JOIN Cita c     ON r.Folio_Cita = c.Folio_Cita
JOIN Doctor d   ON c.Id_Doctor  = d.Id_Doctor
JOIN Usuario ud ON d.Id_Usuario = ud.Id_Usuario
GROUP BY ud.Nombre, ud.Ap_Paterno
ORDER BY TotalRecetas DESC;
GO


-- EXTRA 2 — Recetas de un médico en un rango de fechas (reporte mensual)
SELECT
    r.Id_Receta, r.FechaEmision,
    CONCAT(up.Nombre, ' ', up.Ap_Paterno) AS Paciente,
    r.Medicamento, r.Tratamiento
FROM Receta r
JOIN Cita c     ON r.Folio_Cita  = c.Folio_Cita
JOIN Doctor d   ON c.Id_Doctor   = d.Id_Doctor
JOIN Usuario ud ON d.Id_Usuario  = ud.Id_Usuario
JOIN Paciente p ON c.Id_Paciente = p.Id_Paciente
JOIN Usuario up ON p.Id_Usuario  = up.Id_Usuario
WHERE d.Cedula_prof = 'CED-CARD-001'
  AND r.FechaEmision BETWEEN '2026-06-01' AND '2026-06-30'
ORDER BY r.FechaEmision;
GO


-- EXTRA 3 — Medicamento más recetado por un médico específico
SELECT
    r.Medicamento,
    COUNT(*) AS Veces
FROM Receta r
JOIN Cita c   ON r.Folio_Cita = c.Folio_Cita
JOIN Doctor d ON c.Id_Doctor  = d.Id_Doctor
WHERE d.Cedula_prof = 'CED-CARD-001'
GROUP BY r.Medicamento
ORDER BY Veces DESC;
GO


-- EXTRA 4 — Recetas de un médico filtradas por especialidad
-- (útil si la profesora pregunta "¿y si quiero ver solo las de Cardiología?")
SELECT
    r.Id_Receta, r.FechaEmision,
    CONCAT(up.Nombre, ' ', up.Ap_Paterno)  AS Paciente,
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno)  AS Medico,
    esp.Especialidad,
    r.Medicamento, r.Tratamiento, r.Observaciones
FROM Receta r
JOIN Cita c         ON r.Folio_Cita  = c.Folio_Cita
JOIN Doctor d       ON c.Id_Doctor   = d.Id_Doctor
JOIN Usuario ud     ON d.Id_Usuario  = ud.Id_Usuario
JOIN Especialidad esp ON d.Id_Especialidad = esp.Id_Especialidad
JOIN Paciente p     ON c.Id_Paciente = p.Id_Paciente
JOIN Usuario up     ON p.Id_Usuario  = up.Id_Usuario
WHERE esp.Especialidad = 'Cardiología'
ORDER BY r.FechaEmision DESC;
GO


-- EXTRA 5 — Recetas de un paciente específico, sin importar el médico
-- (la pregunta inversa: "muéstrame el historial de recetas de Juan Pérez")
SELECT
    r.Id_Receta, r.FechaEmision,
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno) AS Medico,
    esp.Especialidad,
    r.Medicamento, r.Tratamiento, r.Observaciones
FROM Receta r
JOIN Cita c         ON r.Folio_Cita  = c.Folio_Cita
JOIN Doctor d       ON c.Id_Doctor   = d.Id_Doctor
JOIN Usuario ud     ON d.Id_Usuario  = ud.Id_Usuario
JOIN Especialidad esp ON d.Id_Especialidad = esp.Id_Especialidad
JOIN Paciente p     ON c.Id_Paciente = p.Id_Paciente
JOIN Usuario up     ON p.Id_Usuario  = up.Id_Usuario
WHERE CONCAT(up.Nombre, ' ', up.Ap_Paterno, ' ', ISNULL(up.Ap_Materno, '')) LIKE '%Pérez%'
ORDER BY r.FechaEmision DESC;
GO


-- EXTRA 6 — Recetas emitidas HOY por un médico (validación de "fecha de la cita")
-- Relevante porque la rúbrica de "Generar receta" exige que solo se habilite
-- el día de la cita; esta consulta muestra cómo se vería ese filtro.
SELECT
    r.Id_Receta, r.FechaEmision,
    CONCAT(up.Nombre, ' ', up.Ap_Paterno) AS Paciente,
    c.Fecha_Cita, c.Hora_Cita,
    r.Medicamento, r.Tratamiento
FROM Receta r
JOIN Cita c     ON r.Folio_Cita  = c.Folio_Cita
JOIN Doctor d   ON c.Id_Doctor   = d.Id_Doctor
JOIN Paciente p ON c.Id_Paciente = p.Id_Paciente
JOIN Usuario up ON p.Id_Usuario  = up.Id_Usuario
WHERE d.Cedula_prof = 'CED-CARD-001'
  AND r.FechaEmision = CAST(GETDATE() AS DATE);
GO


-- EXTRA 7 — Verificar alergias del paciente ANTES de recetar
-- (cruce con Historial_medico; útil si pregunta "¿cómo evitarían un error médico?")
SELECT
    CONCAT(up.Nombre, ' ', up.Ap_Paterno) AS Paciente,
    hm.Tipo_sangre,
    hm.Alergias,
    hm.Padecimientos,
    r.Medicamento AS MedicamentoRecetado
FROM Receta r
JOIN Cita c          ON r.Folio_Cita  = c.Folio_Cita
JOIN Paciente p      ON c.Id_Paciente = p.Id_Paciente
JOIN Usuario up      ON p.Id_Usuario  = up.Id_Usuario
LEFT JOIN Historial_medico hm ON hm.Id_Paciente = p.Id_Paciente
WHERE c.Folio_Cita = 5;   -- ajustar al folio de cita real
GO


-- EXTRA 8 — Total de recetas emitidas por consultorio/piso
-- (cruce con Consultorio, demuestra dominio de relaciones más profundas)
SELECT
    co.Nombre   AS Consultorio,
    co.Piso,
    COUNT(r.Id_Receta) AS TotalRecetas
FROM Receta r
JOIN Cita c          ON r.Folio_Cita = c.Folio_Cita
JOIN Consultorio co  ON c.Id_Consultorio = co.Id_Consultorio
GROUP BY co.Nombre, co.Piso
ORDER BY TotalRecetas DESC;
GO


-- EXTRA 9 — Médicos que NO han emitido ninguna receta (LEFT JOIN + IS NULL)
-- Pregunta clásica de profesor: "¿y los que no tienen registros, cómo los ven?"
SELECT
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno) AS Medico,
    d.Cedula_prof
FROM Doctor d
JOIN Usuario ud ON d.Id_Usuario = ud.Id_Usuario
LEFT JOIN Cita c     ON c.Id_Doctor = d.Id_Doctor
LEFT JOIN Receta r   ON r.Folio_Cita = c.Folio_Cita
WHERE r.Id_Receta IS NULL
GROUP BY ud.Nombre, ud.Ap_Paterno, d.Cedula_prof;
GO


-- EXTRA 10 — Última receta emitida por cada médico (subconsulta correlacionada)
-- Pregunta típica: "¿cuál fue la receta más reciente de cada doctor?"
SELECT
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno) AS Medico,
    r.Id_Receta, r.FechaEmision, r.Medicamento
FROM Receta r
JOIN Cita c     ON r.Folio_Cita = c.Folio_Cita
JOIN Doctor d   ON c.Id_Doctor  = d.Id_Doctor
JOIN Usuario ud ON d.Id_Usuario = ud.Id_Usuario
WHERE r.FechaEmision = (
    SELECT MAX(r2.FechaEmision)
    FROM Receta r2
    JOIN Cita c2 ON r2.Folio_Cita = c2.Folio_Cita
    WHERE c2.Id_Doctor = d.Id_Doctor
)
ORDER BY ud.Ap_Paterno;
GO

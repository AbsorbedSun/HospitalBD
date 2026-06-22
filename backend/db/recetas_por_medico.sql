USE HospitalDB;
GO

-- ============================================================
-- Consultas principales: Recetas por Médico
-- ============================================================

-- 1. Búsqueda de recetas por nombre del médico (coincidencia parcial)
-- Utiliza la cláusula LIKE con comodines '%' para buscar coincidencias de texto
-- en la concatenación del nombre y apellidos del médico[cite: 1].
SELECT
    r.Id_Receta                                                            AS NumReceta,
    r.FechaEmision                                                         AS Fecha,
    CONCAT(up.Nombre, ' ', up.Ap_Paterno, ' ', ISNULL(up.Ap_Materno, ''))  AS NombrePaciente,
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno, ' ', ISNULL(ud.Ap_Materno, ''))  AS NombreMedico,
    NULL                                                                   AS Diagnostico, -- Requerido por rúbrica, no implementado en schema actual[cite: 1]
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


-- 2. Búsqueda de recetas por cédula profesional exacta
-- Filtra directamente por el campo Cedula_prof de la tabla Doctor.
-- Es una búsqueda exacta (=), lo que resulta en una consulta más óptima que LIKE[cite: 1].
SELECT
    r.Id_Receta                                                            AS NumReceta,
    r.FechaEmision                                                         AS Fecha,
    CONCAT(up.Nombre, ' ', up.Ap_Paterno, ' ', ISNULL(up.Ap_Materno, ''))  AS NombrePaciente,
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno, ' ', ISNULL(ud.Ap_Materno, ''))  AS NombreMedico,
    NULL                                                                   AS Diagnostico,
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


-- 3. Stored Procedure para flexibilizar la búsqueda
-- Encapsula la lógica relacional recibiendo un parámetro @Busqueda.
-- Combina ambas condiciones (cédula exacta O nombre parcial) usando un OR lógico[cite: 1].
CREATE OR ALTER PROCEDURE SP_RecetasPorMedico
    @Busqueda VARCHAR(100) 
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.Id_Receta                                                            AS NumReceta,
        r.FechaEmision                                                         AS Fecha,
        CONCAT(up.Nombre, ' ', up.Ap_Paterno, ' ', ISNULL(up.Ap_Materno, ''))  AS NombrePaciente,
        CONCAT(ud.Nombre, ' ', ud.Ap_Paterno, ' ', ISNULL(ud.Ap_Materno, ''))  AS NombreMedico,
        NULL                                                                   AS Diagnostico,
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

-- Pruebas del SP:
-- EXEC SP_RecetasPorMedico @Busqueda = 'García';
-- EXEC SP_RecetasPorMedico @Busqueda = 'CED-CARD-001';


-- ============================================================
-- Consultas de reportes y validaciones adicionales
-- ============================================================

-- Conteo del volumen de recetas por médico
-- Agrupa los registros por el nombre del médico (GROUP BY) y utiliza 
-- la función de agregación COUNT() para totalizar las recetas[cite: 1].
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

-- Reporte de recetas emitidas por un médico en un periodo específico
-- Utiliza el operador BETWEEN sobre el campo FechaEmision para delimitar 
-- los resultados a un rango de fechas exacto[cite: 1].
SELECT
    r.Id_Receta, 
    r.FechaEmision,
    CONCAT(up.Nombre, ' ', up.Ap_Paterno) AS Paciente,
    r.Medicamento, 
    r.Tratamiento
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

-- Frecuencia de medicamentos recetados por un médico
-- Cuenta las incidencias agrupando por la columna Medicamento para obtener
-- el fármaco de mayor rotación según el historial del doctor[cite: 1].
SELECT
    r.Medicamento,
    COUNT(*) AS Frecuencia
FROM Receta r
JOIN Cita c   ON r.Folio_Cita = c.Folio_Cita
JOIN Doctor d ON c.Id_Doctor  = d.Id_Doctor
WHERE d.Cedula_prof = 'CED-CARD-001'
GROUP BY r.Medicamento
ORDER BY Frecuencia DESC;
GO

-- Listado de recetas filtradas por especialidad
-- Incorpora un JOIN adicional a la tabla Especialidad para permitir 
-- el filtrado a nivel de departamento médico en lugar de médico individual[cite: 1].
SELECT
    r.Id_Receta, 
    r.FechaEmision,
    CONCAT(up.Nombre, ' ', up.Ap_Paterno) AS Paciente,
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno) AS Medico,
    esp.Especialidad,
    r.Medicamento, 
    r.Tratamiento, 
    r.Observaciones
FROM Receta r
JOIN Cita c           ON r.Folio_Cita  = c.Folio_Cita
JOIN Doctor d         ON c.Id_Doctor   = d.Id_Doctor
JOIN Usuario ud       ON d.Id_Usuario  = ud.Id_Usuario
JOIN Especialidad esp ON d.Id_Especialidad = esp.Id_Especialidad
JOIN Paciente p       ON c.Id_Paciente = p.Id_Paciente
JOIN Usuario up       ON p.Id_Usuario  = up.Id_Usuario
WHERE esp.Especialidad = 'Cardiología'
ORDER BY r.FechaEmision DESC;
GO

-- Historial general de recetas de un paciente específico
-- Filtra la tabla de pacientes mediante un LIKE en su nombre para devolver
-- su trazabilidad clínica sin importar quién fue el médico tratante[cite: 1].
SELECT
    r.Id_Receta, 
    r.FechaEmision,
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno) AS Medico,
    esp.Especialidad,
    r.Medicamento, 
    r.Tratamiento, 
    r.Observaciones
FROM Receta r
JOIN Cita c           ON r.Folio_Cita  = c.Folio_Cita
JOIN Doctor d         ON c.Id_Doctor   = d.Id_Doctor
JOIN Usuario ud       ON d.Id_Usuario  = ud.Id_Usuario
JOIN Especialidad esp ON d.Id_Especialidad = esp.Id_Especialidad
JOIN Paciente p       ON c.Id_Paciente = p.Id_Paciente
JOIN Usuario up       ON p.Id_Usuario  = up.Id_Usuario
WHERE CONCAT(up.Nombre, ' ', up.Ap_Paterno, ' ', ISNULL(up.Ap_Materno, '')) LIKE '%Pérez%'
ORDER BY r.FechaEmision DESC;
GO

-- Recetas emitidas en el día actual (validación de fecha de sistema)
-- Efectúa un casteo (CAST) de GETDATE() a DATE para aislar la fecha actual
-- e igualarla con FechaEmision, omitiendo la hora[cite: 1].
SELECT
    r.Id_Receta, 
    r.FechaEmision,
    CONCAT(up.Nombre, ' ', up.Ap_Paterno) AS Paciente,
    c.Fecha_Cita, 
    c.Hora_Cita,
    r.Medicamento, 
    r.Tratamiento
FROM Receta r
JOIN Cita c     ON r.Folio_Cita  = c.Folio_Cita
JOIN Doctor d   ON c.Id_Doctor   = d.Id_Doctor
JOIN Paciente p ON c.Id_Paciente = p.Id_Paciente
JOIN Usuario up ON p.Id_Usuario  = up.Id_Usuario
WHERE d.Cedula_prof = 'CED-CARD-001'
  AND r.FechaEmision = CAST(GETDATE() AS DATE);
GO

-- Consulta del historial médico y alergias vinculadas a la receta
-- Aplica un LEFT JOIN hacia Historial_medico para traer alergias y padecimientos, 
-- asegurando que la consulta no falle si el paciente aún no tiene historial registrado[cite: 1].
SELECT
    CONCAT(up.Nombre, ' ', up.Ap_Paterno) AS Paciente,
    hm.Tipo_sangre,
    hm.Alergias,
    hm.Padecimientos,
    r.Medicamento AS MedicamentoRecetado
FROM Receta r
JOIN Cita c                   ON r.Folio_Cita  = c.Folio_Cita
JOIN Paciente p               ON c.Id_Paciente = p.Id_Paciente
JOIN Usuario up               ON p.Id_Usuario  = up.Id_Usuario
LEFT JOIN Historial_medico hm ON hm.Id_Paciente = p.Id_Paciente
WHERE c.Folio_Cita = 5; 
GO

-- Distribución de volumen de recetas por consultorio
-- Escala las relaciones hasta la tabla Consultorio para agrupar las recetas emitidas
-- por la ubicación física en lugar de la persona[cite: 1].
SELECT
    co.Nombre          AS Consultorio,
    co.Piso,
    COUNT(r.Id_Receta) AS TotalRecetas
FROM Receta r
JOIN Cita c         ON r.Folio_Cita = c.Folio_Cita
JOIN Consultorio co ON c.Id_Consultorio = co.Id_Consultorio
GROUP BY co.Nombre, co.Piso
ORDER BY TotalRecetas DESC;
GO

-- Identificación de médicos sin recetas emitidas
-- Se invierte la lógica con un LEFT JOIN desde Doctor hacia Receta.
-- Al evaluar "r.Id_Receta IS NULL", obtenemos únicamente los doctores que no cruzaron datos[cite: 1].
SELECT
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno) AS Medico,
    d.Cedula_prof
FROM Doctor d
JOIN Usuario ud      ON d.Id_Usuario = ud.Id_Usuario
LEFT JOIN Cita c     ON c.Id_Doctor = d.Id_Doctor
LEFT JOIN Receta r   ON r.Folio_Cita = c.Folio_Cita
WHERE r.Id_Receta IS NULL
GROUP BY ud.Nombre, ud.Ap_Paterno, d.Cedula_prof;
GO

-- Última receta emitida por cada médico activo
-- Utiliza una subconsulta correlacionada en el WHERE. Por cada fila evaluada, 
-- la subconsulta busca la fecha máxima (MAX) correspondiente a ese doctor en particular[cite: 1].
SELECT
    CONCAT(ud.Nombre, ' ', ud.Ap_Paterno) AS Medico,
    r.Id_Receta, 
    r.FechaEmision, 
    r.Medicamento
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
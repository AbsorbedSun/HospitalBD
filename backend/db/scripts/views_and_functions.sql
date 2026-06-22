-- HospitalDB — Vistas y Funciones

USE HospitalDB;
GO

-- ============================================================
-- FUNCIONES 
-- ------------------------------------------------------------


-- FN_CalcularEdad
-- Calcula la edad exacta en años a partir de la fecha de nacimiento, considerando si ya cumplió
-- años en el año en curso.
-- 
-- Retorna la edad en años.

CREATE OR ALTER FUNCTION dbo.FN_CalcularEdad(@Fecha_Nac DATE)
-- Datediff tiene un pequeño error al calcular las diferencias es por eso que se valida 
-- comprobando si la fecha correspondiente a eso ya paso o esta por pasar.
RETURNS INT
AS
BEGIN -- Toma la fecha de nacimiento y realiza la diferencia de edad mediante DATEDIFF 
    RETURN DATEDIFF(year, @Fecha_Nac, GETDATE()) - CASE 
        -- Evalua la fecha, tanto dia como mes, validando si aun no cumple años por lo que resta 1 si es verdadero
            -- Mes de la fecha >= Mes presente      &       Fecha > Fecha presente 
               WHEN (MONTH(@Fecha_Nac) > MONTH(GETDATE())) OR (MONTH(@Fecha_Nac) = MONTH(GETDATE()) AND DAY(@Fecha_Nac) > DAY(GETDATE()))
                    THEN 1 -- Resta 1 a la edad en caso de no haber cumplido años durante el transcurso de el año presente
               ELSE 0 -- Deja la diferencia (DATEDIFF) tal y como esta.
             END;
END;
GO

-- ------------------------------------------------------------


-- FN_DoctorDisponible
-- Revisa si un doctor tiene un espacio libre en su agenda. Checa que no tenga otra cita viva  
-- (por pagar o por ser atendida) justo en la fecha y hora que le estás pidiendo.
-- 
-- Retorna 1 = disponible, 0 = ocupado

-- Toma el IdDoctor, la Fecha y la Hora
CREATE OR ALTER FUNCTION dbo.FN_DoctorDisponible(@Id_Doctor INT, @Fecha DATE, @Hora TIME)
RETURNS BIT AS
BEGIN
-- No importan los datos de la tabla solo se busca validar una accion es por eso que es un select 1
    IF EXISTS (SELECT 1 FROM Cita c JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
    -- Busca la exixtencia de algun registro en la tabla Cita que cumpla con los 3 parametros solicitados y
    -- que tenga un estatus activo ('agendada...' o 'pagada...')
        WHERE c.Id_Doctor = @Id_Doctor AND  c.Fecha_Cita = @Fecha AND  c.Hora_Cita  = @Hora
          AND ec.Clave IN ('agendada_pendiente_pago', 'pagada_pendiente_atender'))
        RETURN 0; -- Si esta ocupado (encuentra aunque sea un registro)
    RETURN 1; -- Si no exixte registro alguno
END;
GO

-- ------------------------------------------------------------


-- FN_PacienteTieneCitaPendiente
-- Verifica si un paciente ya tiene una cita activa
-- (pendiente o confirmada) con el mismo doctor indicado.
-- Retorna 1 = tiene cita pendiente, 0 = libre

-- Toma el IdDoctor y IdPaciente
CREATE OR ALTER FUNCTION dbo.FN_PacienteTieneCitaPendiente(@Id_Paciente INT, @Id_Doctor INT)
RETURNS BIT AS
BEGIN -- Misma logica que la funcion anterior pero cruzando a Paciente con Doctor para llegar al resultado
    IF EXISTS (SELECT 1 FROM   Cita c JOIN   EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
        WHERE  c.Id_Paciente = @Id_Paciente AND  c.Id_Doctor   = @Id_Doctor
          AND  ec.Clave IN ('agendada_pendiente_pago', 'pagada_pendiente_atender'))
        RETURN 1; -- Si ya tiene cita
    RETURN 0; -- No tiene cita
END;
GO

-- ------------------------------------------------------------


-- FN_MontoDevolucion
-- Calcula el monto a devolver al paciente según la política de cancelación del hospital:
    -- Si el paciente cancela con más de 48 hrs, se le devuelve todo (100%).
    -- Si cancela entre 24 y 48 hrs, se le devuelve la mitad (50%).
    -- Si cancela a última hora (menos de 24 hrs), no se le devuelve nada (0%).
-- Si no existe pago confirmado retorna 0.
-- Retorna un DECIMAL(10,2) monto a reembolsar

-- Toma el Folio de una cita y la Fecha de la cancelación
CREATE OR ALTER FUNCTION dbo.FN_MontoDevolucion(@Folio_Cita INT, @Fecha_Cancelacion DATETIME)
RETURNS DECIMAL(10,2) AS
BEGIN
-- Declaracion de variables a usar, similar a una funcion normal en cualquier lenguaje de alto nivel
    DECLARE @Monto DECIMAL(10,2) = 0.00; -- Maximo de 10 numeros, con dos de ellos decimales
    DECLARE @FechaCita DATETIME;
    DECLARE @HorasAntes INT;

    -- Obtener monto pagado y fecha (datetime) exacto de la cita
        -- Suma la fecha y hora para obtener el datetime
    SELECT @FechaCita = CAST(c.Fecha_Cita AS DATETIME) + CAST(c.Hora_Cita AS DATETIME), 
           -- Si el paciente no ha pagado, ISNULL convierte ese vacío en 0.00
            @Monto = ISNULL(p.Monto, 0.00) 
           -- Trae el pago solo si existe y su estado es 'Pagado'
            FROM  Cita c LEFT JOIN Pago p ON p.Folio_Cita = c.Folio_Cita AND p.Estado = 'Pagado'
    WHERE c.Folio_Cita = @Folio_Cita;

     -- Si el paciente nunca pago o la cita no existe devuelve un monto de 0
    IF @Monto = 0.00 OR @FechaCita IS NULL
        RETURN 0.00;

    -- Regresa un numero entero en horas
    SET @HorasAntes = DATEDIFF(hour, @Fecha_Cancelacion, @FechaCita); -- Contar cuántas horas faltan desde 
                                                                        -- el momento de cancelación hasta el momento de la cita

    RETURN CASE -- Realiza las validaciones dependiendo de las horas
        WHEN @HorasAntes >= 48 THEN @Monto -- Mayor a 48 hrs regresa todo el monto
        WHEN @HorasAntes >= 24 THEN CAST(@Monto * 0.50 AS DECIMAL(10,2)) -- Mayor a 48 hrs pero menos a 24 hrs, la mitas del monto
        ELSE 0.00 -- Menos de 24hrs nada
    END;
END;
GO

-- ------------------------------------------------------------


-- FN_StockSuficiente
-- Verifica si hay suficiente inventario de un medicamento para lo que el cliente quiere comprar.
-- 
-- Retorna  1 = stock suficiente, 0 = insuficiente/no existe


CREATE OR ALTER FUNCTION dbo.FN_StockSuficiente(@Id_Medicamento INT, @Cantidad    INT)
RETURNS BIT AS
BEGIN
-- Declaracion de variables a usar
    DECLARE @Stock INT = 0;
    -- Asigna a la variable Stock el valor obtenido de seleccionar de la tabla Medicamentos (variable = valor de la columna)
    SELECT @Stock = Stock FROM Medicamentos WHERE Id_Medicamento = @Id_Medicamento;
    -- Si no existe regresa 0 (no hay cantidad)
    IF @Stock IS NULL RETURN 0;
    -- Si hay mayor cantidad a la solicitada regresa 1 (hay cantidad suficiente)
    IF @Stock >= @Cantidad RETURN 1;
    -- Si no se cumple lo anterior (se pide mas de lo que hay)
    RETURN 0;
END;
GO


-- ============================================================
-- VISTAS
-- ------------------------------------------------------------


-- VW_CitasCompletas
-- Vista de todas las citas, une toda la información esparcida del paciente, doctor, especialidad, 
--consultorio y pago. Centraliza el JOIN más complejo del sistema y evita repetirlo en cada consulta.


CREATE OR ALTER VIEW dbo.VW_CitasCompletas AS
SELECT c.Folio_Cita, 
    c.Fecha_Cita, 
    c.Hora_Cita, 
    c.Solicitud_Cita, 
    c.Id_EstatusCita,
    ec.Clave AS Estatus,
    ec.Descripcion AS DescripcionEstatus,
    -- Paciente
    c.Id_Paciente,
    pa.Id_Usuario       AS Id_UsuarioPaciente,
    up.Nombre           AS NombrePaciente,
    up.Ap_Paterno       AS ApPaternoPaciente,
    up.Ap_Materno       AS ApMaternoPaciente,
    up.Telefono         AS TelefonoPaciente,
    up.Email            AS EmailPaciente,
    dbo.FN_CalcularEdad(up.Fecha_Nac) AS EdadPaciente,
    -- Doctor
    c.Id_Doctor,
    d.Id_Usuario        AS Id_UsuarioDoctor,
    ud.Nombre           AS NombreDoctor,
    ud.Ap_Paterno       AS ApPaternoDoctor,
    ud.Ap_Materno       AS ApMaternoDoctor,
    d.Cedula_prof,
    -- Especialidad
    e.Id_Especialidad,
    e.Especialidad,
    e.Precio            AS PrecioEspecialidad,
    -- Consultorio
    c.Id_Consultorio,
    co.Nombre           AS NombreConsultorio,
    co.Piso             AS PisoConsultorio,
    -- Pago (el más reciente asociado a la cita)
    pg.Id_Pago,
    pg.MetodoPago,
    pg.Monto            AS MontoPago,
    pg.FechaPago,
    pg.Estado           AS EstadoPago,
    pg.MontoDevuelto
FROM Cita c
JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
JOIN Paciente pa ON c.Id_Paciente = pa.Id_Paciente
JOIN Usuario up ON pa.Id_Usuario = up.Id_Usuario
JOIN Doctor d  ON c.Id_Doctor = d.Id_Doctor
JOIN Usuario ud ON d.Id_Usuario = ud.Id_Usuario
JOIN Especialidad e  ON d.Id_Especialidad = e.Id_Especialidad
LEFT JOIN Consultorio co ON c.Id_Consultorio = co.Id_Consultorio
LEFT JOIN (
    -- Tomar el pago más reciente por cita (evita duplicados)
    -- Agrupa los pagos por el folio de la cita y los ordena del más nuevo al más viejo, asignándoles un número (1, 2, 3...)
    SELECT *,ROW_NUMBER() OVER ( 
               PARTITION BY Folio_Cita
               ORDER BY FechaPago DESC) AS rn
               -- Filtra con pg.rn = 1 (- Evitar Duplic)
    FROM Pago WHERE Folio_Cita IS NOT NULL) pg ON pg.Folio_Cita = c.Folio_Cita AND pg.rn = 1;
GO

-- ------------------------------------------------------------
-- VW_AgendaDoctor
-- Vista de la agenda de cada doctor. Muestra solo citas activas (pendientes de pago o confirmadas)
-- ordenadas por fecha y hora ascendente.
-- Filtrando la basura (canceladas, rechazadas o ya terminadas)


CREATE OR ALTER VIEW dbo.VW_AgendaDoctor AS
SELECT
    d.Id_Doctor,
    ud.Nombre AS NombreDoctor,
    ud.Ap_Paterno AS ApPaternoDoctor,
    e.Especialidad,
    c.Folio_Cita,
    c.Fecha_Cita,
    c.Hora_Cita,
    c.Solicitud_Cita,
    ec.Clave AS Estatus,
    ec.Descripcion AS DescripcionEstatus,
    -- Paciente
    c.Id_Paciente,
    pa.Id_Usuario AS Id_UsuarioPaciente,
    up.Nombre AS NombrePaciente,
    up.Ap_Paterno AS ApPaternoPaciente,
    up.Ap_Materno AS ApMaternoPaciente,
    up.Telefono AS TelefonoPaciente,
    up.Email AS EmailPaciente,
    dbo.FN_CalcularEdad(up.Fecha_Nac) AS EdadPaciente,
    -- Consultorio
    c.Id_Consultorio,
    co.Nombre AS NombreConsultorio,
    co.Piso AS PisoConsultorio
FROM Cita c
JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
JOIN Doctor d ON c.Id_Doctor  = d.Id_Doctor
JOIN Usuario ud ON d.Id_Usuario = ud.Id_Usuario
JOIN Especialidad e ON d.Id_Especialidad = e.Id_Especialidad
JOIN Paciente pa ON c.Id_Paciente = pa.Id_Paciente
JOIN Usuario up ON pa.Id_Usuario = up.Id_Usuario
LEFT JOIN Consultorio co ON c.Id_Consultorio = co.Id_Consultorio
WHERE ec.Clave IN ('agendada_pendiente_pago', 'pagada_pendiente_atender');
GO


-- ------------------------------------------------------------
-- VW_InventarioMedicamentos
-- Vista del inventario de medicamentos + una columna de alerta de stock calculada y una
-- señalización de disponibilidad para el catálogo público.


CREATE OR ALTER VIEW dbo.VW_InventarioMedicamentos AS
-- Selecciona el id, nombre, descripcion, precio, unidad, stock de la tabla Medicamentos
SELECT f.Id_Medicamento, f.Nombre, f.Descripcion, f.Precio, f.Unidad, f.Stock,
    CASE -- Clasifica los numeros en palabras
        WHEN f.Stock =  0  THEN 'Agotado' -- Cuando la cantidad es 0
        WHEN f.Stock < 10  THEN 'Stock Crítico' -- Cantidades menores a 10 piezas
        WHEN f.Stock < 30  THEN 'Stock Bajo'
        ELSE 'Disponible' -- Cantidad mayor a 30 piezas (stock aceptable)
        -- Agrega otra columna para una rapida visualizacion del stock contestando a la pregunta 
        -- ¿Hay stock disponible? 1 (Si) / 0 (No)
    END AS AlertaStock, CAST(CASE 
                                WHEN f.Stock > 0 THEN 1 
                                ELSE 0 
                                END AS BIT) AS Disponible
FROM Medicamentos f;
GO

-- ------------------------------------------------------------
-- VW_HistorialPaciente
-- Vista consolidada del historial clínico completo de cada paciente: datos personales, ficha médica
-- (tipo de sangre, alergias, etc.), historial de citas y recetas emitidas.
-- Cada fila combina una cita con su receta (si existe).


CREATE OR ALTER VIEW dbo.VW_HistorialPaciente AS
SELECT
    pa.Id_Paciente,
    pa.Id_Usuario,
    up.Nombre AS NombrePaciente,
    up.Ap_Paterno AS ApPaternoPaciente,
    up.Ap_Materno AS ApMaternoPaciente,
    up.Email AS EmailPaciente,
    dbo.FN_CalcularEdad(up.Fecha_Nac) AS Edad,
    -- Ficha médica (NULL si aún no tiene historial)
    hm.Id_HistorialMed,
    hm.Tipo_sangre,
    hm.Estatura,
    hm.Peso,
    hm.Alergias,
    hm.Padecimientos,
    -- Cita (NULL si no tiene citas)
    c.Folio_Cita,
    c.Fecha_Cita,
    c.Hora_Cita,
    ec.Clave AS EstatusCita,
    ec.Descripcion AS DescripcionEstatus,
    -- Doctor (NULL si no tiene citas)
    d.Id_Doctor,
    ud.Nombre AS NombreDoctor,
    ud.Ap_Paterno AS ApPaternoDoctor,
    d.Cedula_prof,
    e.Especialidad,
    -- Receta (NULL si la cita no generó receta)
    r.Id_Receta,
    r.Medicamento,
    r.Tratamiento,
    r.Observaciones,
    r.FechaEmision
FROM Paciente pa
JOIN Usuario up ON pa.Id_Usuario = up.Id_Usuario
-- Si se usa JOIN normal solo vería a los pacientes que ya tuvieron citas y que ya tienen historial médico
-- Al usar LEFT JOIN desde la tabla Paciente aseguramos que sus columnas siempre salgan aunque sean nulas debido a ser un paciente nuevo.
LEFT JOIN Historial_medico hm ON hm.Id_Paciente  = pa.Id_Paciente
LEFT JOIN Cita c  ON c.Id_Paciente = pa.Id_Paciente
LEFT JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
LEFT JOIN Doctor d  ON c.Id_Doctor = d.Id_Doctor
LEFT JOIN Usuario ud ON d.Id_Usuario = ud.Id_Usuario
LEFT JOIN Especialidad e ON d.Id_Especialidad = e.Id_Especialidad
LEFT JOIN Receta r  ON r.Folio_Cita = c.Folio_Cita;
GO



-- CASE
SELECT dbo.FN_CalcularEdad('2006-09-23') AS EdadActual
-- No CASE
SELECT dbo.FN_CalcularEdad('2006-04-23') AS EdadActual

-- Devuelve 1 o 0
SELECT dbo.FN_DoctorDisponible(3, '2026-06-15', '10:00:00') AS EstaLibre; -- 1 Si / 0 No

-- Devuelve 1 o 0
SELECT dbo.FN_PacienteTieneCitaPendiente(10, 5) AS YaTieneCita; -- 1 Si / 0 No

-- Escenario 1: Cancelación con mucha anticipación (100%)
SELECT dbo.FN_MontoDevolucion(1, '2026-06-01 10:00:00') AS ReembolsoTotal;

-- Escenario 2: Cancelación un día antes (50%)
SELECT dbo.FN_MontoDevolucion(1, '2026-06-05 10:00:00') AS ReembolsoMitad;

-- Escenario 3: Cancelación el mismo día (0%)
SELECT dbo.FN_MontoDevolucion(1, '2026-06-06 09:00:00') AS SinReembolso;

-- "Quiero 5 cajas de X medicmento con ID 12. ¿Hay suficientes?"
SELECT dbo.FN_StockSuficiente(12, 5) AS HayStock; -- 1 Si / 0 No

SELECT * FROM VW_CitasCompletas;

SELECT * FROM VW_AgendaDoctor WHERE Id_Doctor = 8 ORDER BY Fecha_Cita, Hora_Cita;

SELECT * FROM VW_AgendaDoctor

SELECT * FROM VW_InventarioMedicamentos

SELECT * FROM VW_HistorialPaciente

PRINT 'Vistas y funciones creadas exitosamente.';
GO

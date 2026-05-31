-- HospitalDB — Vistas y Funciones

USE HospitalDB;
GO

-- FUNCIONES ESCALARES 
-- ------------------------------------------------------------
-- FN_CalcularEdad
-- Calcula la edad exacta en años a partir de la
-- fecha de nacimiento, considerando si ya cumplió
-- años en el año en curso.
-- 
-- Retorna   : INT  (edad en años completos)
-- Usado en  : VW_CitasCompletas, VW_AgendaDoctor,
--             VW_HistorialPaciente, perfiles de usuario
-- ------------------------------------------------------------
CREATE OR ALTER FUNCTION dbo.FN_CalcularEdad(@Fecha_Nac DATE)
RETURNS INT
AS
BEGIN
    RETURN DATEDIFF(year, @Fecha_Nac, GETDATE())
           - CASE
               WHEN (MONTH(@Fecha_Nac) > MONTH(GETDATE()))
                 OR (MONTH(@Fecha_Nac) = MONTH(GETDATE())
                     AND DAY(@Fecha_Nac) > DAY(GETDATE()))
               THEN 1
               ELSE 0
             END;
END;
GO

-- ------------------------------------------------------------
-- FN_DoctorDisponible
-- Verifica si un doctor NO tiene una cita activa
-- (pendiente de pago o confirmada) en la fecha y
-- hora solicitadas.
-- 
-- Retorna   : BIT  1 = disponible, 0 = ocupado
-- Usado en  : agendar_cita (validación de traslape)
-- ------------------------------------------------------------
CREATE OR ALTER FUNCTION dbo.FN_DoctorDisponible(
    @Id_Doctor INT,
    @Fecha     DATE,
    @Hora      TIME
)
RETURNS BIT
AS
BEGIN
    IF EXISTS (
        SELECT 1
        FROM   Cita c
        JOIN   EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
        WHERE  c.Id_Doctor  = @Id_Doctor
          AND  c.Fecha_Cita = @Fecha
          AND  c.Hora_Cita  = @Hora
          AND  ec.Clave IN ('agendada_pendiente_pago', 'pagada_pendiente_atender')
    )
        RETURN 0;
    RETURN 1;
END;
GO

-- ------------------------------------------------------------
-- FN_PacienteTieneCitaPendiente
-- Verifica si un paciente ya tiene una cita activa
-- (pendiente o confirmada) con el doctor indicado.
-- 
-- Retorna   : BIT  1 = tiene cita pendiente, 0 = libre
-- Usado en  : agendar_cita (validación de restricción de agendado)
-- ------------------------------------------------------------
CREATE OR ALTER FUNCTION dbo.FN_PacienteTieneCitaPendiente(
    @Id_Paciente INT,
    @Id_Doctor   INT
)
RETURNS BIT
AS
BEGIN
    IF EXISTS (
        SELECT 1
        FROM   Cita c
        JOIN   EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
        WHERE  c.Id_Paciente = @Id_Paciente
          AND  c.Id_Doctor   = @Id_Doctor
          AND  ec.Clave IN ('agendada_pendiente_pago', 'pagada_pendiente_atender')
    )
        RETURN 1;
    RETURN 0;
END;
GO

-- ------------------------------------------------------------
-- FN_MontoDevolucion
-- Calcula el monto a devolver al paciente según la
-- política de cancelación del hospital:
--               >= 48 hrs de anticipación → 100 % del pago
--               >= 24 hrs de anticipación → 50 % del pago
--               <  24 hrs de anticipación → 0 % (sin devolución)
-- Si no existe pago confirmado retorna 0.
-- 
-- Retorna   : DECIMAL(10,2) monto a reembolsar
-- Usado en  : cancelar_cita (cálculo automático de reembolso)
-- ------------------------------------------------------------
CREATE OR ALTER FUNCTION dbo.FN_MontoDevolucion(
    @Folio_Cita        INT,
    @Fecha_Cancelacion DATETIME
)
RETURNS DECIMAL(10,2)
AS
BEGIN
    DECLARE @Monto      DECIMAL(10,2) = 0.00;
    DECLARE @FechaCita  DATETIME;
    DECLARE @HorasAntes INT;

    -- Obtener monto pagado y datetime exacto de la cita
    SELECT
        @FechaCita = CAST(c.Fecha_Cita AS DATETIME)
                     + CAST(c.Hora_Cita AS DATETIME),
        @Monto     = ISNULL(p.Monto, 0.00)
    FROM  Cita c
    LEFT JOIN Pago p ON p.Folio_Cita = c.Folio_Cita
                    AND p.Estado     = 'Pagado'
    WHERE c.Folio_Cita = @Folio_Cita;

    IF @Monto = 0.00 OR @FechaCita IS NULL
        RETURN 0.00;

    SET @HorasAntes = DATEDIFF(hour, @Fecha_Cancelacion, @FechaCita);

    RETURN CASE
        WHEN @HorasAntes >= 48 THEN @Monto
        WHEN @HorasAntes >= 24 THEN CAST(@Monto * 0.50 AS DECIMAL(10,2))
        ELSE 0.00
    END;
END;
GO

-- ------------------------------------------------------------
-- FN_StockSuficiente
-- Verifica si hay suficiente inventario de un
-- medicamento para cubrir la cantidad solicitada.
-- 
-- Retorna   : BIT  1 = stock suficiente, 0 = insuficiente/no existe
-- Usado en  : crear solicitud de compra, validaciones de venta
-- ------------------------------------------------------------
CREATE OR ALTER FUNCTION dbo.FN_StockSuficiente(
    @Id_Farmacia INT,
    @Cantidad    INT
)
RETURNS BIT
AS
BEGIN
    DECLARE @Stock INT = 0;
    SELECT @Stock = Stock FROM Farmacia WHERE Id_Farmacia = @Id_Farmacia;
    IF @Stock IS NULL RETURN 0;
    IF @Stock >= @Cantidad RETURN 1;
    RETURN 0;
END;
GO


-- ============================================================
-- VISTAS

-- ------------------------------------------------------------
-- VW_CitasCompletas
-- Vista de todas las citas con datos del
-- paciente, doctor, especialidad, consultorio y pago.
-- Centraliza el JOIN más complejo del sistema y evita
-- repetirlo en cada consulta de la API.
--
-- Usado en  : listar_citas (recepcionista), citas del paciente,
--             citas del doctor, dashboard de recepcionista
-- ------------------------------------------------------------
CREATE OR ALTER VIEW dbo.VW_CitasCompletas AS
SELECT
    c.Folio_Cita,
    c.Fecha_Cita,
    c.Hora_Cita,
    c.Solicitud_Cita,
    c.Id_EstatusCita,
    ec.Clave            AS Estatus,
    ec.Descripcion      AS DescripcionEstatus,
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
JOIN EstatusCita  ec ON c.Id_EstatusCita  = ec.Id_EstatusCita
JOIN Paciente     pa ON c.Id_Paciente     = pa.Id_Paciente
JOIN Usuario      up ON pa.Id_Usuario     = up.Id_Usuario
JOIN Doctor       d  ON c.Id_Doctor       = d.Id_Doctor
JOIN Usuario      ud ON d.Id_Usuario      = ud.Id_Usuario
JOIN Especialidad e  ON d.Id_Especialidad = e.Id_Especialidad
LEFT JOIN Consultorio co
       ON c.Id_Consultorio = co.Id_Consultorio
LEFT JOIN (
    -- Tomar el pago más reciente por cita (evita duplicados)
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY Folio_Cita
               ORDER BY FechaPago DESC
           ) AS rn
    FROM Pago
    WHERE Folio_Cita IS NOT NULL
) pg ON pg.Folio_Cita = c.Folio_Cita AND pg.rn = 1;
GO

-- ------------------------------------------------------------
-- VW_AgendaDoctor
-- Vista de la agenda de cada doctor. Muestra solo
-- citas activas (pendientes de pago o confirmadas)
-- ordenadas por fecha y hora ascendente.
-- 
-- Usado en  : dashboard del doctor (inicio + citas asignadas)
-- ------------------------------------------------------------
CREATE OR ALTER VIEW dbo.VW_AgendaDoctor AS
SELECT
    d.Id_Doctor,
    ud.Nombre           AS NombreDoctor,
    ud.Ap_Paterno       AS ApPaternoDoctor,
    e.Especialidad,
    c.Folio_Cita,
    c.Fecha_Cita,
    c.Hora_Cita,
    c.Solicitud_Cita,
    ec.Clave            AS Estatus,
    ec.Descripcion      AS DescripcionEstatus,
    -- Paciente
    c.Id_Paciente,
    pa.Id_Usuario       AS Id_UsuarioPaciente,
    up.Nombre           AS NombrePaciente,
    up.Ap_Paterno       AS ApPaternoPaciente,
    up.Ap_Materno       AS ApMaternoPaciente,
    up.Telefono         AS TelefonoPaciente,
    up.Email            AS EmailPaciente,
    dbo.FN_CalcularEdad(up.Fecha_Nac) AS EdadPaciente,
    -- Consultorio
    c.Id_Consultorio,
    co.Nombre           AS NombreConsultorio,
    co.Piso             AS PisoConsultorio
FROM Cita c
JOIN EstatusCita  ec ON c.Id_EstatusCita  = ec.Id_EstatusCita
JOIN Doctor       d  ON c.Id_Doctor       = d.Id_Doctor
JOIN Usuario      ud ON d.Id_Usuario      = ud.Id_Usuario
JOIN Especialidad e  ON d.Id_Especialidad = e.Id_Especialidad
JOIN Paciente     pa ON c.Id_Paciente     = pa.Id_Paciente
JOIN Usuario      up ON pa.Id_Usuario     = up.Id_Usuario
LEFT JOIN Consultorio co ON c.Id_Consultorio = co.Id_Consultorio
WHERE ec.Clave IN ('agendada_pendiente_pago', 'pagada_pendiente_atender');
GO

-- ------------------------------------------------------------
-- VW_InventarioFarmacia
-- Vista del inventario de medicamentos enriquecida
-- con una columna de alerta de stock calculada y un
-- flag de disponibilidad para el catálogo público.
--
-- Usado en  : catalogo público (landing page), farmacia del
--             paciente, gestión de inventario de recepcionista
-- ------------------------------------------------------------
CREATE OR ALTER VIEW dbo.VW_InventarioFarmacia AS
SELECT
    f.Id_Farmacia,
    f.Nombre,
    f.Descripcion,
    f.Precio,
    f.Unidad,
    f.Stock,
    CASE
        WHEN f.Stock =  0  THEN 'Agotado'
        WHEN f.Stock < 10  THEN 'Stock Crítico'
        WHEN f.Stock < 30  THEN 'Stock Bajo'
        ELSE                    'Disponible'
    END AS AlertaStock,
    CAST(CASE WHEN f.Stock > 0 THEN 1 ELSE 0 END AS BIT) AS Disponible
FROM Farmacia f;
GO

-- ------------------------------------------------------------
-- VW_HistorialPaciente
-- Vista consolidada del historial clínico completo
-- de cada paciente: datos personales, ficha médica
-- (tipo de sangre, alergias, etc.), historial de
-- citas y recetas emitidas.
-- Cada fila combina una cita con su receta (si existe).
--
-- Usado en  : mis-recetas del paciente, historial del paciente,
--             consulta del doctor sobre su paciente
-- ------------------------------------------------------------
CREATE OR ALTER VIEW dbo.VW_HistorialPaciente AS
SELECT
    pa.Id_Paciente,
    pa.Id_Usuario,
    up.Nombre           AS NombrePaciente,
    up.Ap_Paterno       AS ApPaternoPaciente,
    up.Ap_Materno       AS ApMaternoPaciente,
    up.Email            AS EmailPaciente,
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
    ec.Clave            AS EstatusCita,
    ec.Descripcion      AS DescripcionEstatus,
    -- Doctor (NULL si no tiene citas)
    d.Id_Doctor,
    ud.Nombre           AS NombreDoctor,
    ud.Ap_Paterno       AS ApPaternoDoctor,
    d.Cedula_prof,
    e.Especialidad,
    -- Receta (NULL si la cita no generó receta)
    r.Id_Receta,
    r.Medicamento,
    r.Tratamiento,
    r.Observaciones,
    r.FechaEmision
FROM Paciente pa
JOIN Usuario           up ON pa.Id_Usuario    = up.Id_Usuario
LEFT JOIN Historial_medico hm ON hm.Id_Paciente  = pa.Id_Paciente
LEFT JOIN Cita          c  ON c.Id_Paciente   = pa.Id_Paciente
LEFT JOIN EstatusCita   ec ON c.Id_EstatusCita = ec.Id_EstatusCita
LEFT JOIN Doctor        d  ON c.Id_Doctor      = d.Id_Doctor
LEFT JOIN Usuario       ud ON d.Id_Usuario     = ud.Id_Usuario
LEFT JOIN Especialidad  e  ON d.Id_Especialidad = e.Id_Especialidad
LEFT JOIN Receta        r  ON r.Folio_Cita     = c.Folio_Cita;
GO

PRINT 'Vistas y funciones creadas exitosamente.';
GO

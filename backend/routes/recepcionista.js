const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const { authMiddleware, checkUserType } = require('../middleware/auth');

// GET /api/recepcionistas/dashboard - Estadísticas del dashboard
router.get('/dashboard', authMiddleware, checkUserType('recepcionista'), async (req, res) => {
    try {
        const pool = await getConnection();

        // Obtener estadísticas
        const stats = await pool.request().query(`
            SELECT
                (SELECT COUNT(*) FROM Cita WHERE fecha_cita = CAST(GETDATE() AS DATE)) as citas_hoy,
                (SELECT COUNT(*) FROM Cita WHERE estatus = 'agendada_pendiente_pago') as citas_pendientes_pago,
                (SELECT COUNT(*) FROM Cita WHERE estatus = 'pagada_pendiente_atender' AND fecha_cita = CAST(GETDATE() AS DATE)) as citas_pendientes_hoy,
                (SELECT COUNT(*) FROM Paciente WHERE activo = 1) as total_pacientes,
                (SELECT COUNT(*) FROM Doctor d INNER JOIN Empleado e ON d.id_empleado = e.id_empleado WHERE e.activo = 1) as total_doctores,
                (SELECT SUM(m.stock * m.precio_unitario) FROM Medicamento m WHERE m.activo = 1) as valor_inventario
        `);

        // Citas próximas
        const citasProximas = await pool.request().query(`
            SELECT TOP 10
                c.folio_cita,
                c.fecha_cita,
                c.hora_cita,
                c.estatus,
                p.nombre + ' ' + p.apellido_paterno as paciente,
                e.nombre + ' ' + e.apellido_paterno as doctor,
                esp.nombre as especialidad
            FROM Cita c
            INNER JOIN Paciente p ON c.id_paciente = p.id_paciente
            INNER JOIN Doctor d ON c.id_doctor = d.id_doctor
            INNER JOIN Empleado e ON d.id_empleado = e.id_empleado
            INNER JOIN Especialidad esp ON d.id_especialidad = esp.id_especialidad
            WHERE c.fecha_cita >= CAST(GETDATE() AS DATE)
            AND c.estatus IN ('agendada_pendiente_pago', 'pagada_pendiente_atender')
            ORDER BY c.fecha_cita, c.hora_cita
        `);

        res.json({
            success: true,
            estadisticas: stats.recordset[0],
            citas_proximas: citasProximas.recordset
        });

    } catch (error) {
        console.error('Error al obtener dashboard:', error);
        res.status(500).json({
            error: 'Error al obtener información del dashboard',
            details: error.message
        });
    }
});

// GET /api/recepcionistas/bitacora/estatus - Bitácora de estatus de citas
router.get('/bitacora/estatus', authMiddleware, checkUserType('recepcionista'), async (req, res) => {
    try {
        const pool = await getConnection();
        const { fecha_inicio, fecha_fin, limit } = req.query;

        let query = `
            SELECT TOP ${limit || 50}
                b.id_bitacora_estatus,
                b.folio_cita,
                b.fecha_movimiento,
                b.estatus_cita,
                b.fecha_cita,
                esp.nombre as especialidad,
                b.costo,
                b.politica_cancelacion,
                b.monto_devuelto
            FROM BitacoraEstatusCita b
            LEFT JOIN Especialidad esp ON b.id_especialidad = esp.id_especialidad
            WHERE 1=1
        `;

        const request = pool.request();

        if (fecha_inicio) {
            query += ' AND b.fecha_movimiento >= @fecha_inicio';
            request.input('fecha_inicio', sql.DateTime, fecha_inicio);
        }

        if (fecha_fin) {
            query += ' AND b.fecha_movimiento <= @fecha_fin';
            request.input('fecha_fin', sql.DateTime, fecha_fin);
        }

        query += ' ORDER BY b.fecha_movimiento DESC';

        const result = await request.query(query);

        res.json({
            success: true,
            count: result.recordset.length,
            bitacora: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener bitácora:', error);
        res.status(500).json({
            error: 'Error al obtener bitácora',
            details: error.message
        });
    }
});

// GET /api/recepcionistas/bitacora/historial - Bitácora de historial de citas
router.get('/bitacora/historial', authMiddleware, checkUserType('recepcionista'), async (req, res) => {
    try {
        const pool = await getConnection();
        const { fecha_inicio, fecha_fin, limit } = req.query;

        let query = `
            SELECT TOP ${limit || 50}
                b.id_historial_bitacora,
                b.usuario,
                b.tipo_usuario,
                b.ip_maquina,
                b.folio_cita,
                b.fecha_cita,
                b.hora_cita,
                b.folio_receta,
                b.estatus_consulta,
                b.especialidad,
                b.consultorio,
                b.fecha_registro
            FROM BitacoraHistorialCitas b
            WHERE 1=1
        `;

        const request = pool.request();

        if (fecha_inicio) {
            query += ' AND b.fecha_registro >= @fecha_inicio';
            request.input('fecha_inicio', sql.DateTime, fecha_inicio);
        }

        if (fecha_fin) {
            query += ' AND b.fecha_registro <= @fecha_fin';
            request.input('fecha_fin', sql.DateTime, fecha_fin);
        }

        query += ' ORDER BY b.fecha_registro DESC';

        const result = await request.query(query);

        res.json({
            success: true,
            count: result.recordset.length,
            bitacora: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener bitácora:', error);
        res.status(500).json({
            error: 'Error al obtener bitácora de historial',
            details: error.message
        });
    }
});

module.exports = router;

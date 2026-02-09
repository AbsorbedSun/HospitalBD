const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getConnection, sql } = require('../config/database');
const { authMiddleware, checkUserType } = require('../middleware/auth');

// GET /api/citas - Obtener citas (requiere autenticación)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const pool = await getConnection();
        const { tipo_usuario, id_paciente, id_doctor } = req.user;
        const { estatus, fecha_inicio, fecha_fin } = req.query;

        let query = `
            SELECT 
                c.id_cita,
                c.folio_cita,
                c.fecha_cita,
                c.hora_cita,
                c.estatus,
                c.fecha_agendada,
                c.limite_pago,
                p.nombre + ' ' + p.apellido_paterno + ' ' + ISNULL(p.apellido_materno, '') as nombre_paciente,
                e.nombre + ' ' + e.apellido_paterno as nombre_doctor,
                esp.nombre as especialidad,
                esp.costo_consulta,
                cons.numero_consultorio,
                pag.folio_pago,
                pag.estatus as estatus_pago,
                pag.monto
            FROM Cita c
            INNER JOIN Paciente p ON c.id_paciente = p.id_paciente
            INNER JOIN Doctor d ON c.id_doctor = d.id_doctor
            INNER JOIN Empleado e ON d.id_empleado = e.id_empleado
            INNER JOIN Especialidad esp ON d.id_especialidad = esp.id_especialidad
            INNER JOIN Consultorio cons ON c.id_consultorio = cons.id_consultorio
            LEFT JOIN Pago pag ON c.id_pago = pag.id_pago
            WHERE 1=1
        `;

        const request = pool.request();

        // Filtrar por tipo de usuario
        if (tipo_usuario === 'paciente') {
            query += ' AND c.id_paciente = @id_paciente';
            request.input('id_paciente', sql.Int, id_paciente);
        } else if (tipo_usuario === 'doctor') {
            query += ' AND c.id_doctor = @id_doctor';
            request.input('id_doctor', sql.Int, id_doctor);
        }

        // Filtros adicionales
        if (estatus) {
            query += ' AND c.estatus = @estatus';
            request.input('estatus', sql.VarChar, estatus);
        }

        if (fecha_inicio) {
            query += ' AND c.fecha_cita >= @fecha_inicio';
            request.input('fecha_inicio', sql.Date, fecha_inicio);
        }

        if (fecha_fin) {
            query += ' AND c.fecha_cita <= @fecha_fin';
            request.input('fecha_fin', sql.Date, fecha_fin);
        }

        query += ' ORDER BY c.fecha_cita DESC, c.hora_cita DESC';

        const result = await request.query(query);

        res.json({
            success: true,
            count: result.recordset.length,
            citas: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener citas:', error);
        res.status(500).json({
            error: 'Error al obtener citas',
            details: error.message
        });
    }
});

// POST /api/citas/agendar - Agendar nueva cita (Paciente)
router.post('/agendar',
    authMiddleware,
    checkUserType('paciente'),
    [
        body('id_doctor').isInt().withMessage('ID de doctor inválido'),
        body('fecha_cita').isDate().withMessage('Fecha inválida'),
        body('hora_cita').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Hora inválida')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id_doctor, fecha_cita, hora_cita } = req.body;
            const { id_paciente } = req.user;

            const pool = await getConnection();

            // Ejecutar procedimiento almacenado
            const result = await pool.request()
                .input('id_paciente', sql.Int, id_paciente)
                .input('id_doctor', sql.Int, id_doctor)
                .input('fecha_cita', sql.Date, fecha_cita)
                .input('hora_cita', sql.Time, hora_cita)
                .output('resultado', sql.Int)
                .output('mensaje', sql.VarChar(200))
                .execute('sp_AgendarCita');

            const resultado = result.output.resultado;
            const mensaje = result.output.mensaje;

            if (resultado > 0) {
                // Obtener información de la cita creada
                const citaInfo = await pool.request()
                    .input('id_cita', sql.Int, resultado)
                    .query(`
                        SELECT 
                            c.folio_cita,
                            c.fecha_cita,
                            c.hora_cita,
                            c.limite_pago,
                            cons.numero_consultorio,
                            esp.nombre as especialidad,
                            e.nombre + ' ' + e.apellido_paterno as nombre_doctor,
                            pag.folio_pago,
                            pag.monto
                        FROM Cita c
                        INNER JOIN Doctor d ON c.id_doctor = d.id_doctor
                        INNER JOIN Empleado e ON d.id_empleado = e.id_empleado
                        INNER JOIN Especialidad esp ON d.id_especialidad = esp.id_especialidad
                        INNER JOIN Consultorio cons ON c.id_consultorio = cons.id_consultorio
                        INNER JOIN Pago pag ON c.id_pago = pag.id_pago
                        WHERE c.id_cita = @id_cita
                    `);

                res.status(201).json({
                    success: true,
                    message: mensaje,
                    cita: citaInfo.recordset[0]
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: mensaje
                });
            }

        } catch (error) {
            console.error('Error al agendar cita:', error);
            res.status(500).json({
                error: 'Error al agendar cita',
                details: error.message
            });
        }
    }
);

// POST /api/citas/cancelar - Cancelar cita
router.post('/cancelar/:folio_cita',
    authMiddleware,
    checkUserType('paciente', 'doctor', 'recepcionista'),
    async (req, res) => {
        try {
            const { folio_cita } = req.params;
            const { motivo_cancelacion } = req.body;
            const { tipo_usuario } = req.user;

            const pool = await getConnection();

            let tipo_cancelacion = tipo_usuario === 'doctor' ? 'doctor' : 'paciente';

            const result = await pool.request()
                .input('folio_cita', sql.VarChar, folio_cita)
                .input('motivo_cancelacion', sql.VarChar, motivo_cancelacion || 'Sin especificar')
                .input('tipo_cancelacion', sql.VarChar, tipo_cancelacion)
                .output('resultado', sql.Int)
                .output('mensaje', sql.VarChar(200))
                .execute('sp_CancelarCita');

            const resultado = result.output.resultado;
            const mensaje = result.output.mensaje;

            if (resultado === 1) {
                res.json({
                    success: true,
                    message: mensaje
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: mensaje
                });
            }

        } catch (error) {
            console.error('Error al cancelar cita:', error);
            res.status(500).json({
                error: 'Error al cancelar cita',
                details: error.message
            });
        }
    }
);

// POST /api/citas/pagar - Confirmar pago de cita
router.post('/pagar',
    authMiddleware,
    checkUserType('paciente', 'recepcionista'),
    [
        body('folio_pago').notEmpty().withMessage('Folio de pago requerido'),
        body('metodo_pago').isIn(['efectivo', 'tarjeta', 'transferencia']).withMessage('Método de pago inválido')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { folio_pago, metodo_pago } = req.body;

            const pool = await getConnection();

            const result = await pool.request()
                .input('folio_pago', sql.VarChar, folio_pago)
                .input('metodo_pago', sql.VarChar, metodo_pago)
                .output('resultado', sql.Int)
                .output('mensaje', sql.VarChar(200))
                .execute('sp_ConfirmarPago');

            const resultado = result.output.resultado;
            const mensaje = result.output.mensaje;

            if (resultado === 1) {
                res.json({
                    success: true,
                    message: mensaje
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: mensaje
                });
            }

        } catch (error) {
            console.error('Error al confirmar pago:', error);
            res.status(500).json({
                error: 'Error al confirmar pago',
                details: error.message
            });
        }
    }
);

// GET /api/citas/horarios-disponibles - Obtener horarios disponibles de un doctor
router.get('/horarios-disponibles/:id_doctor', async (req, res) => {
    try {
        const { id_doctor } = req.params;
        const { fecha_inicio, fecha_fin } = req.query;

        if (!fecha_inicio || !fecha_fin) {
            return res.status(400).json({
                error: 'Se requieren fecha_inicio y fecha_fin'
            });
        }

        const pool = await getConnection();

        const result = await pool.request()
            .input('id_doctor', sql.Int, id_doctor)
            .input('fecha_inicio', sql.Date, fecha_inicio)
            .input('fecha_fin', sql.Date, fecha_fin)
            .execute('sp_ObtenerHorariosDisponibles');

        res.json({
            success: true,
            horarios: result.recordsets[0],
            citas_ocupadas: result.recordsets[1]
        });

    } catch (error) {
        console.error('Error al obtener horarios:', error);
        res.status(500).json({
            error: 'Error al obtener horarios disponibles',
            details: error.message
        });
    }
});

module.exports = router;

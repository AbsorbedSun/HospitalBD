const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getConnection, sql } = require('../config/database');
const { authMiddleware, checkUserType } = require('../middleware/auth');

// GET /api/doctores/perfil - Obtener perfil del doctor actual
router.get('/perfil', authMiddleware, checkUserType('doctor'), async (req, res) => {
    try {
        const { id_doctor } = req.user;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_doctor', sql.Int, id_doctor)
            .query(`
                SELECT 
                    d.id_doctor,
                    e.numero_empleado,
                    e.nombre,
                    e.apellido_paterno,
                    e.apellido_materno,
                    e.curp,
                    e.telefono,
                    e.email,
                    d.cedula_profesional,
                    esp.nombre as especialidad,
                    esp.id_especialidad,
                    cons.numero_consultorio,
                    cons.piso,
                    cons.edificio
                FROM Doctor d
                INNER JOIN Empleado e ON d.id_empleado = e.id_empleado
                INNER JOIN Especialidad esp ON d.id_especialidad = esp.id_especialidad
                LEFT JOIN Consultorio cons ON d.id_consultorio = cons.id_consultorio
                WHERE d.id_doctor = @id_doctor
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Doctor no encontrado'
            });
        }

        res.json({
            success: true,
            doctor: result.recordset[0]
        });

    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({
            error: 'Error al obtener perfil del doctor',
            details: error.message
        });
    }
});

// GET /api/doctores/horarios - Obtener horarios del doctor
router.get('/horarios', authMiddleware, checkUserType('doctor'), async (req, res) => {
    try {
        const { id_doctor } = req.user;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_doctor', sql.Int, id_doctor)
            .query(`
                SELECT 
                    id_horario,
                    dia_semana,
                    CASE dia_semana
                        WHEN 1 THEN 'Lunes'
                        WHEN 2 THEN 'Martes'
                        WHEN 3 THEN 'Miércoles'
                        WHEN 4 THEN 'Jueves'
                        WHEN 5 THEN 'Viernes'
                        WHEN 6 THEN 'Sábado'
                        WHEN 7 THEN 'Domingo'
                    END as dia_nombre,
                    hora_inicio,
                    hora_fin,
                    activo
                FROM HorarioDoctor
                WHERE id_doctor = @id_doctor
                ORDER BY dia_semana
            `);

        res.json({
            success: true,
            horarios: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener horarios:', error);
        res.status(500).json({
            error: 'Error al obtener horarios',
            details: error.message
        });
    }
});

// GET /api/doctores/pacientes - Obtener lista de pacientes del doctor
router.get('/pacientes', authMiddleware, checkUserType('doctor'), async (req, res) => {
    try {
        const { id_doctor } = req.user;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_doctor', sql.Int, id_doctor)
            .query(`
                SELECT DISTINCT
                    p.id_paciente,
                    p.nombre,
                    p.apellido_paterno,
                    p.apellido_materno,
                    p.edad,
                    p.sexo,
                    p.telefono,
                    p.email,
                    (
                        SELECT COUNT(*) 
                        FROM Cita c 
                        WHERE c.id_paciente = p.id_paciente 
                        AND c.id_doctor = @id_doctor
                        AND c.estatus = 'atendida'
                    ) as total_consultas,
                    (
                        SELECT TOP 1 fecha_cita 
                        FROM Cita c 
                        WHERE c.id_paciente = p.id_paciente 
                        AND c.id_doctor = @id_doctor
                        ORDER BY c.fecha_cita DESC
                    ) as ultima_consulta
                FROM Paciente p
                INNER JOIN Cita c ON p.id_paciente = c.id_paciente
                WHERE c.id_doctor = @id_doctor
                AND p.activo = 1
                ORDER BY p.nombre, p.apellido_paterno
            `);

        res.json({
            success: true,
            count: result.recordset.length,
            pacientes: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener pacientes:', error);
        res.status(500).json({
            error: 'Error al obtener pacientes',
            details: error.message
        });
    }
});

// GET /api/doctores/pacientes/:id_paciente/historial - Obtener historial médico de un paciente
router.get('/pacientes/:id_paciente/historial', 
    authMiddleware, 
    checkUserType('doctor'), 
    async (req, res) => {
        try {
            const { id_paciente } = req.params;
            const pool = await getConnection();

            const result = await pool.request()
                .input('id_paciente', sql.Int, id_paciente)
                .query(`
                    SELECT 
                        h.id_historial,
                        p.nombre + ' ' + p.apellido_paterno + ' ' + ISNULL(p.apellido_materno, '') as nombre_paciente,
                        h.tipo_sangre,
                        h.alergias,
                        h.padecimientos_previos,
                        h.peso,
                        h.estatura,
                        h.fecha_actualizacion,
                        p.edad,
                        p.sexo
                    FROM HistorialMedico h
                    INNER JOIN Paciente p ON h.id_paciente = p.id_paciente
                    WHERE h.id_paciente = @id_paciente
                `);

            res.json({
                success: true,
                historial: result.recordset.length > 0 ? result.recordset[0] : null
            });

        } catch (error) {
            console.error('Error al obtener historial:', error);
            res.status(500).json({
                error: 'Error al obtener historial médico',
                details: error.message
            });
        }
    }
);

// POST /api/doctores/recetas - Crear receta médica
router.post('/recetas',
    authMiddleware,
    checkUserType('doctor'),
    [
        body('id_cita').isInt().withMessage('ID de cita inválido'),
        body('diagnostico').notEmpty().withMessage('El diagnóstico es requerido'),
        body('tratamiento').notEmpty().withMessage('El tratamiento es requerido')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id_cita, diagnostico, tratamiento, observaciones } = req.body;
            const pool = await getConnection();

            // Verificar que la cita pertenezca al doctor
            const citaCheck = await pool.request()
                .input('id_cita', sql.Int, id_cita)
                .input('id_doctor', sql.Int, req.user.id_doctor)
                .query(`
                    SELECT id_paciente
                    FROM Cita
                    WHERE id_cita = @id_cita
                    AND id_doctor = @id_doctor
                `);

            if (citaCheck.recordset.length === 0) {
                return res.status(403).json({
                    error: 'Esta cita no pertenece a tu consulta'
                });
            }

            const result = await pool.request()
                .input('id_cita', sql.Int, id_cita)
                .input('diagnostico', sql.VarChar, diagnostico)
                .input('tratamiento', sql.VarChar, tratamiento)
                .input('observaciones', sql.VarChar, observaciones || '')
                .input('medicamentos', sql.NVarChar, '[]')
                .output('resultado', sql.Int)
                .output('mensaje', sql.VarChar(200))
                .execute('sp_CrearReceta');

            const resultado = result.output.resultado;
            const mensaje = result.output.mensaje;

            if (resultado > 0) {
                res.status(201).json({
                    success: true,
                    message: mensaje,
                    id_receta: resultado
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: mensaje
                });
            }

        } catch (error) {
            console.error('Error al crear receta:', error);
            res.status(500).json({
                error: 'Error al crear receta',
                details: error.message
            });
        }
    }
);

// GET /api/doctores - Listar todos los doctores (público o recepcionista)
router.get('/', async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_especialidad } = req.query;

        let query = `
            SELECT 
                d.id_doctor,
                e.nombre + ' ' + e.apellido_paterno + ' ' + ISNULL(e.apellido_materno, '') as nombre_completo,
                d.cedula_profesional,
                esp.nombre as especialidad,
                esp.id_especialidad,
                cons.numero_consultorio
            FROM Doctor d
            INNER JOIN Empleado e ON d.id_empleado = e.id_empleado
            INNER JOIN Especialidad esp ON d.id_especialidad = esp.id_especialidad
            LEFT JOIN Consultorio cons ON d.id_consultorio = cons.id_consultorio
            WHERE e.activo = 1
        `;

        const request = pool.request();

        if (id_especialidad) {
            query += ' AND d.id_especialidad = @id_especialidad';
            request.input('id_especialidad', sql.Int, id_especialidad);
        }

        query += ' ORDER BY e.nombre, e.apellido_paterno';

        const result = await request.query(query);

        res.json({
            success: true,
            count: result.recordset.length,
            doctores: result.recordset
        });

    } catch (error) {
        console.error('Error al listar doctores:', error);
        res.status(500).json({
            error: 'Error al listar doctores',
            details: error.message
        });
    }
});

module.exports = router;

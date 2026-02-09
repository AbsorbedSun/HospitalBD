const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// GET /api/especialidades - Obtener todas las especialidades activas
router.get('/', async (req, res) => {
    try {
        const pool = await getConnection();

        const result = await pool.request()
            .query(`
                SELECT 
                    id_especialidad,
                    nombre,
                    descripcion,
                    costo_consulta
                FROM Especialidad
                WHERE activa = 1
                ORDER BY nombre
            `);

        res.json({
            success: true,
            count: result.recordset.length,
            especialidades: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener especialidades:', error);
        res.status(500).json({
            error: 'Error al obtener especialidades',
            details: error.message
        });
    }
});

// GET /api/especialidades/:id - Obtener una especialidad específica
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_especialidad', sql.Int, id)
            .query(`
                SELECT 
                    id_especialidad,
                    nombre,
                    descripcion,
                    costo_consulta
                FROM Especialidad
                WHERE id_especialidad = @id_especialidad
                AND activa = 1
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Especialidad no encontrada'
            });
        }

        res.json({
            success: true,
            especialidad: result.recordset[0]
        });

    } catch (error) {
        console.error('Error al obtener especialidad:', error);
        res.status(500).json({
            error: 'Error al obtener especialidad',
            details: error.message
        });
    }
});

// GET /api/especialidades/:id/doctores - Obtener doctores de una especialidad
router.get('/:id/doctores', async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_especialidad', sql.Int, id)
            .query(`
                SELECT 
                    d.id_doctor,
                    e.nombre + ' ' + e.apellido_paterno + ' ' + ISNULL(e.apellido_materno, '') as nombre_completo,
                    d.cedula_profesional,
                    cons.numero_consultorio,
                    cons.piso,
                    cons.edificio,
                    (
                        SELECT COUNT(*) 
                        FROM Cita c 
                        WHERE c.id_doctor = d.id_doctor 
                        AND c.estatus IN ('pagada_pendiente_atender', 'atendida')
                    ) as total_citas
                FROM Doctor d
                INNER JOIN Empleado e ON d.id_empleado = e.id_empleado
                LEFT JOIN Consultorio cons ON d.id_consultorio = cons.id_consultorio
                WHERE d.id_especialidad = @id_especialidad
                AND e.activo = 1
                ORDER BY e.nombre, e.apellido_paterno
            `);

        res.json({
            success: true,
            count: result.recordset.length,
            doctores: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener doctores:', error);
        res.status(500).json({
            error: 'Error al obtener doctores de la especialidad',
            details: error.message
        });
    }
});

module.exports = router;

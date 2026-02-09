const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const { authMiddleware, checkUserType } = require('../middleware/auth');

// GET /api/pacientes/perfil - Obtener perfil del paciente actual
router.get('/perfil', authMiddleware, checkUserType('paciente'), async (req, res) => {
    try {
        const { id_paciente } = req.user;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_paciente', sql.Int, id_paciente)
            .query(`
                SELECT 
                    p.id_paciente,
                    p.nombre,
                    p.apellido_paterno,
                    p.apellido_materno,
                    p.fecha_nacimiento,
                    p.edad,
                    p.sexo,
                    p.curp,
                    p.telefono,
                    p.email,
                    p.direccion,
                    p.fecha_registro
                FROM Paciente p
                WHERE p.id_paciente = @id_paciente
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Paciente no encontrado'
            });
        }

        res.json({
            success: true,
            paciente: result.recordset[0]
        });

    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({
            error: 'Error al obtener perfil del paciente',
            details: error.message
        });
    }
});

// GET /api/pacientes/historial-medico - Obtener historial médico
router.get('/historial-medico', authMiddleware, checkUserType('paciente', 'doctor'), async (req, res) => {
    try {
        const { id_paciente } = req.user;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_paciente', sql.Int, id_paciente)
            .query(`
                SELECT 
                    h.id_historial,
                    h.tipo_sangre,
                    h.alergias,
                    h.padecimientos_previos,
                    h.peso,
                    h.estatura,
                    h.fecha_actualizacion
                FROM HistorialMedico h
                WHERE h.id_paciente = @id_paciente
            `);

        res.json({
            success: true,
            historial: result.recordset.length > 0 ? result.recordset[0] : null
        });

    } catch (error) {
        console.error('Error al obtener historial médico:', error);
        res.status(500).json({
            error: 'Error al obtener historial médico',
            details: error.message
        });
    }
});

// PUT /api/pacientes/perfil - Actualizar perfil del paciente
router.put('/perfil', authMiddleware, checkUserType('paciente'), async (req, res) => {
    try {
        const { id_paciente } = req.user;
        const { telefono, email, direccion } = req.body;
        const pool = await getConnection();

        const request = pool.request()
            .input('id_paciente', sql.Int, id_paciente);

        let updates = [];
        if (telefono) {
            updates.push('telefono = @telefono');
            request.input('telefono', sql.VarChar, telefono);
        }
        if (email) {
            updates.push('email = @email');
            request.input('email', sql.VarChar, email);
        }
        if (direccion) {
            updates.push('direccion = @direccion');
            request.input('direccion', sql.VarChar, direccion);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No se proporcionaron campos para actualizar'
            });
        }

        await request.query(`
            UPDATE Paciente
            SET ${updates.join(', ')}
            WHERE id_paciente = @id_paciente
        `);

        res.json({
            success: true,
            message: 'Perfil actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({
            error: 'Error al actualizar perfil',
            details: error.message
        });
    }
});

// GET /api/pacientes - Listar todos los pacientes (Solo recepcionista)
router.get('/', authMiddleware, checkUserType('recepcionista'), async (req, res) => {
    try {
        const pool = await getConnection();
        const { buscar } = req.query;

        let query = `
            SELECT 
                p.id_paciente,
                p.nombre,
                p.apellido_paterno,
                p.apellido_materno,
                p.fecha_nacimiento,
                p.edad,
                p.sexo,
                p.telefono,
                p.email,
                p.fecha_registro,
                (SELECT COUNT(*) FROM Cita WHERE id_paciente = p.id_paciente) as total_citas
            FROM Paciente p
            WHERE p.activo = 1
        `;

        const request = pool.request();

        if (buscar) {
            query += ` AND (
                p.nombre LIKE @buscar OR 
                p.apellido_paterno LIKE @buscar OR 
                p.apellido_materno LIKE @buscar OR
                p.email LIKE @buscar OR
                p.telefono LIKE @buscar
            )`;
            request.input('buscar', sql.VarChar, `%${buscar}%`);
        }

        query += ' ORDER BY p.fecha_registro DESC';

        const result = await request.query(query);

        res.json({
            success: true,
            count: result.recordset.length,
            pacientes: result.recordset
        });

    } catch (error) {
        console.error('Error al listar pacientes:', error);
        res.status(500).json({
            error: 'Error al listar pacientes',
            details: error.message
        });
    }
});

module.exports = router;

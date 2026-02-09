const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getConnection, sql } = require('../config/database');

// Validaciones
const loginValidation = [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('La contraseña es requerida'),
    body('userType').isIn(['paciente', 'doctor', 'recepcionista']).withMessage('Tipo de usuario inválido')
];

const registerValidation = [
    body('firstName').notEmpty().withMessage('El nombre es requerido'),
    body('lastName').notEmpty().withMessage('El apellido es requerido'),
    body('email').isEmail().withMessage('Email inválido'),
    body('phone').notEmpty().withMessage('El teléfono es requerido'),
    body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
];

// POST /api/auth/login
router.post('/login', loginValidation, async (req, res) => {
    try {
        // Validar errores
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, userType } = req.body;

        const pool = await getConnection();
        
        // Buscar usuario
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .input('tipo_usuario', sql.VarChar, userType)
            .query(`
                SELECT 
                    u.id_usuario,
                    u.email,
                    u.password_hash,
                    u.tipo_usuario,
                    u.activo
                FROM Usuario u
                WHERE u.email = @email 
                AND u.tipo_usuario = @tipo_usuario
                AND u.activo = 1
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        const user = result.recordset[0];

        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        // Obtener información adicional según tipo de usuario
        let userData = {
            id_usuario: user.id_usuario,
            email: user.email,
            tipo_usuario: user.tipo_usuario
        };

        if (userType === 'paciente') {
            const pacienteResult = await pool.request()
                .input('id_usuario', sql.Int, user.id_usuario)
                .query(`
                    SELECT 
                        p.id_paciente,
                        p.nombre,
                        p.apellido_paterno,
                        p.apellido_materno,
                        p.telefono
                    FROM Paciente p
                    WHERE p.id_usuario = @id_usuario
                `);
            
            if (pacienteResult.recordset.length > 0) {
                userData = { ...userData, ...pacienteResult.recordset[0] };
            }
        } else if (userType === 'doctor') {
            const doctorResult = await pool.request()
                .input('id_usuario', sql.Int, user.id_usuario)
                .query(`
                    SELECT 
                        d.id_doctor,
                        e.nombre,
                        e.apellido_paterno,
                        e.apellido_materno,
                        d.cedula_profesional,
                        esp.nombre as especialidad
                    FROM Doctor d
                    INNER JOIN Empleado e ON d.id_empleado = e.id_empleado
                    INNER JOIN Especialidad esp ON d.id_especialidad = esp.id_especialidad
                    WHERE e.id_usuario = @id_usuario
                `);
            
            if (doctorResult.recordset.length > 0) {
                userData = { ...userData, ...doctorResult.recordset[0] };
            }
        } else if (userType === 'recepcionista') {
            const recepResult = await pool.request()
                .input('id_usuario', sql.Int, user.id_usuario)
                .query(`
                    SELECT 
                        r.id_recepcionista,
                        e.nombre,
                        e.apellido_paterno,
                        e.apellido_materno,
                        r.turno
                    FROM Recepcionista r
                    INNER JOIN Empleado e ON r.id_empleado = e.id_empleado
                    WHERE e.id_usuario = @id_usuario
                `);
            
            if (recepResult.recordset.length > 0) {
                userData = { ...userData, ...recepResult.recordset[0] };
            }
        }

        // Actualizar último acceso
        await pool.request()
            .input('id_usuario', sql.Int, user.id_usuario)
            .query('UPDATE Usuario SET ultimo_acceso = GETDATE() WHERE id_usuario = @id_usuario');

        // Generar token JWT
        const token = jwt.sign(
            userData,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            message: 'Login exitoso',
            token,
            user: userData
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            error: 'Error al iniciar sesión',
            details: error.message
        });
    }
});

// POST /api/auth/register (Solo para pacientes)
router.post('/register', registerValidation, async (req, res) => {
    try {
        // Validar errores
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { firstName, lastName, email, phone, password, fechaNacimiento, sexo } = req.body;

        const pool = await getConnection();

        // Verificar si el email ya existe
        const existingUser = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT id_usuario FROM Usuario WHERE email = @email');

        if (existingUser.recordset.length > 0) {
            return res.status(400).json({
                error: 'El email ya está registrado'
            });
        }

        // Hash de la contraseña
        const passwordHash = await bcrypt.hash(password, 10);

        // Iniciar transacción
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Crear usuario
            const userResult = await transaction.request()
                .input('email', sql.VarChar, email)
                .input('password_hash', sql.VarChar, passwordHash)
                .input('tipo_usuario', sql.VarChar, 'paciente')
                .query(`
                    INSERT INTO Usuario (email, password_hash, tipo_usuario)
                    OUTPUT INSERTED.id_usuario
                    VALUES (@email, @password_hash, @tipo_usuario)
                `);

            const idUsuario = userResult.recordset[0].id_usuario;

            // Crear paciente
            const pacienteResult = await transaction.request()
                .input('nombre', sql.VarChar, firstName)
                .input('apellido_paterno', sql.VarChar, lastName)
                .input('fecha_nacimiento', sql.Date, fechaNacimiento || '2000-01-01')
                .input('sexo', sql.Char, sexo || 'M')
                .input('telefono', sql.VarChar, phone)
                .input('email', sql.VarChar, email)
                .input('id_usuario', sql.Int, idUsuario)
                .query(`
                    INSERT INTO Paciente (nombre, apellido_paterno, fecha_nacimiento, sexo, telefono, email, id_usuario)
                    OUTPUT INSERTED.id_paciente
                    VALUES (@nombre, @apellido_paterno, @fecha_nacimiento, @sexo, @telefono, @email, @id_usuario)
                `);

            const idPaciente = pacienteResult.recordset[0].id_paciente;

            await transaction.commit();

            // Generar token
            const userData = {
                id_usuario: idUsuario,
                id_paciente: idPaciente,
                email,
                tipo_usuario: 'paciente',
                nombre: firstName,
                apellido_paterno: lastName
            };

            const token = jwt.sign(
                userData,
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            res.status(201).json({
                message: 'Registro exitoso',
                token,
                user: userData
            });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({
            error: 'Error al registrar usuario',
            details: error.message
        });
    }
});

// GET /api/auth/verify - Verificar token
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                valid: false,
                error: 'No se proporcionó token'
            });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        res.json({
            valid: true,
            user: decoded
        });
    } catch (error) {
        res.status(401).json({
            valid: false,
            error: 'Token inválido o expirado'
        });
    }
});

module.exports = router;

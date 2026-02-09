const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { getConnection } = require('./config/database');

// Importar rutas
const authRoutes = require('./routes/auth');
const pacienteRoutes = require('./routes/paciente');
const doctorRoutes = require('./routes/doctor');
const recepcionistaRoutes = require('./routes/recepcionista');
const citaRoutes = require('./routes/cita');
const especialidadRoutes = require('./routes/especialidad');
const farmaciaRoutes = require('./routes/farmacia');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5500',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Logging de requests

// Ruta de bienvenida
app.get('/', (req, res) => {
    res.json({
        message: 'API Sistema de Gestión Hospitalaria',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            pacientes: '/api/pacientes',
            doctores: '/api/doctores',
            recepcionistas: '/api/recepcionistas',
            citas: '/api/citas',
            especialidades: '/api/especialidades',
            farmacia: '/api/farmacia'
        }
    });
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT 1 as test');
        
        res.json({
            status: 'OK',
            database: 'Connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            database: 'Disconnected',
            error: error.message
        });
    }
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/doctores', doctorRoutes);
app.use('/api/recepcionistas', recepcionistaRoutes);
app.use('/api/citas', citaRoutes);
app.use('/api/especialidades', especialidadRoutes);
app.use('/api/farmacia', farmaciaRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.path
    });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Iniciar servidor
const startServer = async () => {
    try {
        // Verificar conexión a BD
        await getConnection();
        
        app.listen(PORT, () => {
            console.log('');
            console.log('╔════════════════════════════════════════════╗');
            console.log('║   Sistema de Gestión Hospitalaria - API   ║');
            console.log('╚════════════════════════════════════════════╝');
            console.log('');
            console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
            console.log(`📊 Base de datos: ${process.env.DB_DATABASE}`);
            console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
            console.log('');
            console.log('Endpoints disponibles:');
            console.log(`  - POST   /api/auth/login`);
            console.log(`  - POST   /api/auth/register`);
            console.log(`  - GET    /api/especialidades`);
            console.log(`  - GET    /api/citas`);
            console.log(`  - POST   /api/citas/agendar`);
            console.log('');
        });
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;

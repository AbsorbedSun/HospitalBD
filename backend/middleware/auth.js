const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        // Obtener token del header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'No se proporcionó token de autenticación'
            });
        }

        const token = authHeader.substring(7); // Remover 'Bearer '

        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Agregar información del usuario al request
        req.user = decoded;
        
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Token inválido'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expirado'
            });
        }
        
        return res.status(500).json({
            error: 'Error al verificar autenticación'
        });
    }
};

// Middleware para verificar tipo de usuario
const checkUserType = (...allowedTypes) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Usuario no autenticado'
            });
        }

        if (!allowedTypes.includes(req.user.tipo_usuario)) {
            return res.status(403).json({
                error: 'No tienes permisos para acceder a este recurso',
                requiredType: allowedTypes,
                yourType: req.user.tipo_usuario
            });
        }

        next();
    };
};

module.exports = {
    authMiddleware,
    checkUserType
};

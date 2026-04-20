"""
Decoradores para protección de rutas y control de acceso por rol.
"""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt


def requiere_auth(f):
    """Verifica que el request tenga un JWT válido."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception as e:
            return jsonify({'error': 'Token inválido o expirado. Inicia sesión nuevamente.'}), 401
        return f(*args, **kwargs)
    return wrapper


def requiere_rol(*roles):
    """
    Verifica que el usuario autenticado tenga uno de los roles indicados.

    Uso:
        @requiere_rol('doctor')
        @requiere_rol('recepcionista', 'admin')
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request()
                claims = get_jwt()
                rol_usuario = claims.get('rol', '')
                if rol_usuario not in roles:
                    return jsonify({
                        'error': f'Acceso denegado. Se requiere rol: {", ".join(roles)}'
                    }), 403
            except Exception:
                return jsonify({'error': 'Token inválido o expirado.'}), 401
            return f(*args, **kwargs)
        return wrapper
    return decorator

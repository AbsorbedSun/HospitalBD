"""
Rutas de autenticación: login, registro de paciente, verificar token.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt_identity, get_jwt
import bcrypt
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database.connection import get_db, execute_query, execute_insert_returning_id
from utils.decorators import requiere_auth

auth_bp = Blueprint('auth', __name__)

# Mapeo tipo_usuario (BD) → rol (JWT)
ROL_MAP = {
    1: 'paciente',
    2: 'doctor',
    3: 'recepcionista',
    4: 'admin'
}


# ------------------------------------------------------------------
# POST /api/auth/login
# ------------------------------------------------------------------
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email    = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return jsonify({'error': 'Email y contraseña son requeridos.'}), 400

    # Buscar usuario
    rows = execute_query(
        """
        SELECT u.Id_Usuario, u.Nombre, u.Ap_Paterno, u.Ap_Materno,
               u.Email, u.Contrasena, u.Id_TipoUsuario
        FROM Usuario u
        WHERE u.Email = ?
        """,
        (email,)
    )

    if not rows:
        return jsonify({'error': 'Credenciales incorrectas.'}), 401

    usuario = rows[0]

    # Verificar contraseña
    hash_bd = usuario['Contrasena']
    if isinstance(hash_bd, str):
        hash_bd = hash_bd.encode('utf-8')

    if not bcrypt.checkpw(password.encode('utf-8'), hash_bd):
        return jsonify({'error': 'Credenciales incorrectas.'}), 401

    tipo = usuario['Id_TipoUsuario']
    rol  = ROL_MAP.get(tipo, 'paciente')

    # Obtener Id específico según rol
    id_especifico = _get_id_especifico(usuario['Id_Usuario'], rol)

    # Crear JWT
    additional_claims = {
        'rol': rol,
        'id_usuario': usuario['Id_Usuario'],
        'id_especifico': id_especifico
    }
    token = create_access_token(
        identity=str(usuario['Id_Usuario']),
        additional_claims=additional_claims
    )

    return jsonify({
        'token': token,
        'user': {
            'id_usuario':    usuario['Id_Usuario'],
            'id_especifico': id_especifico,
            'nombre':        usuario['Nombre'],
            'ap_paterno':    usuario['Ap_Paterno'],
            'ap_materno':    usuario['Ap_Materno'] or '',
            'email':         usuario['Email'],
            'rol':           rol
        }
    }), 200


# ------------------------------------------------------------------
# POST /api/auth/register   (auto-registro de pacientes)
# ------------------------------------------------------------------
@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}

    # Campos requeridos
    required = ['nombre', 'ap_paterno', 'email', 'password', 'curp', 'fecha_nac']
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f'Campos faltantes: {", ".join(missing)}'}), 400

    email    = data['email'].strip().lower()
    password = data['password'].strip()

    if len(password) < 8:
        return jsonify({'error': 'La contraseña debe tener al menos 8 caracteres.'}), 400

    # Verificar email único
    existe = execute_query('SELECT 1 FROM Usuario WHERE Email = ?', (email,))
    if existe:
        return jsonify({'error': 'El correo electrónico ya está registrado.'}), 409

    # Verificar CURP único
    curp = data['curp'].strip().upper()
    existe_curp = execute_query('SELECT 1 FROM Usuario WHERE CURP = ?', (curp,))
    if existe_curp:
        return jsonify({'error': 'El CURP ya está registrado.'}), 409

    # Hash de contraseña
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = get_db()
    try:
        cursor = conn.cursor()

        # Insertar Usuario
        cursor.execute(
            """
            INSERT INTO Usuario
                (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno, CURP, Email,
                 Fecha_Nac, Contrasena, Telefono, Calle, Numero, Colonia)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            SELECT SCOPE_IDENTITY();
            """,
            (
                data['nombre'].strip(),
                data['ap_paterno'].strip(),
                data.get('ap_materno', '').strip() or None,
                curp,
                email,
                data['fecha_nac'],
                password_hash,
                data.get('telefono', '').strip() or None,
                data.get('calle', '').strip() or None,
                data.get('numero', '').strip() or None,
                data.get('colonia', '').strip() or None,
            )
        )
        id_usuario = int(cursor.fetchone()[0])

        # Insertar Paciente
        cursor.execute(
            'INSERT INTO Paciente (Id_Usuario) VALUES (?); SELECT SCOPE_IDENTITY();',
            (id_usuario,)
        )
        id_paciente = int(cursor.fetchone()[0])

        conn.commit()

        # Crear JWT
        token = create_access_token(
            identity=str(id_usuario),
            additional_claims={
                'rol': 'paciente',
                'id_usuario': id_usuario,
                'id_especifico': id_paciente
            }
        )

        return jsonify({
            'token': token,
            'user': {
                'id_usuario':    id_usuario,
                'id_especifico': id_paciente,
                'nombre':        data['nombre'].strip(),
                'ap_paterno':    data['ap_paterno'].strip(),
                'email':         email,
                'rol':           'paciente'
            }
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({'error': f'Error al registrar usuario: {str(e)}'}), 500
    finally:
        conn.close()


# ------------------------------------------------------------------
# GET /api/auth/verify   (verificar token activo)
# ------------------------------------------------------------------
@auth_bp.route('/verify', methods=['GET'])
@requiere_auth
def verify():
    claims = get_jwt()
    return jsonify({
        'valid': True,
        'rol':        claims.get('rol'),
        'id_usuario': claims.get('id_usuario')
    }), 200


# ------------------------------------------------------------------
# Helpers internos
# ------------------------------------------------------------------
def _get_id_especifico(id_usuario: int, rol: str):
    """Retorna el Id específico del perfil según el rol."""
    queries = {
        'paciente':      ('SELECT Id_Paciente      FROM Paciente      WHERE Id_Usuario = ?', id_usuario),
        'doctor':        ('SELECT Id_Doctor        FROM Doctor        WHERE Id_Usuario = ?', id_usuario),
        'recepcionista': ('SELECT Id_Recepcionista FROM Recepcionista WHERE Id_Usuario = ?', id_usuario),
    }
    if rol not in queries:
        return None
    sql, param = queries[rol]
    rows = execute_query(sql, (param,))
    if not rows:
        return None
    return list(rows[0].values())[0]

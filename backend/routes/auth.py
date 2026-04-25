"""
Rutas de autenticación: login, registro de paciente, verificar token.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt
import bcrypt
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database.connection import get_db, execute_query, execute_insert_returning_id
from utils.decorators import requiere_auth

auth_bp = Blueprint('auth', __name__)

ROL_MAP = {1: 'paciente', 2: 'doctor', 3: 'recepcionista', 4: 'admin'}


# ── POST /api/auth/login ─────────────────────────────────────────
@auth_bp.route('/login', methods=['POST'])
def login():
    data     = request.get_json(silent=True) or {}
    email    = (data.get('email')    or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return jsonify({'error': 'Email y contraseña son requeridos.'}), 400

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

    usuario  = rows[0]
    hash_bd  = usuario['Contrasena']
    if isinstance(hash_bd, str):
        hash_bd = hash_bd.encode('utf-8')

    if not bcrypt.checkpw(password.encode('utf-8'), hash_bd):
        return jsonify({'error': 'Credenciales incorrectas.'}), 401

    rol           = ROL_MAP.get(usuario['Id_TipoUsuario'], 'paciente')
    id_especifico = _get_id_especifico(usuario['Id_Usuario'], rol)

    token = create_access_token(
        identity=str(usuario['Id_Usuario']),
        additional_claims={
            'rol':          rol,
            'id_usuario':   usuario['Id_Usuario'],
            'id_especifico': id_especifico
        }
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


# ── POST /api/auth/register ──────────────────────────────────────
@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}

    # 1. Validación de campos obligatorios
    required = ['nombre', 'ap_paterno', 'email', 'password', 'curp', 'fecha_nac']
    missing  = [f for f in required if not (data.get(f) or '').strip()]
    if missing:
        return jsonify({'error': f'Campos requeridos faltantes: {", ".join(missing)}'}), 400

    email    = data['email'].strip().lower()
    password = data['password'].strip()
    curp     = data['curp'].strip().upper()

    if len(password) < 8:
        return jsonify({'error': 'La contraseña debe tener al menos 8 caracteres.'}), 400

    if len(curp) != 18:
        return jsonify({'error': 'El CURP debe tener exactamente 18 caracteres.'}), 400

    # 2. Verificar duplicados (usando la función auxiliar de connection.py)
    if execute_query('SELECT 1 FROM Usuario WHERE Email = ?', (email,)):
        return jsonify({'error': 'El correo electrónico ya está registrado.'}), 409

    if execute_query('SELECT 1 FROM Usuario WHERE CURP = ?', (curp,)):
        return jsonify({'error': 'El CURP ya está registrado.'}), 409

    # 3. Hashear contraseña
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()

        # 4. Insertar en Usuario usando OUTPUT para obtener el ID de inmediato
        cursor.execute(
            """
            INSERT INTO Usuario
                (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno,
                 CURP, Email, Fecha_Nac, Contrasena, Telefono,
                 Calle, Numero, Colonia)
            OUTPUT INSERTED.Id_Usuario
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data['nombre'].strip(),
                data['ap_paterno'].strip(),
                (data.get('ap_materno') or '').strip() or None,
                curp,
                email,
                data['fecha_nac'],
                password_hash,
                (data.get('telefono') or '').strip() or None,
                (data.get('calle')    or '').strip() or None,
                (data.get('numero')   or '').strip() or None,
                (data.get('colonia')  or '').strip() or None,
            )
        )
        
        # Obtenemos el ID de Usuario
        id_usuario = int(cursor.fetchone()[0])

        # 5. Insertar en Paciente usando OUTPUT para obtener su ID específico
        cursor.execute(
            "INSERT INTO Paciente (Id_Usuario) OUTPUT INSERTED.Id_Paciente VALUES (?)",
            (id_usuario,)
        )
        
        # Obtenemos el ID de Paciente
        id_paciente = int(cursor.fetchone()[0])

        # 6. Confirmar la transacción
        conn.commit()

        # 7. Generar Token JWT
        token = create_access_token(
            identity=str(id_usuario),
            additional_claims={
                'rol':           'paciente',
                'id_usuario':    id_usuario,
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
                'ap_materno':    (data.get('ap_materno') or '').strip(),
                'email':         email,
                'rol':           'paciente'
            }
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()
        # Imprimimos el error en consola para debuggear mejor
        print(f"Error detallado en registro: {str(e)}")
        return jsonify({'error': f'Error al registrar: {str(e)}'}), 500
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


# ── GET /api/auth/verify ─────────────────────────────────────────
@auth_bp.route('/verify', methods=['GET'])
@requiere_auth
def verify():
    claims = get_jwt()
    return jsonify({
        'valid':      True,
        'rol':        claims.get('rol'),
        'id_usuario': claims.get('id_usuario')
    }), 200


# ── Helper ───────────────────────────────────────────────────────
def _get_id_especifico(id_usuario: int, rol: str):
    queries = {
        'paciente':      'SELECT Id_Paciente      FROM Paciente      WHERE Id_Usuario = ?',
        'doctor':        'SELECT Id_Doctor        FROM Doctor        WHERE Id_Usuario = ?',
        'recepcionista': 'SELECT Id_Recepcionista FROM Recepcionista WHERE Id_Usuario = ?',
    }
    if rol not in queries:
        return None
    rows = execute_query(queries[rol], (id_usuario,))
    return list(rows[0].values())[0] if rows else None

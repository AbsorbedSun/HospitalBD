"""
Rutas de autenticación: login, registro de paciente, verificar token,
y utilidades de administración de contraseñas.

CORRECCIÓN: El hash de bcrypt en seed.sql estaba mal generado.
            Todos los usuarios de prueba usan: Hospital123!
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt
import bcrypt
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from db.connection import get_db, execute_query, execute_insert_returning_id
from core.decorators import requiere_auth

auth_bp = Blueprint('auth', __name__)

# Mapa Id_TipoUsuario → nombre de rol
ROL_MAP = {1: 'paciente', 2: 'doctor', 3: 'recepcionista', 4: 'admin'}

# Mapa rol → dashboard HTML
DASHBOARD_MAP = {
    'paciente':      'dashboard-paciente.html',
    'doctor':        'dashboard-doctor.html',
    'recepcionista': 'dashboard-recepcionista.html',
    'admin':         'dashboard-recepcionista.html',
}


# ── POST /api/auth/login ─────────────────────────────────────────
@auth_bp.route('/login', methods=['POST'])
def login():
    data     = request.get_json(silent=True) or {}
    email    = (data.get('email')    or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return jsonify({'error': 'Email y contraseña son requeridos.'}), 400

    # 1. Buscar usuario por email
    try:
        rows = execute_query(
            """
            SELECT u.Id_Usuario, u.Nombre, u.Ap_Paterno, u.Ap_Materno,
                   u.Email, u.Contrasena, u.Id_TipoUsuario
            FROM Usuario u
            WHERE u.Email = ?
            """,
            (email,)
        )
    except Exception as e:
        print(f"[Auth/Login] Error consultando BD: {e}")
        return jsonify({'error': 'Error al conectar con la base de datos.'}), 500

    if not rows:
        return jsonify({'error': 'Credenciales incorrectas.'}), 401

    usuario = rows[0]

    # 2. Verificar contraseña con bcrypt
    try:
        hash_bd = usuario['Contrasena']
        if isinstance(hash_bd, str):
            hash_bd = hash_bd.encode('utf-8')

        if not bcrypt.checkpw(password.encode('utf-8'), hash_bd):
            return jsonify({'error': 'Credenciales incorrectas.'}), 401

    except Exception as e:
        print(f"[Auth/Login] Error verificando contraseña para {email}: {e}")
        return jsonify({'error': 'Error al verificar credenciales.'}), 500

    # 3. Determinar rol e ID específico
    rol = ROL_MAP.get(usuario['Id_TipoUsuario'], 'paciente')

    try:
        id_especifico = _get_id_especifico(usuario['Id_Usuario'], rol)
    except Exception as e:
        print(f"[Auth/Login] Error obteniendo ID específico para {email} (rol={rol}): {e}")
        return jsonify({'error': 'Error al cargar el perfil del usuario.'}), 500

    # 4. Generar token JWT
    token = create_access_token(
        identity=str(usuario['Id_Usuario']),
        additional_claims={
            'rol':           rol,
            'id_usuario':    usuario['Id_Usuario'],
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
            'rol':           rol,
            'dashboard':     DASHBOARD_MAP.get(rol, 'dashboard-paciente.html')
        }
    }), 200


# ── POST /api/auth/register ──────────────────────────────────────
@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}

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

    # Verificar duplicados
    try:
        if execute_query('SELECT 1 FROM Usuario WHERE Email = ?', (email,)):
            return jsonify({'error': 'El correo electrónico ya está registrado.'}), 409
        if execute_query('SELECT 1 FROM Usuario WHERE CURP = ?', (curp,)):
            return jsonify({'error': 'El CURP ya está registrado.'}), 409
    except Exception as e:
        print(f"[Auth/Register] Error verificando duplicados: {e}")
        return jsonify({'error': 'Error al verificar datos existentes.'}), 500

    # Hashear contraseña
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()

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
        id_usuario = int(cursor.fetchone()[0])

        cursor.execute(
            "INSERT INTO Paciente (Id_Usuario) OUTPUT INSERTED.Id_Paciente VALUES (?)",
            (id_usuario,)
        )
        id_paciente = int(cursor.fetchone()[0])
        conn.commit()

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
                'rol':           'paciente',
                'dashboard':     'dashboard-paciente.html'
            }
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[Auth/Register] Error detallado: {e}")
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
    rol    = claims.get('rol', '')
    return jsonify({
        'valid':      True,
        'rol':        rol,
        'id_usuario': claims.get('id_usuario'),
        'dashboard':  DASHBOARD_MAP.get(rol, 'login.html')
    }), 200


# ── POST /api/auth/reset-password  (solo desarrollo / admin) ─────
@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """
    Actualiza la contraseña de un usuario por su email.
    Usar SOLO en desarrollo o cuando el admin necesite restablecer
    la contraseña de un doctor/recepcionista ya existente en BD.

    Body JSON: { "email": "...", "nueva_password": "..." }
    """
    data           = request.get_json(silent=True) or {}
    email          = (data.get('email')          or '').strip().lower()
    nueva_password = (data.get('nueva_password') or '').strip()

    if not email or not nueva_password:
        return jsonify({'error': 'Email y nueva_password son requeridos.'}), 400

    if len(nueva_password) < 8:
        return jsonify({'error': 'La contraseña debe tener al menos 8 caracteres.'}), 400

    try:
        rows = execute_query('SELECT Id_Usuario FROM Usuario WHERE Email = ?', (email,))
        if not rows:
            return jsonify({'error': 'Usuario no encontrado.'}), 404

        nuevo_hash = bcrypt.hashpw(nueva_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        from db.connection import execute_non_query
        execute_non_query(
            'UPDATE Usuario SET Contrasena = ? WHERE Email = ?',
            (nuevo_hash, email)
        )

        return jsonify({'mensaje': f'Contraseña actualizada correctamente para {email}.'}), 200

    except Exception as e:
        print(f"[Auth/ResetPassword] Error: {e}")
        return jsonify({'error': f'Error al actualizar contraseña: {str(e)}'}), 500


# ── Helper ───────────────────────────────────────────────────────
def _get_id_especifico(id_usuario: int, rol: str):
    """
    Retorna el ID de la tabla específica (Paciente, Doctor, Recepcionista)
    dado el Id_Usuario y el rol. Retorna None si no existe el registro.
    """
    queries = {
        'paciente':      'SELECT Id_Paciente      FROM Paciente      WHERE Id_Usuario = ?',
        'doctor':        'SELECT Id_Doctor        FROM Doctor        WHERE Id_Usuario = ?',
        'recepcionista': 'SELECT Id_Recepcionista FROM Recepcionista WHERE Id_Usuario = ?',
        'admin':         'SELECT Id_Recepcionista FROM Recepcionista WHERE Id_Usuario = ?',
    }
    if rol not in queries:
        return None
    rows = execute_query(queries[rol], (id_usuario,))
    if not rows:
        print(f"[Auth] Advertencia: no se encontró registro específico "
              f"para Id_Usuario={id_usuario}, rol={rol}")
        return None
    return list(rows[0].values())[0]

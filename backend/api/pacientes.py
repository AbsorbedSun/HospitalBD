"""
Rutas del perfil Paciente.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from db.connection import execute_query, execute_non_query
from core.decorators import requiere_auth, requiere_rol
from core.helpers import rows_to_json

paciente_bp = Blueprint('pacientes', __name__)


# ------------------------------------------------------------------
# GET /api/pacientes/perfil   (paciente ve sus datos)
# ------------------------------------------------------------------
@paciente_bp.route('/perfil', methods=['GET'])
@requiere_auth
def obtener_perfil():
    claims = get_jwt()
    id_usuario = claims.get('id_usuario')

    rows = execute_query(
        """
        SELECT u.Id_Usuario, p.Id_Paciente,
               u.Nombre, u.Ap_Paterno, u.Ap_Materno, u.CURP, u.Email,
               u.Fecha_Nac,
               dbo.FN_CalcularEdad(u.Fecha_Nac)       AS Edad,
               u.Telefono, u.Calle, u.Numero, u.Colonia, u.Direccion
        FROM Usuario u
        JOIN Paciente p ON p.Id_Usuario = u.Id_Usuario
        WHERE u.Id_Usuario = ?
        """,
        (id_usuario,)
    )
    if not rows:
        return jsonify({'error': 'Paciente no encontrado.'}), 404
    return jsonify(rows_to_json(rows[0])), 200


# ------------------------------------------------------------------
# PUT /api/pacientes/perfil   (paciente actualiza datos de contacto)
# Campos de identidad bloqueados: Nombre, Ap_Paterno, Ap_Materno, CURP, Fecha_Nac
# ------------------------------------------------------------------
@paciente_bp.route('/perfil', methods=['PUT'])
@requiere_auth
def actualizar_perfil():
    claims = get_jwt()
    id_usuario = claims.get('id_usuario')
    data = request.get_json(silent=True) or {}

    campos, params = [], []
    # Email incluido: es dato de contacto, no de identidad
    permitidos = ['Email', 'Telefono', 'Calle', 'Numero', 'Colonia', 'Direccion']
    for campo in permitidos:
        key = campo.lower()
        if key in data:
            valor = data[key] or None
            # Validación básica de formato de email
            if campo == 'Email' and valor:
                import re
                if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', valor):
                    return jsonify({'error': 'El formato del email no es válido.'}), 400
            campos.append(f'{campo} = ?')
            params.append(valor)

    if not campos:
        return jsonify({'error': 'Sin campos permitidos para actualizar.'}), 400

    params.append(id_usuario)
    execute_non_query(
        f"UPDATE Usuario SET {', '.join(campos)} WHERE Id_Usuario = ?",
        tuple(params)
    )
    return jsonify({'mensaje': 'Perfil actualizado.'}), 200


# ------------------------------------------------------------------
# GET /api/pacientes/historial-medico
# ------------------------------------------------------------------
@paciente_bp.route('/historial-medico', methods=['GET'])
@requiere_auth
def obtener_historial_medico():
    claims = get_jwt()
    id_usuario = claims.get('id_usuario')

    rows = execute_query(
        """
        SELECT hm.Id_HistorialMed, hm.Id_Paciente,
               hm.Tipo_sangre, hm.Estatura, hm.Peso,
               hm.Alergias, hm.Padecimientos
        FROM Historial_medico hm
        JOIN Paciente p ON hm.Id_Paciente = p.Id_Paciente
        WHERE p.Id_Usuario = ?
        """,
        (id_usuario,)
    )
    if not rows:
        return jsonify(None), 200   # Puede no tener historial aún
    return jsonify(rows_to_json(rows[0])), 200


# ------------------------------------------------------------------
# GET /api/pacientes/mis-recetas   (paciente ve sus propias recetas)
# ------------------------------------------------------------------
@paciente_bp.route('/mis-recetas', methods=['GET'])
@requiere_auth
def mis_recetas():
    claims     = get_jwt()
    id_usuario = claims.get('id_usuario')

    # VW_HistorialPaciente consolida Paciente + Historial + Citas + Recetas.
    # Filtramos solo filas con receta (Id_Receta IS NOT NULL) ordenadas
    # por fecha de emisión descendente — mismo resultado, sin JOIN manual.
    rows = execute_query(
        """
        SELECT Id_Receta, Folio_Cita, FechaEmision,
               Medicamento, Tratamiento, Observaciones,
               NombreDoctor, ApPaternoDoctor, Cedula_prof,
               Especialidad, Fecha_Cita, Hora_Cita, Edad AS EdadPaciente
        FROM VW_HistorialPaciente
        WHERE Id_Usuario = ?
          AND Id_Receta IS NOT NULL
        ORDER BY FechaEmision DESC
        """,
        (id_usuario,)
    )
    return jsonify(rows_to_json(rows)), 200


# ------------------------------------------------------------------
# GET /api/pacientes   (solo recepcionista puede listar todos)
# ------------------------------------------------------------------
@paciente_bp.route('', methods=['GET'])
@requiere_rol('recepcionista', 'admin')
def listar_pacientes():
    nombre = request.args.get('nombre', '')
    params = []
    filtro = ''
    if nombre:
        filtro = "WHERE u.Nombre LIKE ? OR u.Ap_Paterno LIKE ?"
        params = [f'%{nombre}%', f'%{nombre}%']

    rows = execute_query(
        f"""
        SELECT p.Id_Paciente,
               u.Nombre, u.Ap_Paterno, u.Ap_Materno, u.Email, u.Telefono,
               u.CURP,
               dbo.FN_CalcularEdad(u.Fecha_Nac)       AS Edad
        FROM Paciente p
        JOIN Usuario u ON p.Id_Usuario = u.Id_Usuario
        {filtro}
        ORDER BY u.Ap_Paterno, u.Nombre
        """,
        tuple(params) if params else None
    )
    return jsonify(rows_to_json(rows)), 200


# ------------------------------------------------------------------
# GET /api/pacientes/<id>   (doctor o recepcionista ven un paciente)
# ------------------------------------------------------------------
@paciente_bp.route('/<int:id_paciente>', methods=['GET'])
@requiere_rol('doctor', 'recepcionista', 'admin')
def obtener_paciente(id_paciente):
    rows = execute_query(
        """
        SELECT p.Id_Paciente,
               u.Nombre, u.Ap_Paterno, u.Ap_Materno, u.Email, u.Telefono,
               u.CURP, u.Fecha_Nac,
               dbo.FN_CalcularEdad(u.Fecha_Nac)       AS Edad,
               u.Calle, u.Numero, u.Colonia
        FROM Paciente p
        JOIN Usuario u ON p.Id_Usuario = u.Id_Usuario
        WHERE p.Id_Paciente = ?
        """,
        (id_paciente,)
    )
    if not rows:
        return jsonify({'error': 'Paciente no encontrado.'}), 404
    return jsonify(rows_to_json(rows[0])), 200


# ------------------------------------------------------------------
# GET /api/pacientes/<id>/historial   (solo doctor puede ver historial)
# ------------------------------------------------------------------
@paciente_bp.route('/<int:id_paciente>/historial', methods=['GET'])
@requiere_rol('doctor')
def historial_por_doctor(id_paciente):
    rows = execute_query(
        """
        SELECT hm.Id_HistorialMed, hm.Tipo_sangre, hm.Estatura,
               hm.Peso, hm.Alergias, hm.Padecimientos
        FROM Historial_medico hm
        WHERE hm.Id_Paciente = ?
        """,
        (id_paciente,)
    )
    if not rows:
        return jsonify(None), 200
    return jsonify(rows_to_json(rows[0])), 200


# ------------------------------------------------------------------
# PUT /api/pacientes/<id>/historial   (solo doctor actualiza historial)
# ------------------------------------------------------------------
@paciente_bp.route('/<int:id_paciente>/historial', methods=['PUT'])
@requiere_rol('doctor')
def actualizar_historial(id_paciente):
    data = request.get_json(silent=True) or {}

    # Verificar si ya existe historial
    existe = execute_query(
        'SELECT Id_HistorialMed FROM Historial_medico WHERE Id_Paciente = ?',
        (id_paciente,)
    )

    if existe:
        # UPDATE
        campos, params = [], []
        permitidos = {
            'tipo_sangre': 'Tipo_sangre', 'estatura': 'Estatura',
            'peso': 'Peso', 'alergias': 'Alergias', 'padecimientos': 'Padecimientos'
        }
        for key, col in permitidos.items():
            if key in data:
                campos.append(f'{col} = ?')
                params.append(data[key])
        if not campos:
            return jsonify({'error': 'Sin campos para actualizar.'}), 400
        params.append(id_paciente)
        execute_non_query(
            f"UPDATE Historial_medico SET {', '.join(campos)} WHERE Id_Paciente = ?",
            tuple(params)
        )
    else:
        # INSERT
        execute_non_query(
            """
            INSERT INTO Historial_medico
                (Id_Paciente, Tipo_sangre, Estatura, Peso, Alergias, Padecimientos)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                id_paciente,
                data.get('tipo_sangre', 'ND'),
                data.get('estatura', 0),
                data.get('peso', 0),
                data.get('alergias'),
                data.get('padecimientos')
            )
        )
    return jsonify({'mensaje': 'Historial médico actualizado.'}), 200

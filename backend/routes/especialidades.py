"""
Rutas de especialidades médicas.
"""
from flask import Blueprint, jsonify, request
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database.connection import execute_query, execute_non_query, execute_insert_returning_id
from utils.decorators import requiere_auth, requiere_rol
from utils.helpers import rows_to_json

esp_bp = Blueprint('especialidades', __name__)


# GET /api/especialidades
@esp_bp.route('', methods=['GET'])
def obtener_especialidades():
    """Lista todas las especialidades con su precio."""
    rows = execute_query(
        'SELECT Id_Especialidad, Especialidad, Precio FROM Especialidad ORDER BY Especialidad'
    )
    return jsonify(rows_to_json(rows)), 200


# GET /api/especialidades/<id>
@esp_bp.route('/<int:id_esp>', methods=['GET'])
def obtener_especialidad(id_esp):
    rows = execute_query(
        'SELECT Id_Especialidad, Especialidad, Precio FROM Especialidad WHERE Id_Especialidad = ?',
        (id_esp,)
    )
    if not rows:
        return jsonify({'error': 'Especialidad no encontrada.'}), 404
    return jsonify(rows_to_json(rows[0])), 200


# GET /api/especialidades/<id>/doctores
@esp_bp.route('/<int:id_esp>/doctores', methods=['GET'])
def obtener_doctores_por_especialidad(id_esp):
    """Lista doctores de una especialidad con su horario."""
    rows = execute_query(
        """
        SELECT d.Id_Doctor, u.Nombre, u.Ap_Paterno, u.Ap_Materno,
               d.Cedula_prof, h.Turno, h.Hora_inic, h.Hora_final
        FROM Doctor d
        JOIN Usuario  u ON d.Id_Usuario  = u.Id_Usuario
        JOIN Horario  h ON d.Id_Horario  = h.Id_Horario
        WHERE d.Id_Especialidad = ?
        ORDER BY u.Ap_Paterno
        """,
        (id_esp,)
    )
    return jsonify(rows_to_json(rows)), 200


# POST /api/especialidades   (solo recepcionista)
@esp_bp.route('', methods=['POST'])
@requiere_rol('recepcionista', 'admin')
def crear_especialidad():
    data = request.get_json(silent=True) or {}
    nombre = (data.get('especialidad') or '').strip()
    precio = data.get('precio')

    if not nombre or precio is None:
        return jsonify({'error': 'Nombre y precio son requeridos.'}), 400

    id_nuevo = execute_insert_returning_id(
        """
        INSERT INTO Especialidad (Especialidad, Precio) VALUES (?, ?);
        SELECT SCOPE_IDENTITY();
        """,
        (nombre, float(precio))
    )
    return jsonify({'id_especialidad': id_nuevo, 'mensaje': 'Especialidad creada.'}), 201


# PUT /api/especialidades/<id>   (solo recepcionista)
@esp_bp.route('/<int:id_esp>', methods=['PUT'])
@requiere_rol('recepcionista', 'admin')
def actualizar_especialidad(id_esp):
    data = request.get_json(silent=True) or {}
    campos, params = [], []

    if 'especialidad' in data:
        campos.append('Especialidad = ?')
        params.append(data['especialidad'].strip())
    if 'precio' in data:
        campos.append('Precio = ?')
        params.append(float(data['precio']))

    if not campos:
        return jsonify({'error': 'Sin campos para actualizar.'}), 400

    params.append(id_esp)
    execute_non_query(
        f"UPDATE Especialidad SET {', '.join(campos)} WHERE Id_Especialidad = ?",
        tuple(params)
    )
    return jsonify({'mensaje': 'Especialidad actualizada.'}), 200

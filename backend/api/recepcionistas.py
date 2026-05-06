"""
Rutas del perfil Recepcionista: dashboard, bitácoras,
aprobación de cancelaciones y gestión general.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt
import bcrypt, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from db.connection import execute_query, execute_non_query, execute_insert_returning_id, get_db
from core.decorators import requiere_rol
from core.helpers import rows_to_json

recep_bp = Blueprint('recepcionistas', __name__)


# ------------------------------------------------------------------
# GET /api/recepcionistas/dashboard
# ------------------------------------------------------------------
@recep_bp.route('/dashboard', methods=['GET'])
@requiere_rol('recepcionista', 'admin')
def dashboard():
    """Resumen estadístico del día/semana para el dashboard."""
    stats = execute_query(
        """
        SELECT
            (SELECT COUNT(*) FROM Cita c JOIN EstatusCita e ON c.Id_EstatusCita=e.Id_EstatusCita
             WHERE e.Clave='pagada_pendiente_atender' AND c.Fecha_Cita = CAST(GETDATE() AS DATE)) AS CitasHoy,
            (SELECT COUNT(*) FROM Cita c JOIN EstatusCita e ON c.Id_EstatusCita=e.Id_EstatusCita
             WHERE e.Clave='agendada_pendiente_pago') AS PendientesPago,
            (SELECT COUNT(*) FROM Paciente) AS TotalPacientes,
            (SELECT COUNT(*) FROM Doctor d JOIN Empleado emp ON d.Id_Usuario=emp.Id_Usuario
             WHERE emp.Estatus_empleado='Activo') AS DoctoresActivos,
            (SELECT COUNT(*) FROM SolicitudCancelacion WHERE Estatus='Pendiente') AS SolicitudesPendientes
        """
    )
    return jsonify(rows_to_json(stats[0])), 200


# ------------------------------------------------------------------
# GET /api/recepcionistas/bitacora/estatus
# ------------------------------------------------------------------
@recep_bp.route('/bitacora/estatus', methods=['GET'])
@requiere_rol('recepcionista', 'admin')
def bitacora_estatus():
    filtros, params = [], []
    if request.args.get('folio_cita'):
        filtros.append('Folio_Cita = ?')
        params.append(int(request.args.get('folio_cita')))
    if request.args.get('estatus'):
        filtros.append('Estatus_Cita = ?')
        params.append(request.args.get('estatus'))
    if request.args.get('fecha_inicio'):
        filtros.append('Fecha_Mov >= ?')
        params.append(request.args.get('fecha_inicio'))
    if request.args.get('fecha_fin'):
        filtros.append('Fecha_Mov <= ?')
        params.append(request.args.get('fecha_fin'))

    where = ('WHERE ' + ' AND '.join(filtros)) if filtros else ''
    rows = execute_query(
        f"""
        SELECT Id_Registro, Folio_Cita, Fecha_Mov, Estatus_Cita,
               Fecha_Cita, Id_Especialidad, Costo,
               Politica_Cancela, Monto_Devuelto
        FROM Bitacora_EstatusCita
        {where}
        ORDER BY Fecha_Mov DESC
        """,
        tuple(params) if params else None
    )
    return jsonify(rows_to_json(rows)), 200


# ------------------------------------------------------------------
# GET /api/recepcionistas/bitacora/historial
# ------------------------------------------------------------------
@recep_bp.route('/bitacora/historial', methods=['GET'])
@requiere_rol('recepcionista', 'admin')
def bitacora_historial():
    filtros, params = [], []
    if request.args.get('id_paciente'):
        filtros.append('Id_Paciente = ?')
        params.append(int(request.args.get('id_paciente')))
    if request.args.get('id_doctor'):
        filtros.append('Id_Doctor = ?')
        params.append(int(request.args.get('id_doctor')))

    where = ('WHERE ' + ' AND '.join(filtros)) if filtros else ''
    rows = execute_query(
        f"""
        SELECT Id_Historial, Usuario, Rol_Usuario, Folio_Cita,
               Fecha_Cita, Hora_Cita, Id_Paciente, Folio_Receta,
               Id_Doctor, Estatus_Consulta, Especialidad,
               Id_Consultorio, Fecha_Registro
        FROM Bitacora_HistorialCitas
        {where}
        ORDER BY Fecha_Registro DESC
        """,
        tuple(params) if params else None
    )
    return jsonify(rows_to_json(rows)), 200


# ------------------------------------------------------------------
# GET /api/recepcionistas/solicitudes-cancelacion
# ------------------------------------------------------------------
@recep_bp.route('/solicitudes-cancelacion', methods=['GET'])
@requiere_rol('recepcionista', 'admin')
def listar_solicitudes():
    rows = execute_query(
        """
        SELECT sc.Id_Solicitud, sc.Folio_Cita, sc.Motivo,
               sc.Estatus, sc.Fecha_Solicitud,
               ud.Nombre AS NombreDoctor, ud.Ap_Paterno AS ApDoc,
               up.Nombre AS NombrePaciente, up.Ap_Paterno AS ApPac,
               c.Fecha_Cita, c.Hora_Cita
        FROM SolicitudCancelacion sc
        JOIN Doctor  d  ON sc.Id_Doctor    = d.Id_Doctor
        JOIN Usuario ud ON d.Id_Usuario    = ud.Id_Usuario
        JOIN Cita    c  ON sc.Folio_Cita   = c.Folio_Cita
        JOIN Paciente p ON c.Id_Paciente   = p.Id_Paciente
        JOIN Usuario up ON p.Id_Usuario    = up.Id_Usuario
        WHERE sc.Estatus = 'Pendiente'
        ORDER BY sc.Fecha_Solicitud ASC
        """
    )
    return jsonify(rows_to_json(rows)), 200


# ------------------------------------------------------------------
# POST /api/recepcionistas/solicitudes-cancelacion/<id>/aprobar
# ------------------------------------------------------------------
@recep_bp.route('/solicitudes-cancelacion/<int:id_solicitud>/aprobar', methods=['POST'])
@requiere_rol('recepcionista', 'admin')
def aprobar_solicitud(id_solicitud):
    claims          = get_jwt()
    id_recepcionista = claims.get('id_especifico')

    solicitud = execute_query(
        "SELECT * FROM SolicitudCancelacion WHERE Id_Solicitud = ? AND Estatus = 'Pendiente'",
        (id_solicitud,)
    )
    if not solicitud:
        return jsonify({'error': 'Solicitud no encontrada o ya resuelta.'}), 404

    sol = solicitud[0]
    folio_cita = sol['Folio_Cita']

    # Aprobar solicitud
    execute_non_query(
        """
        UPDATE SolicitudCancelacion
        SET Estatus = 'Aprobada', Id_Recepcionista = ?, Fecha_Resolucion = GETDATE()
        WHERE Id_Solicitud = ?
        """,
        (id_recepcionista, id_solicitud)
    )

    # Cancelar la cita (cancelada_doctor → 100% reembolso)
    from api.citas import _cambiar_estatus
    cita = execute_query(
        """
        SELECT d.Id_Especialidad, e.Precio
        FROM Cita c
        JOIN Doctor d ON c.Id_Doctor = d.Id_Doctor
        JOIN Especialidad e ON d.Id_Especialidad = e.Id_Especialidad
        WHERE c.Folio_Cita = ?
        """,
        (folio_cita,)
    )
    if cita:
        precio = float(cita[0]['Precio'])
        id_esp = int(cita[0]['Id_Especialidad'])
        _cambiar_estatus(folio_cita, 'cancelada_doctor', precio, id_esp, '100%', precio)
        # Actualizar pago
        pago = execute_query(
            "SELECT Id_Pago, Monto FROM Pago WHERE Folio_Cita = ? AND Estado = 'Pagado'",
            (folio_cita,)
        )
        if pago:
            execute_non_query(
                "UPDATE Pago SET MontoDevuelto = Monto WHERE Id_Pago = ?",
                (pago[0]['Id_Pago'],)
            )

    return jsonify({'mensaje': 'Cancelación aprobada. Se procesó reembolso del 100%.'}), 200


# ------------------------------------------------------------------
# POST /api/recepcionistas/solicitudes-cancelacion/<id>/rechazar
# ------------------------------------------------------------------
@recep_bp.route('/solicitudes-cancelacion/<int:id_solicitud>/rechazar', methods=['POST'])
@requiere_rol('recepcionista', 'admin')
def rechazar_solicitud(id_solicitud):
    claims           = get_jwt()
    id_recepcionista = claims.get('id_especifico')

    execute_non_query(
        """
        UPDATE SolicitudCancelacion
        SET Estatus = 'Rechazada', Id_Recepcionista = ?, Fecha_Resolucion = GETDATE()
        WHERE Id_Solicitud = ? AND Estatus = 'Pendiente'
        """,
        (id_recepcionista, id_solicitud)
    )
    return jsonify({'mensaje': 'Solicitud rechazada.'}), 200


# ------------------------------------------------------------------
# POST /api/recepcionistas   (dar de alta otra recepcionista)
# ------------------------------------------------------------------
@recep_bp.route('', methods=['POST'])
@requiere_rol('recepcionista', 'admin')
def crear_recepcionista():
    data = request.get_json(silent=True) or {}
    required = ['nombre', 'ap_paterno', 'email', 'password', 'curp', 'fecha_nac', 'rfc', 'sueldo']
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f'Campos faltantes: {", ".join(missing)}'}), 400

    email = data['email'].strip().lower()
    existe = execute_query('SELECT 1 FROM Usuario WHERE Email = ?', (email,))
    if existe:
        return jsonify({'error': 'El correo ya está registrado.'}), 409

    password_hash = bcrypt.hashpw(
        data['password'].encode('utf-8'), bcrypt.gensalt()
    ).decode('utf-8')

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO Usuario
                (Id_TipoUsuario, Nombre, Ap_Paterno, Ap_Materno, CURP, Email,
                 Fecha_Nac, Contrasena, Telefono)
            VALUES (3, ?, ?, ?, ?, ?, ?, ?, ?);
            SELECT SCOPE_IDENTITY();
            """,
            (
                data['nombre'].strip(), data['ap_paterno'].strip(),
                data.get('ap_materno', '') or None,
                data['curp'].strip().upper(), email,
                data['fecha_nac'], password_hash,
                data.get('telefono') or None
            )
        )
        id_usuario = int(cursor.fetchone()[0])
        id_horario = int(data.get('id_horario', 1))

        cursor.execute(
            """
            INSERT INTO Empleado (Id_Usuario, Id_Horario, RFC, Sueldo, DiasVacacion, Estatus_empleado)
            VALUES (?, ?, ?, ?, ?, 'Activo');
            """,
            (id_usuario, id_horario, data['rfc'].strip(),
             float(data['sueldo']), int(data.get('dias_vacacion', 15)))
        )

        cursor.execute(
            'INSERT INTO Recepcionista (Id_Usuario) VALUES (?); SELECT SCOPE_IDENTITY();',
            (id_usuario,)
        )
        id_recep = int(cursor.fetchone()[0])
        conn.commit()
        return jsonify({'id_recepcionista': id_recep, 'mensaje': 'Recepcionista registrada.'}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

"""
Rutas de gestión de citas médicas.
Implementa todas las reglas de negocio del proyecto.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt
from datetime import datetime, date, timedelta
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from db.connection import execute_query, execute_non_query, get_db
from core.decorators import requiere_auth, requiere_rol
from core.helpers import (rows_to_json, calcular_politica_cancelacion,
                           calcular_monto_devolucion, validar_ventana_cita)

citas_bp = Blueprint('citas', __name__)


# ------------------------------------------------------------------
# GET /api/citas   (paciente ve sus citas; doctor/recep ven todas)
# ------------------------------------------------------------------
@citas_bp.route('', methods=['GET'])
@requiere_auth
def listar_citas():
    claims   = get_jwt()
    rol      = claims.get('rol')
    id_esp   = claims.get('id_especifico')

    fecha_inicio = request.args.get('fecha_inicio')
    fecha_fin    = request.args.get('fecha_fin')
    estatus_f    = request.args.get('estatus')

    filtros, params = [], []

    if rol == 'paciente':
        filtros.append('c.Id_Paciente = ?')
        params.append(id_esp)
    elif rol == 'doctor':
        filtros.append('c.Id_Doctor = ?')
        params.append(id_esp)
    # recepcionista y admin ven todas

    if fecha_inicio:
        filtros.append('c.Fecha_Cita >= ?')
        params.append(fecha_inicio)
    if fecha_fin:
        filtros.append('c.Fecha_Cita <= ?')
        params.append(fecha_fin)
    if estatus_f:
        filtros.append('ec.Clave = ?')
        params.append(estatus_f)

    where = ('WHERE ' + ' AND '.join(filtros)) if filtros else ''

    rows = execute_query(
        f"""
        SELECT c.Folio_Cita, c.Fecha_Cita, c.Hora_Cita, c.Solicitud_Cita,
               ec.Clave AS Estatus, ec.Descripcion AS DescripcionEstatus,
               up.Nombre AS NombrePaciente, up.Ap_Paterno AS ApPaciPat,
               ud.Nombre AS NombreDoctor,  ud.Ap_Paterno AS ApDocPat,
               e.Especialidad, e.Precio,
               con.Nombre AS Consultorio, con.Piso,
               d.Id_Doctor, p.Id_Paciente,
               pago.Id_Pago, pago.Estado AS EstadoPago, pago.Monto
        FROM Cita c
        JOIN EstatusCita  ec  ON c.Id_EstatusCita  = ec.Id_EstatusCita
        JOIN Paciente     p   ON c.Id_Paciente      = p.Id_Paciente
        JOIN Usuario      up  ON p.Id_Usuario       = up.Id_Usuario
        JOIN Doctor       d   ON c.Id_Doctor        = d.Id_Doctor
        JOIN Usuario      ud  ON d.Id_Usuario       = ud.Id_Usuario
        JOIN Especialidad e   ON d.Id_Especialidad  = e.Id_Especialidad
        LEFT JOIN Consultorio con ON c.Id_Consultorio = con.Id_Consultorio
        LEFT JOIN Pago pago ON pago.Folio_Cita = c.Folio_Cita
                           AND pago.Estado <> 'Cancelado'
        {where}
        ORDER BY c.Fecha_Cita DESC, c.Hora_Cita DESC
        """,
        tuple(params) if params else None
    )
    return jsonify(rows_to_json(rows)), 200


# ------------------------------------------------------------------
# POST /api/citas/agendar
# ------------------------------------------------------------------
@citas_bp.route('/agendar', methods=['POST'])
@requiere_auth
def agendar_cita():
    claims     = get_jwt()
    rol        = claims.get('rol')
    id_paciente = claims.get('id_especifico') if rol == 'paciente' else None

    data = request.get_json(silent=True) or {}

    # Recepcionista puede agendar para cualquier paciente
    if rol in ('recepcionista', 'admin'):
        id_paciente = data.get('id_paciente')

    required = ['id_doctor', 'fecha_cita', 'hora_cita']
    missing  = [f for f in required if not data.get(f)]
    if not id_paciente:
        missing.append('id_paciente')
    if missing:
        return jsonify({'error': f'Campos faltantes: {", ".join(missing)}'}), 400

    id_doctor   = int(data['id_doctor'])
    fecha_str   = data['fecha_cita']         # YYYY-MM-DD
    hora_str    = data['hora_cita']          # HH:MM

    try:
        fecha_cita = date.fromisoformat(fecha_str)
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido. Use YYYY-MM-DD'}), 400

    # ── Regla 1: ventana de tiempo (48h – 3 meses) ──────────────────
    valida = validar_ventana_cita(fecha_cita)
    if not valida['valido']:
        return jsonify({'error': valida['error']}), 422

    # ── Regla 2: doctor existe y horario laboral ─────────────────────
    doctor_info = execute_query(
        """
        SELECT d.Id_Doctor, h.Hora_inic, h.Hora_final, d.Id_Especialidad,
               e.Precio, ud.Nombre, ud.Ap_Paterno
        FROM Doctor d
        JOIN Horario h     ON d.Id_Horario     = h.Id_Horario
        JOIN Especialidad e ON d.Id_Especialidad = e.Id_Especialidad
        JOIN Usuario ud    ON d.Id_Usuario     = ud.Id_Usuario
        WHERE d.Id_Doctor = ?
        """,
        (id_doctor,)
    )
    if not doctor_info:
        return jsonify({'error': 'Doctor no encontrado.'}), 404

    doc = doctor_info[0]
    hora_inic  = _time_to_str(doc['Hora_inic'])
    hora_final = _time_to_str(doc['Hora_final'])

    if not (hora_inic <= hora_str < hora_final):
        return jsonify({
            'error': f'El horario {hora_str} está fuera del horario laboral del doctor ({hora_inic} – {hora_final}).'
        }), 422

    # ── Regla 3: doctor no ocupado en esa fecha/hora ────────────────
    ocupado = execute_query(
        """
        SELECT 1 FROM Cita c
        JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
        WHERE c.Id_Doctor = ? AND c.Fecha_Cita = ? AND c.Hora_Cita = ?
          AND ec.Clave IN ('agendada_pendiente_pago','pagada_pendiente_atender')
        """,
        (id_doctor, fecha_str, hora_str)
    )
    if ocupado:
        return jsonify({'error': 'El doctor ya tiene una cita en esa fecha y horario.'}), 422

    # ── Regla 4: paciente sin cita pendiente con el mismo doctor ────
    pendiente = execute_query(
        """
        SELECT 1 FROM Cita c
        JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
        WHERE c.Id_Paciente = ? AND c.Id_Doctor = ?
          AND ec.Clave IN ('agendada_pendiente_pago','pagada_pendiente_atender')
        """,
        (id_paciente, id_doctor)
    )
    if pendiente:
        return jsonify({'error': 'Ya tienes una cita pendiente con este doctor.'}), 422

    # ── Asignar consultorio disponible de la especialidad ───────────
    consultorio = execute_query(
        """
        SELECT TOP 1 con.Id_Consultorio FROM Consultorio con
        WHERE con.Id_Especialidad = ?
          AND con.Id_Consultorio NOT IN (
              SELECT ISNULL(c2.Id_Consultorio, 0)
              FROM Cita c2
              JOIN EstatusCita ec2 ON c2.Id_EstatusCita = ec2.Id_EstatusCita
              WHERE c2.Fecha_Cita = ? AND c2.Hora_Cita = ?
                AND ec2.Clave IN ('agendada_pendiente_pago','pagada_pendiente_atender')
          )
        """,
        (doc['Id_Especialidad'], fecha_str, hora_str)
    )
    id_consultorio = consultorio[0]['Id_Consultorio'] if consultorio else None

    # ── Obtener Id_EstatusCita = 'agendada_pendiente_pago' ──────────
    estatus = execute_query(
        "SELECT Id_EstatusCita FROM EstatusCita WHERE Clave = 'agendada_pendiente_pago'"
    )
    id_estatus = estatus[0]['Id_EstatusCita']

    conn = get_db()
    try:
        cursor = conn.cursor()

        # Insertar Cita  — OUTPUT INSERTED es la forma correcta con pyodbc/SQL Server
        # (INSERT + SELECT SCOPE_IDENTITY() en un solo execute() deja el cursor en el
        #  resultado del INSERT, que no tiene filas, y fetchone() lanza el error
        #  "No results. Previous SQL was not a query.")
        cursor.execute(
            """
            INSERT INTO Cita
                (Id_Doctor, Id_Paciente, Id_Consultorio, Id_EstatusCita,
                 Fecha_Cita, Hora_Cita)
            OUTPUT INSERTED.Folio_Cita
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (id_doctor, id_paciente, id_consultorio, id_estatus, fecha_str, hora_str)
        )
        folio_cita = int(cursor.fetchone()[0])

        # Insertar Pago pendiente — OUTPUT INSERTED por la misma razón.
        # MetodoPago usa 'Efectivo' como placeholder valido: el CHECK constraint
        # solo permite 'Efectivo'|'Tarjeta'|'Transferencia', no 'Pendiente'.
        # confirmar_pago() lo sobreescribe con el metodo real al momento del cobro.
        cursor.execute(
            """
            INSERT INTO Pago (Folio_Cita, MetodoPago, Monto, Estado)
            OUTPUT INSERTED.Id_Pago
            VALUES (?, 'Efectivo', ?, 'Pendiente')
            """,
            (folio_cita, float(doc['Precio']))
        )
        id_pago = int(cursor.fetchone()[0])

        # Bitácora estatus
        cursor.execute(
            """
            INSERT INTO Bitacora_EstatusCita
                (Folio_Cita, Estatus_Cita, Fecha_Cita, Id_Especialidad,
                 Costo, Politica_Cancela, Monto_Devuelto)
            VALUES (?, 'agendada_pendiente_pago', ?, ?, ?, NULL, 0)
            """,
            (folio_cita, fecha_str, doc['Id_Especialidad'], float(doc['Precio']))
        )

        conn.commit()

        # Respuesta (comprobante)
        return jsonify({
            'folio_cita':    folio_cita,
            'id_pago':       id_pago,
            'fecha_cita':    fecha_str,
            'hora_cita':     hora_str,
            'doctor':        f"Dr. {doc['Nombre']} {doc['Ap_Paterno']}",
            'especialidad':  doc['Especialidad'] if 'Especialidad' in doc else '',
            'consultorio':   id_consultorio,
            'monto':         float(doc['Precio']),
            'estatus':       'agendada_pendiente_pago',
            'aviso_pago':    'Tienes 8 horas para realizar el pago, de lo contrario la cita será cancelada.',
            'politica_cancelacion': {
                '48h_o_mas': 'Devolución del 100%',
                '24h':       'Devolución del 50%',
                'menos_24h': 'Sin devolución (0%)'
            }
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ------------------------------------------------------------------
# POST /api/citas/pagar
# ------------------------------------------------------------------
@citas_bp.route('/pagar', methods=['POST'])
@requiere_auth
def confirmar_pago():
    claims     = get_jwt()
    rol        = claims.get('rol')
    data       = request.get_json(silent=True) or {}
    folio_cita = data.get('folio_cita')
    metodo     = data.get('metodo_pago', 'Efectivo')

    if not folio_cita:
        return jsonify({'error': 'folio_cita es requerido.'}), 400

    # Verificar que la cita existe y está pendiente de pago
    cita = execute_query(
        """
        SELECT c.Folio_Cita, c.Solicitud_Cita, ec.Clave AS Estatus,
               e.Precio, d.Id_Especialidad
        FROM Cita c
        JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
        JOIN Doctor d        ON c.Id_Doctor      = d.Id_Doctor
        JOIN Especialidad e  ON d.Id_Especialidad = e.Id_Especialidad
        WHERE c.Folio_Cita = ?
        """,
        (folio_cita,)
    )
    if not cita:
        return jsonify({'error': 'Cita no encontrada.'}), 404

    c = cita[0]

    if c['Estatus'] != 'agendada_pendiente_pago':
        return jsonify({'error': f'La cita no está pendiente de pago (estado actual: {c["Estatus"]}).'}), 422

    # Verificar ventana de 8 horas
    solicitud_dt = c['Solicitud_Cita']
    if isinstance(solicitud_dt, str):
        solicitud_dt = datetime.fromisoformat(solicitud_dt)
    limite_pago = solicitud_dt + timedelta(hours=8)
    if datetime.now() > limite_pago:
        # Cancelar automáticamente
        _cambiar_estatus(folio_cita, 'cancelada_falta_pago', float(c['Precio']),
                         int(c['Id_Especialidad']), None, 0.0)
        return jsonify({'error': 'El tiempo de pago ha vencido (8 horas). La cita fue cancelada.'}), 422

    conn = get_db()
    try:
        cursor = conn.cursor()

        # Obtener Id del pago pendiente
        pago_row = execute_query(
            "SELECT Id_Pago FROM Pago WHERE Folio_Cita = ? AND Estado = 'Pendiente'",
            (folio_cita,)
        )
        if not pago_row:
            return jsonify({'error': 'No se encontró el pago pendiente.'}), 404

        id_pago = pago_row[0]['Id_Pago']

        # Actualizar pago
        cursor.execute(
            "UPDATE Pago SET Estado = 'Pagado', MetodoPago = ?, FechaPago = GETDATE() WHERE Id_Pago = ?",
            (metodo, id_pago)
        )

        # Cambiar estatus cita
        estatus = execute_query(
            "SELECT Id_EstatusCita FROM EstatusCita WHERE Clave = 'pagada_pendiente_atender'"
        )
        cursor.execute(
            'UPDATE Cita SET Id_EstatusCita = ? WHERE Folio_Cita = ?',
            (estatus[0]['Id_EstatusCita'], folio_cita)
        )

        # Bitácora
        cursor.execute(
            """
            INSERT INTO Bitacora_EstatusCita
                (Folio_Cita, Estatus_Cita, Fecha_Cita, Id_Especialidad,
                 Costo, Politica_Cancela, Monto_Devuelto)
            SELECT ?, 'pagada_pendiente_atender', Fecha_Cita, ?, ?, NULL, 0
            FROM Cita WHERE Folio_Cita = ?
            """,
            (folio_cita, c['Id_Especialidad'], float(c['Precio']), folio_cita)
        )
        conn.commit()
        return jsonify({'mensaje': 'Pago confirmado. Cita lista para ser atendida.'}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ------------------------------------------------------------------
# POST /api/citas/cancelar/<folio>
# ------------------------------------------------------------------
@citas_bp.route('/cancelar/<int:folio_cita>', methods=['POST'])
@requiere_auth
def cancelar_cita(folio_cita):
    claims = get_jwt()
    rol    = claims.get('rol')
    data   = request.get_json(silent=True) or {}
    motivo = data.get('motivo_cancelacion', '')

    # Obtener datos de la cita
    cita = execute_query(
        """
        SELECT c.Folio_Cita, c.Fecha_Cita, c.Hora_Cita, c.Id_Paciente, c.Id_Doctor,
               ec.Clave AS Estatus, d.Id_Especialidad, e.Precio
        FROM Cita c
        JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
        JOIN Doctor d        ON c.Id_Doctor      = d.Id_Doctor
        JOIN Especialidad e  ON d.Id_Especialidad = e.Id_Especialidad
        WHERE c.Folio_Cita = ?
        """,
        (folio_cita,)
    )
    if not cita:
        return jsonify({'error': 'Cita no encontrada.'}), 404

    c = cita[0]

    # Validar que está en estado cancelable
    if c['Estatus'] not in ('agendada_pendiente_pago', 'pagada_pendiente_atender'):
        return jsonify({'error': f'La cita no puede cancelarse (estado: {c["Estatus"]}).'}), 422

    # Validar que quien cancela tiene permiso
    id_esp = claims.get('id_especifico')
    if rol == 'paciente' and c['Id_Paciente'] != id_esp:
        return jsonify({'error': 'No puedes cancelar la cita de otro paciente.'}), 403

    # Calcular política de cancelación
    politica    = calcular_politica_cancelacion(c['Fecha_Cita'], c['Hora_Cita'])
    porcentaje  = politica['porcentaje']
    etiqueta    = politica['politica']

    # Si cancela el doctor (vía recepcionista), siempre 100%
    if rol in ('recepcionista', 'admin') and data.get('cancelacion_doctor'):
        porcentaje = 100
        etiqueta   = '100%'
        clave_nuevo_estatus = 'cancelada_doctor'
    elif rol == 'paciente' or rol in ('recepcionista', 'admin'):
        clave_nuevo_estatus = 'cancelada_paciente'
    else:
        clave_nuevo_estatus = 'cancelada_paciente'

    # Obtener monto pagado
    pago = execute_query(
        "SELECT Id_Pago, Monto FROM Pago WHERE Folio_Cita = ? AND Estado = 'Pagado'",
        (folio_cita,)
    )
    monto_devuelto = 0.0
    if pago:
        monto_pagado   = float(pago[0]['Monto'])
        monto_devuelto = calcular_monto_devolucion(monto_pagado, porcentaje)

    _cambiar_estatus(folio_cita, clave_nuevo_estatus, float(c['Precio']),
                     int(c['Id_Especialidad']), etiqueta, monto_devuelto)

    # Actualizar pago si había
    if pago and monto_devuelto > 0:
        execute_non_query(
            'UPDATE Pago SET MontoDevuelto = ? WHERE Id_Pago = ?',
            (monto_devuelto, pago[0]['Id_Pago'])
        )

    return jsonify({
        'mensaje':         f'Cita cancelada correctamente.',
        'politica':        etiqueta,
        'monto_devuelto':  monto_devuelto
    }), 200


# ------------------------------------------------------------------
# PUT /api/citas/<folio>/atender   (solo doctor)
# ------------------------------------------------------------------
@citas_bp.route('/<int:folio_cita>/atender', methods=['PUT'])
@requiere_rol('doctor')
def marcar_atendida(folio_cita):
    claims    = get_jwt()
    id_doctor = claims.get('id_especifico')

    cita = execute_query(
        """
        SELECT c.Folio_Cita, ec.Clave AS Estatus, d.Id_Especialidad, e.Precio
        FROM Cita c
        JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
        JOIN Doctor d        ON c.Id_Doctor      = d.Id_Doctor
        JOIN Especialidad e  ON d.Id_Especialidad = e.Id_Especialidad
        WHERE c.Folio_Cita = ? AND c.Id_Doctor = ?
        """,
        (folio_cita, id_doctor)
    )
    if not cita:
        return jsonify({'error': 'Cita no encontrada o no pertenece a este doctor.'}), 404

    c = cita[0]
    if c['Estatus'] != 'pagada_pendiente_atender':
        return jsonify({'error': 'La cita no está en estado para atenderse.'}), 422

    _cambiar_estatus(folio_cita, 'atendida', float(c['Precio']),
                     int(c['Id_Especialidad']), None, 0.0)
    return jsonify({'mensaje': 'Cita marcada como atendida.'}), 200


# ------------------------------------------------------------------
# PUT /api/citas/<folio>/no-acudio   (doctor o recepcionista)
# ------------------------------------------------------------------
@citas_bp.route('/<int:folio_cita>/no-acudio', methods=['PUT'])
@requiere_rol('doctor', 'recepcionista', 'admin')
def marcar_no_acudio(folio_cita):
    cita = execute_query(
        """
        SELECT c.Folio_Cita, ec.Clave AS Estatus, d.Id_Especialidad, e.Precio
        FROM Cita c
        JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
        JOIN Doctor d        ON c.Id_Doctor      = d.Id_Doctor
        JOIN Especialidad e  ON d.Id_Especialidad = e.Id_Especialidad
        WHERE c.Folio_Cita = ?
        """,
        (folio_cita,)
    )
    if not cita:
        return jsonify({'error': 'Cita no encontrada.'}), 404

    c = cita[0]
    _cambiar_estatus(folio_cita, 'no_acudio', float(c['Precio']),
                     int(c['Id_Especialidad']), None, 0.0)
    return jsonify({'mensaje': 'Cita marcada como "No Acudió".'}), 200


# ------------------------------------------------------------------
# GET /api/citas/verificar-vencidas   (job de limpieza, usar periódicamente)
# ------------------------------------------------------------------
@citas_bp.route('/verificar-vencidas', methods=['POST'])
@requiere_rol('admin', 'recepcionista')
def verificar_vencidas():
    """
    Cancela por falta de pago citas donde ya pasaron 8 horas
    y siguen en estado 'agendada_pendiente_pago'.
    En producción esto se ejecutaría con un cron job o SQL Agent.
    """
    vencidas = execute_query(
        """
        SELECT c.Folio_Cita, d.Id_Especialidad, e.Precio
        FROM Cita c
        JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
        JOIN Doctor d        ON c.Id_Doctor      = d.Id_Doctor
        JOIN Especialidad e  ON d.Id_Especialidad = e.Id_Especialidad
        WHERE ec.Clave = 'agendada_pendiente_pago'
          AND DATEADD(hour, 8, c.Solicitud_Cita) < GETDATE()
        """
    )
    count = 0
    for v in vencidas:
        _cambiar_estatus(v['Folio_Cita'], 'cancelada_falta_pago',
                         float(v['Precio']), int(v['Id_Especialidad']), None, 0.0)
        count += 1

    return jsonify({'canceladas': count, 'mensaje': f'{count} citas canceladas por vencimiento de pago.'}), 200


# ------------------------------------------------------------------
# Helpers internos
# ------------------------------------------------------------------
def _cambiar_estatus(folio_cita, nueva_clave, precio, id_esp, politica, monto_dev):
    """Actualiza estatus de una cita y registra en bitácora."""
    estatus = execute_query(
        'SELECT Id_EstatusCita FROM EstatusCita WHERE Clave = ?', (nueva_clave,)
    )
    if not estatus:
        raise ValueError(f'Estatus desconocido: {nueva_clave}')

    execute_non_query(
        'UPDATE Cita SET Id_EstatusCita = ? WHERE Folio_Cita = ?',
        (estatus[0]['Id_EstatusCita'], folio_cita)
    )
    execute_non_query(
        """
        INSERT INTO Bitacora_EstatusCita
            (Folio_Cita, Estatus_Cita, Fecha_Cita, Id_Especialidad,
             Costo, Politica_Cancela, Monto_Devuelto)
        SELECT ?, ?, Fecha_Cita, ?, ?, ?, ?
        FROM Cita WHERE Folio_Cita = ?
        """,
        (folio_cita, nueva_clave, id_esp, precio, politica, monto_dev, folio_cita)
    )


def _time_to_str(t) -> str:
    """Convierte TIME de pyodbc (timedelta o time) a string 'HH:MM'."""
    if hasattr(t, 'seconds'):   # timedelta
        total = int(t.total_seconds())
        h, m = divmod(total // 60, 60)
        return f'{h:02d}:{m:02d}'
    if hasattr(t, 'strftime'):  # datetime.time
        return t.strftime('%H:%M')
    return str(t)[:5]

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
from core.helpers import rows_to_json, validar_fecha_nacimiento

recep_bp = Blueprint('recepcionistas', __name__)


# ------------------------------------------------------------------
# ------------------------------------------------------------------
# GET /api/recepcionistas/perfil   (recepcionista consulta su perfil)
# ------------------------------------------------------------------
@recep_bp.route('/perfil', methods=['GET'])
@requiere_rol('recepcionista', 'admin')
def obtener_perfil():
    claims     = get_jwt()
    id_usuario = claims.get('id_usuario')

    rows = execute_query(
        """
        SELECT u.Id_Usuario, u.Nombre, u.Ap_Paterno, u.Ap_Materno,
               u.CURP, u.Email, u.Fecha_Nac, u.Telefono,
               u.Calle, u.Numero, u.Colonia, u.Direccion,
               DATEDIFF(year, u.Fecha_Nac, GETDATE()) AS Edad,
               e.RFC, e.Sueldo, e.DiasVacacion, e.Estatus_empleado,
               h.Turno, h.Hora_inic, h.Hora_final,
               r.Id_Recepcionista
        FROM   Usuario      u
        JOIN   Empleado     e  ON u.Id_Usuario  = e.Id_Usuario
        JOIN   Recepcionista r ON e.Id_Usuario  = r.Id_Usuario
        JOIN   Horario      h  ON e.Id_Horario  = h.Id_Horario
        WHERE  u.Id_Usuario = ?
        """,
        (id_usuario,)
    )
    if not rows:
        return jsonify({'error': 'Perfil no encontrado.'}), 404
    return jsonify(rows_to_json(rows[0])), 200


# ------------------------------------------------------------------
# PUT /api/recepcionistas/perfil   (recepcionista actualiza contacto)
# Bloqueados: Nombre, Ap_Paterno, Ap_Materno, CURP, Fecha_Nac, RFC,
#             Sueldo, DiasVacacion, Estatus_empleado
# ------------------------------------------------------------------
@recep_bp.route('/perfil', methods=['PUT'])
@requiere_rol('recepcionista', 'admin')
def actualizar_perfil():
    claims     = get_jwt()
    id_usuario = claims.get('id_usuario')
    data       = request.get_json(silent=True) or {}

    campos, params = [], []
    permitidos = ['Email', 'Telefono', 'Calle', 'Numero', 'Colonia', 'Direccion']
    for campo in permitidos:
        key = campo.lower()
        if key in data:
            valor = data[key] or None
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
    return jsonify({'mensaje': 'Perfil actualizado correctamente.'}), 200


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
    claims           = get_jwt()
    id_recepcionista = claims.get('id_especifico')

    solicitud = execute_query(
        "SELECT * FROM SolicitudCancelacion WHERE Id_Solicitud = ? AND Estatus = 'Pendiente'",
        (id_solicitud,)
    )
    if not solicitud:
        return jsonify({'error': 'Solicitud no encontrada o ya resuelta.'}), 404

    # Solo actualizar el estatus.
    # El trigger TRG_SolicitudCancelacion_Aprobada (triggers.sql) se activa
    # automáticamente con este UPDATE y se encarga de:
    #   1. Cambiar el estatus de la Cita a 'cancelada_doctor'
    #   2. Marcar el Pago como 'Cancelado' con MontoDevuelto = Monto (100%)
    #   3. Insertar en Bitacora_EstatusCita con los valores correctos
    # Hacer esas tres operaciones también desde Python generaría registros
    # duplicados en la bitácora — por eso se eliminó el código manual.
    execute_non_query(
        """
        UPDATE SolicitudCancelacion
        SET Estatus = 'Aprobada', Id_Recepcionista = ?, Fecha_Resolucion = GETDATE()
        WHERE Id_Solicitud = ?
        """,
        (id_recepcionista, id_solicitud)
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

    # ── Validar fecha de nacimiento / edad ──────────────────────
    val_fecha = validar_fecha_nacimiento(data['fecha_nac'])
    if not val_fecha['valido']:
        return jsonify({'error': val_fecha['error']}), 400
    if val_fecha['edad'] < 18:
        return jsonify({'error': 'El empleado debe ser mayor de edad (18 años o más).'}), 400

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


# ================================================================
# SOLICITUDES DE COMPRA  (recepcionista gestiona)
# ================================================================

# GET /api/recepcionistas/solicitudes-compra
@recep_bp.route('/solicitudes-compra', methods=['GET'])
@requiere_rol('recepcionista', 'admin')
def listar_solicitudes_compra():
    estatus = request.args.get('estatus', 'Pendiente')
    rows = execute_query(
        """
        SELECT sc.Id_Solicitud, sc.Estatus, sc.Fecha_Solicitud,
               sc.Fecha_Proceso, sc.Total, sc.Notas,
               up.Nombre      AS NombrePaciente,
               up.Ap_Paterno  AS ApPaternoPaciente,
               up.Telefono    AS TelefonoPaciente
        FROM   SolicitudCompra sc
        JOIN   Paciente p  ON sc.Id_Paciente = p.Id_Paciente
        JOIN   Usuario  up ON p.Id_Usuario   = up.Id_Usuario
        WHERE  sc.Estatus = ?
        ORDER  BY sc.Fecha_Solicitud ASC
        """,
        (estatus,)
    )
    return jsonify(rows_to_json(rows)), 200


# POST /api/recepcionistas/solicitudes-compra/<id>/procesar
# Convierte la SolicitudCompra en una Venta real
@recep_bp.route('/solicitudes-compra/<int:id_solicitud>/procesar', methods=['POST'])
@requiere_rol('recepcionista', 'admin')
def procesar_solicitud_compra(id_solicitud):
    claims     = get_jwt()
    id_usuario = claims.get('id_usuario')

    # Obtener id_recepcionista
    recep = execute_query(
        'SELECT Id_Recepcionista FROM Recepcionista WHERE Id_Usuario = ?', (id_usuario,)
    )
    if not recep:
        return jsonify({'error': 'No se encontró perfil de recepcionista.'}), 403
    id_recepcionista = recep[0]['Id_Recepcionista']

    # Verificar que la solicitud exista y esté pendiente
    sol = execute_query(
        'SELECT * FROM SolicitudCompra WHERE Id_Solicitud = ? AND Estatus = ?',
        (id_solicitud, 'Pendiente')
    )
    if not sol:
        return jsonify({'error': 'Solicitud no encontrada o ya procesada.'}), 404

    # Obtener detalle
    detalle = execute_query(
        """
        SELECT dsc.Id_Servicio, dsc.Id_Medicamento, dsc.Cantidad, dsc.Subtotal,
               f.Stock, f.Nombre AS NombreMedicamento
        FROM   Detalle_SolicitudCompra dsc
        LEFT JOIN Medicamentos f ON dsc.Id_Medicamento = f.Id_Medicamento
        WHERE  dsc.Id_Solicitud = ?
        """,
        (id_solicitud,)
    )

    # Re-validar stock antes de procesar
    for d in rows_to_json(detalle):
        if d['Id_Medicamento'] and d['Stock'] < d['Cantidad']:
            return jsonify({
                'error': f'Stock insuficiente para "{d["NombreMedicamento"]}". '
                         f'Disponible: {d["Stock"]}.'
            }), 409

    conn = None
    try:
        from db.connection import get_db
        conn   = get_db()
        cursor = conn.cursor()

        sol_d       = rows_to_json(detalle)
        tiene_farm  = any(d['Id_Medicamento'] for d in sol_d)
        tiene_serv  = any(d['Id_Servicio'] for d in sol_d)
        tipo_venta  = 'Mixta' if (tiene_farm and tiene_serv) else ('Medicamento' if tiene_farm else 'Servicio')

        # Crear Venta
        cursor.execute(
            """
            INSERT INTO Venta (Id_Recepcionista, Total, Tipo_Venta)
            OUTPUT INSERTED.Id_Venta
            VALUES (?, ?, ?)
            """,
            (id_recepcionista, float(sol[0]['Total']), tipo_venta)
        )
        id_venta = int(cursor.fetchone()[0])

        # Crear Detalle_Venta y descontar stock
        for d in sol_d:
            cursor.execute(
                """
                INSERT INTO Detalle_Venta
                       (Id_Venta, Id_Servicio, Id_Medicamento, Cantidad, Subtotal)
                VALUES (?, ?, ?, ?, ?)
                """,
                (id_venta, d['Id_Servicio'], d['Id_Medicamento'], d['Cantidad'], d['Subtotal'])
            )
            if d['Id_Medicamento']:
                cursor.execute(
                    'UPDATE Medicamentos SET Stock = Stock - ? WHERE Id_Medicamento = ?',
                    (d['Cantidad'], d['Id_Medicamento'])
                )

        # Marcar solicitud como Procesada
        cursor.execute(
            """
            UPDATE SolicitudCompra
            SET Estatus          = 'Procesada',
                Id_Recepcionista = ?,
                Fecha_Proceso    = GETDATE()
            WHERE Id_Solicitud   = ?
            """,
            (id_recepcionista, id_solicitud)
        )

        conn.commit()
        return jsonify({'id_venta': id_venta, 'mensaje': 'Solicitud procesada y venta registrada.'}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()


# POST /api/recepcionistas/solicitudes-compra/<id>/rechazar
@recep_bp.route('/solicitudes-compra/<int:id_solicitud>/rechazar', methods=['POST'])
@requiere_rol('recepcionista', 'admin')
def rechazar_solicitud_compra(id_solicitud):
    claims     = get_jwt()
    id_usuario = claims.get('id_usuario')
    data       = request.get_json(silent=True) or {}

    recep = execute_query(
        'SELECT Id_Recepcionista FROM Recepcionista WHERE Id_Usuario = ?', (id_usuario,)
    )
    if not recep:
        return jsonify({'error': 'No se encontró perfil de recepcionista.'}), 403
    id_recepcionista = recep[0]['Id_Recepcionista']

    sol = execute_query(
        'SELECT Id_Solicitud FROM SolicitudCompra WHERE Id_Solicitud = ? AND Estatus = ?',
        (id_solicitud, 'Pendiente')
    )
    if not sol:
        return jsonify({'error': 'Solicitud no encontrada o ya procesada.'}), 404

    execute_non_query(
        """
        UPDATE SolicitudCompra
        SET Estatus          = 'Rechazada',
            Id_Recepcionista = ?,
            Fecha_Proceso    = GETDATE(),
            Notas            = ?
        WHERE Id_Solicitud   = ?
        """,
        (id_recepcionista, data.get('motivo', ''), id_solicitud)
    )
    return jsonify({'mensaje': 'Solicitud rechazada.'}), 200

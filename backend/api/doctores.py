"""
Rutas del perfil Doctor.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt
from datetime import date as dt_date
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from db.connection import execute_query, execute_non_query, execute_insert_returning_id, get_db
from core.decorators import requiere_auth, requiere_rol
from core.helpers import rows_to_json, validar_fecha_nacimiento

doctor_bp = Blueprint('doctores', __name__)


# ------------------------------------------------------------------
# GET /api/doctores/perfil
# ------------------------------------------------------------------
@doctor_bp.route('/perfil', methods=['GET'])
@requiere_rol('doctor')
def obtener_perfil():
    claims = get_jwt()
    id_usuario = claims.get('id_usuario')

    rows = execute_query(
        """
        SELECT d.Id_Doctor, d.Cedula_prof,
               u.Nombre, u.Ap_Paterno, u.Ap_Materno, u.Email, u.CURP,
               u.Telefono, u.Fecha_Nac,
               DATEDIFF(year, u.Fecha_Nac, GETDATE()) AS Edad,
               e.Especialidad, e.Id_Especialidad,
               h.Turno, h.Hora_inic, h.Hora_final,
               emp.RFC, emp.Sueldo, emp.DiasVacacion, emp.Estatus_empleado
        FROM Doctor d
        JOIN Usuario    u   ON d.Id_Usuario      = u.Id_Usuario
        JOIN Especialidad e ON d.Id_Especialidad  = e.Id_Especialidad
        JOIN Horario    h   ON d.Id_Horario       = h.Id_Horario
        JOIN Empleado   emp ON emp.Id_Usuario     = u.Id_Usuario
        WHERE u.Id_Usuario = ?
        """,
        (id_usuario,)
    )
    if not rows:
        return jsonify({'error': 'Doctor no encontrado.'}), 404
    return jsonify(rows_to_json(rows[0])), 200


# ------------------------------------------------------------------
# GET /api/doctores   (cualquier autenticado puede listar doctores)
# ------------------------------------------------------------------
@doctor_bp.route('', methods=['GET'])
@requiere_auth
def listar_doctores():
    id_esp = request.args.get('id_especialidad')
    params, filtro = [], ''
    if id_esp:
        filtro = 'WHERE d.Id_Especialidad = ?'
        params.append(int(id_esp))

    rows = execute_query(
        f"""
        SELECT d.Id_Doctor, d.Cedula_prof,
               u.Nombre, u.Ap_Paterno, u.Ap_Materno,
               e.Especialidad, e.Id_Especialidad,
               h.Turno, h.Hora_inic, h.Hora_final
        FROM Doctor d
        JOIN Usuario    u  ON d.Id_Usuario     = u.Id_Usuario
        JOIN Especialidad e ON d.Id_Especialidad = e.Id_Especialidad
        JOIN Horario    h  ON d.Id_Horario     = h.Id_Horario
        JOIN Empleado emp  ON emp.Id_Usuario   = u.Id_Usuario
        WHERE emp.Estatus_empleado = 'Activo'
        {'AND d.Id_Especialidad = ?' if id_esp else ''}
        ORDER BY u.Ap_Paterno
        """,
        tuple(params) if params else None
    )
    return jsonify(rows_to_json(rows)), 200


# ------------------------------------------------------------------
# GET /api/doctores/<id>
# ------------------------------------------------------------------
@doctor_bp.route('/<int:id_doctor>', methods=['GET'])
@requiere_auth
def obtener_doctor(id_doctor):
    rows = execute_query(
        """
        SELECT d.Id_Doctor, d.Cedula_prof,
               u.Nombre, u.Ap_Paterno, u.Ap_Materno,
               e.Especialidad, e.Precio,
               h.Turno, h.Hora_inic, h.Hora_final
        FROM Doctor d
        JOIN Usuario    u  ON d.Id_Usuario     = u.Id_Usuario
        JOIN Especialidad e ON d.Id_Especialidad = e.Id_Especialidad
        JOIN Horario    h  ON d.Id_Horario     = h.Id_Horario
        WHERE d.Id_Doctor = ?
        """,
        (id_doctor,)
    )
    if not rows:
        return jsonify({'error': 'Doctor no encontrado.'}), 404
    return jsonify(rows_to_json(rows[0])), 200


# ------------------------------------------------------------------
# GET /api/doctores/pacientes   (el doctor ve sus pacientes)
# ------------------------------------------------------------------
@doctor_bp.route('/pacientes', methods=['GET'])
@requiere_rol('doctor')
def mis_pacientes():
    claims = get_jwt()
    id_doctor = claims.get('id_especifico')

    # Usamos VW_CitasCompletas (no VW_AgendaDoctor) para incluir pacientes
    # de citas ya atendidas, canceladas, etc. — no solo las citas activas.
    # DISTINCT sobre Id_Paciente garantiza un registro por paciente único.
    rows = execute_query(
        """
        SELECT DISTINCT
               vc.Id_Paciente,
               vc.NombrePaciente,
               vc.ApPaternoPaciente     AS Ap_Paterno,
               up.Ap_Materno,
               up.Telefono,
               up.Email,
               dbo.FN_CalcularEdad(up.Fecha_Nac) AS Edad,
               hm.Tipo_sangre,
               hm.Alergias
        FROM VW_CitasCompletas vc
        JOIN Paciente  pa ON vc.Id_Paciente  = pa.Id_Paciente
        JOIN Usuario   up ON pa.Id_Usuario   = up.Id_Usuario
        LEFT JOIN Historial_medico hm ON hm.Id_Paciente = pa.Id_Paciente
        WHERE vc.Id_Doctor = ?
        ORDER BY vc.ApPaternoPaciente, vc.NombrePaciente
        """,
        (id_doctor,)
    )
    return jsonify(rows_to_json(rows)), 200


# ------------------------------------------------------------------
# POST /api/doctores/recetas
# ------------------------------------------------------------------
@doctor_bp.route('/recetas', methods=['POST'])
@requiere_rol('doctor')
def crear_receta():
    claims    = get_jwt()
    id_doctor = claims.get('id_especifico')
    data      = request.get_json(silent=True) or {}

    # ── Validar campos obligatorios ──────────────────────────────────
    required = ['folio_cita', 'diagnostico', 'tratamiento', 'duracion']
    missing  = [f for f in required if not data.get(f)]
    medicamentos = data.get('medicamentos') or []
    if not isinstance(medicamentos, list) or len(medicamentos) == 0:
        missing.append('medicamentos (al menos uno)')
    if missing:
        return jsonify({'error': f'Campos faltantes: {", ".join(missing)}'}), 400

    # ── Verificar que la cita pertenece a este doctor ────────────────
    cita = execute_query(
        '''SELECT c.Folio_Cita, c.Fecha_Cita, ec.Clave AS Estatus
           FROM Cita c
           JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
           WHERE c.Folio_Cita = ? AND c.Id_Doctor = ?''',
        (data['folio_cita'], id_doctor)
    )
    if not cita:
        return jsonify({'error': 'Cita no encontrada o no pertenece a este doctor.'}), 403

    c = cita[0]
    if c['Estatus'] != 'pagada_pendiente_atender':
        return jsonify({'error': 'La cita no está en estado confirmado para atenderse.'}), 422

    # ── Validar que hoy es el día de la cita (rúbrica) ───────────────
    fecha_cita = c['Fecha_Cita']
    if hasattr(fecha_cita, 'date'):
        fecha_cita = fecha_cita.date()
    if fecha_cita != dt_date.today():
        return jsonify({
            'error': f'La receta solo puede emitirse el día de la cita ({fecha_cita}). '
                     f'Hoy es {dt_date.today()}.'
        }), 422

    # ── Resumen legacy (columna Medicamento original) ─────────────────
    med_resumen = ', '.join(
        m.get('nombre', '') for m in medicamentos if m.get('nombre')
    )

    # ── Transacción: receta + medicamentos individuales + estatus cita ─
    conn = get_db()
    try:
        cursor = conn.cursor()

        # 1. Insertar la receta con todos los campos requeridos
        cursor.execute(
            '''INSERT INTO Receta
                   (Folio_Cita, Diagnostico, Medicamento, Tratamiento, Duracion, Observaciones)
               OUTPUT INSERTED.Id_Receta
               VALUES (?, ?, ?, ?, ?, ?)''',
            (data['folio_cita'],
             data['diagnostico'].strip(),
             med_resumen,
             data['tratamiento'].strip(),
             data['duracion'].strip(),
             (data.get('observaciones') or '').strip() or None)
        )
        id_receta = int(cursor.fetchone()[0])

        # 2. Insertar un registro por cada medicamento (rúbrica)
        for med in medicamentos:
            nombre = (med.get('nombre') or '').strip()
            if nombre:
                cursor.execute(
                    '''INSERT INTO Receta_Medicamento (Id_Receta, Nombre, Dosis, Frecuencia)
                       VALUES (?, ?, ?, ?)''',
                    (id_receta,
                     nombre,
                     (med.get('dosis') or '').strip() or None,
                     (med.get('frecuencia') or '').strip() or None)
                )

        # 3. Actualizar estatus de la cita → atendida (rúbrica)
        estatus = execute_query(
            "SELECT Id_EstatusCita FROM EstatusCita WHERE Clave = 'atendida'"
        )
        cursor.execute(
            'UPDATE Cita SET Id_EstatusCita = ? WHERE Folio_Cita = ?',
            (estatus[0]['Id_EstatusCita'], data['folio_cita'])
        )

        conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify({'error': str(exc)}), 500
    finally:
        conn.close()

    # Registrar en bitácora (fuera de la transacción principal)
    _registrar_bitacora_historial(data['folio_cita'], id_receta, 'Atendida', claims)

    return jsonify({'id_receta': id_receta, 'mensaje': 'Receta creada correctamente.'}), 201


# ------------------------------------------------------------------
# GET /api/doctores/recetas   (listar recetas del doctor)
# ------------------------------------------------------------------
@doctor_bp.route('/recetas', methods=['GET'])
@requiere_rol('doctor')
def listar_recetas():
    claims    = get_jwt()
    id_doctor = claims.get('id_especifico')

    rows = execute_query(
        """
        SELECT Id_Receta, Folio_Cita, FechaEmision,
               Diagnostico, Medicamento, Tratamiento, Duracion, Observaciones,
               NombrePaciente, ApPaternoPaciente,
               Edad AS EdadPaciente
        FROM VW_HistorialPaciente
        WHERE Id_Doctor  = ?
          AND Id_Receta IS NOT NULL
        ORDER BY FechaEmision DESC
        """,
        (id_doctor,)
    )
    return jsonify(rows_to_json(rows)), 200


# ------------------------------------------------------------------
# GET /api/doctores/recetas/<id>  (detalle con medicamentos individuales)
# ------------------------------------------------------------------
@doctor_bp.route('/recetas/<int:id_receta>', methods=['GET'])
@requiere_rol('doctor')
def obtener_receta_detalle(id_receta):
    claims    = get_jwt()
    id_doctor = claims.get('id_especifico')

    receta = execute_query(
        """
        SELECT r.Id_Receta, r.Folio_Cita, r.FechaEmision,
               r.Diagnostico, r.Medicamento, r.Tratamiento, r.Duracion, r.Observaciones,
               up.Nombre AS NombrePaciente, up.Ap_Paterno AS ApPaternoPaciente,
               dbo.FN_CalcularEdad(up.Fecha_Nac) AS EdadPaciente
        FROM   Receta   r
        JOIN   Cita     c  ON r.Folio_Cita  = c.Folio_Cita
        JOIN   Paciente pa ON c.Id_Paciente  = pa.Id_Paciente
        JOIN   Usuario  up ON pa.Id_Usuario  = up.Id_Usuario
        WHERE  r.Id_Receta = ? AND c.Id_Doctor = ?
        """,
        (id_receta, id_doctor)
    )
    if not receta:
        return jsonify({'error': 'Receta no encontrada.'}), 404

    meds = execute_query(
        """
        SELECT Id_RecetaMed, Nombre, Dosis, Frecuencia
        FROM   Receta_Medicamento
        WHERE  Id_Receta = ?
        ORDER BY Id_RecetaMed
        """,
        (id_receta,)
    )

    resultado              = rows_to_json(receta[0])
    resultado['Medicamentos'] = rows_to_json(meds) if meds else []
    return jsonify(resultado), 200


# ------------------------------------------------------------------
# POST /api/doctores/solicitar-cancelacion
# ------------------------------------------------------------------
@doctor_bp.route('/solicitar-cancelacion', methods=['POST'])
@requiere_rol('doctor')
def solicitar_cancelacion():
    claims = get_jwt()
    id_doctor = claims.get('id_especifico')
    data = request.get_json(silent=True) or {}

    folio_cita = data.get('folio_cita')
    motivo     = (data.get('motivo') or '').strip()

    if not folio_cita or not motivo:
        return jsonify({'error': 'folio_cita y motivo son requeridos.'}), 400

    # Verificar que la cita es del doctor y está activa
    cita = execute_query(
        """
        SELECT c.Folio_Cita FROM Cita c
        JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
        WHERE c.Folio_Cita = ? AND c.Id_Doctor = ?
          AND ec.Clave IN ('agendada_pendiente_pago','pagada_pendiente_atender')
        """,
        (folio_cita, id_doctor)
    )
    if not cita:
        return jsonify({'error': 'Cita no encontrada, no activa o no pertenece a este doctor.'}), 404

    execute_non_query(
        """
        INSERT INTO SolicitudCancelacion (Folio_Cita, Id_Doctor, Motivo)
        VALUES (?, ?, ?)
        """,
        (folio_cita, id_doctor, motivo)
    )
    return jsonify({'mensaje': 'Solicitud de cancelación enviada. Pendiente de aprobación por recepcionista.'}), 201


# ------------------------------------------------------------------
# GET /api/doctores/<id>/horarios-disponibles
# ------------------------------------------------------------------
@doctor_bp.route('/<int:id_doctor>/horarios-disponibles', methods=['GET'])
@requiere_auth
def horarios_disponibles(id_doctor):
    """
    Retorna lista de slots libres del doctor en un rango de fechas.
    Query params: fecha_inicio (YYYY-MM-DD), fecha_fin (YYYY-MM-DD)
    """
    fecha_inicio = request.args.get('fecha_inicio')
    fecha_fin    = request.args.get('fecha_fin')

    if not fecha_inicio or not fecha_fin:
        return jsonify({'error': 'fecha_inicio y fecha_fin son requeridos.'}), 400

    # Obtener horario del doctor
    horario = execute_query(
        """
        SELECT h.Hora_inic, h.Hora_final
        FROM Doctor d JOIN Horario h ON d.Id_Horario = h.Id_Horario
        WHERE d.Id_Doctor = ?
        """,
        (id_doctor,)
    )
    if not horario:
        return jsonify({'error': 'Doctor no encontrado.'}), 404

    # Obtener citas ya ocupadas en el rango
    ocupadas = execute_query(
        """
        SELECT Fecha_Cita, Hora_Cita FROM Cita
        WHERE Id_Doctor = ?
          AND Fecha_Cita BETWEEN ? AND ?
          AND Id_EstatusCita IN (
              SELECT Id_EstatusCita FROM EstatusCita
              WHERE Clave IN ('agendada_pendiente_pago','pagada_pendiente_atender')
          )
        """,
        (id_doctor, fecha_inicio, fecha_fin)
    )

    ocupadas_set = {
        (str(r['Fecha_Cita']), str(r['Hora_Cita'])[:5])
        for r in ocupadas
    }

    return jsonify({
        'horario_doctor': rows_to_json(horario[0]),
        'fechas_ocupadas': list(ocupadas_set)
    }), 200


# ------------------------------------------------------------------
# POST /api/doctores   (solo recepcionista da de alta doctores)
# ------------------------------------------------------------------
@doctor_bp.route('', methods=['POST'])
@requiere_rol('recepcionista', 'admin')
def crear_doctor():
    import bcrypt
    data = request.get_json(silent=True) or {}

    required = ['nombre', 'ap_paterno', 'email', 'password', 'curp',
                'fecha_nac', 'rfc', 'cedula_prof', 'id_especialidad',
                'id_horario', 'sueldo']
    missing = [f for f in required if not data.get(f)]
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
    if val_fecha['edad'] < 23:
        return jsonify({'error': 'El doctor debe tener al menos 23 años de edad (edad mínima para contar con cédula profesional).'}), 400

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
            VALUES (2, ?, ?, ?, ?, ?, ?, ?, ?);
            SELECT SCOPE_IDENTITY();
            """,
            (
                data['nombre'].strip(), data['ap_paterno'].strip(),
                data.get('ap_materno', '').strip() or None,
                data['curp'].strip().upper(), email,
                data['fecha_nac'], password_hash,
                data.get('telefono') or None
            )
        )
        id_usuario = int(cursor.fetchone()[0])

        cursor.execute(
            """
            INSERT INTO Empleado (Id_Usuario, Id_Horario, RFC, Sueldo, DiasVacacion, Estatus_empleado)
            VALUES (?, ?, ?, ?, ?, 'Activo');
            """,
            (id_usuario, data['id_horario'], data['rfc'].strip(),
             float(data['sueldo']), int(data.get('dias_vacacion', 15)))
        )

        cursor.execute(
            """
            INSERT INTO Doctor (Id_Usuario, Id_Especialidad, Id_Horario, Cedula_prof)
            VALUES (?, ?, ?, ?);
            SELECT SCOPE_IDENTITY();
            """,
            (id_usuario, data['id_especialidad'], data['id_horario'],
             data['cedula_prof'].strip())
        )
        id_doctor = int(cursor.fetchone()[0])
        conn.commit()
        return jsonify({'id_doctor': id_doctor, 'mensaje': 'Doctor registrado correctamente.'}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ------------------------------------------------------------------
# Helpers internos
# ------------------------------------------------------------------
def _registrar_bitacora_historial(folio_cita, folio_receta, estatus, claims):
    try:
        cita = execute_query(
            """
            SELECT c.Fecha_Cita, c.Hora_Cita, c.Id_Paciente, c.Id_Doctor,
                   c.Id_Consultorio, e.Especialidad
            FROM Cita c
            JOIN Doctor d     ON c.Id_Doctor       = d.Id_Doctor
            JOIN Especialidad e ON d.Id_Especialidad = e.Id_Especialidad
            WHERE c.Folio_Cita = ?
            """,
            (folio_cita,)
        )
        if not cita:
            return
        c = cita[0]
        execute_non_query(
            """
            INSERT INTO Bitacora_HistorialCitas
                (Usuario, Rol_Usuario, Folio_Cita, Fecha_Cita, Hora_Cita,
                 Id_Paciente, Folio_Receta, Id_Doctor, Estatus_Consulta,
                 Especialidad, Id_Consultorio)
            VALUES (?, 'doctor', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                claims.get('sub', ''), folio_cita,
                c['Fecha_Cita'], c['Hora_Cita'],
                c['Id_Paciente'], folio_receta,
                c['Id_Doctor'], estatus,
                c['Especialidad'], c['Id_Consultorio']
            )
        )
    except Exception:
        pass  # No interrumpir flujo principal por error en bitácora


# PATCH /api/doctores/<id>/dar-baja
# Solo recepcionista/admin puede ejecutar esta acción.
@doctor_bp.route('/<int:id_doctor>/dar-baja', methods=['PATCH'])
@requiere_rol('recepcionista', 'admin')
def dar_baja_doctor(id_doctor):
    """
    Da de baja (inactiva) a un doctor aplicando las validaciones de negocio:
      - El doctor debe existir y estar Activo.
      - No puede tener citas con estatus 'agendada_pendiente_pago' o 'pagada_pendiente_atender'.
      - No puede tener pagos de cita en estatus 'Pendiente' asociados.
      - Si pasa todas las validaciones, se cambia Estatus_empleado → 'Inactivo'.
    """
    # 1. Verificar que el doctor existe y está activo
    doctor_rows = execute_query(
        """
        SELECT d.Id_Doctor, e.Estatus_empleado,
               u.Nombre, u.Ap_Paterno
        FROM Doctor d
        JOIN Empleado e ON d.Id_Usuario = e.Id_Usuario
        JOIN Usuario  u ON d.Id_Usuario = u.Id_Usuario
        WHERE d.Id_Doctor = ?
        """,
        (id_doctor,)
    )
    if not doctor_rows:
        return jsonify({'error': 'Doctor no encontrado.'}), 404

    doc = doctor_rows[0]
    if doc['Estatus_empleado'] == 'Inactivo':
        return jsonify({'error': f"El doctor {doc['Nombre']} {doc['Ap_Paterno']} ya se encuentra inactivo."}), 409

    # 2. Validar que no tenga citas activas (pendientes de pago o por atender)
    citas_activas = execute_query(
        """
        SELECT COUNT(*) AS total
        FROM Cita c
        JOIN EstatusCita ec ON c.Id_EstatusCita = ec.Id_EstatusCita
        WHERE c.Id_Doctor = ?
          AND ec.Clave IN ('agendada_pendiente_pago', 'pagada_pendiente_atender')
        """,
        (id_doctor,)
    )
    n_citas = citas_activas[0]['total'] if citas_activas else 0
    if n_citas > 0:
        return jsonify({
            'error': f'El doctor tiene {n_citas} cita(s) activa(s) pendiente(s). '
                     f'Cancélalas o reasígnalas antes de dar de baja al doctor.'
        }), 409

    # 3. Validar que no tenga pagos pendientes de cita asociados
    pagos_pendientes = execute_query(
        """
        SELECT COUNT(*) AS total
        FROM Pago p
        JOIN Cita c ON p.Folio_Cita = c.Folio_Cita
        WHERE c.Id_Doctor = ?
          AND p.Estado    = 'Pendiente'
        """,
        (id_doctor,)
    )
    n_pagos = pagos_pendientes[0]['total'] if pagos_pendientes else 0
    if n_pagos > 0:
        return jsonify({
            'error': f'El doctor tiene {n_pagos} pago(s) de cita pendiente(s). '
                     f'Resuelve los pagos antes de dar de baja al doctor.'
        }), 409

    # 4. Dar de baja: cambiar Estatus_empleado → 'Inactivo'
    execute_non_query(
        """
        UPDATE Empleado
        SET    Estatus_empleado = 'Inactivo'
        WHERE  Id_Usuario = (SELECT Id_Usuario FROM Doctor WHERE Id_Doctor = ?)
        """,
        (id_doctor,)
    )

    return jsonify({
        'mensaje': f"Doctor {doc['Nombre']} {doc['Ap_Paterno']} dado de baja correctamente."
    }), 200

"""
Rutas de compras públicas (walk-in) y procesamiento por recepcionista.

Flujo:
  1. Cualquier persona (registrada o no) POST /api/compras/solicitar
       → Crea SolicitudCompra con sus datos de cliente y carrito
       → Devuelve un ticket con folio y desglose
  2. Recepcionista PATCH /api/compras/<id>/procesar
       → Valida stock, genera Venta + Detalle_Venta, descuenta stock, marca solicitud Procesada
  3. Recepcionista DELETE /api/compras/<id>/rechazar   (opcional, con motivo)
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from db.connection import get_db, execute_query, execute_non_query
from core.decorators import requiere_rol
from core.helpers import rows_to_json

compras_bp = Blueprint('compras', __name__)


# ──────────────────────────────────────────────────────────────
# POST /api/compras/solicitar   (PÚBLICO — sin autenticación)
# ──────────────────────────────────────────────────────────────
@compras_bp.route('/solicitar', methods=['POST'])
def solicitar_compra():
    """
    Body:
    {
        "nombre_cliente": "María López",   # obligatorio
        "telefono_cliente": "5551234567",  # opcional
        "items": [
            { "tipo": "medicamento", "id": 3, "cantidad": 2 },
            { "tipo": "servicio",    "id": 1, "cantidad": 1 }
        ]
    }
    No requiere JWT. El cliente puede ser cualquier persona.
    """
    data             = request.get_json(silent=True) or {}
    nombre_cliente   = (data.get('nombre_cliente') or '').strip()
    telefono_cliente = (data.get('telefono_cliente') or '').strip()
    items            = data.get('items', [])

    if not nombre_cliente:
        return jsonify({'error': 'El nombre del cliente es obligatorio.'}), 400
    if not items:
        return jsonify({'error': 'El carrito está vacío.'}), 400

    # Validar items y calcular total con precios reales de BD
    total = 0.0
    items_validados = []
    for item in items:
        tipo     = item.get('tipo')
        id_item  = item.get('id')
        cantidad = int(item.get('cantidad', 1))
        if cantidad < 1:
            return jsonify({'error': 'La cantidad debe ser al menos 1.'}), 400

        if tipo == 'medicamento':
            prod = execute_query(
                'SELECT Nombre, Precio, Stock FROM Medicamentos WHERE Id_Medicamento = ?',
                (id_item,)
            )
            if not prod:
                return jsonify({'error': f'Medicamento id={id_item} no encontrado.'}), 404
            if prod[0]['Stock'] < cantidad:
                return jsonify({
                    'error': f'Stock insuficiente para "{prod[0]["Nombre"]}". '
                             f'Disponible: {prod[0]["Stock"]}.'
                }), 409
            subtotal = float(prod[0]['Precio']) * cantidad
            items_validados.append({
                'tipo': 'medicamento', 'id': id_item,
                'nombre': prod[0]['Nombre'],
                'precio_unitario': float(prod[0]['Precio']),
                'cantidad': cantidad, 'subtotal': round(subtotal, 2)
            })

        elif tipo == 'servicio':
            serv = execute_query(
                'SELECT Nombre, Precio FROM Servicio WHERE Id_Servicio = ?', (id_item,)
            )
            if not serv:
                return jsonify({'error': f'Servicio id={id_item} no encontrado.'}), 404
            subtotal = float(serv[0]['Precio']) * cantidad
            items_validados.append({
                'tipo': 'servicio', 'id': id_item,
                'nombre': serv[0]['Nombre'],
                'precio_unitario': float(serv[0]['Precio']),
                'cantidad': cantidad, 'subtotal': round(subtotal, 2)
            })
        else:
            return jsonify({'error': f'Tipo de artículo inválido: {tipo}'}), 400

        total += subtotal

    # Insertar SolicitudCompra + Detalle
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO SolicitudCompra
                (Nombre_Cliente, Telefono_Cliente, Total)
            OUTPUT INSERTED.Id_Solicitud
            VALUES (?, ?, ?)
            """,
            (nombre_cliente, telefono_cliente or None, round(total, 2))
        )
        id_solicitud = int(cursor.fetchone()[0])

        for it in items_validados:
            id_serv = it['id'] if it['tipo'] == 'servicio'    else None
            id_med  = it['id'] if it['tipo'] == 'medicamento' else None
            cursor.execute(
                """
                INSERT INTO Detalle_SolicitudCompra
                    (Id_Solicitud, Id_Servicio, Id_Medicamento, Cantidad, Subtotal)
                VALUES (?, ?, ?, ?, ?)
                """,
                (id_solicitud, id_serv, id_med, it['cantidad'], it['subtotal'])
            )

        conn.commit()
        return jsonify({
            'id_solicitud':   id_solicitud,
            'nombre_cliente': nombre_cliente,
            'items':          items_validados,
            'total':          round(total, 2),
            'estatus':        'Pendiente',
            'mensaje': (
                f'Solicitud #{id_solicitud:05d} registrada. '
                'Preséntate en el mostrador con este folio para completar tu compra.'
            )
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────
# GET /api/compras/pendientes   (recepcionista)
# ──────────────────────────────────────────────────────────────
@compras_bp.route('/pendientes', methods=['GET'])
@requiere_rol('recepcionista', 'admin')
def listar_pendientes():
    rows = execute_query(
        """
        SELECT sc.Id_Solicitud, sc.Nombre_Cliente, sc.Telefono_Cliente,
               sc.Total, sc.Estatus, sc.Fecha_Solicitud, sc.Notas,
               p.Id_Paciente,
               up.Nombre  AS NombrePaciente,
               up.Ap_Paterno AS ApPaciente
        FROM SolicitudCompra sc
        LEFT JOIN Paciente p  ON sc.Id_Paciente = p.Id_Paciente
        LEFT JOIN Usuario  up ON p.Id_Usuario   = up.Id_Usuario
        WHERE sc.Estatus = 'Pendiente'
        ORDER BY sc.Fecha_Solicitud ASC
        """
    )
    result = []
    for r in rows_to_json(rows):
        # Unificar nombre de cliente (registrado o anónimo)
        r['cliente'] = (
            f"{r.get('NombrePaciente','')} {r.get('ApPaciente','')}".strip()
            if r.get('NombrePaciente')
            else r.get('Nombre_Cliente', 'Desconocido')
        )
        result.append(r)
    return jsonify(result), 200


# ──────────────────────────────────────────────────────────────
# GET /api/compras/<id>/detalle   (recepcionista)
# ──────────────────────────────────────────────────────────────
@compras_bp.route('/<int:id_solicitud>/detalle', methods=['GET'])
@requiere_rol('recepcionista', 'admin')
def detalle_solicitud(id_solicitud):
    encabezado = execute_query(
        """
        SELECT sc.Id_Solicitud, sc.Nombre_Cliente, sc.Telefono_Cliente,
               sc.Total, sc.Estatus, sc.Fecha_Solicitud,
               p.Id_Paciente,
               up.Nombre  AS NombrePaciente,
               up.Ap_Paterno AS ApPaciente
        FROM SolicitudCompra sc
        LEFT JOIN Paciente p  ON sc.Id_Paciente = p.Id_Paciente
        LEFT JOIN Usuario  up ON p.Id_Usuario   = up.Id_Usuario
        WHERE sc.Id_Solicitud = ?
        """,
        (id_solicitud,)
    )
    if not encabezado:
        return jsonify({'error': 'Solicitud no encontrada.'}), 404

    detalle = execute_query(
        """
        SELECT dsc.Cantidad, dsc.Subtotal,
               m.Nombre  AS NombreMed,   m.Precio AS PrecioMed,
               s.Nombre  AS NombreServ,  s.Precio AS PrecioServ
        FROM Detalle_SolicitudCompra dsc
        LEFT JOIN Medicamentos m ON dsc.Id_Medicamento = m.Id_Medicamento
        LEFT JOIN Servicio     s ON dsc.Id_Servicio    = s.Id_Servicio
        WHERE dsc.Id_Solicitud = ?
        """,
        (id_solicitud,)
    )

    res = rows_to_json(encabezado[0])
    res['cliente'] = (
        f"{res.get('NombrePaciente','')} {res.get('ApPaciente','')}".strip()
        if res.get('NombrePaciente')
        else res.get('Nombre_Cliente', 'Desconocido')
    )
    items = []
    for d in rows_to_json(detalle):
        items.append({
            'nombre':   d.get('NombreMed') or d.get('NombreServ'),
            'tipo':     'medicamento' if d.get('NombreMed') else 'servicio',
            'precio':   float(d.get('PrecioMed') or d.get('PrecioServ') or 0),
            'cantidad': d['Cantidad'],
            'subtotal': float(d['Subtotal'])
        })
    res['items'] = items
    return jsonify(res), 200


# ──────────────────────────────────────────────────────────────
# PATCH /api/compras/<id>/procesar   (recepcionista)
# ──────────────────────────────────────────────────────────────
@compras_bp.route('/<int:id_solicitud>/procesar', methods=['PATCH'])
@requiere_rol('recepcionista', 'admin')
def procesar_solicitud(id_solicitud):
    """
    Recepcionista revisa el ticket y confirma la venta.
    Genera Venta + Detalle_Venta, descuenta stock y marca la solicitud como Procesada.
    """
    claims           = get_jwt()
    id_recepcionista = claims.get('id_especifico')

    # Verificar solicitud pendiente
    sol = execute_query(
        "SELECT * FROM SolicitudCompra WHERE Id_Solicitud = ?", (id_solicitud,)
    )
    if not sol:
        return jsonify({'error': 'Solicitud no encontrada.'}), 404
    if sol[0]['Estatus'] != 'Pendiente':
        return jsonify({'error': f"La solicitud ya fue {sol[0]['Estatus'].lower()}."}), 409

    # Obtener detalle
    detalle = execute_query(
        """
        SELECT dsc.Id_Servicio, dsc.Id_Medicamento, dsc.Cantidad, dsc.Subtotal,
               m.Stock AS StockActual
        FROM Detalle_SolicitudCompra dsc
        LEFT JOIN Medicamentos m ON dsc.Id_Medicamento = m.Id_Medicamento
        WHERE dsc.Id_Solicitud = ?
        """,
        (id_solicitud,)
    )

    # Revalidar stock (puede haber cambiado desde que se creó la solicitud)
    for d in detalle:
        if d['Id_Medicamento'] and (d['StockActual'] is None or d['StockActual'] < d['Cantidad']):
            return jsonify({
                'error': f'Stock insuficiente para medicamento id={d["Id_Medicamento"]}. '
                         f'Disponible: {d["StockActual"] or 0}.'
            }), 409

    conn = get_db()
    try:
        cursor = conn.cursor()
        total = float(sol[0]['Total'])

        # Determinar Tipo_Venta
        tipos = set()
        for d in detalle:
            if d['Id_Medicamento']: tipos.add('Medicamento')
            if d['Id_Servicio']:    tipos.add('Servicio')
        tipo_venta = tipos.pop() if len(tipos) == 1 else 'Mixta'

        # Crear Venta
        cursor.execute(
            """
            INSERT INTO Venta (Id_Recepcionista, Total, Tipo_Venta)
            OUTPUT INSERTED.Id_Venta
            VALUES (?, ?, ?)
            """,
            (id_recepcionista, total, tipo_venta)
        )
        id_venta = int(cursor.fetchone()[0])

        # Crear Detalle_Venta y descontar stock
        for d in detalle:
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
            WHERE Id_Solicitud = ?
            """,
            (id_recepcionista, id_solicitud)
        )

        conn.commit()
        return jsonify({
            'id_venta':    id_venta,
            'id_solicitud': id_solicitud,
            'total':       total,
            'tipo_venta':  tipo_venta,
            'mensaje':     f'Venta #{id_venta:05d} generada a partir de solicitud #{id_solicitud:05d}.'
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────
# PATCH /api/compras/<id>/rechazar   (recepcionista)
# ──────────────────────────────────────────────────────────────
@compras_bp.route('/<int:id_solicitud>/rechazar', methods=['PATCH'])
@requiere_rol('recepcionista', 'admin')
def rechazar_solicitud(id_solicitud):
    data   = request.get_json(silent=True) or {}
    motivo = (data.get('motivo') or '').strip()

    sol = execute_query(
        "SELECT Estatus FROM SolicitudCompra WHERE Id_Solicitud = ?", (id_solicitud,)
    )
    if not sol:
        return jsonify({'error': 'Solicitud no encontrada.'}), 404
    if sol[0]['Estatus'] != 'Pendiente':
        return jsonify({'error': f"La solicitud ya fue {sol[0]['Estatus'].lower()}."}), 409

    execute_non_query(
        """
        UPDATE SolicitudCompra
        SET Estatus       = 'Rechazada',
            Notas         = ?,
            Fecha_Proceso = GETDATE()
        WHERE Id_Solicitud = ?
        """,
        (motivo or 'Sin motivo especificado', id_solicitud)
    )
    return jsonify({'mensaje': f'Solicitud #{id_solicitud:05d} rechazada.'}), 200

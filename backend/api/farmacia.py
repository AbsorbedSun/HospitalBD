"""
Rutas de Farmacia, Servicios y Ventas de mostrador.
IMPORTANTE: Para vender medicamentos o servicios el cliente
NO necesita ser paciente del hospital.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from db.connection import execute_query, execute_non_query, execute_insert_returning_id, get_db
from core.decorators import requiere_auth, requiere_rol
from core.helpers import rows_to_json

farmacia_bp = Blueprint('farmacia', __name__)


# ================================================================
# MEDICAMENTOS
# ================================================================

# GET /api/farmacia/catalogo   (público — sin autenticación)
# Devuelve medicamentos con stock > 0 y todos los servicios
# para mostrarse en la landing page sin requerir login.
@farmacia_bp.route('/catalogo', methods=['GET'])
def catalogo_publico():
    medicamentos = execute_query(
        """
        SELECT Id_Farmacia, Nombre, Descripcion, Precio, Unidad, Stock
        FROM   Farmacia
        WHERE  Stock > 0
        ORDER  BY Nombre
        """
    )
    servicios = execute_query(
        """
        SELECT Id_Servicio, Nombre, Descripcion, Precio
        FROM   Servicio
        ORDER  BY Nombre
        """
    )
    return jsonify({
        'medicamentos': rows_to_json(medicamentos),
        'servicios':    rows_to_json(servicios)
    }), 200


# GET /api/farmacia/medicamentos
@farmacia_bp.route('/medicamentos', methods=['GET'])
@requiere_auth
def listar_medicamentos():
    nombre = request.args.get('nombre', '')
    filtro, params = '', []
    if nombre:
        filtro = 'WHERE Nombre LIKE ?'
        params.append(f'%{nombre}%')

    rows = execute_query(
        f"""
        SELECT Id_Farmacia, Nombre, Descripcion, Precio, Unidad, Stock
        FROM Farmacia
        {filtro}
        ORDER BY Nombre
        """,
        tuple(params) if params else None
    )
    return jsonify(rows_to_json(rows)), 200


# GET /api/farmacia/medicamentos/<id>
@farmacia_bp.route('/medicamentos/<int:id_farmacia>', methods=['GET'])
@requiere_auth
def obtener_medicamento(id_farmacia):
    rows = execute_query(
        'SELECT * FROM Farmacia WHERE Id_Farmacia = ?', (id_farmacia,)
    )
    if not rows:
        return jsonify({'error': 'Medicamento no encontrado.'}), 404
    return jsonify(rows_to_json(rows[0])), 200


# POST /api/farmacia/medicamentos   (solo recepcionista/admin)
@farmacia_bp.route('/medicamentos', methods=['POST'])
@requiere_rol('recepcionista', 'admin')
def crear_medicamento():
    data = request.get_json(silent=True) or {}
    required = ['nombre', 'precio', 'unidad', 'stock']
    missing  = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({'error': f'Campos faltantes: {", ".join(missing)}'}), 400

    id_nuevo = execute_insert_returning_id(
        """
        INSERT INTO Farmacia (Nombre, Descripcion, Precio, Unidad, Stock)
        OUTPUT INSERTED.Id_Farmacia
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            data['nombre'].strip(),
            data.get('descripcion', ''),
            float(data['precio']),
            data['unidad'].strip(),
            int(data['stock'])
        )
    )
    return jsonify({'id_farmacia': id_nuevo, 'mensaje': 'Medicamento registrado.'}), 201


# PUT /api/farmacia/medicamentos/<id>   (actualizar stock/precio)
@farmacia_bp.route('/medicamentos/<int:id_farmacia>', methods=['PUT'])
@requiere_rol('recepcionista', 'admin')
def actualizar_medicamento(id_farmacia):
    data = request.get_json(silent=True) or {}
    campos, params = [], []

    permitidos = {
        'nombre': 'Nombre', 'descripcion': 'Descripcion',
        'precio': 'Precio', 'unidad': 'Unidad', 'stock': 'Stock'
    }
    for key, col in permitidos.items():
        if key in data:
            campos.append(f'{col} = ?')
            params.append(data[key])

    if not campos:
        return jsonify({'error': 'Sin campos para actualizar.'}), 400

    params.append(id_farmacia)
    execute_non_query(
        f"UPDATE Farmacia SET {', '.join(campos)} WHERE Id_Farmacia = ?",
        tuple(params)
    )
    return jsonify({'mensaje': 'Medicamento actualizado.'}), 200


# DELETE /api/farmacia/medicamentos/<id>   (eliminar medicamento)
@farmacia_bp.route('/medicamentos/<int:id_farmacia>', methods=['DELETE'])
@requiere_rol('recepcionista', 'admin')
def eliminar_medicamento(id_farmacia):
    # Verificar que el medicamento existe
    existe = execute_query(
        'SELECT Id_Farmacia, Nombre FROM Farmacia WHERE Id_Farmacia = ?',
        (id_farmacia,)
    )
    if not existe:
        return jsonify({'error': 'Medicamento no encontrado.'}), 404

    # Verificar que no tiene ventas asociadas (integridad referencial)
    en_uso = execute_query(
        'SELECT TOP 1 Id_Venta FROM Detalle_Venta WHERE Id_Farmacia = ?',
        (id_farmacia,)
    )
    if en_uso:
        return jsonify({
            'error': f'No se puede eliminar "{existe[0]["Nombre"]}" porque tiene ventas registradas. '
                     'Considera dejarlo con stock 0 en lugar de eliminarlo.'
        }), 409

    execute_non_query(
        'DELETE FROM Farmacia WHERE Id_Farmacia = ?', (id_farmacia,)
    )
    return jsonify({'mensaje': 'Medicamento eliminado correctamente.'}), 200


# ================================================================
# SERVICIOS
# ================================================================

# GET /api/farmacia/servicios
@farmacia_bp.route('/servicios', methods=['GET'])
@requiere_auth
def listar_servicios():
    rows = execute_query(
        'SELECT Id_Servicio, Nombre, Precio, Descripcion FROM Servicio ORDER BY Nombre'
    )
    return jsonify(rows_to_json(rows)), 200


# POST /api/farmacia/servicios   (solo recepcionista/admin)
@farmacia_bp.route('/servicios', methods=['POST'])
@requiere_rol('recepcionista', 'admin')
def crear_servicio():
    data = request.get_json(silent=True) or {}
    if not data.get('nombre') or data.get('precio') is None:
        return jsonify({'error': 'nombre y precio son requeridos.'}), 400

    id_nuevo = execute_insert_returning_id(
        """
        INSERT INTO Servicio (Nombre, Precio, Descripcion)
        OUTPUT INSERTED.Id_Servicio
        VALUES (?, ?, ?)
        """,
        (data['nombre'].strip(), float(data['precio']), data.get('descripcion', ''))
    )
    return jsonify({'id_servicio': id_nuevo, 'mensaje': 'Servicio registrado.'}), 201


# PUT /api/farmacia/servicios/<id>
@farmacia_bp.route('/servicios/<int:id_servicio>', methods=['PUT'])
@requiere_rol('recepcionista', 'admin')
def actualizar_servicio(id_servicio):
    data = request.get_json(silent=True) or {}
    campos, params = [], []
    for key, col in [('nombre','Nombre'),('precio','Precio'),('descripcion','Descripcion')]:
        if key in data:
            campos.append(f'{col} = ?')
            params.append(data[key])
    if not campos:
        return jsonify({'error': 'Sin campos para actualizar.'}), 400
    params.append(id_servicio)
    execute_non_query(
        f"UPDATE Servicio SET {', '.join(campos)} WHERE Id_Servicio = ?",
        tuple(params)
    )
    return jsonify({'mensaje': 'Servicio actualizado.'}), 200


# DELETE /api/farmacia/servicios/<id>   (eliminar servicio)
@farmacia_bp.route('/servicios/<int:id_servicio>', methods=['DELETE'])
@requiere_rol('recepcionista', 'admin')
def eliminar_servicio(id_servicio):
    existe = execute_query(
        'SELECT Id_Servicio, Nombre FROM Servicio WHERE Id_Servicio = ?',
        (id_servicio,)
    )
    if not existe:
        return jsonify({'error': 'Servicio no encontrado.'}), 404

    en_uso = execute_query(
        'SELECT TOP 1 Id_Venta FROM Detalle_Venta WHERE Id_Servicio = ?',
        (id_servicio,)
    )
    if en_uso:
        return jsonify({
            'error': f'No se puede eliminar "{existe[0]["Nombre"]}" porque tiene ventas registradas.'
        }), 409

    execute_non_query(
        'DELETE FROM Servicio WHERE Id_Servicio = ?', (id_servicio,)
    )
    return jsonify({'mensaje': 'Servicio eliminado correctamente.'}), 200


# ================================================================
# VENTAS
# ================================================================

# GET /api/farmacia/ventas
@farmacia_bp.route('/ventas', methods=['GET'])
@requiere_rol('recepcionista', 'admin')
def listar_ventas():
    filtros, params = [], []
    if request.args.get('fecha_inicio'):
        filtros.append('v.Fecha >= ?')
        params.append(request.args.get('fecha_inicio'))
    if request.args.get('fecha_fin'):
        filtros.append('v.Fecha <= ?')
        params.append(request.args.get('fecha_fin'))

    where = ('WHERE ' + ' AND '.join(filtros)) if filtros else ''
    rows = execute_query(
        f"""
        SELECT v.Id_Venta, v.Total, v.Fecha, v.Tipo_Venta,
               u.Nombre AS NombreRecep, u.Ap_Paterno AS ApRecep
        FROM Venta v
        JOIN Recepcionista r ON v.Id_Recepcionista = r.Id_Recepcionista
        JOIN Usuario u       ON r.Id_Usuario       = u.Id_Usuario
        {where}
        ORDER BY v.Fecha DESC
        """,
        tuple(params) if params else None
    )
    return jsonify(rows_to_json(rows)), 200


# GET /api/farmacia/ventas/<id>
@farmacia_bp.route('/ventas/<int:id_venta>', methods=['GET'])
@requiere_rol('recepcionista', 'admin')
def detalle_venta(id_venta):
    encabezado = execute_query(
        """
        SELECT v.Id_Venta, v.Total, v.Fecha, v.Tipo_Venta,
               u.Nombre AS NombreRecep
        FROM Venta v
        JOIN Recepcionista r ON v.Id_Recepcionista = r.Id_Recepcionista
        JOIN Usuario u       ON r.Id_Usuario       = u.Id_Usuario
        WHERE v.Id_Venta = ?
        """,
        (id_venta,)
    )
    if not encabezado:
        return jsonify({'error': 'Venta no encontrada.'}), 404

    detalle = execute_query(
        """
        SELECT dv.Id_Detalle, dv.Cantidad, dv.Subtotal,
               s.Nombre AS NombreServicio,
               f.Nombre AS NombreProducto
        FROM Detalle_Venta dv
        LEFT JOIN Servicio s  ON dv.Id_Servicio = s.Id_Servicio
        LEFT JOIN Farmacia f  ON dv.Id_Farmacia = f.Id_Farmacia
        WHERE dv.Id_Venta = ?
        """,
        (id_venta,)
    )
    result = rows_to_json(encabezado[0])
    result['detalle'] = rows_to_json(detalle)
    return jsonify(result), 200


# POST /api/farmacia/ventas   (realizar venta de mostrador)
@farmacia_bp.route('/ventas', methods=['POST'])
@requiere_rol('recepcionista', 'admin')
def realizar_venta():
    """
    Body esperado:
    {
        "items": [
            {"tipo": "farmacia",  "id": 3, "cantidad": 2},
            {"tipo": "servicio",  "id": 1, "cantidad": 1}
        ]
    }
    El cliente NO necesita ser paciente del hospital.
    """
    claims           = get_jwt()
    id_recepcionista = claims.get('id_especifico')
    data             = request.get_json(silent=True) or {}
    items            = data.get('items', [])

    if not items:
        return jsonify({'error': 'Se requiere al menos un artículo en items.'}), 400

    conn = get_db()
    try:
        cursor = conn.cursor()
        total      = 0.0
        tipo_venta = 'Mixta'
        tipos_set  = set()
        detalles   = []

        for item in items:
            tipo     = item.get('tipo')       # 'farmacia' o 'servicio'
            id_item  = item.get('id')
            cantidad = int(item.get('cantidad', 1))

            if tipo == 'farmacia':
                prod = execute_query(
                    'SELECT Precio, Stock FROM Farmacia WHERE Id_Farmacia = ?', (id_item,)
                )
                if not prod:
                    return jsonify({'error': f'Medicamento {id_item} no encontrado.'}), 404
                if prod[0]['Stock'] < cantidad:
                    return jsonify({'error': f'Stock insuficiente para medicamento {id_item}.'}), 422
                subtotal = float(prod[0]['Precio']) * cantidad
                total   += subtotal
                tipos_set.add('Farmacia')
                detalles.append({'tipo': 'farmacia', 'id': id_item,
                                  'cantidad': cantidad, 'subtotal': subtotal})

            elif tipo == 'servicio':
                serv = execute_query(
                    'SELECT Precio FROM Servicio WHERE Id_Servicio = ?', (id_item,)
                )
                if not serv:
                    return jsonify({'error': f'Servicio {id_item} no encontrado.'}), 404
                subtotal = float(serv[0]['Precio']) * cantidad
                total   += subtotal
                tipos_set.add('Servicio')
                detalles.append({'tipo': 'servicio', 'id': id_item,
                                  'cantidad': cantidad, 'subtotal': subtotal})
            else:
                return jsonify({'error': f'Tipo de artículo inválido: {tipo}'}), 400

        # Determinar tipo de venta
        if len(tipos_set) == 1:
            tipo_venta = tipos_set.pop()

        # Insertar Venta
        cursor.execute(
            """
            INSERT INTO Venta (Id_Recepcionista, Total, Tipo_Venta)
            VALUES (?, ?, ?);
            SELECT SCOPE_IDENTITY();
            """,
            (id_recepcionista, round(total, 2), tipo_venta)
        )
        id_venta = int(cursor.fetchone()[0])

        # Insertar Detalles y actualizar stock
        for d in detalles:
            id_serv = d['id'] if d['tipo'] == 'servicio' else None
            id_farm = d['id'] if d['tipo'] == 'farmacia' else None

            cursor.execute(
                """
                INSERT INTO Detalle_Venta (Id_Venta, Id_Servicio, Id_Farmacia, Cantidad, Subtotal)
                VALUES (?, ?, ?, ?, ?)
                """,
                (id_venta, id_serv, id_farm, d['cantidad'], d['subtotal'])
            )

            if d['tipo'] == 'farmacia':
                cursor.execute(
                    'UPDATE Farmacia SET Stock = Stock - ? WHERE Id_Farmacia = ?',
                    (d['cantidad'], d['id'])
                )

        conn.commit()
        return jsonify({
            'id_venta':  id_venta,
            'total':     round(total, 2),
            'tipo_venta': tipo_venta,
            'mensaje':   'Venta registrada correctamente.'
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ================================================================
# SOLICITUDES DE COMPRA  (paciente ↔ recepcionista)
# ================================================================

# POST /api/farmacia/solicitudes   (paciente crea solicitud)
@farmacia_bp.route('/solicitudes', methods=['POST'])
@requiere_auth
def crear_solicitud_compra():
    claims     = get_jwt()
    id_usuario = claims.get('id_usuario')
    data       = request.get_json(silent=True) or {}
    items      = data.get('items', [])

    if not items:
        return jsonify({'error': 'El carrito está vacío.'}), 400

    # Obtener Id_Paciente desde el usuario autenticado
    rows = execute_query(
        'SELECT Id_Paciente FROM Paciente WHERE Id_Usuario = ?', (id_usuario,)
    )
    if not rows:
        return jsonify({'error': 'Usuario no registrado como paciente.'}), 403
    id_paciente = rows[0]['Id_Paciente']

    # Validar items y calcular total verificando precios reales en BD
    total = 0.0
    items_validados = []
    for item in items:
        tipo     = item.get('tipo')       # 'farmacia' o 'servicio'
        id_item  = item.get('id')
        cantidad = int(item.get('cantidad', 1))

        if tipo == 'farmacia':
            prod = execute_query(
                'SELECT Nombre, Precio, Stock FROM Farmacia WHERE Id_Farmacia = ?',
                (id_item,)
            )
            if not prod:
                return jsonify({'error': f'Medicamento id={id_item} no encontrado.'}), 400
            if prod[0]['Stock'] < cantidad:
                return jsonify({
                    'error': f'Stock insuficiente para "{prod[0]["Nombre"]}". '
                             f'Disponible: {prod[0]["Stock"]}.'
                }), 409
            subtotal = float(prod[0]['Precio']) * cantidad
        elif tipo == 'servicio':
            serv = execute_query(
                'SELECT Nombre, Precio FROM Servicio WHERE Id_Servicio = ?', (id_item,)
            )
            if not serv:
                return jsonify({'error': f'Servicio id={id_item} no encontrado.'}), 400
            subtotal = float(serv[0]['Precio']) * cantidad
        else:
            return jsonify({'error': f'Tipo de ítem inválido: {tipo}.'}), 400

        total += subtotal
        items_validados.append({
            'tipo': tipo, 'id': id_item, 'cantidad': cantidad, 'subtotal': round(subtotal, 2)
        })

    # Insertar SolicitudCompra y su detalle en una transacción
    conn = None
    try:
        from db.connection import get_db
        conn   = get_db()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO SolicitudCompra (Id_Paciente, Total, Notas)
            OUTPUT INSERTED.Id_Solicitud
            VALUES (?, ?, ?)
            """,
            (id_paciente, round(total, 2), data.get('notas', ''))
        )
        id_solicitud = int(cursor.fetchone()[0])

        for item in items_validados:
            id_serv = item['id'] if item['tipo'] == 'servicio' else None
            id_farm = item['id'] if item['tipo'] == 'farmacia'  else None
            cursor.execute(
                """
                INSERT INTO Detalle_SolicitudCompra
                       (Id_Solicitud, Id_Servicio, Id_Farmacia, Cantidad, Subtotal)
                VALUES (?, ?, ?, ?, ?)
                """,
                (id_solicitud, id_serv, id_farm, item['cantidad'], item['subtotal'])
            )

        conn.commit()
        return jsonify({
            'id_solicitud': id_solicitud,
            'total':        round(total, 2),
            'mensaje':      'Solicitud enviada. La recepcionista la procesará en breve.'
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()


# GET /api/farmacia/solicitudes   (paciente consulta sus propias solicitudes)
@farmacia_bp.route('/solicitudes', methods=['GET'])
@requiere_auth
def mis_solicitudes_compra():
    claims     = get_jwt()
    id_usuario = claims.get('id_usuario')

    rows = execute_query(
        """
        SELECT sc.Id_Solicitud, sc.Estatus, sc.Fecha_Solicitud,
               sc.Fecha_Proceso, sc.Total, sc.Notas,
               u.Nombre   AS NombreRecep,
               u.Ap_Paterno AS ApRecep
        FROM   SolicitudCompra sc
        LEFT JOIN Recepcionista r ON sc.Id_Recepcionista = r.Id_Recepcionista
        LEFT JOIN Usuario       u ON r.Id_Usuario        = u.Id_Usuario
        JOIN  Paciente          p ON sc.Id_Paciente      = p.Id_Paciente
        WHERE  p.Id_Usuario = ?
        ORDER  BY sc.Fecha_Solicitud DESC
        """,
        (id_usuario,)
    )
    return jsonify(rows_to_json(rows)), 200


# GET /api/farmacia/solicitudes/<id>/detalle   (detalle de una solicitud)
@farmacia_bp.route('/solicitudes/<int:id_solicitud>/detalle', methods=['GET'])
@requiere_auth
def detalle_solicitud(id_solicitud):
    claims     = get_jwt()
    id_usuario = claims.get('id_usuario')
    rol        = claims.get('rol', '')

    # Paciente solo ve sus propias; recepcionista ve todas
    if rol == 'paciente':
        owner = execute_query(
            """
            SELECT 1 FROM SolicitudCompra sc
            JOIN Paciente p ON sc.Id_Paciente = p.Id_Paciente
            WHERE sc.Id_Solicitud = ? AND p.Id_Usuario = ?
            """,
            (id_solicitud, id_usuario)
        )
        if not owner:
            return jsonify({'error': 'Solicitud no encontrada.'}), 404

    rows = execute_query(
        """
        SELECT dsc.Id_Detalle, dsc.Cantidad, dsc.Subtotal,
               f.Nombre  AS NombreFarmacia, f.Unidad,
               s.Nombre  AS NombreServicio
        FROM   Detalle_SolicitudCompra dsc
        LEFT JOIN Farmacia f ON dsc.Id_Farmacia = f.Id_Farmacia
        LEFT JOIN Servicio s ON dsc.Id_Servicio = s.Id_Servicio
        WHERE  dsc.Id_Solicitud = ?
        """,
        (id_solicitud,)
    )
    return jsonify(rows_to_json(rows)), 200

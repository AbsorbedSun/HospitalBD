"""
Rutas de Medicamentos, Servicios y Ventas de mostrador.
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

medicamentos_bp = Blueprint('medicamentos', __name__)


# ================================================================
# MEDICAMENTOS
# ================================================================

# GET /api/medicamentos/catalogo   (público — sin autenticación)
# Devuelve medicamentos con stock > 0 y todos los servicios
# para mostrarse en la landing page sin requerir login.
@medicamentos_bp.route('/catalogo', methods=['GET'])
def catalogo_publico():
    # VW_InventarioMedicamentos añade AlertaStock y el flag Disponible (Stock > 0)
    # Solo mostramos los disponibles en el catálogo público
    medicamentos = execute_query(
        """
        SELECT Id_Medicamento, Nombre, Descripcion, Precio, Unidad,
               Stock, AlertaStock
        FROM   VW_InventarioMedicamentos
        WHERE  Disponible = 1
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


# GET /api/medicamentos/medicamentos
@medicamentos_bp.route('/medicamentos', methods=['GET'])
@requiere_auth
def listar_medicamentos():
    nombre = request.args.get('nombre', '')
    filtro, params = '', []
    if nombre:
        filtro = 'WHERE Nombre LIKE ?'
        params.append(f'%{nombre}%')

    # VW_InventarioMedicamentos incluye AlertaStock calculado y flag Disponible
    # El filtro de nombre se aplica sobre la vista igual que sobre la tabla
    if nombre:
        filtro = 'WHERE Nombre LIKE ?'
    rows = execute_query(
        f"""
        SELECT Id_Medicamento, Nombre, Descripcion, Precio, Unidad,
               Stock, AlertaStock, Disponible
        FROM VW_InventarioMedicamentos
        {filtro}
        ORDER BY Nombre
        """,
        tuple(params) if params else None
    )
    return jsonify(rows_to_json(rows)), 200


# GET /api/medicamentos/medicamentos/<id>
@medicamentos_bp.route('/medicamentos/<int:id_medicamento>', methods=['GET'])
@requiere_auth
def obtener_medicamento(id_medicamento):
    rows = execute_query(
        'SELECT * FROM Medicamentos WHERE Id_Medicamento = ?', (id_medicamento,)
    )
    if not rows:
        return jsonify({'error': 'Medicamento no encontrado.'}), 404
    return jsonify(rows_to_json(rows[0])), 200


# POST /api/medicamentos/medicamentos   (solo recepcionista/admin)
@medicamentos_bp.route('/medicamentos', methods=['POST'])
@requiere_rol('recepcionista', 'admin')
def crear_medicamento():
    data = request.get_json(silent=True) or {}
    required = ['nombre', 'precio', 'unidad', 'stock']
    missing  = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({'error': f'Campos faltantes: {", ".join(missing)}'}), 400

    id_nuevo = execute_insert_returning_id(
        """
        INSERT INTO Medicamentos (Nombre, Descripcion, Precio, Unidad, Stock)
        OUTPUT INSERTED.Id_Medicamento
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
    return jsonify({'id_medicamento': id_nuevo, 'mensaje': 'Medicamento registrado.'}), 201


# PUT /api/medicamentos/medicamentos/<id>   (actualizar stock/precio)
@medicamentos_bp.route('/medicamentos/<int:id_medicamento>', methods=['PUT'])
@requiere_rol('recepcionista', 'admin')
def actualizar_medicamento(id_medicamento):
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

    params.append(id_medicamento)
    execute_non_query(
        f"UPDATE Medicamentos SET {', '.join(campos)} WHERE Id_Medicamento = ?",
        tuple(params)
    )
    return jsonify({'mensaje': 'Medicamento actualizado.'}), 200


# DELETE /api/medicamentos/medicamentos/<id>   (eliminar medicamento)
@medicamentos_bp.route('/medicamentos/<int:id_medicamento>', methods=['DELETE'])
@requiere_rol('recepcionista', 'admin')
def eliminar_medicamento(id_medicamento):
    # Verificar que el medicamento existe
    existe = execute_query(
        'SELECT Id_Medicamento, Nombre FROM Medicamentos WHERE Id_Medicamento = ?',
        (id_medicamento,)
    )
    if not existe:
        return jsonify({'error': 'Medicamento no encontrado.'}), 404

    # Verificar que no tiene ventas asociadas (integridad referencial)
    en_uso = execute_query(
        'SELECT TOP 1 Id_Venta FROM Detalle_Venta WHERE Id_Medicamento = ?',
        (id_medicamento,)
    )
    if en_uso:
        return jsonify({
            'error': f'No se puede eliminar "{existe[0]["Nombre"]}" porque tiene ventas registradas. '
                     'Considera dejarlo con stock 0 en lugar de eliminarlo.'
        }), 409

    execute_non_query(
        'DELETE FROM Medicamentos WHERE Id_Medicamento = ?', (id_medicamento,)
    )
    return jsonify({'mensaje': 'Medicamento eliminado correctamente.'}), 200


# ================================================================
# SERVICIOS
# ================================================================

# GET /api/medicamentos/servicios
@medicamentos_bp.route('/servicios', methods=['GET'])
@requiere_auth
def listar_servicios():
    rows = execute_query(
        'SELECT Id_Servicio, Nombre, Precio, Descripcion FROM Servicio ORDER BY Nombre'
    )
    return jsonify(rows_to_json(rows)), 200


# POST /api/medicamentos/servicios   (solo recepcionista/admin)
@medicamentos_bp.route('/servicios', methods=['POST'])
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


# PUT /api/medicamentos/servicios/<id>
@medicamentos_bp.route('/servicios/<int:id_servicio>', methods=['PUT'])
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


# DELETE /api/medicamentos/servicios/<id>   (eliminar servicio)
@medicamentos_bp.route('/servicios/<int:id_servicio>', methods=['DELETE'])
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

# GET /api/medicamentos/ventas
@medicamentos_bp.route('/ventas', methods=['GET'])
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


# GET /api/medicamentos/ventas/<id>
@medicamentos_bp.route('/ventas/<int:id_venta>', methods=['GET'])
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
        LEFT JOIN Medicamentos f  ON dv.Id_Medicamento = f.Id_Medicamento
        WHERE dv.Id_Venta = ?
        """,
        (id_venta,)
    )
    result = rows_to_json(encabezado[0])
    result['detalle'] = rows_to_json(detalle)
    return jsonify(result), 200


# POST /api/medicamentos/ventas   (realizar venta de mostrador)
@medicamentos_bp.route('/ventas', methods=['POST'])
@requiere_rol('recepcionista', 'admin')
def realizar_venta():
    """
    Body esperado:
    {
        "items": [
            {"tipo": "medicamento",  "id": 3, "cantidad": 2},
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
            tipo     = item.get('tipo')       # 'medicamento' o 'servicio'
            id_item  = item.get('id')
            cantidad = int(item.get('cantidad', 1))

            if tipo == 'medicamento':
                prod = execute_query(
                    'SELECT Precio, Stock FROM Medicamentos WHERE Id_Medicamento = ?', (id_item,)
                )
                if not prod:
                    return jsonify({'error': f'Medicamento {id_item} no encontrado.'}), 404
                if prod[0]['Stock'] < cantidad:
                    return jsonify({'error': f'Stock insuficiente para medicamento {id_item}.'}), 422
                subtotal = float(prod[0]['Precio']) * cantidad
                total   += subtotal
                tipos_set.add('Medicamento')
                detalles.append({'tipo': 'medicamento', 'id': id_item,
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

        # Insertar Venta — SET NOCOUNT ON + bucle nextset() para evitar
        # "No results. Previous SQL was not a query." cuando hay
        # múltiples statements en el mismo batch.
        cursor.execute(
            """
            SET NOCOUNT ON;
            INSERT INTO Venta (Id_Recepcionista, Total, Tipo_Venta)
            VALUES (?, ?, ?);
            SELECT SCOPE_IDENTITY();
            """,
            (id_recepcionista, round(total, 2), tipo_venta)
        )
        row = cursor.fetchone()
        while row is None and cursor.nextset():
            row = cursor.fetchone()
        id_venta = int(row[0])

        # Insertar Detalles — el trigger TR_DetalleVenta_DescontarStock
        # se encarga de descontar el Stock automáticamente. Ya NO se
        # hace UPDATE Medicamentos manual aquí (evita doble descuento).
        for d in detalles:
            id_serv = d['id'] if d['tipo'] == 'servicio' else None
            id_med = d['id'] if d['tipo'] == 'medicamento' else None

            cursor.execute(
                """
                INSERT INTO Detalle_Venta (Id_Venta, Id_Servicio, Id_Medicamento, Cantidad, Subtotal)
                VALUES (?, ?, ?, ?, ?)
                """,
                (id_venta, id_serv, id_med, d["cantidad"], d["subtotal"])
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

# POST /api/medicamentos/solicitudes   (paciente crea solicitud)
@medicamentos_bp.route('/solicitudes', methods=['POST'])
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
        tipo     = item.get('tipo')       # 'medicamento' o 'servicio'
        id_item  = item.get('id')
        cantidad = int(item.get('cantidad', 1))

        if tipo == 'medicamento':
            prod = execute_query(
                'SELECT Nombre, Precio, Stock FROM Medicamentos WHERE Id_Medicamento = ?',
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
            SET NOCOUNT ON;
            DECLARE @OutSolicitud TABLE (Id_Solicitud INT);

            INSERT INTO SolicitudCompra (Id_Paciente, Total, Notas)
            OUTPUT INSERTED.Id_Solicitud INTO @OutSolicitud
            VALUES (?, ?, ?);

            SELECT Id_Solicitud FROM @OutSolicitud;
            """,
            (id_paciente, round(total, 2), data.get('notas', ''))
        )
        row = cursor.fetchone()
        while row is None and cursor.nextset():
            row = cursor.fetchone()
        id_solicitud = int(row[0])

        for item in items_validados:
            id_serv = item['id'] if item['tipo'] == 'servicio' else None
            id_med = item['id'] if item['tipo'] == 'medicamento'  else None
            cursor.execute(
                """
                INSERT INTO Detalle_SolicitudCompra
                       (Id_Solicitud, Id_Servicio, Id_Medicamento, Cantidad, Subtotal)
                VALUES (?, ?, ?, ?, ?)
                """,
                (id_solicitud, id_serv, id_med, item["cantidad"], item["subtotal"])
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


# GET /api/medicamentos/solicitudes   (paciente consulta sus propias solicitudes)
@medicamentos_bp.route('/solicitudes', methods=['GET'])
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


# GET /api/medicamentos/solicitudes/<id>/detalle   (detalle de una solicitud)
@medicamentos_bp.route('/solicitudes/<int:id_solicitud>/detalle', methods=['GET'])
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
               f.Nombre  AS NombreMedicamento, f.Unidad,
               s.Nombre  AS NombreServicio
        FROM   Detalle_SolicitudCompra dsc
        LEFT JOIN Medicamentos f ON dsc.Id_Medicamento = f.Id_Medicamento
        LEFT JOIN Servicio s ON dsc.Id_Servicio = s.Id_Servicio
        WHERE  dsc.Id_Solicitud = ?
        """,
        (id_solicitud,)
    )
    return jsonify(rows_to_json(rows)), 200

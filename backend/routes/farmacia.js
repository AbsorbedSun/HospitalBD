const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getConnection, sql } = require('../config/database');
const { authMiddleware, checkUserType } = require('../middleware/auth');

// GET /api/farmacia/medicamentos - Listar medicamentos
router.get('/medicamentos', authMiddleware, async (req, res) => {
    try {
        const pool = await getConnection();
        const { buscar, bajo_stock } = req.query;

        let query = `
            SELECT 
                id_medicamento,
                nombre,
                descripcion,
                precio_unitario,
                stock,
                stock_minimo,
                fecha_vencimiento,
                activo,
                CASE 
                    WHEN stock <= stock_minimo THEN 1
                    ELSE 0
                END as requiere_reorden
            FROM Medicamento
            WHERE activo = 1
        `;

        const request = pool.request();

        if (buscar) {
            query += ' AND (nombre LIKE @buscar OR descripcion LIKE @buscar)';
            request.input('buscar', sql.VarChar, `%${buscar}%`);
        }

        if (bajo_stock === 'true') {
            query += ' AND stock <= stock_minimo';
        }

        query += ' ORDER BY nombre';

        const result = await request.query(query);

        res.json({
            success: true,
            count: result.recordset.length,
            medicamentos: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener medicamentos:', error);
        res.status(500).json({
            error: 'Error al obtener medicamentos',
            details: error.message
        });
    }
});

// GET /api/farmacia/servicios - Listar servicios
router.get('/servicios', authMiddleware, async (req, res) => {
    try {
        const pool = await getConnection();

        const result = await pool.request().query(`
            SELECT 
                id_servicio,
                nombre,
                descripcion,
                precio,
                activo
            FROM Servicio
            WHERE activo = 1
            ORDER BY nombre
        `);

        res.json({
            success: true,
            count: result.recordset.length,
            servicios: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener servicios:', error);
        res.status(500).json({
            error: 'Error al obtener servicios',
            details: error.message
        });
    }
});

// POST /api/farmacia/ventas - Realizar venta
router.post('/ventas',
    authMiddleware,
    checkUserType('recepcionista'),
    [
        body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un item'),
        body('metodo_pago').isIn(['efectivo', 'tarjeta', 'transferencia']).withMessage('Método de pago inválido')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { items, metodo_pago, nombre_cliente } = req.body;
            const { id_recepcionista } = req.user;

            const pool = await getConnection();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                // Calcular total
                let total = 0;
                for (const item of items) {
                    if (item.tipo_producto === 'medicamento') {
                        const medResult = await transaction.request()
                            .input('id', sql.Int, item.id_medicamento)
                            .query('SELECT precio_unitario, stock FROM Medicamento WHERE id_medicamento = @id');
                        
                        if (medResult.recordset.length === 0) {
                            throw new Error(`Medicamento ${item.id_medicamento} no encontrado`);
                        }

                        const med = medResult.recordset[0];
                        if (med.stock < item.cantidad) {
                            throw new Error(`Stock insuficiente para ${item.id_medicamento}`);
                        }

                        total += med.precio_unitario * item.cantidad;
                    } else if (item.tipo_producto === 'servicio') {
                        const servResult = await transaction.request()
                            .input('id', sql.Int, item.id_servicio)
                            .query('SELECT precio FROM Servicio WHERE id_servicio = @id');
                        
                        if (servResult.recordset.length === 0) {
                            throw new Error(`Servicio ${item.id_servicio} no encontrado`);
                        }

                        total += servResult.recordset[0].precio * item.cantidad;
                    }
                }

                // Generar folio
                const folio = 'VEN-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + 
                              '-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

                // Crear venta
                const ventaResult = await transaction.request()
                    .input('folio_venta', sql.VarChar, folio)
                    .input('total', sql.Decimal(10, 2), total)
                    .input('metodo_pago', sql.VarChar, metodo_pago)
                    .input('id_recepcionista', sql.Int, id_recepcionista)
                    .input('nombre_cliente', sql.VarChar, nombre_cliente || 'Cliente General')
                    .query(`
                        INSERT INTO Venta (folio_venta, total, metodo_pago, id_recepcionista, nombre_cliente)
                        OUTPUT INSERTED.id_venta
                        VALUES (@folio_venta, @total, @metodo_pago, @id_recepcionista, @nombre_cliente)
                    `);

                const id_venta = ventaResult.recordset[0].id_venta;

                // Insertar detalles y actualizar stock
                for (const item of items) {
                    let precio_unitario, subtotal;

                    if (item.tipo_producto === 'medicamento') {
                        const medResult = await transaction.request()
                            .input('id', sql.Int, item.id_medicamento)
                            .query('SELECT precio_unitario FROM Medicamento WHERE id_medicamento = @id');
                        
                        precio_unitario = medResult.recordset[0].precio_unitario;
                        subtotal = precio_unitario * item.cantidad;

                        await transaction.request()
                            .input('id_venta', sql.Int, id_venta)
                            .input('tipo_producto', sql.VarChar, 'medicamento')
                            .input('id_medicamento', sql.Int, item.id_medicamento)
                            .input('cantidad', sql.Int, item.cantidad)
                            .input('precio_unitario', sql.Decimal(10, 2), precio_unitario)
                            .input('subtotal', sql.Decimal(10, 2), subtotal)
                            .query(`
                                INSERT INTO DetalleVenta (id_venta, tipo_producto, id_medicamento, cantidad, precio_unitario, subtotal)
                                VALUES (@id_venta, @tipo_producto, @id_medicamento, @cantidad, @precio_unitario, @subtotal)
                            `);

                        // Actualizar stock
                        await transaction.request()
                            .input('id_medicamento', sql.Int, item.id_medicamento)
                            .input('cantidad', sql.Int, item.cantidad)
                            .query('UPDATE Medicamento SET stock = stock - @cantidad WHERE id_medicamento = @id_medicamento');

                    } else if (item.tipo_producto === 'servicio') {
                        const servResult = await transaction.request()
                            .input('id', sql.Int, item.id_servicio)
                            .query('SELECT precio FROM Servicio WHERE id_servicio = @id');
                        
                        precio_unitario = servResult.recordset[0].precio;
                        subtotal = precio_unitario * item.cantidad;

                        await transaction.request()
                            .input('id_venta', sql.Int, id_venta)
                            .input('tipo_producto', sql.VarChar, 'servicio')
                            .input('id_servicio', sql.Int, item.id_servicio)
                            .input('cantidad', sql.Int, item.cantidad)
                            .input('precio_unitario', sql.Decimal(10, 2), precio_unitario)
                            .input('subtotal', sql.Decimal(10, 2), subtotal)
                            .query(`
                                INSERT INTO DetalleVenta (id_venta, tipo_producto, id_servicio, cantidad, precio_unitario, subtotal)
                                VALUES (@id_venta, @tipo_producto, @id_servicio, @cantidad, @precio_unitario, @subtotal)
                            `);
                    }
                }

                await transaction.commit();

                res.status(201).json({
                    success: true,
                    message: 'Venta realizada exitosamente',
                    folio_venta: folio,
                    total: total
                });

            } catch (error) {
                await transaction.rollback();
                throw error;
            }

        } catch (error) {
            console.error('Error al realizar venta:', error);
            res.status(500).json({
                error: 'Error al realizar venta',
                details: error.message
            });
        }
    }
);

// GET /api/farmacia/ventas - Obtener historial de ventas
router.get('/ventas', authMiddleware, checkUserType('recepcionista'), async (req, res) => {
    try {
        const pool = await getConnection();
        const { fecha_inicio, fecha_fin, limit } = req.query;

        let query = `
            SELECT TOP ${limit || 50}
                v.id_venta,
                v.folio_venta,
                v.fecha_venta,
                v.total,
                v.metodo_pago,
                v.nombre_cliente,
                e.nombre + ' ' + e.apellido_paterno as vendedor
            FROM Venta v
            LEFT JOIN Recepcionista r ON v.id_recepcionista = r.id_recepcionista
            LEFT JOIN Empleado e ON r.id_empleado = e.id_empleado
            WHERE 1=1
        `;

        const request = pool.request();

        if (fecha_inicio) {
            query += ' AND v.fecha_venta >= @fecha_inicio';
            request.input('fecha_inicio', sql.DateTime, fecha_inicio);
        }

        if (fecha_fin) {
            query += ' AND v.fecha_venta <= @fecha_fin';
            request.input('fecha_fin', sql.DateTime, fecha_fin);
        }

        query += ' ORDER BY v.fecha_venta DESC';

        const result = await request.query(query);

        res.json({
            success: true,
            count: result.recordset.length,
            ventas: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener ventas:', error);
        res.status(500).json({
            error: 'Error al obtener historial de ventas',
            details: error.message
        });
    }
});

// GET /api/farmacia/ventas/:id - Obtener detalle de venta
router.get('/ventas/:id', authMiddleware, checkUserType('recepcionista'), async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const venta = await pool.request()
            .input('id_venta', sql.Int, id)
            .query(`
                SELECT 
                    v.id_venta,
                    v.folio_venta,
                    v.fecha_venta,
                    v.total,
                    v.metodo_pago,
                    v.nombre_cliente
                FROM Venta v
                WHERE v.id_venta = @id_venta
            `);

        if (venta.recordset.length === 0) {
            return res.status(404).json({
                error: 'Venta no encontrada'
            });
        }

        const detalles = await pool.request()
            .input('id_venta', sql.Int, id)
            .query(`
                SELECT 
                    dv.tipo_producto,
                    CASE 
                        WHEN dv.tipo_producto = 'medicamento' THEN m.nombre
                        WHEN dv.tipo_producto = 'servicio' THEN s.nombre
                    END as nombre_producto,
                    dv.cantidad,
                    dv.precio_unitario,
                    dv.subtotal
                FROM DetalleVenta dv
                LEFT JOIN Medicamento m ON dv.id_medicamento = m.id_medicamento
                LEFT JOIN Servicio s ON dv.id_servicio = s.id_servicio
                WHERE dv.id_venta = @id_venta
            `);

        res.json({
            success: true,
            venta: venta.recordset[0],
            detalles: detalles.recordset
        });

    } catch (error) {
        console.error('Error al obtener detalle de venta:', error);
        res.status(500).json({
            error: 'Error al obtener detalle de venta',
            details: error.message
        });
    }
});

module.exports = router;

/**
 * Cliente API para Sistema de Gestión Hospitalaria
 *
 * El frontend es servido por Flask en el mismo origen que la API,
 * por lo que se usan rutas relativas (/api) sin necesidad de
 * especificar host ni puerto.
 *
 * Arrancar el sistema completo desde la raíz del proyecto:
 *   python run.py
 */

const CONFIG = {
    API_URL: '/api',   // Ruta relativa — funciona en cualquier puerto
    TIMEOUT: 15000
};

/**
 * Función base para todas las peticiones al backend Flask.
 * - Adjunta el JWT automáticamente si existe.
 * - Lanza errores con mensajes descriptivos (incluyendo errores de red).
 */
async function apiRequest(endpoint, options = {}) {
    const token = sessionStorage.getItem('authToken');

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    // Timeout real usando AbortController
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    const fetchOptions = {
        ...options,
        signal: controller.signal,
        headers: { ...headers, ...(options.headers || {}) }
    };

    let response;
    try {
        response = await fetch(`${CONFIG.API_URL}${endpoint}`, fetchOptions);
        clearTimeout(timeoutId);
    } catch (networkError) {
        clearTimeout(timeoutId);
        // Error de red: servidor caído, CORS bloqueado, sin conexión, o timeout
        console.error('[API] Error de red:', networkError);
        if (networkError.name === 'AbortError') {
            throw new Error(
                `La solicitud tardó más de ${CONFIG.TIMEOUT / 1000}s. ` +
                'Verifica que el servidor esté corriendo (python run.py).'
            );
        }
        throw new Error(
            'No se pudo conectar con el servidor. ' +
            'Verifica que esté corriendo (ejecuta: python run.py desde la raíz del proyecto).'
        );
    }

    // Intentar parsear JSON siempre
    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error(`El servidor respondió con un formato inesperado (HTTP ${response.status})`);
    }

    if (!response.ok) {
        // Si el token expiró, limpiar sesión y redirigir
        if (response.status === 401 && endpoint !== '/auth/login') {
            auth.logout();
        }
        throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
    }

    return data;
}

// ============================================================
// AUTENTICACIÓN
// ============================================================
const auth = {
    login: async (email, password) => {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        sessionStorage.setItem('authToken',    data.token);
        sessionStorage.setItem('currentUser',  JSON.stringify(data.user));
        sessionStorage.setItem('isLoggedIn',   'true');
        return data;
    },

    register: async (userData) => {
        const data = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        sessionStorage.setItem('authToken',   data.token);
        sessionStorage.setItem('currentUser', JSON.stringify(data.user));
        sessionStorage.setItem('isLoggedIn',  'true');
        return data;
    },

    verify: async () => apiRequest('/auth/verify'),

    logout: () => {
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('isLoggedIn');
        window.location.href = '/pages/auth/login.html';
    },

    isAuthenticated: () => !!sessionStorage.getItem('authToken'),

    getCurrentUser: () => {
        const u = sessionStorage.getItem('currentUser');
        return u ? JSON.parse(u) : null;
    }
};

// ============================================================
// ESPECIALIDADES
// ============================================================
const especialidades = {
    obtenerTodas:    ()     => apiRequest('/especialidades'),
    obtenerPorId:    (id)   => apiRequest(`/especialidades/${id}`),
    obtenerDoctores: (id)   => apiRequest(`/especialidades/${id}/doctores`),
    crear:   (d)            => apiRequest('/especialidades', { method:'POST', body:JSON.stringify(d) }),
    actualizar: (id, d)     => apiRequest(`/especialidades/${id}`, { method:'PUT', body:JSON.stringify(d) })
};

// ============================================================
// CITAS
// ============================================================
const citas = {
    obtenerMisCitas: (filtros = {}) => {
        const p = new URLSearchParams(filtros).toString();
        return apiRequest(`/citas${p ? '?' + p : ''}`);
    },
    agendarCita:    (d)         => apiRequest('/citas/agendar', { method:'POST', body:JSON.stringify(d) }),
    cancelarCita:   (folio, motivo) => apiRequest(`/citas/cancelar/${folio}`, {
        method: 'POST', body: JSON.stringify({ motivo_cancelacion: motivo })
    }),
    confirmarPago:  (folio, metodo) => apiRequest('/citas/pagar', {
        method: 'POST', body: JSON.stringify({ folio_cita: folio, metodo_pago: metodo })
    }),
    consultarPoliticaCancelacion: (folio) => apiRequest(`/citas/${folio}/politica-cancelacion`),
    detallePago:    (folio) => apiRequest(`/citas/${folio}/detalle-pago`),
    marcarAtendida:  (folio)    => apiRequest(`/citas/${folio}/atender`,   { method:'PUT' }),
    marcarNoAcudio:  (folio)    => apiRequest(`/citas/${folio}/no-acudio`, { method:'PUT' }),
    obtenerHorariosDisponibles: (idDoc, fi, ff) =>
        apiRequest(`/doctores/${idDoc}/horarios-disponibles?fecha_inicio=${fi}&fecha_fin=${ff}`),
    verificarVencidas: () => apiRequest('/citas/verificar-vencidas', { method:'POST' })
};

// ============================================================
// PACIENTE
// ============================================================
const paciente = {
    obtenerPerfil:        ()        => apiRequest('/pacientes/perfil'),
    actualizarPerfil:     (d)       => apiRequest('/pacientes/perfil', { method:'PUT', body:JSON.stringify(d) }),
    obtenerHistorialMedico: ()      => apiRequest('/pacientes/historial-medico'),
    obtenerMisRecetas:    ()        => apiRequest('/pacientes/mis-recetas'),
    listarTodos: (filtros = {}) => {
        const p = new URLSearchParams(filtros).toString();
        return apiRequest(`/pacientes${p ? '?' + p : ''}`);
    },
    obtenerPorId:         (id)      => apiRequest(`/pacientes/${id}`),
    obtenerHistorial:     (id)      => apiRequest(`/pacientes/${id}/historial`),
    actualizarHistorial:  (id, d)   => apiRequest(`/pacientes/${id}/historial`, {
        method:'PUT', body:JSON.stringify(d)
    })
};

// ============================================================
// DOCTOR
// ============================================================
const doctor = {
    obtenerPerfil:        ()    => apiRequest('/doctores/perfil'),
    listarTodos: (filtros = {}) => {
        const p = new URLSearchParams(filtros).toString();
        return apiRequest(`/doctores${p ? '?' + p : ''}`);
    },
    obtenerPorId:         (id)  => apiRequest(`/doctores/${id}`),
    obtenerPacientes:     ()    => apiRequest('/doctores/pacientes'),
    crearReceta:          (d)   => apiRequest('/doctores/recetas', { method:'POST', body:JSON.stringify(d) }),
    listarRecetas:        ()    => apiRequest('/doctores/recetas'),
    obtenerReceta:        (id)  => apiRequest(`/doctores/recetas/${id}`),
    solicitarCancelacion: (folio, motivo) => apiRequest('/doctores/solicitar-cancelacion', {
        method:'POST', body:JSON.stringify({ folio_cita: folio, motivo })
    }),
    crear:    (d)  => apiRequest('/doctores', { method:'POST', body:JSON.stringify(d) }),
    darBaja:  (id) => apiRequest(`/doctores/${id}/dar-baja`, { method:'PATCH' })
};

// ============================================================
// RECEPCIONISTA
// ============================================================
const recepcionista = {
    obtenerPerfil:        ()          => apiRequest('/recepcionistas/perfil'),
    actualizarPerfil:     (d)         => apiRequest('/recepcionistas/perfil', { method:'PUT', body:JSON.stringify(d) }),
    obtenerDashboard:     ()          => apiRequest('/recepcionistas/dashboard'),
    // Solicitudes de compra
    listarSolicitudesCompra: (est='Pendiente') => apiRequest(`/recepcionistas/solicitudes-compra?estatus=${est}`),
    procesarSolicitudCompra: (id)     => apiRequest(`/recepcionistas/solicitudes-compra/${id}/procesar`, { method:'POST' }),
    rechazarSolicitudCompra: (id, motivo) => apiRequest(`/recepcionistas/solicitudes-compra/${id}/rechazar`, { method:'POST', body:JSON.stringify({ motivo }) }),
    obtenerBitacoraEstatus: (f = {})  => {
        const p = new URLSearchParams(f).toString();
        return apiRequest(`/recepcionistas/bitacora/estatus${p ? '?' + p : ''}`);
    },
    obtenerBitacoraHistorial: (f={})  => {
        const p = new URLSearchParams(f).toString();
        return apiRequest(`/recepcionistas/bitacora/historial${p ? '?' + p : ''}`);
    },
    listarSolicitudesCancelacion: ()  => apiRequest('/recepcionistas/solicitudes-cancelacion'),
    aprobarCancelacion:  (id)         => apiRequest(`/recepcionistas/solicitudes-cancelacion/${id}/aprobar`, { method:'POST' }),
    rechazarCancelacion: (id)         => apiRequest(`/recepcionistas/solicitudes-cancelacion/${id}/rechazar`, { method:'POST' }),
    crear: (d) => apiRequest('/recepcionistas', { method:'POST', body:JSON.stringify(d) })
};

// ============================================================
// MEDICAMENTOS
// ============================================================
const medicamentos = {
    obtenerMedicamentos: (f={}) => {
        const p = new URLSearchParams(f).toString();
        return apiRequest(`/medicamentos/medicamentos${p ? '?' + p : ''}`);
    },
    obtenerMedicamento:   (id)  => apiRequest(`/medicamentos/medicamentos/${id}`),
    crearMedicamento:     (d)   => apiRequest('/medicamentos/medicamentos',  { method:'POST', body:JSON.stringify(d) }),
    actualizarMedicamento:(id,d)=> apiRequest(`/medicamentos/medicamentos/${id}`, { method:'PUT', body:JSON.stringify(d) }),
    eliminarMedicamento:  (id)  => apiRequest(`/medicamentos/medicamentos/${id}`, { method:'DELETE' }),
    obtenerServicios:     ()    => apiRequest('/medicamentos/servicios'),
    crearServicio:        (d)   => apiRequest('/medicamentos/servicios',    { method:'POST', body:JSON.stringify(d) }),
    actualizarServicio:   (id,d)=> apiRequest(`/medicamentos/servicios/${id}`, { method:'PUT', body:JSON.stringify(d) }),
    eliminarServicio:     (id)  => apiRequest(`/medicamentos/servicios/${id}`, { method:'DELETE' }),
    catalogo:             ()    => apiRequest('/medicamentos/catalogo'),
    // Solicitudes de compra (paciente)
    crearSolicitud:       (d)   => apiRequest('/medicamentos/solicitudes',  { method:'POST', body:JSON.stringify(d) }),
    misSolicitudes:       ()    => apiRequest('/medicamentos/solicitudes'),
    detalleSolicitud:     (id)  => apiRequest(`/medicamentos/solicitudes/${id}/detalle`),
    realizarVenta:        (d)   => apiRequest('/medicamentos/ventas',       { method:'POST', body:JSON.stringify(d) }),
    obtenerVentas: (f={}) => {
        const p = new URLSearchParams(f).toString();
        return apiRequest(`/medicamentos/ventas${p ? '?' + p : ''}`);
    },
    obtenerDetalleVenta:  (id)  => apiRequest(`/medicamentos/ventas/${id}`)
};

// ============================================================
// UTILIDADES
// ============================================================
const utils = {
    formatearFecha: (fecha) => {
        if (!fecha) return '—';
        try {
            // Evitar desfase de zona horaria añadiendo T12:00:00
            const d = new Date(String(fecha).includes('T') ? fecha : fecha + 'T12:00:00');
            return d.toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' });
        } catch { return fecha; }
    },

    formatearHora: (hora) => {
        if (!hora) return '—';
        return String(hora).substring(0, 5);
    },

    formatearMoneda: (monto) => {
        if (monto === null || monto === undefined) return '—';
        return new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(monto);
    },

    redirigirSegunRol: () => {
        const user = auth.getCurrentUser();
        if (!user) { window.location.href = '/pages/auth/login.html'; return; }
        const rutas = {
            paciente:      '/pages/dashboard/paciente.html',
            doctor:        '/pages/dashboard/doctor.html',
            recepcionista: '/pages/dashboard/recepcionista.html',
            admin:         '/pages/dashboard/recepcionista.html'
        };
        window.location.href = rutas[user.rol] || '/pages/auth/login.html';
    }
};

// ── COMPRAS PÚBLICAS (walk-in, sin autenticación requerida) ──────────
const compras = {
    /** Crea una solicitud de compra sin necesidad de estar registrado */
    solicitar: (nombreCliente, telefonoCliente, items) =>
        fetch(`${CONFIG.API_URL}/compras/solicitar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_cliente:   nombreCliente,
                telefono_cliente: telefonoCliente,
                items
            })
        }).then(r => r.json()),

    /** Listar solicitudes pendientes (recepcionista) */
    listarPendientes: () => apiRequest('/compras/pendientes'),

    /** Ver detalle de una solicitud (recepcionista) */
    detalle: (id) => apiRequest(`/compras/${id}/detalle`),

    /** Procesar / aprobar una solicitud (recepcionista) */
    procesar: (id) => apiRequest(`/compras/${id}/procesar`, { method: 'PATCH' }),

    /** Rechazar una solicitud (recepcionista) */
    rechazar: (id, motivo) =>
        apiRequest(`/compras/${id}/rechazar`, {
            method: 'PATCH',
            body: JSON.stringify({ motivo })
        }),
};

console.log('✓ API Client cargado – rutas relativas en', CONFIG.API_URL);

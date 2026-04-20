/**
 * Cliente API para Sistema de Gestión Hospitalaria
 * Conecta con backend Python/Flask en puerto 5000
 */

const CONFIG = {
    API_URL: 'http://localhost:5000/api',
    TIMEOUT: 10000
};

/**
 * Función base para peticiones HTTP al backend Flask.
 * Adjunta automáticamente el token JWT si existe.
 */
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    };

    const config = {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...(options.headers || {}) }
    };

    try {
        const response = await fetch(`${CONFIG.API_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401 && endpoint !== '/auth/login') {
                auth.logout();
                throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
            }
            throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
        }
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
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
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');
        return data;
    },

    register: async (userData) => {
        const data = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');
        return data;
    },

    verify: async () => apiRequest('/auth/verify'),

    logout: () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    },

    isAuthenticated: () => !!localStorage.getItem('authToken'),

    getCurrentUser: () => {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }
};

// ============================================================
// ESPECIALIDADES
// ============================================================
const especialidades = {
    obtenerTodas: () => apiRequest('/especialidades'),
    obtenerPorId: (id) => apiRequest(`/especialidades/${id}`),
    obtenerDoctores: (idEspecialidad) => apiRequest(`/especialidades/${idEspecialidad}/doctores`),
    crear: (datos) => apiRequest('/especialidades', { method: 'POST', body: JSON.stringify(datos) }),
    actualizar: (id, datos) => apiRequest(`/especialidades/${id}`, { method: 'PUT', body: JSON.stringify(datos) })
};

// ============================================================
// CITAS
// ============================================================
const citas = {
    obtenerMisCitas: (filtros = {}) => {
        const params = new URLSearchParams(filtros);
        return apiRequest(`/citas?${params}`);
    },

    agendarCita: (citaData) => apiRequest('/citas/agendar', {
        method: 'POST',
        body: JSON.stringify(citaData)
    }),

    cancelarCita: (folioCita, motivo) => apiRequest(`/citas/cancelar/${folioCita}`, {
        method: 'POST',
        body: JSON.stringify({ motivo_cancelacion: motivo })
    }),

    confirmarPago: (folioCita, metodoPago) => apiRequest('/citas/pagar', {
        method: 'POST',
        body: JSON.stringify({ folio_cita: folioCita, metodo_pago: metodoPago })
    }),

    marcarAtendida: (folioCita) => apiRequest(`/citas/${folioCita}/atender`, { method: 'PUT' }),

    marcarNoAcudio: (folioCita) => apiRequest(`/citas/${folioCita}/no-acudio`, { method: 'PUT' }),

    obtenerHorariosDisponibles: (idDoctor, fechaInicio, fechaFin) =>
        apiRequest(`/doctores/${idDoctor}/horarios-disponibles?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`),

    verificarVencidas: () => apiRequest('/citas/verificar-vencidas', { method: 'POST' })
};

// ============================================================
// PACIENTE
// ============================================================
const paciente = {
    obtenerPerfil: () => apiRequest('/pacientes/perfil'),
    actualizarPerfil: (datos) => apiRequest('/pacientes/perfil', { method: 'PUT', body: JSON.stringify(datos) }),
    obtenerHistorialMedico: () => apiRequest('/pacientes/historial-medico'),
    listarTodos: (filtros = {}) => apiRequest(`/pacientes?${new URLSearchParams(filtros)}`),
    obtenerPorId: (id) => apiRequest(`/pacientes/${id}`),
    obtenerHistorial: (id) => apiRequest(`/pacientes/${id}/historial`),
    actualizarHistorial: (id, datos) => apiRequest(`/pacientes/${id}/historial`, {
        method: 'PUT',
        body: JSON.stringify(datos)
    })
};

// ============================================================
// DOCTOR
// ============================================================
const doctor = {
    obtenerPerfil: () => apiRequest('/doctores/perfil'),
    listarTodos: (filtros = {}) => apiRequest(`/doctores?${new URLSearchParams(filtros)}`),
    obtenerPorId: (id) => apiRequest(`/doctores/${id}`),
    obtenerPacientes: () => apiRequest('/doctores/pacientes'),
    crearReceta: (recetaData) => apiRequest('/doctores/recetas', {
        method: 'POST',
        body: JSON.stringify(recetaData)
    }),
    listarRecetas: () => apiRequest('/doctores/recetas'),
    solicitarCancelacion: (folioCita, motivo) => apiRequest('/doctores/solicitar-cancelacion', {
        method: 'POST',
        body: JSON.stringify({ folio_cita: folioCita, motivo })
    }),
    crear: (datos) => apiRequest('/doctores', { method: 'POST', body: JSON.stringify(datos) })
};

// ============================================================
// RECEPCIONISTA
// ============================================================
const recepcionista = {
    obtenerDashboard: () => apiRequest('/recepcionistas/dashboard'),
    obtenerBitacoraEstatus: (filtros = {}) =>
        apiRequest(`/recepcionistas/bitacora/estatus?${new URLSearchParams(filtros)}`),
    obtenerBitacoraHistorial: (filtros = {}) =>
        apiRequest(`/recepcionistas/bitacora/historial?${new URLSearchParams(filtros)}`),
    listarSolicitudesCancelacion: () => apiRequest('/recepcionistas/solicitudes-cancelacion'),
    aprobarCancelacion: (idSolicitud) =>
        apiRequest(`/recepcionistas/solicitudes-cancelacion/${idSolicitud}/aprobar`, { method: 'POST' }),
    rechazarCancelacion: (idSolicitud) =>
        apiRequest(`/recepcionistas/solicitudes-cancelacion/${idSolicitud}/rechazar`, { method: 'POST' }),
    crear: (datos) => apiRequest('/recepcionistas', { method: 'POST', body: JSON.stringify(datos) })
};

// ============================================================
// FARMACIA
// ============================================================
const farmacia = {
    obtenerMedicamentos: (filtros = {}) =>
        apiRequest(`/farmacia/medicamentos?${new URLSearchParams(filtros)}`),
    obtenerMedicamento: (id) => apiRequest(`/farmacia/medicamentos/${id}`),
    crearMedicamento: (datos) => apiRequest('/farmacia/medicamentos', {
        method: 'POST', body: JSON.stringify(datos)
    }),
    actualizarMedicamento: (id, datos) => apiRequest(`/farmacia/medicamentos/${id}`, {
        method: 'PUT', body: JSON.stringify(datos)
    }),
    obtenerServicios: () => apiRequest('/farmacia/servicios'),
    crearServicio: (datos) => apiRequest('/farmacia/servicios', {
        method: 'POST', body: JSON.stringify(datos)
    }),
    realizarVenta: (ventaData) => apiRequest('/farmacia/ventas', {
        method: 'POST', body: JSON.stringify(ventaData)
    }),
    obtenerVentas: (filtros = {}) =>
        apiRequest(`/farmacia/ventas?${new URLSearchParams(filtros)}`),
    obtenerDetalleVenta: (idVenta) => apiRequest(`/farmacia/ventas/${idVenta}`)
};

// ============================================================
// UTILIDADES
// ============================================================
const utils = {
    formatearFecha: (fecha) => {
        if (!fecha) return '';
        return new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    },

    formatearHora: (hora) => hora ? hora.substring(0, 5) : '',

    formatearMoneda: (monto) => new Intl.NumberFormat('es-MX', {
        style: 'currency', currency: 'MXN'
    }).format(monto),

    obtenerColorEstatus: (clave) => {
        const colores = {
            'agendada_pendiente_pago':   '#FFA500',
            'pagada_pendiente_atender':  '#2D5F5D',
            'cancelada_falta_pago':      '#DC2626',
            'cancelada_paciente':        '#DC2626',
            'cancelada_doctor':          '#B91C1C',
            'atendida':                  '#059669',
            'no_acudio':                 '#6B6B6B'
        };
        return colores[clave] || '#6B6B6B';
    },

    obtenerTextoEstatus: (clave) => {
        const textos = {
            'agendada_pendiente_pago':   'Pendiente de Pago',
            'pagada_pendiente_atender':  'Confirmada',
            'cancelada_falta_pago':      'Cancelada – Falta de Pago',
            'cancelada_paciente':        'Cancelada por Paciente',
            'cancelada_doctor':          'Cancelada por Doctor',
            'atendida':                  'Atendida',
            'no_acudio':                 'No Acudió'
        };
        return textos[clave] || clave;
    },

    /** Redirecciona según el rol guardado en localStorage */
    redirigirSegunRol: () => {
        const user = auth.getCurrentUser();
        if (!user) { window.location.href = 'login.html'; return; }
        const rutas = {
            paciente:       'dashboard-paciente.html',
            doctor:         'dashboard-doctor.html',
            recepcionista:  'dashboard-recepcionista.html',
            admin:          'dashboard-recepcionista.html'
        };
        window.location.href = rutas[user.rol] || 'login.html';
    }
};

console.log('✓ API Client cargado – Flask backend en', CONFIG.API_URL);

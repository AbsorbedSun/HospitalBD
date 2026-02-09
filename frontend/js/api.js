/**
 * API Client para Sistema de Gestión Hospitalaria
 * Maneja todas las comunicaciones con el backend
 */

// Configuración
const CONFIG = {
    API_URL: 'http://localhost:3000/api',
    TIMEOUT: 10000 // 10 segundos
};

/**
 * Función base para hacer peticiones HTTP
 * @param {string} endpoint - Ruta del endpoint (ej: '/auth/login')
 * @param {object} options - Opciones de fetch
 * @returns {Promise} - Respuesta de la API
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
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch(`${CONFIG.API_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            // Manejar token expirado
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

// =============================================
// AUTENTICACIÓN
// =============================================
const auth = {
    /**
     * Iniciar sesión
     */
    login: async (email, password, userType) => {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, userType })
        });
        
        // Guardar token y datos de usuario
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');
        
        return data;
    },

    /**
     * Registrar nuevo paciente
     */
    register: async (userData) => {
        const data = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        // Guardar token y datos de usuario
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');
        
        return data;
    },

    /**
     * Verificar token
     */
    verify: async () => {
        return apiRequest('/auth/verify');
    },

    /**
     * Cerrar sesión
     */
    logout: () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    },

    /**
     * Verificar si está autenticado
     */
    isAuthenticated: () => {
        return !!localStorage.getItem('authToken');
    },

    /**
     * Obtener usuario actual
     */
    getCurrentUser: () => {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }
};

// =============================================
// ESPECIALIDADES
// =============================================
const especialidades = {
    /**
     * Obtener todas las especialidades
     */
    obtenerTodas: async () => {
        return apiRequest('/especialidades');
    },

    /**
     * Obtener una especialidad
     */
    obtenerPorId: async (id) => {
        return apiRequest(`/especialidades/${id}`);
    },

    /**
     * Obtener doctores de una especialidad
     */
    obtenerDoctores: async (idEspecialidad) => {
        return apiRequest(`/especialidades/${idEspecialidad}/doctores`);
    }
};

// =============================================
// CITAS
// =============================================
const citas = {
    /**
     * Obtener mis citas (con filtros opcionales)
     */
    obtenerMisCitas: async (filtros = {}) => {
        const params = new URLSearchParams(filtros);
        return apiRequest(`/citas?${params}`);
    },

    /**
     * Agendar nueva cita
     */
    agendarCita: async (citaData) => {
        return apiRequest('/citas/agendar', {
            method: 'POST',
            body: JSON.stringify(citaData)
        });
    },

    /**
     * Cancelar cita
     */
    cancelarCita: async (folioCita, motivo) => {
        return apiRequest(`/citas/cancelar/${folioCita}`, {
            method: 'POST',
            body: JSON.stringify({ motivo_cancelacion: motivo })
        });
    },

    /**
     * Confirmar pago de cita
     */
    confirmarPago: async (folioPago, metodoPago) => {
        return apiRequest('/citas/pagar', {
            method: 'POST',
            body: JSON.stringify({ folio_pago: folioPago, metodo_pago: metodoPago })
        });
    },

    /**
     * Obtener horarios disponibles de un doctor
     */
    obtenerHorariosDisponibles: async (idDoctor, fechaInicio, fechaFin) => {
        return apiRequest(`/citas/horarios-disponibles/${idDoctor}?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`);
    }
};

// =============================================
// PACIENTE
// =============================================
const paciente = {
    /**
     * Obtener perfil del paciente actual
     */
    obtenerPerfil: async () => {
        return apiRequest('/pacientes/perfil');
    },

    /**
     * Actualizar perfil
     */
    actualizarPerfil: async (datos) => {
        return apiRequest('/pacientes/perfil', {
            method: 'PUT',
            body: JSON.stringify(datos)
        });
    },

    /**
     * Obtener historial médico
     */
    obtenerHistorialMedico: async () => {
        return apiRequest('/pacientes/historial-medico');
    },

    /**
     * Listar todos los pacientes (solo recepcionista)
     */
    listarTodos: async (filtros = {}) => {
        const params = new URLSearchParams(filtros);
        return apiRequest(`/pacientes?${params}`);
    }
};

// =============================================
// DOCTOR
// =============================================
const doctor = {
    /**
     * Obtener perfil del doctor actual
     */
    obtenerPerfil: async () => {
        return apiRequest('/doctores/perfil');
    },

    /**
     * Obtener horarios del doctor
     */
    obtenerHorarios: async () => {
        return apiRequest('/doctores/horarios');
    },

    /**
     * Obtener lista de pacientes
     */
    obtenerPacientes: async () => {
        return apiRequest('/doctores/pacientes');
    },

    /**
     * Obtener historial médico de un paciente
     */
    obtenerHistorialPaciente: async (idPaciente) => {
        return apiRequest(`/doctores/pacientes/${idPaciente}/historial`);
    },

    /**
     * Crear receta médica
     */
    crearReceta: async (recetaData) => {
        return apiRequest('/doctores/recetas', {
            method: 'POST',
            body: JSON.stringify(recetaData)
        });
    },

    /**
     * Listar todos los doctores
     */
    listarTodos: async (filtros = {}) => {
        const params = new URLSearchParams(filtros);
        return apiRequest(`/doctores?${params}`);
    }
};

// =============================================
// RECEPCIONISTA
// =============================================
const recepcionista = {
    /**
     * Obtener datos del dashboard
     */
    obtenerDashboard: async () => {
        return apiRequest('/recepcionistas/dashboard');
    },

    /**
     * Obtener bitácora de estatus de citas
     */
    obtenerBitacoraEstatus: async (filtros = {}) => {
        const params = new URLSearchParams(filtros);
        return apiRequest(`/recepcionistas/bitacora/estatus?${params}`);
    },

    /**
     * Obtener bitácora de historial de citas
     */
    obtenerBitacoraHistorial: async (filtros = {}) => {
        const params = new URLSearchParams(filtros);
        return apiRequest(`/recepcionistas/bitacora/historial?${params}`);
    }
};

// =============================================
// FARMACIA
// =============================================
const farmacia = {
    /**
     * Obtener medicamentos
     */
    obtenerMedicamentos: async (filtros = {}) => {
        const params = new URLSearchParams(filtros);
        return apiRequest(`/farmacia/medicamentos?${params}`);
    },

    /**
     * Obtener servicios
     */
    obtenerServicios: async () => {
        return apiRequest('/farmacia/servicios');
    },

    /**
     * Realizar venta
     */
    realizarVenta: async (ventaData) => {
        return apiRequest('/farmacia/ventas', {
            method: 'POST',
            body: JSON.stringify(ventaData)
        });
    },

    /**
     * Obtener historial de ventas
     */
    obtenerVentas: async (filtros = {}) => {
        const params = new URLSearchParams(filtros);
        return apiRequest(`/farmacia/ventas?${params}`);
    },

    /**
     * Obtener detalle de una venta
     */
    obtenerDetalleVenta: async (idVenta) => {
        return apiRequest(`/farmacia/ventas/${idVenta}`);
    }
};

// =============================================
// UTILIDADES
// =============================================
const utils = {
    /**
     * Formatear fecha para mostrar
     */
    formatearFecha: (fecha) => {
        if (!fecha) return '';
        const date = new Date(fecha);
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    /**
     * Formatear hora
     */
    formatearHora: (hora) => {
        if (!hora) return '';
        return hora.substring(0, 5); // HH:MM
    },

    /**
     * Formatear moneda
     */
    formatearMoneda: (monto) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(monto);
    },

    /**
     * Obtener color de estatus
     */
    obtenerColorEstatus: (estatus) => {
        const colores = {
            'agendada_pendiente_pago': '#FFA500',
            'pagada_pendiente_atender': '#2D5F5D',
            'cancelada_falta_pago': '#DC2626',
            'cancelada_paciente': '#DC2626',
            'cancelada_doctor': '#DC2626',
            'atendida': '#059669',
            'no_acudio': '#6B6B6B'
        };
        return colores[estatus] || '#6B6B6B';
    },

    /**
     * Obtener texto legible de estatus
     */
    obtenerTextoEstatus: (estatus) => {
        const textos = {
            'agendada_pendiente_pago': 'Pendiente de Pago',
            'pagada_pendiente_atender': 'Confirmada',
            'cancelada_falta_pago': 'Cancelada - Falta de Pago',
            'cancelada_paciente': 'Cancelada por Paciente',
            'cancelada_doctor': 'Cancelada por Doctor',
            'atendida': 'Atendida',
            'no_acudio': 'No Acudió'
        };
        return textos[estatus] || estatus;
    }
};

// Mensaje de carga
console.log('✓ API Client cargado correctamente');
console.log('Endpoints disponibles: auth, especialidades, citas, paciente, doctor, recepcionista, farmacia');

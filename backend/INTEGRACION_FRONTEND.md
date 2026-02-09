# 🔗 Guía de Integración Frontend-Backend

Esta guía te ayudará a conectar tu frontend existente con el backend de la API.

## 📁 Archivos del Frontend a Modificar

### 1. `js/auth.js`

Reemplazar las secciones de simulación de API con llamadas reales.

#### Antes (líneas 29-56):
```javascript
// Simulate login (replace with actual API call)
showNotification('Iniciando sesión...', 'info');

setTimeout(() => {
    // Store user data
    const userData = {
        userType: userType,
        email: email,
        name: email.split('@')[0]
    };
    localStorage.setItem('currentUser', JSON.stringify(userData));
    // ...redirect...
}, 1000);
```

#### Después:
```javascript
// API Call
showNotification('Iniciando sesión...', 'info');

try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: email,
            password: password,
            userType: userType
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
    }

    // Guardar token y datos de usuario
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    localStorage.setItem('isLoggedIn', 'true');

    showNotification('Login exitoso', 'success');

    // Redirigir según tipo de usuario
    setTimeout(() => {
        switch(userType) {
            case 'paciente':
                window.location.href = 'dashboard-paciente.html';
                break;
            case 'doctor':
                window.location.href = 'dashboard-doctor.html';
                break;
            case 'recepcionista':
                window.location.href = 'dashboard-recepcionista.html';
                break;
        }
    }, 500);

} catch (error) {
    console.error('Error:', error);
    showNotification(error.message, 'error');
}
```

### 2. Crear `js/api.js` - Utilidad para llamadas API

```javascript
// Configuración base de la API
const API_URL = 'http://localhost:3000/api';

// Función auxiliar para hacer peticiones
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
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error en la petición');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Funciones de autenticación
const auth = {
    login: async (email, password, userType) => {
        return apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, userType })
        });
    },

    register: async (userData) => {
        return apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    logout: () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    },

    isAuthenticated: () => {
        return !!localStorage.getItem('authToken');
    },

    getCurrentUser: () => {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }
};

// Funciones de citas
const citas = {
    obtenerMisCitas: async (filtros = {}) => {
        const params = new URLSearchParams(filtros);
        return apiRequest(`/citas?${params}`);
    },

    agendarCita: async (citaData) => {
        return apiRequest('/citas/agendar', {
            method: 'POST',
            body: JSON.stringify(citaData)
        });
    },

    cancelarCita: async (folioCita, motivo) => {
        return apiRequest(`/citas/cancelar/${folioCita}`, {
            method: 'POST',
            body: JSON.stringify({ motivo_cancelacion: motivo })
        });
    },

    confirmarPago: async (folioPago, metodoPago) => {
        return apiRequest('/citas/pagar', {
            method: 'POST',
            body: JSON.stringify({ folio_pago: folioPago, metodo_pago: metodoPago })
        });
    },

    obtenerHorariosDisponibles: async (idDoctor, fechaInicio, fechaFin) => {
        return apiRequest(`/citas/horarios-disponibles/${idDoctor}?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`);
    }
};

// Funciones de especialidades
const especialidades = {
    obtenerTodas: async () => {
        return apiRequest('/especialidades');
    },

    obtenerDoctores: async (idEspecialidad) => {
        return apiRequest(`/especialidades/${idEspecialidad}/doctores`);
    }
};

// Funciones de paciente
const paciente = {
    obtenerPerfil: async () => {
        return apiRequest('/pacientes/perfil');
    },

    actualizarPerfil: async (datos) => {
        return apiRequest('/pacientes/perfil', {
            method: 'PUT',
            body: JSON.stringify(datos)
        });
    },

    obtenerHistorialMedico: async () => {
        return apiRequest('/pacientes/historial-medico');
    }
};

// Funciones de doctor
const doctor = {
    obtenerPerfil: async () => {
        return apiRequest('/doctores/perfil');
    },

    obtenerPacientes: async () => {
        return apiRequest('/doctores/pacientes');
    },

    obtenerHistorialPaciente: async (idPaciente) => {
        return apiRequest(`/doctores/pacientes/${idPaciente}/historial`);
    },

    crearReceta: async (recetaData) => {
        return apiRequest('/doctores/recetas', {
            method: 'POST',
            body: JSON.stringify(recetaData)
        });
    }
};

// Funciones de farmacia
const farmacia = {
    obtenerMedicamentos: async (filtros = {}) => {
        const params = new URLSearchParams(filtros);
        return apiRequest(`/farmacia/medicamentos?${params}`);
    },

    obtenerServicios: async () => {
        return apiRequest('/farmacia/servicios');
    },

    realizarVenta: async (ventaData) => {
        return apiRequest('/farmacia/ventas', {
            method: 'POST',
            body: JSON.stringify(ventaData)
        });
    }
};

// Exportar (si usas módulos)
// export { auth, citas, especialidades, paciente, doctor, farmacia };
```

### 3. Incluir `api.js` en los HTML

Agregar antes de los otros scripts:

```html
<!-- En todos los dashboards -->
<script src="js/api.js"></script>
<script src="js/dashboard-paciente.js"></script>
```

### 4. Ejemplo de Uso en Dashboard Paciente

Modificar `js/dashboard-paciente.js`:

```javascript
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar autenticación
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Cargar datos del usuario
    try {
        const perfilData = await paciente.obtenerPerfil();
        mostrarDatosPersonales(perfilData.paciente);

        const citasData = await citas.obtenerMisCitas();
        mostrarCitas(citasData.citas);

    } catch (error) {
        console.error('Error al cargar datos:', error);
        showNotification('Error al cargar información', 'error');
    }

    // Resto del código...
});

function mostrarDatosPersonales(datos) {
    document.getElementById('nombrePaciente').textContent = 
        `${datos.nombre} ${datos.apellido_paterno}`;
    document.getElementById('emailPaciente').textContent = datos.email;
    // etc...
}

function mostrarCitas(listaCitas) {
    const container = document.getElementById('citasContainer');
    container.innerHTML = listaCitas.map(cita => `
        <div class="cita-card">
            <h3>${cita.especialidad}</h3>
            <p>Dr. ${cita.nombre_doctor}</p>
            <p>Fecha: ${cita.fecha_cita}</p>
            <p>Hora: ${cita.hora_cita}</p>
            <span class="status">${cita.estatus}</span>
        </div>
    `).join('');
}

// Handler para agendar cita
async function handleAgendarCita(event) {
    event.preventDefault();

    const citaData = {
        id_doctor: document.getElementById('doctorSelect').value,
        fecha_cita: document.getElementById('fechaCita').value,
        hora_cita: document.getElementById('horaCita').value
    };

    try {
        const resultado = await citas.agendarCita(citaData);
        showNotification(resultado.message, 'success');
        
        // Mostrar comprobante
        mostrarComprobante(resultado.cita);
        
        // Recargar lista de citas
        const citasData = await citas.obtenerMisCitas();
        mostrarCitas(citasData.citas);
        
    } catch (error) {
        showNotification(error.message, 'error');
    }
}
```

## 🔐 Protección de Rutas

Agregar al inicio de cada archivo dashboard:

```javascript
// Verificar autenticación al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const currentUser = auth.getCurrentUser();
    
    // Verificar que el tipo de usuario coincida con el dashboard
    // Por ejemplo, en dashboard-paciente.html:
    if (currentUser.tipo_usuario !== 'paciente') {
        window.location.href = 'index.html';
        return;
    }

    // Continuar con la carga normal...
});
```

## 📝 Checklist de Integración

- [ ] Copiar backend a una carpeta separada
- [ ] Instalar dependencias del backend (`npm install`)
- [ ] Configurar `.env` con credenciales de SQL Server
- [ ] Ejecutar scripts SQL para crear la base de datos
- [ ] Iniciar el backend (`npm run dev`)
- [ ] Crear `js/api.js` en el frontend
- [ ] Incluir `api.js` en todos los HTML
- [ ] Modificar `js/auth.js` para usar la API real
- [ ] Modificar dashboards para cargar datos de la API
- [ ] Probar login con credenciales de prueba
- [ ] Probar agendar cita
- [ ] Probar otras funcionalidades

## 🐛 Debug

Para ver las peticiones HTTP en la consola del navegador:

```javascript
// En api.js, modificar apiRequest:
async function apiRequest(endpoint, options = {}) {
    console.log('API Request:', endpoint, options);
    
    // ... código existente ...
    
    console.log('API Response:', data);
    return data;
}
```

## 🚀 Puesta en Producción

1. Cambiar `API_URL` en `api.js` a la URL de producción
2. Configurar CORS en el backend para permitir la URL de producción
3. Usar HTTPS para todas las comunicaciones
4. Cambiar `JWT_SECRET` a un valor seguro
5. Configurar variables de entorno en el servidor

## 💡 Consejos

- Siempre manejar errores con try-catch
- Mostrar mensajes claros al usuario
- Validar datos antes de enviar a la API
- Implementar loading states mientras se espera respuesta
- Limpiar el localStorage al hacer logout
- Renovar token antes de que expire (implementar refresh token)

¡Buena suerte con la integración! 🎉

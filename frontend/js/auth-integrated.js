/**
 * Sistema de Autenticación
 * Maneja login, registro y autenticación de usuarios
 * Compatible con API backend y modo offline para desarrollo
 */

// Configuración - Cambiar a false para usar datos simulados
const USE_API = true;

// =============================================
// TOGGLE PASSWORD VISIBILITY
// =============================================
document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
        const input = this.previousElementSibling;
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        this.classList.toggle('active');
    });
});

// =============================================
// LOGIN FORM HANDLER
// =============================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const userType = document.getElementById('userType').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // Validación básica
        if (!userType || !email || !password) {
            showNotification('Por favor completa todos los campos', 'error');
            return;
        }

        showNotification('Iniciando sesión...', 'info');

        try {
            if (USE_API) {
                // ==========================================
                // MODO API - Conectar con backend real
                // ==========================================
                const data = await auth.login(email, password, userType);
                
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
                
            } else {
                // ==========================================
                // MODO OFFLINE - Simulación para desarrollo
                // ==========================================
                setTimeout(() => {
                    const userData = {
                        userType: userType,
                        email: email,
                        name: email.split('@')[0]
                    };
                    localStorage.setItem('currentUser', JSON.stringify(userData));
                    localStorage.setItem('isLoggedIn', 'true');
                    
                    showNotification('Login exitoso (modo offline)', 'success');
                    
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
                }, 1000);
            }
            
        } catch (error) {
            console.error('Error en login:', error);
            showNotification(error.message || 'Error al iniciar sesión', 'error');
        }
    });
}

// =============================================
// REGISTER FORM HANDLER
// =============================================
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const termsAccepted = document.querySelector('input[name="terms"]').checked;
        
        // Validaciones
        if (!firstName || !lastName || !email || !phone || !password || !confirmPassword) {
            showNotification('Por favor completa todos los campos', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showNotification('Las contraseñas no coinciden', 'error');
            document.getElementById('confirmPassword').classList.add('error');
            return;
        }
        
        if (password.length < 8) {
            showNotification('La contraseña debe tener al menos 8 caracteres', 'error');
            document.getElementById('password').classList.add('error');
            return;
        }
        
        if (!termsAccepted) {
            showNotification('Debes aceptar los términos y condiciones', 'error');
            return;
        }

        showNotification('Creando tu cuenta...', 'info');

        try {
            if (USE_API) {
                // ==========================================
                // MODO API - Conectar con backend real
                // ==========================================
                const userData = {
                    firstName,
                    lastName,
                    email,
                    phone,
                    password
                };
                
                const data = await auth.register(userData);
                
                showNotification('¡Cuenta creada exitosamente!', 'success');
                
                setTimeout(() => {
                    window.location.href = 'dashboard-paciente.html';
                }, 1500);
                
            } else {
                // ==========================================
                // MODO OFFLINE - Simulación para desarrollo
                // ==========================================
                setTimeout(() => {
                    const userData = {
                        userType: 'paciente',
                        email: email,
                        name: `${firstName} ${lastName}`,
                        phone: phone
                    };
                    localStorage.setItem('currentUser', JSON.stringify(userData));
                    localStorage.setItem('isLoggedIn', 'true');
                    
                    showNotification('¡Cuenta creada exitosamente! (modo offline)', 'success');
                    
                    setTimeout(() => {
                        window.location.href = 'dashboard-paciente.html';
                    }, 1500);
                }, 1000);
            }
            
        } catch (error) {
            console.error('Error en registro:', error);
            showNotification(error.message || 'Error al crear cuenta', 'error');
        }
    });
}

// =============================================
// REMOVE ERROR CLASS ON INPUT
// =============================================
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
        this.classList.remove('error');
    });
});

// =============================================
// NOTIFICATION SYSTEM
// =============================================
function showNotification(message, type = 'info') {
    // Remover notificación existente
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Crear notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Agregar estilos si no existen
    if (!document.getElementById('notification-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'notification-styles';
        styleSheet.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 1rem 1.5rem;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                z-index: 10000;
                animation: slideInRight 0.3s ease-out;
                max-width: 400px;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
            }
            
            .notification-error {
                border-left: 4px solid #DC2626;
            }
            
            .notification-success {
                border-left: 4px solid #059669;
            }
            
            .notification-info {
                border-left: 4px solid #2D5F5D;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #6B6B6B;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .notification-close:hover {
                color: #1A1A1A;
            }
        `;
        document.head.appendChild(styleSheet);
    }
    
    // Agregar a la página
    document.body.appendChild(notification);
    
    // Botón de cerrar
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
    
    // Auto remover después de 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// =============================================
// VERIFICAR ESTADO DE API
// =============================================
if (USE_API) {
    console.log('✓ Modo API activado - Conectando con backend');
    console.log('Backend URL:', typeof auth !== 'undefined' ? 'Configurado' : 'api.js no cargado');
} else {
    console.log('⚠ Modo OFFLINE - Usando datos simulados');
    console.log('Para activar API, cambia USE_API = true en auth.js');
}

console.log('✓ Sistema de autenticación cargado');

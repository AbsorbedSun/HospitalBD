// Toggle password visibility
document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
        const input = this.previousElementSibling;
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        
        // Toggle icon (you can add different SVG for open/closed eye)
        this.classList.toggle('active');
    });
});

// Login Form Handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const userType = document.getElementById('userType').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // Basic validation
        if (!userType || !email || !password) {
            showNotification('Por favor completa todos los campos', 'error');
            return;
        }
        
        // Simulate login (replace with actual API call)
        showNotification('Iniciando sesión...', 'info');
        
        setTimeout(() => {
            // Store user data
            const userData = {
                userType: userType,
                email: email,
                name: email.split('@')[0] // Simplified name extraction
            };
            localStorage.setItem('currentUser', JSON.stringify(userData));
            localStorage.setItem('isLoggedIn', 'true');
            
            // Redirect based on user type
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
                default:
                    showNotification('Tipo de usuario no válido', 'error');
            }
        }, 1000);
    });
}

// Register Form Handler
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const termsAccepted = document.querySelector('input[name="terms"]').checked;
        
        // Validation
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
        
        // Simulate registration (replace with actual API call)
        showNotification('Creando tu cuenta...', 'info');
        
        setTimeout(() => {
            // Store user data
            const userData = {
                userType: 'paciente', // New users are patients by default
                email: email,
                name: `${firstName} ${lastName}`,
                phone: phone
            };
            localStorage.setItem('currentUser', JSON.stringify(userData));
            localStorage.setItem('isLoggedIn', 'true');
            
            showNotification('¡Cuenta creada exitosamente!', 'success');
            
            // Redirect to patient dashboard
            setTimeout(() => {
                window.location.href = 'dashboard-paciente.html';
            }, 1500);
        }, 1000);
    });
}

// Remove error class on input
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
        this.classList.remove('error');
    });
});

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Add styles
    const styles = `
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
    
    // Add styles if not already added
    if (!document.getElementById('notification-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'notification-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

console.log('Auth system loaded ✓');

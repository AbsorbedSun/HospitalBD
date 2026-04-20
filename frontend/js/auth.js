/**
 * Manejador de autenticación para Login y Registro.
 * Conecta directamente con el backend Python/Flask a través de api.js
 *
 * NOTA: Este archivo reemplaza a auth.js y auth-integrated.js anteriores.
 * Requiere que api.js esté cargado antes.
 */

// ─── Toggle visibilidad de contraseña ────────────────────────────
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function () {
        const input = this.previousElementSibling;
        input.setAttribute('type', input.type === 'password' ? 'text' : 'password');
        this.classList.toggle('active');
    });
});

// ─── Utilidad de notificaciones ──────────────────────────────────
function showNotification(message, type = 'info') {
    document.querySelector('.notification')?.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>`;

    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification{position:fixed;top:20px;right:20px;background:#fff;padding:1rem 1.5rem;
                border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.12);z-index:10000;
                animation:slideIn .3s ease-out;max-width:420px}
            @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
            .notification-content{display:flex;align-items:center;justify-content:space-between;gap:1rem}
            .notification-error  {border-left:4px solid #DC2626}
            .notification-success{border-left:4px solid #059669}
            .notification-info   {border-left:4px solid #2D5F5D}
            .notification-close{background:none;border:none;font-size:1.5rem;cursor:pointer;
                color:#6B6B6B;padding:0;width:24px;height:24px;display:flex;align-items:center;
                justify-content:center}
            .notification-close:hover{color:#1A1A1A}`;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);
    notification.querySelector('.notification-close').addEventListener('click', () => notification.remove());
    setTimeout(() => notification.parentElement && notification.remove(), 5000);
}

// ─── FORMULARIO DE LOGIN ──────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!email || !password) {
            showNotification('Por favor completa todos los campos.', 'error');
            return;
        }

        const submitBtn = loginForm.querySelector('[type="submit"]');
        submitBtn.disabled = true;
        showNotification('Iniciando sesión…', 'info');

        try {
            const data = await auth.login(email, password);
            showNotification('¡Bienvenido! Redirigiendo…', 'success');

            const rutas = {
                paciente:      'dashboard-paciente.html',
                doctor:        'dashboard-doctor.html',
                recepcionista: 'dashboard-recepcionista.html',
                admin:         'dashboard-recepcionista.html'
            };
            setTimeout(() => {
                window.location.href = rutas[data.user.rol] || 'dashboard-paciente.html';
            }, 800);

        } catch (err) {
            showNotification(err.message || 'Error al iniciar sesión.', 'error');
            submitBtn.disabled = false;
        }
    });
}

// ─── FORMULARIO DE REGISTRO ───────────────────────────────────────
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const nombre    = document.getElementById('firstName').value.trim();
        const apPaterno = document.getElementById('lastName').value.trim();
        const email     = document.getElementById('email').value.trim();
        const telefono  = document.getElementById('phone').value.trim();
        const curp      = document.getElementById('curp')?.value.trim() || '';
        const fechaNac  = document.getElementById('fechaNac')?.value || '';
        const password  = document.getElementById('password').value.trim();
        const confirmar = document.getElementById('confirmPassword').value.trim();
        const terminos  = document.querySelector('input[name="terms"]')?.checked;

        // Validaciones
        if (!nombre || !apPaterno || !email || !password || !confirmar) {
            showNotification('Por favor completa todos los campos requeridos.', 'error');
            return;
        }
        if (password !== confirmar) {
            showNotification('Las contraseñas no coinciden.', 'error');
            document.getElementById('confirmPassword').classList.add('error');
            return;
        }
        if (password.length < 8) {
            showNotification('La contraseña debe tener al menos 8 caracteres.', 'error');
            return;
        }
        if (!terminos) {
            showNotification('Debes aceptar los términos y condiciones.', 'error');
            return;
        }

        const submitBtn = registerForm.querySelector('[type="submit"]');
        submitBtn.disabled = true;
        showNotification('Creando tu cuenta…', 'info');

        try {
            await auth.register({
                nombre,
                ap_paterno: apPaterno,
                email,
                telefono,
                curp,
                fecha_nac: fechaNac,
                password
            });
            showNotification('¡Cuenta creada exitosamente! Redirigiendo…', 'success');
            setTimeout(() => { window.location.href = 'dashboard-paciente.html'; }, 1000);
        } catch (err) {
            showNotification(err.message || 'Error al crear la cuenta.', 'error');
            submitBtn.disabled = false;
        }
    });
}

// ─── Limpiar clase error en inputs ───────────────────────────────
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function () { this.classList.remove('error'); });
});

console.log('✓ Auth system cargado');

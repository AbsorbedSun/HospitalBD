/**
 * Manejador de autenticación – Login y Registro
 * Requiere api.js cargado primero.
 */

// ── Estilos de notificación (inyectados una sola vez) ────────────
(function injectStyles() {
    if (document.getElementById('notif-styles')) return;
    const s = document.createElement('style');
    s.id = 'notif-styles';
    s.textContent = `
        .notif{position:fixed;top:1.25rem;right:1.25rem;z-index:9999;
            background:#fff;border-radius:12px;padding:1rem 1.5rem;
            box-shadow:0 8px 32px rgba(0,0,0,.15);max-width:420px;
            display:flex;align-items:flex-start;gap:.75rem;
            animation:nIn .3s ease;font-family:'Manrope',sans-serif}
        @keyframes nIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
        .notif-error  {border-left:4px solid #DC2626}
        .notif-success{border-left:4px solid #059669}
        .notif-info   {border-left:4px solid #2D5F5D}
        .notif-icon   {font-size:1.3rem;flex-shrink:0}
        .notif-body   {flex:1}
        .notif-title  {font-weight:700;font-size:.95rem;margin-bottom:.2rem}
        .notif-msg    {font-size:.875rem;color:#444;line-height:1.4}
        .notif-close  {background:none;border:none;cursor:pointer;font-size:1.2rem;color:#999;align-self:flex-start}
        .notif-close:hover{color:#1a1a1a}
    `;
    document.head.appendChild(s);
})();

function showNotification(message, type = 'info', title = '') {
    document.querySelectorAll('.notif').forEach(n => n.remove());

    const icons   = { error:'❌', success:'✅', info:'ℹ️' };
    const titles  = { error:'Error', success:'¡Listo!', info:'Info' };
    const el      = document.createElement('div');
    el.className  = `notif notif-${type}`;
    el.innerHTML  = `
        <span class="notif-icon">${icons[type] || 'ℹ️'}</span>
        <div class="notif-body">
            <div class="notif-title">${title || titles[type] || ''}</div>
            <div class="notif-msg">${message}</div>
        </div>
        <button class="notif-close" onclick="this.parentElement.remove()">×</button>`;
    document.body.appendChild(el);

    // Auto-cerrar según tipo
    const delay = type === 'error' ? 8000 : 4000;
    setTimeout(() => el.parentElement && el.remove(), delay);
}

// ── Inicialización ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Limpiar error visual al escribir en cualquier input
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => input.classList.remove('error'));
    });

    initLoginForm();
    initRegisterForm();
});

// ── FORMULARIO DE LOGIN ──────────────────────────────────────────
function initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const emailEl    = document.getElementById('email');
        const passwordEl = document.getElementById('password');
        const submitBtn  = form.querySelector('[type="submit"]');

        const email    = (emailEl?.value    || '').trim();
        const password = (passwordEl?.value || '').trim();

        // Validación básica
        if (!email) {
            emailEl?.classList.add('error');
            showNotification('Ingresa tu correo electrónico.', 'error');
            return;
        }
        if (!password) {
            passwordEl?.classList.add('error');
            showNotification('Ingresa tu contraseña.', 'error');
            return;
        }

        submitBtn.disabled    = true;
        submitBtn.textContent = 'Iniciando sesión…';
        showNotification('Verificando credenciales…', 'info');

        try {
            const data = await auth.login(email, password);

            showNotification(`¡Bienvenido, ${data.user.nombre}! Redirigiendo…`, 'success');

            const rutas = {
                paciente:      'dashboard-paciente.html',
                doctor:        'dashboard-doctor.html',
                recepcionista: 'dashboard-recepcionista.html',
                admin:         'dashboard-recepcionista.html'
            };

            setTimeout(() => {
                window.location.href = rutas[data.user.rol] || 'dashboard-paciente.html';
            }, 900);

        } catch (err) {
            console.error('[Login]', err);
            showNotification(err.message || 'Error desconocido al iniciar sesión.', 'error');
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Iniciar Sesión';
            // Marcar campo con error visual si son credenciales
            if (err.message?.includes('Credenciales')) {
                emailEl?.classList.add('error');
                passwordEl?.classList.add('error');
            }
        }
    });
}

// ── FORMULARIO DE REGISTRO ───────────────────────────────────────
function initRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const g    = id => (document.getElementById(id)?.value || '').trim();
        const mark = id => document.getElementById(id)?.classList.add('error');

        const nombre    = g('firstName');
        const apPaterno = g('lastName');
        const email     = g('email');
        const curp      = g('curp').toUpperCase();
        const fechaNac  = g('fechaNac');
        const password  = g('password');
        const confirmar = g('confirmPassword');
        const terminos  = document.querySelector('input[name="terms"]')?.checked;

        // Validaciones
        const errores = [];
        if (!nombre)    { errores.push('Nombre es requerido.');          mark('firstName'); }
        if (!apPaterno) { errores.push('Apellido paterno es requerido.');  mark('lastName'); }
        if (!email)     { errores.push('Correo electrónico es requerido.'); mark('email'); }
        if (!curp || curp.length !== 18) { errores.push('CURP debe tener 18 caracteres.'); mark('curp'); }
        if (!fechaNac)  { errores.push('Fecha de nacimiento es requerida.'); mark('fechaNac'); }
        if (!password)  { errores.push('Contraseña es requerida.'); mark('password'); }
        if (password.length > 0 && password.length < 8) {
            errores.push('La contraseña debe tener al menos 8 caracteres.'); mark('password');
        }
        if (password !== confirmar) {
            errores.push('Las contraseñas no coinciden.'); mark('confirmPassword');
        }
        if (!terminos)  { errores.push('Debes aceptar los términos y condiciones.'); }

        if (errores.length) {
            showNotification(errores[0], 'error');
            return;
        }

        const submitBtn = form.querySelector('[type="submit"]');
        submitBtn.disabled    = true;
        submitBtn.textContent = 'Creando cuenta…';
        showNotification('Registrando tu cuenta…', 'info');

        try {
            await auth.register({
                nombre,
                ap_paterno: apPaterno,
                ap_materno: g('lastName2') || '',
                email,
                curp,
                fecha_nac:  fechaNac,
                password,
                telefono:   g('phone') || ''
            });

            showNotification('¡Cuenta creada exitosamente! Redirigiendo…', 'success');
            setTimeout(() => { window.location.href = 'dashboard-paciente.html'; }, 1000);

        } catch (err) {
            console.error('[Register]', err);
            showNotification(err.message || 'Error al crear la cuenta.', 'error');
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Registrarse';
        }
    });
}

/**
 * Dashboard Paciente – MediConnect
 * JS completamente funcional con llamadas reales al backend Flask.
 */

const STATE = {
    user: null, perfil: null, citas: [], historial: null,
    especialidades: [],
    agendar: { paso: 1, especialidad: null, doctor: null, fecha: null, hora: null }
};

// Guarda contra cargas concurrentes: solo la ultima vista solicitada escribe en el DOM.
let _loadingView = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = auth.getCurrentUser();
    if (!user || user.rol !== 'paciente') { window.location.href = '/pages/auth/login.html'; return; }
    STATE.user = user;
    document.getElementById('userName').textContent = `${user.nombre} ${user.ap_paterno}`;
    document.getElementById('userInitials').textContent = (user.nombre[0] + user.ap_paterno[0]).toUpperCase();
    if (!document.getElementById('toast-container')) {
        const tc = document.createElement('div'); tc.id = 'toast-container'; document.body.appendChild(tc);
    }

    // Navegación lateral
    document.querySelectorAll('.nav-item:not(.logout-btn)').forEach(item => {
        item.addEventListener('click', function () {
            document.querySelectorAll('.nav-item:not(.logout-btn)').forEach(n => n.classList.remove('active'));
            this.classList.add('active');
            loadView(this.dataset.view);
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('¿Cerrar sesión?')) auth.logout();
    });

    // Cargar pantalla de inicio primero
    loadView('inicio');
});

const VIEWS = {
    'inicio':            { title: 'Inicio',             subtitle: `Bienvenido a MediConnect` },
    'datos-personales':  { title: 'Datos Personales',   subtitle: 'Tu información registrada' },
    'citas-agendadas':   { title: 'Mis Citas',          subtitle: 'Historial y gestión de citas' },
    'agendar-cita':      { title: 'Agendar Nueva Cita', subtitle: 'Programa tu próxima consulta' },
    'historial-medico':  { title: 'Historial Médico',   subtitle: 'Tu información de salud' },
    'mis-recetas':       { title: 'Mis Recetas',        subtitle: 'Prescripciones médicas emitidas por tus doctores' },
    'farmacia-paciente': { title: 'Farmacia',           subtitle: 'Solicita medicamentos y servicios sin salir del sistema' },
};

async function loadView(viewName) {
    const myToken = Symbol(viewName);
    _loadingView  = myToken;

    const container = document.getElementById('contentContainer');
    const info = VIEWS[viewName] || {};
    document.getElementById('pageTitle').textContent    = info.title    || viewName;
    document.getElementById('pageSubtitle').textContent = info.subtitle || '';
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
        switch (viewName) {
            case 'inicio':           await renderInicio(container, myToken);          break;
            case 'datos-personales': await renderDatosPersonales(container, myToken); break;
            case 'citas-agendadas':  await renderCitas(container, myToken);           break;
            case 'agendar-cita':     await renderAgendarCita(container, myToken);     break;
            case 'historial-medico': await renderHistorialMedico(container, myToken); break;
            case 'mis-recetas':      await renderMisRecetas(container, myToken);      break;
            case 'farmacia-paciente':await renderFarmaciaPaciente(container, myToken);break;
        }
    } catch (err) {
        if (_loadingView === myToken) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 3L18 17H2L10 3Z"/><path d="M10 10V13M10 15.5V16"/></svg></div><h3>Error</h3><p>${err.message}</p></div>`;
        }
    }
}

function _stale(token) { return _loadingView !== token; }

/* ── INICIO / BIENVENIDA ──────────────────────────── */
async function renderInicio(container, _token) {
    // Cargar citas de forma segura — si el backend falla, se muestran ceros
    let prog = 0, total = 0, htmlProxima = '';

    try {
        const misCitas = await citas.obtenerMisCitas();
        STATE.citas = Array.isArray(misCitas) ? misCitas : [];
        total = STATE.citas.length;
        prog  = STATE.citas.filter(
            c => ['agendada_pendiente_pago','pagada_pendiente_atender'].includes(c.Estatus)
        ).length;

        // Buscar la próxima cita confirmada más cercana
        const futuras = STATE.citas
            .filter(c => c.Estatus === 'pagada_pendiente_atender')
            .sort((a, b) => new Date(a.Fecha_Cita) - new Date(b.Fecha_Cita));

        const p = futuras[0] || null;

        if (p) {
            // Construir HTML de la cita futura SIN template literal anidado
            const fecha  = utils.formatearFecha(p.Fecha_Cita  || '');
            const hora   = utils.formatearHora(p.Hora_Cita    || '');
            const esp    = p.Especialidad  || '—';
            const docNom = p.NombreDoctor  || '';
            const docAp  = p.ApDocPat      || '';
            const badge  = badgeEstatus(p.Estatus || '');

            htmlProxima =
                '<div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap">' +
                  '<div style="font-size:2.5rem">🗓️</div>' +
                  '<div>' +
                    '<div style="font-size:1.1rem;font-weight:700;color:var(--primary)">' +
                      fecha + ' a las ' + hora +
                    '</div>' +
                    '<div style="color:var(--text-secondary);margin-top:.25rem">' +
                      esp + ' · Dr. ' + docNom + ' ' + docAp +
                    '</div>' +
                    '<div style="margin-top:.75rem">' + badge + '</div>' +
                  '</div>' +
                '</div>';
        }
    } catch (e) {
        console.warn('[Inicio] Error cargando citas:', e.message);
    }

    // Fallback si no hay próxima cita
    if (!htmlProxima) {
        htmlProxima =
            '<div style="text-align:center;padding:1.5rem 0">' +
              '<div class="empty-icon"><svg width="25" height="25" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 10H7L9 13H11L13 10H17"/><path d="M3 10V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V10L14.5 4H5.5L3 10Z"/></svg></div>' +
              '<p style="color:var(--text-secondary);margin-bottom:1rem">' +
                'No tienes citas confirmadas próximamente.' +
              '</p>' +
              '<button class="btn btn-primary" onclick="irPacienteVista(\'agendar-cita\')">' +
                '+ Agendar mi primera cita' +
              '</button>' +
            '</div>';
    }

    const user   = STATE.user;
    const h      = new Date().getHours();
    const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';

    // Construir el HTML final sin template literals anidados
    container.innerHTML =
        '<div class="view-content">' +

        // ── Banner de bienvenida ──────────────────────────────────────
        '<div class="info-card" style="margin-bottom:1.5rem;background:linear-gradient(135deg,var(--primary) 0%,var(--primary-light) 100%);color:white;border:none">' +
          '<div style="display:flex;align-items:center;gap:1.25rem;flex-wrap:wrap">' +
            '<div style="color:var(--primary);margin-bottom:.5rem"><svg width="32" height="32" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="7" width="14" height="11" rx="1"/><path d="M1 7L10 2L19 7"/><path d="M10 10V15M7.5 12.5H12.5"/></svg></div>' +
            '<div>' +
              '<h2 style="font-size:1.5rem;font-family:\'Playfair Display\',serif;color:white;margin-bottom:.25rem">' +
                saludo + ', ' + user.nombre + ' ' + user.ap_paterno +
              '</h2>' +
              '<p style="color:rgba(255,255,255,.8);font-size:.95rem">' +
                'Bienvenido a tu panel de salud personal en MediConnect' +
              '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // ── Tarjetas de resumen ───────────────────────────────────────
        '<div class="stats-grid" style="margin-bottom:1.5rem">' +
          '<div class="info-card stat-card">' +
            '<div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8H17M7 3V5M13 3V5"/></svg></div>' +
            '<div class="stat-value">' + prog + '</div>' +
            '<div class="stat-label">Citas Activas</div>' +
          '</div>' +
          '<div class="info-card stat-card" style="cursor:pointer" onclick="irPacienteVista(\'citas-agendadas\')">' +
            '<div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4H14C14.55 4 15 4.45 15 5V16C15 16.55 14.55 17 14 17H6C5.45 17 5 16.55 5 16V5C5 4.45 5.45 4 6 4Z"/><path d="M8 8H12M8 11H12M8 14H10"/><path d="M12 2V5M8 2V5"/></svg></div>' +
            '<div class="stat-value">' + total + '</div>' +
            '<div class="stat-label">Total de Citas</div>' +
          '</div>' +
          '<div class="info-card stat-card" style="cursor:pointer" onclick="irPacienteVista(\'agendar-cita\')">' +
            '<div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M10 6V14M6 10H14"/></svg></div>' +
            '<div class="stat-value" style="font-size:1.5rem">Nueva</div>' +
            '<div class="stat-label">Agendar Cita</div>' +
          '</div>' +
          '<div class="info-card stat-card" style="cursor:pointer" onclick="irPacienteVista(\'historial-medico\')">' +
            '<div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 16.5C10 16.5 3 12 3 7C3 5.34 4.34 4 6 4C7.33 4 8.47 4.83 9 6C9.53 4.83 10.67 4 12 4C13.66 4 15 5.34 15 7C15 12 10 16.5 10 16.5Z"/></svg></div>' +
            '<div class="stat-value" style="font-size:1.5rem">Ver</div>' +
            '<div class="stat-label">Mi Historial</div>' +
          '</div>' +
        '</div>' +

        // ── Próxima cita ──────────────────────────────────────────────
        '<div class="info-card" style="margin-bottom:1.5rem">' +
          '<div class="info-header"><h3>Tu Próxima Cita</h3></div>' +
          '<div class="info-body" style="margin-top:1rem">' + htmlProxima + '</div>' +
        '</div>' +

        // ── Acciones rápidas ──────────────────────────────────────────
        '<div class="info-card">' +
          '<div class="info-header"><h3>Acciones Rápidas</h3></div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1rem">' +
            '<button class="btn btn-primary"   onclick="irPacienteVista(\'agendar-cita\')"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8H17M7 3V5M13 3V5"/></svg> Agendar Cita</button>' +
            '<button class="btn btn-secondary" onclick="irPacienteVista(\'citas-agendadas\')"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4H14C14.55 4 15 4.45 15 5V16C15 16.55 14.55 17 14 17H6C5.45 17 5 16.55 5 16V5C5 4.45 5.45 4 6 4Z"/><path d="M8 8H12M8 11H12M8 14H10"/><path d="M12 2V5M8 2V5"/></svg> Ver Mis Citas</button>' +
            '<button class="btn btn-secondary" onclick="irPacienteVista(\'datos-personales\')">👤 Mis Datos</button>' +
            '<button class="btn btn-secondary" onclick="irPacienteVista(\'historial-medico\')"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 16.5C10 16.5 3 12 3 7C3 5.34 4.34 4 6 4C7.33 4 8.47 4.83 9 6C9.53 4.83 10.67 4 12 4C13.66 4 15 5.34 15 7C15 12 10 16.5 10 16.5Z"/></svg> Historial Médico</button>' +
            '<button class="btn btn-secondary" onclick="irPacienteVista(\'mis-recetas\')"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14.24 5.76C15.58 7.1 15.58 9.27 14.24 10.62L10.62 14.24C9.27 15.58 7.1 15.58 5.76 14.24C4.42 12.9 4.42 10.73 5.76 9.38L9.38 5.76C10.73 4.42 12.9 4.42 14.24 5.76Z"/><line x1="7.1" y1="7.1" x2="12.9" y2="12.9"/></svg> Mis Recetas</button>' +
            '<button class="btn btn-secondary" onclick="irPacienteVista(\'farmacia-paciente\')"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6H17L15.5 16H4.5L3 6Z"/><path d="M1 3H19"/><circle cx="7.5" cy="18.5" r="1"/><circle cx="12.5" cy="18.5" r="1"/></svg> Farmacia</button>' +
          '</div>' +
        '</div>' +

        '</div>';
}

function irPacienteVista(vista) {
    document.querySelectorAll('.nav-item:not(.logout-btn)').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-view="${vista}"]`)?.classList.add('active');
    loadView(vista);
}

/* ── DATOS PERSONALES ─────────────────────────────── */
async function renderDatosPersonales(container, _token) {
    if (_stale(_token)) return;
    const [perfil, misCitas] = await Promise.all([paciente.obtenerPerfil(), citas.obtenerMisCitas()]);
    STATE.perfil = perfil; STATE.citas = misCitas;
    const prog = misCitas.filter(c => ['agendada_pendiente_pago','pagada_pendiente_atender'].includes(c.Estatus)).length;
    const comp = misCitas.filter(c => c.Estatus === 'atendida').length;
    const canc = misCitas.filter(c => (c.Estatus||'').startsWith('cancelada')).length;
    container.innerHTML = `<div class="view-content">
      <div class="stats-grid">
        <div class="info-card stat-card"><div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8H17M7 3V5M13 3V5"/></svg></div><div class="stat-value">${prog}</div><div class="stat-label">Citas Programadas</div></div>
        <div class="info-card stat-card"><div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M7 10L9 12L13 8"/></svg></div><div class="stat-value">${comp}</div><div class="stat-label">Citas Completadas</div></div>
        <div class="info-card stat-card"><div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M8 8L12 12M12 8L8 12"/></svg></div><div class="stat-value">${canc}</div><div class="stat-label">Citas Canceladas</div></div>
        <div class="info-card stat-card"><div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4H14C14.55 4 15 4.45 15 5V16C15 16.55 14.55 17 14 17H6C5.45 17 5 16.55 5 16V5C5 4.45 5.45 4 6 4Z"/><path d="M8 8H12M8 11H12M8 14H10"/><path d="M12 2V5M8 2V5"/></svg></div><div class="stat-value">${misCitas.length}</div><div class="stat-label">Total de Citas</div></div>
      </div>
      <div class="info-grid">
        <div class="info-card">
          <div class="info-header"><h3>Información Personal</h3>
            <span style="font-size:.75rem;color:var(--text-secondary);padding:.2rem .55rem;background:var(--bg-secondary,#f1f5f9);border-radius:6px">🔒 Solo lectura</span>
          </div>
          <div class="info-body">
            ${ir('Nombre Completo', `${perfil.Nombre} ${perfil.Ap_Paterno} ${perfil.Ap_Materno||''}`)}
            ${ir('CURP', perfil.CURP)}
            ${ir('Fecha Nac.', utils.formatearFecha(perfil.Fecha_Nac))}
            ${ir('Edad', `${perfil.Edad} años`)}
          </div>
        </div>
        <div class="info-card">
          <div class="info-header"><h3>Datos de Contacto</h3>
            <button class="btn-icon btn-sm" onclick="abrirModalEditar()">✏️ Editar</button>
          </div>
          <div class="info-body">
            ${ir('Email',    perfil.Email     || '—')}
            ${ir('Teléfono', perfil.Telefono  || '—')}
            ${ir('Calle',    perfil.Calle     || '—')}
            ${ir('Número',   perfil.Numero    || '—')}
            ${ir('Colonia',  perfil.Colonia   || '—')}
          </div>
        </div>
      </div></div>`;
}

function abrirModalEditar() {
    const p = STATE.perfil;
    abrirModal('Editar Datos de Contacto', `
      <p style="font-size:.82rem;color:var(--text-secondary);margin-bottom:1rem">
        Los datos de identidad (nombre, CURP, fecha de nacimiento) solo pueden modificarse
        acudiendo a recepción. Aquí puedes actualizar tu información de contacto.
      </p>
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label>Email</label>
          <input id="e-email" type="email" value="${p.Email||''}" placeholder="correo@ejemplo.com">
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input id="e-tel" value="${p.Telefono||''}" placeholder="10 dígitos">
        </div>
        <div class="form-group">
          <label>Calle</label>
          <input id="e-calle" value="${p.Calle||''}">
        </div>
        <div class="form-group">
          <label>Número</label>
          <input id="e-num" value="${p.Numero||''}">
        </div>
        <div class="form-group">
          <label>Colonia</label>
          <input id="e-col" value="${p.Colonia||''}">
        </div>
      </div>`,
        async () => {
            const email = document.getElementById('e-email').value.trim();
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                throw new Error('El formato del email no es válido.');
            }
            await paciente.actualizarPerfil({
                email:    email,
                telefono: document.getElementById('e-tel').value.trim(),
                calle:    document.getElementById('e-calle').value.trim(),
                numero:   document.getElementById('e-num').value.trim(),
                colonia:  document.getElementById('e-col').value.trim()
            });
            toast('Datos de contacto actualizados.', 'success');
            cerrarModal();
            loadView('datos-personales');
        }, 'Guardar Cambios');
}

/* ── CITAS AGENDADAS ──────────────────────────────── */
async function renderCitas(container, _token) {
    if (_stale(_token)) return;
    STATE.citas = await citas.obtenerMisCitas();
    dibujarTablaCitas(container, STATE.citas);
}

function dibujarTablaCitas(container, lista) {
    const filas = lista.length ? lista.map(c => `<tr>
        <td><strong>#${String(c.Folio_Cita).padStart(5,'0')}</strong></td>
        <td>${utils.formatearFecha(c.Fecha_Cita)}</td>
        <td>${utils.formatearHora(c.Hora_Cita)}</td>
        <td>${c.Especialidad}</td>
        <td>Dr. ${c.NombreDoctor} ${c.ApDocPat}</td>
        <td>${badgeEstatus(c.Estatus)}</td>
        <td>${c.Monto ? utils.formatearMoneda(c.Monto) : '—'}</td>
        <td style="display:flex;gap:.4rem;flex-wrap:wrap;">
          ${(['agendada_pendiente_pago','pagada_pendiente_atender'].includes(c.Estatus)) ? `<button class="btn btn-sm btn-danger" onclick="cancelarCitaUI(${c.Folio_Cita})">Cancelar</button>` : ''}
          ${c.Estatus==='agendada_pendiente_pago' ? `<button class="btn btn-sm btn-success" onclick="pagarCitaUI(${c.Folio_Cita})">Pagar</button>` : ''}
        </td></tr>`).join('') :
        `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 10H7L9 13H11L13 10H17"/><path d="M3 10V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V10L14.5 4H5.5L3 10Z"/></svg></div><h3>Sin citas</h3><p>No tienes citas aún.</p></div></td></tr>`;
    container.innerHTML = `<div class="view-content"><div class="table-container">
      <div class="table-header"><h3>Mis Citas</h3>
        <div class="table-filters">
          <input type="date" class="filter-input" id="f-fecha">
          <select class="filter-select" id="f-estatus">
            <option value="">Todos</option>
            <option value="agendada_pendiente_pago">Pend. Pago</option>
            <option value="pagada_pendiente_atender">Confirmada</option>
            <option value="atendida">Atendida</option>
            <option value="cancelada_paciente">Cancelada</option>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="filtrarCitas()">Filtrar</button>
        </div>
      </div>
      <table><thead><tr><th>Folio</th><th>Fecha</th><th>Hora</th><th>Especialidad</th><th>Doctor</th><th>Estatus</th><th>Monto</th><th>Acciones</th></tr></thead>
      <tbody>${filas}</tbody></table></div></div>`;
}

async function filtrarCitas() {
    const fecha = document.getElementById('f-fecha')?.value;
    const est   = document.getElementById('f-estatus')?.value;
    const f = {};
    if (fecha) { f.fecha_inicio = fecha; f.fecha_fin = fecha; }
    if (est)   f.estatus = est;
    const container = document.getElementById('contentContainer');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    STATE.citas = await citas.obtenerMisCitas(f);
    dibujarTablaCitas(container, STATE.citas);
}

async function cancelarCitaUI(folio) {
    abrirModal('Cancelar Cita', `
      <p>¿Cancelar la cita <strong>#${String(folio).padStart(5,'0')}</strong>?</p>
      <p style="margin-top:.5rem;font-size:.9rem;color:var(--text-secondary)">La devolución aplica según política de cancelación.</p>
      <div class="form-group" style="margin-top:1rem"><label>Motivo (opcional)</label><input id="c-motivo" placeholder="Motivo..."></div>`,
        async () => {
            const res = await citas.cancelarCita(folio, document.getElementById('c-motivo').value);
            toast(`Cita cancelada. ${res.monto_devuelto > 0 ? 'Devolución: '+utils.formatearMoneda(res.monto_devuelto) : 'Sin devolución.'}`, 'success');
            cerrarModal(); loadView('citas-agendadas');
        }, 'Confirmar Cancelación', 'btn-danger');
}

async function pagarCitaUI(folio) {
    abrirModal('Confirmar Pago', `
      <p>Pagar cita <strong>#${String(folio).padStart(5,'0')}</strong></p>
      <div class="form-group" style="margin-top:1rem"><label>Método de Pago</label>
        <select id="p-metodo"><option value="Efectivo">Efectivo</option><option value="Tarjeta">Tarjeta</option><option value="Transferencia">Transferencia</option></select>
      </div>`,
        async () => {
            await citas.confirmarPago(folio, document.getElementById('p-metodo').value);
            toast('¡Pago confirmado!', 'success'); cerrarModal(); loadView('citas-agendadas');
        }, 'Confirmar Pago', 'btn-success');
}

/* ── AGENDAR CITA (4 pasos) ───────────────────────── */
async function renderAgendarCita(container, _token) {
    if (_stale(_token)) return;
    STATE.agendar = { paso: 1, especialidad: null, doctor: null, fecha: null, hora: null };
    if (!STATE.especialidades.length) STATE.especialidades = await especialidades.obtenerTodas();
    container.innerHTML = `<div class="view-content"><div class="form-container" id="agendar-container">
      <div class="steps-indicator" id="steps-bar"></div><div id="paso-content"></div></div></div>`;
    renderPaso(1);
}

function renderPaso(n) {
    STATE.agendar.paso = n;
    const pasos = ['Especialidad','Doctor','Fecha y Hora','Confirmar'];
    document.getElementById('steps-bar').innerHTML = pasos.map((l,i) => `
      <div class="step ${n>i+1?'done':n===i+1?'active':''}">
        <div class="step-num">${n>i+1?'✓':i+1}</div><span>${l}</span>
      </div>${i<pasos.length-1?'<div class="step-sep"></div>':''}`).join('');
    const c = document.getElementById('paso-content');
    [,renderPasoEsp,renderPasoDoc,renderPasoFH,renderPasoConfirmar][n](c);
}

function renderPasoEsp(c) {
    c.innerHTML = `<h3 style="margin-bottom:1.25rem">Selecciona la Especialidad</h3>
      <div class="esp-grid">${STATE.especialidades.map(e => `
        <div class="esp-card" data-id="${e.Id_Especialidad}" onclick="selEsp(this,${e.Id_Especialidad})">
          <div class="esp-name">${e.Especialidad}</div>
          <div class="esp-precio">${utils.formatearMoneda(e.Precio)}</div>
        </div>`).join('')}</div>
      <div class="form-actions" style="margin-top:1.5rem">
        <button class="btn btn-primary" id="btn-p2" onclick="renderPaso(2)" disabled>Siguiente →</button>
      </div>`;
    if (STATE.agendar.especialidad) {
        document.querySelector(`[data-id="${STATE.agendar.especialidad.Id_Especialidad}"]`)?.classList.add('selected');
        document.getElementById('btn-p2').disabled = false;
    }
}

function selEsp(el, id) {
    STATE.agendar.especialidad = STATE.especialidades.find(e => e.Id_Especialidad === id);
    STATE.agendar.doctor = null;
    document.querySelectorAll('.esp-card').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('btn-p2').disabled = false;
}

async function renderPasoDoc(c) {
    c.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    const docs = await especialidades.obtenerDoctores(STATE.agendar.especialidad.Id_Especialidad);
    c.innerHTML = `<h3 style="margin-bottom:1rem">Selecciona el Doctor</h3>
      <p style="color:var(--text-secondary);margin-bottom:1.25rem">Especialidad: <strong>${STATE.agendar.especialidad.Especialidad}</strong></p>
      <div class="doctor-grid">${docs.map(d => `
        <div class="doctor-card" data-doc='${JSON.stringify(d)}' onclick="selDoc(this)">
          <div class="doctor-avatar">${d.Nombre[0]}${d.Ap_Paterno[0]}</div>
          <div class="doctor-name">Dr. ${d.Nombre} ${d.Ap_Paterno}</div>
          <div class="doctor-meta">${d.Turno}</div>
          <div class="doctor-meta">${(d.Hora_inic||'').substring(0,5)} – ${(d.Hora_final||'').substring(0,5)}</div>
        </div>`).join('')}</div>
      <div class="form-actions" style="margin-top:1.5rem">
        <button class="btn btn-secondary" onclick="renderPaso(1)">← Anterior</button>
        <button class="btn btn-primary" id="btn-p3" onclick="renderPaso(3)" disabled>Siguiente →</button>
      </div>`;
    if (STATE.agendar.doctor) {
        document.querySelector(`[data-doc*='"Id_Doctor":${STATE.agendar.doctor.Id_Doctor}']`)?.classList.add('selected');
        document.getElementById('btn-p3').disabled = false;
    }
}

function selDoc(el) {
    STATE.agendar.doctor = JSON.parse(el.dataset.doc);
    STATE.agendar.hora = null;
    document.querySelectorAll('.doctor-card').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('btn-p3').disabled = false;
}

async function renderPasoFH(c) {
    const doc = STATE.agendar.doctor;
    const hoy = new Date();
    const minF = new Date(hoy.getTime() + 48*3600000);
    const maxF = new Date(hoy.getTime() + 90*24*3600000);
    const fmt  = d => d.toISOString().split('T')[0];
    c.innerHTML = `<h3 style="margin-bottom:1rem">Fecha y Hora</h3>
      <p style="color:var(--text-secondary);margin-bottom:1.25rem">Dr. ${doc.Nombre} ${doc.Ap_Paterno} · ${(doc.Hora_inic||'').substring(0,5)}–${(doc.Hora_final||'').substring(0,5)}</p>
      <div class="form-grid">
        <div class="form-group"><label>Fecha</label>
          <input type="date" id="fecha-cita" min="${fmt(minF)}" max="${fmt(maxF)}" value="${STATE.agendar.fecha||''}" onchange="cargarSlots()">
        </div>
        <div class="form-group"><label>Horarios Disponibles</label>
          <div class="slots-grid" id="slots-container"><span style="color:var(--text-secondary);font-size:.9rem">Selecciona una fecha.</span></div>
        </div>
      </div>
      <div class="form-actions" style="margin-top:1.5rem">
        <button class="btn btn-secondary" onclick="renderPaso(2)">← Anterior</button>
        <button class="btn btn-primary" id="btn-p4" onclick="renderPaso(4)" ${STATE.agendar.fecha&&STATE.agendar.hora?'':'disabled'}>Siguiente →</button>
      </div>`;
    if (STATE.agendar.fecha) await cargarSlots();
}

async function cargarSlots() {
    const fecha = document.getElementById('fecha-cita')?.value;
    if (!fecha) return;
    STATE.agendar.fecha = fecha; STATE.agendar.hora = null;
    const sc = document.getElementById('slots-container');
    sc.innerHTML = '<div class="spinner" style="width:22px;height:22px;border-width:2px"></div>';
    const doc  = STATE.agendar.doctor;
    const info = await citas.obtenerHorariosDisponibles(doc.Id_Doctor, fecha, fecha);
    const ocupados = new Set((info.fechas_ocupadas||[]).map(([,h]) => (h||'').substring(0,5)));
    const hi = doc.Hora_inic, hf = doc.Hora_final;
    const toMin = s => { const [h,m] = (s||'00:00').substring(0,5).split(':').map(Number); return h*60+m; };
    const slots = [];
    for (let m = toMin(hi); m < toMin(hf); m += 30) {
        const hh = String(Math.floor(m/60)).padStart(2,'0'), mm = String(m%60).padStart(2,'0');
        slots.push(`${hh}:${mm}`);
    }
    sc.innerHTML = slots.map(s => `
      <button class="slot-btn ${ocupados.has(s)?'busy':''} ${STATE.agendar.hora===s?'selected':''}"
        ${ocupados.has(s)?'disabled':''} onclick="selSlot(this,'${s}')">${s}</button>`).join('') ||
        '<span style="color:var(--text-secondary)">Sin horarios disponibles.</span>';
}

function selSlot(el, h) {
    STATE.agendar.hora = h;
    document.querySelectorAll('.slot-btn').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    const b = document.getElementById('btn-p4');
    if (b) b.disabled = false;
}

function renderPasoConfirmar(c) {
    const { especialidad: esp, doctor: doc, fecha, hora } = STATE.agendar;
    c.innerHTML = `<h3 style="margin-bottom:1.25rem">Confirmar Cita</h3>
      <div class="comprobante">
        <div class="comprobante-header"><h2>MediConnect</h2><p style="color:var(--text-secondary);font-size:.9rem">Pre-comprobante</p></div>
        ${cr('Especialidad', esp.Especialidad)}
        ${cr('Doctor', `Dr. ${doc.Nombre} ${doc.Ap_Paterno}`)}
        ${cr('Fecha', utils.formatearFecha(fecha))}
        ${cr('Hora', hora)}
        ${cr('Costo', utils.formatearMoneda(esp.Precio))}
        <div class="comprobante-aviso"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M10 6V10L13 12"/></svg> Tendrás <strong>8 horas</strong> para realizar el pago. Sin pago, la cita se cancelará automáticamente.</div>
      </div>
      <div class="form-actions" style="margin-top:1.5rem">
        <button class="btn btn-secondary" onclick="renderPaso(3)">← Anterior</button>
        <button class="btn btn-primary" onclick="confirmarCita()">✓ Agendar Cita</button>
      </div>`;
}

async function confirmarCita() {
    const { especialidad: esp, doctor: doc, fecha, hora } = STATE.agendar;
    try {
        const res = await citas.agendarCita({ id_doctor: doc.Id_Doctor, fecha_cita: fecha, hora_cita: hora });
        document.getElementById('agendar-container').innerHTML = `
          <div class="comprobante">
            <div class="comprobante-header"><div style="font-size:2.5rem;margin-bottom:.5rem">🎉</div><h2>¡Cita Agendada!</h2>
              <p style="color:var(--text-secondary)">Folio #${String(res.folio_cita).padStart(5,'0')}</p></div>
            ${cr('Doctor', res.doctor)} ${cr('Especialidad', esp.Especialidad)}
            ${cr('Fecha', utils.formatearFecha(fecha))} ${cr('Hora', hora)} ${cr('Monto', utils.formatearMoneda(res.monto))}
            <div class="comprobante-aviso"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M10 6V10L13 12"/></svg> ${res.aviso_pago}</div>
            <div style="margin-top:1rem;font-size:.82rem;color:var(--text-secondary)">
              Política cancelación: 48h+ → 100% · 24h → 50% · &lt;24h → 0%
            </div>
          </div>
          <div class="form-actions" style="margin-top:1.5rem">
            <button class="btn btn-secondary" onclick="loadView('agendar-cita')">Nueva Cita</button>
            <button class="btn btn-primary" onclick="irACitas()">Ver Mis Citas →</button>
          </div>`;
        toast('¡Cita agendada exitosamente!', 'success');
    } catch (err) { toast(err.message, 'error'); }
}

function irACitas() {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-view="citas-agendadas"]')?.classList.add('active');
    loadView('citas-agendadas');
}

/* ── FARMACIA (PACIENTE) ─────────────────────────── */

// Estado del carrito — vive en memoria mientras la vista esté activa
let _carrito = [];

async function renderFarmaciaPaciente(container, _token) {
    if (_stale(_token)) return;
    _carrito = [];

    const [catalogo, solicitudes] = await Promise.all([
        farmacia.catalogo(),
        farmacia.misSolicitudes()
    ]);
    const meds  = catalogo.medicamentos || [];
    const servs = catalogo.servicios    || [];

    container.innerHTML = `<div class="view-content">

      <!-- Aviso informativo -->
      <div style="background:#e8f5f4;border-left:4px solid var(--primary,#2D5F5D);
                  border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.5rem;
                  display:flex;gap:.75rem;align-items:flex-start">
        <span style="color:var(--primary)"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="7" width="14" height="11" rx="1"/><path d="M1 7L10 2L19 7"/><path d="M10 10V15M7.5 12.5H12.5"/></svg></span>
        <div style="font-size:.88rem;color:#334155;line-height:1.5">
          <strong style="color:#2D5F5D">¿Cómo funciona?</strong><br>
          Agrega productos o servicios a tu carrito y envía la solicitud.
          La recepcionista la revisará y procesará tu compra. Puedes
          ver el estado de tus solicitudes en la sección inferior.
        </div>
      </div>

      <!-- Tabs catálogo -->
      <div style="display:flex;gap:.5rem;margin-bottom:1.25rem;flex-wrap:wrap">
        <button class="tab-btn active" data-tab="cat-meds"
                onclick="switchCatTab('cat-meds')"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14.24 5.76C15.58 7.1 15.58 9.27 14.24 10.62L10.62 14.24C9.27 15.58 7.1 15.58 5.76 14.24C4.42 12.9 4.42 10.73 5.76 9.38L9.38 5.76C10.73 4.42 12.9 4.42 14.24 5.76Z"/><line x1="7.1" y1="7.1" x2="12.9" y2="12.9"/></svg> Medicamentos (${meds.length})</button>
        <button class="tab-btn" data-tab="cat-servs"
                onclick="switchCatTab('cat-servs')"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="7" width="14" height="11" rx="1"/><path d="M1 7L10 2L19 7"/><path d="M10 10V15M7.5 12.5H12.5"/></svg> Servicios (${servs.length})</button>
        <button class="tab-btn" data-tab="cat-hist"
                onclick="switchCatTab('cat-hist')"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4H14C14.55 4 15 4.45 15 5V16C15 16.55 14.55 17 14 17H6C5.45 17 5 16.55 5 16V5C5 4.45 5.45 4 6 4Z"/><path d="M8 8H12M8 11H12M8 14H10"/><path d="M12 2V5M8 2V5"/></svg> Mis Solicitudes (${solicitudes.length})</button>
      </div>

      <!-- Panel Medicamentos -->
      <div id="cat-meds">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem">
          ${meds.length ? meds.map(m => `
            <div class="info-card" style="gap:.5rem">
              <div style="color:var(--primary)"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14.24 5.76C15.58 7.1 15.58 9.27 14.24 10.62L10.62 14.24C9.27 15.58 7.1 15.58 5.76 14.24C4.42 12.9 4.42 10.73 5.76 9.38L9.38 5.76C10.73 4.42 12.9 4.42 14.24 5.76Z"/><line x1="7.1" y1="7.1" x2="12.9" y2="12.9"/></svg></div>
              <div>
                <div style="font-weight:700;font-size:.95rem">${m.Nombre}</div>
                ${m.Descripcion ? `<div style="font-size:.8rem;color:var(--text-secondary)">${m.Descripcion}</div>` : ''}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;
                          border-top:1px solid var(--border);padding-top:.5rem;margin-top:.25rem">
                <strong style="color:var(--primary,#2D5F5D)">$${parseFloat(m.Precio).toFixed(2)}</strong>
                <span style="font-size:.75rem;color:var(--text-secondary)">${m.Unidad}</span>
              </div>
              <button class="btn btn-secondary btn-sm" style="width:100%"
                      onclick="agregarAlCarrito('farmacia',${m.Id_Farmacia},'${m.Nombre.replace(/'/g,"\\'")}',${m.Precio},'${m.Unidad}')">
                + Agregar
              </button>
            </div>`).join('') :
            '<p style="color:var(--text-secondary)">Sin medicamentos disponibles.</p>'}
        </div>
      </div>

      <!-- Panel Servicios -->
      <div id="cat-servs" style="display:none">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem">
          ${servs.length ? servs.map(s => `
            <div class="info-card" style="gap:.5rem">
              <div style="color:var(--primary)"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="7" width="14" height="11" rx="1"/><path d="M1 7L10 2L19 7"/><path d="M10 10V15M7.5 12.5H12.5"/></svg></div>
              <div>
                <div style="font-weight:700;font-size:.95rem">${s.Nombre}</div>
                ${s.Descripcion ? `<div style="font-size:.8rem;color:var(--text-secondary)">${s.Descripcion}</div>` : ''}
              </div>
              <div style="border-top:1px solid var(--border);padding-top:.5rem;margin-top:.25rem">
                <strong style="color:var(--primary,#2D5F5D)">$${parseFloat(s.Precio).toFixed(2)}</strong>
              </div>
              <button class="btn btn-secondary btn-sm" style="width:100%"
                      onclick="agregarAlCarrito('servicio',${s.Id_Servicio},'${s.Nombre.replace(/'/g,"\\'")}',${s.Precio},'')">
                + Agregar
              </button>
            </div>`).join('') :
            '<p style="color:var(--text-secondary)">Sin servicios disponibles.</p>'}
        </div>
      </div>

      <!-- Panel Mis Solicitudes -->
      <div id="cat-hist" style="display:none">
        ${solicitudes.length ? `
        <div class="table-container">
          <table>
            <thead><tr>
              <th>Folio</th><th>Fecha</th><th>Total</th><th>Estatus</th><th>Procesada por</th>
            </tr></thead>
            <tbody>
              ${solicitudes.map(s => `<tr>
                <td>#${String(s.Id_Solicitud).padStart(4,'0')}</td>
                <td>${utils.formatearFecha(s.Fecha_Solicitud)}</td>
                <td><strong>$${parseFloat(s.Total).toFixed(2)}</strong></td>
                <td><span class="badge ${s.Estatus==='Pendiente'?'badge-warning':s.Estatus==='Procesada'?'badge-success':'badge-error'}">
                  ${s.Estatus}</span></td>
                <td>${s.NombreRecep ? `${s.NombreRecep} ${s.ApRecep}` : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` :
        '<div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6H17L15.5 16H4.5L3 6Z"/><path d="M1 3H19"/><circle cx="7.5" cy="18.5" r="1"/><circle cx="12.5" cy="18.5" r="1"/></svg></div><h3>Sin solicitudes</h3><p>Aún no has enviado ninguna solicitud.</p></div>'}
      </div>

      <!-- Carrito flotante -->
      <div id="carrito-panel" style="display:none;position:fixed;bottom:1.5rem;right:1.5rem;
           width:320px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);
           border:1.5px solid var(--border);z-index:1000;padding:1.25rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
          <strong><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6H17L15.5 16H4.5L3 6Z"/><path d="M1 3H19"/><circle cx="7.5" cy="18.5" r="1"/><circle cx="12.5" cy="18.5" r="1"/></svg> Carrito</strong>
          <button onclick="cerrarCarrito()" style="background:none;border:none;font-size:1.1rem;cursor:pointer">✕</button>
        </div>
        <div id="carrito-items" style="max-height:220px;overflow-y:auto;margin-bottom:.75rem"></div>
        <div style="border-top:1px solid var(--border);padding-top:.75rem">
          <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:.75rem">
            <span>Total</span><span id="carrito-total">$0.00</span>
          </div>
          <button class="btn btn-primary" style="width:100%" onclick="enviarSolicitud()">
            📤 Enviar solicitud
          </button>
        </div>
      </div>

      <!-- Botón flotante carrito -->
      <button id="carrito-fab" onclick="toggleCarrito()"
              style="display:none;position:fixed;bottom:1.5rem;right:1.5rem;
                     width:56px;height:56px;border-radius:50%;background:var(--primary,#2D5F5D);
                     color:#fff;border:none;font-size:1.4rem;cursor:pointer;
                     box-shadow:0 4px 16px rgba(45,95,93,.4);z-index:999">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6H17L15.5 16H4.5L3 6Z"/><path d="M1 3H19"/><circle cx="7.5" cy="18.5" r="1"/><circle cx="12.5" cy="18.5" r="1"/></svg><span id="carrito-count"
               style="position:absolute;top:2px;right:2px;background:#ef4444;color:#fff;
                      border-radius:50%;width:18px;height:18px;font-size:.7rem;
                      display:flex;align-items:center;justify-content:center;font-weight:700">0</span>
      </button>

    </div>`;
}

function switchCatTab(tab) {
    ['cat-meds','cat-servs','cat-hist'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === tab ? '' : 'none';
    });
    document.querySelectorAll('.tab-btn[data-tab]').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === tab));
}

function agregarAlCarrito(tipo, id, nombre, precio, unidad) {
    const existente = _carrito.find(i => i.tipo === tipo && i.id === id);
    if (existente) {
        existente.cantidad++;
        existente.subtotal = parseFloat((existente.precio * existente.cantidad).toFixed(2));
    } else {
        _carrito.push({ tipo, id, nombre, precio: parseFloat(precio), unidad, cantidad: 1,
                        subtotal: parseFloat(precio) });
    }
    actualizarCarritoUI();
    mostrarCarrito();
    toast(`"${nombre}" agregado al carrito.`, 'success');
}

function actualizarCarritoUI() {
    const items   = document.getElementById('carrito-items');
    const totalEl = document.getElementById('carrito-total');
    const countEl = document.getElementById('carrito-count');
    const fab     = document.getElementById('carrito-fab');
    if (!items) return;

    const total = _carrito.reduce((s, i) => s + i.subtotal, 0);
    if (totalEl)  totalEl.textContent  = `$${total.toFixed(2)}`;
    if (countEl)  countEl.textContent  = _carrito.reduce((s, i) => s + i.cantidad, 0);
    if (fab)      fab.style.display    = _carrito.length ? 'flex' : 'none';

    items.innerHTML = _carrito.length ? _carrito.map((item, idx) => `
      <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;
                  border-bottom:1px solid var(--border)">
        <div style="flex:1;font-size:.85rem">
          <div style="font-weight:600">${item.nombre}</div>
          <div style="color:var(--text-secondary);font-size:.78rem">
            $${item.precio.toFixed(2)} ${item.unidad ? '/ ' + item.unidad : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.25rem">
          <button onclick="cambiarCantidad(${idx},-1)"
                  style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border);
                         background:none;cursor:pointer;font-size:.9rem">−</button>
          <span style="min-width:18px;text-align:center;font-size:.85rem">${item.cantidad}</span>
          <button onclick="cambiarCantidad(${idx},1)"
                  style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border);
                         background:none;cursor:pointer;font-size:.9rem">+</button>
          <button onclick="quitarDelCarrito(${idx})"
                  style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:.9rem;margin-left:.25rem">✕</button>
        </div>
      </div>`).join('') :
      '<p style="text-align:center;color:var(--text-secondary);font-size:.85rem;padding:.5rem 0">Carrito vacío</p>';
}

function cambiarCantidad(idx, delta) {
    _carrito[idx].cantidad += delta;
    if (_carrito[idx].cantidad <= 0) { _carrito.splice(idx, 1); }
    else { _carrito[idx].subtotal = parseFloat((_carrito[idx].precio * _carrito[idx].cantidad).toFixed(2)); }
    actualizarCarritoUI();
}
function quitarDelCarrito(idx) { _carrito.splice(idx, 1); actualizarCarritoUI(); }

function mostrarCarrito() {
    const panel = document.getElementById('carrito-panel');
    const fab   = document.getElementById('carrito-fab');
    if (panel) { panel.style.display = 'block'; if (fab) fab.style.display = 'none'; }
}
function cerrarCarrito() {
    const panel = document.getElementById('carrito-panel');
    const fab   = document.getElementById('carrito-fab');
    if (panel) panel.style.display = 'none';
    if (fab && _carrito.length) fab.style.display = 'flex';
}
function toggleCarrito() {
    const panel = document.getElementById('carrito-panel');
    if (!panel) return;
    panel.style.display === 'none' ? mostrarCarrito() : cerrarCarrito();
}

async function enviarSolicitud() {
    if (!_carrito.length) { toast('El carrito está vacío.', 'error'); return; }
    try {
        const res = await farmacia.crearSolicitud({
            items: _carrito.map(i => ({ tipo: i.tipo, id: i.id, cantidad: i.cantidad }))
        });
        toast(`Solicitud #${String(res.id_solicitud).padStart(4,'0')} enviada. La recepcionista la procesará pronto.`, 'success');
        _carrito = [];
        actualizarCarritoUI();
        cerrarCarrito();
        loadView('farmacia-paciente');
    } catch (e) {
        toast(e.message || 'Error al enviar la solicitud.', 'error');
    }
}

/* ── MIS RECETAS ──────────────────────────────────── */
async function renderMisRecetas(container, _token) {
    if (_stale(_token)) return;
    const recetas = await paciente.obtenerMisRecetas();

    if (!recetas || recetas.length === 0) {
        container.innerHTML =
            '<div class="view-content">' +
              '<div class="empty-state">' +
                '<div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14.24 5.76C15.58 7.1 15.58 9.27 14.24 10.62L10.62 14.24C9.27 15.58 7.1 15.58 5.76 14.24C4.42 12.9 4.42 10.73 5.76 9.38L9.38 5.76C10.73 4.42 12.9 4.42 14.24 5.76Z"/><line x1="7.1" y1="7.1" x2="12.9" y2="12.9"/></svg></div>' +
                '<h3>Sin recetas</h3>' +
                '<p>Aún no tienes recetas médicas emitidas.</p>' +
              '</div>' +
            '</div>';
        return;
    }

    // Una tarjeta por receta con opción de expandir el detalle
    const tarjetas = recetas.map((r, idx) => {
        const folio       = String(r.Folio_Cita).padStart(5, '0');
        const idReceta    = String(r.Id_Receta).padStart(5, '0');
        const fechaEmit   = utils.formatearFecha(r.FechaEmision);
        const fechaCita   = utils.formatearFecha(r.Fecha_Cita);
        const hora        = utils.formatearHora(r.Hora_Cita);
        const doctor      = `Dr. ${r.NombreDoctor} ${r.ApPaternoDoctor}`;
        const cedula      = r.Cedula_prof  || '—';
        const especialidad = r.Especialidad || '—';
        const medicamento = (r.Medicamento   || '').replace(/\n/g, '<br>');
        const tratamiento = (r.Tratamiento   || '').replace(/\n/g, '<br>');
        const obs         = (r.Observaciones || '').replace(/\n/g, '<br>');

        return (
            '<div class="info-card" style="margin-bottom:1rem">' +

              // ── Cabecera siempre visible ──────────────────────────
              '<div class="info-header" style="cursor:pointer;user-select:none" ' +
                   'onclick="toggleReceta(' + idx + ')">' +
                '<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">' +
                  '<span style="color:var(--primary)"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14.24 5.76C15.58 7.1 15.58 9.27 14.24 10.62L10.62 14.24C9.27 15.58 7.1 15.58 5.76 14.24C4.42 12.9 4.42 10.73 5.76 9.38L9.38 5.76C10.73 4.42 12.9 4.42 14.24 5.76Z"/><line x1="7.1" y1="7.1" x2="12.9" y2="12.9"/></svg></span>' +
                  '<div>' +
                    '<div style="font-weight:700">Receta #' + idReceta + '</div>' +
                    '<div style="font-size:.85rem;color:var(--text-secondary)">' +
                      'Emitida el ' + fechaEmit + ' · ' + especialidad +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<span id="receta-chevron-' + idx + '" ' +
                      'style="font-size:1.1rem;transition:transform .2s">▼</span>' +
              '</div>' +

              // ── Cuerpo desplegable ────────────────────────────────
              '<div id="receta-body-' + idx + '" ' +
                   'style="display:none;padding:1rem 0 0">' +

                // Datos del médico y cita
                '<div class="info-grid" style="margin-bottom:1rem">' +
                  '<div>' +
                    ir('Doctor', doctor) +
                    ir('Cédula Profesional', cedula) +
                    ir('Especialidad', especialidad) +
                  '</div>' +
                  '<div>' +
                    ir('Cita #', '#' + folio) +
                    ir('Fecha de Consulta', fechaCita + ' ' + hora) +
                    ir('Emisión de Receta', fechaEmit) +
                  '</div>' +
                '</div>' +

                // Contenido médico
                '<div style="border-top:1px solid var(--border);padding-top:1rem;display:grid;gap:.75rem">' +

                  '<div>' +
                    '<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;' +
                         'letter-spacing:.06em;color:var(--text-secondary);margin-bottom:.35rem">' +
                      'Medicamento(s)' +
                    '</div>' +
                    '<div style="background:var(--bg-secondary,#f8f9fa);border-radius:8px;' +
                         'padding:.75rem 1rem;font-size:.9rem;line-height:1.6">' +
                      medicamento +
                    '</div>' +
                  '</div>' +

                  '<div>' +
                    '<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;' +
                         'letter-spacing:.06em;color:var(--text-secondary);margin-bottom:.35rem">' +
                      'Tratamiento' +
                    '</div>' +
                    '<div style="background:var(--bg-secondary,#f8f9fa);border-radius:8px;' +
                         'padding:.75rem 1rem;font-size:.9rem;line-height:1.6">' +
                      tratamiento +
                    '</div>' +
                  '</div>' +

                  (obs ?
                    '<div>' +
                      '<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;' +
                           'letter-spacing:.06em;color:var(--text-secondary);margin-bottom:.35rem">' +
                        'Observaciones' +
                      '</div>' +
                      '<div style="background:var(--bg-secondary,#f8f9fa);border-radius:8px;' +
                           'padding:.75rem 1rem;font-size:.9rem;line-height:1.6">' +
                        obs +
                      '</div>' +
                    '</div>'
                  : '') +

                '</div>' +
              '</div>' + // receta-body

            '</div>'    // info-card
        );
    }).join('');

    container.innerHTML =
        '<div class="view-content">' +
          '<div style="margin-bottom:1rem;display:flex;align-items:center;' +
               'justify-content:space-between;flex-wrap:wrap;gap:.5rem">' +
            '<p style="color:var(--text-secondary);font-size:.9rem">' +
              recetas.length + ' receta' + (recetas.length !== 1 ? 's' : '') + ' emitida' +
              (recetas.length !== 1 ? 's' : '') +
            '</p>' +
            '<button class="btn btn-secondary btn-sm" onclick="expandirTodasRecetas(' + recetas.length + ')">' +
              'Expandir todas' +
            '</button>' +
          '</div>' +
          tarjetas +
        '</div>';
}

// Alterna la visibilidad de una receta individual
function toggleReceta(idx) {
    const body    = document.getElementById('receta-body-' + idx);
    const chevron = document.getElementById('receta-chevron-' + idx);
    if (!body) return;
    const abierto = body.style.display !== 'none';
    body.style.display    = abierto ? 'none' : 'block';
    chevron.style.transform = abierto ? '' : 'rotate(180deg)';
}

// Expande o colapsa todas las recetas a la vez
function expandirTodasRecetas(total) {
    const body0 = document.getElementById('receta-body-0');
    const expandir = body0 && body0.style.display === 'none';
    for (let i = 0; i < total; i++) {
        const body    = document.getElementById('receta-body-' + i);
        const chevron = document.getElementById('receta-chevron-' + i);
        if (body)    body.style.display      = expandir ? 'block' : 'none';
        if (chevron) chevron.style.transform = expandir ? 'rotate(180deg)' : '';
    }
}

/* ── HISTORIAL MÉDICO ─────────────────────────────── */
async function renderHistorialMedico(container, _token) {
    if (_stale(_token)) return;
    if (!STATE.citas.length) STATE.citas = await citas.obtenerMisCitas();
    const hm = await paciente.obtenerHistorialMedico();
    const imc = hm ? calcIMC(hm.Peso, hm.Estatura) : '—';
    const atendidas = STATE.citas.filter(c => c.Estatus === 'atendida');
    container.innerHTML = `<div class="view-content">
      <div class="info-grid">
        <div class="info-card">
          <div class="info-header"><h3>Datos de Salud</h3></div>
          <div class="info-body">
            ${hm ? ir('Tipo de Sangre', hm.Tipo_sangre) + ir('Peso', hm.Peso+' kg') + ir('Estatura', hm.Estatura+' m') + ir('IMC', imc) : '<p style="color:var(--text-secondary)">Sin historial médico registrado aún.</p>'}
          </div>
        </div>
        <div class="info-card">
          <div class="info-header"><h3>Antecedentes</h3></div>
          <div class="info-body">
            ${hm ? ir('Alergias', hm.Alergias||'Ninguna reportada') + ir('Padecimientos', hm.Padecimientos||'Ninguno reportado') : '<p style="color:var(--text-secondary)">Sin información.</p>'}
          </div>
        </div>
      </div>
      <div class="table-container">
        <div class="table-header"><h3>Consultas Atendidas</h3></div>
        <table><thead><tr><th>Fecha</th><th>Doctor</th><th>Especialidad</th></tr></thead>
        <tbody>${atendidas.length ? atendidas.map(c => `<tr>
            <td>${utils.formatearFecha(c.Fecha_Cita)}</td>
            <td>Dr. ${c.NombreDoctor} ${c.ApDocPat}</td>
            <td>${c.Especialidad}</td></tr>`).join('') :
            `<tr><td colspan="3"><div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4H14C14.55 4 15 4.45 15 5V16C15 16.55 14.55 17 14 17H6C5.45 17 5 16.55 5 16V5C5 4.45 5.45 4 6 4Z"/><path d="M8 8H12M8 11H12M8 14H10"/><path d="M12 2V5M8 2V5"/></svg></div><h3>Sin consultas atendidas</h3></div></td></tr>`}
        </tbody></table>
      </div></div>`;
}

function calcIMC(peso, estatura) {
    if (!peso||!estatura) return '—';
    const v = (peso/(estatura*estatura)).toFixed(1);
    const c = v<18.5?'Bajo peso':v<25?'Normal':v<30?'Sobrepeso':'Obesidad';
    return `${v} (${c})`;
}

/* ── MODAL ────────────────────────────────────────── */
function abrirModal(titulo, body, onOk, btnTxt='Guardar', btnCls='btn-primary') {
    cerrarModal();
    const o = document.createElement('div'); o.className='modal-overlay'; o.id='active-modal';
    o.innerHTML = `<div class="modal">
      <div class="modal-header"><h3>${titulo}</h3><button class="modal-close" onclick="cerrarModal()">×</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button class="btn ${btnCls}" id="modal-ok">${btnTxt}</button>
      </div></div>`;
    document.body.appendChild(o);
    document.getElementById('modal-ok').addEventListener('click', async () => {
        const btn = document.getElementById('modal-ok');
        btn.disabled=true; btn.textContent='Procesando…';
        try { await onOk(); } catch(e) { toast(e.message,'error'); btn.disabled=false; btn.textContent=btnTxt; }
    });
    o.addEventListener('click', e => { if(e.target===o) cerrarModal(); });
}
function cerrarModal() { document.getElementById('active-modal')?.remove(); }

/* ── TOASTS ───────────────────────────────────────── */
function toast(msg, type='info') {
    const icons={success:`<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 10L8 14L16 6"/></svg>`,error:`<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 5L15 15M15 5L5 15"/></svg>`,warning:`<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 3L18 17H2L10 3Z"/><path d="M10 10V13M10 15.5V16"/></svg>`,info:`<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M10 9V14M10 7V7.5"/></svg>`};
    const el=document.createElement('div'); el.className=`toast ${type}`;
    el.innerHTML=`<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span><button class="toast-x" onclick="this.parentElement.remove()">×</button>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(()=>{ el.style.animation='toastOut .3s ease forwards'; setTimeout(()=>el.remove(),300); },4500);
}

/* ── HELPERS ──────────────────────────────────────── */
const ir = (l,v)=>`<div class="info-row"><span class="label">${l}</span><span class="value">${v??'—'}</span></div>`;
const cr = (l,v)=>`<div class="comprobante-row"><span>${l}</span><strong>${v}</strong></div>`;
function badgeEstatus(clave) {
    const m={'agendada_pendiente_pago':['warning','Pend. Pago'],'pagada_pendiente_atender':['info','Confirmada'],'cancelada_falta_pago':['error','Canc. Pago'],'cancelada_paciente':['error','Cancelada'],'cancelada_doctor':['error','Canc. Doctor'],'atendida':['success','Atendida'],'no_acudio':['neutral','— No Acudió']};
    const [c,t]=m[clave]||['neutral',clave];
    return `<span class="badge badge-${c}">${t}</span>`;
}

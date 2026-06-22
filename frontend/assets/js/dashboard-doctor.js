/**
 * Dashboard Doctor – MediConnect
 * Completamente funcional con llamadas reales al backend Flask.
 */

const STATE = { user: null, perfil: null, misCitas: [], misPacientes: [], misRecetas: [] };

// Guarda contra cargas concurrentes: si el usuario hace clic varias
// veces antes de que termine una carga, solo se aplica la última.
let _loadingView = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = auth.getCurrentUser();
    if (!user || user.rol !== 'doctor') { window.location.href = '/pages/auth/login.html'; return; }
    STATE.user = user;
    document.getElementById('userName').textContent = `Dr. ${user.nombre} ${user.ap_paterno}`;
    document.getElementById('userInitials').textContent = (user.nombre[0]+user.ap_paterno[0]).toUpperCase();
    if (!document.getElementById('toast-container')) {
        const tc=document.createElement('div'); tc.id='toast-container'; document.body.appendChild(tc);
    }
    document.querySelectorAll('.nav-item:not(.logout-btn)').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.nav-item:not(.logout-btn)').forEach(n=>n.classList.remove('active'));
            this.classList.add('active'); loadView(this.dataset.view);
        });
    });
    document.getElementById('logoutBtn').addEventListener('click', ()=>{ if(confirm('¿Cerrar sesión?')) auth.logout(); });
    loadView('inicio');
});

const VIEWS = {
    'inicio':       { title:'Inicio',                  subtitle:'Bienvenido a tu panel médico' },
    'datos-doctor': { title:'Mis Datos Profesionales', subtitle:'Información del doctor' },
    'citas':        { title:'Mis Citas',               subtitle:'Gestiona las citas de tus pacientes' },
    'pacientes':    { title:'Mis Pacientes',            subtitle:'Lista de pacientes atendidos' },
    'recetas':      { title:'Recetas Médicas',          subtitle:'Crea y consulta recetas' },
};

async function loadView(viewName) {
    // Registrar cual es la vista mas reciente solicitada.
    // Si durante la carga llega otra solicitud, esta queda obsoleta y no escribe en el DOM.
    const myToken = Symbol(viewName);
    _loadingView  = myToken;

    const container = document.getElementById('contentContainer');
    const info = VIEWS[viewName]||{};
    document.getElementById('pageTitle').textContent    = info.title    || viewName;
    document.getElementById('pageSubtitle').textContent = info.subtitle || '';
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
        switch(viewName) {
            case 'inicio':       await renderInicio(container, myToken);       break;
            case 'datos-doctor': await renderDatosDoctor(container, myToken);  break;
            case 'citas':        await renderCitas(container, myToken);         break;
            case 'pacientes':    await renderPacientes(container, myToken);     break;
            case 'recetas':      await renderRecetas(container, myToken);       break;
        }
    } catch(err) {
        if (_loadingView === myToken) {
            container.innerHTML=`<div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 3L18 17H2L10 3Z"/><path d="M10 10V13M10 15.5V16"/></svg></div><h3>Error</h3><p>${err.message}</p></div>`;
        }
    }
}

// Helper interno: retorna true si esta carga ya fue superada por una mas reciente.
function _stale(token) { return _loadingView !== token; }

/* ── INICIO / BIENVENIDA ──────────────────────────── */
async function renderInicio(container, _token) {
    // Cargar perfil y citas de forma segura
    let perfil = null, citasHoy = 0, citasPend = 0, htmlProxima = '';

    // Llamadas en paralelo para mayor velocidad
    const [perfilResult, citasResult] = await Promise.allSettled([
        doctor.obtenerPerfil(),
        citas.obtenerMisCitas()
    ]);

    if (perfilResult.status === 'fulfilled') {
        perfil = perfilResult.value;
        STATE.perfil = perfil;
    } else { console.warn('[Doc/Inicio] Perfil:', perfilResult.reason?.message); }

    // Guard: si el usuario navegó a otra vista mientras cargaba, abortar
    if (_stale(_token)) return;

    try {
        const todasCitas = citasResult.status === 'fulfilled'
            ? citasResult.value
            : (()=>{ console.warn('[Doc/Inicio] Citas:', citasResult.reason?.message); return []; })();
        STATE.misCitas = Array.isArray(todasCitas) ? todasCitas : [];
        const hoy = new Date().toISOString().split('T')[0];
        citasHoy  = STATE.misCitas.filter(c => (c.Fecha_Cita||'').startsWith(hoy)).length;
        citasPend = STATE.misCitas.filter(c => c.Estatus === 'pagada_pendiente_atender').length;

        const proximas = STATE.misCitas
            .filter(c => c.Estatus === 'pagada_pendiente_atender')
            .sort((a,b) => new Date(a.Fecha_Cita) - new Date(b.Fecha_Cita));
        const p = proximas[0] || null;

        if (p) {
            const fecha  = utils.formatearFecha(p.Fecha_Cita || '');
            const hora   = utils.formatearHora(p.Hora_Cita   || '');
            const pac    = (p.NombrePaciente || '') + ' ' + (p.ApPaternoPaciente || '');
            const esp    = p.Especialidad || '—';
            htmlProxima =
                '<div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap">' +
                  '<div style="font-size:2.5rem">🗓️</div>' +
                  '<div>' +
                    '<div style="font-size:1.1rem;font-weight:700;color:var(--primary)">' + fecha + ' a las ' + hora + '</div>' +
                    '<div style="color:var(--text-secondary);margin-top:.25rem">Paciente: ' + pac.trim() + ' · ' + esp + '</div>' +
                  '</div>' +
                '</div>';
        }
    } catch(e) { console.warn('[Doc/Inicio] Citas:', e.message); }

    // Guard final antes de escribir en el DOM
    if (_stale(_token)) return;

    if (!htmlProxima) {
        htmlProxima =
            '<div style="text-align:center;padding:1.5rem 0">' +
              '<div class="empty-icon"><svg width="25" height="25" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 10H7L9 13H11L13 10H17"/><path d="M3 10V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V10L14.5 4H5.5L3 10Z"/></svg></div>' +
              '<p style="color:var(--text-secondary)">No tienes citas programadas próximamente.</p>' +
            '</div>';
    }

    const user   = STATE.user;
    const h      = new Date().getHours();
    const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const espNom = perfil ? (perfil.Especialidad || '') : '';
    const turno  = perfil ? (perfil.Turno || '')        : '';

    // ── Agenda de hoy (lista de citas) ──────────────────────────────
    const hoy = new Date().toISOString().split('T')[0];
    const citasHoyLista = STATE.misCitas
        .filter(c => (c.Fecha_Cita||'').startsWith(hoy))
        .sort((a,b) => (a.Hora_Cita||'').localeCompare(b.Hora_Cita||''));

    let htmlAgenda;
    if (citasHoyLista.length) {
        htmlAgenda = '<div class="flex flex-col gap-2">' +
            citasHoyLista.slice(0, 5).map(c => {
                const pac  = ((c.NombrePaciente||'') + ' ' + (c.ApPaternoPaciente||'')).trim();
                const hora = utils.formatearHora(c.Hora_Cita || '');
                const badge = badgeEstatus(c.Estatus || '');
                return '<div class="flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-3 py-2.5">' +
                    '<div class="flex items-center gap-3 min-w-0">' +
                      '<div class="text-xs font-bold flex-shrink-0" style="color:var(--brand-600);font-family:\'Playfair Display\',serif;min-width:52px">' + hora + '</div>' +
                      '<div class="text-sm font-medium text-slate-700 truncate">' + (pac || 'Paciente') + '</div>' +
                    '</div>' +
                    '<div class="flex-shrink-0">' + badge + '</div>' +
                  '</div>';
            }).join('') +
        '</div>';
        if (citasHoyLista.length > 5) {
            htmlAgenda += '<button class="btn btn-secondary btn-sm mt-3 w-full" onclick="irDoctorVista(\'citas\')">Ver las ' + citasHoyLista.length + ' citas de hoy</button>';
        }
    } else {
        htmlAgenda =
            '<div class="text-center py-4">' +
              '<div class="empty-icon"><svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 10H7L9 13H11L13 10H17"/><path d="M3 10V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V10L14.5 4H5.5L3 10Z"/></svg></div>' +
              '<p class="text-sm" style="color:var(--muted)">No tienes citas programadas para hoy.</p>' +
            '</div>';
    }

    // ── Mini ficha profesional ──────────────────────────────────────
    let htmlFicha;
    if (perfil) {
        htmlFicha =
            '<div class="grid grid-cols-2 gap-3">' +
              '<div class="rounded-xl bg-brand-50 p-3">' +
                '<div class="text-xs text-slate-500 font-medium mb-1">Cédula Prof.</div>' +
                '<div class="text-sm font-bold text-slate-800">' + (perfil.Cedula_prof || '—') + '</div>' +
              '</div>' +
              '<div class="rounded-xl bg-brand-50 p-3">' +
                '<div class="text-xs text-slate-500 font-medium mb-1">Especialidad</div>' +
                '<div class="text-sm font-bold text-slate-800 truncate">' + (espNom || '—') + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="mt-3 text-sm text-slate-600 leading-relaxed">' +
              '<span class="font-semibold text-slate-800">Horario:</span> ' +
              (perfil.Hora_inic ? perfil.Hora_inic.substring(0,5) : '—') + ' – ' + (perfil.Hora_final ? perfil.Hora_final.substring(0,5) : '—') +
              (turno ? ' · Turno ' + turno : '') +
            '</div>';
    } else {
        htmlFicha = '<p class="text-sm text-slate-500">No se pudo cargar tu información profesional.</p>';
    }

    container.innerHTML =
        '<div class="view-content">' +

        // ── Banner ───────────────────────────────────────────────────
        '<div class="info-card" style="margin-bottom:1.5rem;background:linear-gradient(135deg,var(--primary) 0%,var(--primary-light) 100%);border:none">' +
          '<div class="flex items-center justify-between gap-4 flex-wrap">' +
            '<div style="display:flex;align-items:center;gap:1.25rem;flex-wrap:wrap">' +
              '<div style="color:var(--gold-400)"><svg width="32" height="32" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="14" cy="14" r="2.5"/><path d="M6 4V9C6 11.21 7.79 13 10 13H11.5"/><path d="M4 4H8M6 2V6"/></svg></div>' +
              '<div>' +
                '<h2 style="font-size:1.5rem;font-family:\'Playfair Display\',serif;color:#fff;margin-bottom:.25rem">' +
                  saludo + ', Dr. ' + user.nombre + ' ' + user.ap_paterno +
                '</h2>' +
                '<p style="color:rgba(255,255,255,.75);font-size:.95rem">' +
                  (espNom ? espNom + (turno ? ' · Turno ' + turno : '') : 'Panel médico — MediConnect') +
                '</p>' +
              '</div>' +
            '</div>' +
            '<button class="btn" style="background:var(--gold-400);color:var(--brand-700);flex-shrink:0" onclick="irDoctorVista(\'recetas\')">' +
              '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 3H15C15.55 3 16 3.45 16 4V16C16 16.55 15.55 17 15 17H5C4.45 17 4 16.55 4 16V4C4 3.45 4.45 3 5 3Z"/><path d="M7 10H13M7 13H11M7 7H13"/></svg> Emitir Receta' +
            '</button>' +
          '</div>' +
        '</div>' +

        // ── Stats compactas ──────────────────────────────────────────
        '<div class="stats-grid-sm">' +
          '<div class="stat-card-sm">' +
            '<div class="stat-icon-sm"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8H17M7 3V5M13 3V5"/></svg></div>' +
            '<div class="stat-info"><div class="stat-value-sm">' + citasHoy + '</div><div class="stat-label-sm">Citas Hoy</div></div>' +
          '</div>' +
          '<div class="stat-card-sm">' +
            '<div class="stat-icon-sm"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 3H15M5 17H15"/><path d="M6 3C6 3 6 8 10 10C14 12 14 17 14 17"/><path d="M14 3C14 3 14 8 10 10C6 12 6 17 6 17"/></svg></div>' +
            '<div class="stat-info"><div class="stat-value-sm">' + citasPend + '</div><div class="stat-label-sm">Pendientes</div></div>' +
          '</div>' +
          '<div class="stat-card-sm">' +
            '<div class="stat-icon-sm"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M7 10L9 12L13 8"/></svg></div>' +
            '<div class="stat-info"><div class="stat-value-sm">' + (STATE.misCitas.filter(c => c.Estatus === 'atendida').length) + '</div><div class="stat-label-sm">Atendidas</div></div>' +
          '</div>' +
          '<div class="stat-card-sm">' +
            '<div class="stat-icon-sm"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 9C7.1 9 8 8.1 8 7C8 5.9 7.1 5 6 5C4.9 5 4 5.9 4 7C4 8.1 4.9 9 6 9Z"/><path d="M14 9C15.1 9 16 8.1 16 7C16 5.9 15.1 5 14 5C12.9 5 12 5.9 12 7C12 8.1 12.9 9 14 9Z"/><path d="M2 14C2 11.79 3.79 10 6 10C8.21 10 10 11.79 10 14M12 14C12 11.79 13.79 10 16 10C18.21 10 20 11.79 20 14"/></svg></div>' +
            '<div class="stat-info"><div class="stat-value-sm">' +
              new Set(STATE.misCitas.map(c => c.Id_Paciente)).size +
            '</div><div class="stat-label-sm">Pacientes</div></div>' +
          '</div>' +
        '</div>' +

        // ── Layout dos columnas ─────────────────────────────────────
        '<div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6 items-start">' +

          // Columna izquierda (2/3): próxima cita + accesos rápidos
          '<div class="lg:col-span-2 flex flex-col gap-5">' +

            '<div class="info-card">' +
              '<div class="info-header"><h3>Próxima Cita Programada</h3></div>' +
              '<div class="info-body" style="margin-top:.5rem">' + htmlProxima + '</div>' +
            '</div>' +

            '<div>' +
              '<div class="section-heading"><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M11 2L3 11H9L9 18L17 9H11L11 2Z"/></svg> Accesos Rápidos</div>' +
              '<div class="quick-actions-grid">' +

                '<div class="quick-action-tile" onclick="irDoctorVista(\'citas\')">' +
                  (citasPend > 0 ? '<span class="qa-badge">' + citasPend + '</span>' : '') +
                  '<div class="qa-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8H17M7 3V5M13 3V5"/></svg></div>' +
                  '<div><div class="qa-title">Mis Citas</div><div class="qa-desc">Agenda y estatus de tus consultas</div></div>' +
                '</div>' +

                '<div class="quick-action-tile" onclick="irDoctorVista(\'pacientes\')">' +
                  '<div class="qa-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 9C7.1 9 8 8.1 8 7C8 5.9 7.1 5 6 5C4.9 5 4 5.9 4 7C4 8.1 4.9 9 6 9Z"/><path d="M14 9C15.1 9 16 8.1 16 7C16 5.9 15.1 5 14 5C12.9 5 12 5.9 12 7C12 8.1 12.9 9 14 9Z"/><path d="M2 14C2 11.79 3.79 10 6 10C8.21 10 10 11.79 10 14M12 14C12 11.79 13.79 10 16 10C18.21 10 20 11.79 20 14"/></svg></div>' +
                  '<div><div class="qa-title">Mis Pacientes</div><div class="qa-desc">Consulta historial y datos</div></div>' +
                '</div>' +

                '<div class="quick-action-tile" onclick="irDoctorVista(\'recetas\')">' +
                  '<div class="qa-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 3H15C15.55 3 16 3.45 16 4V16C16 16.55 15.55 17 15 17H5C4.45 17 4 16.55 4 16V4C4 3.45 4.45 3 5 3Z"/><path d="M7 10H13M7 13H11M7 7H13"/></svg></div>' +
                  '<div><div class="qa-title">Emitir Receta</div><div class="qa-desc">Crea una receta electrónica</div></div>' +
                '</div>' +

                '<div class="quick-action-tile" onclick="irDoctorVista(\'datos-doctor\')">' +
                  '<div class="qa-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="7" r="3"/><path d="M4 16C4 12.69 6.69 10 10 10C13.31 10 16 12.69 16 16"/></svg></div>' +
                  '<div><div class="qa-title">Mi Perfil</div><div class="qa-desc">Información profesional y horario</div></div>' +
                '</div>' +

              '</div>' +
            '</div>' +

          '</div>' +

          // Columna derecha (1/3): agenda de hoy + ficha profesional
          '<div class="flex flex-col gap-5">' +

            '<div class="info-card">' +
              '<div class="info-header"><h3>Agenda de Hoy</h3></div>' +
              '<div class="info-body" style="margin-top:.5rem">' + htmlAgenda + '</div>' +
            '</div>' +

            '<div class="info-card">' +
              '<div class="info-header"><h3>Ficha Profesional</h3></div>' +
              '<div class="info-body" style="margin-top:.5rem">' + htmlFicha + '</div>' +
            '</div>' +

            '<div class="rounded-2xl p-5" style="background:var(--gold-50);border:1px solid var(--gold-200)">' +
              '<div class="flex items-center gap-2 mb-2">' +
                '<div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:var(--gold-400);color:var(--brand-700)">' +
                  '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 3H15C15.55 3 16 3.45 16 4V16C16 16.55 15.55 17 15 17H5C4.45 17 4 16.55 4 16V4C4 3.45 4.45 3 5 3Z"/><path d="M7 10H13M7 13H11M7 7H13"/></svg>' +
                '</div>' +
                '<div class="font-semibold text-sm" style="color:var(--brand-700)">Recuerda</div>' +
              '</div>' +
              '<p class="text-sm leading-relaxed" style="color:var(--brand-700)">' +
                'Para cancelar una cita debes enviar una solicitud a recepción; ellos procesarán el reembolso correspondiente.' +
              '</p>' +
            '</div>' +

          '</div>' +

        '</div>' +

        '</div>';
}

function irDoctorVista(vista) {
    document.querySelectorAll('.nav-item:not(.logout-btn)').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-view="' + vista + '"]')?.classList.add('active');
    loadView(vista);
}

/* ── DATOS DOCTOR ─────────────────────────────────── */
async function renderDatosDoctor(container, _token) {
    if (_stale(_token)) return;

    // Se piden perfil, citas, pacientes y recetas en paralelo en lugar de
    // depender de que el usuario ya haya visitado antes las vistas
    // "Mis Citas", "Pacientes" o "Recetas" (que son las que normalmente
    // llenan STATE.misCitas/misPacientes/misRecetas). Así los contadores
    // de esta tarjeta siempre muestran datos reales desde la primera vez
    // que se entra a "Mi Perfil", sin necesidad de recargar la página.
    const [perfilResult, citasResult, pacientesResult, recetasResult] = await Promise.allSettled([
        doctor.obtenerPerfil(),
        citas.obtenerMisCitas(),
        doctor.obtenerPacientes(),
        doctor.listarRecetas()
    ]);

    if (_stale(_token)) return;

    if (perfilResult.status !== 'fulfilled') {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 3L18 17H2L10 3Z"/><path d="M10 10V13M10 15.5V16"/></svg></div><h3>Error</h3><p>No se pudo cargar tu perfil.</p></div>`;
        return;
    }
    const p = perfilResult.value;
    STATE.perfil = p;

    if (citasResult.status === 'fulfilled')     STATE.misCitas     = Array.isArray(citasResult.value) ? citasResult.value : [];
    if (pacientesResult.status === 'fulfilled') STATE.misPacientes = Array.isArray(pacientesResult.value) ? pacientesResult.value : [];
    if (recetasResult.status === 'fulfilled')   STATE.misRecetas   = Array.isArray(recetasResult.value) ? recetasResult.value : [];

    const citasHoy = STATE.misCitas.filter(c => c.Fecha_Cita === new Date().toISOString().split('T')[0]).length;
    container.innerHTML = `<div class="view-content">
      <div class="stats-grid">
        <div class="info-card stat-card"><div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="14" cy="14" r="2.5"/><path d="M6 4V9C6 11.21 7.79 13 10 13H11.5"/><path d="M4 4H8M6 2V6"/></svg></div><div class="stat-value">${citasHoy}</div><div class="stat-label">Citas Hoy</div></div>
        <div class="info-card stat-card"><div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 9C7.1 9 8 8.1 8 7C8 5.9 7.1 5 6 5C4.9 5 4 5.9 4 7C4 8.1 4.9 9 6 9Z"/><path d="M14 9C15.1 9 16 8.1 16 7C16 5.9 15.1 5 14 5C12.9 5 12 5.9 12 7C12 8.1 12.9 9 14 9Z"/><path d="M2 14C2 11.79 3.79 10 6 10C8.21 10 10 11.79 10 14M12 14C12 11.79 13.79 10 16 10C18.21 10 20 11.79 20 14"/></svg></div><div class="stat-value">${STATE.misPacientes.length}</div><div class="stat-label">Pacientes</div></div>
        <div class="info-card stat-card"><div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4H14C14.55 4 15 4.45 15 5V16C15 16.55 14.55 17 14 17H6C5.45 17 5 16.55 5 16V5C5 4.45 5.45 4 6 4Z"/><path d="M8 8H12M8 11H12M8 14H10"/><path d="M12 2V5M8 2V5"/></svg></div><div class="stat-value">${STATE.misRecetas.length}</div><div class="stat-label">Recetas Emitidas</div></div>
        <div class="info-card stat-card"><div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M10 6V10L13 12"/></svg></div><div class="stat-value">${p.Turno||'—'}</div><div class="stat-label">Turno Laboral</div></div>
      </div>
      <div class="info-grid">
        <div class="info-card">
          <div class="info-header"><h3>Datos Profesionales</h3>
            <span style="font-size:.8rem;color:var(--text-secondary);border:1px solid var(--border);padding:.2rem .6rem;border-radius:6px">🔒 No editable</span>
          </div>
          <div class="info-body">
            ${ir('Nombre Completo', `Dr. ${p.Nombre} ${p.Ap_Paterno} ${p.Ap_Materno||''}`)}
            ${ir('CURP',            p.CURP)}
            ${ir('Cédula Prof.',    p.Cedula_prof)}
            ${ir('Especialidad',    p.Especialidad)}
            ${ir('RFC',             p.RFC)}
            ${ir('Núm. Empleado',   p.Id_Doctor)}
          </div>
        </div>
        <div class="info-card">
          <div class="info-header"><h3>Horario y Contacto</h3></div>
          <div class="info-body">
            ${ir('Email',     p.Email)}
            ${ir('Teléfono',  p.Telefono||'—')}
            ${ir('Turno',     p.Turno)}
            ${ir('Entrada',   (p.Hora_inic||'').substring(0,5))}
            ${ir('Salida',    (p.Hora_final||'').substring(0,5))}
            ${ir('Estatus',   `<span class="badge badge-success">${p.Estatus_empleado}</span>`)}
          </div>
        </div>
      </div>
      <div class="info-card" style="margin-bottom:1rem">
        <div class="info-header"><h3>Solicitar Cancelación de Cita</h3></div>
        <div class="info-body">
          <p style="color:var(--text-secondary);font-size:.9rem;margin-bottom:1rem">Para cancelar una cita debes solicitar aprobación de la recepcionista.</p>
          <button class="btn btn-danger btn-sm" onclick="loadView('citas')">Ver Citas para Solicitar</button>
        </div>
      </div>
    </div>`;
}

/* ── CITAS ────────────────────────────────────────── */
async function renderCitas(container, _token) {
    if (_stale(_token)) return;
    STATE.misCitas = await citas.obtenerMisCitas();
    dibujarTablaCitas(container, STATE.misCitas);
}

function dibujarTablaCitas(container, lista) {
    const filas = lista.length ? lista.map(c => {
        const esCancelada = (c.Estatus||'').startsWith('cancelada');
        const monto = c.MontoPago
            ? utils.formatearMoneda(c.MontoPago)
            : (c.PrecioEspecialidad ? utils.formatearMoneda(c.PrecioEspecialidad) : '—');
        let reembolsoCell;
        if (esCancelada) {
            const dev = parseFloat(c.MontoDevuelto || 0);
            if (dev > 0)
                reembolsoCell = `<span style="color:#166534;font-weight:700">${utils.formatearMoneda(dev)}</span>`;
            else if (c.MontoPago && parseFloat(c.MontoPago) > 0)
                reembolsoCell = `<span style="color:#991b1b;font-size:.8rem">Sin reembolso</span>`;
            else
                reembolsoCell = `<span style="color:#94a3b8;font-size:.8rem">—</span>`;
        } else {
            reembolsoCell = `<span style="color:#94a3b8;font-size:.8rem">—</span>`;
        }
        return `<tr>
            <td><strong>#${String(c.Folio_Cita).padStart(5,'0')}</strong></td>
            <td>${utils.formatearFecha(c.Fecha_Cita)}</td>
            <td>${utils.formatearHora(c.Hora_Cita)}</td>
            <td>${c.NombrePaciente||''} ${c.ApPaternoPaciente||''}</td>
            <td>${c.Especialidad||'—'}</td>
            <td>${badgeEstatus(c.Estatus)}</td>
            <td>${monto}</td>
            <td>${c.MetodoPago
                ? `<span class="badge badge-neutral" style="font-size:.72rem">${c.MetodoPago}</span>`
                : '<span style="color:#94a3b8;font-size:.8rem">—</span>'}</td>
            <td>${reembolsoCell}</td>
            <td style="display:flex;gap:.35rem;flex-wrap:wrap">
              ${c.SolicitudCancelacionPendiente ? `
                <span class="badge badge-warning" style="font-size:.72rem" title="Esperando aprobación de la recepcionista">⏳ Cancelación solicitada</span>
              ` : `
                ${c.Estatus==='pagada_pendiente_atender'?`
                  <button class="btn btn-sm btn-success" onclick="atenderCitaUI(${c.Folio_Cita})">✓ Atendida</button>
                  <button class="btn btn-sm btn-secondary" onclick="noAcudioUI(${c.Folio_Cita})">No acudió</button>
                  <button class="btn btn-sm" onclick="crearRecetaModal(${c.Folio_Cita},'${c.NombrePaciente} ${c.ApPaternoPaciente}')">📄 Receta</button>
                `:''}
                ${['agendada_pendiente_pago','pagada_pendiente_atender'].includes(c.Estatus)?`
                  <button class="btn btn-sm btn-danger" onclick="solicitarCancelUI(${c.Folio_Cita})">Solicitar Canc.</button>
                `:''}
              `}
            </td>
        </tr>`;
    }).join('') :
    `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 10H7L9 13H11L13 10H17"/><path d="M3 10V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V10L14.5 4H5.5L3 10Z"/></svg></div><h3>Sin citas</h3></div></td></tr>`
    container.innerHTML = `<div class="view-content"><div class="table-container">
      <div class="table-header"><h3>Mis Citas</h3>
        <div class="table-filters">
          <input type="date" class="filter-input" id="f-fecha">
          <select class="filter-select" id="f-est">
            <option value="">Todos</option>
            <option value="pagada_pendiente_atender">Confirmadas</option>
            <option value="atendida">Atendidas</option>
            <option value="agendada_pendiente_pago">Pend. Pago</option>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="filtrarCitas()">Filtrar</button>
        </div>
      </div>
      <div style="overflow-x:auto"><table style="min-width:1100px"><thead><tr><th>Folio</th><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Especialidad</th><th>Estatus</th><th>Monto</th><th title="Cómo pagó el paciente">Método Pago</th><th title="Monto reembolsado">Reembolso</th><th>Acciones</th></tr></thead>
      <tbody>${filas}</tbody></table></div></div></div>`;
}

async function filtrarCitas() {
    const fecha = document.getElementById('f-fecha')?.value;
    const est   = document.getElementById('f-est')?.value;
    const f={};
    if (fecha) { f.fecha_inicio=fecha; f.fecha_fin=fecha; }
    if (est)   f.estatus=est;
    const container=document.getElementById('contentContainer');
    container.innerHTML='<div class="loading-spinner"><div class="spinner"></div></div>';
    STATE.misCitas = await citas.obtenerMisCitas(f);
    dibujarTablaCitas(container, STATE.misCitas);
}

async function atenderCitaUI(folio) {
    if (!confirm(`¿Marcar la cita #${String(folio).padStart(5,'0')} como atendida?`)) return;
    try {
        await citas.marcarAtendida(folio);
        toast('Cita marcada como atendida.','success');
        loadView('citas');
    } catch(e) { toast(e.message,'error'); }
}

async function noAcudioUI(folio) {
    if (!confirm(`¿Marcar que el paciente no acudió a la cita #${String(folio).padStart(5,'0')}?`)) return;
    try {
        await citas.marcarNoAcudio(folio);
        toast('Cita marcada como "No Acudió".','success');
        loadView('citas');
    } catch(e) { toast(e.message,'error'); }
}

async function solicitarCancelUI(folio) {
    abrirModal('Solicitar Cancelación', `
      <p>Solicitar cancelación de la cita <strong>#${String(folio).padStart(5,'0')}</strong>.</p>
      <p style="font-size:.9rem;color:var(--text-secondary);margin-top:.5rem">La cancelación por doctor genera reembolso del 100% al paciente y requiere aprobación de la recepcionista.</p>
      <div class="form-group" style="margin-top:1rem"><label>Motivo (requerido)</label>
        <textarea id="m-motivo" placeholder="Describe el motivo de la cancelación..." style="min-height:80px"></textarea>
      </div>`,
        async () => {
            const motivo = document.getElementById('m-motivo').value.trim();
            if (!motivo) throw new Error('El motivo es requerido.');
            await doctor.solicitarCancelacion(folio, motivo);
            toast('Solicitud enviada a la recepcionista.','success');
            cerrarModal(); loadView('citas');
        }, 'Enviar Solicitud', 'btn-danger');
}

/* ── PACIENTES ────────────────────────────────────── */
async function renderPacientes(container, _token) {
    if (_stale(_token)) return;
    STATE.misPacientes = await doctor.obtenerPacientes();
    const filas = STATE.misPacientes.length ? STATE.misPacientes.map(p => {
        // La API ahora devuelve NombrePaciente (no Nombre) desde VW_CitasCompletas
        const nombre = `${p.NombrePaciente||p.Nombre||''} ${p.Ap_Paterno||''}${p.Ap_Materno ? ' '+p.Ap_Materno : ''}`.trim();
        return `<tr>
            <td><strong>${nombre}</strong></td>
            <td>${p.Email||'—'}</td>
            <td>${p.Telefono||'—'}</td>
            <td>${p.Edad != null ? p.Edad+' años' : '—'}</td>
            <td>${p.Tipo_sangre
                ? `<span class="badge badge-error" style="font-size:.75rem">${p.Tipo_sangre}</span>`
                : '<span style="color:#94a3b8;font-size:.8rem">—</span>'}</td>
            <td>${p.Alergias||'<span style="color:#94a3b8;font-size:.8rem">Ninguna</span>'}</td>
            <td style="display:flex;gap:.4rem;flex-wrap:wrap">
                <button class="btn btn-sm btn-secondary" onclick="verHistorialPaciente(${p.Id_Paciente},'${nombre.replace(/'/g,"\\'")}')">Ver Historial</button>
                <button class="btn btn-sm" onclick="editarHistorialModal(${p.Id_Paciente})">✏️ Editar</button>
            </td>
        </tr>`;
    }).join('') :
    `<tr><td colspan="7"><div class="empty-state">
        <div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 9C7.1 9 8 8.1 8 7C8 5.9 7.1 5 6 5C4.9 5 4 5.9 4 7C4 8.1 4.9 9 6 9Z"/><path d="M14 9C15.1 9 16 8.1 16 7C16 5.9 15.1 5 14 5C12.9 5 12 5.9 12 7C12 8.1 12.9 9 14 9Z"/><path d="M2 14C2 11.79 3.79 10 6 10C8.21 10 10 11.79 10 14M12 14C12 11.79 13.79 10 16 10C18.21 10 20 11.79 20 14"/></svg></div>
        <h3>Sin pacientes</h3>
        <p>Aún no tienes pacientes registrados (citas atendidas, activas o canceladas).</p>
    </div></td></tr>`;

    container.innerHTML = `<div class="view-content"><div class="table-container">
      <div class="table-header"><h3>Mis Pacientes</h3>
        <div class="table-filters">
          <input type="text" class="filter-input" id="dp-buscar" placeholder="Buscar paciente…" oninput="filtrarPacientesDoc()">
        </div>
      </div>
      <div style="overflow-x:auto">
      <table style="min-width:860px"><thead><tr>
        <th>Paciente</th><th>Email</th><th>Teléfono</th><th>Edad</th>
        <th>Tipo Sangre</th><th>Alergias</th><th>Acciones</th>
      </tr></thead>
      <tbody id="dp-tbody">${filas}</tbody></table>
      </div>
    </div></div>`;
}

function filtrarPacientesDoc() {
    const q = (document.getElementById('dp-buscar')?.value || '').toLowerCase();
    document.querySelectorAll('#dp-tbody tr').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

async function verHistorialPaciente(id, nombre) {
    const hm = await paciente.obtenerHistorial(id);
    const body = hm ? `
      <div class="info-body">
        ${ir('Tipo de Sangre', hm.Tipo_sangre)} ${ir('Estatura', hm.Estatura+' m')}
        ${ir('Peso', hm.Peso+' kg')} ${ir('Alergias', hm.Alergias||'Ninguna')}
        ${ir('Padecimientos', hm.Padecimientos||'Ninguno')}
      </div>` : '<p style="color:var(--text-secondary)">Sin historial médico registrado.</p>';
    abrirModal(`Historial de ${nombre}`, body, async () => cerrarModal(), 'Cerrar', 'btn-secondary');
}

async function editarHistorialModal(idPaciente) {
    let hm = null;
    try { hm = await paciente.obtenerHistorial(idPaciente); } catch {}
    abrirModal('Actualizar Historial Médico', `
      <div class="form-grid">
        <div class="form-group"><label>Tipo de Sangre</label>
          <select id="hm-ts">
            ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t=>`<option ${hm?.Tipo_sangre===t?'selected':''}>${t}</option>`).join('')}
          </select></div>
        <div class="form-group"><label>Peso (kg)</label><input id="hm-peso" type="number" step=".1" value="${hm?.Peso||''}"></div>
        <div class="form-group"><label>Estatura (m)</label><input id="hm-est" type="number" step=".01" value="${hm?.Estatura||''}"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Alergias</label><input id="hm-al" value="${hm?.Alergias||''}"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Padecimientos Previos</label><textarea id="hm-pad" style="min-height:60px">${hm?.Padecimientos||''}</textarea></div>
      </div>`,
        async () => {
            await paciente.actualizarHistorial(idPaciente, {
                tipo_sangre: document.getElementById('hm-ts').value,
                peso: parseFloat(document.getElementById('hm-peso').value),
                estatura: parseFloat(document.getElementById('hm-est').value),
                alergias: document.getElementById('hm-al').value,
                padecimientos: document.getElementById('hm-pad').value,
            });
            toast('Historial actualizado.','success'); cerrarModal();
        });
}

/* ── RECETAS ──────────────────────────────────────── */
async function renderRecetas(container, _token) {
    if (_stale(_token)) return;
    STATE.misRecetas = await doctor.listarRecetas();
    if (!STATE.misCitas.length) STATE.misCitas = await citas.obtenerMisCitas();
    const citasAtendibles = STATE.misCitas.filter(c => c.Estatus === 'pagada_pendiente_atender' && !c.SolicitudCancelacionPendiente);
    const filas = STATE.misRecetas.length ? STATE.misRecetas.map(r => `<tr>
        <td><strong>#${String(r.Id_Receta).padStart(5,'0')}</strong></td>
        <td>${utils.formatearFecha(r.FechaEmision)}</td>
        <td>${r.NombrePaciente} ${r.ApPaternoPaciente}</td>
        <td>${r.EdadPaciente} años</td>
        <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.Medicamento}</td>
        <td><button class="btn btn-sm btn-secondary" onclick="verRecetaModal(${r.Id_Receta})">Ver</button></td>
      </tr>`).join('') :
      `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14.24 5.76C15.58 7.1 15.58 9.27 14.24 10.62L10.62 14.24C9.27 15.58 7.1 15.58 5.76 14.24C4.42 12.9 4.42 10.73 5.76 9.38L9.38 5.76C10.73 4.42 12.9 4.42 14.24 5.76Z"/><line x1="7.1" y1="7.1" x2="12.9" y2="12.9"/></svg></div><h3>Sin recetas</h3></div></td></tr>`;
    container.innerHTML = `<div class="view-content">
      <div style="margin-bottom:1.5rem">
        <button class="btn btn-primary" onclick="crearRecetaModal()">+ Nueva Receta</button>
      </div>
      <div class="table-container">
        <div class="table-header"><h3>Mis Recetas Emitidas</h3></div>
        <table><thead><tr><th>Folio</th><th>Fecha</th><th>Paciente</th><th>Edad</th><th>Medicamento</th><th>Acciones</th></tr></thead>
        <tbody>${filas}</tbody></table>
      </div></div>`;
}

async function crearRecetaModal(folioPreselect, nombrePaciente) {
    if (!STATE.misCitas.length) STATE.misCitas = await citas.obtenerMisCitas();
    const atendibles = STATE.misCitas.filter(c => c.Estatus === 'pagada_pendiente_atender' && !c.SolicitudCancelacionPendiente);
    if (!atendibles.length) { toast('No tienes citas confirmadas para emitir receta.','warning'); return; }
    abrirModal('Nueva Receta Médica', `
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1"><label>Cita</label>
          <select id="r-cita">
            ${atendibles.map(c => `<option value="${c.Folio_Cita}" ${folioPreselect==c.Folio_Cita?'selected':''}>
              #${String(c.Folio_Cita).padStart(5,'0')} – ${c.NombrePaciente} ${c.ApPaternoPaciente} – ${utils.formatearFecha(c.Fecha_Cita)}
            </option>`).join('')}
          </select></div>
        <div class="form-group" style="grid-column:1/-1"><label>Diagnóstico / Medicamento(s)</label>
          <textarea id="r-med" placeholder="Paracetamol 500mg cada 8h, Ibuprofeno 400mg..." style="min-height:80px"></textarea></div>
        <div class="form-group" style="grid-column:1/-1"><label>Tratamiento</label>
          <textarea id="r-trat" placeholder="Reposo, hidratación, seguimiento en 7 días..." style="min-height:70px"></textarea></div>
        <div class="form-group" style="grid-column:1/-1"><label>Observaciones</label>
          <textarea id="r-obs" placeholder="Observaciones adicionales..." style="min-height:60px"></textarea></div>
      </div>`,
        async () => {
            const folio = parseInt(document.getElementById('r-cita').value);
            const med   = document.getElementById('r-med').value.trim();
            const trat  = document.getElementById('r-trat').value.trim();
            if (!med || !trat) throw new Error('Medicamento y tratamiento son requeridos.');
            await doctor.crearReceta({ folio_cita: folio, medicamento: med, tratamiento: trat, observaciones: document.getElementById('r-obs').value });
            toast('Receta emitida correctamente.','success'); cerrarModal(); loadView('recetas');
        }, 'Emitir Receta');
}

async function verRecetaModal(idReceta) {
    const r = STATE.misRecetas.find(x => x.Id_Receta === idReceta);
    if (!r) return;
    const p = STATE.perfil;
    abrirModal('Receta Médica', `
      <div class="comprobante">
        <div class="comprobante-header">
          <h2>Receta Médica</h2>
          <p style="font-size:.85rem;color:var(--text-secondary)">Folio #${String(r.Id_Receta).padStart(5,'0')}</p>
        </div>
        ${cr('Doctor',     `Dr. ${p?.Nombre||''} ${p?.Ap_Paterno||''}`)}
        ${cr('Cédula',     p?.Cedula_prof||'—')}
        ${cr('Fecha',      utils.formatearFecha(r.FechaEmision))}
        ${cr('Paciente',   `${r.NombrePaciente} ${r.ApPaternoPaciente}`)}
        ${cr('Edad',       `${r.EdadPaciente} años`)}
        <div style="margin-top:1rem">
          <p style="font-size:.85rem;font-weight:600;margin-bottom:.4rem">Medicamento(s)</p>
          <p style="font-size:.9rem">${r.Medicamento}</p>
        </div>
        <div style="margin-top:.75rem">
          <p style="font-size:.85rem;font-weight:600;margin-bottom:.4rem">Tratamiento</p>
          <p style="font-size:.9rem">${r.Tratamiento}</p>
        </div>
        ${r.Observaciones?`<div style="margin-top:.75rem">
          <p style="font-size:.85rem;font-weight:600;margin-bottom:.4rem">Observaciones</p>
          <p style="font-size:.9rem">${r.Observaciones}</p>
        </div>`:''}
      </div>`,
        async () => cerrarModal(), 'Cerrar', 'btn-secondary');
}

/* ── MODAL / TOAST ────────────────────────────────── */
function abrirModal(titulo, body, onOk, btnTxt='Guardar', btnCls='btn-primary') {
    cerrarModal();
    const o=document.createElement('div'); o.className='modal-overlay'; o.id='active-modal';
    o.innerHTML=`<div class="modal modal-lg"><div class="modal-header"><h3>${titulo}</h3>
      <button class="modal-close" onclick="cerrarModal()">×</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="cerrarModal()">Cancelar</button>
      <button class="btn ${btnCls}" id="modal-ok">${btnTxt}</button></div></div>`;
    document.body.appendChild(o);
    document.getElementById('modal-ok').addEventListener('click', async ()=>{
        const b=document.getElementById('modal-ok'); b.disabled=true; b.textContent='Procesando…';
        try { await onOk(); } catch(e) { toast(e.message,'error'); b.disabled=false; b.textContent=btnTxt; }
    });
    o.addEventListener('click', e=>{ if(e.target===o) cerrarModal(); });
}
function cerrarModal() { document.getElementById('active-modal')?.remove(); }

function toast(msg, type='info') {
    const icons={success:`<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 10L8 14L16 6"/></svg>`,error:`<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 5L15 15M15 5L5 15"/></svg>`,warning:`<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 3L18 17H2L10 3Z"/><path d="M10 10V13M10 15.5V16"/></svg>`,info:`<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M10 9V14M10 7V7.5"/></svg>`};
    const el=document.createElement('div'); el.className=`toast ${type}`;
    el.innerHTML=`<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span><button class="toast-x" onclick="this.parentElement.remove()">×</button>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(()=>{ el.style.animation='toastOut .3s ease forwards'; setTimeout(()=>el.remove(),300); },4500);
}

const ir = (l,v)=>`<div class="info-row"><span class="label">${l}</span><span class="value">${v??'—'}</span></div>`;
const cr = (l,v)=>`<div class="comprobante-row"><span>${l}</span><strong>${v}</strong></div>`;
function badgeEstatus(clave) {
    const m={'agendada_pendiente_pago':['warning','Pend. Pago'],'pagada_pendiente_atender':['info','Confirmada'],'cancelada_falta_pago':['error','Canc. Pago'],'cancelada_paciente':['error','Cancelada'],'cancelada_doctor':['error','Canc. Doctor'],'atendida':['success','Atendida'],'no_acudio':['neutral','No Acudio']};
    const [c,t]=m[clave]||['neutral',clave];
    return `<span class="badge badge-${c}">${t}</span>`;
}

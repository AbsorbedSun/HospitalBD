/**
 * Dashboard Recepcionista – MediConnect
 * Completamente funcional con llamadas reales al backend Flask.
 */

const STATE = { user: null, todasCitas: [], todosPacientes: [], todosDoctores: [], solicitudes: [] };

document.addEventListener('DOMContentLoaded', async () => {
    const user = auth.getCurrentUser();
    if (!user || !['recepcionista','admin'].includes(user.rol)) { window.location.href = '/pages/auth/login.html'; return; }
    STATE.user = user;
    document.getElementById('userName').textContent = `${user.nombre} ${user.ap_paterno}`;
    document.getElementById('userInitials').textContent = (user.nombre[0]+user.ap_paterno[0]).toUpperCase();
    if (!document.getElementById('toast-container')) {
        const tc=document.createElement('div'); tc.id='toast-container'; document.body.appendChild(tc);
    }

    // Navegación lateral
    document.querySelectorAll('.nav-item:not(.logout-btn)').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.nav-item:not(.logout-btn)').forEach(n => n.classList.remove('active'));
            this.classList.add('active');
            loadView(this.dataset.view);
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('¿Cerrar sesión?')) auth.logout();
    });

    // Cargar panel principal al entrar
    loadView('dashboard');
});

const VIEWS = {
    'dashboard':   { title:'Panel Principal',       subtitle:'Resumen del hospital' },
    'citas':       { title:'Gestión de Citas',      subtitle:'Todas las citas del hospital' },
    'pacientes':   { title:'Pacientes',             subtitle:'Gestión de pacientes' },
    'doctores':    { title:'Doctores',              subtitle:'Gestión del personal médico' },
    'farmacia':    { title:'Medicamentos y Servicios',  subtitle:'Inventario y ventas de mostrador' },
    'bitacoras':   { title:'Bitácoras',             subtitle:'Registro de auditoría del sistema' },
    'solicitudes': { title:'Solicitudes',           subtitle:'Cancelaciones pendientes de aprobación' },
    'mi-perfil':   { title:'Mi Perfil',             subtitle:'Tu información personal y laboral' },
};

/* ── Badge dinámico de Solicitudes en el sidebar ──── */
function actualizarBadgeSolicitudes(cantidad) {
    const navItem = document.querySelector('.nav-item[data-view="solicitudes"]');
    if (!navItem) return;
    let badge = navItem.querySelector('.nav-badge');
    if (cantidad > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'nav-badge';
            navItem.appendChild(badge);
        }
        badge.textContent = cantidad;
    } else if (badge) {
        badge.remove();
    }
}

/* ── Validación de fecha de nacimiento / edad ──────────────────── */
function calcularEdad(fechaNacStr) {
    if (!fechaNacStr) return null;
    const fechaNac = new Date(fechaNacStr + 'T00:00:00');
    if (isNaN(fechaNac.getTime())) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaFutura = fechaNac.getTime() > hoy.getTime();

    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mesActual = hoy.getMonth() - fechaNac.getMonth();
    if (mesActual < 0 || (mesActual === 0 && hoy.getDate() < fechaNac.getDate())) edad--;

    return { edad, fechaFutura };
}

/** Limita un <input type="date"> a un rango de edad razonable (0–120 años). */
function limitarFechaNacimiento(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const hoy = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    input.max = fmt(hoy);
    input.min = fmt(new Date(hoy.getFullYear() - 120, hoy.getMonth(), hoy.getDate()));
}

/**
 * Valida una fecha de nacimiento y lanza un Error con un mensaje
 * descriptivo si no cumple el rango permitido. `edadMinima` es opcional
 * (por ejemplo 18 para personal, 23 para doctores).
 */
function validarFechaNacimiento(fechaNacStr, edadMinima = 0) {
    const info = calcularEdad(fechaNacStr);
    if (!info) throw new Error('La fecha de nacimiento no es válida.');
    if (info.fechaFutura) throw new Error('La fecha de nacimiento no puede ser una fecha futura.');
    if (info.edad > 120) throw new Error('La fecha de nacimiento indica una edad mayor a 120 años. Verifica el dato.');
    if (info.edad < 0) throw new Error('La fecha de nacimiento es inválida.');
    if (info.edad < edadMinima) throw new Error(`La edad mínima requerida es de ${edadMinima} años.`);
    return info.edad;
}

async function loadView(viewName) {
    const container = document.getElementById('contentContainer');
    const info = VIEWS[viewName]||{};
    document.getElementById('pageTitle').textContent    = info.title    || viewName;
    document.getElementById('pageSubtitle').textContent = info.subtitle || '';
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    try {
        switch(viewName) {
            case 'dashboard':   await renderDashboard(container);  break;
            case 'citas':       await renderCitas(container);       break;
            case 'pacientes':   await renderPacientes(container);   break;
            case 'doctores':    await renderDoctores(container);    break;
            case 'farmacia':    await renderFarmacia(container);    break;
            case 'bitacoras':   await renderBitacoras(container);   break;
            case 'solicitudes': await renderSolicitudes(container); break;
            case 'mi-perfil':   await renderMiPerfil(container);   break;
        }
    } catch(err) {
        container.innerHTML=`<div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 3L18 17H2L10 3Z"/><path d="M10 10V13M10 15.5V16"/></svg></div><h3>Error</h3><p>${err.message}</p></div>`;
    }
}

/* ── DASHBOARD GENERAL ────────────────────────────── */
async function renderDashboard(container) {
    const stats = await recepcionista.obtenerDashboard();
    const hora   = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
    actualizarBadgeSolicitudes(stats.SolicitudesPendientes || 0);
    const user   = STATE.user;

    // ── Citas de hoy (para el widget lateral) ───────────────────────
    let htmlCitasHoy;
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const todasCitas = await citas.obtenerMisCitas();
        STATE.todasCitas = Array.isArray(todasCitas) ? todasCitas : [];
        const citasHoyLista = STATE.todasCitas
            .filter(c => (c.Fecha_Cita||'').startsWith(hoy))
            .sort((a,b) => (a.Hora_Cita||'').localeCompare(b.Hora_Cita||''));

        if (citasHoyLista.length) {
            htmlCitasHoy = '<div class="flex flex-col gap-2">' +
                citasHoyLista.slice(0, 5).map(c => {
                    const pac  = ((c.NombrePaciente||'') + ' ' + (c.ApPaciPat||'')).trim();
                    const horaC = utils.formatearHora(c.Hora_Cita || '');
                    const badge = badgeEstatus(c.Estatus || '');
                    return '<div class="flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-3 py-2.5">' +
                        '<div class="flex items-center gap-3 min-w-0">' +
                          '<div class="text-xs font-bold flex-shrink-0" style="color:var(--brand-600);font-family:\'Playfair Display\',serif;min-width:52px">' + horaC + '</div>' +
                          '<div class="text-sm font-medium text-slate-700 truncate">' + (pac || 'Paciente') + '</div>' +
                        '</div>' +
                        '<div class="flex-shrink-0">' + badge + '</div>' +
                      '</div>';
                }).join('') +
            '</div>';
            if (citasHoyLista.length > 5) {
                htmlCitasHoy += '<button class="btn btn-secondary btn-sm mt-3 w-full" onclick="irVista(\'citas\')">Ver las ' + citasHoyLista.length + ' citas de hoy</button>';
            }
        } else {
            htmlCitasHoy =
                '<div class="text-center py-4">' +
                  '<div class="empty-icon"><svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 10H7L9 13H11L13 10H17"/><path d="M3 10V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V10L14.5 4H5.5L3 10Z"/></svg></div>' +
                  '<p class="text-sm" style="color:var(--muted)">No hay citas programadas para hoy.</p>' +
                '</div>';
        }
    } catch (e) {
        console.warn('[Recep/Dashboard] Citas hoy:', e.message);
        htmlCitasHoy = '<p class="text-sm text-slate-500">No se pudo cargar la agenda de hoy.</p>';
    }

    // ── Solicitudes de cancelación recientes (para el widget lateral) ──
    let htmlSolicitudes;
    try {
        const solicitudes = await recepcionista.listarSolicitudesCancelacion();
        STATE.solicitudes = Array.isArray(solicitudes) ? solicitudes : [];

        if (STATE.solicitudes.length) {
            htmlSolicitudes = '<div class="flex flex-col gap-2">' +
                STATE.solicitudes.slice(0, 4).map(s => {
                    const pac   = ((s.NombrePaciente||'') + ' ' + (s.ApPac||'')).trim();
                    const fecha = utils.formatearFecha(s.Fecha_Cita || '');
                    return '<div class="rounded-xl bg-amber-50 px-3 py-2.5 border border-amber-100">' +
                        '<div class="flex items-center justify-between gap-2 mb-0.5">' +
                          '<div class="text-sm font-semibold text-slate-700 truncate">' + (pac || 'Paciente') + '</div>' +
                          '<span class="badge badge-warning flex-shrink-0">#' + String(s.Folio_Cita).padStart(5,'0') + '</span>' +
                        '</div>' +
                        '<div class="text-xs text-slate-500">Cita: ' + fecha + ' · ' + (s.Motivo || 'Sin motivo especificado') + '</div>' +
                      '</div>';
                }).join('') +
            '</div>' +
            '<button class="btn btn-primary btn-sm mt-3 w-full" onclick="irVista(\'solicitudes\')">Revisar solicitudes</button>';
        } else {
            htmlSolicitudes =
                '<div class="text-center py-4">' +
                  '<div class="empty-icon"><svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 10L9 13L14 7"/><circle cx="10" cy="10" r="7"/></svg></div>' +
                  '<p class="text-sm" style="color:var(--muted)">Sin solicitudes pendientes.</p>' +
                '</div>';
        }
    } catch (e) {
        console.warn('[Recep/Dashboard] Solicitudes:', e.message);
        htmlSolicitudes = '<p class="text-sm text-slate-500">No se pudieron cargar las solicitudes.</p>';
    }

    container.innerHTML = `<div class="view-content">

      <!-- Saludo principal -->
      <div class="info-card" style="margin-bottom:1.5rem;background:linear-gradient(135deg,var(--primary) 0%,var(--primary-light) 100%);border:none">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div style="display:flex;align-items:center;gap:1.25rem;flex-wrap:wrap">
            <div style="color:var(--gold-400)"><svg width="32" height="32" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="7" width="14" height="11" rx="1"/><path d="M1 7L10 2L19 7"/><path d="M10 10V15M7.5 12.5H12.5"/></svg></div>
            <div>
              <h2 style="font-size:1.5rem;font-family:'Playfair Display',serif;color:#fff;margin-bottom:.25rem">
                ${saludo}, ${user.nombre} ${user.ap_paterno}
              </h2>
              <p style="color:rgba(255,255,255,.75);font-size:.95rem">Panel de recepción — MediConnect</p>
            </div>
          </div>
          <button class="btn" style="background:var(--gold-400);color:var(--brand-700);flex-shrink:0" onclick="irVista('citas')">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8H17M7 3V5M13 3V5"/></svg> Ver Citas
          </button>
        </div>
      </div>

      <!-- Estadísticas compactas -->
      <div class="stats-grid-sm">
        <div class="stat-card-sm">
          <div class="stat-icon-sm"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8H17M7 3V5M13 3V5"/></svg></div>
          <div class="stat-info"><div class="stat-value-sm">${stats.CitasHoy||0}</div><div class="stat-label-sm">Citas Hoy</div></div>
        </div>
        <div class="stat-card-sm">
          <div class="stat-icon-sm"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 3H15M5 17H15"/><path d="M6 3C6 3 6 8 10 10C14 12 14 17 14 17"/><path d="M14 3C14 3 14 8 10 10C6 12 6 17 6 17"/></svg></div>
          <div class="stat-info"><div class="stat-value-sm">${stats.PendientesPago||0}</div><div class="stat-label-sm">Pend. de Pago</div></div>
        </div>
        <div class="stat-card-sm">
          <div class="stat-icon-sm"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 9C7.1 9 8 8.1 8 7C8 5.9 7.1 5 6 5C4.9 5 4 5.9 4 7C4 8.1 4.9 9 6 9Z"/><path d="M14 9C15.1 9 16 8.1 16 7C16 5.9 15.1 5 14 5C12.9 5 12 5.9 12 7C12 8.1 12.9 9 14 9Z"/><path d="M2 14C2 11.79 3.79 10 6 10C8.21 10 10 11.79 10 14M12 14C12 11.79 13.79 10 16 10C18.21 10 20 11.79 20 14"/></svg></div>
          <div class="stat-info"><div class="stat-value-sm">${stats.TotalPacientes||0}</div><div class="stat-label-sm">Pacientes</div></div>
        </div>
        <div class="stat-card-sm">
          <div class="stat-icon-sm"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="14" cy="14" r="2.5"/><path d="M6 4V9C6 11.21 7.79 13 10 13H11.5"/><path d="M4 4H8M6 2V6"/></svg></div>
          <div class="stat-info"><div class="stat-value-sm">${stats.DoctoresActivos||0}</div><div class="stat-label-sm">Doctores Activos</div></div>
        </div>
        <div class="stat-card-sm" style="${stats.SolicitudesPendientes>0?'border-color:var(--error)':''}">
          <div class="stat-icon-sm" style="${stats.SolicitudesPendientes>0?'background:#fee2e2;color:var(--error)':''}"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 3C10 3 6 4.5 6 9V14H14V9C14 4.5 10 3 10 3Z"/><path d="M4 14H16"/><path d="M9 17H11"/></svg></div>
          <div class="stat-info"><div class="stat-value-sm" style="${stats.SolicitudesPendientes>0?'color:var(--error)':''}">${stats.SolicitudesPendientes||0}</div><div class="stat-label-sm">Solicitudes</div></div>
        </div>
      </div>

      <!-- Layout dos columnas -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6 items-start">

        <!-- Columna izquierda (2/3): accesos rápidos -->
        <div class="lg:col-span-2 flex flex-col gap-5">
          <div>
            <div class="section-heading"><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M11 2L3 11H9L9 18L17 9H11L11 2Z"/></svg> Accesos Rápidos</div>
            <div class="quick-actions-grid">

              <div class="quick-action-tile" onclick="irVista('citas')">
                ${stats.PendientesPago>0?`<span class="qa-badge">${stats.PendientesPago}</span>`:''}
                <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8H17M7 3V5M13 3V5"/></svg></div>
                <div><div class="qa-title">Citas</div><div class="qa-desc">Gestiona la agenda del hospital</div></div>
              </div>

              <div class="quick-action-tile" onclick="irVista('solicitudes')">
                ${stats.SolicitudesPendientes>0?`<span class="qa-badge">${stats.SolicitudesPendientes}</span>`:''}
                <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M10 6V10L13 13"/></svg></div>
                <div><div class="qa-title">Solicitudes</div><div class="qa-desc">Aprueba cancelaciones pendientes</div></div>
              </div>

              <div class="quick-action-tile" onclick="irVista('farmacia')">
                <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14.24 5.76C15.58 7.1 15.58 9.27 14.24 10.62L10.62 14.24C9.27 15.58 7.1 15.58 5.76 14.24C4.42 12.9 4.42 10.73 5.76 9.38L9.38 5.76C10.73 4.42 12.9 4.42 14.24 5.76Z"/><line x1="7.1" y1="7.1" x2="12.9" y2="12.9"/></svg></div>
                <div><div class="qa-title">Venta Mostrador</div><div class="qa-desc">Medicamentos y servicios extra</div></div>
              </div>

              <div class="quick-action-tile" onclick="irVista('pacientes')">
                <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 9C7.1 9 8 8.1 8 7C8 5.9 7.1 5 6 5C4.9 5 4 5.9 4 7C4 8.1 4.9 9 6 9Z"/><path d="M14 9C15.1 9 16 8.1 16 7C16 5.9 15.1 5 14 5C12.9 5 12 5.9 12 7C12 8.1 12.9 9 14 9Z"/><path d="M2 14C2 11.79 3.79 10 6 10C8.21 10 10 11.79 10 14M12 14C12 11.79 13.79 10 16 10C18.21 10 20 11.79 20 14"/></svg></div>
                <div><div class="qa-title">Pacientes</div><div class="qa-desc">Consulta el directorio completo</div></div>
              </div>

              <div class="quick-action-tile" onclick="irVista('doctores')">
                <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="7" r="3"/><path d="M4 17C4 13.69 6.69 11 10 11C13.31 11 16 13.69 16 17"/><path d="M13 5H17M15 3V7"/></svg></div>
                <div><div class="qa-title">Doctores</div><div class="qa-desc">Directorio y alta de médicos</div></div>
              </div>

              <div class="quick-action-tile" onclick="nuevoDoctor()">
                <span class="qa-badge">+ Alta</span>
                <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="7" r="3"/><path d="M4 16C4 12.69 6.69 10 10 10C13.31 10 16 12.69 16 16"/><path d="M13 5H17M15 3V7"/></svg></div>
                <div><div class="qa-title">Nuevo Doctor</div><div class="qa-desc">Registrar un médico al sistema</div></div>
              </div>

              <div class="quick-action-tile" onclick="irVista('bitacoras')">
                <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4H14C14.55 4 15 4.45 15 5V16C15 16.55 14.55 17 14 17H6C5.45 17 5 16.55 5 16V5C5 4.45 5.45 4 6 4Z"/><path d="M8 8H12M8 11H12M8 14H10"/><path d="M12 2V5M8 2V5"/></svg></div>
                <div><div class="qa-title">Bitácoras</div><div class="qa-desc">Auditoría del sistema</div></div>
              </div>

              <div class="quick-action-tile" onclick="irVista('mi-perfil')">
                <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="7" r="3"/><path d="M4 17C4 14.24 6.69 12 10 12C13.31 12 16 14.24 16 17"/><path d="M13 5L14.5 6.5L17 4"/></svg></div>
                <div><div class="qa-title">Mi Perfil</div><div class="qa-desc">Datos personales y laborales</div></div>
              </div>

            </div>
          </div>
        </div>

        <!-- Columna derecha (1/3): citas de hoy + solicitudes -->
        <div class="flex flex-col gap-5">

          <div class="info-card">
            <div class="info-header"><h3>Citas de Hoy</h3></div>
            <div class="info-body" style="margin-top:.5rem">${htmlCitasHoy}</div>
          </div>

          <div class="info-card">
            <div class="info-header"><h3>Solicitudes Recientes</h3></div>
            <div class="info-body" style="margin-top:.5rem">${htmlSolicitudes}</div>
          </div>

          <div class="rounded-2xl p-5" style="background:var(--gold-50);border:1px solid var(--gold-200)">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:var(--gold-400);color:var(--brand-700)">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M10 6V10M10 14H10.01"/></svg>
              </div>
              <div class="font-semibold text-sm" style="color:var(--brand-700)">Recuerda</div>
            </div>
            <p class="text-sm leading-relaxed" style="color:var(--brand-700)">
              Las citas sin pago confirmado se liberan automáticamente después de 8 horas.
            </p>
          </div>

        </div>

      </div>
    </div>`;
}

function irVista(v) {
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    document.querySelector(`[data-view="${v}"]`)?.classList.add('active');
    loadView(v);
}

/* ── CITAS ────────────────────────────────────────── */
async function renderCitas(container) {
    STATE.todasCitas = await citas.obtenerMisCitas();
    dibujarTablaCitas(container, STATE.todasCitas);
}

function dibujarTablaCitas(container, lista) {
    const filas = lista.length ? lista.map(c => `<tr>
        <td><strong>#${String(c.Folio_Cita).padStart(5,'0')}</strong></td>
        <td>${utils.formatearFecha(c.Fecha_Cita)}</td>
        <td>${utils.formatearHora(c.Hora_Cita)}</td>
        <td>${c.NombrePaciente||''} ${c.ApPaciPat||''}</td>
        <td>Dr. ${c.NombreDoctor||''} ${c.ApDocPat||''}</td>
        <td>${c.Especialidad}</td>
        <td>${badgeEstatus(c.Estatus)}</td>
        <td>${c.Monto?utils.formatearMoneda(c.Monto):'—'}</td>
        <td>${['agendada_pendiente_pago','pagada_pendiente_atender'].includes(c.Estatus)?
          `<button class="btn btn-sm btn-danger" onclick="cancelarCitaRecep(${c.Folio_Cita})">Cancelar</button>`:''}
        </td></tr>`).join('') :
        `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 10H7L9 13H11L13 10H17"/><path d="M3 10V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V10L14.5 4H5.5L3 10Z"/></svg></div><h3>Sin citas</h3></div></td></tr>`;
    container.innerHTML = `<div class="view-content"><div class="table-container">
      <div class="table-header"><h3>Todas las Citas</h3>
        <div class="table-filters">
          <input type="date" class="filter-input" id="rf-fecha">
          <select class="filter-select" id="rf-est">
            <option value="">Todos los estados</option>
            <option value="agendada_pendiente_pago">Pend. Pago</option>
            <option value="pagada_pendiente_atender"> Confirmadas</option>
            <option value="atendida">Atendidas</option>
            <option value="no_acudio">— No Acudió</option>
            <optgroup label="── Cancelaciones ──">
              <option value="canceladas"> Todas las cancelaciones</option>
              <option value="cancelada_paciente">↩ Cancelada - Paciente</option>
              <option value="cancelada_doctor">Cancelada - Doctor</option>
              <option value="cancelada_falta_pago">💳 Cancelada - Sin pago</option>
            </optgroup>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="filtrarCitasRecep()">Filtrar</button>
        </div>
      </div>
      <table><thead><tr><th>Folio</th><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Doctor</th><th>Especialidad</th><th>Estatus</th><th>Monto</th><th>Acción</th></tr></thead>
      <tbody>${filas}</tbody></table></div></div>`;
}

async function filtrarCitasRecep() {
    const f={};
    const fecha=document.getElementById('rf-fecha')?.value;
    const est=document.getElementById('rf-est')?.value;
    if (fecha) { f.fecha_inicio=fecha; f.fecha_fin=fecha; }
    if (est) f.estatus=est;
    const c=document.getElementById('contentContainer');
    c.innerHTML='<div class="loading-spinner"><div class="spinner"></div></div>';
    STATE.todasCitas = await citas.obtenerMisCitas(f);
    dibujarTablaCitas(c, STATE.todasCitas);
}

async function cancelarCitaRecep(folio) {
    abrirModal('Cancelar Cita', `
      <p>¿Cancelar la cita <strong>#${String(folio).padStart(5,'0')}</strong>?</p>
      <div class="form-group" style="margin-top:1rem">
        <label>Tipo de cancelación</label>
        <select id="rc-tipo">
          <option value="paciente">Por parte del paciente (aplica política)</option>
          <option value="doctor">Por parte del doctor (100% reembolso)</option>
        </select>
      </div>
      <div class="form-group" style="margin-top:.75rem"><label>Motivo</label>
        <input id="rc-motivo" placeholder="Motivo..."></div>`,
        async () => {
            const tipo = document.getElementById('rc-tipo').value;
            const body = { motivo_cancelacion: document.getElementById('rc-motivo').value };
            if (tipo === 'doctor') body.cancelacion_doctor = true;
            const res = await citas.cancelarCita(folio, body.motivo_cancelacion);
            toast(`Cita cancelada. Devolución: ${utils.formatearMoneda(res.monto_devuelto||0)}`,'success');
            cerrarModal(); loadView('citas');
        }, 'Cancelar Cita', 'btn-danger');
}

/* ── PACIENTES ────────────────────────────────────── */
async function renderPacientes(container) {
    STATE.todosPacientes = await paciente.listarTodos();
    dibujarTablaPacientes(container, STATE.todosPacientes);
}

function dibujarTablaPacientes(container, lista) {
    const filas = lista.length ? lista.map(p => `<tr>
        <td><strong>${p.Nombre} ${p.Ap_Paterno} ${p.Ap_Materno||''}</strong></td>
        <td>${p.Email}</td>
        <td>${p.Telefono||'—'}</td>
        <td>${p.CURP}</td>
        <td>${p.Edad} años</td>
        <td><button class="btn btn-sm btn-secondary" onclick="verPaciente(${p.Id_Paciente})">Ver</button></td>
      </tr>`).join('') :
      `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 9C7.1 9 8 8.1 8 7C8 5.9 7.1 5 6 5C4.9 5 4 5.9 4 7C4 8.1 4.9 9 6 9Z"/><path d="M14 9C15.1 9 16 8.1 16 7C16 5.9 15.1 5 14 5C12.9 5 12 5.9 12 7C12 8.1 12.9 9 14 9Z"/><path d="M2 14C2 11.79 3.79 10 6 10C8.21 10 10 11.79 10 14M12 14C12 11.79 13.79 10 16 10C18.21 10 20 11.79 20 14"/></svg></div><h3>Sin pacientes</h3></div></td></tr>`;
    container.innerHTML = `<div class="view-content"><div class="table-container">
      <div class="table-header"><h3>Pacientes Registrados</h3>
        <div class="table-filters">
          <input class="filter-input" id="bp-bus" placeholder="Buscar por nombre...">
          <button class="btn btn-secondary btn-sm" onclick="buscarPacientes()">Buscar</button>
        </div>
      </div>
      <table><thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>CURP</th><th>Edad</th><th>Acciones</th></tr></thead>
      <tbody>${filas}</tbody></table></div></div>`;
}

async function buscarPacientes() {
    const nombre = document.getElementById('bp-bus')?.value;
    const c = document.getElementById('contentContainer');
    c.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    STATE.todosPacientes = await paciente.listarTodos({ nombre });
    dibujarTablaPacientes(c, STATE.todosPacientes);
}

async function verPaciente(id) {
    const p = await paciente.obtenerPorId(id);
    abrirModal('Datos del Paciente', `
      <div class="info-body">
        ${ir('Nombre', `${p.Nombre} ${p.Ap_Paterno} ${p.Ap_Materno||''}`)}
        ${ir('CURP', p.CURP)} ${ir('Email', p.Email)} ${ir('Teléfono', p.Telefono||'—')}
        ${ir('Fecha Nac.', utils.formatearFecha(p.Fecha_Nac))} ${ir('Edad', `${p.Edad} años`)}
        ${ir('Calle', p.Calle||'—')} ${ir('Colonia', p.Colonia||'—')}
      </div>`,
        async () => cerrarModal(), 'Cerrar', 'btn-secondary');
}

/* ── DOCTORES ─────────────────────────────────────── */
async function renderDoctores(container) {
    const [docs, esps] = await Promise.all([
        doctor.listarTodos(),
        especialidades.obtenerTodas()
    ]);
    STATE.todosDoctores = docs;
    const filas = docs.length ? docs.map(d => `<tr>
        <td>
          <strong>Dr. ${d.Nombre} ${d.Ap_Paterno}</strong>
          ${d.Estatus_empleado === 'Inactivo' ? '<span class="badge badge-neutral" style="margin-left:.4rem">Inactivo</span>' : ''}
        </td>
        <td>${d.Especialidad}</td>
        <td>${d.Cedula_prof}</td>
        <td>${d.Turno}</td>
        <td>${(d.Hora_inic||'').substring(0,5)} – ${(d.Hora_final||'').substring(0,5)}</td>
        <td>
          ${d.Estatus_empleado !== 'Inactivo'
            ? `<button class="btn btn-sm btn-danger" onclick="darBajaDoctor(${d.Id_Doctor},'${(d.Nombre+' '+d.Ap_Paterno).replace(/'/g,"\\'")}')">
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M7 7L13 13M13 7L7 13"/></svg>
                Dar de Baja
               </button>`
            : '<span class="text-sm" style="color:var(--muted)">—</span>'}
        </td>
      </tr>`).join('') :
      `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="14" cy="14" r="2.5"/><path d="M6 4V9C6 11.21 7.79 13 10 13H11.5"/><path d="M4 4H8M6 2V6"/></svg></div><h3>Sin doctores</h3></div></td></tr>`;
    container.innerHTML = `<div class="view-content">
      <div style="margin-bottom:1.5rem">
        <button class="btn btn-primary" onclick="nuevoDoctor()">+ Alta Doctor</button>
      </div>
      <div class="table-container">
        <div class="table-header"><h3>Personal Médico</h3></div>
        <table><thead><tr><th>Doctor</th><th>Especialidad</th><th>Cédula</th><th>Turno</th><th>Horario</th><th>Acción</th></tr></thead>
        <tbody>${filas}</tbody></table></div></div>`;
}

async function darBajaDoctor(idDoctor, nombre) {
    abrirModal('Dar de Baja — ' + nombre, `
      <div class="flex items-start gap-3 p-4 rounded-xl" style="background:#fee2e2;border:1px solid #fecaca;margin-bottom:1rem">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" class="flex-shrink-0 mt-0.5"><circle cx="10" cy="10" r="7"/><path d="M10 7V10M10 13H10.01"/></svg>
        <div style="font-size:.88rem;color:#991b1b;line-height:1.5">
          <strong>Esta acción desactivará al doctor.</strong><br>
          Solo se puede dar de baja si el doctor <strong>no tiene citas activas</strong> ni <strong>pagos pendientes</strong>.<br>
          El doctor <strong>no podrá</strong> acceder al sistema ni aparecer en el directorio de disponibles.
        </div>
      </div>
      <p style="font-size:.9rem;color:var(--text)">¿Confirmas que deseas dar de baja a <strong>${nombre}</strong>?</p>`,
        async () => {
            await doctor.darBaja(idDoctor);
            toast(`Dr. ${nombre} dado de baja correctamente.`, 'success');
            cerrarModal();
            loadView('doctores');
        }, 'Confirmar Baja', 'btn-danger');
}

async function nuevoDoctor() {
    // Cargar especialidades via apiRequest (URL correcta: /api/especialidades)
    const esps = await especialidades.obtenerTodas();
    const horarios = [
        {Id_Horario:1, Turno:'Matutino'},
        {Id_Horario:2, Turno:'Vespertino'},
        {Id_Horario:3, Turno:'Nocturno'}
    ];
    abrirModal('Alta de Doctor', `
      <div class="form-grid">
        <div class="form-group"><label>Nombre(s)*</label><input id="nd-nom" placeholder="Juan"></div>
        <div class="form-group"><label>Apellido Paterno*</label><input id="nd-ap" placeholder="García"></div>
        <div class="form-group"><label>Apellido Materno</label><input id="nd-am" placeholder="López"></div>
        <div class="form-group"><label>Email*</label><input id="nd-email" type="email"></div>
        <div class="form-group"><label>Contraseña inicial*</label><input id="nd-pass" type="password" placeholder="Min. 8 caracteres"></div>
        <div class="form-group"><label>CURP*</label><input id="nd-curp" maxlength="18" style="text-transform:uppercase"></div>
        <div class="form-group"><label>RFC*</label><input id="nd-rfc" maxlength="13" style="text-transform:uppercase"></div>
        <div class="form-group"><label>Cédula Profesional*</label><input id="nd-ced" placeholder="CED-0000000"></div>
        <div class="form-group"><label>Fecha de Nacimiento* <small style="color:var(--muted);font-weight:400">(mínimo 23 años)</small></label><input id="nd-nac" type="date"></div>
        <div class="form-group"><label>Teléfono</label><input id="nd-tel"></div>
        <div class="form-group"><label>Especialidad*</label>
          <select id="nd-esp">${esps.map(e=>`<option value="${e.Id_Especialidad}">${e.Especialidad}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Turno*</label>
          <select id="nd-hor">${horarios.map(h=>`<option value="${h.Id_Horario}">${h.Turno}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Sueldo Mensual*</label><input id="nd-suel" type="number" placeholder="30000"></div>
      </div>`,
        async () => {
            const g = id => document.getElementById(id)?.value?.trim();
            const req = ['nd-nom','nd-ap','nd-email','nd-pass','nd-curp','nd-rfc','nd-ced','nd-nac','nd-suel'];
            const miss = req.filter(id=>!g(id));
            if (miss.length) throw new Error('Completa todos los campos requeridos (*).');
            // Validar edad del doctor (mínimo 23 años para tener cédula profesional)
            validarFechaNacimiento(g('nd-nac'), 23);
            await doctor.crear({
                nombre: g('nd-nom'), ap_paterno: g('nd-ap'), ap_materno: g('nd-am'),
                email: g('nd-email'), password: g('nd-pass'),
                curp: g('nd-curp').toUpperCase(), rfc: g('nd-rfc').toUpperCase(),
                cedula_prof: g('nd-ced'), fecha_nac: g('nd-nac'),
                telefono: g('nd-tel'), id_especialidad: parseInt(g('nd-esp')),
                id_horario: parseInt(g('nd-hor')), sueldo: parseFloat(g('nd-suel')),
            });
            toast('Doctor registrado correctamente.','success');
            cerrarModal(); loadView('doctores');
        }, 'Registrar Doctor');
    // Limitar el datepicker a un rango de 23–120 años en el siguiente tick
    setTimeout(() => limitarFechaNacimiento('nd-nac'), 0);
}

/* ── MEDICAMENTOS Y SERVICIOS ─────────────────────────── */
async function renderFarmacia(container) {
    const [meds, servs, ventas] = await Promise.all([
        medicamentos.obtenerMedicamentos(), medicamentos.obtenerServicios(), medicamentos.obtenerVentas()
    ]);

    // ── Filas medicamentos ────────────────────────────────────────────
    const filasMeds = meds.map(m => `<tr>
        <td><strong>${m.Nombre}</strong>
            <div style="font-size:.8rem;color:var(--text-secondary)">${m.Descripcion||''}</div></td>
        <td>${utils.formatearMoneda(m.Precio)}</td>
        <td><span class="badge ${m.Stock<10?'badge-error':m.Stock<30?'badge-warning':'badge-success'}">${m.Stock}</span></td>
        <td>${m.Unidad}</td>
        <td style="display:flex;gap:.35rem;flex-wrap:wrap">
            <button class="btn btn-sm btn-secondary"
                onclick="editarMedicamentoModal(${m.Id_Medicamento},'${m.Nombre.replace(/'/g,"\\'")}',${m.Precio},'${(m.Unidad||'').replace(/'/g,"\\'")}',${m.Stock},'${(m.Descripcion||'').replace(/'/g,"\\'")}')">
                ✏️ Editar
            </button>
            <button class="btn btn-sm btn-danger"
                onclick="eliminarMedicamentoModal(${m.Id_Medicamento},'${m.Nombre.replace(/'/g,"\\'")}')">
                🗑️ Eliminar
            </button>
        </td></tr>`).join('') ||
        '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">Sin medicamentos</td></tr>';

    // ── Filas servicios ───────────────────────────────────────────────
    const filasServs = servs.map(s => `<tr>
        <td><strong>${s.Nombre}</strong>
            <div style="font-size:.8rem;color:var(--text-secondary)">${s.Descripcion||''}</div></td>
        <td>${utils.formatearMoneda(s.Precio)}</td>
        <td style="display:flex;gap:.35rem;flex-wrap:wrap">
            <button class="btn btn-sm btn-secondary"
                onclick="editarServicioModal(${s.Id_Servicio},'${s.Nombre.replace(/'/g,"\\'")}',${s.Precio},'${(s.Descripcion||'').replace(/'/g,"\\'")}')">
                ✏️ Editar
            </button>
            <button class="btn btn-sm btn-danger"
                onclick="eliminarServicioModal(${s.Id_Servicio},'${s.Nombre.replace(/'/g,"\\'")}')">
                🗑️ Eliminar
            </button>
        </td></tr>`).join('') ||
        '<tr><td colspan="3" style="text-align:center">Sin servicios</td></tr>';

    container.innerHTML = `<div class="view-content">
      <div style="margin-bottom:1.5rem;display:flex;gap:1rem;flex-wrap:wrap">
        <button class="btn btn-primary"   onclick="nuevaVentaModal()">💰 Nueva Venta</button>
        <button class="btn btn-secondary" onclick="nuevoMedicamento()">+ Medicamento</button>
        <button class="btn btn-secondary" onclick="nuevoServicio()">+ Servicio</button>
      </div>
      <div class="info-grid">
        <div class="table-container">
          <div class="table-header"><h3><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14.24 5.76C15.58 7.1 15.58 9.27 14.24 10.62L10.62 14.24C9.27 15.58 7.1 15.58 5.76 14.24C4.42 12.9 4.42 10.73 5.76 9.38L9.38 5.76C10.73 4.42 12.9 4.42 14.24 5.76Z"/><line x1="7.1" y1="7.1" x2="12.9" y2="12.9"/></svg> Medicamentos</h3></div>
          <table><thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Unidad</th><th>Acciones</th></tr></thead>
          <tbody>${filasMeds}</tbody></table>
        </div>
        <div class="table-container">
          <div class="table-header"><h3><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="7" width="14" height="11" rx="1"/><path d="M1 7L10 2L19 7"/><path d="M10 10V15M7.5 12.5H12.5"/></svg> Servicios Extra</h3></div>
          <table><thead><tr><th>Servicio</th><th>Precio</th><th>Acciones</th></tr></thead>
          <tbody>${filasServs}</tbody></table>
        </div>
      </div>
      <div class="table-container">
        <div class="table-header"><h3>Ventas Recientes</h3></div>
        <table><thead><tr><th>ID</th><th>Fecha</th><th>Tipo</th><th>Total</th></tr></thead>
        <tbody>${ventas.slice(0,15).map(v=>`<tr>
            <td>#${String(v.Id_Venta).padStart(4,'0')}</td>
            <td>${utils.formatearFecha(v.Fecha)}</td>
            <td><span class="badge badge-info">${v.Tipo_Venta}</span></td>
            <td><strong>${utils.formatearMoneda(v.Total)}</strong></td>
          </tr>`).join('')||'<tr><td colspan="4" style="text-align:center">Sin ventas</td></tr>'}
        </tbody></table>
      </div>
    </div>`;
}

// ── MEDICAMENTOS: editar (nombre, precio, unidad, stock, descripción) ─
async function editarMedicamentoModal(id, nombre, precio, unidad, stock, descripcion) {
    abrirModal(`Editar Medicamento — ${nombre}`, `
      <div class="form-grid">
        <div class="form-group"><label>Nombre*</label>
            <input id="em-nom" value="${nombre}"></div>
        <div class="form-group"><label>Precio*</label>
            <input id="em-pre" type="number" step=".01" value="${precio}"></div>
        <div class="form-group"><label>Unidad*</label>
            <input id="em-uni" value="${unidad}"></div>
        <div class="form-group"><label>Stock</label>
            <input id="em-stk" type="number" min="0" value="${stock}"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Descripción</label>
            <input id="em-des" value="${descripcion}"></div>
      </div>`,
        async () => {
            const g = id => document.getElementById(id)?.value?.trim();
            if (!g('em-nom') || !g('em-pre') || !g('em-uni')) throw new Error('Completa los campos requeridos.');
            await medicamentos.actualizarMedicamento(id, {
                nombre:      g('em-nom'),
                precio:      parseFloat(g('em-pre')),
                unidad:      g('em-uni'),
                stock:       parseInt(document.getElementById('em-stk').value),
                descripcion: g('em-des')
            });
            toast('Medicamento actualizado.', 'success');
            cerrarModal(); loadView('farmacia');
        }, 'Guardar Cambios');
}

// ── MEDICAMENTOS: eliminar con confirmación ───────────────────────────
async function eliminarMedicamentoModal(id, nombre) {
    abrirModal('Eliminar Medicamento', `
      <p>¿Estás seguro de que deseas eliminar <strong>${nombre}</strong>?</p>
      <p style="margin-top:.5rem;font-size:.9rem;color:var(--text-secondary)">
        Esta acción es irreversible. Si el medicamento tiene ventas registradas no podrá eliminarse.
      </p>`,
        async () => {
            await medicamentos.eliminarMedicamento(id);
            toast(`"${nombre}" eliminado correctamente.`, 'success');
            cerrarModal(); loadView('farmacia');
        }, 'Eliminar', 'btn-danger');
}

// ── SERVICIOS: editar ────────────────────────────────────────────────
async function editarServicioModal(id, nombre, precio, descripcion) {
    abrirModal(`Editar Servicio — ${nombre}`, `
      <div class="form-grid">
        <div class="form-group"><label>Nombre*</label>
            <input id="es-nom" value="${nombre}"></div>
        <div class="form-group"><label>Precio*</label>
            <input id="es-pre" type="number" step=".01" value="${precio}"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Descripción</label>
            <input id="es-des" value="${descripcion}"></div>
      </div>`,
        async () => {
            const g = id => document.getElementById(id)?.value?.trim();
            if (!g('es-nom') || !g('es-pre')) throw new Error('Nombre y precio son requeridos.');
            await medicamentos.actualizarServicio(id, {
                nombre:      g('es-nom'),
                precio:      parseFloat(g('es-pre')),
                descripcion: g('es-des')
            });
            toast('Servicio actualizado.', 'success');
            cerrarModal(); loadView('farmacia');
        }, 'Guardar Cambios');
}

// ── SERVICIOS: eliminar con confirmación ─────────────────────────────
async function eliminarServicioModal(id, nombre) {
    abrirModal('Eliminar Servicio', `
      <p>¿Estás seguro de que deseas eliminar <strong>${nombre}</strong>?</p>
      <p style="margin-top:.5rem;font-size:.9rem;color:var(--text-secondary)">
        Esta acción es irreversible. Si el servicio tiene ventas registradas no podrá eliminarse.
      </p>`,
        async () => {
            await medicamentos.eliminarServicio(id);
            toast(`"${nombre}" eliminado correctamente.`, 'success');
            cerrarModal(); loadView('farmacia');
        }, 'Eliminar', 'btn-danger');
}


async function nuevaVentaModal() {
    const [meds, servs] = await Promise.all([medicamentos.obtenerMedicamentos(), medicamentos.obtenerServicios()]);
    let items = [];
    const renderItems = () => items.map((item,i) => `
      <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem">
        <span style="flex:1">${item.tipo==='medicamento'?'Med':'Serv'} ${item.nombre}</span>
        <input type="number" min="1" value="${item.cantidad}" style="width:60px;padding:.3rem;border:1px solid var(--border);border-radius:6px"
          onchange="actualizarCantItem(${i},this.value)">
        <span style="width:80px;text-align:right">${utils.formatearMoneda(item.precio*item.cantidad)}</span>
        <button onclick="quitarItem(${i})" style="background:none;border:none;color:var(--error);cursor:pointer;font-size:1.2rem">×</button>
      </div>`).join('');
    
    window._ventaItems = items;
    window.actualizarCantItem = (i,v) => { window._ventaItems[i].cantidad=parseInt(v)||1; actualizarVentaModal(); };
    window.quitarItem = i => { window._ventaItems.splice(i,1); actualizarVentaModal(); };
    window.actualizarVentaModal = () => {
        const tot = window._ventaItems.reduce((s,it)=>s+it.precio*it.cantidad,0);
        document.getElementById('venta-items').innerHTML = window._ventaItems.length ?
            renderItems().replace(/window\._ventaItems/g,'items') + `<div style="text-align:right;font-weight:700;margin-top:.75rem;font-size:1.1rem">Total: ${utils.formatearMoneda(tot)}</div>`
            : '<p style="color:var(--text-secondary)">Agrega medicamentos o servicios.</p>';
    };

    abrirModal('Nueva Venta de Mostrador', `
      <p style="color:var(--text-secondary);font-size:.9rem;margin-bottom:1rem">El cliente NO necesita ser paciente del hospital.</p>
      <div class="form-grid">
        <div class="form-group"><label>Tipo</label>
          <select id="v-tipo"><option value="medicamento">Medicamento</option><option value="servicio">Servicio</option></select>
        </div>
        <div class="form-group"><label>Producto/Servicio</label>
          <select id="v-item">
            ${meds.map(m=>`<option value="${m.Id_Medicamento}" data-tipo="medicamento" data-precio="${m.Precio}" data-nombre="${m.Nombre}">${m.Nombre} – ${utils.formatearMoneda(m.Precio)}</option>`).join('')}
            ${servs.map(s=>`<option value="${s.Id_Servicio}" data-tipo="servicio" data-precio="${s.Precio}" data-nombre="${s.Nombre}">${s.Nombre} – ${utils.formatearMoneda(s.Precio)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Cantidad</label><input id="v-cant" type="number" min="1" value="1"></div>
        <div class="form-group" style="display:flex;align-items:flex-end">
          <button class="btn btn-secondary btn-sm" style="width:100%" onclick="agregarItemVenta()">+ Agregar</button>
        </div>
      </div>
      <div id="venta-items" style="border:1px solid var(--border);border-radius:10px;padding:1rem;min-height:60px">
        <p style="color:var(--text-secondary)">Agrega medicamentos o servicios.</p>
      </div>`,
        async () => {
            if (!window._ventaItems.length) throw new Error('Agrega al menos un artículo.');
            const payload = {
                items: window._ventaItems.map(it => ({
                    tipo: it.tipo, id: it.id, cantidad: it.cantidad
                }))
            };
            const res = await medicamentos.realizarVenta(payload);
            toast(`Venta #${res.id_venta} registrada. Total: ${utils.formatearMoneda(res.total)}`,'success');
            cerrarModal(); loadView('farmacia');
        }, 'Registrar Venta');
}

window.agregarItemVenta = () => {
    const sel = document.getElementById('v-item');
    const opt = sel.options[sel.selectedIndex];
    window._ventaItems = window._ventaItems || [];
    window._ventaItems.push({
        tipo: opt.dataset.tipo, id: parseInt(sel.value),
        nombre: opt.dataset.nombre, precio: parseFloat(opt.dataset.precio),
        cantidad: parseInt(document.getElementById('v-cant').value)||1
    });
    window.actualizarVentaModal();
};

async function nuevoMedicamento() {
    abrirModal('Nuevo Medicamento', `
      <div class="form-grid">
        <div class="form-group"><label>Nombre*</label><input id="nm-nom"></div>
        <div class="form-group"><label>Precio*</label><input id="nm-pre" type="number" step=".01"></div>
        <div class="form-group"><label>Unidad*</label><input id="nm-uni" placeholder="Caja x 10, Frasco..."></div>
        <div class="form-group"><label>Stock inicial*</label><input id="nm-stk" type="number" min="0"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Descripción</label><input id="nm-des"></div>
      </div>`,
        async () => {
            const g=id=>document.getElementById(id)?.value?.trim();
            if (!g('nm-nom')||!g('nm-pre')||!g('nm-uni')||!g('nm-stk')) throw new Error('Completa los campos requeridos.');
            await medicamentos.crearMedicamento({nombre:g('nm-nom'),precio:parseFloat(g('nm-pre')),unidad:g('nm-uni'),stock:parseInt(g('nm-stk')),descripcion:g('nm-des')});
            toast('Medicamento agregado.','success'); cerrarModal(); loadView('farmacia');
        });
}

async function nuevoServicio() {
    abrirModal('Nuevo Servicio', `
      <div class="form-grid">
        <div class="form-group"><label>Nombre*</label><input id="ns-nom"></div>
        <div class="form-group"><label>Precio*</label><input id="ns-pre" type="number" step=".01"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Descripción</label><input id="ns-des"></div>
      </div>`,
        async () => {
            const g=id=>document.getElementById(id)?.value?.trim();
            if (!g('ns-nom')||!g('ns-pre')) throw new Error('Nombre y precio son requeridos.');
            await medicamentos.crearServicio({nombre:g('ns-nom'),precio:parseFloat(g('ns-pre')),descripcion:g('ns-des')});
            toast('Servicio agregado.','success'); cerrarModal(); loadView('farmacia');
        });
}

/* ── MI PERFIL ────────────────────────────────────── */
async function renderMiPerfil(container) {
    const p = await recepcionista.obtenerPerfil();

    const nombreCompleto = `${p.Nombre} ${p.Ap_Paterno} ${p.Ap_Materno || ''}`.trim();
    const fechaNac       = utils.formatearFecha(p.Fecha_Nac);
    const turno          = `${p.Turno} (${utils.formatearHora(p.Hora_inic)} – ${utils.formatearHora(p.Hora_final)})`;
    const sueldo         = utils.formatearMoneda(p.Sueldo);

    container.innerHTML = `<div class="view-content">
      <div class="info-grid">

        <!-- Datos de identidad — solo lectura -->
        <div class="info-card">
          <div class="info-header">
            <h3>Información Personal</h3>
            <span style="font-size:.75rem;color:var(--text-secondary);padding:.2rem .55rem;
                  background:var(--bg-secondary,#f1f5f9);border-radius:6px">🔒 Solo lectura</span>
          </div>
          <div class="info-body">
            ${ir('Nombre Completo', nombreCompleto)}
            ${ir('CURP',           p.CURP)}
            ${ir('Fecha Nac.',     fechaNac)}
            ${ir('Edad',           `${p.Edad} años`)}
          </div>
        </div>

        <!-- Datos de contacto — editables -->
        <div class="info-card">
          <div class="info-header">
            <h3>Datos de Contacto</h3>
            <button class="btn-icon btn-sm" onclick="editarPerfilRecep()">✏️ Editar</button>
          </div>
          <div class="info-body">
            ${ir('Email',    p.Email    || '—')}
            ${ir('Teléfono', p.Telefono || '—')}
            ${ir('Calle',    p.Calle    || '—')}
            ${ir('Número',   p.Numero   || '—')}
            ${ir('Colonia',  p.Colonia  || '—')}
          </div>
        </div>

        <!-- Datos laborales — solo lectura -->
        <div class="info-card">
          <div class="info-header">
            <h3>Datos Laborales</h3>
            <span style="font-size:.75rem;color:var(--text-secondary);padding:.2rem .55rem;
                  background:var(--bg-secondary,#f1f5f9);border-radius:6px">🔒 Solo lectura</span>
          </div>
          <div class="info-body">
            ${ir('RFC',              p.RFC)}
            ${ir('Sueldo Mensual',   sueldo)}
            ${ir('Días de Vacación', `${p.DiasVacacion} días`)}
            ${ir('Estatus',          p.Estatus_empleado)}
          </div>
        </div>

        <!-- Horario asignado — solo lectura -->
        <div class="info-card">
          <div class="info-header">
            <h3>Horario Asignado</h3>
            <span style="font-size:.75rem;color:var(--text-secondary);padding:.2rem .55rem;
                  background:var(--bg-secondary,#f1f5f9);border-radius:6px">🔒 Solo lectura</span>
          </div>
          <div class="info-body">
            ${ir('Turno', turno)}
          </div>
        </div>

      </div>
    </div>`;

    // Guardar perfil en STATE para reutilizar en el modal
    window._perfilRecep = p;
}

async function editarPerfilRecep() {
    const p = window._perfilRecep;
    if (!p) return;

    abrirModal('Editar Datos de Contacto', `
      <p style="font-size:.82rem;color:var(--text-secondary);margin-bottom:1rem">
        Los datos de identidad y laborales (nombre, CURP, RFC, sueldo) solo pueden
        modificarse a través de administración. Aquí puedes actualizar tu contacto.
      </p>
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label>Email</label>
          <input id="rp-email" type="email" value="${p.Email || ''}" placeholder="correo@ejemplo.com">
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input id="rp-tel" value="${p.Telefono || ''}" placeholder="10 dígitos">
        </div>
        <div class="form-group">
          <label>Calle</label>
          <input id="rp-calle" value="${p.Calle || ''}">
        </div>
        <div class="form-group">
          <label>Número</label>
          <input id="rp-num" value="${p.Numero || ''}">
        </div>
        <div class="form-group">
          <label>Colonia</label>
          <input id="rp-col" value="${p.Colonia || ''}">
        </div>
      </div>`,
        async () => {
            const email = document.getElementById('rp-email').value.trim();
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                throw new Error('El formato del email no es válido.');
            }
            await recepcionista.actualizarPerfil({
                email:    email,
                telefono: document.getElementById('rp-tel').value.trim(),
                calle:    document.getElementById('rp-calle').value.trim(),
                numero:   document.getElementById('rp-num').value.trim(),
                colonia:  document.getElementById('rp-col').value.trim()
            });
            toast('Perfil actualizado correctamente.', 'success');
            cerrarModal();
            loadView('mi-perfil');
        }, 'Guardar Cambios');
}

/* ── BITÁCORAS ────────────────────────────────────── */
async function renderBitacoras(container) {
    const bit = await recepcionista.obtenerBitacoraEstatus();
    container.innerHTML = `<div class="view-content">
      <div class="table-container">
        <div class="table-header"><h3>Bitácora de Estatus de Citas</h3>
          <div class="table-filters">
            <input type="date" class="filter-input" id="bit-fi">
            <input type="date" class="filter-input" id="bit-ff">
            <button class="btn btn-secondary btn-sm" onclick="filtrarBitacora()">Filtrar</button>
          </div>
        </div>
        <table><thead><tr><th>Registro</th><th>Fecha Mov.</th><th>Folio Cita</th><th>Estatus</th><th>Fecha Cita</th><th>Costo</th><th>Política</th><th>Devuelto</th></tr></thead>
        <tbody>${bit.slice(0,50).map(b=>`<tr>
            <td>${b.Id_Registro}</td>
            <td>${utils.formatearFecha(b.Fecha_Mov)}</td>
            <td>#${String(b.Folio_Cita).padStart(5,'0')}</td>
            <td>${badgeEstatus(b.Estatus_Cita)}</td>
            <td>${utils.formatearFecha(b.Fecha_Cita)}</td>
            <td>${utils.formatearMoneda(b.Costo)}</td>
            <td>${b.Politica_Cancela||'—'}</td>
            <td>${b.Monto_Devuelto>0?utils.formatearMoneda(b.Monto_Devuelto):'—'}</td>
          </tr>`).join('')||'<tr><td colspan="8" style="text-align:center;padding:2rem">Sin registros</td></tr>'}
        </tbody></table>
      </div>
    </div>`;
}

async function filtrarBitacora() {
    const fi=document.getElementById('bit-fi')?.value;
    const ff=document.getElementById('bit-ff')?.value;
    const f={};
    if(fi) f.fecha_inicio=fi;
    if(ff) f.fecha_fin=ff;
    const c=document.getElementById('contentContainer');
    c.innerHTML='<div class="loading-spinner"><div class="spinner"></div></div>';
    const bit=await recepcionista.obtenerBitacoraEstatus(f);
    // re-render simplificado
    await renderBitacoras(c);
}

/* ── SOLICITUDES DE CANCELACIÓN ───────────────────── */
async function renderSolicitudes(container) {
    const [cancelaciones, comprasPend] = await Promise.all([
        recepcionista.listarSolicitudesCancelacion(),
        compras.listarPendientes()
    ]);
    actualizarBadgeSolicitudes(cancelaciones.length + comprasPend.length);

    container.innerHTML = `<div class="view-content">
      <!-- Tabs -->
      <div style="display:flex;gap:.4rem;margin-bottom:1.5rem;flex-wrap:wrap;
                  background:#f1f5f9;border-radius:12px;padding:.35rem">
        <button class="farm-tab active" data-tab="sol-cancel" onclick="switchSolTab('sol-cancel')">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="14" cy="14" r="2.5"/><path d="M6 4V9C6 11.21 7.79 13 10 13H11.5"/><path d="M4 4H8M6 2V6"/></svg>
          Cancelaciones
          ${cancelaciones.length ? `<span class="farm-tab-count" style="background:#ef4444;color:#fff">${cancelaciones.length}</span>` : '<span class="farm-tab-count">0</span>'}
        </button>
        <button class="farm-tab" data-tab="sol-compra" onclick="switchSolTab('sol-compra')">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6H17L15.5 16H4.5L3 6Z"/><path d="M1 3H19"/><circle cx="7.5" cy="18.5" r="1"/><circle cx="12.5" cy="18.5" r="1"/></svg>
          Compras Walk-in
          ${comprasPend.length ? `<span class="farm-tab-count" style="background:#ef4444;color:#fff">${comprasPend.length}</span>` : '<span class="farm-tab-count">0</span>'}
        </button>
      </div>

      <!-- CANCELACIONES -->
      <div id="sol-cancel">
        ${cancelaciones.length ? `
        <div class="table-container">
          <table>
            <thead><tr><th>Folio Cita</th><th>Doctor</th><th>Paciente</th><th>Motivo</th><th>Fecha Sol.</th><th>Acciones</th></tr></thead>
            <tbody>
              ${cancelaciones.map(s => `<tr>
                <td>#${String(s.Folio_Cita).padStart(5,'0')}</td>
                <td>${s.NombreDoctor||''} ${s.ApDoc||''}</td>
                <td>${s.NombrePaciente||''} ${s.ApPac||''}</td>
                <td style="max-width:160px;white-space:normal">${s.Motivo||'—'}</td>
                <td>${utils.formatearFecha(s.Fecha_Solicitud)}</td>
                <td style="display:flex;gap:.35rem">
                  <button class="btn btn-sm btn-primary" onclick="aprobarCancelacion(${s.Id_Solicitud})">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 10L8 14L16 6"/></svg> Aprobar
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="rechazarCancelacion(${s.Id_Solicitud})">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5L15 15M15 5L5 15"/></svg> Rechazar
                  </button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` :
        '<div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 10L9 13L14 7"/><circle cx="10" cy="10" r="7"/></svg></div><h3>Sin solicitudes de cancelación</h3><p>No hay cancelaciones pendientes.</p></div>'}
      </div>

      <!-- COMPRAS WALK-IN -->
      <div id="sol-compra" style="display:none">
        ${comprasPend.length ? `
        <div class="table-container">
          <table>
            <thead><tr><th>Folio</th><th>Cliente</th><th>Teléfono</th><th>Total</th><th>Solicitado</th><th>Acciones</th></tr></thead>
            <tbody>
              ${comprasPend.map(s => `<tr>
                <td><strong>#${String(s.Id_Solicitud).padStart(5,'0')}</strong></td>
                <td>${s.cliente || '—'}</td>
                <td>${s.Telefono_Cliente||s.TelefonoPaciente||'—'}</td>
                <td><strong>${utils.formatearMoneda(s.Total)}</strong></td>
                <td>${utils.formatearFecha(s.Fecha_Solicitud)}</td>
                <td style="display:flex;gap:.35rem;flex-wrap:wrap">
                  <button class="btn btn-sm btn-secondary" onclick="verTicketCompra(${s.Id_Solicitud})">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 10C2 10 5 5 10 5C15 5 18 10 18 10C18 10 15 15 10 15C5 15 2 10 2 10Z"/><circle cx="10" cy="10" r="2.5"/></svg> Ver Ticket
                  </button>
                  <button class="btn btn-sm btn-success" onclick="procesarCompraWalkin(${s.Id_Solicitud})">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 10L8 14L16 6"/></svg> Procesar
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="rechazarCompraWalkin(${s.Id_Solicitud})">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5L15 15M15 5L5 15"/></svg> Rechazar
                  </button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` :
        '<div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6H17L15.5 16H4.5L3 6Z"/><path d="M1 3H19"/><circle cx="7.5" cy="18.5" r="1"/><circle cx="12.5" cy="18.5" r="1"/></svg></div><h3>Sin solicitudes de compra walk-in</h3><p>Los clientes pueden solicitarlas desde la página principal.</p></div>'}
      </div>
    </div>`;
}

function switchSolTab(tab) {
    ['sol-cancel','sol-compra'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === tab ? '' : 'none';
    });
    document.querySelectorAll('.farm-tab[data-tab]').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === tab));
}

// Ver ticket de compra walk-in (sólo visual, sin comprometer nada)
async function verTicketCompra(idSolicitud) {
    let data = null;
    try { data = await compras.detalle(idSolicitud); } catch(e) {}
    if (!data) { toast('No se pudo cargar el ticket.','error'); return; }

    const filas = (data.items||[]).map(it =>
        `<tr>
          <td>${it.nombre}</td>
          <td style="text-align:center">${it.cantidad}</td>
          <td style="text-align:right">${utils.formatearMoneda(it.precio)}</td>
          <td style="text-align:right"><strong>${utils.formatearMoneda(it.subtotal)}</strong></td>
        </tr>`
    ).join('') || '<tr><td colspan="4">Sin detalle</td></tr>';

    const fecha = utils.formatearFecha(data.Fecha_Solicitud);

    abrirModal(`Ticket #${String(idSolicitud).padStart(5,'0')}`, `
      <div class="comprobante">
        <div class="comprobante-header">
          <div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">MediConnect · Solicitud de Compra</div>
          <h2>Folio #${String(idSolicitud).padStart(5,'0')}</h2>
          <div style="font-size:.85rem;color:var(--muted);margin-top:.25rem">${fecha}</div>
        </div>
        <div class="comprobante-row"><span class="info-label">Cliente</span><span class="info-value">${data.cliente||'—'}</span></div>
        ${data.Telefono_Cliente ? `<div class="comprobante-row"><span class="info-label">Teléfono</span><span class="info-value">${data.Telefono_Cliente}</span></div>` : ''}
        <div style="margin:1rem 0">
          <table style="width:100%;font-size:.85rem">
            <thead><tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding-bottom:.4rem">Producto/Servicio</th>
              <th style="text-align:center">Cant.</th>
              <th style="text-align:right">Precio</th>
              <th style="text-align:right">Subtotal</th>
            </tr></thead>
            <tbody>${filas}</tbody>
            <tfoot><tr style="border-top:2px solid var(--border)">
              <td colspan="3" style="text-align:right;font-weight:700;padding-top:.5rem">Total</td>
              <td style="text-align:right;font-weight:700;padding-top:.5rem;font-size:1.05rem;color:var(--brand-600)">${utils.formatearMoneda(data.Total)}</td>
            </tr></tfoot>
          </table>
        </div>
        <div class="comprobante-aviso">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M10 6V10M10 14H10.01"/></svg>
          Revisa el ticket y haz clic en "Procesar Venta" para confirmar la entrega y descontar stock.
        </div>
      </div>`,
        async () => { await procesarCompraWalkin(idSolicitud); },
        'Procesar Venta', 'btn-primary'
    );
}

async function procesarCompraWalkin(id) {
    try {
        const res = await compras.procesar(id);
        toast(`Venta #${String(res.id_venta).padStart(5,'0')} registrada. Total: ${utils.formatearMoneda(res.total)}.`, 'success');
        cerrarModal();
        loadView('solicitudes');
    } catch(e) {
        toast(e.message || 'Error al procesar la venta.', 'error');
    }
}

async function rechazarCompraWalkin(id) {
    abrirModal('Rechazar Solicitud de Compra', `
      <div class="form-group">
        <label>Motivo del rechazo <small style="color:var(--muted);font-weight:400">(opcional)</small></label>
        <input id="rw-motivo" placeholder="Ej: stock insuficiente, acercarse en otro horario…">
      </div>`,
        async () => {
            const motivo = document.getElementById('rw-motivo')?.value?.trim() || '';
            await compras.rechazar(id, motivo);
            toast('Solicitud rechazada correctamente.', 'success');
            cerrarModal();
            loadView('solicitudes');
        }, 'Rechazar', 'btn-danger');
}

// Alias compatibilidad: compras de paciente registrado (flujo antiguo)
async function verDetalleSolicitudCompra(id, paciente, total) {
    return verTicketCompra(id);
}
async function procesarCompra(id) { return procesarCompraWalkin(id); }
async function rechazarCompra(id) { return rechazarCompraWalkin(id); }

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
function badgeEstatus(clave) {
    const m={'agendada_pendiente_pago':['warning','Pend. Pago'],'pagada_pendiente_atender':['info','Confirmada'],'cancelada_falta_pago':['error','Canc. Pago'],'cancelada_paciente':['error','Cancelada'],'cancelada_doctor':['error','Canc. Doctor'],'atendida':['success','Atendida'],'no_acudio':['neutral','No Acudio']};
    const [c,t]=m[clave]||['neutral',clave];
    return `<span class="badge badge-${c}">${t}</span>`;
}

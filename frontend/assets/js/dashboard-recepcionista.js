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
    'farmacia':    { title:'Farmacia y Servicios',  subtitle:'Inventario y ventas de mostrador' },
    'bitacoras':   { title:'Bitácoras',             subtitle:'Registro de auditoría del sistema' },
    'solicitudes': { title:'Solicitudes',           subtitle:'Cancelaciones pendientes de aprobación' },
    'mi-perfil':   { title:'Mi Perfil',             subtitle:'Tu información personal y laboral' },
};

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
    const user   = STATE.user;
    container.innerHTML = `<div class="view-content">

      <!-- Saludo principal -->
      <div class="info-card" style="margin-bottom:1.5rem;background:linear-gradient(135deg,var(--primary) 0%,var(--primary-light) 100%);color:white;border:none">
        <div style="display:flex;align-items:center;gap:1.25rem;flex-wrap:wrap">
          <div style="color:var(--primary);margin-bottom:.5rem"><svg width="32" height="32" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="7" width="14" height="11" rx="1"/><path d="M1 7L10 2L19 7"/><path d="M10 10V15M7.5 12.5H12.5"/></svg></div>
          <div>
            <h2 style="font-size:1.5rem;font-family:'Playfair Display',serif;color:white;margin-bottom:.25rem">
              ${saludo}, ${user.nombre} ${user.ap_paterno}
            </h2>
            <p style="color:rgba(255,255,255,.8);font-size:.95rem">Panel de recepción — MediConnect</p>
          </div>
        </div>
      </div>

      <!-- Estadísticas del día -->
      <div class="stats-grid">
        <div class="info-card stat-card"><div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8H17M7 3V5M13 3V5"/></svg></div><div class="stat-value">${stats.CitasHoy||0}</div><div class="stat-label">Citas Hoy</div></div>
        <div class="info-card stat-card"><div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 3H15M5 17H15"/><path d="M6 3C6 3 6 8 10 10C14 12 14 17 14 17"/><path d="M14 3C14 3 14 8 10 10C6 12 6 17 6 17"/></svg></div><div class="stat-value">${stats.PendientesPago||0}</div><div class="stat-label">Pendientes de Pago</div></div>
        <div class="info-card stat-card"><div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 9C7.1 9 8 8.1 8 7C8 5.9 7.1 5 6 5C4.9 5 4 5.9 4 7C4 8.1 4.9 9 6 9Z"/><path d="M14 9C15.1 9 16 8.1 16 7C16 5.9 15.1 5 14 5C12.9 5 12 5.9 12 7C12 8.1 12.9 9 14 9Z"/><path d="M2 14C2 11.79 3.79 10 6 10C8.21 10 10 11.79 10 14M12 14C12 11.79 13.79 10 16 10C18.21 10 20 11.79 20 14"/></svg></div><div class="stat-value">${stats.TotalPacientes||0}</div><div class="stat-label">Total Pacientes</div></div>
        <div class="info-card stat-card"><div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="14" cy="14" r="2.5"/><path d="M6 4V9C6 11.21 7.79 13 10 13H11.5"/><path d="M4 4H8M6 2V6"/></svg></div><div class="stat-value">${stats.DoctoresActivos||0}</div><div class="stat-label">Doctores Activos</div></div>
        <div class="info-card stat-card">
          <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 3C10 3 6 4.5 6 9V14H14V9C14 4.5 10 3 10 3Z"/><path d="M4 14H16"/><path d="M9 17H11"/></svg></div>
          <div class="stat-value" style="${stats.SolicitudesPendientes>0?'color:var(--error)':''}">${stats.SolicitudesPendientes||0}</div>
          <div class="stat-label">Solicitudes Pendientes</div>
          ${stats.SolicitudesPendientes>0?`<button class="btn btn-sm btn-danger" style="margin-top:.75rem" onclick="irVista('solicitudes')">Ver Solicitudes</button>`:''}
        </div>
      </div>

      <!-- Acciones rápidas -->
      <div class="info-card" style="margin-top:1.5rem">
        <div class="info-header"><h3>Acciones Rápidas</h3></div>
        <div style="display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1rem">
          <button class="btn btn-primary"   onclick="irVista('citas')"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8H17M7 3V5M13 3V5"/></svg> Ver Citas</button>
          <button class="btn btn-secondary" onclick="nuevoDoctor()">+ Alta Doctor</button>
          <button class="btn btn-secondary" onclick="irVista('farmacia')"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14.24 5.76C15.58 7.1 15.58 9.27 14.24 10.62L10.62 14.24C9.27 15.58 7.1 15.58 5.76 14.24C4.42 12.9 4.42 10.73 5.76 9.38L9.38 5.76C10.73 4.42 12.9 4.42 14.24 5.76Z"/><line x1="7.1" y1="7.1" x2="12.9" y2="12.9"/></svg> Venta Mostrador</button>
          <button class="btn btn-secondary" onclick="irVista('pacientes')"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 9C7.1 9 8 8.1 8 7C8 5.9 7.1 5 6 5C4.9 5 4 5.9 4 7C4 8.1 4.9 9 6 9Z"/><path d="M14 9C15.1 9 16 8.1 16 7C16 5.9 15.1 5 14 5C12.9 5 12 5.9 12 7C12 8.1 12.9 9 14 9Z"/><path d="M2 14C2 11.79 3.79 10 6 10C8.21 10 10 11.79 10 14M12 14C12 11.79 13.79 10 16 10C18.21 10 20 11.79 20 14"/></svg> Pacientes</button>
          <button class="btn btn-secondary" onclick="irVista('bitacoras')"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4H14C14.55 4 15 4.45 15 5V16C15 16.55 14.55 17 14 17H6C5.45 17 5 16.55 5 16V5C5 4.45 5.45 4 6 4Z"/><path d="M8 8H12M8 11H12M8 14H10"/><path d="M12 2V5M8 2V5"/></svg> Bitácoras</button>
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
    // Usamos doctor.listarTodos() y especialidades.obtenerTodas() — ambos
    // pasan por apiRequest con la URL correcta (/api/doctores, /api/especialidades)
    const [docs, esps] = await Promise.all([
        doctor.listarTodos(),
        especialidades.obtenerTodas()
    ]);
    STATE.todosDoctores = docs;
    const filas = docs.length ? docs.map(d => `<tr>
        <td><strong>Dr. ${d.Nombre} ${d.Ap_Paterno}</strong></td>
        <td>${d.Especialidad}</td>
        <td>${d.Cedula_prof}</td>
        <td>${d.Turno}</td>
        <td>${(d.Hora_inic||'').substring(0,5)} – ${(d.Hora_final||'').substring(0,5)}</td>
      </tr>`).join('') :
      `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="14" cy="14" r="2.5"/><path d="M6 4V9C6 11.21 7.79 13 10 13H11.5"/><path d="M4 4H8M6 2V6"/></svg></div><h3>Sin doctores</h3></div></td></tr>`;
    container.innerHTML = `<div class="view-content">
      <div style="margin-bottom:1.5rem">
        <button class="btn btn-primary" onclick="nuevoDoctor()">+ Alta Doctor</button>
      </div>
      <div class="table-container">
        <div class="table-header"><h3>Personal Médico</h3></div>
        <table><thead><tr><th>Doctor</th><th>Especialidad</th><th>Cédula</th><th>Turno</th><th>Horario</th></tr></thead>
        <tbody>${filas}</tbody></table></div></div>`;
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
        <div class="form-group"><label>Fecha de Nacimiento*</label><input id="nd-nac" type="date"></div>
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
}

/* ── FARMACIA Y SERVICIOS ─────────────────────────── */
async function renderFarmacia(container) {
    const [meds, servs, ventas] = await Promise.all([
        farmacia.obtenerMedicamentos(), farmacia.obtenerServicios(), farmacia.obtenerVentas()
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
                onclick="editarMedicamentoModal(${m.Id_Farmacia},'${m.Nombre.replace(/'/g,"\\'")}',${m.Precio},'${(m.Unidad||'').replace(/'/g,"\\'")}',${m.Stock},'${(m.Descripcion||'').replace(/'/g,"\\'")}')">
                ✏️ Editar
            </button>
            <button class="btn btn-sm btn-danger"
                onclick="eliminarMedicamentoModal(${m.Id_Farmacia},'${m.Nombre.replace(/'/g,"\\'")}')">
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
            await farmacia.actualizarMedicamento(id, {
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
            await farmacia.eliminarMedicamento(id);
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
            await farmacia.actualizarServicio(id, {
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
            await farmacia.eliminarServicio(id);
            toast(`"${nombre}" eliminado correctamente.`, 'success');
            cerrarModal(); loadView('farmacia');
        }, 'Eliminar', 'btn-danger');
}


async function nuevaVentaModal() {
    const [meds, servs] = await Promise.all([farmacia.obtenerMedicamentos(), farmacia.obtenerServicios()]);
    let items = [];
    const renderItems = () => items.map((item,i) => `
      <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem">
        <span style="flex:1">${item.tipo==='farmacia'?'Med':'Serv'} ${item.nombre}</span>
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
          <select id="v-tipo"><option value="farmacia">Medicamento</option><option value="servicio">Servicio</option></select>
        </div>
        <div class="form-group"><label>Producto/Servicio</label>
          <select id="v-item">
            ${meds.map(m=>`<option value="${m.Id_Farmacia}" data-tipo="farmacia" data-precio="${m.Precio}" data-nombre="${m.Nombre}">${m.Nombre} – ${utils.formatearMoneda(m.Precio)}</option>`).join('')}
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
            const res = await farmacia.realizarVenta(payload);
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
            await farmacia.crearMedicamento({nombre:g('nm-nom'),precio:parseFloat(g('nm-pre')),unidad:g('nm-uni'),stock:parseInt(g('nm-stk')),descripcion:g('nm-des')});
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
            await farmacia.crearServicio({nombre:g('ns-nom'),precio:parseFloat(g('ns-pre')),descripcion:g('ns-des')});
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
        recepcionista.listarSolicitudesCompra('Pendiente')
    ]);

    const badgeCancelaciones = cancelaciones.length
        ? `<span style="background:#ef4444;color:#fff;border-radius:999px;padding:.1rem .45rem;font-size:.75rem;margin-left:.35rem">${cancelaciones.length}</span>` : '';
    const badgeCompras = comprasPend.length
        ? `<span style="background:#ef4444;color:#fff;border-radius:999px;padding:.1rem .45rem;font-size:.75rem;margin-left:.35rem">${comprasPend.length}</span>` : '';

    container.innerHTML = `<div class="view-content">
      <div style="display:flex;gap:.4rem;margin-bottom:1.5rem;flex-wrap:wrap;
                  background:#f1f5f9;border-radius:12px;padding:.35rem">
        <button class="farm-tab active" data-tab="sol-cancel"
                onclick="switchSolTab('sol-cancel')">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="14" cy="14" r="2.5"/><path d="M6 4V9C6 11.21 7.79 13 10 13H11.5"/><path d="M4 4H8M6 2V6"/></svg>
          <span>Cancelaciones</span>
          ${cancelaciones.length
            ? `<span class="farm-tab-count" style="background:#ef4444;color:#fff">${cancelaciones.length}</span>`
            : `<span class="farm-tab-count">0</span>`}
        </button>
        <button class="farm-tab" data-tab="sol-compra"
                onclick="switchSolTab('sol-compra')">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6H17L15.5 16H4.5L3 6Z"/><path d="M1 3H19"/><circle cx="7.5" cy="18.5" r="1"/><circle cx="12.5" cy="18.5" r="1"/></svg>
          <span>Compras pendientes</span>
          ${comprasPend.length
            ? `<span class="farm-tab-count" style="background:#ef4444;color:#fff">${comprasPend.length}</span>`
            : `<span class="farm-tab-count">0</span>`}
        </button>
      </div>

      <!-- Tab: Cancelaciones de citas -->
      <div id="sol-cancel">
        ${cancelaciones.length ? `
        <div class="table-container">
          <table>
            <thead><tr><th>Folio Cita</th><th>Doctor</th><th>Paciente</th><th>Motivo</th><th>Fecha Sol.</th><th>Acciones</th></tr></thead>
            <tbody>
              ${cancelaciones.map(s => `<tr>
                <td>#${String(s.Folio_Cita).padStart(5,'0')}</td>
                <td>${s.NombreDoctor||''} ${s.ApPaternoDoctor||''}</td>
                <td>${s.NombrePaciente||''} ${s.ApPaternoPaciente||''}</td>
                <td style="max-width:180px;white-space:normal">${s.Motivo||'—'}</td>
                <td>${utils.formatearFecha(s.Fecha_Solicitud)}</td>
                <td style="display:flex;gap:.35rem">
                  <button class="btn btn-sm btn-primary"
                    onclick="aprobarCancelacion(${s.Id_Solicitud})"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 10L8 14L16 6"/></svg> Aprobar</button>
                  <button class="btn btn-sm btn-danger"
                    onclick="rechazarCancelacion(${s.Id_Solicitud})"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 5L15 15M15 5L5 15"/></svg> Rechazar</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` :
        '<div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M7 10L9 12L13 8"/></svg></div><h3>Sin solicitudes de cancelación</h3><p>No hay cancelaciones pendientes.</p></div>'}
      </div>

      <!-- Tab: Solicitudes de compra de pacientes -->
      <div id="sol-compra" style="display:none">
        ${comprasPend.length ? `
        <div class="table-container">
          <table>
            <thead><tr><th>Folio</th><th>Paciente</th><th>Teléfono</th><th>Total</th><th>Fecha</th><th>Acciones</th></tr></thead>
            <tbody>
              ${comprasPend.map(s => `<tr>
                <td>#${String(s.Id_Solicitud).padStart(4,'0')}</td>
                <td>${s.NombrePaciente} ${s.ApPaternoPaciente}</td>
                <td>${s.TelefonoPaciente||'—'}</td>
                <td><strong>$${parseFloat(s.Total).toFixed(2)}</strong></td>
                <td>${utils.formatearFecha(s.Fecha_Solicitud)}</td>
                <td style="display:flex;gap:.35rem">
                  <button class="btn btn-sm btn-primary"
                    onclick="verDetalleSolicitudCompra(${s.Id_Solicitud},'${s.NombrePaciente} ${s.ApPaternoPaciente}',${s.Total})">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 10C2 10 5 5 10 5C15 5 18 10 18 10C18 10 15 15 10 15C5 15 2 10 2 10Z"/><circle cx="10" cy="10" r="2.5"/></svg> Ver
                  </button>
                  <button class="btn btn-sm btn-success"
                    onclick="procesarCompra(${s.Id_Solicitud})"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 10L8 14L16 6"/></svg> Procesar</button>
                  <button class="btn btn-sm btn-danger"
                    onclick="rechazarCompra(${s.Id_Solicitud})"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 5L15 15M15 5L5 15"/></svg> Rechazar</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` :
        '<div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6H17L15.5 16H4.5L3 6Z"/><path d="M1 3H19"/><circle cx="7.5" cy="18.5" r="1"/><circle cx="12.5" cy="18.5" r="1"/></svg></div><h3>Sin solicitudes de compra</h3><p>No hay compras pendientes de pacientes.</p></div>'}
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

async function verDetalleSolicitudCompra(id, paciente, total) {
    let detalle = [];
    try { detalle = await farmacia.detalleSolicitud(id); } catch(e) {}

    const filas = detalle.map(d => `<tr>
        <td>${d.NombreFarmacia || d.NombreServicio}</td>
        <td>${d.Cantidad}</td>
        <td>$${parseFloat(d.Subtotal).toFixed(2)}</td>
    </tr>`).join('') || '<tr><td colspan="3">Sin detalle</td></tr>';

    abrirModal(`Solicitud #${String(id).padStart(4,'0')} — ${paciente}`, `
      <table>
        <thead><tr><th>Producto / Servicio</th><th>Cantidad</th><th>Subtotal</th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr>
          <td colspan="2" style="text-align:right;font-weight:700">Total</td>
          <td style="font-weight:700">$${parseFloat(total).toFixed(2)}</td>
        </tr></tfoot>
      </table>`,
        async () => { await procesarCompra(id); },
        'Procesar'
    );
}

async function procesarCompra(id) {
    try {
        const res = await recepcionista.procesarSolicitudCompra(id);
        toast(`Solicitud procesada. Venta #${String(res.id_venta).padStart(4,'0')} registrada.`, 'success');
        cerrarModal();
        loadView('solicitudes');
    } catch(e) {
        toast(e.message || 'Error al procesar.', 'error');
    }
}

async function rechazarCompra(id) {
    abrirModal('Rechazar solicitud de compra', `
      <div class="form-group">
        <label>Motivo del rechazo (opcional)</label>
        <input id="rc-motivo" placeholder="Ej: producto sin stock temporal, solicitar en mostrador…">
      </div>`,
        async () => {
            const motivo = document.getElementById('rc-motivo').value.trim();
            await recepcionista.rechazarSolicitudCompra(id, motivo);
            toast('Solicitud rechazada.', 'success');
            cerrarModal();
            loadView('solicitudes');
        }, 'Rechazar', 'btn-danger');
}

async function aprobarSolicitud(id) {
    if (!confirm('¿Aprobar esta cancelación? Se procesará un reembolso del 100% al paciente.')) return;
    try {
        await recepcionista.aprobarCancelacion(id);
        toast('Cancelación aprobada. Reembolso del 100% procesado.','success');
        loadView('solicitudes');
    } catch(e) { toast(e.message,'error'); }
}

async function rechazarSolicitud(id) {
    if (!confirm('¿Rechazar esta solicitud de cancelación?')) return;
    try {
        await recepcionista.rechazarCancelacion(id);
        toast('Solicitud rechazada.','warning');
        loadView('solicitudes');
    } catch(e) { toast(e.message,'error'); }
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
function badgeEstatus(clave) {
    const m={'agendada_pendiente_pago':['warning','Pend. Pago'],'pagada_pendiente_atender':['info','Confirmada'],'cancelada_falta_pago':['error','Canc. Pago'],'cancelada_paciente':['error','Cancelada'],'cancelada_doctor':['error','Canc. Doctor'],'atendida':['success','Atendida'],'no_acudio':['neutral','No Acudio']};
    const [c,t]=m[clave]||['neutral',clave];
    return `<span class="badge badge-${c}">${t}</span>`;
}

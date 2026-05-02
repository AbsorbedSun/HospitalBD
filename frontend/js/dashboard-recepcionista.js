/**
 * Dashboard Recepcionista – MediConnect
 * Completamente funcional con llamadas reales al backend Flask.
 */

const STATE = { user: null, todasCitas: [], todosPacientes: [], todosDoctores: [], solicitudes: [] };

document.addEventListener('DOMContentLoaded', async () => {
    const user = auth.getCurrentUser();
    if (!user || !['recepcionista','admin'].includes(user.rol)) { window.location.href = 'login.html'; return; }
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
        }
    } catch(err) {
        container.innerHTML=`<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error</h3><p>${err.message}</p></div>`;
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
          <div style="font-size:3rem">🏥</div>
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
        <div class="info-card stat-card"><div class="stat-icon">📅</div><div class="stat-value">${stats.CitasHoy||0}</div><div class="stat-label">Citas Hoy</div></div>
        <div class="info-card stat-card"><div class="stat-icon">⏳</div><div class="stat-value">${stats.PendientesPago||0}</div><div class="stat-label">Pendientes de Pago</div></div>
        <div class="info-card stat-card"><div class="stat-icon">👥</div><div class="stat-value">${stats.TotalPacientes||0}</div><div class="stat-label">Total Pacientes</div></div>
        <div class="info-card stat-card"><div class="stat-icon">🩺</div><div class="stat-value">${stats.DoctoresActivos||0}</div><div class="stat-label">Doctores Activos</div></div>
        <div class="info-card stat-card">
          <div class="stat-icon">🔔</div>
          <div class="stat-value" style="${stats.SolicitudesPendientes>0?'color:var(--error)':''}">${stats.SolicitudesPendientes||0}</div>
          <div class="stat-label">Solicitudes Pendientes</div>
          ${stats.SolicitudesPendientes>0?`<button class="btn btn-sm btn-danger" style="margin-top:.75rem" onclick="irVista('solicitudes')">Ver Solicitudes</button>`:''}
        </div>
      </div>

      <!-- Acciones rápidas -->
      <div class="info-card" style="margin-top:1.5rem">
        <div class="info-header"><h3>Acciones Rápidas</h3></div>
        <div style="display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1rem">
          <button class="btn btn-primary"   onclick="irVista('citas')">📅 Ver Citas</button>
          <button class="btn btn-secondary" onclick="nuevoDoctor()">+ Alta Doctor</button>
          <button class="btn btn-secondary" onclick="irVista('farmacia')">💊 Venta Mostrador</button>
          <button class="btn btn-secondary" onclick="irVista('pacientes')">👥 Pacientes</button>
          <button class="btn btn-secondary" onclick="irVista('bitacoras')">📋 Bitácoras</button>
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
        `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📭</div><h3>Sin citas</h3></div></td></tr>`;
    container.innerHTML = `<div class="view-content"><div class="table-container">
      <div class="table-header"><h3>Todas las Citas</h3>
        <div class="table-filters">
          <input type="date" class="filter-input" id="rf-fecha">
          <select class="filter-select" id="rf-est">
            <option value="">Todos</option>
            <option value="agendada_pendiente_pago">Pend. Pago</option>
            <option value="pagada_pendiente_atender">Confirmadas</option>
            <option value="atendida">Atendidas</option>
            <option value="cancelada_paciente">Canceladas</option>
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
      `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👥</div><h3>Sin pacientes</h3></div></td></tr>`;
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
      `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🩺</div><h3>Sin doctores</h3></div></td></tr>`;
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
    container.innerHTML = `<div class="view-content">
      <div style="margin-bottom:1.5rem;display:flex;gap:1rem;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="nuevaVentaModal()">💰 Nueva Venta</button>
        <button class="btn btn-secondary" onclick="nuevoMedicamento()">+ Medicamento</button>
        <button class="btn btn-secondary" onclick="nuevoServicio()">+ Servicio</button>
      </div>
      <div class="info-grid">
        <div class="table-container">
          <div class="table-header"><h3>💊 Medicamentos</h3></div>
          <table><thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Unidad</th><th>Acción</th></tr></thead>
          <tbody>${meds.map(m=>`<tr>
              <td><strong>${m.Nombre}</strong><div style="font-size:.8rem;color:var(--text-secondary)">${m.Descripcion||''}</div></td>
              <td>${utils.formatearMoneda(m.Precio)}</td>
              <td><span class="badge ${m.Stock<10?'badge-error':m.Stock<30?'badge-warning':'badge-success'}">${m.Stock}</span></td>
              <td>${m.Unidad}</td>
              <td><button class="btn btn-sm btn-secondary" onclick="editarStockModal(${m.Id_Farmacia},'${m.Nombre}',${m.Stock})">Stock</button></td>
            </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">Sin medicamentos</td></tr>'}
          </tbody></table>
        </div>
        <div class="table-container">
          <div class="table-header"><h3>🏥 Servicios Extra</h3></div>
          <table><thead><tr><th>Servicio</th><th>Precio</th></tr></thead>
          <tbody>${servs.map(s=>`<tr><td>${s.Nombre}</td><td>${utils.formatearMoneda(s.Precio)}</td></tr>`).join('')||'<tr><td colspan="2" style="text-align:center">Sin servicios</td></tr>'}
          </tbody></table>
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

async function nuevaVentaModal() {
    const [meds, servs] = await Promise.all([farmacia.obtenerMedicamentos(), farmacia.obtenerServicios()]);
    let items = [];
    const renderItems = () => items.map((item,i) => `
      <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem">
        <span style="flex:1">${item.tipo==='farmacia'?'💊':'🏥'} ${item.nombre}</span>
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
            ${meds.map(m=>`<option value="${m.Id_Farmacia}" data-tipo="farmacia" data-precio="${m.Precio}" data-nombre="${m.Nombre}">💊 ${m.Nombre} – ${utils.formatearMoneda(m.Precio)}</option>`).join('')}
            ${servs.map(s=>`<option value="${s.Id_Servicio}" data-tipo="servicio" data-precio="${s.Precio}" data-nombre="${s.Nombre}">🏥 ${s.Nombre} – ${utils.formatearMoneda(s.Precio)}</option>`).join('')}
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

async function editarStockModal(id, nombre, stockActual) {
    abrirModal(`Actualizar Stock – ${nombre}`, `
      <div class="form-group"><label>Nuevo stock</label>
        <input id="es-stock" type="number" min="0" value="${stockActual}">
      </div>`,
        async () => {
            const s = parseInt(document.getElementById('es-stock').value);
            await farmacia.actualizarMedicamento(id,{stock:s});
            toast('Stock actualizado.','success'); cerrarModal(); loadView('farmacia');
        });
}

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
    STATE.solicitudes = await recepcionista.listarSolicitudesCancelacion();
    const filas = STATE.solicitudes.length ? STATE.solicitudes.map(s => `<tr>
        <td>#${String(s.Folio_Cita).padStart(5,'0')}</td>
        <td>Dr. ${s.NombreDoctor} ${s.ApDoc}</td>
        <td>${s.NombrePaciente} ${s.ApPac}</td>
        <td>${utils.formatearFecha(s.Fecha_Cita)} ${utils.formatearHora(s.Hora_Cita)}</td>
        <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${s.Motivo}">${s.Motivo}</td>
        <td>${utils.formatearFecha(s.Fecha_Solicitud)}</td>
        <td>
          <button class="btn btn-sm btn-success" onclick="aprobarSolicitud(${s.Id_Solicitud})">✓ Aprobar</button>
          <button class="btn btn-sm btn-danger" onclick="rechazarSolicitud(${s.Id_Solicitud})">✗ Rechazar</button>
        </td></tr>`).join('') :
        `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">✅</div><h3>Sin solicitudes pendientes</h3><p>No hay solicitudes de cancelación por revisar.</p></div></td></tr>`;
    container.innerHTML = `<div class="view-content"><div class="table-container">
      <div class="table-header"><h3>Solicitudes de Cancelación Pendientes
        ${STATE.solicitudes.length ? `<span class="badge badge-error" style="margin-left:.5rem">${STATE.solicitudes.length}</span>` : ''}
      </h3></div>
      <table><thead><tr><th>Folio Cita</th><th>Doctor</th><th>Paciente</th><th>Fecha/Hora Cita</th><th>Motivo</th><th>Solicitada</th><th>Acciones</th></tr></thead>
      <tbody>${filas}</tbody></table></div></div>`;
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
    const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
    const el=document.createElement('div'); el.className=`toast ${type}`;
    el.innerHTML=`<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span><button class="toast-x" onclick="this.parentElement.remove()">×</button>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(()=>{ el.style.animation='toastOut .3s ease forwards'; setTimeout(()=>el.remove(),300); },4500);
}

const ir = (l,v)=>`<div class="info-row"><span class="label">${l}</span><span class="value">${v??'—'}</span></div>`;
function badgeEstatus(clave) {
    const m={'agendada_pendiente_pago':['warning','🕐 Pend. Pago'],'pagada_pendiente_atender':['info','✅ Confirmada'],'cancelada_falta_pago':['error','❌ Canc. Pago'],'cancelada_paciente':['error','❌ Cancelada'],'cancelada_doctor':['error','❌ Canc. Doctor'],'atendida':['success','✓ Atendida'],'no_acudio':['neutral','— No Acudió']};
    const [c,t]=m[clave]||['neutral',clave];
    return `<span class="badge badge-${c}">${t}</span>`;
}

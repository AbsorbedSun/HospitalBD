/**
 * Dashboard Paciente – MediConnect
 * JS completamente funcional con llamadas reales al backend Flask.
 */

const STATE = {
    user: null, perfil: null, citas: [], historial: null,
    especialidades: [],
    agendar: { paso: 1, especialidad: null, doctor: null, fecha: null, hora: null }
};

document.addEventListener('DOMContentLoaded', async () => {
    const user = auth.getCurrentUser();
    if (!user || user.rol !== 'paciente') { window.location.href = 'login.html'; return; }
    STATE.user = user;
    document.getElementById('userName').textContent = `${user.nombre} ${user.ap_paterno}`;
    document.getElementById('userInitials').textContent = (user.nombre[0] + user.ap_paterno[0]).toUpperCase();
    if (!document.getElementById('toast-container')) {
        const tc = document.createElement('div'); tc.id = 'toast-container'; document.body.appendChild(tc);
    }
    const navItems = document.querySelectorAll('.nav-item:not(.logout-btn)');
    navItems.forEach(item => item.addEventListener('click', function () {
        navItems.forEach(n => n.classList.remove('active'));
        this.classList.add('active');
        loadView(this.dataset.view);
    }));
    document.getElementById('logoutBtn').addEventListener('click', () => { if (confirm('¿Cerrar sesión?')) auth.logout(); });
    loadView('datos-personales');
});

const VIEWS = {
    'datos-personales': { title: 'Datos Personales',   subtitle: 'Tu información registrada' },
    'citas-agendadas':  { title: 'Mis Citas',          subtitle: 'Historial y gestión de citas' },
    'agendar-cita':     { title: 'Agendar Nueva Cita', subtitle: 'Programa tu próxima consulta' },
    'historial-medico': { title: 'Historial Médico',   subtitle: 'Tu información de salud' },
};

async function loadView(viewName) {
    const container = document.getElementById('contentContainer');
    const info = VIEWS[viewName] || {};
    document.getElementById('pageTitle').textContent    = info.title    || viewName;
    document.getElementById('pageSubtitle').textContent = info.subtitle || '';
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    try {
        switch (viewName) {
            case 'datos-personales': await renderDatosPersonales(container); break;
            case 'citas-agendadas':  await renderCitas(container);           break;
            case 'agendar-cita':     await renderAgendarCita(container);     break;
            case 'historial-medico': await renderHistorialMedico(container); break;
        }
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error</h3><p>${err.message}</p></div>`;
    }
}

/* ── DATOS PERSONALES ─────────────────────────────── */
async function renderDatosPersonales(container) {
    const [perfil, misCitas] = await Promise.all([paciente.obtenerPerfil(), citas.obtenerMisCitas()]);
    STATE.perfil = perfil; STATE.citas = misCitas;
    const prog = misCitas.filter(c => ['agendada_pendiente_pago','pagada_pendiente_atender'].includes(c.Estatus)).length;
    const comp = misCitas.filter(c => c.Estatus === 'atendida').length;
    const canc = misCitas.filter(c => (c.Estatus||'').startsWith('cancelada')).length;
    container.innerHTML = `<div class="view-content">
      <div class="stats-grid">
        <div class="info-card stat-card"><div class="stat-icon">📅</div><div class="stat-value">${prog}</div><div class="stat-label">Citas Programadas</div></div>
        <div class="info-card stat-card"><div class="stat-icon">✅</div><div class="stat-value">${comp}</div><div class="stat-label">Citas Completadas</div></div>
        <div class="info-card stat-card"><div class="stat-icon">❌</div><div class="stat-value">${canc}</div><div class="stat-label">Citas Canceladas</div></div>
        <div class="info-card stat-card"><div class="stat-icon">📋</div><div class="stat-value">${misCitas.length}</div><div class="stat-label">Total de Citas</div></div>
      </div>
      <div class="info-grid">
        <div class="info-card">
          <div class="info-header"><h3>Información Personal</h3>
            <button class="btn-icon btn-sm" onclick="abrirModalEditar()">✏️ Editar</button>
          </div>
          <div class="info-body">
            ${ir('Nombre Completo', `${perfil.Nombre} ${perfil.Ap_Paterno} ${perfil.Ap_Materno||''}`)}
            ${ir('CURP', perfil.CURP)}
            ${ir('Fecha Nac.', utils.formatearFecha(perfil.Fecha_Nac))}
            ${ir('Edad', `${perfil.Edad} años`)}
          </div>
        </div>
        <div class="info-card">
          <div class="info-header"><h3>Contacto</h3></div>
          <div class="info-body">
            ${ir('Email',    perfil.Email)}
            ${ir('Teléfono', perfil.Telefono || '—')}
            ${ir('Calle',    perfil.Calle    || '—')}
            ${ir('Colonia',  perfil.Colonia  || '—')}
          </div>
        </div>
      </div></div>`;
}

function abrirModalEditar() {
    const p = STATE.perfil;
    abrirModal('Editar Datos de Contacto', `
      <div class="form-grid">
        <div class="form-group"><label>Teléfono</label><input id="e-tel" value="${p.Telefono||''}"></div>
        <div class="form-group"><label>Calle</label><input id="e-calle" value="${p.Calle||''}"></div>
        <div class="form-group"><label>Número</label><input id="e-num" value="${p.Numero||''}"></div>
        <div class="form-group"><label>Colonia</label><input id="e-col" value="${p.Colonia||''}"></div>
      </div>`,
        async () => {
            await paciente.actualizarPerfil({ telefono: document.getElementById('e-tel').value, calle: document.getElementById('e-calle').value, numero: document.getElementById('e-num').value, colonia: document.getElementById('e-col').value });
            toast('Datos actualizados.', 'success'); cerrarModal(); loadView('datos-personales');
        });
}

/* ── CITAS AGENDADAS ──────────────────────────────── */
async function renderCitas(container) {
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
        `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📭</div><h3>Sin citas</h3><p>No tienes citas aún.</p></div></td></tr>`;
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
async function renderAgendarCita(container) {
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
        <div class="comprobante-aviso">⏰ Tendrás <strong>8 horas</strong> para realizar el pago. Sin pago, la cita se cancelará automáticamente.</div>
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
            <div class="comprobante-aviso">⏰ ${res.aviso_pago}</div>
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

/* ── HISTORIAL MÉDICO ─────────────────────────────── */
async function renderHistorialMedico(container) {
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
            `<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">📋</div><h3>Sin consultas atendidas</h3></div></td></tr>`}
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
    const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
    const el=document.createElement('div'); el.className=`toast ${type}`;
    el.innerHTML=`<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span><button class="toast-x" onclick="this.parentElement.remove()">×</button>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(()=>{ el.style.animation='toastOut .3s ease forwards'; setTimeout(()=>el.remove(),300); },4500);
}

/* ── HELPERS ──────────────────────────────────────── */
const ir = (l,v)=>`<div class="info-row"><span class="label">${l}</span><span class="value">${v??'—'}</span></div>`;
const cr = (l,v)=>`<div class="comprobante-row"><span>${l}</span><strong>${v}</strong></div>`;
function badgeEstatus(clave) {
    const m={'agendada_pendiente_pago':['warning','🕐 Pend. Pago'],'pagada_pendiente_atender':['info','✅ Confirmada'],'cancelada_falta_pago':['error','❌ Canc. Pago'],'cancelada_paciente':['error','❌ Cancelada'],'cancelada_doctor':['error','❌ Canc. Doctor'],'atendida':['success','✓ Atendida'],'no_acudio':['neutral','— No Acudió']};
    const [c,t]=m[clave]||['neutral',clave];
    return `<span class="badge badge-${c}">${t}</span>`;
}


// Home Interactions
document.addEventListener('DOMContentLoaded', function() {
    const navbar = document.querySelector('.navbar');

    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
        } else {
            navbar.style.boxShadow = 'none';
        }
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Cargar catálogo público al iniciar
    cargarCatalogo();
});

// ── CATÁLOGO PÚBLICO ───────────────────────────────────────────────────
let _catalogoMeds   = [];
let _catalogoServs  = [];
let _tabActual      = 'medicamentos';

async function cargarCatalogo() {
    try {
        const res  = await fetch('/api/medicamentos/catalogo');
        if (!res.ok) throw new Error('Error al cargar catálogo');
        const data = await res.json();
        _catalogoMeds  = data.medicamentos || [];
        _catalogoServs = data.servicios    || [];
        renderCatalogo();
    } catch (e) {
        document.getElementById('tab-medicamentos').innerHTML =
            '<p class="catalogo-error">No se pudo cargar el catálogo. Intenta más tarde.</p>';
        document.getElementById('tab-servicios').innerHTML = '';
    }
}

function renderCatalogo() {
    renderTabMeds(_catalogoMeds);
    renderTabServs(_catalogoServs);
}

function renderTabMeds(lista) {
    const contenedor = document.getElementById('tab-medicamentos');
    if (!lista.length) {
        contenedor.innerHTML = '<p class="catalogo-vacio-inner">Sin medicamentos disponibles en este momento.</p>';
        return;
    }
    contenedor.innerHTML = lista.map(m => `
        <div class="catalogo-card" data-nombre="${m.Nombre.toLowerCase()} ${(m.Descripcion||'').toLowerCase()}">
            <div class="catalogo-card-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14.24 5.76C15.58 7.1 15.58 9.27 14.24 10.62L10.62 14.24C9.27 15.58 7.1 15.58 5.76 14.24C4.42 12.9 4.42 10.73 5.76 9.38L9.38 5.76C10.73 4.42 12.9 4.42 14.24 5.76Z"/><line x1="7.1" y1="7.1" x2="12.9" y2="12.9"/></svg></div>
            <div class="catalogo-card-body">
                <h4>${m.Nombre}</h4>
                ${m.Descripcion ? `<p>${m.Descripcion}</p>` : ''}
            </div>
            <div class="catalogo-card-footer">
                <span class="catalogo-precio">$${parseFloat(m.Precio).toFixed(2)}</span>
                <span class="catalogo-badge ${m.AlertaStock==='Agotado'||m.AlertaStock==='Stock Crítico'?'badge-warn':'badge-ok'}">
                    ${m.AlertaStock||'Disponible'}
                </span>
                <span class="catalogo-unidad">${m.Unidad}</span>
            </div>
            ${m.AlertaStock !== 'Agotado' ? `<button class="farm-add-btn" onclick="carritoAgregar('medicamento',${m.Id_Medicamento},'${m.Nombre.replace(/'/g,"\\'")}',${m.Precio})">+ Agregar</button>` : `<button class="farm-add-btn" disabled style="opacity:.4;cursor:not-allowed">Sin stock</button>`}
        </div>`).join('');
}

function renderTabServs(lista) {
    const contenedor = document.getElementById('tab-servicios');
    if (!lista.length) {
        contenedor.innerHTML = '<p class="catalogo-vacio-inner">Sin servicios disponibles en este momento.</p>';
        return;
    }
    contenedor.innerHTML = lista.map(s => `
        <div class="catalogo-card" data-nombre="${s.Nombre.toLowerCase()} ${(s.Descripcion||'').toLowerCase()}">
            <div class="catalogo-card-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="7" width="14" height="11" rx="1"/><path d="M1 7L10 2L19 7"/><path d="M10 10V15M7.5 12.5H12.5"/></svg></div>
            <div class="catalogo-card-body">
                <h4>${s.Nombre}</h4>
                ${s.Descripcion ? `<p>${s.Descripcion}</p>` : ''}
            </div>
            <div class="catalogo-card-footer">
                <span class="catalogo-precio">$${parseFloat(s.Precio).toFixed(2)}</span>
                <span class="catalogo-badge badge-ok">Disponible</span>
            </div>
            <button class="farm-add-btn" onclick="carritoAgregar('servicio',${s.Id_Servicio},'${s.Nombre.replace(/'/g,"\\'")}',${s.Precio})">+ Agregar</button>
        </div>`).join('');
}

function switchTab(tab) {
    _tabActual = tab;
    document.getElementById('tab-medicamentos').style.display = tab === 'medicamentos' ? 'grid' : 'none';
    document.getElementById('tab-servicios').style.display    = tab === 'servicios'    ? 'grid' : 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('catalogo-buscar').value = '';
    document.getElementById('catalogo-vacio').style.display = 'none';
    // Restaurar todas las tarjetas al cambiar pestaña
    document.querySelectorAll(`#tab-${tab} .catalogo-card`).forEach(c => c.style.display = '');
}

function filtrarCatalogo() {
    const q          = document.getElementById('catalogo-buscar').value.toLowerCase().trim();
    const contenedor = document.getElementById(`tab-${_tabActual}`);
    const tarjetas   = contenedor.querySelectorAll('.catalogo-card');
    let   visibles   = 0;

    tarjetas.forEach(card => {
        const match = !q || card.dataset.nombre.includes(q);
        card.style.display = match ? '' : 'none';
        if (match) visibles++;
    });

    document.getElementById('catalogo-vacio').style.display =
        visibles === 0 && q ? 'block' : 'none';
}


/* ================================================================
   CARRITO PÚBLICO — sin autenticación requerida
   Permite a cualquier persona agregar artículos y generar
   una solicitud de compra que la recepcionista procesará.
   ================================================================ */

const _carrito = [];   // { tipo, id, nombre, precio, cantidad }
const API_BASE = (window.CONFIG?.API_URL) || '/api';

// ── Actualizar badge del botón flotante ────────────────────────
function _carritoActualizarBadge() {
    const total = _carrito.reduce((s, i) => s + i.cantidad, 0);
    const badge = document.getElementById('carrito-badge');
    const btn   = document.getElementById('carrito-btn');
    if (!badge || !btn) return;
    if (total > 0) {
        badge.textContent = total;
        badge.style.display = 'flex';
        btn.style.display = 'flex';
    } else {
        badge.style.display = 'none';
        btn.style.display   = 'none';
    }
}

// ── Agregar artículo al carrito ────────────────────────────────
function carritoAgregar(tipo, id, nombre, precio) {
    const existing = _carrito.find(i => i.tipo === tipo && i.id === id);
    if (existing) {
        existing.cantidad++;
    } else {
        _carrito.push({ tipo, id, nombre, precio, cantidad: 1 });
    }
    _carritoActualizarBadge();
    _mostrarToastCarrito(nombre);
}

function _mostrarToastCarrito(nombre) {
    const t = document.createElement('div');
    t.style.cssText = `
        position:fixed;bottom:5.5rem;right:1.5rem;z-index:10000;
        background:#0f172a;color:#e6c280;font-size:.82rem;font-weight:600;
        padding:.6rem 1rem;border-radius:10px;
        box-shadow:0 4px 16px rgba(0,0,0,.3);
        animation:toastIn .3s cubic-bezier(.16,1,.3,1);
    `;
    t.textContent = `"${nombre}" agregado al carrito`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
}

// ── Panel del carrito (slide-in lateral) ──────────────────────
function carritoAbrir() {
    let panel = document.getElementById('carrito-panel');
    if (panel) { panel.classList.add('open'); return; }

    panel = document.createElement('div');
    panel.id = 'carrito-panel';
    panel.innerHTML = `
      <div id="carrito-overlay" onclick="carritoCerrar()" style="
        position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;
        animation:fadeIn .2s ease"></div>
      <div style="
        position:fixed;top:0;right:0;bottom:0;width:min(380px,100vw);
        background:#fff;z-index:9001;display:flex;flex-direction:column;
        box-shadow:-4px 0 24px rgba(0,0,0,.15);animation:slideInRight .3s cubic-bezier(.16,1,.3,1)">
        <!-- Header -->
        <div style="padding:1.25rem 1.5rem;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:1rem;font-weight:700;color:#0f172a;font-family:'Playfair Display',serif">🛒 Tu Carrito</div>
          <button onclick="carritoCerrar()" style="background:none;border:none;font-size:1.3rem;color:#64748b;cursor:pointer;padding:.25rem">×</button>
        </div>
        <!-- Items -->
        <div id="carrito-items" style="flex:1;overflow-y:auto;padding:1rem 1.5rem"></div>
        <!-- Footer -->
        <div style="padding:1.25rem 1.5rem;border-top:1px solid #e2e8f0">
          <div id="carrito-total" style="font-size:1.1rem;font-weight:700;color:#0f172a;margin-bottom:1rem;display:flex;justify-content:space-between">
            <span>Total</span><span id="carrito-total-valor">$0.00</span>
          </div>
          <button onclick="carritoCheckout()" style="
            width:100%;padding:.85rem;background:#121e31;color:#e6c280;
            font-weight:700;font-size:.95rem;border:none;border-radius:12px;
            cursor:pointer;font-family:'Manrope',sans-serif;
            transition:background .2s" onmouseover="this.style.background='#0e1828'" onmouseout="this.style.background='#121e31'">
            Continuar con mi solicitud →
          </button>
          <p style="text-align:center;font-size:.75rem;color:#94a3b8;margin-top:.6rem">
            Sin registro previo · Presenta tu folio en mostrador
          </p>
        </div>
      </div>`;
    document.body.appendChild(panel);
    _carritoRenderItems();
}

function _carritoRenderItems() {
    const cont  = document.getElementById('carrito-items');
    const valor = document.getElementById('carrito-total-valor');
    if (!cont) return;

    if (!_carrito.length) {
        cont.innerHTML = `<div style="text-align:center;padding:2rem 0;color:#94a3b8">
            <div style="font-size:2.5rem;margin-bottom:.5rem">🛒</div>
            <div style="font-size:.9rem">El carrito está vacío</div>
        </div>`;
        if (valor) valor.textContent = '$0.00';
        return;
    }

    const total = _carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
    cont.innerHTML = _carrito.map((item, idx) => `
        <div style="display:flex;align-items:center;gap:.75rem;padding:.875rem 0;border-bottom:1px solid #f1f5f9">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:.88rem;color:#0f172a;margin-bottom:.15rem">${item.nombre}</div>
            <div style="font-size:.78rem;color:#64748b">${item.tipo === 'medicamento' ? 'Medicamento' : 'Servicio'} · $${item.precio.toFixed(2)} c/u</div>
          </div>
          <div style="display:flex;align-items:center;gap:.35rem;flex-shrink:0">
            <button onclick="carritoDecrement(${idx})" style="width:26px;height:26px;border-radius:50%;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;font-size:1rem;color:#64748b;display:flex;align-items:center;justify-content:center">−</button>
            <span style="font-weight:700;font-size:.9rem;min-width:20px;text-align:center">${item.cantidad}</span>
            <button onclick="carritoIncrement(${idx})" style="width:26px;height:26px;border-radius:50%;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;font-size:1rem;color:#64748b;display:flex;align-items:center;justify-content:center">+</button>
            <button onclick="carritoEliminar(${idx})" style="width:26px;height:26px;border-radius:50%;border:none;background:#fee2e2;cursor:pointer;color:#dc2626;font-size:.8rem;display:flex;align-items:center;justify-content:center;margin-left:.15rem">✕</button>
          </div>
          <div style="font-weight:700;font-size:.9rem;color:#121e31;min-width:52px;text-align:right">$${(item.precio * item.cantidad).toFixed(2)}</div>
        </div>`).join('');
    if (valor) valor.textContent = '$' + total.toFixed(2);
}

function carritoCerrar() {
    const p = document.getElementById('carrito-panel');
    if (p) p.remove();
}

function carritoIncrement(idx) { _carrito[idx].cantidad++; _carritoActualizarBadge(); _carritoRenderItems(); }
function carritoDecrement(idx) {
    _carrito[idx].cantidad--;
    if (_carrito[idx].cantidad <= 0) _carrito.splice(idx, 1);
    _carritoActualizarBadge();
    _carritoRenderItems();
}
function carritoEliminar(idx) { _carrito.splice(idx, 1); _carritoActualizarBadge(); _carritoRenderItems(); }

// ── Checkout: formulario de datos y envío ─────────────────────
function carritoCheckout() {
    if (!_carrito.length) return;
    carritoCerrar();

    const overlay = document.createElement('div');
    overlay.id = 'checkout-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn .2s ease';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:2rem;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);animation:slideUp .25s cubic-bezier(.16,1,.3,1)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
          <h2 style="font-family:'Playfair Display',serif;font-size:1.2rem;color:#0f172a">Finalizar Solicitud</h2>
          <button onclick="document.getElementById('checkout-modal').remove()" style="background:none;border:none;font-size:1.3rem;color:#94a3b8;cursor:pointer">×</button>
        </div>

        <div style="background:#f8fafc;border-radius:12px;padding:1rem;margin-bottom:1.25rem;font-size:.85rem">
          ${_carrito.map(i => `<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid #e2e8f0">
            <span style="color:#334155">${i.cantidad}× ${i.nombre}</span>
            <strong style="color:#0f172a">$${(i.precio * i.cantidad).toFixed(2)}</strong>
          </div>`).join('')}
          <div style="display:flex;justify-content:space-between;margin-top:.6rem;font-size:1rem;font-weight:700">
            <span>Total</span>
            <span style="color:#121e31">$${_carrito.reduce((s,i)=>s+i.precio*i.cantidad,0).toFixed(2)}</span>
          </div>
        </div>

        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.75rem;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.4rem">Nombre Completo *</label>
          <input id="co-nombre" placeholder="Ej. María López García" style="width:100%;padding:.7rem 1rem;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.9rem;outline:none;font-family:'Manrope',sans-serif" onfocus="this.style.borderColor='#121e31'" onblur="this.style.borderColor='#e2e8f0'">
        </div>
        <div style="margin-bottom:1.5rem">
          <label style="display:block;font-size:.75rem;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.4rem">Teléfono <span style="font-weight:400;color:#94a3b8">(opcional)</span></label>
          <input id="co-tel" type="tel" placeholder="Ej. 5551234567" style="width:100%;padding:.7rem 1rem;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.9rem;outline:none;font-family:'Manrope',sans-serif" onfocus="this.style.borderColor='#121e31'" onblur="this.style.borderColor='#e2e8f0'">
        </div>

        <button id="co-submit" onclick="carritoEnviar()" style="width:100%;padding:.85rem;background:#121e31;color:#e6c280;font-weight:700;font-size:.95rem;border:none;border-radius:12px;cursor:pointer;font-family:'Manrope',sans-serif">
          Generar mi Solicitud
        </button>
        <p style="text-align:center;font-size:.75rem;color:#94a3b8;margin-top:.75rem">
          No se requiere registro. Presenta tu folio en el mostrador para pagar y retirar.
        </p>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('co-nombre')?.focus(), 100);
}

async function carritoEnviar() {
    const nombre  = document.getElementById('co-nombre')?.value?.trim();
    const telefono = document.getElementById('co-tel')?.value?.trim();
    const btn = document.getElementById('co-submit');

    if (!nombre) {
        document.getElementById('co-nombre').style.borderColor = '#ef4444';
        document.getElementById('co-nombre').placeholder = '⚠ Este campo es obligatorio';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando…';

    try {
        const res = await fetch(`${API_BASE}/compras/solicitar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_cliente:   nombre,
                telefono_cliente: telefono || undefined,
                items: _carrito.map(i => ({ tipo: i.tipo, id: i.id, cantidad: i.cantidad }))
            })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error al generar la solicitud.');

        // Vaciar carrito
        _carrito.length = 0;
        _carritoActualizarBadge();
        document.getElementById('checkout-modal')?.remove();

        // Mostrar ticket de confirmación
        _mostrarTicketConfirmacion(data);

    } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Generar mi Solicitud';
        const errDiv = document.createElement('div');
        errDiv.style.cssText = 'background:#fee2e2;color:#991b1b;border-radius:8px;padding:.75rem 1rem;font-size:.83rem;margin-top:.75rem';
        errDiv.textContent = e.message;
        btn.parentElement.appendChild(errDiv);
        setTimeout(() => errDiv.remove(), 5000);
    }
}

function _mostrarTicketConfirmacion(data) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn .2s ease';

    const total = parseFloat(data.total).toFixed(2);
    const filas = (data.items || []).map(i => `
        <div style="display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid #e2e8f0;font-size:.85rem">
          <span>${i.cantidad}× ${i.nombre}</span>
          <strong>$${i.subtotal.toFixed(2)}</strong>
        </div>`).join('');

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:2rem;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);text-align:center">
        <div style="width:56px;height:56px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:1.6rem">✓</div>
        <h2 style="font-family:'Playfair Display',serif;color:#0f172a;margin-bottom:.25rem">¡Solicitud Registrada!</h2>
        <p style="color:#64748b;font-size:.88rem;margin-bottom:1.5rem">Anota tu folio y preséntate en el mostrador</p>

        <div style="background:#eff2f4;border-radius:14px;padding:1.25rem;margin-bottom:1.25rem;border:2px dashed #a7adb4">
          <div style="font-size:.7rem;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.25rem">Folio de Solicitud</div>
          <div style="font-family:'Playfair Display',serif;font-size:2rem;font-weight:700;color:#121e31">#${String(data.id_solicitud).padStart(5,'0')}</div>
        </div>

        <div style="text-align:left;margin-bottom:1.25rem">
          <div style="font-size:.8rem;font-weight:700;color:#334155;margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.04em">Detalle</div>
          ${filas}
          <div style="display:flex;justify-content:space-between;margin-top:.6rem;font-weight:700;font-size:1rem">
            <span>Total a pagar</span><span style="color:#121e31">$${total}</span>
          </div>
        </div>

        <div style="background:#fdfaf2;border:1px solid #eed699;border-radius:10px;padding:.875rem;margin-bottom:1.25rem;font-size:.8rem;color:#7a6b3a;text-align:left">
          <strong>¿Qué sigue?</strong><br>
          Preséntate en el mostrador de MediConnect con el folio <strong>#${String(data.id_solicitud).padStart(5,'0')}</strong>.
          El personal confirmará tu solicitud, realizará el cobro y entregará tus productos.
        </div>

        <button onclick="this.closest('div[style]').remove()" style="width:100%;padding:.8rem;background:#121e31;color:#e6c280;font-weight:700;border:none;border-radius:12px;cursor:pointer;font-family:'Manrope',sans-serif;font-size:.9rem">
          Entendido
        </button>
      </div>`;
    document.body.appendChild(overlay);
}

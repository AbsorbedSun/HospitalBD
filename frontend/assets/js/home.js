
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


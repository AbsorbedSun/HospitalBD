// Dashboard Recepcionista - Navegación entre vistas

document.addEventListener('DOMContentLoaded', function() {
    // Cargar vista inicial
    loadView('dashboard');
    
    // Event listeners para navegación
    const navItems = document.querySelectorAll('.nav-item:not(.logout-btn)');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remover clase active de todos
            navItems.forEach(nav => nav.classList.remove('active'));
            // Agregar clase active al clickeado
            this.classList.add('active');
            
            // Cargar vista
            const view = this.dataset.view;
            loadView(view);
        });
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
            window.location.href = 'index.html';
        }
    });
});

function loadView(viewName) {
    const container = document.getElementById('contentContainer');
    const template = document.getElementById(viewName + '-template');
    
    if (!template) {
        console.error('Template no encontrado:', viewName);
        return;
    }
    
    // Actualizar título y subtítulo
    const titles = {
        'dashboard': {
            title: 'Dashboard General',
            subtitle: 'Gestión integral del hospital'
        },
        'citas': {
            title: 'Gestión de Citas',
            subtitle: 'Administra todas las citas del hospital'
        },
        'pacientes': {
            title: 'Pacientes',
            subtitle: 'Gestiona el registro de pacientes'
        },
        'doctores': {
            title: 'Doctores',
            subtitle: 'Gestiona el registro de doctores'
        },
        'farmacia': {
            title: 'Farmacia',
            subtitle: 'Inventario y gestión de medicamentos'
        },
        'bitacora': {
            title: 'Bitácora',
            subtitle: 'Registro de actividades del sistema'
        }
    };
    
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    
    if (titles[viewName]) {
        pageTitle.textContent = titles[viewName].title;
        pageSubtitle.textContent = titles[viewName].subtitle;
    }
    
    // Limpiar contenedor y cargar nuevo contenido
    container.innerHTML = '';
    const content = template.content.cloneNode(true);
    container.appendChild(content);
}

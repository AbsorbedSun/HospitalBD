// Dashboard Doctor - Navegación entre vistas

document.addEventListener('DOMContentLoaded', function() {
    // Cargar vista inicial
    loadView('datos-doctor');
    
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
        'datos-doctor': {
            title: 'Datos del Doctor',
            subtitle: 'Gestiona tu información profesional'
        },
        'citas': {
            title: 'Mis Citas',
            subtitle: 'Gestiona las citas de tus pacientes'
        },
        'pacientes': {
            title: 'Mis Pacientes',
            subtitle: 'Lista de pacientes bajo tu cuidado'
        },
        'recetas': {
            title: 'Recetas Médicas',
            subtitle: 'Crea y gestiona recetas médicas'
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

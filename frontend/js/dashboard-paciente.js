// Dashboard Paciente - Navegación entre vistas

document.addEventListener('DOMContentLoaded', function() {
    // Cargar vista inicial
    loadView('datos-personales');
    
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
        'datos-personales': {
            title: 'Datos Personales',
            subtitle: 'Gestiona tu información personal'
        },
        'citas-agendadas': {
            title: 'Citas Agendadas',
            subtitle: 'Visualiza y gestiona tus citas'
        },
        'agendar-cita': {
            title: 'Agendar Nueva Cita',
            subtitle: 'Programa tu próxima consulta médica'
        },
        'historial-medico': {
            title: 'Historial Médico',
            subtitle: 'Consulta tu información médica completa'
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

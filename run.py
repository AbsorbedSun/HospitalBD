"""
MediConnect – Punto de entrada unificado
========================================
Un solo proceso sirve la API REST y el frontend estático.

Uso:
    python run.py

Todo en http://127.0.0.1:5000
    /            → index.html (landing page)
    /pages/auth/login.html        → login
    /pages/auth/register.html     → registro
    /pages/dashboard/*.html       → dashboards
    /assets/css/*                 → hojas de estilo (Flask nativo)
    /assets/js/*                  → scripts          (Flask nativo)
    /api/*       → API REST (blueprints Flask)
"""
import sys
import os

ROOT_DIR     = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR  = os.path.join(ROOT_DIR, 'backend')
FRONTEND_DIR = os.path.join(ROOT_DIR, 'frontend')

sys.path.insert(0, BACKEND_DIR)

from flask import send_from_directory
from app import create_app
from config import Config


def build_app():
    # Pasamos static_folder y static_url_path AL CONSTRUCTOR de Flask
    # (no después de crearlo). Esto registra la ruta /<path:filename>
    # correctamente desde el inicio, sirviendo CSS, JS e imágenes.
    app = create_app(
        static_folder=FRONTEND_DIR,
        static_url_path=''          # sirve archivos en la raíz, sin prefijo /static/
    )

    # Solo necesitamos una ruta extra: el root /, porque Flask no
    # hace directory listing (no sabe que / → index.html).
    # Los .html, .css, .js se sirven automáticamente por el static handler.
    @app.route('/')
    def index():
        return send_from_directory(FRONTEND_DIR, 'index.html')

    return app


if __name__ == '__main__':
    app = build_app()

    print()
    print("=" * 58)
    print("  MediConnect  -  Sistema de Gestion Hospitalaria")
    print("=" * 58)
    print(f"  Aplicacion:  http://127.0.0.1:{Config.PORT}")
    print(f"  Health:      http://127.0.0.1:{Config.PORT}/api/health")
    print(f"  Debug:       {Config.DEBUG}")
    print(f"  BD:          {Config.DB_SERVER}/{Config.DB_DATABASE}")
    print("=" * 58)
    print("  Ctrl+C para detener")
    print()

    app.run(
        host='127.0.0.1',
        port=Config.PORT,
        debug=Config.DEBUG,
        use_reloader=Config.DEBUG
    )

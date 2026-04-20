"""
Punto de entrada del backend Flask.
Sistema de Gestión Hospitalaria - IPN ESCOM

Arrancar:
    cd backend
    pip install -r requirements.txt
    cp .env.example .env   # y editar con credenciales SQL Server
    python app.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta

from config import Config

# ── Importar blueprints ──────────────────────────────────────────
from routes.auth           import auth_bp
from routes.especialidades import esp_bp
from routes.pacientes      import paciente_bp
from routes.doctores       import doctor_bp
from routes.citas          import citas_bp
from routes.recepcionistas import recep_bp
from routes.farmacia       import farmacia_bp


def create_app():
    app = Flask(__name__)

    # ── Configuración ────────────────────────────────────────────
    app.config['JWT_SECRET_KEY']        = Config.JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=Config.JWT_EXPIRATION_HOURS)

    # ── Extensiones ──────────────────────────────────────────────
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    JWTManager(app)

    # ── Registrar blueprints ─────────────────────────────────────
    app.register_blueprint(auth_bp,      url_prefix='/api/auth')
    app.register_blueprint(esp_bp,       url_prefix='/api/especialidades')
    app.register_blueprint(paciente_bp,  url_prefix='/api/pacientes')
    app.register_blueprint(doctor_bp,    url_prefix='/api/doctores')
    app.register_blueprint(citas_bp,     url_prefix='/api/citas')
    app.register_blueprint(recep_bp,     url_prefix='/api/recepcionistas')
    app.register_blueprint(farmacia_bp,  url_prefix='/api/farmacia')

    # ── Ruta de salud ────────────────────────────────────────────
    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok', 'mensaje': 'Backend Hospital activo'}), 200

    # ── Manejadores de error globales ────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Endpoint no encontrado.'}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({'error': 'Método HTTP no permitido.'}), 405

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({'error': 'Error interno del servidor.'}), 500

    return app


if __name__ == '__main__':
    app = create_app()
    print("=" * 55)
    print("  🏥  Backend Hospital  –  Flask + SQL Server")
    print("=" * 55)
    print(f"  URL:    http://localhost:{Config.PORT}")
    print(f"  Debug:  {Config.DEBUG}")
    print(f"  DB:     {Config.DB_SERVER}/{Config.DB_DATABASE}")
    print("=" * 55)
    app.run(host='0.0.0.0', port=Config.PORT, debug=Config.DEBUG)

"""
Módulo principal del backend Flask.
Sistema de Gestión Hospitalaria - IPN ESCOM

Para arrancar el sistema completo usar desde la raíz del proyecto:
    python run.py          ← Servidor unificado (API + frontend)

Este archivo puede seguir ejecutándose directamente solo para
desarrollar el backend de forma aislada (sin servir el frontend).
"""
import sys
import os
import traceback
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta

from config import Config

from api.auth           import auth_bp
from api.especialidades import esp_bp
from api.pacientes      import paciente_bp
from api.doctores       import doctor_bp
from api.citas          import citas_bp
from api.recepcionistas import recep_bp
from api.farmacia       import farmacia_bp


def create_app(**flask_kwargs):
    app = Flask(__name__, **flask_kwargs)

    # ── Configuración JWT ────────────────────────────────────────
    app.config['JWT_SECRET_KEY']           = Config.JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=Config.JWT_EXPIRATION_HOURS)

    # ── CORS ────────────────────────────────────────────────────
    # Con el servidor unificado (run.py) frontend y API comparten
    # el mismo origen, por lo que CORS no es necesario en producción.
    # Se mantiene solo para permitir Live Server de VS Code en desarrollo.
    CORS(app,
         resources={r"/api/*": {"origins": [
             "http://127.0.0.1:5000",   # Servidor unificado (run.py)
             "http://localhost:5000",
             "http://127.0.0.1:5500",   # Live Server de VS Code
             "http://localhost:5500",
         ]}},
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

    JWTManager(app)

    # ── Registrar blueprints ─────────────────────────────────────
    app.register_blueprint(auth_bp,      url_prefix='/api/auth')
    app.register_blueprint(esp_bp,       url_prefix='/api/especialidades')
    app.register_blueprint(paciente_bp,  url_prefix='/api/pacientes')
    app.register_blueprint(doctor_bp,    url_prefix='/api/doctores')
    app.register_blueprint(citas_bp,     url_prefix='/api/citas')
    app.register_blueprint(recep_bp,     url_prefix='/api/recepcionistas')
    app.register_blueprint(farmacia_bp,  url_prefix='/api/farmacia')

    # ── Health check ─────────────────────────────────────────────
    @app.route('/api/health')
    def health():
        # También prueba la conexión a la BD
        try:
            from db.connection import execute_query
            execute_query("SELECT 1 AS ok")
            db_status = "conectada"
        except Exception as e:
            db_status = f"ERROR: {str(e)}"
        return jsonify({
            'status':    'ok',
            'mensaje':   'Backend Hospital activo',
            'base_datos': db_status
        }), 200

    # ── Manejadores de error globales ────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Endpoint no encontrado.'}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({'error': 'Método HTTP no permitido.'}), 405

    @app.errorhandler(Exception)
    def handle_exception(e):
        # Loguear el traceback completo en la consola del servidor
        traceback.print_exc()
        return jsonify({'error': f'Error interno: {str(e)}'}), 500

    return app


if __name__ == '__main__':
    app = create_app()
    print("=" * 60)
    print("  🏥  Backend Hospital  –  Flask + SQL Server")
    print("=" * 60)
    print(f"  URL:      http://127.0.0.1:{Config.PORT}")
    print(f"  Health:   http://127.0.0.1:{Config.PORT}/api/health")
    print(f"  Debug:    {Config.DEBUG}")
    print(f"  BD:       {Config.DB_SERVER}/{Config.DB_DATABASE}")
    print("=" * 60)
    print("  Usar run.py desde la raíz para arranque unificado.")
    print("=" * 60)
    # Bind en 127.0.0.1 para consistencia con el frontend
    app.run(host='127.0.0.1', port=Config.PORT, debug=Config.DEBUG)

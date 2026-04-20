"""
Configuración central del backend.
Carga variables de entorno desde .env
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Servidor
    PORT = int(os.getenv("FLASK_PORT", 5000))
    DEBUG = os.getenv("FLASK_DEBUG", "True").lower() == "true"

    # JWT
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-prod")
    JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 8))

    # SQL Server
    DB_SERVER   = os.getenv("DB_SERVER", "localhost")
    DB_DATABASE = os.getenv("DB_DATABASE", "HospitalDB")
    DB_USER     = os.getenv("DB_USER", "sa")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_PORT     = int(os.getenv("DB_PORT", 1433))

    @classmethod
    def get_connection_string(cls):
        """Cadena de conexión ODBC para SQL Server."""
        return (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={cls.DB_SERVER},{cls.DB_PORT};"
            f"DATABASE={cls.DB_DATABASE};"
            f"UID={cls.DB_USER};"
            f"PWD={cls.DB_PASSWORD};"
            "Encrypt=no;"
            "TrustServerCertificate=yes;"
        )

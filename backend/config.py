"""
Configuración central del backend.
Carga variables de entorno desde .env
"""
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

class Config:
    # Servidor
    PORT  = int(os.getenv("FLASK_PORT", 5000))
    DEBUG = os.getenv("FLASK_DEBUG", "True").lower() == "true"

    # JWT
    JWT_SECRET_KEY      = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-prod")
    JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 8))

    # SQL Server — parámetros comunes
    DB_SERVER   = os.getenv("DB_SERVER",   "localhost")
    DB_DATABASE = os.getenv("DB_DATABASE", "HospitalDB")
    DB_PORT     = int(os.getenv("DB_PORT", 1433))

    # Modo de autenticación: "windows" (por defecto) o "sql"
    DB_AUTH_MODE = os.getenv("DB_AUTH_MODE", "windows").lower()

    # Solo necesarios cuando DB_AUTH_MODE=sql
    DB_USER     = os.getenv("DB_USER",     "")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")

    @classmethod
    def get_connection_string(cls):
        """
        Construye la cadena de conexión ODBC según el modo de autenticación.

        DB_AUTH_MODE=windows  →  Autenticación de Windows (Trusted_Connection)
                                  No requiere DB_USER ni DB_PASSWORD.
                                  El proceso debe correr con un usuario de Windows
                                  que tenga acceso al servidor SQL Server.

        DB_AUTH_MODE=sql      →  Autenticación SQL Server (UID + PWD).
                                  Requiere DB_USER y DB_PASSWORD en el .env.
        """
        base = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={cls.DB_SERVER},{cls.DB_PORT};"
            f"DATABASE={cls.DB_DATABASE};"
            "Encrypt=no;"
            "TrustServerCertificate=yes;"
        )

        if cls.DB_AUTH_MODE == "sql":
            if not cls.DB_USER or not cls.DB_PASSWORD:
                raise RuntimeError(
                    "DB_AUTH_MODE=sql requiere DB_USER y DB_PASSWORD en el archivo .env"
                )
            return base + f"UID={cls.DB_USER};PWD={cls.DB_PASSWORD};"

        # Modo por defecto: Windows Authentication
        return base + "Trusted_Connection=yes;"

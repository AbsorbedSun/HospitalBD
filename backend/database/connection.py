"""
Módulo de conexión a SQL Server usando pyodbc.
Proporciona una función get_db() que abre y cierra
conexiones de forma segura.
"""
import pyodbc
from config import Config


def get_db():
    """
    Crea y retorna una conexión a SQL Server.
    Usar con 'with' para garantizar el cierre:

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(...)
    """
    conn = pyodbc.connect(Config.get_connection_string())
    conn.autocommit = False  # Manejar transacciones manualmente
    return conn


def execute_query(sql, params=None, fetch=True):
    """
    Ejecuta una consulta SELECT y retorna los resultados como
    lista de diccionarios.

    :param sql:    Sentencia SQL con placeholders (?)
    :param params: Tupla de parámetros (o None)
    :param fetch:  True → retorna filas, False → retorna rowcount
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params or ())
        if fetch:
            columns = [col[0] for col in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.commit()
        return cursor.rowcount


def execute_non_query(sql, params=None):
    """
    Ejecuta INSERT / UPDATE / DELETE dentro de una transacción.
    Retorna el número de filas afectadas.
    """
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params or ())
        conn.commit()
        return cursor.rowcount
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def execute_insert_returning_id(sql, params=None):
    """
    Ejecuta un INSERT y retorna el ID generado (SCOPE_IDENTITY).
    La sentencia SQL debe terminar con SELECT SCOPE_IDENTITY().
    """
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params or ())
        row = cursor.fetchone()
        conn.commit()
        return int(row[0]) if row and row[0] is not None else None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

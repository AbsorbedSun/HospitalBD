"""
Módulo de conexión a SQL Server usando pyodbc.
CORREGIDO: manejo explícito de conexiones, sin context manager de pyodbc.
"""
import pyodbc
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import Config


def get_db():
    """Crea y retorna una conexión a SQL Server."""
    conn = pyodbc.connect(Config.get_connection_string(), timeout=10)
    conn.autocommit = False
    return conn


def execute_query(sql, params=None):
    """
    Ejecuta un SELECT y retorna lista de dicts.
    Abre y cierra la conexión correctamente.
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(sql, params or ())
        # cursor.description puede ser None si la consulta no retorna filas
        if cursor.description is None:
            return []
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
        return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        raise RuntimeError(f"Error en execute_query: {e}") from e
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def execute_non_query(sql, params=None):
    """
    Ejecuta INSERT / UPDATE / DELETE.
    Retorna el número de filas afectadas.
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(sql, params or ())
        conn.commit()
        return cursor.rowcount
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        raise RuntimeError(f"Error en execute_non_query: {e}") from e
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def execute_insert_returning_id(sql, params=None):
    """
    Ejecuta un INSERT y retorna el ID generado.

    Soporta dos patrones de SQL Server:
      1. OUTPUT INSERTED.<col>  →  el propio INSERT devuelve una fila (recomendado).
      2. INSERT ...; SELECT SCOPE_IDENTITY();  →  dos sentencias; pyodbc requiere
         nextset() para avanzar al resultado del SELECT.

    Usar preferentemente el patrón OUTPUT INSERTED para evitar ambigüedades.
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(sql, params or ())

        # Intentar leer el resultado del conjunto actual.
        # Con OUTPUT INSERTED esto funciona directamente.
        row = cursor.fetchone()

        # Si no hay resultado, puede ser el patrón INSERT; SELECT SCOPE_IDENTITY()
        # donde pyodbc deja el cursor en el result-set vacío del INSERT.
        # Avanzamos al siguiente result-set (el SELECT) con nextset().
        if row is None and cursor.nextset():
            row = cursor.fetchone()

        conn.commit()
        if row is None or row[0] is None:
            return None
        return int(row[0])
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        raise RuntimeError(f"Error en execute_insert_returning_id: {e}") from e
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass

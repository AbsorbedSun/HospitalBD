"""
Funciones de utilidad compartidas entre rutas.
"""
from datetime import datetime, date, timedelta
from decimal import Decimal
import json


def serialize(obj):
    """
    Serializa objetos Python no-JSON-nativos a tipos JSON compatibles.
    Útil para convertir resultados de pyodbc a JSON.
    """
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Tipo no serializable: {type(obj)}")


def rows_to_json(rows):
    """
    Convierte una lista de dicts (resultado de pyodbc) a JSON seguro.
    """
    return json.loads(json.dumps(rows, default=serialize))


def calcular_politica_cancelacion(fecha_cita: date, hora_cita) -> dict:
    """
    Calcula el porcentaje de devolución según la política de cancelación.

    Reglas:
      ≥ 48h antes → 100% devuelto
      ≥ 24h antes → 50% devuelto
      < 24h antes → 0% devuelto

    :param fecha_cita: Fecha de la cita (date)
    :param hora_cita:  Hora de la cita (time o timedelta)
    :return: dict con 'porcentaje' y 'politica' (etiqueta)
    """
    # Construir datetime completo de la cita
    if isinstance(hora_cita, timedelta):
        segundos = int(hora_cita.total_seconds())
        hora_cita = (datetime.min + hora_cita).time()

    cita_dt = datetime.combine(fecha_cita, hora_cita)
    ahora = datetime.now()
    diferencia = cita_dt - ahora

    horas_restantes = diferencia.total_seconds() / 3600

    if horas_restantes >= 48:
        return {'porcentaje': 100, 'politica': '100%'}
    elif horas_restantes >= 24:
        return {'porcentaje': 50, 'politica': '50%'}
    else:
        return {'porcentaje': 0, 'politica': '0%'}


def calcular_monto_devolucion(monto_pagado: float, porcentaje: int) -> float:
    """Calcula el monto a devolver según el porcentaje."""
    return round(monto_pagado * porcentaje / 100, 2)


def validar_ventana_cita(fecha_cita: date) -> dict:
    """
    Valida que la fecha de la cita esté dentro de la ventana permitida:
    mínimo 48h y máximo 3 meses desde ahora.

    :return: dict con 'valido' (bool) y 'error' (str) si no es válido
    """
    ahora = datetime.now()
    minima = ahora + timedelta(hours=48)
    maxima = ahora + timedelta(days=90)  # ~3 meses

    cita_dt = datetime.combine(fecha_cita, datetime.min.time())

    if cita_dt < minima:
        return {'valido': False, 'error': 'La cita debe agendarse con al menos 48 horas de anticipación.'}
    if cita_dt > maxima:
        return {'valido': False, 'error': 'La cita no puede agendarse con más de 3 meses de anticipación.'}
    return {'valido': True}
